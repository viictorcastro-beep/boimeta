export type AnimalCurvePoint = {
  id: string;
  contract: string;
  date: string;
  price: number;
  sourceDate: string;
};

export type AnimalTimelineInputs = {
  entryDate: string;
  entryLiveWeight: number;
  decisionLiveWeight: number;
  finalLiveWeight: number;
  gmdToDecision: number;
  gmdPastureFinish: number;
  gmdFeedlot: number;
  carcassYieldPercent: number;
  feedlotCarcassYieldLiftPercent?: number;
  saleDeductionPercent: number;
  entryCostHead: number;
  entryPriceDate: string;
  gateValuePerKgLive: number;
  gatePriceDate: string;
  gateSourceDate: string;
  asOfDate: string;
  commonPastureCostDay: number;
  pastureFinishCostDay: number;
  dietDmDay: number;
  dietPriceDm: number;
  ownOperationDay: number;
  ownFixedCostHead: number;
  thirdPartyAllInDay: number;
  thirdPartyFreightHead: number;
  includeThirdParty?: boolean;
  annualCarryRatePercent: number;
  mortalityPercent: number;
  pastureMortalityPercent: number;
  bgiEligible: boolean;
  curve: AnimalCurvePoint[];
};

export type CurveCoverage =
  | 'exact'
  | 'interpolated'
  | 'before-curve'
  | 'after-curve'
  | 'ineligible'
  | 'missing';

export type AnimalComparisonStatus =
  | 'comparable'
  | 'insufficient-market-coverage'
  | 'gate-price-date-mismatch'
  | 'invalid-source-date'
  | 'invalid-curve-source-date'
  | 'invalid-input';

export type AnimalRoute = {
  id: 'sell-gate' | 'pasture-finish' | 'own-feedlot' | 'third-party';
  label: string;
  exitDate: string;
  daysAfterDecision: number;
  exitLiveWeight: number;
  exitCarcassArrobas: number;
  projectedPrice: number | null;
  contracts: string;
  curveCoverage: CurveCoverage;
  netRevenueHead: number | null;
  routeCostHead: number;
  carryCostHead: number;
  incrementalVsSellGate: number | null;
  marginFromEntry: number | null;
};

const DAY_MS = 86_400_000;
const MAX_GATE_SOURCE_AGE_DAYS = 14;
const MAX_CURVE_SOURCE_AGE_DAYS = 7;

function utcDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && isoDate(date) === iso ? date : null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const date = utcDate(iso);
  if (!date || !Number.isFinite(days) || days < 0) return '';
  date.setUTCDate(date.getUTCDate() + Math.ceil(days));
  return isoDate(date);
}

function safeDays(weightGain: number, gmd: number) {
  // O calendário, os custos e o ranking usam o mesmo número inteiro de diárias.
  return Math.ceil(weightGain / gmd);
}

