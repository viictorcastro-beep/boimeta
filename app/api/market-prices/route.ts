import { fetchConabPrices, VALID_UFS } from '../../../lib/conab-prices.ts';

export async function GET(request: Request) {
  const uf = new URL(request.url).searchParams.get('uf')?.toUpperCase() ?? 'BA';
  if (!VALID_UFS.has(uf)) return Response.json({ error: 'UF inválida.' }, { status: 400 });
  try {
    return Response.json(await fetchConabPrices(uf), {
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Fonte indisponível.' }, { status: 502 });
  }
}
