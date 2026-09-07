import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';

class RecoveryBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main style={{ padding: 32, fontFamily: 'system-ui' }}>
      <h1>Não foi possível abrir este cenário</h1>
      <p>O arquivo salvo continua no navegador. Você pode voltar às premissas-base sem alterar seus arquivos baixados.</p>
      <button onClick={() => { localStorage.removeItem('pivo-scenario-v1'); location.reload(); }}>Voltar à base</button>
    </main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(<RecoveryBoundary><Home /></RecoveryBoundary>);
