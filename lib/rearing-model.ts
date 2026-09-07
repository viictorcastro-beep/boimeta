import { BASE, type Assumptions } from './livestock-model.ts';
import {
  calculateMonthlyCashFlow,
  type CashEvent,
} from './operational-model.ts';
import { isoTime } from './market-signals.ts';

/** C: 100% da área em recria, 100% reposição comprada; venda líquida em kg vivo. */
export function rearingOnly(a: Assumptions, gateNetPriceKg: number) {
  const valid =
    a.totalArea > 0 &&
    a.stockingUa >= 0 &&
    a.entryWeight > 0 &&
    a.pivotExitWeight > a.entryWeight &&
    a.gmdPivotA > 0 &&
    Number.isFinite(gateNetPriceKg) &&
    gateNetPriceKg >= 0;
  const survival = 1 - Math.min(100, Math.max(0, a.pastureMortalityPercent ?? 0.2)) / 100;
  const days = valid
    ? Math.ceil((a.pivotExitWeight - a.entryWeight) / a.gmdPivotA)
    : 0;
  const cycles = days > 0 ? 365 / days : 0;
  const simultaneousHeads = valid
    ? (a.totalArea * a.stockingUa * 450) /
      ((a.entryWeight + a.pivotExitWeight) / 2)
    : 0;
  const entrants = simultaneousHeads * cycles;
  const sold = entrants * survival;
  const factor = a.otherCostFactor / 100;
  const freightIn = 50 * factor;
  const health = 45 * factor;
  const supplement = 28.4 * (days / (160 / 0.9)) * a.supplementPrice * factor;
  const preGateVariableHead = a.calfCost + freightIn + health + supplement;
  const pastureCost =
    ((Math.max(0, a.totalArea) * BASE.soldA * (432.62 + 19.97)) /
      BASE.pastureAreaA) *
    factor;
  const lease = Math.max(0, a.totalArea) * a.landLeaseHa;
  const costs = entrants * preGateVariableHead + pastureCost + lease;
  const revenue = sold * a.pivotExitWeight * Math.max(0, gateNetPriceKg);
  const margin = revenue - costs;
  return {
    valid,
    survival,
    days,
    cycles,
    simultaneousHeads,
    entrants,
    sold,
    freightIn,
    health,
    supplement,
    preGateVariableHead,
    pastureCost,
    lease,
    costs,
    operatingCycleReserve: simultaneousHeads * preGateVariableHead + (pastureCost + lease) * Math.max(1, days / 365),
    revenue,
    margin,
    marginHa: a.totalArea > 0 ? margin / a.totalArea : 0,
    variableCostPerSold: survival > 0 ? preGateVariableHead / survival : null,
    gateNetPriceKg,
    breakEvenPriceKg: sold > 0 ? costs / (sold * a.pivotExitWeight) : null,
    // Não usa cocho, silagem, vacas, efluente ou prêmio de exportação.
  };
}

export function rearingStartupCash(
  a: Assumptions,
  gateNetPriceKg: number,
  anchor: string,
  setupDays = 0,
  setupCost = 0,
) {
  const core = rearingOnly(a, gateNetPriceKg);
  const start = isoTime(anchor);
  if (start === null) return null;
  const date = (day: number) =>
    new Date(start + day * 86400000).toISOString().slice(0, 10);
  const events: CashEvent[] = [
    {
      date: anchor,
      label: 'Pivô/implantação + custeio anual do pasto e arrendamento',
      inflow: 0,
      outflow: a.pivotInvestment + setupCost + core.pastureCost + core.lease,
    },
  ];
  const boughtBatch = core.entrants / 365;
  const soldBatch = boughtBatch * core.survival;
  const outgoing = Array<number>(365).fill(0),
    incoming = Array<number>(365).fill(0);
  let closingHeads = 0,
    salesHeads = 0,
    boughtHeads = 0;
  for (
    let entry = Math.ceil(Math.max(0, setupDays));
    entry < 365 && core.days > 0;
    entry++
  ) {
    boughtHeads += boughtBatch;
    outgoing[entry] += boughtBatch * (a.calfCost + core.freightIn);
    for (let day = 0; day < Math.min(core.days, 365 - entry); day++) {
      outgoing[entry + day] +=
        (boughtBatch * (core.supplement + core.health)) / core.days;
    }
    if (entry + core.days < 365) {
      salesHeads += soldBatch;
      incoming[entry + core.days] +=
        soldBatch * a.pivotExitWeight * gateNetPriceKg;
    } else closingHeads += boughtBatch;
  }
  for (let day = 0; day < 365; day++) {
    // Mesmo tratamento intradia de A/B: pagar primeiro, receber depois.
    if (outgoing[day])
      events.push({
        date: date(day),
        label: 'Coortes de recria · compra e custeio',
        inflow: 0,
        outflow: outgoing[day],
      });
    if (incoming[day])
      events.push({
        date: date(day),
        label: 'Coortes de recria · venda líquida',
        inflow: incoming[day],
        outflow: 0,
      });
  }
  return {
    ...calculateMonthlyCashFlow(events),
    events,
    closingHeads,
    salesHeads,
    boughtHeads,
    deaths: Math.max(0, boughtHeads - salesHeads - closingHeads),
    firstSaleDate: core.valid ? date(Math.ceil(setupDays) + core.days) : '',
    netCash: events.reduce(
      (sum, event) => sum + event.inflow - event.outflow,
      0,
    ),
    inventoryAtPurchaseCost: closingHeads * a.calfCost,
    note: 'Coortes diárias equivalentes; início vazio; preços constantes. Animais remanescentes não são venda. Sem matrizes próprias, confinamento ou receita de exportação adicional.',
  };
}

/** Reserva conservadora para financiar uma ocupação inteira até a venda, sem
 * usar receitas do mesmo lote antes da conclusão nem truncar em 31/12. */
export function rearingCapitalRequirement(
  a: Assumptions,
  gateNetPriceKg: number,
  datedPeak: number,
  setupCost = 0,
  reserveCash = 0,
) {
  const c = rearingOnly(a, gateNetPriceKg);
  const fullCycleReserve =
    c.operatingCycleReserve +
    a.pivotInvestment +
    setupCost;
  return {
    fullCycleReserve,
    required: Math.max(datedPeak, fullCycleReserve) + reserveCash,
  };
}

export function stressRearing(
  a: Assumptions,
  gateNetPriceKg: number,
  factors: {
    productivity: number;
    cost: number;
    replacement: number;
    price: number;
  },
) {
  return rearingOnly(
    {
      ...a,
      totalArea: 1,
      calfCost: a.calfCost * factors.replacement,
      stockingUa: Math.max(0, a.stockingUa * factors.productivity),
      gmdPivotA: Math.max(0.05, a.gmdPivotA * factors.productivity),
      otherCostFactor: Math.max(0, a.otherCostFactor * factors.cost),
    },
    gateNetPriceKg * Math.max(0, factors.price),
  );
}
