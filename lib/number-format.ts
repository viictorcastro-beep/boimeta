/** Interface pt-BR. Sem arredondar os valores do modelo nem gravar strings monetárias. */
export function formatNumberBr(value: number) {
  return Number.isFinite(value)
    ? value.toLocaleString('pt-BR', { maximumFractionDigits: 12 })
    : '';
}

export function parseNumberBr(input: string): number | null {
  const text = input
    .trim()
    .replace(/^R\$\s*/, '')
    .replace(/[\s\u00a0]/g, '')
    .replace(/−/g, '-');
  if (!text) return null;
  let normalized: string;
  if (text.includes(',')) {
    if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d*$/.test(text)) return null;
    normalized = text.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(text)) {
    normalized = text.replace(/\./g, '');
  } else if (/^[+-]?\d+(?:\.\d*)?$/.test(text)) {
    normalized = text;
  } else return null;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : null;
}

export function boundedNumber(value: number, min = -Infinity, max = Infinity) {
  return Math.min(max, Math.max(min, value));
}
