import {
  BASE,
  calculateCore,
  defaultAssumptions,
  type Assumptions,
} from './livestock-model.ts';
import {
  calculateMonthlyCashFlow,
  type CashEvent,
} from './operational-model.ts';
import { MONTH_DAYS } from './pasture-capacity.ts';

export const REVIEW_VERSION = '2026-09-07.2';
export const reviewDefaults = {
  pastureYieldDmTonnesHa: 0,
  grazingEfficiencyPercent: 0,
  intakePercent: 2.5,
  waterDepthMmYear: 0,
  irrigationEfficiencyPercent: 0,
  kwhM3: 0,
  electricityPrice: 0,
  monthlyForageShares: Array.from({ length: 12 }, () => 100 / 12),
  observations: '',
  studyName: 'Meu cenário',
};

/** Ponte aditiva, ordem explícita. Não calibra os custos para reproduzir a apresentação. */
export function referenceBridge(current: Assumptions) {
  let state = { ...defaultAssumptions };
  const referenceCore = calculateCore(state);
  const sourceTotalHa = BASE.ebitdaA / BASE.totalArea;
  let previous = referenceCore.ebitdaA / state.totalArea;
  const rows = [
    {
      label: 'Resumo histórico · EBITDA / 400 ha',
      value: sourceTotalHa,
      delta: 0,
    },
    {
      label: 'Diferença entre resumo e motor auditado',
      value: previous,
      delta: previous - sourceTotalHa,
    },
  ];
  const groups: { label: string; keys: (keyof Assumptions)[] }[] = [
    {
      label: 'Área e proporção pasto/silagem',
      keys: ['totalArea', 'silageShare'],
    },
    {
      label: 'Lotação, pesos, desempenho e giro',
      keys: [
        'stockingUa',
        'entryWeight',
        'pivotExitWeight',
        'saleWeight',
        'gmdPivotA',
        'gmdFeedlot',
        'gmdB',
        'pastureMortalityPercent',
        'feedlotMortalityPercent',
      ],
    },
    {
      label: 'Compra, venda, rendimento e deduções',
      keys: [
        'priceArroba',
        'calfCost',
        'carcassYieldPercent',
        'feedlotCarcassYieldLiftPercent',
        'saleDeductionPercent',
      ],
    },
    {
      label: 'Dieta, consumo e produção de silagem',
      keys: [
        'dietDmDay',
        'dietPriceDm',
        'forageShare',
        'silageCostHaCut',
        'silageYieldDm',
        'silageCrops',
        'silageRecovery',
      ],
    },
    {
      label: 'Suplemento, demais custos e arrendamento',
      keys: ['supplementPrice', 'otherCostFactor', 'landLeaseHa'],
    },
    {
      label: 'Janela de vacas',
      keys: ['includeCows', 'cowBuyCost', 'cowSaleArroba'],
    },
  ];
  for (const group of groups) {
    state = {
      ...state,
      ...Object.fromEntries(group.keys.map((key) => [key, current[key]])),
    };
    const value = calculateCore(state).ebitdaA / Math.max(state.totalArea, 1);
    rows.push({ label: group.label, value, delta: value - previous });
    previous = value;
  }
  const actual =
    calculateCore(current).ebitdaA / Math.max(current.totalArea, 1);
  if (Math.abs(actual - previous) > 0.005)
    rows.push({
      label: 'Outras diferenças de configuração',
      value: actual,
      delta: actual - previous,
    });
  return {
    rows,
    sourceTotalHa,
    currentTotalHa: actual,
    pastureCashHa: 32261,
    normalizedCashHa: (32261 * 300) / 400,
    normalizedAccrualHa: (30010 * 300) / 400,
    sourceUnreconciled:
      BASE.soldA * BASE.cashMarginHeadA +
      BASE.cowsSold * BASE.cowCashMargin -
      BASE.ebitdaA,
    delta: actual - sourceTotalHa,
  };
}

export function rankWithinBudget<
  T extends { marginHa: number; capitalRequired: number; rankable: boolean },
