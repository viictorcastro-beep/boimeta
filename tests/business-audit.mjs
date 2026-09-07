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
import { rankWithinBudget, cattleCapitalRequirement, cattleStartupCash, pastureRequirements, reviewDefaults } from '../lib/decision-review.ts';
import { pastureCapacity, MONTH_DAYS } from '../lib/pasture-capacity.ts';
import { allocateStrategy } from '../lib/strategy-model.ts';
import { capacityActions } from '../lib/capacity-actions.ts';
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
const forage = { ...reviewDefaults, pastureYieldDmTonnesHa: 20, grazingEfficiencyPercent: 60,
  monthlyForageShares: MONTH_DAYS.map(d => d / 365 * 100) };
test('forragem ausente não é zero nem capacidade comprovada', () => {
  const r = pastureCapacity(7.8, reviewDefaults);
  assert.equal(r.known, false); close(r.effectiveUa, 7.8);
});
test('forragem medida limita lotação anual e mensal sem criar animais', () => {
  const r = pastureCapacity(7.8, forage);
  close(r.supportUa, 12000 / (450 * .025 * 365), 1e-9);
  assert.ok(r.limited);
  close(pastureCapacity(1, forage).effectiveUa, 1);
});
test('mês sem oferta impede fluxo contínuo sem reserva explícita', () => {
  const r = pastureCapacity(7.8, { ...forage, monthlyForageShares: [0, ...Array(11).fill(100/11)] });
  close(r.effectiveUa, 0); assert.equal(r.limitingMonth, 1);
});
test('distribuição mensal inválida não recebe selo local', () => {
  const r = pastureCapacity(7.8, { ...forage, monthlyForageShares: Array(12).fill(10) });
  assert.equal(r.known, false);
  assert.ok(r.annualKnown && r.effectiveUa < 7.8);
});
test('cocho limitado reduz demanda real de pasto sem apagar seu custo', () => {
  const small = { ...a, feedlotCapacity: 100 };
  const r = calculateCore(small), p = pastureRequirements(small, forage);
  close(p.annualDemand, r.entrantsA * r.daysPivotA * ((a.entryWeight + a.pivotExitWeight)/2) * .025);
  assert.ok(p.annualDemand < pastureRequirements(a, forage).annualDemand);
  close(r.annualPastureOperatingA, calculateCore(a).annualPastureOperatingA);
});
test('limite de MS limita A/B/C e preserva orçamento do hectare', () => {
  const bounded = { ...a, stockingUa: pastureCapacity(a.stockingUa, forage).effectiveUa };
  assert.ok(calculateCore(bounded).soldA < calculateCore(a).soldA);
  assert.ok(calculateCore(bounded).soldB < calculateCore(a).soldB);
  assert.ok(rearingOnly(bounded, 12).sold < rearingOnly(a, 12).sold);
  close(rearingOnly(bounded, 12).pastureCost, rearingOnly(a, 12).pastureCost);
});
test('mortalidade é fechada por fase sem mortos consumindo cocho', () => {
  const r = calculateCore({ ...a, pastureMortalityPercent: 10, feedlotMortalityPercent: 5 });
  close(r.feedlotEntriesA, r.entrantsA * .9);
  close(r.soldA, r.entrantsA * .9 * .95);
  close(r.soldB, r.entrantsB * .9);
  close(r.silageConsumedDm, r.feedlotEntriesA * r.forageDmHead);
  close(r.confinementOccupancy, r.feedlotEntriesA * r.daysFeedlot / 365);
  close(r.cashCostsA, r.netRevenueA - r.ebitdaA);
});
test('alterar mortalidade do cocho não altera B/C', () => {
  const high = { ...a, feedlotMortalityPercent: 10 };
  close(calculateCore(high).ebitdaB, calculateCore(a).ebitdaB);
  close(rearingOnly(high, 12).margin, rearingOnly(a, 12).margin);
  assert.ok(calculateCore(high).ebitdaA < calculateCore(a).ebitdaA);
});
test('100% de perdas no pasto mantém compras e prejuízo, sem dieta de cocho', () => {
  const m = { ...a, includeCows: false, pastureMortalityPercent: 100 };
  const r = calculateCore(m);
  assert.ok(r.entrantsA > 0); close(r.soldA, 0); close(r.soldB, 0); close(r.feedlotEntriesA, 0);
  assert.ok(r.ebitdaA < 0 && r.ebitdaB < 0);
  assert.ok(Number.isFinite(r.cashCostsA) && Number.isFinite(r.operationalNpv));
  assert.ok(rearingOnly(m, 12).margin < 0);
  assert.ok(cattleStartupCash(m, 'A', '2026-09-10').peakFundingNeed > 0);
});
test('100% de perdas no cocho mantém vagas, alimentação e custo', () => {
  const r = calculateCore({ ...a, includeCows: false, feedlotMortalityPercent: 100 });
  close(r.soldA, 0); assert.ok(r.feedlotEntriesA > 0 && r.silageConsumedDm > 0 && r.ebitdaA < 0);
  assert.ok(capacityActions({ ...a, feedlotMortalityPercent: 100 }, 65).unusedFlowArea < a.totalArea);
});
test('A/B reservam ciclo completo mesmo com entrada tardia', () => {
  for (const route of ['A','B']) {
    const m = { ...a, includeCows: false, totalArea: 400, investment: 0, pivotInvestment: 0 };
    const floor = cattleCapitalRequirement(m, route).fullCycleReserve;
    const immediate = cattleCapitalRequirement(m, route, cattleStartupCash(m, route, '2026-09-10').peakFundingNeed).required;
    for (const delay of [0,200,350]) {
      const cash = cattleStartupCash(m, route, '2026-09-10', delay);
      assert.ok(cattleCapitalRequirement(m, route, cash.peakFundingNeed).required >= floor);
      assert.ok(cattleCapitalRequirement(m, route, cash.peakFundingNeed).required >= immediate - 1e-6);
    }
    assert.ok(floor > 12000000);
  }
});
test('piso de ciclo não altera margem e contabiliza CAPEX só uma vez', () => {
  const floor = cattleCapitalRequirement(a, 'A').required;
  close(cattleCapitalRequirement({ ...a, pivotInvestment: a.pivotInvestment + 1e6 }, 'A').required, floor + 1e6);
  const slow = { ...a, gmdB: .3 };
  assert.ok(cattleCapitalRequirement(slow, 'B').required > cattleCapitalRequirement(a, 'B').required);
});
test('esteira A reserva recompra enquanto primeiro lote está no cocho', () => {
  for (const gmd of [1.48, .4]) {
    const m = { ...defaultAssumptions, gmdFeedlot: gmd, includeCows: false, investment: 0, pivotInvestment: 0 };
    const immediate = cattleCapitalRequirement(m, 'A', cattleStartupCash(m, 'A', '2026-09-10').peakFundingNeed).required;
    const delayed = cattleCapitalRequirement(m, 'A', cattleStartupCash(m, 'A', '2026-09-10',350).peakFundingNeed).required;
    close(delayed, immediate, .01);
  }
});
test('candidatos magros não dependem de perdas futuras no cocho', () => {
  close(calculateCore({ ...a, feedlotMortalityPercent: 10 }).pastureCandidatesA, calculateCore(a).pastureCandidatesA);
  close(calculateCore(a).pastureCandidatesA, calculateCore(a).pastureEntryCapacityA * calculateCore(a).pastureSurvival);
});
test('mix de recria longa não gasta R$8,78mi sob limite de R$6mi', () => {
  const m = { ...defaultAssumptions, totalArea: 1, includeCows: false, investment: 0, pivotInvestment: 0, gmdPivotA: .3 };
  const c = rearingOnly(m, 14);
  assert.ok(c.days > 365 && c.operatingCycleReserve > c.costs);
  const mix = allocateStrategy({ totalArea: 400, capitalLimit: 6e6, maxSharePercent: 100, criterion: 'defensive',
    activities: [{ id: 'cattle-c', label: 'C', margins: { low: c.margin, base: c.margin, high: c.margin }, cashCostHa: Math.max(c.costs, c.operatingCycleReserve) }] });
  assert.ok(mix.rows[0].area * c.operatingCycleReserve <= 6e6 + .01);
  close(mix.rows[0].area, 6e6 / c.operatingCycleReserve, .01);
});
console.log('business-audit: ' + count + ' testes aprovados');
