export type Assumptions = {
  totalArea: number;
  landLeaseHa: number;
  silageShare: number;
  stockingUa: number;
  pastureExtraCostHa?: number;
  priceArroba: number;
  carcassYieldPercent: number;
  feedlotCarcassYieldLiftPercent: number;
  saleDeductionPercent: number;
  calfCost: number;
  entryWeight: number;
  pivotExitWeight: number;
  saleWeight: number;
  gmdPivotA: number;
  gmdFeedlot: number;
  gmdB: number;
  supplementPrice: number;
  dietPriceDm: number;
  linkFeedToCropCosts: boolean;
  feedUseOpportunityCost: boolean;
  dietOtherCostDm: number;
  dietDmDay: number;
  forageShare: number;
  silageCostHaCut: number;
  silageYieldDm: number;
  silageCrops: number;
  silageRecovery: number;
  otherCostFactor: number;
  includeCows: boolean;
  cowSaleArroba: number;
  cowBuyCost: number;
  includeEffluentSavings: boolean;
  effluentArea: number;
  effluentDepthMm: number;
  effluentValueM3: number;
  investment: number;
  pivotInvestment: number;
  discountRate: number;
  horizon: number;
  terminalValue: number;
  otherIngredientSharePercent?: number;
  feedlotCapacity?: number;
  feedlotUtilization?: number;
  pastureMortalityPercent?: number;
  feedlotMortalityPercent?: number;
};

export const BASE = {
  totalArea: 400,
  pastureAreaA: 300,
  silageAreaA: 100,
  soldA: 6725,
  soldB: 4373,
  cowsSold: 798,
  ebitdaA: 9_808_729,
  ebitdaB: 7_316_859,
  ebitA: 9_068_925,
  ebitB: 6_749_295,
  grossRevenueA: 52_021_405,
  grossRevenueB: 29_985_707,
  cashMarginHeadA: 1_431.98,
  marginHeadA: 1_332.97,
  cashMarginHeadB: 1_669.89,
  marginHeadB: 1_540.35,
  cowCashMargin: 651.87,
  cowMargin: 571.16,
  cashCostHeadA: 5_326.24,
  totalCostHeadA: 5_426.14,
  cashCostHeadB: 4_868.71,
  breakEvenA: 280.61,
  breakEvenB: 267.17,
  costArrobaA: 268.11,
  costArrobaB: 255.26,
  marginHaA: 30_010,
  marginHaB: 16_873,
  roiA: 25.8,
  roiB: 28,
  investment: 10_859_939,
  basePrice: 349.5,
} as const;

export const defaultAssumptions: Assumptions = {
  totalArea: 400,
  landLeaseHa: 0,
  silageShare: 25,
  stockingUa: 7.8,
  pastureExtraCostHa: 0,
  priceArroba: 349.5,
  carcassYieldPercent: 54,
  // O caso de referência distingue o rendimento do animal terminado no
  // cocho do animal terminado a pasto. Manter um único rendimento deprimia
  // artificialmente a receita da rota A.
  feedlotCarcassYieldLiftPercent: 2,
  saleDeductionPercent: 4,
  calfCost: 3_288,
  entryWeight: 240,
  pivotExitWeight: 400,
  saleWeight: 540,
  gmdPivotA: 0.9,
  gmdFeedlot: 1.48,
  gmdB: 1,
  supplementPrice: 5.08,
  dietPriceDm: 1.1239,
  linkFeedToCropCosts: true,
  feedUseOpportunityCost: true,
  dietOtherCostDm: 0.6864,
  dietDmDay: 11.14,
  forageShare: 45,
  silageCostHaCut: 5_450,
  silageYieldDm: 18,
  silageCrops: 2,
  silageRecovery: 88.7,
  otherCostFactor: 100,
  includeCows: true,
  cowSaleArroba: 300,
  cowBuyCost: 3_673.33,
  includeEffluentSavings: false,
  // Área-alvo inicial. O volume e o crédito efetivos são reconciliados no
  // alocador a partir das cabeças-dia realmente confinadas em instalação própria.
  effluentArea: 400,
  effluentDepthMm: 150,
  effluentValueM3: 17.45,
  investment: BASE.investment,
  pivotInvestment: 0,
  discountRate: 12,
  horizon: 10,
  terminalValue: 0,
};

