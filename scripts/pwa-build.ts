import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

export function pwaBuild(): Plugin {
  let base = '/boimeta/';
  return {
    name: 'boimeta-pwa',
    configResolved(config) { base = config.base; },
    generateBundle(_options, bundle) {
      const manifest = {
        id: base, name: 'BoiMeta', short_name: 'BoiMeta', lang: 'pt-BR',
        description: 'Simulador agropecuário de custos, margens e metas de produção.',
        start_url: base, scope: base, display: 'standalone',
        background_color: '#f8f8f0', theme_color: '#0d2b1e',
        icons: [192, 512].map((size) => ({ src: 'icons/app-' + size + '.png', sizes: size + 'x' + size, type: 'image/png', purpose: 'any maskable' })),
      };
      const publicRoot = new URL('../public/', import.meta.url);
      const publicFiles = ['favicon.svg', 'icons/app.svg', 'icons/app-192.png', 'icons/app-512.png',
        ...readdirSync(new URL('market-prices/', publicRoot)).filter((name) => /^(?:[A-Z]{2}|fundamentals)\.json$/.test(name)).map((name) => 'market-prices/' + name)];
      const hash = createHash('sha256');
      hash.update(readFileSync(new URL('../pages/index.html', import.meta.url)));
      for (const value of Object.values(bundle)) hash.update(value.type === 'chunk' ? value.code : value.source);
      // Preços usam cache de dados separado: uma coleta não exige reinstalar o app.
      for (const name of publicFiles.filter(name => !name.startsWith('market-prices/'))) {
        hash.update(readFileSync(new URL(name, publicRoot)));
      }
      const template = readFileSync(fileURLToPath(new URL('../pages/service-worker.js', import.meta.url)), 'utf8');
      hash.update(template).update(JSON.stringify(manifest));
      const files = [...new Set(['index.html', ...Object.keys(bundle), 'manifest.webmanifest', ...publicFiles])];
      const worker = template.replace('__APP_VERSION__', JSON.stringify(hash.digest('hex').slice(0, 16)))
        .replace('__APP_BASE__', JSON.stringify(base)).replace('__APP_FILES__', JSON.stringify(files));
      this.emitFile({ type: 'asset', fileName: 'manifest.webmanifest', source: JSON.stringify(manifest, null, 2) });
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker });
    },
  };
}
