export type BreedingEconomicsInputs = {
  annualEntrants: number;
  desiredOwnSharePercent: number;
  netEligibleCalvesPerCow: number;
  calfPurchaseWeightKg: number;
  purchasedCalfPriceHead: number;
  purchaseTransactionCostHead: number;
  finishedCattlePriceArroba: number;
  carcassYieldPercent: number;
  finishedSaleDeductionPercent: number;
  downstreamMaximumPurchasePriceHead: number;
  downstreamCeilingValid: boolean;
  matrixMarketValue: number;
  matrixResidualPercent: number;
  annualCowCashCost: number;
  annualReproductionCostCow: number;
  externalReplacementHeifersPerCow: number;
  externalReplacementHeiferPriceHead: number;
  herdUaPerCow: number;
  stockingUa: number;
  breedingAreaAvailableHa: number;
  breedingLandCostHaYear: number;
  existingMatrices: number;
  newMatrixCapitalLimit: number;
  annualRatePercent: number;
  horizonYears: number;
  inputsConfirmed: boolean;
  calfPriceSourceValid: boolean;
  replacementHeiferPriceSourceValid: boolean;
  replacementSystemCloses: boolean;
  breedingAreaOutsideBase: boolean;
};

const clampShare = (value: number) => Math.min(1, Math.max(0, value / 100));

function annuityFactor(rate: number, years: number) {
  if (years <= 0) return 0;
  if (rate === 0) return years;
  return (1 - Math.pow(1 + rate, -years)) / rate;
}

