# BoiMeta

Simulador técnico-econômico de pecuária e culturas irrigadas. Sem cadastro, sem transmissão dos cenários pessoais a um servidor.

[Abrir o BoiMeta](https://viictorcastro-beep.github.io/boimeta/)

## Experiência de aplicativo

- Layout adaptável a celular, tablet e computador; no celular, a barra inferior alterna **Cenário, Resultado, Mercado e Relatório**.
- **Seu cenário** concentra as entradas básicas em cinco grupos. Só **Fazenda e capital** começa aberto, com área, capital e data. Cada grupo recolhido resume as premissas usadas.
- Os grupos restantes são **Gado e desempenho**, **Alimentação e cocho**, **Lavouras irrigadas** e **Investimentos e extras**. Pesos, custos e hipóteses opcionais ficam em detalhes; não é necessário preencher tudo para estudar a base.
- A margem é recalculada ao editar. No celular, use **+ / −** ou digitação; deslizar para rolar a página não deve alterar valores. Os atalhos **Editar no cenário** levam ao campo original, sem manter editores duplicados nos estudos.
- Use **Usar como aplicativo** para instruções de instalação. Chrome/Edge podem oferecer instalação; no iPhone, use Safari → Compartilhar → Adicionar à Tela de Início. A disponibilidade depende do navegador/sistema.
- Após a primeira carga completa, o aplicativo e as referências datadas ficam disponíveis offline. Preços não se atualizam sem conexão; as datas originais são preservadas.
- Uma nova versão avisa antes de recarregar. **Salve o cenário antes de atualizar.** O armazenamento é local ao navegador, sem sincronização automática entre dispositivos.
- As tabelas extensas têm rolagem própria; zoom, teclado e redução de movimento permanecem disponíveis.
- Versões anteriores tiveram navegação e edição verificadas em navegador com larguras estreitas, intermediárias e amplas. A reorganização 2026-09-07.3 foi verificada por testes de código, renderização React e build; nesta rodada não houve nova inspeção visual/gestual em navegador ou aparelho físico.

## Como utilizar

1. Em **Seu cenário**, comece por área e capital. Confira a data-base e só abra os outros grupos se quiser alterar suas premissas.
   A base produtiva de 400 ha é editável; não é uma meta de margem. O radar busca referências datadas sem sobrescrever seu estudo.
2. Compare margem anual, margem por hectare e margem sobre custo operacional. Esta última **não é ROI sobre patrimônio nem lucro líquido**.
3. Confira o alimento produzido e consumido, a área adicional do milho, os lotes, a capacidade e o caixa.
4. Consulte referências semanais CONAB por UF quando disponíveis. Aplicar uma referência é uma decisão explícita; editar um preço transforma-o em hipótese.
5. Teste preço, produtividade, dieta, lotação, arrendamento e capital. Resultados negativos são preservados.
6. Use **Salvar no navegador** e **Restaurar salvo** para guardar um cenário no dispositivo. Não há salvamento automático: salve novamente depois das alterações.
7. **Baixar cenário** e **Abrir cenário** compartilham premissas em JSON versionado. Confirmações operacionais são renovadas ao importar.
8. A aba de relatório exporta CSV e permite impressão. O JSON restaura o cenário; o CSV documenta resultados.
9. Abra **Validações** para conferir primeiro ano, reserva/implantação e requisitos físicos. A reconciliação histórica permanece recolhida, não como meta de margem.
10. Em **Validações → Estudos salvos**, guarde até dez versões locais e registre pesagens `id;data;peso kg`. O desvio de GMD não determina venda ou mudança de dieta automaticamente.
11. **Resultado** destaca a maior margem entre alternativas que cabem no capital estimado. Em **Estudos detalhados → Ciclo & mix**, calcule um mix exclusivo de hectares, com custeio conservador, CAPEX e limite de vagas-dia.
12. Compare **A: recria + cocho**, **B: ciclo no pivô** e **C: recria e venda do magro**. Informe o preço líquido local do magro; não é a cotação da arroba de boi gordo. O GMD de recria A/C e o do ciclo B têm controles separados.
13. Valores usam português brasileiro: `30.000.000`, `1.234,56`, `0,78`. É possível colar `R$ 1.234,56`. Um campo vazio não zera silenciosamente a premissa; use vírgula decimal, Enter para concluir ou as setas para incrementar.
14. Em **Validações → Alimentos, pasto e água**, informe produção de MS e aproveitamento. Esses dados limitam A/B/C; a distribuição mensal limita o fluxo contínuo pelo mês mais restritivo. Não há carregamento automático de sobra de capim entre meses.
15. O capital A/B cobre a esteira até a primeira venda e a reserva de custeio do ciclo. O mix separa essa reserva do custo anual usado para calcular margem; adiar a entrada não faz despesas futuras desaparecerem.

## O que os números representam

### Caixa, lotação e alavancas

Em **Resultado → O que muda a decisão**, use **Mesmo capital** para comparar escalas parciais, **Alavancas de margem** para testar uma mudança por vez e **Lotação e área** para separar UA/ha de pasto da média da fazenda. O quadro geral acima continua comparando a área inteira. A diferença entre esses escopos pode mudar a primeira colocação.

A rota A mostra a melhor proporção pasto/silagem testada e os preços de empate com B/C, sem prometer preço futuro ou retorno ao investimento. A inversa calcula a área equivalente de custeio agrícola, mas só atribui margem à área disponível. Informe custos adicionais de intensificação; aumentar UA sozinho não cria capim, energia ou desempenho. O relatório CSV contém os estudos e suas limitações. Veja a [auditoria numérica e prioridades](DECISAO_CAPITAL_2026-09-07.4.md).

- A tela rápida é uma comparação nominal de **ano em regime pleno**, não um orçamento de implantação nem garantia de retorno.
- A margem/ha usa a área-base total, incluindo silagem. Na comparação rápida, A usa silagem própria e milho comprado; o preço entregue fica em **Seu cenário → Alimentação e cocho**. O preço de venda do milho fica em **Lavouras irrigadas**. Hectares de milho próprio adicional e sua oportunidade de venda são identificados na integração avançada.
- A análise datada e o alocador têm critérios próprios de mercado, disponibilidade, capacidade e oportunidade do alimento.
- A dieta manual funciona na comparação rápida e na projeção individual. A alocação integrada de alimento próprio usa custos por ingrediente e custo de oportunidade; não recebe selo de validação sob dieta manual.
- A oferta anual de alimento não prova disponibilidade no dia de uso. Compras adicionais antes da safra são mostradas e impedem a validação operacional até conciliação econômica.
- Calendário agronômico-base: **Barra/BA**. Escolher outra UF para preços não altera clima, janela, vazio sanitário ou licenças.
- O efluente mostra bruto, benefício limitado ao adubo substituível, custos e líquido hipotético. Disponibilidade e orçamento não informados não geram benefício. Continua sujeito a medição, análise química, projeto e requisitos locais.
- Fixos agrícolas são R$/ha/safra, independentes do preço da commodity. No editor de custos, estresse altera o orçamento; classificação redistribui o agregado existente.
- O primeiro ano usa coortes diárias equivalentes, aquisição de animais, implantação e custeio datado. Animais não vendidos não viram receita. É um plano financeiro simplificado, não programação executiva dos lotes.
- O mix defensivo maximiza o pior resultado do portfólio conjunto. Não atribui probabilidades aos cenários nem supõe vendas e consumo simultâneo do mesmo milho.
- Notícias oficiais IBGE de abate/safra são coletadas em dias úteis, com data da publicação e da coleta. Não são interpretadas automaticamente como variação de preço. Curvas futuras ainda não têm feed automático validado e não garantem preço de venda.
- Recria C usa toda a área, reposição 100% comprada, venda líquida por kg vivo e a mortalidade de pasto editada no cenário (base: 0,2%). A usa também a mortalidade do cocho. Perdas são modeladas ao fim de cada fase; mortos no pasto não consomem confinamento. C não inclui silagem, confinamento, matrizes, vacas ou efluente.
- Capital é reserva de recursos, não uma nova despesa deduzida da margem. A/B usam o maior entre pico datado, custeio de uma ocupação e caixa antes da primeira venda da esteira, mais CAPEX, preparação e reserva livre; C cobre sua ocupação até a venda.
- VPL exibido no painel de investimento é **incremental A menos B**, com regime pleno e preços constantes. Não é VPL da aquisição da fazenda. Pesos/GMD inválidos exigem correção antes de emitir esse parecer.
- Foco em exportação não acrescenta prêmio. Peso/acabamento não certificam “boi-China”; documentação, sanidade, requisitos vigentes e comprador precisam ser verificados.
- Os custos iniciais são bases anonimizadas/hipóteses editáveis; não são cotações atuais de fornecedores.

## Desenvolvimento

Registro da rodada: [auditoria de prioridades · 2026-09-07.1](docs/PRIORIDADES_2026-09-07.1.md).

Reorganização do preenchimento: [guia e auditoria · 2026-09-07.3](docs/PREENCHIMENTO_2026-09-07.3.md).

Requer Node 22.13+ e pnpm. Dependências travadas em pnpm-lock.yaml.

```sh
pnpm install --frozen-lockfile
pnpm test:model
pnpm test:regression
pnpm test:decision
pnpm test:market
pnpm test:business
pnpm test:controls
pnpm test:lab
pnpm test:render
pnpm lint
pnpm exec tsc --noEmit
pnpm build:pages
pnpm test:pwa
pnpm dev:pages
```

Esta distribuição é estática: `pnpm dev` inicia o ambiente local e `pnpm build` gera `dist-pages/`. O projeto original Sites/Cloudflare foi preservado separadamente; seus identificadores e histórico privado não fazem parte deste repositório.

## GitHub Pages

O workflow `.github/workflows/pages.yml` testa, atualiza referências e publica os arquivos estáticos. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**. O primeiro push em `main` inicia a publicação.

- Caminho de projeto padrão: `/boimeta/`.
- Outro repositório: o workflow usa automaticamente o nome do repositório.
- Site raiz `usuario.github.io`: ajuste `PAGES_BASE_PATH` para `/`.
- Não hospede `dist/client` do build Sites sozinho; ele depende do servidor.
- A atualização está programada para dias úteis, às 12h30 UTC. A janela de 12 semanas avança com a data; o histórico acumula até 104 semanas. O workflow versiona dados/registro de tentativa em main, evitando depender de cache e mitigando inatividade. É melhor esforço: GitHub pode atrasar/desativar a agenda se ela deixar de funcionar.
- Cada observação preserva data e praça. Falha da fonte mantém o último arquivo válido, sem rebatizá-lo como preço de hoje.
- Sem preço válido, a simulação manual continua disponível.

## Dados e privacidade

Não publique anexos de fazendas, documentos, senhas, .env, .openai, diretórios de trabalho ou histórico privado de desenvolvimento. Uma publicação estática torna seus parâmetros-base legíveis no JavaScript. Os cenários salvos pelo visitante ficam apenas no próprio navegador; baixá-los/compartilhá-los é opcional.

O repositório não concede licença ampla de reutilização do código por padrão. A disponibilização do simulador para uso público não transfere direitos sobre fontes, marcas ou dados de terceiros.

## Referências técnicas

- [CONAB — preços de mercado](https://consultaprecosdemercado.conab.gov.br/)
- [GitHub — Pages e hospedagem estática](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub — workflows de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Vite — publicação estática](https://vite.dev/guide/static-deploy.html#github-pages)
- [OWASP — proteção contra fórmulas em CSV](https://owasp.org/www-community/attacks/CSV_Injection)

Veja [a auditoria desta versão](docs/AUDITORIA_PUBLICA_2026-09-06.md) para correções e limitações.

Veja [o guia da versão 2026-09-06.2](docs/DECISAO_2026-09-06.2.md) para memória da referência, funcionalidades novas e pendências priorizadas.

Veja [a versão 2026-09-06.3 — mercado e atualização contínua](docs/MERCADO_2026-09-06.3.md) para a janela móvel, sinais descritivos, ações explícitas de preço e limites.

Veja [a auditoria executada em cinco níveis — versão 2026-09-06.4](docs/AUDITORIA_5_NIVEIS_2026-09-06.4.md) para as correções de decisão, uso, caixa, notícias e testes desta rodada.
