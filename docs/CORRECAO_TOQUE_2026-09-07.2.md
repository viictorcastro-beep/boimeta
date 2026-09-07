# Ajustes sem edição acidental — 2026-09-07.2

## Causa e correção

A barra aceitava `track-press` no início do gesto. A faixa ampliada para toque usava `touch-action: none`, confundindo o gesto de rolar com uma edição. Apenas diminuir a sensibilidade não eliminaria esse salto inicial.

- Telas compactas, dispositivos sem hover e qualquer aparelho que informe ponteiro coarse usam botões −/+ e o campo numérico. Uma ativação altera um passo já definido; não há repetição por manter pressionado nem alteração no pointer-down.
- A barra permanece em telas amplas com mouse e hover, sem ponteiro coarse. Eventos de dedo, caneta e roda são recusados também no callback do modelo. Rolagem vertical e zoom por pinça não são bloqueados pelo controle.
- Os botões têm alvos de pelo menos 44 × 44 CSS px, rótulos acessíveis e limites. Informam o passo/unidade. Valores maiores podem ser digitados diretamente em pt-BR.
- Focar/sair do campo sem digitar não grava nem limita dados carregados. Entrada inválida não é convertida silenciosamente no mínimo/máximo: mantém o último valor válido. O botão encerra o rascunho antes de aplicar um passo sobre esse valor.
- O aviso de edição não desloca o botão ao desaparecer: uma verificação de entrada inválida reproduziu perda de clique por esse deslocamento e motivou a correção do layout do aviso.
- Cenários anteriores continuam importáveis. Não foram alteradas fórmulas econômicas, passos das premissas ou dados salvos.

## Critérios de aceite

1. Rolagem e eventos touch/pen não chegam ao modelo como mudanças da barra.
2. +/− alteram exatamente um passo, inclusive R$ 100.000 e GMD de 0,01 kg/d.
3. Valores decimais fora da grade, limites e números negativos não são truncados indevidamente.
4. Digitação seguida de +/− não é desfeita por um rascunho antigo no blur.
5. Mouse/teclado e recálculo imediato permanecem funcionais.

## Verificações

10 testes novos (`test:controls`), verificações dos callbacks e da renderização, além das 115 regressões de negócio/mercado/modelo enumeradas, tipos, lint, build e PWA. No navegador: edição direta, um passo/reversão, recálculo da margem, foco/saída, limites e telas compacta/ampla. Isso não equivale a ensaio físico em todos os aparelhos.

## Próximas verificações priorizadas

- **P1 · impacto alto · esforço baixo:** confirmar gestos verticais/diagonais reais em Android e iPhone, inclusive começando sobre −/+; o ambiente de QA desta rodada não reproduz um dedo físico nesses aparelhos.
- **P2 · impacto médio · esforço baixo:** ensaiar notebook híbrido alternando dedo/caneta/mouse e teclado móvel aberto. A proteção usa capacidade de entrada, não apenas largura de tela.

Não adicionar travas de confirmação em cada campo: isso prejudicaria a exploração rápida sem corrigir a causa do gesto.