const cowDeduction = 1 - 5_034.69 / (((530 * 0.48) / 15) * 300);

export function annuityFactor(ratePercent: number, years: number) {
  const rate = ratePercent / 100;
  if (years <= 0) return 0;
  if (Math.abs(rate) < 1e-9) return years;
  return (1 - (1 + rate) ** -years) / rate;
}

export function npv(ratePercent: number, cashFlows: number[]) {
  const rate = ratePercent / 100;
  return cashFlows.reduce(
    (sum, cashFlow, year) => sum + cashFlow / (1 + rate) ** year,
    0,
  );
}

export function irr(cashFlows: number[]) {
  if (!cashFlows.some((flow) => flow < 0) || !cashFlows.some((flow) => flow > 0)) return null;
  const valueAt = (rate: number) =>
    cashFlows.reduce(
      (sum, cashFlow, year) => sum + cashFlow / (1 + rate) ** year,
      0,
    );
  let low = -0.99;
  let high = 10;
  let lowValue = valueAt(low);
  let highValue = valueAt(high);
  if (lowValue * highValue > 0) return null;
  for (let index = 0; index < 180; index += 1) {
    const middle = (low + high) / 2;
    const middleValue = valueAt(middle);
    if (Math.abs(middleValue) < 0.01) return middle * 100;
    if (lowValue * middleValue <= 0) {
      high = middle;
      highValue = middleValue;
    } else {
      low = middle;
      lowValue = middleValue;
    }
  }
  return ((low + high) / 2) * 100;
}

function safeDays(weightGain: number, gmd: number) {
  return Math.max(1, Math.ceil(weightGain / Math.max(gmd, 0.05)));
}

