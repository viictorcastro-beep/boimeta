export type CropCostItem = {
  id: string;
  label: string;
  value: number;
  status: 'base' | 'underwriting';
};

export type CropAssumption = {
  id: 'soy-irrigated' | 'corn-irrigated' | 'cotton-irrigated';
  name: string;
  shortName: string;
  farm: string;
  season: string;
  unit: string;
  yield: number;
  price: number;
  costItems: CropCostItem[];
  deductionRate: number;
  fixedRate: number;
  // Valor por hectare/safra. fixedRate é mantido apenas para importar versões antigas.
  fixedCostHa?: number;
  source: string;
  note: string;
};

export const CORN_UNALLOCATED_BUDGET_HA = 4_800;
export const CORN_DETAIL_COST_IDS = [
  'seed',
  'fertilizer',
  'crop-protection',
  'operations',
  'harvest-logistics',
] as const;

export const cropDefaults: CropAssumption[] = [
  {
    id: 'soy-irrigated',
    name: 'Soja irrigada — regime pleno',
    shortName: 'Soja irrig.',
    farm: 'Base local anonimizada · Oeste da Bahia',
    season: 'Cenário de regime pleno · hipótese',
    unit: 'sc/ha',
    yield: 80,
    price: 125,
    costItems: [
      { id: 'seed', label: 'Semente + tratamento', value: 507.96, status: 'base' },
      { id: 'inoculant', label: 'Inoculante', value: 16.76, status: 'base' },
      { id: 'fertilizer', label: 'Fertilizantes', value: 1221.8, status: 'base' },
      { id: 'foliar', label: 'Fertilizantes foliares', value: 77.25, status: 'base' },
      { id: 'lime', label: 'Corretivos e calcário', value: 55.11, status: 'base' },
      { id: 'herbicide', label: 'Herbicidas', value: 404.11, status: 'base' },
      { id: 'insecticide', label: 'Inseticidas', value: 390.81, status: 'base' },
      { id: 'fungicide', label: 'Fungicidas', value: 403.09, status: 'base' },
      { id: 'adjuvant', label: 'Óleo e adjuvantes', value: 45.28, status: 'base' },
      { id: 'operations', label: 'Diesel e operações', value: 196.38, status: 'base' },
      { id: 'irrigation', label: 'Irrigação e energia', value: 513, status: 'base' },
      { id: 'technical', label: 'Consultoria', value: 28, status: 'base' },
    ],
    deductionRate: 0.2,
    fixedRate: 10,
    fixedCostHa: 1000,
    source: 'Planilha local anonimizada — Unidade A',
    note: 'Produtividade assumida no cenário-base; o custo fornecido inclui R$ 513/ha de irrigação e R$ 28/ha de consultoria.',
  },
  {
    id: 'corn-irrigated',
    name: 'Milho irrigado — 2ª safra em regime pleno',
    shortName: 'Milho 2ª safra',
    farm: 'Plano produtivo anonimizado · Oeste da Bahia',
    season: '2ª safra em regime pleno · hipótese',
    unit: 'sc/ha',
    yield: 200,
    price: 55,
    costItems: [
      { id: 'seed', label: 'Sementes e tratamento · preencher', value: 0, status: 'underwriting' },
      { id: 'fertilizer', label: 'Fertilizantes e corretivos · preencher', value: 0, status: 'underwriting' },
      { id: 'crop-protection', label: 'Defensivos e adjuvantes · preencher', value: 0, status: 'underwriting' },
      { id: 'operations', label: 'Operações e diesel · preencher', value: 0, status: 'underwriting' },
      { id: 'harvest-logistics', label: 'Colheita, secagem e frete · preencher', value: 0, status: 'underwriting' },
      { id: 'unallocated', label: 'Saldo do custeio ainda não classificado', value: CORN_UNALLOCATED_BUDGET_HA, status: 'underwriting' },
      { id: 'irrigation', label: 'Irrigação O&M', value: 650, status: 'underwriting' },
    ],
    deductionRate: 0.2,
    fixedRate: 10,
    fixedCostHa: 1100,
    source: 'Plano produtivo local anonimizado — Unidade B',
    note: 'O custeio de R$ 4.800/ha foi aberto com saldo não classificado. Ao preencher sementes, fertilizantes, defensivos, operações ou colheita, esse saldo cai na mesma proporção e o total não duplica. A base histórica cruzada contém somente custo direto total de R$ 6.528,60/ha, sem decomposição.',
  },
  {
    id: 'cotton-irrigated',
    name: 'Algodão irrigado — base local',
    shortName: 'Algodão irrig.',
    farm: 'Base local anonimizada · Oeste da Bahia',
    season: 'Base irrigada local',
    unit: '@/ha',
    yield: 380,
    price: 51.21384,
    costItems: [
      { id: 'seed', label: 'Semente + tratamento', value: 739.43, status: 'base' },
      { id: 'inoculant', label: 'Inoculante', value: 41.76, status: 'base' },
      { id: 'fertilizer', label: 'Fertilizantes', value: 3426.7, status: 'base' },
      { id: 'foliar', label: 'Fertilizantes foliares', value: 401.63, status: 'base' },
      { id: 'lime', label: 'Corretivos e calcário', value: 211.6, status: 'base' },
      { id: 'herbicide', label: 'Herbicidas', value: 1015.34, status: 'base' },
      { id: 'insecticide', label: 'Inseticidas', value: 2800.04, status: 'base' },
      { id: 'fungicide', label: 'Fungicidas', value: 1083.48, status: 'base' },
      { id: 'adjuvant', label: 'Óleo e adjuvantes', value: 132.66, status: 'base' },
      { id: 'operations', label: 'Diesel e operações', value: 482.09, status: 'base' },
      { id: 'materials', label: 'Lona e rolinho', value: 395, status: 'base' },
      { id: 'processing', label: 'Beneficiamento', value: 2280, status: 'base' },
      { id: 'irrigation', label: 'Irrigação e energia', value: 513, status: 'base' },
      { id: 'technical', label: 'Consultoria', value: 28, status: 'base' },
    ],
    deductionRate: 1.5,
    fixedRate: 10,
    fixedCostHa: 1946.12592,
    source: 'Planilha local anonimizada — Unidade A',
    note: 'A recomposição inclui irrigação e consultoria fora do subtotal original; o preço equivalente combina pluma e caroço.',
  },
];

