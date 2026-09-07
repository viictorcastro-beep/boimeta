'use client';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import {
  referenceBridge,
  cattleStartupCash,
  pastureRequirements,
  observedGains,
  reviewDefaults,
  REVIEW_VERSION,
} from '@/lib/decision-review';
import { calculateCore, type Assumptions } from '@/lib/livestock-model';

const money = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
const number = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
type Study = {
  name: string;
  savedAt: string;
  model: string;
  marginHa: number;
  json: string;
};
const LIBRARY_KEY = 'boimeta-study-library-v1';
type Props = {
  assumptions: Assumptions;
  anchor: string;
  config: typeof reviewDefaults;
  onConfig: (next: typeof reviewDefaults) => void;
  operations: Record<string, number>;
  onOperation: (key: string, value: number) => void;
  budget: number;
  onBudget: (value: number) => void;
  exportScenario: () => string;
  restoreScenario: (raw: unknown) => void;
  onResetReference: () => void;
};
function Field({
  label,
  value,
  onChange,
  max = 1e10,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <label className="block text-sm">
      <span>{label}</span>
      <Input
        className="mt-1 bg-white font-mono"
        type="number"
        min={0}
        max={max}
        step="any"
        value={Number(value.toFixed(4))}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.max(0, Math.min(max, v)));
        }}
      />
    </label>
  );
}
export function DecisionReview(p: Props) {
  const bridge = useMemo(() => referenceBridge(p.assumptions), [p.assumptions]);
  const core = useMemo(() => calculateCore(p.assumptions), [p.assumptions]);
  const physical = useMemo(
    () => pastureRequirements(p.assumptions, p.config),
    [p.assumptions, p.config],
  );
  const startupA = useMemo(
    () =>
      cattleStartupCash(
        p.assumptions,
        'A',
        p.anchor,
        p.operations.setupDays,
        p.operations.setupCost,
      ),
    [p.assumptions, p.anchor, p.operations.setupDays, p.operations.setupCost],
  );
  const startupB = useMemo(
    () =>
      cattleStartupCash(
        p.assumptions,
        'B',
        p.anchor,
        p.operations.setupDays,
        p.operations.setupCost,
      ),
    [p.assumptions, p.anchor, p.operations.setupDays, p.operations.setupCost],
  );
  const observed = useMemo(
    () => observedGains(p.config.observations, p.assumptions.gmdPivotA),
    [p.config.observations, p.assumptions.gmdPivotA],
  );
  const [studies, setStudies] = useState<Study[]>(() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw: unknown = JSON.parse(
        localStorage.getItem(LIBRARY_KEY) ?? '[]',
      );
      if (Array.isArray(raw))
        return raw
          .filter(
            (s): s is Study =>
              s &&
              typeof s.name === 'string' &&
              s.name.length <= 80 &&
              typeof s.json === 'string' &&
              s.json.length <= 2_000_000 &&
              Number.isFinite(s.marginHa) &&
              typeof s.savedAt === 'string' &&
              typeof s.model === 'string',
          )
          .slice(0, 10);
    } catch {
      /* Armazenamento pode estar indisponível; exportação continua utilizável. */
    }
    return [];
  });
  const [message, setMessage] = useState('');
  const saveStudy = () => {
    const next = [
      {
        name: p.config.studyName.trim().slice(0, 80) || 'Cenário',
        savedAt: new Date().toISOString(),
        model: REVIEW_VERSION,
        marginHa: bridge.currentTotalHa,
        json: p.exportScenario(),
      },
      ...studies,
    ].slice(0, 10);
    try {
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
      setStudies(next);
      setMessage(
        'Estudo salvo neste dispositivo. Exporte o cenário para fazer uma cópia externa.',
      );
    } catch {
      setMessage(
        'Não foi possível salvar. Exporte o cenário; o estudo atual continua na tela.',
      );
    }
  };
  const op = (key: string, label: string, max?: number) => (
    <Field
      key={key}
      label={label}
      value={p.operations[key] ?? 0}
      onChange={(v) => p.onOperation(key, v)}
      max={max}
    />
  );
  const conf = (
    key: keyof typeof reviewDefaults,
    label: string,
    max?: number,
  ) => (
    <Field
      key={key}
      label={label}
      value={Number(p.config[key])}
      onChange={(v) => p.onConfig({ ...p.config, [key]: v })}
      max={max}
    />
  );
  const netCash = (cash: NonNullable<typeof startupA>) =>
    cash.events.reduce((s, e) => s + e.inflow - e.outflow, 0);
  return (
    <div className="space-y-5 text-base">
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-2xl font-semibold">
          De onde vem a margem?
        </h2>
        <p className="mt-2 text-muted-foreground">
          Referência histórica e cenário local usam o mesmo denominador. Não
          ajustamos custos ou produtividade para forçar o resultado da
          referência.
        </p>
        <div className="my-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[#eef5ef] p-4">
            <p className="text-sm">Histórico: caixa / ha de pasto</p>
            <strong className="text-xl">{money(32261)}/ano</strong>
            <p className="text-sm">300 ha de pasto + 100 ha de silagem</p>
          </div>
          <div className="rounded-xl bg-[#eef5ef] p-4">
            <p className="text-sm">Mesmo indicador / ha total</p>
            <strong className="text-xl">
              {money(bridge.normalizedCashHa)}/ano
            </strong>
            <p className="text-sm">32.261 × 300 ÷ 400</p>
          </div>
          <div className="rounded-xl bg-[#173e2c] p-4 text-white">
            <p className="text-sm">Seu A / ha total</p>
            <strong className="text-xl">
              {money(bridge.currentTotalHa)}/ano
            </strong>
            <p className="text-sm">
              Margem caixa de regime pleno, não lucro líquido
            </p>
          </div>
        </div>
        <p className="text-sm">
          O resumo histórico informa EBITDA de {money(9808729)}, ou{' '}
          {money(bridge.sourceTotalHa)}/ha total com vacas. A soma das margens
          unitárias por cabeças difere desse resumo em{' '}
          {money(bridge.sourceUnreconciled)}. As fotos não permitem fechar esse
          ajuste; a diferença permanece identificada.
        </p>
        <details className="mt-4 rounded-xl border p-4" open>
          <summary className="cursor-pointer font-semibold">
            Ponte de cálculo · R$/ha total/ano
          </summary>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alteração acumulada</TableHead>
                  <TableHead className="text-right">Efeito</TableHead>
                  <TableHead className="text-right">
                    Margem resultante
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bridge.rows.map((r) => (
                  <TableRow key={r.label}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right font-mono">
                      {money(r.delta)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {money(r.value)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Efeitos sequenciais na ordem acima, não sensibilidades
            independentes. A primeira diferença inclui inconsistências
            documentais e correções do motor. O efluente não é creditado no
            núcleo anual sem validação.
          </p>
        </details>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={p.onResetReference}>
            Carregar premissas históricas
          </Button>
          <p className="text-sm text-muted-foreground">
            Salve seu cenário antes. Carregar a referência não elimina as
            diferenças documentais.
          </p>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <h2 className="font-heading text-xl font-semibold">
          Capital e primeiro ano
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Field
            label="Capital total disponível · R$"
            value={p.budget}
            onChange={p.onBudget}
          />
          {op('reserveCash', 'Reserva que não será investida · R$')}
          {op('setupCost', 'Preparação adicional não incluída no CAPEX · R$')}
          {op('setupDays', 'Espera até entrada do primeiro lote · dias', 730)}
        </div>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead>Margem anual estabilizada</TableHead>
                <TableHead>Saldo caixa ano 1, após CAPEX</TableHead>
                <TableHead>Pico de financiamento + reserva</TableHead>
                <TableHead>Animais ao fim do ano</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ['A · recria + cocho', startupA, core.ebitdaA],
                  ['B · pivô', startupB, core.ebitdaB],
                ] as const
              ).map(
                ([label, cash, margin]) =>
                  cash && (
                    <TableRow key={label}>
                      <TableCell>{label}</TableCell>
                      <TableCell className="font-mono">
                        {money(margin)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {money(netCash(cash))}
                      </TableCell>
                      <TableCell className="font-mono">
                        {money(cash.peakFundingNeed + p.operations.reserveCash)}
                      </TableCell>
                      <TableCell>{number(cash.closingHeads)} cab</TableCell>
                    </TableRow>
                  ),
              )}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {startupA?.note} O estoque final é mostrado em cabeças, sem
          transformá-lo em recebimento. Parcelamentos, impostos sobre lucro e
          financiamento ainda exigem orçamento específico.
        </p>
        <details className="mt-4 rounded-xl border p-4">
          <summary className="cursor-pointer font-semibold">
            Fluxo mensal da implantação A
          </summary>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Entradas</TableHead>
                  <TableHead>Saídas</TableHead>
                  <TableHead>Saldo acumulado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {startupA?.rows.map((r) => (
                  <TableRow key={r.month}>
                    <TableCell>{r.month}</TableCell>
                    <TableCell>{money(r.inflow)}</TableCell>
                    <TableCell>{money(r.outflow)}</TableCell>
                    <TableCell>{money(r.cumulative)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </section>
      <details className="rounded-2xl border bg-card p-5 sm:p-6">
        <summary className="cursor-pointer text-xl font-semibold">
          Alimentos, pasto e água · conferir capacidade
        </summary>
        <p className="mt-3 text-sm">
          Dados sem medição ficam como não informados, não como capacidade
          comprovada. A oferta mensal usa a distribuição editável abaixo; não é
          previsão climática.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {op('openingSilageTonnesDm', 'Silagem já existente · t MS')}
          {op(
            'silageFirstReleaseDays',
            'Liberação do primeiro silo após marco · dias',
            730,
          )}
          {op(
            'silageCutIntervalDays',
            'Intervalo entre liberações · dias',
            730,
          )}
          {op(
            'otherIngredientSharePercent',
            'Complemento/proteico/núcleo · % da MS',
            100,
          )}
          {conf(
            'pastureYieldDmTonnesHa',
            'Produção medida de pasto · t MS/ha/ano',
          )}
          {conf(
            'grazingEfficiencyPercent',
            'Aproveitamento da MS produzida · %',
            100,
          )}
          {conf('intakePercent', 'Consumo de MS · % peso vivo/dia', 10)}
          {conf('waterDepthMmYear', 'Lâmina líquida de irrigação · mm/ano')}
          {conf(
            'irrigationEfficiencyPercent',
            'Eficiência de aplicação · %',
            100,
          )}
          {conf('kwhM3', 'Energia específica · kWh/m³')}
          {conf('electricityPrice', 'Tarifa entregue · R$/kWh')}
        </div>
        <p className="mt-4 text-sm">
          Dieta atual: {number(p.assumptions.forageShare)}% silagem +{' '}
          {number(
            Math.max(
              0,
              100 -
                p.assumptions.forageShare -
                p.operations.otherIngredientSharePercent,
            ),
          )}
          % milho + {number(p.operations.otherIngredientSharePercent)}%
          complemento. O custo do complemento continua em R$/kg da dieta total,
          no campo de custos adicionais.{' '}
          {p.assumptions.forageShare +
            p.operations.otherIngredientSharePercent >
          100
            ? 'ERRO: as frações excedem 100%; rota A não é elegível.'
            : 'Fechar massa não comprova proteína, energia ou fibra; validar formulação e GMD com responsável técnico.'}
        </p>
        <p className="mt-3 text-sm">
          MS demandada no pasto: {number(physical.annualDemand / 1000)} t/ano.
          Um lote único no peso de saída ocuparia{' '}
          {number(physical.peakUaSingleBatch)} UA/ha, frente a{' '}
          {number(p.assumptions.stockingUa)} UA/ha médias. O escalonamento
          precisa ser demonstrado. Referência:{' '}
          <a
            className="underline"
            href="https://cloud.cnpgc.embrapa.br/sac/2016/06/15/como-se-calcula-a-capacidade-de-suporte-de-uma-pastagem/"
            target="_blank"
            rel="noreferrer"
          >
            Embrapa · capacidade de suporte e UA
          </a>
          .
        </p>
        <p className="mt-3 text-sm">
          Água bruta:{' '}
          {physical.grossWaterM3 === null
            ? 'informar lâmina e eficiência'
            : `${number(physical.grossWaterM3)} m³/ano`}
          . Energia estimada:{' '}
          {physical.energyCost === null
            ? 'informar consumo e tarifa'
            : `${money(physical.energyCost)}/ano`}
          . Diagnóstico separado: não soma novamente ao orçamento de irrigação
          já incluído.
        </p>
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Fração da produção anual · %</TableHead>
                <TableHead>Oferta aproveitável · t MS</TableHead>
                <TableHead>Demanda · t MS</TableHead>
                <TableHead>Déficit · t MS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {physical.months.map((r, i) => (
                <TableRow key={r.month}>
                  <TableCell>{r.month}</TableCell>
                  <TableCell>
                    <Input
                      aria-label={`Produção de pasto no mês ${r.month} em percentual anual`}
                      className="w-24"
                      type="number"
                      min={0}
                      max={100}
                      value={Number(p.config.monthlyForageShares[i].toFixed(3))}
                      onChange={(e) => {
                        const next = [...p.config.monthlyForageShares];
                        next[i] = Math.max(
                          0,
                          Math.min(100, Number(e.target.value) || 0),
                        );
                        p.onConfig({ ...p.config, monthlyForageShares: next });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {r.supply === null
                      ? 'não informado'
                      : number(r.supply / 1000)}
                  </TableCell>
                  <TableCell>{number(r.demand / 1000)}</TableCell>
                  <TableCell>
                    {r.gap === null ? 'não calculado' : number(r.gap / 1000)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!physical.validShares && (
          <p className="mt-2 text-sm text-red-800">
            A distribuição dos 12 meses deve somar 100%. A oferta não foi
            validada.
          </p>
        )}
      </details>
      <details className="rounded-2xl border bg-card p-5 sm:p-6">
        <summary className="cursor-pointer text-xl font-semibold">
          Efluente · economia líquida
        </summary>
        <p className="mt-3 text-sm">
          O valor bruto por m³ é limitado ao adubo realmente substituível e
          deduzido dos custos abaixo. Zero de disponibilidade ou de orçamento
          substituível não concede benefício. Não reduzir fertilizantes na
          planilha e creditar novamente a mesma economia.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {op(
            'effluentAvailabilityPercent',
            'Disponibilidade agronômica · %',
            100,
          )}
          {op(
            'effluentFertilizerCapHa',
            'Adubação substituível · R$/ha aplicado',
          )}
          {op('effluentTreatmentM3', 'Tratamento do volume gerado · R$/m³')}
          {op('effluentApplicationM3', 'Aplicação · R$/m³ aplicado')}
          {op('effluentFixedCost', 'Outros custos fixos de operação · R$/ano')}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Teto econômico preliminar, não balanço químico de N/P/K nem
          autorização ambiental. O líquido aparece na aba Rebanho & alocação;
          pode ser negativo.
        </p>
      </details>
      <details className="rounded-2xl border bg-card p-5 sm:p-6">
        <summary className="cursor-pointer text-xl font-semibold">
          Estudos salvos e desempenho realizado
        </summary>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label
            htmlFor="review-study-name"
            className="min-w-48 flex-1 text-sm"
          >
            Nome do estudo
            <Input
              id="review-study-name"
              maxLength={80}
              value={p.config.studyName}
              onChange={(e) =>
                p.onConfig({ ...p.config, studyName: e.target.value })
              }
            />
          </label>
          <Button onClick={saveStudy}>Salvar estudo</Button>
        </div>
        <output className="mt-2 block text-sm">{message}</output>
        <p className="mt-2 text-sm text-muted-foreground">
          Até 10 versões neste navegador; não há sincronização ou envio de
          dados. A comparação abaixo usa A por hectare total. Versões antigas
          não são comparáveis sem recalcular.
        </p>
        <div className="mt-3 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estudo</TableHead>
                <TableHead>Data / modelo</TableHead>
                <TableHead>A · margem/ha total</TableHead>
                <TableHead>Diferença atual</TableHead>
                <TableHead>Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {studies.map((s, i) => (
                <TableRow key={`${s.savedAt}-${i}`}>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>
                    {s.savedAt.slice(0, 10)} · {s.model}
                  </TableCell>
                  <TableCell>{money(s.marginHa)}</TableCell>
                  <TableCell>
                    {s.model === REVIEW_VERSION
                      ? money(bridge.currentTotalHa - s.marginHa)
                      : 'recalcular'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      onClick={() => {
                        try {
                          p.restoreScenario(JSON.parse(s.json));
                          setMessage(
                            'Estudo restaurado; confirmações de execução expiradas.',
                          );
                        } catch (e) {
                          setMessage(
                            e instanceof Error
                              ? e.message
                              : 'Estudo incompatível.',
                          );
                        }
                      }}
                    >
                      Restaurar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <label className="mt-5 block text-sm">
          Pesagens reais · id;data;peso vivo kg
          <textarea
            className="mt-2 min-h-36 w-full rounded-xl border bg-white p-3 font-mono text-sm"
            maxLength={3900}
            placeholder={
              'id;data;peso\nLOTE-01;2026-09-10;240\nLOTE-01;2026-10-10;267'
            }
            value={p.config.observations}
            onChange={(e) =>
              p.onConfig({ ...p.config, observations: e.target.value })
            }
          />
        </label>
        {observed.errors.map((error) => (
          <p className="text-sm text-red-800" key={error}>
            {error}
          </p>
        ))}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Dias</TableHead>
                <TableHead>GMD realizado</TableHead>
                <TableHead>Desvio da meta</TableHead>
                <TableHead>Próxima verificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {observed.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.id}</TableCell>
                  <TableCell>{r.days}</TableCell>
                  <TableCell>
                    {r.gmd === null
                      ? 'duas pesagens necessárias'
                      : `${number(r.gmd)} kg/d`}
                  </TableCell>
                  <TableCell>
                    {r.deviation === null ? '—' : `${number(r.deviation)} kg/d`}
                  </TableCell>
                  <TableCell>{r.action}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Não altera automaticamente a dieta ou o destino do animal. Baixo GMD
          pode ser nutricional, sanitário, de manejo ou de medição. Os registros
          são incluídos na exportação do cenário.
        </p>
      </details>
    </div>
  );
}
