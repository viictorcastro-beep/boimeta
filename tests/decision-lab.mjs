import assert from 'node:assert/strict';
import { defaultAssumptions, calculateCore } from '../lib/livestock-model.ts';
import { cropDefaults } from '../lib/crop-model.ts';
import { reviewDefaults } from '../lib/decision-review.ts';
import { validateScenario } from '../lib/scenario-storage.ts';
import {
  enterpriseAtArea,
  affordableEnterprise,
  capitalStudy,
  inverseCropCapital,
  marginLevers,
  stockingStudy,
  feedlotTurningPoints,
} from '../lib/decision-lab.ts';

const close = (a, b, tolerance = 1e-5) =>
  assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const diet = (corn) =>
  (0.45 * 5450) / (18 * 0.887 * 1000) + (0.55 * corn) / (60 * 0.88) + 0.6864;
const input = {
  a: {
    ...defaultAssumptions,
    pivotExitWeight: 399.999,
    dietPriceDm: diet(65),
    feedlotCapacity: 2000,
    feedlotUtilization: 90,
    pastureMortalityPercent: 0.2,
    feedlotMortalityPercent: 0.2,
  },
  calfCostC: 3288,
  gateNetPrice: 12.5,
  budget: 6e6,
  anchor: '2026-09-10',
  setupDays: 0,
  setupCost: 0,
  reserveCash: 0,
  cornDelivered: 65,
  crops: cropDefaults,
  desiredUa: 7.8,
  forage: reviewDefaults,
  windows: Object.fromEntries(
    cropDefaults.map((c) => [
      c.id,
      { plant: '2026-10-01', harvest: '2027-02-01', eligible: true },
    ]),
  ),
  doubleWindow: {
    soyPlant: '2026-10-01',
    soyHarvest: '2027-02-01',
    cornPlant: '2027-02-06',
    cornHarvest: '2027-06-06',
    eligible: true,
  },
};
let count = 0;
const test = (label, fn) => {
  fn();
  console.log(`ok ${++count} · ${label}`);
};
const patch = (a) => ({ ...input, a: { ...input.a, ...a } });
test('R$6 milhões compara área parcial sem apagar CAPEX do cocho', () => {
  const study = capitalStudy(input);
  const row = (id) => study.rows.find((r) => r.id === id);
  assert.equal(row('cattle-a').maximumArea, 0);
  assert.equal(row('cattle-b').maximumArea, 132);
  assert.equal(row('cattle-c').maximumArea, 122);
  assert.equal(row('soy-irrigated').maximumArea, 400);
  assert.equal(row('double-crop').maximumArea, 400);
  assert.equal(row('cotton-irrigated').maximumArea, 387);
  assert.equal(study.leader.id, 'double-crop');
  for (const r of study.rows)
    if (r.best.area > 0) assert.ok(r.best.capital <= input.budget + 1e-6);
});
test('Soja financia o milho pela venda anterior, não soma o custo anual como pico', () => {
  const s = enterpriseAtArea(input, 'soy-irrigated', 400);
  const d = enterpriseAtArea(input, 'double-crop', 400);
  close(s.capital, d.capital);
  assert.ok(d.cost > d.capital * 2);
});
test('Datas de custos agrícolas não desaparecem quando só há colheita', () => {
  for (const plant of ['', '2026-02-30', '2027-04-01']) {
    const x = {
      ...input,
      windows: {
        ...input.windows,
        'soy-irrigated': { plant, harvest: '2027-02-01', eligible: true },
      },
    };
    assert.equal(enterpriseAtArea(x, 'soy-irrigated', 400).valid, false);
  }
  assert.equal(
    enterpriseAtArea(
      {
        ...input,
        doubleWindow: { ...input.doubleWindow, cornPlant: '2027-01-01' },
      },
      'double-crop',
      400,
    ).valid,
    false,
  );
});
test('Não operar vence perdas incrementais; operações negativas continuam disponíveis para auditoria', () => {
  const x = {
    ...patch({ priceArroba: 0, cowSaleArroba: 0 }),
    gateNetPrice: 0,
    crops: input.crops.map((c) => ({ ...c, price: 0 })),
  };
  const study = capitalStudy(x);
  assert.equal(study.leader, null);
  assert.equal(study.rows.find((r) => r.id === 'soy-irrigated').best.area, 0);
  assert.ok(
    study.rows.find((r) => r.id === 'soy-irrigated').bestOperating.margin < 0,
  );
});
test('O não-operar continua pagando o arrendamento conhecido', () => {
  const x = patch({ landLeaseHa: 1000 });
  close(enterpriseAtArea(x, 'cattle-a', 0).margin, -400000);
});
test('A/B/C preservam capital fixo e reserva uma única vez', () => {
  for (const id of ['cattle-a', 'cattle-b', 'cattle-c']) {
    const first = enterpriseAtArea(input, id, 400);
    const next = enterpriseAtArea(
      { ...patch({ pivotInvestment: 3e6 }), setupCost: 2e6, reserveCash: 1e6 },
      id,
      400,
    );
    close(next.capital - first.capital, 6e6);
    close(next.margin, first.margin);
  }
});
test('Área ociosa paga arrendamento e os quatro equilíbrios zeram sua margem', () => {
  const x = patch({ landLeaseHa: 1000 });
  for (const id of ['cattle-a', 'cattle-b', 'cattle-c', 'soy-irrigated']) {
    const r = enterpriseAtArea(x, id, 100);
    const atPrice =
      id === 'cattle-c'
        ? { ...x, gateNetPrice: r.breakEven }
        : id.startsWith('cattle')
          ? { ...x, a: { ...x.a, priceArroba: r.breakEven } }
          : {
              ...x,
              crops: x.crops.map((c) =>
                c.id === id ? { ...c, price: r.breakEven } : c,
              ),
            };
    close(enterpriseAtArea(atPrice, id, 100).margin, 0);
    close(r.idleLease, 300000);
  }
});
test('Inversa parcial não excede o capital do gado pagando arrendamento da área toda', () => {
  const r = inverseCropCapital(
    {
      ...patch({ stockingUa: 1, calfCost: 500, landLeaseHa: 1000 }),
      calfCostC: 500,
    },
    'cattle-b',
  );
  for (const c of r.rows)
    assert.ok(c.local.capital <= r.reference.capital + 1e-5);
  const cotton = r.rows.find((r) => r.id === 'cotton-irrigated');
  close(cotton.equivalentArea, 296.3365846, 1e-3);
});
test('Equivalência de custeio acima da fazenda não cria hectares ou margem fictícios', () => {
  const r = inverseCropCapital(input, 'cattle-a');
  assert.ok(r.rows[0].equivalentArea > 400);
  for (const c of r.rows) {
    assert.ok(c.local.area <= 400);
    close(c.local.margin, enterpriseAtArea(input, c.id, 400).margin);
  }
});
test('Cocho saturado não aceita regra de três de capital e busca também o ponto físico', () => {
  const x = patch({ investment: 0, includeCows: false, feedlotCapacity: 500 });
  const r = affordableEnterprise(x, 'cattle-a');
  assert.equal(r.maximumArea, 108);
  assert.equal(r.best.area, 103);
  assert.ok(r.best.margin > enterpriseAtArea(x, 'cattle-a', 108).margin);
  assert.ok(
    enterpriseAtArea(x, 'cattle-a', (400 * 6e6) / r.full.capital).capital > 6e6,
  );
});
test('10 UA entra diretamente no pasto, não se reduz o valor pela silagem', () => {
  const x = { ...patch({ stockingUa: 10 }), desiredUa: 10 };
  const r = stockingStudy(x).find((r) => r.desired === 10);
  close(r.applied, 10);
  close(r.pastureAreaA, 300);
  close(r.silageArea, 100);
  close(r.pastureUaA, 3000);
  close(r.pastureUaPerTotalArea, 7.5);
  close(r.pastureUaB, 4000);
});
test('Lotação isolada não cria silagem nem vagas de cocho', () => {
  const study = stockingStudy(input);
  for (const r of study) {
    close(r.rows[0].sold, study[0].rows[0].sold);
    assert.ok(r.rows[0].feedlotHeads <= 1800 + 1e-6);
  }
});
test('Pasto medido limita as três rotas e não é ignorado nos testes de 15 UA', () => {
  const forage = {
    ...input.forage,
    pastureYieldDmTonnesHa: 30,
    grazingEfficiencyPercent: 50,
    intakePercent: 2.5,
  };
  const study = stockingStudy({ ...input, forage });
  assert.ok(study.every((r) => r.applied < 4 && r.known && r.limited));
});
test('Custo adicional do pasto chega à margem de todas as rotas', () => {
  const x = patch({ pastureExtraCostHa: 1000 });
  for (const [id, delta] of [
    ['cattle-a', 300000],
    ['cattle-b', 400000],
    ['cattle-c', 400000],
  ]) {
    const first = enterpriseAtArea(input, id, 400),
      next = enterpriseAtArea(x, id, 400);
    close(first.margin - next.margin, delta);
    assert.ok(next.capital > first.capital);
  }
});
test('Alavancas são recálculos independentes, com contrapartida de capital', () => {
  const r = marginLevers(input, 'cattle-a');
  for (const row of r.rows) close(row.delta, row.result.margin - r.base.margin);
  const corn = r.rows.find((r) => r.label.startsWith('Milho entregue'));
  close(
    corn.result.margin,
    calculateCore({ ...input.a, dietPriceDm: diet(65 * 0.95) }).ebitdaA,
  );
  assert.ok(corn.extraCapital < 0);
});
test('Modo manual testa preço de dieta e não finge vínculo com milho', () => {
  const r = marginLevers(patch({ linkFeedToCropCosts: false }), 'cattle-a');
  assert.ok(r.rows.some((r) => r.label.startsWith('Dieta manual')));
  assert.ok(!r.rows.some((r) => r.label.startsWith('Milho entregue')));
});
test('Reproduz imagem 220 ha / 10 UA e redistribuição melhora A sem impor vitória', () => {
  const x = { ...patch({ totalArea: 220, stockingUa: 10 }), desiredUa: 10 };
  const c = calculateCore(x.a);
  close(c.ebitdaA, 3947738.58, 0.01);
  close(enterpriseAtArea(x, 'cattle-c', 220).margin, 7046205.83, 0.01);
  const r = feedlotTurningPoints(x);
  close(r.silageShare, 30.1);
  close(r.balanced.margin, 5184941.13, 0.01);
  const vsC = r.comparisons.find((r) => r.id === 'cattle-c');
  close(vsC.price, 371.2746, 0.001);
  assert.ok(vsC.difference < 0);
  const breakeven = calculateCore({
    ...x.a,
    silageShare: r.silageShare,
    priceArroba: vsC.price,
  });
  close(breakeven.ebitdaA, vsC.alternative.margin);
});
test('Hipótese de GMD1,84 e milho55 supera C por pouco, sem esconder capital', () => {
  const x = {
    ...patch({
      totalArea: 220,
      stockingUa: 10,
      gmdFeedlot: 1.84,
      dietPriceDm: diet(55),
    }),
    cornDelivered: 55,
    desiredUa: 10,
  };
  const r = feedlotTurningPoints(x);
  close(r.silageShare, 25.8);
  close(r.balanced.margin, 7408581.78, 0.01);
  close(
    r.comparisons.find((r) => r.id === 'cattle-c').difference,
    362375.96,
    0.02,
  );
  assert.ok(r.balanced.capital > 27e6);
});
test('Pesos inválidos não geram estudos financiáveis', () => {
  const x = patch({ entryWeight: 540, pivotExitWeight: 400, saleWeight: 540 });
  for (const id of ['cattle-a', 'cattle-b', 'cattle-c'])
    assert.equal(affordableEnterprise(x, id).maximumArea, 0);
});
test('Importação anterior usa adicional zero, sem herdar custo da tela atual', () => {
  const { pastureExtraCostHa: removed, ...legacy } = input.a;
  assert.equal(removed, 0);
  const template = { assumptions: { ...input.a, pastureExtraCostHa: 1234 } };
  close(
    validateScenario(
      { schema: 1, model: '2026-09-07.3', data: { assumptions: legacy } },
      template,
    ).assumptions.pastureExtraCostHa,
    0,
  );
  close(
    validateScenario(
      {
        schema: 1,
        model: '2026-09-07.4',
        data: { assumptions: { ...legacy, pastureExtraCostHa: 987 } },
      },
      template,
    ).assumptions.pastureExtraCostHa,
    987,
  );
  assert.throws(() =>
    validateScenario(
      {
        schema: 1,
        data: { assumptions: { ...legacy, pastureExtraCostHa: -1 } },
      },
      template,
    ),
  );
});
test('Duas safras que exigem mais de um ano não viram margem anual equivalente', () => {
  const x = {
    ...input,
    doubleWindow: { ...input.doubleWindow, cornHarvest: '2027-11-01' },
  };
  assert.equal(enterpriseAtArea(x, 'double-crop', 400).valid, false);
});
console.log(`decision-lab: ${count} testes aprovados.`);