export function calculateCore(a: Assumptions) {
  const routeAInputValid = a.gmdPivotA > 0 && a.gmdFeedlot > 0 && a.totalArea > 0 && a.silageShare >= 0 && a.silageShare <= 100 &&
    a.forageShare >= 0 && a.forageShare + (a.otherIngredientSharePercent ?? 0) <= 100 &&
    a.entryWeight > 0 && a.pivotExitWeight > a.entryWeight && a.saleWeight > a.pivotExitWeight;
  const routeBInputValid = a.gmdB > 0 && a.entryWeight > 0 && a.saleWeight > a.entryWeight;
  const inputErrors = [
    ...(!routeAInputValid ? ['Rota A: entrada < decisão < saída e ganhos diários positivos são obrigatórios.'] : []),
    ...(!routeBInputValid ? ['Rota B: saída maior que entrada e ganho diário positivo são obrigatórios.'] : []),
  ];
  const scale = a.totalArea / BASE.totalArea;
  const silageArea = a.totalArea * (a.silageShare / 100);
  const pastureAreaA = Math.max(0, a.totalArea - silageArea);
  const pastureAreaB = a.totalArea;
  const daysPivotA = safeDays(a.pivotExitWeight - a.entryWeight, a.gmdPivotA);
  const daysFeedlot = safeDays(a.saleWeight - a.pivotExitWeight, a.gmdFeedlot);
  const daysB = safeDays(a.saleWeight - a.entryWeight, a.gmdB);
  const cyclesA = routeAInputValid ? 365 / daysPivotA : 0;
  const cyclesB = routeBInputValid ? 365 / daysB : 0;
  const avgWeightA = (a.entryWeight + a.pivotExitWeight) / 2;
  const avgWeightB = (a.entryWeight + a.saleWeight) / 2;
  const pastureSurvival = 1 - Math.min(100, Math.max(0, a.pastureMortalityPercent ?? 0.2)) / 100;
  const feedlotSurvival = 1 - Math.min(100, Math.max(0, a.feedlotMortalityPercent ?? 0)) / 100;
  const survival = pastureSurvival * feedlotSurvival;

  const simultaneousPivotA =
    (pastureAreaA * a.stockingUa) / Math.max(avgWeightA / 450, 0.1);
  const simultaneousPivotB =
    (pastureAreaB * a.stockingUa) / Math.max(avgWeightB / 450, 0.1);
  const pastureEntryCapacityA = simultaneousPivotA * cyclesA;
  const pastureCandidatesA = pastureEntryCapacityA * pastureSurvival;
  const pasturePotentialA = pastureCandidatesA * feedlotSurvival;
  const pasturePotentialB = simultaneousPivotB * cyclesB * pastureSurvival;

  const dietDmHead = (a.dietDmDay * daysFeedlot) / 1_000;
  const forageDmHead = dietDmHead * (a.forageShare / 100);
  const usableSilageDmHa =
    a.silageYieldDm * a.silageCrops * (a.silageRecovery / 100);
  const silagePotentialA =
    forageDmHead > 0 ? (silageArea * usableSilageDmHa) / forageDmHead * feedlotSurvival : Infinity;
  const feedlotPotentialA = a.feedlotCapacity === undefined ? Infinity : Math.max(0, a.feedlotCapacity) *
    Math.max(0, Math.min(100, a.feedlotUtilization ?? 100)) / 100 * 365 / daysFeedlot * feedlotSurvival;
  const feedlotEntryLimit = Math.min(
    forageDmHead > 0 ? silageArea * usableSilageDmHa / forageDmHead : Infinity,
    a.feedlotCapacity === undefined ? Infinity : Math.max(0, a.feedlotCapacity) *
      Math.max(0, Math.min(100, a.feedlotUtilization ?? 100)) / 100 * 365 / daysFeedlot,
  );
  const entrantsA = routeAInputValid ? Math.max(0, Math.min(simultaneousPivotA * cyclesA,
    pastureSurvival > 0 ? feedlotEntryLimit / pastureSurvival : Infinity)) : 0;
  const entrantsB = Math.max(0, simultaneousPivotB * cyclesB);
  const feedlotEntriesA = entrantsA * pastureSurvival;
  const soldA = feedlotEntriesA * feedlotSurvival;
  const soldB = entrantsB * pastureSurvival;
  const bindingConstraintA =
    feedlotPotentialA < Math.min(pasturePotentialA, silagePotentialA) ? 'vagas-dia de cocho' : pasturePotentialA <= silagePotentialA ? 'pasto sob pivô' : 'silagem';
  const requiredSilageArea =
    usableSilageDmHa > 0 ? (simultaneousPivotA * cyclesA * pastureSurvival * forageDmHead) / usableSilageDmHa : Infinity;
  const balancedStockingUa =
    (silagePotentialA / Math.max(cyclesA * survival, 0.01)) *
    (avgWeightA / 450) /
    Math.max(pastureAreaA, 0.000001);

  const netSaleA =
    (a.saleWeight *
      (Math.min(100, a.carcassYieldPercent + a.feedlotCarcassYieldLiftPercent) /
        100) *
      a.priceArroba *
      (1 - a.saleDeductionPercent / 100)) /
    15;
  const netSaleB =
    (a.saleWeight *
      (a.carcassYieldPercent / 100) *
      a.priceArroba *
      (1 - a.saleDeductionPercent / 100)) /
    15;

  const supplementKgA = 28.4 * (daysPivotA / (160 / 0.9));
  const supplementKgB = 105.3 * (daysB / 300);
  // O&M do pivô é orçamento por hectare/ano, não multiplicador gratuito de cabeças.
  // Benchmark agregado; o diagnóstico hídrico é separado até existir medição local.
  const annualPastureOperatingA = pastureAreaA * (BASE.soldA * (432.62 + 19.97) / BASE.pastureAreaA + (a.pastureExtraCostHa ?? 0));
  const annualPastureOperatingB = pastureAreaB * (BASE.soldB * 930.89 / BASE.totalArea + (a.pastureExtraCostHa ?? 0));
  const pastureOperatingA = soldA > 0 ? annualPastureOperatingA / soldA : 0;
  const pastureOperatingB = soldB > 0 ? annualPastureOperatingB / soldB : 0;
  const variableFactor = a.otherCostFactor / 100;
  const annualSilageCashCost =
    silageArea * a.silageCostHaCut * a.silageCrops * variableFactor;
  const silageCashCostDm =
    usableSilageDmHa > 0
      ? (a.silageCostHaCut * a.silageCrops) / (usableSilageDmHa * 1_000)
      : 0;
  const embeddedSilageCostHead =
    forageDmHead * 1_000 * silageCashCostDm;
  const consumedDietCostBeforeFactor = dietDmHead * 1_000 * a.dietPriceDm;
  const nonSilageDietCostHead =
    Math.max(0, consumedDietCostBeforeFactor - embeddedSilageCostHead) *
    variableFactor;
  const allocatedSilageCostHead =
    soldA > 0 ? annualSilageCashCost / soldA : 0;
  const silageConsumedDm = feedlotEntriesA * forageDmHead;
  const silageProducedDm = silageArea * usableSilageDmHa;
  const silageSurplusDm = Math.max(0, silageProducedDm - silageConsumedDm);
  const silageSurplusCashCost = Math.max(
    0,
    annualSilageCashCost -
      feedlotEntriesA * embeddedSilageCostHead * variableFactor,
  );
  const costComponentsA = {
    animal: a.calfCost,
    freightIn: 50 * variableFactor,
    supplement: supplementKgA * a.supplementPrice * variableFactor,
    // The fixed silage area is fully costed. Consumed silage embedded in the
    // ration price is replaced by the full annual crop cost, avoiding both a
    // free surplus and double charging the consumed tonnes.
    feedlotDiet: nonSilageDietCostHead + allocatedSilageCostHead,
    feedlotOperation: 141.89 * (daysFeedlot / (140 / 1.48)) * variableFactor,
    health: 45 * variableFactor,
    freightOut: 19.9 * variableFactor,
    pivotOperation: pastureOperatingA * variableFactor,
  };
  const costComponentsB = {
    animal: a.calfCost,
    freightIn: 50 * variableFactor,
    supplement: supplementKgB * a.supplementPrice * variableFactor,
    health: 45 * variableFactor,
    freightOut: 19.9 * variableFactor,
    pivotOperation: pastureOperatingB * variableFactor,
  };
  // Perdas no fim da fase: compra e custeio dos animais perdidos permanecem.
  // Hipótese conservadora explícita; o modelo de lotes pode datar perdas antes.
  const preFeedlotCostHead = a.calfCost + costComponentsA.freightIn + costComponentsA.supplement + costComponentsA.health;
  const feedlotVariableCostHead = nonSilageDietCostHead + costComponentsA.feedlotOperation;
  const preSaleCostHeadB = a.calfCost + costComponentsB.freightIn + costComponentsB.supplement + costComponentsB.health;
  // Perdas ao fim de cada fase: mortos no pasto não consomem dieta nem vagas de cocho.
  // As quantidades custeadas permanecem mesmo se nenhuma cabeça chegar à venda.
  const operatingCostsA = entrantsA * preFeedlotCostHead + feedlotEntriesA * feedlotVariableCostHead +
    soldA * costComponentsA.freightOut + annualSilageCashCost + annualPastureOperatingA * variableFactor;
  const operatingCostsB = entrantsB * preSaleCostHeadB + soldB * costComponentsB.freightOut + annualPastureOperatingB * variableFactor;
  const mortalityCostHeadA = soldA > 0 ? (entrantsA - soldA) / soldA * preFeedlotCostHead +
    (feedlotEntriesA - soldA) / soldA * feedlotVariableCostHead : 0;
  const mortalityCostHeadB = soldB > 0 ? (entrantsB - soldB) / soldB * preSaleCostHeadB : 0;
  const cashCostHeadA = soldA > 0 ? operatingCostsA / soldA : 0;
  const cashCostHeadB = soldB > 0 ? operatingCostsB / soldB : 0;
  const cashMarginHeadA = soldA > 0 ? netSaleA - cashCostHeadA : 0;
  const cashMarginHeadB = soldB > 0 ? netSaleB - cashCostHeadB : 0;

  // Opportunity cows use one explicitly shared post-silage batch on the
  // silage hectares. They do not create another 25% of invisible land.
  const cowWindowArea = silageArea;
  const cowsSold = a.includeCows ? cowWindowArea * 8 * 0.9975 : 0;
  const cowNetSale =
    ((530 * 0.48) / 15) * a.cowSaleArroba * (1 - cowDeduction);
  const cowOtherCashCost = 50 + 84.33 + 45 + 19.96 + 510.19;
  const cowCashCost = (a.cowBuyCost + (cowOtherCashCost - 19.96) * variableFactor) / 0.9975 + 19.96 * variableFactor;
  const cowCashMargin = cowNetSale - cowCashCost;

  const fertilizerSavingsPerHa =
    (a.effluentDepthMm / 1_000) * 10_000 * a.effluentValueM3;
  const fertilizerSavings = fertilizerSavingsPerHa * a.effluentArea;
  // O núcleo estático não conhece o roteamento final do cocho. O crédito só
  // pode ser incluído depois que as cabeças-dia próprias fecharem no alocador.
  // Mantemos o valor-alvo para diagnóstico, mas nunca o lançamos aqui.
  const includedFertilizerSavings = 0;
  const landLeaseCost = a.totalArea * a.landLeaseHa;
  const unallocatedSilageCost = soldA > 0 ? 0 : operatingCostsA;
  const unallocatedPastureB = soldB > 0 ? 0 : operatingCostsB;

  const ebitdaA =
    soldA * cashMarginHeadA +
    cowsSold * cowCashMargin +
    includedFertilizerSavings -
    landLeaseCost - unallocatedSilageCost;
  const ebitdaB = soldB * cashMarginHeadB - landLeaseCost - unallocatedPastureB;
  const depreciationA = (BASE.ebitdaA - BASE.ebitA) * scale;
  const depreciationB = (BASE.ebitdaB - BASE.ebitB) * scale;
  const ebitA = ebitdaA - depreciationA;
  const ebitB = ebitdaB - depreciationB;
  const incrementalEbitda = ebitdaA - ebitdaB;
  const confinementOccupancy = (feedlotEntriesA * daysFeedlot) / 365;
  const recommendedConfinementCapacity = Math.ceil((confinementOccupancy * 1.1) / 50) * 50;

  const netRevenueA = soldA * netSaleA + cowsSold * cowNetSale;
  const netRevenueB = soldB * netSaleB;
  const cashCostsA =
    soldA * cashCostHeadA +
    cowsSold * cowCashCost +
    landLeaseCost -
    includedFertilizerSavings + unallocatedSilageCost;
  const cashCostsB = soldB * cashCostHeadB + landLeaseCost + unallocatedPastureB;
  const workingCapitalA =
    simultaneousPivotA * a.calfCost + confinementOccupancy * cashCostHeadA * 0.34;
  const workingCapitalB = simultaneousPivotB * a.calfCost;
  const incrementalWorkingCapital = workingCapitalA - workingCapitalB;

  const annualFlows = Array.from({ length: Math.max(1, Math.round(a.horizon)) }, (_, index) =>
    index === Math.max(1, Math.round(a.horizon)) - 1
      ? incrementalEbitda + a.terminalValue + incrementalWorkingCapital
      : incrementalEbitda,
  );
  const cashFlows = [
    -a.investment - incrementalWorkingCapital,
    ...annualFlows,
  ];
  const operationalNpv = npv(a.discountRate, cashFlows);
  const operationalIrr = irr(cashFlows);
  const annuity = annuityFactor(a.discountRate, Math.max(1, Math.round(a.horizon)));
  const maxInvestment =
    incrementalEbitda * annuity +
    (a.terminalValue + incrementalWorkingCapital) /
      (1 + a.discountRate / 100) ** Math.max(1, Math.round(a.horizon)) -
    incrementalWorkingCapital;
  const requiredIncremental =
    (a.investment + incrementalWorkingCapital -
      (a.terminalValue + incrementalWorkingCapital) /
        (1 + a.discountRate / 100) ** Math.max(1, Math.round(a.horizon))) /
    Math.max(annuity, 0.01);
  const simplePayback =
    incrementalEbitda > 0
      ? (a.investment + Math.max(0, incrementalWorkingCapital)) /
        incrementalEbitda
      : null;

  return {
    routeAInputValid,
    routeBInputValid,
    inputErrors,
    survival,
    pastureSurvival,
    feedlotSurvival,
    entrantsA,
    entrantsB,
    feedlotEntriesA,
    operatingCostsA,
    operatingCostsB,
    preFeedlotCostHead,
    feedlotVariableCostHead,
    preSaleCostHeadB,
    mortalityCostHeadA,
    mortalityCostHeadB,
    scale,
    silageArea,
    pastureAreaA,
    pastureAreaB,
    daysPivotA,
    daysFeedlot,
    daysB,
    cyclesA,
    cyclesB,
    simultaneousPivotA,
    simultaneousPivotB,
    pasturePotentialA,
    pastureCandidatesA,
    pastureEntryCapacityA,
    pasturePotentialB,
    silagePotentialA,
    feedlotPotentialA,
    annualPastureOperatingA,
    annualPastureOperatingB,
    soldA,
    soldB,
    bindingConstraintA,
    requiredSilageArea,
    balancedStockingUa,
    annualSilageCashCost,
    silageCashCostDm,
    silageProducedDm,
    silageConsumedDm,
    silageSurplusDm,
    silageSurplusCashCost,
    dietDmHead,
    forageDmHead,
    netSaleA,
    netSaleB,
    cashCostHeadA,
    cashCostHeadB,
    costComponentsA,
    costComponentsB,
    cashMarginHeadA,
    cashMarginHeadB,
    cowsSold,
    cowWindowArea,
    cowNetSale,
    cowCashCost,
    cowCashMargin,
    fertilizerSavingsPerHa,
    fertilizerSavings,
    includedFertilizerSavings,
    landLeaseCost,
    ebitdaA,
    ebitdaB,
    ebitA,
    ebitB,
    incrementalEbitda,
    netRevenueA,
    netRevenueB,
    cashCostsA,
    cashCostsB,
    workingCapitalA,
    workingCapitalB,
    incrementalWorkingCapital,
    confinementOccupancy,
    recommendedConfinementCapacity,
    operationalNpv,
    operationalIrr,
    maxInvestment,
    requiredIncremental,
    simplePayback,
    cashFlows,
  };
}

