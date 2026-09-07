# BoiMeta

Simulador técnico-econômico de pecuária e culturas irrigadas. Sem cadastro, sem transmissão dos cenários pessoais a um servidor.

[Abrir o BoiMeta](https://viictorcastro-beep.github.io/boimeta/)

## Experiência de aplicativo

- Layout adaptável a celular, tablet e computador; no celular, a barra inferior alterna ajustes, simulação, decisão e relatório.
- Toque em **Ajustar** para abrir os parâmetros. A margem anual fica visível enquanto você altera valores.
- Use **Usar como aplicativo** para instruções de instalação. Chrome/Edge podem oferecer instalação; no iPhone, use Safari → Compartilhar → Adicionar à Tela de Início. A disponibilidade depende do navegador/sistema.
- Após a primeira carga completa, o aplicativo e as referências datadas ficam disponíveis offline. Preços não se atualizam sem conexão; as datas originais são preservadas.
- Uma nova versão avisa antes de recarregar. **Salve o cenário antes de atualizar.** O armazenamento é local ao navegador, sem sincronização automática entre dispositivos.
- As tabelas extensas têm rolagem própria; zoom, teclado e redução de movimento permanecem disponíveis.
- Responsividade implementada por breakpoints; não há certificação em todos os hardwares nem teste manual em dispositivos nesta rodada.

## Como utilizar

1. Ajuste área, preço de compra/venda, pesos e GMD na tela inicial.
   A base produtiva de 400 ha é editável; não é uma meta de margem. O radar busca referências datadas sem sobrescrever seu estudo.
2. Compare margem anual, margem por hectare e margem sobre custo operacional. Esta última **não é ROI sobre patrimônio nem lucro líquido**.
3. Confira o alimento produzido e consumido, a área adicional do milho, os lotes, a capacidade e o caixa.
4. Consulte referências semanais CONAB por UF quando disponíveis. Aplicar uma referência é uma decisão explícita; editar um preço transforma-o em hipótese.
5. Teste preço, produtividade, dieta, lotação, arrendamento e capital. Resultados negativos são preservados.
6. Use **Salvar no navegador** e **Restaurar salvo** para guardar um cenário no dispositivo. Não há salvamento automático: salve novamente depois das alterações.
7. **Baixar cenário** e **Abrir cenário** compartilham premissas em JSON versionado. Confirmações operacionais são renovadas ao importar.
8. A aba de relatório exporta CSV e permite impressão. O JSON restaura o cenário; o CSV documenta resultados.
9. Abra **Conferir margem** para reconciliar a referência histórica, comparar primeiro ano com regime pleno, informar reserva/implantação e verificar os requisitos físicos.
10. Em **Conferir margem → Estudos salvos**, guarde até dez versões locais e registre pesagens `id;data;peso kg`. O desvio de GMD não determina venda ou mudança de dieta automaticamente.
11. A tela rápida destaca a maior margem entre alternativas que cabem no capital estimado. **Estratégia** calcula um mix exclusivo de hectares, com custeio conservador, CAPEX e limite de vagas-dia.

## O que os números representam

- A tela rápida é uma comparação nominal de **ano em regime pleno**, não um orçamento de implantação nem garantia de retorno.
- A margem/ha usa a área-base total, incluindo silagem. Na comparação rápida, A usa silagem própria e milho comprado; o preço entregue do milho fica na alocação. Hectares de milho próprio adicional e sua oportunidade de venda são identificados na integração avançada.
- A análise datada e o alocador têm critérios próprios de mercado, disponibilidade, capacidade e oportunidade do alimento.
- A dieta manual funciona na comparação rápida e na projeção individual. A alocação integrada de alimento próprio usa custos por ingrediente e custo de oportunidade; não recebe selo de validação sob dieta manual.
- A oferta anual de alimento não prova disponibilidade no dia de uso. Compras adicionais antes da safra são mostradas e impedem a validação operacional até conciliação econômica.
- Calendário agronômico-base: **Barra/BA**. Escolher outra UF para preços não altera clima, janela, vazio sanitário ou licenças.
- O efluente mostra bruto, benefício limitado ao adubo substituível, custos e líquido hipotético. Disponibilidade e orçamento não informados não geram benefício. Continua sujeito a medição, análise química, projeto e requisitos locais.
- Fixos agrícolas são R$/ha/safra, independentes do preço da commodity. No editor de custos, estresse altera o orçamento; classificação redistribui o agregado existente.
- O primeiro ano usa coortes diárias equivalentes, aquisição de animais, implantação e custeio datado. Animais não vendidos não viram receita. É um plano financeiro simplificado, não programação executiva dos lotes.
- O mix defensivo maximiza o pior resultado do portfólio conjunto. Não atribui probabilidades aos cenários nem supõe vendas e consumo simultâneo do mesmo milho.
- Curvas futuras e notícias não são um feed automático em tempo real. Cotações futuras não garantem o preço de venda.
- Os custos iniciais são bases anonimizadas/hipóteses editáveis; não são cotações atuais de fornecedores.

## Desenvolvimento

Requer Node 22.13+ e pnpm. Dependências travadas em pnpm-lock.yaml.

```sh
pnpm install --frozen-lockfile
pnpm test:model
pnpm test:regression
pnpm test:decision
pnpm test:market
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
