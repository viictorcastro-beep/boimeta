import type { ReactNode } from 'react';
import type { calculateCore, Assumptions } from '@/lib/livestock-model';
import type { rearingOnly, rearingStartupCash } from '@/lib/rearing-model';
import type { areaResponse } from '@/lib/investment-screen';
import { MarketNewsPanel } from '@/components/market-news';

const money = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });
const n = (value: number) =>
  value.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
type Props = {
  a: Assumptions;
  core: ReturnType<typeof calculateCore>;
  rearing: ReturnType<typeof rearingOnly>;
  cash: ReturnType<typeof rearingStartupCash>;
  rearingCapital: number;
  budget: number;
  gateSourceDate: string;
  rows: ReturnType<typeof areaResponse>;
  controls: ReactNode;
};

export function BusinessReview(p: Props) {
  const { rearing: c, cash, core: r } = p;
  const investmentValid = r.routeAInputValid && r.routeBInputValid;
  return (
    <section
      className="rounded-2xl border bg-card p-5 sm:p-6"
      aria-labelledby="business-review-title"
    >
      <p className="text-sm text-muted-foreground">
        Da produção ao investimento
      </p>
      <h2
        id="business-review-title"
        className="mt-1 font-heading text-2xl font-semibold"
      >
        Recriar, terminar ou investir no cocho?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        As três rotas pecuárias e as culturas entram no ranking rápido. Maior
        margem operacional não é, sozinha, aprovação do investimento. A recria C
        usa todo o pivô, sem silagem e sem confinamento.
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">{p.controls}</div>
      <p className="mt-3 text-sm text-muted-foreground">
        Capital C é o maior entre o pico de caixa e a reserva conservadora para
        completar uma ocupação inteira do pasto, mais a reserva livre. Adiar a
        entrada não elimina o custeio que vence depois do primeiro ano.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm">Recria C · margem anual</p>
          <strong className="mt-2 block font-mono text-xl">
            {money(c.margin)}
          </strong>
          <p className="mt-2 text-sm">
            {n(c.sold)} magros/ano · {n(c.cycles)} giros equivalentes de{' '}
            {c.days} dias. Não são lotes completos garantidos no primeiro ano.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm">Recria C · capital necessário</p>
          <strong className="mt-2 block font-mono text-xl">
            {money(p.rearingCapital)}
          </strong>
          <p className="mt-2 text-sm">
            {p.rearingCapital <= p.budget
              ? 'Dentro do orçamento estimado.'
              : 'Fora do orçamento: ' +
                money(p.rearingCapital - p.budget) +
                ' adicionais.'}{' '}
            Inclui preparação, pivô novo informado e reserva; não compra da
            terra.
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm">Magro · preço líquido de equilíbrio</p>
          <strong className="mt-2 block font-mono text-xl">
            {c.breakEvenPriceKg === null
              ? 'n/d'
              : 'R$ ' +
                c.breakEvenPriceKg.toLocaleString('pt-BR', {
                  maximumFractionDigits: 2,
                }) +
                '/kg vivo'}
          </strong>
          <p className="mt-2 text-sm">
            Após despesas de venda. Compra, frete de entrada, suplemento,
            sanidade, pasto e arrendamento incluídos uma única vez.
          </p>
        </div>
        <div className="rounded-xl border bg-[#fff8e9] p-4">
          <p className="text-sm">Recria C · saldo de caixa no ano 1</p>
          <strong className="mt-2 block font-mono text-xl">
            {cash ? money(cash.netCash) : 'data inválida'}
          </strong>
          <p className="mt-2 text-sm">
            {cash
              ? n(cash.closingHeads) +
                ' animais em estoque ao fechar o ano, não reconhecidos como venda.'
              : 'Informe o marco de entrada.'}{' '}
            Saldo de caixa não é lucro.
          </p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Preço do magro: hipótese constante{' '}
        {p.gateSourceDate
          ? 'com data-base informada ' + p.gateSourceDate
          : 'sem cotação local datada'}
        . A cotação do boi gordo não atualiza o magro. Reposição C integralmente
        comprada; mortalidade aplicada de {n(p.a.pastureMortalityPercent ?? 0.2)}%, custeada até o fim da fase.
      </p>
      {!investmentValid ? (
        <p className="mt-5 rounded-xl border bg-[#fff8e9] p-4 text-sm">
          Corrija os pesos e os ganhos antes de comparar o investimento A − B:
          entrada menor que decisão, decisão menor que saída e GMD positivo em
          ambas as rotas. Nenhum parecer de investimento é emitido para rotas
          inválidas.
        </p>
      ) : (
        <div className="mt-5 rounded-xl border bg-[#eef5ef] p-5">
          <h3 className="font-semibold">
            O investimento adicional em A paga a diferença para B?
          </h3>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4">
            <div>
              <p className="text-sm">Margem anual A − B</p>
              <strong className="font-mono text-xl">
                {money(r.incrementalEbitda)}
              </strong>
            </div>
            <div>
              <p className="text-sm">VPL incremental de triagem</p>
              <strong className="font-mono text-xl">
                {money(r.operationalNpv)}
              </strong>
            </div>
            <div>
              <p className="text-sm">Teto indicativo de novo CAPEX</p>
              <strong className="font-mono text-xl">
                {money(r.maxInvestment)}
              </strong>
            </div>
          </div>
          <p className="mt-3 text-sm">
            {r.operationalNpv < 0
              ? 'Nestas premissas, A não remunera o investimento incremental à taxa exigida em relação a B, mesmo que tenha maior margem operacional.'
              : 'A supera B nesta triagem descontada. Ainda é necessário conferir implantação, lotes, crédito e custos não modelados.'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Novo CAPEX: {money(p.a.investment)} · TMA {n(p.a.discountRate)}% ·{' '}
            {p.a.horizon} anos. Inclui diferença de capital de giro e
            recuperação terminal informada. Fluxos anuais estabilizados e preços
            constantes: não é VPL da fazenda inteira, não inclui
            dívidas/impostos nem substitui o caixa de implantação. Patrimônio
            existente não deve ser lançado novamente como compra nova. Teto
            negativo significa que nem CAPEX zero compensa nessa comparação.
          </p>
        </div>
      )}
      <div className="mt-4">
        <MarketNewsPanel />
      </div>
      <details className="mt-4 rounded-xl border p-4">
        <summary className="cursor-pointer font-semibold">
          Estressar área sem ignorar a capacidade instalada
        </summary>
        <p className="mt-3 text-sm text-muted-foreground">
          O motor recalcula cada área, mantendo vagas de cocho, demais
          parâmetros e CAPEX fixos. A pode ganhar em uma faixa e perder em
          outra. A tabela é uma amostragem, não uma área mínima universal; o
          caixa precisa ser reavaliado para cada escala.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-3 text-left">Área</th>
                <th className="p-3 text-right">Margem A/ano</th>
                <th className="p-3 text-right">Margem B/ano</th>
                <th className="p-3 text-right">A − B/ano</th>
                <th className="p-3 text-right">VPL A − B</th>
                <th className="p-3 text-left">Gargalo de A</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.map((row) => (
                <tr
                  key={row.area}
                  className={
                    Math.abs(row.area - p.a.totalArea) < 0.01
                      ? 'border-b bg-[#eef5ef]'
                      : 'border-b'
                  }
                >
                  <td className="whitespace-nowrap p-3">{n(row.area)} ha</td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {money(row.marginA)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {money(row.marginB)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {money(row.delta)}
                  </td>
                  <td className="whitespace-nowrap p-3 text-right">
                    {money(row.npv)}
                  </td>
                  <td className="p-3">{row.bottleneck}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <details className="mt-4 rounded-xl border p-4">
        <summary className="cursor-pointer font-semibold">
          Foco exportação · sem prêmio embutido nos preços
        </summary>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>
            O destino de exportação não acrescenta receita neste modelo.
            Acabamento, peso e GMD não comprovam enquadramento: validar
            idade/documentação, condição sanitária e especificação do comprador
            e do estabelecimento habilitado. Não atribuímos selo “boi-China” por
            peso ou por estar no confinamento.
          </p>
          <p>
            Contexto documental datado, não atualização em tempo real: o MAPA
            informou cota brasileira de 1,106 milhão de toneladas em 2026. O
            aviso chinês de 11/08/2026 registrava 90% utilizados em 10/08 e
            adicional tarifário após o esgotamento. Isso não informa o saldo
            disponível hoje e não autoriza descontar tarifa diretamente da
            arroba. Concentração em um destino é risco a testar, não prêmio
            garantido.
          </p>
          <p>
            Fontes:{' '}
            <a
              className="underline"
              href="https://www.gov.br/agricultura/pt-br/assuntos/noticias/cota-carne-china"
              target="_blank"
              rel="noreferrer"
            >
              MAPA — cota 2026
            </a>
            ,{' '}
            <a
              className="underline"
              href="https://cacs.mofcom.gov.cn/cacscms/article/jkdc?articleId=188893&amp;type=11"
              target="_blank"
              rel="noreferrer"
            >
              MOFCOM — aviso datado
            </a>{' '}
            e{' '}
            <a
              className="underline"
              href="https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/exportacao"
              target="_blank"
              rel="noreferrer"
            >
              MAPA — requisitos/habilitação
            </a>
            .
          </p>
          <p>
            Idade de entrada/nascimento e aceite documental do comprador não
            estão informados: elegibilidade não verificada. O protocolo vigente
            deve ser confirmado na operação, inclusive qualquer limite etário; a
            ferramenta não substitui essa verificação.
          </p>
        </div>
      </details>
    </section>
  );
}