function findThreshold(
  source: Assumptions,
  key: keyof Pick<Assumptions, 'priceArroba' | 'dietPriceDm' | 'stockingUa'>,
  low: number,
  high: number,
  objective: (result: ReturnType<typeof calculateCore>) => number,
) {
  let lowValue = objective(calculateCore({ ...source, [key]: low }));
  let highValue = objective(calculateCore({ ...source, [key]: high }));
  if (lowValue === 0) return low;
  if (highValue === 0) return high;
  if (lowValue * highValue > 0) return null;
  for (let index = 0; index < 90; index += 1) {
    const middle = (low + high) / 2;
    const value = objective(calculateCore({ ...source, [key]: middle }));
    if (Math.abs(value) < 0.5) return middle;
    if (lowValue * value <= 0) {
      high = middle;
      highValue = value;
    } else {
      low = middle;
      lowValue = value;
    }
  }
  return (low + high) / 2;
}

export function simulate(a: Assumptions) {
  const result = calculateCore(a);
  const priceBreakEvenA = findThreshold(
    a,
    'priceArroba',
    1,
    1_000,
    (next) => next.ebitdaA,
  );
  const priceBreakEvenB = findThreshold(
    a,
    'priceArroba',
    1,
    1_000,
    (next) => next.ebitdaB,
  );
  const priceWhereAEqualsB = findThreshold(
    a,
    'priceArroba',
    1,
    1_000,
    (next) => next.incrementalEbitda,
  );
  const maxDietPrice = findThreshold(
    a,
    'dietPriceDm',
    0.2,
    6,
    (next) => next.incrementalEbitda,
  );
  const minimumStockingForA = findThreshold(
    a,
    'stockingUa',
    1,
    16,
    (next) => next.incrementalEbitda,
  );
  return {
    ...result,
    priceBreakEvenA,
    priceBreakEvenB,
    priceWhereAEqualsB,
    maxDietPrice,
    minimumStockingForA,
  };
}
