import assert from 'node:assert/strict';

import {
  cattlePriceAtDate,
  projectAnimalDecision,
} from '../lib/animal-timeline-model.ts';
import {
  calculateFeedAllocation,
  calculateHerdFlow,
} from '../lib/allocation-model.ts';
import { allocateStrategy } from '../lib/strategy-model.ts';
import { futureQuoteDefaults, validateFutureQuote } from '../lib/futures-model.ts';
import { calculateBreedingEconomics } from '../lib/breeding-model.ts';
import { calculateEffluentScale } from '../lib/effluent-model.ts';
import { calculateCore, defaultAssumptions } from '../lib/livestock-model.ts';
import { provenanceCanRank } from '../lib/scenario-mode.ts';
import { buildAutomaticCalendar } from '../lib/crop-calendar-model.ts';
import {
  calculateCrop,
  cropDefaults,
  cropDirectCostHa,
  updateCropCostItem,
} from '../lib/crop-model.ts';
import {
  buildCapexStep,
  calculateMonthlyCashFlow,
  calculateWeeklyFeedPlan,
  calculateWorkRate,
  cropCashEvents,
} from '../lib/operational-model.ts';

const assertClose = (actual, expected, tolerance = 1e-6) => {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `esperado ${expected}, recebido ${actual} (tolerância ${tolerance})`,
  );
};

assert.equal(provenanceCanRank('working-assumption', 'validation'), false);
assert.equal(provenanceCanRank('local-spreadsheet', 'validation'), true);
assert.equal(provenanceCanRank('demo-snapshot', 'validation'), false);
assert.equal(provenanceCanRank('demo-snapshot', 'exploration'), true);
assert.equal(provenanceCanRank('conab-official', 'validation'), true);

const automaticCalendar = buildAutomaticCalendar('2026-09-10');
assert.equal(automaticCalendar.location, 'Barra/BA');
assert.equal(automaticCalendar.horizonEndDate, '2027-09-10');
assert.equal(
  automaticCalendar.crops['soy-irrigated'].plantDate,
  '2026-11-01',
);
assert.equal(
  automaticCalendar.crops['soy-irrigated'].harvestDate,
  '2027-02-24',
);
assert.equal(
  automaticCalendar.crops['cotton-irrigated'].plantDate,
  '2026-11-01',
);
assert.equal(
  automaticCalendar.crops['corn-irrigated'].plantDate,
  '2027-03-01',
);
assert.equal(
  automaticCalendar.crops['corn-irrigated'].harvestDate,
  '2027-06-29',
);
assert.equal(
  automaticCalendar.crops['corn-irrigated'].legalBasis,
  'not-applicable',
);
assert.match(
  automaticCalendar.crops['corn-irrigated'].legalNote,
  /2ª safra/i,
);
assert.equal(
  automaticCalendar.crops['soy-irrigated'].legalAct,
  'Portaria ADAB nº 40, de 20/05/2026',
);
assert.equal(
  automaticCalendar.crops['soy-irrigated'].rulesCheckedAt,
  '2026-09-01',
);
assert.equal(automaticCalendar.doubleCrop.cornHarvestDate, '2027-06-29');
assert.equal(automaticCalendar.doubleCrop.completedWithinHorizon, true);
assert.equal(
  buildAutomaticCalendar('2027-01-15').crops['soy-irrigated'].plantDate,
  '2027-01-15',
);
assert.equal(
  buildAutomaticCalendar('2027-03-01').crops['soy-irrigated'].plantDate,
  '2027-11-01',
);
assert.equal(
  buildAutomaticCalendar('2027-03-01').crops['soy-irrigated'].legalBasis,
  'projected-repeat',
);
assert.equal(
  buildAutomaticCalendar('2026-09-10', 100).crops['cotton-irrigated']
    .completedWithinHorizon,
  false,
);
assert.equal(
  buildAutomaticCalendar('2026-09-10', 100).crops['cotton-irrigated']
    .availableDate,
  '',
);
assert.throws(() => buildAutomaticCalendar(''), /inválida/i);

const curve = [
  {
    id: 'mar27',
    contract: 'Mar/27',
    date: '2027-03-15',
    price: 370,
    sourceDate: '2026-08-31',
  },
  {
    id: 'aug27',
    contract: 'Ago/27',
    date: '2027-08-15',
    price: 390,
    sourceDate: '2026-08-31',
  },
];

assert.equal(cattlePriceAtDate(curve, '2027-03-15').coverage, 'exact');
assert.equal(cattlePriceAtDate(curve, '2027-03-01').price, null);
assert.equal(cattlePriceAtDate(curve, '2027-09-01').price, null);
assert.equal(cattlePriceAtDate(curve, '2027-06-01').coverage, 'interpolated');

const animalInput = {
  entryDate: '2026-09-10',
  entryLiveWeight: 210,
  decisionLiveWeight: 375,
  finalLiveWeight: 540,
  gmdToDecision: 0.9,
  gmdPastureFinish: 1,
  gmdFeedlot: 1.5,
  carcassYieldPercent: 54,
  saleDeductionPercent: 4,
  entryCostHead: 3_360,
  entryPriceDate: '2026-08-31',
  gateValuePerKgLive: 12.5,
  gatePriceDate: '2027-03-13',
  gateSourceDate: '2026-08-31',
  asOfDate: '2026-09-01',
  commonPastureCostDay: 4.5,
  pastureFinishCostDay: 5.5,
  dietDmDay: 11.1,
  dietPriceDm: 1.4,
  ownOperationDay: 1.55,
  ownFixedCostHead: 65,
  thirdPartyAllInDay: 18,
  thirdPartyFreightHead: 120,
  annualCarryRatePercent: 12,
  mortalityPercent: 0.2,
  pastureMortalityPercent: 0.2,
  bgiEligible: true,
  curve,
};

const animal = projectAnimalDecision(animalInput);
const animalHigherYield = projectAnimalDecision({ ...animalInput, feedlotCarcassYieldLiftPercent: 2 });
const routeById = (result, id) => result.routes.find((route) => route.id === id);
assertClose(routeById(animalHigherYield, 'pasture-finish').netRevenueHead,
  routeById(animal, 'pasture-finish').netRevenueHead);
assert.ok(routeById(animalHigherYield, 'own-feedlot').netRevenueHead >
  routeById(animal, 'own-feedlot').netRevenueHead);
assert.equal(animal.entryToDecisionDays, 184);
assert.equal(animal.decisionDate, '2027-03-13');
assert.equal(animal.comparisonStatus, 'comparable');
assert.ok(animal.bestRoute);
const animalWithoutThirdParty = projectAnimalDecision({
  ...animalInput,
  includeThirdParty: false,
});
assert.equal(
  animalWithoutThirdParty.routes.some((route) => route.id === 'third-party'),
  false,
);

