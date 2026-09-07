import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath, URL } from 'node:url';
import { pwaBuild } from './scripts/pwa-build';

export default defineConfig({
  root: 'pages',
  publicDir: '../public',
  base: process.env.PAGES_BASE_PATH || '/boimeta/',
  plugins: [react(), pwaBuild()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  define: { __PAGES_BUILD__: 'true' },
  build: { outDir: '../dist-pages', emptyOutDir: true, sourcemap: false },
});
