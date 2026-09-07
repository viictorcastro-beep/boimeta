export type AutomaticCropId =
  | 'soy-irrigated'
  | 'corn-irrigated'
  | 'cotton-irrigated';

export type AutomaticCropCalendar = {
  id: AutomaticCropId;
  label: string;
  plantDate: string;
  harvestDate: string;
  availableDate: string;
  lastDeliveryDate: string;
  cycleDays: number;
  waitingDays: number;
  completedWithinHorizon: boolean;
  legalWindow: string;
  sanitaryVoid: string;
  legalBasis: 'official-2026-27' | 'projected-repeat' | 'not-applicable';
  legalAct: string;
  legalNote: string;
  cycleBasis: string;
  rulesCheckedAt: string;
  officialRegistryUrl: string;
  legalSourceUrl: string;
  legalSourceLabel: string;
  cycleSourceUrl: string;
};

export type AutomaticDoubleCropCalendar = {
  soyPlantDate: string;
  soyHarvestDate: string;
  cornPlantDate: string;
  cornHarvestDate: string;
  transitionDays: number;
  totalDays: number;
  completedWithinHorizon: boolean;
  availableDate: string;
  lastDeliveryDate: string;
};

export type AutomaticCalendar = {
  anchorDate: string;
  horizonDays: number;
  horizonEndDate: string;
  location: 'Barra/BA';
  crops: Record<AutomaticCropId, AutomaticCropCalendar>;
  doubleCrop: AutomaticDoubleCropCalendar;
};

const DAY_MS = 86_400_000;
const RULES_CHECKED_AT = '2026-09-01';
const BAHIA_OFFICIAL_REGISTRY_URL = 'https://dool.egba.ba.gov.br/';
const SOY_RULE_URL =
  'https://aiba.org.br/wp-content/uploads/2026/05/adab-portaria-n40-20.05.2026.pdf';
const COTTON_RULE_URL =
  'https://www.legisweb.com.br/legislacao/?id=483198';
const CORN_RULE_URL =
  'https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/sanidade-vegetal/enfezamentos-do-milho';
const SOY_ZARC_URL =
  'https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/bahia/PORTN196SOJABA.pdf';
const CORN_ZARC_URL =
  'https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/bahia/POBFCC1.PDF';
const COTTON_ZARC_URL =
  'https://www.gov.br/agricultura/pt-br/assuntos/riscos-seguro/programa-nacional-de-zoneamento-agricola-de-risco-climatico/portarias/safra-vigente/bahia/PORTN14.PDF';

function parseIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date
    : null;
}

function iso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = parseIso(value);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + Math.ceil(days));
  return iso(date);
}

function daysBetween(start: string, end: string) {
  const first = parseIso(start);
  const second = parseIso(end);
  if (!first || !second) return 0;
  return Math.round((second.getTime() - first.getTime()) / DAY_MS);
}

function minIso(left: string, right: string) {
  return left <= right ? left : right;
}

function nextCrossYearWindowDate(
  anchorDate: string,
  startMonthDay: string,
  endMonthDay: string,
) {
  const anchor = parseIso(anchorDate);
  if (!anchor) return '';
  const anchorYear = anchor.getUTCFullYear();

  for (let startYear = anchorYear - 1; startYear <= anchorYear + 2; startYear += 1) {
    const start = `${startYear}-${startMonthDay}`;
    const end = `${startYear + 1}-${endMonthDay}`;
    if (anchorDate <= end) return anchorDate < start ? start : anchorDate;
  }
  return '';
}

function ruleBasis(plantDate: string, crop: 'soy' | 'cotton') {
  const officialEnd = crop === 'soy' ? '2027-02-28' : '2027-02-10';
  return plantDate >= '2026-11-01' && plantDate <= officialEnd
    ? 'official-2026-27'
    : 'projected-repeat';
}

function buildCrop(
  id: AutomaticCropId,
  label: string,
  anchorDate: string,
  horizonEndDate: string,
  plantDate: string,
  cycleDays: number,
  legalWindow: string,
  sanitaryVoid: string,
  legalBasis: AutomaticCropCalendar['legalBasis'],
  legalAct: string,
  legalNote: string,
  cycleBasis: string,
  officialRegistryUrl: string,
  legalSourceUrl: string,
  legalSourceLabel: string,
  cycleSourceUrl: string,
): AutomaticCropCalendar {
  const harvestDate = addDays(plantDate, cycleDays);
  const completedWithinHorizon = Boolean(
    harvestDate && harvestDate <= horizonEndDate,
  );
  const availableDate = completedWithinHorizon ? harvestDate : '';
  const lastDeliveryDate = completedWithinHorizon
    ? minIso(addDays(harvestDate, 90), horizonEndDate)
    : '';

  return {
    id,
    label,
    plantDate,
    harvestDate,
    availableDate,
    lastDeliveryDate,
    cycleDays,
    waitingDays: daysBetween(anchorDate, plantDate),
    completedWithinHorizon,
    legalWindow,
    sanitaryVoid,
    legalBasis,
    legalAct,
    legalNote,
    cycleBasis,
    rulesCheckedAt: RULES_CHECKED_AT,
    officialRegistryUrl,
    legalSourceUrl,
    legalSourceLabel,
    cycleSourceUrl,
  };
}

