'use client';

import type { ReactNode } from 'react';
import { AppInstall } from '@/components/app-install';
import { DecisionReview } from '@/components/decision-review';
import { MarketCompass } from '@/components/market-compass';
import { BusinessReview } from '@/components/business-review';
import { DecisionLab } from '@/components/decision-lab';
import { capitalStudy, inverseCropCapital, marginLevers, stockingStudy, feedlotTurningPoints, enterpriseIds, type LabInput } from '@/lib/decision-lab';
import { capacityActions } from '@/lib/capacity-actions';
import { rearingOnly, rearingStartupCash, rearingCapitalRequirement, stressRearing } from '@/lib/rearing-model';
import { areaResponse } from '@/lib/investment-screen';
import type { ConabPrice } from '@/lib/conab-prices';
import { referenceBridge, rankWithinBudget, cattleStartupCash, cattleCapitalRequirement, reviewDefaults, REVIEW_VERSION } from '@/lib/decision-review';
import { pastureCapacity } from '@/lib/pasture-capacity';
import { marketPricesUrl, isStaticEdition } from '@/lib/market-client';
import { csvCell, validateScenario, SCENARIO_STORAGE_KEY, SCENARIO_SCHEMA } from '@/lib/scenario-storage';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Beef,
  CircleDollarSign,
  Download,
  Droplets,
  ExternalLink,
  Factory,
  FileText,
  Gauge,
  Leaf,
  RefreshCw,
  SlidersHorizontal,
  Sprout,
  Tractor,
  TrendingUp,
  Waves,
  Wheat,
} from 'lucide-react';
const MarginChart = lazy(() => import('@/components/comparison-charts').then(m => ({ default: m.MarginChart })));
const StressChart = lazy(() => import('@/components/comparison-charts').then(m => ({ default: m.StressChart })));

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NumericInput } from '@/components/numeric-input';
import { ParameterAdjustment } from '@/components/parameter-adjustment';
import { ScenarioEditor, EditValue } from '@/components/scenario-editor';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  calculateFeedAllocation,
  calculateHerdFlow,
  type LotProfile,
} from '@/lib/allocation-model';
import {
  cattlePriceAtDate,
  projectAnimalDecision,
} from '@/lib/animal-timeline-model';
import {
  calculateBreedingEconomics,
  type BreedingEconomicsInputs,
} from '@/lib/breeding-model';
import {
  calculateCrop,
  calculateDoubleCrop,
  CORN_DETAIL_COST_IDS,
  CORN_UNALLOCATED_BUDGET_HA,
  cropDefaults,
  cropDirectCostHa,
  cropFixedCostHa,
  cropNetSalePrice,
  type CropAssumption,
  updateCropCostItem,
} from '@/lib/crop-model';
import { buildAutomaticCalendar } from '@/lib/crop-calendar-model';
import { calculateEffluentScale } from '@/lib/effluent-model';
import {
  buildCapexStep,
  calculateMonthlyCashFlow,
  calculateWeeklyFeedPlan,
  calculateWorkRate,
  cropCashEvents,
} from '@/lib/operational-model';
import {
  futureModelUnitLabel,
  integerHedgeCoverage,
  futurePriceInModelUnit,
  validateFutureQuote,
  futureProductLabel,
  futureQuoteDefaults,
  futureRawUnitLabel,
  type FutureProduct,
  type FutureQuote,
} from '@/lib/futures-model';
import {
  annuityFactor,
  calculateCore,
  defaultAssumptions,
  irr,
  npv,
  simulate,
  type Assumptions,
} from '@/lib/livestock-model';
import {
  provenanceCanRank,
  type ScenarioMode,
  type ScenarioPriceProvenance,
} from '@/lib/scenario-mode';
import {
  allocateEnterpriseStrategy,
  criterionMargin,
  type DecisionCriterion,
  type ScenarioMargins,
} from '@/lib/strategy-model';

const brl0 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const brl2 = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const int = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const one = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const two = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DAY_MS = 86_400_000;
const MAX_PHYSICAL_QUOTE_AGE_DAYS = 35;
const MAX_REPLACEMENT_QUOTE_AGE_DAYS = 30;
const MODEL_VERSION = REVIEW_VERSION;
const COMMON_HORIZON_DAYS = 365;

function strictIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
    ? parsed
    : null;
}

function isoAgeDays(source: string, asOf: string) {
  const sourceDate = strictIsoDate(source);
  const asOfDate = strictIsoDate(asOf);
  if (!sourceDate || !asOfDate) return null;
  return Math.round((asOfDate.getTime() - sourceDate.getTime()) / DAY_MS);
}

function addIsoDays(source: string, days: number) {
  const date = strictIsoDate(source);
  if (!date || !Number.isFinite(days)) return '';
  date.setUTCDate(date.getUTCDate() + Math.ceil(days));
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
}

function dateBr(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split('-').reverse().join('/')
    : 'n/d';
}

function moneyCompact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}R$ ${two.format(abs / 1_000_000)} mi`;
  if (abs >= 1_000) return `${sign}R$ ${one.format(abs / 1_000)} mil`;
  return brl0.format(value);
}

function percentage(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return 'n/d';
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-[20px] border border-border/80 bg-card shadow-[0_12px_40px_rgba(24,52,35,0.055)] ${className}`}>
      {children}
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 border-b border-border/70 p-5 sm:flex-row sm:items-end lg:p-6">
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#5f7f65]">{eyebrow}</p>
        <h2 className="font-heading text-xl font-semibold tracking-[-0.025em] sm:text-2xl">{title}</h2>
        {text ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

function Metric({
  label,
  value,
  note,
  tone = 'plain',
  icon,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'plain' | 'green' | 'lime' | 'warn';
  icon?: ReactNode;
}) {
  const tones = {
    plain: 'bg-card',
    green: 'border-[#2d6746]/15 bg-[#eef5ef]',
    lime: 'border-[#b9d840]/35 bg-[#f2f7da]',
    warn: 'border-[#d49e37]/25 bg-[#fff7e8]',
  };
  return (
    <div className={`metric-card min-w-0 rounded-2xl border border-border/80 p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
        {icon ? <span className="text-[#477357]">{icon}</span> : null}
      </div>
      <p className="mt-2 font-mono text-xl font-semibold tracking-[-0.035em] sm:text-2xl">{value}</p>
      {note ? <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function Control({
  label,
  value,
  suffix,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div data-field-label={label} className="parameter-control border-b border-border/65 pb-4 last:border-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <div className="flex min-w-0 max-w-full items-center gap-1.5">
          <NumericInput
            aria-label={label}
            className="h-9 w-36 bg-background px-2 text-right font-mono text-sm"
            min={min}
            max={max}
            step={step}
            value={value}
            onValueChange={onChange}
          />
          <span className="w-10 text-[10px] text-muted-foreground">{suffix}</span>
        </div>
      </div>
      <ParameterAdjustment label={label} value={value} suffix={suffix} min={min} max={max} step={step} onChange={onChange} />
    </div>
  );
}

function CostRows({ rows, total }: { rows: Array<[string, number]>; total: number }) {
  return (
    <div className="divide-y divide-border/60 text-sm">
      {rows.map(([label, value]) => (
        <div className="flex items-center justify-between gap-4 py-2.5" key={label}>
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono text-xs font-semibold">{brl2.format(value)}</span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 pt-3 font-semibold">
        <span>Custo de caixa por cabeça</span>
        <span className="font-mono">{brl2.format(total)}</span>
      </div>
    </div>
  );
}

type ComparisonRow = {
  id: string;
  label: string;
  source: string;
  production: string;
  revenue: number;
  cost: number;
  margin: number;
  marginHa: number;
  roi: number;
  breakEven: string;
  capitalRequired: number;
  capitalFeasible: boolean;
  rankable: boolean;
  evidenceLevel: 'base-spreadsheet' | 'preflight-validated';
  blocker?: string;
  warning?: string;
};

type BreakEvenRow = {
  id: string;
  label: string;
  currentPrice: string;
  zeroMargin: string;
  minimumOutput: string;
  minimumArea: string;
  priceBuffer: number | null;
  competitivePoint: string;
};

type FutureOpportunity = {
  quote: FutureQuote;
  futurePrice: number;
  effectivePrice: number;
  activity: string;
  margin: number;
  marginHa: number;
  baselineMarginHa: number;
  deltaMarginHa: number;
  breakEvenPrice: number | null;
  priceDistance: number | null;
  contractsAtCoverage: number;
  capitalRequired: number;
  capitalFeasible: boolean;
  isUsable: boolean;
  executionUsable: boolean;
  validationIssue: string | null;
  horizonDays: number | null;
};

type StrategyBand = 'low' | 'base' | 'high';

type StrategyScenario = {
  id: StrategyBand;
  label: string;
  note: string;
  margins: Record<string, number>;
  costs: Record<string, number>;
  capital: Record<string, number>;
  penDaysHa: number;
};

const strategyStressDefaults = {
  cattleLow: -10,
  cattleHigh: 10,
  soyLow: -12,
  soyHigh: 12,
  cornLow: -15,
  cornHigh: 18,
  cottonLow: -15,
  cottonHigh: 18,
  productivityLow: -10,
  productivityHigh: 5,
  costLow: 10,
  costHigh: -3,
  replacementLow: 5,
  replacementHigh: 8,
};

const marketCycleEvidence = [
  {
    id: 'cattle-regions',
    label: 'Bovinos · agregado rastreado FAS',
    value: '−1,7%',
    period: '2026F vs 2025',
    status: 'previsão',
    tone: 'suporte regional',
    text: '902,1 mi de cabeças no agregado publicado. Brasil, China, UE e EUA recuam; Austrália e México crescem. Não equivale a uma escassez mundial permanente.',
    source: 'USDA FAS · abr/2026',
    sourceUrl: 'https://apps.fas.usda.gov/psdonline/circulars/livestock_poultry.pdf?v=1.0.0',
  },
  {
    id: 'us-calves',
    label: 'EUA · safra de bezerros',
    value: '−2,0%',
    period: '2026F vs 2025',
    status: 'previsão',
    tone: 'oferta apertada',
    text: '32,9 mi de bezerros e 27,6 mi de vacas de corte. Apoia preços do gado, mas também encarece a reposição do confinamento.',
    source: 'USDA NASS · jan/2026',
    sourceUrl: 'https://www.nass.usda.gov/Publications/Todays_Reports/reports/catl0126.pdf',
  },
  {
    id: 'brazil-females',
    label: 'Brasil · participação de fêmeas',
    value: '49,92%',
    period: '1T26',
    status: 'realizado',
    tone: 'alerta 18–36 meses',
    text: 'Vacas + novilhas somaram 5,137 mi de 10,289 mi abatidos. Quantidade e participação seguem elevadas; a virada para retenção ainda não foi confirmada.',
    source: 'IBGE/SIDRA · 1T26 final',
    sourceUrl: 'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/47167-abates-de-bovinos-suinos-e-frangos-tem-o-melhor-resultado-para-um-1-trimestre',
  },
  {
    id: 'corn-stocks',
    label: 'Milho · estoque mundial',
    value: '−8,1%',
    period: '2026/27F vs 2025/26',
    status: 'projeção',
    tone: 'aperto relativo',
    text: 'Produção mundial abaixo do uso e estoque/uso ex-China perto de 11%. No Brasil, porém, a Conab projeta recuperação do estoque de passagem.',
    source: 'USDA WASDE · ago/2026',
    sourceUrl: 'https://www.usda.gov/oce/commodity/wasde/wasde0826.pdf',
  },
  {
    id: 'soy-balance',
    label: 'Soja · estoque mundial',
    value: '−0,7%',
    period: '2026/27F vs 2025/26',
    status: 'projeção',
    tone: 'balanço neutro',
    text: 'Produção e uso crescem quase juntos; estoque/uso global de 28,1%. China, câmbio, basis e esmagamento pesam mais que uma tese de escassez.',
    source: 'USDA WASDE · ago/2026',
    sourceUrl: 'https://www.usda.gov/oce/commodity/wasde/wasde0826.pdf',
  },
  {
    id: 'cotton-stocks',
    label: 'Algodão · estoque mundial',
    value: '−6,8%',
    period: '2026/27F vs 2025/26',
    status: 'projeção',
    tone: 'melhora com ressalvas',
    text: 'Uso supera produção, mas estoque/uso ainda é 56,7%. No Brasil, cerca de 82% do uso + exportação projetado pela Conab depende do mercado externo.',
    source: 'USDA/Conab · ago/2026',
    sourceUrl: 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/safra-de-graos/boletim-da-safra-de-graos/11o-levantamento-safra-2025-26/11o-levantamento-safra-2025-26',
  },
] as const;

function stressCrop(
  crop: CropAssumption,
  priceFactor: number,
  productivityFactor: number,
  costFactor: number,
) {
  return {
    ...crop,
    price: Math.max(0, crop.price * priceFactor),
    yield: Math.max(0, crop.yield * productivityFactor),
    costItems: crop.costItems.map((item) => ({
      ...item,
      value: Math.max(0, item.value * costFactor),
    })),
  };
}

function BreakEvenTable({ rows }: { rows: BreakEvenRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-[#f4f7f1]">
          <TableHead className="pl-5">Cultura / cenário</TableHead>
          <TableHead className="text-right">Preço do cenário</TableHead>
          <TableHead className="text-right">Preço de margem zero</TableHead>
          <TableHead className="text-right">Produção mínima</TableHead>
          <TableHead className="text-right">Área mínima · CAPEX</TableHead>
          <TableHead className="text-right">Folga de preço</TableHead>
          <TableHead className="pr-5 text-right">Ponto competitivo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="pl-5 font-semibold">{row.label}</TableCell>
            <TableCell className="text-right font-mono text-xs">{row.currentPrice}</TableCell>
            <TableCell className="text-right font-mono text-xs font-semibold">{row.zeroMargin}</TableCell>
            <TableCell className="text-right text-xs">{row.minimumOutput}</TableCell>
            <TableCell className="text-right font-mono text-xs">{row.minimumArea}</TableCell>
            <TableCell className={`text-right font-mono text-xs font-semibold ${(row.priceBuffer ?? 0) < 10 ? 'text-[#a05a16]' : 'text-[#2d6c45]'}`}>{row.priceBuffer === null ? 'n/d' : percentage(row.priceBuffer)}</TableCell>
            <TableCell className="pr-5 text-right text-xs">{row.competitivePoint}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type MarketQuote = {
  id: 'cattle' | CropAssumption['id'];
  label: string;
  unit: string;
  date: string;
  reference: number;
  basis: number;
  market: string;
  sourceUrl: string;
  note: string;
  provenance: 'working-assumption' | 'conab-official' | 'manual-override';
  officialReference?: number;
  officialUnit?: string;
  officialDate?: string;
};

type MarketApiQuote = {
  product: 'soy' | 'corn' | 'cotton' | 'cattle';
  uf: string;
  sourceDate: string;
  rawPeriod: string;
  displayUnit: string;
  value: number;
};

const marketQuoteDefaults: MarketQuote[] = [
  { id: 'cattle', label: 'Boi gordo', unit: 'R$/@', date: '', reference: 349.5, basis: 0, market: 'CEPEA/B3 · São Paulo', sourceUrl: 'https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx', note: 'Cotação de trabalho inicial. Confirme data, praça, prazo, padrão, impostos e frete.', provenance: 'working-assumption' },
  { id: 'soy-irrigated', label: 'Soja', unit: 'R$/sc 60 kg', date: '', reference: 125, basis: 0, market: 'CEPEA/ESALQ · Paraná', sourceUrl: 'https://www.cepea.esalq.usp.br/br/indicador/soja.aspx', note: 'Cotação de trabalho inicial. Use o basis para chegar ao preço líquido na fazenda.', provenance: 'working-assumption' },
  { id: 'corn-irrigated', label: 'Milho', unit: 'R$/sc 60 kg', date: '', reference: 55, basis: 0, market: 'ESALQ/BM&FBovespa · Campinas', sourceUrl: 'https://www.cepea.esalq.usp.br/br/indicador/milho.aspx', note: 'Cotação de trabalho inicial. A praça local pode divergir muito de Campinas.', provenance: 'working-assumption' },
  { id: 'cotton-irrigated', label: 'Algodão equivalente', unit: 'R$/@ produzida', date: '', reference: 51.21384, basis: 0, market: 'Equivalente fazenda · pluma + caroço', sourceUrl: 'https://www.cepea.esalq.usp.br/br/indicador/algodao.aspx', note: 'Cotação de trabalho inicial. Não aplique R$/lb da pluma diretamente: converta rendimento, qualidade, caroço e beneficiamento.', provenance: 'working-assumption' },
];

const marketUfOptions = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS',
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC',
  'SP', 'SE', 'TO',
];

const initialMarketStatus =
  'Base da planilha ativa e pronta para comparação. A CONAB é opcional para confrontar o cenário com uma referência semanal por UF.';

const futurePhysicalBaseDefaults: Record<MarketQuote['id'], number> = {
  cattle: defaultAssumptions.priceArroba,
  'soy-irrigated': cropDefaults.find((crop) => crop.id === 'soy-irrigated')?.price ?? 0,
  'corn-irrigated': cropDefaults.find((crop) => crop.id === 'corn-irrigated')?.price ?? 0,
  'cotton-irrigated': cropDefaults.find((crop) => crop.id === 'cotton-irrigated')?.price ?? 0,
};
const futurePhysicalBaseDateDefaults: Record<MarketQuote['id'], string> = {
  cattle: '',
  'soy-irrigated': '',
  'corn-irrigated': '',
  'cotton-irrigated': '',
};
type AppliedPriceMeta = {
  provenance: ScenarioPriceProvenance;
  date: string;
  source: string;
};
const appliedPriceMetaDefaults: Record<MarketQuote['id'], AppliedPriceMeta> = {
  cattle: { provenance: 'local-spreadsheet', date: '', source: 'premissa-base fornecida · editável' },
  'soy-irrigated': { provenance: 'local-spreadsheet', date: '', source: 'planilha local anonimizada · Unidade A' },
  'corn-irrigated': { provenance: 'local-spreadsheet', date: '', source: 'plano produtivo local anonimizado · Unidade B' },
  'cotton-irrigated': { provenance: 'local-spreadsheet', date: '', source: 'planilha local anonimizada · Unidade A' },
};
const gateAppliedPriceMetaDefault: AppliedPriceMeta = {
  provenance: 'working-assumption',
  date: '',
  source: 'hipótese inicial de boi magro; exige cotação local datada',
};

const appliedFutureFingerprintDefaults: Record<MarketQuote['id'], string> = {
  cattle: '',
  'soy-irrigated': '',
  'corn-irrigated': '',
  'cotton-irrigated': '',
};

const herdFlowDefaults = {
  selfSupplyPercent: 100,
  pregnancyRate: 87.5,
  pregnancyToBirthLoss: 7,
  preWeaningMortality: 5,
  postWeaningMortality: 2,
  replacementRate: 20,
  heiferDevelopmentSurvival: 85,
  heiferApprovalRate: 90,
  ownReplacementShare: 100,
  allowExternalReplacementHeifers: true,
  maleShare: 50,
  finishBothSexes: true,
  herdUaPerCow: 1.35,
  averageStockWeight: 320,
  naturalServiceShare: 30,
  bullCowRatio: 25,
};

const allocationDefaults = {
  silageOpportunityCostDm: 0.38,
  purchasedSilageCostDm: 0.55,
  grainPurchasePriceSack: 65,
  ownOperationDay: 1.55,
  ownFixedCostHead: 65,
  thirdPartyAllInDay: 18,
  thirdPartyFreightHead: 120,
  thirdPartyCapacity: 0,
  feedlotMortality: 0.2,
  feedlotCapacity: 2_000,
  feedlotUtilization: 90,
  grainAreaHa: 370,
  allowPurchasedFeed: true,
  dietFormulaConfirmed: false,
  feedAvailabilityConfirmed: false,
  peakCapacityConfirmed: false,
  thirdPartyQuoteConfirmed: false,
  annualCalendarConfirmed: false,
  pastureWaterForageConfirmed: false,
  cowOpportunityWindowConfirmed: false,
  cowBuyQuoteDate: '',
  cowBuyQuoteSource: '',
  cowSaleQuoteDate: '',
  cowSaleQuoteSource: '',
  effluentReferenceAreaHa: 50,
  effluentReferenceDepthMm: 150,
  effluentReferenceAnnualHeads: 6_725,
  effluentReferenceConfinementDays: 95,
  effluentCalibrationSource: '',
  effluentCalibrationPeriodStart: '',
  effluentCalibrationPeriodEnd: '',
  effluentCalibrationPeriodConfirmed: false,
  effluentValueSource: '',
  effluentValueDate: '',
  effluentCreditConfirmed: false,
  effluentExcessDestination: '',
  effluentExcessDestinationCapacityM3: 0,
  effluentExcessDestinationConfirmed: false,
};

const animalTimelineDefaults = {
  entryDate: '2026-09-10',
  entryArrobas: 8,
  decisionArrobas: 13.3333,
  liveEquivalent: true,
  carcassYield: 54,
  entryValuePerKgLive: defaultAssumptions.calfCost / defaultAssumptions.entryWeight,
  linkEntryCostToReplacement: true,
  entryQuoteDate: '',
  entryQuoteSource: '',
  gateValuePerKgLive: 12.5,
  gateValuationDate: '2027-03-07',
  gateSourceDate: '',
  commonPastureCostDay: 4.5,
  linkCommonPastureCost: true,
  commonPastureBaseCostDay: 3.69,
  supplementKgDay: 0.16,
  pastureFinishCostDay: 5.5,
  pastureMortality: 0.2,
  bgiEligible: false,
  saleDeduction: 4,
};

const cropMarketingWindowDefaults = {
  soy: {
    availableDate: '',
    lastDeliveryDate: '',
    carryBasisConfirmed: false,
  },
  corn: {
    availableDate: '',
    lastDeliveryDate: '',
    carryBasisConfirmed: false,
  },
  cotton: {
    availableDate: '',
    lastDeliveryDate: '',
    carryBasisConfirmed: false,
  },
};
const doubleCropCalendarDefaults = {
  soyPlantDate: '',
  soyHarvestDate: '',
  cornPlantDate: '',
  cornHarvestDate: '',
  waterEnergyConfirmed: false,
  waterEnergyCapacityHa: 0,
  machineCapacityConfirmed: false,
  machineCapacityHa: 0,
};

const operationalDefaults = {
  openingSilageTonnesDm: 0,
  silageFirstReleaseDays: 150,
  silageCutIntervalDays: 180,
  reserveCash: 0,
  setupCost: 0,
  setupDays: 0,
  otherIngredientSharePercent: 0,
  effluentAvailabilityPercent: 0,
  effluentFertilizerCapHa: 0,
  effluentTreatmentM3: 0,
  effluentApplicationM3: 0,
  effluentFixedCost: 0,
  usablePlantDays: 15,
  usableHarvestDays: 15,
  informedPlantRateHaDay: 0,
  informedHarvestRateHaDay: 0,
  grainStorageCapacityTonnes: 0,
  grainStorageCapexPerTonne: 0,
  silageStorageCapacityTonnes: 0,
  silageStorageCapexPerTonne: 0,
  feedMillCapacityTonnesDay: 0,
  feedMillCapexPerTonneDay: 0,
};

type CropOperationalGate = {
  plantDate: string;
  harvestDate: string;
  waterEnergyConfirmed: boolean;
  waterEnergyCapacityHa: number;
  machineCapacityConfirmed: boolean;
  machineCapacityHa: number;
};
const emptyCropOperationalGate = (): CropOperationalGate => ({
  plantDate: '',
  harvestDate: '',
  waterEnergyConfirmed: false,
  waterEnergyCapacityHa: 0,
  machineCapacityConfirmed: false,
  machineCapacityHa: 0,
});
const cropOperationalDefaults: Record<CropAssumption['id'], CropOperationalGate> = {
  'soy-irrigated': emptyCropOperationalGate(),
  'corn-irrigated': emptyCropOperationalGate(),
  'cotton-irrigated': emptyCropOperationalGate(),
};

const breedingEconomicsDefaults = {
  calfPurchaseWeightKg: 240,
  calfPriceSourceDate: '',
  calfPriceSource: '',
  purchaseTransactionCostHead: 0,
  matrixMarketValue: defaultAssumptions.cowBuyCost,
  matrixResidualPercent: 70,
  annualCowCashCost: 0,
  annualReproductionCostCow: 0,
  externalReplacementHeiferPriceHead: 0,
  replacementHeiferPriceSourceDate: '',
  replacementHeiferPriceSource: '',
  breedingStockingUa: 1.5,
  breedingAreaAvailableHa: 0,
  breedingLandCostHaYear: 0,
  breedingAreaOutsideBase: true,
  existingMatrices: 0,
  newMatrixCapitalLimit: 0,
  targetDownstreamMarginHead: 0,
  inputsConfirmed: false,
  applyToComparison: true,
};

const lotProfileDefaults: LotProfile[] = [
  { id: 'high', label: 'Recria acima da média', share: 30, pastureGmd: 0.9, gmd: 1.48, dietDmDay: 11.4, entryDate: '', exitDate: '' },
  { id: 'medium', label: 'Recria intermediária', share: 50, pastureGmd: 0.7, gmd: 1.48, dietDmDay: 11.4, entryDate: '', exitDate: '' },
  { id: 'low', label: 'Recria abaixo da média', share: 20, pastureGmd: 0.45, gmd: 1.48, dietDmDay: 11.4, entryDate: '', exitDate: '' },
];

export default function Home() {
  const [assumptions, setAssumptions] = useState<Assumptions>(defaultAssumptions);
  const [crops, setCrops] = useState<CropAssumption[]>(cropDefaults);
  const [activeTab, setActiveTab] = useState('quick');
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [editorGroup, setEditorGroup] = useState<string | null>('farm');
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>('validation');
  const [explorationLoading, setExplorationLoading] = useState(false);
  const explorationAutoloaded = useRef(false);
  const explorationLoader = useRef<() => Promise<void>>(async () => {});
  const [marketQuotes, setMarketQuotes] = useState<MarketQuote[]>(marketQuoteDefaults);
  const [marketUf, setMarketUf] = useState('BA');
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketStatus, setMarketStatus] = useState(initialMarketStatus);
  const [futureQuotes, setFutureQuotes] = useState<FutureQuote[]>(futureQuoteDefaults);
  const [futurePhysicalBasePrices, setFuturePhysicalBasePrices] = useState(
    futurePhysicalBaseDefaults,
  );
  const [futurePhysicalBaseDates, setFuturePhysicalBaseDates] = useState(
    futurePhysicalBaseDateDefaults,
  );
  const [futureUsdBrl, setFutureUsdBrl] = useState(5.2005);
  const [futureHedgePercent, setFutureHedgePercent] = useState(50);
  const [cottonFiberRecovery, setCottonFiberRecovery] = useState(40);
  const [cottonSeedCredit, setCottonSeedCredit] = useState(8);
  const [herdFlowInputs, setHerdFlowInputs] = useState(herdFlowDefaults);
  const [allocationInputs, setAllocationInputs] = useState(allocationDefaults);
  const [lotProfiles, setLotProfiles] = useState<LotProfile[]>(lotProfileDefaults);
  const [animalTimelineInputs, setAnimalTimelineInputs] = useState(animalTimelineDefaults);
  const [cropMarketingWindows, setCropMarketingWindows] = useState(
    cropMarketingWindowDefaults,
  );
  const [doubleCropCalendar, setDoubleCropCalendar] = useState(
    doubleCropCalendarDefaults,
  );
  const [operationalInputs, setOperationalInputs] = useState(
    operationalDefaults,
  );
  const [cropOperational, setCropOperational] = useState(
    cropOperationalDefaults,
  );
  const [breedingEconomicsInputs, setBreedingEconomicsInputs] = useState(
    breedingEconomicsDefaults,
  );
  const [strategyStress, setStrategyStress] = useState(strategyStressDefaults);
  const [strategyCriterion, setStrategyCriterion] = useState<DecisionCriterion>('defensive');
  const [strategyMaxShare, setStrategyMaxShare] = useState(60);
  const [strategyCapitalLimit, setStrategyCapitalLimit] = useState(30_000_000);
  const [strategyErrorHa, setStrategyErrorHa] = useState(3_000);
  const [scenarioAuditTrail, setScenarioAuditTrail] = useState<string[]>([]);
  const [appliedPriceMeta, setAppliedPriceMeta] = useState(appliedPriceMetaDefaults);
  const [gateAppliedPriceMeta, setGateAppliedPriceMeta] = useState(
    gateAppliedPriceMetaDefault,
  );
  const [appliedFutureFingerprints, setAppliedFutureFingerprints] = useState(
    appliedFutureFingerprintDefaults,
  );
  const [savedStatus, setSavedStatus] = useState('');
  const [costEditMode, setCostEditMode] = useState<'stress' | 'classify'>('stress');
  const [reviewInputs, setReviewInputs] = useState(reviewDefaults);
  const [marketEvidence, setMarketEvidence] = useState<ConabPrice[]>([]);
  const scenarioFileInput = useRef<HTMLInputElement>(null);
  const scenarioData = { assumptions, crops, scenarioMode, marketQuotes, marketUf, futureQuotes, futurePhysicalBasePrices, futurePhysicalBaseDates, futureUsdBrl, futureHedgePercent, cottonFiberRecovery, cottonSeedCredit, herdFlowInputs, allocationInputs, lotProfiles, animalTimelineInputs, cropMarketingWindows, doubleCropCalendar, operationalInputs, cropOperational, breedingEconomicsInputs, strategyStress, strategyCriterion, strategyMaxShare, strategyCapitalLimit, strategyErrorHa, appliedPriceMeta, gateAppliedPriceMeta, appliedFutureFingerprints };
  const restoreScenario = (raw: unknown) => {
    const data = validateScenario(raw, scenarioData);
    // Validar tudo antes de alterar estado: um erro não restaura metade do arquivo.
    const extras = validateScenario(raw, {
      reviewInputs: reviewDefaults, operationalInputs: operationalDefaults,
      scenarioAuditTrail: [] as string[],
    });
    if (!['validation', 'exploration'].includes(data.scenarioMode) ||
      !['defensive', 'base', 'balanced'].includes(data.strategyCriterion) ||
      !marketUfOptions.includes(data.marketUf)) throw new Error('Modo ou UF incompatível.');
    setReviewInputs(extras.reviewInputs);
    setAssumptions(data.assumptions);
    setCrops(data.crops);
    setScenarioMode(data.scenarioMode);
    setMarketQuotes(data.marketQuotes);
    setMarketUf(data.marketUf);
    setFutureQuotes(data.futureQuotes);
    setFuturePhysicalBasePrices(data.futurePhysicalBasePrices);
    setFuturePhysicalBaseDates(data.futurePhysicalBaseDates);
    setFutureUsdBrl(data.futureUsdBrl);
    setFutureHedgePercent(data.futureHedgePercent);
    setCottonFiberRecovery(data.cottonFiberRecovery);
    setCottonSeedCredit(data.cottonSeedCredit);
    setHerdFlowInputs(data.herdFlowInputs);
    setAllocationInputs(data.allocationInputs);
    setLotProfiles(data.lotProfiles);
    setAnimalTimelineInputs(data.animalTimelineInputs);
    setCropMarketingWindows(data.cropMarketingWindows);
    setDoubleCropCalendar(data.doubleCropCalendar);
    setOperationalInputs(extras.operationalInputs);
    setCropOperational(data.cropOperational);
    setBreedingEconomicsInputs(data.breedingEconomicsInputs);
    setStrategyStress(data.strategyStress);
    setStrategyCriterion(data.strategyCriterion);
    setStrategyMaxShare(data.strategyMaxShare);
    setStrategyCapitalLimit(data.strategyCapitalLimit);
    setStrategyErrorHa(data.strategyErrorHa);
    setAppliedPriceMeta(data.appliedPriceMeta);
    setGateAppliedPriceMeta(data.gateAppliedPriceMeta);
    setAppliedFutureFingerprints(data.appliedFutureFingerprints);
    const trail = extras.scenarioAuditTrail;
    setScenarioAuditTrail([...trail.slice(-199), `Restaurado e recalculado no modelo ${MODEL_VERSION}; confirme novamente evidências e capacidade operacional.`]);
    setSavedStatus('Cenário restaurado. Confirmações operacionais precisam ser renovadas.');
  };
  const serializedScenario = () => JSON.stringify({ schema: SCENARIO_SCHEMA,
    model: MODEL_VERSION, savedAt: new Date().toISOString(),
    marketEvidence: { method: 'conab-weekly-v1', uf: marketUf, observations: marketEvidence.filter(q => q.uf === marketUf) },
    data: { ...scenarioData, reviewInputs, scenarioAuditTrail } }, null, 2);
  const saveLocalScenario = () => {
    try { localStorage.setItem(SCENARIO_STORAGE_KEY, serializedScenario());
      setSavedStatus('Cenário salvo somente neste navegador. Use Baixar cenário para compartilhar.');
    } catch { setSavedStatus('Não foi possível salvar neste navegador. Use Baixar cenário.'); }
  };
  const downloadScenario = () => {
    const url = URL.createObjectURL(new Blob([serializedScenario()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'boimeta-cenario.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const restoreLocalScenario = () => {
    try {
      const raw = localStorage.getItem(SCENARIO_STORAGE_KEY);
      if (!raw) throw new Error('Nenhum cenário salvo neste navegador.');
      restoreScenario(JSON.parse(raw));
    } catch (error) { setSavedStatus(error instanceof Error ? error.message : 'Arquivo inválido.'); }
  };

  const futureScenarioFingerprint = JSON.stringify({
    forage: reviewInputs,
    quantities: [assumptions.totalArea, assumptions.stockingUa, assumptions.entryWeight, assumptions.saleWeight, assumptions.gmdB, animalTimelineInputs.pastureMortality, ...crops.map((crop) => crop.yield)],
    quotes: futureQuotes,
    physicalBasePrices: futurePhysicalBasePrices,
    physicalBaseDates: futurePhysicalBaseDates,
    animalEntryDate: animalTimelineInputs.entryDate,
    futureUsdBrl,
    futureHedgePercent,
    cottonFiberRecovery,
    cottonSeedCredit,
  });
  const todayInSaoPaulo = () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
  const [asOfDate, setAsOfDate] = useState(todayInSaoPaulo);
  useEffect(() => {
    const updateDay = () => setAsOfDate(todayInSaoPaulo());
    const timer = window.setInterval(updateDay, 60000);
    window.addEventListener('focus', updateDay);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', updateDay); };
  }, []);
  const marketRequest = useRef<AbortController | null>(null);
  useEffect(() => () => marketRequest.current?.abort(), [marketUf]);

  const invalidateOperationalConfirmations = () =>
    setAllocationInputs((current) => ({
      ...current,
      dietFormulaConfirmed: false,
      feedAvailabilityConfirmed: false,
      peakCapacityConfirmed: false,
      thirdPartyQuoteConfirmed: false,
      annualCalendarConfirmed: false,
      pastureWaterForageConfirmed: false,
      cowOpportunityWindowConfirmed: false,
      effluentCalibrationPeriodConfirmed: false,
      effluentCreditConfirmed: false,
      effluentExcessDestinationConfirmed: false,
    }));

  const invalidateCropOperationalConfirmations = () =>
    setCropOperational({
      'soy-irrigated': emptyCropOperationalGate(),
      'corn-irrigated': emptyCropOperationalGate(),
      'cotton-irrigated': emptyCropOperationalGate(),
    });

  const invalidateSingleCropOperationalConfirmation = (
    id: CropAssumption['id'],
  ) =>
    setCropOperational((current) => ({
      ...current,
      [id]: emptyCropOperationalGate(),
    }));

  const appliedPriceIsValid = (id: MarketQuote['id']) => {
    const ageDays = isoAgeDays(appliedPriceMeta[id].date, asOfDate);
    const futureExecutionReady =
      id === 'cattle' ||
      (id === 'soy-irrigated' && cropMarketingWindows.soy.carryBasisConfirmed) ||
      (id === 'corn-irrigated' && cropMarketingWindows.corn.carryBasisConfirmed) ||
      (id === 'cotton-irrigated' &&
        cropMarketingWindows.cotton.carryBasisConfirmed);
    return (
      ageDays !== null &&
      ageDays >= 0 &&
      ageDays <= MAX_PHYSICAL_QUOTE_AGE_DAYS &&
      provenanceCanRank(appliedPriceMeta[id].provenance, scenarioMode) &&
      (appliedPriceMeta[id].provenance !== 'future-scenario' ||
        (appliedFutureFingerprints[id] === futureScenarioFingerprint &&
          futureExecutionReady))
    );
  };
  const appliedPriceSupportsBase = (id: MarketQuote['id']) =>
    appliedPriceMeta[id].provenance === 'local-spreadsheet' ||
    appliedPriceIsValid(id);

  const update = <K extends keyof Assumptions>(key: K, value: Assumptions[K]) => {
    setAssumptions((current) => ({
      ...current,
      [key]: value,
      ...(key === 'totalArea' && typeof value === 'number'
        ? { effluentArea: value }
        : {}),
    }));
    if (
      [
        'totalArea',
        'stockingUa',
        'pastureExtraCostHa',
        'otherCostFactor',
        'entryWeight',
        'pivotExitWeight',
        'saleWeight',
        'gmdPivotA',
        'gmdFeedlot',
        'gmdB',
        'supplementPrice',
        'dietDmDay',
        'dietPriceDm',
        'dietOtherCostDm',
        'forageShare',
        'silageShare',
        'silageYieldDm',
        'silageCostHaCut',
        'silageCrops',
        'silageRecovery',
        'includeCows',
        'cowBuyCost',
        'cowSaleArroba',
        'includeEffluentSavings',
        'effluentArea',
        'effluentDepthMm',
        'effluentValueM3',
      ].includes(String(key))
    ) {
      invalidateOperationalConfirmations();
    }
    if (key === 'totalArea') {
      setDoubleCropCalendar((current) => ({
        ...current,
        waterEnergyConfirmed: false,
        machineCapacityConfirmed: false,
      }));
      invalidateCropOperationalConfirmations();
    }
    if (key === 'priceArroba' && typeof value === 'number') {
      setAppliedFutureFingerprints((current) => ({ ...current, cattle: '' }));
      setFuturePhysicalBasePrices((current) => ({
        ...current,
        cattle: value,
      }));
      setFuturePhysicalBaseDates((current) => ({
        ...current,
        cattle: '',
      }));
      setAppliedPriceMeta((current) => ({
        ...current,
        cattle: {
          provenance: 'manual-override',
          date: '',
          source: 'edição direta no cenário; cotação observada preservada',
        },
      }));
    }
    if (key === 'calfCost') {
      setBreedingEconomicsInputs((current) => ({
        ...current,
        calfPriceSourceDate: '',
        calfPriceSource: '',
      }));
    }
  };

  const updateCrop = (
    id: CropAssumption['id'],
    key: 'yield' | 'price' | 'deductionRate' | 'fixedRate' | 'fixedCostHa',
    value: number,
  ) => {
    setCrops((current) =>
      current.map((crop) => (crop.id === id ? { ...crop, [key]: value } : crop)),
    );
    if (key === 'price') {
      setAppliedFutureFingerprints((current) => ({ ...current, [id]: '' }));
      setFuturePhysicalBasePrices((current) => ({
        ...current,
        [id]: value,
      }));
      setFuturePhysicalBaseDates((current) => ({
        ...current,
        [id]: '',
      }));
      setAppliedPriceMeta((current) => ({
        ...current,
        [id]: {
          provenance: 'manual-override',
          date: '',
          source: 'edição direta no cenário; cotação observada preservada',
        },
      }));
    }
    setDoubleCropCalendar((current) => ({
      ...current,
      waterEnergyConfirmed: false,
      machineCapacityConfirmed: false,
    }));
    if (key === 'yield') invalidateSingleCropOperationalConfirmation(id);
    if (id === 'corn-irrigated') invalidateOperationalConfirmations();
  };

  const updateCropCost = (
    id: CropAssumption['id'],
    costId: string,
    value: number,
  ) => {
    setCrops((current) =>
      current.map((crop) =>
        crop.id === id ? updateCropCostItem(crop, costId, value, costEditMode) : crop,
      ),
    );
    if (id === 'corn-irrigated') invalidateOperationalConfirmations();
    setDoubleCropCalendar((current) => ({
      ...current,
      waterEnergyConfirmed: false,
      machineCapacityConfirmed: false,
    }));
  };

  const updateMarketQuote = (
    id: MarketQuote['id'],
    key: 'date' | 'reference' | 'basis',
    value: string | number,
  ) =>
    setMarketQuotes((current) =>
      current.map((quote) =>
        quote.id === id
          ? {
              ...quote,
              [key]: value,
               provenance: 'manual-override',
            }
          : quote,
      ),
    );

  const updateFutureQuote = (
    id: string,
    key: 'rawPrice' | 'localBasis' | 'sourceDate' | 'referenceDate',
    value: number | string,
  ) => {
    setFutureQuotes((current) =>
      current.map((quote) =>
        quote.id === id
          ? key === 'referenceDate' && typeof value === 'string'
            ? {
                ...quote,
                referenceDate: value,
                deliveryMonth: value.slice(0, 7),
                contract: value.slice(0, 7),
                provenance: 'manual-override',
              }
            : { ...quote, [key]: value, provenance: 'manual-override' }
          : quote,
      ),
    );
    invalidateOperationalConfirmations();
  };

  const updateHerdFlow = <K extends keyof typeof herdFlowDefaults>(
    key: K,
    value: (typeof herdFlowDefaults)[K],
  ) => {
    setHerdFlowInputs((current) => ({ ...current, [key]: value }));
    setBreedingEconomicsInputs((current) => ({
      ...current,
      inputsConfirmed: false,
    }));
    invalidateOperationalConfirmations();
  };

  const updateAllocation = <K extends keyof typeof allocationDefaults>(
    key: K,
    value: (typeof allocationDefaults)[K],
  ) =>
    setAllocationInputs((current) => {
      const confirmationKeys = new Set([
        'dietFormulaConfirmed',
        'feedAvailabilityConfirmed',
        'peakCapacityConfirmed',
        'thirdPartyQuoteConfirmed',
        'annualCalendarConfirmed',
        'pastureWaterForageConfirmed',
        'cowOpportunityWindowConfirmed',
        'effluentCalibrationPeriodConfirmed',
        'effluentCreditConfirmed',
        'effluentExcessDestinationConfirmed',
      ]);
      if (confirmationKeys.has(String(key))) return { ...current, [key]: value };
      return {
        ...current,
        [key]: value,
        dietFormulaConfirmed: false,
        feedAvailabilityConfirmed: false,
        peakCapacityConfirmed: false,
        thirdPartyQuoteConfirmed: false,
        annualCalendarConfirmed: false,
        pastureWaterForageConfirmed: false,
        cowOpportunityWindowConfirmed: false,
        effluentCalibrationPeriodConfirmed: false,
        effluentCreditConfirmed: false,
        effluentExcessDestinationConfirmed: false,
      };
    });

  const updateOperational = <K extends keyof typeof operationalDefaults>(
    key: K,
    value: (typeof operationalDefaults)[K],
  ) => setOperationalInputs((current) => ({ ...current, [key]: value }));

  const updateAnimalTimeline = <K extends keyof typeof animalTimelineDefaults>(
    key: K,
    value: (typeof animalTimelineDefaults)[K],
  ) => {
    setAnimalTimelineInputs((current) => ({
      ...current,
      [key]: value,
      bgiEligible: key === 'bgiEligible' ? Boolean(value) : false,
    }));
    if (key === 'gateValuePerKgLive' || key === 'gateSourceDate') {
      setGateAppliedPriceMeta({
        provenance: 'manual-override',
        date:
          key === 'gateSourceDate'
            ? String(value)
            : animalTimelineInputs.gateSourceDate,
        source: 'cotação/cenário local informado manualmente',
      });
    }
    invalidateOperationalConfirmations();
  };

  const arrobasToLiveKg = (arrobas: number) =>
    animalTimelineInputs.liveEquivalent
      ? arrobas * 30
      : (arrobas * 15) /
        Math.max(0.01, animalTimelineInputs.carcassYield / 100);

  const liveKgToArrobas = (liveKg: number) =>
    animalTimelineInputs.liveEquivalent
      ? liveKg / 30
      : (liveKg * (animalTimelineInputs.carcassYield / 100)) / 15;

  const updateQuickEntryArrobas = (value: number) => {
    updateAnimalTimeline('entryArrobas', value);
    update('entryWeight', arrobasToLiveKg(value));
  };

  const updateQuickDecisionArrobas = (value: number) => {
    updateAnimalTimeline('decisionArrobas', value);
    update('pivotExitWeight', arrobasToLiveKg(value));
  };

  const updateQuickSaleArrobas = (value: number) => {
    update('saleWeight', arrobasToLiveKg(value));
  };

  const updateBreedingEconomics = <
    K extends keyof typeof breedingEconomicsDefaults,
  >(
    key: K,
    value: (typeof breedingEconomicsDefaults)[K],
  ) => {
    setBreedingEconomicsInputs((current) => ({
      ...current,
      [key]: value,
      inputsConfirmed:
        key === 'inputsConfirmed' ? Boolean(value) : false,
    }));
    invalidateOperationalConfirmations();
  };

  const updateStrategyStress = <K extends keyof typeof strategyStressDefaults>(
    key: K,
    value: (typeof strategyStressDefaults)[K],
  ) => setStrategyStress((current) => ({ ...current, [key]: value }));

  const updateStrategyCapitalLimit = (value: number) => {
    setStrategyCapitalLimit(value);
    invalidateOperationalConfirmations();
  };

  const updateLotProfile = (
    id: string,
    key: 'share' | 'pastureGmd' | 'gmd' | 'dietDmDay' | 'entryDate' | 'exitDate',
    value: number | string,
  ) => {
    setLotProfiles((current) =>
      current.map((lot) => (lot.id === id ? { ...lot, [key]: value } : lot)),
    );
    invalidateOperationalConfirmations();
  };

  const applyMarketQuote = (quote: MarketQuote) => {
    const ageDays = isoAgeDays(quote.date, asOfDate);
    const dateValid =
      ageDays !== null &&
      ageDays >= 0 &&
      ageDays <= MAX_PHYSICAL_QUOTE_AGE_DAYS;
    if (!dateValid) {
      setMarketStatus(
        `${quote.label}: a data-base deve ser válida, não futura e ter no máximo ${MAX_PHYSICAL_QUOTE_AGE_DAYS} dias. Cotações antigas podem ser preservadas como hipótese histórica, mas não entram no ranking atual.`,
      );
      return;
    }
    const finalPrice = Math.max(0, quote.reference + quote.basis);
    if (quote.id === 'cattle') update('priceArroba', finalPrice);
    else updateCrop(quote.id, 'price', finalPrice);
    setFuturePhysicalBaseDates((current) => ({
      ...current,
      [quote.id]: quote.date,
    }));
    setAppliedPriceMeta((current) => ({
      ...current,
      [quote.id]: {
        provenance:
          quote.provenance === 'conab-official' && quote.basis === 0
            ? 'conab-official'
            : 'manual-override',
        date: quote.date,
        source:
          quote.provenance === 'conab-official' && quote.basis === 0
            ? `${quote.market} · ${quote.sourceUrl}`
            : quote.provenance === 'conab-official'
              ? `Indicador oficial ${quote.market} ajustado manualmente por basis local de ${brl2.format(quote.basis)} · ${quote.sourceUrl}`
              : `Valor informado manualmente; referência comparativa: ${quote.market} · ${quote.sourceUrl}`,
      },
    }));
    setAppliedFutureFingerprints((current) => ({ ...current, [quote.id]: '' }));
  };

  const applyRadarPrice = (observation: ConabPrice) => {
    if (observation.uf !== marketUf || observation.product === 'cotton') return;
    const id: MarketQuote['id'] = observation.product === 'cattle' ? 'cattle' :
      observation.product === 'soy' ? 'soy-irrigated' : 'corn-irrigated';
    const template = marketQuoteDefaults.find(q => q.id === id)!;
    const quote: MarketQuote = { ...template, basis: 0, reference: observation.value,
      date: observation.sourceDate, market: `CONAB · produtor · ${marketUf} · ${observation.rawPeriod}`,
      sourceUrl: 'https://consultaprecosdemercado.conab.gov.br/', provenance: 'conab-official' };
    applyMarketQuote(quote);
    setMarketQuotes(current => current.map(q => q.id === id ? quote : q));
    setScenarioAuditTrail(current => [...current.slice(-199),
      `Preço de venda aplicado: ${id} · ${observation.value} ${observation.displayUnit} · ${marketUf} · ${observation.sourceDate}. Milho entregue e reposição preservados.`]);
  };

  const loadProductionBase = () => {
    setAssumptions(current => ({ ...current, totalArea: 400, silageShare: 25,
      stockingUa: 7.8, entryWeight: 240, pivotExitWeight: 400, saleWeight: 540,
      gmdPivotA: 0.9, gmdFeedlot: 1.48, gmdB: 1, dietDmDay: 11.14, forageShare: 45 }));
    setAnimalTimelineInputs(current => ({ ...current, entryArrobas: 8,
      decisionArrobas: 400 / 30, liveEquivalent: true, bgiEligible: false }));
    invalidateOperationalConfirmations();
    setActiveTab('quick');
    setScenarioAuditTrail(current => [...current.slice(-199),
      'Base produtiva de 400 ha carregada; preços, custos, datas, cocho e orçamento atuais preservados.']);
    setSavedStatus('Base produtiva: 400 ha, 300 de pasto + 100 de silagem, 240 → 400 → 540 kg. Preços, custos, datas e capacidade preservados.');
  };

  const fetchMarketPrices = async () => {
    marketRequest.current?.abort();
    const controller = new AbortController();
    marketRequest.current = controller;
    setMarketLoading(true);
    setMarketStatus(isStaticEdition ? `Carregando referência semanal publicada para ${marketUf}…` : `Consultando a última semana encerrada para ${marketUf}…`);
    try {
      const response = await fetch(marketPricesUrl(marketUf), { signal: controller.signal });
      const payload = (await response.json()) as {
        error?: string;
        legalNote?: string;
        quotes?: MarketApiQuote[];
        missingProducts?: MarketApiQuote['product'][];
      };
      if (controller.signal.aborted) return;
      if (!response.ok || !payload.quotes?.length || payload.quotes.some(q => q.uf !== marketUf)) {
        throw new Error(payload.error ?? 'A fonte não retornou cotações.');
      }
      const byProduct = new Map(payload.quotes.map((item) => [item.product, item]));
      const productById: Record<MarketQuote['id'], MarketApiQuote['product']> = {
        cattle: 'cattle',
        'soy-irrigated': 'soy',
        'corn-irrigated': 'corn',
        'cotton-irrigated': 'cotton',
      };
      setMarketQuotes((current) =>
        current.map((quote) => {
          const official = byProduct.get(productById[quote.id]);
          if (!official) {
            return {
              ...quote,
              date: '',
              market: `Manual preservado · CONAB sem ${quote.label.toLowerCase()} recente para ${marketUf}`,
              officialReference: undefined,
              officialUnit: undefined,
              officialDate: undefined,
              provenance: 'manual-override',
              note: 'Sem referência oficial nas quatro semanas consultadas. O valor foi preservado apenas como hipótese manual e não pode ser aplicado sem data-base.',
            };
          }
          const cottonNeedsConversion = quote.id === 'cotton-irrigated';
          return {
            ...quote,
            date: cottonNeedsConversion ? '' : official.sourceDate,
            reference: cottonNeedsConversion ? quote.reference : official.value,
            market: cottonNeedsConversion
              ? `Manual sem data · CONAB pluma separada · ${official.uf} · ${official.rawPeriod}`
              : `CONAB · produtor · ${official.uf} · ${official.rawPeriod}`,
            sourceUrl: 'https://consultaprecosdemercado.conab.gov.br/',
            officialReference: official.value,
            officialUnit: official.displayUnit,
            officialDate: official.sourceDate,
            provenance: cottonNeedsConversion
              ? 'manual-override'
              : 'conab-official',
            note: cottonNeedsConversion
              ? 'A referência pública é de pluma e foi guardada apenas no campo oficial. Ela não empresta data ao equivalente manual da fazenda; converta rendimento, qualidade, caroço e beneficiamento e informe uma data própria antes de aplicar.'
              : 'Referência semanal ao produtor. Use o basis para representar frete, qualidade, impostos, prazo e prêmio/deságio local.',
          };
        }),
      );
      const productLabels: Record<MarketApiQuote['product'], string> = {
        cattle: 'boi',
        soy: 'soja',
        corn: 'milho',
        cotton: 'algodão',
      };
      const found = [...new Set(payload.quotes.map((quote) => productLabels[quote.product]))];
      const missing = (payload.missingProducts ?? []).map(
        (product) => productLabels[product],
      );
      setMarketStatus(
        `${isStaticEdition ? 'Arquivo público atualizado periodicamente — não tempo real. ' : ''}CONAB ${marketUf}: ${found.join(', ')} carregado(s), cada qual com sua data. ${missing.length ? `Sem publicação recente para ${missing.join(', ')}; os valores ficaram como hipótese manual sem data.` : 'Produtos disponíveis; confira a data de cada referência, especialmente em arquivos preservados.'} Algodão em pluma continua exigindo conversão antes de substituir o equivalente da fazenda.`,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      setMarketStatus(
        `${error instanceof Error ? error.message : 'Consulta indisponível.'} Os valores manuais foram preservados.`,
      );
    } finally {
      if (marketRequest.current === controller) setMarketLoading(false);
    }
  };

  const loadExplorationScenario = async () => {
    setExplorationLoading(true);
    setScenarioMode('exploration');
    const demoArea = Math.max(1, assumptions.totalArea);
    const demoEntryDate = addIsoDays(asOfDate, 9);
    const demoEntryWeight = animalTimelineDefaults.entryArrobas * 30;
    const demoDecisionWeight = animalTimelineDefaults.decisionArrobas * 30;
    const demoDecisionDays = Math.ceil(
      (demoDecisionWeight - demoEntryWeight) / defaultAssumptions.gmdPivotA,
    );
    const demoDecisionDate = addIsoDays(demoEntryDate, demoDecisionDays);
    const demoOwnExitDate = addIsoDays(
      demoDecisionDate,
      Math.ceil(
        (defaultAssumptions.saleWeight - demoDecisionWeight) /
          defaultAssumptions.gmdFeedlot,
      ),
    );
    const demoPastureExitDate = addIsoDays(
      demoDecisionDate,
      Math.ceil(
        (defaultAssumptions.saleWeight - demoDecisionWeight) /
          defaultAssumptions.gmdB,
      ),
    );
    const demoRouteBExitDate = addIsoDays(
      demoEntryDate,
      Math.ceil(
        (defaultAssumptions.saleWeight - demoEntryWeight) /
          defaultAssumptions.gmdB,
      ),
    );
    const soyPlantDate = addIsoDays(asOfDate, 30);
    const soyHarvestDate = addIsoDays(soyPlantDate, 137);
    const cornPlantDate = addIsoDays(soyHarvestDate, 5);
    const cornHarvestDate = addIsoDays(cornPlantDate, 140);
    const cottonPlantDate = addIsoDays(asOfDate, 45);
    const cottonHarvestDate = addIsoDays(cottonPlantDate, 243);
    const conabUrl = 'https://consultaprecosdemercado.conab.gov.br/';

    try {
      let officialQuotes: MarketApiQuote[] = [];
      let usedConab = false;
      try {
        const response = await fetch(marketPricesUrl('BA'));
        const payload = (await response.json()) as {
          quotes?: MarketApiQuote[];
        };
        if (response.ok && payload.quotes?.length) {
          officialQuotes = payload.quotes;
          usedConab = true;
        }
      } catch {
        // O modo exploratório continua com o snapshot ilustrativo local e
        // mantém essa proveniência explícita. Nenhum fallback vira dado real.
      }

      const officialByProduct = new Map(
        officialQuotes.map((quote) => [quote.product, quote]),
      );
      const currentCropPrice = (id: CropAssumption['id']) =>
        crops.find((crop) => crop.id === id)?.price ??
        cropDefaults.find((crop) => crop.id === id)?.price ??
        0;
      const cattleOfficial = officialByProduct.get('cattle');
      const soyOfficial = officialByProduct.get('soy');
      const cornOfficial = officialByProduct.get('corn');
      const cottonOfficial = officialByProduct.get('cotton');
      const cattlePrice = cattleOfficial?.value ?? assumptions.priceArroba;
      const soyPrice = soyOfficial?.value ?? currentCropPrice('soy-irrigated');
      const cornPrice = cornOfficial?.value ?? currentCropPrice('corn-irrigated');
      const cottonPrice = cottonOfficial
        ? cottonOfficial.value * (cottonFiberRecovery / 100) + cottonSeedCredit
        : currentCropPrice('cotton-irrigated');
      const sourceDates: Record<MarketQuote['id'], string> = {
        cattle: cattleOfficial?.sourceDate ?? asOfDate,
        'soy-irrigated': soyOfficial?.sourceDate ?? asOfDate,
        'corn-irrigated': cornOfficial?.sourceDate ?? asOfDate,
        'cotton-irrigated': cottonOfficial?.sourceDate ?? asOfDate,
      };
      const prices: Record<MarketQuote['id'], number> = {
        cattle: cattlePrice,
        'soy-irrigated': soyPrice,
        'corn-irrigated': cornPrice,
        'cotton-irrigated': cottonPrice,
      };
      const productById: Record<
        MarketQuote['id'],
        MarketApiQuote['product']
      > = {
        cattle: 'cattle',
        'soy-irrigated': 'soy',
        'corn-irrigated': 'corn',
        'cotton-irrigated': 'cotton',
      };

      setAssumptions((current) => ({
        ...current,
        priceArroba: cattlePrice,
        includeCows: false,
        includeEffluentSavings: false,
      }));
      setCrops((current) =>
        current.map((crop) => ({ ...crop, price: prices[crop.id] })),
      );
      setMarketQuotes((current) =>
        current.map((quote) => {
          const official = officialByProduct.get(productById[quote.id]);
          const cottonDerived = quote.id === 'cotton-irrigated' && official;
          return {
            ...quote,
            date: sourceDates[quote.id],
            reference: prices[quote.id],
            basis: 0,
            market: official
              ? cottonDerived
                ? `Demonstração derivada · CONAB pluma · BA · ${official.rawPeriod}`
                : `Demonstração · CONAB produtor · BA · ${official.rawPeriod}`
              : 'Snapshot demonstrativo local · substitua por cotação da praça',
            sourceUrl: official ? conabUrl : quote.sourceUrl,
            provenance: 'manual-override',
            officialReference: official?.value,
            officialUnit: official?.displayUnit,
            officialDate: official?.sourceDate,
            note: cottonDerived
              ? `Exemplo: pluma CONAB × ${one.format(cottonFiberRecovery)}% de rendimento + ${brl2.format(cottonSeedCredit)}/@ de crédito do caroço. Não é preço líquido contratado.`
              : 'Valor carregado somente para explorar o motor. Confirme praça, basis, frete, impostos, qualidade e prazo antes de validar.',
          };
        }),
      );
      setFuturePhysicalBasePrices(prices);
      setFuturePhysicalBaseDates(sourceDates);
      setAppliedPriceMeta(
        Object.fromEntries(
          (Object.keys(prices) as MarketQuote['id'][]).map((id) => [
            id,
            {
              provenance: 'demo-snapshot' as const,
              date: sourceDates[id],
              source:
                id === 'cotton-irrigated' && cottonOfficial
                  ? `DEMONSTRAÇÃO · derivado da pluma CONAB (${cottonOfficial.value} ${cottonOfficial.displayUnit}) × ${cottonFiberRecovery}% + crédito ilustrativo do caroço; ${conabUrl}`
                  : officialByProduct.get(productById[id])
                    ? `DEMONSTRAÇÃO · referência semanal CONAB BA; ${conabUrl}`
                    : 'DEMONSTRAÇÃO · snapshot local ilustrativo sem validação de praça',
            },
          ]),
        ) as Record<MarketQuote['id'], AppliedPriceMeta>,
      );
      setAppliedFutureFingerprints(appliedFutureFingerprintDefaults);

      const demoCattleQuote = (
        id: string,
        contract: string,
        referenceDate: string,
        factor: number,
      ): FutureQuote => ({
        id,
        product: 'cattle',
        contract,
        deliveryMonth: referenceDate.slice(0, 7),
        referenceDate,
        rawPrice: cattlePrice * factor,
        rawUnit: 'BRL_ARROBA',
        localBasis: 0,
        sourceDate: asOfDate,
        exchange: 'B3',
        symbol: 'BGI',
        sourceUrl:
          'https://www.b3.com.br/pt_br/market-data-e-indices/servicos-de-dados/market-data/historico/boletins-diarios/pesquisa-por-pregao/pesquisa-por-pregao/',
        note: 'DEMONSTRAÇÃO: ponto ilustrativo derivado do preço físico; não é cotação coletada da B3 nem preço garantido.',
        provenance: 'manual-override',
      });
      setFutureQuotes([
        demoCattleQuote(
          'demo-bgi-cocho',
          'Demo · cocho',
          demoOwnExitDate,
          1.06,
        ),
        demoCattleQuote(
          'demo-bgi-b',
          'Demo · rota B',
          demoRouteBExitDate,
          1.08,
        ),
        demoCattleQuote(
          'demo-bgi-pasto',
          'Demo · pasto',
          demoPastureExitDate,
          1.1,
        ),
        ...futureQuoteDefaults
          .filter((quote) => quote.product !== 'cattle')
          .map((quote) => ({
            ...quote,
            sourceDate: asOfDate,
            note: `DEMONSTRAÇÃO: ${quote.note} Atualize o fechamento antes de qualquer decisão.`,
            provenance: 'manual-override' as const,
          })),
      ]);
      setAnimalTimelineInputs((current) => ({
        ...current,
        entryDate: demoEntryDate,
        entryQuoteDate: asOfDate,
        entryQuoteSource: 'DEMONSTRAÇÃO · bezerro de referência editável',
        gateValuationDate: demoDecisionDate,
        gateSourceDate: asOfDate,
        bgiEligible: true,
      }));
      setGateAppliedPriceMeta({
        provenance: 'demo-snapshot',
        date: asOfDate,
        source: 'DEMONSTRAÇÃO · valor ilustrativo do boi magro na data de decisão',
      });
      setBreedingEconomicsInputs((current) => ({
        ...current,
        calfPriceSourceDate: asOfDate,
        calfPriceSource: 'DEMONSTRAÇÃO · preço de reposição editável',
        inputsConfirmed: false,
        applyToComparison: false,
      }));
      setAllocationInputs((current) => ({
        ...current,
        dietFormulaConfirmed: true,
        feedAvailabilityConfirmed: true,
        peakCapacityConfirmed: true,
        thirdPartyQuoteConfirmed: false,
        annualCalendarConfirmed: true,
        pastureWaterForageConfirmed: true,
        cowOpportunityWindowConfirmed: false,
        effluentCalibrationSource:
          'DEMONSTRAÇÃO · demo-snapshot do módulo-base; não é medição local',
        effluentCalibrationPeriodStart: addIsoDays(asOfDate, -365),
        effluentCalibrationPeriodEnd: asOfDate,
        effluentCalibrationPeriodConfirmed: true,
        effluentValueSource:
          'DEMONSTRAÇÃO · demo-snapshot do valor evitável; substituir por fonte local',
        effluentValueDate: asOfDate,
        effluentCreditConfirmed: false,
        effluentExcessDestination: '',
        effluentExcessDestinationCapacityM3: 0,
        effluentExcessDestinationConfirmed: false,
      }));
      setLotProfiles(
        lotProfileDefaults.map((lot) => ({
          ...lot,
          entryDate: demoDecisionDate,
          exitDate: addIsoDays(
            demoDecisionDate,
            Math.ceil(
              (defaultAssumptions.saleWeight - demoDecisionWeight) / lot.gmd,
            ),
          ),
        })),
      );
      setCropOperational({
        'soy-irrigated': {
          plantDate: soyPlantDate,
          harvestDate: soyHarvestDate,
          waterEnergyConfirmed: true,
          waterEnergyCapacityHa: demoArea,
          machineCapacityConfirmed: true,
          machineCapacityHa: demoArea,
        },
        'corn-irrigated': {
          plantDate: cornPlantDate,
          harvestDate: cornHarvestDate,
          waterEnergyConfirmed: true,
          waterEnergyCapacityHa: demoArea,
          machineCapacityConfirmed: true,
          machineCapacityHa: demoArea,
        },
        'cotton-irrigated': {
          plantDate: cottonPlantDate,
          harvestDate: cottonHarvestDate,
          waterEnergyConfirmed: true,
          waterEnergyCapacityHa: demoArea,
          machineCapacityConfirmed: true,
          machineCapacityHa: demoArea,
        },
      });
      setDoubleCropCalendar({
        soyPlantDate,
        soyHarvestDate,
        cornPlantDate,
        cornHarvestDate,
        waterEnergyConfirmed: true,
        waterEnergyCapacityHa: demoArea,
        machineCapacityConfirmed: true,
        machineCapacityHa: demoArea,
      });
      setCropMarketingWindows({
        soy: {
          availableDate: addIsoDays(soyHarvestDate, 1),
          lastDeliveryDate: addIsoDays(soyHarvestDate, 90),
          carryBasisConfirmed: true,
        },
        corn: {
          availableDate: addIsoDays(cornHarvestDate, 1),
          lastDeliveryDate: addIsoDays(cornHarvestDate, 90),
          carryBasisConfirmed: true,
        },
        cotton: {
          availableDate: addIsoDays(cottonHarvestDate, 1),
          lastDeliveryDate: addIsoDays(cottonHarvestDate, 90),
          carryBasisConfirmed: true,
        },
      });
      setStrategyCapitalLimit(60_000_000);
      setScenarioAuditTrail([
        `DEMONSTRAÇÃO carregada em ${asOfDate}. Preços físicos ${usedConab ? 'partem da última semana disponível da CONAB BA' : 'usam o snapshot local ilustrativo'}; curva pecuária, capacidades, calendários e confirmações são hipóteses para explorar o motor, não validações de campo.`,
      ]);
      setMarketStatus(
        usedConab
          ? 'Demonstração carregada com a última semana disponível da CONAB BA. Os demais gates foram preenchidos como hipóteses ilustrativas e precisam ser substituídos.'
          : 'CONAB indisponível: demonstração carregada com snapshot local ilustrativo. Nenhum preço deve ser tratado como cotação atual.',
      );
      setActiveTab('quick');
      window.setTimeout(
        () =>
          document
            .getElementById('analysis-tabs')
            ?.scrollIntoView({ behavior: 'smooth' }),
        0,
      );
    } finally {
      setExplorationLoading(false);
    }
  };

  const openExplorationScenario = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'demo');
    window.open(url.toString(), '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    explorationLoader.current = loadExplorationScenario;
  });

  useEffect(() => {
    if (
      explorationAutoloaded.current ||
      new URLSearchParams(window.location.search).get('mode') !== 'demo'
    ) {
      return;
    }
    explorationAutoloaded.current = true;
    void explorationLoader.current();
  }, []);

  const applyPriceShock = (factor: number) => {
    setAssumptions((current) => ({
      ...current,
      priceArroba: Math.max(0, current.priceArroba * factor),
    }));
    setCrops((current) =>
      current.map((crop) => ({ ...crop, price: Math.max(0, crop.price * factor) })),
    );
    setAnimalTimelineInputs((current) => ({
      ...current,
      gateValuePerKgLive: Math.max(0, current.gateValuePerKgLive * factor),
    }));
    setFuturePhysicalBasePrices((current) =>
      Object.fromEntries(
        Object.entries(current).map(([key, value]) => [
          key,
          Math.max(0, value * factor),
        ]),
      ) as Record<MarketQuote['id'], number>,
    );
    setAppliedPriceMeta((current) =>
      Object.fromEntries(
        Object.keys(current).map((id) => [
          id,
          {
            provenance: 'scenario-shock',
            date: current[id as MarketQuote['id']].date,
            source: `choque multiplicativo ×${factor.toFixed(4)} sobre ${current[id as MarketQuote['id']].source}; fonte-base preservada`,
          },
        ]),
      ) as Record<MarketQuote['id'], AppliedPriceMeta>,
    );
    setGateAppliedPriceMeta((current) => ({
      provenance: 'scenario-shock',
      date: current.date,
      source: `choque multiplicativo ×${factor.toFixed(4)} sobre ${current.source}`,
    }));
    setScenarioAuditTrail((current) => [
      ...current,
      `Choque de cenário aplicado aos preços modelados: ×${factor.toFixed(4)}. Fontes, datas-base subjacentes e curva futura foram preservadas; a proveniência do preço aplicado foi marcada como scenario-shock.`,
    ]);
    invalidateOperationalConfirmations();
  };

  const applyCostShock = (factor: number) => {
    setAssumptions((current) => ({
      ...current,
      dietPriceDm: current.dietPriceDm * factor,
      dietOtherCostDm: current.dietOtherCostDm * factor,
      supplementPrice: current.supplementPrice * factor,
    }));
    invalidateOperationalConfirmations();
    setCrops((current) =>
      current.map((crop) => ({
        ...crop,
        costItems: crop.costItems.map((item) => ({ ...item, value: item.value * factor })),
      })),
    );
    setScenarioAuditTrail((current) => [
      ...current,
      `Choque de cenário aplicado a ração, suplemento e custos agrícolas: ×${factor.toFixed(4)}.`,
    ]);
  };

  const resetScenario = () => {
    setActiveTab('quick');
    setScenarioMode('validation');
    setExplorationLoading(false);
    setAssumptions(defaultAssumptions);
    setCrops(cropDefaults);
    setMarketQuotes(marketQuoteDefaults);
    setFutureQuotes(futureQuoteDefaults);
    setFuturePhysicalBasePrices(futurePhysicalBaseDefaults);
    setFuturePhysicalBaseDates(futurePhysicalBaseDateDefaults);
    setFutureUsdBrl(5.2005);
    setFutureHedgePercent(50);
    setCottonFiberRecovery(40);
    setCottonSeedCredit(8);
    setHerdFlowInputs(herdFlowDefaults);
    setAllocationInputs(allocationDefaults);
    setLotProfiles(lotProfileDefaults);
    setAnimalTimelineInputs(animalTimelineDefaults);
    setCropMarketingWindows(cropMarketingWindowDefaults);
    setDoubleCropCalendar(doubleCropCalendarDefaults);
    setOperationalInputs(operationalDefaults);
    setReviewInputs(reviewDefaults);
    setCostEditMode('stress');
    setCropOperational(cropOperationalDefaults);
    setBreedingEconomicsInputs(breedingEconomicsDefaults);
    setStrategyStress(strategyStressDefaults);
    setStrategyCriterion('defensive');
    setStrategyMaxShare(60);
    setStrategyCapitalLimit(30_000_000);
    setStrategyErrorHa(3_000);
    setScenarioAuditTrail([]);
    setAppliedPriceMeta(appliedPriceMetaDefaults);
    setGateAppliedPriceMeta(gateAppliedPriceMetaDefault);
    setAppliedFutureFingerprints(appliedFutureFingerprintDefaults);
    setMarketUf('BA');
    setMarketStatus(initialMarketStatus);
  };

  const exitExplorationScenario = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('mode') === 'demo') {
      url.searchParams.delete('mode');
      window.close();
      window.setTimeout(() => window.location.replace(url.toString()), 50);
      return;
    }
    resetScenario();
  };

  const cornFeedCrop =
    crops.find((crop) => crop.id === 'corn-irrigated') ?? crops[0];
  const cornFeedCostHa = cropDirectCostHa(cornFeedCrop);
  const grainDmKgHa = cornFeedCrop.yield * 60 * 0.88;
  const cornGrainCashCostDm =
    grainDmKgHa > 0 ? cornFeedCostHa / grainDmKgHa : 0;
  const cornRetainedPrice = cropNetSalePrice(cornFeedCrop);
  const cornGrainOpportunityCostDm =
    cornRetainedPrice > 0 ? cornRetainedPrice / (60 * 0.88) : 0;
  const cornOwnValuationDm = assumptions.feedUseOpportunityCost
    ? cornGrainOpportunityCostDm
    : cornGrainCashCostDm;
  const cornPurchaseCostDm =
    allocationInputs.grainPurchasePriceSack / (60 * 0.88);
  const localPasture = useMemo(() => pastureCapacity(assumptions.stockingUa, reviewInputs), [assumptions.stockingUa, reviewInputs]);
  const physicalReference = useMemo(
    () => calculateCore({ ...assumptions, stockingUa: localPasture.effectiveUa,
      pastureMortalityPercent: animalTimelineInputs.pastureMortality, feedlotMortalityPercent: allocationInputs.feedlotMortality,
      otherIngredientSharePercent: operationalInputs.otherIngredientSharePercent,
      feedlotCapacity: allocationInputs.feedlotCapacity, feedlotUtilization: allocationInputs.feedlotUtilization }),
    [assumptions, localPasture.effectiveUa, animalTimelineInputs.pastureMortality, allocationInputs.feedlotMortality,
      operationalInputs.otherIngredientSharePercent, allocationInputs.feedlotCapacity, allocationInputs.feedlotUtilization],
  );
  const physicalGrainDemandDmKg =
    physicalReference.feedlotEntriesA * physicalReference.dietDmHead *
    Math.max(0, 1 - assumptions.forageShare / 100 - operationalInputs.otherIngredientSharePercent / 100) *
    1_000;
  const ownGrainProductionDmKg =
    allocationInputs.grainAreaHa * grainDmKgHa;
  const ownGrainShare =
    physicalGrainDemandDmKg > 0
      ? Math.min(1, ownGrainProductionDmKg / physicalGrainDemandDmKg)
      : 1;
  const purchasedGrainShare = allocationInputs.allowPurchasedFeed
    ? 1 - ownGrainShare
    : 0;
  const cornGrainCostDm =
    cornOwnValuationDm * (1 - purchasedGrainShare) +
    cornPurchaseCostDm * purchasedGrainShare;
  const annualSilageCostHa = assumptions.silageCostHaCut * assumptions.silageCrops;
  const recoveredSilageDmKgHa =
    assumptions.silageYieldDm *
    assumptions.silageCrops *
    1_000 *
    (assumptions.silageRecovery / 100);
  const silageCostDm =
    recoveredSilageDmKgHa > 0
      ? annualSilageCostHa / recoveredSilageDmKgHa
      : 0;
  const linkedDietPriceDm =
    (assumptions.forageShare / 100) * silageCostDm +
    Math.max(0, 1 - assumptions.forageShare / 100 - operationalInputs.otherIngredientSharePercent / 100) * cornPurchaseCostDm +
    assumptions.dietOtherCostDm;
  const timelineEntryWeight = animalTimelineInputs.liveEquivalent
    ? animalTimelineInputs.entryArrobas * 30
    : (animalTimelineInputs.entryArrobas * 15) /
      Math.max(0.01, animalTimelineInputs.carcassYield / 100);
  const timelineDecisionWeight = animalTimelineInputs.liveEquivalent
    ? animalTimelineInputs.decisionArrobas * 30
    : (animalTimelineInputs.decisionArrobas * 15) /
      Math.max(0.01, animalTimelineInputs.carcassYield / 100);
  const baseModelAssumptions = useMemo(
    () => ({
      ...assumptions,
      stockingUa: localPasture.effectiveUa,
      pastureMortalityPercent: animalTimelineInputs.pastureMortality,
      feedlotMortalityPercent: allocationInputs.feedlotMortality,
      otherIngredientSharePercent: operationalInputs.otherIngredientSharePercent,
      feedlotCapacity: allocationInputs.feedlotCapacity,
      feedlotUtilization: allocationInputs.feedlotUtilization,
      entryWeight: timelineEntryWeight,
      pivotExitWeight: timelineDecisionWeight,
      carcassYieldPercent: animalTimelineInputs.carcassYield,
          feedlotCarcassYieldLiftPercent: assumptions.feedlotCarcassYieldLiftPercent,
      saleDeductionPercent: animalTimelineInputs.saleDeduction,
      dietPriceDm: assumptions.linkFeedToCropCosts
        ? linkedDietPriceDm
        : assumptions.dietPriceDm,
    }),
    [
      assumptions,
      localPasture.effectiveUa,
      animalTimelineInputs.pastureMortality,
      allocationInputs.feedlotMortality,
      operationalInputs.otherIngredientSharePercent,
      allocationInputs.feedlotCapacity,
      allocationInputs.feedlotUtilization,
      animalTimelineInputs.carcassYield,
      animalTimelineInputs.saleDeduction,
      linkedDietPriceDm,
      timelineDecisionWeight,
      timelineEntryWeight,
    ],
  );
  const baseResult = useMemo(
    () => simulate(baseModelAssumptions),
    [baseModelAssumptions],
  );
  const cattleCurve = useMemo(
    () => {
      const cattleQuotes = futureQuotes.filter(
        (quote) => quote.product === 'cattle',
      );
      return cattleQuotes
        .filter((quote) => {
          const convertedPrice = futurePriceInModelUnit(
            quote,
            futureUsdBrl,
            cottonFiberRecovery,
            cottonSeedCredit,
          );
          return validateFutureQuote(quote, asOfDate, {
            convertedPrice,
            usdBrl: futureUsdBrl,
            cottonFiberRecovery,
          }).isUsable;
        })
        .map((quote) => ({
          id: quote.id,
          contract: quote.contract,
          date: quote.referenceDate,
          price: futurePriceInModelUnit(
            quote,
            futureUsdBrl,
            cottonFiberRecovery,
            cottonSeedCredit,
          ),
          sourceDate: quote.sourceDate,
        }));
    },
    [
      asOfDate,
      cottonFiberRecovery,
      cottonSeedCredit,
      futureQuotes,
      futureUsdBrl,
    ],
  );
  const herdFlow = useMemo(
    () =>
      calculateHerdFlow({
        annualEntrants: baseResult.pastureEntryCapacityA,
        ...herdFlowInputs,
        breedingStockingUa: breedingEconomicsInputs.breedingStockingUa,
        stockingUa: localPasture.effectiveUa,
        totalArea: assumptions.totalArea,
      }),
    [
      localPasture.effectiveUa,
      assumptions.totalArea,
      baseResult.pastureEntryCapacityA,
      breedingEconomicsInputs.breedingStockingUa,
      herdFlowInputs,
    ],
  );
  const calfQuoteAgeDays = isoAgeDays(
    breedingEconomicsInputs.calfPriceSourceDate,
    asOfDate,
  );
  const replacementHeiferQuoteAgeDays = isoAgeDays(
    breedingEconomicsInputs.replacementHeiferPriceSourceDate,
    asOfDate,
  );
  const calfPriceSourceValid = Boolean(
    calfQuoteAgeDays !== null &&
      calfQuoteAgeDays >= 0 &&
      calfQuoteAgeDays <= MAX_REPLACEMENT_QUOTE_AGE_DAYS &&
      breedingEconomicsInputs.calfPriceSource.trim().length > 0,
  );
  const replacementHeiferPriceSourceValid = Boolean(
    replacementHeiferQuoteAgeDays !== null &&
      replacementHeiferQuoteAgeDays >= 0 &&
      replacementHeiferQuoteAgeDays <= MAX_REPLACEMENT_QUOTE_AGE_DAYS &&
      breedingEconomicsInputs.replacementHeiferPriceSource.trim().length > 0,
  );
  const routeBDays = Math.ceil(
    (assumptions.saleWeight - timelineEntryWeight) /
      Math.max(0.05, assumptions.gmdB),
  );
  const routeBExitDate = addIsoDays(
    animalTimelineInputs.entryDate,
    routeBDays,
  );
  const routeBCarcassArrobas =
    (assumptions.saleWeight * (animalTimelineInputs.carcassYield / 100)) / 15;
  const routeBEligibleForBgi =
    animalTimelineInputs.bgiEligible && routeBCarcassArrobas >= 16;
  const routeBCurve = routeBEligibleForBgi
    ? cattlePriceAtDate(cattleCurve, routeBExitDate)
    : {
        price: null,
        coverage: 'ineligible' as const,
        contracts: 'elegibilidade BGI não confirmada',
        sourceDate: '',
      };
  const routeBNetRevenueHead =
    routeBCurve.price === null
      ? null
      : routeBCurve.price *
        ((assumptions.saleWeight *
          (animalTimelineInputs.carcassYield / 100)) /
          15) *
        (1 - animalTimelineInputs.saleDeduction / 100) *
        (1 - animalTimelineInputs.pastureMortality / 100);
  const routeBDiscount = Math.pow(
    1 + Math.max(0, assumptions.discountRate / 100),
    routeBDays / 365,
  );
  const routeBCostDiscount = Math.pow(
    1 + Math.max(0, assumptions.discountRate / 100),
    routeBDays / 730,
  );
  const routeBRevenueHeadAtEntry =
    routeBNetRevenueHead === null
      ? null
      : routeBNetRevenueHead / routeBDiscount;
  const downstreamCeilingValidB = Boolean(
    calfPriceSourceValid &&
      routeBEligibleForBgi &&
      routeBRevenueHeadAtEntry !== null &&
      Number.isFinite(routeBRevenueHeadAtEntry),
  );
  const downstreamMaximumPurchasePriceHeadB = downstreamCeilingValidB
    ? Math.max(
        0,
        (routeBRevenueHeadAtEntry ?? 0) -
          (routeBDays * animalTimelineInputs.pastureFinishCostDay) /
            routeBCostDiscount -
          breedingEconomicsInputs.targetDownstreamMarginHead,
      )
    : 0;
  const downstreamDaysToGate = Math.ceil(
    (timelineDecisionWeight - timelineEntryWeight) /
      Math.max(0.05, assumptions.gmdPivotA),
  );
  const downstreamDecisionDate = addIsoDays(
    animalTimelineInputs.entryDate,
    downstreamDaysToGate,
  );
  const downstreamGateSourceAge = isoAgeDays(
    animalTimelineInputs.gateSourceDate,
    asOfDate,
  );
  const gateAppliedSourceValid =
    provenanceCanRank(gateAppliedPriceMeta.provenance, scenarioMode) &&
    gateAppliedPriceMeta.date === animalTimelineInputs.gateSourceDate;
  const downstreamCeilingValid = Boolean(
    calfPriceSourceValid &&
      gateAppliedSourceValid &&
      downstreamDecisionDate &&
      downstreamDecisionDate === animalTimelineInputs.gateValuationDate &&
      downstreamGateSourceAge !== null &&
      downstreamGateSourceAge >= 0 &&
      downstreamGateSourceAge <= 14,
  );
  const breedingCommonPastureCostDay =
    animalTimelineInputs.linkCommonPastureCost
      ? Math.max(
          0,
          animalTimelineInputs.commonPastureBaseCostDay +
            animalTimelineInputs.supplementKgDay *
              assumptions.supplementPrice *
              (assumptions.otherCostFactor / 100),
        )
      : animalTimelineInputs.commonPastureCostDay;
  const downstreamDiscount = Math.pow(
    1 + Math.max(0, assumptions.discountRate / 100),
    downstreamDaysToGate / 365,
  );
  const downstreamCostDiscount = Math.pow(
    1 + Math.max(0, assumptions.discountRate / 100),
    downstreamDaysToGate / 730,
  );
  const downstreamMaximumPurchasePriceHead = downstreamCeilingValid
    ? Math.max(
        0,
        (timelineDecisionWeight * animalTimelineInputs.gateValuePerKgLive) /
          downstreamDiscount -
          (downstreamDaysToGate * breedingCommonPastureCostDay) /
            downstreamCostDiscount -
          breedingEconomicsInputs.targetDownstreamMarginHead,
      )
    : 0;
  const breedingEconomicsCommonInputs = useMemo<
    Omit<BreedingEconomicsInputs, 'annualEntrants'>
  >(
    () => ({
      desiredOwnSharePercent: herdFlowInputs.selfSupplyPercent,
      netEligibleCalvesPerCow: herdFlow.netEligiblePerCow,
      calfPurchaseWeightKg: breedingEconomicsInputs.calfPurchaseWeightKg,
      purchasedCalfPriceHead: assumptions.calfCost,
      purchaseTransactionCostHead:
        breedingEconomicsInputs.purchaseTransactionCostHead,
      finishedCattlePriceArroba: assumptions.priceArroba,
      carcassYieldPercent: animalTimelineInputs.carcassYield,
      finishedSaleDeductionPercent: animalTimelineInputs.saleDeduction,
      downstreamMaximumPurchasePriceHead,
      downstreamCeilingValid,
      matrixMarketValue: breedingEconomicsInputs.matrixMarketValue,
      matrixResidualPercent: breedingEconomicsInputs.matrixResidualPercent,
      annualCowCashCost: breedingEconomicsInputs.annualCowCashCost,
      annualReproductionCostCow:
        breedingEconomicsInputs.annualReproductionCostCow,
      externalReplacementHeifersPerCow:
        herdFlow.externalReplacementNeedPerCow,
      externalReplacementHeiferPriceHead:
        breedingEconomicsInputs.externalReplacementHeiferPriceHead,
      herdUaPerCow: herdFlowInputs.herdUaPerCow,
      stockingUa: breedingEconomicsInputs.breedingStockingUa,
      breedingAreaAvailableHa:
        breedingEconomicsInputs.breedingAreaAvailableHa,
      breedingLandCostHaYear:
        breedingEconomicsInputs.breedingLandCostHaYear,
      existingMatrices: breedingEconomicsInputs.existingMatrices,
      newMatrixCapitalLimit: breedingEconomicsInputs.newMatrixCapitalLimit,
      annualRatePercent: assumptions.discountRate,
      horizonYears: assumptions.horizon,
      inputsConfirmed: breedingEconomicsInputs.inputsConfirmed,
      calfPriceSourceValid,
      replacementHeiferPriceSourceValid,
      replacementSystemCloses: herdFlow.replacementSystemCloses,
      breedingAreaOutsideBase: breedingEconomicsInputs.breedingAreaOutsideBase,
    }),
    [
      animalTimelineInputs.carcassYield,
      animalTimelineInputs.saleDeduction,
      assumptions.calfCost,
      assumptions.discountRate,
      assumptions.horizon,
      assumptions.priceArroba,
      breedingEconomicsInputs,
      calfPriceSourceValid,
      downstreamMaximumPurchasePriceHead,
      downstreamCeilingValid,
      herdFlow.netEligiblePerCow,
      herdFlow.externalReplacementNeedPerCow,
      herdFlow.replacementSystemCloses,
      herdFlowInputs.herdUaPerCow,
      herdFlowInputs.selfSupplyPercent,
      replacementHeiferPriceSourceValid,
    ],
  );
  const breedingEconomics = useMemo(
    () =>
      calculateBreedingEconomics({
        ...breedingEconomicsCommonInputs,
        annualEntrants: baseResult.pastureEntryCapacityA,
      }),
    [baseResult.pastureEntryCapacityA, breedingEconomicsCommonInputs],
  );
  const breedingEconomicsB = useMemo(
    () =>
      calculateBreedingEconomics({
        ...breedingEconomicsCommonInputs,
        annualEntrants: baseResult.pasturePotentialB,
        downstreamMaximumPurchasePriceHead:
          downstreamMaximumPurchasePriceHeadB,
        downstreamCeilingValid: downstreamCeilingValidB,
      }),
    [
      baseResult.pasturePotentialB,
      breedingEconomicsCommonInputs,
      downstreamCeilingValidB,
      downstreamMaximumPurchasePriceHeadB,
    ],
  );
  const replacementBlendReadyA =
    breedingEconomicsInputs.applyToComparison &&
    breedingEconomics.modelReady &&
    downstreamCeilingValid &&
    breedingEconomics.recommendedSupplyCloses === true &&
    (breedingEconomics.downstreamSupportsPurchasedCalf === true ||
      breedingEconomics.downstreamSupportsOwnCalf === true) &&
    breedingEconomics.blendedEconomicCostHead !== null &&
    breedingEconomics.blendedCashCostHead !== null;
  const replacementBlendReadyB =
    breedingEconomicsInputs.applyToComparison &&
    breedingEconomicsB.modelReady &&
    downstreamCeilingValidB &&
    breedingEconomicsB.recommendedSupplyCloses === true &&
    (breedingEconomicsB.downstreamSupportsPurchasedCalf === true ||
      breedingEconomicsB.downstreamSupportsOwnCalf === true) &&
    breedingEconomicsB.blendedEconomicCostHead !== null &&
    breedingEconomicsB.blendedCashCostHead !== null;
  const replacementSupplyReadyA =
    !breedingEconomicsInputs.applyToComparison || replacementBlendReadyA;
  const replacementSupplyReadyB =
    !breedingEconomicsInputs.applyToComparison || replacementBlendReadyB;
  const replacementSupplyShortfallA = Math.max(
    0,
    baseResult.pastureEntryCapacityA -
      (breedingEconomics.recommendedOwnEntrants ?? 0) -
      (breedingEconomics.recommendedPurchasedEntrants ?? 0),
  );
  const replacementSupplyShortfallB = Math.max(
    0,
    baseResult.pasturePotentialB -
      (breedingEconomicsB.recommendedOwnEntrants ?? 0) -
      (breedingEconomicsB.recommendedPurchasedEntrants ?? 0),
  );
  const effectiveReplacementCostHead =
    replacementBlendReadyA
      ? (breedingEconomics.blendedEconomicCostHead ?? assumptions.calfCost)
      : assumptions.calfCost;
  const effectiveReplacementCostHeadB =
    replacementBlendReadyB
      ? (breedingEconomicsB.blendedEconomicCostHead ?? assumptions.calfCost)
      : assumptions.calfCost;
  const effectiveReplacementCashCostHead =
    replacementBlendReadyA
      ? (breedingEconomics.blendedCashCostHead ?? assumptions.calfCost)
      : assumptions.calfCost;
  const effectiveReplacementCashCostHeadB =
    replacementBlendReadyB
      ? (breedingEconomicsB.blendedCashCostHead ?? assumptions.calfCost)
      : assumptions.calfCost;
  const timelineEntryCostHead = animalTimelineInputs.linkEntryCostToReplacement
    ? effectiveReplacementCostHead
    : timelineEntryWeight * animalTimelineInputs.entryValuePerKgLive;
  const timelineEntryCostHeadB = animalTimelineInputs.linkEntryCostToReplacement
    ? effectiveReplacementCostHeadB
    : timelineEntryWeight * animalTimelineInputs.entryValuePerKgLive;
  const timelineEntryCashCostHead = animalTimelineInputs.linkEntryCostToReplacement
    ? effectiveReplacementCashCostHead
    : timelineEntryWeight * animalTimelineInputs.entryValuePerKgLive;
  const timelineEntryCashCostHeadB = animalTimelineInputs.linkEntryCostToReplacement
    ? effectiveReplacementCashCostHeadB
    : timelineEntryWeight * animalTimelineInputs.entryValuePerKgLive;
  const timelineEntrySourceDate =
    animalTimelineInputs.linkEntryCostToReplacement
      ? breedingEconomicsInputs.calfPriceSourceDate
      : animalTimelineInputs.entryQuoteDate;
  const timelineEntrySource = animalTimelineInputs.linkEntryCostToReplacement
    ? breedingEconomicsInputs.calfPriceSource
    : animalTimelineInputs.entryQuoteSource;
  const integratedCommonPastureCostDay = breedingCommonPastureCostDay;
  const modelAssumptions = useMemo(
    () => ({
      ...baseModelAssumptions,
      calfCost: effectiveReplacementCostHead,
    }),
    [baseModelAssumptions, effectiveReplacementCostHead],
  );
  const result = useMemo(() => simulate(modelAssumptions), [modelAssumptions]);
  // Orçamento anual da área inteira, inclusive capacidade ociosa. Na rota
  // integrada as diárias são premissas separadas: não somar o adicional nelas.
  const extraPastureCostHa = Math.max(0, assumptions.pastureExtraCostHa ?? 0) * assumptions.otherCostFactor / 100;
  const extraPastureAnnualA = result.pastureAreaA * extraPastureCostHa;
  const extraPastureAnnualB = assumptions.totalArea * extraPastureCostHa;
  const rearingAssumptions = useMemo(() => ({ ...modelAssumptions, calfCost: assumptions.calfCost }), [modelAssumptions, assumptions.calfCost]);
  const rearing = useMemo(() => rearingOnly(rearingAssumptions, animalTimelineInputs.gateValuePerKgLive), [rearingAssumptions, animalTimelineInputs.gateValuePerKgLive]);
  const rearingCash = useMemo(() => rearingStartupCash(rearingAssumptions, animalTimelineInputs.gateValuePerKgLive, animalTimelineInputs.entryDate, operationalInputs.setupDays, operationalInputs.setupCost),
    [rearingAssumptions, animalTimelineInputs.gateValuePerKgLive, animalTimelineInputs.entryDate, operationalInputs.setupDays, operationalInputs.setupCost]);
  const areaResponses = useMemo(() => areaResponse(modelAssumptions), [modelAssumptions]);
  const staticEconomicCostHeadA = result.cashCostHeadA;
  const staticCashCostHeadA =
    staticEconomicCostHeadA -
    effectiveReplacementCostHead +
    effectiveReplacementCashCostHead;
  const staticEconomicCostHeadB =
    result.cashCostHeadB -
    effectiveReplacementCostHead +
    effectiveReplacementCostHeadB;
  const staticCashCostHeadB =
    result.cashCostHeadB -
    effectiveReplacementCostHead +
    effectiveReplacementCashCostHeadB;
  const staticEconomicMarginHeadA = result.netSaleA - staticEconomicCostHeadA;
  const staticEconomicMarginHeadB = result.netSaleB - staticEconomicCostHeadB;
  const breedingDecision = !breedingEconomics.modelReady
    ? {
        label: 'preencha os dados do cálculo',
        text: 'Preencha e confirme custos, área, capital e reposição antes de usar a origem dos bezerros no comparativo.',
        tone: 'warn' as const,
      }
    : !downstreamCeilingValid
      ? {
          label: 'custo calculado · complete a rota',
          text: 'A cria própria e a compra foram custeadas, mas não há preço do boi magro fresco e alinhado à data projetada do gate. Sem esse teto a jusante, o simulador não recomenda expandir matrizes nem comprar entradas.',
          tone: 'warn' as const,
        }
    : breedingEconomics.recommendedOwnEntrants &&
        breedingEconomics.recommendedOwnEntrants > 0
      ? {
          label: 'próprios até o limite',
          text: `O custo econômico próprio ficou abaixo da compra e do teto do ciclo. A escala continua limitada a ${int.format(breedingEconomics.recommendedOwnEntrants)} bezerros próprios/ano; o restante só deve ser comprado se também couber no teto a jusante.`,
          tone: 'green' as const,
        }
      : breedingEconomics.downstreamSupportsPurchasedCalf
        ? {
            label: 'comprar é a referência',
            text: 'Na configuração informada, comprar reposição custa menos que expandir matrizes e ainda cabe no preço máximo suportado pelo ciclo.',
            tone: 'lime' as const,
          }
        : {
            label: 'não expandir a entrada',
            text: 'Nem o bezerro comprado nem a expansão de matrizes remuneram a margem-alvo do ciclo. O gargalo está no preço da reposição ou no desempenho a jusante.',
            tone: 'warn' as const,
          };
  const grainDmHead = result.dietDmHead * Math.max(0, 1 - assumptions.forageShare / 100 - operationalInputs.otherIngredientSharePercent / 100);
  const annualGrainDmTonnes = result.feedlotEntriesA * grainDmHead;
  const annualCornSacks =
    annualGrainDmTonnes > 0
      ? (annualGrainDmTonnes * 1_000) / (60 * 0.88)
      : 0;
  const equivalentCornArea =
    grainDmKgHa > 0 ? (annualGrainDmTonnes * 1_000) / grainDmKgHa : 0;
  const upstreamLandFootprint = assumptions.totalArea + equivalentCornArea;
  const decisionDietPriceDm = !assumptions.linkFeedToCropCosts ? assumptions.dietPriceDm :
    (assumptions.forageShare / 100) *
      allocationInputs.silageOpportunityCostDm +
    Math.max(0, 1 - assumptions.forageShare / 100 - operationalInputs.otherIngredientSharePercent / 100) * cornGrainCostDm +
    assumptions.dietOtherCostDm;
  const preGateDaysA = Math.max(
    0,
    Math.ceil(
      (timelineDecisionWeight - timelineEntryWeight) /
        Math.max(0.05, assumptions.gmdPivotA),
    ),
  );
  const preGateCapitalA =
    result.simultaneousPivotA * timelineEntryCashCostHead +
    result.pastureCandidatesA *
      preGateDaysA *
      integratedCommonPastureCostDay *
      (preGateDaysA / 730) +
    extraPastureAnnualA * Math.max(1, (result.daysPivotA + result.daysFeedlot + 1) / 365);
  const automaticFeedlotEntryDate = addIsoDays(
    animalTimelineInputs.entryDate,
    preGateDaysA,
  );
  const scheduledLotProfiles = useMemo(
    () =>
      lotProfiles.map((lot) => {
        const projectedDays = Math.max(
          1,
          Math.ceil(
            (assumptions.saleWeight - timelineDecisionWeight) /
              Math.max(0.05, lot.gmd),
          ),
        );
        const entryDate = lot.entryDate || automaticFeedlotEntryDate;
        return {
          ...lot,
          entryDate,
          exitDate: lot.exitDate || addIsoDays(entryDate, projectedDays),
        };
      }),
    [
      assumptions.saleWeight,
      automaticFeedlotEntryDate,
      lotProfiles,
      timelineDecisionWeight,
    ],
  );
  const postGateCapitalLimitA = Math.max(
    0,
    strategyCapitalLimit - preGateCapitalA - assumptions.investment - assumptions.pivotInvestment - operationalInputs.reserveCash - operationalInputs.setupCost,
  );
  const feedAllocation = useMemo(
    () => calculateFeedAllocation({
      annualCandidates: result.pastureCandidatesA,
      entryWeight: timelineDecisionWeight,
      saleWeight: assumptions.saleWeight,
      netFinishedRevenueByGmd: (gmd: number, lot?: LotProfile) => {
        if (lot?.entryDate && animalTimelineInputs.bgiEligible) {
          const exit = addIsoDays(lot.entryDate, Math.ceil((assumptions.saleWeight - timelineDecisionWeight) / Math.max(gmd, 0.05)));
          const price = cattlePriceAtDate(cattleCurve, exit).price;
          return price === null || assumptions.saleWeight * Math.min(100, animalTimelineInputs.carcassYield + assumptions.feedlotCarcassYieldLiftPercent) / 1500 < 16 ? null :
            price * assumptions.saleWeight * Math.min(100, animalTimelineInputs.carcassYield + assumptions.feedlotCarcassYieldLiftPercent) / 1500 *
            (1 - animalTimelineInputs.saleDeduction / 100) * (1 - allocationInputs.feedlotMortality / 100);
        }
        const projection = projectAnimalDecision({
          entryDate: animalTimelineInputs.entryDate,
          entryLiveWeight: timelineEntryWeight,
          decisionLiveWeight: timelineDecisionWeight,
          finalLiveWeight: assumptions.saleWeight,
          gmdToDecision: assumptions.gmdPivotA,
          gmdPastureFinish: assumptions.gmdB,
          gmdFeedlot: gmd,
          carcassYieldPercent: animalTimelineInputs.carcassYield,
          feedlotCarcassYieldLiftPercent: assumptions.feedlotCarcassYieldLiftPercent,
          saleDeductionPercent: animalTimelineInputs.saleDeduction,
          entryCostHead: timelineEntryCostHead,
          entryPriceDate: timelineEntrySourceDate,
          gateValuePerKgLive: animalTimelineInputs.gateValuePerKgLive,
          gatePriceDate: animalTimelineInputs.gateValuationDate,
          gateSourceDate: animalTimelineInputs.gateSourceDate,
          asOfDate,
          commonPastureCostDay: integratedCommonPastureCostDay,
          pastureFinishCostDay: animalTimelineInputs.pastureFinishCostDay,
          dietDmDay: assumptions.dietDmDay,
          dietPriceDm: decisionDietPriceDm,
          ownOperationDay: allocationInputs.ownOperationDay,
          ownFixedCostHead: allocationInputs.ownFixedCostHead,
          thirdPartyAllInDay: allocationInputs.thirdPartyAllInDay,
          thirdPartyFreightHead: allocationInputs.thirdPartyFreightHead,
          includeThirdParty: false,
          annualCarryRatePercent: assumptions.discountRate,
          mortalityPercent: allocationInputs.feedlotMortality,
          pastureMortalityPercent: animalTimelineInputs.pastureMortality,
          bgiEligible: animalTimelineInputs.bgiEligible,
          curve: cattleCurve,
        });
        return projection.comparisonStatus === 'comparable'
          ? projection.routes.find((route) => route.id === 'own-feedlot')
              ?.netRevenueHead ?? null
          : null;
      },
      sellNowHead:
        timelineDecisionWeight * animalTimelineInputs.gateValuePerKgLive,
      dietDmDay: assumptions.dietDmDay,
      forageShare: assumptions.forageShare,
      otherIngredientSharePercent: operationalInputs.otherIngredientSharePercent,
      silageCashCostDm: silageCostDm,
      silageOpportunityCostDm: allocationInputs.silageOpportunityCostDm,
      purchasedSilageCostDm: allocationInputs.purchasedSilageCostDm,
      grainCashCostDm: cornGrainCashCostDm,
      grainNetSalePriceSack: cornRetainedPrice,
      grainPurchasePriceSack: allocationInputs.grainPurchasePriceSack,
      dietOtherCostDm: assumptions.dietOtherCostDm,
      ownOperationDay: allocationInputs.ownOperationDay,
      ownFixedCostHead: allocationInputs.ownFixedCostHead,
      thirdPartyAllInDay: allocationInputs.thirdPartyAllInDay,
      thirdPartyFreightHead: allocationInputs.thirdPartyFreightHead,
      thirdPartyCapacity: 0,
      annualCarryRate: assumptions.discountRate,
      feedlotCapacity: allocationInputs.feedlotCapacity,
      feedlotUtilization: allocationInputs.feedlotUtilization,
      grainAreaHa: allocationInputs.grainAreaHa,
      grainYieldSacksHa: cornFeedCrop.yield,
      grainCashCostHa: cornFeedCostHa,
      silageAreaHa: result.silageArea,
      silageDmTonnesHaYear:
        assumptions.silageYieldDm *
        assumptions.silageCrops *
        (assumptions.silageRecovery / 100),
      silageCashCostHaYear: annualSilageCostHa,
      allowPurchasedFeed: allocationInputs.allowPurchasedFeed,
      allowOwnFeedlot:
        allocationInputs.dietFormulaConfirmed &&
        allocationInputs.feedAvailabilityConfirmed &&
        allocationInputs.peakCapacityConfirmed &&
        allocationInputs.annualCalendarConfirmed,
      allowOutsource: false,
      workingCapitalLimit: postGateCapitalLimitA,
      lots: scheduledLotProfiles,
    }),
    [
      allocationInputs,
      operationalInputs.otherIngredientSharePercent,
      annualSilageCostHa,
      animalTimelineInputs,
      asOfDate,
      assumptions.dietDmDay,
      assumptions.dietOtherCostDm,
      assumptions.discountRate,
      assumptions.forageShare,
      assumptions.gmdB,
      assumptions.gmdPivotA,
      assumptions.saleWeight,
      assumptions.silageCrops,
      assumptions.silageRecovery,
      assumptions.silageYieldDm,
      cornFeedCostHa,
      cornFeedCrop.yield,
      cornGrainCashCostDm,
      cornRetainedPrice,
      cattleCurve,
      decisionDietPriceDm,
      assumptions.feedlotCarcassYieldLiftPercent,
      integratedCommonPastureCostDay,
      scheduledLotProfiles,
      result.pastureCandidatesA,
      result.silageArea,
      silageCostDm,
      postGateCapitalLimitA,
      timelineDecisionWeight,
      timelineEntryCostHead,
      timelineEntrySourceDate,
      timelineEntryWeight,
    ],
  );
  const feedlotCalendarHasConflict = feedAllocation.calendarIssues.some(
    (issue) => !issue.includes('calendário de ocupação não informado.'),
  );
  const effluentScale = useMemo(
    () =>
      calculateEffluentScale({
        agronomicAvailabilityPercent: operationalInputs.effluentAvailabilityPercent,
        avoidedFertilizerBudgetHa: operationalInputs.effluentFertilizerCapHa,
        treatmentCostM3: operationalInputs.effluentTreatmentM3,
        applicationCostM3: operationalInputs.effluentApplicationM3,
        annualFixedOperatingCost: operationalInputs.effluentFixedCost,
        referenceAreaHa: allocationInputs.effluentReferenceAreaHa,
        referenceDepthMm: allocationInputs.effluentReferenceDepthMm,
        referenceAnnualHeads: allocationInputs.effluentReferenceAnnualHeads,
        referenceConfinementDays:
          allocationInputs.effluentReferenceConfinementDays,
        currentOwnFeedlotHeadDays: feedAllocation.penDaysUsed,
        targetAreaHa: assumptions.effluentArea,
        totalAreaHa: assumptions.totalArea,
        targetDepthMm: assumptions.effluentDepthMm,
        valueM3: assumptions.effluentValueM3,
        calibrationSource: allocationInputs.effluentCalibrationSource,
        calibrationPeriodStart:
          allocationInputs.effluentCalibrationPeriodStart,
        calibrationPeriodEnd: allocationInputs.effluentCalibrationPeriodEnd,
        calibrationPeriodConfirmed:
          allocationInputs.effluentCalibrationPeriodConfirmed,
        valueSource: allocationInputs.effluentValueSource,
        valueDate: allocationInputs.effluentValueDate,
        creditConfirmed:
          assumptions.includeEffluentSavings &&
          allocationInputs.effluentCreditConfirmed,
        excessDestination: allocationInputs.effluentExcessDestination,
        excessDestinationCapacityM3:
          allocationInputs.effluentExcessDestinationCapacityM3,
        excessDestinationConfirmed:
          allocationInputs.effluentExcessDestinationConfirmed,
      }),
    [
      operationalInputs,
      allocationInputs.effluentCalibrationPeriodConfirmed,
      allocationInputs.effluentCalibrationPeriodEnd,
      allocationInputs.effluentCalibrationPeriodStart,
      allocationInputs.effluentCalibrationSource,
      allocationInputs.effluentCreditConfirmed,
      allocationInputs.effluentExcessDestination,
      allocationInputs.effluentExcessDestinationCapacityM3,
      allocationInputs.effluentExcessDestinationConfirmed,
      allocationInputs.effluentReferenceAnnualHeads,
      allocationInputs.effluentReferenceAreaHa,
      allocationInputs.effluentReferenceConfinementDays,
      allocationInputs.effluentReferenceDepthMm,
      allocationInputs.effluentValueDate,
      allocationInputs.effluentValueSource,
      assumptions.effluentArea,
      assumptions.effluentDepthMm,
      assumptions.effluentValueM3,
      assumptions.includeEffluentSavings,
      assumptions.totalArea,
      feedAllocation.penDaysUsed,
    ],
  );
  const effluentVolumePerFinishedHeadM3 =
    effluentScale.referenceAnnualHeads > 0
      ? effluentScale.referenceVolumeM3 /
        effluentScale.referenceAnnualHeads
      : 0;
  const effluentAreaPerFinishedHeadHa =
    effluentScale.referenceAnnualHeads > 0
      ? effluentScale.referenceAreaHa /
        effluentScale.referenceAnnualHeads
      : 0;
  const effluentCreditPerFinishedHead =
    effluentVolumePerFinishedHeadM3 * assumptions.effluentValueM3;
  const requiredNominalFeedlotCapacity =
    effluentScale.requiredAverageConfinedHeads === null
      ? null
      : effluentScale.requiredAverageConfinedHeads /
        Math.max(0.01, allocationInputs.feedlotUtilization / 100);
  const animalTimeline = useMemo(
    () =>
      projectAnimalDecision({
        entryDate: animalTimelineInputs.entryDate,
        entryLiveWeight: timelineEntryWeight,
        decisionLiveWeight: timelineDecisionWeight,
        finalLiveWeight: assumptions.saleWeight,
        gmdToDecision: assumptions.gmdPivotA,
        gmdPastureFinish: assumptions.gmdB,
        gmdFeedlot: assumptions.gmdFeedlot,
        carcassYieldPercent: animalTimelineInputs.carcassYield,
          feedlotCarcassYieldLiftPercent: assumptions.feedlotCarcassYieldLiftPercent,
        saleDeductionPercent: animalTimelineInputs.saleDeduction,
        entryCostHead: timelineEntryCostHead,
        entryPriceDate: timelineEntrySourceDate,
        gateValuePerKgLive: animalTimelineInputs.gateValuePerKgLive,
        gatePriceDate: animalTimelineInputs.gateValuationDate,
        gateSourceDate: animalTimelineInputs.gateSourceDate,
        asOfDate,
        commonPastureCostDay: integratedCommonPastureCostDay,
        pastureFinishCostDay: animalTimelineInputs.pastureFinishCostDay,
        dietDmDay: assumptions.dietDmDay,
        dietPriceDm: decisionDietPriceDm,
        ownOperationDay: allocationInputs.ownOperationDay,
        ownFixedCostHead: allocationInputs.ownFixedCostHead,
        thirdPartyAllInDay: allocationInputs.thirdPartyAllInDay,
        thirdPartyFreightHead: allocationInputs.thirdPartyFreightHead,
        includeThirdParty: false,
        annualCarryRatePercent: assumptions.discountRate,
        mortalityPercent: allocationInputs.feedlotMortality,
        pastureMortalityPercent: animalTimelineInputs.pastureMortality,
        bgiEligible: animalTimelineInputs.bgiEligible,
        curve: cattleCurve,
      }),
    [
      allocationInputs.feedlotMortality,
      allocationInputs.ownFixedCostHead,
      allocationInputs.ownOperationDay,
      allocationInputs.thirdPartyAllInDay,
      allocationInputs.thirdPartyFreightHead,
      animalTimelineInputs,
      asOfDate,
      assumptions.dietDmDay,
      assumptions.discountRate,
      assumptions.gmdB,
      assumptions.gmdFeedlot,
      assumptions.gmdPivotA,
      assumptions.saleWeight,
      cattleCurve,
      decisionDietPriceDm,
      assumptions.feedlotCarcassYieldLiftPercent,
      integratedCommonPastureCostDay,
      timelineDecisionWeight,
      timelineEntryCostHead,
      timelineEntrySourceDate,
      timelineEntryWeight,
    ],
  );
  const sellGateRoute = animalTimeline.routes.find(
    (route) => route.id === 'sell-gate',
  );
  const entryPriceAgeDays = isoAgeDays(
    timelineEntrySourceDate,
    asOfDate,
  );
  const entryPriceSourceValid =
    animalTimeline.entryPriceSourceValid &&
    timelineEntrySource.trim().length > 0 &&
    entryPriceAgeDays !== null &&
    entryPriceAgeDays >= 0 &&
    entryPriceAgeDays <= MAX_REPLACEMENT_QUOTE_AGE_DAYS;
  const gateMarginFromEntry = sellGateRoute?.marginFromEntry ?? null;
  const gateRouteReady =
    gateMarginFromEntry !== null &&
    Number.isFinite(gateMarginFromEntry) &&
    animalTimeline.inputErrors.length === 0 &&
    entryPriceSourceValid &&
    gateAppliedSourceValid &&
    animalTimeline.gateSourceValid &&
    animalTimeline.decisionDate === animalTimelineInputs.gateValuationDate;
  const livestockCornPriceRequired =
    allocationInputs.grainAreaHa > 0 ||
    (assumptions.linkFeedToCropCosts && assumptions.feedUseOpportunityCost);
  const cornAppliedPriceValid = appliedPriceIsValid('corn-irrigated');
  const livestockCornPriceReady =
    !livestockCornPriceRequired || cornAppliedPriceValid;
  const cowBuyQuoteAgeDays = isoAgeDays(
    allocationInputs.cowBuyQuoteDate,
    asOfDate,
  );
  const cowSaleQuoteAgeDays = isoAgeDays(
    allocationInputs.cowSaleQuoteDate,
    asOfDate,
  );
  const cowOpportunityPricesValid = Boolean(
    cowBuyQuoteAgeDays !== null &&
      cowBuyQuoteAgeDays >= 0 &&
      cowBuyQuoteAgeDays <= MAX_REPLACEMENT_QUOTE_AGE_DAYS &&
      cowSaleQuoteAgeDays !== null &&
      cowSaleQuoteAgeDays >= 0 &&
      cowSaleQuoteAgeDays <= MAX_PHYSICAL_QUOTE_AGE_DAYS &&
      allocationInputs.cowBuyQuoteSource.trim().length > 0 &&
      allocationInputs.cowSaleQuoteSource.trim().length > 0,
  );
  const routedCandidateHeads =
    feedAllocation.ownHeads +
    feedAllocation.outsourceHeads +
    feedAllocation.sellHeads;
  // Every hectare explicitly assigned by the user remains visible in exactly
  // one enterprise. Grain can be sold, but silage only earns an internal
  // transfer for the volume actually consumed; unused stock never becomes
  // recurring revenue without an explicit sale route.
  const linkedGrainAreaHa = Math.max(0, allocationInputs.grainAreaHa);
  const linkedSilageAreaHa = result.silageArea;
  const linkedGrainEnterprise = calculateCrop(
    cornFeedCrop,
    linkedGrainAreaHa,
    assumptions.landLeaseHa,
  );
  const linkedGrainRevenue = linkedGrainEnterprise.revenue;
  const linkedGrainCashCost = linkedGrainEnterprise.totalCost;
  const linkedSilageProducedDmKg =
    linkedSilageAreaHa *
    assumptions.silageYieldDm *
    assumptions.silageCrops *
    (assumptions.silageRecovery / 100) *
    1_000;
  const linkedSilageConsumedDmKg = Math.min(
    linkedSilageProducedDmKg,
    feedAllocation.ownSilageUsedDmKg,
  );
  const linkedSilageEndingStockDmKg = Math.max(
    0,
    linkedSilageProducedDmKg - linkedSilageConsumedDmKg,
  );
  const linkedSilageRevenue = feedAllocation.ownSilageTransferNominal;
  const linkedSilageCashCost = linkedSilageAreaHa * annualSilageCostHa;
  const linkedFeedRevenueAtEntry =
    linkedGrainRevenue + linkedSilageRevenue;
  const linkedFeedCostAtEntry =
    linkedGrainCashCost + linkedSilageCashCost;
  const integratedWorkingCapitalA =
    preGateCapitalA + feedAllocation.workingCapitalUsed;
  const integratedCapitalA = integratedWorkingCapitalA + assumptions.investment + assumptions.pivotInvestment + operationalInputs.reserveCash + operationalInputs.setupCost;
  const capitalFeasibleA =
    preGateCapitalA <= strategyCapitalLimit + 1e-6 &&
    feedAllocation.capitalFeasible &&
    integratedCapitalA <= strategyCapitalLimit + 1e-6;
  const automaticCalendar = useMemo(
    () =>
      buildAutomaticCalendar(
        strictIsoDate(animalTimelineInputs.entryDate)
          ? animalTimelineInputs.entryDate
          : asOfDate,
        COMMON_HORIZON_DAYS,
      ),
    [animalTimelineInputs.entryDate, asOfDate],
  );
  const feedPlanUsesIndicativeCohort = feedAllocation.ownHeads <= 0;
  const indicativeCohortHeads = Math.max(
    0,
    Math.min(
      result.pastureCandidatesA,
      allocationInputs.feedlotCapacity *
        Math.max(0, allocationInputs.feedlotUtilization / 100),
    ),
  );
  const indicativeFeedLots = feedAllocation.lots.map((lot) => {
    const entryDate = lot.entryDate || animalTimeline.decisionDate;
    return {
      ...lot,
      ownHeads: feedPlanUsesIndicativeCohort
        ? Math.min(lot.heads, indicativeCohortHeads * lot.normalizedShare)
        : lot.ownHeads,
      entryDate,
      exitDate: lot.exitDate || addIsoDays(entryDate, lot.days),
    };
  });
  const indicativeGrainDemandSacks = indicativeFeedLots.reduce(
    (sum, lot) => sum + lot.ownHeads * lot.grainSacksHead,
    0,
  );
  const indicativeSilageDemandDmKg = indicativeFeedLots.reduce(
    (sum, lot) => sum + lot.ownHeads * lot.silageDmKgHead,
    0,
  );
  const weeklyFeedPlan = calculateWeeklyFeedPlan({
    lots: indicativeFeedLots,
    grainProducedSacks: feedAllocation.grainProducedSacks,
    ownGrainAllocatedSacks: feedPlanUsesIndicativeCohort
      ? indicativeGrainDemandSacks
      : feedAllocation.ownGrainUsedSacks,
    ownSilageAllocatedDmKg: feedPlanUsesIndicativeCohort
      ? Math.min(linkedSilageProducedDmKg, indicativeSilageDemandDmKg)
      : feedAllocation.ownSilageUsedDmKg,
    grainReceiptDate: automaticCalendar.crops['corn-irrigated'].harvestDate,
    allowPurchases: allocationInputs.allowPurchasedFeed,
    openingSilageDmKg: operationalInputs.openingSilageTonnesDm * 1000,
    silageReceipts: Array.from({ length: Math.max(0, Math.floor(assumptions.silageCrops)) }, (_, index) => ({
      date: addIsoDays(automaticCalendar.anchorDate, operationalInputs.silageFirstReleaseDays + index * operationalInputs.silageCutIntervalDays),
      dmKg: linkedSilageProducedDmKg / Math.max(1, assumptions.silageCrops),
    })),
  });
  const extraTemporalGrainPurchase = Math.max(0,
    weeklyFeedPlan.totalGrainPurchasedSacks - feedAllocation.purchasedGrainSacks);
  const extraTemporalSilagePurchase = Math.max(0, weeklyFeedPlan.totalSilagePurchasedDmKg - feedAllocation.purchasedSilageDmKg);
  const feedTimingReady = feedAllocation.ownHeads <= 0 || (
    weeklyFeedPlan.calendarReady &&
    weeklyFeedPlan.totalGrainShortageSacks < 1e-6 &&
    weeklyFeedPlan.totalSilageShortageDmKg < 1e-6 &&
    extraTemporalGrainPurchase < 1e-6 && extraTemporalSilagePurchase < 1e-6
  );
  const routeIntegrationReady =
    feedTimingReady &&
    assumptions.linkFeedToCropCosts &&
    assumptions.feedUseOpportunityCost &&
    gateRouteReady &&
    replacementSupplyReadyA &&
    livestockCornPriceReady &&
    !feedlotCalendarHasConflict &&
    allocationInputs.pastureWaterForageConfirmed &&
    (!assumptions.includeCows ||
      (allocationInputs.cowOpportunityWindowConfirmed &&
        cowOpportunityPricesValid)) &&
    (!assumptions.includeEffluentSavings ||
      effluentScale.creditReady) &&
    allocationInputs.annualCalendarConfirmed &&
    capitalFeasibleA;
  const integratedSystemFootprintA =
    assumptions.totalArea + linkedGrainAreaHa;
  const integratedRouteRevenueA =
    feedAllocation.routeRevenueNominal +
    result.cowsSold * result.cowNetSale +
    effluentScale.includedCredit +
    linkedFeedRevenueAtEntry;
  const commonCostToGateHead = (timelineEntryCostHead + animalTimeline.entryToDecisionDays * integratedCommonPastureCostDay) /
    Math.max(0.000001, 1 - animalTimelineInputs.pastureMortality / 100);
  const integratedRouteCostA =
    routedCandidateHeads * commonCostToGateHead +
    feedAllocation.routeCostNominal +
    result.cowsSold * result.cowCashCost +
    result.landLeaseCost +
    linkedFeedCostAtEntry + extraPastureAnnualA;
  const integratedRouteMarginA = routeIntegrationReady
    ? integratedRouteRevenueA - integratedRouteCostA
    : 0;
  // B is a direct 240→peso final route. It must not inherit A's gate or GMD
  // before the decision, otherwise its calendar and annual throughput diverge.
  const routeBCostHeadAtEntry =
    timelineEntryCostHeadB +
    (routeBDays * animalTimelineInputs.pastureFinishCostDay) /
      routeBCostDiscount;
  const integratedWorkingCapitalB =
    result.simultaneousPivotB * timelineEntryCashCostHeadB +
    result.soldB *
      routeBDays *
      animalTimelineInputs.pastureFinishCostDay *
      (routeBDays / 730) +
    linkedGrainCashCost + extraPastureAnnualB * Math.max(1, (routeBDays + 1) / 365);
  const capitalFeasibleB =
    integratedWorkingCapitalB + assumptions.pivotInvestment + operationalInputs.reserveCash + operationalInputs.setupCost <= strategyCapitalLimit + 1e-6;
  const routeBReady =
    allocationInputs.annualCalendarConfirmed &&
    allocationInputs.pastureWaterForageConfirmed &&
    replacementSupplyReadyB &&
    capitalFeasibleB &&
    livestockCornPriceReady &&
    entryPriceSourceValid &&
    animalTimeline.curveSourceValid &&
    routeBRevenueHeadAtEntry !== null &&
    Number.isFinite(routeBRevenueHeadAtEntry);
  const routeBRevenue = routeBReady
    ? result.entrantsB * (routeBNetRevenueHead ?? 0)
    : 0;
  const routeBMargin = routeBReady
    ? routeBRevenue -
      result.entrantsB * (timelineEntryCostHeadB + routeBDays * animalTimelineInputs.pastureFinishCostDay) -
      result.landLeaseCost - extraPastureAnnualB
    : 0;
  const routeBCost = routeBReady ? routeBRevenue - routeBMargin : 0;
  // The external grain hectares are common to both A and B. In A they may be
  // consumed; in B they are sold. Keeping the enterprise in both sides makes
  // A−B depend only on the marginal destination of the grain, not on an extra
  // farm that exists on one side of the comparison.
  const commonGrainRevenueAtEntry =
    linkedGrainRevenue;
  const commonGrainCostAtEntry =
    linkedGrainCashCost;
  const commonGrainMarginAtEntry =
    commonGrainRevenueAtEntry - commonGrainCostAtEntry;
  const routeBSystemRevenue = routeBReady
    ? routeBRevenue + commonGrainRevenueAtEntry
    : 0;
  const routeBSystemCost = routeBReady
    ? routeBCost + commonGrainCostAtEntry
    : 0;
  const routeBSystemMargin = routeBReady
    ? routeBSystemRevenue - routeBSystemCost
    : 0;
  const animalDecisionBlocker =
    !assumptions.linkFeedToCropCosts || !assumptions.feedUseOpportunityCost
      ? 'A simulação rápida aceita dieta manual/custo de produção. A alocação integrada usa ingredientes e oportunidade do alimento; ligue as duas bases para validar essa rota.'
    : !feedTimingReady
      ? 'Há alimento indisponível na data de consumo ou compra antes da safra ainda não conciliada economicamente. Confira o plano de alimentação.'
    :     !allocationInputs.annualCalendarConfirmed
      ? 'Confirme que o calendário anual de coortes representa este lote antes de anualizar a margem'
      : feedlotCalendarHasConflict
        ? feedAllocation.calendarIssues[0] ??
          'Corrija a divergência entre permanência projetada e calendário do cocho'
      : !allocationInputs.pastureWaterForageConfirmed
        ? 'Confirme que água, energia, outorga, forragem e lotação suportam o pasto irrigado em toda a janela'
      : !replacementSupplyReadyA
        ? `O plano de origem validado não cobre ${int.format(replacementSupplyShortfallA)} das entradas anuais de A; reduza a escala ou valide compra adicional dentro do teto econômico`
      : !livestockCornPriceReady
        ? `O milho vinculado à pecuária precisa de preço aplicado com fonte/data válida de até ${MAX_PHYSICAL_QUOTE_AGE_DAYS} dias`
      : assumptions.includeCows &&
          !allocationInputs.cowOpportunityWindowConfirmed
        ? 'A janela pós-silagem, a área e a escala das vacas de oportunidade precisam ser confirmadas'
      : assumptions.includeCows && !cowOpportunityPricesValid
        ? 'Compra e venda das vacas de oportunidade precisam de fonte e data recentes separadas'
      : assumptions.includeEffluentSavings &&
          !effluentScale.creditReady
        ? effluentScale.blockers[0] ??
          'O crédito do efluente exige volume fechado pelas cabeças-dia, análise química, eficiência agronômica e licenças confirmados'
      : !entryPriceSourceValid
        ? `A fonte do preço de entrada deve ter no máximo ${MAX_REPLACEMENT_QUOTE_AGE_DAYS} dias e ser anterior à entrada`
      : !gateAppliedSourceValid
        ? 'O preço do boi magro precisa de fonte/data aplicada; hipótese inicial não libera a rota A'
      : !capitalFeasibleA
        ? `A rota A requer ${moneyCompact(integratedCapitalA)} entre giro e CAPEX incremental e excede o limite compartilhado em ${moneyCompact(Math.max(0, integratedCapitalA - strategyCapitalLimit))}`
      : animalTimeline.comparisonStatus === 'invalid-input'
      ? animalTimeline.inputErrors[0] ?? 'As premissas do lote são inválidas'
      : animalTimeline.comparisonStatus === 'invalid-curve-source-date'
      ? 'A curva BGI contém data de observação inválida ou futura'
      : animalTimeline.comparisonStatus === 'invalid-source-date'
      ? 'A data-base do preço-cenário é inválida ou está no futuro'
      : animalTimeline.comparisonStatus === 'gate-price-date-mismatch'
      ? 'A data-alvo do boi magro não coincide com a data projetada da decisão'
      : animalTimeline.routes.some(
            (route) => route.curveCoverage === 'ineligible',
          )
        ? 'A elegibilidade do lote ao padrão BGI não foi confirmada'
        : 'A curva BGI não cobre nenhuma data projetada de terminação';
  const routeBBlocker = !allocationInputs.annualCalendarConfirmed
    ? 'Calendário anual de coortes ainda não confirmado'
    : !allocationInputs.pastureWaterForageConfirmed
      ? 'Água, energia, outorga, forragem e lotação do pasto irrigado ainda não confirmadas'
    : !replacementSupplyReadyB
      ? `O plano de origem validado não cobre ${int.format(replacementSupplyShortfallB)} das entradas anuais de B; reduza a escala ou valide compra adicional dentro do teto econômico de B`
    : !livestockCornPriceReady
      ? `Milho comum vinculado sem preço aplicado rastreável de até ${MAX_PHYSICAL_QUOTE_AGE_DAYS} dias`
    : !entryPriceSourceValid
      ? 'Preço de entrada sem data-base válida'
      : !capitalFeasibleB
        ? `A rota B requer ${moneyCompact(integratedWorkingCapitalB)} e excede o limite compartilhado em ${moneyCompact(Math.max(0, integratedWorkingCapitalB - strategyCapitalLimit))}`
      : !animalTimeline.curveSourceValid
        ? 'Curva BGI ausente, vencida ou com datas inválidas'
        : routeBCurve.coverage === 'ineligible'
          ? 'Elegibilidade do lote ao BGI não confirmada'
          : `A curva BGI não cobre a saída direta de B em ${routeBExitDate}`;
  const cropResults = useMemo(
    () =>
      crops.map((crop) =>
        calculateCrop(crop, assumptions.totalArea, assumptions.landLeaseHa),
      ),
    [crops, assumptions.totalArea, assumptions.landLeaseHa],
  );
  const doubleCrop = useMemo(() => {
    const soy = crops.find((crop) => crop.id === 'soy-irrigated') ?? crops[0];
    const corn = crops.find((crop) => crop.id === 'corn-irrigated') ?? crops[0];
    return calculateDoubleCrop(
      soy,
      corn,
      assumptions.totalArea,
      assumptions.landLeaseHa,
    );
  }, [crops, assumptions.totalArea, assumptions.landLeaseHa]);
  const automaticCalendarUsesFallback =
    strictIsoDate(animalTimelineInputs.entryDate) === null;
  const doubleCropDates = {
    soyPlant: strictIsoDate(automaticCalendar.doubleCrop.soyPlantDate),
    soyHarvest: strictIsoDate(automaticCalendar.doubleCrop.soyHarvestDate),
    cornPlant: strictIsoDate(automaticCalendar.doubleCrop.cornPlantDate),
    cornHarvest: strictIsoDate(automaticCalendar.doubleCrop.cornHarvestDate),
  };
  const soyCycleDays =
    doubleCropDates.soyPlant && doubleCropDates.soyHarvest
      ? Math.round(
          (doubleCropDates.soyHarvest.getTime() -
            doubleCropDates.soyPlant.getTime()) /
            DAY_MS,
        )
      : null;
  const cropTransitionDays =
    doubleCropDates.soyHarvest && doubleCropDates.cornPlant
      ? Math.round(
          (doubleCropDates.cornPlant.getTime() -
            doubleCropDates.soyHarvest.getTime()) /
            DAY_MS,
        )
      : null;
  const cornCycleDays =
    doubleCropDates.cornPlant && doubleCropDates.cornHarvest
      ? Math.round(
          (doubleCropDates.cornHarvest.getTime() -
            doubleCropDates.cornPlant.getTime()) /
            DAY_MS,
        )
      : null;
  const doubleCropTotalDays =
    doubleCropDates.soyPlant && doubleCropDates.cornHarvest
      ? Math.round(
          (doubleCropDates.cornHarvest.getTime() -
            doubleCropDates.soyPlant.getTime()) /
            DAY_MS,
        )
      : null;
  const doubleCropSequenceValid = Boolean(
    doubleCropDates.soyPlant &&
      doubleCropDates.soyHarvest &&
      doubleCropDates.cornPlant &&
      doubleCropDates.cornHarvest &&
      doubleCropDates.soyPlant.getTime() <
        doubleCropDates.soyHarvest.getTime() &&
      doubleCropDates.soyHarvest.getTime() <=
        doubleCropDates.cornPlant.getTime() &&
      doubleCropDates.cornPlant.getTime() <
        doubleCropDates.cornHarvest.getTime() &&
      soyCycleDays !== null &&
      soyCycleDays >= 60 &&
      soyCycleDays <= 220 &&
      cropTransitionDays !== null &&
      cropTransitionDays >= 0 &&
      cropTransitionDays <= 60 &&
      cornCycleDays !== null &&
      cornCycleDays >= 60 &&
      cornCycleDays <= 240 &&
      doubleCropTotalDays !== null &&
      doubleCropTotalDays <= COMMON_HORIZON_DAYS &&
      automaticCalendar.doubleCrop.completedWithinHorizon,
  );
  const doubleCropCapacityReady =
    doubleCropSequenceValid &&
    automaticCalendar.crops['soy-irrigated'].legalBasis ===
      'official-2026-27' &&
    doubleCropCalendar.waterEnergyConfirmed &&
    doubleCropCalendar.waterEnergyCapacityHa >= assumptions.totalArea &&
    doubleCropCalendar.machineCapacityConfirmed &&
    doubleCropCalendar.machineCapacityHa >= assumptions.totalArea;
  const singleCropCapacityReady = (id: CropAssumption['id']) => {
    const gate = cropOperational[id];
    const legalBasis = automaticCalendar.crops[id].legalBasis;
    return Boolean(
      automaticCalendar.crops[id].operationalReady &&
        (legalBasis === 'official-2026-27' || legalBasis === 'not-applicable') &&
        gate.waterEnergyConfirmed &&
        gate.waterEnergyCapacityHa >= assumptions.totalArea &&
        gate.machineCapacityConfirmed &&
        gate.machineCapacityHa >= assumptions.totalArea,
    );
  };

  const planningPlantRate = calculateWorkRate({
    areaHa: assumptions.totalArea,
    usableDays: operationalInputs.usablePlantDays,
    informedRateHaDay: operationalInputs.informedPlantRateHaDay,
  });
  const planningHarvestRate = calculateWorkRate({
    areaHa: assumptions.totalArea,
    usableDays: operationalInputs.usableHarvestDays,
    informedRateHaDay: operationalInputs.informedHarvestRateHaDay,
  });
  const cropCashComparisons = crops.map((crop) => {
    const calendar = automaticCalendar.crops[crop.id];
    const cash = calculateMonthlyCashFlow(
      cropCashEvents(
        crop,
        assumptions.totalArea,
        calendar.plantDate,
        calendar.harvestDate,
        assumptions.landLeaseHa,
      ),
    );
    return { id: crop.id, label: crop.shortName, cash };
  });
  const soyCrop = crops.find((crop) => crop.id === 'soy-irrigated') ?? crops[0];
  const cornCrop = crops.find((crop) => crop.id === 'corn-irrigated') ?? crops[0];
  const doubleCropCash = calculateMonthlyCashFlow([
    ...cropCashEvents(
      soyCrop,
      assumptions.totalArea,
      automaticCalendar.doubleCrop.soyPlantDate,
      automaticCalendar.doubleCrop.soyHarvestDate,
      assumptions.landLeaseHa,
      true,
    ),
    ...cropCashEvents(
      cornCrop,
      assumptions.totalArea,
      automaticCalendar.doubleCrop.cornPlantDate,
      automaticCalendar.doubleCrop.cornHarvestDate,
      assumptions.landLeaseHa,
      false,
    ),
  ]);
  const operationalCashComparisons = [
    ...cropCashComparisons,
    { id: 'soy-corn', label: 'Soja + milho', cash: doubleCropCash },
  ].sort((left, right) => left.cash.peakFundingNeed - right.cash.peakFundingNeed);
  const feedlotRequiredSlots = Math.ceil(
    Math.max(
      feedAllocation.concurrentOwnHeads,
      requiredNominalFeedlotCapacity ?? 0,
    ),
  );
  const derivedFeedlotCapexSlot =
    allocationInputs.feedlotCapacity > 0 && assumptions.investment > 0
      ? assumptions.investment / allocationInputs.feedlotCapacity
      : 0;
  const capexSteps = [
    buildCapexStep(
      'feedlot',
      'Cocho e currais',
      'vagas',
      feedlotRequiredSlots,
      allocationInputs.feedlotCapacity,
      derivedFeedlotCapexSlot,
      'R$/vaga inferido do CAPEX incremental e vagas informadas; valide o escopo do orçamento',
    ),
    buildCapexStep(
      'grain-storage',
      'Armazenagem de milho',
      't físicas',
      weeklyFeedPlan.peakGrainStockSacks * 0.06,
      operationalInputs.grainStorageCapacityTonnes,
      operationalInputs.grainStorageCapexPerTonne,
      'pico do estoque semanal calculado; capacidade e orçamento locais ainda editáveis',
    ),
    buildCapexStep(
      'silage-storage',
      'Armazenagem de silagem',
      't MS',
      weeklyFeedPlan.peakSilageStockDmKg / 1_000,
      operationalInputs.silageStorageCapacityTonnes,
      operationalInputs.silageStorageCapexPerTonne,
      'estoque próprio requerido no primeiro dia do cocho; validar ensilagem e perdas',
    ),
    buildCapexStep(
      'feed-mill',
      'Mistura e distribuição',
      't MS/dia',
      weeklyFeedPlan.peakWeeklyDmKg / 7_000,
      operationalInputs.feedMillCapacityTonnesDay,
      operationalInputs.feedMillCapexPerTonneDay,
      'pico semanal de matéria seca ÷ 7; não inclui reserva por turno/parada',
    ),
  ];
  const knownIncrementalCapex = capexSteps.reduce(
    (sum, step) => sum + (step.incrementalCapex ?? 0),
    0,
  );
  const unresolvedCapexSteps = capexSteps.filter(
    (step) => step.gap === null || step.incrementalCapex === null,
  ).length;
  const cornDetailedSubtotal = cornCrop.costItems
    .filter((item) =>
      CORN_DETAIL_COST_IDS.includes(
        item.id as (typeof CORN_DETAIL_COST_IDS)[number],
      ),
    )
    .reduce((sum, item) => sum + item.value, 0);
  const cornUnallocatedCost =
    cornCrop.costItems.find((item) => item.id === 'unallocated')?.value ?? 0;
  const cornHistoricalDirectCostGap = 6_528.6 - cropDirectCostHa(cornCrop);

  const futureOpportunities = (() => {
    const soy = crops.find((crop) => crop.id === 'soy-irrigated') ?? crops[0];
    const corn = crops.find((crop) => crop.id === 'corn-irrigated') ?? crops[0];
    const cotton = crops.find((crop) => crop.id === 'cotton-irrigated') ?? crops[0];
    const cropByProduct: Record<Exclude<FutureProduct, 'cattle'>, CropAssumption> = {
      soy,
      corn,
      cotton,
    };

    return futureQuotes.map((quote) => {
      const futurePrice = futurePriceInModelUnit(
        quote,
        futureUsdBrl,
        cottonFiberRecovery,
        cottonSeedCredit,
      );
      const physicalBaseId: MarketQuote['id'] =
        quote.product === 'cattle'
          ? 'cattle'
          : quote.product === 'soy'
            ? 'soy-irrigated'
            : quote.product === 'corn'
              ? 'corn-irrigated'
              : 'cotton-irrigated';
      const annualQuantity = quote.product === 'cattle' ? result.entrantsB * (1 - animalTimelineInputs.pastureMortality / 100) * routeBCarcassArrobas :
        cropByProduct[quote.product].yield * assumptions.totalArea * (quote.product === 'cotton' ? 15 * cottonFiberRecovery / 100 / 0.45359237 : 1);
      const eligibleQuantity = quote.product === 'cattle' ? annualQuantity / Math.max(1, result.cyclesB) : annualQuantity;
      const hedge = integerHedgeCoverage(eligibleQuantity, futureHedgePercent, quote.product === 'cattle' ? 330 : quote.product === 'cotton' ? 50000 : 450);
      const coverage = annualQuantity > 0 ? hedge.coveredQuantity / annualQuantity : 0;
      const physicalBaseAge = isoAgeDays(
        futurePhysicalBaseDates[physicalBaseId],
        asOfDate,
      );
      const physicalBaseValid =
        coverage >= 1 ||
        appliedPriceMeta[physicalBaseId].provenance === 'local-spreadsheet' ||
        (physicalBaseAge !== null &&
          physicalBaseAge >= 0 &&
          physicalBaseAge <= MAX_PHYSICAL_QUOTE_AGE_DAYS);
      const coverageValid = coverage > 0;

      if (quote.product === 'cattle') {
        const effectivePrice =
          futurePhysicalBasePrices.cattle * (1 - coverage) +
          futurePrice * coverage;
        const validation = validateFutureQuote(quote, asOfDate, {
          convertedPrice: futurePrice,
          effectivePrice,
          usdBrl: futureUsdBrl,
          cottonFiberRecovery,
        });
        const contractMatchesExitMonth =
          Boolean(routeBExitDate) &&
          quote.referenceDate.slice(0, 7) === routeBExitDate.slice(0, 7);
        const sold = result.entrantsB * (1 - animalTimelineInputs.pastureMortality / 100);
        const arrobas =
          sold *
          assumptions.saleWeight *
          (modelAssumptions.carcassYieldPercent / 100) /
          15;
        const retainedSale = 1 - modelAssumptions.saleDeductionPercent / 100;
        const scenarioRevenueHeadAtEntry =
          (routeBCarcassArrobas * effectivePrice * retainedSale * (1 - animalTimelineInputs.pastureMortality / 100)) /
          routeBDiscount;
        const scenarioDownstreamCeilingValidB = Boolean(
          calfPriceSourceValid &&
            validation.isUsable &&
            physicalBaseValid &&
            coverageValid &&
            routeBEligibleForBgi &&
            contractMatchesExitMonth &&
            Number.isFinite(scenarioRevenueHeadAtEntry),
        );
        const scenarioDownstreamMaximumPurchasePriceHeadB =
          scenarioDownstreamCeilingValidB
            ? Math.max(
                0,
                scenarioRevenueHeadAtEntry -
                  (routeBDays * animalTimelineInputs.pastureFinishCostDay) /
                    routeBCostDiscount -
                  breedingEconomicsInputs.targetDownstreamMarginHead,
              )
            : 0;
        const scenarioBreedingEconomicsB = calculateBreedingEconomics({
          ...breedingEconomicsCommonInputs,
          annualEntrants: baseResult.pasturePotentialB,
          downstreamMaximumPurchasePriceHead:
            scenarioDownstreamMaximumPurchasePriceHeadB,
          downstreamCeilingValid: scenarioDownstreamCeilingValidB,
        });
        const scenarioReplacementBlendReadyB =
          breedingEconomicsInputs.applyToComparison &&
          scenarioBreedingEconomicsB.modelReady &&
          scenarioDownstreamCeilingValidB &&
          scenarioBreedingEconomicsB.recommendedSupplyCloses === true &&
          (scenarioBreedingEconomicsB.downstreamSupportsPurchasedCalf === true ||
            scenarioBreedingEconomicsB.downstreamSupportsOwnCalf === true) &&
          scenarioBreedingEconomicsB.blendedEconomicCostHead !== null &&
          scenarioBreedingEconomicsB.blendedCashCostHead !== null;
        const scenarioReplacementSupplyReadyB =
          !breedingEconomicsInputs.applyToComparison ||
          scenarioReplacementBlendReadyB;
        const scenarioReplacementSupplyShortfallB = Math.max(
          0,
          baseResult.pasturePotentialB -
            (scenarioBreedingEconomicsB.recommendedOwnEntrants ?? 0) -
            (scenarioBreedingEconomicsB.recommendedPurchasedEntrants ?? 0),
        );
        const scenarioEffectiveReplacementCostHeadB =
          scenarioReplacementBlendReadyB
            ? (scenarioBreedingEconomicsB.blendedEconomicCostHead ??
              assumptions.calfCost)
            : assumptions.calfCost;
        const scenarioEffectiveReplacementCashCostHeadB =
          scenarioReplacementBlendReadyB
            ? (scenarioBreedingEconomicsB.blendedCashCostHead ??
              assumptions.calfCost)
            : assumptions.calfCost;
        const scenarioTimelineEntryCostHeadB =
          animalTimelineInputs.linkEntryCostToReplacement
            ? scenarioEffectiveReplacementCostHeadB
            : timelineEntryWeight * animalTimelineInputs.entryValuePerKgLive;
        const scenarioTimelineEntryCashCostHeadB =
          animalTimelineInputs.linkEntryCostToReplacement
            ? scenarioEffectiveReplacementCashCostHeadB
            : timelineEntryWeight * animalTimelineInputs.entryValuePerKgLive;
        const scenarioIntegratedWorkingCapitalB =
          result.simultaneousPivotB * scenarioTimelineEntryCashCostHeadB +
          result.soldB *
            routeBDays *
            animalTimelineInputs.pastureFinishCostDay *
            (routeBDays / 730) +
          linkedGrainCashCost + extraPastureAnnualB * Math.max(1, (routeBDays + 1) / 365);
        const scenarioCapitalFeasibleB =
          scenarioIntegratedWorkingCapitalB + assumptions.pivotInvestment + operationalInputs.reserveCash + operationalInputs.setupCost <= strategyCapitalLimit + 1e-6;
        const revenueAtEntry = arrobas * effectivePrice * retainedSale;
        const annualCostAtEntry = result.entrantsB * (scenarioTimelineEntryCostHeadB + routeBDays * animalTimelineInputs.pastureFinishCostDay) + result.landLeaseCost + extraPastureAnnualB;
        const margin =
          revenueAtEntry -
          annualCostAtEntry +
          commonGrainRevenueAtEntry -
          commonGrainCostAtEntry;
        const baselineMargin = routeBReady ? routeBSystemMargin : 0;
        const breakEvenPrice =
          arrobas > 0 && retainedSale > 0
            ? Math.max(0, annualCostAtEntry - commonGrainMarginAtEntry) /
              (arrobas * retainedSale)
            : null;
        const operationallyUsable =
          allocationInputs.annualCalendarConfirmed &&
          allocationInputs.pastureWaterForageConfirmed &&
          scenarioReplacementSupplyReadyB &&
          livestockCornPriceReady &&
          entryPriceSourceValid &&
          routeBEligibleForBgi &&
          scenarioCapitalFeasibleB &&
          contractMatchesExitMonth;
        const cattleFutureUsable =
          validation.isUsable &&
          operationallyUsable &&
          physicalBaseValid &&
          coverageValid;
        return {
          quote,
          futurePrice,
          effectivePrice,
          activity:
            linkedGrainAreaHa > 0
              ? 'Pecuária B + milho comum vendido'
              : 'Pecuária B · somente pivô',
          margin,
          marginHa: margin / integratedSystemFootprintA,
          baselineMarginHa: baselineMargin / integratedSystemFootprintA,
          deltaMarginHa:
            (margin - baselineMargin) / integratedSystemFootprintA,
          breakEvenPrice,
          priceDistance:
            breakEvenPrice && effectivePrice > 0
              ? ((effectivePrice - breakEvenPrice) / effectivePrice) * 100
              : null,
          contractsAtCoverage: hedge.contracts,
          actualCoveragePercent: coverage * 100,
          eligibleQuantity,
          capitalRequired: scenarioIntegratedWorkingCapitalB + assumptions.pivotInvestment + operationalInputs.reserveCash + operationalInputs.setupCost,
          capitalFeasible: scenarioCapitalFeasibleB,
          isUsable: cattleFutureUsable,
          executionUsable: cattleFutureUsable,
          validationIssue: !coverageValid
            ? 'cobertura futura deve ser maior que zero'
            : !physicalBaseValid
              ? 'a parcela física descoberta não possui preço-base recente e rastreável'
            : !allocationInputs.annualCalendarConfirmed
            ? 'calendário anual de coortes não confirmado'
            : !allocationInputs.pastureWaterForageConfirmed
              ? 'água, energia, forragem e lotação do pasto irrigado não confirmadas'
            : !scenarioReplacementSupplyReadyB
              ? `plano de origem não cobre ${int.format(scenarioReplacementSupplyShortfallB)} entradas anuais de B sob o preço ponderado deste contrato`
            : !livestockCornPriceReady
              ? `milho vinculado sem preço aplicado rastreável de até ${MAX_PHYSICAL_QUOTE_AGE_DAYS} dias`
            : !entryPriceSourceValid
              ? 'data-base do preço de entrada inválida'
            : !routeBEligibleForBgi
                ? 'lote não elegível ao BGI ou carcaça projetada abaixo de 16 @'
                : !scenarioCapitalFeasibleB
                  ? `capital requerido de ${moneyCompact(scenarioIntegratedWorkingCapitalB)} excede o limite`
                : !contractMatchesExitMonth
                  ? `o contrato não cobre a saída de B em ${routeBExitDate}`
                  : validation.issue,
          horizonDays: validation.horizonDays,
        };
      }

      const source = cropByProduct[quote.product];
      const effectivePrice =
        futurePhysicalBasePrices[source.id] * (1 - coverage) +
        futurePrice * coverage;
      const validation = validateFutureQuote(quote, asOfDate, {
        convertedPrice: futurePrice,
        effectivePrice,
        usdBrl: futureUsdBrl,
        cottonFiberRecovery,
      });
      const automaticCropWindow = automaticCalendar.crops[source.id];
      const availableDate = strictIsoDate(automaticCropWindow.availableDate);
      const lastDeliveryDate = strictIsoDate(
        automaticCropWindow.lastDeliveryDate,
      );
      const referenceDate = strictIsoDate(quote.referenceDate);
      const singleWindowValid = Boolean(
        availableDate &&
          lastDeliveryDate &&
          referenceDate &&
          availableDate.getTime() <= referenceDate.getTime() &&
          referenceDate.getTime() <= lastDeliveryDate.getTime(),
      );
      const projectedCrop = { ...source, price: effectivePrice };
      const projectedMono = calculateCrop(
        projectedCrop,
        assumptions.totalArea,
        assumptions.landLeaseHa,
      );
      let activity = source.name;
      let margin = projectedMono.margin;
      let marginHa = projectedMono.marginHa;
      let baselineMarginHa =
        cropResults.find((item) => item.id === source.id)?.marginHa ?? 0;
      let breakEvenPrice = projectedMono.breakEvenPrice;
      let capitalRequired = projectedMono.totalCost;
      let requiresDoubleCropGate = false;
      let companionPriceValid = true;
      let companionExecutionPriceValid = true;

      if (quote.product === 'soy' || quote.product === 'corn') {
        const projectedSoy = quote.product === 'soy' ? projectedCrop : soy;
        const projectedCorn = quote.product === 'corn' ? projectedCrop : corn;
        const projectedDouble = calculateDoubleCrop(
          projectedSoy,
          projectedCorn,
          assumptions.totalArea,
          assumptions.landLeaseHa,
        );
        if (projectedDouble.marginHa > marginHa) {
          requiresDoubleCropGate = true;
          companionPriceValid = appliedPriceSupportsBase(
            quote.product === 'soy' ? corn.id : soy.id,
          );
          companionExecutionPriceValid = appliedPriceIsValid(
            quote.product === 'soy' ? corn.id : soy.id,
          );
          activity = 'Soja + milho · duas safras';
          margin = projectedDouble.margin;
          marginHa = projectedDouble.marginHa;
          capitalRequired = projectedDouble.totalCost;
          baselineMarginHa = doubleCrop.marginHa;
          const other = quote.product === 'soy' ? corn : soy;
          const retainedRate = Math.max(
            0,
            1 - source.deductionRate / 100,
          );
          const otherRetainedRate = Math.max(
            0,
            1 - other.deductionRate / 100,
          );
          const annualCashNeed =
            cropFixedCostHa(soy) + cropFixedCostHa(corn) +
            cropDirectCostHa(soy) +
            cropDirectCostHa(corn) +
            assumptions.landLeaseHa;
          const otherRetainedRevenue =
            other.yield * other.price * otherRetainedRate;
          breakEvenPrice =
            source.yield > 0 && retainedRate > 0
              ? Math.max(
                  0,
                  (annualCashNeed - otherRetainedRevenue) /
                    (source.yield * retainedRate),
                )
              : null;
        }
      }

      capitalRequired += assumptions.pivotInvestment + operationalInputs.reserveCash + operationalInputs.setupCost;
      const capitalFeasible = capitalRequired <= strategyCapitalLimit + 1e-6;
      const relevantHarvestDate = strictIsoDate(
        requiresDoubleCropGate
          ? quote.product === 'soy'
            ? automaticCalendar.doubleCrop.soyHarvestDate
            : quote.product === 'corn'
              ? automaticCalendar.doubleCrop.cornHarvestDate
              : automaticCropWindow.harvestDate
          : automaticCropWindow.harvestDate,
      );
      const relevantAvailableDate = strictIsoDate(
        requiresDoubleCropGate && quote.product === 'corn'
          ? automaticCalendar.doubleCrop.availableDate
          : automaticCropWindow.availableDate,
      );
      const relevantLastDeliveryDate = strictIsoDate(
        requiresDoubleCropGate && quote.product === 'corn'
          ? automaticCalendar.doubleCrop.lastDeliveryDate
          : automaticCropWindow.lastDeliveryDate,
      );
      const relevantWindowValid = Boolean(
        relevantAvailableDate &&
          relevantLastDeliveryDate &&
          referenceDate &&
          relevantAvailableDate.getTime() <= referenceDate.getTime() &&
          referenceDate.getTime() <= relevantLastDeliveryDate.getTime(),
      );
      const availabilityAfterHarvest = Boolean(
        relevantAvailableDate &&
          relevantHarvestDate &&
          relevantAvailableDate.getTime() >= relevantHarvestDate.getTime(),
      );
      const contractsAtCoverage = hedge.contracts;
      const triageUsable =
        validation.isUsable &&
        (requiresDoubleCropGate ? relevantWindowValid : singleWindowValid) &&
        physicalBaseValid &&
        capitalFeasible &&
        availabilityAfterHarvest &&
        companionPriceValid &&
        (requiresDoubleCropGate
          ? automaticCalendar.doubleCrop.completedWithinHorizon
          : automaticCropWindow.operationalReady) &&
        coverageValid;
      const executionUsable =
        triageUsable &&
        cropMarketingWindows[quote.product].carryBasisConfirmed &&
        companionExecutionPriceValid;

      return {
        quote,
        futurePrice,
        effectivePrice,
        activity,
        margin,
        marginHa,
        baselineMarginHa,
        deltaMarginHa: marginHa - baselineMarginHa,
        breakEvenPrice,
        priceDistance:
          breakEvenPrice && effectivePrice > 0
            ? ((effectivePrice - breakEvenPrice) / effectivePrice) * 100
            : null,
        contractsAtCoverage,
        actualCoveragePercent: coverage * 100,
        eligibleQuantity,
        capitalRequired,
        capitalFeasible,
        isUsable: triageUsable,
        executionUsable,
        validationIssue: !coverageValid
          ? 'cobertura futura deve ser maior que zero'
          : !physicalBaseValid
            ? 'a parcela física descoberta não possui preço-base recente e rastreável'
          : !relevantAvailableDate || !relevantLastDeliveryDate
          ? `o ciclo agrícola não liquida até ${automaticCalendar.horizonEndDate}`
          : !relevantHarvestDate
            ? 'calendário automático sem colheita válida'
          : !availabilityAfterHarvest
            ? 'a disponibilidade comercial não pode anteceder a colheita informada'
          : referenceDate && referenceDate.getTime() < relevantAvailableDate.getTime()
            ? 'contrato anterior à disponibilidade física'
          : referenceDate &&
                referenceDate.getTime() > relevantLastDeliveryDate.getTime()
              ? 'contrato posterior à janela de estoque informada'
              : !capitalFeasible
                  ? `capital requerido de ${moneyCompact(capitalRequired)} excede o limite`
                : requiresDoubleCropGate && !companionPriceValid
                  ? 'a outra cultura da dupla safra precisa de preço físico aplicado, recente e coerente'
                : validation.issue,
        horizonDays: validation.horizonDays,
      };
    });
  })();
  const futureRanking = futureOpportunities.filter((item) => item.isUsable).sort(
    (left, right) => right.marginHa - left.marginHa,
  );
  const invalidFutureCount = futureOpportunities.length - futureRanking.length;
  const futureExecutionCount = futureRanking.filter(
    (item) => item.executionUsable,
  ).length;
  const bestFutureOpportunity = futureRanking[0];
  const bestFutureByProduct = (product: FutureProduct) =>
    futureRanking.find((item) => item.quote.product === product);
  const bestFutureCattle = bestFutureByProduct('cattle');
  const bestFutureGrain = futureRanking.find(
    (item) => item.quote.product === 'soy' || item.quote.product === 'corn',
  );
  const bestFutureFiber = bestFutureByProduct('cotton');

  const comparisons = (() => {
    const fixedCapital = assumptions.pivotInvestment + operationalInputs.reserveCash + operationalInputs.setupCost;
    const startupA = cattleStartupCash(modelAssumptions, 'A', animalTimelineInputs.entryDate, operationalInputs.setupDays, operationalInputs.setupCost);
    const startupB = cattleStartupCash(modelAssumptions, 'B', animalTimelineInputs.entryDate, operationalInputs.setupDays, operationalInputs.setupCost);
    const capitalA = cattleCapitalRequirement(modelAssumptions, 'A', startupA?.peakFundingNeed ?? 0, operationalInputs.setupCost, operationalInputs.reserveCash).required;
    const capitalB = cattleCapitalRequirement(modelAssumptions, 'B', startupB?.peakFundingNeed ?? 0, operationalInputs.setupCost, operationalInputs.reserveCash).required;
    const cattleA: ComparisonRow = {
      id: 'cattle-a',
      label: 'Pecuária A · recria + confinamento',
      source: 'Premissas-base fornecidas · ano nominal sobre a mesma área',
      production: `${int.format(result.soldA)} bois/ano${result.cowsSold > 0 ? ` + ${int.format(result.cowsSold)} vacas` : ''}`,
      revenue: result.netRevenueA,
      cost: result.cashCostsA,
      margin: result.ebitdaA,
      marginHa: result.ebitdaA / assumptions.totalArea,
      roi: result.cashCostsA > 0 ? (result.ebitdaA / result.cashCostsA) * 100 : 0,
      breakEven: result.priceBreakEvenA
        ? `${brl2.format(result.priceBreakEvenA)}/@`
        : 'n/d',
      capitalRequired: capitalA,
      capitalFeasible: capitalA <= strategyCapitalLimit + 1e-6,
      rankable: result.routeAInputValid && assumptions.totalArea > 0,
      evidenceLevel: 'base-spreadsheet',
      warning:
        routeIntegrationReady && capitalFeasibleA
          ? undefined
          : `Comparação-base disponível; execução detalhada pendente: ${animalDecisionBlocker}`,
    };
    const cattleB: ComparisonRow = {
      id: 'cattle-b',
      label: 'Pecuária B · somente pivô',
      source: 'Premissas-base fornecidas · ano nominal sobre a mesma área',
      production: `${int.format(result.soldB)} bois/ano`,
      revenue: result.netRevenueB,
      cost: result.cashCostsB,
      margin: result.ebitdaB,
      marginHa: result.ebitdaB / assumptions.totalArea,
      roi: result.cashCostsB > 0 ? (result.ebitdaB / result.cashCostsB) * 100 : 0,
      breakEven: result.priceBreakEvenB
        ? `${brl2.format(result.priceBreakEvenB)}/@`
        : 'n/d',
      capitalRequired: capitalB,
      capitalFeasible: capitalB <= strategyCapitalLimit + 1e-6,
      rankable: result.routeBInputValid && assumptions.totalArea > 0,
      evidenceLevel: 'base-spreadsheet',
      warning:
        routeBReady && capitalFeasibleB
          ? undefined
          : `Comparação-base disponível; execução detalhada pendente: ${routeBBlocker}`,
    };
    const capitalC = rearingCapitalRequirement(rearingAssumptions, animalTimelineInputs.gateValuePerKgLive,
      rearingCash?.peakFundingNeed ?? 0, operationalInputs.setupCost, operationalInputs.reserveCash).required;
    const cattleC: ComparisonRow = {
      id: 'cattle-c', label: 'Pecuária C · só recria e venda do magro',
      source: 'Recria sob pivô · reposição comprada · preço líquido do magro informado',
      production: `${int.format(rearing.sold)} magros/ano · ${one.format(rearing.cycles)} giros equivalentes`,
      revenue: rearing.revenue, cost: rearing.costs, margin: rearing.margin, marginHa: rearing.marginHa,
      roi: rearing.costs > 0 ? rearing.margin / rearing.costs * 100 : 0,
      breakEven: rearing.breakEvenPriceKg === null ? 'n/d' : `${brl2.format(rearing.breakEvenPriceKg)}/kg vivo líquido`,
      capitalRequired: capitalC, capitalFeasible: capitalC <= strategyCapitalLimit + 1e-6,
      rankable: rearing.valid && rearingCash !== null,
      evidenceLevel: 'base-spreadsheet',
      warning: 'Hipótese de preço líquido do magro, não cotação automática de boi gordo. Recria usa toda a área e bezerros comprados; validar comprador, lotes, pasto e caixa. Não é certificação para exportação.',
    };
    const cropRows = cropResults.map<ComparisonRow>((crop) => {
      const salesDeductions = crop.deductionsHa * crop.area;
      const comparableRevenue = crop.revenue - salesDeductions;
      const comparableCost = crop.totalCost - salesDeductions;
      const capitalRequired = (cropCashComparisons.find((r) => r.id === crop.id)?.cash.peakFundingNeed ?? comparableCost) + fixedCapital;
      const capitalFeasible = capitalRequired <= strategyCapitalLimit + 1e-6;
      const priceSourceValid = appliedPriceIsValid(crop.id);
      const hasAggregateCost = crops
        .find((item) => item.id === crop.id)
        ?.costItems.some((item) => item.status === 'underwriting');
      return {
        id: crop.id,
        label: crop.name,
        source: crop.farm,
        production: `${int.format(crop.production)} ${crop.unit.replace('/ha', '')}`,
        revenue: comparableRevenue,
        cost: comparableCost,
        margin: crop.margin,
        marginHa: crop.marginHa,
        roi:
          comparableCost > 0 ? (crop.margin / comparableCost) * 100 : 0,
        breakEven: crop.breakEvenPrice ? `${brl2.format(crop.breakEvenPrice)}/${crop.unit.split('/')[0]}` : 'n/d',
        capitalRequired,
        capitalFeasible,
        rankable: automaticCalendar.crops[crop.id].sanitaryFit && crop.area > 0,
        evidenceLevel:
          capitalFeasible &&
          priceSourceValid &&
          singleCropCapacityReady(crop.id) &&
          !hasAggregateCost
            ? 'preflight-validated'
            : 'base-spreadsheet',
        blocker: undefined,
        warning:
          capitalFeasible &&
          priceSourceValid &&
          singleCropCapacityReady(crop.id) &&
          !hasAggregateCost
            ? undefined
            : `Margem anual em regime pleno disponível; confirme ${!priceSourceValid ? 'preço atual, ' : ''}água/energia, máquinas e ${moneyCompact(comparableCost)} de custeio antes de executar${!automaticCalendar.crops[crop.id].completedWithinHorizon ? `; a primeira colheita após o marco cai depois de ${automaticCalendar.horizonEndDate}` : ''}${hasAggregateCost ? '; abra o custeio agregado do milho para excluir possível dupla contagem de irrigação' : ''}`,
      };
    });
    const doubleCropSalesDeductions = cropResults
      .filter(
        (crop) =>
          crop.id === 'soy-irrigated' || crop.id === 'corn-irrigated',
      )
      .reduce((sum, crop) => sum + crop.deductionsHa * crop.area, 0);
    const doubleCropComparableRevenue =
      doubleCrop.revenue - doubleCropSalesDeductions;
    const doubleCropComparableCost =
      doubleCrop.totalCost - doubleCropSalesDeductions;
    const doubleCropCapitalFeasible =
      doubleCropCash.peakFundingNeed + fixedCapital <= strategyCapitalLimit + 1e-6;
    const doubleCropPriceSourcesValid = ['soy-irrigated', 'corn-irrigated'].every(
      (id) => {
        const quoteId = id as MarketQuote['id'];
        return appliedPriceIsValid(quoteId);
      },
    );
    return [
      cattleA,
      cattleB,
      cattleC,
      ...cropRows,
      {
        id: 'double-crop',
        label: doubleCrop.name,
        source: 'Cenário combinado irrigado',
        production: '2 safras na mesma área',
        revenue: doubleCropComparableRevenue,
        cost: doubleCropComparableCost,
        margin: doubleCrop.margin,
        marginHa: doubleCrop.marginHa,
        roi:
          doubleCropComparableCost > 0
            ? (doubleCrop.margin / doubleCropComparableCost) * 100
            : 0,
        breakEven: 'ver cada cultura',
        capitalRequired: doubleCropCash.peakFundingNeed + fixedCapital,
        capitalFeasible: doubleCropCapitalFeasible,
        rankable: automaticCalendar.crops['soy-irrigated'].sanitaryFit && automaticCalendar.crops['corn-irrigated'].sanitaryFit,
        evidenceLevel:
          doubleCropCapitalFeasible &&
          doubleCropPriceSourcesValid &&
          doubleCropCapacityReady &&
          !crops
            .find((crop) => crop.id === 'corn-irrigated')
            ?.costItems.some((item) => item.status === 'underwriting')
            ? 'preflight-validated'
            : 'base-spreadsheet',
        blocker: undefined,
        warning:
          doubleCropCapitalFeasible &&
          doubleCropPriceSourcesValid &&
          doubleCropCapacityReady &&
          !crops
            .find((crop) => crop.id === 'corn-irrigated')
            ?.costItems.some((item) => item.status === 'underwriting')
            ? undefined
            : `Margem anual em regime pleno disponível; confirme preços atuais, água/energia, máquinas e ${moneyCompact(doubleCropComparableCost)} de custeio para executar${!automaticCalendar.doubleCrop.completedWithinHorizon ? `; a sequência iniciada no marco termina depois de ${automaticCalendar.horizonEndDate}` : ''}; abra o custeio agregado do milho para excluir possível dupla contagem de irrigação`,
      },
    ];
  })();
  const rankableComparisons = comparisons.filter((row) => row.rankable);
  // Coeficientes lineares de um módulo de 1 ha. Vagas-dia limitam a área
  // alocada; não diluir um cocho já saturado em toda a fazenda.
  const strategyUnitCattle = useMemo(() => calculateCore({
    ...modelAssumptions, totalArea: 1, feedlotCapacity: undefined, includeEffluentSavings: false,
  }), [modelAssumptions]);
  const strategyBaseComparisons = rankableComparisons.map((row) => {
    if (row.id !== 'cattle-a' && row.id !== 'cattle-b') return row;
    const routeA = row.id === 'cattle-a';
    const marginHa = routeA ? strategyUnitCattle.ebitdaA : strategyUnitCattle.ebitdaB;
    const costHa = routeA ? strategyUnitCattle.cashCostsA : strategyUnitCattle.cashCostsB;
    return { ...row, marginHa, margin: marginHa * assumptions.totalArea, cost: costHa * assumptions.totalArea };
  });

  const strategyScenarios: StrategyScenario[] = (() => {
    const baseMargins = Object.fromEntries(
      strategyBaseComparisons.map((row) => [row.id, row.marginHa]),
    );
    const baseCosts = Object.fromEntries(
      strategyBaseComparisons.map((row) => [
        row.id,
        row.cost / Math.max(assumptions.totalArea, 1),
      ]),
    );
    const buildStressScenario = (
      id: Exclude<StrategyBand, 'base'>,
    ): StrategyScenario => {
      const low = id === 'low';
      const productivityFactor =
        1 +
        (low
          ? strategyStress.productivityLow
          : strategyStress.productivityHigh) /
          100;
      const costFactor =
        1 + (low ? strategyStress.costLow : strategyStress.costHigh) / 100;
      const replacementFactor =
        1 +
        (low
          ? strategyStress.replacementLow
          : strategyStress.replacementHigh) /
          100;
      const cattlePriceFactor =
        1 + (low ? strategyStress.cattleLow : strategyStress.cattleHigh) / 100;
      const cornPriceFactor =
        1 + (low ? strategyStress.cornLow : strategyStress.cornHigh) / 100;
      const priceFactorForCrop = (crop: CropAssumption) => {
        if (crop.id === 'soy-irrigated') {
          return 1 + (low ? strategyStress.soyLow : strategyStress.soyHigh) / 100;
        }
        if (crop.id === 'corn-irrigated') return cornPriceFactor;
        return 1 + (low ? strategyStress.cottonLow : strategyStress.cottonHigh) / 100;
      };
      const stressedCrops = crops.map((crop) =>
        stressCrop(
          crop,
          priceFactorForCrop(crop),
          productivityFactor,
          costFactor,
        ),
      );
      const stressedSilageCostDm =
        silageCostDm / Math.max(productivityFactor, 0.05);
      const stressedGrainCostDm = cornPurchaseCostDm * cornPriceFactor;
      const stressedDietPrice = assumptions.linkFeedToCropCosts
        ? (assumptions.forageShare / 100) * stressedSilageCostDm +
          Math.max(0, 1 - assumptions.forageShare / 100 - operationalInputs.otherIngredientSharePercent / 100) * stressedGrainCostDm +
          assumptions.dietOtherCostDm
        : modelAssumptions.dietPriceDm;
      const stressedAssumptions = {
        ...modelAssumptions,
        totalArea: 1,
        feedlotCapacity: undefined,
        includeEffluentSavings: false,
        priceArroba: modelAssumptions.priceArroba * cattlePriceFactor,
        cowSaleArroba: modelAssumptions.cowSaleArroba * cattlePriceFactor,
        calfCost: modelAssumptions.calfCost * replacementFactor,
        cowBuyCost: modelAssumptions.cowBuyCost * replacementFactor,
        stockingUa: Math.max(0, modelAssumptions.stockingUa * productivityFactor),
        gmdPivotA: Math.max(0.05, modelAssumptions.gmdPivotA * productivityFactor),
        gmdFeedlot: Math.max(0.05, modelAssumptions.gmdFeedlot * productivityFactor),
        gmdB: Math.max(0.05, modelAssumptions.gmdB * productivityFactor),
        silageYieldDm: Math.max(
          0.1,
          modelAssumptions.silageYieldDm * productivityFactor,
        ),
        dietPriceDm: stressedDietPrice,
        otherCostFactor: Math.max(
          0,
          modelAssumptions.otherCostFactor * costFactor,
        ),
      };
      const stressedCattle = simulate(stressedAssumptions);
      const stressedRearing = stressRearing(rearingAssumptions, animalTimelineInputs.gateValuePerKgLive, {
        productivity: productivityFactor, cost: costFactor, replacement: replacementFactor, price: cattlePriceFactor,
      });
      const stressedCropResults = stressedCrops.map((crop) =>
        calculateCrop(crop, assumptions.totalArea, assumptions.landLeaseHa),
      );
      const stressedSoy =
        stressedCrops.find((crop) => crop.id === 'soy-irrigated') ??
        stressedCrops[0];
      const stressedCorn =
        stressedCrops.find((crop) => crop.id === 'corn-irrigated') ??
        stressedCrops[0];
      const stressedDouble = calculateDoubleCrop(
        stressedSoy,
        stressedCorn,
        assumptions.totalArea,
        assumptions.landLeaseHa,
      );
      const stressedCropComparableCostHa = (
        crop: (typeof stressedCropResults)[number],
      ) => crop.totalCostHa - crop.deductionsHa;
      const stressedDoubleSalesDeductionsHa = stressedCropResults
        .filter(
          (crop) =>
            crop.id === 'soy-irrigated' || crop.id === 'corn-irrigated',
        )
        .reduce((sum, crop) => sum + crop.deductionsHa, 0);
      return {
        id,
        capital: {
          'cattle-a': cattleCapitalRequirement({ ...stressedAssumptions, investment: 0, pivotInvestment: 0 }, 'A').required,
          'cattle-b': cattleCapitalRequirement({ ...stressedAssumptions, investment: 0, pivotInvestment: 0 }, 'B').required,
          'cattle-c': stressedRearing.operatingCycleReserve,
        },
        penDaysHa: stressedCattle.confinementOccupancy * 365,
        label: low ? 'Faixa inferior' : 'Faixa superior',
        note: low
          ? 'Preço e produtividade menores; custos e reposição pressionados.'
          : 'Preço e produtividade maiores; custos levemente aliviados, mas reposição também sobe.',
        margins: {
          'cattle-a': stressedCattle.ebitdaA,
          'cattle-b': stressedCattle.ebitdaB,
          'cattle-c': stressedRearing.marginHa,
          ...Object.fromEntries(
            stressedCropResults.map((crop) => [crop.id, crop.marginHa]),
          ),
          'double-crop': stressedDouble.marginHa,
        },
        costs: {
          'cattle-c': stressedRearing.costs,
          'cattle-a':
            stressedCattle.cashCostsA,
          'cattle-b':
            stressedCattle.cashCostsB,
          ...Object.fromEntries(
            stressedCropResults.map((crop) => [
              crop.id,
              stressedCropComparableCostHa(crop),
            ]),
          ),
          'double-crop':
            stressedDouble.totalCostHa - stressedDoubleSalesDeductionsHa,
        },
      };
    };

    return [
      buildStressScenario('low'),
      {
        id: 'base',
        capital: {
          'cattle-a': cattleCapitalRequirement({ ...modelAssumptions, totalArea: 1, feedlotCapacity: undefined, investment: 0, pivotInvestment: 0 }, 'A').required,
          'cattle-b': cattleCapitalRequirement({ ...modelAssumptions, totalArea: 1, feedlotCapacity: undefined, investment: 0, pivotInvestment: 0 }, 'B').required,
          'cattle-c': rearing.operatingCycleReserve / Math.max(assumptions.totalArea, 1),
        },
        penDaysHa: strategyUnitCattle.confinementOccupancy * 365,
        label: 'Cenário central',
        note: 'Premissas atualmente informadas no simulador.',
        margins: baseMargins,
        costs: baseCosts,
      },
      buildStressScenario('high'),
    ];
  })();
  const strategyActivities = strategyBaseComparisons.map((row) => {
        const margins: ScenarioMargins = {
          low:
            strategyScenarios.find((scenario) => scenario.id === 'low')?.margins[
              row.id
            ] ?? row.marginHa,
          base: row.marginHa,
          high:
            strategyScenarios.find((scenario) => scenario.id === 'high')?.margins[
              row.id
            ] ?? row.marginHa,
        };
        const scenarioCosts = strategyScenarios.map(
          (scenario) =>
            Math.max(scenario.capital[row.id] ?? 0, scenario.costs[row.id] ??
            row.cost / Math.max(assumptions.totalArea, 1)),
        );
        return {
          id: row.id,
          label: row.label,
          margins,
          cashCostHa: Math.max(...scenarioCosts),
          maxAreaHa: row.id === 'cattle-a'
            ? allocationInputs.feedlotCapacity * allocationInputs.feedlotUtilization / 100 * 365 /
              Math.max(1e-9, ...strategyScenarios.map((scenario) => scenario.penDaysHa))
            : assumptions.totalArea,
          scoreHa: criterionMargin(margins, strategyCriterion),
        };
      });
  const strategyIdleActivity = {
    id: 'idle',
    label: 'Não operar · área ociosa',
    margins: {
      low: -assumptions.landLeaseHa,
      base: -assumptions.landLeaseHa,
      high: -assumptions.landLeaseHa,
    },
    cashCostHa: assumptions.landLeaseHa,
    scoreHa: -assumptions.landLeaseHa,
  };
  const strategyRanking = [...strategyActivities, strategyIdleActivity].sort(
    (left, right) => right.scoreHa - left.scoreHa,
  );
  const strategyReady = strategyActivities.length > 0;
  const strategyLeader = strategyReady ? strategyRanking[0] : undefined;
  const strategySecond = strategyReady ? strategyRanking[1] : undefined;
  const strategyGap = strategyLeader && strategySecond
    ? strategyLeader.scoreHa - strategySecond.scoreHa
    : 0;
  const strategyIndifferent = strategyGap < strategyErrorHa;
  const strategyAllocation = allocateEnterpriseStrategy({
        commonFixedCapital: assumptions.pivotInvestment + operationalInputs.setupCost + operationalInputs.reserveCash,
        feedlotFixedCapital: assumptions.investment,
        activities: strategyActivities,
        totalArea: assumptions.totalArea,
        capitalLimit: strategyCapitalLimit,
        maxSharePercent: strategyMaxShare,
        criterion: strategyCriterion,
        idleMargins: {
          low: -assumptions.landLeaseHa,
          base: -assumptions.landLeaseHa,
          high: -assumptions.landLeaseHa,
        },
        idleCashCostHa: assumptions.landLeaseHa,
      });
  const strategyChartData = strategyRanking.map((activity) => ({
    name: activity.label,
    low: activity.margins.low,
    base: activity.margins.base,
    high: activity.margins.high,
  }));

  const noFeasibleComparison: ComparisonRow = {
    id: 'none-feasible',
    label: 'Nenhuma alternativa viável no limite atual',
    source: 'Aplique preços datados e complete as confirmações obrigatórias; depois ajuste capital ou área se ainda não houver alternativa apta',
    production: 'aguarda preenchimento',
    revenue: 0,
    cost: 0,
    margin: 0,
    marginHa: 0,
    roi: 0,
    breakEven: 'n/d',
    capitalRequired: 0,
    capitalFeasible: false,
    rankable: false,
    evidenceLevel: 'base-spreadsheet',
    blocker: 'Todas as alternativas excedem o capital ou têm dados obrigatórios pendentes',
  };
  const budgetRanking = rankWithinBudget(comparisons, strategyCapitalLimit, strategyErrorHa);
  const best = budgetRanking.best ?? noFeasibleComparison;
  const allOperatingLosses = budgetRanking.feasible.length > 0 && best.margin <= 0;
  const cattlePurchaseA =
    routedCandidateHeads * effectiveReplacementCashCostHead +
    result.cowsSold * assumptions.cowBuyCost;
  const cattlePurchaseB = result.entrantsB * effectiveReplacementCashCostHeadB;
  const ranking = [...comparisons].sort(
    (left, right) => right.marginHa - left.marginHa,
  );
  const runnerUp = budgetRanking.feasible[1];
  const capacityDiagnostics = capacityActions(modelAssumptions, allocationInputs.grainPurchasePriceSack);
  const decisionLabInput = useMemo<LabInput>(() => ({
    a: modelAssumptions, calfCostC: assumptions.calfCost,
    gateNetPrice: animalTimelineInputs.gateValuePerKgLive, budget: strategyCapitalLimit,
    anchor: animalTimelineInputs.entryDate, setupDays: operationalInputs.setupDays,
    setupCost: operationalInputs.setupCost, reserveCash: operationalInputs.reserveCash,
    cornDelivered: allocationInputs.grainPurchasePriceSack, crops,
    windows: Object.fromEntries(crops.map(c => { const w = automaticCalendar.crops[c.id]; return [c.id, { plant: w.plantDate, harvest: w.harvestDate, eligible: w.sanitaryFit }]; })),
    doubleWindow: { soyPlant: automaticCalendar.doubleCrop.soyPlantDate, soyHarvest: automaticCalendar.doubleCrop.soyHarvestDate,
      cornPlant: automaticCalendar.doubleCrop.cornPlantDate, cornHarvest: automaticCalendar.doubleCrop.cornHarvestDate,
      eligible: automaticCalendar.crops['soy-irrigated'].sanitaryFit && automaticCalendar.crops['corn-irrigated'].sanitaryFit },
    desiredUa: assumptions.stockingUa, forage: reviewInputs,
  }), [modelAssumptions, assumptions.calfCost, assumptions.stockingUa, animalTimelineInputs.gateValuePerKgLive, animalTimelineInputs.entryDate, strategyCapitalLimit, operationalInputs, allocationInputs.grainPurchasePriceSack, crops, automaticCalendar, reviewInputs]);
  const reportCapitalStudy = useMemo(() => activeTab === 'report' ? capitalStudy(decisionLabInput) : null, [activeTab, decisionLabInput]);
  const leaseBurden =
    best.id !== 'none-feasible' && result.landLeaseCost > 0
      ? (result.landLeaseCost /
          Math.max(Math.abs(best.margin) + result.landLeaseCost, 1)) *
        100
      : null;
  const bestCrop = crops.find((crop) => crop.id === best.id);
  const dominantCropCost = bestCrop
    ? [...bestCrop.costItems].sort((left, right) => right.value - left.value)[0]
    : null;
  const bottlenecks = [
    {
      level:
        best.id === 'none-feasible' ||
        best.evidenceLevel !== 'preflight-validated'
          ? 'atenção'
          : 'monitorar',
      title: best.id === 'none-feasible'
        ? 'Nenhuma alternativa anual pôde ser calculada'
        : best.evidenceLevel === 'preflight-validated'
          ? 'Alternativa líder com pré-validação concluída'
          : 'Triagem econômica pronta; execução ainda requer validação',
      text: best.id === 'none-feasible'
        ? comparisons.filter((row) => !row.rankable).slice(0, 4).map((row) => `${row.label}: ${row.blocker ?? 'fora do horizonte'}`).join(' · ')
        : best.warning ?? 'Preço, capacidade e calendário detalhado estão reconciliados para a alternativa líder.',
    },
    {
      level: result.bindingConstraintA === 'silagem' ? 'atenção' : 'monitorar',
      title: `Capacidade física de A: ${result.bindingConstraintA}`,
      text:
        result.bindingConstraintA === 'silagem'
          ? `A área disponível é ${one.format(result.silageArea)} ha e o balanço pede ${one.format(result.requiredSilageArea)} ha.`
          : `O pasto limita a saída antes da silagem; a lotação de equilíbrio é ${two.format(result.balancedStockingUa)} UA/ha.`,
    },
    {
      level: equivalentCornArea > assumptions.totalArea * 0.5 ? 'atenção' : 'monitorar',
      title: 'Suprimento de milho-grão fora da área-base',
      text: `${int.format(annualCornSacks)} sc/ano, equivalentes a ${one.format(equivalentCornArea)} ha na produtividade informada. Os ${int.format(assumptions.totalArea)} ha do cenário fecham pasto + silagem; o grão entra como reposição externa e não é descontado dessa área.`,
    },
    {
      level: animalTimeline.comparisonStatus === 'comparable' ? 'monitorar' : 'atenção',
      title: 'Cobertura temporal das rotas terminadas',
      text:
        animalTimeline.comparisonStatus === 'comparable'
          ? 'Ao menos uma saída terminada possui preço BGI compatível; nas demais, preencha um vencimento coberto.'
          : animalDecisionBlocker,
    },
    {
      level: leaseBurden !== null && leaseBurden > 20 ? 'atenção' : 'monitorar',
      title: 'Peso do arrendamento',
      text:
        best.id === 'none-feasible'
          ? 'O impacto relativo do arrendamento só é calculado depois que pelo menos uma alternativa entra validamente no ranking.'
        : assumptions.landLeaseHa > 0 && leaseBurden !== null
          ? `${one.format(leaseBurden)}% da margem da alternativa de maior margem calculada antes do arrendamento; desembolso anual de ${moneyCompact(result.landLeaseCost)}.`
          : 'Ainda zerado. Informe R$/ha/ano para comparar operação própria e área arrendada.',
    },
    {
      level:
        best.id === 'corn-irrigated' || best.id === 'double-crop'
          ? 'atenção'
          : 'monitorar',
      title: dominantCropCost
        ? `Maior custo da alternativa de maior margem: ${dominantCropCost.label}`
        : 'Capital e reposição animal',
      text: dominantCropCost
        ? `${brl2.format(dominantCropCost.value)}/ha, equivalente a ${one.format((dominantCropCost.value / Math.max(cropDirectCostHa(bestCrop!), 1)) * 100)}% do custo direto.`
        : `A compra anual de animais em A chega a ${moneyCompact(cattlePurchaseA)}; valide calendário, limite de crédito e giro.`,
    },
    {
      level:
        effluentScale.coveragePercent >= 100 && effluentScale.creditReady
          ? 'monitorar'
          : 'atenção',
      title: 'Efluente: escala do confinamento versus área-alvo',
      text:
        effluentScale.currentOwnFeedlotHeadDays <= 0
          ? 'A rota atual não envia animais ao cocho próprio; portanto não há volume de efluente próprio a creditar.'
          : `${int.format(effluentScale.availableVolumeM3)} m³ cobrem ${one.format(effluentScale.areaCoveredAtTargetDepthHa)} dos ${one.format(effluentScale.targetAreaHa)} ha a ${int.format(assumptions.effluentDepthMm)} mm/ano. Para cobrir toda a área seriam ${two.format(effluentScale.requiredReferenceModules ?? 0)} módulos e ${int.format(effluentScale.requiredAnnualHeadsAtReferenceStay ?? 0)} animais/ano na permanência-base.`,
    },
  ];

  const capitalRecoveryFactor = annuityFactor(
    assumptions.discountRate,
    Math.max(1, Math.round(assumptions.horizon)),
  );
  const integratedIncrementalWorkingCapital =
    integratedWorkingCapitalA - integratedWorkingCapitalB;
  const integratedFinancialReady = routeIntegrationReady && routeBReady;
  const integratedIncrementalMargin = integratedFinancialReady
    ? integratedRouteMarginA - routeBSystemMargin
    : 0;
  const integratedYears = Math.max(1, Math.round(assumptions.horizon));
  const integratedCashFlows = integratedFinancialReady
    ? [
        -assumptions.investment - integratedIncrementalWorkingCapital,
        ...Array.from({ length: integratedYears }, (_, index) =>
          index === integratedYears - 1
            ? integratedIncrementalMargin +
              assumptions.terminalValue +
              integratedIncrementalWorkingCapital
            : integratedIncrementalMargin,
        ),
      ]
    : [];
  const integratedOperationalNpv = integratedFinancialReady
    ? npv(assumptions.discountRate, integratedCashFlows)
    : null;
  const integratedOperationalIrr = integratedFinancialReady
    ? irr(integratedCashFlows)
    : null;
  const integratedMaxInvestment = integratedFinancialReady
    ? integratedIncrementalMargin * capitalRecoveryFactor +
      (assumptions.terminalValue + integratedIncrementalWorkingCapital) /
        (1 + assumptions.discountRate / 100) ** integratedYears -
      integratedIncrementalWorkingCapital
    : null;
  const integratedSimplePayback =
    integratedFinancialReady && integratedIncrementalMargin > 0
      ? (assumptions.investment +
          Math.max(0, integratedIncrementalWorkingCapital)) /
        integratedIncrementalMargin
      : null;
  const commonPivotAnnualNeed =
    assumptions.pivotInvestment / Math.max(capitalRecoveryFactor, 0.01);
  const formatMinimumArea = (annualNeed: number, marginHa: number) => {
    if (annualNeed <= 0) return 'linear · CAPEX comum = 0';
    if (marginHa <= 0) return 'não fecha';
    return `${int.format(annualNeed / marginHa)} ha`;
  };
  const leaderIncrementalInvestment = best.id === 'cattle-a' ? assumptions.investment : 0;
  const maxCommonPivotInvestment =
    best.id === 'none-feasible'
      ? null
      : Math.max(
          0,
          best.margin * capitalRecoveryFactor - leaderIncrementalInvestment,
        );

  const doubleCropBreakEvenFactor = (() => {
    const soy = crops.find((crop) => crop.id === 'soy-irrigated');
    const corn = crops.find((crop) => crop.id === 'corn-irrigated');
    if (!soy || !corn) return null;
    const soyRetained = 1 - soy.deductionRate / 100;
    const cornRetained = 1 - corn.deductionRate / 100;
    const retainedRevenue =
      soy.yield * soy.price * soyRetained +
      corn.yield * corn.price * cornRetained;
    const fixedCashNeed =
      cropFixedCostHa(soy) + cropFixedCostHa(corn) +
      cropDirectCostHa(soy) +
      cropDirectCostHa(corn) +
      assumptions.landLeaseHa;
    return retainedRevenue > 0 ? fixedCashNeed / retainedRevenue : null;
  })();
  const routeBArrobasHead =
    (assumptions.saleWeight *
      (animalTimelineInputs.carcassYield / 100)) /
    15;
  const routeBRetainedSale =
    (1 - animalTimelineInputs.saleDeduction / 100) *
    (1 - animalTimelineInputs.pastureMortality / 100);
  const routeBBreakEvenPrice =
    routeBReady && result.soldB > 0 && routeBArrobasHead > 0
      ? (Math.max(
          0,
          routeBCostHeadAtEntry +
            result.landLeaseCost / result.soldB -
            commonGrainMarginAtEntry / result.soldB,
        ) *
          routeBDiscount) /
        (routeBArrobasHead * routeBRetainedSale)
      : null;

  const breakEvenRows: BreakEvenRow[] = [
    {
      id: 'break-even-c', label: 'Pecuária C · só recria',
      currentPrice: `${brl2.format(rearing.gateNetPriceKg)}/kg vivo líquido`,
      zeroMargin: rearing.breakEvenPriceKg === null ? 'dados insuficientes' : `${brl2.format(rearing.breakEvenPriceKg)}/kg vivo líquido`,
      minimumOutput: `${int.format(rearing.sold)} magros/ano · ${rearing.days} dias por fase`,
      minimumArea: formatMinimumArea(commonPivotAnnualNeed, rearing.marginHa),
      priceBuffer: rearing.breakEvenPriceKg !== null && rearing.gateNetPriceKg > 0
        ? (1 - rearing.breakEvenPriceKg / rearing.gateNetPriceKg) * 100 : null,
      competitivePoint: 'Regime pleno; preço do magro independente do boi gordo. Capital inclui reserva para completar a fase.',
    },
    {
      id: 'break-even-a',
      label: 'Pecuária · recria + rotas',
      currentPrice: `${brl2.format(animalTimelineInputs.gateValuePerKgLive)}/kg vivo no gate`,
      zeroMargin: routeIntegrationReady
        ? 'multi-rota · ver VP por lote'
        : 'aguarda dados',
      minimumOutput: routeIntegrationReady
        ? `${int.format(routedCandidateHeads)} entradas/ano confirmadas`
        : 'calendário anual não confirmado',
      minimumArea: 'não linear · recalcular pasto, alimento e cocho a cada área',
      priceBuffer: null,
      competitivePoint: integratedFinancialReady
        ? `Margem econômica A − B = ${moneyCompact(integratedIncrementalMargin)}/ano; não extrapolar este resultado para outras áreas`
        : 'exige A e B datadas e anualizadas',
    },
    {
      id: 'break-even-b',
      label: 'Pecuária B · somente pivô',
      currentPrice:
        routeBCurve.price === null
          ? 'sem preço para a saída'
          : `${brl2.format(routeBCurve.price)}/@ em ${routeBExitDate}`,
      zeroMargin:
        routeBBreakEvenPrice === null
          ? 'aguarda dados'
          : `${brl2.format(routeBBreakEvenPrice)}/@`,
      minimumOutput: routeBReady
        ? `${int.format(result.soldB)} cab/ano · ${routeBDays} dias`
        : routeBBlocker,
      minimumArea: formatMinimumArea(
        commonPivotAnnualNeed,
        routeBSystemMargin / integratedSystemFootprintA,
      ),
      priceBuffer:
        routeBBreakEvenPrice !== null && (routeBCurve.price ?? 0) > 0
          ? (((routeBCurve.price ?? 0) - routeBBreakEvenPrice) /
              (routeBCurve.price ?? 1)) *
            100
          : null,
      competitivePoint: integratedFinancialReady
        ? integratedIncrementalMargin >= 0
          ? 'A tem maior margem no cenário integrado'
          : 'B tem maior margem no cenário integrado'
        : 'complete A e B para comparar',
    },
    ...cropResults.map<BreakEvenRow>((crop) => {
      const source = crops.find((item) => item.id === crop.id);
      const retainedRate = source
        ? 1 - source.deductionRate / 100
        : 0;
      const minimumYield =
        source && source.price > 0 && retainedRate > 0
          ? (crop.directCostHa + crop.fixedCostHa + assumptions.landLeaseHa) /
            (source.price * retainedRate)
          : null;
      const unit = crop.unit.split('/')[0];
      return {
        id: `break-even-${crop.id}`,
        label: crop.name,
        currentPrice: `${brl2.format(crop.price)}/${unit}`,
        zeroMargin: crop.breakEvenPrice
          ? `${brl2.format(crop.breakEvenPrice)}/${unit}`
          : 'n/d',
        minimumOutput:
          minimumYield === null
            ? 'n/d'
            : `${one.format(minimumYield)} ${crop.unit}`,
        minimumArea: formatMinimumArea(commonPivotAnnualNeed, crop.marginHa),
        priceBuffer:
          crop.breakEvenPrice && crop.price > 0
            ? ((crop.price - crop.breakEvenPrice) / crop.price) * 100
            : null,
        competitivePoint: 'ranking por margem/ha',
      };
    }),
    {
      id: 'break-even-double-crop',
      label: 'Soja + milho · duas safras',
      currentPrice: 'índice conjunto 100',
      zeroMargin:
        doubleCropBreakEvenFactor === null
          ? 'n/d'
          : `índice ${one.format(doubleCropBreakEvenFactor * 100)}`,
      minimumOutput:
        doubleCropBreakEvenFactor === null
          ? 'n/d'
          : `${one.format(doubleCropBreakEvenFactor * 100)}% da base conjunta`,
      minimumArea: formatMinimumArea(commonPivotAnnualNeed, doubleCrop.marginHa),
      priceBuffer:
        doubleCropBreakEvenFactor === null
          ? null
          : (1 - doubleCropBreakEvenFactor) * 100,
      competitivePoint: 'escala soja e milho juntas',
    },
  ];
  const breakEvenIdByComparison: Record<string, string> = {
    'cattle-c': 'break-even-c',
    'cattle-a': 'break-even-a',
    'cattle-b': 'break-even-b',
    'soy-irrigated': 'break-even-soy-irrigated',
    'corn-irrigated': 'break-even-corn-irrigated',
    'cotton-irrigated': 'break-even-cotton-irrigated',
    'double-crop': 'break-even-double-crop',
  };
  const leaderBreakEven = breakEvenRows.find(
    (row) => row.id === breakEvenIdByComparison[best.id],
  );
  const calculatedDecisionTitle =
    best.id === 'none-feasible'
      ? 'Nenhuma alternativa anual pôde ser calculada com as premissas informadas.'
      : allOperatingLosses
      ? 'Todas as alternativas viáveis no orçamento apresentam margem operacional não positiva. O ranking mostra a menor perda; não indica investimento aprovado.'
      : best.id === 'cattle-a'
      ? feedAllocation.ownHeads > 0
        ? 'A pecuária A apresenta a maior margem operacional anual modelada sob as premissas-base.'
        : 'A pecuária A apresenta a maior margem operacional anual modelada sob as premissas-base.'
      : best.id === 'cattle-b'
        ? 'O ciclo inteiro no pivô apresenta a maior margem operacional anual modelada sob as premissas-base.'
        : best.id === 'double-crop'
          ? 'Soja + milho apresenta a maior margem operacional anual modelada sob as premissas-base.'
          : `${best.label} apresenta a maior margem operacional anual modelada sob as premissas-base.`;
  const decisionTitle =
    scenarioMode === 'exploration'
      ? best.id === 'none-feasible'
        ? 'O exemplo ainda pede dados; use o checklist para abrir o próximo campo.'
        : `Resultado ilustrativo: ${calculatedDecisionTitle}`
      : calculatedDecisionTitle;
  const appliedPhysicalPriceCount = (
    ['cattle', 'soy-irrigated', 'corn-irrigated', 'cotton-irrigated'] as const
  ).filter((id) => appliedPriceIsValid(id)).length;
  const cropCapacityReadyCount = crops.filter((crop) =>
    singleCropCapacityReady(crop.id),
  ).length;
  const validationSteps = [
    {
      label: 'Preços, praça, data e fonte',
      detail: `${appliedPhysicalPriceCount}/4 preços físicos aptos`,
      ready: appliedPhysicalPriceCount === 4,
      tab: 'compare',
    },
    {
      label: 'Calendário e capacidade agrícola',
      detail: `${cropCapacityReadyCount}/3 culturas com capacidade básica confirmada`,
      ready: cropCapacityReadyCount > 0,
      tab: 'compare',
    },
    {
      label: 'Lote, curva, alimento e capacidade',
      detail:
        routeIntegrationReady || routeBReady
          ? `${Number(routeIntegrationReady) + Number(routeBReady)}/2 rotas pecuárias aptas`
          : animalDecisionBlocker,
      ready: routeIntegrationReady || routeBReady,
      tab: 'allocation',
    },
    {
      label: 'Alternativas anuais e limite de capital',
      detail: `${rankableComparisons.length}/${comparisons.length} no ranking · ${rankableComparisons.filter((row) => row.capitalFeasible).length}/${comparisons.length} cabem no limite`,
      ready: rankableComparisons.some((row) => row.capitalFeasible),
      tab: 'strategy',
    },
  ] as const;

  const applyFutureOpportunity = (opportunity: FutureOpportunity) => {
    if (!opportunity.isUsable) return;
    const productId: Record<FutureProduct, MarketQuote['id']> = {
      cattle: 'cattle',
      soy: 'soy-irrigated',
      corn: 'corn-irrigated',
      cotton: 'cotton-irrigated',
    };
    const id = productId[opportunity.quote.product];
    if (id === 'cattle') {
      setAssumptions((current) => ({
        ...current,
        priceArroba: opportunity.effectivePrice,
      }));
    } else {
      setCrops((current) =>
        current.map((crop) =>
          crop.id === id
            ? { ...crop, price: opportunity.effectivePrice }
            : crop,
        ),
      );
    }
    setAppliedPriceMeta((current) => ({
      ...current,
      [id]: {
        provenance: 'future-scenario',
        date: opportunity.quote.sourceDate,
        source: `Hipótese manual de curva para ${opportunity.quote.exchange} ${opportunity.quote.symbol} ${opportunity.quote.contract} · ponto ${opportunity.quote.referenceDate} · ${opportunity.executionUsable ? 'basis/carrego confirmados' : 'basis/carrego ainda não confirmados'} · URL de referência ${opportunity.quote.sourceUrl}`,
      },
    }));
    setAppliedFutureFingerprints((current) => ({
      ...current,
      [id]: futureScenarioFingerprint,
    }));
    setScenarioAuditTrail((current) => [
      ...current,
      `Preço futuro manual convertido aplicado como hipótese de cenário: ${opportunity.quote.exchange} ${opportunity.quote.symbol} ${opportunity.quote.contract}, observado ${opportunity.quote.sourceDate}, ponto ${opportunity.quote.referenceDate}, cobertura ${futureHedgePercent.toFixed(1)}%, preço efetivo ${opportunity.effectivePrice.toFixed(4)}, basis/carrego ${opportunity.executionUsable ? 'confirmados' : 'não confirmados'}, URL de referência ${opportunity.quote.sourceUrl}. Não é atribuído à bolsa como cotação automaticamente coletada; o registro físico observado foi preservado.`,
    ]);
    invalidateOperationalConfirmations();
  };

  const openAnalysisTab = (tab: string) => {
    setActiveTab(tab);
    window.setTimeout(
      () => document.getElementById('analysis-tabs')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
      0,
    );
  };

  const showReport = () => openAnalysisTab('report');
  const openEditor = (group: string, fieldLabel?: string) => {
    setEditorGroup(group);
    setMobileControlsOpen(true);
    window.setTimeout(() => {
      const field = fieldLabel ? Array.from(document.querySelectorAll<HTMLElement>('.scenario-editor [data-field-label]')).find((element) => element.dataset.fieldLabel === fieldLabel) : undefined;
      for (let ancestor = field?.parentElement; ancestor && !ancestor.classList.contains('scenario-editor'); ancestor = ancestor.parentElement) {
        if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      }
      const target = field?.querySelector<HTMLInputElement>('input') ?? document.getElementById('editor-' + group);
      target?.scrollIntoView({ block: 'start' });
      target?.focus({ preventScroll: true });
    }, 0);
  };

  const exportReport = () => {
    const quote = csvCell;
    const bridge = referenceBridge(modelAssumptions);
    const startupReports = (['A', 'B'] as const).map((route) => ({
      route, cash: cattleStartupCash(modelAssumptions, route, automaticCalendar.anchorDate, operationalInputs.setupDays, operationalInputs.setupCost),
    }));
    const lines: Array<Array<string | number>> = [
      ['BOIMETA — CENÁRIO EXPORTADO'],
      ['Versão do modelo', MODEL_VERSION],
      [
        'Modo do cenário',
        scenarioMode === 'exploration'
          ? 'DEMONSTRAÇÃO — dados ilustrativos e confirmações hipotéticas; não validado'
          : 'Validação real — sujeito aos gates e fontes informados',
      ],
      ['Data de exportação', new Date().toLocaleString('pt-BR')],
      ['Aviso', 'Ferramenta de exploração de cenários. Não substitui projeto agronômico, hidráulico, zootécnico, tributário, jurídico ou de crédito.'],
      ['Uso de dados de mercado', 'Referências públicas com atribuição. Confirme direitos de reutilização antes de uso comercial ou redistribuição.'],
      ['RADAR DE MERCADO', 'conab-weekly-v1 · descritivo; não extrapola preços. CONAB semanal por UF, fonte: https://consultaprecosdemercado.conab.gov.br/'],
      ['UF', marketUf, 'Data da análise', asOfDate],
      ['Produto', 'Unidade', 'UF', 'Descrição', 'Data observada', 'Preço CONAB'],
      ...marketEvidence.filter(q => q.uf === marketUf).map(q => [q.product, q.displayUnit, q.uf, q.description, q.sourceDate, q.value]),
      ['DIAGNÓSTICO MARGINAL', 'Não inclui novo CAPEX ou novo capital de giro'],
      ['Milho entregue A = B (R$/sc)', capacityDiagnostics.cornIndifference ?? 'sem empate não negativo'],
      ['Cocho nominal para potencial alimentar', capacityDiagnostics.neededCapacity ?? 'n/d'],
      ['Área não utilizada pelo fluxo terminado (ha)', capacityDiagnostics.unusedFlowArea],
      ['MESMO CAPITAL · margem anual de regime pleno · não é lucro líquido'],
      ['Orçamento (R$)', decisionLabInput.budget, 'Área disponível (ha)', assumptions.totalArea],
      ['Método', 'Alternativas exclusivas. Busca discreta em hectares inteiros e saturação do cocho; não ótimo global. CAPEX/reserva mantidos; arrendamento ocioso pago. Não operar é alternativa, com arrendamento conhecido.'],
      ['Rota', 'Área inteira: capital (R$)', 'Máximo financiável (ha)', 'Área de maior margem testada (ha)', 'Margem anual (R$)', 'Capital exigido (R$)', 'Caixa livre (R$)', 'Melhor operação testada: margem, mesmo se negativa (R$)'],
      ...capitalStudy(decisionLabInput).rows.map(r => [r.id, r.full.capital, r.maximumArea, r.best.area, r.best.margin, r.best.capital, r.spareCash, r.bestOperating?.margin ?? 'sem operação financiável']),
      ['INVERSA · mesma verba da pecuária · área equivalente não significa terra disponível'],
      ...(['cattle-a', 'cattle-b', 'cattle-c'] as const).flatMap(id => { const study = inverseCropCapital(decisionLabInput, id); return study.rows.map(r => [id, study.reference.capital, r.id, r.equivalentArea ?? 'n/d', r.local.area, r.local.margin, r.local.capital]); }),
      ['LOTAÇÃO · por hectare de PASTO, não de área total; UA = 450 kg vivos'],
      ['Intensificação adicional (R$/ha pasto/ano antes do fator)', assumptions.pastureExtraCostHa ?? 0],
      ['UA desejada', 'UA aplicada', 'UA no pasto A', 'UA pasto A/ha total', 'A vendidos/ano', 'A margem anual', 'B margem anual', 'C margem anual', 'Silagem: melhor % testado'],
      ...stockingStudy(decisionLabInput).map(r => [r.desired, r.applied, r.pastureUaA, r.pastureUaPerTotalArea, r.rows[0].sold, ...r.rows.map(x => x.margin), r.balancedShare]),
      ['ALAVANCAS · uma alteração por vez · efeitos não somáveis · consumo/custos adicionais não presumidos'],
      ['Rota', 'Teste', 'Valor', 'Unidade', 'Efeito na margem (R$/ano)', 'Nova margem (R$/ano)', 'Capital requerido (R$)', 'Limite'],
      ...enterpriseIds.flatMap(id => (['improve', 'pressure'] as const).flatMap(direction => marginLevers(decisionLabInput, id, direction).rows.map(r => [id, r.label, r.value, r.unit, r.delta, r.result.margin, r.result.capital, r.warning]))),
      ['CONFINAMENTO · melhor divisão testada de 5 a 80% a cada 0,1 p.p.; mesma capacidade; não é projeto'],
      ...(() => { const f = feedlotTurningPoints(decisionLabInput); return [['Silagem %', f.silageShare, 'Margem anual A', f.balanced.margin, 'Capital A', f.balanced.capital], ...f.comparisons.map(r => ['A versus', r.id, 'Diferença anual', r.difference, 'Preço boi empate (não previsão)', r.price ?? 'n/d', 'A melhora', r.direction])]; })(),
      ['RECRIA C · venda líquida em kg vivo · sem cocho/silagem/matrizes'],
      ['Preço líquido do magro (R$/kg)', animalTimelineInputs.gateValuePerKgLive],
      ['Fonte do magro', gateAppliedPriceMeta.source, 'Data-base informada', animalTimelineInputs.gateSourceDate || 'hipótese sem data'],
      ['Dias de recria', rearing.days, 'Mortes no modelo anual (%)', 0.2],
      ['Entradas/ano', rearing.entrants, 'Vendas/ano', rearing.sold, 'Giro equivalente', rearing.cycles],
      ['Receita C', rearing.revenue, 'Custo C', rearing.costs, 'Margem anual C', rearing.margin],
      ['Equilíbrio C (R$/kg líquido)', rearing.breakEvenPriceKg ?? 'n/d'],
      ['Pico de caixa C', rearingCash?.peakFundingNeed ?? 'n/d', 'Saldo ano 1 C', rearingCash?.netCash ?? 'n/d', 'Estoque vivo C', rearingCash?.closingHeads ?? 'n/d'],
      ['VPL anual de triagem A−B', result.operationalNpv, 'CAPEX incremental novo', assumptions.investment],
      ['VARREDURA DE ÁREA · CAPEX/vagas fixos · não é limiar universal', 'Área', 'Margem A', 'Margem B', 'A−B', 'VPL A−B', 'Gargalo'],
      ...areaResponses.map(row => ['', row.area, row.marginA, row.marginB, row.delta, row.npv, row.bottleneck]),
      ['Exportação', 'Objetivo comercial; sem prêmio ou ajuste automático de preços; elegibilidade não certificada'],
      ['Definição financeira', 'EBITDA e margem são indicadores operacionais modelados; não equivalem a DRE contábil, fluxo do acionista ou recomendação de investimento.'],
      ['TRILHA DE OVERRIDES DO CENÁRIO', scenarioAuditTrail.length ? scenarioAuditTrail.join(' | ') : 'nenhum choque rápido ou preço futuro aplicado nesta sessão'],
      ['Área total (ha)', assumptions.totalArea],
      ['Marco temporal único · entrada do gado', automaticCalendar.anchorDate],
      ['Janela operacional de referência (dias)', automaticCalendar.horizonDays],
      ['Fim da janela operacional de referência', automaticCalendar.horizonEndDate],
      ['Calendário usa fallback de data', automaticCalendarUsesFallback ? 'sim; corrigir a entrada do gado' : 'não'],
      ['Convenção do ranking', 'Margem operacional anual em regime pleno; a janela operacional não proporcionaliza nem reconhece fração da margem agrícola'],
      ['Município assumido para regras agrícolas', automaticCalendar.location],
      ['Arrendamento (R$/ha/ano)', assumptions.landLeaseHa],
      ['CAPEX comum do pivô (R$)', assumptions.pivotInvestment],
      ['Investimento incremental A (R$)', assumptions.investment],
      ['TMA (% a.a.)', assumptions.discountRate],
      ['Horizonte (anos)', assumptions.horizon],
      ['Limite compartilhado de capital (R$)', strategyCapitalLimit],
      ['Reserva intocável (R$)', operationalInputs.reserveCash],
      ['Implantação adicional (R$)', operationalInputs.setupCost],
      ['Dias até iniciar a operação', operationalInputs.setupDays],
      ['Nome do estudo', reviewInputs.studyName],
      ['CONCILIAÇÃO DA REFERÊNCIA', 'R$/ha total/ano', 'Variação R$/ha'],
      ['32.261 por ha de pasto, convertido por 300/400', bridge.normalizedCashHa],
      ['30.010 por ha de pasto, convertido por 300/400', bridge.normalizedAccrualHa],
      ['Divergência não conciliada entre fotos (R$)', bridge.sourceUnreconciled],
      ...bridge.rows.map((row) => [row.label, row.value, row.delta]),
      ['PRIMEIRO ANO · início vazio', 'Cabeças compradas', 'Cabeças vendidas', 'Cabeças não vendidas', 'Pico de capital R$', 'Caixa final R$'],
      ...startupReports.flatMap(({ route, cash }) => cash ? [[route, cash.boughtHeads, cash.salesHeads, cash.closingHeads, cash.peakFundingNeed, cash.endingCash]] : []),
      ['Nota do primeiro ano', startupReports[0].cash?.note ?? 'data inválida'],
      ['CAIXA PRIMEIRO ANO', 'Mês', 'Recebimentos', 'Pagamentos', 'Líquido', 'Acumulado'],
      ...startupReports.flatMap(({ route, cash }) => cash?.rows.map((row) => [route, row.month, row.inflow, row.outflow, row.net, row.cumulative]) ?? []),
      ['PREMISSAS DA AUDITORIA', 'Valor informado; zero pode significar não medido'],
      ...Object.entries(reviewInputs).map(([key, value]) => [key, Array.isArray(value) ? value.join(' | ') : value]),
      ['EFLUENTE · benefício limitado R$', effluentScale.avoidedFertilizerCost],
      ['EFLUENTE · custo tratamento/aplicação R$', effluentScale.operatingCost],
      ['EFLUENTE · líquido hipotético R$', effluentScale.netPotentialCredit],
      ['OPERACIONAL · parâmetros adicionais', 'Valor'],
      ...Object.entries(operationalInputs).map(([key, value]) => [key, value]),
      [],
      ['DADOS, LATÊNCIA E LICENÇA', 'Estado'],
      ['CONAB · preços físicos', 'Consulta semanal sob demanda por UF; não intradiária'],
      ['B3 / ICE · futuros', 'Curva manual datada; feed de produção depende de contratação e licença'],
      ['IBGE / USDA / Conab · fundamentos', 'Snapshots oficiais mensais ou trimestrais; realizado, estimativa e projeção separados'],
      ['Notícias e eventos', 'Camada automática ainda não habilitada; notícia não altera preço sem modelo validado e backtest'],
      [],
      ['CICLO ANIMAL DATADO', 'Valor'],
      ['Data de entrada', animalTimelineInputs.entryDate],
      ['Convenção das arrobas informadas', animalTimelineInputs.liveEquivalent ? '@ vivo-equivalente = 30 kg vivos' : '@ de carcaça = 15 kg ÷ rendimento'],
      ['Peso vivo de entrada (kg)', timelineEntryWeight],
      ['Custo econômico de entrada A (R$/kg vivo)', timelineEntryCostHead / Math.max(timelineEntryWeight, 1)],
      ['Data-base do preço de entrada efetivo', timelineEntrySourceDate || 'sem data'],
      ['Fonte do preço de entrada efetivo', timelineEntrySource || 'sem fonte'],
      ['Custo econômico de entrada A (R$/cab)', timelineEntryCostHead],
      ['Desembolso caixa de entrada A (R$/cab)', timelineEntryCashCostHead],
      ['Custo econômico de entrada B (R$/cab)', timelineEntryCostHeadB],
      ['Desembolso caixa de entrada B (R$/cab)', timelineEntryCashCostHeadB],
      ['Entrada vinculada ao modelo cria/compra', animalTimelineInputs.linkEntryCostToReplacement ? 'sim' : 'não'],
      ['Data-base do preço de entrada válida', entryPriceSourceValid ? 'sim' : 'não; preencha para calcular a margem desde a entrada'],
      ['Peso vivo da decisão (kg)', timelineDecisionWeight],
      ['Data projetada da decisão', animalTimeline.decisionDate],
      ['Dias entrada → decisão', animalTimeline.entryToDecisionDays],
      ['Preço do boi magro na decisão (R$/kg vivo)', animalTimelineInputs.gateValuePerKgLive],
      ['Data-alvo do preço-cenário do boi magro', animalTimelineInputs.gateValuationDate || 'sem data'],
      ['Data-base do preço-cenário do boi magro', animalTimelineInputs.gateSourceDate || 'sem data'],
      ['Proveniência aplicada do boi magro', gateAppliedPriceMeta.provenance],
      ['Fonte-base/transformação do boi magro', gateAppliedPriceMeta.source],
      ['Fonte aplicada do boi magro válida', gateAppliedSourceValid ? 'sim' : 'não'],
      ['Data de corte do simulador', asOfDate],
      ['Idade da fonte do preço-cenário (dias)', animalTimeline.sourceAgeDays ?? 'n/d'],
      ['Horizonte do preço-cenário (dias)', animalTimeline.forecastHorizonDays ?? 'n/d'],
      ['Idade do snapshot BGI mais novo (dias)', animalTimeline.curveSnapshotAgeDays ?? 'n/d'],
      ['Datas-base BGI válidas', animalTimeline.curveSourceValid ? 'sim' : 'não'],
      ['Valor do boi magro na decisão (R$/cab)', animalTimeline.gateValueHead],
      ['Melhor rota calculada', animalTimeline.bestRoute?.label ?? 'dados de mercado insuficientes'],
      ['Estado da comparação', animalTimeline.comparisonStatus === 'comparable' ? 'ao menos uma rota terminada coberta' : animalDecisionBlocker],
      ['Erros de entrada', animalTimeline.inputErrors.join(' | ') || 'nenhum'],
      ['Nota do boi magro', 'Preço manual/local e separado do BGI. Exige série própria por praça, categoria e data; não é previsão automática nesta versão.'],
      [],
      ['CONFIRMAÇÕES OPERACIONAIS', 'Estado'],
      ['Fórmula da dieta confirmada', allocationInputs.dietFormulaConfirmed ? 'sim' : 'não'],
      ['Disponibilidade física dos alimentos confirmada', allocationInputs.feedAvailabilityConfirmed ? 'sim' : 'não'],
      ['Pico de capacidade do cocho confirmado', allocationInputs.peakCapacityConfirmed ? 'sim' : 'não'],
      ['Calendário anual de coortes confirmado', allocationInputs.annualCalendarConfirmed ? 'sim' : 'não'],
      ['Pasto irrigado · água, energia, forragem e lotação confirmados', allocationInputs.pastureWaterForageConfirmed ? 'sim' : 'não'],
      ['Janela das vacas de oportunidade confirmada', allocationInputs.cowOpportunityWindowConfirmed ? 'sim' : 'não'],
      ['Fonte/data da compra e venda das vacas válidas', cowOpportunityPricesValid ? 'sim' : 'não'],
      ['Compra da vaca · data/fonte', `${allocationInputs.cowBuyQuoteDate || 'sem data'} · ${allocationInputs.cowBuyQuoteSource || 'sem fonte'}`],
      ['Venda da vaca · data/fonte', `${allocationInputs.cowSaleQuoteDate || 'sem data'} · ${allocationInputs.cowSaleQuoteSource || 'sem fonte'}`],
      ['Período medido do módulo de efluente confirmado', allocationInputs.effluentCalibrationPeriodConfirmed ? 'sim' : 'não'],
      ['Fonte da calibração do efluente', effluentScale.calibrationSource || 'sem fonte'],
      ['Período medido da calibração', `${effluentScale.calibrationPeriodStart || 'sem início'} a ${effluentScale.calibrationPeriodEnd || 'sem fim'}`],
      ['Fonte/data do valor evitável do efluente', `${effluentScale.valueSource || 'sem fonte'} · ${effluentScale.valueDate || 'sem data'}`],
      ['Tratamento, análise, eficiência e requisitos aplicáveis confirmados', allocationInputs.effluentCreditConfirmed ? 'sim' : 'não'],
      ['Rota/capacidade do excedente confirmadas', allocationInputs.effluentExcessDestinationConfirmed ? 'sim' : 'não'],
      ['Regra de invalidação', 'Qualquer alteração em lote, preço, dieta, alimento, capacidade, capital ou calendário desmarca as confirmações relacionadas.'],
      [],
      ['EFLUENTE · ESCALA DO MÓDULO-BASE', 'Valor'],
      ['Área/lâmina anual do módulo-base', `${effluentScale.referenceAreaHa} ha × ${effluentScale.referenceDepthMm} mm/ano`],
      ['Volume do módulo-base (m³)', effluentScale.referenceVolumeM3],
      ['Animais/dias do módulo-base', `${effluentScale.referenceAnnualHeads} cab × ${effluentScale.referenceConfinementDays} dias`],
      ['Volume calibrado (L/cabeça-dia)', effluentScale.volumePerHeadDayM3 * 1_000],
      ['Volume por animal no ciclo-base (m³/cab)', effluentVolumePerFinishedHeadM3],
      ['Área por animal no ciclo-base (ha/cab)', effluentAreaPerFinishedHeadHa],
      ['Economia bruta por animal no ciclo-base (R$/cab)', effluentCreditPerFinishedHead],
      ['Cabeças-dia próprias roteadas', effluentScale.currentOwnFeedlotHeadDays],
      ['Volume disponível escalado (m³)', effluentScale.availableVolumeM3],
      ['Área/lâmina-alvo anual', `${effluentScale.targetAreaHa} ha × ${assumptions.effluentDepthMm} mm/ano`],
      ['Volume requerido na área-alvo (m³)', effluentScale.requiredVolumeM3],
      ['Área coberta na lâmina-alvo (ha)', effluentScale.areaCoveredAtTargetDepthHa],
      ['Área potencial antes do limite da área-alvo (ha)', effluentScale.potentialAreaAtTargetDepthHa],
      ['Lâmina ao distribuir em toda área-alvo (mm)', effluentScale.depthAcrossTargetAreaMm],
      ['Cobertura da área-alvo (%)', effluentScale.coveragePercent],
      ['Volume excedente à área-alvo (m³)', effluentScale.volumeExcessM3],
      ['Destino operacional do excedente', effluentScale.excessDestination || 'não informado'],
      ['Capacidade anual validada do destino (m³/ano)', effluentScale.excessDestinationCapacityM3],
      ['Excedente operacionalmente fechado', effluentScale.excessDestinationReady ? 'sim' : 'não'],
      ['Módulos necessários', effluentScale.requiredReferenceModules ?? 'n/d'],
      ['Animais/ano necessários na permanência-base', effluentScale.requiredAnnualHeadsAtReferenceStay ?? 'n/d'],
      ['Capacidade nominal indicativa (vagas)', requiredNominalFeedlotCapacity ?? 'n/d'],
      ['Economia bruta suportada pelo volume (R$)', effluentScale.grossPotentialCredit],
      ['Crédito incluído uma única vez na rota A (R$)', effluentScale.includedCredit],
      ['Aviso da calibração', 'Coeficiente derivado do módulo-base do projeto; substituir por medição de volume tratado e análise agronômica antes de decisão real.'],
      [],
      ['ROTAS DO LOTE POR DATA', 'Saída', 'Dias após decisão', 'Peso vivo de saída', 'Contrato(s)', 'Cobertura', 'Preço projetado R$/@', 'Receita líquida R$/cab', 'Custo + ajuste temporal R$/cab', 'Δ em VP vs vender magro R$/cab', 'Margem em VP desde entrada R$/cab'],
      ...animalTimeline.ranking.map((route) => [
        route.label,
        route.exitDate,
        route.daysAfterDecision,
        route.exitLiveWeight,
        route.contracts,
        route.curveCoverage,
        route.projectedPrice ?? 'não calculado',
        route.netRevenueHead ?? 'não calculada',
        route.routeCostHead + route.carryCostHead,
        route.incrementalVsSellGate ?? 'aguarda preço e data',
        route.marginFromEntry ?? 'não calculada',
      ]),
      ['Aviso BGI', 'BGI referencia boi gordo padrão e não cota automaticamente boi magro. Rotas fora da curva pedem preço e data próprios; não há extrapolação silenciosa.'],
      [],
      ['RANKING ECONÔMICO ANUAL · IRRESTRITO POR CAPITAL', 'Receita líquida modelada', 'Custo operacional comparável', 'Margem operacional anual', 'Margem/ha', 'Margem operacional ÷ custo operacional', 'Funding/custeio indicativo', 'Cabe no limite informado', 'Nível de evidência', 'Alerta de execução', 'Equilíbrio'],
      ...ranking.map((row) => [row.label, row.revenue, row.cost, row.margin, row.marginHa, row.roi, row.capitalRequired, row.capitalFeasible ? 'sim' : 'não', row.evidenceLevel, row.warning ?? 'nenhum', row.breakEven]),
      ['ALERTAS DE EXECUÇÃO POR ALTERNATIVA', 'Alerta', 'Funding/custeio indicativo'],
      ...comparisons.filter((row) => row.warning || row.blocker).map((row) => [row.label, row.blocker ?? row.warning ?? 'nenhum', row.capitalRequired]),
      ['Nota do ranking', 'Ranking anual em regime pleno, sem restrição de capital. Deduções comerciais agrícolas são apresentadas reduzindo a receita; a margem não muda. Pecuária usa giro aproximado; lavoura usa custeio anual. Funding não é pico de caixa comparável. Compra de terra, CAPEX comum, impostos, financiamento e cronograma mensal permanecem fora.'],
      [],
      ['FINANCEIRO INTEGRADO A × B', 'Valor'],
      ['Comparação pronta', integratedFinancialReady ? 'sim' : 'não'],
      ['Margem anual A integrada (R$)', routeIntegrationReady ? integratedRouteMarginA : 'aguarda pré-requisitos'],
      ['Margem anual B direta + milho comum (R$)', routeBReady ? routeBSystemMargin : 'aguarda pré-requisitos'],
      ['Margem incremental A − B (R$/ano)', integratedFinancialReady ? integratedIncrementalMargin : 'aguarda A e B'],
      ['Capital de giro A (R$)', integratedWorkingCapitalA],
      ['Capital de giro B (R$)', integratedWorkingCapitalB],
      ['Capital incremental A − B (R$)', integratedIncrementalWorkingCapital],
      ['CAPEX incremental A (R$)', assumptions.investment],
      ['VPL operacional incremental (R$)', integratedOperationalNpv ?? 'aguarda A e B'],
      ['TIR operacional incremental (%)', integratedOperationalIrr ?? 'aguarda A e B'],
      ['Payback simples incremental (anos)', integratedSimplePayback ?? 'não fecha'],
      ['Limite indicativo de CAPEX incremental (R$)', integratedMaxInvestment ?? 'aguarda A e B'],
      ['Fluxos anuais t0..terminal (R$)', integratedCashFlows.join(' | ') || 'aguardam A e B'],
      ['Nota financeira', 'Capital de giro entra em t0 e é recuperado no terminal. Fluxo antes de impostos, financiamento e cronograma mensal.'],
      [],
      ['PONTOS DE EQUILÍBRIO', 'Preço usado no cenário', 'Margem zero', 'Produção mínima', 'Área mínima', 'Folga de preço', 'Ponto competitivo'],
      ...breakEvenRows.map((row) => [row.label, row.currentPrice, row.zeroMargin, row.minimumOutput, row.minimumArea, row.priceBuffer ?? 'n/d', row.competitivePoint]),
      [],
      ['PREMISSAS PECUÁRIAS', 'Valor'],
      ['Arroba do boi (R$/@)', assumptions.priceArroba],
      ['Bezerro 240 kg (R$/cab)', assumptions.calfCost],
      ['Lotação (UA/ha)', assumptions.stockingUa],
      ['Lotação efetiva no motor (UA/ha)', modelAssumptions.stockingUa],
      ['Teto local de forragem (UA/ha)', localPasture.supportUa ?? 'não informado'],
      ['Mortalidade no pasto (%)', animalTimelineInputs.pastureMortality],
      ['Mortalidade no cocho (%)', allocationInputs.feedlotMortality],
      ['Área de silagem (%)', assumptions.silageShare],
      ['GMD recria A (kg/dia)', assumptions.gmdPivotA],
      ['GMD confinamento (kg/dia)', assumptions.gmdFeedlot],
      ['Rendimento de carcaça a pasto (%)', modelAssumptions.carcassYieldPercent],
      ['Prêmio de rendimento no confinamento (p.p.)', assumptions.feedlotCarcassYieldLiftPercent],
      ['Vacas de oportunidade incluídas', assumptions.includeCows ? 'sim' : 'não'],
      ['Dieta efetiva (R$/kg MS)', modelAssumptions.dietPriceDm],
      ['Dieta ligada aos custos locais', assumptions.linkFeedToCropCosts ? 'sim' : 'não'],
      ['Produtividade da silagem por corte (t MS/ha)', assumptions.silageYieldDm],
      ['Custo da silagem por corte (R$/ha)', assumptions.silageCostHaCut],
      ['Cortes de silagem por ano', assumptions.silageCrops],
      ['Recuperação da silagem (%)', assumptions.silageRecovery],
      ['Silagem local (R$/kg MS)', silageCostDm],
      ['Milho local/de reposição — custo caixa (R$/kg MS)', cornGrainCashCostDm],
      ['Milho — custo de oportunidade líquido, após deduções evitáveis (R$/kg MS)', cornGrainOpportunityCostDm],
      ['Base de valoração do milho', assumptions.feedUseOpportunityCost ? 'preço líquido após deduções evitáveis; fixos já incorridos não reduzem o custo de oportunidade' : 'custo caixa local'],
      ['Núcleo, mistura e perdas (R$/kg MS)', assumptions.dietOtherCostDm],
      ['Demanda roteada de milho-grão (t MS)', feedAllocation.grainDemandSacks * 60 * 0.88 / 1_000],
      ['Demanda roteada de milho-grão (sacas)', feedAllocation.grainDemandSacks],
      ['Área de milho-grão explicitamente vinculada (ha)', linkedGrainAreaHa],
      ['Footprint econômico integrado (ha)', integratedSystemFootprintA],
      ['Nota de área', 'A área-base fecha pasto e silagem; todo hectare de milho-grão próprio é somado ao footprint. Silagem excedente permanece estoque sem receita até existir venda física contratada.'],
      [],
      ['FUNIL DO REBANHO', 'Valor'],
      ['Candidatos anuais após recria (cab)', result.pastureCandidatesA],
      ['Capacidade instantânea (UA)', herdFlow.totalUaCapacity],
      ['Peso médio para conversão (kg/cab)', herdFlowInputs.averageStockWeight],
      ['Cabeças simultâneas equivalentes', herdFlow.simultaneousHeads],
      ['Abastecimento próprio (%)', herdFlowInputs.selfSupplyPercent],
      ['Prenhez sobre matrizes expostas (%)', herdFlowInputs.pregnancyRate],
      ['Perda prenhez → nascimento (% das prenhes)', herdFlowInputs.pregnancyToBirthLoss],
      ['Mortalidade nascimento → desmama (% dos nascidos)', herdFlowInputs.preWeaningMortality],
      ['Mortalidade pós-desmama (%)', herdFlowInputs.postWeaningMortality],
      ['Reposição (% das matrizes)', herdFlowInputs.replacementRate],
      ['Taxa de desmama resultante (%)', herdFlow.weaningRate * 100],
      ['Matrizes expostas necessárias', herdFlow.matricesRequired],
      ['Área equivalente da cria (ha)', herdFlow.breedingAreaEquivalent],
      ['Novilhas necessárias', herdFlow.replacementNeed],
      ['Novilhas disponíveis', herdFlow.replacementHeifersAvailable],
      ['Déficit de reposição', herdFlow.replacementGap],
      ['Compras externas planejadas (cab)', herdFlow.purchasedEntrants],
      [],
      ['ECONOMIA DA CRIA E REPOSIÇÃO', 'Valor'],
      ['Modelo da cria pronto', breedingEconomics.modelReady ? 'sim' : `não: ${breedingEconomics.errors.join(' | ')}`],
      ['Preço entregue do bezerro comprado (R$/cab)', breedingEconomics.purchaseLandedCostHead],
      ['Data-base do bezerro comprado', breedingEconomicsInputs.calfPriceSourceDate || 'sem data'],
      ['Fonte do bezerro comprado', breedingEconomicsInputs.calfPriceSource || 'sem fonte'],
      ['Ágio do bezerro vs boi vivo-equivalente (%)', breedingEconomics.calfPremiumPercent ?? 'n/d'],
      ['Teto a jusante A válido', downstreamCeilingValid ? 'sim' : 'não'],
      ['Teto econômico A da reposição (R$/cab)', downstreamCeilingValid ? breedingEconomics.downstreamMaximumPurchasePriceHead : 'aguarda dados a jusante'],
      ['Teto a jusante B válido', downstreamCeilingValidB ? 'sim' : 'não'],
      ['Teto econômico B da reposição (R$/cab)', downstreamCeilingValidB ? breedingEconomicsB.downstreamMaximumPurchasePriceHead : 'aguarda dados a jusante'],
      ['Origem recomendada cobre A integralmente', breedingEconomics.recommendedSupplyCloses === null ? 'aguarda custos e teto' : breedingEconomics.recommendedSupplyCloses ? 'sim' : 'não'],
      ['Déficit de origem recomendada A (cab/ano)', replacementSupplyShortfallA],
      ['Origem recomendada cobre B integralmente', breedingEconomicsB.recommendedSupplyCloses === null ? 'aguarda custos e teto' : breedingEconomicsB.recommendedSupplyCloses ? 'sim' : 'não'],
      ['Déficit de origem recomendada B (cab/ano)', replacementSupplyShortfallB],
      ['Custo caixa do bezerro próprio (R$/cab)', breedingEconomics.ownCalfCashCostHead ?? 'aguarda custos'],
      ['Custo econômico do bezerro próprio (R$/cab)', breedingEconomics.ownCalfEconomicCostHead ?? 'aguarda custos'],
      ['Custo econômico blended aplicado (R$/cab)', effectiveReplacementCostHead],
      ['Custo caixa blended A aplicado (R$/cab)', effectiveReplacementCashCostHead],
      ['Custo econômico blended B aplicado (R$/cab)', effectiveReplacementCostHeadB],
      ['Custo caixa blended B aplicado (R$/cab)', effectiveReplacementCashCostHeadB],
      ['Matrizes máximas por área e capital', breedingEconomics.maxMatrices],
      ['Entradas próprias economicamente recomendadas/ano', breedingEconomics.recommendedOwnEntrants ?? 'aguarda validação'],
      ['Entradas compradas recomendadas/ano', breedingEconomics.recommendedPurchasedEntrants ?? 'aguarda validação'],
      ['Capital inicial em novas matrizes (R$)', breedingEconomics.initialMatrixCapital],
      ['Vantagem econômica anual da cria própria (R$)', breedingEconomics.annualEconomicAdvantage ?? 'aguarda validação'],
      ['Payback simples da expansão (anos)', breedingEconomics.paybackYears ?? 'não fecha'],
      ['Data-base da novilha de reposição', breedingEconomicsInputs.replacementHeiferPriceSourceDate || 'sem data'],
      ['Fonte da novilha de reposição', breedingEconomicsInputs.replacementHeiferPriceSource || 'sem fonte'],
      [],
      ['ROTEAMENTO DOS LOTES', 'GMD recria kg/d', 'GMD cocho kg/d', 'CMS kg MS/d', 'Conversão kg MS/kg ganho', 'Participação %', 'Entrada do cocho', 'Saída do cocho', 'Cabeças candidatas', 'Dias no cocho', 'Margem próprio vs vender R$/cab', 'Preço máximo teórico do milho R$/sc', 'Próprio', 'Venda antecipada'],
      ...feedAllocation.lots.map((lot) => [lot.label, lot.pastureGmd ?? 'n/d', lot.gmd, lot.dailyDmKg, lot.feedConversionDm, lot.normalizedShare * 100, lot.entryDate ?? lot.entryWeek ?? 'não informada', lot.exitDate ?? lot.exitWeek ?? 'não informada', lot.heads, lot.days, lot.ownMarginHead, lot.shadowGrainPriceSack, lot.ownHeads, lot.sellHeads]),
      ['GMD equilíbrio próprio vs vender (kg/d)', feedAllocation.thresholdOwnVsSell ?? 'n/d'],
      ['Vaga-dias usados', feedAllocation.penDaysUsed],
      ['Vaga-dias disponíveis', feedAllocation.penDaysCapacity],
      ['Modo do calendário do cocho', feedAllocation.calendarMode],
      ['Pico calculado de cabeças próprias', feedAllocation.concurrentOwnHeads],
      ['Pendências do calendário', feedAllocation.calendarIssues.join(' | ') || 'nenhuma'],
      ...feedAllocation.temporalOccupancy.map((period) => [`Ocupação própria · ${period.period}`, period.ownHeads]),
      ['Vagas físicas ajustadas por utilização', feedAllocation.concurrentOwnCapacity],
      ['Margem incremental das rotas (R$/ano)', feedAllocation.totalIncrementalMargin],
      ['Capital pré-gate A (R$)', preGateCapitalA],
      ['Capital pós-gate usado A (R$)', feedAllocation.workingCapitalUsed],
      ['Capital total requerido A (giro + CAPEX incremental) (R$)', integratedCapitalA],
      ['Capital A viável no limite', capitalFeasibleA ? 'sim' : 'não'],
      ['Capital total requerido B (R$)', integratedWorkingCapitalB],
      ['Capital B viável no limite', capitalFeasibleB ? 'sim' : 'não'],
      [],
      ['ALOCAÇÃO DE ALIMENTO', 'Valor'],
      ['Área de milho-grão a montante (ha)', allocationInputs.grainAreaHa],
      ['Milho produzido (sc)', feedAllocation.grainProducedSacks],
      ['Milho consumido no cocho próprio (sc)', feedAllocation.grainDemandSacks],
      ['Milho próprio consumido (sc)', feedAllocation.ownGrainUsedSacks],
      ['Milho comprado (sc)', feedAllocation.purchasedGrainSacks],
      ['Milho vendido (sc)', feedAllocation.soldGrainSacks],
      ['Preço líquido evitável da venda (R$/sc)', cornRetainedPrice],
      ['Preço de indiferença médio do milho nos lotes usados (R$/sc)', feedAllocation.weightedShadowGrain],
      ['Spread diagnóstico dos lotes alocados (R$)', feedAllocation.allocationValueVsSell],
      ['Silagem consumida (t MS)', feedAllocation.silageDemandDmKg / 1_000],
      ['Silagem produzida (t MS)', linkedSilageProducedDmKg / 1_000],
      ['Silagem própria efetivamente consumida (t MS)', linkedSilageConsumedDmKg / 1_000],
      ['Crédito interno da silagem própria em VP (R$)', feedAllocation.ownSilageTransferPresentValue],
      ['Silagem comprada (t MS)', feedAllocation.purchasedSilageDmKg / 1_000],
      ['Estoque final de silagem sem receita (t MS)', linkedSilageEndingStockDmKg / 1_000],
      ['Receita reconhecida para silagem excedente', 0],
      ['Contribuição marginal do ha de grão (R$/ha)', feedAllocation.grainContributionHa],
      ['Valoração indicativa do ha de silagem ao break-even médio (R$/ha)', feedAllocation.silageContributionHa],
      ['Compra externa permitida', allocationInputs.allowPurchasedFeed ? 'sim' : 'não'],
      ['Nota de alocação', `O LP otimiza rotas conjuntamente e ${feedAllocation.calendarMode === 'legacy-conservative' ? 'impõe pico conservador porque as janelas de todos os lotes não foram preenchidas' : 'impõe capacidade em cada semana informada'}. A nova camada operacional reconcilia colheita, consumo e estoque por semana, dimensiona fábrica e caixa agrícola por mês; disponibilidade da silagem, orçamento civil, caixa pecuário consolidado e chamada de margem permanecem validações externas. O estoque final de silagem não gera receita.`],
      [],
      ['CAPACIDADE OPERACIONAL', 'Valor', 'Unidade/estado'],
      ['Dias úteis de plantio', operationalInputs.usablePlantDays, 'hipótese de planejamento editável'],
      ['Taxa requerida de plantio', planningPlantRate.requiredRateHaDay, 'ha/dia'],
      ['Taxa informada de plantio', operationalInputs.informedPlantRateHaDay || 'não informada', 'ha/dia'],
      ['Plantio cabe na janela útil', planningPlantRate.informed ? planningPlantRate.fits ? 'sim' : 'não' : 'aguarda taxa'],
      ['Dias úteis de colheita', operationalInputs.usableHarvestDays, 'hipótese de planejamento editável'],
      ['Taxa requerida de colheita', planningHarvestRate.requiredRateHaDay, 'ha/dia'],
      ['Taxa informada de colheita', operationalInputs.informedHarvestRateHaDay || 'não informada', 'ha/dia'],
      ['Colheita cabe na janela útil', planningHarvestRate.informed ? planningHarvestRate.fits ? 'sim' : 'não' : 'aguarda taxa'],
      [],
      ['ESTOQUE SEMANAL DE ALIMENTO', 'Valor'],
      ['Modo da coorte', feedPlanUsesIndicativeCohort ? 'pré-dimensionamento pelas vagas úteis' : 'rota econômica atual'],
      ['Milho comprado por desencontro temporal (sc)', weeklyFeedPlan.timingMismatchGrainSacks],
      ['Estoque inicial de silagem informado (t MS)', weeklyFeedPlan.openingSilageDmKg / 1_000],
      ['Pico de estoque de milho (t físicas)', weeklyFeedPlan.peakGrainStockSacks * 0.06],
      ['Pico de estoque de silagem (t MS)', weeklyFeedPlan.peakSilageStockDmKg / 1_000],
      ['Pico de fábrica/distribuição (t MS/dia)', weeklyFeedPlan.peakWeeklyDmKg / 7_000],
      ['SEMANA', 'RECEBIMENTO MILHO SC', 'CONSUMO MILHO SC', 'COMPRA MILHO SC', 'DÉFICIT MILHO SC', 'ESTOQUE MILHO SC', 'CONSUMO SILAGEM KG MS', 'COMPRA SILAGEM KG MS', 'DÉFICIT SILAGEM KG MS', 'ESTOQUE SILAGEM KG MS', 'CONSUMO TOTAL KG MS', 'RECEBIMENTO SILAGEM KG MS'],
      ...weeklyFeedPlan.rows.map((row) => [row.weekStart, row.grainReceiptSacks, row.grainConsumptionSacks, row.grainPurchaseSacks, row.grainShortageSacks, row.grainEndingSacks, row.silageConsumptionDmKg, row.silagePurchaseDmKg, row.silageShortageDmKg, row.silageEndingDmKg, row.totalDmConsumptionKg, row.silageReceiptDmKg]),
      [],
      ['CAIXA AGRÍCOLA MENSAL', 'Pico de capital', 'Mês do pico', 'Caixa final'],
      ...operationalCashComparisons.map((item) => [item.label, item.cash.peakFundingNeed, item.cash.peakFundingMonth || 'n/d', item.cash.endingCash]),
      ['MOVIMENTOS MENSAIS', 'Entrada', 'Saída', 'Líquido', 'Acumulado', 'Eventos'],
      ...operationalCashComparisons.flatMap((item) => item.cash.rows.map((row) => [`${item.label} · ${row.month}`, row.inflow, row.outflow, row.net, row.cumulative, row.events.join(' + ')])),
      [],
      ['CAPEX POR DEGRAU', 'Necessário', 'Unidade', 'Existente informado', 'Lacuna', 'Custo unitário', 'CAPEX incremental', 'Fonte/memória'],
      ...capexSteps.map((step) => [step.label, step.required, step.unit, step.informedExisting || 'não informado', step.gap ?? 'aguarda capacidade', step.unitCost || 'não informado', step.incrementalCapex ?? 'aguarda orçamento', step.source]),
      ['CAPEX incremental já quantificável (R$)', knownIncrementalCapex],
      ['Degraus ainda não fechados', unresolvedCapexSteps],
      [],
      ['ABERTURA DO CUSTO DO MILHO', 'R$/ha'],
      ...cornCrop.costItems.map((item) => [item.label, item.value]),
      ['Subtotal classificado', cornDetailedSubtotal],
      ['Saldo não classificado', cornUnallocatedCost],
      ['Custo direto corrente', cropDirectCostHa(cornCrop)],
      ['Custo direto histórico cruzado', 6528.6],
      ['Diferença histórico − corrente', cornHistoricalDirectCostGap],
      [],
      ['MESA DE PREÇOS', 'Data do valor editável', 'Indicador editável', 'Basis local', 'Preço aplicado', 'Proveniência do registro observado', 'Proveniência do preço aplicado', 'Data do preço aplicado', 'Fonte do preço aplicado', 'Referência oficial preservada', 'Data oficial preservada', 'Unidade oficial', 'Praça/unidade', 'URL', 'Nota'],
      ...marketQuotes.map((quote) => [
        quote.label,
        quote.date,
        quote.reference,
        quote.basis,
        quote.id === 'cattle'
          ? assumptions.priceArroba
          : crops.find((crop) => crop.id === quote.id)?.price ?? 0,
        quote.provenance,
        appliedPriceMeta[quote.id].provenance,
        appliedPriceMeta[quote.id].date || 'sem data',
        appliedPriceMeta[quote.id].source,
        quote.officialReference ?? 'n/d',
        quote.officialDate ?? 'n/d',
        quote.officialUnit ?? 'n/d',
        `${quote.market} · ${quote.unit}`,
        quote.sourceUrl,
        quote.note,
      ]),
      ['DATAS-BASE FÍSICAS USADAS NA CURVA', 'Data', 'Preço-base', 'Proveniência', 'Fonte', 'Cenário futuro aplicado ainda coerente'],
      ...Object.entries(futurePhysicalBaseDates).map(([id, date]) => {
        const quoteId = id as MarketQuote['id'];
        return [id, date || 'sem data', futurePhysicalBasePrices[quoteId], appliedPriceMeta[quoteId].provenance, appliedPriceMeta[quoteId].source, appliedPriceMeta[quoteId].provenance !== 'future-scenario' ? 'não se aplica' : appliedPriceIsValid(quoteId) ? 'sim' : 'não; confirme basis/carrego e reaplique se a curva mudou'];
      }),
      [],
      ['JANELAS DE COMERCIALIZAÇÃO AGRÍCOLA', 'Disponível em', 'Última entrega', 'Carry/basis confirmado'],
      ...(['soy', 'corn', 'cotton'] as const).map((product) => {
        const cropId: CropAssumption['id'] = product === 'soy' ? 'soy-irrigated' : product === 'corn' ? 'corn-irrigated' : 'cotton-irrigated';
        const calendar = automaticCalendar.crops[cropId];
        return [product, calendar.availableDate || 'ciclo não liquidado', calendar.lastDeliveryDate || 'fora do horizonte', cropMarketingWindows[product].carryBasisConfirmed ? 'sim' : 'não'];
      }),
      ['PRÉ-VALIDAÇÃO AGRÍCOLA POR CULTURA', 'Plantio automático', 'Colheita automática', 'Ciclo (dias)', 'Vazio sanitário', 'Base legal', 'Ato/estado da revisão', 'Data da revisão', 'Memória do ciclo', 'Registro/página oficial', 'Cópia/referência de acesso', 'Classe da cópia/referência', 'Fonte do ciclo/ZARC', 'Ciclo liquidado na janela operacional', 'Água/energia confirmadas', 'Capacidade água/energia (ha)', 'Máquinas confirmadas', 'Capacidade máquinas (ha)', 'Capacidade básica confirmada'],
      ...crops.map((crop) => {
        const gate = cropOperational[crop.id];
        const calendar = automaticCalendar.crops[crop.id];
        return [crop.name, calendar.plantDate, calendar.harvestDate, calendar.cycleDays, calendar.sanitaryVoid, calendar.legalBasis, calendar.legalAct, calendar.rulesCheckedAt, calendar.cycleBasis, calendar.officialRegistryUrl, calendar.legalSourceUrl, calendar.legalSourceLabel, calendar.cycleSourceUrl, calendar.completedWithinHorizon ? 'sim' : 'não', gate.waterEnergyConfirmed ? 'sim' : 'não', gate.waterEnergyCapacityHa, gate.machineCapacityConfirmed ? 'sim' : 'não', gate.machineCapacityHa, singleCropCapacityReady(crop.id) ? 'sim' : 'não'];
      }),
      ['CALENDÁRIO DUPLA SAFRA', 'Valor'],
      ['Plantio da soja', automaticCalendar.doubleCrop.soyPlantDate],
      ['Colheita da soja', automaticCalendar.doubleCrop.soyHarvestDate],
      ['Plantio do milho', automaticCalendar.doubleCrop.cornPlantDate],
      ['Colheita do milho', automaticCalendar.doubleCrop.cornHarvestDate],
      ['Duração soja (dias)', soyCycleDays ?? 'n/d'],
      ['Transição soja→milho (dias)', cropTransitionDays ?? 'n/d'],
      ['Duração milho (dias)', cornCycleDays ?? 'n/d'],
      ['Ciclo total (dias)', doubleCropTotalDays ?? 'n/d'],
      ['Sequência central liquidada na janela operacional', doubleCropSequenceValid ? 'sim' : 'não'],
      ['Água e energia confirmadas', doubleCropCalendar.waterEnergyConfirmed ? 'sim' : 'não'],
      ['Capacidade de água e energia (ha)', doubleCropCalendar.waterEnergyCapacityHa],
      ['Máquinas e operação confirmadas', doubleCropCalendar.machineCapacityConfirmed ? 'sim' : 'não'],
      ['Capacidade de máquinas e operação (ha)', doubleCropCalendar.machineCapacityHa],
      ['Dupla safra · capacidade básica confirmada', doubleCropCapacityReady ? 'sim' : 'não'],
      [],
      ['CURVA FUTURA MANUAL', 'Contrato', 'Mês de entrega', 'Data de observação', 'Ponto da curva', 'Horizonte (dias)', 'Triagem temporal/econômica', 'Execução com basis/carrego', 'Preço bruto', 'Unidade bruta', 'Basis local', 'Preço futuro convertido', 'Preço ponderado', 'Cobertura %', 'Atividade modelada', 'Margem/ha', 'Δ margem/ha', 'Contratos inteiros', 'Capital requerido', 'Capital viável', 'Proveniência', 'Contrato de referência', 'URL', 'Memória da conversão'],
      ['Câmbio usado (R$/US$)', futureUsdBrl],
      ['Rendimento de fibra do algodão (%)', cottonFiberRecovery],
      ['Crédito do caroço (R$/@ de algodão em caroço)', cottonSeedCredit],
      ...futureOpportunities.map((item) => [
        `${futureProductLabel[item.quote.product]} · ${item.quote.symbol}`,
        item.quote.contract,
        item.quote.deliveryMonth,
        item.quote.sourceDate,
        item.quote.referenceDate,
        item.horizonDays ?? 'n/d',
        item.isUsable ? 'apta à triagem' : `pendente: ${item.validationIssue ?? 'erro não identificado'}`,
        item.executionUsable ? 'sim' : item.quote.product === 'cattle' ? 'não' : 'não; confirme basis/carrego',
        item.quote.rawPrice,
        futureRawUnitLabel(item.quote.rawUnit),
        item.quote.localBasis,
        item.futurePrice,
        item.effectivePrice,
        futureHedgePercent,
        item.activity,
        item.marginHa,
        item.deltaMarginHa,
        item.contractsAtCoverage,
        item.capitalRequired,
        item.capitalFeasible ? 'sim' : 'não',
        item.quote.provenance ?? 'manual-reference',
        `${item.quote.exchange} ${item.quote.symbol}`,
        item.quote.sourceUrl,
        `${item.quote.rawPrice} ${futureRawUnitLabel(item.quote.rawUnit)} + basis ${item.quote.localBasis}; câmbio ${futureUsdBrl}; rendimento fibra ${cottonFiberRecovery}%; crédito caroço ${cottonSeedCredit}`,
      ]),
      ['Aviso da curva', 'Referências inseridas manualmente; não são feed em tempo real nem recomendação de hedge. Confirme os ajustes oficiais e os direitos de uso antes de redistribuir.'],
      [],
      ['CICLO DE MERCADO OFICIAL', 'Valor', 'Período', 'Estado', 'Leitura', 'Fonte', 'URL'],
      ...marketCycleEvidence.map((item) => [item.label, item.value, item.period, item.status, item.text, `${item.source} · ${item.tone}`, item.sourceUrl]),
      ['Nota de fundamento', 'Sinais de oferta e demanda explicam risco direcional, mas não substituem preço futuro, basis, custo local, capital e calendário.'],
      [],
      ['FAIXAS DE ESTRESSE EDITÁVEIS', 'Inferior %', 'Superior %'],
      ['Preço bovinos (gordo e hipótese do magro)', strategyStress.cattleLow, strategyStress.cattleHigh],
      ['Preço da soja', strategyStress.soyLow, strategyStress.soyHigh],
      ['Preço do milho', strategyStress.cornLow, strategyStress.cornHigh],
      ['Preço do algodão', strategyStress.cottonLow, strategyStress.cottonHigh],
      ['Produtividade', strategyStress.productivityLow, strategyStress.productivityHigh],
      ['Custo', strategyStress.costLow, strategyStress.costHigh],
      ['Reposição', strategyStress.replacementLow, strategyStress.replacementHigh],
      ['Aviso das faixas', 'Choques manuais não calibrados; inferior/central/superior não são mínimo, máximo, P10, P50 ou P90.'],
      [],
      ['MATRIZ DE ROBUSTEZ', 'Margem inferior R$/ha', 'Margem central R$/ha', 'Margem superior R$/ha', 'Valor no critério R$/ha'],
      ['Estado do ranking estratégico', strategyReady ? 'apto' : 'aguarda ao menos uma alternativa validada'],
      ...strategyRanking.map((activity) => [activity.label, activity.margins.low, activity.margins.base, activity.margins.high, activity.scoreHa]),
      ['Critério de decisão', strategyCriterion === 'defensive' ? 'maximin' : strategyCriterion === 'base' ? 'margem central' : 'pesos 25/50/25 não probabilísticos'],
      ['Faixa manual de indiferença (R$/ha)', strategyErrorHa],
      [],
      ['MIX SOB RESTRIÇÕES', 'Área ha', 'Participação %', 'Caixa/ha conservador', 'Caixa usado', 'Margem inferior anual', 'Margem central anual', 'Margem superior anual'],
      ...strategyAllocation.rows.filter((row) => row.area > 0.01).map((row) => [row.label, row.area, row.share, row.cashCostHa, row.cashUsed, row.marginsAnnual.low, row.marginsAnnual.base, row.marginsAnnual.high]),
      ['Área alocada (ha)', strategyAllocation.allocatedArea],
      ['Área ociosa (ha)', strategyAllocation.idleArea],
      ['Capital total disponível para o projeto (R$)', strategyCapitalLimit],
      ['Capital usado (R$)', strategyAllocation.cashUsed],
      ['Capital viável', strategyAllocation.capitalFeasible ? 'sim' : 'não'],
      ['Déficit de capital (R$)', strategyAllocation.capitalShortfall],
      ['Máximo por sistema (% área)', strategyMaxShare],
      ['Custo inevitável da área ociosa (R$/ha/ano)', assumptions.landLeaseHa],
      ['Nota do mix', 'Alocação anual com área exclusiva, orçamento conservador e CAPEX indivisível de pivô/cocho. Não fecha ainda lotes inteiros, transferência interna de grãos ou programação conjunta de caixa e água.'],
      [],
      ['CUSTOS AGRÍCOLAS', 'Item', 'R$/ha', 'Status'],
      ...crops.flatMap((crop) =>
        crop.costItems.map((item) => [
          crop.name,
          item.label,
          item.value,
          item.status === 'base' ? 'base fornecida' : 'hipótese agregada',
        ]),
      ),
      [],
      ['PREMISSAS AGRÍCOLAS', 'Produtividade', 'Preço', 'Deduções %', 'Fixos R$/ha/safra', 'Custo direto/ha'],
      ...crops.map((crop) => [crop.name, crop.yield, crop.price, crop.deductionRate, cropFixedCostHa(crop), cropDirectCostHa(crop)]),
    ];
    const csv = `\uFEFF${lines.map((row) => row.map(quote).join(';')).join('\r\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `boimeta-${new Date().toISOString().slice(0, 10)}.csv`;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <main className="simulator-app min-h-screen bg-background text-foreground">
      <a href="#analysis-tabs" className="skip-link">Ir para os resultados</a>
      <header className="no-print sticky top-0 z-40 border-b border-white/10 bg-[#0d2b1e]/95 text-white backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-[#d7f06b] text-[#10291f]">
              <Droplets className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-heading text-sm font-semibold tracking-tight">BoiMeta</p>
              <p className="text-[9px] uppercase tracking-[0.17em] text-white/55">Cenários rastreáveis · modelo {MODEL_VERSION}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-[10px] text-white/65 sm:flex">
            <span className={`size-1.5 rounded-full ${scenarioMode === 'exploration' ? 'bg-[#f2c879]' : 'bg-[#d7f06b]'}`} />
            {scenarioMode === 'exploration' ? 'DEMONSTRAÇÃO · não validada' : '100% irrigado · cenário de regime pleno'}
          </div>
        </div>
      </header>
      <AppInstall />
      {result.inputErrors.length > 0 ? <div className="no-print bg-amber-100 p-4 text-sm text-amber-950">{result.inputErrors.join(' ')}</div> : null}
      <div className="no-print border-b bg-white/80 px-4 py-3">
        <details className="mx-auto max-w-[1540px]">
          <summary className="cursor-pointer text-sm font-semibold">Meus cenários · salvar, abrir e exportar</summary>
          <div className="scenario-toolbar mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={saveLocalScenario}>Salvar no navegador</Button>
          <Button size="sm" variant="outline" onClick={restoreLocalScenario}>Restaurar salvo</Button>
          <Button size="sm" variant="outline" onClick={downloadScenario}>Baixar cenário</Button>
          <Button size="sm" variant="outline" onClick={() => scenarioFileInput.current?.click()}>Abrir cenário</Button>
          <input ref={scenarioFileInput} type="file" accept=".json,application/json" className="hidden" aria-label="Arquivo de cenário" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 2_000_000) throw new Error('Arquivo maior que 2 MB.');
              restoreScenario(JSON.parse(await file.text()));
            } catch (error) { setSavedStatus(error instanceof Error ? error.message : 'Arquivo inválido.'); }
            event.target.value = '';
          }} />
          <output className="text-xs text-muted-foreground">{savedStatus || 'Sem cadastro. Dados salvos ficam no seu dispositivo; exportação é opcional.'}</output>
          </div>
        </details>
      </div>


      <div className="no-print border-b border-[#dce5d9] bg-[#edf3e8]">
        <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:px-8 lg:py-5">
          <div>
            <div className="mb-3 flex flex-wrap gap-2">
              <Badge className="bg-[#173e2c] text-white">Caso atual · {int.format(assumptions.totalArea)} ha</Badge>
              <Badge variant="outline" className="border-[#76917c]/30 bg-white/55">Hipótese irrigada plena</Badge>
              <Badge variant="outline" className="border-[#76917c]/30 bg-white/55">R$ nominais</Badge>
              {scenarioMode === 'exploration' ? <Badge className="bg-[#f2c879] text-[#68460c]">DEMONSTRAÇÃO · não validada</Badge> : null}
            </div>
            <h1 className="max-w-4xl font-heading text-xl font-semibold leading-tight tracking-[-0.035em] sm:text-2xl">
              Compare os usos da sua área.
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">1. Ajuste seu cenário · 2. Compare os resultados · 3. Confira o mercado.</p><details className="mt-2 text-sm"><summary className="cursor-pointer font-medium text-[#315a3e]">Como interpretar os resultados</summary>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#52685a] sm:text-base">
              Dimensionamento físico simplificado, compra de gado, custos, receitas e margem comparados sobre a mesma área-base com soja, milho e algodão irrigados em regime pleno. Insumos e área a montante aparecem separadamente. Calendário-base: Barra/BA; mudar a UF de preços não adapta regras agronômicas. Margens anuais de regime pleno não representam lucro líquido nem caixa do primeiro ano.
            </p>
            </details>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="bg-[#173e2c] text-white" onClick={() => openEditor('farm')}><SlidersHorizontal /> Ajustar cenário</Button>
            <Button variant="outline" onClick={showReport}><FileText /> Ver relatório</Button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1600px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8 lg:py-7">
        <aside id="quick-controls" data-mobile-open={mobileControlsOpen} className="quick-controls no-print min-w-0 self-start lg:sticky lg:top-[74px]">
          <ScenarioEditor openGroup={editorGroup} onGroup={setEditorGroup}
            margin={best.id === 'none-feasible' ? 'n/d' : moneyCompact(best.margin)}
            onCompare={() => { setMobileControlsOpen(false); openAnalysisTab('quick'); }}
            groups={[{ id: 'farm', title: 'Fazenda e capital', summary: int.format(assumptions.totalArea) + ' ha · ' + moneyCompact(strategyCapitalLimit), children: <><Control label="Área total" value={assumptions.totalArea} suffix="ha" min={1} max={5000} step={1} onChange={(value) => update('totalArea', value)} />
<Control label="Capital disponível" value={strategyCapitalLimit} suffix="R$" min={0} max={500000000} step={100000} onChange={updateStrategyCapitalLimit} />
<p className="text-xs text-muted-foreground">Capital para custeio e novos investimentos. Compra da terra não incluída; reserva e preparação são detalhadas em Validações.</p>
<label className="block rounded-xl border border-[#bfd0bd] bg-[#eef5ef] p-3" htmlFor="scenario-anchor-date"><span className="text-[11px] font-semibold text-[#315a3e]">Entrada do gado · marco único</span><Input id="scenario-anchor-date" className="mt-2 h-9 bg-white text-xs" type="date" value={animalTimelineInputs.entryDate} onChange={(event) => { if (strictIsoDate(event.target.value)) updateAnimalTimeline('entryDate', event.target.value); }} /><span className={`mt-2 block text-[9px] leading-relaxed ${automaticCalendarUsesFallback ? 'text-[#9b4b2f]' : 'text-muted-foreground'}`}>{automaticCalendarUsesFallback ? `Data inválida: calendário temporariamente ancorado em ${dateBr(asOfDate)}.` : `Gera automaticamente plantio, colheita e janela operacional de ${COMMON_HORIZON_DAYS} dias.`}</span></label>
<details className="editor-detail"><summary>Arrendamento</summary><div className="mt-4 space-y-4"><Control label="Arrendamento anual" value={assumptions.landLeaseHa} suffix="R$/ha" min={0} max={10000} step={50} onChange={(value) => update('landLeaseHa', value)} /></div></details></> },
{ id: 'cattle', title: 'Gado e desempenho', summary: int.format(assumptions.entryWeight) + ' → ' + int.format(assumptions.saleWeight) + ' kg · recria ' + two.format(assumptions.gmdPivotA) + ' kg/d', children: <><p className="text-sm text-muted-foreground">Compra, venda do magro e venda do gordo têm preços e unidades diferentes.</p>
<Control label="Bezerro de 240 kg" value={assumptions.calfCost} suffix="R$/cab" min={500} max={10000} step={25} onChange={(value) => update('calfCost', value)} />
<Control label="Magro · valor líquido na porteira" value={animalTimelineInputs.gateValuePerKgLive} suffix="R$/kg vivo" min={0} max={40} step={0.1} onChange={value => updateAnimalTimeline('gateValuePerKgLive', value)} />
<Control label="Arroba do boi" value={assumptions.priceArroba} suffix="R$/@" min={100} max={700} step={0.5} onChange={(value) => update('priceArroba', value)} />
<details className="editor-detail"><summary>Pesos, ganhos e lotação</summary><div className="mt-4 space-y-4"><p className="text-xs text-muted-foreground">GMD é o ganho médio diário. A/C usam recria; B termina no pasto. As arrobas de peso seguem a conversão informada na análise do lote.</p><Control label="Peso de entrada" value={animalTimelineInputs.entryArrobas} suffix="@/cab" min={1} max={40} step={0.1} onChange={updateQuickEntryArrobas} />
<Control label="Peso da decisão" value={animalTimelineInputs.decisionArrobas} suffix="@/cab" min={1} max={40} step={0.1} onChange={updateQuickDecisionArrobas} />
<Control label="Peso de saída" value={liveKgToArrobas(assumptions.saleWeight)} suffix="@/cab" min={1} max={40} step={0.1} onChange={updateQuickSaleArrobas} />
<Control label="GMD recria · A/C" value={assumptions.gmdPivotA} suffix="kg/d" min={0.2} max={2} step={0.01} onChange={(value) => update('gmdPivotA', value)} />
<Control label="GMD ciclo no pivô · B" value={assumptions.gmdB} suffix="kg/d" min={0.2} max={2} step={0.01} onChange={(value) => update('gmdB', value)} />
<Control label="GMD no confinamento" value={assumptions.gmdFeedlot} suffix="kg/d" min={0.5} max={3} step={0.01} onChange={(value) => update('gmdFeedlot', value)} />
<Control label="Lotação no pasto" value={assumptions.stockingUa} suffix="UA/ha" min={1} max={30} step={0.1} onChange={(value) => update('stockingUa', value)} />
<p className="text-sm text-muted-foreground">Digite a lotação por hectare de pasto, sem descontar silagem. A separa a área de silagem; B/C usam toda a área em pasto. Uma UA equivale a 450 kg vivos, não uma cabeça. O suporte anual depende da produção mensal de capim.</p>
<Control label="Intensificação adicional do pasto" value={assumptions.pastureExtraCostHa ?? 0} suffix="R$/ha/ano" min={0} max={50000} step={100} onChange={value => update('pastureExtraCostHa', value)} />
<p className="text-xs text-muted-foreground">Adubação, energia e manejo adicionais à base. Zero não comprova intensificação gratuita. Incide só no pasto, antes do fator abaixo.</p>
<Control label="Custeio não animal" value={assumptions.otherCostFactor} suffix="% da base" min={0} max={300} step={1} onChange={value => update('otherCostFactor', value)} />
<Control label="Prêmio de rendimento no cocho" value={assumptions.feedlotCarcassYieldLiftPercent} suffix="p.p." min={0} max={10} step={0.1} onChange={(value) => update('feedlotCarcassYieldLiftPercent', value)} />
<Control label="Preço do suplemento" value={assumptions.supplementPrice} suffix="R$/kg" min={1} max={20} step={0.05} onChange={(value) => update('supplementPrice', value)} /></div></details></> },
{ id: 'feed', title: 'Alimentação e cocho', summary: one.format(assumptions.silageShare) + '% silagem · ' + int.format(allocationInputs.feedlotCapacity) + ' vagas', children: <><Control label="Área de silagem" value={assumptions.silageShare} suffix="%" min={5} max={80} step={1} onChange={(value) => update('silageShare', value)} />
<Control label="Vagas nominais de confinamento" value={allocationInputs.feedlotCapacity} suffix="vagas" min={0} max={100000} step={50} onChange={value => updateAllocation('feedlotCapacity', value)} />
<Control label="Milho comprado · preço entregue" value={allocationInputs.grainPurchasePriceSack} suffix="R$/sc" min={0} max={500} step={0.5} onChange={value => updateAllocation('grainPurchasePriceSack', value)} />
<p className="text-xs text-muted-foreground">Milho entregue inclui frete e condições de compra. Não é o preço de venda da lavoura.</p>
<div className="flex items-center justify-between gap-4 rounded-xl border border-[#bfd0bd] bg-[#eef5ef] p-3">
                <div><p className="text-xs font-semibold">Dieta: silagem local + milho comprado</p><p className="text-[10px] text-muted-foreground">Atual: {brl2.format(modelAssumptions.dietPriceDm)}/kg MS</p></div>
                <Switch aria-label="Vincular dieta à silagem local e ao milho comprado" checked={assumptions.linkFeedToCropCosts} onCheckedChange={(checked) => update('linkFeedToCropCosts', checked)} />
              </div>
{!assumptions.linkFeedToCropCosts ? <Control label="Dieta manual (MS)" value={assumptions.dietPriceDm} suffix="R$/kg" min={0.2} max={6} step={0.01} onChange={(value) => update('dietPriceDm', value)} /> : <p className="text-xs text-muted-foreground">Dieta calculada pelos ingredientes. O valor manual permanece guardado.</p>}
<details className="editor-detail"><summary>Custos da silagem e composição</summary><div className="mt-4 space-y-4"><Control label="Complemento + mistura por kg MS total" value={assumptions.dietOtherCostDm} suffix="R$/kg" min={0} max={6} step={0.01} onChange={(value) => update('dietOtherCostDm', value)} />
<Control label="Custo da silagem por corte" value={assumptions.silageCostHaCut} suffix="R$/ha" min={0} max={30000} step={50} onChange={(value) => update('silageCostHaCut', value)} />
<Control label="Produtividade da silagem por corte" value={assumptions.silageYieldDm} suffix="t MS/ha" min={5} max={60} step={0.5} onChange={(value) => update('silageYieldDm', value)} />
<Control label="Cortes de silagem por ano" value={assumptions.silageCrops} suffix="cortes" min={1} max={4} step={1} onChange={(value) => update('silageCrops', Math.round(value))} /><div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3">
                <div><p className="text-xs font-semibold">Milho próprio · valoração na alocação</p><p className="text-[10px] text-muted-foreground">{assumptions.feedUseOpportunityCost ? 'Usa preço líquido após deduções evitáveis' : 'Usa custo caixa local por kg MS'}</p></div>
                <Switch aria-label="Usar custo de oportunidade do milho" checked={assumptions.feedUseOpportunityCost} onCheckedChange={(checked) => update('feedUseOpportunityCost', checked)} />
              </div></div></details>
<Button variant="outline" className="w-full" onClick={() => { setMobileControlsOpen(false); openAnalysisTab('allocation'); }}>Ver alimento próprio e estoques</Button></> },
{ id: 'crops', title: 'Lavouras irrigadas', summary: 'Soja, milho e algodão · preços de venda e produtividade', children: <><p className="text-sm text-muted-foreground">Preços e produção da base irrigada; custos de cultivo já preenchidos. Cotação consultada só entra após você aplicar.</p>
{crops.map((crop) => <section className="rounded-xl border p-3 space-y-3" key={crop.id} aria-label={crop.shortName}>
<h3 className="text-sm font-semibold">{crop.shortName}</h3>
<Control label={'Preço de venda · ' + crop.shortName} value={crop.price} suffix={'R$/' + crop.unit.split('/')[0]} min={0} max={crop.id === 'cotton-irrigated' ? 500 : 1000} step={0.5} onChange={(value) => updateCrop(crop.id, 'price', value)} />
<Control label={'Produtividade · ' + crop.shortName} value={crop.yield} suffix={crop.unit} min={0} max={crop.id === 'cotton-irrigated' ? 1000 : 500} step={1} onChange={(value) => updateCrop(crop.id, 'yield', value)} />
</section>)}
<Button variant="outline" className="w-full" onClick={() => { setMobileControlsOpen(false); openAnalysisTab('costs'); }}>Detalhar custos de cultivo</Button></> },
{ id: 'investment', title: 'Investimentos e extras', summary: 'Pivô ' + moneyCompact(assumptions.pivotInvestment) + ' · cocho ' + moneyCompact(assumptions.investment) + (assumptions.includeCows ? ' · vacas incluídas' : '') + (assumptions.includeEffluentSavings ? ' · efluente hipotético' : ''), children: <><p className="text-sm text-muted-foreground">Informe somente investimento novo. Não relance a estrutura já paga.</p>
<Control label="CAPEX comum do pivô" value={assumptions.pivotInvestment} suffix="R$" min={0} max={200000000} step={100000} onChange={(value) => update('pivotInvestment', value)} />
<Control label="Investimento incremental" value={assumptions.investment} suffix="R$" min={0} max={100000000} step={100000} onChange={(value) => update('investment', value)} />
<details className="editor-detail"><summary>Taxa de retorno e prazo</summary><div className="mt-4 space-y-4"><p className="text-xs text-muted-foreground">TMA é a taxa mínima de atratividade. Afeta o valor do investimento, não a receita operacional.</p><Control label="TMA" value={assumptions.discountRate} suffix="% a.a." min={0} max={40} step={0.5} onChange={(value) => update('discountRate', value)} /><Control label="Horizonte" value={assumptions.horizon} suffix="anos" min={1} max={30} step={1} onChange={(value) => update('horizon', value)} /></div></details>
<details className="editor-detail"><summary>Vacas de oportunidade · {assumptions.includeCows ? 'incluídas' : 'não incluídas'}</summary><div className="mt-4 space-y-4"><div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3">
                <div><p className="text-xs font-semibold">Vacas de oportunidade</p><p className="text-[10px] text-muted-foreground">Um lote pós-silagem na mesma área; ative só com janela agronômica confirmada</p></div>
                <Switch aria-label="Incluir vacas de oportunidade" checked={assumptions.includeCows} onCheckedChange={(checked) => update('includeCows', checked)} />
              </div>{assumptions.includeCows ? <><Control label="Compra da vaca magra" value={assumptions.cowBuyCost} suffix="R$/cab" min={0} max={20000} step={25} onChange={(value) => update('cowBuyCost', value)} /><Control label="Venda da vaca gorda" value={assumptions.cowSaleArroba} suffix="R$/@" min={0} max={1000} step={0.5} onChange={(value) => update('cowSaleArroba', value)} /></> : null}</div></details>
<details className="editor-detail"><summary>Efluente · {assumptions.includeEffluentSavings ? 'hipótese incluída' : 'sem crédito'}</summary><div className="mt-4 space-y-4"><div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3">
                <div><p className="text-xs font-semibold">Crédito bruto calibrado do efluente</p><p className="text-[10px] text-muted-foreground">Escala pelas cabeças-dia próprias; exige medição, análise, eficiência e licenças</p></div>
                <Switch aria-label="Incluir crédito hipotético do efluente" checked={assumptions.includeEffluentSavings} onCheckedChange={(checked) => update('includeEffluentSavings', checked)} />
              </div>{assumptions.includeEffluentSavings ? <><Control label="Área-alvo do efluente" value={assumptions.effluentArea} suffix="ha" min={0} max={assumptions.totalArea} step={10} onChange={(value) => update('effluentArea', Math.min(value, assumptions.totalArea))} />
<Control label="Lâmina-alvo do efluente" value={assumptions.effluentDepthMm} suffix="mm/ano" min={0} max={1000} step={10} onChange={(value) => update('effluentDepthMm', value)} />
<Control label="Valor bruto calibrado" value={assumptions.effluentValueM3} suffix="R$/m³" min={0} max={100} step={0.1} onChange={(value) => update('effluentValueM3', value)} />
<Control label="Módulo-base fertirrigado" value={allocationInputs.effluentReferenceAreaHa} suffix="ha" min={1} max={5000} step={1} onChange={(value) => updateAllocation('effluentReferenceAreaHa', value)} />
<Control label="Lâmina anual do módulo-base" value={allocationInputs.effluentReferenceDepthMm} suffix="mm/ano" min={1} max={1000} step={5} onChange={(value) => updateAllocation('effluentReferenceDepthMm', value)} />
<Control label="Animais do módulo-base" value={allocationInputs.effluentReferenceAnnualHeads} suffix="cab/ano" min={1} max={500000} step={25} onChange={(value) => updateAllocation('effluentReferenceAnnualHeads', value)} />
<Control label="Dias no cocho do módulo-base" value={allocationInputs.effluentReferenceConfinementDays} suffix="dias" min={1} max={365} step={1} onChange={(value) => updateAllocation('effluentReferenceConfinementDays', value)} /></> : null}</div></details></> }]}
            footer={<details className="editor-detail"><summary>Base e restauração do cenário</summary><div className="mt-3 space-y-3">
              <p className="text-xs text-muted-foreground">Salve antes de substituir valores. Carregar a base de 400 ha preserva preços, custos, data, orçamento e vagas; restaurar tudo substitui as premissas.</p>
              <Button variant="outline" className="w-full" onClick={loadProductionBase}>Usar base produtiva · 400 ha</Button>
              <Button variant="outline" className="w-full" onClick={resetScenario}><RefreshCw /> Restaurar premissas de referência</Button>
            </div></details>}
          />
        </aside>

        <div className="min-w-0" id="analysis-tabs" tabIndex={-1}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="no-print mb-5 flex flex-wrap items-start gap-2 pb-1">
              <TabsList className="primary-tabs h-auto rounded-xl border border-border/70 bg-card p-1 shadow-sm">
                <TabsTrigger className="px-3 py-2" value="quick"><Gauge /> Resultado</TabsTrigger>
                <TabsTrigger className="px-3 py-2" value="market"><TrendingUp /> Mercado</TabsTrigger>
                <TabsTrigger className="px-3 py-2" value="audit"><FileText /> Validações</TabsTrigger>
                <TabsTrigger className="px-3 py-2" value="report"><FileText /> Relatório</TabsTrigger>
              </TabsList>
              <details className="relative rounded-xl border border-border/70 bg-card px-3 py-2 shadow-sm"><summary className="cursor-pointer text-sm font-semibold text-muted-foreground">Estudos detalhados</summary><div className="mt-3 grid min-w-56 gap-1">{([['viability', 'Capital e viabilidade'], ['decision', 'Decisão validada'], ['operations', 'Operação & caixa'], ['dimension', 'Dimensionamento'], ['allocation', 'Rebanho & alocação'], ['compare', 'Comparar usos'], ['costs', 'Custos detalhados'], ['sensitivity', 'Pontos de equilíbrio'], ['futures', 'Mercado futuro'], ['strategy', 'Ciclo & mix'], ['evidence', 'Evidências']] as const).map(([tab, label]) => <button className={`rounded-lg px-3 py-2 text-left text-sm hover:bg-[#edf3e8] ${activeTab === tab ? 'bg-[#edf3e8] font-semibold text-[#315a3e]' : ''}`} key={tab} onClick={(event) => { setActiveTab(tab); event.currentTarget.closest('details')?.removeAttribute('open'); }} type="button">{label}</button>)}</div></details>
            </div>

            <TabsContent value="quick" className="space-y-5">
              <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
                <p>Margens anuais de regime pleno · não são lucro líquido nem caixa do primeiro ano.</p>
                <Button variant="outline" onClick={() => openEditor('farm')}>Ajustar cenário</Button>
              </div>
              <Panel className="overflow-hidden">
                <div className="grid gap-4 bg-[#113724] p-5 text-white lg:grid-cols-[1.2fr_1fr] lg:p-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-white/55">Leitura simples do cenário</p>
                    <h2 className="mt-3 max-w-2xl font-heading text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{best.id === 'none-feasible' ? 'Nenhuma alternativa integral cabe no orçamento. As margens continuam visíveis; reduza a área ou consulte o mix parcial.' : allOperatingLosses ? 'Nenhuma alternativa dentro do orçamento apresenta margem operacional positiva. Compare a menor perda com custos inevitáveis de adiar a operação; não há aprovação de investimento.' : budgetRanking.indifferent ? 'As melhores alternativas estão dentro da faixa de indiferença informada. Compare risco, caixa e esforço operacional.' : best.id === 'cattle-a' ? 'A recria seguida de confinamento apresenta a maior margem anual nesta combinação.' : best.id === 'cattle-b' ? 'Fechar o ciclo no pivô, sem confinamento próprio, apresenta a maior margem anual nesta combinação.' : best.id === 'double-crop' ? 'A sucessão soja + milho apresenta a maior margem anual por hectare nesta combinação.' : `${best.label} apresenta a maior margem anual por hectare nesta combinação.`}</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">{best.id === 'none-feasible' ? 'Não há vencedor dentro do capital informado. A tabela preserva as margens teóricas; ajuste a escala ou estude um uso parcial da área.' : allOperatingLosses ? 'A menor perda modelada não é uma indicação para investir. Revise preços e custos e compare também o custo de esperar.' : budgetRanking.indifferent ? 'Uma pequena diferença de margem não decide o investimento. Confira capital, risco e capacidade operacional nas Validações.' : 'Este é o maior valor modelado com os preços, pesos, ganhos e custos informados; não é aprovação de investimento. Confira caixa, capacidade e dados nas Validações.'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/8 p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Margem anual</p><p className="mt-2 font-mono text-xl font-bold text-[#d7f06b]">{moneyCompact(best.margin)}</p></div>
                    <div className="rounded-xl bg-white/8 p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Margem por hectare</p><p className="mt-2 font-mono text-xl font-bold">{brl0.format(best.marginHa)}</p></div>
                    <div className="rounded-xl bg-white/8 p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Diferença para o 2º</p><p className="mt-2 font-mono text-lg font-bold">{runnerUp ? `${brl0.format(best.marginHa - runnerUp.marginHa)}/ha` : 'n/d'}</p></div>
                    <div className="rounded-xl bg-white/8 p-4"><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Margem / custo operacional</p><p className="mt-2 font-mono text-lg font-bold">{percentage(best.roi)}</p></div>
                  </div>
                </div>
              </Panel>
              <div className="rounded-xl border bg-[#fff8e9] p-4 text-sm">
                <p><strong>Pasto: {localPasture.limited ? 'lotação limitada pela oferta informada' : localPasture.known ? 'capacidade calculada com os dados informados' : 'capacidade ainda presumida'}.</strong> {result.inputErrors.length ? 'Há premissas inválidas: confira os avisos no topo.' : 'A comparação não dispensa caixa, alimento e validação de campo.'}</p>
                <button type="button" className="mt-2 min-h-11 font-semibold underline" onClick={() => openAnalysisTab('audit')}>Ver o que precisa ser validado</button>
              </div>
              <Panel>
                <SectionTitle eyebrow={`Comparação em tempo real · ${int.format(assumptions.totalArea)} ha`} title="O que acontece em cada alternativa" text="Todas usam a mesma área-base e as premissas atuais. O primeiro lugar é o maior valor modelado por hectare; a diferença negativa mostra quanto cada alternativa está atrás." />
                <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Alternativa</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Margem total</TableHead><TableHead className="text-right">Margem/ha</TableHead><TableHead className="text-right">Diferença para líder</TableHead><TableHead className="pr-5 text-right">Estado</TableHead></TableRow></TableHeader><TableBody>{ranking.map((row, index) => <TableRow className={row.id === best.id ? 'bg-[#f2f7da]/65' : ''} key={`quick-row-${row.id}`}><TableCell className="pl-5"><span className="font-semibold">{index + 1}. {row.label}</span><p className="mt-1 text-[9px] text-muted-foreground">{row.production}</p></TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(row.revenue)}</TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(row.cost)}</TableCell><TableCell className={`text-right font-mono text-xs font-semibold ${row.margin >= 0 ? 'text-[#2d6c45]' : 'text-[#9b4b2f]'}`}>{moneyCompact(row.margin)}</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(row.marginHa)}</TableCell><TableCell className="text-right font-mono text-xs">{row.id === best.id ? 'líder no orçamento' : `${brl0.format(row.marginHa - best.marginHa)}/ha`}</TableCell><TableCell className="pr-5 text-right"><Badge variant="outline">{!row.rankable ? 'restrição de calendário ou balanço' : !row.capitalFeasible ? 'fora do orçamento' : row.evidenceLevel === 'preflight-validated' ? 'pré-validado' : 'cabe no capital estimado'}</Badge></TableCell></TableRow>)}</TableBody></Table></div>
              </Panel>
              <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Bases da comparação e limites do pasto</summary><div className="mt-4 space-y-4">
              <section className={`rounded-xl border p-4 text-sm ${localPasture.limited ? 'bg-[#fff8e9]' : 'bg-card'}`} aria-label="Capacidade de pasto aplicada">
                <h2 className="font-semibold">Lotação desejada: {two.format(assumptions.stockingUa)} UA/ha · aplicada: {two.format(localPasture.effectiveUa)} UA/ha</h2>
                <p className="mt-2">{localPasture.known
                  ? `O motor A/B/C usa o menor limite entre lotação desejada e oferta de pasto informada. Mês limitante: ${localPasture.limitingMonth}. Sem transferência automática de sobras entre meses; os custos da área inteira permanecem.`
                  : localPasture.annualKnown
                    ? 'Teto anual aplicado, mas a distribuição mensal não fecha 100%. Corrija os meses para avaliar a sazonalidade; capacidade contínua ainda não comprovada.'
                    : 'Capacidade presumida: faltam produção de matéria seca e aproveitamento válidos. A simulação usa a lotação desejada, sem comprovar que o pasto a suporta.'}</p>
                <p className="mt-2">Mortalidade aplicada: {two.format(animalTimelineInputs.pastureMortality)}% no pasto e {two.format(allocationInputs.feedlotMortality)}% no cocho. Perdas ao final de cada fase, sem prêmio de exportação automático.</p>
                <button type="button" className="mt-2 font-semibold underline" onClick={() => setActiveTab('audit')}>Conferir dados de pasto, água e custeio →</button>
              </section>
              <div className="rounded-xl border bg-[#eef5ef] p-4 text-sm">
                <strong>Mesma área, mesmo capital:</strong> o líder respeita o orçamento estimado; resultados fora do limite permanecem na tabela.
                {budgetRanking.unconstrained && <span> Sem restrição de caixa, a maior margem é de {budgetRanking.unconstrained.label}: {brl0.format(budgetRanking.unconstrained.marginHa)}/ha total/ano.</span>}
                <p className="mt-2">No ranking anual, A inclui pasto e silagem na área-base e compra milho ao preço entregue. A alocação avançada mostra, separadamente, a produção própria e sua área adicional. {assumptions.linkFeedToCropCosts ? '' : 'Dieta manual ativa: composição e origem não validadas.'}</p>

              </div>
              </div></details>
              <DecisionLab input={decisionLabInput} onEdit={openEditor} onBudget={updateStrategyCapitalLimit}
                onValidate={() => openAnalysisTab('audit')} onCosts={() => openAnalysisTab('costs')} />
              <div className="no-print grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={() => openAnalysisTab('market')}>Consultar preços e tendências</Button>
                <Button variant="outline" onClick={() => openAnalysisTab('viability')}>Ver capital e viabilidade do cocho</Button>
              </div>
              <details className="rounded-xl border bg-card p-4"><summary className="cursor-pointer text-sm font-semibold">Memória física e como interpretar</summary><div className="mt-4">
              <div className="grid gap-5 xl:grid-cols-2">
                <Panel>
                  <SectionTitle eyebrow="Efeito físico das alavancas" title="O que o simulador recalculou" />
                  <div className="grid gap-3 p-5 sm:grid-cols-2 lg:p-6">
                    <Metric label="Decisão de rota em" value={dateBr(animalTimeline.decisionDate)} note={`${int.format(animalTimeline.entryToDecisionDays)} dias desde a entrada a ${two.format(assumptions.gmdPivotA)} kg/d`} />
                    <Metric label="Escala anual A · B" value={`${int.format(result.soldA)} · ${int.format(result.soldB)} cab`} note="Muda com área, lotação, pesos e ganho" />
                    <Metric label="Vagas indicativas" value={`${int.format(result.recommendedConfinementCapacity)} vagas`} note="Hipótese integral antes do roteamento econômico" />
                    <Metric label="Taxa para cobrir a área" value={`${two.format(planningPlantRate.requiredRateHaDay)} ha/d`} note={`${operationalInputs.usablePlantDays} dias úteis assumidos para plantio`} />
                    <Metric label="Milho antes da colheita" value={`${int.format(weeklyFeedPlan.timingMismatchGrainSacks)} sc`} note="Compra indicada pelo desencontro entre consumo e safra própria" tone={weeklyFeedPlan.timingMismatchGrainSacks > 0 ? 'warn' : 'green'} />
                    <Metric label="Pico de caixa agrícola líder" value={best.id === 'double-crop' ? moneyCompact(doubleCropCash.peakFundingNeed) : cropCashComparisons.find((item) => item.id === best.id) ? moneyCompact(cropCashComparisons.find((item) => item.id === best.id)?.cash.peakFundingNeed ?? 0) : 'ver capital pecuário'} note="Agricultura por datas; pecuária permanece no módulo de capital por ciclo" />
                  </div>
                </Panel>
                <Panel>
                  <SectionTitle eyebrow="Como interpretar" title="Simular primeiro; validar o vencedor depois" />
                  <div className="space-y-3 p-5 text-sm leading-relaxed text-muted-foreground lg:p-6"><p><strong className="text-foreground">1.</strong> Mude uma variável: por exemplo, peso de decisão, GMD do cocho, preço do boi ou produtividade da soja.</p><p><strong className="text-foreground">2.</strong> Observe se o líder muda, quanto a margem/ha se desloca e qual gargalo físico cresceu.</p><p><strong className="text-foreground">3.</strong> Quando uma alternativa permanecer líder em uma faixa razoável, abra <button className="font-semibold text-[#315a3e] underline" onClick={() => setActiveTab('decision')} type="button">Decisão</button> e <button className="font-semibold text-[#315a3e] underline" onClick={() => setActiveTab('operations')} type="button">Operação & caixa</button> para fechar preços, capacidades, estoque e capital.</p><div className="rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-3 text-xs text-[#735a2a]"><strong>Importante:</strong> mudar a data desloca calendário, estoque e contratos. Ela só muda o preço automaticamente quando existir uma curva de mercado aplicada; o simulador não inventa preço futuro apenas pela passagem do tempo.</div></div>
                </Panel>
              </div>
              </div></details>
            </TabsContent>

            <TabsContent value="market" className="space-y-5" keepMounted>
              <MarketCompass uf={marketUf} onUf={setMarketUf} asOf={asOfDate}
                modeledPrices={{ cattle: assumptions.priceArroba, soy: crops.find(c => c.id === 'soy-irrigated')?.price ?? 0, corn: crops.find(c => c.id === 'corn-irrigated')?.price ?? 0, cotton: crops.find(c => c.id === 'cotton-irrigated')?.price ?? 0 }}
                onApply={applyRadarPrice} onEvidence={setMarketEvidence}
                decisionDate={animalTimeline.decisionDate}
                exitDate={animalTimeline.routes.find(r => r.id === 'own-feedlot')?.exitDate ?? ''}
                curvePrice={animalTimeline.routes.find(r => r.id === 'own-feedlot')?.projectedPrice ?? null}
                curveCovered={animalTimeline.curveSourceValid && ['exact', 'interpolated'].includes(animalTimeline.routes.find(r => r.id === 'own-feedlot')?.curveCoverage ?? '')}
                onAdvanced={() => setActiveTab('futures')} />
            </TabsContent>
            <TabsContent value="viability" className="space-y-5">
              <BusinessReview a={modelAssumptions} core={result} rearing={rearing} cash={rearingCash}
                rearingCapital={comparisons.find(row => row.id === 'cattle-c')?.capitalRequired ?? 0}
                budget={strategyCapitalLimit} gateSourceDate={animalTimelineInputs.gateSourceDate} rows={areaResponses}
                controls={<Button variant="outline" onClick={() => openEditor('cattle')}>Ajustar preços e desempenho</Button>} />
            </TabsContent>

            <TabsContent value="audit" className="space-y-5">
              <DecisionReview assumptions={modelAssumptions} anchor={animalTimelineInputs.entryDate} config={reviewInputs} onConfig={(next) => { setReviewInputs(next); invalidateOperationalConfirmations(); }}
                operations={operationalInputs} onOperation={(key, value) => { setOperationalInputs((current) => ({ ...current, [key]: value })); invalidateOperationalConfirmations(); }}
                budget={strategyCapitalLimit} onEditBudget={() => openEditor('farm', 'Capital disponível')} exportScenario={serializedScenario} restoreScenario={restoreScenario}
                onResetReference={loadProductionBase} />
            </TabsContent>

            <TabsContent value="decision" className="space-y-5">
              {scenarioMode === 'validation' && best.id === 'none-feasible' ? (
                <Panel className="no-print overflow-hidden border-[#d5b46c]/45">
                  <div className="grid gap-5 bg-[#fffaf0] p-5 lg:grid-cols-[1.15fr_1fr] lg:p-6">
                    <div>
                      <Badge className="bg-[#173e2c] text-white">Comece aqui</Badge>
                      <h2 className="mt-4 max-w-xl font-heading text-2xl font-semibold tracking-[-0.03em]">Preencha o que falta e o resultado será calculado passo a passo.</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Cada item à direita abre diretamente a área que precisa de preço, data, capacidade ou confirmação. Se quiser conhecer o motor antes, abra um exemplo já preenchido em outra aba; premissas ilustrativas continuam identificadas e não substituem os seus dados.</p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <Button className="bg-[#173e2c] text-white hover:bg-[#22533a]" onClick={openExplorationScenario}>
                          <Sprout /> Abrir demonstração isolada
                        </Button>
                        <Button variant="outline" onClick={() => openAnalysisTab('compare')}>Validar meu cenário <ArrowRight /></Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                      {validationSteps.map((step, index) => (
                        <button className="flex items-center justify-between gap-3 rounded-xl border border-border/75 bg-white p-3 text-left transition hover:border-[#77947c]" key={step.label} onClick={() => openAnalysisTab(step.tab)} type="button">
                          <span className="flex min-w-0 items-start gap-3"><span className={`grid size-7 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${step.ready ? 'bg-[#d7f06b] text-[#173724]' : 'bg-[#fff0c8] text-[#6f5320]'}`}>{index + 1}</span><span><span className="block text-xs font-semibold">{step.label}</span><span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">{step.detail}</span></span></span>
                          <Badge variant="outline">{step.ready ? 'concluído' : 'abrir'}</Badge>
                        </button>
                      ))}
                    </div>
                  </div>
                </Panel>
              ) : null}

              {scenarioMode === 'exploration' ? (
                <div className="rounded-2xl border border-[#d49e37]/35 bg-[#fff4d8] p-4 text-[#6b4a12] sm:flex sm:items-center sm:justify-between sm:gap-5">
                  <div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><p className="text-sm font-semibold">{explorationLoading ? 'DEMONSTRAÇÃO — carregando exemplo isolado' : 'DEMONSTRAÇÃO — resultado ilustrativo, não validado'}</p><p className="mt-1 text-xs leading-relaxed">Preços físicos partem da CONAB BA quando a consulta responde; curva futura, água, energia, máquinas, calendário e capacidade foram preenchidos como hipóteses para você estressar os números. Substitua e confirme cada gate antes de usar o modo real.</p></div></div>
                  <Button className="mt-3 shrink-0 border-[#9b762b]/35 bg-white text-[#6b4a12] hover:bg-[#fffaf0] sm:mt-0" disabled={explorationLoading} variant="outline" onClick={exitExplorationScenario}>Fechar demonstração</Button>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Margem incremental A − B" value={moneyCompact(result.incrementalEbitda)} note={`${brl0.format(result.incrementalEbitda / assumptions.totalArea)}/ha no ano-base`} tone={result.incrementalEbitda >= 0 ? 'lime' : 'warn'} icon={<ArrowRight className="size-4" />} />
                <Metric label="Escala anual A · B" value={`${int.format(result.soldA)} · ${int.format(result.soldB)}`} note="bois terminados/ano nas premissas-base" icon={<Beef className="size-4" />} />
                <Metric label="Confinamento indicativo de A" value={`${int.format(result.recommendedConfinementCapacity)} vagas`} note={`${int.format(result.confinementOccupancy)} cabeças médias × 10% de folga`} icon={<Factory className="size-4" />} />
                <Metric label="Limite indicativo de CAPEX incremental" value={moneyCompact(result.maxInvestment)} note={`Inclui capital de giro · ${assumptions.horizon} anos · TMA ${one.format(assumptions.discountRate)}%`} tone={result.maxInvestment >= 0 ? 'green' : 'warn'} icon={<CircleDollarSign className="size-4" />} />
              </div>

              <Panel>
                <SectionTitle eyebrow="Leitura do cenário" title={decisionTitle} text={scenarioMode === 'exploration' ? best.id === 'none-feasible' ? 'O exemplo continua sem alternativa anual comparável.' : `No exemplo, ${best.label} apresenta ${brl0.format(best.marginHa)}/ha/ano sob premissas ilustrativas. O valor serve para explorar sensibilidade; não representa recomendação, orçamento ou previsão.` : best.id === 'none-feasible' ? 'Revise as premissas econômicas anuais do estudo.' : `O ranking econômico anual em regime pleno usa os preços, produtividades e custos da planilha e não é limitado pelo capital disponível. Separadamente, a entrada em ${dateBr(automaticCalendar.anchorDate)} gera a janela operacional até ${dateBr(automaticCalendar.horizonEndDate)} para safras, contratos e rotas animais. ${best.label} modela ${brl0.format(best.marginHa)}/ha; ${runnerUp ? `a diferença para ${runnerUp.label} é ${brl0.format(best.marginHa - runnerUp.marginHa)}/ha` : 'não há segunda alternativa'}. Alertas de preço atual, caixa e capacidade devem ser fechados antes da execução.`} action={<Badge className={scenarioMode === 'exploration' || best.id === 'none-feasible' ? 'bg-[#ffe1a6] text-[#714817]' : 'bg-[#d7f06b] text-[#183b28]'}>{scenarioMode === 'exploration' ? 'demonstração' : best.evidenceLevel === 'preflight-validated' ? 'pré-validado' : 'base da planilha'}</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label={best.id === 'none-feasible' ? 'Estado do ranking' : scenarioMode === 'exploration' ? 'Maior margem ilustrativa' : 'Maior margem calculada'} value={best.id === 'none-feasible' ? 'aguardando validações' : best.label} note={best.source} tone={best.id === 'none-feasible' || scenarioMode === 'exploration' ? 'warn' : 'lime'} />
                  <Metric label="Margem anual" value={best.id === 'none-feasible' ? 'n/d' : moneyCompact(best.margin)} note={best.id === 'none-feasible' ? 'Nenhuma alternativa rankeável' : `${percentage(best.roi)} de margem ÷ custo anual`} tone={best.id === 'none-feasible' ? 'warn' : 'green'} />
                  <Metric label="Área mínima / escala" value={leaderBreakEven?.minimumArea ?? 'n/d'} note="Considera o CAPEX informado" />
                  <Metric label="Primeiro ponto a validar" value={bottlenecks[0].title} note={bottlenecks[0].text} tone={bottlenecks[0].level === 'atenção' ? 'warn' : 'plain'} />
                </div>
              </Panel>

              <div className="grid gap-5 xl:grid-cols-2">
                <article className="relative overflow-hidden rounded-[22px] bg-[#113724] p-5 text-white shadow-[0_20px_55px_rgba(15,49,32,0.18)] sm:p-6">
                  <div className="absolute right-[-70px] top-[-90px] size-64 rounded-full border-[42px] border-[#d7f06b]/10" />
                  <div className="relative">
                    <div className="flex items-center justify-between gap-3"><Badge className="bg-[#d7f06b] text-[#173724]">Rota A integrada</Badge><span className="text-[10px] uppercase tracking-[0.14em] text-white/55">recria + melhor destino marginal</span></div>
                    <h2 className="mt-7 max-w-md font-heading text-2xl font-semibold tracking-[-0.03em]">Cada lote segue apenas a rota coberta e economicamente superior.</h2>
                    <div className="mt-8 grid grid-cols-2 gap-3">
                      <div><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Receita econômica</p><p className="mt-1 font-mono text-xl font-semibold">{routeIntegrationReady ? moneyCompact(integratedRouteRevenueA) : 'n/d'}</p></div>
                      <div><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Margem econômica</p><p className="mt-1 font-mono text-xl font-semibold text-[#d7f06b]">{routeIntegrationReady ? moneyCompact(integratedRouteMarginA) : 'aguarda dados'}</p></div>
                      <div><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Custo econômico</p><p className="mt-1 font-mono text-sm font-semibold">{routeIntegrationReady ? moneyCompact(integratedRouteCostA) : 'n/d'}</p></div>
                      <div><p className="text-[10px] uppercase tracking-[0.12em] text-white/50">Margem / footprint</p><p className="mt-1 font-mono text-sm font-semibold">{routeIntegrationReady ? brl0.format(integratedRouteMarginA / integratedSystemFootprintA) : 'n/d'}</p></div>
                    </div>
                  </div>
                </article>

                <Panel className="p-5 sm:p-6">
                  <div className="flex items-center justify-between gap-3"><Badge variant="outline">Situação B</Badge><span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Somente pivô</span></div>
                  <h2 className="mt-7 max-w-md font-heading text-2xl font-semibold tracking-[-0.03em]">Menos infraestrutura, ciclo mais longo no pasto.</h2>
                  <div className="mt-8 grid grid-cols-2 gap-3">
                    <div><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Receita em VP</p><p className="mt-1 font-mono text-xl font-semibold">{routeBReady ? moneyCompact(routeBSystemRevenue) : 'n/d'}</p></div>
                    <div><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Margem em VP</p><p className="mt-1 font-mono text-xl font-semibold text-[#2d6c45]">{routeBReady ? moneyCompact(routeBSystemMargin) : 'aguarda dados'}</p></div>
                    <div><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Custo em VP</p><p className="mt-1 font-mono text-sm font-semibold">{routeBReady ? moneyCompact(routeBSystemCost) : 'n/d'}</p></div>
                    <div><p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Margem / footprint</p><p className="mt-1 font-mono text-sm font-semibold">{routeBReady ? brl0.format(routeBSystemMargin / integratedSystemFootprintA) : 'n/d'}</p></div>
                  </div>
                </Panel>
              </div>

              <Panel>
                <SectionTitle
                  eyebrow="Fronteira de decisão"
                  title={
                    !integratedFinancialReady
                      ? 'Preencha as duas rotas para calcular a comparação financeira A × B.'
                      : scenarioMode === 'exploration'
                        ? integratedIncrementalMargin >= 0
                          ? 'No exemplo, A apresenta maior margem econômica que B.'
                          : 'No exemplo, B apresenta maior margem econômica que A.'
                        : integratedIncrementalMargin >= 0
                          ? 'A apresenta maior margem econômica que B.'
                          : 'B apresenta maior margem econômica que A.'
                  }
                  text="A leitura marginal usa o mesmo calendário, valor presente, custo da reposição, alimento integrado e capital de giro. Não reutiliza o confinamento integral quando o roteador manda vender."
                  action={
                    <Badge
                      className={
                        scenarioMode === 'exploration' ||
                        !integratedFinancialReady ||
                        integratedIncrementalMargin < 0
                          ? 'bg-[#ffe1a6] text-[#714817]'
                          : 'bg-[#d7f06b] text-[#183b28]'
                      }
                    >
                      {!integratedFinancialReady
                        ? 'aguarda dados'
                        : scenarioMode === 'exploration'
                          ? integratedIncrementalMargin >= 0
                            ? 'A à frente no exemplo'
                            : 'B à frente no exemplo'
                          : integratedIncrementalMargin >= 0
                            ? 'A à frente'
                            : 'B à frente'}
                    </Badge>
                  }
                />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Equilíbrio do preço em B" value={routeBBreakEvenPrice === null ? 'aguarda dados de B' : `${brl2.format(routeBBreakEvenPrice)}/@`} note={`Peso final ${int.format(assumptions.saleWeight)} kg · saída ${routeBExitDate || 'n/d'}`} />
                  <Metric label="Capital de giro incremental" value={integratedFinancialReady ? moneyCompact(integratedIncrementalWorkingCapital) : 'aguarda A e B'} note="Entra no t0 e é recuperado no terminal" />
                  <Metric label="Área para A superar B" value="não há limiar linear" note="A saturação do cocho pode inverter o resultado. Consulte a varredura de áreas no simulador rápido." />
                  <Metric label="Payback simples marginal" value={integratedSimplePayback === null ? 'aguarda margem positiva' : `${two.format(integratedSimplePayback)} anos`} note="Antes de impostos e financiamento" />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6">
                  <strong>Reconciliação financeira:</strong> {integratedFinancialReady ? <>com o CAPEX informado, capital de giro, horizonte e TMA do cenário, o fluxo integrado gera VPL de <strong>{moneyCompact(integratedOperationalNpv ?? 0)}</strong> e TIR de <strong>{percentage(integratedOperationalIrr)}</strong>.</> : <>não é exibido VPL/TIR enquanto A ou B não tiver calendário, fonte, curva e elegibilidade válidos.</>} Antes de investir, substitua a série anual uniforme pelo cronograma mensal de obras, ramp-up, impostos, financiamento e valor residual.
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="dimension" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow="Envelope físico · não é o ranking" title="Capacidade máxima se toda a terminação fosse própria" text="Este bloco dimensiona o teto físico da hipótese integral. A decisão econômica efetiva está no roteador: cabeças vendidas no gate não consomem dieta própria. A área de alimento só entra no footprint integrado quando é realmente usada." action={<Badge variant={result.bindingConstraintA === 'silagem' ? 'destructive' : 'secondary'}>Teto interno: {result.bindingConstraintA}</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3 lg:p-6">
                  <Metric label="Pasto irrigado" value={`${one.format(result.pastureAreaA)} ha`} note={`${100 - assumptions.silageShare}% da área`} icon={<Sprout className="size-4" />} />
                  <Metric label="Silagem" value={`${one.format(result.silageArea)} ha`} note={`Necessário pelo balanço: ${one.format(result.requiredSilageArea)} ha`} tone={result.requiredSilageArea > result.silageArea ? 'warn' : 'green'} icon={<Wheat className="size-4" />} />
                  <Metric label="Potencial de bois no pasto A" value={`${int.format(result.simultaneousPivotA)} cab`} note={`Não é o fluxo roteado. Pasto efetivamente usado pelo fluxo: ${int.format(result.entrantsA * result.daysPivotA / 365)} cabeças médias.`} icon={<Beef className="size-4" />} />
                  <Metric label="Potencial físico integral" value={`${int.format(result.soldA)} cab/ano`} note="Só vale se mercado, dieta, coortes e pico fecharem; não é o destino atual" tone="warn" />
                  <Metric label="Vagas indicativas de confinamento" value={`${int.format(result.recommendedConfinementCapacity)} cab`} note={`Ocupação média modelada + 10% assumidos; validar pico e manejo`} icon={<Factory className="size-4" />} />
                  <Metric label="Vacas de oportunidade" value={`${int.format(result.cowsSold)} cab/ano`} note={assumptions.includeCows ? `${int.format(result.cowWindowArea)} ha pós-silagem · um lote a 8 cab/ha` : 'Desligadas; não há área ou receita implícita'} />
                  <Metric label="Lotação de equilíbrio" value={`${two.format(result.balancedStockingUa)} UA/ha`} note="Ponto em que pasto e silagem fecham juntos" tone="green" />
                  <Metric label="Dieta por boi" value={`${one.format(result.dietDmHead)} t MS`} note={`${two.format(assumptions.dietDmDay)} kg MS/dia`} />
                  <Metric label="Compra anual de animais" value={moneyCompact(cattlePurchaseA)} note="Bois + vacas; não é CAPEX" tone="warn" icon={<CircleDollarSign className="size-4" />} />
                  <Metric label="Milho no destino atual" value={`${int.format(feedAllocation.grainDemandSacks)} sc/ano`} note={`${int.format(feedAllocation.ownGrainUsedSacks)} próprias + ${int.format(feedAllocation.purchasedGrainSacks)} compradas`} tone="warn" icon={<Wheat className="size-4" />} />
                  <Metric label="Área de milho vinculada" value={`${one.format(linkedGrainAreaHa)} ha`} note={linkedGrainAreaHa > 0 ? 'Produção e margem do milho reconciliadas no sistema A' : 'Nenhuma área própria consumida pelo roteador'} tone={linkedGrainAreaHa > 0 ? 'warn' : 'plain'} />
                  <Metric label="Footprint econômico integrado" value={`${one.format(integratedSystemFootprintA)} ha`} note="Área-base + milho próprio efetivamente vinculado" />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Fechamento de área e custo:</strong> a silagem usada é custeada pela safra inteira e reconciliada com seu valor alternativo; o milho próprio usado traz toda a área informada, sua receita potencial e seu custo de produção. Quando nenhuma cabeça usa alimento próprio, essas lavouras não são escondidas dentro da pecuária. Os números físicos integrais acima permanecem apenas como teto de projeto.</div>
              </Panel>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel>
                  <SectionTitle eyebrow="Linha do tempo A" title={`${int.format(timelineEntryWeight)} → ${int.format(timelineDecisionWeight)} → ${int.format(assumptions.saleWeight)} kg`} />
                  <div className="p-5 lg:p-6">
                    <div className="relative grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-2">
                      <div className="rounded-xl bg-[#edf4eb] p-3 text-center"><strong className="font-mono">{int.format(timelineEntryWeight)} kg</strong><p className="text-[10px] text-muted-foreground">entrada</p></div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                      <div className="rounded-xl bg-[#dfeadb] p-3 text-center"><strong className="font-mono">{int.format(timelineDecisionWeight)} kg</strong><p className="text-[10px] text-muted-foreground">{one.format(result.daysPivotA)} dias no pivô</p></div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                      <div className="rounded-xl bg-[#d7f06b] p-3 text-center text-[#173724]"><strong className="font-mono">{int.format(assumptions.saleWeight)} kg</strong><p className="text-[10px] text-[#48603f]">{one.format(result.daysFeedlot)} dias no cocho</p></div>
                    </div>
                    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">GMD: {two.format(assumptions.gmdPivotA)} kg/dia na recria e {two.format(assumptions.gmdFeedlot)} kg/dia no confinamento. Use desempenho conservador até que pesagens próprias validem o ganho real.</p>
                  </div>
                </Panel>
                <Panel>
                  <SectionTitle eyebrow="Sistema B" title="Ciclo completo no pivô" />
                  <div className="grid gap-3 p-5 sm:grid-cols-2 lg:p-6">
                    <Metric label="Área de pasto" value={`${one.format(result.pastureAreaB)} ha`} note="Sem área de silagem" />
                    <Metric label="Estoque simultâneo" value={`${int.format(result.simultaneousPivotB)} cab`} note={`${two.format(result.simultaneousPivotB / result.pastureAreaB)} cab/ha`} />
                    <Metric label="Venda anual" value={`${int.format(result.soldB)} cab`} note={`${two.format(result.cyclesB)} ciclos/ano`} />
                    <Metric label="Permanência" value={`${one.format(result.daysB)} dias`} note={`GMD ${two.format(assumptions.gmdB)} kg/dia`} />
                    <Metric label="Compra anual de gado" value={moneyCompact(cattlePurchaseB)} note="Necessidade bruta de reposição" tone="warn" />
                    <Metric label="Capital de giro estimado" value={routeBReady ? moneyCompact(integratedWorkingCapitalB) : 'aguarda dados de B'} note="Entrada + formação média do custo; recuperado no terminal" />
                  </div>
                </Panel>
              </div>

              <Panel>
                <SectionTitle eyebrow="Água + nutrientes" title={`O módulo de ${int.format(effluentScale.referenceAreaHa)} ha escala pelas cabeças-dia do cocho próprio`} text={`A calibração usa ${int.format(effluentScale.referenceAreaHa)} ha × ${int.format(effluentScale.referenceDepthMm)} mm/ano = ${int.format(effluentScale.referenceVolumeM3)} m³/ano para ${int.format(effluentScale.referenceAnnualHeads)} animais × ${int.format(effluentScale.referenceConfinementDays)} dias. Só animais realmente roteados ao confinamento próprio geram volume neste balanço; vender no magro ou manter a pasto não gera crédito coletável para a fazenda.`} action={<Badge className={effluentScale.coveragePercent >= 100 ? 'bg-[#d7f06b] text-[#173724]' : 'bg-[#ffe1a6] text-[#714817]'}>{one.format(effluentScale.coveragePercent)}% da área-alvo</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Módulo de calibração" value={`${int.format(effluentScale.referenceAreaHa)} ha · ${int.format(effluentScale.referenceVolumeM3)} m³`} note={`${int.format(effluentScale.referenceAnnualHeads)} animais × ${int.format(effluentScale.referenceConfinementDays)} dias`} />
                  <Metric label="Por cabeça-dia" value={`${one.format(effluentScale.volumePerHeadDayM3 * 1_000)} L`} note={`${brl2.format(effluentScale.volumePerHeadDayM3 * assumptions.effluentValueM3)}/cabeça-dia · coeficiente calibrado`} />
                  <Metric label="Por animal no ciclo-base" value={`${two.format(effluentVolumePerFinishedHeadM3)} m³`} note={`${one.format(effluentAreaPerFinishedHeadHa * 10_000)} m² a ${int.format(effluentScale.referenceDepthMm)} mm/ano · ${brl2.format(effluentCreditPerFinishedHead)} bruto`} />
                  <Metric label="Cabeças-dia próprias roteadas" value={int.format(effluentScale.currentOwnFeedlotHeadDays)} note={`${int.format(feedAllocation.ownHeads)} animais/ano destinados ao cocho próprio`} tone={effluentScale.currentOwnFeedlotHeadDays > 0 ? 'green' : 'warn'} />
                  <Metric label="Volume escalado disponível" value={`${int.format(effluentScale.availableVolumeM3)} m³`} note={`${two.format(effluentScale.currentReferenceModules ?? 0)} módulos efetivamente usados`} />
                  <Metric label={`Área coberta a ${int.format(assumptions.effluentDepthMm)} mm/ano`} value={`${one.format(effluentScale.areaCoveredAtTargetDepthHa)} ha`} note={`Área-alvo: ${one.format(effluentScale.targetAreaHa)} ha`} tone={effluentScale.coveragePercent >= 100 ? 'green' : 'warn'} />
                  <Metric label="Lâmina se distribuir na área-alvo" value={`${two.format(effluentScale.depthAcrossTargetAreaMm)} mm`} note="Aumentar a área reduz a lâmina; não cria volume" />
                  <Metric label="Volume exigido pela área-alvo" value={`${int.format(effluentScale.requiredVolumeM3)} m³`} note={effluentScale.volumeShortfallM3 > 0 ? `Déficit: ${int.format(effluentScale.volumeShortfallM3)} m³` : `Excedente sem crédito nesta área: ${int.format(effluentScale.volumeExcessM3)} m³`} tone={effluentScale.volumeShortfallM3 > 0 ? 'warn' : 'green'} />
                  <Metric label="Escala necessária" value={`${two.format(effluentScale.requiredReferenceModules ?? 0)} módulos`} note={`${int.format(effluentScale.requiredAnnualHeadsAtReferenceStay ?? 0)} animais/ano a ${int.format(effluentScale.referenceConfinementDays)} dias`} tone="warn" />
                  <Metric label="Capacidade nominal indicativa" value={requiredNominalFeedlotCapacity === null ? 'n/d' : `${int.format(requiredNominalFeedlotCapacity)} vagas`} note={`Ocupação média ÷ ${one.format(allocationInputs.feedlotUtilization)}% de utilização; validar pico semanal`} />
                  <Metric label="Economia bruta suportada pelo volume" value={moneyCompact(effluentScale.grossPotentialCredit)} note={`${brl2.format(assumptions.effluentValueM3)}/m³ · antes de tratamento, bombeamento, aplicação e análises`} tone="warn" icon={<Waves className="size-4" />} />
                  <Metric label="Proveniência da calibração/valor" value={effluentScale.provenanceReady ? 'completa' : 'pendente'} note={effluentScale.provenanceReady ? `${effluentScale.calibrationPeriodStart} a ${effluentScale.calibrationPeriodEnd} · valor em ${effluentScale.valueDate}` : effluentScale.blockers[0] ?? 'Informe fonte, período e data'} tone={effluentScale.provenanceReady ? 'green' : 'warn'} />
                  <Metric label="Crédito incluído na rota A" value={moneyCompact(effluentScale.includedCredit)} note={effluentScale.creditReady ? 'Incluído uma única vez no sistema integrado A; excedente sem crédito' : effluentScale.blockers[0] ?? 'Complete as pré-condições do efluente'} tone={effluentScale.creditReady ? 'green' : 'warn'} />
                  <Metric label="Adubo substituível · teto" value={moneyCompact(effluentScale.avoidedFertilizerCost)} note="Menor entre disponibilidade agronômica e orçamento evitável; ajuste em Premissas & caixa" />
                  <Metric label="Tratamento e aplicação" value={moneyCompact(effluentScale.operatingCost)} note="Inclui tratamento do volume disponível, aplicação e custo fixo informado" />
                  <Metric label="Benefício líquido hipotético" value={moneyCompact(effluentScale.netPotentialCredit)} note="Benefício limitado menos custos; não é economia comprovada" tone={effluentScale.netPotentialCredit >= 0 ? 'green' : 'warn'} />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Limite de interpretação:</strong> os {one.format(effluentScale.volumePerHeadDayM3 * 1_000)} L/cabeça-dia são uma calibração matemática do módulo apresentado, não uma medição universal de dejeto bovino. Antes de ativar o crédito, substitua por medição da saída do tratamento e valide nutrientes, solo, custo evitável, destino operacional, capacidade hidráulica e requisitos regulatórios aplicáveis.</div>
              </Panel>
            </TabsContent>

            <TabsContent value="operations" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow="Escala operacional" title={`Quanto a equipe precisa executar para cobrir ${int.format(assumptions.totalArea)} ha`} text="A área continua sendo o comando principal. O simulador transforma a área em hectares por dia; capacidade zero significa não informada, não capacidade inexistente. Os 15 dias úteis são uma hipótese de planejamento editável, não um benchmark técnico." action={<Badge className={planningPlantRate.informed && planningHarvestRate.informed && planningPlantRate.fits && planningHarvestRate.fits ? 'bg-[#d7f06b] text-[#173724]' : 'bg-[#ffe1a6] text-[#714817]'}>{planningPlantRate.informed && planningHarvestRate.informed ? planningPlantRate.fits && planningHarvestRate.fits ? 'taxas fecham' : 'há déficit de taxa' : 'dimensionamento indicativo'}</Badge>} />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Control label="Dias úteis para plantar" value={operationalInputs.usablePlantDays} suffix="dias" min={1} max={90} step={1} onChange={(value) => updateOperational('usablePlantDays', Math.round(value))} />
                  <Control label="Dias úteis para colher" value={operationalInputs.usableHarvestDays} suffix="dias" min={1} max={90} step={1} onChange={(value) => updateOperational('usableHarvestDays', Math.round(value))} />
                  <Control label="Taxa própria/contratada de plantio" value={operationalInputs.informedPlantRateHaDay} suffix="ha/dia" min={0} max={5000} step={1} onChange={(value) => updateOperational('informedPlantRateHaDay', value)} />
                  <Control label="Taxa própria/contratada de colheita" value={operationalInputs.informedHarvestRateHaDay} suffix="ha/dia" min={0} max={5000} step={1} onChange={(value) => updateOperational('informedHarvestRateHaDay', value)} />
                </div>
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="Plantio requerido" value={`${two.format(planningPlantRate.requiredRateHaDay)} ha/d`} note={`${int.format(assumptions.totalArea)} ha ÷ ${planningPlantRate.usableDays} dias úteis`} tone={planningPlantRate.informed && !planningPlantRate.fits ? 'warn' : 'green'} />
                  <Metric label="Colheita requerida" value={`${two.format(planningHarvestRate.requiredRateHaDay)} ha/d`} note={`${int.format(assumptions.totalArea)} ha ÷ ${planningHarvestRate.usableDays} dias úteis`} tone={planningHarvestRate.informed && !planningHarvestRate.fits ? 'warn' : 'green'} />
                  <Metric label="Duração com taxa informada · plantio" value={planningPlantRate.informedDurationDays === null ? 'taxa não informada' : `${two.format(planningPlantRate.informedDurationDays)} dias`} note={planningPlantRate.capacityGapHaDay === null ? `Necessidade calculada: ${two.format(planningPlantRate.requiredRateHaDay)} ha/d` : planningPlantRate.fits ? 'Cabe na janela útil informada' : `Faltam ${two.format(planningPlantRate.capacityGapHaDay)} ha/d`} tone={planningPlantRate.informed && !planningPlantRate.fits ? 'warn' : 'plain'} />
                  <Metric label="Duração com taxa informada · colheita" value={planningHarvestRate.informedDurationDays === null ? 'taxa não informada' : `${two.format(planningHarvestRate.informedDurationDays)} dias`} note={planningHarvestRate.capacityGapHaDay === null ? `Necessidade calculada: ${two.format(planningHarvestRate.requiredRateHaDay)} ha/d` : planningHarvestRate.fits ? 'Cabe na janela útil informada' : `Faltam ${two.format(planningHarvestRate.capacityGapHaDay)} ha/d`} tone={planningHarvestRate.informed && !planningHarvestRate.fits ? 'warn' : 'plain'} />
                </div>
                <div className="overflow-x-auto border-t border-border/70">
                  <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Uso</TableHead><TableHead>Plantio automático</TableHead><TableHead>Colheita automática</TableHead><TableHead className="text-right">Ciclo</TableHead><TableHead className="pr-5">Leitura</TableHead></TableRow></TableHeader><TableBody>{crops.map((crop) => { const calendar = automaticCalendar.crops[crop.id]; return <TableRow key={crop.id}><TableCell className="pl-5 font-semibold">{crop.shortName}</TableCell><TableCell className="font-mono text-xs">{dateBr(calendar.plantDate)}</TableCell><TableCell className="font-mono text-xs">{dateBr(calendar.harvestDate)}</TableCell><TableCell className="text-right font-mono text-xs">{calendar.cycleDays} d</TableCell><TableCell className="pr-5 text-xs">{!calendar.sanitaryFit ? 'conflito sanitário — revisar ciclo/plantio' : calendar.completedWithinHorizon ? 'liquida na janela anual' : 'ultrapassa a janela anual'}</TableCell></TableRow>; })}</TableBody></Table>
                </div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Alimento por semana" title="Milho, silagem, compra e estoque são reconciliados pela data de uso" text={`${!feedTimingReady ? 'Atenção: déficit ou compra antes da safra impede validar a rota integrada; o custo temporal ainda precisa ser conciliado. ' : ''}O milho próprio só entra no estoque na colheita automática de ${dateBr(automaticCalendar.crops['corn-irrigated'].harvestDate)}. A silagem entra somente pelo estoque inicial informado ou pelos cortes datados em Premissas & caixa. Falta antes do recebimento gera compra ou déficit; a produção anual não é estoque inicial.`} action={<Badge className={weeklyFeedPlan.calendarReady ? 'bg-[#d7f06b] text-[#173724]' : 'bg-[#ffe1a6] text-[#714817]'}>{feedPlanUsesIndicativeCohort ? 'coorte indicativa' : weeklyFeedPlan.calendarReady ? 'rota atual datada' : 'sem consumo próprio'}</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Coorte simultânea planejada" value={`${int.format(indicativeFeedLots.reduce((sum, lot) => sum + lot.ownHeads, 0))} cab`} note={feedPlanUsesIndicativeCohort ? `Pré-dimensionamento: vagas úteis distribuídas entre os lotes; não é recomendação de rota` : 'Cabeças realmente destinadas ao cocho próprio'} tone={feedPlanUsesIndicativeCohort ? 'warn' : 'green'} />
                  <Metric label="Milho comprado por desencontro de datas" value={`${int.format(weeklyFeedPlan.timingMismatchGrainSacks)} sc`} note="Compra semanal antes de existir estoque próprio disponível" tone={weeklyFeedPlan.timingMismatchGrainSacks > 0 ? 'warn' : 'green'} />
                  <Metric label="Silagem própria exigida no início" value={`${int.format(weeklyFeedPlan.openingSilageDmKg / 1_000)} t MS`} note="Confirmar data de corte, compactação, perdas e liberação do silo" tone={weeklyFeedPlan.openingSilageDmKg > 0 ? 'warn' : 'plain'} />
                  <Metric label="Pico de fábrica/distribuição" value={`${two.format(weeklyFeedPlan.peakWeeklyDmKg / 7_000)} t MS/d`} note="Maior semana ÷ 7; ainda sem reserva por turno ou parada" />
                  <Metric label="Pico físico de milho armazenado" value={`${two.format(weeklyFeedPlan.peakGrainStockSacks * 0.06)} t`} note={`${int.format(weeklyFeedPlan.peakGrainStockSacks)} sacas de 60 kg`} />
                  <Metric label="Pico físico de silagem armazenada" value={`${two.format(weeklyFeedPlan.peakSilageStockDmKg / 1_000)} t MS`} note="Base matéria seca; converta para matéria natural com análise do volumoso" />
                  <Metric label="Déficit não comprado · milho" value={`${int.format(weeklyFeedPlan.totalGrainShortageSacks)} sc`} note={allocationInputs.allowPurchasedFeed ? 'Compra externa ligada; déficit vira compra' : 'Compra desligada; restringe o número de cabeças'} tone={weeklyFeedPlan.totalGrainShortageSacks > 0 ? 'warn' : 'plain'} />
                  <Metric label="Déficit não comprado · silagem" value={`${int.format(weeklyFeedPlan.totalSilageShortageDmKg / 1_000)} t MS`} note={allocationInputs.allowPurchasedFeed ? 'Compra externa ligada; déficit vira compra' : 'Compra desligada; restringe o número de cabeças'} tone={weeklyFeedPlan.totalSilageShortageDmKg > 0 ? 'warn' : 'plain'} />
                </div>
                {weeklyFeedPlan.calendarReady ? <div className="max-h-[430px] overflow-auto border-t border-border/70"><Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Semana</TableHead><TableHead className="text-right">Recebe milho</TableHead><TableHead className="text-right">Consome milho</TableHead><TableHead className="text-right">Compra milho</TableHead><TableHead className="text-right">Estoque milho</TableHead><TableHead className="text-right">Consome silagem</TableHead><TableHead className="pr-5 text-right">Estoque silagem</TableHead></TableRow></TableHeader><TableBody>{weeklyFeedPlan.rows.filter((row) => row.grainReceiptSacks > 0 || row.grainConsumptionSacks > 0 || row.silageConsumptionDmKg > 0).map((row) => <TableRow key={row.weekStart}><TableCell className="pl-5 font-mono text-xs">{dateBr(row.weekStart)}–{dateBr(row.weekEnd)}</TableCell><TableCell className="text-right font-mono text-xs">{int.format(row.grainReceiptSacks)} sc</TableCell><TableCell className="text-right font-mono text-xs">{int.format(row.grainConsumptionSacks)} sc</TableCell><TableCell className={`text-right font-mono text-xs ${row.grainPurchaseSacks > 0 ? 'text-[#a05a16]' : ''}`}>{int.format(row.grainPurchaseSacks)} sc</TableCell><TableCell className="text-right font-mono text-xs">{int.format(row.grainEndingSacks)} sc</TableCell><TableCell className="text-right font-mono text-xs">{int.format(row.silageConsumptionDmKg / 1_000)} t MS</TableCell><TableCell className="pr-5 text-right font-mono text-xs">{int.format(row.silageEndingDmKg / 1_000)} t MS</TableCell></TableRow>)}</TableBody></Table></div> : <div className="border-t border-border/70 bg-[#fff8e9] p-5 text-xs text-[#735a2a]">Nenhuma cabeça foi roteada ou pré-dimensionada para o cocho com datas válidas. O resultado anual continua visível; a tabela semanal começa assim que houver vagas úteis e uma data de decisão calculável.</div>}
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Caixa por data" title="A necessidade de capital passa a seguir plantio e colheita" text="O caixa agrícola usa a data automática de plantio para o custeio direto e a colheita para receita, deduções e custos fixos percentuais. O arrendamento entra uma vez por hectare. Financiamento, impostos e parcelamento do custeio ainda não são presumidos." />
                <div className="overflow-x-auto"><Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Alternativa</TableHead><TableHead className="text-right">Pico de capital</TableHead><TableHead className="text-right">Mês do pico</TableHead><TableHead className="text-right">Caixa final do ciclo</TableHead><TableHead className="pr-5">Movimentos</TableHead></TableRow></TableHeader><TableBody>{operationalCashComparisons.map((item) => <TableRow key={item.id}><TableCell className="pl-5 font-semibold">{item.label}</TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(item.cash.peakFundingNeed)}</TableCell><TableCell className="text-right font-mono text-xs">{item.cash.peakFundingMonth || 'n/d'}</TableCell><TableCell className={`text-right font-mono text-xs ${item.cash.endingCash >= 0 ? 'text-[#2d6c45]' : 'text-[#9b4b2f]'}`}>{moneyCompact(item.cash.endingCash)}</TableCell><TableCell className="pr-5 text-[10px] leading-relaxed text-muted-foreground">{item.cash.rows.map((row) => `${row.month}: ${row.events.join(' + ')}`).join(' · ')}</TableCell></TableRow>)}</TableBody></Table></div>
                <div className="border-t border-border/70 bg-[#fff8e9] px-5 py-3 text-[11px] leading-relaxed text-[#735a2a]"><strong>Escopo:</strong> este quadro já corrige o erro de tratar custo anual como se todo o dinheiro fosse necessário no mesmo momento, mas ainda é uma curva agrícola simplificada. Pecuária permanece no capital por ciclo e no estoque semanal até que compras, recebimentos, vendas por lote e desembolsos diários sejam consolidados em um único fluxo bancário mensal.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="CAPEX em degraus" title="O investimento aparece quando a capacidade existente deixa de suportar a escala" text="Nenhum orçamento ausente é inventado. O cocho usa apenas a razão entre o CAPEX incremental e as vagas já informadas; silo e fábrica ficam como necessidade física até receber capacidade existente e R$/unidade." action={<Badge className={unresolvedCapexSteps === 0 ? 'bg-[#d7f06b] text-[#173724]' : 'bg-[#ffe1a6] text-[#714817]'}>{unresolvedCapexSteps} degraus sem orçamento completo</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="CAPEX incremental já quantificável" value={moneyCompact(knownIncrementalCapex)} note="Soma apenas degraus com capacidade existente e custo unitário informados" tone={unresolvedCapexSteps > 0 ? 'warn' : 'green'} />
                  <Metric label="Vagas requeridas" value={`${int.format(feedlotRequiredSlots)} vagas`} note={`${int.format(allocationInputs.feedlotCapacity)} vagas informadas hoje`} />
                  <Metric label="Armazenagem de milho requerida" value={`${two.format(weeklyFeedPlan.peakGrainStockSacks * 0.06)} t`} note="Pico semanal físico; não confundir com produção anual" />
                  <Metric label="Armazenagem de silagem requerida" value={`${two.format(weeklyFeedPlan.peakSilageStockDmKg / 1_000)} t MS`} note="Converter para t matéria natural antes do projeto civil" />
                </div>
                <details className="mx-5 mb-5 rounded-xl border border-border/70 bg-[#fafbf8] p-4 lg:mx-6 lg:mb-6"><summary className="cursor-pointer text-xs font-semibold">Informar capacidades existentes e custos unitários</summary><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><Control label="Silo de grãos existente" value={operationalInputs.grainStorageCapacityTonnes} suffix="t" min={0} max={500000} step={10} onChange={(value) => updateOperational('grainStorageCapacityTonnes', value)} /><Control label="CAPEX do silo de grãos" value={operationalInputs.grainStorageCapexPerTonne} suffix="R$/t" min={0} max={100000} step={100} onChange={(value) => updateOperational('grainStorageCapexPerTonne', value)} /><Control label="Silo de silagem existente" value={operationalInputs.silageStorageCapacityTonnes} suffix="t MS" min={0} max={500000} step={10} onChange={(value) => updateOperational('silageStorageCapacityTonnes', value)} /><Control label="CAPEX do silo de silagem" value={operationalInputs.silageStorageCapexPerTonne} suffix="R$/t MS" min={0} max={100000} step={100} onChange={(value) => updateOperational('silageStorageCapexPerTonne', value)} /><Control label="Fábrica/distribuição existente" value={operationalInputs.feedMillCapacityTonnesDay} suffix="t MS/d" min={0} max={10000} step={0.1} onChange={(value) => updateOperational('feedMillCapacityTonnesDay', value)} /><Control label="CAPEX da fábrica" value={operationalInputs.feedMillCapexPerTonneDay} suffix="R$/(t/d)" min={0} max={10000000} step={10000} onChange={(value) => updateOperational('feedMillCapexPerTonneDay', value)} /></div><p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">Zero significa “não informado”. Para representar capacidade realmente nula, mantenha zero e preencha o custo unitário; a memória exportada preserva essa distinção como pendência de capacidade.</p></details>
                <div className="overflow-x-auto border-t border-border/70"><Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Degrau</TableHead><TableHead className="text-right">Necessário</TableHead><TableHead className="text-right">Existente informado</TableHead><TableHead className="text-right">Lacuna</TableHead><TableHead className="text-right">Custo unitário</TableHead><TableHead className="pr-5 text-right">CAPEX incremental</TableHead></TableRow></TableHeader><TableBody>{capexSteps.map((step) => <TableRow key={step.id}><TableCell className="pl-5"><span className="font-semibold">{step.label}</span><p className="mt-1 max-w-md text-[9px] text-muted-foreground">{step.source}</p></TableCell><TableCell className="text-right font-mono text-xs">{two.format(step.required)} {step.unit}</TableCell><TableCell className="text-right font-mono text-xs">{step.informedExisting > 0 ? `${two.format(step.informedExisting)} ${step.unit}` : 'não informado'}</TableCell><TableCell className="text-right font-mono text-xs">{step.gap === null ? 'calcular após capacidade' : `${two.format(step.gap)} ${step.unit}`}</TableCell><TableCell className="text-right font-mono text-xs">{step.unitCost > 0 ? brl2.format(step.unitCost) : 'não informado'}</TableCell><TableCell className="pr-5 text-right font-mono text-xs">{step.incrementalCapex === null ? 'aguarda orçamento' : moneyCompact(step.incrementalCapex)}</TableCell></TableRow>)}</TableBody></Table></div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Auditoria do milho" title="O total conhecido foi aberto sem fabricar componentes" text={`O orçamento-base preserva R$ ${int.format(CORN_UNALLOCATED_BUDGET_HA)}/ha antes da irrigação. Cada componente preenchido reduz o saldo não classificado; se a soma detalhada ultrapassar esse valor, o custo total cresce e o simulador sinaliza a diferença para a referência histórica de R$ 6.528,60/ha.`} action={<Badge className={cornUnallocatedCost <= 0.01 ? 'bg-[#d7f06b] text-[#173724]' : 'bg-[#ffe1a6] text-[#714817]'}>{cornUnallocatedCost <= 0.01 ? 'abertura completa' : `${brl0.format(cornUnallocatedCost)}/ha a classificar`}</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Componentes já classificados" value={`${brl2.format(cornDetailedSubtotal)}/ha`} note="Sementes + fertilizantes + defensivos + operações + colheita" />
                  <Metric label="Saldo não classificado" value={`${brl2.format(cornUnallocatedCost)}/ha`} note="Cai automaticamente quando um componente é preenchido" tone={cornUnallocatedCost > 0 ? 'warn' : 'green'} />
                  <Metric label="Custo direto corrente" value={`${brl2.format(cropDirectCostHa(cornCrop))}/ha`} note="Inclui irrigação O&M informada no cenário" />
                  <Metric label="Diferença para a base histórica" value={`${cornHistoricalDirectCostGap >= 0 ? '+' : '−'}${brl2.format(Math.abs(cornHistoricalDirectCostGap))}/ha`} note="Histórico total R$ 6.528,60/ha; bases podem ter escopos diferentes" tone={Math.abs(cornHistoricalDirectCostGap) > 1 ? 'warn' : 'green'} />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Não há decomposição local recuperada:</strong> o valor de R$ 6.528,60/ha aparece como custo direto produtivo total em outra base anonimizada; ela não identifica sementes, adubo, defensivos, operações ou se irrigação já está incluída. Por isso ela é comparação, não substituição automática do orçamento atual.</div>
              </Panel>
            </TabsContent>

            <TabsContent value="allocation" className="space-y-5">
              <Panel>
                <SectionTitle
                  eyebrow="Lote datado · curva por janela"
                  title={animalTimeline.bestRoute ? `${animalTimeline.bestRoute.label} apresenta o maior valor incremental modelado` : animalDecisionBlocker}
                  text={`Entrada em ${animalTimelineInputs.entryDate}, chegada à faixa de decisão em ${animalTimeline.decisionDate} e comparação das rotas pelo preço BGI correspondente à data estimada de abate. A venda na faixa de 12–13 @ usa preço próprio de boi magro; BGI não é cotação de reposição.`}
                  action={<Badge className={animalTimeline.bestRoute ? animalTimeline.bestRoute.id === 'sell-gate' ? 'bg-[#ffe1a6] text-[#714817]' : 'bg-[#d7f06b] text-[#183b28]' : 'bg-[#f2c879] text-[#68460c]'}>{animalTimeline.bestRoute ? 'decisão por data' : 'dados insuficientes'}</Badge>}
                />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <div className="rounded-2xl border border-[#bfd0bd] bg-[#eef5ef] p-4"><span className="text-[11px] font-medium text-muted-foreground">Calendário comum automático</span><p className="mt-2 font-mono text-sm font-semibold">{dateBr(automaticCalendar.anchorDate)} → {dateBr(automaticCalendar.horizonEndDate)}</p><p className="mt-1 text-[9px] text-muted-foreground">Altere a entrada no painel lateral.</p></div>
                  <EditValue label="Peso de entrada" value={two.format(animalTimelineInputs.entryArrobas) + ' @/cab'} onEdit={() => openEditor('cattle', 'Peso de entrada')} />
                  <EditValue label="Peso da decisão" value={two.format(animalTimelineInputs.decisionArrobas) + ' @/cab'} onEdit={() => openEditor('cattle', 'Peso da decisão')} />
                  <Control label="Preço manual de entrada" value={animalTimelineInputs.entryValuePerKgLive} suffix="R$/kg vivo" min={0} max={40} step={0.1} onChange={(value) => updateAnimalTimeline('entryValuePerKgLive', value)} />
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="animal-entry-quote-date"><span className="text-[11px] font-medium text-muted-foreground">Data-base do preço de entrada</span><Input id="animal-entry-quote-date" className="mt-2 h-9 text-xs" type="date" value={animalTimelineInputs.entryQuoteDate} onChange={(event) => updateAnimalTimeline('entryQuoteDate', event.target.value)} /></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="animal-entry-quote-source"><span className="text-[11px] font-medium text-muted-foreground">Fonte da entrada manual</span><Input id="animal-entry-quote-source" className="mt-2 h-9 text-xs" placeholder="praça, fornecedor ou boletim" value={animalTimelineInputs.entryQuoteSource} onChange={(event) => updateAnimalTimeline('entryQuoteSource', event.target.value)} /></label>
                  <EditValue label="Magro · valor líquido após despesas de venda" value={brl2.format(animalTimelineInputs.gateValuePerKgLive) + '/kg vivo'} onEdit={() => openEditor('cattle', 'Magro · valor líquido na porteira')} />
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="animal-gate-valuation-date"><span className="text-[11px] font-medium text-muted-foreground">Data-alvo do preço do magro</span><Input id="animal-gate-valuation-date" className="mt-2 h-9 text-xs" type="date" value={animalTimelineInputs.gateValuationDate} onChange={(event) => updateAnimalTimeline('gateValuationDate', event.target.value)} /></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="animal-gate-source-date"><span className="text-[11px] font-medium text-muted-foreground">Data-base do preço-cenário</span><Input id="animal-gate-source-date" className="mt-2 h-9 text-xs" type="date" value={animalTimelineInputs.gateSourceDate} onChange={(event) => updateAnimalTimeline('gateSourceDate', event.target.value)} /></label>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 md:col-span-2"><div><p className="text-xs font-semibold">@ vivo-equivalente = 30 kg</p><p className="text-[10px] text-muted-foreground">Ligado: 7 @ = 210 kg vivos. Desligado: @ de carcaça = 15 kg ÷ rendimento.</p></div><Switch aria-label="Usar arroba vivo-equivalente" checked={animalTimelineInputs.liveEquivalent} onCheckedChange={(checked) => updateAnimalTimeline('liveEquivalent', checked)} /></div>
                  <Control label="Rendimento de carcaça" value={animalTimelineInputs.carcassYield} suffix="%" min={35} max={65} step={0.5} onChange={(value) => updateAnimalTimeline('carcassYield', value)} />
                  <Control label="Custo diário manual da recria" value={animalTimelineInputs.commonPastureCostDay} suffix="R$/cab/d" min={0} max={30} step={0.1} onChange={(value) => updateAnimalTimeline('commonPastureCostDay', value)} />
                  <Control label="Base diária sem suplemento" value={animalTimelineInputs.commonPastureBaseCostDay} suffix="R$/cab/d" min={0} max={30} step={0.1} onChange={(value) => updateAnimalTimeline('commonPastureBaseCostDay', value)} />
                  <Control label="Suplemento na recria" value={animalTimelineInputs.supplementKgDay} suffix="kg/cab/d" min={0} max={5} step={0.01} onChange={(value) => updateAnimalTimeline('supplementKgDay', value)} />
                  <Control label="Custo diário para fechar no pivô" value={animalTimelineInputs.pastureFinishCostDay} suffix="R$/cab/d" min={0} max={40} step={0.1} onChange={(value) => updateAnimalTimeline('pastureFinishCostDay', value)} />
                  <Control label="Mortalidade no pivô" value={animalTimelineInputs.pastureMortality} suffix="%" min={0} max={10} step={0.1} onChange={(value) => updateAnimalTimeline('pastureMortality', value)} />
                  <Control label="Deduções da venda terminada" value={animalTimelineInputs.saleDeduction} suffix="%" min={0} max={20} step={0.1} onChange={(value) => updateAnimalTimeline('saleDeduction', value)} />
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 md:col-span-2"><div><p className="text-xs font-semibold">Lote elegível ao padrão BGI informado</p><p className="text-[10px] text-muted-foreground">Confirme macho, idade, carcaça mínima e demais especificações do contrato. A trava automática também exige pelo menos 16 @ de carcaça.</p></div><Switch aria-label="Confirmar elegibilidade do lote ao padrão BGI" checked={animalTimelineInputs.bgiEligible} onCheckedChange={(checked) => updateAnimalTimeline('bgiEligible', checked)} /></div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 md:col-span-2"><div><p className="text-xs font-semibold">Vincular entrada à reposição canônica</p><p className="text-[10px] text-muted-foreground">Ligado: usa bezerro comprado ou custo misto entre produção própria e compra do módulo de origem. Desligado: usa R$/kg manual.</p></div><Switch aria-label="Vincular entrada à reposição canônica" checked={animalTimelineInputs.linkEntryCostToReplacement} onCheckedChange={(checked) => updateAnimalTimeline('linkEntryCostToReplacement', checked)} /></div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 md:col-span-2"><div><p className="text-xs font-semibold">Vincular diária ao suplemento principal</p><p className="text-[10px] text-muted-foreground">Ligado: base diária + kg de suplemento × preço principal × fator de custo. Desligado: usa diária manual.</p></div><Switch aria-label="Vincular diária ao suplemento principal" checked={animalTimelineInputs.linkCommonPastureCost} onCheckedChange={(checked) => updateAnimalTimeline('linkCommonPastureCost', checked)} /></div>
                </div>
                {animalTimeline.inputErrors.length > 0 ? <div className="mx-5 mb-5 rounded-xl border border-[#d9a879]/60 bg-[#fff2e8] p-4 text-xs text-[#7a3f24] lg:mx-6 lg:mb-6"><strong>Preencha para calcular:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{animalTimeline.inputErrors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="Peso vivo de entrada" value={`${int.format(timelineEntryWeight)} kg`} note={`${one.format(animalTimelineInputs.entryArrobas)} @ na convenção selecionada`} />
                  <Metric label="Entrada A · econômico / caixa" value={`${brl0.format(timelineEntryCostHead)} / ${brl0.format(timelineEntryCashCostHead)}`} note={entryPriceSourceValid ? `${animalTimelineInputs.linkEntryCostToReplacement ? 'origem própria/compra calculada' : 'manual'} · base ${timelineEntrySourceDate}` : `Fonte ausente, futura ou com mais de ${MAX_REPLACEMENT_QUOTE_AGE_DAYS} dias`} tone={entryPriceSourceValid ? 'plain' : 'warn'} />
                  <Metric label="Custo diário integrado da recria" value={`${brl2.format(integratedCommonPastureCostDay)}/cab/d`} note={animalTimelineInputs.linkCommonPastureCost ? `${brl2.format(animalTimelineInputs.commonPastureBaseCostDay)} base + ${two.format(animalTimelineInputs.supplementKgDay)} kg × ${brl2.format(assumptions.supplementPrice)}` : 'diária manual'} />
                  <Metric label="Data da decisão" value={animalTimeline.decisionDate} note={`${int.format(animalTimeline.entryToDecisionDays)} dias a ${two.format(assumptions.gmdPivotA)} kg/d`} tone="green" />
                  <Metric label="Valor-cenário do boi magro" value={brl0.format(animalTimeline.gateValueHead)} note={`${brl2.format(animalTimelineInputs.gateValuePerKgLive)}/kg vivo · alvo ${animalTimelineInputs.gateValuationDate || 'sem data'} · base ${animalTimelineInputs.gateSourceDate || 'sem data'} · ${gateAppliedPriceMeta.provenance} · ${gateAppliedPriceMeta.source}`} tone={gateAppliedSourceValid && animalTimeline.gateSourceValid ? 'plain' : 'warn'} />
                  <Metric label="Idade / horizonte do preço-cenário" value={`${animalTimeline.sourceAgeDays === null ? 'n/d' : `${int.format(animalTimeline.sourceAgeDays)} d`} / ${animalTimeline.forecastHorizonDays === null ? 'n/d' : `${int.format(animalTimeline.forecastHorizonDays)} d`}`} note={`Data de corte ${asOfDate} · idade da fonte / horizonte até o alvo`} tone={animalTimeline.gateSourceValid ? 'plain' : 'warn'} />
                  <Metric label="Curva BGI inserida" value={`${animalTimeline.oldestSourceDate || 'n/d'} → ${animalTimeline.newestSourceDate || 'n/d'}`} note={`Datas de observação · snapshot mais novo com ${animalTimeline.curveSnapshotAgeDays === null ? 'idade n/d' : `${int.format(animalTimeline.curveSnapshotAgeDays)} dias`}`} tone={!animalTimeline.curveSourceValid || animalTimeline.routes.some((route) => route.curveCoverage === 'after-curve') ? 'warn' : 'plain'} />
                </div>
                <div className="overflow-x-auto border-t border-border/70">
                  <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Rota na data de decisão</TableHead><TableHead className="text-right">Saída</TableHead><TableHead className="text-right">Dias adicionais</TableHead><TableHead className="text-right">Preço da @</TableHead><TableHead className="text-right">Receita líquida</TableHead><TableHead className="text-right">Custo + tempo</TableHead><TableHead className="text-right">Δ em VP vs magro</TableHead><TableHead className="pr-5 text-right">Cobertura da curva</TableHead></TableRow></TableHeader><TableBody>
                    {animalTimeline.ranking.map((route) => <TableRow className={animalTimeline.bestRoute?.id === route.id ? 'bg-[#f2f7da]/65' : ''} key={route.id}><TableCell className="pl-5"><span className="font-semibold">{route.label}</span><p className="mt-1 text-[9px] text-muted-foreground">{route.contracts}</p></TableCell><TableCell className="text-right font-mono text-xs">{route.exitDate}</TableCell><TableCell className="text-right font-mono text-xs">{int.format(route.daysAfterDecision)}</TableCell><TableCell className="text-right font-mono text-xs">{route.id === 'sell-gate' ? 'preço do magro' : route.projectedPrice === null ? 'sem contrato' : `${brl2.format(route.projectedPrice)}/@`}</TableCell><TableCell className="text-right font-mono text-xs">{route.netRevenueHead === null ? 'não calculada' : brl0.format(route.netRevenueHead)}</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(route.routeCostHead + route.carryCostHead)}</TableCell><TableCell className={`text-right font-mono text-xs font-semibold ${route.incrementalVsSellGate === null ? 'text-[#a05a16]' : route.incrementalVsSellGate >= 0 ? 'text-[#2d6c45]' : 'text-[#9b4b2f]'}`}>{route.incrementalVsSellGate === null ? 'preencha preço/data' : brl0.format(route.incrementalVsSellGate)}</TableCell><TableCell className="pr-5 text-right"><Badge variant="outline">{route.id === 'sell-gate' ? 'cotação própria' : route.curveCoverage === 'exact' ? 'ponto exato da curva' : route.curveCoverage === 'interpolated' ? 'entre contratos' : route.curveCoverage === 'after-curve' ? 'depois da curva' : route.curveCoverage === 'before-curve' ? 'antes da curva' : route.curveCoverage === 'ineligible' ? 'lote inelegível' : 'sem curva'}</Badge></TableCell></TableRow>)}
                  </TableBody></Table>
                </div>
                <div className="border-t border-border/70 bg-[#fff8e9] px-5 py-4 text-[11px] leading-relaxed text-[#735a2a] lg:px-6"><strong>Trava de integridade:</strong> o BGI representa boi gordo para liquidação; não multiplica automaticamente um animal de 12–13 @. Entrada e venda do boi magro exigem séries próprias por R$/kg vivo, praça, categoria e data. O ponto inicial da curva é o meio do mês apenas como padrão editável — não o vencimento oficial do contrato. Fora dos pontos cobertos, a interface pede o preço ou a data que falta, sem extrapolação silenciosa.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="UA não é cabeça" title="Capacidade física convertida por peso e giro" text="A lotação informa massa viva suportada. O número de cabeças simultâneas muda com o peso médio; a saída anual ainda depende dos dias em cada fase e da sazonalidade." action={<Button variant="outline" size="sm" onClick={() => { update('totalArea', 1_000); update('stockingUa', 10); }}>Aplicar 1.000 ha × 10 UA</Button>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Capacidade instantânea" value={`${int.format(herdFlow.totalUaCapacity)} UA`} note={`${int.format(herdFlow.totalUaCapacity * 450)} kg de peso vivo`} tone="green" />
                  <Metric label="Cabeças simultâneas" value={`${int.format(herdFlow.simultaneousHeads)} cab`} note={`A ${int.format(herdFlowInputs.averageStockWeight)} kg médios/cabeça`} />
                  <Metric label="Candidatos anuais após recria" value={`${int.format(result.pastureCandidatesA)} cab/ano`} note={`${two.format(result.cyclesA)} giros teóricos · antes dos limites de cocho e alimento`} />
                  <Metric label="Vagas próprias informadas" value={`${int.format(allocationInputs.feedlotCapacity)} cab`} note={`${one.format(allocationInputs.feedlotUtilization)}% de utilização máxima`} tone={allocationInputs.feedlotCapacity < result.confinementOccupancy ? 'warn' : 'plain'} />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Leitura correta:</strong> {one.format(assumptions.stockingUa)} UA/ha equivalem a {int.format(assumptions.stockingUa * 450)} kg vivos/ha. A {int.format(herdFlowInputs.averageStockWeight)} kg, isso representa {one.format((assumptions.stockingUa * 450) / Math.max(herdFlowInputs.averageStockWeight, 1))} cabeças simultâneas/ha — não uma promessa de produção anual.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Fábrica de bezerros" title="Quantas matrizes sustentam a recria planejada?" text="O funil parte de matrizes expostas, passa por prenhez, nascimento, desmama, mortalidade pós-desmama e retenção de novilhas. As taxas têm denominadores explícitos e são editáveis." action={<Badge variant="outline">fluxo estabilizado</Badge>} />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Control label="Abastecimento próprio" value={herdFlowInputs.selfSupplyPercent} suffix="% das entradas" min={0} max={100} step={5} onChange={(value) => updateHerdFlow('selfSupplyPercent', value)} />
                  <Control label="Prenhez / matrizes expostas" value={herdFlowInputs.pregnancyRate} suffix="%" min={40} max={100} step={0.5} onChange={(value) => updateHerdFlow('pregnancyRate', value)} />
                  <Control label="Perda prenhez → nascimento" value={herdFlowInputs.pregnancyToBirthLoss} suffix="% das prenhes" min={0} max={30} step={0.5} onChange={(value) => updateHerdFlow('pregnancyToBirthLoss', value)} />
                  <Control label="Mortalidade até desmama" value={herdFlowInputs.preWeaningMortality} suffix="% dos nascidos" min={0} max={25} step={0.5} onChange={(value) => updateHerdFlow('preWeaningMortality', value)} />
                  <Control label="Mortalidade pós-desmama" value={herdFlowInputs.postWeaningMortality} suffix="%" min={0} max={15} step={0.25} onChange={(value) => updateHerdFlow('postWeaningMortality', value)} />
                  <Control label="Reposição anual" value={herdFlowInputs.replacementRate} suffix="% das matrizes" min={5} max={40} step={0.5} onChange={(value) => updateHerdFlow('replacementRate', value)} />
                  <Control label="Sobrevivência na recria de novilhas" value={herdFlowInputs.heiferDevelopmentSurvival} suffix="% das retidas" min={40} max={100} step={0.5} onChange={(value) => updateHerdFlow('heiferDevelopmentSurvival', value)} />
                  <Control label="Aprovação das novilhas" value={herdFlowInputs.heiferApprovalRate} suffix="% das sobreviventes" min={40} max={100} step={0.5} onChange={(value) => updateHerdFlow('heiferApprovalRate', value)} />
                  <Control label="Reposição formada em casa" value={herdFlowInputs.ownReplacementShare} suffix="% da reposição" min={0} max={100} step={5} onChange={(value) => updateHerdFlow('ownReplacementShare', value)} />
                  <Control label="Machos ao nascimento" value={herdFlowInputs.maleShare} suffix="%" min={35} max={65} step={0.5} onChange={(value) => updateHerdFlow('maleShare', value)} />
                  <Control label="UA do sistema por matriz" value={herdFlowInputs.herdUaPerCow} suffix="UA/matriz" min={0.8} max={2.5} step={0.05} onChange={(value) => updateHerdFlow('herdUaPerCow', value)} />
                  <Control label="Peso médio do lote" value={herdFlowInputs.averageStockWeight} suffix="kg/cab" min={100} max={650} step={5} onChange={(value) => updateHerdFlow('averageStockWeight', value)} />
                  <Control label="Monta natural" value={herdFlowInputs.naturalServiceShare} suffix="% das matrizes" min={0} max={100} step={5} onChange={(value) => updateHerdFlow('naturalServiceShare', value)} />
                  <Control label="Relação touro:vaca" value={herdFlowInputs.bullCowRatio} suffix="vacas/touro" min={10} max={80} step={1} onChange={(value) => updateHerdFlow('bullCowRatio', value)} />
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-xs font-semibold">Terminar ambos os sexos</p><p className="text-[10px] text-muted-foreground">Desligado: a meta considera somente machos</p></div><Switch aria-label="Terminar ambos os sexos" checked={herdFlowInputs.finishBothSexes} onCheckedChange={(checked) => updateHerdFlow('finishBothSexes', checked)} /></div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-xs font-semibold">Permitir compra de novilhas</p><p className="text-[10px] text-muted-foreground">Cobre a parcela externa planejada e eventual falha da formação própria</p></div><Switch aria-label="Permitir compra de novilhas" checked={herdFlowInputs.allowExternalReplacementHeifers} onCheckedChange={(checked) => updateHerdFlow('allowExternalReplacementHeifers', checked)} /></div>
                </div>
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="Taxa de desmama resultante" value={percentage(herdFlow.weaningRate * 100)} note="Prenhez × nascimento condicional × sobrevivência até desmama" tone="green" />
                  <Metric label="Matrizes expostas necessárias" value={Number.isFinite(herdFlow.matricesRequired) ? `${int.format(herdFlow.matricesRequired)} matrizes` : 'não fecha'} note={`Para ${int.format(herdFlow.targetOwnEntrants)} entradas próprias/ano`} tone={herdFlow.breedingAreaEquivalent > assumptions.totalArea ? 'warn' : 'green'} />
                  <Metric label="Área equivalente da cria" value={Number.isFinite(herdFlow.breedingAreaEquivalent) ? `${int.format(herdFlow.breedingAreaEquivalent)} ha` : 'não fecha'} note={`${two.format(herdFlowInputs.herdUaPerCow)} UA/matriz ÷ ${two.format(breedingEconomicsInputs.breedingStockingUa)} UA/ha de cria; separada da recria`} />
                  <Metric label="Compra desejada de bezerros" value={`${int.format(herdFlow.purchasedEntrants)} cab/ano`} note={`${one.format(100 - herdFlowInputs.selfSupplyPercent)}% das entradas, antes dos limites de área e capital`} />
                  <Metric label="Novilhas brutas retidas" value={`${int.format(herdFlow.retainedHeifers)} cab/ano`} note={`${int.format(herdFlow.matureOwnReplacements)} aprovadas para repor ${int.format(herdFlow.replacementNeed)} matrizes`} tone={herdFlow.ownReplacementGap > 0 ? 'warn' : 'green'} />
                  <Metric label="Compra de novilhas" value={`${int.format(herdFlow.externalReplacementPurchases)} cab/ano`} note={herdFlow.replacementSystemCloses ? 'Política fecha a reposição informada' : `${int.format(herdFlow.replacementGap)} reposições seguem descobertas`} tone={herdFlow.replacementSystemCloses ? 'green' : 'warn'} />
                  <Metric label="Touros indicativos" value={`${int.format(herdFlow.bullsRequired)} touros`} note={`${one.format(herdFlowInputs.naturalServiceShare)}% em monta natural · 1:${int.format(herdFlowInputs.bullCowRatio)}`} />
                  <Metric label="Oferta líquida por matriz" value={`${two.format(herdFlow.netEligiblePerCow)} cab/ano`} note="Após mortalidade e retenção; não é taxa de desmama" />
                </div>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-3 text-[11px] leading-relaxed text-muted-foreground"><strong>Regra de consistência:</strong> o módulo usa o funil completo, não multiplica novamente uma taxa de desmama já consolidada. É um estado estacionário; formar a base de novilhas e estabilizar partos exige cronograma plurianual, caixa e área próprios.</div>
              </Panel>

              <Panel>
                <SectionTitle
                  eyebrow="Origem da reposição"
                  title="Comprar bezerros ou imobilizar capital em matrizes?"
                  text="O ágio é medido em R$/kg vivo entregue contra o R$/kg vivo equivalente do boi líquido. A decisão econômica compara custo próprio anualizado, compra entregue, teto suportado pela recria–terminação, área e capital — ágio alto isolado não recomenda cria."
                  action={<Badge className={breedingDecision.tone === 'green' ? 'bg-[#d7f06b] text-[#183b28]' : breedingDecision.tone === 'lime' ? 'bg-[#e8efb9] text-[#31411d]' : 'bg-[#f2c879] text-[#68460c]'}>{breedingDecision.label}</Badge>}
                />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Control label="Peso do bezerro comprado" value={breedingEconomicsInputs.calfPurchaseWeightKg} suffix="kg vivo/cab" min={80} max={500} step={5} onChange={(value) => updateBreedingEconomics('calfPurchaseWeightKg', value)} />
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="calf-price-source-date"><span className="text-[11px] font-medium text-muted-foreground">Data-base do preço do bezerro</span><Input id="calf-price-source-date" className="mt-2 h-9 text-xs" type="date" value={breedingEconomicsInputs.calfPriceSourceDate} onChange={(event) => updateBreedingEconomics('calfPriceSourceDate', event.target.value)} /></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="calf-price-source"><span className="text-[11px] font-medium text-muted-foreground">Fonte da cotação do bezerro</span><Input id="calf-price-source" className="mt-2 h-9 text-xs" placeholder="praça, leilão, fornecedor ou boletim" value={breedingEconomicsInputs.calfPriceSource} onChange={(event) => updateBreedingEconomics('calfPriceSource', event.target.value)} /></label>
                  <Control label="Frete, comissão e quebra" value={breedingEconomicsInputs.purchaseTransactionCostHead} suffix="R$/cab" min={0} max={3000} step={10} onChange={(value) => updateBreedingEconomics('purchaseTransactionCostHead', value)} />
                  <Control label="Margem-alvo após reposição" value={breedingEconomicsInputs.targetDownstreamMarginHead} suffix="R$/cab" min={0} max={10000} step={50} onChange={(value) => updateBreedingEconomics('targetDownstreamMarginHead', value)} />
                  <Control label="Valor econômico da matriz" value={breedingEconomicsInputs.matrixMarketValue} suffix="R$/matriz" min={0} max={30000} step={50} onChange={(value) => updateBreedingEconomics('matrixMarketValue', value)} />
                  <Control label="Residual da matriz no horizonte" value={breedingEconomicsInputs.matrixResidualPercent} suffix="% do valor" min={0} max={100} step={1} onChange={(value) => updateBreedingEconomics('matrixResidualPercent', value)} />
                  <Control label="Custo caixa anual da matriz" value={breedingEconomicsInputs.annualCowCashCost} suffix="R$/matriz/ano" min={0} max={20000} step={50} onChange={(value) => updateBreedingEconomics('annualCowCashCost', value)} />
                  <Control label="Reprodução anual" value={breedingEconomicsInputs.annualReproductionCostCow} suffix="R$/matriz/ano" min={0} max={10000} step={25} onChange={(value) => updateBreedingEconomics('annualReproductionCostCow', value)} />
                  <Control label="Novilha comprada entregue" value={breedingEconomicsInputs.externalReplacementHeiferPriceHead} suffix="R$/cab" min={0} max={30000} step={50} onChange={(value) => updateBreedingEconomics('externalReplacementHeiferPriceHead', value)} />
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="replacement-heifer-price-date"><span className="text-[11px] font-medium text-muted-foreground">Data-base da novilha comprada</span><Input id="replacement-heifer-price-date" className="mt-2 h-9 text-xs" type="date" value={breedingEconomicsInputs.replacementHeiferPriceSourceDate} onChange={(event) => updateBreedingEconomics('replacementHeiferPriceSourceDate', event.target.value)} /></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="replacement-heifer-price-source"><span className="text-[11px] font-medium text-muted-foreground">Fonte da cotação da novilha</span><Input id="replacement-heifer-price-source" className="mt-2 h-9 text-xs" placeholder="praça, leilão, fornecedor ou boletim" value={breedingEconomicsInputs.replacementHeiferPriceSource} onChange={(event) => updateBreedingEconomics('replacementHeiferPriceSource', event.target.value)} /></label>
                  <Control label="Lotação da área de cria" value={breedingEconomicsInputs.breedingStockingUa} suffix="UA/ha" min={0.1} max={15} step={0.1} onChange={(value) => updateBreedingEconomics('breedingStockingUa', value)} />
                  <Control label="Área disponível para cria" value={breedingEconomicsInputs.breedingAreaAvailableHa} suffix="ha" min={0} max={100000} step={10} onChange={(value) => updateBreedingEconomics('breedingAreaAvailableHa', value)} />
                  <Control label="Custo anual da terra de cria" value={breedingEconomicsInputs.breedingLandCostHaYear} suffix="R$/ha/ano" min={0} max={30000} step={50} onChange={(value) => updateBreedingEconomics('breedingLandCostHaYear', value)} />
                  <Control label="Matrizes já disponíveis" value={breedingEconomicsInputs.existingMatrices} suffix="matrizes" min={0} max={200000} step={10} onChange={(value) => updateBreedingEconomics('existingMatrices', value)} />
                  <Control label="Capital novo para matrizes" value={breedingEconomicsInputs.newMatrixCapitalLimit} suffix="R$" min={0} max={1000000000} step={100000} onChange={(value) => updateBreedingEconomics('newMatrixCapitalLimit', value)} />
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-xs font-semibold">Área de cria fora da base irrigada</p><p className="text-[10px] text-muted-foreground">Desligado exige alocar a área de cria dentro da base para não contar o mesmo hectare duas vezes</p></div><Switch aria-label="Considerar área de cria fora da base irrigada" checked={breedingEconomicsInputs.breedingAreaOutsideBase} onCheckedChange={(checked) => updateBreedingEconomics('breedingAreaOutsideBase', checked)} /></div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3"><div><p className="text-xs font-semibold">Custos completos conferidos</p><p className="text-[10px] text-muted-foreground">Inclua manejo, touros/IATF, novilhas, descarte líquido, mão de obra, manutenção e giro</p></div><Switch aria-label="Confirmar custos completos da cria" checked={breedingEconomicsInputs.inputsConfirmed} onCheckedChange={(checked) => updateBreedingEconomics('inputsConfirmed', checked)} /></div>
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 md:col-span-2"><div><p className="text-xs font-semibold">Aplicar custo econômico misto ao comparativo</p><p className="text-[10px] text-muted-foreground">Troca o custo de compra puro pelo custo anualizado ponderado entre bezerros próprios viáveis e comprados</p></div><Switch aria-label="Aplicar custo econômico misto ao comparativo" checked={breedingEconomicsInputs.applyToComparison} onCheckedChange={(checked) => updateBreedingEconomics('applyToComparison', checked)} /></div>
                </div>
                {breedingEconomics.errors.length > 0 ? <div className="mx-5 mb-5 rounded-xl border border-[#d9a879]/60 bg-[#fff2e8] p-4 text-xs text-[#7a3f24] lg:mx-6 lg:mb-6"><strong>Preencha para integrar a cria:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{breedingEconomics.errors.map((error) => <li key={error}>{error}</li>)}</ul></div> : null}
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="Bezerro entregue" value={brl0.format(breedingEconomics.purchaseLandedCostHead)} note={breedingEconomics.calfPriceKg === null ? 'peso inválido' : `${brl2.format(breedingEconomics.calfPriceKg)}/kg vivo · base ${breedingEconomicsInputs.calfPriceSourceDate || 'sem data'}`} tone={calfPriceSourceValid ? 'plain' : 'warn'} />
                  <Metric label="Boi líquido vivo-equivalente" value={breedingEconomics.finishedLiveEquivalentKg === null ? 'n/d' : `${brl2.format(breedingEconomics.finishedLiveEquivalentKg)}/kg vivo`} note={`${one.format(animalTimelineInputs.carcassYield)}% rendimento e ${one.format(animalTimelineInputs.saleDeduction)}% deduções`} />
                  <Metric label="Ágio do bezerro" value={breedingEconomics.calfPremiumPercent === null ? 'n/d' : percentage(breedingEconomics.calfPremiumPercent)} note="Preço/kg do bezerro ÷ preço/kg vivo equivalente do boi − 1; não é recomendação de cria" tone={(breedingEconomics.calfPremiumPercent ?? 0) > 20 ? 'warn' : 'plain'} />
                  <Metric label="Teto da reposição · A / B" value={`${downstreamCeilingValid ? brl0.format(breedingEconomics.downstreamMaximumPurchasePriceHead) : 'aguarda A'} / ${downstreamCeilingValidB ? brl0.format(breedingEconomicsB.downstreamMaximumPurchasePriceHead) : 'aguarda B'}`} note={`A usa o boi magro na data do gate; B usa a receita BGI de sua própria saída em ${routeBExitDate || 'data n/d'}. Margem-alvo: ${brl0.format(breedingEconomicsInputs.targetDownstreamMarginHead)}/cab.`} tone={downstreamCeilingValid && downstreamCeilingValidB ? 'green' : 'warn'} />
                  <Metric label="Custo econômico próprio" value={breedingEconomics.ownCalfEconomicCostHead === null ? 'aguarda custos' : brl0.format(breedingEconomics.ownCalfEconomicCostHead)} note={breedingEconomics.ownCalfCashCostHead === null ? 'Confirme os custos' : `Caixa: ${brl0.format(breedingEconomics.ownCalfCashCostHead)}/bezerro; capital da matriz anualizado à TMA`} tone={breedingEconomics.expansionSupported ? 'green' : 'warn'} />
                  <Metric label="Blend por alternativa · A / B" value={`${brl0.format(effectiveReplacementCostHead)} / ${brl0.format(effectiveReplacementCostHeadB)}`} note={`Caixa A/B: ${brl0.format(effectiveReplacementCashCostHead)} / ${brl0.format(effectiveReplacementCashCostHeadB)}. ${replacementSupplyReadyA ? 'A fecha a origem' : `A tem déficit de ${int.format(replacementSupplyShortfallA)} cab`} · ${replacementSupplyReadyB ? 'B fecha a origem' : `B tem déficit de ${int.format(replacementSupplyShortfallB)} cab`}. Preencha a origem do déficit; o motor não inventa compra adicional.`} tone={replacementSupplyReadyA && replacementSupplyReadyB ? 'green' : 'warn'} />
                  <Metric label="Matrizes viáveis por área e capital" value={`${int.format(breedingEconomics.maxMatrices)} matrizes`} note={`${int.format(breedingEconomics.maxMatricesByArea)} por área; +${int.format(breedingEconomics.maxNewMatricesByCapital)} novas por capital`} />
                  <Metric label="Origem própria fisicamente viável" value={`${one.format(breedingEconomics.feasibleOwnSharePercent)}%`} note={`${int.format(breedingEconomics.feasibleOwnEntrants)} próprios + ${int.format(breedingEconomics.purchasedEntrants)} comprados/ano`} tone={breedingEconomics.feasibleOwnSharePercent + 0.01 >= herdFlowInputs.selfSupplyPercent ? 'green' : 'warn'} />
                  <Metric label="Capital inicial em novas matrizes" value={Number.isFinite(breedingEconomics.initialMatrixCapital) ? moneyCompact(breedingEconomics.initialMatrixCapital) : 'não fecha'} note={`${int.format(breedingEconomics.newMatricesForPlan)} matrizes novas; separado do capital de giro da recria e do cocho`} />
                  <Metric label="Compra anual de novilhas" value={moneyCompact(breedingEconomics.annualExternalReplacementCost)} note={`${int.format(herdFlow.externalReplacementPurchases)} cab/ano × ${brl0.format(breedingEconomicsInputs.externalReplacementHeiferPriceHead)}; base ${breedingEconomicsInputs.replacementHeiferPriceSourceDate || 'sem data'}`} tone={herdFlow.externalReplacementPurchases > 0 && !replacementHeiferPriceSourceValid ? 'warn' : 'plain'} />
                  <Metric label="Vantagem econômica anual" value={breedingEconomics.annualEconomicAdvantage === null ? 'aguarda validação' : moneyCompact(breedingEconomics.annualEconomicAdvantage)} note="Próprios viáveis × (compra entregue − custo econômico próprio)" tone={(breedingEconomics.annualEconomicAdvantage ?? -1) >= 0 ? 'green' : 'warn'} />
                  <Metric label="Payback simples de triagem" value={breedingEconomics.paybackYears === null ? 'sem retorno simples' : `${one.format(breedingEconomics.paybackYears)} anos`} note="Não substitui fluxo mensal, VPL/TIR, rampa reprodutiva ou valor residual" tone={breedingEconomics.paybackYears !== null && breedingEconomics.paybackYears <= assumptions.horizon ? 'green' : 'warn'} />
                  <Metric label="Equilíbrio reprodutivo" value={breedingEconomics.breakEvenEligibleCalvesPerCow === null ? 'n/d' : `${two.format(breedingEconomics.breakEvenEligibleCalvesPerCow)} entradas/matriz/ano`} note={`Funil atual: ${two.format(herdFlow.netEligiblePerCow)}`} />
                  <Metric label="Valor máximo da matriz" value={breedingEconomics.breakEvenMatrixValue === null ? 'sem espaço econômico' : brl0.format(breedingEconomics.breakEvenMatrixValue)} note="Valor que iguala custo próprio anualizado à compra entregue, mantendo as demais premissas" />
                </div>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-4 text-[11px] leading-relaxed text-muted-foreground lg:px-6"><strong>Direção calculada:</strong> {breedingDecision.text} Reter um bezerro já nascido é outra decisão: seu custo econômico é o valor líquido que ele poderia alcançar na venda à desmama. O simulador não soma esse valor de oportunidade novamente ao custo completo da mesma cria.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Lote a lote" title="Vender agora ou ocupar o cocho próprio" text="Cada faixa compara o mesmo animal no dia da decisão. O histórico da recria contextualiza o lote, mas a destinação usa a margem futura do cocho, o consumo, a conversão, alimento, caixa, vagas físicas e vaga-dias — não apenas o GMD passado." />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Venda do boi magro na decisão" value={brl0.format(animalTimeline.gateValueHead)} note={`${int.format(timelineDecisionWeight)} kg × ${brl2.format(animalTimelineInputs.gateValuePerKgLive)}/kg · mesma base do lote datado`} />
                  <EditValue label="Capacidade física do cocho" value={int.format(allocationInputs.feedlotCapacity) + ' vagas'} onEdit={() => openEditor('feed', 'Vagas nominais de confinamento')} />
                  <Control label="Utilização operacional" value={allocationInputs.feedlotUtilization} suffix="%" min={10} max={100} step={1} onChange={(value) => updateAllocation('feedlotUtilization', value)} />
                  <Control label="Operação própria" value={allocationInputs.ownOperationDay} suffix="R$/cab/d" min={0} max={30} step={0.05} onChange={(value) => updateAllocation('ownOperationDay', value)} />
                  <Control label="Custo fixo próprio" value={allocationInputs.ownFixedCostHead} suffix="R$/cab" min={0} max={2000} step={5} onChange={(value) => updateAllocation('ownFixedCostHead', value)} />
                  <Control label="Mortalidade no cocho" value={allocationInputs.feedlotMortality} suffix="%" min={0} max={10} step={0.1} onChange={(value) => updateAllocation('feedlotMortality', value)} />
                </div>
                <div className="mx-5 mb-5 rounded-2xl border border-[#d9a879]/55 bg-[#fff8ed] p-4 lg:mx-6">
                  <div className="mb-3"><p className="text-sm font-semibold">Pré-condições para entrar no ranking anual</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Confirmações não são decorativas: qualquer alteração em dieta, lote, GMD, datas, capacidade ou milho as invalida automaticamente. Sem elas, o motor mantém a alternativa no diagnóstico, mas não direciona cabeças ao cocho nem anualiza a recomendação.</p></div>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Fórmula validada</p><p className="text-[9px] text-muted-foreground">MS, PB, energia, minerais e limites por ingrediente conferidos por nutricionista</p></div><Switch aria-label="Confirmar fórmula da dieta" checked={allocationInputs.dietFormulaConfirmed} onCheckedChange={(checked) => updateAllocation('dietFormulaConfirmed', checked)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Estoque e colheita</p><p className="text-[9px] text-muted-foreground">Oferta semanal, perdas, armazenagem e compra emergencial fechadas</p></div><Switch aria-label="Confirmar estoque e colheita dos alimentos" checked={allocationInputs.feedAvailabilityConfirmed} onCheckedChange={(checked) => updateAllocation('feedAvailabilityConfirmed', checked)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Pico de capacidade conferido</p><p className="text-[9px] text-muted-foreground">Com datas completas, o motor testa a ocupação por semana; sem elas, mantém o teto simultâneo conservador</p></div><Switch aria-label="Confirmar pico de capacidade do cocho" checked={allocationInputs.peakCapacityConfirmed} onCheckedChange={(checked) => updateAllocation('peakCapacityConfirmed', checked)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Calendário anual</p><p className="text-[9px] text-muted-foreground">Este lote e seus preços representam as coortes do ano; sem isso não há escala anual</p></div><Switch aria-label="Confirmar calendário anual de coortes" checked={allocationInputs.annualCalendarConfirmed} onCheckedChange={(checked) => updateAllocation('annualCalendarConfirmed', checked)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Pasto irrigado validado</p><p className="text-[9px] text-muted-foreground">Água, energia, outorga, forragem e lotação suportam a janela e toda a área</p></div><Switch aria-label="Confirmar água, forragem e lotação do pasto irrigado" checked={allocationInputs.pastureWaterForageConfirmed} onCheckedChange={(checked) => updateAllocation('pastureWaterForageConfirmed', checked)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Janela das vacas validada</p><p className="text-[9px] text-muted-foreground">Obrigatório só quando vacas de oportunidade estão ligadas; confirma área, datas e 8 cab/ha</p></div><Switch aria-label="Confirmar janela das vacas de oportunidade" checked={allocationInputs.cowOpportunityWindowConfirmed} disabled={!assumptions.includeCows} onCheckedChange={(checked) => updateAllocation('cowOpportunityWindowConfirmed', checked)} /></div>
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Crédito aplicado do efluente</p><p className="text-[9px] text-muted-foreground">Só libera o volume aplicado após proveniência, período comum, análise, eficiência e requisitos aplicáveis</p></div><Switch aria-label="Confirmar crédito agronômico do efluente" checked={allocationInputs.effluentCreditConfirmed} disabled={!assumptions.includeEffluentSavings || !effluentScale.calibrationReady || !effluentScale.provenanceReady || !effluentScale.excessDestinationReady || effluentScale.currentOwnFeedlotHeadDays <= 0} onCheckedChange={(checked) => updateAllocation('effluentCreditConfirmed', checked)} /></div>
                  </div>
                  {assumptions.includeEffluentSavings ? <div className="mt-3 rounded-xl border border-border/70 bg-white p-3"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5"><label htmlFor="effluent-calibration-source"><span className="mb-1 block text-[9px] text-muted-foreground">Fonte da calibração</span><Input id="effluent-calibration-source" className="h-8 text-xs" placeholder="registro/documento que fecha volume e cabeças-dia" value={allocationInputs.effluentCalibrationSource} onChange={(event) => updateAllocation('effluentCalibrationSource', event.target.value)} /></label><label htmlFor="effluent-calibration-start"><span className="mb-1 block text-[9px] text-muted-foreground">Início do período medido</span><Input id="effluent-calibration-start" className="h-8 text-xs" type="date" value={allocationInputs.effluentCalibrationPeriodStart} onChange={(event) => updateAllocation('effluentCalibrationPeriodStart', event.target.value)} /></label><label htmlFor="effluent-calibration-end"><span className="mb-1 block text-[9px] text-muted-foreground">Fim do período medido</span><Input id="effluent-calibration-end" className="h-8 text-xs" type="date" value={allocationInputs.effluentCalibrationPeriodEnd} onChange={(event) => updateAllocation('effluentCalibrationPeriodEnd', event.target.value)} /></label><label htmlFor="effluent-value-source"><span className="mb-1 block text-[9px] text-muted-foreground">Fonte do valor evitável</span><Input id="effluent-value-source" className="h-8 text-xs" placeholder="memória/orçamento local do R$/m³" value={allocationInputs.effluentValueSource} onChange={(event) => updateAllocation('effluentValueSource', event.target.value)} /></label><label htmlFor="effluent-value-date"><span className="mb-1 block text-[9px] text-muted-foreground">Data do valor evitável</span><Input id="effluent-value-date" className="h-8 text-xs" type="date" value={allocationInputs.effluentValueDate} onChange={(event) => updateAllocation('effluentValueDate', event.target.value)} /></label></div><div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-[#fafbf8] p-3"><div><p className="text-xs font-semibold">Mesmo período e denominador</p><p className="text-[9px] text-muted-foreground">Confirma que volume, 50 ha × 150 mm/ano e 6.725 cab × 95 dias pertencem ao período informado</p></div><Switch aria-label="Confirmar período comum da calibração do efluente" checked={allocationInputs.effluentCalibrationPeriodConfirmed} disabled={!allocationInputs.effluentCalibrationSource.trim() || !effluentScale.calibrationPeriodValid} onCheckedChange={(checked) => updateAllocation('effluentCalibrationPeriodConfirmed', checked)} /></div>{effluentScale.excessRequiresDestination ? <div className="mt-3 grid gap-2 rounded-xl border border-[#e2c37e]/45 bg-[#fff8e9] p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"><label htmlFor="effluent-excess-destination"><span className="mb-1 block text-[9px] text-muted-foreground">Destino operacional dos {int.format(effluentScale.volumeExcessM3)} m³ excedentes</span><Input id="effluent-excess-destination" className="h-8 text-xs" placeholder="destino, período e responsável; ou reduza a escala do cocho" value={allocationInputs.effluentExcessDestination} onChange={(event) => updateAllocation('effluentExcessDestination', event.target.value)} /></label><label htmlFor="effluent-excess-capacity"><span className="mb-1 block text-[9px] text-muted-foreground">Capacidade validada</span><div className="flex items-center gap-1"><NumericInput id="effluent-excess-capacity" className="h-8 text-right font-mono text-xs" min={0} step={1000} value={allocationInputs.effluentExcessDestinationCapacityM3} onValueChange={(numericValue) => updateAllocation('effluentExcessDestinationCapacityM3', Math.max(0, numericValue || 0))} /><span className="text-[9px]">m³/ano</span></div></label><div className="flex items-end"><div className="flex w-full items-center justify-between gap-3 rounded-lg border border-border/70 bg-white p-2"><span className="text-[9px] font-semibold">Rota suporta todo o excedente</span><Switch aria-label="Confirmar destino operacional do excedente" checked={allocationInputs.effluentExcessDestinationConfirmed} disabled={!allocationInputs.effluentExcessDestination.trim() || allocationInputs.effluentExcessDestinationCapacityM3 + 1e-6 < effluentScale.volumeExcessM3} onCheckedChange={(checked) => updateAllocation('effluentExcessDestinationConfirmed', checked)} /></div></div><p className="text-[9px] leading-relaxed text-muted-foreground md:col-span-3">O excedente não recebe crédito na área-alvo. Informe uma rota local comprovável; o simulador não presume armazenamento, área receptora, transferência ou autorização.</p></div> : null}<p className={`mt-3 text-[10px] leading-relaxed ${effluentScale.provenanceReady && effluentScale.excessDestinationReady ? 'text-[#315a3e]' : 'text-[#735a2a]'}`}>{effluentScale.provenanceReady && effluentScale.excessDestinationReady ? 'Proveniência mínima e balanço do excedente fechados; confirme o crédito aplicado no cartão acima.' : effluentScale.blockers.join(' ')}</p></div> : null}
                  {assumptions.includeCows ? <div className="mt-3 grid gap-2 rounded-xl border border-border/70 bg-white p-3 md:grid-cols-2 xl:grid-cols-4"><label htmlFor="cow-buy-quote-date"><span className="mb-1 block text-[9px] text-muted-foreground">Data da compra</span><Input id="cow-buy-quote-date" className="h-8 text-xs" type="date" value={allocationInputs.cowBuyQuoteDate} onChange={(event) => updateAllocation('cowBuyQuoteDate', event.target.value)} /></label><label htmlFor="cow-buy-quote-source"><span className="mb-1 block text-[9px] text-muted-foreground">Fonte da compra</span><Input id="cow-buy-quote-source" className="h-8 text-xs" placeholder="praça, fornecedor ou boletim" value={allocationInputs.cowBuyQuoteSource} onChange={(event) => updateAllocation('cowBuyQuoteSource', event.target.value)} /></label><label htmlFor="cow-sale-quote-date"><span className="mb-1 block text-[9px] text-muted-foreground">Data da venda</span><Input id="cow-sale-quote-date" className="h-8 text-xs" type="date" value={allocationInputs.cowSaleQuoteDate} onChange={(event) => updateAllocation('cowSaleQuoteDate', event.target.value)} /></label><label htmlFor="cow-sale-quote-source"><span className="mb-1 block text-[9px] text-muted-foreground">Fonte da venda</span><Input id="cow-sale-quote-source" className="h-8 text-xs" placeholder="praça, frigorífico ou boletim" value={allocationInputs.cowSaleQuoteSource} onChange={(event) => updateAllocation('cowSaleQuoteSource', event.target.value)} /></label><p className="text-[9px] text-muted-foreground md:col-span-2 xl:col-span-4">Compra: {brl0.format(assumptions.cowBuyCost)}/cab · venda: {brl2.format(assumptions.cowSaleArroba)}/@ · {cowOpportunityPricesValid ? 'fontes recentes válidas' : 'preencha fonte e data'}.</p></div> : null}
                </div>
                <div className="grid gap-3 px-5 pb-5 md:grid-cols-3 lg:px-6">
                  {lotProfiles.map((lot) => {
                    const scheduled = scheduledLotProfiles.find((item) => item.id === lot.id) ?? lot;
                    return <div className="rounded-2xl border border-border/75 bg-[#fafbf8] p-4" key={lot.id}><div className="flex items-start justify-between gap-3"><p className="text-sm font-semibold">{lot.label}</p><Badge variant="outline">datas automáticas</Badge></div><div className="mt-3 grid grid-cols-2 gap-2"><label htmlFor={`lot-share-${lot.id}`}><span className="mb-1 block text-[9px] text-muted-foreground">Participação</span><div className="flex items-center gap-1"><NumericInput id={`lot-share-${lot.id}`} className="h-8 text-right font-mono text-xs" min={0} max={100} step={1} value={lot.share} onValueChange={(numericValue) => updateLotProfile(lot.id, 'share', Math.max(0, numericValue || 0))} /><span className="text-[9px]">%</span></div></label><label htmlFor={`lot-pasture-gmd-${lot.id}`}><span className="mb-1 block text-[9px] text-muted-foreground">GMD observado na recria</span><div className="flex items-center gap-1"><NumericInput id={`lot-pasture-gmd-${lot.id}`} className="h-8 text-right font-mono text-xs" min={-0.5} max={2.5} step={0.01} value={lot.pastureGmd ?? 0} onValueChange={(numericValue) => updateLotProfile(lot.id, 'pastureGmd', numericValue || 0)} /><span className="text-[9px]">kg/d</span></div></label><label htmlFor={`lot-gmd-${lot.id}`}><span className="mb-1 block text-[9px] text-muted-foreground">GMD projetado no cocho</span><div className="flex items-center gap-1"><NumericInput id={`lot-gmd-${lot.id}`} className="h-8 text-right font-mono text-xs" min={0.2} max={3.5} step={0.01} value={lot.gmd} onValueChange={(numericValue) => updateLotProfile(lot.id, 'gmd', Math.max(0.2, numericValue || 0.2))} /><span className="text-[9px]">kg/d</span></div></label><label htmlFor={`lot-dmi-${lot.id}`}><span className="mb-1 block text-[9px] text-muted-foreground">Consumo projetado</span><div className="flex items-center gap-1"><NumericInput id={`lot-dmi-${lot.id}`} className="h-8 text-right font-mono text-xs" min={0} max={40} step={0.1} value={lot.dietDmDay ?? assumptions.dietDmDay} onValueChange={(numericValue) => updateLotProfile(lot.id, 'dietDmDay', Math.max(0, numericValue || 0))} /><span className="text-[9px]">kg MS/d</span></div></label></div><div className="mt-3 rounded-lg border border-[#bfd0bd] bg-[#eef5ef] p-2 text-[10px] text-[#315a3e]"><strong>Janela calculada:</strong> {dateBr(scheduled.entryDate ?? '')} → {dateBr(scheduled.exitDate ?? '')}. Só altere abaixo se houver escalonamento real.</div></div>;
                  })}
                </div>
                <details className="mx-5 mb-3 rounded-xl border border-border/70 bg-[#fafbf8] p-4 lg:mx-6"><summary className="cursor-pointer text-xs font-semibold">Exceção avançada: escalonar datas por lote</summary><p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Por padrão, todos os lotes entram quando atingem o peso de decisão e saem após os dias calculados pelo GMD. Use estas datas somente se houver calendário operacional próprio; limpar um campo restaura o cálculo automático.</p><div className="mt-3 grid gap-3 md:grid-cols-3">{lotProfiles.map((lot) => <div className="rounded-xl border border-border/70 bg-white p-3" key={`schedule-${lot.id}`}><p className="text-xs font-semibold">{lot.label}</p><div className="mt-2 grid grid-cols-2 gap-2"><label htmlFor={`lot-entry-${lot.id}`}><span className="mb-1 block text-[9px] text-muted-foreground">Entrada opcional</span><Input id={`lot-entry-${lot.id}`} className="h-8 px-2 text-[10px]" type="date" value={lot.entryDate ?? ''} onChange={(event) => updateLotProfile(lot.id, 'entryDate', event.target.value)} /></label><label htmlFor={`lot-exit-${lot.id}`}><span className="mb-1 block text-[9px] text-muted-foreground">Saída opcional</span><Input id={`lot-exit-${lot.id}`} className="h-8 px-2 text-[10px]" type="date" value={lot.exitDate ?? ''} onChange={(event) => updateLotProfile(lot.id, 'exitDate', event.target.value)} /></label></div></div>)}</div></details>
                <div className={`mx-5 mb-5 rounded-xl border p-4 text-xs leading-relaxed lg:mx-6 lg:mb-6 ${feedAllocation.calendarMode === 'legacy-conservative' ? 'border-[#e2c37e]/35 bg-[#fff8e9] text-[#735a2a]' : 'border-[#bfd0bd] bg-[#eef5ef] text-[#315a3e]'}`}><strong>Calendário do cocho:</strong> {feedAllocation.calendarMode === 'legacy-conservative' ? `não foi possível derivar uma janela válida da entrada, pesos e GMD. Revise apenas esses dados-base. ${feedAllocation.calendarIssues.join(' ')}` : `gerado automaticamente e testado semana a semana; pico calculado de ${int.format(feedAllocation.concurrentOwnHeads)} cabeças para ${int.format(feedAllocation.concurrentOwnCapacity)} vagas úteis. Datas manuais são opcionais.`}</div>
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="GMD mínimo · próprio vs vender" value={feedAllocation.thresholdOwnVsSell === null ? 'não fecha' : `${two.format(feedAllocation.thresholdOwnVsSell)} kg/d`} note="Margem incremental do cocho próprio = 0" tone="green" />
                  <Metric label="GMD mínimo econômico no cocho" value={feedAllocation.thresholdOwnVsSell === null ? 'não fecha' : `${two.format(feedAllocation.thresholdOwnVsSell)} kg/d`} note="Ponto em que cocho próprio e venda do magro se igualam" tone="lime" />
                  <Metric label="Rota própria calculada" value={`${int.format(feedAllocation.ownHeads)} cab/ano`} note={`${int.format(feedAllocation.concurrentOwnHeads)} / ${int.format(feedAllocation.concurrentOwnCapacity)} cabeças no ${feedAllocation.calendarMode === 'legacy-conservative' ? 'teto conservador' : 'pico semanal calculado'} · ${one.format((feedAllocation.penDaysUsed / Math.max(feedAllocation.penDaysCapacity, 1)) * 100)}% dos vaga-dias`} />
                  <Metric label="Efluente por animal · ciclo-base" value={`${two.format(effluentVolumePerFinishedHeadM3)} m³`} note={`${one.format(effluentAreaPerFinishedHeadHa * 10_000)} m² fertirrigados · ${brl2.format(effluentCreditPerFinishedHead)} bruto/cab`} />
                  <Metric label="Cobertura pela rota própria" value={`${one.format(effluentScale.areaCoveredAtTargetDepthHa)} / ${one.format(effluentScale.targetAreaHa)} ha`} note={`${int.format(effluentScale.availableVolumeM3)} de ${int.format(effluentScale.requiredVolumeM3)} m³`} tone={effluentScale.coveragePercent >= 100 ? 'green' : 'warn'} />
                  <Metric label="Venda antecipada" value={`${int.format(feedAllocation.sellHeads)} cab/ano`} note="Candidatos cujo cocho próprio não maximiza valor sob estas premissas" />
                  <Metric label="Capital total A requerido" value={moneyCompact(integratedCapitalA)} note={`${moneyCompact(preGateCapitalA)} pré-gate + ${moneyCompact(feedAllocation.workingCapitalUsed)} pós-gate + ${moneyCompact(assumptions.investment)} CAPEX incremental · limite ${moneyCompact(strategyCapitalLimit)}`} tone={capitalFeasibleA ? 'plain' : 'warn'} />
                  <Metric label="Faixas com mercado coberto" value={`${feedAllocation.lots.filter((lot) => lot.routeCovered).length}/${feedAllocation.lots.length}`} note={feedAllocation.lots.some((lot) => !lot.routeCovered) ? animalDecisionBlocker : 'Cada GMD usa sua própria data de saída na mesma curva'} tone={feedAllocation.lots.every((lot) => lot.routeCovered) ? 'green' : 'warn'} />
                </div>
                <div className="overflow-x-auto border-t border-border/70">
                  <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Faixa</TableHead><TableHead className="text-right">GMD recria</TableHead><TableHead className="text-right">GMD cocho</TableHead><TableHead className="text-right">Conversão</TableHead><TableHead className="text-right">Dias</TableHead><TableHead className="text-right">Próprio vs vender</TableHead><TableHead className="text-right">Preço máximo milho</TableHead><TableHead className="pr-5 text-right">Roteamento</TableHead></TableRow></TableHeader><TableBody>{feedAllocation.lots.map((lot) => <TableRow key={lot.id}><TableCell className="pl-5 font-semibold">{lot.label}<p className="text-[9px] font-normal text-muted-foreground">{int.format(lot.heads)} cab candidatas</p></TableCell><TableCell className="text-right font-mono text-xs">{two.format(lot.pastureGmd ?? 0)} kg/d</TableCell><TableCell className="text-right font-mono text-xs">{two.format(lot.gmd)} kg/d</TableCell><TableCell className="text-right font-mono text-xs">{two.format(lot.feedConversionDm)} kg MS/kg</TableCell><TableCell className="text-right font-mono text-xs">{int.format(lot.days)}</TableCell><TableCell className={`text-right font-mono text-xs ${lot.routeCovered && lot.ownMarginHead >= 0 ? 'text-[#2d6c45]' : 'text-[#a05a16]'}`}>{lot.routeCovered ? `${brl0.format(lot.ownMarginHead)}/cab` : 'aguarda preço de saída'}</TableCell><TableCell className="text-right font-mono text-xs">{lot.routeCovered ? `${brl2.format(lot.shadowGrainPriceSack)}/sc` : 'n/d'}</TableCell><TableCell className="pr-5 text-right text-xs">{lot.routeCovered ? `${int.format(lot.ownHeads)} próprio · ${int.format(lot.sellHeads)} venda` : 'preencha curva/elegibilidade'}</TableCell></TableRow>)}</TableBody></Table>
                </div>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-3 text-[11px] leading-relaxed text-muted-foreground"><strong>Critério:</strong> valor presente da receita líquida do boi terminado − valor-cenário do magro na decisão − valor presente de dieta e operação. O GMD observado na recria não comanda a venda: ganho compensatório e consumo podem inverter a ordem. O roteamento usa GMD e CMS esperados no cocho, preço de saída, conversão, vaga e capital; sem esses dados, a linha indica exatamente o campo a preencher.</div>
                <div className="border-t border-border/70 bg-[#fff8e9] px-5 py-3 text-[11px] leading-relaxed text-[#735a2a]"><strong>O que a evidência permite afirmar:</strong> desempenho baixo na recria merece diagnóstico, mas não venda automática. Em dados discutidos na literatura, animais de menor ganho prévio podem apresentar ganho compensatório; e a <a className="font-semibold underline" href="https://locus.ufv.br/bitstreams/30ca36f0-56ca-4e61-bcc9-65016bc07157/download" rel="noreferrer" target="_blank">tese de Pedro Veiga Paulino</a> mostra que animais com o mesmo GMD podem consumir quantidades diferentes. Por isso o simulador separa GMD da recria, GMD do cocho e CMS.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Milho: caixa ou cocho" title="Destino econômico do grão e da silagem" text="O preço de indiferença mostra quanto cada lote suporta pagar por saca. É diagnóstico médio dos lotes usados, não o dual da próxima tranche; a decisão efetiva vem do LP com todas as restrições." />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Control label="Área de milho-grão" value={allocationInputs.grainAreaHa} suffix="ha a montante" min={0} max={10000} step={10} onChange={(value) => updateAllocation('grainAreaHa', value)} />
                  <Control label="Valor alternativo da silagem" value={allocationInputs.silageOpportunityCostDm} suffix="R$/kg MS" min={0} max={5} step={0.01} onChange={(value) => updateAllocation('silageOpportunityCostDm', value)} />
                  <EditValue label="Milho comprado entregue" value={brl2.format(allocationInputs.grainPurchasePriceSack) + '/sc 60 kg'} onEdit={() => openEditor('feed', 'Milho comprado · preço entregue')} />
                  <Control label="Silagem comprada entregue" value={allocationInputs.purchasedSilageCostDm} suffix="R$/kg MS" min={0} max={5} step={0.01} onChange={(value) => updateAllocation('purchasedSilageCostDm', value)} />
                  <div className="flex items-center justify-between gap-4 rounded-xl border border-border/70 p-3 md:col-span-2"><div><p className="text-xs font-semibold">Permitir compra externa de alimento</p><p className="text-[10px] text-muted-foreground">Ligado: o cocho pode comprar o déficit; desligado: milho e silagem próprios limitam a escala</p></div><Switch aria-label="Permitir compra externa de alimento" checked={allocationInputs.allowPurchasedFeed} onCheckedChange={(checked) => updateAllocation('allowPurchasedFeed', checked)} /></div>
                </div>
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="Milho produzido" value={`${int.format(feedAllocation.grainProducedSacks)} sc/ano`} note={`${one.format(allocationInputs.grainAreaHa)} ha × ${one.format(cornFeedCrop.yield)} sc/ha`} />
                  <Metric label="Milho no cocho próprio" value={`${int.format(feedAllocation.grainDemandSacks)} sc/ano`} note={`${int.format(feedAllocation.ownGrainUsedSacks)} próprias + ${int.format(feedAllocation.purchasedGrainSacks)} compradas`} />
                  <Metric label="Milho vendido" value={`${int.format(feedAllocation.soldGrainSacks)} sc/ano`} note={`${brl2.format(cornRetainedPrice)}/sc líquido informado`} tone="green" />
                  <Metric label="Preço de indiferença médio" value={feedAllocation.grainDemandSacks > 0 ? `${brl2.format(feedAllocation.weightedShadowGrain)}/sc` : 'sem consumo'} note={`Não é dual marginal · mercado líquido: ${brl2.format(cornRetainedPrice)}/sc`} tone={feedAllocation.weightedShadowGrain >= cornRetainedPrice ? 'lime' : 'warn'} />
                  <Metric label="Custo econômico do milho no cocho" value={`${brl2.format(feedAllocation.effectiveGrainCostDm)}/kg MS`} note={`${percentage(feedAllocation.ownGrainShare * 100)} próprio a valor de oportunidade; déficit a ${brl2.format(allocationInputs.grainPurchasePriceSack)}/sc`} />
                  <Metric label="Custo econômico da silagem" value={`${brl2.format(feedAllocation.effectiveSilageCostDm)}/kg MS`} note={`${percentage(feedAllocation.ownSilageShare * 100)} própria; déficit a ${brl2.format(allocationInputs.purchasedSilageCostDm)}/kg MS`} />
                  <Metric label="Spread do milho alocado" value={moneyCompact(feedAllocation.allocationValueVsSell)} note="Valor-sombra menos venda externa, aplicado às sacas próprias consumidas" tone={feedAllocation.allocationValueVsSell >= 0 ? 'green' : 'warn'} />
                  <Metric label="Silagem consumida" value={`${int.format(feedAllocation.silageDemandDmKg / 1_000)} t MS/ano`} note={`${int.format(feedAllocation.purchasedSilageDmKg / 1_000)} t MS externas`} />
                  <Metric label="Estoque final de silagem" value={`${int.format(linkedSilageEndingStockDmKg / 1_000)} t MS`} note="Sem receita recorrente: só vira venda se houver contrato, preço e saída física explícitos" tone={linkedSilageEndingStockDmKg > linkedSilageProducedDmKg * 0.1 ? 'warn' : 'plain'} />
                  <Metric label="Próximo ha como grão" value={`${brl0.format(feedAllocation.grainContributionHa)}/ha`} note="Receita líquida do grão − custo caixa informado" />
                  <Metric label="Silagem ao break-even médio" value={`${brl0.format(feedAllocation.silageContributionHa)}/ha`} note="Valoração indicativa; não representa o ganho dual do próximo hectare" tone={feedAllocation.silageContributionHa >= feedAllocation.grainContributionHa ? 'lime' : 'warn'} />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#bfd0bd] bg-[#eef5ef] p-4 text-xs leading-relaxed text-[#315a3e] lg:mx-6 lg:mb-6"><strong>Trava econômica:</strong> alimentar só cria valor quando o valor-sombra do lote supera o preço líquido de venda do grão e a silagem também remunera mais que o uso alternativo do hectare. Se o mercado pagar mais, o modelo direciona o milho à venda e testa se o animal também deve ser vendido no magro. Compras externas aparecem como déficit, nunca como produção própria.</div>
              </Panel>
            </TabsContent>

            <TabsContent value="compare" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow={`Mesma base irrigada · ${int.format(assumptions.totalArea)} ha`} title="Qual uso entrega mais margem por hectare?" text={`Comparação anual em regime pleno com a base fornecida. A entrada do gado ancora uma janela operacional separada de ${COMMON_HORIZON_DAYS} dias: plantio, colheita e disponibilidade são derivados para Barra/BA, enquanto capacidade, preço atual e caixa aparecem como alertas de execução.`} />
                <div className="h-[330px] p-4 sm:p-6">
                  {activeTab === 'compare' ? <Suspense fallback={<output>Carregando gráfico… A tabela continua disponível abaixo.</output>}><MarginChart rows={rankableComparisons.map(row => ({ name: row.label.replace('Pecuária ', 'Pec. '), value: Math.round(row.marginHa) }))} /></Suspense> : null}
                </div>
                <div className="grid gap-3 border-t border-border/70 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Janela operacional" value={`${dateBr(automaticCalendar.anchorDate)} → ${dateBr(automaticCalendar.horizonEndDate)}`} note={`${COMMON_HORIZON_DAYS} dias · não é o fluxo anual do ranking · Barra/BA`} />
                  <Metric label="Soja automática" value={`${dateBr(automaticCalendar.crops['soy-irrigated'].plantDate)} → ${dateBr(automaticCalendar.crops['soy-irrigated'].harvestDate)}`} note={`${automaticCalendar.crops['soy-irrigated'].waitingDays} dias de espera · vazio 01/08–31/10`} tone="green" />
                  <Metric label="Milho 2ª safra automático" value={`${dateBr(automaticCalendar.crops['corn-irrigated'].plantDate)} → ${dateBr(automaticCalendar.crops['corn-irrigated'].harvestDate)}`} note="Janela central da sucessão soja→milho · sem receita/custo da soja no cenário isolado" />
                  <Metric label="Algodão automático" value={`${dateBr(automaticCalendar.crops['cotton-irrigated'].plantDate)} → ${dateBr(automaticCalendar.crops['cotton-irrigated'].harvestDate)}`} note={`${automaticCalendar.crops['cotton-irrigated'].waitingDays} dias de espera · ciclo de 243 dias a validar`} tone="warn" />
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Comparativo completo" title="Receita, custo, margem, retorno e equilíbrio" />
                <Table>
                  <TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Alternativa</TableHead><TableHead>Produção</TableHead><TableHead className="text-right">Receita líquida</TableHead><TableHead className="text-right">Custo operacional</TableHead><TableHead className="text-right">Margem anual</TableHead><TableHead className="text-right">Margem/ha</TableHead><TableHead className="text-right">Margem/custo</TableHead><TableHead className="text-right">Funding indicativo</TableHead><TableHead className="pr-5 text-right">Equilíbrio</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {comparisons.map((row) => (
                      <TableRow key={row.id} className={row.id === best.id ? 'bg-[#f2f7da]/65' : ''}>
                        <TableCell className="pl-5"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{row.label}</span>{row.rankable && row.id === best.id ? <Badge className={scenarioMode === 'exploration' ? 'bg-[#f2c879] text-[#68460c]' : 'bg-[#d7f06b] text-[#173724]'}>{scenarioMode === 'exploration' ? 'maior margem do exemplo' : 'maior margem anual modelada'}</Badge> : !row.rankable ? <Badge className="bg-[#f2c879] text-[#68460c]">fora da comparação</Badge> : null}<Badge variant="outline">{row.evidenceLevel === 'preflight-validated' ? 'pré-validado' : 'base da planilha'}</Badge></div><p className="mt-1 text-[10px] text-muted-foreground">{row.blocker ?? row.warning ?? row.source}</p></TableCell>
                        <TableCell className="text-xs">{row.production}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{row.rankable ? moneyCompact(row.revenue) : 'n/d'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{row.rankable ? moneyCompact(row.cost) : 'n/d'}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">{row.rankable ? moneyCompact(row.margin) : 'n/d'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{row.rankable ? brl0.format(row.marginHa) : 'n/d'}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{row.rankable ? percentage(row.roi) : 'n/d'}</TableCell>
                        <TableCell className={`text-right font-mono text-xs ${row.capitalFeasible ? '' : 'text-[#9b4b2f]'}`}>{moneyCompact(row.capitalRequired)}</TableCell>
                        <TableCell className="pr-5 text-right font-mono text-xs">{row.breakEven}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">A tabela mantém todas as alternativas; o destaque seleciona a maior margem operacional entre as calculáveis que cabem no orçamento estimado. Não é ranking por VPL. Capital considera pico de caixa modelado, pisos de custeio, implantação, CAPEX novo informado e reserva; recria C também reserva recursos para concluir a fase além do ano 1. “Margem/custo” não é retorno sobre patrimônio. Deduções comerciais são abatidas uma única vez. Os calendários simplificados não substituem lotes, orçamento de campo e financiamento. Compra da terra, tributos não parametrizados e serviço da dívida continuam fora.</div>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Mapa de equilíbrio" title="Distância de preço e produtividade até a margem zero" text="Sensibilidade determinística: mostra o ponto de margem zero e quando uma alternativa ultrapassa outra, mantendo as demais premissas constantes. Não mede probabilidade nem segurança." />
                <div className="grid gap-3 border-b border-border/70 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Área atual" value={`${int.format(assumptions.totalArea)} ha`} note="Base usada no ranking" />
                  <Metric label="Área e investimento incremental" value="recalcular por escala" note="A amostragem do simulador rápido mantém CAPEX e vagas fixos. Não extrapole margem por hectare." tone="warn" />
                  <label className="rounded-2xl border border-border/80 bg-card p-4" htmlFor="pivot-capex-equilibrium"><span className="text-[11px] font-medium text-muted-foreground">CAPEX comum do pivô</span><NumericInput className="mt-2 h-9 bg-background text-right font-mono text-sm" id="pivot-capex-equilibrium" min={0} step={100000} value={assumptions.pivotInvestment} onValueChange={(numericValue) => update('pivotInvestment', Math.max(0, numericValue || 0))} /><span className="mt-1.5 block text-[10px] text-muted-foreground">Informe projeto, bombas, energia e infraestrutura comum.</span></label>
                  <Metric label="Limite indicativo de CAPEX comum" value={maxCommonPivotInvestment === null ? 'aguarda alternativa válida' : moneyCompact(maxCommonPivotInvestment)} note={maxCommonPivotInvestment === null ? 'Preencha ao menos uma alternativa comparável' : `Fluxo simplificado na área atual · maior margem: ${best.label}`} tone={maxCommonPivotInvestment === null ? 'warn' : 'lime'} />
                </div>
                <BreakEvenTable rows={breakEvenRows} />
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">As áreas mínimas são triagem com o CAPEX informado mantido fixo; o modelo não redimensiona pivô, bombas, rede elétrica ou confinamento. Na soja + milho, o índice 100 representa os dois preços e as duas produtividades atuais e não substitui a análise separada de janela, água e capacidade operacional.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Mesa de preços" title="A base já roda; mercado atual é uma atualização opcional" text="Os preços da planilha entram imediatamente. Quando quiser confrontá-los com o mercado, busque a referência semanal da CONAB por UF, ajuste o basis da praça ou force um cenário. O relatório preserva a origem de cada valor." action={<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => applyPriceShock(0.85)}>Cenário de preços −15%</Button><Button size="sm" variant="outline" onClick={() => applyPriceShock(1.15)}>Cenário de preços +15%</Button><Button size="sm" variant="outline" onClick={() => applyCostShock(1.2)}>Ração, suplemento e lavoura +20%</Button></div>} />
                <div className="mx-5 mt-5 flex flex-col gap-3 rounded-2xl border border-[#bfd0bd] bg-[#eef5ef] p-4 sm:flex-row sm:items-end sm:justify-between lg:mx-6">
                  <div>
                    <p className="text-xs font-semibold">Dados públicos · CONAB</p>
                    <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">{marketStatus}</p>
                  </div>
                  <div className="flex shrink-0 items-end gap-2">
                    <label htmlFor="market-uf"><span className="mb-1 block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">UF da praça</span><select className="h-9 rounded-lg border border-input bg-white px-3 text-xs" id="market-uf" value={marketUf} onChange={(event) => setMarketUf(event.target.value)}>{marketUfOptions.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></label>
                    <Button disabled={marketLoading} size="sm" onClick={fetchMarketPrices}><RefreshCw className={`mr-2 size-3.5 ${marketLoading ? 'animate-spin' : ''}`} />{marketLoading ? 'Buscando' : 'Buscar CONAB'}</Button>
                  </div>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  {marketQuotes.map((quote) => {
                    const appliedPrice = quote.id === 'cattle'
                      ? assumptions.priceArroba
                      : crops.find((crop) => crop.id === quote.id)?.price ?? 0;
                    const dateId = `market-${quote.id}-date`;
                    const referenceId = `market-${quote.id}-reference`;
                    const basisId = `market-${quote.id}-basis`;
                    const quoteAgeDays = isoAgeDays(quote.date, asOfDate);
                    const quoteDateValid =
                      quoteAgeDays !== null &&
                      quoteAgeDays >= 0 &&
                      quoteAgeDays <= MAX_PHYSICAL_QUOTE_AGE_DAYS;
                    return (
                      <div className="rounded-2xl border border-border/75 bg-[#fafbf8] p-4" key={quote.id}>
                        <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{quote.label}</p><p className="mt-1 text-[10px] text-muted-foreground">{quote.market}</p></div><div className="flex flex-col items-end gap-1"><Badge variant="outline">{quote.unit}</Badge><Badge variant="outline">{quote.provenance === 'conab-official' ? 'CONAB oficial' : quote.provenance === 'manual-override' ? 'override manual' : 'hipótese inicial'}</Badge></div></div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <label className="col-span-2" htmlFor={dateId}><span className="mb-1 block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Data da referência</span><Input className="h-8 text-xs" id={dateId} type="date" value={quote.date} onChange={(event) => updateMarketQuote(quote.id, 'date', event.target.value)} /></label>
                          <label htmlFor={referenceId}><span className="mb-1 block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Indicador</span><NumericInput className="h-8 font-mono text-xs" id={referenceId} min={0} step={0.01} value={Number(quote.reference.toFixed(2))} onValueChange={(numericValue) => updateMarketQuote(quote.id, 'reference', Math.max(0, numericValue || 0))} /></label>
                          <label htmlFor={basisId}><span className="mb-1 block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Basis local</span><NumericInput className="h-8 font-mono text-xs" id={basisId} step={0.01} value={Number(quote.basis.toFixed(2))} onValueChange={(numericValue) => updateMarketQuote(quote.id, 'basis', numericValue || 0)} /></label>
                        </div>
                        <div className="mt-3 rounded-xl bg-white p-3"><p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Preço no cenário</p><p className="mt-1 font-mono text-lg font-semibold">{brl2.format(appliedPrice)}</p><p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">{appliedPriceMeta[quote.id].provenance} · {appliedPriceMeta[quote.id].date || 'sem data observada'} · {appliedPriceMeta[quote.id].source}</p></div>
                        {quote.officialReference ? <div className="mt-2 rounded-xl border border-[#bfd0bd] bg-[#eef5ef] p-3"><p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Última referência oficial preservada</p><p className="mt-1 font-mono text-sm font-semibold">{brl2.format(quote.officialReference)} <span className="font-sans text-[10px] font-normal text-muted-foreground">{quote.officialUnit} · {quote.officialDate || 'data n/d'}</span></p></div> : null}
                        <div className="mt-3 flex gap-2"><Button className="flex-1" disabled={!quoteDateValid} size="sm" onClick={() => applyMarketQuote(quote)}>{quoteDateValid ? `Aplicar ${brl2.format(quote.reference + quote.basis)}` : 'Data ausente ou vencida'}</Button><a aria-label={`Abrir referência de ${quote.label}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white transition hover:bg-muted" href={quote.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" /></a></div>
                        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{quote.note}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Por que confirmar manualmente?</strong> Indicador não é preço líquido da fazenda. Praça, qualidade, frete, impostos, prazo e unidade podem inverter o ranking. A pesquisa pública é carregada sob demanda, com atribuição à CONAB; confirme as condições de reutilização antes de uso comercial.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Premissas agrícolas editáveis" title="Somente irrigado em regime pleno" text="A base evita comparar pecuária intensiva com área de abertura. Produtividade, preço e custo operacional no escopo continuam editáveis." />
                <div className="grid gap-4 p-5 lg:grid-cols-2 lg:p-6">
                  <div className="rounded-2xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 lg:col-span-2">
                    <div><p className="font-semibold">Calendário automático + pré-validações</p><p className="mt-1 text-[10px] text-muted-foreground">A entrada do gado é o único marco preenchido. O modelo deriva o primeiro plantio regular, a colheita e a janela comercial para Barra/BA. Água, energia e máquinas confirmam apenas capacidade básica; escala diária e custos abertos ainda precisam fechar antes da execução.</p></div>
                    <div className="mt-4 grid gap-3 xl:grid-cols-3">
                      {crops.map((crop) => {
                        const gate = cropOperational[crop.id];
                        const calendar = automaticCalendar.crops[crop.id];
                        return (
                          <div className="rounded-xl border border-border/70 bg-white p-3" key={`gate-${crop.id}`}>
                            <div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">{crop.name}</p><Badge variant="outline">{singleCropCapacityReady(crop.id) ? 'capacidade básica confirmada' : !calendar.sanitaryFit ? 'conflito sanitário' : calendar.completedWithinHorizon ? 'calendário pronto' : 'fora da janela operacional'}</Badge></div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                              <div className="rounded-lg bg-[#f4f7f1] p-2"><span className="block text-[9px] text-muted-foreground">Plantio automático</span><strong className="mt-1 block font-mono text-[11px]">{dateBr(calendar.plantDate)}</strong></div>
                              <div className="rounded-lg bg-[#f4f7f1] p-2"><span className="block text-[9px] text-muted-foreground">Colheita estimada</span><strong className="mt-1 block font-mono text-[11px]">{dateBr(calendar.harvestDate)}</strong></div>
                            </div>
                            <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">{calendar.cycleDays} dias · espera {calendar.waitingDays} dias · janela {calendar.legalWindow}. {calendar.legalAct}. {calendar.legalBasis === 'projected-repeat' ? 'Regra futura projetada: reconfirmar o ato da safra.' : calendar.legalBasis === 'not-applicable' ? 'Sem vazio legal fixo identificado na revisão.' : 'Ato 2026/27 aplicado.'} Revisado em {dateBr(calendar.rulesCheckedAt)}.</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-[9px]"><a className="inline-flex items-center gap-1 text-[#315a3e] underline underline-offset-2" href={calendar.officialRegistryUrl} rel="noreferrer" target="_blank">registro/página oficial <ExternalLink className="size-2.5" /></a>{calendar.legalSourceUrl !== calendar.officialRegistryUrl ? <a className="inline-flex items-center gap-1 text-[#315a3e] underline underline-offset-2" href={calendar.legalSourceUrl} rel="noreferrer" target="_blank">{calendar.legalSourceLabel} <ExternalLink className="size-2.5" /></a> : null}<a className="inline-flex items-center gap-1 text-[#315a3e] underline underline-offset-2" href={calendar.cycleSourceUrl} rel="noreferrer" target="_blank">ZARC oficial <ExternalLink className="size-2.5" /></a></div>
                            <div className="mt-3 space-y-3">
                              {([
                                ['waterEnergyConfirmed', 'waterEnergyCapacityHa', 'Água e energia', 'lâmina, outorga, bomba e tarifa'],
                                ['machineCapacityConfirmed', 'machineCapacityHa', 'Máquinas e operação', 'tratos, colheita, secagem e logística'],
                              ] as const).map(([confirmationKey, capacityKey, label, note]) => (
                                <div className="rounded-lg border border-border/60 p-2" key={`${crop.id}-${confirmationKey}`}><div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-medium">{label}</p><p className="text-[9px] text-muted-foreground">{note}</p></div><Switch aria-label={`Confirmar ${label.toLowerCase()} de ${crop.name}`} checked={gate[confirmationKey]} onCheckedChange={(checked) => setCropOperational((current) => ({ ...current, [crop.id]: { ...current[crop.id], [confirmationKey]: checked } }))} /></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] text-muted-foreground">Capacidade comprovada</span><span className="flex items-center gap-1"><NumericInput aria-label={`Capacidade em hectares de ${label.toLowerCase()} para ${crop.name}`} className="h-7 w-24 text-right font-mono text-[10px]" min={0} value={gate[capacityKey]} onValueChange={(numericValue) => setCropOperational((current) => ({ ...current, [crop.id]: { ...current[crop.id], [capacityKey]: Math.max(0, numericValue || 0), [confirmationKey]: false } }))} /><span className="text-[9px] text-muted-foreground">ha</span></span></div></div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  {crops.map((crop) => {
                    const calc = calculateCrop(crop, assumptions.totalArea, assumptions.landLeaseHa);
                    return (
                      <div className="rounded-2xl border border-border/75 p-4" key={crop.id}>
                        <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{crop.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{crop.farm} · {crop.season}</p></div><Badge variant="outline">{brl0.format(calc.marginHa)}/ha</Badge></div>
                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <EditValue label="Produtividade" value={two.format(crop.yield) + ' ' + crop.unit} onEdit={() => openEditor('crops', 'Produtividade · ' + crop.shortName)} />
                          <EditValue label="Preço de venda" value={brl2.format(crop.price) + '/' + crop.unit.split('/')[0]} onEdit={() => openEditor('crops', 'Preço de venda · ' + crop.shortName)} />
                          {([['deductionRate', 'Deduções %', crop.deductionRate], ['fixedCostHa', 'Fixos R$/ha/safra', cropFixedCostHa(crop)]] as const).map(([key, label, value]) => (
                            <label key={key}><span className="mb-1 block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span><NumericInput className="h-8 font-mono text-xs" min={0} step={0.01} value={Number(value.toFixed(2))} onValueChange={(numericValue) => updateCrop(crop.id, key, numericValue || 0)} /></label>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground"><span>Custo direto: <strong className="font-mono text-foreground">{brl2.format(calc.directCostHa)}/ha</strong></span><span>Arrendamento: <strong className="font-mono text-foreground">{brl2.format(assumptions.landLeaseHa)}/ha</strong></span><span>Equilíbrio: <strong className="font-mono text-foreground">{calc.breakEvenPrice ? brl2.format(calc.breakEvenPrice) : 'n/d'}</strong></span></div>
                        <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">{crop.note}</p>
                      </div>
                    );
                  })}
                  <div className="rounded-2xl border border-[#bfd0bd] bg-[#eef5ef] p-4 lg:col-span-2">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Soja + milho · calendário automático</p><p className="mt-1 text-[10px] text-muted-foreground">Sequência derivada do marco do gado: soja no primeiro dia regular, 5 dias de transição e milho de 120 dias. A margem anual em regime pleno permanece no ranking; esta janela qualifica disponibilidade física e contratos.</p></div><Badge variant="outline">{doubleCropCapacityReady ? 'capacidade básica confirmada' : automaticCalendar.doubleCrop.completedWithinHorizon ? 'calendário pronto' : 'fora da janela operacional'}</Badge></div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {([
                        ['Plantio da soja', automaticCalendar.doubleCrop.soyPlantDate],
                        ['Colheita da soja', automaticCalendar.doubleCrop.soyHarvestDate],
                        ['Plantio do milho', automaticCalendar.doubleCrop.cornPlantDate],
                        ['Colheita do milho', automaticCalendar.doubleCrop.cornHarvestDate],
                      ] as const).map(([label, value]) => <div className="rounded-xl border border-border/70 bg-white p-3" key={label}><span className="block text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{label}</span><strong className="mt-1 block font-mono text-xs">{dateBr(value)}</strong></div>)}
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {([
                        ['waterEnergyConfirmed', 'waterEnergyCapacityHa', 'Água e energia confirmadas', 'Lâmina, outorga, bomba e tarifa cobrem as duas safras nas datas acima'],
                        ['machineCapacityConfirmed', 'machineCapacityHa', 'Máquinas e operação confirmadas', 'Colheita da soja, plantio do milho e tratos cabem sem sobreposição inviável'],
                      ] as const).map(([confirmationKey, capacityKey, label, note]) => (
                        <div className="rounded-xl border border-border/70 bg-white p-3" key={confirmationKey}><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold">{label}</p><p className="text-[9px] text-muted-foreground">{note}</p></div><Switch aria-label={`${label} da dupla safra`} checked={doubleCropCalendar[confirmationKey]} onCheckedChange={(checked) => setDoubleCropCalendar((current) => ({ ...current, [confirmationKey]: checked }))} /></div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-[9px] text-muted-foreground">Capacidade comprovada</span><span className="flex items-center gap-1"><NumericInput aria-label={`Capacidade em hectares de ${label.toLowerCase()} da dupla safra`} className="h-7 w-24 text-right font-mono text-[10px]" min={0} value={doubleCropCalendar[capacityKey]} onValueChange={(numericValue) => setDoubleCropCalendar((current) => ({ ...current, [capacityKey]: Math.max(0, numericValue || 0), [confirmationKey]: false }))} /><span className="text-[9px] text-muted-foreground">ha</span></span></div></div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a]">
                    <strong>Regra de comparabilidade:</strong> sequeiro e ano 1 não entram no ranking. O cenário-base assume 200 sc/ha de milho, 80 sc/ha de soja e 380 @/ha de algodão; valide cada produtividade. Soja + milho só fecha quando a segunda safra cabe em água, janela, máquinas e caixa.
                  </div>
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="costs" className="space-y-5">
              <div className="rounded-xl border bg-card p-4 text-sm">
                <label className="font-semibold" htmlFor="cost-edit-mode">Ao editar os itens de custo</label>
                <select id="cost-edit-mode" className="ml-3 rounded-lg border bg-white p-2" value={costEditMode} onChange={(e) => setCostEditMode(e.target.value === 'classify' ? 'classify' : 'stress')}>
                  <option value="stress">Alterar o custo total (simular aumento/redução)</option>
                  <option value="classify">Detalhar o orçamento de milho (compensar saldo não classificado)</option>
                </select>
                <p className="mt-2">{costEditMode === 'stress' ? 'Cada real alterado muda o total; o saldo agregado permanece. Se o item já está dentro desse saldo, detalhe o orçamento primeiro.' : 'A alteração de um item do milho consome ou devolve o saldo não classificado; excedentes aumentam o orçamento. Não é teste de aumento de preço.'}</p>
              </div>
              <Panel>
                <SectionTitle eyebrow="Integração lavoura → cocho" title="Milho e silagem locais formam o custo estimado da dieta" text="Quando o vínculo está ativo, qualquer alteração no orçamento do milho, na produtividade, nos cortes, na recuperação da silagem ou nos custos complementares recalcula o confinamento, o ponto A×B e a área mínima." action={<Badge className={assumptions.linkFeedToCropCosts ? 'bg-[#d7f06b] text-[#183b28]' : 'bg-[#e8edf0] text-[#3e4f59]'}>{assumptions.linkFeedToCropCosts ? 'vínculo ativo' : 'dieta manual'}</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Silagem local" value={`${brl2.format(silageCostDm)}/kg MS`} note={`${one.format(assumptions.silageYieldDm)} t MS/ha/corte × ${assumptions.silageCrops} cortes × ${one.format(assumptions.silageRecovery)}%`} tone="green" />
                  <Metric label="Milho próprio valorado" value={`${brl2.format(cornOwnValuationDm)}/kg MS`} note={`${assumptions.feedUseOpportunityCost ? 'Preço líquido de oportunidade' : 'Custo caixa local'} · ${one.format(cornFeedCrop.yield)} sc/ha · 88% MS`} />
                  <Metric label="Milho externo entregue" value={`${brl2.format(cornPurchaseCostDm)}/kg MS`} note={`${brl2.format(allocationInputs.grainPurchasePriceSack)}/sc; aplicado ao déficit físico`} tone={purchasedGrainShare > 0 ? 'warn' : 'plain'} />
                  <Metric label="Mistura próprio + comprado" value={`${brl2.format(cornGrainCostDm)}/kg MS`} note={`${percentage((1 - purchasedGrainShare) * 100)} próprio + ${percentage(purchasedGrainShare * 100)} externo`} />
                  <Metric label="Complemento + mistura por kg MS total" value={`${brl2.format(assumptions.dietOtherCostDm)}/kg MS`} note="Proteína, mineral, mistura, frete e quebras" />
                  <Metric label="Dieta efetiva" value={`${brl2.format(modelAssumptions.dietPriceDm)}/kg MS`} note={`${one.format(assumptions.forageShare)}% forragem · ${one.format(100 - assumptions.forageShare)}% concentrado`} tone="lime" />
                  <Metric label="Demanda de milho-grão" value={`${int.format(annualCornSacks)} sc/ano`} note={`${int.format(annualGrainDmTonnes)} t MS no ano`} tone="warn" />
                  <Metric label="Área equivalente externa" value={`${one.format(equivalentCornArea)} ha`} note={`A ${one.format(cornFeedCrop.yield)} sc/ha`} tone="warn" />
                  <Metric label="Área-base pecuária" value={`${one.format(assumptions.totalArea)} ha`} note="Pasto irrigado + silagem" />
                  <Metric label="Footprint a montante" value={`${one.format(upstreamLandFootprint)} ha`} note="Área-base + milho equivalente" />
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#bfd0bd] bg-[#eef5ef] p-4 text-xs leading-relaxed text-[#315a3e] lg:mx-6 lg:mb-6"><strong>Fórmula rastreável:</strong> orçamento de cada corte ÷ matéria seca recuperada da silagem; milho próprio a custo de oportunidade (ou caixa, se selecionado) e qualquer déficit ao preço entregue informado. A área de silagem é custeada integralmente: sobra física não desaparece do custo. Depois entram núcleo, mistura e perdas. Custos fixos já incorridos não reduzem o custo de oportunidade.</div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Limite físico:</strong> a fração de milho é o restante da dieta após silagem e demais ingredientes. Informe a participação dos complementos em Premissas & caixa; o valor por kg de dieta não substitui uma formulação nutricional. O footprint de {one.format(upstreamLandFootprint)} ha é uma equivalência de suprimento, não uma alocação automática dentro dos {one.format(assumptions.totalArea)} ha.</div>
              </Panel>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel><SectionTitle eyebrow="Pecuária A" title="Custo econômico por boi terminado" text="240 kg na entrada; recria no pivô e acabamento no cocho. A origem própria entra pelo custo de oportunidade; o desembolso aparece separado." /><div className="p-5 lg:p-6">{result.soldA > 0 ? <CostRows rows={[["Entrada econômica", effectiveReplacementCostHead], ["Frete de compra", result.costComponentsA.freightIn], ["Suplementação no pivô", result.costComponentsA.supplement], ["Dieta de confinamento", result.costComponentsA.feedlotDiet], ["Operação do confinamento", result.costComponentsA.feedlotOperation], ["Sanidade e manejo", result.costComponentsA.health], ["Frete de venda", result.costComponentsA.freightOut], ["Pivô, energia e manutenção", result.costComponentsA.pivotOperation], ["Custeio das perdas por fase", result.mortalityCostHeadA]]} total={staticEconomicCostHeadA} /> : <p className="text-sm">Sem animais vendidos: custo e margem por vendido não se aplicam. Os custos anuais da área permanecem no comparativo.</p>}<div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Margem econômica/cab" value={result.soldA > 0 ? brl2.format(staticEconomicMarginHeadA) : 'n/d · sem vendas'} tone="green" /><Metric label="Desembolso estimado/cab" value={result.soldA > 0 ? brl2.format(staticCashCostHeadA) : 'n/d · sem vendas'} note="Entrada própria pelo custo caixa; não inclui CAPEX da matriz" /></div></div></Panel>
                <Panel><SectionTitle eyebrow="Pecuária B" title="Custo econômico por boi terminado" text="240 a 540 kg inteiramente no pivô. A demanda anual distinta recalcula a proporção entre bezerros próprios e comprados." /><div className="p-5 lg:p-6">{result.soldB > 0 ? <CostRows rows={[["Entrada econômica", effectiveReplacementCostHeadB], ["Frete de compra", result.costComponentsB.freightIn], ["Suplementação no pivô", result.costComponentsB.supplement], ["Sanidade e manejo", result.costComponentsB.health], ["Frete de venda", result.costComponentsB.freightOut], ["Pivô, energia e manutenção", result.costComponentsB.pivotOperation]]} total={staticEconomicCostHeadB} /> : <p className="text-sm">Sem animais vendidos: custo e margem por vendido não se aplicam. Os custos anuais da área permanecem no comparativo.</p>}<div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Margem econômica/cab" value={result.soldB > 0 ? brl2.format(staticEconomicMarginHeadB) : 'n/d · sem vendas'} tone="green" /><Metric label="Desembolso estimado/cab" value={result.soldB > 0 ? brl2.format(staticCashCostHeadB) : 'n/d · sem vendas'} note="Entrada própria pelo custo caixa; não inclui CAPEX da matriz" /></div></div></Panel>
              </div>

              <Panel>
                <SectionTitle eyebrow="Orçamentos por hectare" title="Abra sementes, calcário, fertilizantes, defensivos e irrigação" text="Cada item é editável. Deduções comerciais, custos fixos e arrendamento entram depois do custo direto para formar o custo operacional no escopo modelado." />
                <div className="grid gap-4 p-5 xl:grid-cols-3 lg:p-6">
                  {crops.map((crop) => {
                    const calc = calculateCrop(crop, assumptions.totalArea, assumptions.landLeaseHa);
                    const isAggregate = crop.costItems.some((item) => item.status === 'underwriting');
                    return (
                      <div className="rounded-2xl border border-border/75 bg-[#fafbf8] p-4" key={crop.id}>
                        <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{crop.shortName}</p><p className="mt-1 text-[10px] text-muted-foreground">R$/ha · valores do cenário</p></div><Badge variant={isAggregate ? 'outline' : 'secondary'}>{isAggregate ? 'hipótese agregada' : 'base fornecida'}</Badge></div>
                        <div className="mt-4 divide-y divide-border/60">
                          {crop.costItems.map((item) => (
                            <label className="flex items-center justify-between gap-3 py-2" key={item.id}><span className="text-[11px] leading-tight text-muted-foreground">{item.label}</span><NumericInput aria-label={`${crop.shortName} — ${item.label}`} className="h-7 w-24 bg-white text-right font-mono text-xs" min={0} step={0.01} value={Number(item.value.toFixed(2))} onValueChange={(numericValue) => updateCropCost(crop.id, item.id, Math.max(0, numericValue || 0))} /></label>
                          ))}
                        </div>
                        <div className="mt-3 space-y-1.5 rounded-xl bg-white p-3 text-[10px]">
                          <div className="flex justify-between"><span>Custo direto</span><strong className="font-mono">{brl2.format(calc.directCostHa)}</strong></div>
                          <div className="flex justify-between"><span>Deduções + fixos</span><strong className="font-mono">{brl2.format(calc.deductionsHa + calc.fixedCostHa)}</strong></div>
                          <div className="flex justify-between"><span>Arrendamento</span><strong className="font-mono">{brl2.format(calc.landLeaseHa)}</strong></div>
                          <div className="flex justify-between border-t border-border/60 pt-1.5 text-xs"><span>Custo no escopo</span><strong className="font-mono">{brl2.format(calc.totalCostHa)}</strong></div>
                        </div>
                        {isAggregate ? <p className="mt-3 text-[10px] leading-relaxed text-[#84611d]">O milho de 200 sc/ha ainda usa custeio agregado. Substitua pelos seus orçamentos antes da decisão.</p> : null}
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Componentes de capital modelados" title={`Desembolso indicativo para operar ${int.format(assumptions.totalArea)} ha`} text="A e B usam o mesmo motor datado do ranking. O capital de giro entra no fluxo no início e é recuperado no terminal; custos econômicos em VP incluem alimento próprio a custo de oportunidade." />
                <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Sistema</TableHead><TableHead className="text-right">Compra de animais</TableHead><TableHead className="text-right">Custo econômico em VP</TableHead><TableHead className="text-right">Giro indicativo</TableHead><TableHead className="pr-5 text-right">Infra / CAPEX</TableHead></TableRow></TableHeader><TableBody>
                  <TableRow><TableCell className="pl-5 font-semibold">Rota A integrada</TableCell><TableCell className="text-right font-mono">{routeIntegrationReady ? moneyCompact(cattlePurchaseA) : 'n/d'}</TableCell><TableCell className="text-right font-mono">{routeIntegrationReady ? moneyCompact(integratedRouteCostA) : 'aguarda dados'}</TableCell><TableCell className="text-right font-mono">{routeIntegrationReady ? moneyCompact(integratedWorkingCapitalA) : 'n/d'}</TableCell><TableCell className="pr-5 text-right font-mono">{moneyCompact(assumptions.pivotInvestment + assumptions.investment)}</TableCell></TableRow>
                  <TableRow><TableCell className="pl-5 font-semibold">Rota B direta + milho comum</TableCell><TableCell className="text-right font-mono">{routeBReady ? moneyCompact(cattlePurchaseB) : 'n/d'}</TableCell><TableCell className="text-right font-mono">{routeBReady ? moneyCompact(routeBSystemCost) : 'aguarda dados'}</TableCell><TableCell className="text-right font-mono">{routeBReady ? moneyCompact(integratedWorkingCapitalB) : 'n/d'}</TableCell><TableCell className="pr-5 text-right font-mono">{moneyCompact(assumptions.pivotInvestment)}</TableCell></TableRow>
                  {cropResults.map((crop) => <TableRow key={crop.id}><TableCell className="pl-5 font-semibold">{crop.name}</TableCell><TableCell className="text-right text-muted-foreground">—</TableCell><TableCell className="text-right font-mono">{moneyCompact(crop.totalCost)}</TableCell><TableCell className="text-right font-mono">{moneyCompact((crop.directCostHa + assumptions.landLeaseHa) * crop.area)}</TableCell><TableCell className="pr-5 text-right font-mono">{moneyCompact(assumptions.pivotInvestment)}</TableCell></TableRow>)}
                </TableBody></Table>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-3 text-[11px] leading-relaxed text-muted-foreground"><strong className="text-foreground">Não some as colunas.</strong> A compra dos animais já está dentro do custo econômico anual. O giro representa o estoque de caixa aproximado recuperado no fim do horizonte; CAPEX é a infraestrutura informada. A cria/matrizes possui capital separado e ainda não compartilha automaticamente o mesmo limite de crédito.</div>
              </Panel>
            </TabsContent>

            <TabsContent value="sensitivity" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow="Auditoria de sensibilidade" title="A matriz estática A × B foi retirada da decisão" text="O mapa antigo variava preço e lotação no motor físico integral, mas ignorava o roteamento datado, a cobertura dos contratos, o alimento marginal e as travas operacionais. Isso podia mostrar VPL mesmo quando todo o lote era vendido no gate. A análise válida agora nasce das rotas abaixo e dos pontos de equilíbrio por alternativa." action={<Badge className="bg-[#ffe1a6] text-[#714817]">sem atalho estático</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Lote anualizável" value={allocationInputs.annualCalendarConfirmed ? 'confirmado' : 'não confirmado'} note="Qualquer mudança de data, peso, GMD, dieta, lote ou capacidade invalida a confirmação" tone={allocationInputs.annualCalendarConfirmed ? 'green' : 'warn'} />
                  <Metric label="GMD mínimo · próprio vs vender" value={feedAllocation.thresholdOwnVsSell === null ? 'não fecha' : `${two.format(feedAllocation.thresholdOwnVsSell)} kg/d`} note="Usa custo marginal do alimento e VP da receita" />
                  <Metric label="Consumo do lote médio" value={`${two.format(feedAllocation.lots.reduce((sum, lot) => sum + lot.dailyDmKg * lot.normalizedShare, 0))} kg MS/d`} note="Edite por faixa; GMD igual não garante a mesma eficiência alimentar" />
                  <Metric label="Equilíbrio B" value={routeBBreakEvenPrice === null ? 'aguarda dados de B' : `${brl2.format(routeBBreakEvenPrice)}/@`} note={`Saída direta projetada em ${routeBExitDate || 'n/d'}`} tone={routeBBreakEvenPrice === null ? 'warn' : 'plain'} />
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Lotes marginais" title="Quem deve ir ao cocho próprio ou ser vendido" text="As margens são por cabeça em valor presente na data da decisão. O desempenho da recria é histórico; a decisão usa a resposta futura esperada no cocho, CMS, preço, dieta, vaga e caixa." />
                <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Lote</TableHead><TableHead className="text-right">GMD recria</TableHead><TableHead className="text-right">GMD cocho</TableHead><TableHead className="text-right">CMS/d</TableHead><TableHead className="text-right">Conversão</TableHead><TableHead className="text-right">Margem própria/cab</TableHead><TableHead className="text-right">Próprio</TableHead><TableHead className="pr-5 text-right">Venda gate</TableHead></TableRow></TableHeader><TableBody>
                  {feedAllocation.lots.map((lot) => <TableRow key={lot.id}><TableCell className="pl-5 font-semibold">{lot.label}</TableCell><TableCell className="text-right font-mono">{two.format(lot.pastureGmd ?? 0)}</TableCell><TableCell className="text-right font-mono">{two.format(lot.gmd)}</TableCell><TableCell className="text-right font-mono">{two.format(lot.dailyDmKg)}</TableCell><TableCell className="text-right font-mono">{two.format(lot.feedConversionDm)}</TableCell><TableCell className="text-right font-mono">{lot.routeCovered ? brl0.format(lot.ownMarginHead) : 'aguarda preço'}</TableCell><TableCell className="text-right font-mono">{int.format(lot.ownHeads)}</TableCell><TableCell className="pr-5 text-right font-mono">{int.format(lot.sellHeads)}</TableCell></TableRow>)}
                </TableBody></Table>
              </Panel>

            </TabsContent>

            <TabsContent value="futures" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow="Curva manual · triagem datada" title={bestFutureOpportunity ? `${bestFutureOpportunity.activity} apresenta a maior margem entre as hipóteses inseridas` : 'Nenhuma referência temporal está apta à triagem'} text={`O motor converte cada contrato para preço local, mistura ${one.format(futureHedgePercent)}% de cobertura com ${one.format(100 - futureHedgePercent)}% do preço-base e recalcula a margem. Plantio, colheita e disponibilidade vêm automaticamente do marco do gado. Para grãos e fibra, aplicar sem basis/carrego confirmado grava apenas uma hipótese; não transforma o preço em referência atual validada.`} action={<Badge className={invalidFutureCount > 0 || futureExecutionCount < futureRanking.length ? 'bg-[#ffe1a6] text-[#714817]' : 'bg-[#d7f06b] text-[#183b28]'}>{futureRanking.length}/{futureOpportunities.length} triagem · {futureExecutionCount} execução</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Maior margem na curva" value={bestFutureOpportunity ? `${futureProductLabel[bestFutureOpportunity.quote.product]} · ${bestFutureOpportunity.quote.contract}` : 'n/d'} note={bestFutureOpportunity ? `${bestFutureOpportunity.activity} · ${brl0.format(bestFutureOpportunity.marginHa)}/ha` : undefined} tone="lime" icon={<TrendingUp className="size-4" />} />
                  <Metric label="Maior margem · pecuária" value={bestFutureCattle ? `${bestFutureCattle.quote.symbol} ${bestFutureCattle.quote.contract}` : 'n/d'} note={bestFutureCattle ? `${brl2.format(bestFutureCattle.effectivePrice)}/@ ponderado · Δ ${brl0.format(bestFutureCattle.deltaMarginHa)}/ha` : undefined} tone="green" />
                  <Metric label="Maior margem · grãos" value={bestFutureGrain ? `${futureProductLabel[bestFutureGrain.quote.product]} ${bestFutureGrain.quote.contract}` : 'n/d'} note={bestFutureGrain ? `${brl2.format(bestFutureGrain.effectivePrice)}/sc · ${brl0.format(bestFutureGrain.marginHa)}/ha` : undefined} />
                  <Metric label="Maior margem · fibra" value={bestFutureFiber ? `CT ${bestFutureFiber.quote.contract}` : 'n/d'} note={bestFutureFiber ? `${brl2.format(bestFutureFiber.effectivePrice)}/@ equivalente · ${brl0.format(bestFutureFiber.marginHa)}/ha` : undefined} />
                </div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Conversão e cobertura" title="Do contrato ao preço líquido usado no cenário" text="Câmbio, basis e cobertura são riscos separados. Para algodão, a pluma da ICE ainda precisa de rendimento de fibra e crédito do caroço para chegar ao equivalente produzido." />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="future-fx"><span className="text-[11px] font-medium text-muted-foreground">Câmbio por vencimento</span><div className="mt-2 flex items-center gap-2"><NumericInput id="future-fx" className="h-9 text-right font-mono" min={0} max={20} step={0.01} value={futureUsdBrl} onValueChange={(numericValue) => setFutureUsdBrl(Math.max(0, numericValue || 0))} /><span className="text-[10px] text-muted-foreground">R$/US$</span></div></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="future-coverage"><span className="text-[11px] font-medium text-muted-foreground">Cobertura simulada</span><div className="mt-2 flex items-center gap-2"><NumericInput id="future-coverage" className="h-9 text-right font-mono" min={0} max={100} step={5} value={futureHedgePercent} onValueChange={(numericValue) => setFutureHedgePercent(Math.min(100, Math.max(0, numericValue || 0)))} /><span className="text-[10px] text-muted-foreground">%</span></div></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="cotton-fiber-recovery"><span className="text-[11px] font-medium text-muted-foreground">Rendimento de fibra</span><div className="mt-2 flex items-center gap-2"><NumericInput id="cotton-fiber-recovery" className="h-9 text-right font-mono" min={0} max={100} step={0.5} value={cottonFiberRecovery} onValueChange={(numericValue) => setCottonFiberRecovery(Math.min(100, Math.max(0, numericValue || 0)))} /><span className="text-[10px] text-muted-foreground">%</span></div></label>
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="cotton-seed-credit"><span className="text-[11px] font-medium text-muted-foreground">Crédito do caroço</span><div className="mt-2 flex items-center gap-2"><NumericInput id="cotton-seed-credit" className="h-9 text-right font-mono" min={0} max={300} step={0.5} value={cottonSeedCredit} onValueChange={(numericValue) => setCottonSeedCredit(Math.max(0, numericValue || 0))} /><span className="text-[10px] text-muted-foreground">R$/@ de algodão em caroço</span></div></label>
                </div>
                <div className="grid gap-3 px-5 pb-5 md:grid-cols-3 lg:px-6 lg:pb-6">
                  {(['soy', 'corn', 'cotton'] as const).map((product) => {
                    const window = cropMarketingWindows[product];
                    const cropId: CropAssumption['id'] =
                      product === 'soy'
                        ? 'soy-irrigated'
                        : product === 'corn'
                          ? 'corn-irrigated'
                          : 'cotton-irrigated';
                    const calendar = automaticCalendar.crops[cropId];
                    return (
                      <div className="rounded-2xl border border-border/75 bg-[#fafbf8] p-4" key={`window-${product}`}>
                        <p className="text-sm font-semibold">Janela · {futureProductLabel[product]}</p>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-border/70 bg-white p-3"><span className="block text-[9px] text-muted-foreground">Disponível a partir de</span><strong className="mt-1 block font-mono text-[11px]">{dateBr(calendar.availableDate)}</strong></div>
                          <div className="rounded-xl border border-border/70 bg-white p-3"><span className="block text-[9px] text-muted-foreground">Última entrega no horizonte</span><strong className="mt-1 block font-mono text-[11px]">{dateBr(calendar.lastDeliveryDate)}</strong></div>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-white p-3"><div><p className="text-xs font-semibold">Basis e carrego conferidos</p><p className="text-[9px] text-muted-foreground">Validação de execução: frete, armazenagem, quebra, juros, qualidade e impostos. Não bloqueia a triagem-base.</p></div><Switch aria-label={`Confirmar basis e carrego de ${futureProductLabel[product]}`} checked={window.carryBasisConfirmed} onCheckedChange={(checked) => { setCropMarketingWindows((current) => ({ ...current, [product]: { ...current[product], carryBasisConfirmed: checked } })); invalidateOperationalConfirmations(); }} /></div>
                      </div>
                    );
                  })}
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#bfd0bd] bg-[#eef5ef] p-4 text-xs leading-relaxed text-[#315a3e] lg:mx-6 lg:mb-6"><strong>Preço ponderado:</strong> preço-base × parcela descoberta + preço futuro convertido × parcela coberta. Para BGI e CCM, o preço bruto já está em reais; SJC usa US$/saca × câmbio; CT usa US¢/lb × 15 kg × câmbio × rendimento de fibra + crédito do caroço. A convenção é <strong>basis = físico equivalente − futuro equivalente</strong>; portanto, preço físico = futuro + basis. Cada basis deve representar a mesma praça, qualidade, unidade e janela do preço comparado.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Curvas editáveis" title="Boi, milho, soja e algodão por mês de entrega" text="Os valores abaixo são referências manuais datadas, não um feed em tempo real. Atualize preço, basis, data de observação e o ponto temporal usado na curva antes de qualquer decisão." />
                <div className="grid gap-4 p-5 xl:grid-cols-2 lg:p-6">
                  {(['cattle', 'corn', 'soy', 'cotton'] as FutureProduct[]).map((product) => (
                    <div className="rounded-2xl border border-border/75 bg-[#fafbf8] p-4" key={product}>
                      <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{futureProductLabel[product]}</p><p className="mt-1 text-[10px] text-muted-foreground">{futureQuotes.find((quote) => quote.product === product)?.symbol} · {futureRawUnitLabel(futureQuotes.find((quote) => quote.product === product)?.rawUnit ?? 'BRL_ARROBA')}</p></div><Badge variant="outline">{futureModelUnitLabel(product)} local</Badge></div>
                      <div className="mt-4 space-y-3">
                        {futureQuotes.filter((quote) => quote.product === product).map((quote) => {
                          const opportunity = futureOpportunities.find((item) => item.quote.id === quote.id);
                          return (
                            <div className="rounded-xl border border-border/70 bg-white p-3" key={quote.id}>
                              <div className="flex items-center justify-between gap-3"><div><span className="text-xs font-semibold">{quote.symbol} {quote.contract}</span><p className="mt-0.5 text-[9px] text-muted-foreground">{quote.exchange} · mês de entrega {quote.deliveryMonth}</p></div><a aria-label={`Abrir fonte de ${quote.symbol} ${quote.contract}`} className="inline-flex size-7 items-center justify-center rounded-lg border border-border" href={quote.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" /></a></div>
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                <label htmlFor={`future-price-${quote.id}`}><span className="mb-1 block text-[8px] uppercase tracking-[0.08em] text-muted-foreground">Preço bruto</span><NumericInput id={`future-price-${quote.id}`} className="h-8 text-right font-mono text-xs" min={0} step={0.01} value={quote.rawPrice} onValueChange={(numericValue) => updateFutureQuote(quote.id, 'rawPrice', Math.max(0, numericValue || 0))} /></label>
                                <label htmlFor={`future-basis-${quote.id}`}><span className="mb-1 block text-[8px] uppercase tracking-[0.08em] text-muted-foreground">Basis local</span><NumericInput id={`future-basis-${quote.id}`} className="h-8 text-right font-mono text-xs" step={0.5} value={quote.localBasis} onValueChange={(numericValue) => updateFutureQuote(quote.id, 'localBasis', numericValue || 0)} /></label>
                                <label htmlFor={`future-source-date-${quote.id}`}><span className="mb-1 block text-[8px] uppercase tracking-[0.08em] text-muted-foreground">Observado em</span><Input id={`future-source-date-${quote.id}`} className="h-8 px-2 text-[10px]" type="date" value={quote.sourceDate} onChange={(event) => updateFutureQuote(quote.id, 'sourceDate', event.target.value)} /></label>
                                <label htmlFor={`future-reference-date-${quote.id}`}><span className="mb-1 block text-[8px] uppercase tracking-[0.08em] text-muted-foreground">Ponto da curva</span><Input id={`future-reference-date-${quote.id}`} className="h-8 px-2 text-[10px]" type="date" value={quote.referenceDate} onChange={(event) => updateFutureQuote(quote.id, 'referenceDate', event.target.value)} /></label>
                              </div>
                              <div className="mt-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Futuro convertido · ponderado</p><p className="mt-1 font-mono text-sm font-semibold">{opportunity?.isUsable ? `${brl2.format(opportunity.futurePrice)} · ${brl2.format(opportunity.effectivePrice)}` : 'complete a referência'}</p></div><div className="text-right"><Badge variant="outline">{opportunity?.executionUsable ? 'basis/carrego confirmado' : opportunity?.isUsable ? 'hipótese de triagem' : 'pendente'}</Badge><p className={`mt-1 text-[10px] ${opportunity?.isUsable ? 'text-muted-foreground' : 'text-[#9b4b2f]'}`}>{opportunity?.isUsable ? `Ponto ${opportunity.quote.referenceDate} · ${int.format(opportunity.horizonDays ?? 0)} d · Δ ${brl0.format(opportunity.deltaMarginHa)}/ha` : opportunity?.validationIssue ?? 'referência inválida'}</p></div></div>
                              <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">{quote.note}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Referências aptas à triagem" title="Margem modelada sob cada preço inserido" text="A ordenação usa referências com fonte, mês e ponto temporal coerentes. Basis/carrego define se o preço também está pronto para pré-validação; produtos e meses diferentes ainda carregam liquidez, armazenagem, caixa e calendário próprios." />
                <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Produto / contrato</TableHead><TableHead>Atividade</TableHead><TableHead className="text-right">Preço local futuro</TableHead><TableHead className="text-right">Preço ponderado</TableHead><TableHead className="text-right">Margem/ha</TableHead><TableHead className="text-right">Δ vs base</TableHead><TableHead className="text-right">Distância do equilíbrio</TableHead><TableHead className="text-right">Contratos</TableHead><TableHead className="pr-5 text-right">Cenário</TableHead></TableRow></TableHeader><TableBody>
                  {futureRanking.map((item, index) => <TableRow className={index === 0 ? 'bg-[#f2f7da]/65' : ''} key={item.quote.id}><TableCell className="pl-5"><span className="font-semibold">{futureProductLabel[item.quote.product]} · {item.quote.contract}</span><p className="mt-1 text-[9px] text-muted-foreground">{item.quote.symbol} · observado {item.quote.sourceDate} · ponto {item.quote.referenceDate} ({int.format(item.horizonDays ?? 0)} d)</p></TableCell><TableCell className="text-xs">{item.activity}</TableCell><TableCell className="text-right font-mono text-xs">{brl2.format(item.futurePrice)}</TableCell><TableCell className="text-right font-mono text-xs">{brl2.format(item.effectivePrice)}</TableCell><TableCell className="text-right font-mono text-xs font-semibold">{brl0.format(item.marginHa)}</TableCell><TableCell className={`text-right font-mono text-xs ${item.deltaMarginHa >= 0 ? 'text-[#2d6c45]' : 'text-[#9b4b2f]'}`}>{brl0.format(item.deltaMarginHa)}</TableCell><TableCell className="text-right font-mono text-xs">{item.priceDistance === null ? 'n/d' : percentage(item.priceDistance)}</TableCell><TableCell className="text-right font-mono text-xs">{int.format(item.contractsAtCoverage)}<p className="text-[9px]">{one.format(item.actualCoveragePercent)}% do volume anual</p></TableCell><TableCell className="pr-5 text-right"><Button size="sm" variant="outline" onClick={() => applyFutureOpportunity(item)}>{item.executionUsable ? 'Aplicar preço' : 'Aplicar hipótese'}</Button></TableCell></TableRow>)}
                </TableBody></Table>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-3 text-[11px] leading-relaxed text-muted-foreground">“Contratos” arredonda para baixo a cobertura física aproximada: BGI = 330 @, CCM/SJC = 450 sc e CT = 50.000 lb de pluma; o volume residual fica descoberto. Não inclui margem de garantia, ajustes diários, corretagem, slippage, rolagem, risco de crédito ou descasamento de volume/qualidade.</div>
              </Panel>

              <Panel>
                <div className="flex gap-3 p-5 text-xs leading-relaxed text-muted-foreground lg:p-6"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#a56a1d]" /><p><strong className="text-foreground">Atualização automática:</strong> preços de ajuste B3 podem ser integrados por UP2DATA contratado; CME e ICE também exigem canais e licenças próprios para uso de produção/redistribuição. Esta versão mantém a curva manual para preservar rastreabilidade e evitar apresentar scraping como feed oficial. Confirme vencimento, ajuste, horário, licença e liquidez na fonte antes de aplicar.</p></div>
              </Panel>
            </TabsContent>

            <TabsContent value="strategy" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow="Ciclo observado · corte 31/08/2026" title="Sinais oficiais que podem deslocar o cenário" text="Cada card separa realizado, estimativa e projeção. Fundamento direcional não é rentabilidade local: reposição, ração, basis, câmbio, qualidade, capital e calendário podem inverter a oportunidade." action={<Badge variant="outline">fontes primárias</Badge>} />
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-3 lg:p-6">
                  {marketCycleEvidence.map((item) => <article className="rounded-2xl border border-border/75 bg-[#fafbf8] p-4" key={item.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold">{item.label}</p><p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{item.period} · {item.status}</p></div><a aria-label={`Abrir fonte de ${item.label}`} className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white" href={item.sourceUrl} rel="noreferrer" target="_blank"><ExternalLink className="size-3.5" /></a></div><p className="mt-4 font-mono text-2xl font-semibold tracking-[-0.035em]">{item.value}</p><Badge className="mt-2 bg-[#eef5ef] text-[#315a3e]" variant="outline">{item.tone}</Badge><p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{item.text}</p><p className="mt-3 text-[9px] text-muted-foreground">{item.source}</p></article>)}
                </div>
                <div className="mx-5 mb-5 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><strong>Leitura pecuária atual:</strong> a participação de vacas + novilhas chegou a 49,92% do abate formal no 1T26, recorde da série corrente; a virada para retenção ainda não estava confirmada. Isso pode apertar bezerro e boi magro em 12–36 meses, mas uma reposição mais cara pode comprimir o confinamento mesmo quando a arroba sobe. O mix por sexo do 2T26 ainda não havia sido publicado na data de corte.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Faixas de estresse" title="Inferior, central e superior — sem falsa previsão de mínimo/máximo" text="A versão atual usa choques manuais não calibrados. Quando houver histórico local suficiente, estes campos devem ser substituídos por P10/P50/P90 walk-forward de preço futuro, FX, basis, produtividade e custo, preservando correlações por ano-safra." action={<Badge className="bg-[#ffe1a6] text-[#714817]">não probabilístico</Badge>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Boi · faixa inferior/central/superior" value={`${brl0.format(assumptions.priceArroba * (1 + strategyStress.cattleLow / 100))} · ${brl0.format(assumptions.priceArroba)} · ${brl0.format(assumptions.priceArroba * (1 + strategyStress.cattleHigh / 100))}`} note="R$/@ · choques editáveis" />
                  <Metric label="Soja · faixa de estresse" value={`${brl0.format((crops.find((crop) => crop.id === 'soy-irrigated')?.price ?? 0) * (1 + strategyStress.soyLow / 100))} · ${brl0.format(crops.find((crop) => crop.id === 'soy-irrigated')?.price ?? 0)} · ${brl0.format((crops.find((crop) => crop.id === 'soy-irrigated')?.price ?? 0) * (1 + strategyStress.soyHigh / 100))}`} note="R$/sc 60 kg" />
                  <Metric label="Milho · faixa de estresse" value={`${brl0.format(cornFeedCrop.price * (1 + strategyStress.cornLow / 100))} · ${brl0.format(cornFeedCrop.price)} · ${brl0.format(cornFeedCrop.price * (1 + strategyStress.cornHigh / 100))}`} note="R$/sc 60 kg" />
                  <Metric label="Algodão · faixa de estresse" value={`${brl0.format((crops.find((crop) => crop.id === 'cotton-irrigated')?.price ?? 0) * (1 + strategyStress.cottonLow / 100))} · ${brl0.format(crops.find((crop) => crop.id === 'cotton-irrigated')?.price ?? 0)} · ${brl0.format((crops.find((crop) => crop.id === 'cotton-irrigated')?.price ?? 0) * (1 + strategyStress.cottonHigh / 100))}`} note="R$/@ equivalente produzido" />
                </div>
                <details className="mx-5 mb-5 rounded-xl border border-border/75 bg-[#fafbf8] p-4 lg:mx-6 lg:mb-6">
                  <summary className="cursor-pointer text-xs font-semibold">Editar choques de preço, produtividade, custo e reposição</summary>
                  <p className="mt-3 text-xs text-muted-foreground">O choque “Bovinos” estressa boi gordo e preço líquido do magro no mesmo percentual apenas como hipótese de teste, não como correlação comprovada. Os preços-base continuam independentes. Produtividade estressa GMD e lotação de A, B e C.</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Control label="Bovinos · preço inferior" value={strategyStress.cattleLow} suffix="%" min={-60} max={0} step={1} onChange={(value) => updateStrategyStress('cattleLow', value)} />
                    <Control label="Bovinos · preço superior" value={strategyStress.cattleHigh} suffix="%" min={0} max={80} step={1} onChange={(value) => updateStrategyStress('cattleHigh', value)} />
                    <Control label="Soja · preço inferior" value={strategyStress.soyLow} suffix="%" min={-60} max={0} step={1} onChange={(value) => updateStrategyStress('soyLow', value)} />
                    <Control label="Soja · preço superior" value={strategyStress.soyHigh} suffix="%" min={0} max={80} step={1} onChange={(value) => updateStrategyStress('soyHigh', value)} />
                    <Control label="Milho · preço inferior" value={strategyStress.cornLow} suffix="%" min={-60} max={0} step={1} onChange={(value) => updateStrategyStress('cornLow', value)} />
                    <Control label="Milho · preço superior" value={strategyStress.cornHigh} suffix="%" min={0} max={80} step={1} onChange={(value) => updateStrategyStress('cornHigh', value)} />
                    <Control label="Algodão · preço inferior" value={strategyStress.cottonLow} suffix="%" min={-60} max={0} step={1} onChange={(value) => updateStrategyStress('cottonLow', value)} />
                    <Control label="Algodão · preço superior" value={strategyStress.cottonHigh} suffix="%" min={0} max={80} step={1} onChange={(value) => updateStrategyStress('cottonHigh', value)} />
                    <Control label="Produtividade inferior" value={strategyStress.productivityLow} suffix="%" min={-60} max={0} step={1} onChange={(value) => updateStrategyStress('productivityLow', value)} />
                    <Control label="Produtividade superior" value={strategyStress.productivityHigh} suffix="%" min={0} max={50} step={1} onChange={(value) => updateStrategyStress('productivityHigh', value)} />
                    <Control label="Custos na faixa inferior" value={strategyStress.costLow} suffix="%" min={0} max={80} step={1} onChange={(value) => updateStrategyStress('costLow', value)} />
                    <Control label="Custos na faixa superior" value={strategyStress.costHigh} suffix="%" min={-40} max={40} step={1} onChange={(value) => updateStrategyStress('costHigh', value)} />
                    <Control label="Reposição na faixa inferior" value={strategyStress.replacementLow} suffix="%" min={-40} max={80} step={1} onChange={(value) => updateStrategyStress('replacementLow', value)} />
                    <Control label="Reposição na faixa superior" value={strategyStress.replacementHigh} suffix="%" min={-40} max={80} step={1} onChange={(value) => updateStrategyStress('replacementHigh', value)} />
                  </div>
                </details>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Matriz de robustez" title="Margem por hectare em cada faixa" text="O ranking central pode inverter quando preço, produtividade e custo caminham juntos. A, B e C usam hectares exclusivos. A contém pasto e silagem; B termina no pivô; C recria e vende magros com reposição comprada. Milho do cocho é comprado e milho agrícola é vendido: não há transferência física automática entre módulos. O mix usa custeio anual conservador; o caixa de implantação precisa ser conferido depois." />
                <div className="h-[420px] p-4 sm:p-6">{activeTab === 'strategy' ? <Suspense fallback={<output>Carregando gráfico…</output>}><StressChart rows={strategyChartData} /></Suspense> : null}</div>
                <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Alternativa</TableHead><TableHead className="text-right">Inferior</TableHead><TableHead className="text-right">Central</TableHead><TableHead className="text-right">Superior</TableHead><TableHead className="text-right">Pior faixa</TableHead><TableHead className="pr-5 text-right">Valor no critério</TableHead></TableRow></TableHeader><TableBody>{strategyRanking.map((activity, index) => <TableRow className={strategyReady && index === 0 ? 'bg-[#f2f7da]/65' : ''} key={activity.id}><TableCell className="pl-5 font-semibold">{activity.label}</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(activity.margins.low)}/ha</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(activity.margins.base)}/ha</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(activity.margins.high)}/ha</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(Math.min(activity.margins.low, activity.margins.base, activity.margins.high))}/ha</TableCell><TableCell className="pr-5 text-right font-mono text-xs font-semibold">{brl0.format(activity.scoreHa)}/ha</TableCell></TableRow>)}</TableBody></Table>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Alocação sob restrições" title={strategyReady && strategyAllocation.capitalFeasible ? 'Mix de maior valor modelado no critério' : 'Mix sem viabilidade no orçamento atual'} text="Módulos exclusivos de pecuária e culturas, custeio anual conservador, limite de vagas-dia e CAPEX indivisível de pivô/cocho. Área ociosa paga arrendamento. O milho da pecuária é comprado; não há transferência gratuita entre módulos. Rotação, água mensal e lotes inteiros ainda exigem validação." action={<Badge className={!strategyReady || !strategyAllocation.capitalFeasible ? 'bg-[#ffe1a6] text-[#714817]' : 'bg-[#d7f06b] text-[#183b28]'}>{!strategyAllocation.capitalFeasible ? 'déficit de capital' : 'triagem de portfólio'}</Badge>} />
                <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <label className="rounded-2xl border border-border/80 p-4" htmlFor="strategy-criterion"><span className="text-[11px] font-medium text-muted-foreground">Critério de decisão</span><select className="mt-2 h-9 w-full rounded-lg border border-input bg-white px-3 text-xs" id="strategy-criterion" value={strategyCriterion} onChange={(event) => setStrategyCriterion(event.target.value as DecisionCriterion)}><option value="defensive">Proteger o pior cenário</option><option value="base">Maximizar cenário central</option><option value="balanced">Balanceado 25/50/25</option></select><span className="mt-2 block text-[9px] leading-relaxed text-muted-foreground">25/50/25 são pesos de decisão, não probabilidades.</span></label>
                  <Control label="Máximo por sistema" value={strategyMaxShare} suffix="% área" min={10} max={100} step={5} onChange={setStrategyMaxShare} />
                  <EditValue label="Capital disponível para o projeto" value={brl0.format(strategyCapitalLimit)} onEdit={() => openEditor('farm', 'Capital disponível')} />
                  <Control label="Erro/indiferença manual" value={strategyErrorHa} suffix="R$/ha" min={0} max={50000} step={500} onChange={setStrategyErrorHa} />
                </div>
                <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 xl:grid-cols-4 lg:px-6 lg:pb-6">
                  <Metric label="Valor do portfólio no critério" value={moneyCompact(strategyAllocation.objective)} note="Calculado sobre o conjunto de áreas, não pelo vencedor isolado" tone={strategyAllocation.capitalFeasible ? 'lime' : 'warn'} />
                  <Metric label="Diferença entre atividades isoladas" value={strategyReady ? `${brl0.format(strategyGap)}/ha` : 'n/d'} note={strategyReady ? `Faixa de indiferença manual: ${brl0.format(strategyErrorHa)}/ha` : 'Sem duas alternativas validadas'} tone={!strategyReady || strategyIndifferent ? 'warn' : 'green'} />
                  <Metric label="Área alocada / ociosa" value={`${int.format(strategyAllocation.allocatedArea)} / ${int.format(strategyAllocation.idleArea)} ha`} note={`${one.format((strategyAllocation.allocatedArea / Math.max(assumptions.totalArea, 1)) * 100)}% da área`} />
                  <Metric label="Caixa usado / limite" value={`${moneyCompact(strategyAllocation.cashUsed)} / ${moneyCompact(strategyCapitalLimit)}`} note={strategyAllocation.capitalFeasible ? `${moneyCompact(strategyAllocation.capitalSlack)} de folga · custo/ha da faixa mais exigente` : `${moneyCompact(strategyAllocation.capitalShortfall)} de déficit obrigatório`} tone={!strategyAllocation.capitalFeasible || strategyAllocation.capitalSlack < strategyCapitalLimit * 0.02 ? 'warn' : 'plain'} />
                  <Metric label="Margem anual · inferior" value={strategyReady ? moneyCompact(strategyAllocation.scenarioTotals.low) : 'n/d'} note={strategyReady ? 'Não é P10 enquanto não houver calibração' : 'Preencha uma alternativa'} tone="warn" />
                  <Metric label="Margem anual · central" value={strategyReady ? moneyCompact(strategyAllocation.scenarioTotals.base) : 'n/d'} note={strategyReady ? 'Premissas atualmente informadas' : 'Preencha uma alternativa'} tone={strategyReady ? 'green' : 'warn'} />
                  <Metric label="Margem anual · superior" value={strategyReady ? moneyCompact(strategyAllocation.scenarioTotals.high) : 'n/d'} note={strategyReady ? 'Não é teto de preço garantido' : 'Preencha uma alternativa'} tone={strategyReady ? 'lime' : 'warn'} />
                  <Metric label="Regra de decisão" value={strategyCriterion === 'defensive' ? 'maximin' : strategyCriterion === 'base' ? 'margem central' : '25% / 50% / 25%'} note="Objetivo explícito e reproduzível" />
                </div>
                <div className="overflow-x-auto border-t border-border/70"><Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">Sistema</TableHead><TableHead className="text-right">Área</TableHead><TableHead className="text-right">Participação</TableHead><TableHead className="text-right">Caixa/ha</TableHead><TableHead className="text-right">Caixa usado</TableHead><TableHead className="text-right">Margem inferior</TableHead><TableHead className="pr-5 text-right">Margem central</TableHead></TableRow></TableHeader><TableBody>{strategyAllocation.rows.filter((row) => row.area > 0.01).map((row) => <TableRow key={row.id}><TableCell className="pl-5 font-semibold">{row.label}</TableCell><TableCell className="text-right font-mono text-xs">{one.format(row.area)} ha</TableCell><TableCell className="text-right font-mono text-xs">{one.format(row.share)}%</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(row.cashCostHa)}</TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(row.cashUsed)}</TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(row.marginsAnnual.low)}</TableCell><TableCell className="pr-5 text-right font-mono text-xs font-semibold">{moneyCompact(row.marginsAnnual.base)}</TableCell></TableRow>)}</TableBody></Table></div>
                <div className="border-t border-border/70 bg-[#fafbf8] px-5 py-4 text-[11px] leading-relaxed text-muted-foreground lg:px-6"><strong>Próxima trava antes de automatizar plantio:</strong> o cocho já aceita janelas semanais por lote, mas ainda faltam estoque de alimentos e caixa por data, água/energia mensal, rotação e lotes inteiros. Sem essas restrições, o mix é triagem anual — não um plano operacional executável.</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Conectores e latência" title="O que é atual, o que é manual e o que ainda precisa de licença" text="Cada decisão precisa carregar fonte, período, data de divulgação, data de coleta, unidade, praça e validade. Notícia entra como evento explicativo; não altera preço automaticamente sem backtest." />
                <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="CONAB · preços físicos" value="sob demanda" note="Consulta semanal por UF já conectada; não é intradiária" tone="green" />
                  <Metric label="B3 / ICE · futuros" value="curva manual" note="Feed de produção requer contratação/licença; data fica registrada" tone="warn" />
                  <Metric label="IBGE / USDA / Conab" value="snapshots oficiais" note="Trimestral ou mensal; realizado, estimativa e projeção separados" />
                  <Metric label="Notícias e eventos" value="camada pendente" note="Exige ingestão, deduplicação, fonte e backtest; nunca deve decidir sozinha" tone="warn" />
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="report" className="space-y-5" id="report-output">
              <Panel><SectionTitle eyebrow="Mesmo capital · área parcial" title="Escalas que o orçamento permite estudar" text="Margens anuais de regime pleno, não lucro líquido ou retorno do primeiro ano. O quadro geral compara a área inteira; aqui a escala pode diminuir para caber no caixa." /><div className="p-5"><Table><TableHeader><TableRow><TableHead>Alternativa</TableHead><TableHead>Área testada de maior margem</TableHead><TableHead>Margem anual</TableHead><TableHead>Capital exigido</TableHead><TableHead>Capital para área inteira</TableHead></TableRow></TableHeader><TableBody>{reportCapitalStudy?.rows.map(r => <TableRow key={r.id}><TableCell>{r.id}</TableCell><TableCell>{one.format(r.best.area)} ha</TableCell><TableCell>{brl0.format(r.best.margin)}</TableCell><TableCell>{brl0.format(r.best.capital)}</TableCell><TableCell>{brl0.format(r.full.capital)}</TableCell></TableRow>)}</TableBody></Table><p className="mt-3 text-sm text-muted-foreground">Busca discreta, não ótimo global. Arrendamento ocioso, CAPEX e reserva mantidos. Não operar pode evitar perda incremental. CSV inclui alavancas, lotação, equivalência de custeio e preços de indiferença do cocho.</p></div></Panel>
              {scenarioMode === 'exploration' ? <div className="rounded-2xl border-2 border-[#d49e37]/45 bg-[#fff4d8] p-4 text-sm font-semibold text-[#6b4a12]">DEMONSTRAÇÃO — este relatório contém preços, capacidades, calendários e confirmações ilustrativas. Não use como recomendação, orçamento ou aprovação de investimento.</div> : null}
              <Panel>
                <SectionTitle eyebrow={scenarioMode === 'exploration' ? 'Relatório demonstrativo' : 'Relatório executivo'} title={`${scenarioMode === 'exploration' ? 'Exemplo para' : 'Decisão para'} ${int.format(assumptions.totalArea)} ha irrigados`} text={scenarioMode === 'exploration' ? 'Síntese do exemplo para testar relações e sensibilidades. Toda exportação permanece marcada como demonstração não validada.' : 'Síntese automática do cenário atual. O ranking é recalculado instantaneamente quando preços, produtividades, custos e arrendamento são editados.'} action={<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={exportReport}><Download /> Baixar CSV</Button><Button size="sm" className="bg-[#173e2c] text-white hover:bg-[#22533a]" onClick={() => window.print()}><FileText /> Imprimir / PDF</Button></div>} />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label={best.id === 'none-feasible' ? 'Estado do ranking' : scenarioMode === 'exploration' ? 'Maior margem ilustrativa' : 'Maior margem calculada'} value={best.id === 'none-feasible' ? 'aguardando validações' : best.label} note={best.id === 'none-feasible' ? 'Veja os pré-requisitos específicos no comparativo' : `${brl0.format(best.marginHa)}/ha/ano${scenarioMode === 'exploration' ? ' · exemplo não validado' : ''}`} tone={best.id === 'none-feasible' || scenarioMode === 'exploration' ? 'warn' : 'lime'} />
                  <Metric label="Vantagem sobre 2º lugar" value={best.id === 'none-feasible' ? 'n/d' : runnerUp ? `${brl0.format(best.marginHa - runnerUp.marginHa)}/ha` : 'n/d'} note={runnerUp && best.id !== 'none-feasible' ? `contra ${runnerUp.label}` : undefined} />
                  <Metric label={scenarioMode === 'exploration' ? 'Margem anual do exemplo' : 'Margem anual calculada'} value={best.id === 'none-feasible' ? 'n/d' : moneyCompact(best.margin)} note={best.id === 'none-feasible' ? 'Nenhuma recomendação é emitida' : `${percentage(best.roi)} de margem ÷ custo anual`} tone={best.id === 'none-feasible' || scenarioMode === 'exploration' ? 'warn' : 'green'} />
                  <Metric label="Custo ÷ receita da alternativa" value={best.id !== 'none-feasible' && best.revenue > 0 ? percentage((best.cost / best.revenue) * 100) : 'n/d'} note={best.id === 'none-feasible' ? 'Aguardando alternativa rankeável' : 'Quanto menor, maior a distância contábil até a margem zero'} tone={best.id === 'none-feasible' || best.cost / Math.max(best.revenue, 1) > 0.85 ? 'warn' : 'plain'} />
                  <Metric label="Maior margem na curva inserida" value={bestFutureOpportunity ? `${futureProductLabel[bestFutureOpportunity.quote.product]} ${bestFutureOpportunity.quote.contract}` : 'n/d'} note={bestFutureOpportunity ? `${bestFutureOpportunity.activity} · ${brl0.format(bestFutureOpportunity.marginHa)}/ha` : undefined} />
                  <Metric label="Cobertura efetiva anual" value={bestFutureOpportunity ? `${one.format(bestFutureOpportunity.actualCoveragePercent)}%` : 'n/d'} note={bestFutureOpportunity ? `${int.format(bestFutureOpportunity.contractsAtCoverage)} contratos inteiros; pedido ${one.format(futureHedgePercent)}% do volume elegível` : 'Curva não preenchida'} />
                  <Metric label="Rota do lote datado" value={animalTimeline.bestRoute?.label ?? 'dados insuficientes'} note={`${animalTimeline.decisionDate} · boi magro em série própria`} tone={!animalTimeline.bestRoute || animalTimeline.bestRoute.id === 'sell-gate' ? 'warn' : 'lime'} />
                  <Metric label="Cobertura das rotas terminadas" value={`${animalTimeline.comparisonStatus === 'comparable' ? animalTimeline.routes.filter((route) => route.id !== 'sell-gate' && route.projectedPrice !== null).length : 0}/3 aptas`} note={animalTimeline.comparisonStatus === 'comparable' ? 'Sem extrapolar além da curva BGI inserida' : animalDecisionBlocker} tone={animalTimeline.comparisonStatus === 'comparable' && animalTimeline.routes.every((route) => route.id === 'sell-gate' || route.projectedPrice !== null) ? 'green' : 'warn'} />
                  <Metric label="Portfólio · valor no critério" value={moneyCompact(strategyAllocation.objective)} note={strategyAllocation.capitalFeasible ? 'Alocação conjunta sob orçamento conservador' : 'Há déficit de capital; não executável'} tone={strategyAllocation.capitalFeasible ? 'lime' : 'warn'} />
                  <Metric label="Mix anual calculado" value={`${int.format(strategyAllocation.allocatedArea)} ha alocados`} note={strategyAllocation.rows.filter((row) => row.area > 0.01).slice(0, 3).map((row) => `${row.label}: ${int.format(row.area)} ha`).join(' · ') || `${int.format(strategyAllocation.idleArea)} ha ociosos`} />
                </div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Diagnóstico automático" title="Principais gargalos e pontos de validação" text="Os alertas priorizam o que mais pode mudar a decisão, sem substituir orçamento, projeto agronômico ou análise de crédito." />
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:p-6">
                  {bottlenecks.map((item) => (
                    <div className={`rounded-2xl border p-4 ${item.level === 'atenção' ? 'border-[#d49e37]/30 bg-[#fff7e8]' : item.level === 'folga' ? 'border-[#a8c65d]/35 bg-[#f2f7da]' : 'border-border/75 bg-[#f5f7f2]'}`} key={item.title}>
                      <div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold">{item.title}</p><Badge variant="outline">{item.level}</Badge></div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Ranking consolidado" title="Todos os usos na mesma área-base e no mesmo arrendamento" />
                <Table><TableHeader><TableRow className="bg-[#f4f7f1]"><TableHead className="pl-5">#</TableHead><TableHead>Alternativa</TableHead><TableHead className="text-right">Receita</TableHead><TableHead className="text-right">Custo</TableHead><TableHead className="text-right">Margem</TableHead><TableHead className="text-right">Margem/ha</TableHead><TableHead className="pr-5 text-right">Margem/custo</TableHead></TableRow></TableHeader><TableBody>
                  {ranking.map((row, index) => <TableRow className={index === 0 ? 'bg-[#f2f7da]/65' : ''} key={row.id}><TableCell className="pl-5 font-mono">{index + 1}</TableCell><TableCell><span className="font-semibold">{row.label}</span><p className="mt-1 text-[10px] text-muted-foreground">{row.source}</p></TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(row.revenue)}</TableCell><TableCell className="text-right font-mono text-xs">{moneyCompact(row.cost)}</TableCell><TableCell className="text-right font-mono text-xs font-semibold">{moneyCompact(row.margin)}</TableCell><TableCell className="text-right font-mono text-xs">{brl0.format(row.marginHa)}</TableCell><TableCell className="pr-5 text-right font-mono text-xs">{percentage(row.roi)}</TableCell></TableRow>)}
                </TableBody></Table>
              </Panel>

              <Panel className="overflow-hidden">
                <SectionTitle eyebrow="Equilíbrio por alternativa" title="Preço mínimo, produção mínima e distância ao equilíbrio" text="A distância mantém as demais premissas constantes e não é uma medida probabilística. Valores próximos de zero indicam maior sensibilidade univariada." />
                <BreakEvenTable rows={breakEvenRows} />
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Rebanho e alimento" title="O que a escala exige além da área irrigada" text="Síntese do funil de matrizes, da triagem de lotes e do destino do milho. O cocho usa calendário semanal quando todos os lotes têm datas válidas; alimento e caixa continuam agregados no ano." />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4 lg:p-6">
                  <Metric label="Matrizes para a oferta própria" value={`${int.format(herdFlow.matricesRequired)} matrizes`} note={`${percentage(herdFlow.weaningRate * 100)} de desmama resultante`} tone="warn" />
                  <Metric label="Área equivalente da cria" value={`${int.format(herdFlow.breedingAreaEquivalent)} ha`} note="Fora da área-base de recria, salvo realocação explícita" />
                  <Metric label="Cocho próprio / venda" value={`${int.format(feedAllocation.ownHeads)} / ${int.format(feedAllocation.sellHeads)}`} note="cabeças/ano nas duas rotas operacionais modeladas" />
                  <Metric label="GMD mínimo econômico do cocho" value={feedAllocation.thresholdOwnVsSell === null ? 'não fecha' : `${two.format(feedAllocation.thresholdOwnVsSell)} kg/d`} note="Indiferença entre confinar e vender o mesmo animal no gate" tone="lime" />
                  <Metric label="Milho produzido / consumido" value={`${int.format(feedAllocation.grainProducedSacks)} / ${int.format(feedAllocation.grainDemandSacks)} sc`} note={`${int.format(feedAllocation.soldGrainSacks)} sc direcionadas à venda`} />
                  <Metric label="Indiferença média / mercado" value={`${brl2.format(feedAllocation.weightedShadowGrain)} / ${brl2.format(cornRetainedPrice)}`} note="R$/sc; diagnóstico médio, não dual marginal" />
                  <Metric label="Compra externa de milho" value={`${int.format(feedAllocation.purchasedGrainSacks)} sc`} note={allocationInputs.allowPurchasedFeed ? 'Compra permitida no cenário' : 'Produção interna limita a rota'} />
                  <Metric label="Déficit de reposição" value={`${int.format(herdFlow.replacementGap)} novilhas`} note={herdFlow.replacementGap > 0 ? 'Plano de matrizes não se sustenta' : 'Oferta calculada cobre a retenção'} tone={herdFlow.replacementGap > 0 ? 'warn' : 'green'} />
                  <Metric label="Efluente por animal confinado" value={`${two.format(effluentVolumePerFinishedHeadM3)} m³/cab`} note={`${one.format(effluentAreaPerFinishedHeadHa * 10_000)} m² a ${int.format(effluentScale.referenceDepthMm)} mm/ano · ${brl2.format(effluentCreditPerFinishedHead)} bruto`} />
                  <Metric label="Área-alvo / coberta" value={`${one.format(effluentScale.targetAreaHa)} / ${one.format(effluentScale.areaCoveredAtTargetDepthHa)} ha`} note={`${one.format(effluentScale.coveragePercent)}% pelo volume da rota própria`} tone={effluentScale.coveragePercent >= 100 ? 'green' : 'warn'} />
                  <Metric label="Confinamento para cobrir a área-alvo com efluente" value={`${int.format(effluentScale.requiredAnnualHeadsAtReferenceStay ?? 0)} cab/ano`} note={`${two.format(effluentScale.requiredReferenceModules ?? 0)} módulos de ${int.format(effluentScale.referenceAreaHa)} ha`} tone="warn" />
                  <Metric label="Crédito do efluente incluído" value={moneyCompact(effluentScale.includedCredit)} note={effluentScale.creditReady ? 'Uma única vez na rota A' : `${moneyCompact(effluentScale.grossPotentialCredit)} bruto aguarda validação`} tone={effluentScale.creditReady ? 'green' : 'warn'} />
                </div>
              </Panel>

              <Panel>
                <div className="flex gap-3 p-5 text-xs leading-relaxed text-muted-foreground lg:p-6"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#a56a1d]" /><p><strong className="text-foreground">Limites de uso:</strong> relatório de apoio à decisão, não recomendação de investimento. EBITDA e margem são indicadores operacionais modelados, não uma DRE contábil. O alocador fecha a capacidade semanal do cocho quando todas as janelas são informadas, mas ainda não fecha estoque de alimento por colheita, fábrica, silo ou caixa mensal com reciclagem. Valide projeto agronômico, hidráulico e zootécnico, impostos, crédito, licenças e cotações locais. Referências públicas de mercado exigem atribuição e confirmação dos direitos de reutilização antes de uso comercial ou redistribuição.</p></div>
              </Panel>

              <div className="grid gap-5 xl:grid-cols-2">
                <Panel><SectionTitle eyebrow="Premissas que governam o resultado" title="Retrato do cenário" /><div className="grid grid-cols-2 gap-3 p-5 lg:p-6"><Metric label="Área" value={`${int.format(assumptions.totalArea)} ha`} /><Metric label="Arrendamento" value={`${brl0.format(assumptions.landLeaseHa)}/ha`} /><Metric label="Arroba" value={`${brl2.format(assumptions.priceArroba)}/@`} /><Metric label="Bezerro" value={`${brl0.format(assumptions.calfCost)}/cab`} /><Metric label="Lotação" value={`${two.format(assumptions.stockingUa)} UA/ha`} /><Metric label="Dieta efetiva" value={`${brl2.format(modelAssumptions.dietPriceDm)}/kg MS`} note={assumptions.linkFeedToCropCosts ? 'Silagem local e milho comprado; transferência própria na alocação avançada' : 'Modo manual'} /><Metric label="CAPEX comum" value={moneyCompact(assumptions.pivotInvestment)} /><Metric label="CAPEX incremental A" value={moneyCompact(assumptions.investment)} /></div></Panel>
                <Panel><SectionTitle eyebrow="Antes de investir" title="Checklist de fechamento" /><div className="space-y-3 p-5 text-xs leading-relaxed text-muted-foreground lg:p-6">{['Confirmar preços na praça e ajustar frete, qualidade, impostos e basis.', 'Trocar custos agregados por três cotações locais de insumos, energia e serviços.', 'Validar outorga, lâmina, uniformidade do pivô e restrições sazonais de água.', 'Preencher entrada e saída de todas as coortes e conferir o pico semanal calculado.', 'Medir o efluente tratado, validar nutrientes e testar se a escala por cabeça-dia do módulo de 50 ha representa a instalação ampliada.', 'Montar estoque datado de milho e silagem, fluxo de caixa mensal, crédito e chamadas de margem.', 'Rodar cenários pessimista, base e otimista antes de aprovar CAPEX e financiamento.'].map((item, index) => <div className="flex gap-3" key={item}><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#edf3e8] font-mono text-[10px] font-bold text-[#315a3e]">{index + 1}</span><p>{item}</p></div>)}</div></Panel>
              </div>
            </TabsContent>

            <TabsContent value="evidence" className="space-y-5">
              <Panel>
                <SectionTitle eyebrow="Rastreabilidade" title="Tipos de fonte e estado de verificação" text="Taxonomia para organizar premissas. Os benchmarks de UA e reprodução e as especificações de contratos estão vinculados abaixo; custos e desempenho locais ainda exigem documentos e histórico de campo." />
                <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5 lg:p-6">{[['A', 'Artigo científico', 'Publicação identificável; método e aderência local a avaliar', 'bg-[#163b29] text-white'], ['B', 'Capítulo ou tese', 'Referência acadêmica; aderência local a avaliar', 'bg-[#2f6847] text-white'], ['C', 'Livro ou caso técnico', 'Referência secundária', 'bg-[#d8e6d7] text-[#254333]'], ['D', 'Material técnico', 'Validação necessária', 'bg-[#fff0c8] text-[#6f5320]'], ['E', 'Base fornecida', 'Validar no projeto', 'bg-[#e8edf0] text-[#3e4f59]']].map(([grade, label, note, color]) => <div className="rounded-2xl border border-border/75 p-4" key={grade}><span className={`grid size-8 place-items-center rounded-full font-mono text-sm font-bold ${color}`}>{grade}</span><p className="mt-3 text-xs font-semibold">{label}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{note}</p></div>)}</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Síntese do método" title="Três elos, não uma promessa de produtividade" />
                <div className="grid gap-3 p-5 md:grid-cols-3 lg:p-6">{[[Leaf, 'Crescimento da forragem', 'Clima, ETc, lâmina efetiva, cultivar, fertilidade e matéria seca.'], [Tractor, 'Eficiência de utilização', 'Altura de entrada/saída, perdas, lotação, ocupação e silagem.'], [Beef, 'Conversão animal', 'Genética, ingestão, GMD, mortalidade, carcaça e preços.']].map(([Icon, title, text]) => { const Component = Icon as typeof Leaf; return <div className="rounded-2xl bg-[#f3f7ef] p-5" key={String(title)}><Component className="size-5 text-[#38694a]" /><h3 className="mt-4 font-semibold">{String(title)}</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{String(text)}</p></div>; })}</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Arquitetura de dados" title="Cinco camadas deixam as premissas rastreáveis" text="O motor separa base local, cálculo, mercado datado, fundamento e hipótese para que o usuário identifique rapidamente onde está o risco de decisão." />
                <div className="grid gap-3 p-5 sm:grid-cols-2 lg:p-6 xl:grid-cols-5">{[['Caso físico A/B', 'Fluxos de animais, dias, pesos, lotação e capacidade anual a validar.'], ['Planilhas locais', 'Valores da base fornecida, ainda sujeitos a conferência documental.'], ['Mercado datado', 'Preço, praça, unidade, data, basis, latência e licença precisam viajar juntos.'], ['Fundamentos oficiais', 'IBGE, USDA e Conab explicam o ciclo; não substituem a curva de preços.'], ['Hipóteses editáveis', 'Produtividade, custos e choques usados para estressar gargalos e pontos de equilíbrio.']].map(([title, text]) => <div className="rounded-2xl border border-border/75 bg-[#f5f7f2] p-4" key={title}><p className="text-sm font-semibold">{title}</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{text}</p></div>)}</div>
              </Panel>

              <Panel>
                <SectionTitle eyebrow="Referências independentes" title="Onde atualizar mercado, custos e água" />
                <div className="grid gap-3 p-5 lg:grid-cols-2 lg:p-6">{[
                  ['CEPEA/ESALQ — indicadores de preços', 'Referências por produto, unidade, praça e data.', 'https://www.cepea.esalq.usp.br/br/indicador/', 'mercado'],
                  ['CONAB — custos de produção', 'Metodologia e séries oficiais para orçamentos agrícolas.', 'https://www.conab.gov.br/info-agro/custos-de-producao', 'custos'],
                  ['ANA — agricultura irrigada', 'Planejamento hídrico, usos da água e contexto regulatório.', 'https://www.gov.br/ana/pt-br/assuntos/usos-da-agua/irrigacao', 'água'],
                  ['ANA — Resolução 156/2023', 'Dimensionamento de captação e lançamento parte da quantidade de animais e do tratamento; regras locais ainda precisam ser verificadas.', 'https://www.gov.br/ana/pt-br/legislacao/resolucoes/resolucoes-regulatorias/2023/156', 'efluente'],
                  ['FEPAM — diretriz para bovinos confinados', 'Benchmark técnico de geração e exigências de coleta/armazenagem; não substitui a licença aplicável na Bahia.', 'https://ww3.fepam.rs.gov.br/central/diretrizes/diret_bovinos_novos.pdf', 'benchmark'],
                  ['Tese de Pedro Veiga Paulino — eficiência alimentar', 'Animais com o mesmo peso e GMD consumiram 11,5% mais matéria seca no grupo de alto consumo residual; GMD isolado não mede eficiência.', 'https://locus.ufv.br/bitstreams/30ca36f0-56ca-4e61-bcc9-65016bc07157/download', 'cocho'],
                  ['Revisão — recria e desempenho posterior', 'Efeitos da nutrição a pasto sobre o confinamento variam entre sistemas; suplementação e GMD anteriores não produzem uma regra universal de ordenação.', 'https://pubmed.ncbi.nlm.nih.gov/15526788/', 'recria'],
                  ['SciELO — manejo do pasto e ganho compensatório', 'No caso estudado, animais de menor ganho na recria tiveram maior GMD no cocho, porém levaram mais dias; reforça comparar margem, consumo e tempo.', 'https://www.scielo.br/j/rbspa/a/HWCK8tnR9jVh3qJ98Jh3zKQ/', 'recria'],
                  ['Pedro Veiga Paulino — importância da recria', 'A maior parte da vida ocorre no pasto; qualidade da cria e da recria condiciona o animal que chega à terminação.', 'https://www.scotconsultoria.com.br/noticias/agronegocio-na-midia/31905/confinamento-requer-aten%C3%A7%C3%A3o-%C3%A0-alimenta%C3%A7%C3%A3o-e-ao-manejo.htm', 'manejo'],
                  ['Embrapa — sistemas de produção', 'Publicações técnicas para validar parâmetros agronômicos e zootécnicos.', 'https://www.embrapa.br/busca-de-publicacoes', 'técnica'],
                  ['Embrapa — UA e lotação por peso', '1 UA = 450 kg de peso vivo; converter capacidade em cabeças pelo peso médio.', 'https://cloud.cnpgc.embrapa.br/sac/2012/09/14/como-faco-para-calcular-quantos-ua%C2%B4sha-ou-lotacao-animal/', 'UA'],
                  ['MAPA/Embrapa — boas práticas bovinas', 'Definições e denominadores para prenhez, desmama e mortalidade.', 'https://www.gov.br/agricultura/pt-br/assuntos/producao-animal/boas-praticas-de-producao-animal/Boaspraticasagropecuariasbovinos2022.pdf/%40%40download/file', 'rebanho'],
                  ['Embrapa — eficiência de confinamentos', 'Pesquisa recente sobre GMD, dias, custos e eficiência técnica.', 'https://ainfo.cnptia.embrapa.br/digital/bitstream/doc/1160682/1/EficienciaTecnicaConfinamentos.pdf', 'cocho'],
                  ['B3 — especificação do BGI', 'Boi gordo padrão: contrato não é cotação de bezerro ou boi magro.', 'https://www.b3.com.br/pt_br/produtos-e-servicos/negociacao/commodities/ficha-do-produto-8AA8D0CC9D71B1D8019D78950B2F5D64.htm', 'BGI'],
                  ['ICE — Cotton No. 2', 'Contrato internacional de pluma; uso no Brasil é cross-hedge e exige conversão.', 'https://www.ice.com/products/254/Cotton-No-2-Futures', 'fibra'],
                  ['USDA FAS — Livestock and Poultry', 'Rebanho, produção, comércio e projeções por região; não prova escassez mundial permanente.', 'https://apps.fas.usda.gov/psdonline/circulars/livestock_poultry.pdf?v=1.0.0', 'ciclo bovino'],
                  ['USDA NASS — Cattle 2026', 'Vacas de corte, estoque e safra de bezerros dos EUA.', 'https://www.nass.usda.gov/Publications/Todays_Reports/reports/catl0126.pdf', 'EUA'],
                  ['IBGE — abate no 1T26', 'Abate total e participação de vacas e novilhas no Brasil.', 'https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/47167-abates-de-bovinos-suinos-e-frangos-tem-o-melhor-resultado-para-um-1-trimestre', 'Brasil'],
                  ['USDA — WASDE ago/2026', 'Balanços mundiais de milho, soja e algodão separados das contas locais.', 'https://www.usda.gov/oce/commodity/wasde/wasde0826.pdf', 'grãos/fibra'],
                  ['Conab — 11º levantamento 2025/26', 'Produção, consumo, exportação e estoque de passagem no Brasil.', 'https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras/safra-de-graos/boletim-da-safra-de-graos/11o-levantamento-safra-2025-26/11o-levantamento-safra-2025-26', 'Brasil'],
                ].map(([title, text, href, grade]) => <a className="group rounded-2xl border border-border/75 p-4 transition hover:border-[#61836a]/50 hover:bg-[#f5f8f2]" href={href} key={href} rel="noreferrer" target="_blank"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold group-hover:text-[#2d6442]">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{text}</p></div><span className="rounded-full bg-[#edf3e8] px-2 py-1 text-[9px] font-bold uppercase tracking-wide">{grade}</span></div><p className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-[#477357]">Abrir fonte <ExternalLink className="size-3" /></p></a>)}</div>
                <div className="mx-5 mb-5 flex gap-3 rounded-xl border border-[#e2c37e]/35 bg-[#fff8e9] p-4 text-xs leading-relaxed text-[#735a2a] lg:mx-6 lg:mb-6"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>Benchmarks externos sem documentação suficiente não foram incluídos nesta versão; isso não avalia sua validade. A incorporação ao motor exige fonte rastreável, unidade compatível e validação local.</p></div>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="no-print mt-6 border-t border-white/10 bg-[#0d2b1e] text-white"><div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-3 px-4 py-6 text-[11px] text-white/55 sm:px-6 lg:flex-row lg:px-8"><p>BoiMeta · explorador técnico-econômico de cenários</p><p>Decisão sujeita a projeto hidráulico, orçamento, crédito, licenças e dados de campo.</p></div></footer>
      <nav className="mobile-app-nav no-print" aria-label="Navegação principal do simulador">
        {mobileControlsOpen ? <p className="mobile-live-margin">Margem modelada: <strong>{best.id === 'none-feasible' ? 'n/d' : moneyCompact(best.margin)}</strong> / ano · {int.format(assumptions.totalArea)} ha</p> : null}
        <div className="grid grid-cols-4">
          <button type="button" aria-expanded={mobileControlsOpen} aria-controls="quick-controls" onClick={() => openEditor(editorGroup ?? 'farm')}><SlidersHorizontal aria-hidden="true" />Cenário</button>
          {([['quick', 'Resultado', Gauge], ['market', 'Mercado', TrendingUp], ['report', 'Relatório', FileText]] as const).map(([tab, label, Icon]) => <button type="button" key={tab} aria-current={!mobileControlsOpen && activeTab === tab ? 'page' : undefined} onClick={() => { setMobileControlsOpen(false); openAnalysisTab(tab); document.getElementById('analysis-tabs')?.focus({ preventScroll: true }); }}><Icon aria-hidden="true" />{label}</button>)}
        </div>
      </nav>
    </main>
  );
}
