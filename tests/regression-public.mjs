import assert from 'node:assert/strict';
import { calculateCore, defaultAssumptions, irr } from '../lib/livestock-model.ts';
import { calculateMonthlyCashFlow, calculateWeeklyFeedPlan, buildCapexStep } from '../lib/operational-model.ts';
import { parseConab, parsePeriod, parsePtBrNumber } from '../lib/conab-prices.ts';
import { csvCell, validateScenario } from '../lib/scenario-storage.ts';
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, a + ' != ' + b);
let count = 0;
const test = (name, fn) => { fn(); count++; console.log('ok ' + count + ' · ' + name); };
const feed = {
  lots: [{ id: 'lot', label: 'Teste', ownHeads: 10, days: 14,
    entryDate: '2026-09-01', exitDate: '2026-09-15',
    grainSacksHead: 1, silageDmKgHead: 140, totalDmKgHead: 200 }],
  grainProducedSacks: 10, ownGrainAllocatedSacks: 10,
  ownSilageAllocatedDmKg: 1400, grainReceiptDate: '2026-09-07', allowPurchases: true,
};
test('Estoque colhido antes do cocho é reconhecido', () => {
  const r = calculateWeeklyFeedPlan({ ...feed, grainReceiptDate: '2026-08-31' });
  close(r.totalGrainPurchasedSacks, 0); close(r.openingGrainSacks, 10);
});
test('Colheita de fim de semana não alimenta dias anteriores', () => {
  const r = calculateWeeklyFeedPlan(feed);
  close(r.totalGrainPurchasedSacks, 60 / 14);
  close(r.timingMismatchGrainSacks, 60 / 14);
});
test('Compra desligada deixa déficit físico visível', () => {
  const r = calculateWeeklyFeedPlan({ ...feed, allowPurchases: false });
  close(r.totalGrainPurchasedSacks, 0); close(r.totalGrainShortageSacks, 60 / 14);
});
test('Recebimento no dia da saída permanece no estoque', () => {
  const r = calculateWeeklyFeedPlan({ ...feed, grainReceiptDate: '2026-09-15' });
  close(r.totalGrainPurchasedSacks, 10); close(r.rows.at(-1).grainEndingSacks, 10);
});
test('Pico de caixa respeita datas dentro do mês', () => {
  const r = calculateMonthlyCashFlow([
    { date: '2026-09-30', label: 'venda', inflow: 7e6, outflow: 0 },
    { date: '2026-09-01', label: 'compra', inflow: 0, outflow: 6e6 },
  ]);
  close(r.peakFundingNeed, 6e6); close(r.endingCash, 1e6);
  assert.equal(r.peakFundingDate, '2026-09-01');
});
test('Zero estrutura exige CAPEX integral, não dado ausente', () => {
  const r = buildCapexStep('x', 'x', 'un', 100, 0, 1000, 'teste');
  close(r.gap, 100); close(r.incrementalCapex, 100000);
  assert.equal(buildCapexStep('x', 'x', 'un', 100, undefined, 1000, '').gap, null);
});
test('Área zero não gera animais ou margem', () => {
  const r = calculateCore({ ...defaultAssumptions, totalArea: 0, forageShare: 0, includeCows: false });
  close(r.pastureAreaA, 0); close(r.soldA, 0); close(r.ebitdaA, 0);
});
test('Silagem sem gado continua tendo custo', () => {
  const r = calculateCore({ ...defaultAssumptions, stockingUa: 0, includeCows: false });
  const ongoingCost = 1090000 + 300 * 6725 * (432.62 + 19.97) / 300;
  close(r.cashCostsA, ongoingCost); close(r.ebitdaA, -ongoingCost);
});
test('Cem por cento silagem não cria hectare de pasto', () => {
  const r = calculateCore({ ...defaultAssumptions, silageShare: 100, includeCows: false });
  close(r.pastureAreaA, 0); close(r.soldA, 0);
});
test('Pesos invertidos ou GMD zero não criam ciclos produtivos', () => {
  const reversed = calculateCore({ ...defaultAssumptions, pivotExitWeight: 200 });
  close(reversed.soldA, 0); assert.equal(reversed.routeAInputValid, false);
  const stalled = calculateCore({ ...defaultAssumptions, gmdB: 0 });
  close(stalled.soldB, 0); assert.equal(stalled.routeBInputValid, false);
});
test('TIR de fluxos sem troca de sinal é indefinida', () => {
  assert.equal(irr([0, 0, 0]), null); assert.equal(irr([1, 2]), null);
});
test('Datas impossíveis e preços não positivos são rejeitados', () => {
  assert.throws(() => parsePeriod('31/02/26 a 04/03/26'));
  assert.throws(() => parsePeriod('10/03/26 a 04/03/26'));
  for (const x of [0, -1, '0', '-2', NaN]) assert.throws(() => parsePtBrNumber(x));
  close(parsePtBrNumber('1.234,50'), 1234.5);
});
test('Uma linha inválida não elimina preços válidos', () => {
  const rows = parseConab({ precos: [
    { nomeProduto: 'Milho em grãos', nivel: 'PRODUTOR', uf: 'BA', periodo: '31/08/26 a 04/09/26', valor: '66,96' },
    { valor: 'inválido' },
  ] });
  assert.equal(rows.length, 1); close(rows[0].value, 66.96);
});
test('CSV neutraliza fórmulas mas preserva números negativos', () => {
  for (const x of ['=1+1', '+cmd', '@SUM(A1)', '  =1+1', '-cmd']) assert.ok(csvCell(x).startsWith('"\''));
  assert.equal(csvCell(-123), '"-123"');
});
test('Cenário importado renova confirmações e valida números', () => {
  const template = { assumptions: defaultAssumptions, readyConfirmed: true, price: 2 };
  const doc = { schema: 1, data: template };
  assert.equal(validateScenario(doc, template).readyConfirmed, false);
  assert.throws(() => validateScenario({ ...doc, schema: 99 }, template));
  assert.throws(() => validateScenario({ schema: 1, data: { ...template, price: Infinity } }, template));
});
test('Importação rejeita custo negativo e peso que estoura o calendário', () => {
  const template = { assumptions: defaultAssumptions, crops: [{ costItems: [{ value: 1 }] }] };
  assert.throws(() => validateScenario({ schema: 1, data: {
    ...template, crops: [{ costItems: [{ value: -1e6 }] }]
  } }, template));
  assert.throws(() => validateScenario({ schema: 1, data: {
    ...template, assumptions: { ...defaultAssumptions, saleWeight: 1e12 }
  } }, template));
});
test('Datas avançadas sobrevivem à importação sobre um cenário fresco', () => {
  const template = { lots: [{ id: 'x', entryDate: '', exitDate: '' }] };
  const lots = [{ id: 'x', entryDate: '2027-08-01', exitDate: '2027-11-02' }];
  assert.deepEqual(validateScenario({ schema: 1, data: { lots } }, template).lots, lots);
});
test('Compra já prevista não vira compra temporal adicional', () => {
  const r = calculateWeeklyFeedPlan({ ...feed, grainProducedSacks: 0, ownGrainAllocatedSacks: 0 });
  close(Math.max(0, r.totalGrainPurchasedSacks - 10), 0);
});
console.log('regression-public: ' + count + ' testes aprovados');