>(rows: T[], capital: number, toleranceHa: number) {
  const all = rows
    .filter(
      (r) =>
        r.rankable &&
        Number.isFinite(r.marginHa) &&
        Number.isFinite(r.capitalRequired),
    )
    .sort((a, b) => b.marginHa - a.marginHa);
  const feasible = all.filter(
    (r) => r.capitalRequired <= Math.max(0, capital) + 0.01,
  );
  return {
    all,
    feasible,
    best: feasible[0],
    unconstrained: all[0],
    indifferent:
      feasible.length > 1 &&
      feasible[0].marginHa - feasible[1].marginHa <= Math.max(0, toleranceHa),
    minimumAdditionalCapital: all.length
      ? Math.max(0, Math.min(...all.map((r) => r.capitalRequired)) - capital)
      : null,
  };
}

/** Primeiro ano com início vazio; custos datados, sem reconhecer venda fora do ano. */
export function cattleStartupCash(
  a: Assumptions,
  route: 'A' | 'B',
  anchor: string,
  setupDays = 0,
  setupCost = 0,
) {
  const core = calculateCore(a);
  const start = Date.parse(`${anchor}T12:00:00Z`);
  if (!Number.isFinite(start)) return null;
  const date = (day: number) =>
    new Date(start + day * 86400000).toISOString().slice(0, 10);
  const soldAnnual = route === 'A' ? core.soldA : core.soldB;
  const totalDays =
    route === 'A' ? core.daysPivotA + core.daysFeedlot : core.daysB;
  const sale = route === 'A' ? core.netSaleA : core.netSaleB;
  const annualSilage = route === 'A' ? core.annualSilageCashCost : 0;
  const annualPasture =
    ((route === 'A'
      ? core.annualPastureOperatingA
      : core.annualPastureOperatingB) *
      a.otherCostFactor) /
    100;
  // Coortes diárias equivalentes: o giro anual pressupõe fluxo escalonado,
  // não que toda a lotação média de pasto entre no cocho no mesmo dia.
  const headsSoldBatch = soldAnnual / 365;
  const headsBoughtBatch = (route === 'A' ? core.entrantsA : core.entrantsB) / 365;
  const headsFeedlotBatch = route === 'A' ? core.feedlotEntriesA / 365 : 0;
  const pastureDays = route === 'A' ? core.daysPivotA : core.daysB;
  const components = route === 'A' ? core.costComponentsA : core.costComponentsB;
  const events: CashEvent[] = [
    {
      date: anchor,
      label: 'Implantação + pivô + estrutura incremental',
      inflow: 0,
      outflow:
        a.pivotInvestment +
        (route === 'A' ? a.investment : 0) +
        setupCost +
        core.landLeaseCost +
        annualSilage +
        annualPasture,
    },
  ];
  let closingHeads = 0;
  let salesHeads = 0;
  let boughtHeads = 0;
  const dailyOut = Array<number>(365).fill(0);
  const dailyIn = Array<number>(365).fill(0);
  for (let entry = Math.ceil(Math.max(0, setupDays)); entry < 365; entry += 1) {
    const acquisition = headsBoughtBatch * (a.calfCost + components.freightIn);
    boughtHeads += headsBoughtBatch;
    dailyOut[entry] += acquisition;
    for (let day = 0; day < Math.min(totalDays, 365 - entry); day += 1) {
      dailyOut[entry + day] += day < pastureDays
        ? headsBoughtBatch * (components.supplement + components.health) / pastureDays
        : headsFeedlotBatch * core.feedlotVariableCostHead / core.daysFeedlot;
    }
    if (entry + totalDays < 365) {
      salesHeads += headsSoldBatch;
      dailyOut[entry + totalDays] += headsSoldBatch * components.freightOut;
      dailyIn[entry + totalDays] += headsSoldBatch * sale;
    } else closingHeads += route === 'A' && entry + pastureDays < 365 ? headsFeedlotBatch : headsBoughtBatch;
  }
  for (let day = 0; day < 365; day++) {
    if (dailyOut[day] > 0)
      events.push({
        date: date(day),
        label: 'Compra e custeio diário de coortes',
        inflow: 0,
        outflow: dailyOut[day],
      });
    if (dailyIn[day] > 0)
      events.push({
        date: date(day),
        label: 'Venda de coorte terminada',
        inflow: dailyIn[day],
        outflow: 0,
      });
  }
  const cash = calculateMonthlyCashFlow(events);
  return {
    ...cash,
    events,
    closingHeads,
    salesHeads,
    boughtHeads,
    headsBoughtBatch,
    unrecognizedStockAtPurchaseCost: closingHeads * a.calfCost,
    peakFeedlotHeads: route === 'A' ? headsFeedlotBatch * core.daysFeedlot : 0,
    note: 'Hipótese: coortes diárias equivalentes (cabeças fracionárias), início sem animais, custeio diário e preços constantes. Agrupar em lotes reais exige conferir picos de capacidade. Estoque final não é venda; vacas/efluente não entram sem calendário. Não é lucro líquido nem cronograma executivo.',
  };
}

