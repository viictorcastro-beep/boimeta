'use client';

import { useEffect, useRef, useState } from 'react';
import { marketPricesUrl } from '@/lib/market-client';
import { VALID_UFS, type ConabPrice, type Product } from '@/lib/conab-prices';
import {
  PRODUCTS,
  marketSignal,
  cattleCornRelation,
  mergeMarketHistory,
} from '@/lib/market-signals';
import { Button } from '@/components/ui/button';

const labels: Record<Product, string> = {
  cattle: 'Boi gordo',
  soy: 'Soja',
  corn: 'Milho',
  cotton: 'Algodão · pluma',
};
const number = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const date = (v: string | null) =>
  v ? v.split('-').reverse().join('/') : 'sem data';
const pct = (v: number | null) =>
  v === null ? 'n/d' : (v > 0 ? '+' : '') + number(v) + '%';
type Props = {
  uf: string;
  onUf: (uf: string) => void;
  asOf: string;
  modeledPrices: Record<Product, number>;
  onApply: (quote: ConabPrice) => void;
  onEvidence: (history: ConabPrice[]) => void;
  decisionDate: string;
  exitDate: string;
  curvePrice: number | null;
  curveCovered: boolean;
  onAdvanced: () => void;
};

export function MarketCompass(p: Props) {
  const [snapshot, setSnapshot] = useState<{
    uf: string;
    history: ConabPrice[];
  }>({ uf: '', history: [] });
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState('Carregando referências públicas…');
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState('');
  const historyCache = useRef(new Map<string, ConabPrice[]>());
  const { uf, onEvidence } = p;
  // PWA aberta por semanas também busca novos arquivos. Sem aba visível, não consulta.
  useEffect(() => {
    let lastAttempt = Date.now();
    const refreshIfDue = () => {
      if (
        document.visibilityState !== 'visible' ||
        Date.now() - lastAttempt < 15 * 60000
      )
        return;
      lastAttempt = Date.now();
      setLoading(true);
      setRefresh((v) => v + 1);
    };
    const timer = window.setInterval(refreshIfDue, 60 * 60000);
    document.addEventListener('visibilitychange', refreshIfDue);
    window.addEventListener('focus', refreshIfDue);
    window.addEventListener('online', refreshIfDue);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshIfDue);
      window.removeEventListener('focus', refreshIfDue);
      window.removeEventListener('online', refreshIfDue);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 40000);
    void (async () => {
      try {
        const response = await fetch(marketPricesUrl(uf), {
          signal: controller.signal,
          cache: 'no-cache',
        });
        const data = (await response.json()) as {
          uf?: string;
          history?: unknown;
          quotes?: unknown;
        };
        if (!response.ok || data.uf !== uf)
          throw new Error('Referência indisponível para esta UF.');
        const history = mergeMarketHistory(data.history, data.quotes).filter(
          (q) => q.uf === uf,
        );
        if (!history.length)
          throw new Error('Sem observações válidas para esta UF.');
        if (!active) return;
        historyCache.current.set(uf, history);
        setSnapshot({ uf, history });
        onEvidence(history);
        setStatus(
          'CONAB · janela móvel de 12 semanas. Novas referências são buscadas todos os dias úteis. Este aplicativo consulta ao abrir, voltar à tela e a cada hora visível; não é preço em tempo real.',
        );
      } catch {
        if (active) {
          const saved = historyCache.current.get(uf);
          if (saved) {
            setSnapshot({ uf, history: saved });
            onEvidence(saved);
          }
          setStatus(
            'Atualização indisponível. A simulação continua; qualquer série preservada mantém sua data original.',
          );
        }
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [uf, refresh, onEvidence]);
  const history = snapshot.uf === uf ? snapshot.history : [];
  const signals = PRODUCTS.map((product) =>
    marketSignal(history, uf, product, p.asOf),
  );
  const relation = cattleCornRelation(signals[0], signals[2], p.asOf);
  const freshRelation = relation.current;
  return (
    <section
      className="rounded-2xl border bg-card p-5 sm:p-6"
      aria-labelledby="market-compass-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Mercado observado × sua simulação
          </p>
          <h2
            id="market-compass-title"
            className="mt-1 font-heading text-2xl font-semibold"
          >
            O mercado está ajudando ou pressionando?
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            A base de 400 ha fornece as premissas iniciais. O sinal abaixo
            descreve preços observados, não um valor garantido na venda.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="radar-uf" className="text-sm">
            UF
          </label>
          <select
            id="radar-uf"
            value={uf}
            onChange={(e) => {
              setLoading(true);
              setApplied('');
              onEvidence([]);
              p.onUf(e.target.value);
            }}
            className="h-10 rounded-lg border bg-background px-3"
          >
            {[...VALID_UFS].sort().map((state) => (
              <option key={state}>{state}</option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setApplied('');
              setRefresh((v) => v + 1);
            }}
          >
            {loading ? 'Buscando…' : 'Atualizar'}
          </Button>
        </div>
      </div>
      <output className="mt-3 block text-sm text-muted-foreground">
        {status} {applied}
      </output>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {signals.map((signal) => (
          <article
            key={signal.product}
            className="flex min-w-0 flex-col rounded-xl border bg-[#f5f8f2] p-4"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="font-semibold">{labels[signal.product]}</h3>
              <span className="rounded-full border bg-white px-2 py-0.5 text-sm">
                {signal.direction}
              </span>
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold">
              {signal.latest
                ? 'R$ ' + number(signal.latest.value)
                : 'Sem cotação'}
            </p>
            <p className="text-sm">
              {signal.latest?.displayUnit} ·{' '}
              {date(signal.latest?.sourceDate ?? null)}
            </p>
            <p className="mt-3 text-sm">
              Última semana: <strong>{pct(signal.changeWeek)}</strong>
              <br />
              Período disponível: <strong>{pct(signal.changePeriod)}</strong>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {signal.observations} observações · desde {date(signal.startDate)}
            </p>
            <p className="mt-3 text-sm">
              {signal.product === 'cotton'
                ? 'A fazenda usa algodão equivalente, não pluma. Converter rendimento, caroço e beneficiamento antes de aplicar.'
                : 'Na simulação: R$ ' +
                  number(p.modeledPrices[signal.product]) +
                  (signal.product === 'cattle' ? '/@' : '/sc')}
            </p>
            <div className="mt-auto pt-4">
              {signal.product !== 'cotton' ? (
                <Button
                  className="w-full"
                  variant="outline"
                  disabled={!signal.current || !signal.latest}
                  onClick={() => {
                    if (!signal.latest || !signal.current) return;
                    p.onApply(signal.latest);
                    setApplied(
                      labels[signal.product] +
                        ': referência aplicada. Confira ajustes locais e margem recalculada.',
                    );
                  }}
                >
                  Aplicar {labels[signal.product].toLowerCase()}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={p.onAdvanced}
                >
                  Converter na análise avançada
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-[#eef5ef] p-4">
          <h3 className="font-semibold">Poder de compra do boi em milho</h3>
          <p className="mt-2 text-sm">
            {relation.latest
              ? number(relation.latest.ratio) +
                ' sacas por arroba · ' +
                date(relation.latest.date) +
                '. Variação em datas coincidentes: ' +
                pct(relation.change) +
                '.'
              : 'Sem datas coincidentes suficientes.'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {!freshRelation
              ? 'Dados ausentes ou antigos: não usar como sinal atual.'
              : relation.change !== null && relation.change < 0
                ? 'O boi compra menos milho no período. Teste o encarecimento da dieta; alta do boi não assegura melhora da margem.'
                : 'Esta relação descreve os dois preços, mas não inclui bezerro, conversão alimentar, frete ou despesas.'}
          </p>
        </div>
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold">
            Quando este lote encontra o mercado?
          </h3>
          <p className="mt-2 text-sm">
            Decisão da recria: {date(p.decisionDate)} · saída do confinamento:{' '}
            {date(p.exitDate)}.
          </p>
          <p className="mt-2 text-sm">
            {p.curveCovered && p.curvePrice !== null
              ? 'Curva informada e validada cobre a saída: R$ ' +
                number(p.curvePrice) +
                '/@ indicativos. Compare essa rota na análise avançada; o ranking rápido continua usando o preço informado constante. Não é garantia de venda.'
              : 'Sem curva utilizável cobrindo a saída. O ranking rápido usa o preço informado constante; os movimentos recentes não são extrapolados até essa data.'}
          </p>
          <Button variant="outline" className="mt-3" onClick={p.onAdvanced}>
            Ver contratos, ajustes locais e datas
          </Button>
        </div>
      </div>
      <details className="mt-4 rounded-xl border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          Como o sinal funciona e o que ele ainda não sabe
        </summary>
        <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
          <p>
            Método conab-weekly-v1: mesma UF, descrição, nível e unidade; até 12
            observações. Com seis semanas consecutivas, comparamos a média das
            últimas três à das três anteriores. Variação menor que 1% é lateral;
            reversão semanal de pelo menos 1% gera sinal misto. Cotação com mais
            de 14 dias é desatualizada. São critérios descritivos editáveis no
            código, sem probabilidade calibrada.
          </p>
          <p>
            Atualizar o radar não altera o cenário. Aplicar boi ou grão
            substitui apenas seu preço de venda; o milho comprado para a dieta
            tem preço entregue separado nos controles abaixo. Reposição, fretes
            e qualidade não são inferidos da cotação do boi.
          </p>
          <p>
            Fontes de fundamentos para conferir riscos:{' '}
            <a
              className="underline"
              href="https://www.gov.br/conab/pt-br/atuacao/informacoes-agropecuarias/safras"
              target="_blank"
              rel="noreferrer"
            >
              safras CONAB
            </a>
            ,{' '}
            <a
              className="underline"
              href="https://www.ibge.gov.br/estatisticas/economicas/agricultura-e-pecuaria/9203-pesquisas-trimestrais-do-abate-de-animais.html"
              target="_blank"
              rel="noreferrer"
            >
              abate IBGE
            </a>{' '}
            e{' '}
            <a
              className="underline"
              href="https://arquivos.b3.com.br/bdi/tabelas?lang=pt-br"
              target="_blank"
              rel="noreferrer"
            >
              contratos B3
            </a>
            . Manchetes oficiais do IBGE são coletadas automaticamente em dias úteis;
            não inventamos efeitos percentuais sobre preços a partir delas.
          </p>
          <p>
            <a
              className="underline"
              href="https://consultaprecosdemercado.conab.gov.br/"
              target="_blank"
              rel="noreferrer"
            >
              Fonte dos preços: CONAB
            </a>
            . Reutilização com atribuição; confirmar condições antes de
            comercializar informações ou integrar em produto pago.
          </p>
        </div>
      </details>
    </section>
  );
}
