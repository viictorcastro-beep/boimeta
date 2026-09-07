import assert from 'node:assert/strict';
import { ignoreSliderGesture, numericBlurValue, stepParameter } from '../lib/parameter-interaction.ts';

let checks = 0;
function test(name, run) { run(); checks++; console.log(`ok ${checks} - ${name}`); }
test('toque, movimento e cancelamento nunca editam a barra', () => {
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) assert.equal(ignoreSliderGesture({ type }), true);
});
test('dedo e caneta protegidos mesmo em laptop híbrido', () => {
  for (const pointerType of ['touch', 'pen']) assert.equal(ignoreSliderGesture({ type: 'pointerdown', pointerType }), true);
});
test('rolagem de mouse não vira edição', () => assert.equal(ignoreSliderGesture({ type: 'wheel' }), true));
test('mouse e teclado intencionais continuam permitidos', () => {
  assert.equal(ignoreSliderGesture({ type: 'pointerdown', pointerType: 'mouse' }), false);
  assert.equal(ignoreSliderGesture({ type: 'keydown' }), false);
  assert.equal(ignoreSliderGesture({ type: 'input' }), false);
});
test('um toque altera um passo sem acelerar valores grandes', () => {
  assert.equal(stepParameter(30000000, 1, 100000, 0, 200000000), 30100000);
  assert.equal(stepParameter(30000000, -1, 100000, 0, 200000000), 29900000);
});
test('decimais e valores fora da grade conservam precisão', () => {
  assert.equal(stepParameter(0.78, 1, 0.01, 0.2, 2), 0.79);
  assert.equal(stepParameter(13.3333, 1, 0.1, 1, 40), 13.4333);
  assert.equal(stepParameter(0.3, -1, 0.1, 0, 1), 0.2);
});
test('passos nunca ultrapassam limites, inclusive negativos', () => {
  assert.equal(stepParameter(1, -1, 1, 1, 5000), 1);
  assert.equal(stepParameter(1.999, 1, 0.01, 0.2, 2), 2);
  assert.equal(stepParameter(-5, -1, 1, -5, 5), -5);
});
test('passo inválido não modifica o valor', () => {
  for (const step of [0, -1, Infinity, NaN]) assert.equal(stepParameter(1, 1, step, 0, 5), 1);
});
test('focar e sair sem edição não regrava nem limita dado carregado', () => {
  assert.equal(numericBlurValue('1.000', false, 0, 500), null);
  assert.equal(numericBlurValue('30.000.000', false, 0, 200000000), null);
});
test('edição explícita aceita pt-BR; inválido não é corrigido silenciosamente', () => {
  assert.equal(numericBlurValue('1.234,56', true, 0, 5000), 1234.56);
  assert.equal(numericBlurValue('1.000', true, 0, 500), null);
  assert.equal(numericBlurValue('', true, 0, 500), null);
  assert.equal(numericBlurValue('abc', true, 0, 500), null);
});
console.log(`parameter-interaction: ${checks} testes passaram; não substituem gestos em aparelhos físicos.`);