/**
 * Builds an operational reference calendar from the cattle-entry date. It is
 * deliberately separate from the steady-state annual economic ranking: the
 * dates qualify physical availability and execution, but never accrue a
 * fraction of annual crop margin.
 */
export function buildAutomaticCalendar(
  anchorDate: string,
  horizonDays = 365,
): AutomaticCalendar {
  if (!parseIso(anchorDate)) {
    throw new Error('Data de entrada do gado inválida.');
  }
  if (!Number.isFinite(horizonDays) || horizonDays < 1) {
    throw new Error('Janela operacional inválida.');
  }

  const horizonEndDate = addDays(anchorDate, horizonDays);
  const soyPlantDate = nextCrossYearWindowDate(anchorDate, '11-01', '02-28');
  const cottonPlantDate = nextCrossYearWindowDate(anchorDate, '11-01', '02-10');
  // The local corn budget is explicitly a second-crop, full-regime premise.
  // Its stand-alone comparison therefore uses the same central seasonal slot
  // as the corn leg of soy -> corn, even when soy is not counted economically.
  // Planting corn on the cattle anchor would silently turn a second-crop budget
  // into a first/isolated-season budget.
  const cornPlantDate = addDays(addDays(soyPlantDate, 115), 5);

  const soy = buildCrop(
    'soy-irrigated',
    'Soja irrigada',
    anchorDate,
    horizonEndDate,
    soyPlantDate,
    115,
    '01/11 a 28/02',
    '01/08 a 31/10',
    ruleBasis(soyPlantDate, 'soy'),
    'Portaria ADAB nº 40, de 20/05/2026',
    'Barra pertence à Região IV. Irrigação não elimina o vazio e o calendário fitossanitário da ADAB.',
    '115 dias, cenário central entre os grupos de 100/115/130 dias do ZARC 2026/27.',
    BAHIA_OFFICIAL_REGISTRY_URL,
    SOY_RULE_URL,
    'cópia integral hospedada pela AIBA',
    SOY_ZARC_URL,
  );
  const corn = buildCrop(
    'corn-irrigated',
    'Milho irrigado',
    anchorDate,
    horizonEndDate,
    cornPlantDate,
    120,
    'sem janela legal fixa identificada na Bahia',
    'não aplicável no modelo legal atual',
    'not-applicable',
    'Sem ato estadual de vazio fixo identificado na revisão de 01/09/2026',
    'A base local é de 2ª safra. A janela central é inferida da sucessão soja→milho (5 dias após a soja), sem contabilizar receita ou custo da soja no cenário milho isolado. Município, híbrido, rotação e risco fitossanitário ainda precisam de validação agronômica.',
    '120 dias, ponto central da faixa de 110–130 dias do ZARC; semeadura até maturidade fisiológica.',
    CORN_RULE_URL,
    CORN_RULE_URL,
    'página técnica oficial do MAPA',
    CORN_ZARC_URL,
  );
  const cotton = buildCrop(
    'cotton-irrigated',
    'Algodão irrigado',
    anchorDate,
    horizonEndDate,
    cottonPlantDate,
    243,
    '01/11 a 10/02',
    '01/09 a 30/10; destruição de restos até 31/08',
    ruleBasis(cottonPlantDate, 'cotton'),
    'Portaria ADAB nº 77, de 29/08/2025',
    'Barra pertence à Região II. Plantio fora da janela exige autorização e não é ativado por padrão.',
    '243 dias mantidos como ciclo total da premissa já usada no simulador. O ZARC apenas informa grupo III ≥151 dias da emergência; ao substituir esta premissa por um grupo ZARC, some 5–10 dias até emergência uma única vez.',
    BAHIA_OFFICIAL_REGISTRY_URL,
    COTTON_RULE_URL,
    'reprodução integral no LegisWeb',
    COTTON_ZARC_URL,
  );

  const doubleSoyPlantDate = soy.plantDate;
  const doubleSoyHarvestDate = addDays(doubleSoyPlantDate, soy.cycleDays);
  const transitionDays = 5;
  const doubleCornPlantDate = addDays(doubleSoyHarvestDate, transitionDays);
  const doubleCornHarvestDate = addDays(doubleCornPlantDate, corn.cycleDays);
  const doubleCompleted = doubleCornHarvestDate <= horizonEndDate;

  return {
    anchorDate,
    horizonDays,
    horizonEndDate,
    location: 'Barra/BA',
    crops: {
      'soy-irrigated': soy,
      'corn-irrigated': corn,
      'cotton-irrigated': cotton,
    },
    doubleCrop: {
      soyPlantDate: doubleSoyPlantDate,
      soyHarvestDate: doubleSoyHarvestDate,
      cornPlantDate: doubleCornPlantDate,
      cornHarvestDate: doubleCornHarvestDate,
      transitionDays,
      totalDays: daysBetween(doubleSoyPlantDate, doubleCornHarvestDate),
      completedWithinHorizon: doubleCompleted,
      availableDate: doubleCompleted ? doubleCornHarvestDate : '',
      lastDeliveryDate: doubleCompleted
        ? minIso(addDays(doubleCornHarvestDate, 90), horizonEndDate)
        : '',
    },
  };
}
