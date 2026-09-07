// Smoke de renderização React em servidor; não automatiza navegador ou cliques.
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
const server = await createServer({
  configFile: 'vite.pages.config.ts',
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const { default: Page } = await server.ssrLoadModule('../app/page.tsx');
  const html = renderToString(React.createElement(Page));
  assert.match(html, /BoiMeta/);
  assert.match(html, /Premissas &amp; caixa/);
  assert.match(html, /O mercado está ajudando ou pressionando/);
  assert.match(html, /Usar base produtiva/);
  assert.doesNotMatch(html, /A vence pelo giro e pela janela complementar/);
  // Base UI inclui scripts de hidratação com Number.isNaN; não são resultados.
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const nonFinite = [
    ...markup.matchAll(/.{0,130}(?:NaN|Infinity).{0,130}/g),
  ].map((m) => m[0]);
  assert.equal(nonFinite.length, 0, nonFinite.join('\n'));
  const { DecisionReview } = await server.ssrLoadModule(
    '../components/decision-review.tsx',
  );
  const { defaultAssumptions } = await server.ssrLoadModule(
    '../lib/livestock-model.ts',
  );
  const { reviewDefaults } = await server.ssrLoadModule(
    '../lib/decision-review.ts',
  );
  const review = renderToString(
    React.createElement(DecisionReview, {
      assumptions: defaultAssumptions,
      anchor: '2026-09-10',
      config: reviewDefaults,
      operations: {
        setupDays: 0,
        setupCost: 0,
        reserveCash: 0,
        otherIngredientSharePercent: 0,
        openingSilageTonnesDm: 0,
        silageFirstReleaseDays: 150,
        silageCutIntervalDays: 180,
      },
      budget: 6000000,
      onBudget() {},
      onConfig() {},
      onOperation() {},
      exportScenario() {
        return '{}';
      },
      restoreScenario() {},
      onResetReference() {},
    }),
  ).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  assert.ok(
    !/(?:NaN|Infinity)/.test(review),
    'Conferir margem deve renderizar sem números não finitos',
  );
  console.log(
    'render-sanity: página renderizada, sem NaN/Infinity; não substitui teste visual em dispositivos.',
  );
} finally {
  await server.close();
}
