import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../dist-pages/', import.meta.url);
const source = readFileSync(new URL('sw.js', root), 'utf8');
const manifest = JSON.parse(readFileSync(new URL('manifest.webmanifest', root), 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.scope, manifest.start_url);
assert.equal(manifest.id, manifest.scope);
for (const icon of manifest.icons) {
  const data = readFileSync(new URL(icon.src, root));
  const size = Number(icon.sizes.split('x')[0]);
  assert.equal(data.readUInt32BE(16), size);
  assert.equal(data.readUInt32BE(20), size);
}
const handlers = {};
const stores = new Map();
const origin = 'https://example.github.io';
const keyOf = (key) => new URL(typeof key === 'string' ? key : key.url, origin).pathname;
const cacheApi = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async addAll(paths) { for (const path of paths) { assert.ok(path.startsWith(manifest.scope)); assert.ok(existsSync(new URL(path.slice(manifest.scope.length), root)), path); store.set(path, new Response(readFileSync(new URL(path.slice(manifest.scope.length), root)))); } },
      async match(key) { return store.get(keyOf(key))?.clone(); },
      async put(key, response) { store.set(keyOf(key), response); },
    };
  },
  async keys() { return [...stores.keys()]; },
  async delete(key) { return stores.delete(key); },
};
let skip = 0;
let network = async () => { throw new Error('offline'); };
vm.runInNewContext(source, {
  self: { location: { origin }, addEventListener: (name, callback) => { handlers[name] = callback; }, skipWaiting: async () => { skip++; }, clients: { claim: async () => {} } },
  caches: cacheApi, URL, Response, AbortController, setTimeout, clearTimeout,
  fetch: (...args) => network(...args),
});
/** @type {Promise<unknown>} */
let work = Promise.resolve();
handlers.install({ waitUntil: (promise) => { work = promise; } });
await work;
assert.equal(skip, 0, 'Do not activate an update without user choice');
stores.set('unrelated-project', new Map());
stores.set('boimeta:' + manifest.scope + ':old-version', new Map());
handlers.activate({ waitUntil: (promise) => { work = promise; } });
await work;
assert.ok(stores.has('unrelated-project'));
assert.ok(!stores.has('boimeta:' + manifest.scope + ':old-version'));
function request(path, mode = 'cors') {
  /** @type {Promise<Response> | undefined} */
  let response;
  handlers.fetch({ request: { url: origin + path, method: 'GET', mode }, respondWith: (promise) => { response = promise; } });
  return response;
}
assert.equal(request('/different-app/'), undefined);
const html = await (await request(manifest.scope, 'navigate')).text();
assert.match(html, /BoiMeta/);
const pricePath = manifest.scope + 'market-prices/BA.json';
const original = JSON.parse(readFileSync(new URL('market-prices/BA.json', root), 'utf8'));
const offline = await (await request(pricePath)).json();
assert.deepEqual(offline.quotes, original.quotes, 'Offline must preserve quote dates and values');
assert.deepEqual(offline.history, original.history, 'Offline preserves the observed series');
network = async () => new Response('<html>upstream error</html>');
assert.deepEqual((await (await request(pricePath)).json()).quotes, original.quotes);
network = async () => new Response(JSON.stringify({ ...original, history: [], quotes: [original.quotes[0]] }));
assert.equal((await (await request(pricePath)).json()).quotes.length, original.quotes.length, 'Partial response must not erase saved products');
assert.equal((await (await request(pricePath)).json()).history.length, original.history.length, 'Partial snapshot must not erase dated history');
const newsPath = manifest.scope + 'market-prices/fundamentals.json';
const originalNews = JSON.parse(readFileSync(new URL('market-prices/fundamentals.json', root), 'utf8'));
network = async () => { throw new Error('offline'); };
assert.deepEqual((await (await request(newsPath)).json()).items, originalNews.items);
const freshNews = { ...originalNews, collectedAt: '2026-12-01T00:00:00Z' };
network = async () => new Response(JSON.stringify(freshNews));
assert.equal((await (await request(newsPath)).json()).collectedAt, freshNews.collectedAt);
network = async () => new Response(JSON.stringify(originalNews));
assert.equal((await (await request(newsPath)).json()).collectedAt, freshNews.collectedAt, 'Stale network must not replace newer news');
network = async () => new Response('<html>upstream error</html>');
assert.deepEqual((await (await request(newsPath)).json()).items, freshNews.items);
handlers.message({ data: { type: 'ACTIVATE_UPDATE' } });
assert.equal(skip, 1);
console.log('PWA: manifest, PNG dimensions, complete precache, cache isolation, explicit updates, offline shell, dated fallback and partial-market preservation OK.');