assert.equal(
  projectAnimalDecision({ ...animalInput, gatePriceDate: '2027-03-12' })
    .comparisonStatus,
  'gate-price-date-mismatch',
);
assert.equal(
  projectAnimalDecision({ ...animalInput, bgiEligible: false })
    .comparisonStatus,
  'insufficient-market-coverage',
);
const invalidWeightOrder = projectAnimalDecision({
  ...animalInput,
  decisionLiveWeight: 550,
});
assert.equal(invalidWeightOrder.comparisonStatus, 'invalid-input');
assert.equal(invalidWeightOrder.bestRoute, null);
assert.match(invalidWeightOrder.inputErrors.join(' '), /peso final/i);

const invalidDate = projectAnimalDecision({ ...animalInput, entryDate: '' });
assert.equal(invalidDate.comparisonStatus, 'invalid-input');
assert.equal(invalidDate.decisionDate, '');

const invalidGmd = projectAnimalDecision({ ...animalInput, gmdToDecision: 0 });
assert.equal(invalidGmd.comparisonStatus, 'invalid-input');
assert.equal(invalidGmd.entryToDecisionDays, 0);

const staleGate = projectAnimalDecision({
  ...animalInput,
  asOfDate: '2026-09-20',
  gateSourceDate: '2026-09-05',
  curve: curve.map((point) => ({ ...point, sourceDate: '2026-09-19' })),
});
assert.equal(staleGate.gateSourceValid, false);
assert.equal(staleGate.comparisonStatus, 'invalid-source-date');

const staleAnimalCurve = projectAnimalDecision({
  ...animalInput,
  asOfDate: '2026-09-20',
  gateSourceDate: '2026-09-19',
  curve: curve.map((point) => ({ ...point, sourceDate: '2026-09-12' })),
});
assert.equal(staleAnimalCurve.curveSourceValid, false);
assert.equal(staleAnimalCurve.comparisonStatus, 'invalid-curve-source-date');

const integerCalendar = projectAnimalDecision({
  ...animalInput,
  entryLiveWeight: 240,
  decisionLiveWeight: 400,
  finalLiveWeight: 540,
  gmdToDecision: 0.9,
  gmdFeedlot: 1.48,
  gatePriceDate: '2027-03-07',
  gateSourceDate: '2026-08-31',
  curve: [
    {
      id: 'jun27',
      contract: 'Jun/27',
      date: '2027-06-10',
      price: 380,
      sourceDate: '2026-08-31',
    },
    {
      id: 'sep27',
      contract: 'Set/27',
      date: '2027-09-10',
      price: 390,
      sourceDate: '2026-08-31',
    },
  ],
});
assert.equal(integerCalendar.entryToDecisionDays, Math.ceil(160 / 0.9));
assert.equal(integerCalendar.decisionDate, '2027-03-07');
assert.equal(
  integerCalendar.routes.find((route) => route.id === 'own-feedlot')
    ?.daysAfterDecision,
  Math.ceil(140 / 1.48),
);

const missingEntryPriceDate = projectAnimalDecision({
  ...animalInput,
  entryPriceDate: '',
});
assert.equal(missingEntryPriceDate.comparisonStatus, 'comparable');
assert.equal(missingEntryPriceDate.entryPriceSourceValid, false);
assert.equal(
  missingEntryPriceDate.routes.find((route) => route.id === 'sell-gate')
    ?.marginFromEntry,
  null,
);

const partiallyInvalidCurve = projectAnimalDecision({
  ...animalInput,
  curve: curve.map((point, index) =>
    index === 0 ? { ...point, date: '' } : point,
  ),
});
assert.equal(
  partiallyInvalidCurve.comparisonStatus,
  'invalid-curve-source-date',
);
assert.ok(
  partiallyInvalidCurve.routes.every(
    (route) => route.incrementalVsSellGate === null,
  ),
);

assert.equal(
  validateFutureQuote(futureQuoteDefaults[0], '2026-09-01').isUsable,
  true,
);
assert.equal(
  validateFutureQuote(
    { ...futureQuoteDefaults[0], sourceDate: '2026-09-02' },
    '2026-09-01',
  ).isUsable,
  false,
);
const staleFuture = validateFutureQuote(
  { ...futureQuoteDefaults[0], sourceDate: '2026-08-23' },
  '2026-09-01',
);
assert.equal(staleFuture.isUsable, false);
assert.match(staleFuture.issue ?? '', /mais de 7 dias/i);
assert.equal(
  validateFutureQuote(
    { ...futureQuoteDefaults[0], referenceDate: '2026-10-15' },
    '2026-09-01',
  ).isUsable,
  false,
);
assert.equal(
  validateFutureQuote(futureQuoteDefaults[0], '2026-09-01', {
    convertedPrice: -641.2,
    effectivePrice: -145.85,
    usdBrl: 5.2,
    cottonFiberRecovery: 40,
  }).isUsable,
  false,
);

const breeding = calculateBreedingEconomics({
  annualEntrants: 1_000,
  desiredOwnSharePercent: 100,
  netEligibleCalvesPerCow: 0.8,
  calfPurchaseWeightKg: 240,
  purchasedCalfPriceHead: 3_200,
  purchaseTransactionCostHead: 100,
  finishedCattlePriceArroba: 350,
  carcassYieldPercent: 54,
  finishedSaleDeductionPercent: 0,
  downstreamMaximumPurchasePriceHead: 4_000,
  downstreamCeilingValid: true,
  matrixMarketValue: 4_500,
  matrixResidualPercent: 70,
  annualCowCashCost: 1_000,
  annualReproductionCostCow: 200,
  externalReplacementHeifersPerCow: 0,
  externalReplacementHeiferPriceHead: 0,
  herdUaPerCow: 1.2,
  stockingUa: 1,
  breedingAreaAvailableHa: 1_000,
  breedingLandCostHaYear: 100,
  existingMatrices: 0,
  newMatrixCapitalLimit: 10_000_000,
  annualRatePercent: 12,
  horizonYears: 10,
  inputsConfirmed: true,
  calfPriceSourceValid: true,
  replacementHeiferPriceSourceValid: true,
  replacementSystemCloses: true,
  breedingAreaOutsideBase: true,
});
assert.equal(breeding.modelReady, true);
assert.ok(Math.abs(breeding.maxMatrices - 833.3333333) < 0.001);
assert.ok(Math.abs(breeding.feasibleOwnEntrants - 666.6666667) < 0.001);
assert.ok(Math.abs(breeding.purchasedEntrants - 333.3333333) < 0.001);
assert.ok(breeding.calfPremiumPercent !== null && breeding.calfPremiumPercent > 0);
assert.ok(breeding.blendedEconomicCostHead !== null);
assert.ok(breeding.blendedCashCostHead !== null);
assert.ok(
  (breeding.blendedCashCostHead ?? Infinity) <=
    (breeding.blendedEconomicCostHead ?? -Infinity),
);
assert.equal(breeding.recommendedSupplyCloses, true);

