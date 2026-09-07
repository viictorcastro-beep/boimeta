import { photoParameterNotes, photoReferenceLimit } from '../lib/photo-reference';

export function PhotoReferenceNotes({ report = false }: { report?: boolean }) {
  return <details open={report || undefined} className="rounded-xl border p-4 text-sm">
    <summary className="cursor-pointer font-semibold">Origem da base de 400 ha · fotos e hipóteses</summary>
    <div className="mt-3 space-y-3">
      <p>A base inicial usa os parâmetros dos bois legíveis nas fotos e complementos identificados abaixo, sem o lote de vacas. A retirada desse lote reduz o capital necessário, mas também retira sua receita e sua margem; não gera crédito adicional. Os controles mostram os valores atuais, que podem ter sido alterados. A recria com venda do magro e as culturas agrícolas usam bases separadas; não são cenários comprovados por estas fotos.</p>
      <dl className="space-y-3">{photoParameterNotes.map(([label, value, source, note]) => <div key={label} className="border-b pb-3 last:border-0"><dt className="font-semibold">{label}</dt><dd>{value}<span className="ml-2 text-xs text-muted-foreground">{source}</span><p className="mt-1 text-xs text-muted-foreground">{note}</p></dd></div>)}</dl>
      <p className="rounded-lg bg-amber-50 p-3 text-amber-950">{photoReferenceLimit}</p>
      <p>Carregar a referência desliga a dieta vinculada ao milho local e o crédito de efluente. Depois, cada premissa pode ser alterada. O orçamento disponível não é ampliado para fazer A caber; confira Capital e Validações.</p>
    </div>
  </details>;
}
