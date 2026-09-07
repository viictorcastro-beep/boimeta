import { calculateCore, type Assumptions } from './livestock-model.ts';
import { rearingOnly } from './rearing-model.ts';
import { calculateMonthlyCashFlow, type CashEvent } from './operational-model.ts';

export type CampaignInput = {
  a: Assumptions;
  anchor: string;
  gateNetPrice: number;
  setupDays: number;
  setupCost: number;
  reserveCash: number;
  openingSilageTonnesDm: number;
  silageFirstReleaseDays: number;
  silageCutIntervalDays: number;
};
export type CampaignRoute = 'A' | 'B' | 'C';
export const CAMPAIGN_ENTRY_DAYS = 365;
const DAY = 86_400_000;
const MAX_DAYS = 36_500;

/** Campanha finita: 365 coortes diárias equivalentes, nenhuma recompra na cauda.
 * Preços nominais constantes; mortalidade no fim de cada fase, como no núcleo.
 * Um programa de silagem (cortes inteiros), sem repetir safras automaticamente.
 * Restrição diária de UA, vagas e estoque ANTES de calcular receita.
 */
export function closeCampaign(input: CampaignInput, route: CampaignRoute) {
  const a = { ...input.a, includeCows: false, includeEffluentSavings: false };
  const start = Date.parse(`${input.anchor}T12:00:00Z`);
  const c = calculateCore(a), r = rearingOnly(a, input.gateNetPrice);
  const pastureDays = route === 'A' ? c.daysPivotA : route === 'B' ? c.daysB : r.days;
  const feedDays = route === 'A' ? c.daysFeedlot : 0;
  const animalDays = pastureDays + feedDays;
  const error = (message: string) => ({ route, error: message, result: null });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.anchor) || !Number.isFinite(start) ||
      new Date(start).toISOString().slice(0, 10) !== input.anchor)
    return error('Informe uma data de entrada válida para fechar a campanha.');
  if (!(route === 'A' ? c.routeAInputValid : route === 'B' ? c.routeBInputValid : r.valid) ||
      !(a.totalArea > 0) || !Number.isFinite(animalDays) || animalDays < 1)
    return error('Confira pesos crescentes, área positiva e GMD maior que zero.');
  if ([a.entryWeight, a.pivotExitWeight, a.saleWeight, a.totalArea,
    route === 'B' ? a.gmdB : a.gmdPivotA, ...(route === 'A' ? [a.gmdFeedlot] : [])].some(x => !Number.isFinite(x)))
    return error('Área, pesos e ganhos devem ser números finitos.');
  const nonnegative = [a.stockingUa, a.calfCost, a.priceArroba, a.landLeaseHa, a.dietDmDay,
    a.dietPriceDm, a.otherCostFactor, a.pivotInvestment, a.investment, input.setupDays,
    input.setupCost, input.reserveCash, input.openingSilageTonnesDm,
    input.silageFirstReleaseDays, input.silageCutIntervalDays, input.gateNetPrice,
    ...(a.feedlotCapacity === undefined ? [] : [a.feedlotCapacity])];
  if (nonnegative.some(x => !Number.isFinite(x) || x < 0))
    return error('Custos, capacidade, prazos e estoques devem ser números não negativos.');
  if ([a.silageRecovery, a.silageShare, a.forageShare, a.feedlotUtilization ?? 100,
    a.pastureMortalityPercent ?? 0.2, a.feedlotMortalityPercent ?? 0].some(x => !Number.isFinite(x) || x < 0 || x > 100))
    return error('Recuperação, área, volumoso, utilização e mortalidade devem estar entre 0% e 100%.');
  if (route === 'A' && (!Number.isInteger(a.silageCrops) || a.silageCrops < 0 || a.silageCrops > 12 ||
      (a.silageCrops > 1 && input.silageCutIntervalDays < 1)))
    return error('Use cortes inteiros de silagem (0 a 12) e intervalo positivo entre cortes.');
  const date = (day: number) => new Date(start + day * DAY).toISOString().slice(0, 10);
  const setup = Math.ceil(input.setupDays);
  const opening = route === 'A' ? input.openingSilageTonnesDm * 1000 : 0;
  const firstSilo = setup + Math.ceil(input.silageFirstReleaseDays);
  // Não herdar o teto ANUAL de silagem: estoque inicial também pode financiar a dieta.
  const physicalA = Math.min(c.pastureEntryCapacityA, a.feedlotCapacity === undefined || c.pastureSurvival === 0
    ? Infinity : a.feedlotCapacity * (a.feedlotUtilization ?? 100) / 100 * 365 / feedDays / c.pastureSurvival);
  const rawEntrants = route === 'A' ? physicalA : route === 'B' ? c.entrantsB : r.entrants;
  const rawRate = rawEntrants / CAMPAIGN_ENTRY_DAYS;
  if (!Number.isFinite(rawRate)) return error('A capacidade calculada não é finita. Confira lotação, pesos e ganhos.');
  // Menor atraso inteiro que evita consumo além do estoque antes do primeiro corte.
  // Adicionar um pouco de estoque não pode eliminar todo o atraso e inviabilizar o lote.
  let foodDelay = 0;
  if (route === 'A' && a.forageShare > 0 && a.silageCrops > 0 && c.silageArea > 0) {
    let low = 0, high = Math.max(0, firstSilo - setup - pastureDays);
    const demandBeforeFirstCut = (delay: number) => Array.from({ length: 365 }, (_, j) =>
      Math.min(feedDays, Math.max(0, firstSilo - setup - delay - j - pastureDays)))
      .reduce((sum, days) => sum + days, 0) * rawRate * c.pastureSurvival * a.dietDmDay * a.forageShare / 100;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (demandBeforeFirstCut(middle) <= opening) high = middle; else low = middle + 1;
    }
    foodDelay = low;
  }
  const firstEntry = setup + foodDelay;
  const lastEntry = firstEntry + CAMPAIGN_ENTRY_DAYS - 1;
  const endDay = lastEntry + animalDays;
  if (endDay > MAX_DAYS) return error('O ciclo excede 100 anos. Revise os ganhos e prazos; nenhum dia foi cortado do resultado.');
  const cuts = route === 'A' && c.silageArea > 0
    ? Array.from({ length: a.silageCrops }, (_, j) => ({
      day: firstSilo + j * Math.ceil(input.silageCutIntervalDays),
      kg: c.silageArea * a.silageYieldDm * 1000 * a.silageRecovery / 100,
      cost: c.silageArea * a.silageCostHaCut * a.otherCostFactor / 100,
    })).filter(cut => cut.day <= endDay) : [];
  if (cuts.some(cut => !Number.isFinite(cut.kg) || cut.kg < 0 || !Number.isFinite(cut.cost) || cut.cost < 0))
    return error('Confira produtividade, recuperação e custo da silagem.');
  const pastureArea = route === 'A' ? c.pastureAreaA : a.totalArea;
  const uaLimit = pastureArea * a.stockingUa;
  const feedLimit = route === 'A' && a.feedlotCapacity !== undefined
    ? a.feedlotCapacity * Math.min(100, Math.max(0, a.feedlotUtilization ?? 100)) / 100 : null;
  const gmd = route === 'B' ? a.gmdB : a.gmdPivotA;
  const target = route === 'B' ? a.saleWeight : a.pivotExitWeight;
  // Número de coortes ativas e soma de suas idades, em O(1) por dia.
  const ages = (day: number, shift: number, length: number) => {
    const low = Math.max(0, day - lastEntry - shift);
    const high = Math.min(length - 1, day - firstEntry - shift);
    const count = Math.max(0, high - low + 1);
    return { count, sum: count * (low + high) / 2, high };
  };
  let rawPeakUa = 0, rawPeakFeed = 0, consumed = 0, supply = opening;
  let scale = 1;
  const schedule = Array.from({ length: endDay + 1 }, (_, day) => {
    const p = ages(day, 0, pastureDays), f = ages(day, pastureDays, feedDays);
    // Peso ao FINAL do dia: protege o limite diário, não só o peso médio de regime.
    const roundingExcess = p.count > 0 && p.high === pastureDays - 1
      ? Math.max(0, a.entryWeight + gmd * pastureDays - target) : 0;
    const ua = rawRate * (p.count * a.entryWeight + gmd * (p.sum + p.count) - roundingExcess) / 450;
    const feedHeads = f.count * rawRate * c.pastureSurvival;
    rawPeakUa = Math.max(rawPeakUa, ua);
    rawPeakFeed = Math.max(rawPeakFeed, feedHeads);
    supply += cuts.filter(cut => cut.day === day).reduce((sum, cut) => sum + cut.kg, 0);
    consumed += feedHeads * a.dietDmDay * a.forageShare / 100;
    if (consumed > 0) scale = Math.min(scale, supply / consumed);
    return { day, pastureHeads: p.count * rawRate, feedHeads };
  });
  if (rawPeakUa > 0) scale = Math.min(scale, uaLimit / rawPeakUa);
  if (feedLimit !== null && rawPeakFeed > 0) scale = Math.min(scale, feedLimit / rawPeakFeed);
  scale = Math.max(0, Math.min(1, scale));
  const rate = rawRate * scale;
  const bought = rate * CAMPAIGN_ENTRY_DAYS;
  const feedEntered = route === 'A' ? bought * c.pastureSurvival : 0;
  const sold = bought * c.pastureSurvival * (route === 'A' ? c.feedlotSurvival : 1);
  const deadPasture = bought * (1 - c.pastureSurvival);
  const deadFeed = feedEntered * (1 - c.feedlotSurvival);
  const factor = a.otherCostFactor / 100;
  const components = route === 'A' ? c.costComponentsA : c.costComponentsB;
  const freightIn = route === 'C' ? r.freightIn : components.freightIn;
  const phaseCost = route === 'C' ? r.supplement + r.health : components.supplement + components.health;
  const salePrice = route === 'A' ? c.netSaleA : route === 'B' ? c.netSaleB : a.pivotExitWeight * input.gateNetPrice;
  const saleFreight = route === 'C' ? 0 : components.freightOut;
  const pastureAnnual = route === 'C' ? r.pastureCost :
    (route === 'A' ? c.annualPastureOperatingA : c.annualPastureOperatingB) * factor;
  const areaDaily = (pastureAnnual + a.totalArea * a.landLeaseHa) / 365;
  const capex = a.pivotInvestment + input.setupCost + (route === 'A' ? a.investment : 0);
  const silageBudget = cuts.reduce((sum, cut) => sum + cut.cost, 0);
  // Estoque inicial não é receita gratuita: valorar pelo custo local de reposição disponível.
  const silageUnitCost = a.silageYieldDm > 0 && a.silageRecovery > 0
    ? a.silageCostHaCut / (a.silageYieldDm * 1000 * a.silageRecovery / 100) : 0;
  if (opening > 0 && !(silageUnitCost > 0))
    return error('Estoque inicial de silagem exige custo de reposição: confira custo por corte, produtividade e recuperação.');
  const openingBudget = opening * silageUnitCost * factor;
  const feedVariableHead = Math.max(0, a.dietDmDay * feedDays * a.dietPriceDm -
    a.dietDmDay * feedDays * a.forageShare / 100 * silageUnitCost) * factor + c.costComponentsA.feedlotOperation;
  const events: CashEvent[] = [{ date: input.anchor, label: 'Implantação/CAPEX', inflow: 0, outflow: capex },
    { date: input.anchor, label: 'Reserva de custeio dos cortes programados + estoque inicial de silagem', inflow: 0, outflow: silageBudget + openingBudget }];
  let revenue = 0, variableCost = 0, stock = opening, minimumStock = opening;
  let firstYearSales = 0, firstYearBought = 0;
  for (const row of schedule) {
    const { day } = row;
    const purchase = day >= firstEntry && day <= lastEntry ? rate : 0;
    const sales = day >= firstEntry + animalDays && day <= endDay
      ? rate * c.pastureSurvival * (route === 'A' ? c.feedlotSurvival : 1) : 0;
    if (day < 365) { firstYearBought += purchase; firstYearSales += sales; }
    const direct = purchase * (a.calfCost + freightIn) + row.pastureHeads * scale * phaseCost / pastureDays +
      (feedDays > 0 ? row.feedHeads * scale * feedVariableHead / feedDays : 0) + sales * saleFreight;
    const receipts = sales * salePrice;
    variableCost += direct;
    revenue += receipts;
    stock += cuts.filter(cut => cut.day === day).reduce((sum, cut) => sum + cut.kg, 0) -
      row.feedHeads * scale * a.dietDmDay * a.forageShare / 100;
    minimumStock = Math.min(minimumStock, stock);
    events.push({ date: date(day), label: 'Compras, fases e custeio da área (pagamento antes do recebimento)', inflow: 0,
      outflow: direct + (day < endDay ? areaDaily : 0) });
    if (receipts > 0) events.push({ date: date(day), label: 'Venda dos bois', inflow: receipts, outflow: 0 });
  }
  const areaCost = areaDaily * endDay;
  const operatingCost = variableCost + areaCost + silageBudget + openingBudget;
  const margin = revenue - operatingCost;
  const cash = calculateMonthlyCashFlow(events);
  const annualEquivalent = margin * 365 / endDay;
  const ledger = (label: string, quantity: number, unit: string, unitPrice: number, source: string) =>
    ({ label, quantity, unit, unitPrice, total: quantity * unitPrice, source });
  const supplementKgHead = route === 'B' ? 105.3 * pastureDays / 300 : 28.4 * pastureDays / (160 / 0.9);
  const feedDm = feedEntered * feedDays * a.dietDmDay;
  const costLines = [
    ledger('Compra de bezerros', bought, 'cab', a.calfCost, 'Preço de reposição do cenário; confirmar praça/data e cotação'),
    ledger('Frete de compra', bought, 'cab', freightIn, 'Referência R$ 50/cab × fator de custos'),
    ledger('Suplemento no pasto', bought * supplementKgHead, 'kg', a.supplementPrice * factor,
      route === 'B' ? '105,3 kg/cab em 300 dias × duração/300; preço editável × fator' : '28,4 kg/cab em 160/0,90 dias × duração/referência; preço editável × fator'),
    ledger('Sanidade e manejo', bought, 'cab', route === 'C' ? r.health : components.health, 'Referência R$ 45/cab × fator de custos'),
    ledger('Dieta do cocho sem silagem', feedDm, 'kg MS',
      Math.max(0, a.dietPriceDm - a.forageShare / 100 * silageUnitCost) * factor,
      'Preço da dieta − fração de silagem × custo/kg MS da silagem; piso zero × fator. Silagem paga nas linhas próprias'),
    ledger('Operação do confinamento', feedEntered * feedDays, 'cabeça-dia',
      141.89 / (140 / 1.48) * factor, 'Referência R$ 141,89/cab em 140/1,48 dias; proporcional aos dias × fator'),
    ledger('Frete de venda', sold, 'cab', saleFreight,
      route === 'C' ? 'Preço do magro já líquido na porteira; sem novo frete' : 'Referência R$ 19,90/cab vendido × fator'),
    ledger('Pasto e irrigação: custeio agregado', pastureArea * endDay / 365, 'ha-ano',
      pastureArea > 0 ? pastureAnnual / pastureArea : 0,
      route === 'B' ? '4.373 × R$ 930,89 ÷ 400 ha + adicional de intensificação; × fator. Benchmark, não orçamento local aberto'
        : '6.725 × (R$ 432,62 + R$ 19,97) ÷ 300 ha + adicional de intensificação; × fator. Benchmark, não orçamento local aberto'),
    ledger('Arrendamento de toda a área', a.totalArea * endDay / 365, 'ha-ano', a.landLeaseHa, 'R$/ha/ano informado; inclui área reservada/ociosa'),
    ledger('Produção de silagem programada', route === 'A' ? c.silageArea * cuts.length : 0, 'ha-corte',
      a.silageCostHaCut * factor, 'Cortes liberados até encerramento × área; custo/ha/corte informado × fator'),
    ledger('Estoque inicial de silagem', opening, 'kg MS', silageUnitCost * factor,
      'Custo por corte ÷ (t MS/ha/corte × 1.000 × recuperação) × fator; reposição a confirmar'),
  ];
  return { route, error: null, result: {
    route, pastureArea, totalArea: a.totalArea, animalDays, pastureDays, feedDays,
    startDate: input.anchor, firstPurchaseDate: date(firstEntry), lastPurchaseDate: date(lastEntry),
    firstSaleDate: date(firstEntry + animalDays), finalSaleDate: date(endDay), elapsedDays: endDay, foodDelay,
    bought, sold, feedEntered, deadPasture, deadFeed, closingHeads: bought - sold - deadPasture - deadFeed,
    firstYearBought, firstYearSales, revenue, variableCost, areaCost, silageBudget, openingBudget,
    operatingCost, margin, marginHa: margin / a.totalArea, annualEquivalent,
    annualEquivalentHa: annualEquivalent / a.totalArea, capex, netCashAfterCapex: margin - capex,
    requiredCapital: cash.peakFundingNeed + input.reserveCash, reserveCash: input.reserveCash,
    cash, events, scale, peakUa: rawPeakUa * scale, uaLimit, peakFeedHeads: rawPeakFeed * scale, feedLimit,
    silageProducedKg: cuts.reduce((sum, cut) => sum + cut.kg, 0), silageOpeningKg: opening,
    silageConsumedKg: consumed * scale, silageEndingKg: Math.max(0, stock), silageMinimumKg: minimumStock,
    cuts: cuts.map(cut => ({ ...cut, date: date(cut.day) })),
    cutsBeyondCampaign: route === 'A' && c.silageArea > 0 ? a.silageCrops - cuts.length : 0,
    salePriceHead: salePrice,
    costLines,
    calculationBasis: {
      entryWeight: a.entryWeight, pastureExitWeight: target, saleWeight: route === 'C' ? a.pivotExitWeight : a.saleWeight,
      pastureGmd: gmd, feedlotGmd: route === 'A' ? a.gmdFeedlot : null,
      pastureSurvival: c.pastureSurvival, feedlotSurvival: route === 'A' ? c.feedlotSurvival : null,
      stockingUa: a.stockingUa, physicalEntrantsBeforeDailyLimits: rawEntrants,
      carcassYield: route === 'C' ? null : route === 'A' ? Math.min(100, a.carcassYieldPercent + a.feedlotCarcassYieldLiftPercent) : a.carcassYieldPercent,
      salePriceUnit: route === 'C' ? input.gateNetPrice : a.priceArroba,
      saleDeductionsPercent: route === 'C' ? 0 : a.saleDeductionPercent,
      dietDmDay: a.dietDmDay, dietPriceDm: a.dietPriceDm, forageShare: a.forageShare,
      factor: a.otherCostFactor, silageUnitCost,
    },
    breakEvenSalePriceHead: sold > 0 ? operatingCost / sold : null,
    // Sem receita de vacas, efluente, estoque final ou eventual valorização patrimonial.
    cows: 0, effluentCredit: 0,
  } };
}
export type ClosedCampaign = ReturnType<typeof closeCampaign>;