const breedingScenarioSupplyInput = {
  annualEntrants: 1_000,
  desiredOwnSharePercent: 100,
  netEligibleCalvesPerCow: 0.8,
  calfPurchaseWeightKg: 240,
  purchasedCalfPriceHead: 3_200,
  purchaseTransactionCostHead: 100,
  finishedCattlePriceArroba: 350,
  carcassYieldPercent: 54,
  finishedSaleDeductionPercent: 0,
  downstreamCeilingValid: true,
  matrixMarketValue: 4_500,
  matrixResidualPercent: 70,
  annualCowCashCost: 1_000,
  annualReproductionCostCow: 200,
  externalReplacementHeifersPerCow: 0,
  externalReplacementHeiferPriceHead: 0,
  herdUaPerCow: 1.2,
  stockingUa: 1,
  breedingAreaAvailableHa: 1_000,
  breedingLandCostHaYear: 100,
  existingMatrices: 0,
  newMatrixCapitalLimit: 10_000_000,
  annualRatePercent: 12,
  horizonYears: 10,
  inputsConfirmed: true,
  calfPriceSourceValid: true,
  replacementHeiferPriceSourceValid: true,
  replacementSystemCloses: true,
  breedingAreaOutsideBase: true,
};
const breedingPartialUnsupported = calculateBreedingEconomics({
  ...breedingScenarioSupplyInput,
  downstreamMaximumPurchasePriceHead: 3_000,
});
assert.ok((breedingPartialUnsupported.recommendedOwnEntrants ?? 0) > 0);
assert.equal(breedingPartialUnsupported.recommendedPurchasedEntrants, 0);
assert.equal(breedingPartialUnsupported.recommendedSupplyCloses, false);
assert.equal(breedingPartialUnsupported.blendedEconomicCostHead, null);
assert.equal(breedingPartialUnsupported.blendedCashCostHead, null);
const breedingHalfOwnWithoutSupportedPurchase = calculateBreedingEconomics({
  ...breedingScenarioSupplyInput,
  desiredOwnSharePercent: 50,
  purchasedCalfPriceHead: 4_000,
  purchaseTransactionCostHead: 0,
  downstreamMaximumPurchasePriceHead: 3_000,
});
assertClose(breedingHalfOwnWithoutSupportedPurchase.recommendedOwnEntrants, 500);
assert.equal(
  breedingHalfOwnWithoutSupportedPurchase.recommendedPurchasedEntrants,
  0,
);
assert.equal(breedingHalfOwnWithoutSupportedPurchase.recommendedSupplyCloses, false);
assert.equal(breedingHalfOwnWithoutSupportedPurchase.blendedEconomicCostHead, null);
const breedingSameHerdAtHigherScenarioPrice = calculateBreedingEconomics({
  ...breedingScenarioSupplyInput,
  downstreamMaximumPurchasePriceHead: 3_400,
});
assert.equal(breedingSameHerdAtHigherScenarioPrice.recommendedSupplyCloses, true);
assert.ok(breedingSameHerdAtHigherScenarioPrice.blendedEconomicCostHead !== null);

// Cada alternativa mantém seu próprio gate a jusante. Invalidar A não pode
// contaminar o cálculo de B, cuja data de saída e teto são independentes.
const breedingScenarioAWithoutGate = calculateBreedingEconomics({
  ...breedingScenarioSupplyInput,
  downstreamMaximumPurchasePriceHead: 0,
  downstreamCeilingValid: false,
});
const breedingScenarioBWithOwnGate = calculateBreedingEconomics({
  ...breedingScenarioSupplyInput,
  downstreamMaximumPurchasePriceHead: 3_400,
  downstreamCeilingValid: true,
});
assert.equal(breedingScenarioAWithoutGate.recommendedSupplyCloses, null);
assert.equal(breedingScenarioAWithoutGate.blendedEconomicCostHead, null);
assert.equal(breedingScenarioBWithOwnGate.recommendedSupplyCloses, true);
assert.ok(breedingScenarioBWithOwnGate.blendedEconomicCostHead !== null);

const breedingBlocked = calculateBreedingEconomics({
    annualEntrants: 1_000,
    desiredOwnSharePercent: 100,
    netEligibleCalvesPerCow: 0.8,
    calfPurchaseWeightKg: 240,
    purchasedCalfPriceHead: 3_200,
    purchaseTransactionCostHead: 100,
    finishedCattlePriceArroba: 350,
    carcassYieldPercent: 54,
    finishedSaleDeductionPercent: 0,
    downstreamMaximumPurchasePriceHead: 4_000,
    matrixMarketValue: 4_500,
    matrixResidualPercent: 70,
    annualCowCashCost: 0,
    annualReproductionCostCow: 0,
    externalReplacementHeifersPerCow: 0,
    externalReplacementHeiferPriceHead: 0,
    herdUaPerCow: 1.2,
    stockingUa: 1,
    breedingAreaAvailableHa: 1_000,
    breedingLandCostHaYear: 100,
    existingMatrices: 0,
    newMatrixCapitalLimit: 10_000_000,
    annualRatePercent: 12,
    horizonYears: 10,
    inputsConfirmed: false,
    calfPriceSourceValid: true,
    replacementHeiferPriceSourceValid: true,
    replacementSystemCloses: true,
    breedingAreaOutsideBase: true,
});
assert.equal(breedingBlocked.modelReady, false);
assert.equal(breedingBlocked.blendedEconomicCostHead, null);

const herdBothSexes = calculateHerdFlow({
  annualEntrants: 100,
  selfSupplyPercent: 100,
  pregnancyRate: 100,
  pregnancyToBirthLoss: 0,
  preWeaningMortality: 0,
  postWeaningMortality: 0,
  replacementRate: 20,
  heiferDevelopmentSurvival: 100,
  heiferApprovalRate: 100,
  ownReplacementShare: 100,
  allowExternalReplacementHeifers: false,
  maleShare: 50,
  finishBothSexes: true,
  herdUaPerCow: 1.25,
  breedingStockingUa: 2,
  stockingUa: 2,
  averageStockWeight: 320,
  totalArea: 100,
  naturalServiceShare: 0,
  bullCowRatio: 25,
});
assert.equal(herdBothSexes.netEligiblePerCow, 0.8);
assert.equal(herdBothSexes.matricesRequired, 125);
assert.equal(herdBothSexes.replacementSystemCloses, true);

