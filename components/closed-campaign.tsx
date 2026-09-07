import type { ReactNode } from 'react';
import type { ClosedCampaign } from '../lib/closed-campaign';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 });
const unitMoney = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 });
const cents = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const date = (value: string) => value.split('-').reverse().join('/');
const labels = { A: 'Recria + confinamento', B: 'Terminação no pivô', C: 'Recria e venda do magro' };

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return <div className="rounded-xl border border-current/10 p-3"><p className="text-xs opacity-75">{label}</p><p className="mt-1 break-words font-mono text-lg font-semibold tabular-nums">{children}</p></div>;
}

function CalculationMemory({ r }: { r: NonNullable<ClosedCampaign['result']> }) {
  const b = r.calculationBasis;
  const averageWeight = (b.entryWeight + b.pastureExitWeight) / 2;
  const simultaneous = r.pastureArea * b.stockingUa * 450 / averageWeight;
  return <div className="space-y-4 border-b pb-5 last:border-0">
    <h4 className="text-base font-semibold">{r.route} · {labels[r.route]}</h4>
    <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed">
      <li><strong>Área e lotação.</strong> {precise.format(r.pastureArea)} ha de pasto × {precise.format(b.stockingUa)} UA/ha × 450 kg/UA ÷ {precise.format(averageWeight)} kg médios = {precise.format(simultaneous)} cabeças simultâneas teóricas. Peso médio = ({precise.format(b.entryWeight)} + {precise.format(b.pastureExitWeight)}) ÷ 2. A silagem não entra nos hectares de pasto.</li>
      <li><strong>Duração.</strong> ({precise.format(b.pastureExitWeight)} − {precise.format(b.entryWeight)}) kg ÷ {precise.format(b.pastureGmd)} kg/d = {r.pastureDays} dias, arredondados para cima. {r.route === 'A' && <>Cocho: ({precise.format(b.saleWeight)} − {precise.format(b.pastureExitWeight)}) ÷ {precise.format(b.feedlotGmd ?? 0)} = {r.feedDays} dias. </>}Cada animal leva {r.animalDays} dias; a campanha de entradas diárias leva {r.elapsedDays} dias, incluindo implantação e eventual atraso alimentar.</li>
      <li><strong>Quantidade que realmente entra.</strong> Capacidade teórica × 365 ÷ dias no pasto; A também respeita o cocho. Teto antes dos picos e do estoque diário: {precise.format(b.physicalEntrantsBeforeDailyLimits)} animais. Fração aplicável: {precise.format(r.scale * 100)}%. Compras = {precise.format(r.bought)}. A escala não é aumentada para atingir uma meta de margem.</li>
      <li><strong>Sobrevivência.</strong> {precise.format(r.bought)} × {precise.format(b.pastureSurvival * 100)}%{r.route === 'A' ? ` × ${precise.format((b.feedlotSurvival ?? 1) * 100)}%` : ''} = {precise.format(r.sold)} vendidos. O animal perdido continua tendo os custos das fases em que entrou.</li>
      <li><strong>Receita.</strong> {r.route === 'C'
        ? <>{precise.format(b.saleWeight)} kg vivos × {unitMoney.format(b.salePriceUnit)}/kg líquido = {cents.format(r.salePriceHead)}/cab.</>
        : <>{precise.format(b.saleWeight)} kg vivos × {precise.format(b.carcassYield ?? 0)}% de rendimento ÷ 15 kg/@ × {unitMoney.format(b.salePriceUnit)}/@ × (1 − {precise.format(b.saleDeductionsPercent)}%) = {cents.format(r.salePriceHead)}/cab líquido.</>}
        {' '}× {precise.format(r.sold)} vendidos = {cents.format(r.revenue)}. Arroba de carcaça de 15 kg não é 30 kg vivos fixos; o rendimento é uma premissa.</li>
      {r.route === 'A' && <li><strong>Dieta sem dupla contagem.</strong> {precise.format(r.feedEntered)} entradas no cocho × {r.feedDays} dias × {precise.format(b.dietDmDay)} kg MS/dia. Dieta total: {unitMoney.format(b.dietPriceDm)}/kg MS. Retira-se {precise.format(b.forageShare)}% × {unitMoney.format(b.silageUnitCost)}/kg MS de silagem antes do fator de custos, pois a silagem é paga pelo orçamento dos cortes/estoque, abaixo.</li>}
    </ol>
    <p className="text-sm">Cada custo abaixo é <strong>quantidade × custo unitário</strong>. Fator de custos atual: {precise.format(b.factor)}%; não se aplica novamente aos valores unitários desta tabela.</p>
    <div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-sm"><caption className="sr-only">Memória de custo da rota {r.route}</caption>
      <thead><tr className="border-b text-left"><th className="p-2">Componente e origem</th><th className="p-2 text-right">Quantidade</th><th className="p-2">Unidade</th><th className="p-2 text-right">Custo unitário</th><th className="p-2 text-right">Total</th></tr></thead>
      <tbody>{r.costLines.filter(line => line.quantity > 0).map(line => <tr className="border-b align-top" key={line.label}>
        <th scope="row" className="max-w-sm p-2 text-left font-normal"><strong>{line.label}</strong><p className="mt-1 text-xs text-muted-foreground">{line.source}</p></th>
        <td className="p-2 text-right font-mono">{precise.format(line.quantity)}</td><td className="p-2">{line.unit}</td>
        <td className="whitespace-nowrap p-2 text-right font-mono">{unitMoney.format(line.unitPrice)}</td><td className="whitespace-nowrap p-2 text-right font-mono">{cents.format(line.total)}</td>
      </tr>)}</tbody><tfoot><tr><th className="p-2 text-left" colSpan={4}>Custo operacional total</th><td className="p-2 text-right font-mono font-semibold">{cents.format(r.operatingCost)}</td></tr></tfoot>
    </table></div>
    <p className="text-sm"><strong>Fechamento:</strong> {cents.format(r.revenue)} − {cents.format(r.operatingCost)} = {cents.format(r.margin)} de margem da campanha. ÷ {precise.format(r.totalArea)} ha totais = {cents.format(r.marginHa)}/ha no período. × 365 ÷ {r.elapsedDays} dias = {cents.format(r.annualEquivalentHa)}/ha no equivalente anual. Cálculo interno sem os arredondamentos da tela.</p>
  </div>;
}

