/* Build replaces these constants; cache contains public assets, never user scenarios. */
const VERSION = __APP_VERSION__;
const BASE = __APP_BASE__;
const FILES = __APP_FILES__;
const PREFIX = 'boimeta:' + BASE + ':';
const SHELL = PREFIX + VERSION;
const PRICES = PREFIX + 'prices';
const paths = new Set(FILES.map((file) => BASE + file));

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(FILES.map((file) => BASE + file))));
});
self.addEventListener('message', (event) => {
  if (event.data?.type === 'ACTIVATE_UPDATE') void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== SHELL && key !== PRICES).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function marketReference(request) {
  const cache = await caches.open(PRICES);
  const shipped = await (await caches.open(SHELL)).match(request);
  const previous = await cache.match(request);
  async function combine(current, fallback) {
    const data = await current.clone().json();
    const old = fallback ? await fallback.clone().json().catch(() => null) : null;
    const byProduct = new Map();
    for (const quote of [...(old?.quotes || []), ...data.quotes]) {
      const prior = byProduct.get(quote.product);
      if (!prior || quote.sourceDate >= prior.sourceDate) byProduct.set(quote.product, quote);
    }
    const history = new Map();
    for (const quote of [...(old?.history || []), ...(old?.quotes || []), ...(data.history || []), ...data.quotes]) {
      if (quote.uf !== data.uf || !Number.isFinite(quote.value) || quote.value <= 0) continue;
      const key = [quote.uf, quote.product, quote.description, quote.level, quote.displayUnit, quote.periodStart, quote.periodEnd].join('|');
      history.set(key, quote);
    }
    return new Response(JSON.stringify({ ...data, quotes: [...byProduct.values()],
      history: [...history.values()].sort((a, b) => a.sourceDate.localeCompare(b.sourceDate)).slice(-500)
    }), { headers: { 'Content-Type': 'application/json' } });
  }
  const saved = shipped && previous ? await combine(shipped, previous) : shipped || previous;
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), 5000);
  try {
    const response = await fetch(request, { signal: timer.signal, cache: 'no-cache' });
    if (!response.ok) throw new Error('Reference unavailable');
    const data = await response.clone().json();
    if (!Array.isArray(data.quotes) || data.quotes.length === 0 ||
      !data.quotes.every((quote) => Number.isFinite(quote.value) && quote.value > 0 && /^\d{4}-\d{2}-\d{2}$/.test(quote.sourceDate))) throw new Error('Invalid reference');
    const merged = await combine(response, saved);
    await cache.put(request, merged.clone());
    return merged;
  } catch {
    return saved ||
      new Response(JSON.stringify({ quotes: [], error: 'Sem referência salva. Conecte-se para atualizar.' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
  } finally { clearTimeout(timeout); }
}
async function marketNewsReference(request) {
  const cache = await caches.open(PRICES);
  const previous = await cache.match(request);
  const shipped = await (await caches.open(SHELL)).match(request);
  let fallback = previous || shipped;
  if (previous && shipped) {
    const p = await previous.clone().json().catch(() => ({}));
    const s = await shipped.clone().json().catch(() => ({}));
    if ((s.collectedAt || '') > (p.collectedAt || '')) fallback = shipped;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(request, { signal: controller.signal, cache: 'no-cache' });
    const data = await response.clone().json();
    if (!response.ok || data.source !== 'IBGE' || !Array.isArray(data.items) || !data.items.length) throw new Error('No news');
    if (!Number.isFinite(Date.parse(data.collectedAt))) throw new Error('Undated news');
    if (fallback) {
      const saved = await fallback.clone().json().catch(() => ({}));
      if (Date.parse(saved.collectedAt) > Date.parse(data.collectedAt)) return fallback;
    }
    await cache.put(request, response.clone());
    return response;
  } catch {
    return fallback || new Response(JSON.stringify({ items: [], error: 'Sem notícias disponíveis offline.' }), { status: 503 });
  } finally { clearTimeout(timeout); }
}
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  if (/\/market-prices\/[A-Z]{2}\.json$/.test(url.pathname)) {
    event.respondWith(marketReference(event.request));
    return;
  }
  if (url.pathname.endsWith('/market-prices/fundamentals.json')) {
    event.respondWith(marketNewsReference(event.request));
    return;
  }
  if (event.request.mode === 'navigate' && (url.pathname === BASE || url.pathname === BASE + 'index.html')) {
    event.respondWith(caches.open(SHELL).then(async (cache) => await cache.match(BASE + 'index.html') || fetch(event.request)));
    return;
  }
  if (paths.has(url.pathname)) event.respondWith(caches.open(SHELL).then(async (cache) => await cache.match(url.pathname) || fetch(event.request)));
});
