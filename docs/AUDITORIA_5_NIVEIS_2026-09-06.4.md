# Auditoria executada — BoiMeta 2026-09-06.4

Rodada concluída tecnicamente em 07/09/2026. Registro de execução, não um prompt pendente. Destino: repositório BoiMeta e GitHub Pages, preservando o projeto Sites original. O status público de build/deploy fica no [GitHub Actions](https://github.com/viictorcastro-beep/boimeta/actions).

## Cinco níveis de correção e aceite

| Nível | Problema de decisão/uso | Alteração executada | Critério de aceite |
|---|---|---|---|
| 1 — Balanço físico | Só recria não participava integralmente das alternativas; uma área maior podia ser extrapolada ignorando o cocho | Rota C: toda a área em recria, venda líquida de magro, reposição comprada; varredura A/B recalcula capacidade em oito áreas | Compra = venda + perda + estoque; C não recebe custos/receitas de cocho/silagem; aumentar área pode inverter A−B |
| 2 — Caixa e investimento | Margem anual confundida com caixa; despesas/vendas compensadas intradia; atraso escondia parte do custeio | Eventos separados, despesa antes de recebimento; caixa do ano 1, estoque e capital C com reserva para concluir a fase; VPL incremental A−B separado | Pico do caso de teste R$ 26.411.847,06; capital conservador R$ 26.860.549,36, inclusive com atraso de 250 dias; CAPEX muda VPL, não margem |
| 3 — Risco e dados | C parecia imune no estresse; notícias desatualizadas podiam ser confundidas com dado atual | C recebe preço, reposição, GMD/lotação e custos; manchetes IBGE coletadas e datadas; cache preserva referência válida | Faixas C diferem; fontes/domínios/datas inválidos rejeitados; falhas não rejuvenescem observações |
| 4 — Facilidade e interpretação | `30000000` difícil de ler; GMD único aparente ocultava desempenho de B; falsos pareceres para pesos inválidos | Todos os editores numéricos da página e da revisão usam pt-BR; GMD A/C e B separados; equilíbrios e legenda C integrados; parecer financeiro exige rotas válidas | `30.000.000`, `1.234,56` e valores negativos preservados; entrada vazia/inválida não zera modelo; SSR de pesos inválidos não mostra VPL como parecer |
| 5 — Regressão e entrega | Atualização poderia quebrar dados, importação, PWA ou publicação | Testes locais e repetição no workflow; migração aceita versões anteriores; notícias incluídas no cache e no histórico do repositório | Modelo, 100 casos enumerados, TypeScript, lint, SSR, build e PWA aprovados localmente; CI deve repetir antes da entrega pública |

As cinco camadas incluem dez focos: hectares, animais, alimentação, capacidade, margem, capital, tempo, dados, usabilidade e entrega. Os achados de revisão independente foram corrigidos e reavaliados; testes não constituem promessa de inexistência de qualquer bug.

## Memória quantitativa reproduzível

Fixture técnica dos testes, não proposta de investimento: 550 ha, 7,8 UA/ha, entrada 240 kg, decisão 399,999 kg, GMD de recria 0,9 kg/dia, preço líquido do magro R$ 12,50/kg vivo, demais parâmetros-base. Sem prêmio de exportação.

- Fase: 178 dias; 2,05 giros equivalentes por ano de regime pleno.
- Vendidos em regime pleno: 12.345,93 cabeças equivalentes/ano.
- Receita líquida comercial: R$ 61.729.509,81/ano.
- Custeio caixa modelado: R$ 49.217.021,11/ano.
- Margem operacional: R$ 12.512.488,70/ano, ou R$ 22.749,98/ha total/ano.
- Equilíbrio líquido de venda: R$ 9,96627/kg vivo.
- Primeiro ano vazio, marco 10/09/2026: primeira venda 07/03/2027; saldo operacional/implantação acumulado −R$ 17.022.961,82; 6.032,82 cabeças equivalentes em estoque. Estoque não vira recebimento.
- Pico datado: R$ 26.411.847,06. A reserva conservadora de ocupação completa é maior, R$ 26.860.549,36; esse é o piso de capital deste caso antes de novas reservas/obras.
- Adiar a operação 250 dias elimina vendas dentro do primeiro ano, mas não reduz esse piso de financiamento.
- Estresse inferior: R$ 2.622,05/ha; superior: R$ 32.492,73/ha. São hipóteses combinadas, **não intervalos probabilísticos nem previsão de mercado**. Aplicar o mesmo choque ao preço do magro e do gordo é hipótese explícita, não correlação comprovada.

O custo anual de pasto usa a referência de O&M por hectare já presente no núcleo. Mortalidade C fixa em 0,2%, custos por entrante, consumo até o fim da fase. Cabeças fracionárias representam coortes equivalentes para estudo; a programação executiva exige lotes inteiros.

## Mercado e foco exportador

- [CONAB — preços de mercado](https://consultaprecosdemercado.conab.gov.br/): consulta por UF, janela móvel de 12 semanas, histórico retido por até 104 semanas. Dias úteis têm coleta programada; cotação observada não é preço futuro nem oferta firme local.
- [IBGE — API oficial de notícias](https://servicodados.ibge.gov.br/api/docs/noticias?versao=3): produtos 21119, 9203 e 9201, abate e safra. São armazenados título, link e datas, não a íntegra da notícia. Atualização em dias úteis, até 30 manchetes preservadas e seis recentes exibidas. Datas dos indicadores variam; não são dados intradiários.
- Notícias não alteram preços ou margens por inferência automática. BGI/CBOT/ICE não têm feed futuro contínuo validado nesta entrega. A curva manual/datada continua sendo hipótese ou referência conforme sua origem.
- [MAPA — cota China 2026](https://www.gov.br/agricultura/pt-br/assuntos/noticias/cota-carne-china) e [MOFCOM — aviso de 11/08/2026](https://cacs.mofcom.gov.cn/cacscms/article/jkdc?articleId=188893&type=11): contexto datado de concentração comercial. O aviso não informa saldo atual nem permite deduzir tarifa diretamente da arroba.
- [MAPA — exportação e requisitos](https://www.gov.br/agricultura/pt-br/assuntos/sanidade-animal-e-vegetal/saude-animal/exportacao): destino exportador não cria prêmio no simulador. Não há certificação automática de idade, sanidade, rastreabilidade ou habilitação; peso e GMD não comprovam enquadramento.

## Como explorar

1. Comece por capital, área, pesos, preços e os dois GMDs de pasto. Use a base produtiva de 400 ha apenas se fizer sentido como referência técnica.
2. O destaque aponta a maior margem modelada dentro do capital estimado. Se todas as alternativas calculáveis e financiáveis forem não positivas, o texto informa perda — não aprovação de investimento.
3. Veja C: margem anual, capital, preço líquido de equilíbrio e caixa no ano 1. Preço líquido do magro é independente da arroba do gordo.
4. Confira a diferença A−B e o VPL incremental; teste área com a mesma capacidade instalada. Não existe uma área mínima universal obtida dividindo CAPEX por uma margem constante.
5. Consulte o radar e as manchetes; aplique uma referência de preço apenas quando quiser. Edite riscos na aba Estratégia para verificar inversões entre faixas.
6. Salve/exporte o JSON das premissas e o relatório CSV. Fontes, versão, C, caixa e varredura de área têm memória; notícias são contexto externo datado e não parte de uma previsão automatizada exportável.

## Limites e próximos gargalos

| Prioridade | Melhoria ainda necessária | Impacto / urgência / esforço |
|---|---|---|
| 1 | Parametrizar dados locais de nascimento, mortalidade e produtividade mensal de forragem; confirmar capacidade hídrica e dieta antes de executar | Alto / alta antes de investir / médio |
| 2 | Unificar mix, lotes inteiros e fluxos mensais multianuais com dívida, tributação e custos inevitáveis de ociosidade; hoje mix usa custeio anual conservador e A compra milho, sem transferência automática entre módulos | Alto / alta antes de financiar / alto |
| 3 | Contratar/validar feed futuro por vencimento e base local; documentar cobertura, licença e atraso em vez de deduzir preços futuros de manchetes | Alto / média / alto |
| 4 | Validar interação em celulares reais, acessibilidade e fragmentar a página/gráficos para reduzir a carga inicial | Médio-alto / média / médio |

Nesta rodada não houve teste visual ou de cliques em navegador/dispositivos. Foram usados testes automatizados de funções, renderização React no servidor, artefatos PWA e HTTP. O build alerta para bundle principal de aproximadamente 1,09 MB (326 KB gzip); não é erro de compilação, mas é uma oportunidade de desempenho.

## Suítes executadas

`test:model`; `test:regression` (18); `test:decision` (27); `test:market` (27); `test:business` (28); `test:render`; `typecheck`; `lint`; `build:pages`; `test:pwa`.

Dados públicos são atualizados sem carregar cenários pessoais. Ausência de credenciais/fonte automática não é contornada por números inventados. Preservar a data original é obrigatório também offline.