const herdMalesOnly = calculateHerdFlow({
    annualEntrants: 100,
    selfSupplyPercent: 100,
    pregnancyRate: 100,
    pregnancyToBirthLoss: 0,
    preWeaningMortality: 0,
    postWeaningMortality: 0,
    replacementRate: 20,
    heiferDevelopmentSurvival: 80,
    heiferApprovalRate: 100,
    ownReplacementShare: 100,
    allowExternalReplacementHeifers: false,
    maleShare: 50,
    finishBothSexes: false,
    herdUaPerCow: 1.25,
    breedingStockingUa: 2,
    stockingUa: 2,
    averageStockWeight: 320,
    totalArea: 100,
    naturalServiceShare: 0,
    bullCowRatio: 25,
});
assert.equal(herdMalesOnly.netEligiblePerCow, 0.5);
assert.equal(herdMalesOnly.grossHeifersToRetainPerCow, 0.25);
assert.equal(herdMalesOnly.matureOwnReplacementsPerCow, 0.2);

const breedingAreaCap = calculateBreedingEconomics({
    annualEntrants: 1_000,
    desiredOwnSharePercent: 100,
    netEligibleCalvesPerCow: 0.8,
    calfPurchaseWeightKg: 240,
    purchasedCalfPriceHead: 3_200,
    purchaseTransactionCostHead: 0,
    finishedCattlePriceArroba: 300,
    carcassYieldPercent: 50,
    finishedSaleDeductionPercent: 0,
    downstreamMaximumPurchasePriceHead: 4_000,
    matrixMarketValue: 4_500,
    matrixResidualPercent: 70,
    annualCowCashCost: 1_000,
    annualReproductionCostCow: 200,
    externalReplacementHeifersPerCow: 0,
    externalReplacementHeiferPriceHead: 0,
    herdUaPerCow: 1.25,
    stockingUa: 2,
    breedingAreaAvailableHa: 100,
    breedingLandCostHaYear: 0,
    existingMatrices: 0,
    newMatrixCapitalLimit: 10_000_000,
    annualRatePercent: 12,
    horizonYears: 10,
    inputsConfirmed: true,
    calfPriceSourceValid: true,
    replacementHeiferPriceSourceValid: true,
    replacementSystemCloses: true,
    breedingAreaOutsideBase: true,
});
assert.equal(breedingAreaCap.maxMatricesByArea, 160);
// R$ 300/@, 50% de rendimento e zero de dedução equivalem a R$ 10/kg vivo.
assert.equal(breedingAreaCap.finishedLiveEquivalentKg, 10);
assert.ok(
  Math.abs((breedingAreaCap.calfPremiumPercent ?? 0) - 33.3333333) < 0.001,
);

const noPayback = calculateBreedingEconomics({
  ...breedingAreaCap,
  annualEntrants: 1_000,
  desiredOwnSharePercent: 100,
  netEligibleCalvesPerCow: 0.8,
  calfPurchaseWeightKg: 240,
  purchasedCalfPriceHead: 3_200,
  purchaseTransactionCostHead: 0,
  finishedCattlePriceArroba: 300,
  carcassYieldPercent: 50,
  finishedSaleDeductionPercent: 0,
  downstreamMaximumPurchasePriceHead: 4_000,
  matrixMarketValue: 4_500,
  matrixResidualPercent: 70,
  annualCowCashCost: 4_000,
  annualReproductionCostCow: 200,
  externalReplacementHeifersPerCow: 0,
  externalReplacementHeiferPriceHead: 0,
  herdUaPerCow: 1.25,
  stockingUa: 2,
  breedingAreaAvailableHa: 100,
  breedingLandCostHaYear: 0,
  existingMatrices: 0,
  newMatrixCapitalLimit: 10_000_000,
  annualRatePercent: 12,
  horizonYears: 10,
  inputsConfirmed: true,
  calfPriceSourceValid: true,
  replacementHeiferPriceSourceValid: true,
  replacementSystemCloses: true,
  breedingAreaOutsideBase: true,
});
assert.equal(noPayback.paybackYears, null);
assert.equal(
  projectAnimalDecision({
    ...animalInput,
    curve: curve.map((point) => ({ ...point, sourceDate: '2026-09-02' })),
  }).comparisonStatus,
  'invalid-curve-source-date',
);

const core = calculateCore({ ...defaultAssumptions, horizon: 3 });
assert.ok(Number.isInteger(core.daysPivotA));
assert.ok(Number.isInteger(core.daysFeedlot));
assert.ok(Number.isInteger(core.daysB));
assert.equal(core.daysPivotA, Math.ceil((400 - 240) / 0.9));
assert.equal(core.daysFeedlot, Math.ceil((540 - 400) / 1.48));
assert.equal(core.daysB, Math.ceil((540 - 240) / 1));
assert.ok(core.cowsSold > 0);
assert.ok(core.netSaleA > core.netSaleB);
assert.ok(core.ebitdaA > core.ebitdaB);
const coreWithoutFeedlotYieldLift = calculateCore({
  ...defaultAssumptions,
  feedlotCarcassYieldLiftPercent: 0,
});
assert.ok(core.netSaleA > coreWithoutFeedlotYieldLift.netSaleA);
assertClose(core.netSaleB, coreWithoutFeedlotYieldLift.netSaleB);
assertClose(
  core.cashFlows[0],
  -defaultAssumptions.investment - core.incrementalWorkingCapital,
);
assertClose(
  core.cashFlows.at(-1),
  core.incrementalEbitda +
    defaultAssumptions.terminalValue +
    core.incrementalWorkingCapital,
);

// A silagem ocupada é integralmente custeada, inclusive a parte que sobra.
// Com dieta externa zerada, a rubrica de dieta deve carregar exatamente o
// custo anual da área de silagem, e não apenas as toneladas consumidas.
const silageAudit = calculateCore({
  ...defaultAssumptions,
  dietPriceDm: 0,
  stockingUa: 1,
});
assert.ok(silageAudit.silageProducedDm > silageAudit.silageConsumedDm);
assert.ok(silageAudit.silageSurplusDm > 0);
assert.ok(silageAudit.silageSurplusCashCost > 0);
assertClose(
  silageAudit.costComponentsA.feedlotDiet * silageAudit.soldA,
  silageAudit.annualSilageCashCost,
  1e-4,
);

