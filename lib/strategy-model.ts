import { solvePackingLp } from './allocation-model.ts';
export type DecisionCriterion = 'base' | 'defensive' | 'balanced';

export type ScenarioMargins = {
  low: number;
  base: number;
  high: number;
};

export type StrategyActivity = {
  id: string;
  label: string;
  margins: ScenarioMargins;
  cashCostHa: number;
  maxAreaHa?: number;
};

export type StrategyAllocationInput = {
  activities: StrategyActivity[];
  totalArea: number;
  capitalLimit: number;
  maxSharePercent: number;
  criterion: DecisionCriterion;
  idleMargins?: ScenarioMargins;
  idleCashCostHa?: number;
};

export type StrategyAllocationRow = StrategyActivity & {
  scoreHa: number;
  area: number;
  share: number;
  cashUsed: number;
  marginsAnnual: ScenarioMargins;
};

const EPSILON = 1e-7;

export function criterionMargin(
  margins: ScenarioMargins,
  criterion: DecisionCriterion,
) {
  if (criterion === 'base') return margins.base;
  if (criterion === 'defensive') {
    return Math.min(margins.low, margins.base, margins.high);
  }
  // Pesos de decisão declarados; não representam probabilidades de mercado.
  return margins.low * 0.25 + margins.base * 0.5 + margins.high * 0.25;
}

function isFeasible(
  values: number[],
  caps: number[],
  costs: number[],
  areaLimit: number,
  capitalLimit: number,
) {
  if (
    values.some(
      (value, index) =>
        !Number.isFinite(value) ||
        value < -EPSILON ||
        value > caps[index] + EPSILON,
    )
  ) {
    return false;
  }
  const area = values.reduce((sum, value) => sum + Math.max(0, value), 0);
  const cash = values.reduce(
    (sum, value, index) => sum + Math.max(0, value) * costs[index],
    0,
  );
  return area <= areaLimit + EPSILON && cash <= capitalLimit + 0.01;
}

