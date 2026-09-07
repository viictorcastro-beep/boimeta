export type MarketNews = {
  id: string;
  topic: 'abate' | 'safra';
  title: string;
  url: string;
  source: 'IBGE';
  sourceDate: string;
  publishedRaw: string;
};
export function parseIbgeNews(
  raw: unknown,
  topic: MarketNews['topic'],
  asOf = new Date().toISOString().slice(0, 10),
): MarketNews[] {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray((raw as { items?: unknown }).items)
  )
    return [];
  return (raw as { items: Record<string, unknown>[] }).items.flatMap((row) => {
    if (
      !row ||
      !['string', 'number'].includes(typeof row.id) ||
      !String(row.id).trim() ||
      typeof row.titulo !== 'string' ||
      !row.titulo.trim() ||
      typeof row.link !== 'string' ||
      typeof row.data_publicacao !== 'string'
    )
      return [];
    const match = row.data_publicacao.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!match) return [];
    const sourceDate = match[3] + '-' + match[2] + '-' + match[1];
    const date = new Date(sourceDate + 'T12:00:00Z');
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== sourceDate ||
      sourceDate > asOf
    )
      return [];
    let url: URL;
    try {
      url = new URL(row.link);
    } catch {
      return [];
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname !== 'agenciadenoticias.ibge.gov.br' ||
      url.username ||
      url.password ||
      url.port
    )
      return [];
    // A API oficial retorna links HTTP; o portal oferece a mesma página em HTTPS.
    url.protocol = 'https:';
    return [
      {
        id: String(row.id),
        topic,
        title: row.titulo.slice(0, 500),
        url: url.href,
        source: 'IBGE' as const,
        sourceDate,
        publishedRaw: row.data_publicacao,
      },
    ];
  });
}
export async function fetchOfficialNews() {
  const products = [
    { id: 21119, topic: 'abate' as const },
    { id: 9203, topic: 'abate' as const },
    { id: 9201, topic: 'safra' as const },
  ];
  const responses = await Promise.allSettled(
    products.map(async (product) => {
      const response = await fetch(
        'https://servicodados.ibge.gov.br/api/v3/noticias/?qtd=5&idproduto=' +
          product.id,
        { signal: AbortSignal.timeout(10000) },
      );
      if (!response.ok) throw new Error('IBGE ' + response.status);
      return parseIbgeNews(await response.json(), product.topic);
    }),
  );
  const items = responses.flatMap((response) =>
    response.status === 'fulfilled' ? response.value : [],
  );
  if (!items.length)
    throw new Error('IBGE sem notícias válidas nesta consulta.');
  return {
    items,
    collectedAt: new Date().toISOString(),
    source: 'IBGE',
    sourceUrl: 'https://servicodados.ibge.gov.br/api/docs/noticias?versao=3',
    note: 'Contexto oficial de abate/safra, não previsão de preço; nenhuma manchete altera margem automaticamente.',
  };
}
