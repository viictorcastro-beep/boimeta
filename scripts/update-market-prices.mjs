import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fetchConabPrices, VALID_UFS } from '../lib/conab-prices.ts';

// Generated data, never fabricated fallbacks. Preserve each original date.
const folder = new URL('../public/market-prices/', import.meta.url);
await mkdir(folder, { recursive: true });
const ufs = process.env.MARKET_UFS?.split(',') ?? [...VALID_UFS];
let updated = 0;
for (let i = 0; i < ufs.length; i += 3) {
  await Promise.all(ufs.slice(i, i + 3).map(async (uf) => {
    const destination = new URL(uf + '.json', folder);
    try {
      const current = await fetchConabPrices(uf);
      let old;
      try { old = JSON.parse(await readFile(destination, 'utf8')); } catch {}
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
      console.log(uf + ': snapshot atualizado, datas originais preservadas');
    } catch (error) {
      console.warn(uf + ': ' + error.message + ' Último arquivo válido preservado, se existente.');
      try { await readFile(destination); } catch {
        await writeFile(destination, JSON.stringify({ uf, quotes: [], error: 'Sem referência publicada para esta UF. Use os preços manuais da simulação.' }) + '\n');
      }
    }
  }));
}
console.log('UFs atualizadas: ' + updated + '/' + ufs.length);
