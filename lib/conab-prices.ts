export type Product = 'soy' | 'corn' | 'cotton' | 'cattle';

type RawRow = {
  nomeProduto?: string | null;
  nivel?: string | null;
  uf?: string | null;
  periodo?: string | null;
  valor?: string | number | null;
};

export type ConabPrice = {
  source: 'CONAB';
  product: Product;
  description: string;
  uf: string;
  level: string;
  periodStart: string;
  periodEnd: string;
  sourceDate: string;
  rawPeriod: string;
  displayUnit: string;
  value: number;
};

const CONAB_ENDPOINT =
  'https://barramento.conab.gov.br/precosiagro-rs/api/consulta/precos/consultar';

export const VALID_UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
]);

function normalizedName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function parsePtBrNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value !== 'string') throw new Error('Conab: valor ausente.');
  const compact = value.replace(/\u00a0/g, '').replace(/\s/g, '');
  const canonical = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : compact;
  if (!/^-?\d+(?:\.\d+)?$/.test(canonical)) {
    throw new Error('Conab: valor inválido.');
  }
  const parsed = Number(canonical);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Conab: preço inválido.');
  }
  return parsed;
}

export function parsePeriod(raw: string) {
  const match = normalizedName(raw).match(
    /^(\d{2})\/(\d{2})\/(\d{2})\s+(?:A|ATE)\s+(\d{2})\/(\d{2})\/(\d{2})$/,
  );
  if (!match) throw new Error('Conab: período inválido.');
  const iso = (day: string, month: string, year: string) =>
    `20${year}-${month}-${day}`;
  const start = iso(match[1], match[2], match[3]);
  const end = iso(match[4], match[5], match[6]);
  for (const value of [start, end]) {
    const date = new Date(value + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
      throw new Error('Conab: data inexistente.');
  }
  if (start > end) throw new Error('Conab: período invertido.');
  return { start, end };
}

function classify(name: string) {
  const normalized = normalizedName(name);
  if (/^SOJA EM GRAOS\b/.test(normalized) && /\(60 KG\)/.test(normalized)) {
    return { product: 'soy' as const, displayUnit: 'R$/sc 60 kg' };
  }
  if (/^MILHO EM GRAOS\b/.test(normalized) && /\(60 KG\)/.test(normalized)) {
    return { product: 'corn' as const, displayUnit: 'R$/sc 60 kg' };
  }
  if (/^ALGODAO EM PLUMA TIPO BASICO\b/.test(normalized) && /\(15 KG\)/.test(normalized)) {
    return { product: 'cotton' as const, displayUnit: 'R$/15 kg de pluma' };
  }
  if (/^BOI GORDO\b/.test(normalized) && /\(15 KG\)/.test(normalized)) {
    return { product: 'cattle' as const, displayUnit: 'R$/@ de 15 kg' };
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseConab(input: unknown) {
  if (!isRecord(input) || !Array.isArray(input.precos)) {
    throw new Error('Conab: resposta inválida.');
  }
  const inherited = { nomeProduto: '', nivel: '', uf: '', periodo: '' };
  const output: ConabPrice[] = [];

  for (const unknownRow of input.precos) {
    if (!isRecord(unknownRow)) continue;
    const row = unknownRow as RawRow;
    for (const key of ['nomeProduto', 'nivel', 'uf', 'periodo'] as const) {
      inherited[key] = text(row[key]) ?? inherited[key];
    }
    const spec = classify(inherited.nomeProduto);
    if (!spec) continue;
    try {
    const period = parsePeriod(inherited.periodo);
    output.push({
      source: 'CONAB',
      ...spec,
      description: inherited.nomeProduto,
      uf: inherited.uf,
      level: inherited.nivel,
      periodStart: period.start,
      periodEnd: period.end,
      sourceDate: period.end,
      rawPeriod: inherited.periodo,
      value: parsePtBrNumber(row.valor),
    });
    } catch { /* Discard only the malformed row, preserving valid observations. */ }
  }

  return output;
}

function dateInSaoPaulo(asOf = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(asOf);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(`${values.year}-${values.month}-${values.day}T12:00:00-03:00`);
}

function formatConabDate(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function completedWeek(weeksAgo = 0, asOf = new Date()) {
  const today = dateInSaoPaulo(asOf);
  const day = today.getUTCDay();
  const daysSinceFriday = day === 0 ? 2 : day === 6 ? 1 : day + 2;
  const friday = new Date(today);
  friday.setUTCDate(friday.getUTCDate() - daysSinceFriday - weeksAgo * 7);
  const monday = new Date(friday);
  monday.setUTCDate(monday.getUTCDate() - 4);
  return `${formatConabDate(monday)} até ${formatConabDate(friday)}`;
}

async function requestWeek(uf: string, weeksAgo: number) {
  // A fonte permite no máximo quatro semanas por consulta.
  const period = completedWeek(weeksAgo + 3).split(' até ')[0] + ' até ' +
    completedWeek(weeksAgo).split(' até ')[1];
  const response = await fetch(CONAB_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      opcao: 'semanal',
      periodo: period,
      mesInicial: null,
      anoInicial: null,
      mesFinal: null,
      anoFinal: null,
      produto: [29, 22, 17, 226],
      nivelComercializacao: [5],
      unidadeFederacao: [uf],
      captchaCode: null,
      pageSize: 100,
      start: 0,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Conab indisponível (${response.status}).`);
  return { period, quotes: parseConab(await response.json()) };
}

export async function fetchConabPrices(uf = 'BA') {
  if (!VALID_UFS.has(uf)) throw new Error('UF inválida.');
  const products: Product[] = ['soy', 'corn', 'cotton', 'cattle'];
  const latest = new Map<Product, ConabPrice>();
  const history: ConabPrice[] = [];
  const searchedPeriods: string[] = [];
  const warnings: string[] = [];
  const deadline = Date.now() + 36_000;
  for (let weeksAgo = 0; weeksAgo < 12 && Date.now() < deadline; weeksAgo += 4) {
    try {
      const result = await requestWeek(uf, weeksAgo);
      searchedPeriods.push(result.period);
      for (const quote of result.quotes) {
        if (quote.uf !== uf || !normalizedName(quote.level).includes('PRODUTOR')) continue;
        history.push(quote);
        const previous = latest.get(quote.product);
        if (!previous || previous.sourceDate < quote.sourceDate) latest.set(quote.product, quote);
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : 'Consulta parcial indisponível.');
    }
  }
  if (!latest.size) throw new Error('A Conab não retornou preços válidos recentes para ' + uf + '.');
  const missingProducts = products.filter((product) => !latest.has(product));
  return {
    source: 'CONAB · Pesquisa de Preços Agrícolas',
    sourceUrl: 'https://consultaprecosdemercado.conab.gov.br/',
    uf, searchedPeriods, fetchedAt: new Date().toISOString(),
    quotes: [...latest.values()], history, missingProducts, warnings,
    completeness: missingProducts.length ? 'partial' : 'complete',
    frequency: 'weekly',
    legalNote: 'Referência semanal observada ao produtor; não é cotação em tempo real nem contrato futuro. Confirme condições de reutilização comercial.'
  };
}
