'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { calculateCore } from '@/lib/livestock-model';
import {
  capitalStudy,
  enterpriseLabels,
  enterpriseIds,
  inverseCropCapital,
  marginLevers,
  stockingStudy,
  feedlotTurningPoints,
  type EnterpriseId,
  type LabInput,
} from '@/lib/decision-lab';

const money = (v: number) =>
  Number.isFinite(v)
    ? v.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        maximumFractionDigits: 0,
      })
    : 'n/d';
const n = (v: number, digits = 1) =>
  Number.isFinite(v)
    ? v.toLocaleString('pt-BR', { maximumFractionDigits: digits })
    : 'n/d';
const labels: Record<EnterpriseId, string> = {
  ...enterpriseLabels,
  'cattle-a': 'Recria + cocho',
  'cattle-b': 'Terminação a pasto',
  'cattle-c': 'Só recria',
};
type Props = {
  input: LabInput;
  onEdit: (group: string, field?: string) => void;
  onBudget: (value: number) => void;
  onValidate: () => void;
  onCosts: () => void;
};

export function DecisionLab({
  input,
  onEdit,
  onBudget,
  onValidate,
  onCosts,
}: Props) {
  const [active, setActive] = useState('capital');
  const [activity, setActivity] = useState<EnterpriseId>('cattle-a');
  const [direction, setDirection] = useState<'improve' | 'pressure'>('improve');
  const [reference, setReference] = useState<
    'cattle-a' | 'cattle-b' | 'cattle-c'
  >('cattle-c');
  // Estudos especializados só são calculados quando solicitados; não atrasam cada toque.
  const capital = useMemo(
    () => (active === 'capital' ? capitalStudy(input) : null),
    [input, active],
  );
  const inverse = useMemo(
    () => (active === 'capital' ? inverseCropCapital(input, reference) : null),
    [input, active, reference],
  );
  const levers = useMemo(
    () =>
      active === 'levers' ? marginLevers(input, activity, direction) : null,
    [input, active, activity, direction],
  );
  const stocking = useMemo(
    () => (active === 'stocking' ? stockingStudy(input) : []),
    [input, active],
  );
  const turning = useMemo(
    () =>
      active === 'levers' && activity === 'cattle-a'
        ? feedlotTurningPoints(input)
        : null,
    [input, active, activity],
  );
  const leader = capital?.leader;
  const actual = stocking.find((r) => r.desired === input.desiredUa);
  const base = calculateCore(input.a);
  const referenceDiet = calculateCore({ ...input.a, dietPriceDm: 1.1239 });
  return (
    <section
      className="rounded-2xl border bg-card p-4 sm:p-6"
      aria-labelledby="decision-lab-title"
    >
      <h2
        id="decision-lab-title"
        className="font-heading text-2xl font-semibold"
      >
        O que muda a decisão?
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Compare o mesmo caixa, descubra o efeito de cada ajuste e confira onde a
        lotação esbarra no alimento.
      </p>
      <Tabs value={active} onValueChange={setActive} className="mt-5">
        <TabsList className="primary-tabs">
          <TabsTrigger value="capital">Mesmo capital</TabsTrigger>
          <TabsTrigger value="levers">Alavancas de margem</TabsTrigger>
          <TabsTrigger value="stocking">Lotação e área</TabsTrigger>
        </TabsList>
        <TabsContent value="capital" className="mt-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              Caixa: <strong>{money(input.budget)}</strong> · limite físico:{' '}
              <strong>{n(input.a.totalArea)} ha</strong>
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => onBudget(6000000)}>
                Testar R$ 6 milhões
              </Button>
              <Button
                variant="outline"
                onClick={() => onEdit('farm', 'Capital disponível')}
              >
                Alterar capital
              </Button>
            </div>
          </div>
          <div className="rounded-xl bg-secondary p-4">
            <p className="font-semibold">
              {!leader
                ? 'Nenhuma operação testada supera deixar a área sem produção.'
                : leader.best.margin <= 0
                  ? 'As escalas financiáveis apresentam perda. Não há indicação para investir.'
                  : `${labels[leader.id]}: maior margem total entre as escalas testadas.`}
            </p>
            <p className="mt-2 text-sm">
              {leader
                ? `${n(leader.best.area)} ha operados · ${money(leader.best.margin)}/ano · ${money(leader.best.capital)} de capital requerido. Não é lucro líquido nem caixa do primeiro ano.`
                : 'Compare o caixa disponível com o investimento fixo e as perdas. Sem produção, permanece o arrendamento conhecido; outros custos inevitáveis ainda precisam ser informados.'}
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Alternativa</TableHead>
                <TableHead>Área de maior margem testada</TableHead>
                <TableHead>Margem anual total</TableHead>
                <TableHead>Capital utilizado</TableHead>
                <TableHead>Para a área inteira</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capital?.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <strong>{labels[row.id]}</strong>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {!row.full.valid
                        ? 'Rever pesos/calendário'
                        : row.maximumArea > 0
                          ? `Máximo financiável: ${n(row.maximumArea)} ha`
                          : 'Sem área operada no orçamento'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {n(row.best.area)} ha
                    <p className="text-xs text-muted-foreground">
                      {n(row.best.idleArea)} ha sem atividade
                    </p>
                    {row.best.area === 0 && row.bestOperating && (
                      <p className="text-xs text-destructive">
                        Operar {n(row.bestOperating.area)} ha daria{' '}
                        {money(row.bestOperating.margin)}/ano
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    {money(row.best.margin)}
                    <p className="text-xs text-muted-foreground">
                      {row.best.sold > 0
                        ? `${n(row.best.sold, 0)} vendidos/ano`
                        : 'sem receita de gado'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {money(row.best.capital)}
                    <p className="text-xs text-muted-foreground">
                      Caixa livre: {money(row.spareCash)}
                    </p>
                  </TableCell>
                  <TableCell>
                    {money(row.full.capital)}
                    <p className="text-xs text-muted-foreground">
                      {row.shortfall > 0
                        ? `Faltam ${money(row.shortfall)}`
                        : 'Cabe no orçamento'}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground">
            Cada linha é uma alternativa exclusiva: não some as margens. Busca
            em hectares inteiros, até 21 escalas e pontos de saturação do cocho;
            não é ótimo global. CAPEX, preparação e reserva são mantidos. O
            arrendamento da área ociosa continua pago. Outros custos de
            manutenção ociosa precisam de orçamento. Dinheiro que sobra não gera
            rendimento automático.
          </p>
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              E com o dinheiro necessário para lotar toda a área?
            </summary>
            <div className="mt-4 space-y-4">
              <fieldset
                className="flex flex-wrap gap-2"
                aria-label="Capital da rota pecuária"
              >
                {(['cattle-a', 'cattle-b', 'cattle-c'] as const).map((id) => (
                  <Button
                    key={id}
                    variant={reference === id ? 'default' : 'outline'}
                    aria-pressed={reference === id}
                    onClick={() => setReference(id)}
                  >
                    {labels[id]}
                  </Button>
                ))}
              </fieldset>
              <p>
                {labels[reference]} em {n(input.a.totalArea)} ha requer{' '}
                <strong>{money(inverse?.reference.capital ?? 0)}</strong>, com a
                lotação aplicada e os limites atuais. Não significa que pasto,
                silagem e cocho estejam todos plenamente ocupados.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cultura</TableHead>
                    <TableHead>Área equivalente de custeio</TableHead>
                    <TableHead>Margem na área disponível</TableHead>
                    <TableHead>Capital nesta fazenda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inverse?.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{labels[row.id]}</TableCell>
                      <TableCell>
                        {row.equivalentArea === null
                          ? 'n/d'
                          : `${n(row.equivalentArea)} ha`}
                        <p className="text-xs text-muted-foreground">
                          {(row.extraArea ?? 0) > 0
                            ? `${n(row.extraArea!)} ha excedem a fazenda`
                            : 'Dentro da área informada'}
                        </p>
                      </TableCell>
                      <TableCell>
                        {money(row.local.margin)}
                        <p className="text-xs text-muted-foreground">
                          Em {n(row.local.area)} ha, não na área teórica
                        </p>
                      </TableCell>
                      <TableCell>{money(row.local.capital)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground">
                A área equivalente responde quanto o custeio poderia financiar.
                Não inclui aquisição de terras, novos pivôs, água, energia ou
                máquinas para expansão. A margem é limitada à área que você
                informou. O CAPEX de cocho da alternativa A não é uma obrigação
                das lavouras.
              </p>
            </div>
          </details>
        </TabsContent>
        <TabsContent value="levers" className="mt-5 space-y-5">
          <fieldset
            className="flex flex-wrap gap-2"
            aria-label="Atividade para estudar"
          >
            {enterpriseIds.map((id) => (
              <Button
                key={id}
                variant={activity === id ? 'default' : 'outline'}
                aria-pressed={activity === id}
                onClick={() => setActivity(id)}
              >
                {labels[id]}
              </Button>
            ))}
          </fieldset>
          <fieldset
            className="flex flex-wrap gap-2"
            aria-label="Direção do teste"
          >
            <Button
              variant={direction === 'improve' ? 'default' : 'outline'}
              aria-pressed={direction === 'improve'}
              onClick={() => setDirection('improve')}
            >
              Testar melhoria
            </Button>
            <Button
              variant={direction === 'pressure' ? 'default' : 'outline'}
              aria-pressed={direction === 'pressure'}
              onClick={() => setDirection('pressure')}
            >
              Testar pressão
            </Button>
          </fieldset>
          {turning?.valid && (
            <div className="rounded-xl border bg-secondary p-4 space-y-3">
              <h3 className="font-semibold">
                Quando o confinamento supera as outras rotas?
              </h3>
              <p className="text-sm">
                Melhor divisão testada nas condições atuais:{' '}
                <strong>{n(turning.silageShare)}% silagem</strong> e{' '}
                {n(100 - turning.silageShare)}% pasto. Margem de A:{' '}
                <strong>{money(turning.balanced.margin)}/ano</strong>; capital:{' '}
                <strong>{money(turning.balanced.capital)}</strong>
                {turning.balanced.capital > input.budget
                  ? ' · fora do orçamento'
                  : ''}
                .
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comparação anual</TableHead>
                    <TableHead>Diferença de A</TableHead>
                    <TableHead>Boi gordo: preço de empate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {turning.comparisons.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>A versus {labels[row.id]}</TableCell>
                      <TableCell>{money(row.difference)}</TableCell>
                      <TableCell>
                        {row.price === null
                          ? 'Sem empate não negativo'
                          : `${row.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}/@ · A melhora ${row.direction}`}{' '}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground">
                Busca de 5% a 80% de silagem, de 0,1 em 0,1 ponto, mais a
                divisão atual. Mesma área, cocho e demais premissas; não aplica
                alterações. Preço de empate não é previsão: mantém magro,
                reposição e alimentação fixos, embora possam variar juntos. A
                diferença anual não remunera automaticamente o CAPEX nem
                representa caixa do primeiro ano.
              </p>
            </div>
          )}
          <p className="text-sm">
            Base: <strong>{money(levers?.base.margin ?? 0)}/ano</strong> em{' '}
            {n(input.a.totalArea)} ha. Equilíbrio de venda:{' '}
            <strong>
              {levers?.base.breakEven == null
                ? 'sem ponto único válido'
                : `${n(levers.base.breakEven, 2)} ${levers.base.breakEvenUnit}`}
            </strong>
            .
          </p>
          {!levers?.base.valid ? (
            <p>
              Corrija os pesos ou calendário da atividade antes de analisar
              alavancas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Uma mudança por vez</TableHead>
                  <TableHead>Valor testado</TableHead>
                  <TableHead>Efeito na margem anual</TableHead>
                  <TableHead>Nova margem anual</TableHead>
                  <TableHead>Capital adicional</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levers.rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>
                      <strong>{row.label}</strong>
                      <p className="mt-1 max-w-80 text-xs text-muted-foreground">
                        {row.warning}
                      </p>
                      <button
                        type="button"
                        className="mt-2 min-h-11 text-sm font-semibold underline"
                        onClick={() =>
                          row.field ? onEdit(row.group, row.field) : onCosts()
                        }
                      >
                        Conferir premissa
                      </button>
                    </TableCell>
                    <TableCell>
                      {n(row.value, 3)} {row.unit}
                    </TableCell>
                    <TableCell
                      className={
                        row.delta < 0 ? 'text-destructive' : 'text-primary'
                      }
                    >
                      {money(row.delta)}
                    </TableCell>
                    <TableCell>{money(row.result.margin)}</TableCell>
                    <TableCell>
                      {money(row.extraCapital)}
                      <p className="text-xs text-muted-foreground">
                        {row.result.capital > input.budget
                          ? `Faltam ${money(row.result.capital - input.budget)} no orçamento`
                          : 'Cabe no capital informado'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="rounded-xl border bg-secondary p-4 text-sm">
            Os efeitos não se somam automaticamente. A melhora de GMD ou
            produtividade é uma hipótese, não uma intervenção gratuita: o ganho
            exibido é o teto antes de novos custos. Mercado, sanidade, dieta,
            adubação e capacidade precisam sustentar o teste. Não há previsão de
            preço embutida.
          </p>
          {activity === 'cattle-a' && (
            <details className="rounded-xl border p-4">
              <summary className="cursor-pointer font-semibold">
                Por que A pode ficar abaixo da referência?
              </summary>
              <div className="mt-3 space-y-3 text-sm">
                <p>
                  Os R$ 32.261/ha de caixa da referência usam 300 ha de pasto.
                  Normalizados pelos 400 ha totais, equivalem a{' '}
                  <strong>{money((32261 * 300) / 400)}/ha total</strong>, sem
                  reconstruir ajustes/vacas do resumo. Os R$ 16.873 de B são
                  margem após custos não caixa; sua margem caixa de referência é
                  R$ 18.292/ha. Compare a mesma métrica.
                </p>
                <p>
                  Dieta aplicada:{' '}
                  <strong>{n(input.a.dietPriceDm, 3)} R$/kg MS</strong>. Se
                  trocássemos somente esse preço pelos 1,1239 R$/kg MS da
                  referência, A teria {money(referenceDiet.ebitdaA)}/ano:
                  diferença de {money(referenceDiet.ebitdaA - base.ebitdaA)}.
                  Isso não prova que a dieta antiga está disponível hoje.
                </p>
                <p>
                  Gargalo atual: <strong>{base.bindingConstraintA}</strong>.
                  Aumentar apenas a lotação não remove falta de silagem ou
                  vagas. A recria C não fazia parte do comparativo original A ×
                  B.
                </p>
              </div>
            </details>
          )}
        </TabsContent>
        <TabsContent value="stocking" className="mt-5 space-y-5">
          <p className="rounded-xl bg-secondary p-4 text-sm">
            <strong>Informe a lotação diretamente por hectare de pasto.</strong>{' '}
            A área de silagem é descontada da área, não desse número. A usa{' '}
            {n(base.pastureAreaA)} ha de pasto + {n(base.silageArea)} ha de
            silagem. B e C usam {n(input.a.totalArea)} ha de pasto, sem essa
            reserva de silagem. UA é massa viva: 1 UA = 450 kg, não uma cabeça.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onEdit('cattle', 'Lotação no pasto')}
            >
              Alterar UA/ha de pasto
            </Button>
            <Button
              variant="outline"
              onClick={() => onEdit('feed', 'Área de silagem')}
            >
              Alterar divisão da área
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                onEdit('cattle', 'Intensificação adicional do pasto')
              }
            >
              Custear intensificação
            </Button>
          </div>
          <p className="text-sm">
            Teste das lotações desejadas, mantendo GMD, custos por hectare e
            divisão atuais. O pasto medido pode limitar a lotação aplicada.{' '}
            <strong>15 UA no verão não demonstram 15 UA de média anual.</strong>
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UA/ha de pasto desejada → aplicada</TableHead>
                <TableHead>UA no pasto de A</TableHead>
                <TableHead>A: terminados/ano e margem</TableHead>
                <TableHead>B: margem anual</TableHead>
                <TableHead>C: margem anual</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stocking.map((row) => (
                <TableRow key={row.desired}>
                  <TableCell>
                    {n(row.desired)} → {n(row.applied, 2)}
                    <p className="text-xs text-muted-foreground">
                      {row.known
                        ? row.limited
                          ? 'Limitada pelos dados de MS'
                          : 'Teto de MS calculado'
                        : 'Suporte ainda não comprovado'}
                    </p>
                  </TableCell>
                  <TableCell>
                    {n(row.pastureUaA, 0)} UA
                    <p className="text-xs text-muted-foreground">
                      {n(row.pastureUaPerTotalArea, 2)} UA/ha total: só o pasto
                    </p>
                  </TableCell>
                  <TableCell>
                    {n(row.rows[0].sold, 0)} · {money(row.rows[0].margin)}
                    <p className="text-xs text-muted-foreground">
                      {row.rows[0].bottleneck}
                    </p>
                  </TableCell>
                  <TableCell>
                    {money(row.rows[1].margin)}
                    <p className="text-xs text-muted-foreground">
                      Capital {money(row.rows[1].capital)}
                    </p>
                  </TableCell>
                  <TableCell>
                    {money(row.rows[2].margin)}
                    <p className="text-xs text-muted-foreground">
                      Capital {money(row.rows[2].capital)}
                    </p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {actual && (
            <p className="text-sm">
              Em A: potencial de {n(actual.pastureHeadsPotentialA, 0)} cabeças
              médias no pasto; fluxo roteado usa{' '}
              {n(actual.pastureHeadsRoutedA, 0)}. Incluindo o estoque médio no
              cocho, o fluxo de bois (sem as vacas de oportunidade) soma{' '}
              {n(actual.meanUaAWithFeedlot, 0)} UA, ou{' '}
              {n(actual.wholeFarmUaPerHa, 2)} UA/ha total. Essa soma não é
              lotação de pastagem: o cocho consome dieta e milho comprado.
            </p>
          )}
          <details className="rounded-xl border p-4">
            <summary className="cursor-pointer font-semibold">
              E se redistribuir pasto e silagem sem ampliar a área?
            </summary>
            <div className="mt-4 space-y-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>UA desejada</TableHead>
                    <TableHead>Silagem na melhor proporção testada</TableHead>
                    <TableHead>Margem anual A</TableHead>
                    <TableHead>Capital exigido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stocking.map((row) => (
                    <TableRow key={row.desired}>
                      <TableCell>{n(row.desired)}</TableCell>
                      <TableCell>
                        {n(row.balancedShare)}%
                        <p className="text-xs text-muted-foreground">
                          {n(input.a.totalArea * (1 - row.balancedShare / 100))}{' '}
                          ha pasto +{' '}
                          {n((input.a.totalArea * row.balancedShare) / 100)} ha
                          silagem
                        </p>
                      </TableCell>
                      <TableCell>
                        {money(row.balanced.margin)}
                        <p className="text-xs text-muted-foreground">
                          {n(row.balanced.sold, 0)} vendidos/ano ·{' '}
                          {row.balanced.bottleneck}
                        </p>
                      </TableCell>
                      <TableCell>
                        {money(row.balanced.capital)}
                        <p className="text-xs text-muted-foreground">
                          {row.balanced.capital > input.budget
                            ? 'Fora do orçamento'
                            : 'Cabe no capital informado'}
                        </p>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="text-sm text-muted-foreground">
                Busca de 5% a 80% de silagem, de 1 em 1 ponto percentual, mais a
                divisão atual; cocho e CAPEX constantes. É sensibilidade de
                área, não projeto agronômico. Não vende sobra nem compra
                silo/terra automaticamente. Vacas seguem a hipótese atual{' '}
                {input.a.includeCows
                  ? 'ligada, sujeita à janela pós-silagem'
                  : 'desligada'}
                .
              </p>
            </div>
          </details>
          <p className="rounded-xl border bg-[#fff8e9] p-4 text-sm">
            Adicional de pasto informado:{' '}
            {money(input.a.pastureExtraCostHa ?? 0)}/ha de pasto/ano, antes do
            fator de custos. Zero significa não orçado, não intensificação
            gratuita. Aumento de UA não eleva adubação, energia e GMD
            automaticamente.{' '}
            {actual?.requiredProducedDmHa != null
              ? `Para a lotação desejada, a conta exige ${n(actual.requiredProducedDmHa)} t MS produzidas/ha/ano usando consumo e aproveitamento informados; ainda conferir cada mês.`
              : 'Informe consumo, aproveitamento e produção mensal de MS para verificar suporte.'}
          </p>
          <Button variant="outline" onClick={onValidate}>
            Validar pasto, água e caixa
          </Button>
          <p className="text-xs text-muted-foreground">
            Bases técnicas:{' '}
            <a
              className="underline"
              href="https://cloud.cnpgc.embrapa.br/sac/2012/09/14/qtos-animais-posso-colocar-em-1-hectare-de-pasto-para-animais-de-corte/"
              target="_blank"
              rel="noreferrer"
            >
              Embrapa · UA e lotação sazonal (2012)
            </a>
            ;{' '}
            <a
              className="underline"
              href="https://www.infoteca.cnptia.embrapa.br/infoteca/handle/doc/1174002"
              target="_blank"
              rel="noreferrer"
            >
              Embrapa · balanço hídrico (2025)
            </a>
            . Não são validação da fazenda.
          </p>
        </TabsContent>
      </Tabs>
    </section>
  );
}
