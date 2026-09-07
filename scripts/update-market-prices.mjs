import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchConabPrices, VALID_UFS } from '../lib/conab-prices.ts';
import { mergeMarketHistory } from '../lib/market-signals.ts';
import { fetchOfficialNews } from '../lib/market-news.ts';

// Generated data, never fabricated fallbacks. Preserve each original date.
const folder = new URL('../public/market-prices/', import.meta.url);
await mkdir(folder, { recursive: true });
const ufs = process.env.MARKET_UFS?.split(',') ?? [...VALID_UFS];
const attemptedAt = new Date().toISOString();
const failures = [];
let updated = 0;
for (let i = 0; i < ufs.length; i += 3) {
  await Promise.all(ufs.slice(i, i + 3).map(async (uf) => {
    const destination = new URL(uf + '.json', folder);
    try {
      const current = await fetchConabPrices(uf);
      let old;
      try { old = JSON.parse(await readFile(destination, 'utf8')); } catch {}
      // Janela móvel de 104 semanas; snapshots parciais não apagam observações.
      const historyCutoff = new Date(Date.now() - 728 * 86400000).toISOString().slice(0, 10);
      current.history = mergeMarketHistory(old?.history, old?.quotes, current.history)
        .filter(q => q.uf === uf && q.sourceDate >= historyCutoff);
      const byProduct = new Map((old?.quotes ?? []).map((q) => [q.product, q]));
      for (const q of current.quotes) {
        const previous = byProduct.get(q.product);
        if (!previous || q.sourceDate >= previous.sourceDate) byProduct.set(q.product, q);
      }
      current.quotes = [...byProduct.values()];
      const recentCutoff = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10);
      current.missingProducts = ['soy', 'corn', 'cotton', 'cattle'].filter((p) =>
        !byProduct.has(p) || byProduct.get(p).sourceDate < recentCutoff);
      current.completeness = current.missingProducts.length ? 'partial' : 'complete';
      await writeFile(destination, JSON.stringify({ ...current, delivery: 'scheduled-snapshot' }, null, 2) + '\n');
      updated++;
      console.log(uf + ': snapshot atualizado, ' + current.history.length + ' observações, datas originais preservadas');
    } catch (error) {
      failures.push({ uf, error: error.message });
      console.warn(uf + ': ' + error.message + ' Último arquivo válido preservado, se existente.');
      try { await readFile(destination); } catch {
        await writeFile(destination, JSON.stringify({ uf, quotes: [], error: 'Sem referência publicada para esta UF. Use os preços manuais da simulação.' }) + '\n');
      }
    }
  }));
}
console.log('UFs atualizadas: ' + updated + '/' + ufs.length);
// Registro real da rotina: persistido com a série; não altera a data de observação.
await writeFile(new URL('update-status.json', folder), JSON.stringify({
  attemptedAt, completedAt: new Date().toISOString(), requestedUfs: ufs,
  updatedUfs: updated, failures, lookbackWeeks: 12, retentionWeeks: 104,
  frequency: 'Dias úteis, 09:30 de Brasília; GitHub pode atrasar a execução.',
}, null, 2) + '\n');
if (updated === 0) console.warn('::warning::Nenhuma UF atualizada. Observações anteriores e suas datas foram preservadas.');
try {
  const news = await fetchOfficialNews();
  const target = new URL('fundamentals.json', folder);
  let previous;
  try { previous = JSON.parse(await readFile(target, 'utf8')); } catch {}
  const byId = new Map((previous?.items ?? []).map(item => [item.id, item]));
  news.items.forEach(item => byId.set(item.id, item));
  news.items = [...byId.values()].sort((a, b) => b.sourceDate.localeCompare(a.sourceDate)).slice(0, 30);
  await writeFile(target, JSON.stringify(news, null, 2) + '\n');
  console.log('IBGE: ' + news.items.length + ' notícias datadas de abate/safra; sem efeito automático nos preços.');
} catch {
  console.warn('::warning::IBGE indisponível. Último contexto datado preservado.');
}
