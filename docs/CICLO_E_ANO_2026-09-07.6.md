# Correção: ciclo do animal não é encerramento de compras

A versão .5 colocou uma campanha finita de compras como resposta principal. Isso era inadequado para o uso pretendido: estudar a fazenda funcionando, comparando pecuária e agricultura. O pressuposto de comprar por 365 dias e encerrar a operação não havia sido definido pelo usuário. A conta fechava sob essa hipótese, mas o indicador respondia a outra pergunta.

## Correções

- Comparação anual contínua restaurada como resultado principal, sem mudar preços, lotação, GMD, dieta ou custos para forçar uma margem.
- Novo resumo mostra duração do animal, margem por boi vendido com rateio ANUAL completo e volume anual. A produção anual não significa vendas realizadas no primeiro ano.
- Memória anual preservada para conferência: capacidade, duração, mortalidade, receita líquida e linhas quantidade × custo unitário. Inclui custos das perdas e arrendamento; não usa indevidamente `cashMarginHeadA/B`, que isoladamente não incluía arrendamento.
- Campanha finita somente em **Estudos detalhados → Encerramento de compras · opcional**, fora do ranking, do relatório padrão e do CSV padrão. Só é calculada quando a aba é aberta. Sua exportação, quando solicitada nessa aba, identifica o pressuposto.
- Memória e relatório não supõem um lote isolado de tamanho igual a toda a capacidade. Custos unitários são rateios da operação anual, não orçamento comercial de um lote específico.
- Cenários salvos e parâmetros da versão .5 preservados. Aceita importação de versões anteriores; modelo .6.

## Contraprova do texto fornecido

400 ha; 300 ha de pasto + 100 ha de silagem em A; 10 UA/ha de pasto; pesos 240 → 399,999 → 540 kg; GMD A/C 0,90, B 0,90, cocho 1,60 kg/d; dieta R$1,5170909996242017/kg MS; 2.000 vagas nominais, 90% de utilização; mortalidade 0,2% por fase; sem vacas. Boi R$349,50/@; bezerro R$3.288; magro líquido R$12,50/kg; rendimento A/B 56%/54%, deduções de venda 4%. Demais custos de referência mantidos, arrendamento zero.

| Indicador | A: recria + cocho | B: até o final no pivô | C: venda do magro |
|---|---:|---:|---:|
| Dias/animal | 178 + 88 = 266 | 334 | 178 |
| Vendidos/ano de regime pleno | 7.223,976 | 5.033,671 | 11.511,359 |
| Receita líquida anual | R$48.863.573,65 | R$32.832.164,17 | R$57.556.652,50 |
| Custo operacional anual | R$40.492.631,65 | R$24.237.791,49 | R$44.745.369,18 |
| Margem operacional anual | R$8.370.942,00 | R$8.594.372,68 | R$12.811.283,32 |
| Margem/ha TOTAL/ano | R$20.927,35 | R$21.485,93 | R$32.028,21 |
| Margem/boi vendido, rateio anual | R$1.158,77 | R$1.707,38 | R$1.112,93 |

O primeiro boi A leva 266 dias. Os 630 dias pertenciam a 364 dias adicionais de compras antes de começar a encerrar. A campanha A tinha R$6.161.155,82 de margem; seu custeio de pasto estendido até o encerramento adicionava R$2.209.786,17 frente ao custeio anual. Dividir depois essa campanha por 630 e multiplicar por 365 gerava outro indicador — não o lucro anual esperado da fazenda em regime pleno.

## Fórmulas de ponte

- Receita/boi vendido = peso vivo × rendimento/100 ÷ 15 kg/@ × R$/@ × (1 − deduções/100). C usa kg vivo × preço líquido do magro, sem nova dedução de frete.
- Custo/boi vendido = custos anuais dos bois / vendidos anuais. Inclui compra/custeio dos animais perdidos, área ociosa, silagem inteira e arrendamento.
- Margem/boi vendido × vendidos anuais + extras identificados = margem anual total.
- Margem/ha/ano = margem anual / toda a área-base, incluindo silagem.

Não multiplicar margem por boi por 365/dias como se isso sozinho calculasse lucro anual. As fases usam instalações e limites diferentes. A continua limitada pelo alimento. A/B diferem R$558,58/ha/ano neste exemplo; C depende do preço líquido do magro. Nenhuma diferença representa aprovação de investimento.

## Testes e limites

`test:cycle` reproduz o texto e reconcilia a memória ao motor anual. Verifica arrendamento, mortalidade, vacas como extra separado, zero vendidos, preço zero, fator de custos, silagem zero, ciclos acima de um ano e diferença para a campanha opcional. SSR exige que a página inicial NÃO contenha margem da campanha, equivalente anual da campanha ou imposição de compras diárias.

Sem certificação visual/mobile nesta rodada. As contas continuam condicionadas a dados locais: capacidade mensal de água/pasto, calendário de Correntina, custos de implantação e financiamento, cotações e dieta. A memória identifica referências agregadas, não as reclassifica como custos auditados do Grupo Mizote.

Próximas prioridades: custos locais abertos e suporte mensal de pasto/água (alto impacto, antes de investir, esforço médio); orçamento executivo e calendário real de lotes/caixa do primeiro ano (alto impacto, antes de imobilizar capital, esforço alto). Não adicionar nova hipótese operacional ao resultado principal sem identificá-la e justificá-la.