export function allocateStrategy(input: StrategyAllocationInput) {
  const totalArea = Math.max(0, input.totalArea);
  const capitalLimit = Math.max(0, input.capitalLimit);
  const maxShare = Math.min(1, Math.max(0, input.maxSharePercent / 100));
  const idleCashCostHa = Math.max(0, input.idleCashCostHa ?? 0);
  const activities = input.activities.filter(
    (activity) =>
      Number.isFinite(activity.cashCostHa) &&
      activity.cashCostHa >= 0 &&
      Object.values(activity.margins).every(Number.isFinite),
  );
  const count = activities.length;
  const caps = activities.map((activity) => Math.max(0, Math.min(totalArea * maxShare, activity.maxAreaHa ?? totalArea)));
  const rawCosts = activities.map((activity) => activity.cashCostHa);
  const costs = rawCosts.map((cost) => Math.max(0, cost - idleCashCostHa));
  const capitalForActivities =
    capitalLimit - totalArea * idleCashCostHa;
  const scores = activities.map((activity) =>
    criterionMargin(activity.margins, input.criterion),
  );
  const idleMargins = input.idleMargins ?? { low: 0, base: 0, high: 0 };
  const idleScore = criterionMargin(idleMargins, input.criterion);

  let bestValues = Array.from({ length: count }, () => 0);
  let bestObjective = totalArea * idleScore;
  let bestBase = totalArea * idleMargins.base;

  const evaluate = (candidate: number[]) => {
    const values = candidate.map((value) => Math.max(0, value));
    if (!isFeasible(values, caps, costs, totalArea, capitalForActivities)) return;
    const allocatedArea = values.reduce((sum, value) => sum + value, 0);
    const idleArea = Math.max(0, totalArea - allocatedArea);
    const objective = values.reduce(
      (sum, value, index) => sum + value * scores[index],
      idleArea * idleScore,
    );
    const base = values.reduce(
      (sum, value, index) => sum + value * activities[index].margins.base,
      idleArea * idleMargins.base,
    );
    if (
      objective > bestObjective + EPSILON ||
      (Math.abs(objective - bestObjective) <= EPSILON && base > bestBase)
    ) {
      bestObjective = objective;
      bestBase = base;
      bestValues = values;
    }
  };

  const enumerateFixed = (free: number[]) => {
    const freeSet = new Set(free);
    const fixed = Array.from({ length: count }, (_, index) => index).filter(
      (index) => !freeSet.has(index),
    );
    const combinations = 1 << fixed.length;

    for (let mask = 0; mask < combinations; mask += 1) {
      const candidate = Array.from({ length: count }, () => 0);
      fixed.forEach((index, position) => {
        candidate[index] = mask & (1 << position) ? caps[index] : 0;
      });
      const fixedArea = candidate.reduce((sum, value) => sum + value, 0);
      const fixedCash = candidate.reduce(
        (sum, value, index) => sum + value * costs[index],
        0,
      );
      if (
        fixedArea > totalArea + EPSILON ||
        fixedCash > capitalForActivities + 0.01
      ) {
        continue;
      }

      if (free.length === 0) {
        evaluate(candidate);
        continue;
      }

      if (free.length === 1) {
        const index = free[0];
        const byArea = totalArea - fixedArea;
        const byCash =
          costs[index] > EPSILON
            ? (capitalForActivities - fixedCash) / costs[index]
            : caps[index];
        for (const value of [0, caps[index], byArea, byCash]) {
          const next = [...candidate];
          next[index] = value;
          evaluate(next);
        }
        continue;
      }

      const [left, right] = free;
      const areaRemaining = totalArea - fixedArea;
      const cashRemaining = capitalForActivities - fixedCash;
      const denominator = costs[left] - costs[right];
      if (Math.abs(denominator) > EPSILON) {
        const leftValue =
          (cashRemaining - costs[right] * areaRemaining) / denominator;
        const rightValue = areaRemaining - leftValue;
        const next = [...candidate];
        next[left] = leftValue;
        next[right] = rightValue;
        evaluate(next);
      }
    }
  };

  enumerateFixed([]);
  for (let index = 0; index < count; index += 1) {
    enumerateFixed([index]);
  }
  for (let left = 0; left < count; left += 1) {
    for (let right = left + 1; right < count; right += 1) {
      enumerateFixed([left, right]);
    }
  }

  if (input.criterion === 'defensive' && capitalForActivities >= 0 && count > 0) {
    const bands = ['low', 'base', 'high'] as const;
    const floor = totalArea * Math.min(0, ...bands.map((b) => idleMargins[b]),
      ...activities.flatMap((a) => bands.map((b) => a.margins[b])));
    const solution = solvePackingLp([...activities.map(() => 0), 1], [
      { coefficients: [...activities.map(() => 1), 0], limit: totalArea },
      { coefficients: [...costs, 0], limit: capitalForActivities },
      ...activities.map((_, i) => ({ coefficients: [...activities.map((__, j) => Number(i === j)), 0], limit: caps[i] })),
      ...bands.map((b) => ({ coefficients: [...activities.map((a) => idleMargins[b] - a.margins[b]), 1], limit: totalArea * idleMargins[b] - floor })),
    ]);
    const values = solution.values.slice(0, count);
    if (isFeasible(values, caps, costs, totalArea, capitalForActivities)) bestValues = values;
  }

  const rows = activities
    .map<StrategyAllocationRow>((activity, index) => {
      const area = bestValues[index] ?? 0;
      return {
        ...activity,
        scoreHa: scores[index],
        area,
        share: totalArea > 0 ? (area / totalArea) * 100 : 0,
        cashUsed: area * activity.cashCostHa,
        marginsAnnual: {
          low: area * activity.margins.low,
          base: area * activity.margins.base,
          high: area * activity.margins.high,
        },
      };
    })
    .sort((left, right) => right.area - left.area || right.scoreHa - left.scoreHa);

  const allocatedArea = rows.reduce((sum, row) => sum + row.area, 0);
  const cashUsed =
    rows.reduce((sum, row) => sum + row.cashUsed, 0) +
    Math.max(0, totalArea - allocatedArea) * idleCashCostHa;
  const scenarioTotals: ScenarioMargins = {
    low:
      rows.reduce((sum, row) => sum + row.marginsAnnual.low, 0) +
      Math.max(0, totalArea - allocatedArea) * idleMargins.low,
    base:
      rows.reduce((sum, row) => sum + row.marginsAnnual.base, 0) +
      Math.max(0, totalArea - allocatedArea) * idleMargins.base,
    high:
      rows.reduce((sum, row) => sum + row.marginsAnnual.high, 0) +
      Math.max(0, totalArea - allocatedArea) * idleMargins.high,
  };

  return {
    rows,
    allocatedArea,
    idleArea: Math.max(0, totalArea - allocatedArea),
    cashUsed,
    capitalSlack: Math.max(0, capitalLimit - cashUsed),
    capitalShortfall: Math.max(0, cashUsed - capitalLimit),
    capitalFeasible: cashUsed <= capitalLimit + 0.01,
    scenarioTotals,
    objective: criterionMargin(scenarioTotals, input.criterion),
    criterionMarginHa: totalArea > 0 ? criterionMargin(scenarioTotals, input.criterion) / totalArea : 0,
    idleMargins,
    idleCashCostHa,
  };
}

/** Cada hectare pertence a um módulo exclusivo; CAPEX indivisível é cobrado uma vez. */
export function allocateEnterpriseStrategy(input: StrategyAllocationInput & {
  commonFixedCapital: number; feedlotFixedCapital: number;
}) {
  const candidates = [false, true].map((withFeedlot) => {
    const fixed = Math.max(0, input.commonFixedCapital) + (withFeedlot ? Math.max(0, input.feedlotFixedCapital) : 0);
    const result = allocateStrategy({ ...input, capitalLimit: Math.max(0, input.capitalLimit - fixed),
      activities: input.activities.filter((a) => withFeedlot || a.id !== 'cattle-a') });
    const cashUsed = result.cashUsed + fixed;
    return { ...result, fixedCapital: fixed, withFeedlot, cashUsed,
      capitalSlack: Math.max(0, input.capitalLimit - cashUsed), capitalShortfall: Math.max(0, cashUsed - input.capitalLimit),
      capitalFeasible: result.capitalFeasible && cashUsed <= input.capitalLimit + 0.01 };
  });
  return candidates.sort((a, b) => Number(b.capitalFeasible) - Number(a.capitalFeasible) || b.objective - a.objective || a.cashUsed - b.cashUsed)[0];
}
