# Fechamento da campanha — modelo 2026-09-07.5

## O que mudou

O resultado inicial agora acompanha a compra do bezerro até a última venda, sem cortar animais ou despesas aos 365 dias. A base produtiva e novos cenários não compram vacas de oportunidade. Cenários anteriores conservam os valores salvos; há aviso e botão para excluir vacas também dos estudos anuais. O fechamento novo sempre exclui vacas e crédito de efluente.

Não houve calibração para forçar R$ 32 mil/ha. As fotos fornecidas registram R$ 32.261 de margem de caixa anual por hectare de pasto em 300 ha, com outros 100 ha destinados à silagem. Isso equivale a R$ 24.195,75/ha TOTAL/ano. Os R$ 16.873 da rota B já descontavam depreciação, enquanto sua margem de caixa era R$ 18.292. Esses indicadores não podem ser comparados sem alinhar custo, período e área. A divergência entre resumo e valores unitários da apresentação permanece identificada no estudo histórico.

## Método auditável

- Campanha finita: 365 coortes diárias equivalentes; compras apenas nos offsets 0 a 364 após a implantação/ajuste alimentar. Não é um lote inteiro simultâneo nem repetição indefinida.
- Cada animal segue seu peso/GMD. A: recria + confinamento. B: entrada ao peso final com o GMD próprio do ciclo no pivô. C: recria e venda líquida do magro.
- Na base 240 → 400 → 540 kg, GMD 0,90/1,48: 178 dias de recria + 95 dias de cocho = 273 dias/animal. Sem implantação, a campanha A termina no dia 637. Eventos incluem o dia zero; custeio da área tem 637, não 638 diárias.
- No teste GMD do pasto 0,40: A tem 495 dias/animal e termina no dia 859; B tem 750 e termina no dia 1.114; C tem 400 e termina no dia 764. Não há venda no primeiro ano nesses exemplos, mas todos os sobreviventes são vendidos no fechamento.
- Cabeças compradas = vendidas + perdas por fase; estoque animal final zero, salvo arredondamento numérico. Perdas são hipóteses estatísticas no fim da fase, não prognóstico individual.
- UA = 450 kg vivos, com peso no fim de cada dia. Cocho limitado pelas vagas úteis. A entrada é reduzida ANTES da receita se exceder UA, vagas ou estoque acumulado de silagem. Capacidade informada não é medição de campo.
- Sem alimento inicial suficiente, procura-se o menor atraso inteiro de compra que permite o primeiro cocho após a disponibilidade do primeiro corte. Os demais déficits datados reduzem a escala; não se compra alimento fictício nem se inventam colheitas. O atraso não é uma otimização global de lucro.
- Estoque inicial pode substituir produção nova; valorado pelo custo local por kg MS. Um programa de cortes inteiros, sem safras fracionadas ou repetição automática durante a cauda. Cortes posteriores ao encerramento são identificados, não executados nem custeados. Cortes dentro do período têm seu orçamento integral reservado no início. Sobra final não é receita.
- Milho e ingredientes não volumosos são custeados por reposição na dieta. Não há hectares externos implícitos nem venda do mesmo alimento consumido. O custo do volumoso é retirado da dieta consumida e pago no programa de silagem, uma única vez.
- Suplemento diário segue a referência existente, escalado pelos dias; não é reformulação nutricional automática por peso.

## Economia e caixa

Margem da campanha = receita líquida das vendas − custos operacionais da campanha.

Margem/ha da campanha = margem / área TOTAL reservada. A inclui pasto e silagem.

Equivalente anual = margem × 365 / dias decorridos. Não é margem estabilizada, projeção de reinvestimento, TIR ou lucro líquido. Não ordenar margens acumuladas de campanhas com durações diferentes como se tivessem o mesmo horizonte.

Manutenção da área e arrendamento são apropriados linearmente por todo o período, inclusive implantação, formação do fluxo e encerramento. A área ociosa continua custeada. Os custos variáveis seguem as cabeças que entram em cada fase; as perdas no pasto não consomem cocho.