const feed = calculateFeedAllocation({
  annualCandidates: 100,
  entryWeight: 375,
  saleWeight: 540,
  netFinishedRevenueByGmd: () => null,
  sellNowHead: 4_687.5,
  dietDmDay: 11.1,
  forageShare: 40,
  silageCashCostDm: 0.3,
  silageOpportunityCostDm: 0.38,
  purchasedSilageCostDm: 0.55,
  grainCashCostDm: 0.7,
  grainNetSalePriceSack: 65,
  grainPurchasePriceSack: 75,
  dietOtherCostDm: 0.2,
  ownOperationDay: 1.55,
  ownFixedCostHead: 65,
  thirdPartyAllInDay: 18,
  thirdPartyFreightHead: 120,
  annualCarryRate: 12,
  feedlotCapacity: 100,
  feedlotUtilization: 90,
  grainAreaHa: 10,
  grainYieldSacksHa: 200,
  grainCashCostHa: 8_000,
  silageAreaHa: 10,
  silageDmTonnesHaYear: 20,
  silageCashCostHaYear: 8_000,
  allowPurchasedFeed: true,
  lots: [{ id: 'base', label: 'Base', share: 100, gmd: 1.5 }],
});
assert.equal(feed.ownHeads, 0);
assert.equal(feed.outsourceHeads, 0);
assert.equal(feed.sellHeads, 100);
assert.equal(feed.lots[0].routeCovered, false);

// Capacidade para exatamente 10 cabeças, com estoque próprio suficiente e
// compra externa proibitivamente cara: nenhuma cabeça pode ser precificada
// como ração comprada nem ultrapassar as 10 vagas físicas.
const tenHeadMarginalInput = {
  annualCandidates: 10,
  entryWeight: 375,
  saleWeight: 540,
  netFinishedRevenueByGmd: () => 7_000,
  sellNowHead: 4_000,
  dietDmDay: 1,
  forageShare: 50,
  silageCashCostDm: 0.05,
  silageOpportunityCostDm: 0.1,
  purchasedSilageCostDm: 100,
  grainCashCostDm: 0.1,
  grainNetSalePriceSack: 65,
  grainPurchasePriceSack: 10_000,
  dietOtherCostDm: 0,
  ownOperationDay: 0,
  ownFixedCostHead: 0,
  thirdPartyAllInDay: 10_000,
  thirdPartyFreightHead: 0,
  annualCarryRate: 0,
  feedlotCapacity: 10,
  feedlotUtilization: 100,
  grainAreaHa: 1,
  grainYieldSacksHa: 20,
  grainCashCostHa: 0,
  silageAreaHa: 1,
  silageDmTonnesHaYear: 1,
  silageCashCostHaYear: 0,
  allowPurchasedFeed: true,
  lots: [{ id: 'ten', label: '10 cabeças', share: 100, gmd: 1.5 }],
};
const tenHeadMarginalFeed = calculateFeedAllocation(tenHeadMarginalInput);
assertClose(tenHeadMarginalFeed.ownHeads, 10, 1e-8);
assertClose(tenHeadMarginalFeed.outsourceHeads, 0, 1e-8);
assertClose(tenHeadMarginalFeed.sellHeads, 0, 1e-8);
assertClose(tenHeadMarginalFeed.purchasedGrainSacks, 0, 1e-8);
assertClose(tenHeadMarginalFeed.purchasedSilageDmKg, 0, 1e-8);
assert.ok(tenHeadMarginalFeed.penDaysUsed <= tenHeadMarginalFeed.penDaysCapacity + 1e-8);
assert.ok(
  tenHeadMarginalFeed.concurrentOwnHeads <=
    tenHeadMarginalFeed.concurrentOwnCapacity + 1e-8,
);

// GMD observado na recria é histórico e não determina sozinho o destino.
// Com mesma resposta futura e mesmo consumo, a margem do cocho é a mesma.
const pastureHistoryOnly = calculateFeedAllocation({
  ...tenHeadMarginalInput,
  annualCandidates: 2,
  lots: [
    { id: 'pasture-high', label: 'Recria alta', share: 50, pastureGmd: 0.9, gmd: 1.5, dietDmDay: 1 },
    { id: 'pasture-low', label: 'Recria baixa', share: 50, pastureGmd: 0.4, gmd: 1.5, dietDmDay: 1 },
  ],
});
assertClose(
  pastureHistoryOnly.lots[0].ownMarginHead,
  pastureHistoryOnly.lots[1].ownMarginHead,
);

// GMD igual também não garante eficiência igual: maior CMS reduz a margem e
// piora a conversão, exatamente a informação que o GMD isolado omite.
const intakeEfficiency = calculateFeedAllocation({
  ...tenHeadMarginalInput,
  annualCandidates: 2,
  lots: [
    { id: 'efficient', label: 'Eficiente', share: 50, pastureGmd: 0.7, gmd: 1.5, dietDmDay: 1 },
    { id: 'inefficient', label: 'Ineficiente', share: 50, pastureGmd: 0.7, gmd: 1.5, dietDmDay: 2 },
  ],
});
assert.ok(intakeEfficiency.lots[0].ownMarginHead > intakeEfficiency.lots[1].ownMarginHead);
assert.ok(intakeEfficiency.lots[0].feedConversionDm < intakeEfficiency.lots[1].feedConversionDm);

// Silagem própria sem rota explícita de venda é estoque comprometido, não uma
// commodity que possa desaparecer do consolidado. Mesmo com preço de
// transferência acima da compra, o crédito interno precisa cancelar o custo
// interno no objetivo e fazer o estoque próprio ser usado antes da compra.
const ownSilageWithoutSaleRoute = calculateFeedAllocation({
  ...tenHeadMarginalInput,
  annualCandidates: 10,
  netFinishedRevenueByGmd: () => 7_000,
  silageOpportunityCostDm: 0.6,
  purchasedSilageCostDm: 0.55,
  lots: [{ id: 'own-silage', label: 'Silagem comprometida', share: 100, gmd: 1.5 }],
});
assertClose(ownSilageWithoutSaleRoute.ownHeads, 10, 1e-8);
assertClose(ownSilageWithoutSaleRoute.purchasedSilageDmKg, 0, 1e-8);
assert.ok(ownSilageWithoutSaleRoute.ownSilageUsedDmKg > 0);
assert.ok(ownSilageWithoutSaleRoute.ownSilageTransferPresentValue > 0);

