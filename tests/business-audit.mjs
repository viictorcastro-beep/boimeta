import assert from 'node:assert/strict';
import {
  rearingOnly,
  rearingStartupCash,
  rearingCapitalRequirement,
  stressRearing,
} from '../lib/rearing-model.ts';
import { parseIbgeNews } from '../lib/market-news.ts';
import {
  formatNumberBr,
  parseNumberBr,
  boundedNumber,
} from '../lib/number-format.ts';
import { areaResponse } from '../lib/investment-screen.ts';
import { calculateCore, defaultAssumptions } from '../lib/livestock-model.ts';
import { rankWithinBudget } from '../lib/decision-review.ts';
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log('ok ' + name);
};
const close = (a, b, tolerance = 1) =>
  assert.ok(Math.abs(a - b) <= tolerance, a + ' ≠ ' + b);
const a = {
  ...defaultAssumptions,
  totalArea: 550,
  pivotExitWeight: 399.999,
  feedlotCapacity: 2000,
  feedlotUtilization: 90,
};
test('C reproduz memória de custos pré-gate', () => {
  const c = rearingOnly(a, 12.5);
  assert.equal(c.days, 178);
  close(c.sold, 12345.932826, 0.001);
  close(c.revenue, 61729509.81);
  close(c.costs, 49217021.11);
  close(c.margin, 12512488.7);
  close(c.pastureCost, 5580057.54);
  close(c.breakEvenPriceKg, 9.96626679, 1e-6);
});
test('cocho/dieta/culturas/vacas não alteram recria C', () => {
  const c = rearingOnly(a, 12.5);
  assert.deepEqual(
    rearingOnly(
      {
        ...a,
        feedlotCapacity: 0,
        silageShare: 99,
        dietPriceDm: 8,
        includeCows: false,
        cowSaleArroba: 999,
        investment: 50000000,
        gmdFeedlot: 0,
        forageShare: 0,
        includeEffluentSavings: true,
      },
      12.5,
    ),
    c,
  );
});
test('C não depende do rendimento de carcaça/arroba de gordo', () => {
  assert.deepEqual(
    rearingOnly({ ...a, carcassYieldPercent: 1, priceArroba: 999 }, 12.5),
    rearingOnly(a, 12.5),
  );
});
test('equilíbrio líquido zera margem', () => {
  const c = rearingOnly(a, 12.5);
  close(rearingOnly(a, c.breakEvenPriceKg).margin, 0);
});
test('preço zero preserva prejuízo', () => {
  const c = rearingOnly(a, 0);
  assert.equal(c.valid, true);
  assert.equal(c.revenue, 0);
  assert.ok(c.margin < 0);
});
test('preço ausente e GMD inválido não fabricam vendas', () => {
  assert.equal(rearingOnly(a, NaN).valid, false);
  assert.equal(rearingOnly({ ...a, gmdPivotA: 0 }, 12.5).sold, 0);
  assert.equal(rearingOnly({ ...a, pivotExitWeight: 200 }, 12.5).valid, false);
});
test('dobro de área dobra operação mas não CAPEX', () => {
  const c = rearingOnly(a, 12.5),
    d = rearingOnly({ ...a, totalArea: 1100 }, 12.5);
  close(d.sold, 2 * c.sold);
  close(d.costs, 2 * c.costs);
  close(d.margin, 2 * c.margin);
});
test('pico e saldo ano 1 não confundidos com margem', () => {
  const cash = rearingStartupCash(a, 12.5, '2026-09-10');
  close(cash.peakFundingNeed, 26411847.06);
  close(cash.netCash, -17022961.82);
  close(cash.closingHeads, 6032.821926, 0.001);
  close(cash.salesHeads, 6325.176544, 0.001);
  assert.equal(cash.firstSaleDate, '2027-03-07');
});
test('balanço comprado = vendido + morto + estoque', () => {
  const cash = rearingStartupCash(a, 12.5, '2026-09-10');
  close(
    cash.boughtHeads,
    cash.salesHeads + cash.deaths + cash.closingHeads,
    1e-7,
  );
  assert.ok(cash.deaths > 0);
});
test('pagamentos não são financiados por vendas posteriores do mesmo dia', () => {
  const cash = rearingStartupCash(a, 12.5, '2026-09-10');
  assert.ok(cash.events.every((e) => e.inflow === 0 || e.outflow === 0));
  const sale = cash.events.findIndex((e) => e.inflow > 0);
  assert.ok(cash.events[sale - 1].outflow > 0);
  assert.equal(cash.events[sale - 1].date, cash.events[sale].date);
});
test('mortalidade custa compra e alimento por entrante', () => {
  const c = rearingOnly(a, 12.5);
  close(c.sold, c.entrants * 0.998, 1e-7);
  close(
    c.costs,
    c.entrants * c.preGateVariableHead + c.pastureCost + c.lease,
    1e-7,
  );
});
test('venda posterior ao ano não gera caixa', () => {
  const cash = rearingStartupCash(a, 12.5, '2026-09-10', 200);
  assert.equal(cash.salesHeads, 0);
  assert.ok(cash.events.every((event) => event.inflow === 0));
});
test('CAPEX comum não é duplicado nem inclui cocho de A', () => {
  const base = rearingStartupCash(a, 12.5, '2026-09-10');
  const changed = rearingStartupCash(
    { ...a, pivotInvestment: 1000000, investment: 50000000 },
    12.5,
    '2026-09-10',
    0,
    250000,
  );
  close(changed.peakFundingNeed - base.peakFundingNeed, 1250000);
});
test('R$6mi não financiam C550ha só porque tem alta margem', () => {
  const c = rearingOnly(a, 12.5),
    cash = rearingStartupCash(a, 12.5, '2026-09-10');
  const rank = rankWithinBudget(
    [
      {
        marginHa: c.marginHa,
        capitalRequired: cash.peakFundingNeed,
        rankable: c.valid,
      },
    ],
    6000000,
    0,
  );
  assert.equal(rank.feasible.length, 0);
});
test('data inexistente é rejeitada', () =>
  assert.equal(rearingStartupCash(a, 12.5, '2026-02-30'), null));
