export type LotProfile = {
  id: string;
  label: string;
  share: number;
  /** GMD observado na recria a pasto. É contexto histórico, não previsão automática do cocho. */
  pastureGmd?: number;
  /** GMD projetado no confinamento próprio. */
  gmd: number;
  /** Consumo diário de matéria seca projetado para o lote no cocho. */
  dietDmDay?: number;
  /**
   * Optional feedlot occupancy window. Dates must reproduce exactly the stay
   * derived from entry/sale weights and projected GMD. Week numbers use an
   * inclusive entry and exclusive exit and must contain exactly the rounded-up
   * number of weekly buckets. A detailed calendar is only activated when every
   * lot eligible for the own feedlot has one coherent window in the same
   * representation; otherwise the conservative simultaneous-head envelope
   * remains in force and feed, cost and head-days all keep the projected stay.
   */
  entryWeek?: number;
  exitWeek?: number;
  entryDate?: string;
  exitDate?: string;
};

export type HerdFlowInputs = {
  annualEntrants: number;
  selfSupplyPercent: number;
  pregnancyRate: number;
  pregnancyToBirthLoss: number;
  preWeaningMortality: number;
  postWeaningMortality: number;
  replacementRate: number;
  heiferDevelopmentSurvival: number;
  heiferApprovalRate: number;
  ownReplacementShare: number;
  allowExternalReplacementHeifers: boolean;
  maleShare: number;
  finishBothSexes: boolean;
  herdUaPerCow: number;
  breedingStockingUa: number;
  stockingUa: number;
  averageStockWeight: number;
  totalArea: number;
  naturalServiceShare: number;
  bullCowRatio: number;
};

export type FeedAllocationInputs = {
  annualCandidates: number;
  entryWeight: number;
  saleWeight: number;
  netFinishedRevenueByGmd: (gmd: number) => number | null;
  sellNowHead: number;
  dietDmDay: number;
  forageShare: number;
  silageCashCostDm: number;
  silageOpportunityCostDm: number;
  purchasedSilageCostDm: number;
  grainCashCostDm: number;
  grainNetSalePriceSack: number;
  grainPurchasePriceSack: number;
  dietOtherCostDm: number;
  ownOperationDay: number;
  ownFixedCostHead: number;
  thirdPartyAllInDay: number;
  thirdPartyFreightHead: number;
  thirdPartyCapacity: number;
  annualCarryRate: number;
  feedlotCapacity: number;
  feedlotUtilization: number;
  grainAreaHa: number;
  grainYieldSacksHa: number;
  grainCashCostHa: number;
  silageAreaHa: number;
  silageDmTonnesHaYear: number;
  silageCashCostHaYear: number;
  allowPurchasedFeed: boolean;
  allowOwnFeedlot: boolean;
  allowOutsource: boolean;
  workingCapitalLimit: number;
  lots: LotProfile[];
};

export type LotEconomics = LotProfile & {
  normalizedShare: number;
  heads: number;
  days: number;
  totalDmKgHead: number;
  dailyDmKg: number;
  feedConversionDm: number;
  grainSacksHead: number;
  silageDmKgHead: number;
  ownMarginHead: number;
  outsourceMarginHead: number;
  alternativeMarginHead: number;
  ownAdvantageHead: number;
  ownAdvantageDay: number;
  shadowGrainPriceSack: number;
  shadowSilagePriceDm: number;
  routeCovered: boolean;
  netFinishedRevenue: number | null;
  presentFinishedRevenue: number;
  presentOwnCost: number;
  presentOutsourceCost: number;
  sellNowHead: number;
  ownHeads: number;
  outsourceHeads: number;
  sellHeads: number;
};

const clampRate = (value: number) => Math.min(1, Math.max(0, value / 100));

type LotCalendarInterval = {
  mode: 'week' | 'date';
  start: number;
  end: number;
  occupiedPeriods: number[];
};

const millisecondsPerDay = 86_400_000;

function parseStrictIsoDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.trunc(timestamp / millisecondsPerDay);
}

function formatIsoDay(day: number) {
  return new Date(day * millisecondsPerDay).toISOString().slice(0, 10);
}