// Uma rota própria com margem de transferência levemente negativa ainda pode
// criar valor consolidado quando consome silagem já comprometida e sem rota de
// venda. A variável deve chegar ao LP para o crédito interno ser considerado.
const ownSilageConsolidatedPositive = calculateFeedAllocation({
  annualCandidates: 10,
  entryWeight: 375,
  saleWeight: 540,
  netFinishedRevenueByGmd: () => 4_050,
  sellNowHead: 4_000,
  dietDmDay: 1,
  forageShare: 100,
  silageCashCostDm: 0,
  silageOpportunityCostDm: 0.5,
  purchasedSilageCostDm: 10,
  grainCashCostDm: 0,
  grainNetSalePriceSack: 0,
  grainPurchasePriceSack: 0,
  dietOtherCostDm: 0,
  ownOperationDay: 0,
  ownFixedCostHead: 0,
  thirdPartyAllInDay: 1_000,
  thirdPartyFreightHead: 0,
  thirdPartyCapacity: 0,
  annualCarryRate: 0,
  feedlotCapacity: 10,
  feedlotUtilization: 100,
  grainAreaHa: 0,
  grainYieldSacksHa: 0,
  grainCashCostHa: 0,
  silageAreaHa: 2,
  silageDmTonnesHaYear: 1,
  silageCashCostHaYear: 0,
  allowPurchasedFeed: false,
  allowOwnFeedlot: true,
  allowOutsource: false,
  workingCapitalLimit: 100_000,
  lots: [{ id: 'x', label: 'x', share: 100, gmd: 1.5 }],
});
assertClose(ownSilageConsolidatedPositive.lots[0].ownMarginHead, -5);
assertClose(ownSilageConsolidatedPositive.ownHeads, 10);
assertClose(ownSilageConsolidatedPositive.sellHeads, 0);
assertClose(ownSilageConsolidatedPositive.ownSilageTransferPresentValue, 550);

// Todas as rotas usam VP na mesma data-base: receita de rotas menos a
// alternativa de vender todos no portão e menos custos deve fechar a margem.
assertClose(
  tenHeadMarginalFeed.routeRevenuePresentValue -
    10 * 4_000 -
    tenHeadMarginalFeed.routeCostPresentValue,
  tenHeadMarginalFeed.totalIncrementalMargin,
  1e-5,
);

// O calendário opcional substitui apenas o teto conservador de simultaneidade.
// Duas coortes de 10 cabeças usam as mesmas 10 vagas em sequência; o intervalo
// semanal é [entrada, saída). Os 110 dias projetados ocupam 16 buckets;
// portanto a semana 17 já pertence à segunda coorte.
const temporalFeedBase = {
  annualCandidates: 20,
  entryWeight: 375,
  saleWeight: 540,
  netFinishedRevenueByGmd: () => 7_000,
  sellNowHead: 4_000,
  dietDmDay: 0,
  forageShare: 0,
  silageCashCostDm: 0,
  silageOpportunityCostDm: 0,
  purchasedSilageCostDm: 0,
  grainCashCostDm: 0,
  grainNetSalePriceSack: 65,
  grainPurchasePriceSack: 65,
  dietOtherCostDm: 0,
  ownOperationDay: 0,
  ownFixedCostHead: 0,
  thirdPartyAllInDay: 10_000,
  thirdPartyFreightHead: 0,
  annualCarryRate: 0,
  feedlotCapacity: 10,
  feedlotUtilization: 100,
  grainAreaHa: 0,
  grainYieldSacksHa: 0,
  grainCashCostHa: 0,
  silageAreaHa: 0,
  silageDmTonnesHaYear: 0,
  silageCashCostHaYear: 0,
  allowPurchasedFeed: true,
};

const sequentialCohorts = calculateFeedAllocation({
  ...temporalFeedBase,
  lots: [
    {
      id: 'first',
      label: 'Primeira coorte',
      share: 50,
      gmd: 1.5,
      entryWeek: 1,
      exitWeek: 17,
    },
    {
      id: 'second',
      label: 'Segunda coorte',
      share: 50,
      gmd: 1.5,
      entryWeek: 17,
      exitWeek: 33,
    },
  ],
});
assert.equal(sequentialCohorts.calendarMode, 'weekly');
assertClose(sequentialCohorts.ownHeads, 20, 1e-8);
assertClose(sequentialCohorts.sellHeads, 0, 1e-8);
assertClose(sequentialCohorts.concurrentOwnHeads, 10, 1e-8);
assert.ok(
  sequentialCohorts.temporalOccupancy.every(
    (period) => period.ownHeads <= sequentialCohorts.concurrentOwnCapacity + 1e-8,
  ),
);

const overlappingCohorts = calculateFeedAllocation({
  ...temporalFeedBase,
  lots: [
    {
      id: 'first',
      label: 'Primeira coorte',
      share: 50,
      gmd: 1.5,
      entryWeek: 1,
      exitWeek: 17,
    },
    {
      id: 'second',
      label: 'Segunda coorte',
      share: 50,
      gmd: 1.5,
      entryWeek: 1,
      exitWeek: 17,
    },
  ],
});
assert.equal(overlappingCohorts.calendarMode, 'weekly');
assertClose(overlappingCohorts.ownHeads, 10, 1e-8);
assertClose(overlappingCohorts.sellHeads, 10, 1e-8);
assertClose(overlappingCohorts.concurrentOwnHeads, 10, 1e-8);

// Sem calendário detalhado, a API e o envelope legado continuam iguais: o
// total anual é limitado à capacidade simultânea conservadora.
const legacyCohorts = calculateFeedAllocation({
  ...temporalFeedBase,
  lots: [
    { id: 'first', label: 'Primeira coorte', share: 50, gmd: 1.5 },
    { id: 'second', label: 'Segunda coorte', share: 50, gmd: 1.5 },
  ],
});
assert.equal(legacyCohorts.calendarMode, 'legacy-conservative');
assertClose(legacyCohorts.ownHeads, 10, 1e-8);
assertClose(legacyCohorts.concurrentOwnHeads, 10, 1e-8);

const idleInfeasible = allocateStrategy({
  activities: [],
  totalArea: 100,
  capitalLimit: 0,
  maxSharePercent: 100,
  criterion: 'defensive',
  idleMargins: { low: -1_000, base: -1_000, high: -1_000 },
  idleCashCostHa: 1_000,
});
assert.equal(idleInfeasible.capitalFeasible, false);
assert.equal(idleInfeasible.capitalShortfall, 100_000);
assert.equal(idleInfeasible.scenarioTotals.base, -100_000);