function validateTimelineInputs(input: AnimalTimelineInputs) {
  const errors: string[] = [];
  if (!utcDate(input.entryDate)) errors.push('Informe uma data de entrada válida.');
  if (!Number.isFinite(input.entryLiveWeight) || input.entryLiveWeight <= 0) {
    errors.push('O peso vivo de entrada deve ser maior que zero.');
  }
  if (
    !Number.isFinite(input.decisionLiveWeight) ||
    input.decisionLiveWeight <= input.entryLiveWeight
  ) {
    errors.push('O peso da decisão deve ser maior que o peso de entrada.');
  }
  if (
    !Number.isFinite(input.finalLiveWeight) ||
    input.finalLiveWeight <= input.decisionLiveWeight
  ) {
    errors.push('O peso final deve ser maior que o peso da decisão.');
  }
  const positiveRates: Array<[number, string]> = [
    [input.gmdToDecision, 'O GMD até a decisão deve ser maior que zero.'],
    [input.gmdPastureFinish, 'O GMD de terminação no pivô deve ser maior que zero.'],
    [input.gmdFeedlot, 'O GMD de confinamento deve ser maior que zero.'],
  ];
  positiveRates.forEach(([value, message]) => {
    if (!Number.isFinite(value) || value <= 0) errors.push(message);
  });
  if (
    !Number.isFinite(input.carcassYieldPercent) ||
    input.carcassYieldPercent <= 0 ||
    input.carcassYieldPercent > 100
  ) {
    errors.push('O rendimento de carcaça deve estar entre 0% e 100%.');
  }
  const boundedPercentages: Array<[number, string]> = [
    [input.saleDeductionPercent, 'As deduções de venda devem estar entre 0% e 100%.'],
    [input.mortalityPercent, 'A mortalidade no confinamento deve estar entre 0% e 100%.'],
    [input.pastureMortalityPercent, 'A mortalidade no pivô deve estar entre 0% e 100%.'],
  ];
  boundedPercentages.forEach(([value, message]) => {
    if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(message);
  });
  const nonNegativeValues: Array<[number, string]> = [
    [input.entryCostHead, 'O custo de entrada não pode ser negativo.'],
    [input.gateValuePerKgLive, 'O valor do boi magro não pode ser negativo.'],
    [input.commonPastureCostDay, 'O custo comum de recria não pode ser negativo.'],
    [input.pastureFinishCostDay, 'O custo de terminação no pivô não pode ser negativo.'],
    [input.dietDmDay, 'O consumo diário de matéria seca não pode ser negativo.'],
    [input.dietPriceDm, 'O preço da matéria seca não pode ser negativo.'],
    [input.ownOperationDay, 'O custo operacional próprio não pode ser negativo.'],
    [input.ownFixedCostHead, 'O custo fixo próprio não pode ser negativo.'],
    [input.annualCarryRatePercent, 'A taxa de carregamento não pode ser negativa.'],
  ];
  if (input.includeThirdParty !== false) {
    nonNegativeValues.push(
      [input.thirdPartyAllInDay, 'A diária terceirizada não pode ser negativa.'],
      [input.thirdPartyFreightHead, 'O frete terceirizado não pode ser negativo.'],
    );
  }
  nonNegativeValues.forEach(([value, message]) => {
    if (!Number.isFinite(value) || value < 0) errors.push(message);
  });
  return errors;
}

function invalidTimelineResult(inputErrors: string[], includeThirdParty = true) {
  const routes: AnimalRoute[] = [
    ['sell-gate', 'Vender na data de decisão'],
    ['pasture-finish', 'Fechar o ciclo no pivô'],
    ['own-feedlot', 'Confinamento próprio'],
    ...(includeThirdParty
      ? ([['third-party', 'Confinamento de terceiro']] as const)
      : []),
  ].map(([id, label]) => ({
    id: id as AnimalRoute['id'],
    label,
    exitDate: '',
    daysAfterDecision: 0,
    exitLiveWeight: 0,
    exitCarcassArrobas: 0,
    projectedPrice: null,
    contracts: 'entrada inválida',
    curveCoverage: 'missing',
    netRevenueHead: null,
    routeCostHead: 0,
    carryCostHead: 0,
    incrementalVsSellGate: null,
    marginFromEntry: null,
  }));
  return {
    entryToDecisionDays: 0,
    decisionDate: '',
    gateValueHead: 0,
    commonCost: 0,
    routes,
    ranking: routes,
    bestRoute: null,
    comparisonStatus: 'invalid-input' as AnimalComparisonStatus,
    inputErrors,
    entryPriceSourceValid: false,
    gatePriceAligned: false,
    gateSourceValid: false,
    curveSourceValid: false,
    sourceAgeDays: null,
    forecastHorizonDays: null,
    oldestSourceDate: '',
    newestSourceDate: '',
    curveSnapshotAgeDays: null,
  };
}