function normalizeLotCalendar(
  lot: LotEconomics,
): { interval: LotCalendarInterval | null; issue: string | null } {
  const hasDateFields = lot.entryDate !== undefined || lot.exitDate !== undefined;
  const hasWeekFields = lot.entryWeek !== undefined || lot.exitWeek !== undefined;
  if (hasDateFields && hasWeekFields) {
    return {
      interval: null,
      issue: `${lot.label}: use datas ou semanas, não ambas.`,
    };
  }
  if (hasDateFields) {
    const startDay = parseStrictIsoDay(lot.entryDate ?? '');
    const endDay = parseStrictIsoDay(lot.exitDate ?? '');
    if (startDay === null || endDay === null || endDay <= startDay) {
      return {
        interval: null,
        issue: `${lot.label}: janela por data inválida; a saída deve ser posterior à entrada.`,
      };
    }
    const calendarDays = endDay - startDay;
    if (calendarDays !== lot.days) {
      const requiredExitDate = formatIsoDay(startDay + lot.days);
      return {
        interval: null,
        issue: `${lot.label}: entrada e saída informam ${calendarDays} dias, mas pesos/GMD projetam ${lot.days}; ajuste a saída para ${requiredExitDate} ou ajuste GMD/pesos. Até fechar, alimento, custo, vaga-dia e cabeças-dia usam ${lot.days} dias e não há reutilização de vagas.`,
      };
    }
    // UTC day zero (1970-01-01) was a Thursday; +3 anchors buckets on Monday.
    const firstPeriod = Math.floor((startDay + 3) / 7);
    const lastPeriod = Math.floor((endDay - 1 + 3) / 7);
    return {
      interval: {
        mode: 'date',
        start: startDay,
        end: endDay,
        occupiedPeriods: Array.from(
          { length: lastPeriod - firstPeriod + 1 },
          (_, index) => firstPeriod + index,
        ),
      },
      issue: null,
    };
  }
  if (hasWeekFields) {
    const startWeek = lot.entryWeek;
    const endWeek = lot.exitWeek;
    if (
      !Number.isInteger(startWeek) ||
      !Number.isInteger(endWeek) ||
      (startWeek ?? 0) < 1 ||
      (endWeek ?? 0) > 54 ||
      (endWeek ?? 0) <= (startWeek ?? 0)
    ) {
      return {
        interval: null,
        issue: `${lot.label}: janela semanal inválida; use entrada 1..53 e saída exclusiva até 54.`,
      };
    }
    const requiredWeeklyBuckets = Math.ceil(lot.days / 7);
    const requiredExitWeek = (startWeek as number) + requiredWeeklyBuckets;
    if ((endWeek as number) !== requiredExitWeek) {
      return {
        interval: null,
        issue: `${lot.label}: ${lot.days} dias exigem ${requiredWeeklyBuckets} semanas de ocupação; ajuste a saída exclusiva para a semana ${requiredExitWeek} ou ajuste GMD/pesos. Até fechar, não há reutilização de vagas.`,
      };
    }
    return {
      interval: {
        mode: 'week',
        start: startWeek as number,
        end: endWeek as number,
        occupiedPeriods: Array.from(
          { length: (endWeek as number) - (startWeek as number) },
          (_, index) => (startWeek as number) + index,
        ),
      },
      issue: null,
    };
  }
  return {
    interval: null,
    issue: `${lot.label}: calendário de ocupação não informado.`,
  };
}