export function ClosedCampaignPanel({ campaigns, budget, cowsActive, onExcludeCows, report = false }: {
  campaigns: ClosedCampaign[]; budget: number; cowsActive: boolean; onExcludeCows?: () => void; report?: boolean;
}) {
  const a = campaigns.find(c => c.route === 'A')?.result;
  return <section aria-label="Fechamento completo da campanha" className="min-w-0 overflow-hidden rounded-2xl border bg-card">
    <header className="space-y-2 border-b p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#527458]">Do bezerro comprado à última venda · sem vacas</p>
      <h2 className="font-heading text-2xl font-semibold">Quanto sobra ao terminar todos os bois?</h2>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">O simulador compra lotes diários equivalentes durante 365 dias, para de comprar e acompanha a recria e a terminação até o fim. Não corta a venda nem o custeio em 31 de dezembro ou no dia 365. Uma campanha reúne vários lotes; não é um único lote entrando todo junto.</p>
      {cowsActive && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Este fechamento já exclui vacas. Seu cenário salvo ainda inclui vacas nos estudos anuais.
        {onExcludeCows && <button type="button" className="ml-2 min-h-11 font-semibold underline" onClick={onExcludeCows}>Excluir vacas de todo o cenário</button>}</div>}
    </header>
    {a && <div className="space-y-4 bg-[#113724] p-5 text-white sm:p-6">
      <div><h3 className="text-xl font-semibold">A · Recria + confinamento até o peso final</h3>
        <p className="mt-1 text-sm text-white/80">Cada animal: {number.format(a.pastureDays)} dias de recria + {number.format(a.feedDays)} dias de cocho = {number.format(a.animalDays)} dias. Última venda: {date(a.finalSaleDate)}.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Margem operacional da campanha">{money.format(a.margin)}</Stat>
        <Stat label={`Margem / ha TOTAL em ${number.format(a.elapsedDays)} dias`}>{money.format(a.marginHa)}</Stat>
        <Stat label="Equivalente anual / ha total">{money.format(a.annualEquivalentHa)}</Stat>
        <Stat label="Capital estimado, incluindo reserva">{money.format(a.requiredCapital)}</Stat>
      </div>
      <p className="text-sm text-white/80">{number.format(a.sold)} bois vendidos ao final · {number.format(a.firstYearSales)} vendidos nos primeiros 365 dias. A margem não é lucro líquido: CAPEX, financiamento, tributos sobre o resultado e remuneração do capital não estão descontados dela.</p>
      <p className="text-sm text-white/80">Após {money.format(a.capex)} de implantação/CAPEX, o saldo nominal acumulado é {money.format(a.netCashAfterCapex)}. A reserva de {money.format(a.reserveCash)} não é despesa.</p>
      <p className="text-sm text-white/80">Preços e custos unitários permanecem constantes durante toda a campanha. Um período maior não significa preço futuro conhecido nem corrige automaticamente inflação ou juros.</p>
      {a.requiredCapital > budget && <p className="rounded-lg bg-white/10 p-3 text-sm">Faltam {money.format(a.requiredCapital - budget)} para essa escala, considerando o capital informado de {money.format(budget)}. A projeção continua visível; reduza a escala ou confira o estudo «Mesmo capital».</p>}
      {a.bought <= 0 && <p className="rounded-lg bg-white/10 p-3 text-sm">Nenhum animal pode ser alojado com estas capacidades. Confira área de pasto, alimento disponível e vagas; os custos de manter a estrutura permanecem na conta.</p>}
    </div>}
    <div className="space-y-4 p-5 sm:p-6">
      <h3 className="font-semibold">Mesmas premissas, encerramentos diferentes</h3>
      <p className="text-sm text-muted-foreground">Não há vencedor pela soma de períodos diferentes. O equivalente anual divide a margem pelos dias decorridos e multiplica por 365; não presume reinvestimento nem operação estabilizada. Lavouras permanecem no comparativo anual separado.</p>
      <div className="grid gap-3 lg:grid-cols-3">{campaigns.map(item => <article key={item.route} className="min-w-0 rounded-xl border p-4">
        <h4 className="font-semibold">{item.route} · {labels[item.route]}</h4>
        {item.error || !item.result ? <output className="mt-3 block text-sm text-amber-900">{item.error}</output> : <>
          <p className="mt-2 text-sm text-muted-foreground">{number.format(item.result.elapsedDays)} dias até encerrar · {date(item.result.finalSaleDate)}</p>
          <dl className="mt-3 space-y-2 text-sm">
            {[['Receita líquida de venda', money.format(item.result.revenue)], ['Custo operacional', money.format(item.result.operatingCost)],
              ['Margem da campanha', money.format(item.result.margin)], ['Margem / ha total da campanha', money.format(item.result.marginHa)],
              ['Equivalente anual / ha', money.format(item.result.annualEquivalentHa)]].map(([label, value]) => <div className="flex flex-wrap justify-between gap-x-2" key={label}><dt>{label}</dt><dd className="font-mono font-semibold tabular-nums">{value}</dd></div>)}
          </dl>
        </>}
      </article>)}</div>
      <details open={report || undefined} className="rounded-xl border p-4">
        <summary className="cursor-pointer font-semibold">Memória de cálculo · premissa → fórmula → resultado</summary>
        <div className="mt-4 space-y-5">
          <p className="rounded-lg bg-[#fff8e9] p-3 text-sm">Conferência técnica: alguns custos ainda são referências agregadas da apresentação, não custos locais auditados do Grupo Mizote. A origem está descrita por linha. Preços e parâmetros editados são hipóteses do cenário até confirmação documental. Abra os custos detalhados para validar a composição da dieta e das lavouras.</p>
          {campaigns.map(c => c.result ? <CalculationMemory key={c.route} r={c.result} /> : null)}
        </div>
      </details>
      <details open={report || undefined} className="rounded-xl border p-4">
        <summary className="cursor-pointer font-semibold">Conferir datas, animais, alimento e caixa</summary>
        <div className="mt-4 space-y-5 text-sm">
          {campaigns.filter(c => c.result).map(({ route, result: r }) => r && <div key={route} className="space-y-2 border-b pb-4 last:border-0">
            <h4 className="font-semibold">{route} · {labels[route]}</h4>
            <p>Compras: {date(r.firstPurchaseDate)} a {date(r.lastPurchaseDate)}. Vendas: {date(r.firstSaleDate)} a {date(r.finalSaleDate)}.</p>
            <p>{number.format(r.bought)} comprados = {number.format(r.sold)} vendidos + {number.format(r.deadPasture + r.deadFeed)} perdas esperadas. Estoque animal final: {number.format(Math.max(0, r.closingHeads))}. Cabeças fracionadas representam coortes equivalentes, não lotes comerciais já definidos.</p>
            <p>Pico diário: {number.format(r.peakUa)} / {number.format(r.uaLimit)} UA no pasto ({number.format(r.pastureArea)} ha). {route === 'A' && <>Cocho: {number.format(r.peakFeedHeads)} cabeças / {r.feedLimit === null ? 'capacidade não informada' : `${number.format(r.feedLimit)} vagas úteis`}.</>}</p>
            {r.scale < 0.9999 && <p className="text-amber-900">Entradas reduzidas em {number.format((1 - r.scale) * 100)}% para respeitar os picos diários de UA, vagas e disponibilidade de silagem. Isso não comprova a oferta agronômica do pasto.</p>}
            {r.foodDelay > 0 && <p className="text-amber-900">Compra adiada em {r.foodDelay} dias para o primeiro cocho não anteceder a silagem disponível.</p>}
            {route === 'A' && <><p>Silagem: {number.format(r.silageOpeningKg / 1000)} t MS iniciais + {number.format(r.silageProducedKg / 1000)} produzidas − {number.format(r.silageConsumedKg / 1000)} consumidas = {number.format(r.silageEndingKg / 1000)} t MS finais. Sobra não vira receita.</p>
              <p>{r.cuts.length} cortes programados até o encerramento: {r.cuts.map(c => date(c.date)).join(' · ') || 'nenhum'}. Orçamento {money.format(r.silageBudget)} reservado no início. Estoque inicial valorado em {money.format(r.openingBudget)} pelo custo local disponível; confirme seu custo de reposição.</p>
              {r.cutsBeyondCampaign > 0 && <p className="text-amber-900">{r.cutsBeyondCampaign} corte(s) ficariam após o encerramento: não executados nem custeados nesta campanha. Confira o intervalo entre cortes.</p>}</>}
            {route === 'A' && r.animalDays > 365 && <p className="text-amber-900">Ciclo individual acima de um ano: validar idade, acabamento e conservação do estoque. A recuperação da silagem é a taxa informada, sem perdas adicionais calculadas pelo tempo de armazenamento.</p>}
            <p>Custeio de toda a área até o encerramento: {money.format(r.areaCost)}. Capital necessário: {money.format(r.requiredCapital)}; pico de déficit em {r.cash.peakFundingDate ? date(r.cash.peakFundingDate) : 'nenhum dia'}.</p>
          </div>)}
          <p>Hipóteses: GMD e preços constantes; suplemento diário de referência escalado pela duração; mortalidade no fim de cada fase; operação escalonada; manutenção da área e arrendamento apropriados por dia, inclusive durante implantação e encerramento. Silagem segue um único programa de cortes inteiros, não se multiplica pelo número de anos. Milho e demais ingredientes da dieta são custeados por reposição, sem atribuir hectares adicionais ou receita à sua venda. Sem vacas, crédito de efluente ou prêmio de exportação. Não certifica acabamento, idade, sanidade, irrigação ou viabilidade de investimento.</p>
        </div>
      </details>
      <details className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Por que este número não deve ser forçado a R$ 32 mil/ha?</summary>
        <p className="mt-3 text-sm leading-relaxed">Na referência de 400 ha, R$ 32.261 eram margem de caixa anual por hectare de pasto: 300 ha de pasto + 100 ha de silagem. No mesmo denominador deste painel, isso corresponde a R$ 24.196 por hectare total/ano. A margem de R$ 16.873 do ciclo a pasto já descontava depreciação; a margem de caixa era R$ 18.292. Misturar hectare de pasto com hectare total, caixa com resultado após depreciação ou campanha com ano distorce a comparação. Mais tempo também gera custos; não garante alcançar a referência.</p>
      </details>
    </div>
  </section>;
}