export function cattlePriceAtDate(
  curve: AnimalCurvePoint[],
  targetDate: string,
) {
  const target = utcDate(targetDate);
  const points = curve
    .map((point) => ({ ...point, parsedDate: utcDate(point.date) }))
    .filter(
      (point): point is AnimalCurvePoint & { parsedDate: Date } =>
        point.parsedDate !== null && Number.isFinite(point.price) && point.price > 0,
    )
    .sort((left, right) => left.parsedDate.getTime() - right.parsedDate.getTime());

  if (!target || points.length === 0) {
    return {
      price: null,
      coverage: 'missing' as const,
      contracts: 'sem curva',
      sourceDate: '',
    };
  }
  const first = points[0];
  const last = points[points.length - 1];
  const exact = points.find(
    (point) => point.parsedDate.getTime() === target.getTime(),
  );
  if (exact) {
    return {
      price: exact.price,
      coverage: 'exact' as const,
      contracts: exact.contract,
      sourceDate: exact.sourceDate,
    };
  }
  if (target.getTime() < first.parsedDate.getTime()) {
    return {
      price: null,
      coverage: 'before-curve' as const,
      contracts: first.contract,
      sourceDate: first.sourceDate,
    };
  }
  if (target.getTime() > last.parsedDate.getTime()) {
    return {
      price: null,
      coverage: 'after-curve' as const,
      contracts: last.contract,
      sourceDate: last.sourceDate,
    };
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (target.getTime() > right.parsedDate.getTime()) continue;
    const width = right.parsedDate.getTime() - left.parsedDate.getTime();
    const elapsed = target.getTime() - left.parsedDate.getTime();
    const fraction = width > 0 ? elapsed / width : 0;
    return {
      price: left.price + (right.price - left.price) * fraction,
      coverage: 'interpolated' as const,
      contracts: `${left.contract} ↔ ${right.contract}`,
      sourceDate:
        left.sourceDate <= right.sourceDate ? left.sourceDate : right.sourceDate,
    };
  }

  return {
    price: null,
    coverage: 'after-curve' as const,
    contracts: last.contract,
    sourceDate: last.sourceDate,
  };
}

