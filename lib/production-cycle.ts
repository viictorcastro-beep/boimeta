import { calculateCore, type Assumptions } from './livestock-model.ts';
import { rearingOnly } from './rearing-model.ts';

/** Ponte do animal ao ANO ESTABILIZADO. Não usa uma campanha de compras finita,
 * não impõe datas diárias e não multiplica lucro/cabeça por 365/dias.
 * O rateio/cabeça contém o custo de toda a área e dos animais perdidos.
 */
export function productionCycles(a: Assumptions, gateNetPrice: number, calfCostC = a.calfCost) {
  const c = calculateCore(a), r = rearingOnly({ ...a, calfCost: calfCostC }, gateNetPrice);
  const factor = a.otherCostFactor / 100;
  return (['A', 'B', 'C'] as const).map(route => {
    const pastureDays = route === 'A' ? c.daysPivotA : route === 'B' ? c.daysB : r.days;
    const feedDays = route === 'A' ? c.daysFeedlot : 0;
    const entrants = route === 'A' ? c.entrantsA : route === 'B' ? c.entrantsB : r.entrants;
    const feedEntrants = route === 'A' ? c.feedlotEntriesA : 0;
    const sold = route === 'A' ? c.soldA : route === 'B' ? c.soldB : r.sold;
    const saleHead = route === 'A' ? c.netSaleA : route === 'B' ? c.netSaleB : a.pivotExitWeight * gateNetPrice;
    const pastureArea = route === 'A' ? c.pastureAreaA : a.totalArea;
    const pastureCost = route === 'A' ? c.annualPastureOperatingA * factor : route === 'B' ? c.annualPastureOperatingB * factor : r.pastureCost;
    const pastureExit = route === 'B' ? a.saleWeight : a.pivotExitWeight;
    const pastureGmd = route === 'B' ? a.gmdB : a.gmdPivotA;
    const components = route === 'A' ? c.costComponentsA : c.costComponentsB;
    const supplementKgHead = route === 'B' ? 105.3 * pastureDays / 300 : 28.4 * pastureDays / (160 / 0.9);
    const dietKg = a.dietDmDay * feedDays;
    const nonSilageDietHead = Math.max(0, dietKg * a.dietPriceDm - dietKg * a.forageShare / 100 * c.silageCashCostDm) * factor;
    const line = (label: string, quantity: number, unit: string, unitCost: number, source: string) =>
      ({ label, quantity, unit, unitCost, total: quantity * unitCost, source });
    const cows = route === 'A' ? c.cowsSold : 0;
    const costLines = [
      line('Compra de bezerros', entrants, 'cab/ano', route === 'C' ? calfCostC : a.calfCost,
        route === 'C' ? '100% comprado de terceiros, como no ranking C; confirmar data/praça' : 'Preço de reposição informado; confirmar data/praça'),
      line('Frete de compra', entrants, 'cab/ano', 50 * factor, 'Referência R$ 50/cab × fator'),
      line('Suplemento no pasto', entrants * supplementKgHead, 'kg/ano', a.supplementPrice * factor,
        route === 'B' ? '105,3 kg em 300 dias × duração/300; preço informado × fator' : '28,4 kg em 160/0,90 dias × duração/referência; preço informado × fator'),
      line('Sanidade e manejo', entrants, 'cab/ano', 45 * factor, 'Referência R$ 45/cab × fator'),
      line('Dieta de cocho sem silagem', feedEntrants, 'entradas/ano', nonSilageDietHead,
        'kg MS/d × dias × preço da dieta, retirando a silagem consumida; × fator. Silagem paga pelo orçamento de toda a área'),
      line('Operação do cocho', feedEntrants, 'entradas/ano', c.costComponentsA.feedlotOperation,
        'Referência R$ 141,89 em 140/1,48 dias × duração/referência × fator'),
      line('Frete de venda', sold, 'vendidos/ano', route === 'C' ? 0 : components.freightOut,
        route === 'C' ? 'Magro já vendido por preço líquido na porteira' : 'R$ 19,90 por sobrevivente vendido × fator'),
      line('Pasto e irrigação: custeio agregado', pastureArea, 'ha por ano', pastureArea > 0 ? pastureCost / pastureArea : 0,
        route === 'B' ? '(4.373 × R$ 930,89 ÷ 400 ha + intensificação adicional) × fator; referência agregada' : '(6.725 × R$ 452,59 ÷ 300 ha + intensificação adicional) × fator; referência agregada'),
      line('Silagem: orçamento anual da área inteira', route === 'A' ? c.silageArea * a.silageCrops : 0, 'ha-corte/ano', a.silageCostHaCut * factor,
        'Área × cortes/ano × custo/ha/corte × fator. Sobra é custeada e não vira receita'),
      line('Arrendamento', a.totalArea, 'ha por ano', a.landLeaseHa, 'Toda a área-base × R$/ha/ano informado'),
      ...(cows > 0 ? [line('Vacas de oportunidade, se ativadas', cows, 'vendidas/ano', c.cowCashCost, 'Extra separado: custo unitário do módulo de vacas; não incluído no rateio por boi')] : []),
    ];
    const annualRevenue = route === 'A' ? c.netRevenueA : route === 'B' ? c.netRevenueB : r.revenue;
    const annualCost = route === 'A' ? c.cashCostsA : route === 'B' ? c.cashCostsB : r.costs;
    const annualMargin = annualRevenue - annualCost;
    const bullCost = annualCost - cows * c.cowCashCost;
    const valid = (route === 'A' ? c.routeAInputValid : route === 'B' ? c.routeBInputValid : r.valid) &&
      a.totalArea > 0 && [annualRevenue, annualCost, pastureDays, pastureGmd, a.entryWeight, a.saleWeight].every(Number.isFinite);
    return { route, valid, pastureDays, feedDays, cycleDays: pastureDays + feedDays,
      entryWeight: a.entryWeight, pastureExit, pastureGmd, feedlotGmd: a.gmdFeedlot,
      exitWeight: route === 'C' ? a.pivotExitWeight : a.saleWeight,
      pastureArea, totalArea: a.totalArea, stockingUa: a.stockingUa,
      theoreticalPastureEntries: pastureArea * a.stockingUa * 450 / ((a.entryWeight + pastureExit) / 2) * 365 / Math.max(1, pastureDays),
      entrants, feedEntrants, sold, cows, extraCowMargin: cows > 0 ? cows * c.cowCashMargin : 0, cowRevenue: cows * c.cowNetSale,
      cowCost: cows * c.cowCashCost, cowNetSaleHead: c.cowNetSale, cowCostHead: c.cowCashCost,
      cowCostBasis: c.cowCostBasis, cowWindowArea: route === 'A' ? c.cowWindowArea : 0,
      saleHead, bullCost, costPerSold: sold > 0 ? bullCost / sold : null,
      marginPerSold: sold > 0 ? saleHead - bullCost / sold : null,
      revenuePerEntrant: entrants > 0 ? sold * saleHead / entrants : null,
      costPerEntrant: entrants > 0 ? bullCost / entrants : null,
      annualRevenue, annualCost, annualMargin, marginHa: a.totalArea > 0 ? annualMargin / a.totalArea : null,
      costLines, saleDeductions: route === 'C' ? 0 : a.saleDeductionPercent,
      carcassYield: route === 'C' ? null : route === 'A' ? Math.min(100, a.carcassYieldPercent + a.feedlotCarcassYieldLiftPercent) : a.carcassYieldPercent,
      price: route === 'C' ? gateNetPrice : a.priceArroba,
      pastureSurvival: c.pastureSurvival, feedlotSurvival: route === 'A' ? c.feedlotSurvival : 1,
      annualPastureCost: pastureCost, annualSilageCost: route === 'A' ? c.annualSilageCashCost : 0,
      bottleneck: route === 'A' ? c.bindingConstraintA : 'pasto sob pivô',
    };
  });
}
export type ProductionCycle = ReturnType<typeof productionCycles>[number];
