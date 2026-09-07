export type FutureProduct = 'cattle' | 'corn' | 'soy' | 'cotton';

export type FutureUnit =
  | 'BRL_ARROBA'
  | 'BRL_SACK_60KG'
  | 'USD_SACK_60KG'
  | 'US_CENTS_LB';

export type FutureQuote = {
  id: string;
  product: FutureProduct;
  contract: string;
  deliveryMonth: string;
  referenceDate: string;
  rawPrice: number;
  rawUnit: FutureUnit;
  localBasis: number;
  sourceDate: string;
  exchange: 'B3' | 'ICE';
  symbol: string;
  sourceUrl: string;
  note: string;
  provenance?: 'manual-reference' | 'manual-override';
};

export type FutureQuoteValidation = {
  isUsable: boolean;
  issue: string | null;
  horizonDays: number | null;
};

export type FutureQuoteConversion = {
  convertedPrice: number;
  effectivePrice?: number;
  usdBrl: number;
  cottonFiberRecovery: number;
};

const DAY_MS = 86_400_000;
const MAX_FUTURE_SOURCE_AGE_DAYS = 7;

function strictIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

export function validateFutureQuote(
  quote: FutureQuote,
  asOfDate: string,
  conversion?: FutureQuoteConversion,
): FutureQuoteValidation {
  const asOf = strictIsoDate(asOfDate);
  const source = strictIsoDate(quote.sourceDate);
  const reference = strictIsoDate(quote.referenceDate);
  const horizonDays =
    asOf && reference
      ? Math.round((reference.getTime() - asOf.getTime()) / DAY_MS)
      : null;
  let issue: string | null = null;
  if (!asOf) issue = 'data de corte inválida';
  else if (!Number.isFinite(quote.rawPrice) || quote.rawPrice <= 0) {
    issue = 'preço bruto ausente ou inválido';
  } else if (!Number.isFinite(quote.localBasis)) {
    issue = 'basis inválido';
  } else if (!source) issue = 'data de observação inválida';
  else if (source.getTime() > asOf.getTime()) {
    issue = 'data de observação posterior ao corte';
  } else if (
    (asOf.getTime() - source.getTime()) / DAY_MS >
    MAX_FUTURE_SOURCE_AGE_DAYS
  ) {
    issue = `observação com mais de ${MAX_FUTURE_SOURCE_AGE_DAYS} dias`;
  } else if (!reference) issue = 'ponto da curva inválido';
  else if (quote.referenceDate.slice(0, 7) !== quote.deliveryMonth) {
    issue = 'ponto da curva fora do mês de entrega';
  } else if (reference.getTime() < asOf.getTime()) {
    issue = 'ponto da curva anterior à data de corte';
  } else if (source.getTime() > reference.getTime()) {
    issue = 'observação posterior ao ponto da curva';
  } else if (
    conversion &&
    (quote.rawUnit === 'USD_SACK_60KG' ||
      quote.rawUnit === 'US_CENTS_LB') &&
    (!Number.isFinite(conversion.usdBrl) || conversion.usdBrl <= 0)
  ) {
    issue = 'câmbio ausente ou inválido';
  } else if (
    conversion &&
    quote.rawUnit === 'US_CENTS_LB' &&
    (!Number.isFinite(conversion.cottonFiberRecovery) ||
      conversion.cottonFiberRecovery <= 0 ||
      conversion.cottonFiberRecovery > 100)
  ) {
    issue = 'rendimento de fibra ausente ou inválido';
  } else if (
    conversion &&
    (!Number.isFinite(conversion.convertedPrice) ||
      conversion.convertedPrice <= 0)
  ) {
    issue = 'preço convertido não positivo';
  } else if (
    conversion?.effectivePrice !== undefined &&
    (!Number.isFinite(conversion.effectivePrice) ||
      conversion.effectivePrice <= 0)
  ) {
    issue = 'preço ponderado não positivo';
  }
  return { isUsable: issue === null, issue, horizonDays };
}

