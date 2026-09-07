import assert from 'node:assert/strict';
import { calculateCore, defaultAssumptions } from '../lib/livestock-model.ts';
import {
  cropDefaults,
  calculateCrop,
  cropFixedCostHa,
  cropDirectCostHa,
  cropNetSalePrice,
  updateCropCostItem,
} from '../lib/crop-model.ts';
import { calculateEffluentScale } from '../lib/effluent-model.ts';
import {
  allocateStrategy,
  allocateEnterpriseStrategy,
} from '../lib/strategy-model.ts';
import { integerHedgeCoverage } from '../lib/futures-model.ts';
import { buildAutomaticCalendar } from '../lib/crop-calendar-model.ts';
import { calculateWeeklyFeedPlan } from '../lib/operational-model.ts';
import { validateScenario } from '../lib/scenario-storage.ts';
import {
  referenceBridge,
  cattleStartupCash,
  pastureRequirements,
  observedGains,
  reviewDefaults,
} from '../lib/decision-review.ts';

let count = 0;
const close = (a, b, tolerance = 1e-6) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const test = (name, fn) => {
  fn();
  console.log(`ok ${++count} · ${name}`);
};
const base = { ...defaultAssumptions, includeCows: false };
const soy = cropDefaults[0];

test('Ponte explica 32.261 por ha de pasto sem prometer mesma margem por ha total', () => {
  const r = referenceBridge(base);
  close(r.normalizedCashHa, 24195.75);
  close(r.normalizedAccrualHa, 22507.5);
  close(r.sourceUnreconciled, 341528.76);
  close(
    r.rows[0].value + r.rows.reduce((s, v) => s + v.delta, 0),
    r.currentTotalHa,
  );
});
test('Custos fixos não diminuem com a commodity', () => {
  const before = calculateCrop(soy, 100);
  const after = calculateCrop({ ...soy, price: soy.price / 2 }, 100);
  close(before.fixedCostHa, after.fixedCostHa);
  close(
    before.marginHa - after.marginHa,
    ((soy.yield * soy.price) / 2) * (1 - soy.deductionRate / 100),
  );
});
test('Pontos de equilíbrio de preço e produtividade zeram margem agrícola', () => {
  const r = calculateCrop(soy, 100, 700);
  close(calculateCrop({ ...soy, price: r.breakEvenPrice }, 100, 700).margin, 0);
  close(calculateCrop({ ...soy, yield: r.breakEvenYield }, 100, 700).margin, 0);
});
test('Preço líquido do milho não abate fixos já incorridos', () => {
  const corn = cropDefaults.find((c) => c.id === 'corn-irrigated');
  close(cropNetSalePrice(corn), corn.price * (1 - corn.deductionRate / 100));
});
test('Editar custo em estresse altera orçamento; classificação preserva total', () => {
  const corn = cropDefaults.find((c) => c.id === 'corn-irrigated');
  const item = corn.costItems.find((i) => i.id !== 'corn-unallocated');
  const before = cropDirectCostHa(corn);
  close(
    cropDirectCostHa(
      updateCropCostItem(corn, item.id, item.value + 100, 'stress'),
    ),
    before + 100,
  );
  close(
    cropDirectCostHa(
      updateCropCostItem(corn, item.id, item.value + 100, 'classify'),
    ),
    before,
  );
});
test('Mortos são comprados e consomem alimento antes da perda', () => {
  const r = calculateCore(base);
  close(r.entrantsA * r.survival, r.soldA);
  close(r.silageConsumedDm, r.entrantsA * r.forageDmHead);
  assert.ok(r.mortalityCostHeadA > 0);
});
test('Vagas-dia limitam animais vendidos, inclusive mortalidade', () => {
  const r = calculateCore({
    ...base,
    feedlotCapacity: 100,
    feedlotUtilization: 80,
  });
  close(r.confinementOccupancy, 80);
  assert.ok(r.soldA <= ((80 * 365) / r.daysFeedlot) * r.survival + 1e-6);
});
test('Fração de dieta acima de 100% é inválida', () => {
  const r = calculateCore({
    ...base,
    forageShare: 90,
    otherIngredientSharePercent: 20,
  });
  assert.equal(r.routeAInputValid, false);
  close(r.soldA, 0);
});
test('Primeiro ano não vende animais que só terminam depois dele', () => {
  const a = { ...base, gmdB: 0.5 };
  const r = cattleStartupCash(a, 'B', '2026-09-10');
  close(r.salesHeads, 0);
  assert.ok(r.closingHeads > 0);
  close(
    r.events.reduce((s, e) => s + e.inflow, 0),
    0,
  );
});
test('O&M da fazenda permanece integral mesmo sem compra de animais', () => {
  const a = {
    ...base,
    stockingUa: 0,
    pivotInvestment: 0,
    investment: 0,
    landLeaseHa: 0,
  };
  const core = calculateCore(a);
  const r = cattleStartupCash(a, 'B', '2026-09-10');
  close(
    -r.endingCash,
    (core.annualPastureOperatingB * a.otherCostFactor) / 100,
  );
});
test('Primeiro ano em coortes não excede vagas simultâneas', () => {
  const r = cattleStartupCash(
    { ...base, feedlotCapacity: 100, feedlotUtilization: 85 },
    'A',
    '2026-09-10',
  );
  assert.ok(r.peakFeedlotHeads <= 85 + 1e-6);
  assert.ok(r.salesHeads < r.boughtHeads);
  assert.ok(r.events.every((e) => e.date < '2027-09-10'));
});
test('TMA não altera recebimentos nominais do primeiro ano', () => {
  const a = cattleStartupCash({ ...base, discountRate: 0 }, 'A', '2026-09-10');
  const b = cattleStartupCash({ ...base, discountRate: 30 }, 'A', '2026-09-10');
  close(a.endingCash, b.endingCash);
  close(a.peakFundingNeed, b.peakFundingNeed);
});
test('Silagem futura não é estoque antes do corte', () => {
  const r = calculateWeeklyFeedPlan({
    lots: [
      {
        id: 'a',
        label: 'a',
        ownHeads: 10,
        days: 10,
        entryDate: '2026-09-01',
        exitDate: '2026-09-11',
        grainSacksHead: 0,
        silageDmKgHead: 100,
        totalDmKgHead: 100,
      },
    ],
    grainProducedSacks: 0,
    ownGrainAllocatedSacks: 0,
    grainReceiptDate: '',
    ownSilageAllocatedDmKg: 1000,
    silageReceipts: [{ date: '2026-09-06', dmKg: 1000 }],
    allowPurchases: true,
  });
  close(r.openingSilageDmKg, 0);
  close(r.totalSilagePurchasedDmKg, 500);
  close(r.rows.at(-1).silageEndingDmKg, 500);
});
const effluent = {
  referenceAreaHa: 50,
  referenceDepthMm: 150,
  referenceAnnualHeads: 6725,
  referenceConfinementDays: 95,
  currentOwnFeedlotHeadDays: 6725 * 95,
  targetAreaHa: 50,
  totalAreaHa: 400,
  targetDepthMm: 150,
  valueM3: 17.45,
  calibrationSource: 'fixture',
  calibrationPeriodStart: '2026-01-01',
  calibrationPeriodEnd: '2026-12-31',
  calibrationPeriodConfirmed: true,
  valueSource: 'fixture',
  valueDate: '2026-09-01',
  creditConfirmed: true,
  excessDestination: '',
  excessDestinationCapacityM3: 0,
  excessDestinationConfirmed: false,
  agronomicAvailabilityPercent: 50,
  avoidedFertilizerBudgetHa: 2000,
  treatmentCostM3: 0.5,
  applicationCostM3: 0.2,
  annualFixedOperatingCost: 0,
};
test('Efluente limitado ao adubo evitável e líquido dos custos', () => {
  const r = calculateEffluentScale(effluent);
  close(r.avoidedFertilizerCost, 100000);
  close(r.operatingCost, 52500);
  close(r.netPotentialCredit, 47500);
});
test('Efluente negativo permanece visível; benefício ausente não inventa crédito', () => {
  const r = calculateEffluentScale({
    ...effluent,
    annualFixedOperatingCost: 100000,
  });
  close(r.netPotentialCredit, -52500);
  close(
    calculateEffluentScale({ ...effluent, agronomicAvailabilityPercent: 0 })
      .avoidedFertilizerCost,
    0,
  );
});
const activity = (id, low, mid, high, cost = 100, maxAreaHa) => ({
  id,
  label: id,
  margins: { low, base: mid, high },
  cashCostHa: cost,
  maxAreaHa,
});
const strategy = {
  totalArea: 100,
  capitalLimit: 1e6,
  maxSharePercent: 100,
  criterion: 'defensive',
};
test('Maximin protege o conjunto, não soma os piores resultados isolados', () => {
  const r = allocateStrategy({
    ...strategy,
    activities: [activity('a', 0, 60, 80), activity('b', 80, 60, 0)],
  });
  close(r.objective, 4000);
  close(r.rows[0].area, 50);
  close(r.rows[1].area, 50);
});
test('Área máxima física do cocho limita o módulo pecuário no mix', () => {
  const r = allocateEnterpriseStrategy({
    ...strategy,
    criterion: 'base',
    commonFixedCapital: 1000,
    feedlotFixedCapital: 2000,
    activities: [
      activity('cattle-a', 100, 100, 100, 100, 20),
      activity('soy', 30, 30, 30),
    ],
  });
  close(r.rows.find((v) => v.id === 'cattle-a').area, 20);
  close(r.rows.find((v) => v.id === 'soy').area, 80);
  close(r.fixedCapital, 3000);
});
test('CAPEX indivisível pode tornar soja superior sob o mesmo capital', () => {
  const r = allocateEnterpriseStrategy({
    ...strategy,
    criterion: 'base',
    capitalLimit: 12000,
    commonFixedCapital: 1000,
    feedlotFixedCapital: 7000,
    activities: [
      activity('cattle-a', 100, 100, 100),
      activity('soy', 60, 60, 60),
    ],
  });
  assert.equal(r.withFeedlot, false);
  close(r.rows.find((v) => v.id === 'soy').area, 100);
});
test('CAPEX maior que o orçamento mantém déficit, não declara operação viável', () => {
  const r = allocateEnterpriseStrategy({
    ...strategy,
    capitalLimit: 500,
    commonFixedCapital: 1000,
    feedlotFixedCapital: 0,
    activities: [],
  });
  assert.equal(r.capitalFeasible, false);
  close(r.capitalShortfall, 500);
});
test('Módulo pecuário de 1ha escala sem diluir saturação do cocho', () => {
  const unit = calculateCore({
    ...base,
    totalArea: 1,
    feedlotCapacity: undefined,
  });
  const twenty = calculateCore({
    ...base,
    totalArea: 20,
    feedlotCapacity: undefined,
  });
  close(unit.ebitdaA * 20, twenty.ebitdaA);
});
test('Hedge só usa contratos inteiros, inclusive lotes menores que um contrato', () => {
  close(integerHedgeCoverage(329, 100, 330).contracts, 0);
  const r = integerHedgeCoverage(1000, 100, 330);
  close(r.contracts, 3);
  close(r.coveredQuantity, 990);
  close(integerHedgeCoverage(660 - 1e-8, 100, 330).contracts, 1);
});
test('Calendário identifica ciclo tardio do algodão que invade o vazio', () => {
  const r = buildAutomaticCalendar('2027-02-10');
  assert.equal(r.crops['cotton-irrigated'].sanitaryFit, false);
  assert.equal(r.crops['cotton-irrigated'].availableDate, '');
});
test('Ausência de medição do capim não aparece como capacidade comprovada', () => {
  const r = pastureRequirements(base, reviewDefaults);
  assert.equal(r.supplyKnown, false);
  assert.equal(r.months[0].supply, null);
  assert.ok(r.annualDemand > 0);
});
test('Pesagens identificam desvio sem prescrever venda ou dieta automaticamente', () => {
  const r = observedGains(
    'id;data;kg\nX;2026-09-01;240\nX;2026-10-01;261',
    0.9,
  );
  close(r.rows[0].gmd, 0.7);
  close(r.rows[0].deviation, -0.2);
  assert.match(r.rows[0].action, /Investigar/);
  assert.ok(observedGains('X;2026-02-30;240', 0.9).errors.length);
});
test('Importação preserva trilha mas expira confirmação', () => {
  const r = validateScenario(
    {
      schema: 1,
      model: '2026-09-06.2',
      data: { scenarioAuditTrail: ['teste'], capacityConfirmed: true },
    },
    { scenarioAuditTrail: [], capacityConfirmed: false },
  );
  assert.deepEqual(r.scenarioAuditTrail, ['teste']);
  assert.equal(r.capacityConfirmed, false);
  assert.throws(() =>
    validateScenario({ schema: 1, model: 'desconhecido', data: {} }, {}),
  );
});
test('Migração dos fixos não herda custo da tela alterada', () => {
  const { fixedCostHa: removed, ...legacy } = soy;
  assert.ok(removed > 0);
  const r = validateScenario(
    { schema: 1, data: { crops: [{ ...legacy, fixedRate: 20 }] } },
    { crops: [{ ...soy, fixedCostHa: 9000 }] },
  );
  close(cropFixedCostHa(r.crops[0]), 2000);
});
test('Prazos importados respeitam o limite operacional da interface', () => {
  for (const key of ['setupDays', 'silageFirstReleaseDays', 'silageCutIntervalDays']) {
    assert.throws(() => validateScenario(
      { schema: 1, data: { operationalInputs: { [key]: 1e12 } } },
      { operationalInputs: { [key]: 0 } },
    ));
    close(validateScenario(
      { schema: 1, data: { operationalInputs: { [key]: 730 } } },
      { operationalInputs: { [key]: 0 } },
    ).operationalInputs[key], 730);
  }
});
console.log(`decision-audit: ${count} testes aprovados`);