export function calculateHerdFlow(input: HerdFlowInputs) {
  const pregnancy = clampRate(input.pregnancyRate);
  const birthConditional = 1 - clampRate(input.pregnancyToBirthLoss);
  const preWeaningSurvival = 1 - clampRate(input.preWeaningMortality);
  const postWeaningSurvival = 1 - clampRate(input.postWeaningMortality);
  const replacement = clampRate(input.replacementRate);
  const heiferDevelopmentSurvival = clampRate(
    input.heiferDevelopmentSurvival,
  );
  const heiferApprovalRate = clampRate(input.heiferApprovalRate);
  const ownReplacementShare = clampRate(input.ownReplacementShare);
  const maleShare = clampRate(input.maleShare);
  const selfSupply = clampRate(input.selfSupplyPercent);
  const weaningRate = pregnancy * birthConditional * preWeaningSurvival;
  const targetOwnEntrants = Math.max(0, input.annualEntrants) * selfSupply;
  const postWeaningCalvesPerCow = weaningRate * postWeaningSurvival;
  const maleEntrantsPerCow = postWeaningCalvesPerCow * maleShare;
  const femaleHeifersAvailablePerCow =
    postWeaningCalvesPerCow * (1 - maleShare);
  const ownMatureReplacementTargetPerCow =
    replacement * ownReplacementShare;
  const heiferConversion =
    heiferDevelopmentSurvival * heiferApprovalRate;
  const grossHeifersToRetainPerCow =
    heiferConversion > 0
      ? ownMatureReplacementTargetPerCow / heiferConversion
      : ownMatureReplacementTargetPerCow > 0
        ? Infinity
        : 0;
  const retainedHeifersPerCow = Number.isFinite(grossHeifersToRetainPerCow)
    ? Math.min(femaleHeifersAvailablePerCow, grossHeifersToRetainPerCow)
    : 0;
  const matureOwnReplacementsPerCow =
    retainedHeifersPerCow * heiferConversion;
  const ownReplacementGapPerCow = Math.max(
    0,
    ownMatureReplacementTargetPerCow - matureOwnReplacementsPerCow,
  );
  const plannedExternalReplacementsPerCow =
    replacement * (1 - ownReplacementShare);
  const externalReplacementNeedPerCow =
    plannedExternalReplacementsPerCow + ownReplacementGapPerCow;
  const uncoveredReplacementPerCow = input.allowExternalReplacementHeifers
    ? 0
    : externalReplacementNeedPerCow;
  const replacementSystemCloses = uncoveredReplacementPerCow <= 1e-9;
  const grossEligiblePerCow = input.finishBothSexes
    ? postWeaningCalvesPerCow
    : maleEntrantsPerCow;
  // Retained heifers only reduce the finishing stream when females are part of it.
  const netEligiblePerCow = Math.max(
    0,
    input.finishBothSexes
      ? grossEligiblePerCow - retainedHeifersPerCow
      : grossEligiblePerCow,
  );
  const matricesRequired =
    netEligiblePerCow > 0 ? targetOwnEntrants / netEligiblePerCow : Infinity;
  const weanedCalves = matricesRequired * weaningRate;
  const replacementNeed = matricesRequired * replacement;
  const replacementHeifersAvailable =
    matricesRequired * femaleHeifersAvailablePerCow;
  const retainedHeifers = matricesRequired * retainedHeifersPerCow;
  const matureOwnReplacements = matricesRequired * matureOwnReplacementsPerCow;
  const ownReplacementGap = matricesRequired * ownReplacementGapPerCow;
  const externalReplacementPurchases = input.allowExternalReplacementHeifers
    ? matricesRequired * externalReplacementNeedPerCow
    : 0;
  const replacementGap = matricesRequired * uncoveredReplacementPerCow;
  const breedingAreaEquivalent =
    input.breedingStockingUa > 0
      ? (matricesRequired * Math.max(0, input.herdUaPerCow)) /
        input.breedingStockingUa
      : Infinity;
  const totalUaCapacity = Math.max(0, input.totalArea) * Math.max(0, input.stockingUa);
  const simultaneousHeads =
    input.averageStockWeight > 0
      ? (totalUaCapacity * 450) / input.averageStockWeight
      : Infinity;
  const bullsRequired =
    input.bullCowRatio > 0
      ? (matricesRequired * clampRate(input.naturalServiceShare)) / input.bullCowRatio
      : 0;

  return {
    weaningRate,
    postWeaningSurvival,
    targetOwnEntrants,
    grossEligiblePerCow,
    netEligiblePerCow,
    postWeaningCalvesPerCow,
    maleEntrantsPerCow,
    femaleHeifersAvailablePerCow,
    grossHeifersToRetainPerCow,
    retainedHeifersPerCow,
    matureOwnReplacementsPerCow,
    ownReplacementGapPerCow,
    externalReplacementNeedPerCow,
    replacementSystemCloses,
    matricesRequired,
    weanedCalves,
    replacementNeed,
    replacementHeifersAvailable,
    retainedHeifers,
    matureOwnReplacements,
    ownReplacementGap,
    externalReplacementPurchases,
    replacementGap,
    breedingAreaEquivalent,
    totalUaCapacity,
    simultaneousHeads,
    bullsRequired,
    purchasedEntrants: Math.max(0, input.annualEntrants - targetOwnEntrants),
  };
}

function lotEconomics(
  lot: LotProfile,
  normalizedShare: number,
  input: FeedAllocationInputs,
  costBasis?: { grainDm: number; silageDm: number },
) {
  const weightGain = Math.max(0, input.saleWeight - input.entryWeight);
  const days = Math.ceil(weightGain / Math.max(0.05, lot.gmd));
  const dailyDmKg = Math.max(0, lot.dietDmDay ?? input.dietDmDay);
  const totalDmKgHead = dailyDmKg * days;
  const forageFraction = clampRate(input.forageShare);
  const silageDmKgHead = totalDmKgHead * forageFraction;
  const grainDmKgHead = totalDmKgHead - silageDmKgHead;
  const grainSacksHead = grainDmKgHead / (60 * 0.88);
  const grainOpportunityCostDm =
    costBasis?.grainDm ?? input.grainNetSalePriceSack / (60 * 0.88);
  const projectedFinishedRevenue = input.netFinishedRevenueByGmd(lot.gmd);
  const routeCovered =
    projectedFinishedRevenue !== null &&
    Number.isFinite(projectedFinishedRevenue) &&
    projectedFinishedRevenue >= 0;
  const netFinishedRevenue = routeCovered ? projectedFinishedRevenue : 0;
  const annualRate = Math.max(0, input.annualCarryRate / 100);
  const revenueDiscount = Math.pow(1 + annualRate, days / 365);
  const costDiscount = Math.pow(1 + annualRate, days / 730);
  const presentFinishedRevenue = netFinishedRevenue / revenueDiscount;
  const commonOtherDiet = totalDmKgHead * input.dietOtherCostDm;
  const silageEconomicCost =
    silageDmKgHead * (costBasis?.silageDm ?? input.silageOpportunityCostDm);
  const grainEconomicCost = grainDmKgHead * grainOpportunityCostDm;
  const ownOperation = days * input.ownOperationDay + input.ownFixedCostHead;
  const presentOwnCost =
    (silageEconomicCost +
      grainEconomicCost +
      commonOtherDiet +
      ownOperation) /
    costDiscount;
  const presentOutsourceCost =
    (days * input.thirdPartyAllInDay + input.thirdPartyFreightHead) /
    costDiscount;
  const ownMarginHead =
    presentFinishedRevenue - input.sellNowHead - presentOwnCost;
  const outsourceMarginHead =
    presentFinishedRevenue - input.sellNowHead - presentOutsourceCost;
  // Own capacity competes with the gate at this stage. Third-party capacity is
  // finite and is assigned in separate dominant/overflow passes below; using
  // an unlimited boitel as the per-head alternative would strand profitable
  // heads after the contract volume is exhausted.
  const alternativeMarginHead = 0;
  const ownAdvantageHead = ownMarginHead - alternativeMarginHead;
  const heads = Math.max(0, input.annualCandidates) * normalizedShare;
  const fixedBeforeGrain =
    presentFinishedRevenue -
    input.sellNowHead -
    (silageEconomicCost + commonOtherDiet + ownOperation) / costDiscount -
    alternativeMarginHead;
  const fixedBeforeSilage =
    presentFinishedRevenue -
    input.sellNowHead -
    (grainEconomicCost + commonOtherDiet + ownOperation) / costDiscount -
    alternativeMarginHead;

  return {
    ...lot,
    normalizedShare,
    heads,
    days,
    totalDmKgHead,
    dailyDmKg,
    feedConversionDm: dailyDmKg / Math.max(0.05, lot.gmd),
    grainSacksHead,
    silageDmKgHead,
    ownMarginHead,
    outsourceMarginHead,
    alternativeMarginHead,
    ownAdvantageHead,
    ownAdvantageDay: days > 0 ? ownAdvantageHead / days : 0,
    shadowGrainPriceSack:
      grainSacksHead > 0
        ? (fixedBeforeGrain * costDiscount) / grainSacksHead
        : Infinity,
    shadowSilagePriceDm:
      silageDmKgHead > 0
        ? (fixedBeforeSilage * costDiscount) / silageDmKgHead
        : Infinity,
    routeCovered,
    netFinishedRevenue: routeCovered ? netFinishedRevenue : null,
    presentFinishedRevenue,
    presentOwnCost,
    presentOutsourceCost,
    sellNowHead: input.sellNowHead,
    ownHeads: 0,
    outsourceHeads: 0,
    sellHeads: 0,
  } satisfies LotEconomics;
}