export function calculateBreedingEconomics(input: BreedingEconomicsInputs) {
  const annualEntrants = Math.max(0, input.annualEntrants);
  const desiredOwnShare = clampShare(input.desiredOwnSharePercent);
  const netEligible = Math.max(0, input.netEligibleCalvesPerCow);
  const purchaseLandedCostHead =
    Math.max(0, input.purchasedCalfPriceHead) +
    Math.max(0, input.purchaseTransactionCostHead);
  const calfWeight = Math.max(0, input.calfPurchaseWeightKg);
  const calfPriceKg =
    calfWeight > 0 ? purchaseLandedCostHead / calfWeight : null;
  const finishedLiveEquivalentKg =
    input.carcassYieldPercent > 0
      ? (Math.max(0, input.finishedCattlePriceArroba) *
          (input.carcassYieldPercent / 100) *
          (1 - clampShare(input.finishedSaleDeductionPercent))) /
        15
      : null;
  const calfPremiumPercent =
    calfPriceKg !== null &&
    finishedLiveEquivalentKg !== null &&
    finishedLiveEquivalentKg > 0
      ? ((calfPriceKg / finishedLiveEquivalentKg) - 1) * 100
      : null;

  const areaPerCow =
    input.stockingUa > 0
      ? Math.max(0, input.herdUaPerCow) / input.stockingUa
      : Infinity;
  const maxMatricesByArea =
    Number.isFinite(areaPerCow) && areaPerCow > 0
      ? Math.max(0, input.breedingAreaAvailableHa) / areaPerCow
      : 0;
  const existingMatrices = Math.max(0, input.existingMatrices);
  const matrixValue = Math.max(0, input.matrixMarketValue);
  const maxNewMatricesByCapital =
    matrixValue > 0
      ? Math.max(0, input.newMatrixCapitalLimit) / matrixValue
      : 0;
  const maxMatrices = Math.max(
    0,
    Math.min(
      maxMatricesByArea,
      existingMatrices + maxNewMatricesByCapital,
    ),
  );
  const maxOwnEntrants = maxMatrices * netEligible;
  const maxOwnSharePercent =
    annualEntrants > 0
      ? Math.min(100, (maxOwnEntrants / annualEntrants) * 100)
      : 0;
  const desiredOwnEntrants = annualEntrants * desiredOwnShare;
  const feasibleOwnEntrants = Math.min(desiredOwnEntrants, maxOwnEntrants);
  const feasibleOwnSharePercent =
    annualEntrants > 0 ? (feasibleOwnEntrants / annualEntrants) * 100 : 0;
  const purchasedEntrants = Math.max(0, annualEntrants - feasibleOwnEntrants);
  const matricesForFeasiblePlan =
    netEligible > 0 ? feasibleOwnEntrants / netEligible : Infinity;
  const newMatricesForPlan = Number.isFinite(matricesForFeasiblePlan)
    ? Math.max(0, matricesForFeasiblePlan - existingMatrices)
    : Infinity;
  const initialMatrixCapital = Number.isFinite(newMatricesForPlan)
    ? newMatricesForPlan * matrixValue
    : Infinity;
  const breedingAreaUsed = Number.isFinite(matricesForFeasiblePlan)
    ? matricesForFeasiblePlan * areaPerCow
    : Infinity;

  const modelReady = Boolean(
    input.inputsConfirmed &&
      input.calfPriceSourceValid &&
      netEligible > 0 &&
      calfWeight > 0 &&
      purchaseLandedCostHead > 0 &&
      matrixValue > 0 &&
      input.annualCowCashCost > 0 &&
      input.annualReproductionCostCow >= 0 &&
      input.breedingLandCostHaYear >= 0 &&
      input.annualRatePercent >= 0 &&
      input.horizonYears > 0 &&
      input.replacementSystemCloses &&
      input.breedingAreaOutsideBase &&
      (input.externalReplacementHeifersPerCow <= 0 ||
        (input.externalReplacementHeiferPriceHead > 0 &&
          input.replacementHeiferPriceSourceValid)),
  );

  let ownCalfCashCostHead: number | null = null;
  let ownCalfEconomicCostHead: number | null = null;
  let annualizedMatrixCapitalCow: number | null = null;
  let annualEconomicAdvantage: number | null = null;
  let annualCashAdvantage: number | null = null;
  let blendedEconomicCostHead: number | null = null;
  let blendedCashCostHead: number | null = null;
  let expansionSupported: boolean | null = null;
  let economicOwnShareCeilingPercent: number | null = null;
  let paybackYears: number | null = null;
  let breakEvenEligibleCalvesPerCow: number | null = null;
  let breakEvenMatrixValue: number | null = null;
  let downstreamSupportsPurchasedCalf: boolean | null = null;
  let downstreamSupportsOwnCalf: boolean | null = null;
  let purchaseHeadroomToDownstreamCeiling: number | null = null;
  let ownHeadroomToDownstreamCeiling: number | null = null;
  let recommendedOwnEntrants: number | null = null;
  let recommendedPurchasedEntrants: number | null = null;
  let recommendedSupplyCloses: boolean | null = null;
  let economicOwnEntrants = 0;

  if (modelReady) {
    const rate = input.annualRatePercent / 100;
    const years = input.horizonYears;
    const residualFraction = clampShare(input.matrixResidualPercent);
    const residualPresentValue =
      (matrixValue * residualFraction) / Math.pow(1 + rate, years);
    const netCapitalPresentValue = Math.max(
      0,
      matrixValue - residualPresentValue,
    );
    const factor = annuityFactor(rate, years);
    annualizedMatrixCapitalCow =
      factor > 0 ? netCapitalPresentValue / factor : null;
    const landCostCowYear = areaPerCow * input.breedingLandCostHaYear;
    const externalReplacementCostCowYear =
      Math.max(0, input.externalReplacementHeifersPerCow) *
      Math.max(0, input.externalReplacementHeiferPriceHead);
    const annualCowCash =
      input.annualCowCashCost +
      input.annualReproductionCostCow +
      externalReplacementCostCowYear +
      landCostCowYear;
    ownCalfCashCostHead = annualCowCash / netEligible;
    ownCalfEconomicCostHead =
      (annualCowCash + (annualizedMatrixCapitalCow ?? 0)) / netEligible;
    expansionSupported = ownCalfEconomicCostHead <= purchaseLandedCostHead;
    economicOwnShareCeilingPercent = expansionSupported
      ? maxOwnSharePercent
      : 0;
    economicOwnEntrants = expansionSupported ? feasibleOwnEntrants : 0;
    annualEconomicAdvantage =
      economicOwnEntrants *
      (purchaseLandedCostHead - ownCalfEconomicCostHead);
    annualCashAdvantage =
      feasibleOwnEntrants * (purchaseLandedCostHead - ownCalfCashCostHead);
    const newCalves = Number.isFinite(newMatricesForPlan)
      ? newMatricesForPlan * netEligible
      : 0;
    const newAnnualCashAdvantage =
      newCalves * (purchaseLandedCostHead - ownCalfCashCostHead);
    paybackYears =
      initialMatrixCapital > 0 && newAnnualCashAdvantage > 0
        ? initialMatrixCapital / newAnnualCashAdvantage
        : null;
    breakEvenEligibleCalvesPerCow =
      purchaseLandedCostHead > 0
        ? (annualCowCash + (annualizedMatrixCapitalCow ?? 0)) /
          purchaseLandedCostHead
        : null;
    const capitalRecoveryPerReal =
      factor > 0
        ? (1 - residualFraction / Math.pow(1 + rate, years)) / factor
        : 0;
    const annualCapitalRoom =
      purchaseLandedCostHead * netEligible - annualCowCash;
    breakEvenMatrixValue =
      capitalRecoveryPerReal > 0 && annualCapitalRoom > 0
        ? annualCapitalRoom / capitalRecoveryPerReal
        : null;
    if (input.downstreamCeilingValid) {
      const downstreamCeiling = Math.max(
        0,
        input.downstreamMaximumPurchasePriceHead,
      );
      purchaseHeadroomToDownstreamCeiling =
        downstreamCeiling - purchaseLandedCostHead;
      ownHeadroomToDownstreamCeiling =
        downstreamCeiling - ownCalfEconomicCostHead;
      downstreamSupportsPurchasedCalf =
        purchaseHeadroomToDownstreamCeiling >= 0;
      downstreamSupportsOwnCalf = ownHeadroomToDownstreamCeiling >= 0;
      const preferOwn =
        downstreamSupportsOwnCalf &&
        ownCalfEconomicCostHead <= purchaseLandedCostHead;
      recommendedOwnEntrants = preferOwn ? economicOwnEntrants : 0;
      recommendedPurchasedEntrants = downstreamSupportsPurchasedCalf
        ? Math.max(0, annualEntrants - (recommendedOwnEntrants ?? 0))
        : 0;
      recommendedSupplyCloses =
        (recommendedOwnEntrants ?? 0) +
          (recommendedPurchasedEntrants ?? 0) +
          1e-6 >=
        annualEntrants;
      // The applied blend must be built from the sources the downstream route
      // actually supports. A residual purchase that exceeds the route ceiling
      // is a supply shortfall, not an input that may be averaged into all
      // entrants. Leaving the blend null also prevents callers from silently
      // pricing uncovered heads at an infeasible source.
      if (recommendedSupplyCloses && annualEntrants > 0) {
        blendedEconomicCostHead =
          ((recommendedOwnEntrants ?? 0) * ownCalfEconomicCostHead +
            (recommendedPurchasedEntrants ?? 0) * purchaseLandedCostHead) /
          annualEntrants;
        blendedCashCostHead =
          ((recommendedOwnEntrants ?? 0) * ownCalfCashCostHead +
            (recommendedPurchasedEntrants ?? 0) * purchaseLandedCostHead) /
          annualEntrants;
      }
    }
  }

  const errors: string[] = [];
  if (!input.calfPriceSourceValid) {
    errors.push('A data-base do preço do bezerro é inválida.');
  }
  if (!input.inputsConfirmed) {
    errors.push('Confirme que os custos anuais da cria foram preenchidos.');
  }
  if (matrixValue <= 0) errors.push('Informe o valor econômico da matriz.');
  if (input.annualCowCashCost <= 0) {
    errors.push('Informe o custo caixa anual da matriz.');
  }
  if (netEligible <= 0) {
    errors.push('O funil reprodutivo não produz bezerros elegíveis.');
  }
  if (!input.replacementSystemCloses) {
    errors.push(
      'A reposição das matrizes não fecha com as novilhas próprias e a compra externa informadas.',
    );
  }
  if (!input.breedingAreaOutsideBase) {
    errors.push(
      'A área de cria compartilha a base irrigada; realoque a terra antes de aplicar o custo integrado.',
    );
  }
  if (
    input.externalReplacementHeifersPerCow > 0 &&
    input.externalReplacementHeiferPriceHead <= 0
  ) {
    errors.push('Informe o preço entregue das novilhas de reposição compradas.');
  }
  if (
    input.externalReplacementHeifersPerCow > 0 &&
    !input.replacementHeiferPriceSourceValid
  ) {
    errors.push('A data-base do preço da novilha de reposição é inválida.');
  }

  return {
    modelReady,
    errors,
    purchaseLandedCostHead,
    calfPriceKg,
    finishedLiveEquivalentKg,
    calfPremiumPercent,
    areaPerCow,
    maxMatricesByArea,
    maxNewMatricesByCapital,
    maxMatrices,
    maxOwnEntrants,
    maxOwnSharePercent,
    desiredOwnEntrants,
    feasibleOwnEntrants,
    economicOwnEntrants,
    feasibleOwnSharePercent,
    purchasedEntrants,
    matricesForFeasiblePlan,
    newMatricesForPlan,
    initialMatrixCapital,
    breedingAreaUsed,
    annualizedMatrixCapitalCow,
    ownCalfCashCostHead,
    ownCalfEconomicCostHead,
    blendedEconomicCostHead,
    blendedCashCostHead,
    annualEconomicAdvantage,
    annualCashAdvantage,
    expansionSupported,
    economicOwnShareCeilingPercent,
    paybackYears,
    breakEvenEligibleCalvesPerCow,
    breakEvenMatrixValue,
    downstreamMaximumPurchasePriceHead: Math.max(
      0,
      input.downstreamMaximumPurchasePriceHead,
    ),
    downstreamSupportsPurchasedCalf,
    downstreamSupportsOwnCalf,
    purchaseHeadroomToDownstreamCeiling,
    ownHeadroomToDownstreamCeiling,
    recommendedOwnEntrants,
    recommendedPurchasedEntrants,
    recommendedSupplyCloses,
    annualExternalReplacementCost:
      Number.isFinite(matricesForFeasiblePlan)
        ? matricesForFeasiblePlan *
          Math.max(0, input.externalReplacementHeifersPerCow) *
          Math.max(0, input.externalReplacementHeiferPriceHead)
        : Infinity,
  };
}
