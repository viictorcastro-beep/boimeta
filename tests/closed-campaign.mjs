import assert from 'node:assert/strict';
import { closeCampaign } from '../lib/closed-campaign.ts';
import { calculateCore, defaultAssumptions } from '../lib/livestock-model.ts';
import { rearingOnly } from '../lib/rearing-model.ts';
import { calculateWeeklyFeedPlan } from '../lib/operational-model.ts';
const input = { a: { ...defaultAssumptions, feedlotCapacity: 4000, feedlotUtilization: 100,
  pastureMortalityPercent: 0.2, feedlotMortalityPercent: 0.2 },
  anchor: '2026-09-10', gateNetPrice: 12.5, setupDays: 0, setupCost: 0, reserveCash: 150000,
  openingSilageTonnesDm: 0, silageFirstReleaseDays: 150, silageCutIntervalDays: 180 };
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 0.01, `${label}: ${actual} vs ${expected}`);
const get = (i, route) => { const result = closeCampaign(i, route); assert.equal(result.error, null); return result.result; };
const core = calculateCore(input.a);
for (const [route, animalDays] of [['A', 273], ['B', 300], ['C', 178]]) {
  const r = get(input, route);
  assert.equal(r.animalDays, animalDays);
  assert.equal(r.elapsedDays, 364 + animalDays);
  assert.equal(r.lastPurchaseDate, '2027-09-09');
  near(r.bought, r.sold + r.deadPasture + r.deadFeed, 'animal closure');
  near(r.closingHeads, 0, 'no unsold animal');
  near(r.margin, r.revenue - r.operatingCost, 'margin');
  near(r.costLines.reduce((sum, line) => sum + line.total, 0), r.operatingCost, 'memória soma o custo operacional');
  for (const line of r.costLines) near(line.total, line.quantity * line.unitPrice, 'memória quantidade x custo');
  near(r.cash.endingCash, r.margin - r.capex, 'cash reconciles');
  near(r.annualEquivalentHa, r.margin / input.a.totalArea * 365 / r.elapsedDays, 'temporal denominator');
  near(r.requiredCapital, r.cash.peakFundingNeed + input.reserveCash, 'reserve not expensed');
  assert.ok(r.peakUa <= r.uaLimit + 1e-7);
  assert.ok(r.feedLimit === null || r.peakFeedHeads <= r.feedLimit + 1e-7);
  near(r.silageOpeningKg + r.silageProducedKg, r.silageConsumedKg + r.silageEndingKg, 'DM conservation');
  assert.ok(r.silageMinimumKg >= -1e-5, 'no feed from future harvest');
  assert.equal(r.cows, 0);
  assert.equal(r.effluentCredit, 0);
  near(get({ ...input, a: { ...input.a, includeCows: true, includeEffluentSavings: true } }, route).margin, r.margin, 'no extras');
  const variable = route === 'A' ? r.bought * core.preFeedlotCostHead + r.feedEntered * core.feedlotVariableCostHead + r.sold * core.costComponentsA.freightOut
    : route === 'B' ? r.bought * core.preSaleCostHeadB + r.sold * core.costComponentsB.freightOut
      : r.bought * rearingOnly(input.a, input.gateNetPrice).preGateVariableHead;
  near(r.variableCost, variable, 'phase costs counted once');
}
const slow = { ...input, a: { ...input.a, gmdPivotA: 0.4, gmdB: 0.4 } };
for (const [route, end] of [['A', 859], ['B', 1114], ['C', 764]]) {
  const r = get(slow, route);
  assert.equal(r.elapsedDays, end);
  assert.equal(r.firstYearSales, 0);
  assert.equal(r.lastPurchaseDate, '2027-09-09');
  assert.ok(r.sold > 0);
  near(r.closingHeads, 0, 'slow closure');
  assert.ok(r.silageMinimumKg >= -1e-5);
}
const tinyGmd = calculateCore({ ...input.a, gmdPivotA: 0.04 });
assert.equal(tinyGmd.daysPivotA, 4000, 'no hidden 0.05 floor');
const zero = get({ ...input, a: { ...input.a, feedlotCapacity: 0 } }, 'A');
assert.equal(zero.bought, 0);
assert.ok(zero.margin < 0, 'idle structure still costs');
const delayed = get({ ...input, a: { ...input.a, gmdPivotA: 2 } }, 'A');
assert.equal(delayed.foodDelay, 70);
assert.ok(delayed.silageMinimumKg >= -1e-5);
const loss = get({ ...input, a: { ...input.a, priceArroba: 0 } }, 'A');
assert.ok(loss.margin < 0);
const expensive = get({ ...input, setupCost: 500000, reserveCash: 1000000 }, 'A');
near(expensive.margin, get(input, 'A').margin, 'CAPEX/reserve do not change operational margin');
near(expensive.netCashAfterCapex, get(input, 'A').netCashAfterCapex - 500000, 'CAPEX paid once');
near(get({ ...input, a: { ...input.a, discountRate: 90 } }, 'A').margin, get(input, 'A').margin, 'nominal not discounted');
assert.ok(closeCampaign({ ...input, anchor: '2026-02-30' }, 'A').error);
assert.ok(closeCampaign({ ...input, a: { ...input.a, silageCrops: 1.5 } }, 'A').error);
assert.ok(closeCampaign({ ...input, a: { ...input.a, gmdPivotA: 0.00001 } }, 'A').error);
assert.ok(closeCampaign({ ...input, a: { ...input.a, gmdPivotA: Infinity } }, 'A').error);
assert.ok(closeCampaign({ ...input, a: { ...input.a, feedlotCapacity: -1 } }, 'A').error);
assert.ok(closeCampaign({ ...input, a: { ...input.a, silageRecovery: 101 } }, 'A').error);
const stockOnly = get({ ...input, openingSilageTonnesDm: 4000, a: { ...input.a, silageCrops: 0 } }, 'A');
assert.ok(stockOnly.bought > 0 && stockOnly.silageConsumedKg > 0, 'estoque substitui produção nova');
assert.ok(stockOnly.openingBudget > 0, 'estoque não gratuito');
assert.equal(stockOnly.silageBudget, 0);
near(stockOnly.silageOpeningKg, stockOnly.silageConsumedKg + stockOnly.silageEndingKg, 'estoque próprio fecha');
const noStock = get({ ...input, silageFirstReleaseDays: 365 }, 'A');
const tinyStock = get({ ...input, silageFirstReleaseDays: 365, openingSilageTonnesDm: 0.001 }, 'A');
assert.ok(tinyStock.bought >= noStock.bought - 0.01, 'adicionar estoque não elimina o atraso e a operação');
assert.ok(tinyStock.foodDelay > 0);
const lateCut = get({ ...input, silageFirstReleaseDays: 90, silageCutIntervalDays: 1000 }, 'A');
assert.equal(lateCut.cutsBeyondCampaign, 1, 'corte fora do período identificado');
for (const event of get(input, 'A').events) assert.ok(event.inflow === 0 || event.outflow === 0, 'pagar antes de receber no pico de caixa');
const exit = new Date(Date.parse('2026-01-01T12:00:00Z') + 1400 * 86400000).toISOString().slice(0, 10);
const feed = calculateWeeklyFeedPlan({ lots: [{ id: 'long', label: 'Long', ownHeads: 1, days: 1400,
  entryDate: '2026-01-01', exitDate: exit, grainSacksHead: 0, silageDmKgHead: 6300, totalDmKgHead: 14000 }],
  grainProducedSacks: 0, ownGrainAllocatedSacks: 0, ownSilageAllocatedDmKg: 0, grainReceiptDate: '', allowPurchases: false });
assert.ok(feed.rows.length > 160);
near(feed.rows.reduce((sum, row) => sum + row.totalDmConsumptionKg, 0), 14000, 'all 1400 feed days');
near(feed.totalSilageShortageDmKg, 6300, 'full shortage exposed');
console.log('Campanhas A/B/C: encerramento, custos, caixa, datas longas, conservação física e perdas aprovados.');
