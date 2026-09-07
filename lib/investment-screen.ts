import { calculateCore, type Assumptions } from './livestock-model.ts';

/** Varredura física, não extrapolação de R$/ha: cocho e CAPEX permanecem fixos. */
export function areaResponse(a: Assumptions) {
  const current = calculateCore(a);
  if (!current.routeAInputValid || !current.routeBInputValid) return [];
  const baseArea = Math.max(1, a.totalArea);
  return [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((factor) => {
    const area = baseArea * factor;
    const r = calculateCore({ ...a, totalArea: area });
    return {
      area,
      marginA: r.ebitdaA,
      marginB: r.ebitdaB,
      delta: r.ebitdaA - r.ebitdaB,
      npv: r.operationalNpv,
      soldA: r.soldA,
      bottleneck: r.bindingConstraintA,
    };
  });
}