/** Reserva de uma ocupação de pasto até o recebimento da venda, incluindo
 * fases que ultrapassem o ano 1. Não é despesa adicional à margem anual. */
export function cattleCapitalRequirement(a: Assumptions, route: 'A' | 'B', datedPeak = 0, setupCost = 0, reserveCash = 0) {
  const c = calculateCore(a);
  const days = route === 'A' ? c.daysPivotA + c.daysFeedlot : c.daysB;
  const firstOccupation = route === 'A' ? c.entrantsA * c.daysPivotA / 365 : c.entrantsB * c.daysB / 365;
  const variableHead = route === 'A' ? c.preFeedlotCostHead + c.pastureSurvival * c.feedlotVariableCostHead : c.preSaleCostHeadB;
  const areaBudget = (route === 'A' ? c.annualPastureOperatingA : c.annualPastureOperatingB) * a.otherCostFactor / 100 +
    (route === 'A' ? c.annualSilageCashCost : 0) + c.landLeaseCost;
  const cowReserve = route === 'A' ? c.cowsSold * c.cowCashCost : 0;
  const occupationReserve = firstOccupation * variableHead + areaBudget * Math.max(1, days / 365);
  // Caixa imediatamente antes da primeira venda da esteira diária: inclui
  // a recompra do pasto enquanto os primeiros animais já estão no cocho.
  // Soma fechada das coortes, sem simular milhares de dias a cada edição.
  const pastureDays = route === 'A' ? c.daysPivotA : c.daysB;
  const components = route === 'A' ? c.costComponentsA : c.costComponentsB;
  const dailyBought = (route === 'A' ? c.entrantsA : c.entrantsB) / 365;
  const dailySold = (route === 'A' ? c.soldA : c.soldB) / 365;
  const beforeFirstReceipt = dailyBought * (days + 1) * (a.calfCost + components.freightIn) +
    dailyBought * (components.supplement + components.health) * (days + 1 - (pastureDays - 1) / 2) +
    (route === 'A' ? c.feedlotEntriesA / 365 * c.feedlotVariableCostHead * (c.daysFeedlot + 3) / 2 : 0) +
    dailySold * components.freightOut + areaBudget * Math.max(1, (days + 1) / 365);
  const fullCycleReserve = Math.max(occupationReserve, beforeFirstReceipt) +
    cowReserve + a.pivotInvestment + (route === 'A' ? a.investment : 0) + setupCost;
  return { fullCycleReserve, beforeFirstReceipt, required: Math.max(datedPeak, fullCycleReserve) + reserveCash };
}

