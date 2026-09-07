'use client';

import { useEffect, useState } from 'react';

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export function AppInstall() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(() => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
  const [help, setHelp] = useState(false);
  const [ios] = useState(() => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)));
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    let registration: ServiceWorkerRegistration | undefined;
    let refreshing = false;
    const media = window.matchMedia('(display-mode: standalone)');
    const installState = () => setInstalled(media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    const networkState = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void registration?.update().catch(() => {});
    };
    const capturePrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const didInstall = () => { setInstalled(true); setPrompt(null); };
    const controllerChanged = () => {
      // Never reload an open simulation because a different tab activated an update.
      if (refreshing) location.reload();
    };
    const activateUpdate = () => { refreshing = true; };
    window.addEventListener('boimeta-update-approved', activateUpdate);
    window.addEventListener('online', networkState);
    window.addEventListener('offline', networkState);
    window.addEventListener('beforeinstallprompt', capturePrompt);
    window.addEventListener('appinstalled', didInstall);
    media.addEventListener('change', installState);
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.addEventListener('controllerchange', controllerChanged);
      void navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js', { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).then((reg) => {
        registration = reg;
        const reportWorker = () => {
          if (!live) return;
          setWaiting(reg.waiting);
          if (reg.active) setReady(true);
        };
        reportWorker();
        reg.addEventListener('updatefound', () => {
          reg.installing?.addEventListener('statechange', reportWorker);
        });
        return navigator.serviceWorker.ready;
      }).then(() => { if (live) setReady(true); }).catch(() => {
        if (live) setMessage('O simulador funciona online. O armazenamento offline não está disponível neste navegador.');
      });
    }
    return () => {
      live = false;
      window.removeEventListener('boimeta-update-approved', activateUpdate);
      window.removeEventListener('online', networkState);
      window.removeEventListener('offline', networkState);
      window.removeEventListener('beforeinstallprompt', capturePrompt);
      window.removeEventListener('appinstalled', didInstall);
      media.removeEventListener('change', installState);
      if ('serviceWorker' in navigator) navigator.serviceWorker.removeEventListener('controllerchange', controllerChanged);
    };
  }, []);

  async function install() {
    if (!prompt) { setHelp((value) => !value); return; }
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
    catch { setHelp(true); }
  }

  return <div className="app-status no-print"><div>
    <output>{!online ? 'Sem conexão · usando referências salvas e datadas' : ready ? 'Simulador disponível também offline' : 'Simulação no seu dispositivo'}</output>
    {!installed ? <button type="button" onClick={install}>{prompt ? 'Instalar BoiMeta' : 'Usar como aplicativo'}</button> : <span>Modo aplicativo</span>}
    {help ? <p>{ios ? 'No Safari, toque em Compartilhar → Adicionar à Tela de Início → Abrir como App. A instalação depende da versão do sistema.' : 'No Chrome ou Edge, procure “Instalar aplicativo” no menu. No Safari do Mac, use Arquivo → Adicionar ao Dock, quando disponível. Outros navegadores podem oferecer um atalho.'} Após a primeira carga completa, os cálculos funcionam offline. Dados de mercado exigem conexão para atualização; cenários não sincronizam entre aparelhos.</p> : null}
    {message ? <output>{message}</output> : null}
    {waiting ? <p>Nova versão disponível. Salve seu cenário em “Meus cenários” antes de atualizar. <button type="button" onClick={() => { window.dispatchEvent(new Event('boimeta-update-approved')); waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); }}>Atualizar aplicativo</button></p> : null}
  </div></div>;
}
