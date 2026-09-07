export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

type ForageInputs = {
  pastureYieldDmTonnesHa: number;
  grazingEfficiencyPercent: number;
  intakePercent: number;
  monthlyForageShares: number[];
};

/** Programa anual contínuo, 365 dias, UA de 450 kg. Sem transportar sobras
 * entre meses: conservação/estoques requerem outro balanço explícito. */
export function pastureCapacity(desiredUa: number, input: ForageInputs) {
  const validShares = input.monthlyForageShares.length === 12 &&
    input.monthlyForageShares.every(v => Number.isFinite(v) && v >= 0) &&
    Math.abs(input.monthlyForageShares.reduce((sum, v) => sum + v, 0) - 100) < 0.1;
  const annualKnown = input.pastureYieldDmTonnesHa > 0 &&
    input.grazingEfficiencyPercent > 0 && input.grazingEfficiencyPercent <= 100 &&
    input.intakePercent > 0 && input.intakePercent <= 10;
  const known = annualKnown && validShares;
  const usableKgHa = input.pastureYieldDmTonnesHa * 1000 * input.grazingEfficiencyPercent / 100;
  const kgUaDay = 450 * input.intakePercent / 100;
  const annualUa = annualKnown ? usableKgHa / (kgUaDay * 365) : null;
  const monthlyUa = known ? input.monthlyForageShares.map((share, month) =>
    usableKgHa * share / 100 / (kgUaDay * MONTH_DAYS[month])) : [];
  const supportUa = annualUa === null ? null : Math.min(annualUa, ...monthlyUa);
  const effectiveUa = Math.max(0, supportUa === null ? desiredUa : Math.min(desiredUa, supportUa));
  return { known, annualKnown, validShares, desiredUa, effectiveUa, annualUa, supportUa, monthlyUa,
    limited: supportUa !== null && effectiveUa < desiredUa - 1e-9,
    limitingMonth: monthlyUa.length ? monthlyUa.indexOf(Math.min(...monthlyUa)) + 1 : null };
}
