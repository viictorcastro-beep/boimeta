'use client';

import type { ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export type EditorGroup = {
  id: string;
  title: string;
  summary: string;
  children: ReactNode;
};

export function ScenarioEditor({ groups, openGroup, onGroup, onCompare, margin, footer }: {
  groups: EditorGroup[];
  openGroup: string | null;
  onGroup: (id: string | null) => void;
  onCompare: () => void;
  margin: string;
  footer: ReactNode;
}) {
  return (
    <section className="scenario-editor rounded-2xl border bg-card" aria-labelledby="quick-controls-title">
      <div className="border-b p-4">
        <h2 id="quick-controls-title" tabIndex={-1} className="font-heading text-xl font-semibold">Seu cenário</h2>
        <p className="mt-2 text-sm text-muted-foreground">A base já está preenchida. Altere só o que for diferente na sua fazenda.</p>
      </div>
      <Accordion value={openGroup ? [openGroup] : []} onValueChange={(ids) => onGroup(ids[0] ?? null)} keepMounted>
        {groups.map((group, index) => (
          <AccordionItem key={group.id} value={group.id}>
            <AccordionTrigger id={`editor-${group.id}`} className="gap-3 rounded-none px-4 py-4 hover:no-underline" aria-label={group.title} aria-describedby={`editor-summary-${group.id}`}>
              <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-sm text-primary">{index + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{group.title}</span>
                <span id={`editor-summary-${group.id}`} className="mt-1 block text-xs font-normal text-muted-foreground">{group.summary}</span>
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-4 pb-5 [&_p:not(:last-child)]:mb-0">
              {group.children}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <div className="scenario-editor-result border-t bg-secondary p-4">
        <p className="text-xs text-muted-foreground">Maior margem modelada · ano de regime pleno</p>
        <p className="mt-1 font-mono text-xl font-semibold">{margin}</p>
        <Button className="mt-3 w-full" onClick={onCompare}>Ver comparação <ArrowRight aria-hidden="true" /></Button>
      </div>
      <div className="border-t p-4">{footer}</div>
    </section>
  );
}

export function EditValue({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="rounded-xl border bg-secondary/30 p-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold">{value}</p>
      <button type="button" aria-label={`Editar ${label} no cenário`} className="mt-2 min-h-11 text-sm font-semibold text-primary underline underline-offset-4" onClick={onEdit}>Editar no cenário</button>
    </div>
  );
}