export function pastureRequirements(
  a: Assumptions,
  config: typeof reviewDefaults,
) {
  const core = calculateCore(a);
  const hectares = core.pastureAreaA;
  const meanWeight = (a.entryWeight + a.pivotExitWeight) / 2;
  const meanHeads = core.entrantsA * core.daysPivotA / 365;
  const monthlyShares = config.monthlyForageShares;
  const validShares =
    monthlyShares.length === 12 &&
    monthlyShares.every((v) => Number.isFinite(v) && v >= 0) &&
    Math.abs(monthlyShares.reduce((s, v) => s + v, 0) - 100) < 0.1;
  const supplyKnown =
    config.pastureYieldDmTonnesHa > 0 &&
    config.grazingEfficiencyPercent > 0 &&
    validShares;
  const annualDemand =
    ((meanHeads * meanWeight * config.intakePercent) / 100) * 365;
  const usableAnnual =
    (hectares *
      config.pastureYieldDmTonnesHa *
      1000 *
      config.grazingEfficiencyPercent) /
    100;
  const months = monthlyShares.map((share, i) => ({
    month: i + 1,
    demand: annualDemand * MONTH_DAYS[i] / 365,
    supply: supplyKnown ? (usableAnnual * share) / 100 : null,
    gap: supplyKnown
      ? Math.max(0, annualDemand * MONTH_DAYS[i] / 365 - (usableAnnual * share) / 100)
      : null,
  }));
  const waterKnown =
    config.waterDepthMmYear > 0 && config.irrigationEfficiencyPercent > 0;
  const grossWaterM3 = waterKnown
    ? (a.totalArea * config.waterDepthMmYear * 10) /
      (config.irrigationEfficiencyPercent / 100)
    : null;
  return {
    months,
    supplyKnown,
    validShares,
    annualDemand,
    meanHeads,
    peakUaSingleBatch:
      hectares > 0 ? (meanHeads * a.pivotExitWeight) / 450 / hectares : 0,
    requiredProducedTonnesHa:
      hectares > 0 && config.grazingEfficiencyPercent > 0
        ? annualDemand /
          hectares /
          1000 /
          (config.grazingEfficiencyPercent / 100)
        : null,
    grossWaterM3,
    energyCost:
      grossWaterM3 !== null && config.kwhM3 > 0 && config.electricityPrice > 0
        ? grossWaterM3 * config.kwhM3 * config.electricityPrice
        : null,
  };
}

export function observedGains(csv: string, targetGmd: number) {
  const records = new Map<string, { date: string; weight: number }[]>();
  const errors: string[] = [];
  csv
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .forEach((line, i) => {
      if (i === 0 && /^id;/i.test(line)) return;
      const [id, date, rawWeight] = line.split(';').map((x) => x.trim());
      const weight = Number(rawWeight?.replace(',', '.'));
      const parsed = new Date(`${date}T12:00:00Z`);
      if (
        !id ||
        id.length > 80 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') ||
        !Number.isFinite(parsed.getTime()) ||
        parsed.toISOString().slice(0, 10) !== date ||
        !(weight > 0 && weight < 2500)
      ) {
        errors.push(`Linha ${i + 1}: use id;AAAA-MM-DD;peso kg.`);
        return;
      }
      const rows = records.get(id) ?? [];
      if (rows.some((r) => r.date === date)) {
        errors.push(
          `Linha ${i + 1}: pesagem duplicada para ${id} na mesma data.`,
        );
        return;
      }
      rows.push({ date, weight });
      records.set(id, rows);
    });
  return {
    errors,
    rows: [...records.entries()].map(([id, rows]) => {
      rows.sort((a, b) => a.date.localeCompare(b.date));
      const first = rows[0],
        last = rows[rows.length - 1];
      const days = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
      const gmd = days > 0 ? (last.weight - first.weight) / days : null;
      return {
        id,
        days,
        weight: last.weight,
        gmd,
        deviation: gmd === null ? null : gmd - targetGmd,
        action:
          gmd === null
            ? 'Registrar segunda pesagem'
            : gmd < targetGmd
              ? 'Investigar pesagem, acesso ao alimento e sanidade; reavaliar margem antes de escolher destino'
              : 'Dentro da meta informada; avaliar margem marginal da próxima fase',
      };
    }),
  };
}