const positiveMix = allocateStrategy({
  activities: [
    {
      id: 'crop',
      label: 'Cultura',
      margins: { low: 2_000, base: 3_000, high: 4_000 },
      cashCostHa: 5_000,
    },
  ],
  totalArea: 100,
  capitalLimit: 500_000,
  maxSharePercent: 100,
  criterion: 'defensive',
  idleMargins: { low: -1_000, base: -1_000, high: -1_000 },
  idleCashCostHa: 1_000,
});
assert.equal(positiveMix.allocatedArea, 100);
assert.equal(positiveMix.capitalFeasible, true);

// Fluxo integrado calendário -> alocação -> cabeças-dia. Para 142,5 kg de
// ganho a 1,5 kg/d, a permanência única é 95 dias. A saída por data deve
// reproduzir exatamente esse número; alimento, vaga-dia e efluente usam o
// mesmo denominador.
const integratedCalendarFeed = calculateFeedAllocation({
  ...temporalFeedBase,
  annualCandidates: 6_725,
  entryWeight: 400,
  saleWeight: 542.5,
  dietDmDay: 10,
  feedlotCapacity: 6_725,
  lots: [
    {
      id: 'reference-module',
      label: 'Módulo de referência',
      share: 100,
      gmd: 1.5,
      dietDmDay: 10,
      entryDate: '2026-01-01',
      exitDate: '2026-04-06',
    },
  ],
});
assert.equal(integratedCalendarFeed.calendarMode, 'date-weekly');
assert.equal(integratedCalendarFeed.lots[0].days, 95);
assertClose(integratedCalendarFeed.lots[0].totalDmKgHead, 950);
assertClose(integratedCalendarFeed.ownHeads, 6_725);
assertClose(integratedCalendarFeed.penDaysUsed, 6_725 * 95);

// Uma saída um dia mais tarde não pode criar 96 dias de vaga e apenas 95 dias
// de alimento/efluente. O calendário detalhado é rejeitado, a mensagem fornece
// a data exata e todo o balanço permanece na fonte única de 95 dias.
const mismatchedCalendarFeed = calculateFeedAllocation({
  ...temporalFeedBase,
  annualCandidates: 6_725,
  entryWeight: 400,
  saleWeight: 542.5,
  dietDmDay: 10,
  feedlotCapacity: 6_725,
  lots: [
    {
      id: 'reference-module',
      label: 'Módulo de referência',
      share: 100,
      gmd: 1.5,
      dietDmDay: 10,
      entryDate: '2026-01-01',
      exitDate: '2026-04-07',
    },
  ],
});
assert.equal(mismatchedCalendarFeed.calendarMode, 'legacy-conservative');
assert.ok(
  mismatchedCalendarFeed.calendarIssues.some((issue) =>
    issue.includes('ajuste a saída para 2026-04-06'),
  ),
);
assert.equal(mismatchedCalendarFeed.lots[0].days, 95);
assertClose(mismatchedCalendarFeed.lots[0].totalDmKgHead, 950);
assertClose(mismatchedCalendarFeed.penDaysUsed, 6_725 * 95);

const effluentReference = {
  referenceAreaHa: 50,
  referenceDepthMm: 150,
  referenceAnnualHeads: 6_725,
  referenceConfinementDays: 95,
  currentOwnFeedlotHeadDays: 6_725 * 95,
  targetAreaHa: 50,
  totalAreaHa: 400,
  targetDepthMm: 150,
  valueM3: 17.45,
  calibrationSource: 'teste integrado · medição do módulo-base',
  calibrationPeriodStart: '2025-01-01',
  calibrationPeriodEnd: '2026-01-01',
  calibrationPeriodConfirmed: true,
  valueSource: 'teste integrado · memória de custo evitável',
  valueDate: '2026-01-01',
  creditConfirmed: true,
  excessDestination: '',
  excessDestinationCapacityM3: 0,
  excessDestinationConfirmed: false,
};
const effluentModule = calculateEffluentScale(effluentReference);
assertClose(effluentModule.referenceVolumeM3, 75_000);
assertClose(effluentModule.availableVolumeM3, 75_000);
assertClose(effluentModule.areaCoveredAtTargetDepthHa, 50);
assertClose(effluentModule.depthAcrossTargetAreaMm, 150);
assertClose(effluentModule.grossPotentialCredit, 1_308_750);
assertClose(effluentModule.includedCredit, 1_308_750);
assertClose(
  effluentModule.volumePerHeadDayM3 * 1_000,
  75_000_000 / (6_725 * 95),
);
const integratedCalendarEffluent = calculateEffluentScale({
  ...effluentReference,
  currentOwnFeedlotHeadDays: integratedCalendarFeed.penDaysUsed,
});
assertClose(integratedCalendarEffluent.currentOwnFeedlotHeadDays, 638_875);
assertClose(integratedCalendarEffluent.availableVolumeM3, 75_000);
assertClose(integratedCalendarEffluent.areaCoveredAtTargetDepthHa, 50);
assertClose(integratedCalendarEffluent.includedCredit, 1_308_750);

// Aumentar a área receptora não fabrica volume nem crédito. Os mesmos
// 75.000 m³ em 400 ha entregam 18,75 mm e mantêm o benefício bruto total.
const effluentSpread = calculateEffluentScale({
  ...effluentReference,
  targetAreaHa: 400,
});
assertClose(effluentSpread.availableVolumeM3, 75_000);
assertClose(effluentSpread.depthAcrossTargetAreaMm, 18.75);
assertClose(effluentSpread.areaCoveredAtTargetDepthHa, 50);
assertClose(effluentSpread.coveragePercent, 12.5);
assertClose(effluentSpread.grossPotentialCredit, 1_308_750);
assertClose(effluentSpread.requiredVolumeM3, 600_000);
assertClose(effluentSpread.volumeShortfallM3, 525_000);

// Oito módulos fecham 400 ha a 150 mm e exigem oito vezes as cabeças-dia.
const effluentExpanded = calculateEffluentScale({
  ...effluentReference,
  currentOwnFeedlotHeadDays: 8 * 6_725 * 95,
  targetAreaHa: 400,
});
assertClose(effluentExpanded.availableVolumeM3, 600_000);
assertClose(effluentExpanded.areaCoveredAtTargetDepthHa, 400);
assertClose(effluentExpanded.requiredReferenceModules, 8);
assertClose(effluentExpanded.requiredAnnualHeadsAtReferenceStay, 53_800);
assertClose(effluentExpanded.coveragePercent, 100);

