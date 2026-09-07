import {
  calculateCrop,
  type CropAssumption,
} from './crop-model.ts';

const DAY_MS = 86_400_000;

function parseIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseIso(value);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

function monthKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(0, 7) : '';
}

export type WorkRateInput = {
  areaHa: number;
  usableDays: number;
  informedRateHaDay?: number;
};

export function calculateWorkRate(input: WorkRateInput) {
  const areaHa = Math.max(0, input.areaHa);
  const usableDays = Math.max(1, Math.ceil(input.usableDays));
  const informedRateHaDay = Math.max(0, input.informedRateHaDay ?? 0);
  const requiredRateHaDay = areaHa / usableDays;
  const informedDurationDays =
    informedRateHaDay > 0 ? areaHa / informedRateHaDay : null;
  const capacityGapHaDay =
    informedRateHaDay > 0
      ? Math.max(0, requiredRateHaDay - informedRateHaDay)
      : null;

  return {
    areaHa,
    usableDays,
    requiredRateHaDay,
    informedRateHaDay,
    informedDurationDays,
    capacityGapHaDay,
    informed: informedRateHaDay > 0,
    fits: informedRateHaDay > 0 && informedRateHaDay + 1e-9 >= requiredRateHaDay,
  };
}

export type FeedLotWindow = {
  id: string;
  label: string;
  ownHeads: number;
  days: number;
  entryDate?: string;
  exitDate?: string;
  grainSacksHead: number;
  silageDmKgHead: number;
  totalDmKgHead: number;
};

export type WeeklyFeedPlanInput = {
  lots: FeedLotWindow[];
  grainProducedSacks: number;
  ownGrainAllocatedSacks: number;
  ownSilageAllocatedDmKg: number;
  openingSilageDmKg?: number;
  silageReceipts?: { date: string; dmKg: number }[];
  grainReceiptDate: string;
  allowPurchases: boolean;
};

export type WeeklyFeedRow = {
  weekStart: string;
  weekEnd: string;
  grainReceiptSacks: number;
  grainConsumptionSacks: number;
  grainPurchaseSacks: number;
  grainShortageSacks: number;
  grainEndingSacks: number;
  silageConsumptionDmKg: number;
  silageReceiptDmKg: number;
  silagePurchaseDmKg: number;
  silageShortageDmKg: number;
  silageEndingDmKg: number;
  totalDmConsumptionKg: number;
};

function overlappingDays(
  periodStart: string,
  periodEndExclusive: string,
  lotStart: string,
  lotEndExclusive: string,
) {
  const start = Math.max(
    parseIso(periodStart)?.getTime() ?? 0,
    parseIso(lotStart)?.getTime() ?? 0,
  );
  const end = Math.min(
    parseIso(periodEndExclusive)?.getTime() ?? 0,
    parseIso(lotEndExclusive)?.getTime() ?? 0,
  );
  return Math.max(0, Math.round((end - start) / DAY_MS));
}

