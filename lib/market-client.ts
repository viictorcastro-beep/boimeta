declare const __PAGES_BUILD__: boolean;
export const isStaticEdition = typeof __PAGES_BUILD__ !== 'undefined' && __PAGES_BUILD__;

export function marketPricesUrl(uf: string) {
  return isStaticEdition
    ? `${(import.meta as ImportMeta & { env: { BASE_URL: string } }).env.BASE_URL}market-prices/${encodeURIComponent(uf)}.json`
    : `/api/market-prices?uf=${encodeURIComponent(uf)}`;
}

export function marketNewsUrl() {
  return `${(import.meta as ImportMeta & { env: { BASE_URL?: string } }).env.BASE_URL ?? '/'}market-prices/fundamentals.json`;
}
