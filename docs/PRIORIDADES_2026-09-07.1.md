# Prioridades executadas · modelo 2026-09-07.1

## P0 — balanço físico e caixa que podem mudar a decisão

1. Produção de pasto e aproveitamento informados passam a limitar a lotação de A/B/C, preservando O&M de toda a área. Ausência de dados não vira capacidade comprovada.
2. Suporte anual = kg MS produzidos/ha × aproveitamento ÷ (450 kg/UA × consumo em fração do PV/dia × 365). No fluxo contínuo, usa-se também o menor suporte mensal, sem transportar sobras. O calendário padroniza 365 dias; não é previsão climática. Distribuição inválida mantém apenas o teto anual e um alerta.
3. Demanda efetiva de pasto A usa compras × dias no pasto × peso médio × consumo, não a capacidade ociosa de cocho.
4. Mortalidade por fase: compras → sobreviventes do pasto → entradas no cocho → vendidos. Mortos no pasto não consomem dieta, silagem ou vagas de confinamento. Perdas são custeadas até o fim da respectiva fase.
5. Candidatos para vender magros não diminuem com uma mortalidade futura de confinamento ainda não escolhido. O diagnóstico de área usa animais/consumo, não somente sobreviventes vendidos.
6. Capital A/B reserva a esteira antes da primeira venda. A soma fechada foi confrontada com coortes independentes em ciclos de 273, 412 e 645 dias. Atrasar a entrada muda o caixa do ano 1, não elimina o custeio posterior.
7. Mix distingue custo anual e reserva de capital por hectare. Usa o maior coeficiente das faixas de estresse. CAPEX comum e incremental entram separadamente, sem duplicação.
8. Outros ingredientes retiram sua fração de milho também na dieta da análise de rotas, evitando dupla contagem.

Fonte conceitual de suporte, consultada em 07/09/2026: [Embrapa — disponibilidade e consumo de matéria seca](https://cloud.cnpgc.embrapa.br/sac/2016/06/15/como-se-calcula-a-capacidade-de-suporte-de-uma-pastagem/). A eficiência é campo local; nenhum exemplo desta auditoria é recomendação de produtividade/lotação.

## P1 — clareza, acesso e desempenho

- Abas em grade adaptativa, em vez de uma linha que ultrapassava a tela. Tabelas conservam rolagem própria.
- KPIs de capital com largura mínima legível; culturas em duas colunas no espaço intermediário.
- Valores pt-BR preservados. Campo inválido mantém o último valor; rótulos dos campos físicos não mudam durante a edição.
- Gráficos carregados sob demanda e com fallback. O precache offline inclui os novos arquivos.
- JS de entrada: aproximadamente 1.091 kB → 754 kB minificado, 326 kB → 227 kB gzip. Redução de cerca de 31% na entrada; não no total de recursos baixados para offline. Ainda existe aviso de bundle acima de 500 kB.

## Verificação

- 115 casos enumerados: regressão pública 18, decisão 27, mercado 27 e negócios 43; mais sanidade do modelo, renderização, TypeScript, lint, build e PWA.
- Teste no navegador: orçamento de 30.000.000 para 6.000.000 altera o líder; texto inválido mantém 6.000.000; orçamento restaurado.
- Fixture física apenas de teste: 20 t MS/ha/ano, 60% de aproveitamento e distribuição uniforme mensal reduz 7,80 para 2,87 UA/ha e altera o líder. Dados restaurados para não se passar por medição real.
- Comparativo gráfico abre por carregamento separado; a tabela continua sendo a memória numérica acessível.
- Larguras de conteúdo observadas de 400 a 1.405 px, incluindo 675 px: largura rolável do documento não excedeu o viewport. Emulação do navegador com zoom do usuário; não certificação em dispositivos físicos.
- Alterações de calendário não fabricam cotação futura. Referências CONAB continuam semanais, consultadas ao abrir/retornar e atualizadas em dias úteis; notícias oficiais não são transformadas automaticamente em preço.

## Limitações que continuam materiais

| Prioridade | Dependência | Impacto | Urgência | Esforço |
|---|---|---|---|---|
| P0 | Medições locais de MS mensal, vazão/horas de bombeamento, energia e pesagens | Define capacidade real e GMD; preenchimento não certifica campo | Antes de investimento | Médio, com equipe técnica |
| P0 | Orçamento executivo, lotes reais, impostos, dívida e condições de pagamento | Pode alterar pico de caixa e retorno do patrimônio | Antes de contratar | Médio/alto |
| P1 | Provedor e direitos de uso de curva futura por vencimento/praça | Necessário para atualizar perspectivas de saída automaticamente | Antes de usar forecast comercial | Depende de contratação/integração |
| P2 | Celulares físicos e uso assistido em campo | Ergonomia, conectividade e peso do restante do app | Piloto | Médio |

Água é diagnóstico de necessidade, não disponibilidade comprovada. Nenhum feed futuro foi inventado nem comprado. A análise nominal segue sem prêmio automático de exportação, sem garantia de lucro e sem confundir margem operacional com retorno sobre a aquisição da fazenda.