export function calculateWeeklyFeedPlan(input: WeeklyFeedPlanInput) {
  const calendarLots = input.lots.filter(
    (lot) =>
      lot.ownHeads > 0 &&
      lot.days > 0 &&
      parseIso(lot.entryDate ?? '') &&
      parseIso(lot.exitDate ?? '') &&
      (lot.exitDate ?? '') > (lot.entryDate ?? ''),
  );
  if (calendarLots.length === 0) {
    return {
      calendarReady: false,
      rows: [] as WeeklyFeedRow[],
      openingSilageDmKg: 0,
      peakGrainStockSacks: 0,
      peakSilageStockDmKg: 0,
      peakWeeklyDmKg: 0,
      totalGrainPurchasedSacks: 0,
      totalSilagePurchasedDmKg: 0,
      totalGrainShortageSacks: 0,
      totalSilageShortageDmKg: 0,
      timingMismatchGrainSacks: 0,
    };
  }

  const firstEntry = calendarLots.reduce(
    (minimum, lot) => ((lot.entryDate ?? '') < minimum ? lot.entryDate ?? '' : minimum),
    calendarLots[0].entryDate ?? '',
  );
  const lastExit = calendarLots.reduce(
    (maximum, lot) => ((lot.exitDate ?? '') > maximum ? lot.exitDate ?? '' : maximum),
    calendarLots[0].exitDate ?? '',
  );
  const grainFinalDate =
    parseIso(input.grainReceiptDate) && input.grainReceiptDate > lastExit
      ? input.grainReceiptDate
      : lastExit;
  const ownGrainReceipt = Math.min(
    Math.max(0, input.grainProducedSacks),
    Math.max(0, input.ownGrainAllocatedSacks),
  );
  let remainingSilage = Math.max(0, input.ownSilageAllocatedDmKg);
  const receipts = (input.silageReceipts ?? []).filter((r) => parseIso(r.date) && Number.isFinite(r.dmKg) && r.dmKg > 0)
    .sort((a, b) => a.date.localeCompare(b.date)).map((r) => {
      const dmKg = Math.min(r.dmKg, remainingSilage);
      remainingSilage -= dmKg;
      return { ...r, dmKg };
    });
  const finalDate = receipts.reduce((end, r) => r.date > end ? r.date : end, grainFinalDate);
  const openingSilageDmKg = Math.max(0, input.openingSilageDmKg ?? 0) +
    receipts.filter((r) => r.date < firstEntry).reduce((sum, r) => sum + r.dmKg, 0);
  const openingGrainSacks = parseIso(input.grainReceiptDate) && input.grainReceiptDate < firstEntry
    ? ownGrainReceipt : 0;
  let grainStock = openingGrainSacks;
  let silageStock = openingSilageDmKg;
  let weekStart = firstEntry;
  const rows: WeeklyFeedRow[] = [];
  let peakGrainStockSacks = grainStock;
  let peakSilageStockDmKg = silageStock;
  let peakWeeklyDmKg = 0;
  let grainReceiptApplied = openingGrainSacks > 0;
  let timingMismatchGrainSacks = 0;

  while (weekStart <= finalDate || rows.length === 0) {
    const weekEndExclusive = addDays(weekStart, 7);
    const weekEnd = addDays(weekStart, 6);
    let grainReceiptSacks = 0;
    let grainConsumptionSacks = 0;
    let silageConsumptionDmKg = 0;
    let silageReceiptDmKg = 0;
    let totalDmConsumptionKg = 0;
    let grainPurchaseSacks = 0;
    let grainShortageSacks = 0;
    let silagePurchaseDmKg = 0;
    let silageShortageDmKg = 0;
    // Reconcile each day first; a Friday harvest cannot feed Monday's cattle.
    for (let day = weekStart; day < weekEndExclusive; day = addDays(day, 1)) {
    const dailyReceipt =
      !grainReceiptApplied &&
      parseIso(input.grainReceiptDate) &&
      input.grainReceiptDate === day
        ? ownGrainReceipt
        : 0;
    if (dailyReceipt > 0) grainReceiptApplied = true;
    grainStock += dailyReceipt;
    grainReceiptSacks += dailyReceipt;
    const dailySilageReceipt = receipts.filter((r) => r.date === day).reduce((sum, r) => sum + r.dmKg, 0);
    silageStock += dailySilageReceipt;
    silageReceiptDmKg += dailySilageReceipt;
    peakSilageStockDmKg = Math.max(peakSilageStockDmKg, silageStock);
    peakGrainStockSacks = Math.max(peakGrainStockSacks, grainStock);

    let dailyGrain = 0;
    let dailySilage = 0;
    let dailyDm = 0;
    for (const lot of calendarLots) {
      const days = overlappingDays(
        day,
        addDays(day, 1),
        lot.entryDate ?? '',
        lot.exitDate ?? '',
      );
      if (days <= 0) continue;
      dailyGrain +=
        lot.ownHeads * (lot.grainSacksHead / Math.max(lot.days, 1)) * days;
      dailySilage +=
        lot.ownHeads * (lot.silageDmKgHead / Math.max(lot.days, 1)) * days;
      dailyDm +=
        lot.ownHeads * (lot.totalDmKgHead / Math.max(lot.days, 1)) * days;
    }

    grainConsumptionSacks += dailyGrain;
    silageConsumptionDmKg += dailySilage;
    totalDmConsumptionKg += dailyDm;
    const grainGap = Math.max(0, dailyGrain - grainStock);
    const dailyPurchase = input.allowPurchases ? grainGap : 0;
    grainPurchaseSacks += dailyPurchase;
    grainShortageSacks += input.allowPurchases ? 0 : grainGap;
    if (day < input.grainReceiptDate) timingMismatchGrainSacks += dailyPurchase;
    grainStock = Math.max(0, grainStock + dailyPurchase - dailyGrain);

    const silageGap = Math.max(0, dailySilage - silageStock);
    const dailySilagePurchase = input.allowPurchases ? silageGap : 0;
    silagePurchaseDmKg += dailySilagePurchase;
    silageShortageDmKg += input.allowPurchases ? 0 : silageGap;
    silageStock = Math.max(
      0,
      silageStock + dailySilagePurchase - dailySilage,
    );
    }

    peakGrainStockSacks = Math.max(peakGrainStockSacks, grainStock);
    peakSilageStockDmKg = Math.max(peakSilageStockDmKg, silageStock);
    peakWeeklyDmKg = Math.max(peakWeeklyDmKg, totalDmConsumptionKg);
    rows.push({
      weekStart,
      weekEnd,
      grainReceiptSacks,
      grainConsumptionSacks,
      grainPurchaseSacks,
      grainShortageSacks,
      grainEndingSacks: grainStock,
      silageConsumptionDmKg,
      silageReceiptDmKg,
      silagePurchaseDmKg,
      silageShortageDmKg,
      silageEndingDmKg: silageStock,
      totalDmConsumptionKg,
    });
    weekStart = weekEndExclusive;
  }

  return {
    calendarReady: calendarLots.length === input.lots.filter((lot) => lot.ownHeads > 0).length,
    rows,
    openingGrainSacks,
    openingSilageDmKg,
    peakGrainStockSacks,
    peakSilageStockDmKg,
    peakWeeklyDmKg,
    totalGrainPurchasedSacks: rows.reduce(
      (sum, row) => sum + row.grainPurchaseSacks,
      0,
    ),
    totalSilagePurchasedDmKg: rows.reduce(
      (sum, row) => sum + row.silagePurchaseDmKg,
      0,
    ),
    totalGrainShortageSacks: rows.reduce(
      (sum, row) => sum + row.grainShortageSacks,
      0,
    ),
    totalSilageShortageDmKg: rows.reduce(
      (sum, row) => sum + row.silageShortageDmKg,
      0,
    ),
    timingMismatchGrainSacks,
  };
}

