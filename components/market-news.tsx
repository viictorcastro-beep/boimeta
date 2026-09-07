'use client';
import { useEffect, useState } from 'react';
import { marketNewsUrl } from '@/lib/market-client';
import type { MarketNews } from '@/lib/market-news';

export function MarketNewsPanel() {
  const [items, setItems] = useState<MarketNews[]>([]);
  const [status, setStatus] = useState('Consultando notícias oficiais…');
  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return;
      controller?.abort();
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 10000);
      try {
        const response = await fetch(marketNewsUrl(), {
          signal: request.signal,
          cache: 'no-cache',
        });
        const data = (await response.json()) as {
          items?: MarketNews[];
          collectedAt?: string;
        };
        if (!response.ok || !Array.isArray(data.items)) throw new Error();
        const valid = data.items.filter(
          (item) =>
            item.source === 'IBGE' &&
            typeof item.title === 'string' &&
            typeof item.sourceDate === 'string' &&
            typeof item.url === 'string' &&
            item.url.startsWith('https://agenciadenoticias.ibge.gov.br/'),
        );
        if (active && !request.signal.aborted) {
          setItems(valid.slice(0, 6));
          const collected = new Date(data.collectedAt ?? '');
          const collectedText = Number.isFinite(collected.getTime())
            ? collected.toLocaleString('pt-BR')
            : 'data de coleta indisponível';
          setStatus(
            'IBGE · arquivo coletado em ' +
              collectedText +
              '. Atualização programada em dias úteis. Contexto de oferta; nenhuma manchete muda preço ou margem sozinha.',
          );
        }
      } catch {
        if (active && controller === request)
          setStatus(
            'Sem atualização de notícias. Conteúdo eventualmente preservado continua com a data original.',
          );
      } finally {
        clearTimeout(timeout);
      }
    };
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 60 * 60000);
    const visible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  return (
    <details className="rounded-xl border bg-card p-4 text-sm">
      <summary className="cursor-pointer font-semibold">
        Notícias oficiais · oferta de gado e safra
      </summary>
      <p className="mt-3 text-muted-foreground">{status}</p>
      <ul className="mt-3 divide-y">
        {items.map((item) => (
          <li key={item.id} className="py-3">
            <span className="text-muted-foreground">
              {item.sourceDate.split('-').reverse().join('/')} · {item.topic} ·
              IBGE
            </span>
            <a
              className="mt-1 block font-medium underline"
              href={item.url}
              target="_blank"
              rel="noreferrer"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-muted-foreground">
        Mais abate ou maior safra pode alterar oferta, mas não determina preço
        sem avaliar demanda, exportações, câmbio e estoques. Use as notícias
        para escolher quais riscos estressar; não são uma previsão automática.
      </p>
    </details>
  );
}
