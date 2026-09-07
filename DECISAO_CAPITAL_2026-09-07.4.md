# BoiMeta — caixa, lotação e alavancas de margem

## Entrega

Em Resultado → O que muda a decisão, três estudos com as premissas atuais:

1. **Mesmo capital:** área máxima financiável e escala de maior margem entre as testadas; as sete alternativas são exclusivas. Não somar suas margens.
2. **Alavancas de margem:** preços, compra da reposição, GMD, dieta/milho, produtividade agrícola e custos. Melhoria e pressão separadas, uma variável por vez; efeitos não somáveis.
3. **Lotação e área:** desejo e aplicação de UA por hectare de pasto, suporte de matéria seca, cabeça média potencial/roteada e redistribuição pasto/silagem mantendo a área e o cocho.

O destaque geral considera ocupar a área inteira. O estudo por orçamento pode operar menos hectares; portanto seu líder pode ser diferente. Margem é anual em regime pleno, antes de financiamento/depreciação e custos ausentes. Não é lucro líquido, retorno sobre patrimônio ou caixa do primeiro ano.

No confinamento, a melhor divisão testada vem acompanhada da comparação A/B e A/C, preço de indiferença do boi gordo e capital requerido. Não é previsão de preço. Relações magro/gordo, bezerro e milho podem variar conjuntamente no mercado; aqui ficam constantes para isolar um efeito.

## Reproduções numéricas

### Base da imagem: 220 ha, 10 UA/ha de pasto

Entradas240 kg, decisão399,999 kg, saída540 kg; GMD recria0,9, B1,0, cocho1,48; mortalidade0,2% por fase; 2.000 vagas ×90%; boiR$349,50/@, magroR$12,50/kg vivo líquido, reposiçãoR$3.288; milho entregueR$65/sc; dieta11,14 kgMS/d,45% volumoso, complementoR$0,6864/kgMS. Rendimento54% +2p.p. no cocho, deduções4%, vacas ligadas. Não há prêmio de preço de exportação. Campo adicional do pasto0: ainda não orçado.

| Configuração | Silagem | Margem A anual | Diferença A−C |
| --- | ---: | ---: | ---: |
| Base | 25% | R$3.947.739 | −R$3.098.467 |
| Reequilíbrio de área | 30,1% | R$5.184.941 | −R$1.861.265 |
| Hipótese GMD1,84 e milhoR$55/sc | 25,8% | R$7.408.582 | +R$362.376 |

C permaneceR$7.046.206. B a preço-baseR$5.703.603. Com30,1%silagem, manter magro12,50 e demais custos faz A=C em aproximadamenteR$371,27/@ de gordo. É indiferença aritmética, sem forecast. A configuração1,84/R$55 mantém o mesmo consumo, o que precisa ser comprovado em dieta/campo. Seu capital requerido excedeR$27mi, incluindoCAPEX incrementalR$10.859.939; a pequena vantagem anual não demonstra retorno suficiente ao investimento.

### R$6mi na base de400ha e7,8UA/ha

Base econômica acima, alterando área e lotação. Sem reserva, implantação ou CAPEX comum adicionais:

| Alternativa | Máximo financiável |
| --- | ---: |
| A com novo cochoR$10.859.939 | 0ha |
| B | 132ha |
| C | 122ha |
| Soja | 400ha |
| Milho | 400ha |
| Algodão | 387ha |
| Soja+milho em sequência | 400ha |

A soja pode financiar o milho depois da venda. O capital necessário considera o pico datado, não simplesmente a soma dos custos anuais. A área equivalente agrícola não concede hectares, água ou pivôs além da fazenda. O CAPEX da pecuária não é descontado novamente da verba agrícola.

## Regras auditadas

- Busca em hectares inteiros: até21 escalas regulares, mais pontos próximos à saturação do cocho; não ótimo global. Divisão de silagem do ponto de virada5–80% a cada0,1p.p.; tabela de lotação a cada1p.p.; incluem a divisão informada.
- CAPEX não diminui proporcionalmente com a área. Não operar evita o novo investimento, mas paga o arrendamento conhecido; manutenção ociosa adicional não foi inventada.
- Mostrar operações negativas mesmo se a alternativa de não operar as superar.
- Equilíbrio de venda inclui arrendamento de hectares ociosos. Datas agrícolas parciais/invertidas/impossíveis são inválidas; sequência dupla não pode superar365dias entre primeiro plantio e última colheita.
- Margens agrícolas usam deduções de venda uma vez. Não há venda e consumo simultâneo do mesmo milho neste quadro: A compra milho entregue; produção própria/estoques permanecem na alocação avançada.
- UA incide diretamente no pasto: A300ha×10UA=3.000UA, não2.250. B/C400ha×10UA=4.000UA. Cabeças dependem do peso, e cocho não é pastagem.
- O adicional de intensificação é custo por hectare de pasto, antes do fator de custeio. Não aumenta GMD ou produção de capim automaticamente. Cenários antigos carregam adicionalzero em vez de herdar o campo da tela atual.
- CSV exporta premissas, resultados por capital, inversa, sensibilidades, lotação e indiferença. JSON continua sendo o formato de restauração.

## Fontes e limites

- [Embrapa2012: UA e suporte sazonal](https://cloud.cnpgc.embrapa.br/sac/2012/09/14/qtos-animais-posso-colocar-em-1-hectare-de-pasto-para-animais-de-corte/): UA450kg; referência de15UA se refere ao verão, com adubação, irrigação e rotação. Não valida média anual nem a fazenda.
- [Embrapa2025: balanço hídrico e culturas forrageiras](https://www.infoteca.cnptia.embrapa.br/infoteca/handle/doc/1174002): manejo depende de clima, evapotranspiração e coeficientes de cultura; irrigação não garante capacidade universal.
- Caso histórico fornecido em fotos: R$32.261 é margem caixa/ha de **pasto**. Em400ha totais com300pasto equivale aR$24.195,75/ha total. B R$16.873 é margem após custos não caixa; sua margem caixa fotografada éR$18.292/ha. Não misturar métricas ou usar como meta para calibrar lucro.
- Preços desta auditoria são premissas de reprodução, não cotações atuais consultadas. CONAB/futuros permanecem nas camadas datadas próprias, sem aplicação automática de projeções.

## Prioridades seguintes

| Prioridade | Lacuna que muda a decisão | Impacto | Urgência | Esforço |
| --- | --- | --- | --- | --- |
| P0 | Produção mensal de MS, custo de adubação/energia e desempenho local vinculados à lotação | Alto | Antes de investir | Médio/alto: campo |
| P0 | Orçamento executivo do cocho, implantação, capital de giro e fluxo plurianual comparável A/C | Alto | Antes de novo CAPEX | Alto |
| P1 | Estresse conjunto reposição/magro/gordo/milho, com séries locais e validação fora da amostra | Alto | Próxima rodada | Alto |
| P1 | Testes presenciais de leitura, navegação e gestos em aparelhos reais | Médio | Antes de ampliar uso público | Médio |

Verificação desta rodada: testes numéricos, migração, tipagem, lint, renderização React em servidor, compilação e PWA. Não houve inspeção visual nem teste de gestos em navegador/aparelho físico nesta rodada. Nenhuma auditoria demonstra ausência absoluta de erros.