export const futureQuoteDefaults: FutureQuote[] = [
  {
    id: 'bgi-sep26',
    product: 'cattle',
    contract: 'Set/26',
    deliveryMonth: '2026-09',
    referenceDate: '2026-09-15',
    rawPrice: 358.8,
    rawUnit: 'BRL_ARROBA',
    localBasis: -8,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'BGI',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual. BGI representa boi gordo padrão São Paulo; ajuste basis, frete, impostos e padrão do lote.',
  },
  {
    id: 'bgi-oct26',
    product: 'cattle',
    contract: 'Out/26',
    deliveryMonth: '2026-10',
    referenceDate: '2026-10-15',
    rawPrice: 367.95,
    rawUnit: 'BRL_ARROBA',
    localBasis: -8,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'BGI',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual. Confirme o preço de ajuste no boletim da B3 antes de usar.',
  },
  {
    id: 'bgi-dec26',
    product: 'cattle',
    contract: 'Dez/26',
    deliveryMonth: '2026-12',
    referenceDate: '2026-12-15',
    rawPrice: 372.9,
    rawUnit: 'BRL_ARROBA',
    localBasis: -8,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'BGI',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual. Não representa preço garantido na fazenda.',
  },
  {
    id: 'ccm-sep26',
    product: 'corn',
    contract: 'Set/26',
    deliveryMonth: '2026-09',
    referenceDate: '2026-09-15',
    rawPrice: 71.45,
    rawUnit: 'BRL_SACK_60KG',
    localBasis: -10,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'CCM',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual. CCM precisa de basis para representar o milho no Oeste da Bahia.',
  },
  {
    id: 'ccm-nov26',
    product: 'corn',
    contract: 'Nov/26',
    deliveryMonth: '2026-11',
    referenceDate: '2026-11-15',
    rawPrice: 77.88,
    rawUnit: 'BRL_SACK_60KG',
    localBasis: -10,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'CCM',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual. Confirme ajuste, liquidez e custo de carregamento.',
  },
  {
    id: 'ccm-mar27',
    product: 'corn',
    contract: 'Mar/27',
    deliveryMonth: '2027-03',
    referenceDate: '2027-03-15',
    rawPrice: 80,
    rawUnit: 'BRL_SACK_60KG',
    localBasis: -10,
    sourceDate: '2026-08-18',
    exchange: 'B3',
    symbol: 'CCM',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência indicativa mais antiga. Atualize antes de comparar.',
  },
  {
    id: 'sjc-nov26',
    product: 'soy',
    contract: 'Nov/26',
    deliveryMonth: '2026-11',
    referenceDate: '2026-11-15',
    rawPrice: 28.42,
    rawUnit: 'USD_SACK_60KG',
    localBasis: -12,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'SJC',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'SJC é referência CME em US$/sc, não preço físico local. Aplique câmbio e basis.',
  },
  {
    id: 'sjc-jan27',
    product: 'soy',
    contract: 'Jan/27',
    deliveryMonth: '2027-01',
    referenceDate: '2027-01-15',
    rawPrice: 28.7,
    rawUnit: 'USD_SACK_60KG',
    localBasis: -12,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'SJC',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual; risco conjunto de preço, câmbio e basis.',
  },
  {
    id: 'sjc-mar27',
    product: 'soy',
    contract: 'Mar/27',
    deliveryMonth: '2027-03',
    referenceDate: '2027-03-15',
    rawPrice: 28.74,
    rawUnit: 'USD_SACK_60KG',
    localBasis: -12,
    sourceDate: '2026-08-28',
    exchange: 'B3',
    symbol: 'SJC',
    sourceUrl:
      'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
    note: 'Referência manual; confirme o vencimento adequado à janela de venda.',
  },
  {
    id: 'ct-oct26',
    product: 'cotton',
    contract: 'Out/26',
    deliveryMonth: '2026-10',
    referenceDate: '2026-10-15',
    rawPrice: 89.92,
    rawUnit: 'US_CENTS_LB',
    localBasis: -18,
    sourceDate: '2026-08-28',
    exchange: 'ICE',
    symbol: 'CT',
    sourceUrl: 'https://www.ice.com/products/254/Cotton-No-2-Futures/data',
    note: 'CT referencia pluma dos EUA. A conversão usa câmbio, rendimento de fibra, crédito do caroço e basis local.',
  },
  {
    id: 'ct-dec26',
    product: 'cotton',
    contract: 'Dez/26',
    deliveryMonth: '2026-12',
    referenceDate: '2026-12-15',
    rawPrice: 91.38,
    rawUnit: 'US_CENTS_LB',
    localBasis: -18,
    sourceDate: '2026-08-28',
    exchange: 'ICE',
    symbol: 'CT',
    sourceUrl: 'https://www.ice.com/products/254/Cotton-No-2-Futures/data',
    note: 'Referência manual. Qualidade e custos de beneficiamento podem alterar materialmente o equivalente da fazenda.',
  },
  {
    id: 'ct-mar27',
    product: 'cotton',
    contract: 'Mar/27',
    deliveryMonth: '2027-03',
    referenceDate: '2027-03-15',
    rawPrice: 93.34,
    rawUnit: 'US_CENTS_LB',
    localBasis: -18,
    sourceDate: '2026-08-28',
    exchange: 'ICE',
    symbol: 'CT',
    sourceUrl: 'https://www.ice.com/products/254/Cotton-No-2-Futures/data',
    note: 'Referência manual. Não equivale a contrato de algodão brasileiro.',
  },
];

export function futurePriceInModelUnit(
  quote: FutureQuote,
  usdBrl: number,
  cottonFiberRecovery: number,
  cottonSeedCredit: number,
) {
  if (quote.rawUnit === 'BRL_ARROBA' || quote.rawUnit === 'BRL_SACK_60KG') {
    return quote.rawPrice + quote.localBasis;
  }
  if (quote.rawUnit === 'USD_SACK_60KG') {
    return quote.rawPrice * usdBrl + quote.localBasis;
  }
  const poundsPerArroba = 15 / 0.45359237;
  const lintValuePerArroba =
    (quote.rawPrice / 100) * poundsPerArroba * usdBrl;
  return (
    lintValuePerArroba * (cottonFiberRecovery / 100) +
    cottonSeedCredit +
    quote.localBasis
  );
}

export function futureRawUnitLabel(unit: FutureUnit) {
  if (unit === 'BRL_ARROBA') return 'R$/@';
  if (unit === 'BRL_SACK_60KG') return 'R$/sc 60 kg';
  if (unit === 'USD_SACK_60KG') return 'US$/sc 60 kg';
  return 'US¢/lb';
}

export function futureModelUnitLabel(product: FutureProduct) {
  if (product === 'cattle' || product === 'cotton') return 'R$/@';
  return 'R$/sc 60 kg';
}

export const futureProductLabel: Record<FutureProduct, string> = {
  cattle: 'Boi gordo',
  corn: 'Milho',
  soy: 'Soja',
  cotton: 'Algodão',
};
