import { calculateCore, type Assumptions } from './livestock-model.ts';
import { cattleStartupCash, cattleCapitalRequirement } from './decision-review.ts';
import { withoutOpportunityCows } from './photo-reference.ts';

export const equalCostMethod = 'Referência = custo caixa anual de B na área atual. Busca a área de A que iguala esse custo, mantendo preços, GMD, UA/ha de pasto, proporção de silagem e vagas de cocho. A busca para quando o cocho satura: não amplia área ociosa só para gastar o orçamento. São projetos alternativos com áreas próprias, não um mix da mesma fazenda; não custeia área remanescente. Não amplia vagas, compra terra ou orça pivôs automaticamente. Margem anual de regime pleno; CAPEX, implantação, juros e reserva extra não entram no custeio.';
export type EqualCostRow = {
  route: 'A' | 'B'; area: number; pasture: number; silage: number;
  cost: number; revenue: number; margin: number; sold: number; days: number;
  operatingReserve: number | null; extraArea: number; feedlotOccupancy: number;
  costGap: number; bottleneck: string;
};

/** Inversa de custo, não extrapolação de margem/ha: o cocho permanece limitado.
 * Busca monotônica nos custos não negativos até 1 milhão de ha; centavos de tolerância.
 * Não altera a área ou o orçamento do cenário do usuário. */
export function equalCattleCost(input: Assumptions, anchor = '2026-09-10') {
  // Crédito medido não é transferível automaticamente para uma área redimensionada.
  const a = { ...withoutOpportunityCows(input), includeEffluentSavings: false }, base = calculateCore(a);
  const target = base.cashCostsB;
  const rows: EqualCostRow[] = [];
  const outcome = (error: string | null) => ({ target, referenceArea: a.totalArea,
    feedlotCapacity: a.feedlotCapacity, feedlotUtilization: a.feedlotUtilization ?? 100,
    rows, error, method: equalCostMethod });
  const invalidNumber = Object.values(a).some(v => typeof v === 'number' && (!Number.isFinite(v) || v < 0));
  if (invalidNumber) return outcome('Use premissas numéricas finitas e não negativas para comparar custos.');
  if ([a.silageShare, a.forageShare, a.silageRecovery, a.carcassYieldPercent,
    a.saleDeductionPercent, a.pastureMortalityPercent ?? 0, a.feedlotMortalityPercent ?? 0,
    a.feedlotUtilization ?? 100].some(v => v > 100)) return outcome('Percentuais físicos devem estar entre 0% e 100%.');
  if (!(a.totalArea > 0 && a.totalArea <= 1000000 && base.routeBInputValid && base.soldB > 0 && target > 0 && Number.isFinite(target)))
    return outcome('Confira área, lotação, pesos, GMD e custos de B para definir o custeio de referência.');
  const row = (route: 'A' | 'B', area: number): EqualCostRow => {
    const scaled = { ...a, totalArea: area }, c = calculateCore(scaled), isA = route === 'A';
    const cost = isA ? c.cashCostsA : c.cashCostsB, revenue = isA ? c.netRevenueA : c.netRevenueB;
    const operating = { ...scaled, pivotInvestment: 0, investment: 0 };
    const cash = cattleStartupCash(operating, route, anchor);
    return { route, area, pasture: isA ? c.pastureAreaA : area, silage: isA ? c.silageArea : 0,
      cost, revenue, margin: revenue - cost, sold: isA ? c.soldA : c.soldB,
      days: isA ? c.daysPivotA + c.daysFeedlot : c.daysB,
      operatingReserve: cash ? cattleCapitalRequirement(operating, route, cash.peakFundingNeed).required : null,
      extraArea: Math.max(0, area - a.totalArea), feedlotOccupancy: isA ? c.confinementOccupancy : 0,
      costGap: cost - target, bottleneck: isA ? c.bindingConstraintA : 'pasto / desempenho' };
  };
  rows.push(row('B', a.totalArea));
  if (!base.routeAInputValid || !(base.soldA > 0)) return outcome('A não tem fluxo de bois: confira pesos, ganhos, pasto, silagem e cocho. Não há equivalência produtiva válida.');
  if (!Number.isFinite(a.feedlotCapacity) || !(a.feedlotCapacity! > 0)) return outcome('Informe as vagas de confinamento para comparar A sem presumir capacidade ilimitada.');
  const costAt = (area: number) => calculateCore({ ...a, totalArea: area }).cashCostsA;
  const productiveLimit = a.totalArea * base.feedlotPotentialA / Math.min(base.pasturePotentialA, base.silagePotentialA);
  let low = 0, high = Math.min(1000000, productiveLimit);
  if (!Number.isFinite(high) || high <= 0 || !Number.isFinite(costAt(high))) return outcome('Não foi possível calcular a área produtiva dentro dos limites de pasto, silagem e cocho.');
  if (costAt(high) < target - 0.01) {
    rows.push({ ...row('A', high), bottleneck: productiveLimit <= 1000000 ? 'vagas-dia de cocho' : 'limite de busca' });
    return outcome(productiveLimit <= 1000000
      ? 'O cocho atual limita A antes de igualar o custeio. Mostramos a área até sua saturação e o valor não utilizado; expandir área sem aumentar vendas não melhora a operação. Para outra escala, informe novas vagas e o respectivo investimento.'
      : 'A equivalência excede o limite matemático de 1 milhão de hectares. Mostramos apenas a escala calculada dentro do limite.');
  }
  for (let i = 0; i < 80; i++) {
    const middle = (low + high) / 2;
    if (costAt(middle) < target) low = middle; else high = middle;
  }
  const matched = row('A', (low + high) / 2);
  if (Math.abs(matched.costGap) > 0.01 || !Object.values(matched).every(v => typeof v !== 'number' || Number.isFinite(v)))
    return outcome('A equivalência não fechou com precisão de centavos. Confira as premissas antes de comparar.');
  rows.push(matched);
  return outcome(null);
}
export type EqualCostStudy = ReturnType<typeof equalCattleCost>;
