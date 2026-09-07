export const SCENARIO_STORAGE_KEY = 'pivo-scenario-v1';
export const SCENARIO_SCHEMA = 1;

export function csvCell(value: string | number) {
  const safe = typeof value === 'string' && /^[\s\uFEFF]*[=+@-]/.test(value)
    ? "'" + value : String(value);
  return '"' + safe.replaceAll('"', '""') + '"';
}

// Accept only the known shape; no executable expressions or prototype keys.
export function validateScenario<T>(document: unknown, template: T): T {
  if (!document || typeof document !== 'object' ||
    (document as { schema?: number }).schema !== SCENARIO_SCHEMA) throw new Error('Versão de cenário incompatível.');
  const walk = (value: unknown, base: unknown, key = ''): unknown => {
    if (typeof base === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e12)
        throw new Error('Número inválido: ' + key);
      if (value < 0 && !/basis|low|high/i.test(key))
        throw new Error('Valor negativo não permitido: ' + key);
      const upper: Record<string, number> = {
        entryWeight: 2500, pivotExitWeight: 2500, saleWeight: 2500,
        entryArrobas: 80, decisionArrobas: 80, totalArea: 1000000,
        gmdPivotA: 10, gmdB: 10, gmdFeedlot: 10, gmd: 10, pastureGmd: 10,
        dietDmDay: 100, horizon: 100, silageCrops: 12,
      };
      if (upper[key] !== undefined && value > upper[key]) throw new Error('Fora do limite físico de simulação: ' + key);
      if ((key.endsWith('Percent') || ['deductionRate', 'fixedRate', 'share', 'silageShare',
        'forageShare', 'silageRecovery', 'carcassYield', 'saleDeduction', 'feedlotMortality',
        'pastureMortality', 'feedlotUtilization', 'cottonFiberRecovery', 'strategyMaxShare'].includes(key)) &&
        value > 100) throw new Error('Percentual acima de 100%: ' + key);
      return value;
    }
    if (typeof base === 'boolean') {
      if (typeof value !== 'boolean') throw new Error('Confirmação inválida: ' + key);
      // Evidence expires: never import execution approvals as fresh validation.
      return /confirmed|eligible/i.test(key) ? false : value;
    }
    if (typeof base === 'string') {
      if (typeof value !== 'string' || value.length > 4000) throw new Error('Texto inválido: ' + key);
      if (key === 'id' && value !== base) throw new Error('Identificador incompatível.');
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const date = new Date(value + 'T12:00:00Z');
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value ||
          Number(value.slice(0, 4)) < 1900 || Number(value.slice(0, 4)) > 2200)
          throw new Error('Data inválida: ' + key);
      }
      if (/url/i.test(key) && value && !/^https:\/\//i.test(value)) throw new Error('URL não segura.');
      return value;
    }
    if (Array.isArray(base)) {
      if (!Array.isArray(value) || value.length > 500) throw new Error('Lista inválida: ' + key);
      if (!base.length) return [];
      if (value.length !== base.length) throw new Error('Lista incompatível: ' + key);
      return value.map((item, i) => walk(item, base[i], key));
    }
    if (base && typeof base === 'object') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Campo inválido: ' + key);
      return Object.fromEntries(Object.entries(base).map(([name, field]) =>
        [name, walk((value as Record<string, unknown>)[name] ?? field, field, name)]));
    }
    return base;
  };
  const data = walk((document as { data?: unknown }).data, template) as T;
  const assumptions = (data as { assumptions?: Record<string, number> }).assumptions;
  if (assumptions) {
    for (const [key, value] of Object.entries(assumptions)) {
      if (typeof value === 'number' && value < 0) throw new Error('Premissa negativa: ' + key);
    }
    if (assumptions.totalArea <= 0 || assumptions.silageShare > 100 ||
      assumptions.carcassYieldPercent > 100 || assumptions.saleDeductionPercent > 100 ||
      assumptions.forageShare > 100 || assumptions.silageRecovery > 100 ||
      assumptions.gmdPivotA <= 0 || assumptions.gmdB <= 0 || assumptions.gmdFeedlot <= 0 ||
      assumptions.entryWeight <= 0 || assumptions.pivotExitWeight <= assumptions.entryWeight ||
      assumptions.saleWeight <= assumptions.pivotExitWeight || assumptions.horizon < 1 ||
      assumptions.horizon > 100) throw new Error('Confira área, pesos, ganhos, percentuais e horizonte do cenário.');
  }
  return data;
}
