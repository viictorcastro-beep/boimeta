import { calculateCore, type Assumptions } from './livestock-model.ts';

/** Diagnósticos marginais; não autoriza CAPEX nem transforma sobra em receita. */
export function capacityActions(a: Assumptions, cornDeliveredPrice: number) {
  const current = calculateCore(a);
  const utilization = (a.feedlotUtilization ?? 100) / 100;
  const foodPotential = Math.min(
    current.pasturePotentialA,
    current.silagePotentialA,
  );
  const neededCapacity =
    current.routeAInputValid &&
    utilization > 0 &&
    current.feedlotSurvival > 0 &&
    Number.isFinite(foodPotential)
      ? Math.ceil(
          ((foodPotential / current.feedlotSurvival) * current.daysFeedlot) /
            365 /
            utilization,
        )
      : null;
  const expanded =
    neededCapacity !== null
      ? calculateCore({
          ...a,
          feedlotCapacity: Math.max(a.feedlotCapacity ?? 0, neededCapacity),
        })
      : null;
  const usedPasture =
    current.simultaneousPivotA * current.cyclesA > 0
      ? (current.pastureAreaA * current.entrantsA) / (current.simultaneousPivotA * current.cyclesA)
      : 0;
  const usedSilage =
    current.silageProducedDm > 0
      ? (current.silageArea * current.silageConsumedDm) / current.silageProducedDm
      : 0;
  const grainFraction = Math.max(
    0,
    1 - a.forageShare / 100 - (a.otherIngredientSharePercent ?? 0) / 100,
  );
  // Mesmo preço entregue e umidade do motor: 60 kg/sc, 88% MS.
  const dietSlope = grainFraction / (60 * 0.88);
  const pricier = calculateCore({
    ...a,
    dietPriceDm: a.dietPriceDm + dietSlope,
  });
  const costSlope = current.ebitdaA - pricier.ebitdaA;
  const candidate =
    cornDeliveredPrice + (current.ebitdaA - current.ebitdaB) / costSlope;
  let cornIndifference: number | null = null;
  if (
    a.linkFeedToCropCosts &&
    current.routeAInputValid &&
    current.routeBInputValid &&
    Number.isFinite(cornDeliveredPrice) &&
    cornDeliveredPrice >= 0 &&
    costSlope > 0 &&
    Number.isFinite(candidate) &&
    candidate >= 0
  ) {
    const test = calculateCore({
      ...a,
      dietPriceDm: a.dietPriceDm + (candidate - cornDeliveredPrice) * dietSlope,
    });
    if (Math.abs(test.ebitdaA - test.ebitdaB) < 1) cornIndifference = candidate;
  }
  return {
    binding: current.bindingConstraintA,
    neededCapacity,
    currentCapacity: a.feedlotCapacity ?? null,
    extraCapacity:
      neededCapacity === null
        ? null
        : Math.max(0, neededCapacity - (a.feedlotCapacity ?? neededCapacity)),
    unusedFlowArea: Math.max(0, a.totalArea - usedPasture - usedSilage),
    unusedRearingPotential: Math.max(
      0,
      current.pastureCandidatesA - current.feedlotEntriesA,
    ),
    expansionAnnualGain: expanded ? expanded.ebitdaA - current.ebitdaA : null,
    expandedVersusB: expanded ? expanded.ebitdaA - current.ebitdaB : null,
    cornIndifference,
    costSlope,
    grainFraction,
  };
}
