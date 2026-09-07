import type { ConabPrice, Product } from './conab-prices.ts';

export const SIGNAL_METHOD = 'conab-weekly-v1';
export const PRODUCTS: Product[] = ['cattle', 'soy', 'corn', 'cotton'];
const UNITS: Record<Product, string> = {
  cattle: 'R$/@ de 15 kg',
  soy: 'R$/sc 60 kg',
  corn: 'R$/sc 60 kg',
  cotton: 'R$/15 kg de pluma',
};
export function isoTime(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const ms = Date.parse(value + 'T12:00:00Z');
  return Number.isFinite(ms) &&
    new Date(ms).toISOString().slice(0, 10) === value
    ? ms
    : null;
}
export function validObservation(raw: unknown): raw is ConabPrice {
  if (!raw || typeof raw !== 'object') return false;
  const q = raw as ConabPrice;
  return (
    q.source === 'CONAB' &&
    PRODUCTS.includes(q.product) &&
    /^[A-Z]{2}$/.test(q.uf) &&
    q.level === 'PRODUTOR' &&
    typeof q.description === 'string' &&
    q.description.length > 0 &&
    q.displayUnit === UNITS[q.product] &&
    Number.isFinite(q.value) &&
    q.value > 0 &&
    isoTime(q.sourceDate) !== null &&
    isoTime(q.periodStart) !== null &&
    q.sourceDate === q.periodEnd &&
    q.periodStart <= q.periodEnd
  );
}
function seriesKey(q: ConabPrice) {
  return [q.uf, q.product, q.level, q.description, q.displayUnit].join('|');
}
/** Novas revisões substituem a mesma observação; não preenche lacunas. */
export function mergeMarketHistory(...sets: unknown[]): ConabPrice[] {
  const rows = new Map<string, ConabPrice>();
  for (const set of sets) {
    if (!Array.isArray(set)) continue;
    for (const q of set)
      if (validObservation(q)) {
        rows.set(seriesKey(q) + '|' + q.periodStart + '|' + q.periodEnd, q);
      }
  }
  return [...rows.values()].sort((a, b) =>
    a.sourceDate.localeCompare(b.sourceDate),
  );
}
export type MarketSignal = ReturnType<typeof marketSignal>;
export function marketSignal(
  raw: unknown,
  uf: string,
  product: Product,
  asOf: string,
) {
  const today = isoTime(asOf);
  const candidates = mergeMarketHistory(raw).filter(
    (q) =>
      q.uf === uf &&
      q.product === product &&
      today !== null &&
      isoTime(q.sourceDate)! <= today,
  );
  const latest = candidates.at(-1) ?? null;
  // Não une qualidades nem séries distintas apenas por terem o mesmo produto.
  const series = latest
    ? candidates.filter((q) => seriesKey(q) === seriesKey(latest)).slice(-12)
    : [];
  const ageDays =
    latest && today !== null
      ? (today - isoTime(latest.sourceDate)!) / 86400000
      : null;
  const current = ageDays !== null && ageDays >= 0 && ageDays <= 14;
  const first = series[0];
  const previous = series.at(-2);
  const changePeriod =
    latest && first && series.length > 1
      ? (latest.value / first.value - 1) * 100
      : null;
  const changeWeek =
    latest &&
    previous &&
    isoTime(latest.sourceDate)! - isoTime(previous.sourceDate)! === 7 * 86400000
      ? (latest.value / previous.value - 1) * 100
      : null;
  const six = series.slice(-6);
  const regular =
    six.length === 6 &&
    six.every(
      (q, i) =>
        i === 0 ||
        isoTime(q.sourceDate)! - isoTime(six[i - 1].sourceDate)! ===
          7 * 86400000,
    );
  const avg = (rows: ConabPrice[]) =>
    rows.reduce((sum, q) => sum + q.value, 0) / rows.length;
  const changeTrend = regular
    ? (avg(six.slice(3)) / avg(six.slice(0, 3)) - 1) * 100
    : null;
  let direction:
    | 'alta'
    | 'baixa'
    | 'lateral'
    | 'misto'
    | 'insuficiente'
    | 'desatualizado' = 'insuficiente';
  if (latest && !current) direction = 'desatualizado';
  else if (changeTrend !== null) {
    direction =
      Math.abs(changeTrend) < 1
        ? 'lateral'
        : changeTrend > 0
          ? 'alta'
          : 'baixa';
    if (
      changeWeek !== null &&
      Math.abs(changeWeek) >= 1 &&
      changeTrend * changeWeek < 0 &&
      Math.abs(changeTrend) >= 1
    )
      direction = 'misto';
  }
  return {
    product,
    latest,
    series,
    ageDays,
    current,
    changePeriod,
    changeWeek,
    changeTrend,
    direction,
    method: SIGNAL_METHOD,
    observations: series.length,
    startDate: first?.sourceDate ?? null,
  };
}

/** Relação de preços em datas coincidentes, não conversão alimentar nem lucro. */
export function cattleCornRelation(
  cattle: MarketSignal,
  corn: MarketSignal,
  asOf: string,
) {
  const pairs = cattle.series.flatMap((q) => {
    const grain = corn.series.find((g) => g.sourceDate === q.sourceDate);
    return grain ? [{ date: q.sourceDate, ratio: q.value / grain.value }] : [];
  });
  const first = pairs[0],
    last = pairs.at(-1);
  const today = isoTime(asOf);
  const ageDays =
    last && today !== null ? (today - isoTime(last.date)!) / 86400000 : null;
  return {
    latest: last ?? null,
    ageDays,
    current:
      cattle.current &&
      corn.current &&
      ageDays !== null &&
      ageDays >= 0 &&
      ageDays <= 14,
    change:
      first && last && pairs.length >= 2
        ? (last.ratio / first.ratio - 1) * 100
        : null,
    observations: pairs.length,
  };
}