export function cropDirectCostHa(crop: CropAssumption) {
  return crop.costItems.reduce((sum, item) => sum + item.value, 0);
}

export function updateCropCostItem(
  crop: CropAssumption,
  costId: string,
  value: number,
  mode: 'classify' | 'stress' = 'classify',
) {
  const normalizedValue = Math.max(0, value);
  if (mode === 'stress' || crop.id !== 'corn-irrigated' || !CORN_DETAIL_COST_IDS.includes(costId as (typeof CORN_DETAIL_COST_IDS)[number])) {
    return {
      ...crop,
      costItems: crop.costItems.map((item) =>
        item.id === costId ? { ...item, value: normalizedValue } : item,
      ),
    };
  }

  const oldValue = crop.costItems.find((item) => item.id === costId)?.value ?? 0;
  return {
    ...crop,
    costItems: crop.costItems.map((item) => {
      if (item.id === costId) return { ...item, value: normalizedValue };
      if (item.id === 'unallocated') {
        return {
          ...item,
          value: Math.max(0, item.value - (normalizedValue - oldValue)),
        };
      }
      return item;
    }),
  };
}

export function calculateCrop(
  crop: CropAssumption,
  area: number,
  landLeaseHa = 0,
) {
  const directCostHa = cropDirectCostHa(crop);
  const revenueHa = crop.yield * crop.price;
  const deductionsHa = revenueHa * (crop.deductionRate / 100);
  const fixedCostHa = cropFixedCostHa(crop);
  const totalCostHa = directCostHa + deductionsHa + fixedCostHa + landLeaseHa;
  const marginHa = revenueHa - totalCostHa;
  const revenue = revenueHa * area;
  const totalCost = totalCostHa * area;
  const margin = marginHa * area;
  const roi = totalCost > 0 ? (margin / totalCost) * 100 : 0;
  const retainedRevenueRate = 1 - crop.deductionRate / 100;
  const breakEvenPrice =
    crop.yield > 0 && retainedRevenueRate > 0
      ? (directCostHa + fixedCostHa + landLeaseHa) / (crop.yield * retainedRevenueRate)
      : null;

  return {
    ...crop,
    area,
    production: crop.yield * area,
    directCostHa,
    landLeaseHa,
    revenueHa,
    deductionsHa,
    fixedCostHa,
    totalCostHa,
    marginHa,
    revenue,
    totalCost,
    margin,
    roi,
    breakEvenPrice,
    breakEvenYield: crop.price > 0 && retainedRevenueRate > 0
      ? (directCostHa + fixedCostHa + landLeaseHa) / (crop.price * retainedRevenueRate) : null,
  };
}

export function cropFixedCostHa(crop: CropAssumption) {
  const reference = cropDefaults.find((item) => item.id === crop.id);
  return Math.max(0, crop.fixedCostHa ??
    ((reference?.price ?? crop.price) * (reference?.yield ?? crop.yield) * crop.fixedRate / 100));
}

/** Receita alternativa: somente descontos de venda evitáveis, nunca fixos já incorridos. */
export function cropNetSalePrice(crop: CropAssumption) {
  return Math.max(0, crop.price * (1 - crop.deductionRate / 100));
}

export function calculateDoubleCrop(
  soy: CropAssumption,
  corn: CropAssumption,
  area: number,
  landLeaseHa = 0,
) {
  const first = calculateCrop(soy, area);
  const second = calculateCrop(corn, area);
  const landLease = landLeaseHa * area;
  return {
    name: 'Soja irrigada + milho 2ª safra',
    shortName: 'Soja + milho',
    area,
    revenue: first.revenue + second.revenue,
    totalCost: first.totalCost + second.totalCost + landLease,
    margin: first.margin + second.margin - landLease,
    revenueHa: first.revenueHa + second.revenueHa,
    totalCostHa: first.totalCostHa + second.totalCostHa + landLeaseHa,
    marginHa: first.marginHa + second.marginHa - landLeaseHa,
    roi:
      first.totalCost + second.totalCost + landLease > 0
        ? ((first.margin + second.margin - landLease) /
            (first.totalCost + second.totalCost + landLease)) *
          100
        : 0,
    landLeaseHa,
    note: 'Usa a mesma área duas vezes no ano; exige janela agronômica, água, máquinas e capital compatíveis.',
  };
}
