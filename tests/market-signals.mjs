import assert from 'node:assert/strict';
import {
  marketSignal,
  mergeMarketHistory,
  cattleCornRelation,
  validObservation,
} from '../lib/market-signals.ts';
import { capacityActions } from '../lib/capacity-actions.ts';
import { calculateCore, defaultAssumptions } from '../lib/livestock-model.ts';
import { parseConab, completedWeek } from '../lib/conab-prices.ts';
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log('ok ' + name);
};
const day = (n) =>
  new Date(Date.UTC(2026, 5, 19 + n * 7, 12)).toISOString().slice(0, 10);
const observation = (i, value = 100 + i, overrides = {}) => ({
  source: 'CONAB',
  product: 'corn',
  uf: 'BA',
  level: 'PRODUTOR',
  description: 'MILHO EM GRÃOS (60 kg)',
  displayUnit: 'R$/sc 60 kg',
  periodStart: new Date(Date.parse(day(i) + 'T12:00:00Z') - 4 * 86400000)
    .toISOString()
    .slice(0, 10),
  periodEnd: day(i),
  sourceDate: day(i),
  rawPeriod: 'teste',
  value,
  ...overrides,
});
const series = Array.from({ length: 12 }, (_, i) => observation(i));
const signal = (rows = series, asOf = '2026-09-06') =>
  marketSignal(rows, 'BA', 'corn', asOf);
test('12 observações, variação medida sem projeção', () => {
  const s = signal();
  assert.equal(s.observations, 12);
  assert.ok(Math.abs(s.changePeriod - 11) < 1e-8);
  assert.equal(s.direction, 'alta');
  assert.equal('forecast' in s, false);
});
test('UF não mistura', () =>
  assert.equal(
    signal(series.map((q) => ({ ...q, uf: 'MT' }))).observations,
    0,
  ));
test('nível e unidade incompatíveis descartados', () => {
  assert.equal(
    signal(series.map((q) => ({ ...q, level: 'ATACADO' }))).observations,
    0,
  );
  assert.equal(
    signal(series.map((q) => ({ ...q, displayUnit: 'R$/t' }))).observations,
    0,
  );
});
test('descrição/qualidade de outra série não amplia amostra', () => {
  const s = signal(
    series.map((q, i) =>
      i === 11 ? { ...q, description: 'outra qualidade (60 kg)' } : q,
    ),
  );
  assert.equal(s.observations, 1);
  assert.equal(s.direction, 'insuficiente');
});
test('sem pontos ou com um não inventa tendência', () => {
  assert.equal(signal([]).direction, 'insuficiente');
  assert.equal(signal([series.at(-1)]).changePeriod, null);
});
test('série constante lateral', () =>
  assert.equal(
    signal(series.map((q) => ({ ...q, value: 100 }))).direction,
    'lateral',
  ));
test('baixa regular', () =>
  assert.equal(
    signal(series.map((q, i) => ({ ...q, value: 130 - 2 * i }))).direction,
    'baixa',
  ));
test('reversão semanal divergente é mista', () => {
  const rows = series.map((q, i) => ({ ...q, value: 100 + 2 * i }));
  rows[11].value = 115;
  assert.equal(signal(rows).direction, 'misto');
});
test('lacuna não é interpolada', () =>
  assert.equal(
    signal(series.filter((_, i) => i !== 9)).direction,
    'insuficiente',
  ));
test('fonte antiga não rejuvenesce com fetch', () =>
  assert.equal(signal(series, '2026-10-01').direction, 'desatualizado'));
test('ponto futuro não entra', () =>
  assert.equal(signal([observation(12)]).observations, 0));
test('data impossível inválida', () =>
  assert.equal(
    validObservation(
      observation(1, 100, {
        sourceDate: '2026-02-30',
        periodEnd: '2026-02-30',
      }),
    ),
    false,
  ));
test('preços negativos e não finitos inválidos', () => {
  for (const n of [0, -1, NaN, Infinity])
    assert.equal(validObservation(observation(1, n)), false);
});
test('revisão substitui sem duplicar', () => {
  const merged = mergeMarketHistory(series, [observation(11, 125)]);
  assert.equal(merged.length, 12);
  assert.equal(merged.at(-1).value, 125);
});
test('snapshot parcial preserva série', () =>
  assert.equal(mergeMarketHistory(series, [observation(11)]).length, 12));
