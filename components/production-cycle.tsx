import type { ProductionCycle } from '../lib/production-cycle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const n = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const labels = { A: 'Recria + confinamento', B: 'Terminação no pivô', C: 'Recria e venda do magro' };
const value = (x: number | null) => x === null || !Number.isFinite(x) ? 'sem animais vendidos' : money.format(x);

export function ProductionCyclePanel({ rows, report = false }: { rows: ProductionCycle[]; report?: boolean }) {
  return <section aria-label="Ciclo do animal e operação anual" className="rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="font-heading text-xl font-semibold">Ciclo do animal e resultado da operação</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Um animal percorre recria e terminação uma vez. A fazenda pode manter lotes em fases diferentes: a produção anual depende do giro, do pasto, do alimento e do cocho. Não estamos impondo compras diárias nem uma data para encerrar a operação.</p>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">{rows.map(r => <article key={r.route} className="min-w-0 rounded-xl border p-4">
      <h3 className="font-semibold">{r.route} · {labels[r.route]}</h3>
      {!r.valid ? <output className="mt-2 block text-sm text-amber-900">Confira área, pesos e ganhos positivos.</output> : <>
        <p className="mt-3 text-2xl font-semibold">{n.format(r.cycleDays)} dias por animal</p>
        <p className="mt-1 text-sm text-muted-foreground">{r.route === 'A' ? `${r.pastureDays} no pasto + ${r.feedDays} no cocho` : `${n.format(r.entryWeight)} → ${n.format(r.exitWeight)} kg no pasto`}</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt>Margem por boi vendido · rateio anual</dt><dd className="font-mono font-semibold">{value(r.marginPerSold)}</dd></div>
          <div><dt>Produção anual de regime pleno</dt><dd>{n.format(r.sold)} bois vendidos/ano</dd></div>
          <div><dt>Margem operacional anual{r.cows > 0 ? ' com extras' : ''}</dt><dd className="font-mono font-semibold">{value(r.annualMargin)}</dd></div>
        </dl>
        {r.cycleDays > 365 && <p className="mt-3 text-sm text-amber-900">O ciclo ultrapassa um ano. A venda só ocorre ao final; produção de regime pleno não é caixa do primeiro ano.</p>}
        {r.cows > 0 && <p className="mt-3 text-sm text-amber-900">Vacas ainda ativadas neste cenário: extra anual de {value(r.extraCowMargin)}, separado da margem por boi.</p>}
      </>}
    </article>)}</div>
    <p className="mt-4 text-sm text-muted-foreground">A margem por boi inclui rateio dos custos anuais de toda a área e das perdas. Não é orçamento de um lote isolado. Não multiplique essa margem por 365/dias: o resultado anual é margem por vendido × animais vendidos no ano, mais eventuais extras identificados. CAPEX, juros e tributos sobre o resultado continuam fora da margem operacional.</p>
    <details open={report || undefined} className="mt-4 rounded-xl border p-4">
      <summary className="cursor-pointer font-semibold">Memória de cálculo · do animal ao ano da fazenda</summary>
      <div className="mt-4 space-y-6">
        <p className="rounded-lg bg-amber-50 p-3 text-sm">Origem dos custos: referências agregadas ainda não são custos locais auditados. Preços e alterações são premissas editáveis; conferir a documentação com o responsável técnico. Os rateios abaixo usam 12 meses de operação contínua, sem despesas de encerramento artificial.</p>
        {rows.filter(r => r.valid).map(r => <div className="space-y-3 border-b pb-5 last:border-0" key={r.route}>
          <h3 className="font-semibold">{r.route} · {labels[r.route]}</h3>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
            <li><strong>Duração:</strong> ({n.format(r.pastureExit)} − {n.format(r.entryWeight)}) ÷ {n.format(r.pastureGmd)} = {r.pastureDays} dias, arredondados para cima.{r.route === 'A' && <> Cocho: ({n.format(r.exitWeight)} − {n.format(r.pastureExit)}) ÷ {n.format(r.feedlotGmd)} = {r.feedDays} dias. Total: {r.cycleDays}.</>}</li>
            <li><strong>Capacidade:</strong> {n.format(r.pastureArea)} ha de pasto × {n.format(r.stockingUa)} UA/ha × 450 kg/UA ÷ peso médio × 365/dias no pasto = {n.format(r.theoreticalPastureEntries)} entradas anuais teóricas. Após os limites do alimento e cocho: {n.format(r.entrants)} comprados/ano. Restrição calculada: {r.bottleneck}. Não são animais alojados simultaneamente.</li>
            <li><strong>Perdas:</strong> {n.format(r.entrants)} compras × {n.format(r.pastureSurvival * 100)}% de sobrevivência no pasto{r.route === 'A' ? ` × ${n.format(r.feedlotSurvival * 100)}% no cocho` : ''} = {n.format(r.sold)} vendidos/ano.</li>
            <li><strong>Receita por boi:</strong> {r.route === 'C' ? `${n.format(r.exitWeight)} kg vivos × ${money.format(r.price)}/kg líquido` : `${n.format(r.exitWeight)} kg vivos × ${n.format(r.carcassYield ?? 0)}% ÷ 15 kg/@ × ${money.format(r.price)}/@ × (1 − ${n.format(r.saleDeductions)}%)`} = {value(r.saleHead)}. Arrobas de carcaça usam rendimento; não são conversão fixa de 30 kg vivos.</li>
          </ol>
          <div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Componente e origem</TableHead><TableHead className="text-right">Quantidade anual</TableHead><TableHead>Unidade</TableHead><TableHead className="text-right">Custo unitário</TableHead><TableHead className="text-right">Custo anual</TableHead></TableRow></TableHeader><TableBody>{r.costLines.filter(l => l.quantity > 0).map(l => <TableRow key={l.label}><TableCell className="max-w-sm whitespace-normal"><strong>{l.label}</strong><p className="mt-1 text-xs text-muted-foreground">{l.source}</p></TableCell><TableCell className="text-right font-mono">{n.format(l.quantity)}</TableCell><TableCell>{l.unit}</TableCell><TableCell className="text-right font-mono">{value(l.unitCost)}</TableCell><TableCell className="text-right font-mono">{value(l.total)}</TableCell></TableRow>)}</TableBody></Table></div>
          <p className="text-sm"><strong>Ano da fazenda:</strong> {value(r.annualRevenue)} de receita − {value(r.annualCost)} de custo = {value(r.annualMargin)} de margem operacional. ÷ {n.format(r.totalArea)} ha totais = {value(r.marginHa)}/ha/ano. Toda a área de silagem entra no denominador de A.</p>
          <p className="text-sm"><strong>Por boi vendido:</strong> {value(r.saleHead)} de receita − {value(r.costPerSold)} de custo rateado = {value(r.marginPerSold)}. Custo rateado = {value(r.bullCost)} de custos anuais dos bois ÷ {n.format(r.sold)} vendidos/ano. Perdas e ociosidade não desaparecem; sem vendidos não há divisão por cabeça. Cálculo interno sem arredondamento da tela.</p>
        </div>)}
      </div>
    </details>
  </section>;
}