export function projectAnimalDecision(input: AnimalTimelineInputs) {
  const inputErrors = validateTimelineInputs(input);
  if (inputErrors.length > 0) {
    return invalidTimelineResult(inputErrors, input.includeThirdParty !== false);
  }
  const entryToDecisionDays = safeDays(
    input.decisionLiveWeight - input.entryLiveWeight,
    input.gmdToDecision,
  );
  const decisionDate = addDays(input.entryDate, entryToDecisionDays);
  const entryCostHead = Math.max(0, input.entryCostHead);
  const preDecisionPastureCost =
    entryToDecisionDays * Math.max(0, input.commonPastureCostDay);
  const commonCost = entryCostHead + preDecisionPastureCost;
  const asOf = utcDate(input.asOfDate);
  const entry = utcDate(input.entryDate);
  const entryPriceSource = utcDate(input.entryPriceDate);
  const entryPriceSourceValid = Boolean(
    asOf &&
      entry &&
      entryPriceSource &&
      entryPriceSource.getTime() <= asOf.getTime() &&
      entryPriceSource.getTime() <= entry.getTime(),
  );
  const gateValueHead =
    Math.max(0, input.decisionLiveWeight) * Math.max(0, input.gateValuePerKgLive);
  const retainedSale =
    1 - Math.min(1, Math.max(0, input.saleDeductionPercent / 100));
  const carcassYield = Math.min(
    1,
    Math.max(0, input.carcassYieldPercent / 100),
  );
  const annualCarry = Math.max(0, input.annualCarryRatePercent / 100);

  const finishedRoute = (
    id: AnimalRoute['id'],
    label: string,
    gmd: number,
    costForDays: (days: number) => number,
    mortalityPercent: number,
  ): AnimalRoute => {
    const days = safeDays(
      input.finalLiveWeight - input.decisionLiveWeight,
      gmd,
    );
    const exitDate = addDays(decisionDate, days);
    const routeYield = id === 'pasture-finish' ? carcassYield : Math.min(1,
      Math.max(0, carcassYield + (input.feedlotCarcassYieldLiftPercent ?? 0) / 100));
    const arrobas = (Math.max(0, input.finalLiveWeight) * routeYield) / 15;
    const eligible = input.bgiEligible && arrobas >= 16;
    const curve = eligible
      ? cattlePriceAtDate(input.curve, exitDate)
      : {
          price: null,
          coverage: 'ineligible' as const,
          contracts: 'lote fora do padrão BGI informado',
          sourceDate: '',
        };
    const routeSurvival =
      1 - Math.min(1, Math.max(0, mortalityPercent / 100));
    const netRevenueHead =
      curve.price === null
        ? null
        : curve.price * arrobas * retainedSale * routeSurvival;
    const routeCostHead = Math.max(0, costForDays(days));
    const yearFraction = days / 365;
    const revenueDiscount = Math.pow(1 + annualCarry, yearFraction);
    const costDiscount = Math.pow(1 + annualCarry, yearFraction / 2);
    const presentRevenue =
      netRevenueHead === null ? null : netRevenueHead / revenueDiscount;
    const presentRouteCost = routeCostHead / costDiscount;
    const totalYearFraction = (entryToDecisionDays + days) / 365;
    const presentRevenueAtEntry =
      netRevenueHead === null
        ? null
        : netRevenueHead / Math.pow(1 + annualCarry, totalYearFraction);
    const presentPastureCostAtEntry =
      preDecisionPastureCost /
      Math.pow(1 + annualCarry, entryToDecisionDays / 730);
    const presentRouteCostAtEntry =
      routeCostHead /
      Math.pow(
        1 + annualCarry,
        (entryToDecisionDays + days / 2) / 365,
      );
    const temporalAdjustment =
      netRevenueHead === null
        ? 0
        : netRevenueHead -
          routeCostHead -
          ((presentRevenue ?? 0) - presentRouteCost);
    return {
      id,
      label,
      exitDate,
      daysAfterDecision: days,
      exitLiveWeight: input.finalLiveWeight,
      exitCarcassArrobas: arrobas,
      projectedPrice: curve.price,
      contracts: curve.contracts,
      curveCoverage: curve.coverage,
      netRevenueHead,
      routeCostHead,
      carryCostHead: temporalAdjustment,
      incrementalVsSellGate:
        presentRevenue === null
          ? null
          : presentRevenue - gateValueHead - presentRouteCost,
      marginFromEntry:
        presentRevenueAtEntry === null || !entryPriceSourceValid
          ? null
          : presentRevenueAtEntry -
            entryCostHead -
            presentPastureCostAtEntry -
            presentRouteCostAtEntry,
    };
  };

  const routes: AnimalRoute[] = [
    {
      id: 'sell-gate',
      label: 'Vender na data de decisão',
      exitDate: decisionDate,
      daysAfterDecision: 0,
      exitLiveWeight: input.decisionLiveWeight,
      exitCarcassArrobas: (input.decisionLiveWeight * carcassYield) / 15,
      projectedPrice: null,
      contracts: 'valor manual do boi magro',
      curveCoverage: 'missing',
      netRevenueHead: gateValueHead,
      routeCostHead: 0,
      carryCostHead: 0,
      incrementalVsSellGate: 0,
      marginFromEntry:
        entryPriceSourceValid
          ? gateValueHead /
              Math.pow(1 + annualCarry, entryToDecisionDays / 365) -
            entryCostHead -
            preDecisionPastureCost /
              Math.pow(1 + annualCarry, entryToDecisionDays / 730)
          : null,
    },
    finishedRoute(
      'pasture-finish',
      'Fechar o ciclo no pivô',
      input.gmdPastureFinish,
      (days) => days * Math.max(0, input.pastureFinishCostDay),
      input.pastureMortalityPercent,
    ),
    finishedRoute(
      'own-feedlot',
      'Confinamento próprio',
      input.gmdFeedlot,
      (days) =>
        days *
          (Math.max(0, input.dietDmDay) * Math.max(0, input.dietPriceDm) +
            Math.max(0, input.ownOperationDay)) +
        Math.max(0, input.ownFixedCostHead),
      input.mortalityPercent,
    ),
    ...(input.includeThirdParty !== false
      ? [
          finishedRoute(
            'third-party',
            'Confinamento de terceiro',
            input.gmdFeedlot,
            (days) =>
              days * Math.max(0, input.thirdPartyAllInDay) +
              Math.max(0, input.thirdPartyFreightHead),
            input.mortalityPercent,
          ),
        ]
      : []),
  ];

  const comparableFinishedRoutes = routes.filter(
    (route) => route.id !== 'sell-gate' && route.incrementalVsSellGate !== null,
  );
  const gatePriceAligned = input.gatePriceDate === decisionDate;
  const gateSource = utcDate(input.gateSourceDate);
  const gateTarget = utcDate(input.gatePriceDate);
  const gateSourceValid = Boolean(
    gateSource &&
      asOf &&
      gateTarget &&
      gateSource.getTime() <= asOf.getTime() &&
      gateSource.getTime() <= gateTarget.getTime() &&
      (asOf.getTime() - gateSource.getTime()) / DAY_MS <=
        MAX_GATE_SOURCE_AGE_DAYS,
  );
  const sourceAgeDays =
    gateSource && asOf
      ? Math.round((asOf.getTime() - gateSource.getTime()) / DAY_MS)
      : null;
  const forecastHorizonDays =
    asOf && gateTarget
      ? Math.round((gateTarget.getTime() - asOf.getTime()) / DAY_MS)
      : null;
  const curveSourceValid = Boolean(
    asOf &&
      input.curve.length > 0 &&
      input.curve.every((point) => {
        const sourceDate = utcDate(point.sourceDate);
        const referenceDate = utcDate(point.date);
        return (
          sourceDate &&
          referenceDate &&
          Number.isFinite(point.price) &&
          point.price > 0 &&
          sourceDate.getTime() <= asOf.getTime() &&
          sourceDate.getTime() <= referenceDate.getTime() &&
          (asOf.getTime() - sourceDate.getTime()) / DAY_MS <=
            MAX_CURVE_SOURCE_AGE_DAYS
        );
      }) &&
      new Set(input.curve.map((point) => point.sourceDate)).size === 1 &&
      new Set(input.curve.map((point) => point.date)).size === input.curve.length,
  );
  const comparisonStatus: AnimalComparisonStatus = !curveSourceValid
    ? 'invalid-curve-source-date'
    : !gateSourceValid
    ? 'invalid-source-date'
    : !gatePriceAligned
    ? 'gate-price-date-mismatch'
    : comparableFinishedRoutes.length > 0
      ? 'comparable'
      : 'insufficient-market-coverage';
  const sourceDates = input.curve
    .map((point) => point.sourceDate)
    .filter(Boolean)
    .sort();
  const oldestSourceDate = sourceDates[0] ?? '';
  const newestSourceDate = sourceDates[sourceDates.length - 1] ?? '';
  const newest = utcDate(newestSourceDate);
  const curveSnapshotAgeDays =
    asOf && newest
      ? Math.round((asOf.getTime() - newest.getTime()) / DAY_MS)
      : null;
  const exposedRoutes =
    comparisonStatus === 'comparable'
      ? routes
      : routes.map((route) => ({
          ...route,
          incrementalVsSellGate: null,
        }));
  const ranking = [...exposedRoutes].sort(
    (left, right) =>
      (right.incrementalVsSellGate ?? Number.NEGATIVE_INFINITY) -
      (left.incrementalVsSellGate ?? Number.NEGATIVE_INFINITY),
  );

  return {
    entryToDecisionDays,
    decisionDate,
    gateValueHead,
    commonCost,
    routes: exposedRoutes,
    ranking,
    bestRoute: comparisonStatus === 'comparable' ? ranking[0] : null,
    comparisonStatus,
    inputErrors,
    entryPriceSourceValid,
    gatePriceAligned,
    gateSourceValid,
    curveSourceValid,
    sourceAgeDays,
    forecastHorizonDays,
    oldestSourceDate,
    newestSourceDate,
    curveSnapshotAgeDays,
  };
}