function thresholdGmd(
  input: FeedAllocationInputs,
  objective: (lot: LotEconomics) => number,
  costBasis?: { grainDm: number; silageDm: number },
) {
  let low = 0.2;
  let high = 3.5;
  const evaluate = (gmd: number) =>
    objective(
      lotEconomics(
        { id: 'threshold', label: 'Limite', share: 100, gmd },
        1,
        input,
        costBasis,
      ),
    );
  let lowValue = evaluate(low);
  const highValue = evaluate(high);
  if (lowValue >= 0) return low;
  if (highValue < 0) return null;
  for (let index = 0; index < 80; index += 1) {
    const middle = (low + high) / 2;
    const value = evaluate(middle);
    if (Math.abs(value) < 0.01) return middle;
    if (value >= 0) high = middle;
    else {
      low = middle;
      lowValue = value;
    }
  }
  return (low + high) / 2;
}

/**
 * Small deterministic primal-simplex solver for the routing LP. All
 * constraints here are Ax <= b, x >= 0 and b >= 0, so zero is feasible.
 * A joint optimisation is required: a greedy route order can waste a scarce
 * cocho or boitel slot on a lot whose alternative has greater value.
 */
function solvePackingLp(
  objective: number[],
  constraints: Array<{ coefficients: number[]; limit: number }>,
) {
  const epsilon = 1e-8;
  const variableCount = objective.length;
  const rows = constraints.filter(
    (row) => Number.isFinite(row.limit) && row.limit >= -epsilon,
  );
  const constraintCount = rows.length;
  const rhs = variableCount + constraintCount;
  const tableau = Array.from({ length: constraintCount + 1 }, (_, row) => {
    const values = Array(variableCount + constraintCount + 1).fill(0);
    if (row < constraintCount) {
      values.splice(0, variableCount, ...rows[row].coefficients);
      values[variableCount + row] = 1;
      values[rhs] = Math.max(0, rows[row].limit);
    } else {
      objective.forEach((value, column) => {
        values[column] = -value;
      });
    }
    return values;
  });
  const basis = Array.from(
    { length: constraintCount },
    (_, row) => variableCount + row,
  );
  const pivot = (pivotRow: number, pivotColumn: number) => {
    const divisor = tableau[pivotRow][pivotColumn];
    for (let column = 0; column <= rhs; column += 1) {
      tableau[pivotRow][column] /= divisor;
    }
    for (let row = 0; row <= constraintCount; row += 1) {
      if (row === pivotRow) continue;
      const multiplier = tableau[row][pivotColumn];
      if (Math.abs(multiplier) <= epsilon) continue;
      for (let column = 0; column <= rhs; column += 1) {
        tableau[row][column] -= multiplier * tableau[pivotRow][column];
      }
    }
    basis[pivotRow] = pivotColumn;
  };
  for (let iteration = 0; iteration < 20_000; iteration += 1) {
    const objectiveRow = tableau[constraintCount];
    const entering = objectiveRow.findIndex(
      (value, column) => column < rhs && value < -epsilon,
    );
    if (entering < 0) break;
    let leaving = -1;
    let bestRatio = Infinity;
    for (let row = 0; row < constraintCount; row += 1) {
      const coefficient = tableau[row][entering];
      if (coefficient <= epsilon) continue;
      const ratio = tableau[row][rhs] / coefficient;
      if (
        ratio < bestRatio - epsilon ||
        (Math.abs(ratio - bestRatio) <= epsilon &&
          (leaving < 0 || basis[row] < basis[leaving]))
      ) {
        bestRatio = ratio;
        leaving = row;
      }
    }
    if (leaving < 0) break;
    pivot(leaving, entering);
  }
  const values = Array(variableCount).fill(0);
  basis.forEach((column, row) => {
    if (column < variableCount) values[column] = Math.max(0, tableau[row][rhs]);
  });
  return { values, value: tableau[constraintCount][rhs] };
}