// Volume acima da demanda não pode fabricar área nem crédito fora da área-alvo.
const effluentExcess = calculateEffluentScale({
  ...effluentReference,
  currentOwnFeedlotHeadDays: 10 * 6_725 * 95,
  targetAreaHa: 400,
});
assertClose(effluentExcess.potentialAreaAtTargetDepthHa, 500);
assertClose(effluentExcess.areaCoveredAtTargetDepthHa, 400);
assertClose(effluentExcess.volumeExcessM3, 150_000);
assertClose(effluentExcess.grossPotentialCredit, 600_000 * 17.45);
assert.equal(effluentExcess.excessDestinationReady, false);
assert.equal(effluentExcess.creditReady, false);
assertClose(effluentExcess.includedCredit, 0);
assert.ok(
  effluentExcess.blockers.some((blocker) =>
    blocker.includes('150000 m³ excedentes'),
  ),
);

// O usuário precisa fornecer uma rota local e capacidade suficiente; nenhuma
// forma de armazenamento, área ou autorização é presumida. Mesmo fechada, a
// rota do excedente não amplia o crédito além dos 600.000 m³ aplicados.
const effluentExcessClosed = calculateEffluentScale({
  ...effluentReference,
  currentOwnFeedlotHeadDays: 10 * 6_725 * 95,
  targetAreaHa: 400,
  excessDestination:
    'rota local de teste · destino, período e responsável documentados',
  excessDestinationCapacityM3: 150_000,
  excessDestinationConfirmed: true,
});
assert.equal(effluentExcessClosed.excessDestinationReady, true);
assert.equal(effluentExcessClosed.creditReady, true);
assertClose(effluentExcessClosed.includedCredit, 600_000 * 17.45);

const effluentExcessUndersized = calculateEffluentScale({
  ...effluentReference,
  currentOwnFeedlotHeadDays: 10 * 6_725 * 95,
  targetAreaHa: 400,
  excessDestination:
    'rota local de teste · destino, período e responsável documentados',
  excessDestinationCapacityM3: 149_999,
  excessDestinationConfirmed: true,
});
assert.equal(effluentExcessUndersized.excessDestinationReady, false);
assert.equal(effluentExcessUndersized.creditReady, false);
assertClose(effluentExcessUndersized.includedCredit, 0);

const effluentNoOwnFeedlot = calculateEffluentScale({
  ...effluentReference,
  currentOwnFeedlotHeadDays: 0,
});
assertClose(effluentNoOwnFeedlot.availableVolumeM3, 0);
assertClose(effluentNoOwnFeedlot.includedCredit, 0);
assert.equal(effluentNoOwnFeedlot.creditReady, false);

const effluentUnconfirmed = calculateEffluentScale({
  ...effluentReference,
  creditConfirmed: false,
});
assertClose(effluentUnconfirmed.grossPotentialCredit, 1_308_750);
assertClose(effluentUnconfirmed.includedCredit, 0);

const effluentWithoutProvenance = calculateEffluentScale({
  ...effluentReference,
  calibrationSource: '',
});
assert.equal(effluentWithoutProvenance.provenanceReady, false);
assert.equal(effluentWithoutProvenance.creditReady, false);
assertClose(effluentWithoutProvenance.includedCredit, 0);

// O núcleo estático não conhece as cabeças-dia do cocho. Ligar o antigo
// interruptor por hectare não pode alterar o EBITDA antes do alocador.
const coreWithoutEffluent = calculateCore({
  ...defaultAssumptions,
  includeEffluentSavings: false,
});
const coreWithUnreconciledEffluent = calculateCore({
  ...defaultAssumptions,
  includeEffluentSavings: true,
  effluentArea: 400,
});
assertClose(coreWithUnreconciledEffluent.ebitdaA, coreWithoutEffluent.ebitdaA);

const workRate = calculateWorkRate({
  areaHa: 400,
  usableDays: 16,
  informedRateHaDay: 20,
});
assertClose(workRate.requiredRateHaDay, 25);
assertClose(workRate.capacityGapHaDay, 5);
assert.equal(workRate.fits, false);

const cornBudget = cropDefaults.find((crop) => crop.id === 'corn-irrigated');
assert.ok(cornBudget);
const cornWithSeed = updateCropCostItem(cornBudget, 'seed', 500);
assertClose(
  cornWithSeed.costItems.find((item) => item.id === 'unallocated').value,
  4_300,
);
assertClose(cropDirectCostHa(cornWithSeed), cropDirectCostHa(cornBudget));
let cornOverrun = cornBudget;
for (const [id, value] of [
  ['seed', 1_000],
  ['fertilizer', 2_000],
  ['crop-protection', 1_000],
  ['operations', 700],
  ['harvest-logistics', 500],
]) {
  cornOverrun = updateCropCostItem(cornOverrun, id, value);
}
assertClose(
  cornOverrun.costItems.find((item) => item.id === 'unallocated').value,
  0,
);
assertClose(cropDirectCostHa(cornOverrun), 5_850);

const weeklyFeed = calculateWeeklyFeedPlan({
  lots: [
    {
      id: 'lot',
      label: 'Lote teste',
      ownHeads: 10,
      days: 14,
      entryDate: '2026-09-01',
      exitDate: '2026-09-15',
      grainSacksHead: 1,
      silageDmKgHead: 140,
      totalDmKgHead: 200,
    },
  ],
  grainProducedSacks: 10,
  ownGrainAllocatedSacks: 10,
  ownSilageAllocatedDmKg: 1_400,
  grainReceiptDate: '2026-09-08',
  allowPurchases: true,
});
assert.equal(weeklyFeed.calendarReady, true);
assertClose(weeklyFeed.totalGrainPurchasedSacks, 5);
assertClose(weeklyFeed.rows[0].silageEndingDmKg, 700);
assertClose(weeklyFeed.rows[1].grainEndingSacks, 5);
assertClose(weeklyFeed.totalSilagePurchasedDmKg, 0);

const soyBudget = cropDefaults.find((crop) => crop.id === 'soy-irrigated');
assert.ok(soyBudget);
const soyCash = calculateMonthlyCashFlow(
  cropCashEvents(
    soyBudget,
    1,
    '2026-11-01',
    '2027-02-24',
    100,
  ),
);
assertClose(soyCash.peakFundingNeed, cropDirectCostHa(soyBudget) + 100);
assertClose(soyCash.endingCash, calculateCrop(soyBudget, 1, 100).margin);
assert.equal(soyCash.peakFundingMonth, '2026-11');

const capexStep = buildCapexStep(
  'test',
  'Teste',
  'un',
  150,
  100,
  500,
  'teste',
);
assertClose(capexStep.gap, 50);
assertClose(capexStep.incrementalCapex, 25_000);

console.log('model-sanity: ok');
