import { calculateCore, type Assumptions } from './livestock-model.ts';
import {
  calculateCrop,
  calculateDoubleCrop,
  type CropAssumption,
} from './crop-model.ts';
import {
  cattleStartupCash,
  cattleCapitalRequirement,
} from './decision-review.ts';
import {
  rearingOnly,
  rearingStartupCash,
  rearingCapitalRequirement,
} from './rearing-model.ts';
import {
  calculateMonthlyCashFlow,
  cropCashEvents,
} from './operational-model.ts';
import { pastureCapacity } from './pasture-capacity.ts';

export type EnterpriseId =
  | 'cattle-a'
  | 'cattle-b'
  | 'cattle-c'
  | CropAssumption['id']
  | 'double-crop';
export type LabInput = {
  a: Assumptions;
  calfCostC: number;
  gateNetPrice: number;
  budget: number;
  anchor: string;
  setupDays: number;
  setupCost: number;
  reserveCash: number;
  cornDelivered: number;
  crops: CropAssumption[];
  windows: Record<
    string,
    { plant: string; harvest: string; eligible: boolean }
  >;
  doubleWindow: {
    soyPlant: string;
    soyHarvest: string;
    cornPlant: string;
    cornHarvest: string;
    eligible: boolean;
  };
  desiredUa: number;
  forage: Parameters<typeof pastureCapacity>[1];
};
export const enterpriseLabels: Record<EnterpriseId, string> = {
  'cattle-a': 'A · recria + cocho',
  'cattle-b': 'B · terminação no pasto',
  'cattle-c': 'C · recria e venda',
  'soy-irrigated': 'Soja irrigada',
  'corn-irrigated': 'Milho irrigado',
  'cotton-irrigated': 'Algodão irrigado',
  'double-crop': 'Soja + milho',
};
export const enterpriseIds = Object.keys(enterpriseLabels) as EnterpriseId[];
const validWindow = (plant: string, harvest: string) => {
  const valid = (v: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(v) &&
    Number.isFinite(Date.parse(v)) &&
    new Date(v).toISOString().slice(0, 10) === v;
  return valid(plant) && valid(harvest) && plant < harvest;
};
export type EnterpriseResult = {
  id: EnterpriseId;
  area: number;
  valid: boolean;
  revenue: number;
  cost: number;
  margin: number;
  capital: number;
  sold: number;
  pastureHeads: number;
  feedlotHeads: number;
  bottleneck: string;
  idleArea: number;
  idleLease: number;
  breakEven: number | null;
  breakEvenUnit: string;
};

/** Mesmo sistema, outra escala. CAPEX não é rateado nem cancelado pelo caixa curto.
 * Custos/produção da área não operada não são inventados; seu arrendamento permanece. */
export function enterpriseAtArea(
  input: LabInput,
  id: EnterpriseId,
  requestedArea: number,
): EnterpriseResult {
  const area = Math.max(0, Math.min(input.a.totalArea, requestedArea));
  const idleArea = Math.max(0, input.a.totalArea - area);
  const idleLease = idleArea * input.a.landLeaseHa;
  const a = { ...input.a, totalArea: area };
  const common = a.pivotInvestment + input.setupCost + input.reserveCash;
  const empty: EnterpriseResult = {
    id,
    area,
    valid: false,
    revenue: 0,
    cost: idleLease,
    margin: -idleLease,
    capital: idleLease + input.reserveCash,
    sold: 0,
    pastureHeads: 0,
    feedlotHeads: 0,
    bottleneck: 'sem operação',
    idleArea,
    idleLease,
    breakEven: null,
    breakEvenUnit: '',
  };
  if (!(area > 0)) return empty;
  if (id === 'cattle-a' || id === 'cattle-b') {
    const route = id === 'cattle-a' ? 'A' : 'B';
    const c = calculateCore(a);
    const cash = cattleStartupCash(
      a,
      route,
      input.anchor,
      input.setupDays,
      input.setupCost,
    );
    const days = route === 'A' ? c.daysPivotA + c.daysFeedlot : c.daysB;
    const capital =
      cattleCapitalRequirement(
        a,
        route,
        cash?.peakFundingNeed ?? 0,
        input.setupCost,
        input.reserveCash,
      ).required +
      idleLease * Math.max(1, (days + 1) / 365);
    const priceSlope =
      (((route === 'A' ? c.soldA : c.soldB) *
        a.saleWeight *
        Math.min(
          100,
          a.carcassYieldPercent +
            (route === 'A' ? a.feedlotCarcassYieldLiftPercent : 0),
        )) /
        1500) *
      (1 - a.saleDeductionPercent / 100);
    const breakEven =
      priceSlope > 0
        ? a.priceArroba -
          ((route === 'A' ? c.ebitdaA : c.ebitdaB) - idleLease) / priceSlope
        : null;
    return {
      ...empty,
      valid:
        Boolean(cash) &&
        (route === 'A' ? c.routeAInputValid : c.routeBInputValid),
      revenue: route === 'A' ? c.netRevenueA : c.netRevenueB,
      cost: (route === 'A' ? c.cashCostsA : c.cashCostsB) + idleLease,
      margin: (route === 'A' ? c.ebitdaA : c.ebitdaB) - idleLease,
      capital,
      sold: route === 'A' ? c.soldA : c.soldB,
      pastureHeads:
        route === 'A'
          ? (c.entrantsA * c.daysPivotA) / 365
          : (c.entrantsB * c.daysB) / 365,
      feedlotHeads: route === 'A' ? c.confinementOccupancy : 0,
      bottleneck: route === 'A' ? c.bindingConstraintA : 'pasto / desempenho',
      breakEven: breakEven !== null && breakEven >= 0 ? breakEven : null,
      breakEvenUnit: 'R$/@',
    };
  }
  if (id === 'cattle-c') {
    const cAssumptions = { ...a, calfCost: input.calfCostC };
    const c = rearingOnly(cAssumptions, input.gateNetPrice);
    const cash = rearingStartupCash(
      cAssumptions,
      input.gateNetPrice,
      input.anchor,
      input.setupDays,
      input.setupCost,
    );
    return {
      ...empty,
      valid: c.valid && cash !== null,
      revenue: c.revenue,
      cost: c.costs + idleLease,
      margin: c.margin - idleLease,
      capital:
        rearingCapitalRequirement(
          cAssumptions,
          input.gateNetPrice,
          cash?.peakFundingNeed ?? 0,
          input.setupCost,
          input.reserveCash,
        ).required +
        idleLease * Math.max(1, c.days / 365),
      sold: c.sold,
      pastureHeads: c.simultaneousHeads,
      bottleneck: 'pasto / reposição',
      breakEven:
        c.sold * a.pivotExitWeight > 0
          ? (c.costs + idleLease) / (c.sold * a.pivotExitWeight)
          : null,
      breakEvenUnit: 'R$/kg vivo líquido',
    };
  }
  const soy = input.crops.find((c) => c.id === 'soy-irrigated');
  const corn = input.crops.find((c) => c.id === 'corn-irrigated');
  if (id === 'double-crop') {
    if (!soy || !corn) return empty;
    const w = input.doubleWindow;
    if (
      !validWindow(w.soyPlant, w.soyHarvest) ||
      !validWindow(w.cornPlant, w.cornHarvest) ||
      w.soyHarvest > w.cornPlant ||
      (Date.parse(w.cornHarvest) - Date.parse(w.soyPlant)) / 86400000 > 365
    )
      return empty;
    const r = calculateDoubleCrop(soy, corn, area, a.landLeaseHa);
    const s = calculateCrop(soy, area),
      m = calculateCrop(corn, area);
    const deductions = (s.deductionsHa + m.deductionsHa) * area;
    // Todos os eventos até a segunda colheita; a receita da soja pode custear o milho.
    const cash = calculateMonthlyCashFlow([
      ...cropCashEvents(
        soy,
        area,
        w.soyPlant,
        w.soyHarvest,
        a.landLeaseHa,
        true,
      ),
      ...cropCashEvents(
        corn,
        area,
        w.cornPlant,
        w.cornHarvest,
        a.landLeaseHa,
        false,
      ),
    ]);
    return {
      ...empty,
      valid: w.eligible && cash.rows.length > 0,
      revenue: r.revenue - deductions,
      cost: r.totalCost - deductions + idleLease,
      margin: r.margin - idleLease,
      capital: cash.peakFundingNeed + common + idleLease,
      bottleneck: 'janela / água / máquinas',
    };
  }
  const crop = input.crops.find((c) => c.id === id),
    w = input.windows[id];
  if (!crop || !w || !validWindow(w.plant, w.harvest)) return empty;
  const c = calculateCrop(crop, area, a.landLeaseHa);
  const cash = calculateMonthlyCashFlow(
    cropCashEvents(crop, area, w.plant, w.harvest, a.landLeaseHa),
  );
  return {
    ...empty,
    valid: w.eligible && cash.rows.length > 0,
    revenue: c.revenue - c.deductionsHa * area,
    cost: c.totalCost - c.deductionsHa * area + idleLease,
    margin: c.margin - idleLease,
    capital: cash.peakFundingNeed + common + idleLease,
    bottleneck: 'produtividade / custo / preço',
    breakEven:
      c.production * (1 - crop.deductionRate / 100) > 0
        ? (c.totalCost - c.deductionsHa * area + idleLease) /
          (c.production * (1 - crop.deductionRate / 100))
        : null,
    breakEvenUnit: 'R$/' + crop.unit.split('/')[0],
  };
}

export function affordableEnterprise(input: LabInput, id: EnterpriseId) {
  const cache = new Map<number, EnterpriseResult>();
  const at = (ha: number) => {
    if (!cache.has(ha)) cache.set(ha, enterpriseAtArea(input, id, ha));
    return cache.get(ha)!;
  };
  const full = at(input.a.totalArea);
  let lo = 0,
    hi = Math.floor(Math.max(0, input.a.totalArea));
  if (full.valid) {
    while (lo < hi) {
      const middle = Math.ceil((lo + hi) / 2),
        r = at(middle);
      if (r.valid && r.capital <= input.budget + 1e-6) lo = middle;
      else hi = middle - 1;
    }
  } else lo = 0;
  const maximumArea =
    full.valid && full.capital <= input.budget + 1e-6 ? input.a.totalArea : lo;
  const areas = new Set([0, maximumArea]);
  for (let i = 1; i <= 20; i++) areas.add(Math.floor((maximumArea * i) / 20));
  // Ponto não linear: acima dele o cocho não vende mais animais, mas a área custa.
  if (id === 'cattle-a') {
    const unit = calculateCore({
      ...input.a,
      totalArea: 1,
      feedlotCapacity: undefined,
    });
    const capacity =
      ((input.a.feedlotCapacity ?? Infinity) *
        (input.a.feedlotUtilization ?? 100)) /
      100;
    const saturationArea = capacity / unit.confinementOccupancy;
    for (const h of [Math.floor(saturationArea), Math.ceil(saturationArea)])
      if (Number.isFinite(h) && h >= 0 && h <= maximumArea) areas.add(h);
  }
  const candidates = [...areas]
    .map(at)
    .filter((r) => r.area > 0 && r.valid && r.capital <= input.budget + 1e-6);
  const bestOperating =
    candidates.sort(
      (x, y) => y.margin - x.margin || x.capital - y.capital,
    )[0] ?? null;
  const best =
    bestOperating && bestOperating.margin > at(0).margin
      ? bestOperating
      : at(0);
  return {
    id,
    full,
    maximumArea,
    best,
    bestOperating,
    testedAreas: areas.size,
    shortfall: Math.max(0, full.capital - input.budget),
    spareCash: Math.max(0, input.budget - best.capital),
  };
}

export function capitalStudy(input: LabInput) {
  const rows = enterpriseIds.map((id) => affordableEnterprise(input, id));
  const eligible = rows
    .filter((r) => r.best.area > 0 && r.best.valid)
    .sort((x, y) => y.best.margin - x.best.margin);
  return { rows, leader: eligible[0] ?? null, runnerUp: eligible[1] ?? null };
}

/** Equivalência financeira, NÃO liberação de hectares/água/pivôs adicionais. */
export function inverseCropCapital(
  input: LabInput,
  cattleId: 'cattle-a' | 'cattle-b' | 'cattle-c',
) {
  const reference = enterpriseAtArea(input, cattleId, input.a.totalArea);
  const fixed = input.a.pivotInvestment + input.setupCost + input.reserveCash;
  return {
    reference,
    rows: input.crops.map((crop) => {
      const full = enterpriseAtArea(input, crop.id, input.a.totalArea);
      const variableHa =
        input.a.totalArea > 0 ? (full.capital - fixed) / input.a.totalArea : 0;
      const farmLease = input.a.totalArea * input.a.landLeaseHa;
      // Dentro da fazenda paga-se seu arrendamento inteiro, inclusive ocioso.
      // Acima dela, a equivalência inclui arrendamento também nos hectares extras.
      const partialVariableHa = variableHa - input.a.landLeaseHa;
      const equivalentArea =
        variableHa > 0 && reference.valid && full.valid
          ? reference.capital >= full.capital
            ? Math.max(0, reference.capital - fixed) / variableHa
            : partialVariableHa > 0
              ? Math.max(0, reference.capital - fixed - farmLease) /
                partialVariableHa
              : 0
          : null;
      const usableArea =
        equivalentArea === null
          ? 0
          : Math.min(input.a.totalArea, equivalentArea);
      const local = enterpriseAtArea(input, crop.id, usableArea);
      return {
        id: crop.id,
        equivalentArea,
        extraArea:
          equivalentArea === null
            ? null
            : Math.max(0, equivalentArea - input.a.totalArea),
        local,
      };
    }),
  };
}

export function stockingStudy(input: LabInput) {
  return [...new Set([input.desiredUa, 10, 15])]
    .sort((a, b) => a - b)
    .map((desired) => {
      const capacity = pastureCapacity(desired, input.forage);
      const a = { ...input.a, stockingUa: capacity.effectiveUa };
      const c = calculateCore(a);
      const averageA = (a.entryWeight + a.pivotExitWeight) / 2;
      const averageB = (a.entryWeight + a.saleWeight) / 2;
      const pastureUaA = c.pastureAreaA * capacity.effectiveUa;
      const routedUaA = (((c.entrantsA * c.daysPivotA) / 365) * averageA) / 450;
      const meanUaAWithFeedlot =
        routedUaA +
        (c.confinementOccupancy * (a.pivotExitWeight + a.saleWeight)) / 2 / 450;
      const selected = { ...input, a, desiredUa: desired };
      let balancedShare = a.silageShare,
        balancedMargin = c.ebitdaA;
      for (let share = 5; share <= 80; share++) {
        const trial = calculateCore({ ...a, silageShare: share });
        if (trial.routeAInputValid && trial.ebitdaA > balancedMargin) {
          balancedShare = share;
          balancedMargin = trial.ebitdaA;
        }
      }
      const balanced = enterpriseAtArea(
        { ...selected, a: { ...a, silageShare: balancedShare } },
        'cattle-a',
        a.totalArea,
      );
      return {
        desired,
        applied: capacity.effectiveUa,
        known: capacity.known,
        limited: capacity.limited,
        balanced,
        balancedShare,
        pastureAreaA: c.pastureAreaA,
        silageArea: c.silageArea,
        pastureUaA,
        pastureUaPerTotalArea: a.totalArea > 0 ? pastureUaA / a.totalArea : 0,
        pastureHeadsPotentialA:
          averageA > 0 ? (pastureUaA * 450) / averageA : 0,
        pastureHeadsRoutedA: (c.entrantsA * c.daysPivotA) / 365,
        meanUaAWithFeedlot,
        wholeFarmUaPerHa:
          a.totalArea > 0 ? meanUaAWithFeedlot / a.totalArea : 0,
        pastureUaB: a.totalArea * capacity.effectiveUa,
        pastureHeadsB:
          averageB > 0
            ? (a.totalArea * capacity.effectiveUa * 450) / averageB
            : 0,
        rows: (['cattle-a', 'cattle-b', 'cattle-c'] as const).map((id) =>
          enterpriseAtArea(selected, id, a.totalArea),
        ),
        requiredProducedDmHa:
          input.forage.intakePercent > 0 &&
          input.forage.grazingEfficiencyPercent > 0
            ? (((desired * 450 * input.forage.intakePercent) / 100) * 365) /
              (input.forage.grazingEfficiencyPercent / 100) /
              1000
            : null,
      };
    });
}

/** Melhor divisão testada, sem adicionar hectares, vagas, crédito ou prêmios. */
export function feedlotTurningPoints(input: LabInput) {
  let a = input.a;
  let best = calculateCore(a);
  for (let tenth = 50; tenth <= 800; tenth++) {
    const trial = { ...input.a, silageShare: tenth / 10 };
    const c = calculateCore(trial);
    if (c.routeAInputValid && c.ebitdaA > best.ebitdaA) {
      a = trial;
      best = c;
    }
  }
  const local = { ...input, a };
  const balanced = enterpriseAtArea(local, 'cattle-a', a.totalArea);
  const compare = (id: 'cattle-b' | 'cattle-c') => {
    const alternative = enterpriseAtArea(local, id, a.totalArea);
    const baseDifference = balanced.margin - alternative.margin;
    const shiftedA = calculateCore({ ...a, priceArroba: a.priceArroba + 1 });
    const slope =
      shiftedA.ebitdaA -
      best.ebitdaA -
      (id === 'cattle-b' ? shiftedA.ebitdaB - best.ebitdaB : 0);
    const price =
      Math.abs(slope) > 1e-7 ? a.priceArroba - baseDifference / slope : null;
    return {
      id,
      alternative,
      difference: baseDifference,
      price:
        price !== null && price >= 0 && Number.isFinite(price) ? price : null,
      direction:
        slope > 0 ? 'acima' : slope < 0 ? 'abaixo' : 'sem sensibilidade',
    };
  };
  return {
    balanced,
    silageShare: a.silageShare,
    comparisons: [compare('cattle-b'), compare('cattle-c')],
    valid: balanced.valid,
    dietPrice: a.dietPriceDm,
  };
}

export type MarginLever = {
  label: string;
  value: number;
  unit: string;
  group: string;
  field?: string;
  warning: string;
  result: EnterpriseResult;
  delta: number;
  extraCapital: number;
};
export function marginLevers(
  input: LabInput,
  id: EnterpriseId,
  direction: 'improve' | 'pressure' = 'improve',
) {
  const base = enterpriseAtArea(input, id, input.a.totalArea);
  if (!base.valid) return { base, rows: [] as MarginLever[] };
  const s = direction === 'improve' ? 1 : -1;
  const rows: MarginLever[] = [];
  const add = (
    label: string,
    value: number,
    unit: string,
    patch: Partial<LabInput>,
    group: string,
    field: string | undefined,
    warning: string,
  ) => {
    const result = enterpriseAtArea(
      { ...input, ...patch },
      id,
      input.a.totalArea,
    );
    if (result.valid)
      rows.push({
        label,
        value,
        unit,
        group,
        field,
        warning,
        result,
        delta: result.margin - base.margin,
        extraCapital: result.capital - base.capital,
      });
  };
  const ap = (
    label: string,
    key: keyof Assumptions,
    factor: number,
    unit: string,
    group: string,
    field: string | undefined,
    warning: string,
  ) => {
    const value = Number(input.a[key]) * factor;
    add(
      label,
      value,
      unit,
      { a: { ...input.a, [key]: value } },
      group,
      field,
      warning,
    );
  };
  if (id.startsWith('cattle')) {
    if (id === 'cattle-c')
      add(
        'Venda do magro: ' + (s > 0 ? '+5%' : '−5%'),
        input.gateNetPrice * (1 + s * 0.05),
        'R$/kg vivo',
        { gateNetPrice: input.gateNetPrice * (1 + s * 0.05) },
        'cattle',
        'Magro · valor líquido na porteira',
        'Hipótese de preço líquido local, não previsão.',
      );
    else
      ap(
        'Venda do boi: ' + (s > 0 ? '+5%' : '−5%'),
        'priceArroba',
        1 + s * 0.05,
        'R$/@',
        'cattle',
        'Arroba do boi',
        'Teste de preço, sem prêmio de exportação.',
      );
    const calf =
      (id === 'cattle-c' ? input.calfCostC : input.a.calfCost) * (1 - s * 0.05);
    add(
      'Compra da reposição: ' + (s > 0 ? '−5%' : '+5%'),
      calf,
      'R$/cab',
      { a: { ...input.a, calfCost: calf }, calfCostC: calf },
      'cattle',
      'Bezerro de 240 kg',
      'Mesmo peso e qualidade; desconto precisa existir na praça.',
    );
    const key =
      id === 'cattle-a'
        ? 'gmdFeedlot'
        : id === 'cattle-b'
          ? 'gmdB'
          : 'gmdPivotA';
    ap(
      'Ganho diário: ' + (s > 0 ? '+10%' : '−10%'),
      key,
      1 + s * 0.1,
      'kg/d',
      'cattle',
      id === 'cattle-a'
        ? 'GMD no confinamento'
        : id === 'cattle-b'
          ? 'GMD ciclo no pivô · B'
          : 'GMD recria · A/C',
      'Sensibilidade com consumo e custos informados. Uma dieta/manejo novos precisam de orçamento adicional.',
    );
    if (id === 'cattle-a' && input.a.linkFeedToCropCosts) {
      const value = input.cornDelivered * (1 - s * 0.05);
      const fraction = Math.max(
        0,
        1 -
          input.a.forageShare / 100 -
          (input.a.otherIngredientSharePercent ?? 0) / 100,
      );
      add(
        'Milho entregue: ' + (s > 0 ? '−5%' : '+5%'),
        value,
        'R$/sc',
        {
          a: {
            ...input.a,
            dietPriceDm:
              input.a.dietPriceDm +
              ((value - input.cornDelivered) * fraction) / (60 * 0.88),
          },
        },
        'feed',
        'Milho comprado · preço entregue',
        'Preço entregue, sem confundir custo próprio e oportunidade de venda.',
      );
    } else if (id === 'cattle-a')
      ap(
        'Dieta manual: ' + (s > 0 ? '−5%' : '+5%'),
        'dietPriceDm',
        1 - s * 0.05,
        'R$/kg MS',
        'feed',
        'Dieta manual (MS)',
        'Não comprova formulação, conversão ou disponibilidade dos ingredientes.',
      );
    else
      ap(
        'Custeio não animal: ' + (s > 0 ? '−5%' : '+5%'),
        'otherCostFactor',
        1 - s * 0.05,
        '% da base',
        'cattle',
        'Custeio não animal',
        'Não cortar sanidade, adubação ou alimentação mantendo desempenho sem evidência.',
      );
  } else {
    const affected = input.crops.filter((c) =>
      id === 'double-crop' ? c.id !== 'cotton-irrigated' : c.id === id,
    );
    for (const crop of affected) {
      for (const key of ['price', 'yield'] as const) {
        const value = crop[key] * (1 + s * 0.05);
        add(
          crop.shortName +
            (key === 'price' ? ' · preço ' : ' · produtividade ') +
            (s > 0 ? '+5%' : '−5%'),
          value,
          key === 'price' ? 'R$/' + crop.unit.split('/')[0] : crop.unit,
          {
            crops: input.crops.map((c) =>
              c.id === crop.id ? { ...c, [key]: value } : c,
            ),
          },
          'crops',
          (key === 'price' ? 'Preço de venda · ' : 'Produtividade · ') +
            crop.shortName,
          key === 'yield'
            ? 'Produção adicional com custos constantes: é teto de ganho antes de insumos/colheita extras.'
            : 'Não é previsão de mercado; mantém deduções da cultura.',
        );
      }
      add(
        crop.shortName + ' · custos diretos ' + (s > 0 ? '−5%' : '+5%'),
        5,
        '% de variação',
        {
          crops: input.crops.map((c) =>
            c.id === crop.id
              ? {
                  ...c,
                  costItems: c.costItems.map((item) => ({
                    ...item,
                    value: item.value * (1 - s * 0.05),
                  })),
                }
              : c,
          ),
        },
        'crops',
        undefined,
        'Economia de compra/execução precisa ser comprovada sem reduzir a produtividade.',
      );
    }
  }
  return { base, rows: rows.sort((x, y) => y.delta - x.delta) };
}