export function calculateFeedAllocation(input: FeedAllocationInputs) {
  // Keep direct callers and older saved scenarios operational: cocho own is
  // enabled unless explicitly turned off; boitel remains opt-in.
  const ownFeedlotEnabled = input.allowOwnFeedlot !== false;
  const outsourceEnabled = input.allowOutsource === true;
  const shareTotal = input.lots.reduce(
    (sum, lot) => sum + Math.max(0, lot.share),
    0,
  );
  const normalizedById = new Map(
    input.lots.map((lot) => [
      lot.id,
      shareTotal > 0
        ? Math.max(0, lot.share) / shareTotal
        : input.lots.length > 0
          ? 1 / input.lots.length
          : 0,
    ]),
  );
  const grainProducedSacks =
    Math.max(0, input.grainAreaHa) * Math.max(0, input.grainYieldSacksHa);
  const silageProducedDmKg =
    Math.max(0, input.silageAreaHa) *
    Math.max(0, input.silageDmTonnesHaYear) *
    1_000;
  const grainOpportunityCostDm = input.grainNetSalePriceSack / (60 * 0.88);
  const grainPurchaseCostDm = input.grainPurchasePriceSack / (60 * 0.88);
  const baseLots = input.lots.map((lot) =>
    lotEconomics(
      lot,
      normalizedById.get(lot.id) ?? 0,
      input,
      {
        grainDm: grainOpportunityCostDm,
        silageDm: input.silageOpportunityCostDm,
      },
    ),
  );
  const penDaysCapacity =
    Math.max(0, input.feedlotCapacity) *
    365 *
    clampRate(input.feedlotUtilization);
  // Vaga-dia anual não limita um pico de entrada: 4.000 animais por 100 dias
  // cabem em 400 mil vaga-dias, mas não em 2.000 baias. Sem um calendário de
  // entradas/saídas validado, usamos o envelope conservador de simultaneidade.
  const concurrentOwnCapacity =
    Math.max(0, input.feedlotCapacity) * clampRate(input.feedlotUtilization);
  const committedCropCash =
    Math.max(0, input.grainAreaHa) * Math.max(0, input.grainCashCostHa) +
    Math.max(0, input.silageAreaHa) *
      Math.max(0, input.silageCashCostHaYear);
  // Older saved scenarios may omit this optional guardrail.  Absence means
  // "not constrained", never a silent zero-capital prohibition.
  const workingCapitalLimit = Number.isFinite(input.workingCapitalLimit)
    ? Math.max(0, input.workingCapitalLimit)
    : Infinity;
  const availableWorkingCapital = Math.max(
    0,
    workingCapitalLimit - committedCropCash,
  );
  type RouteVariable = {
    lotId: string;
    kind: 'own' | 'outsource';
    economics: LotEconomics;
    useOwnGrain: boolean;
    useOwnSilage: boolean;
    cashNeedHead: number;
  };
  const variables: RouteVariable[] = [];
  const choicesForFeed = (
    demand: number,
    ownAvailable: number,
  ) => {
    if (demand <= 1e-9) return [false];
    // Own grain has an explicit sale route, so its opportunity cost governs
    // allocation. Own silage may not: when the caller provides produced stock
    // without a sale route, the internal transfer is credited back in the
    // consolidated system. Keep both physical choices and let the LP compare
    // the full consolidated contribution instead of hiding own stock merely
    // because its transfer price exceeds a purchase quote.
    const canUseOwn = ownAvailable > 1e-9;
    const choices: boolean[] = [];
    if (canUseOwn) choices.push(true);
    if (input.allowPurchasedFeed) choices.push(false);
    return choices;
  };
  baseLots.forEach((baseLot) => {
    if (!baseLot.routeCovered) return;
    if (ownFeedlotEnabled) {
      const grainChoices = choicesForFeed(
        baseLot.grainSacksHead,
        grainProducedSacks,
      );
      const silageChoices = choicesForFeed(
        baseLot.silageDmKgHead,
        silageProducedDmKg,
      );
      grainChoices.forEach((useOwnGrain) => {
        silageChoices.forEach((useOwnSilage) => {
          const economics = lotEconomics(
            baseLot,
            baseLot.normalizedShare,
            input,
            {
              grainDm: useOwnGrain
                ? grainOpportunityCostDm
                : grainPurchaseCostDm,
              silageDm: useOwnSilage
                ? input.silageOpportunityCostDm
                : input.purchasedSilageCostDm,
            },
          );
          const grainDmKgHead = economics.totalDmKgHead *
            (1 - clampRate(input.forageShare));
          variables.push({
            lotId: baseLot.id,
            kind: 'own',
            economics,
            useOwnGrain,
            useOwnSilage,
            cashNeedHead:
              economics.totalDmKgHead * input.dietOtherCostDm +
              economics.days * input.ownOperationDay +
              input.ownFixedCostHead +
              (useOwnGrain ? 0 : grainDmKgHead * grainPurchaseCostDm) +
              (useOwnSilage
                ? 0
                : economics.silageDmKgHead * input.purchasedSilageCostDm),
          });
        });
      });
    }
    if (outsourceEnabled && baseLot.outsourceMarginHead > 1e-9) {
      variables.push({
        lotId: baseLot.id,
        kind: 'outsource',
        economics: baseLot,
        useOwnGrain: false,
        useOwnSilage: false,
        cashNeedHead:
          baseLot.days * input.thirdPartyAllInDay + input.thirdPartyFreightHead,
      });
    }
  });
  const ownRouteLotIds = new Set(
    variables
      .filter((route) => route.kind === 'own')
      .map((route) => route.lotId),
  );
  const calendarChecks = baseLots
    .filter((lot) => ownRouteLotIds.has(lot.id))
    .map((lot) => ({ lot, ...normalizeLotCalendar(lot) }));
  const calendarModes = new Set(
    calendarChecks.flatMap((check) =>
      check.interval ? [check.interval.mode] : [],
    ),
  );
  const hasCompleteCalendar =
    calendarChecks.length > 0 &&
    calendarChecks.every((check) => check.interval !== null) &&
    calendarModes.size === 1;
  const calendarMode: 'legacy-conservative' | 'weekly' | 'date-weekly' =
    hasCompleteCalendar
      ? calendarModes.has('date')
        ? 'date-weekly'
        : 'weekly'
      : 'legacy-conservative';
  const calendarByLot = new Map(
    calendarChecks.flatMap((check) =>
      check.interval ? [[check.lot.id, check.interval] as const] : [],
    ),
  );
  const calendarPeriods = hasCompleteCalendar
    ? [
        ...new Set(
          calendarChecks.flatMap(
            (check) => check.interval?.occupiedPeriods ?? [],
          ),
        ),
      ].sort((left, right) => left - right)
    : [];
  const calendarIssues = calendarChecks.flatMap((check) =>
    check.issue ? [check.issue] : [],
  );
  if (calendarChecks.length > 0 && calendarModes.size > 1) {
    calendarIssues.push(
      'Os lotes misturam datas e semanas; use uma única representação temporal.',
    );
  }
  const coefficients = (value: (route: RouteVariable) => number) =>
    variables.map(value);
  const ownCapacityConstraints = hasCompleteCalendar
    ? calendarPeriods.map((period) => ({
        coefficients: coefficients((route) =>
          route.kind === 'own' &&
          calendarByLot.get(route.lotId)?.occupiedPeriods.includes(period)
            ? 1
            : 0,
        ),
        limit: concurrentOwnCapacity,
      }))
    : [
        {
          coefficients: coefficients((route) =>
            route.kind === 'own' ? 1 : 0,
          ),
          limit: concurrentOwnCapacity,
        },
      ];
  const constraints: Array<{ coefficients: number[]; limit: number }> = [
    ...baseLots.map((lot) => ({
      coefficients: coefficients((route) => (route.lotId === lot.id ? 1 : 0)),
      limit: lot.heads,
    })),
    {
      coefficients: coefficients((route) =>
        route.kind === 'own' ? route.economics.days : 0,
      ),
      limit: penDaysCapacity,
    },
    ...ownCapacityConstraints,
    {
      coefficients: coefficients((route) =>
        route.kind === 'own' && route.useOwnGrain
          ? route.economics.grainSacksHead
          : 0,
      ),
      limit: grainProducedSacks,
    },
    {
      coefficients: coefficients((route) =>
        route.kind === 'own' && route.useOwnSilage
          ? route.economics.silageDmKgHead
          : 0,
      ),
      limit: silageProducedDmKg,
    },
    {
      coefficients: coefficients((route) => route.cashNeedHead),
      limit: availableWorkingCapital,
    },
    {
      coefficients: coefficients((route) =>
        route.kind === 'outsource' ? 1 : 0,
      ),
      limit: outsourceEnabled ? Math.max(0, input.thirdPartyCapacity) : 0,
    },
  ];
  const ownSilageTransferCredit = (route: RouteVariable) => {
    if (route.kind !== 'own' || !route.useOwnSilage) return 0;
    const costDiscount = Math.pow(
      1 + Math.max(0, input.annualCarryRate / 100),
      route.economics.days / 730,
    );
    return (
      route.economics.silageDmKgHead *
      input.silageOpportunityCostDm /
      costDiscount
    );
  };
  const solution = solvePackingLp(
    variables.map((route) =>
      route.kind === 'own'
        ? route.economics.ownMarginHead + ownSilageTransferCredit(route)
        : route.economics.outsourceMarginHead,
    ),
    constraints,
  );
  const allocations = new Map(
    baseLots.map((lot) => [
      lot.id,
      {
        ownHeads: 0,
        outsourceHeads: 0,
        ownMargin: 0,
        ownAdvantage: 0,
        ownPresentCost: 0,
        ownGrainUsedSacks: 0,
        ownSilageUsedDmKg: 0,
        purchasedGrainSacks: 0,
        purchasedSilageDmKg: 0,
        cashUsed: 0,
      },
    ]),
  );
  variables.forEach((route, index) => {
    const heads = solution.values[index] ?? 0;
    if (heads <= 1e-8) return;
    const allocation = allocations.get(route.lotId);
    if (!allocation) return;
    allocation.cashUsed += heads * route.cashNeedHead;
    if (route.kind === 'outsource') {
      allocation.outsourceHeads += heads;
      return;
    }
    allocation.ownHeads += heads;
    allocation.ownMargin += heads * route.economics.ownMarginHead;
    allocation.ownAdvantage += heads * route.economics.ownAdvantageHead;
    allocation.ownPresentCost += heads * route.economics.presentOwnCost;
    if (route.useOwnGrain) {
      allocation.ownGrainUsedSacks += heads * route.economics.grainSacksHead;
    } else {
      allocation.purchasedGrainSacks += heads * route.economics.grainSacksHead;
    }
    if (route.useOwnSilage) {
      allocation.ownSilageUsedDmKg += heads * route.economics.silageDmKgHead;
    } else {
      allocation.purchasedSilageDmKg += heads * route.economics.silageDmKgHead;
    }
  });

  const lots = baseLots.map((baseLot) => {
    const accumulator = allocations.get(baseLot.id) ?? {
      ownHeads: 0,
      outsourceHeads: 0,
      ownMargin: 0,
      ownAdvantage: 0,
      ownPresentCost: 0,
      ownGrainUsedSacks: 0,
      ownSilageUsedDmKg: 0,
      purchasedGrainSacks: 0,
      purchasedSilageDmKg: 0,
      cashUsed: 0,
    };
    const outsourceHeads = accumulator.outsourceHeads;
    const sellHeads = Math.max(
      0,
      baseLot.heads - accumulator.ownHeads - outsourceHeads,
    );
    return {
      ...baseLot,
      ownMarginHead:
        accumulator.ownHeads > 0
          ? accumulator.ownMargin / accumulator.ownHeads
          : baseLot.ownMarginHead,
      ownAdvantageHead:
        accumulator.ownHeads > 0
          ? accumulator.ownAdvantage / accumulator.ownHeads
          : baseLot.ownAdvantageHead,
      presentOwnCost:
        accumulator.ownHeads > 0
          ? accumulator.ownPresentCost / accumulator.ownHeads
          : baseLot.presentOwnCost,
      ownHeads: accumulator.ownHeads,
      outsourceHeads,
      sellHeads,
    };
  });
  const ownHeads = lots.reduce((sum, lot) => sum + lot.ownHeads, 0);
  const outsourceHeads = lots.reduce((sum, lot) => sum + lot.outsourceHeads, 0);
  const sellHeads = lots.reduce((sum, lot) => sum + lot.sellHeads, 0);
  const temporalOccupancy = hasCompleteCalendar
    ? calendarPeriods.map((period) => {
        const ownHeadsInPeriod = variables.reduce((sum, route, index) => {
          if (
            route.kind !== 'own' ||
            !calendarByLot.get(route.lotId)?.occupiedPeriods.includes(period)
          ) {
            return sum;
          }
          return sum + (solution.values[index] ?? 0);
        }, 0);
        const label = calendarMode === 'weekly'
          ? `Semana ${period}`
          : new Date((period * 7 - 3) * millisecondsPerDay)
              .toISOString()
              .slice(0, 10);
        return { period: label, ownHeads: ownHeadsInPeriod };
      })
    : [];
  const peakConcurrentOwnHeads = hasCompleteCalendar
    ? temporalOccupancy.reduce(
        (peak, occupancy) => Math.max(peak, occupancy.ownHeads),
        0,
      )
    : ownHeads;
  const grainDemandSacks = lots.reduce(
    (sum, lot) => sum + lot.ownHeads * lot.grainSacksHead,
    0,
  );
  const silageDemandDmKg = lots.reduce(
    (sum, lot) => sum + lot.ownHeads * lot.silageDmKgHead,
    0,
  );
  const ownGrainUsedSacks = [...allocations.values()].reduce(
    (sum, allocation) => sum + allocation.ownGrainUsedSacks,
    0,
  );
  const purchasedGrainSacks = [...allocations.values()].reduce(
    (sum, allocation) => sum + allocation.purchasedGrainSacks,
    0,
  );
  const soldGrainSacks = Math.max(0, grainProducedSacks - ownGrainUsedSacks);
  const purchasedSilageDmKg = [...allocations.values()].reduce(
    (sum, allocation) => sum + allocation.purchasedSilageDmKg,
    0,
  );
  const ownSilageUsedDmKg = [...allocations.values()].reduce(
    (sum, allocation) => sum + allocation.ownSilageUsedDmKg,
    0,
  );
  const ownSilageTransferPresentValue = variables.reduce(
    (sum, route, index) =>
      sum + (solution.values[index] ?? 0) * ownSilageTransferCredit(route),
    0,
  );
  const ownGrainShare =
    grainDemandSacks > 0
      ? Math.min(1, ownGrainUsedSacks / grainDemandSacks)
      : 0;
  const ownSilageShare =
    silageDemandDmKg > 0
      ? Math.min(1, ownSilageUsedDmKg / silageDemandDmKg)
      : 0;
  const effectiveGrainCostDm =
    grainDemandSacks > 0
      ? ownGrainShare * grainOpportunityCostDm +
        (1 - ownGrainShare) * grainPurchaseCostDm
      : grainOpportunityCostDm;
  const effectiveSilageCostDm =
    silageDemandDmKg > 0
      ? ownSilageShare * input.silageOpportunityCostDm +
        (1 - ownSilageShare) * input.purchasedSilageCostDm
      : input.silageOpportunityCostDm;
  const costBasis = {
    grainDm: effectiveGrainCostDm,
    silageDm: effectiveSilageCostDm,
  };
  const weightedShadowGrain =
    grainDemandSacks > 0
      ? lots.reduce(
          (sum, lot) => sum + lot.ownHeads * lot.grainSacksHead * lot.shadowGrainPriceSack,
          0,
        ) / grainDemandSacks
      : 0;
  const weightedShadowSilage =
    silageDemandDmKg > 0
      ? lots.reduce(
          (sum, lot) => sum + lot.ownHeads * lot.silageDmKgHead * lot.shadowSilagePriceDm,
          0,
        ) / silageDemandDmKg
      : 0;
  const allocationValueVsSell =
    ownGrainUsedSacks * (weightedShadowGrain - input.grainNetSalePriceSack);
  const grainContributionHa =
    input.grainYieldSacksHa * input.grainNetSalePriceSack - input.grainCashCostHa;
  const silageContributionHa =
    input.silageDmTonnesHaYear * 1_000 * weightedShadowSilage - input.silageCashCostHaYear;
  const totalIncrementalMargin = lots.reduce(
    (sum, lot) =>
      sum +
      lot.ownHeads * lot.ownMarginHead +
      lot.outsourceHeads * lot.outsourceMarginHead,
    0,
  );
  const routeRevenuePresentValue = lots.reduce(
    (sum, lot) =>
      sum +
      (lot.ownHeads + lot.outsourceHeads) * lot.presentFinishedRevenue +
      lot.sellHeads * lot.sellNowHead,
    0,
  );
  const routeCostPresentValue = lots.reduce(
    (sum, lot) =>
      sum +
      lot.ownHeads * lot.presentOwnCost +
      lot.outsourceHeads * lot.presentOutsourceCost,
    0,
  );

  return {
    lots,
    ownHeads,
    outsourceHeads,
    sellHeads,
    grainProducedSacks,
    grainDemandSacks,
    ownGrainUsedSacks,
    ownSilageUsedDmKg,
    ownSilageTransferPresentValue,
    purchasedGrainSacks,
    soldGrainSacks,
    silageProducedDmKg,
    silageDemandDmKg,
    purchasedSilageDmKg,
    weightedShadowGrain,
    weightedShadowSilage,
    allocationValueVsSell,
    grainContributionHa,
    silageContributionHa,
    totalIncrementalMargin,
    routeRevenuePresentValue,
    routeCostPresentValue,
    thresholdOwnVsSell: thresholdGmd(
      input,
      (lot) => lot.ownMarginHead,
      costBasis,
    ),
    thresholdOwnVsAlternative: thresholdGmd(
      input,
      (lot) =>
        lot.ownMarginHead -
        (input.allowOutsource && input.thirdPartyCapacity > 0
          ? Math.max(0, lot.outsourceMarginHead)
          : 0),
      costBasis,
    ),
    effectiveGrainCostDm,
    effectiveSilageCostDm,
    ownGrainShare,
    ownSilageShare,
    penDaysUsed: lots.reduce((sum, lot) => sum + lot.ownHeads * lot.days, 0),
    penDaysCapacity,
    concurrentOwnHeads: peakConcurrentOwnHeads,
    concurrentOwnCapacity,
    calendarMode,
    calendarIssues,
    temporalOccupancy,
    committedCropCash,
    workingCapitalLimit,
    workingCapitalUsed:
      committedCropCash +
      [...allocations.values()].reduce(
        (sum, allocation) => sum + allocation.cashUsed,
        0,
      ),
    capitalShortfall: Math.max(0, committedCropCash - workingCapitalLimit),
    capitalFeasible: committedCropCash <= workingCapitalLimit + 1e-6,
    thirdPartyCapacity: Math.max(0, input.thirdPartyCapacity),
  };
}
