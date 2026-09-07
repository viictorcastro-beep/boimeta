export type EffluentScaleInputs = {
  referenceAreaHa: number;
  referenceDepthMm: number;
  referenceAnnualHeads: number;
  referenceConfinementDays: number;
  currentOwnFeedlotHeadDays: number;
  targetAreaHa: number;
  totalAreaHa: number;
  targetDepthMm: number;
  valueM3: number;
  calibrationSource: string;
  calibrationPeriodStart: string;
  calibrationPeriodEnd: string;
  calibrationPeriodConfirmed: boolean;
  valueSource: string;
  valueDate: string;
  creditConfirmed: boolean;
  agronomicAvailabilityPercent?: number;
  avoidedFertilizerBudgetHa?: number;
  treatmentCostM3?: number;
  applicationCostM3?: number;
  annualFixedOperatingCost?: number;
  /** Destino local informado pelo usuário para o volume que não cabe na área-alvo. */
  excessDestination: string;
  /** Capacidade anual validada da rota informada, no mesmo denominador do excedente. */
  excessDestinationCapacityM3: number;
  excessDestinationConfirmed: boolean;
};

const nonNegative = (value: number) =>
  Number.isFinite(value) ? Math.max(0, value) : 0;

const millisecondsPerDay = 86_400_000;

function parseStrictIsoDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return Math.trunc(timestamp / millisecondsPerDay);
}

/**
 * Scales the 50 ha / 150 mm/year reference module by actual own-feedlot
 * head-days. The calibration is a project assumption, not a claim that
 * pasture or outsourced cattle produce collectable effluent for this farm.
 */
