import type { EqualCostStudy } from '../lib/equal-cattle-cost';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';

const money = (v: number | null) => v !== null && Number.isFinite(v) ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'n/d';
const n = (v: number, digits = 1) => Number.isFinite(v) ? v.toLocaleString('pt-BR', { maximumFractionDigits: digits }) : 'n/d';
const labels = { A: 'Recria + confinamento', B: 'Terminação no pivô' };

export function EqualCattleCostPanel({ study, report = false }: { study: EqualCostStudy; report?: boolean }) {
  const b = study.rows.find(r => r.route === 'B'), a = study.rows.find(r => r.route === 'A');
  const delta = a && b ? a.margin - b.margin : null;
  // Faixa de leitura explícita, não intervalo estatístico nem precisão de previsão.
  const indifferent = delta !== null && Math.abs(delta) <= study.target * 0.005;
  const leader = a && b ? a.margin > b.margin ? a : b : null;
  return <section aria-label="Mesmo custeio anual, áreas diferentes" className="rounded-2xl border bg-card p-5 sm:p-6">
    <h2 className="font-heading text-xl font-semibold">Com o mesmo gasto, qual deixa mais margem?</h2>
    <p className="mt-2 leading-relaxed">Usamos os <strong>{money(study.target)}/ano</strong> de custo de B em {n(study.referenceArea)} ha e calculamos quantos hectares A precisa para gastar o mesmo. A área pode ser diferente da sua fazenda.</p>
    <p className="mt-2 text-sm text-muted-foreground">Somente operação dos bois, sem vacas ou crédito de efluente. A conta não altera o cenário atual.</p>
    {study.error ? <output className="mt-4 block rounded-xl bg-amber-50 p-4 text-sm text-amber-950">{study.error}</output> : <div className="mt-4 rounded-xl bg-secondary p-4">
      <p className="font-semibold">{indifferent ? 'As margens estão próximas: não há vantagem clara nesta faixa.' : leader && delta !== null ? `${leader.route} · ${labels[leader.route]} deixa ${money(Math.abs(delta))} a mais por ano, com o mesmo custeio.` : ''}</p>
      <p className="mt-2 text-sm">{leader && leader.margin <= 0 ? 'As duas alternativas apresentam margem não positiva. Menor perda não significa que vale a pena investir.' : 'É a maior margem modelada neste critério, não aprovação de investimento. Caixa inicial, infraestrutura e risco podem mudar a escolha.'}{indifferent ? ' Diferença até 0,5% do custeio é tratada como faixa de indiferença; não é um intervalo estatístico.' : ''}</p>
    </div>}
    <div className="mt-4 overflow-x-auto"><Table>
      <TableHeader><TableRow><TableHead>Alternativa</TableHead><TableHead>Área irrigada necessária</TableHead><TableHead>Custeio anual utilizado</TableHead><TableHead>Receita anual</TableHead><TableHead>Margem anual</TableHead></TableRow></TableHeader>
      <TableBody>{study.rows.map(r => <TableRow key={r.route}>
        <TableCell className="whitespace-normal"><strong>{r.route} · {labels[r.route]}</strong><p className="mt-1 text-sm">{n(r.sold, 0)} bois/ano</p></TableCell>
        <TableCell><strong>{n(r.area, 2)} ha</strong><p className="mt-1 text-sm">{n(r.pasture, 2)} pasto + {n(r.silage, 2)} silagem</p>{r.extraArea > 0 && <p className="mt-1 text-sm text-amber-900">Exige {n(r.extraArea, 2)} ha além da área informada</p>}</TableCell>
        <TableCell className="font-mono">{money(r.cost)}{r.costGap < -0.01 && <p className="mt-1 text-sm text-amber-900">{money(-r.costGap)} do limite não utilizado</p>}</TableCell>
        <TableCell className="font-mono">{money(r.revenue)}</TableCell>
        <TableCell className="font-mono"><strong className={r.margin < 0 ? 'text-destructive' : ''}>{money(r.margin)}</strong><p className="mt-1 text-sm">{n(r.margin / r.cost * 100)}% do custo</p></TableCell>
      </TableRow>)}</TableBody>
    </Table></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">{study.rows.map(r => <p key={r.route} className="rounded-xl border p-3 text-sm"><strong>{r.route}: {n(r.days, 0)} dias por animal.</strong> Reserva operacional estimada: <strong>{money(r.operatingReserve)}</strong>. Maior entre pico do primeiro ano e custeio até sustentar as primeiras vendas. Não inclui CAPEX, implantação, juros ou reserva extra.</p>)}</div>
    <details open={report || undefined} className="mt-4 rounded-xl border p-4 text-sm"><summary className="cursor-pointer font-semibold">Como a equivalência é calculada e seus limites</summary><div className="mt-3 space-y-3">
      <p>{study.method}</p>
      <p>A busca recalcula animais, dieta e custos a cada área; não multiplica a margem por hectare. Cocho de A mantido em {study.feedlotCapacity === undefined ? 'capacidade não informada' : `${n(study.feedlotCapacity, 0)} vagas nominais`} × {n(study.feedlotUtilization)}% de uso. Ocupação média resultante: {a ? n(a.feedlotOccupancy, 0) : 'n/d'} animais. Gargalo de A: {a?.bottleneck ?? 'não validado'}.</p>
      <p>Todos os hectares de silagem de A são custeados, inclusive eventual sobra; B utiliza sua área só como pasto. Milho e outros ingredientes seguem o preço da dieta informado: a área não inclui lavouras externas que forneçam a ração. Mesma lotação por hectare pressupõe água e forragem equivalentes, ainda sujeitas à validação local.</p>
      <p>Reserva operacional é estimativa de custeio até as primeiras vendas da esteira e de uma ocupação completa; não é despesa adicional. Para concluir se vale a pena investir, dimensione terra, pivôs e cocho para cada área, acrescente CAPEX e confronte com seu caixa e calendário. Nenhuma área ou orçamento da tela é alterado por esta conta.</p>
    </div></details>
  </section>;
}
