# Base das fotos e contabilização das vacas — 2026-09-07.7

## Escopo

Pedido: carregar os parâmetros das fotografias da apresentação e contabilizar a atividade adicional de vacas. Não fabricar receita para reconciliar slides incompatíveis. Não alterar cenários salvos automaticamente. A base inicial da página e o botão de referência agora usam a mesma configuração; a base legada do motor permanece preservada para regressões e arquivos anteriores.

## Dados transcritos e complementos

- Área de 400 ha: 300 de pasto + 100 de silagem para A; 400 de pasto para B.
- Entrada 240 kg, decisão 400 kg, saída 540 kg; GMD de 0,90 no pasto de A/C, 1,48 no cocho e 1,00 em B.
- Compra de bezerro R$ 3.288,09 (centavos da foto de custos), preço-base do boi R$ 349,50/@; suplemento R$ 5,08/kg; consumo-base 28,4 kg para A e 105,3 kg para B.
- Dieta manual R$ 1,1239/kg MS e consumo 11,14 kg MS/dia. O preço local do milho não substitui automaticamente essa dieta. Ligar o vínculo posteriormente volta ao cenário de custo local.
- Investimento incremental R$ 10.859.939, TMA 12% a.a., horizonte 10 anos. Não é o orçamento de compra da terra nem todo o capital de giro.
- Sem crédito de efluente, prêmio de exportação ou cria própria. C e agricultura mantêm bases distintas: não são resultados comprovados por essas fotos.
- Complementos mantidos, identificados na interface: 7,8 UA/ha de pasto; rendimento 54% com +2 p.p. no cocho; deduções 4%; perdas 0,2% por fase; 2.000 vagas a 90%; silagem 18 t MS/ha/corte, dois cortes, recuperação 88,7%, custo R$ 5.450/ha/corte e 45% da dieta. Estes valores não estão todos demonstrados nas fotografias anexadas.
- Marco 10/09/2026 e capital inicial R$ 30 milhões são convenções do simulador, não fatos da apresentação. Carregar a base mantém o orçamento que o usuário digitou; restaurar tudo repõe R$ 30 milhões. Não elevar o orçamento para fazer A vencer.

## Vacas: receita, custo e margem separados

Na referência são 798 vendidas na janela de 100 ha pós-silagem. A quantidade escala com essa área, sem criar hectares. A janela física e o calendário continuam pendentes de validação.

| Indicador | Por vendida | 798 vendidas |
|---|---:|---:|
| Receita líquida derivada | R$ 5.034,69 | R$ 4.017.682,62 |
| Custo caixa informado | R$ 4.382,82 | R$ 3.497.490,36 |
| Margem caixa | R$ 651,87 | R$ 520.192,26 |

Receita líquida é **derivada**, não cotação independente: custo caixa informado + margem caixa informada. O índice de venda em R$/@ escala essa receita por índice/300; 300 é convenção preexistente. Foram removidos da fórmula o peso de 530 kg, rendimento de 48% e desconto calibrado implícitos: eles não eram evidências independentes do cenário-base.

Dois tratamentos de custo, nunca somados:

1. `reported-per-sold`: interpretação agregada por vendida para reproduzir o orçamento transcrito. Compra e demais custos são editáveis. O slide não esclarece a base de compras/mortalidade; não impor outra perda sobre esse custo sem esclarecer se já está embutida.
2. `purchases-with-losses`: tratamento operacional anterior, com 800 compras equivalentes, 798 vendas e custeio das perdas. Na base resulta em custo R$ 4.393,744461 por vendida e margem R$ 640,945539. Arquivos anteriores continuam nesse modo.

Em ambos, receita e custo já entram uma vez em A. Não somar novamente faturamento ou margem no painel. O rateio por boi exclui as vacas. Custos não caixa continuam no agregado de depreciação do motor; não adicionar a depreciação individual das vacas novamente.

## Reconciliação e resultado do motor

`6.725 × 1.431,98 / 300 = R$ 32.100,22/ha de pasto`, versus R$ 32.261 impresso. O indicador impresso normalizado pelos 400 ha totais é R$ 24.195,75/ha total/ano.

`6.725 × 1.431,98 + 798 × 651,87 = R$ 10.150.257,76`, versus EBITDA resumido de R$ 9.808.729. A diferença de R$ 341.528,76 **não é receita, custo, crédito ou ajuste inserido no cálculo**.

A base nova, com complementos operacionais acima, calcula aproximadamente 6.691,6829 bois vendidos/ano + 798 vacas e margem anual de A **R$ 9.975.902,89**, ou **R$ 24.939,76/ha total/ano**. B: 4.371,24 bois e R$ 7.192.780,40/ano. São margens operacionais de regime pleno, não lucro líquido nem caixa do primeiro ano.

A dura 178 dias de pasto + 95 de cocho = 273 dias por animal. A apresentação arredonda para 272. Mantivemos as taxas e o arredondamento conservador por fase; não adulteramos o GMD para alcançar o dia ou a margem impressa.

## Governança e testes

- Nova versão .7 aceita arquivos legados. Migração estável: ausência de `cowCostBasis` significa tratamento operacional antigo, independentemente do modo da tela atual. Valores inválidos são rejeitados.
- Carregamento reinicia dieta, lotação, forragem presumida, perdas, cocho, reposição de terceiros, calendário e fontes/confirmacões. Não escreve nem remove o armazenamento local. Fica indisponível durante carregamento demonstrativo para evitar sobrescrita assíncrona.
- Origem histórica sem data/praça comprovadas não é marcada como cotação atual. O radar permanece separado; aplicar preço de mercado é uma ação explícita.
- Painel e relatório discriminam receita, custo, margem e método das vacas. CSV inclui esses campos e as limitações da referência, além dos valores atuais do cenário.
- Testes incluem parâmetros com centavos, receita menos custo, delta com vacas ligadas/desligadas, prejuízo, escala de área, custo de compra, índice de venda, preservação do método físico, migração legada, reinício limpo e reconciliação dos totais com os componentes. SSR verifica valores publicados na renderização inicial e ausência da campanha como resultado principal. Não substitui teste visual em aparelhos reais.

## Próximos gargalos

| Prioridade | Lacuna | Impacto | Urgência | Esforço |
|---|---|---|---|---|
| P0 | Planilha original: reconciliar lotação, rendimentos, silagem, vacas e totais | Alto | Antes de chamar a reprodução de exata | Baixo com o arquivo |
| P0 | Janela pós-silagem, água/MS mensal e orçamento local de alimentação | Alto | Antes da execução/investimento | Médio–alto |
| P0 | Caixa de implantação, dívida/tributos e CAPEX executivo | Alto | Antes de comprometer capital | Alto |

O calendário agronômico preexistente ainda não foi adaptado à Fazenda Barra Velha em Correntina nesta rodada. A versão não certifica a janela das vacas, a sucessão agrícola ou a disponibilidade hídrica local.