test('capacidade fixa pode inverter A−B conforme área', () => {
  const source = {
    ...defaultAssumptions,
    totalArea: 400,
    feedlotCapacity: 2000,
    feedlotUtilization: 90,
    includeCows: false,
    includeEffluentSavings: false,
  };
  const rows = areaResponse(source);
  assert.ok(rows.find((r) => r.area === 400).delta > 0);
  assert.ok(rows.find((r) => r.area === 600).delta < 0);
  assert.ok(rows.find((r) => r.area === 800).delta < 0);
});
test('CAPEX altera VPL, não a margem operacional', () => {
  const low = calculateCore({
    ...defaultAssumptions,
    includeCows: false,
    investment: 1000000,
    discountRate: 30,
  });
  const high = calculateCore({
    ...defaultAssumptions,
    includeCows: false,
    investment: 50000000,
    discountRate: 30,
  });
  close(low.ebitdaA, high.ebitdaA);
  close(low.operationalNpv - high.operationalNpv, 49000000);
  assert.ok(high.operationalNpv < 0);
});
test('setor de exportação não cria receita ou prêmio na entrada do modelo', () => {
  assert.equal('exportPremium' in rearingOnly(a, 12.5), false);
  close(
    calculateCore(a).netSaleA,
    calculateCore({ ...a, exportFocus: true }).netSaleA,
    1e-7,
  );
});
test('capital C não desaparece ao adiar compra para depois do primeiro ano', () => {
  const today = rearingStartupCash(a, 12.5, '2026-09-10');
  const later = rearingStartupCash(a, 12.5, '2026-09-10', 250);
  const first = rearingCapitalRequirement(a, 12.5, today.peakFundingNeed);
  const delayed = rearingCapitalRequirement(a, 12.5, later.peakFundingNeed);
  close(first.required, delayed.required, 0.01);
  assert.ok(delayed.required > 26400000);
  assert.equal(later.salesHeads, 0);
});
test('capital C reserva custeio de ciclo superior a 365 dias', () => {
  const slow = { ...a, gmdPivotA: 0.2 };
  const c = rearingOnly(slow, 12.5);
  const capital = rearingCapitalRequirement(slow, 12.5, 0, 100000, 500000);
  close(
    capital.required,
    c.simultaneousHeads * c.preGateVariableHead +
      ((c.pastureCost + c.lease) * c.days) / 365 +
      slow.pivotInvestment +
      600000,
    0.01,
  );
});
test('C recebe stress adverso e favorável sem ficar imune', () => {
  const low = stressRearing(a, 12.5, {
    productivity: 0.9,
    cost: 1.1,
    replacement: 1.05,
    price: 0.9,
  });
  const high = stressRearing(a, 12.5, {
    productivity: 1.05,
    cost: 0.97,
    replacement: 1.08,
    price: 1.1,
  });
  close(low.marginHa, 2622.05);
  close(high.marginHa, 32492.73);
  assert.ok(low.marginHa < rearingOnly(a, 12.5).marginHa);
  assert.ok(high.marginHa > rearingOnly(a, 12.5).marginHa);
});
test('pesos inválidos não geram tabela de parecer de investimento', () => {
  assert.deepEqual(
    areaResponse({
      ...a,
      entryWeight: 540,
      pivotExitWeight: 400,
      saleWeight: 540,
    }),
    [],
  );
});
const item = {
  id: 123,
  titulo: 'Abate e produção',
  link: 'http://agenciadenoticias.ibge.gov.br/release.html',
  data_publicacao: '19/08/2026 09:00:00',
};
test('notícia oficial normaliza data e melhora HTTP para HTTPS', () => {
  const [news] = parseIbgeNews({ items: [item] }, 'abate', '2026-09-06');
  assert.equal(news.sourceDate, '2026-08-19');
  assert.equal(news.url, 'https://agenciadenoticias.ibge.gov.br/release.html');
});
test('notícias rejeitam datas falsas, futuras e identificadores ausentes', () => {
  for (const change of [
    { data_publicacao: '31/02/2026' },
    { data_publicacao: '19/08/2027' },
    { id: undefined },
    { titulo: '' },
  ]) {
    assert.deepEqual(
      parseIbgeNews({ items: [{ ...item, ...change }] }, 'safra', '2026-09-06'),
      [],
    );
  }
});
test('notícias não aceitam domínio parecido, credenciais ou javascript', () => {
  for (const link of [
    'https://agenciadenoticias.ibge.gov.br.evil.org/',
    'https://evil.org/',
    'https://user@agenciadenoticias.ibge.gov.br/',
    'javascript:alert(1)',
  ]) {
    assert.deepEqual(
      parseIbgeNews({ items: [{ ...item, link }] }, 'abate', '2026-09-06'),
      [],
    );
  }
});
test('30 milhões e decimais ficam legíveis em pt-BR', () => {
  assert.equal(formatNumberBr(30000000), '30.000.000');
  assert.equal(formatNumberBr(1.12), '1,12');
  assert.equal(formatNumberBr(-1234.56), '-1.234,56');
});
test('colar reais, pontos de milhar e vírgula não muda ordem de grandeza', () => {
  for (const [text, value] of [
    ['30.000.000', 30000000],
    ['30000000', 30000000],
    ['R$ 1.234,56', 1234.56],
    ['−1.234,56', -1234.56],
    ['1.12', 1.12],
    ['0,78', 0.78],
    ['349,', 349],
  ]) {
    assert.equal(parseNumberBr(text), value);
  }
});
test('entradas vazias ou inválidas não viram zero silencioso', () => {
  for (const text of [
    '',
    '-',
    'abc',
    'Infinity',
    'NaN',
    '30,000,000',
    '2..3',
    '1e9',
  ])
    assert.equal(parseNumberBr(text), null);
  assert.equal(boundedNumber(-10, 0, 100), 0);
  assert.equal(boundedNumber(200, 0, 100), 100);
});
console.log('business-audit: ' + count + ' testes aprovados');