CAPEX/implantação sai do caixa uma vez, fora da margem operacional. Capital exigido = maior déficit acumulado + reserva. Pagamentos precedem recebimentos no mesmo dia para não ocultar necessidade intradiária. Reserva não é despesa. Não se aplica o piso do modelo de compras contínuas a uma campanha que já parou de comprar.

Não desconta depreciação, juros de financiamento ou tributos sobre o resultado da margem operacional. TMA não muda o resultado nominal. Preços constantes são uma hipótese do cenário, não previsão para as datas futuras. Futuros/notícias não extrapolam automaticamente o preço deste fechamento.

A agricultura e a pecuária em operação contínua permanecem na seção anual separada. Comparar lavouras diretamente à campanha exige o mesmo horizonte e safras realmente programadas; não acrescentar 1,75 safra por simples regra de três.

## Verificação

`tests/closed-campaign.mjs`: fechamento A/B/C, compras finitas, ciclos longos, mortalidade, custo por fase, caixa final, capital, reserva, CAPEX, preços zero, estoque inicial sem cortes, atraso com estoque parcial, cortes fora do período, picos físicos, matéria seca e entradas inválidas. Removido o corte silencioso após 161 semanas do plano alimentar; teste de 1.400 dias reconcilia 14.000 kg MS. Removido o piso oculto de GMD 0,05 no núcleo: 0,04 calcula 4.000 dias de recria.

As contraprovas históricas dos testes explicitam vacas ligadas; os novos testes exigem base sem vacas. SSR verifica o painel, períodos, avisos e preservação da comparação anual. Não houve teste de gestos ou certificação em aparelhos físicos nesta rodada.

CSV exporta método, datas, receitas/custos, denominadores, animais, balanços, cortes e caixa mensal. Relatório apresenta a campanha e a memória física. Fontes das premissas: dados já informados no simulador e fotos fornecidas pelo usuário; não são dados locais auditados só por constarem na aplicação.

## Memória para conferência técnica

Em Resultado, abrir **Memória de cálculo · premissa → fórmula → resultado**. O relatório também apresenta essa memória expandida. A sequência mostra área/UA/peso médio, duração por peso/GMD, capacidade e fração aplicável, mortalidade, rendimento de carcaça, deduções de venda, consumo da dieta e o fechamento completo.

Cada componente de custo informa quantidade, unidade, custo unitário, produto e origem/fórmula. A soma é testada contra o custo do motor. Custeio de pasto/irrigação, fretes, sanidade, suplemento e operação de cocho ainda carregam referências agregadas, explicitadas na tela: não são declarados custos auditados do Grupo Mizote. A composição local da dieta/lavouras e documentos de origem continuam necessários para substituir benchmarks. O CSV inclui essa tabela e os parâmetros usados, sem arredondamento interno.

## Próximos gargalos

| Prioridade | Lacuna | Impacto / urgência / esforço |
|---|---|---|
| P0 | Calibrar calendário para Correntina, não Barra, e validar água/forragem mensal | Alto / antes de implantar / médio |
| P0 | Fechar orçamento executivo, dívida, tributos e início real de lotes | Alto / antes de investir / alto |
| P1 | Unificar culturas e pecuária em horizonte comum, com rotação e estoque, sem multiplicar safras | Alto / próxima análise de mix / alto |
| P1 | Curva datada de compra/venda e estresse conjunto, distinguindo observação de cenário | Alto / antes de travar margens / alto |
| P1 | Revisar ganhos muito baixos no alocador avançado (piso 0,05 ainda fora do núcleo) | Médio / antes de usar esses casos-limite no alocador / médio |

O fechamento não certifica ausência de todos os erros na plataforma. A conta evidencia quando uma margem desejada não fecha e não transforma duração adicional em rentabilidade garantida.