export type CashEvent = {
  date: string;
  label: string;
  inflow: number;
  outflow: number;
};

export function cropCashEvents(
  crop: CropAssumption,
  areaHa: number,
  plantDate: string,
  harvestDate: string,
  landLeaseHa = 0,
  includeLandLease = true,
) {
  const result = calculateCrop(crop, areaHa, includeLandLease ? landLeaseHa : 0);
  const events: CashEvent[] = [
    {
      date: plantDate,
      label: `${crop.shortName} · custeio direto${includeLandLease && landLeaseHa > 0 ? ' + terra' : ''}`,
      inflow: 0,
      outflow:
        (result.directCostHa + result.fixedCostHa + (includeLandLease ? landLeaseHa : 0)) * areaHa,
    },
    {
      date: harvestDate,
      label: `${crop.shortName} · venda bruta`,
      inflow: result.revenue,
      outflow: result.deductionsHa * areaHa,
    },
  ];
  return events;
}

export function calculateMonthlyCashFlow(events: CashEvent[]) {
  const valid = events.filter(
    (event) => parseIso(event.date) && monthKey(event.date),
  );
  const months = [...new Set(valid.map((event) => monthKey(event.date)))].sort();
  let cumulative = 0;
  let peakFundingNeed = 0;
  let peakFundingMonth = '';
  let peakFundingDate = '';
  const rows = months.map((month) => {
    const monthEvents = valid.filter((event) => monthKey(event.date) === month);
    const inflow = monthEvents.reduce((sum, event) => sum + event.inflow, 0);
    const outflow = monthEvents.reduce((sum, event) => sum + event.outflow, 0);
    const net = inflow - outflow;
    const days = [...new Set(monthEvents.map((event) => event.date))].sort();
    for (const day of days) {
      const daily = monthEvents.filter((event) => event.date === day);
      // Negative events precede receipts on the same date. Deductions attached
      // to a sale stay netted within that event (not paid twice upfront).
      for (const event of daily.sort((a, b) => (a.inflow - a.outflow) - (b.inflow - b.outflow))) {
        cumulative += event.inflow - event.outflow;
        if (-cumulative > peakFundingNeed) {
          peakFundingNeed = -cumulative;
          peakFundingMonth = month;
          peakFundingDate = day;
        }
      }
    }
    return {
      month,
      inflow,
      outflow,
      net,
      cumulative,
      events: monthEvents.map((event) => event.label),
    };
  });

  return {
    rows,
    peakFundingNeed,
    peakFundingMonth,
    peakFundingDate,
    endingCash: cumulative,
  };
}

export type CapexStep = {
  id: string;
  label: string;
  unit: string;
  required: number;
  informedExisting: number;
  gap: number | null;
  unitCost: number;
  incrementalCapex: number | null;
  source: string;
};

export function buildCapexStep(
  id: string,
  label: string,
  unit: string,
  required: number,
  informedExisting: number | null | undefined,
  unitCost: number,
  source: string,
): CapexStep {
  const normalizedRequired = Math.max(0, required);
  const existing = Math.max(0, informedExisting ?? 0);
  const normalizedUnitCost = Math.max(0, unitCost);
  const hasExisting = informedExisting != null && Number.isFinite(informedExisting);
  const gap = hasExisting ? Math.max(0, normalizedRequired - existing) : null;
  return {
    id,
    label,
    unit,
    required: normalizedRequired,
    informedExisting: existing,
    gap,
    unitCost: normalizedUnitCost,
    incrementalCapex:
      gap !== null && normalizedUnitCost > 0 ? gap * normalizedUnitCost : null,
    source,
  };
}
