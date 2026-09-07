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
  const { ParameterAdjustment } = await server.ssrLoadModule('../components/parameter-adjustment.tsx');
  const events = [];
  const adjustment = ParameterAdjustment({ label: 'Teste', value: 400, suffix: 'ha', min: 1, max: 5000, step: 1, onChange: value => events.push(value) });
  const [stepper, mouseWrapper] = adjustment.props.children;
  assert.equal(mouseWrapper.props.children.props.thumbAlignment, 'center', 'barra não depende de medir um elemento inicialmente oculto');
  const [decrease, , increase] = stepper.props.children;
  assert.equal(increase.props.onPointerDown, undefined, 'não alterar ao começar gesto');
  increase.props.onClick({currentTarget: {focus: () => events.push('focus')}});
  assert.deepEqual(events, ['focus', 401], 'encerrar rascunho antes do incremento');
  events.length = 0;
  decrease.props.onClick({currentTarget: {focus: () => events.push('focus')}});
  assert.deepEqual(events, ['focus', 399]);
  events.length = 0;
  mouseWrapper.props.children.props.onValueChange([450], {event:{type:'touchmove'}, cancel:()=>events.push('cancel')});
  assert.deepEqual(events, ['cancel'], 'touch não chega ao modelo');
  const html = renderToString(React.createElement(Page));
  assert.match(html, /BoiMeta/);
  assert.match(html, /Premissas &amp; caixa/);
  assert.match(html, /O mercado está ajudando ou pressionando/);
  assert.match(html, /Usar base produtiva/);
  assert.match(html, /Recriar, terminar ou investir no cocho/);
  assert.match(html, /Pecuária C/);
  assert.match(html, /sem prêmio embutido/);
  assert.match(html, /value="30\.000\.000"/);
  assert.match(html, /GMD recria · A\/C/);
  assert.match(html, /GMD ciclo no pivô · B/);
  assert.match(html, /aria-label="Aumentar Área total"/);
  assert.match(html, /aria-label="Diminuir Capital disponível"/);
  assert.match(html.replace(/<!--.*?-->/g, ''), /100\.000 R\$/);
  assert.match(html, /parameter-stepper/);
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
  const { BusinessReview } = await server.ssrLoadModule('../components/business-review.tsx');
  const { calculateCore } = await server.ssrLoadModule('../lib/livestock-model.ts');
  const { rearingOnly } = await server.ssrLoadModule('../lib/rearing-model.ts');
  const invalidAssumptions = { ...defaultAssumptions, entryWeight: 540, pivotExitWeight: 400, saleWeight: 540 };
  const invalidReview = renderToString(React.createElement(BusinessReview, {
    a: invalidAssumptions, core: calculateCore(invalidAssumptions),
    rearing: rearingOnly(invalidAssumptions, 12.5), cash: null, rearingCapital: 0,
    budget: 30000000, gateSourceDate: '', rows: [], controls: null,
  }));
  assert.match(invalidReview, /Corrija os pesos/);
  assert.doesNotMatch(invalidReview, /VPL incremental de triagem/);
  console.log(
    'render-sanity: página renderizada, sem NaN/Infinity; não substitui teste visual em dispositivos.',
  );
} finally {
  await server.close();
}