export function calculateEffluentScale(input: EffluentScaleInputs) {
  const totalAreaHa = nonNegative(input.totalAreaHa);
  const targetAreaHa = Math.min(nonNegative(input.targetAreaHa), totalAreaHa);
  const referenceAreaHa = nonNegative(input.referenceAreaHa);
  const referenceDepthMm = nonNegative(input.referenceDepthMm);
  const referenceAnnualHeads = nonNegative(input.referenceAnnualHeads);
  const referenceConfinementDays = nonNegative(
    input.referenceConfinementDays,
  );
  const currentOwnFeedlotHeadDays = nonNegative(
    input.currentOwnFeedlotHeadDays,
  );
  const targetDepthMm = nonNegative(input.targetDepthMm);
  const valueM3 = nonNegative(input.valueM3);
  const calibrationSource = input.calibrationSource.trim();
  const calibrationPeriodStart = input.calibrationPeriodStart.trim();
  const calibrationPeriodEnd = input.calibrationPeriodEnd.trim();
  const calibrationStartDay = parseStrictIsoDay(calibrationPeriodStart);
  const calibrationEndDay = parseStrictIsoDay(calibrationPeriodEnd);
  const calibrationPeriodValid =
    calibrationStartDay !== null &&
    calibrationEndDay !== null &&
    calibrationEndDay > calibrationStartDay;
  const valueSource = input.valueSource.trim();
  const valueDate = input.valueDate.trim();
  const valueDateValid = parseStrictIsoDay(valueDate) !== null;
  const provenanceReady =
    calibrationSource.length > 0 &&
    calibrationPeriodValid &&
    input.calibrationPeriodConfirmed &&
    valueSource.length > 0 &&
    valueDateValid;
  const excessDestination = input.excessDestination.trim();
  const excessDestinationCapacityM3 = nonNegative(
    input.excessDestinationCapacityM3,
  );

  const referenceVolumeM3 = referenceAreaHa * referenceDepthMm * 10;
  const referenceHeadDays =
    referenceAnnualHeads * referenceConfinementDays;
  const calibrationReady =
    referenceVolumeM3 > 0 && referenceHeadDays > 0;
  const volumePerHeadDayM3 = calibrationReady
    ? referenceVolumeM3 / referenceHeadDays
    : 0;
  const availableVolumeM3 =
    currentOwnFeedlotHeadDays * volumePerHeadDayM3;
  const requiredVolumeM3 = targetAreaHa * targetDepthMm * 10;
  const potentialAreaAtTargetDepthHa =
    targetDepthMm > 0 ? availableVolumeM3 / (targetDepthMm * 10) : 0;
  const areaCoveredAtTargetDepthHa = Math.min(
    targetAreaHa,
    potentialAreaAtTargetDepthHa,
  );
  const depthAcrossTargetAreaMm =
    targetAreaHa > 0 ? availableVolumeM3 / (targetAreaHa * 10) : 0;
  const appliedAreaHa = Math.min(
    targetAreaHa,
    areaCoveredAtTargetDepthHa,
  );
  const appliedVolumeM3 = Math.min(availableVolumeM3, requiredVolumeM3);
  const coveragePercent =
    requiredVolumeM3 > 0
      ? Math.min(100, (availableVolumeM3 / requiredVolumeM3) * 100)
      : 0;
  const requiredReferenceModules =
    referenceVolumeM3 > 0 ? requiredVolumeM3 / referenceVolumeM3 : null;
  const currentReferenceModules =
    referenceHeadDays > 0
      ? currentOwnFeedlotHeadDays / referenceHeadDays
      : null;
  const requiredHeadDays =
    volumePerHeadDayM3 > 0
      ? requiredVolumeM3 / volumePerHeadDayM3
      : null;
  const requiredAnnualHeadsAtReferenceStay =
    requiredHeadDays !== null && referenceConfinementDays > 0
      ? requiredHeadDays / referenceConfinementDays
      : null;
  const requiredAverageConfinedHeads =
    requiredHeadDays !== null ? requiredHeadDays / 365 : null;
  const volumeShortfallM3 = Math.max(
    0,
    requiredVolumeM3 - availableVolumeM3,
  );
  const volumeExcessM3 = Math.max(
    0,
    availableVolumeM3 - requiredVolumeM3,
  );
  const excessRequiresDestination = volumeExcessM3 > 1e-6;
  const excessDestinationReady =
    !excessRequiresDestination ||
    (excessDestination.length > 0 &&
      excessDestinationCapacityM3 + 1e-6 >= volumeExcessM3 &&
      input.excessDestinationConfirmed);
  const grossPotentialCredit = appliedVolumeM3 * valueM3;
  const fertilizerCap = appliedAreaHa * nonNegative(input.avoidedFertilizerBudgetHa ?? 0);
  const avoidedFertilizerCost = Math.min(fertilizerCap, grossPotentialCredit *
    Math.min(100, nonNegative(input.agronomicAvailabilityPercent ?? 0)) / 100);
  const operatingCost = availableVolumeM3 * nonNegative(input.treatmentCostM3 ?? 0) +
    appliedVolumeM3 * nonNegative(input.applicationCostM3 ?? 0) + nonNegative(input.annualFixedOperatingCost ?? 0);
  const netPotentialCredit = avoidedFertilizerCost - operatingCost;
  const creditReady =
    input.creditConfirmed &&
    calibrationReady &&
    currentOwnFeedlotHeadDays > 0 &&
    targetAreaHa > 0 &&
    targetDepthMm > 0 &&
    provenanceReady &&
    excessDestinationReady;
  const includedCredit = creditReady ? netPotentialCredit : 0;

  const blockers: string[] = [];
  if (fertilizerCap <= 0) blockers.push('Sem orçamento de fertilizante efetivamente substituível: benefício econômico igual a zero, custos de operação preservados quando ativados.');
  if (referenceAreaHa <= 0 || referenceDepthMm <= 0) {
    blockers.push('Informe área e lâmina do módulo de referência.');
  }
  if (referenceHeadDays <= 0) {
    blockers.push('Informe cabeças e dias no cocho do módulo de referência.');
  }
  if (currentOwnFeedlotHeadDays <= 0) {
    blockers.push(
      'Nenhuma cabeça-dia foi roteada ao confinamento próprio neste cenário.',
    );
  }
  if (targetAreaHa <= 0 || targetDepthMm <= 0) {
    blockers.push('Informe área e lâmina-alvo positivas.');
  }
  if (calibrationSource.length === 0) {
    blockers.push(
      'Informe a fonte do módulo de calibração (volume, área, lâmina e cabeças-dia).',
    );
  }
  if (!calibrationPeriodValid) {
    blockers.push(
      'Informe início e fim válidos do período medido da calibração, com fim posterior ao início.',
    );
  } else if (!input.calibrationPeriodConfirmed) {
    blockers.push(
      `Confirme que os ${Math.round(referenceVolumeM3)} m³ e ${Math.round(referenceHeadDays)} cabeças-dia pertencem ao mesmo período medido (${calibrationPeriodStart} a ${calibrationPeriodEnd}).`,
    );
  }
  if (valueSource.length === 0 || !valueDateValid) {
    blockers.push(
      'Informe fonte e data válidas do valor evitável em R$/m³; o número editável, sozinho, não libera crédito.',
    );
  }
  if (excessRequiresDestination && excessDestination.length === 0) {
    blockers.push(
      `Informe o destino operacional dos ${Math.ceil(volumeExcessM3)} m³ excedentes, sua capacidade anual e o período/responsável; ou reduza a escala do cocho até zerar o excedente.`,
    );
  } else if (
    excessRequiresDestination &&
    excessDestinationCapacityM3 + 1e-6 < volumeExcessM3
  ) {
    blockers.push(
      `A rota informada suporta ${Math.floor(excessDestinationCapacityM3)} m³/ano; valide pelo menos ${Math.ceil(volumeExcessM3)} m³/ano ou reduza a escala do cocho.`,
    );
  } else if (excessRequiresDestination && !input.excessDestinationConfirmed) {
    blockers.push(
      `Confirme que a rota informada suporta os ${Math.ceil(volumeExcessM3)} m³ excedentes no período modelado; esse volume não recebe crédito nesta área-alvo.`,
    );
  }
  if (!input.creditConfirmed) {
    blockers.push(
      'Confirme tratamento, análise, eficiência agronômica e os requisitos regulatórios aplicáveis ao crédito.',
    );
  }

  return {
    totalAreaHa,
    targetAreaHa,
    referenceAreaHa,
    referenceDepthMm,
    referenceAnnualHeads,
    referenceConfinementDays,
    referenceVolumeM3,
    referenceHeadDays,
    calibrationReady,
    volumePerHeadDayM3,
    currentOwnFeedlotHeadDays,
    availableVolumeM3,
    requiredVolumeM3,
    potentialAreaAtTargetDepthHa,
    areaCoveredAtTargetDepthHa,
    depthAcrossTargetAreaMm,
    appliedAreaHa,
    appliedVolumeM3,
    coveragePercent,
    requiredReferenceModules,
    currentReferenceModules,
    requiredHeadDays,
    requiredAnnualHeadsAtReferenceStay,
    requiredAverageConfinedHeads,
    volumeShortfallM3,
    volumeExcessM3,
    calibrationSource,
    calibrationPeriodStart,
    calibrationPeriodEnd,
    calibrationPeriodValid,
    calibrationPeriodConfirmed: input.calibrationPeriodConfirmed,
    valueSource,
    valueDate,
    valueDateValid,
    provenanceReady,
    excessRequiresDestination,
    excessDestination,
    excessDestinationCapacityM3,
    excessDestinationReady,
    grossPotentialCredit,
    fertilizerCap,
    avoidedFertilizerCost,
    operatingCost,
    netPotentialCredit,
    creditReady,
    includedCredit,
    blockers,
  };
}