test('relação boi/milho só usa datas comuns', () => {
  const cattle = marketSignal(
    series.map((q) => ({
      ...q,
      product: 'cattle',
      description: 'BOI GORDO (15 kg)',
      displayUnit: 'R$/@ de 15 kg',
      value: 330,
    })),
    'BA',
    'cattle',
    '2026-09-06',
  );
  const ratio = cattleCornRelation(cattle, signal(), '2026-09-06');
  assert.equal(ratio.observations, 12);
  assert.ok(ratio.change < 0);
});
test('par comum antigo não vira relação atual com pontas recentes distintas', () => {
  const cows = [observation(2), observation(11)].map((q) => ({
    ...q,
    product: 'cattle',
    description: 'BOI GORDO (15 kg)',
    displayUnit: 'R$/@ de 15 kg',
    value: 330,
  }));
  const cattle = marketSignal(cows, 'BA', 'cattle', '2026-09-06');
  const corn = signal([observation(2), observation(10)]);
  assert.equal(cattle.current, true);
  assert.equal(corn.current, true);
  assert.equal(cattleCornRelation(cattle, corn, '2026-09-06').current, false);
});
test('API rejeita peso de unidade incompatível', () => {
  const rows = parseConab({
    precos: [
      {
        nomeProduto: 'MILHO EM GRÃOS (50 kg)',
        nivel: 'PRODUTOR',
        uf: 'BA',
        periodo: '31/08/26 a 04/09/26',
        valor: '66,96',
      },
    ],
  });
  assert.equal(rows.length, 0);
});
const a = {
  ...defaultAssumptions,
  includeCows: true, // Contraprova histórica da imagem, não configuração-base atual.
  totalArea: 550,
  feedlotCapacity: 2000,
  feedlotUtilization: 90,
  dietPriceDm: 1.5170909996242017,
};
test('gargalo reproduz margens do motor', () => {
  const c = calculateCore(a),
    d = capacityActions(a, 65);
  // Perdas de referência ao fim do pasto; mortos não consomem cocho.
  assert.ok(Math.abs(c.ebitdaA - 6252035.64) < 1);
  assert.ok(Math.abs(c.ebitdaB - 9890615.08) < 1);
  assert.equal(d.neededCapacity, 2667);
  assert.ok(Math.abs(d.expandedVersusB - 103087.40) < 1);
});
test('indiferença do milho fecha A=B sem alterar entrada', () => {
  const d = capacityActions(a, 65);
  assert.ok(d.cornIndifference > 17 && d.cornIndifference < 18);
  const b = calculateCore({
    ...a,
    dietPriceDm: a.dietPriceDm + ((d.cornIndifference - 65) * 0.55) / 52.8,
  });
  assert.ok(Math.abs(b.ebitdaA - b.ebitdaB) < 1);
  assert.equal(a.feedlotCapacity, 2000);
});
test('dieta manual não inventa elasticidade', () =>
  assert.equal(
    capacityActions({ ...a, linkFeedToCropCosts: false }, 65).cornIndifference,
    null,
  ));
test('cocho já suficiente não cria ganho', () => {
  const d = capacityActions(
    { ...a, totalArea: 400, feedlotCapacity: 10000 },
    65,
  );
  assert.equal(d.extraCapacity, 0);
  assert.equal(d.expansionAnnualGain, 0);
});
test('utilização zero não recomenda capacidade infinita', () =>
  assert.equal(
    capacityActions({ ...a, feedlotUtilization: 0 }, 65).neededCapacity,
    null,
  ));
test('GMD zero não calcula falso equilíbrio', () =>
  assert.equal(
    capacityActions({ ...a, gmdFeedlot: 0 }, 65).cornIndifference,
    null,
  ));
test('potencial de sobra não gera receita', () => {
  const d = capacityActions(a, 65);
  assert.ok(Math.abs(d.unusedFlowArea - 138.7651) < .01);
  assert.ok(d.unusedRearingPotential > 0);
  assert.equal('surplusRevenue' in d, false);
});
test('daqui a dez semanas a consulta avança, não repete setembro', () => {
  assert.equal(
    completedWeek(0, new Date('2026-09-06T15:00:00Z')),
    '31/08/2026 até 04/09/2026',
  );
  assert.equal(
    completedWeek(0, new Date('2026-11-15T15:00:00Z')),
    '09/11/2026 até 13/11/2026',
  );
  assert.equal(
    completedWeek(11, new Date('2026-11-15T15:00:00Z')),
    '24/08/2026 até 28/08/2026',
  );
});
test('preços de setembro deixam de ser atuais dez semanas depois', () => {
  assert.equal(signal(series, '2026-11-15').direction, 'desatualizado');
  assert.equal(signal(series, '2026-11-15').current, false);
});
console.log('market-signals: ' + count + ' testes aprovados');
