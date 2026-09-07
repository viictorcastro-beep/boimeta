# Preenchimento objetivo — 2026-09-07.3

## Fluxo entregue

**Seu cenário → Resultado → Mercado → Validações → Relatório.** As funções especializadas continuam em Estudos detalhados. Não houve recalibração dos preços, custos, produtividades ou fórmulas para alterar o vencedor.

O painel de entrada está organizado em cinco grupos, com apenas o primeiro aberto. Área, capital e data são as três entradas inicialmente expostas. Os demais valores vêm da base ou do cenário carregado, não de uma validação local implícita.

| Grupo | Conteúdo |
| --- | --- |
| Fazenda e capital | Área, orçamento do projeto, data-base e arrendamento opcional |
| Gado e desempenho | Compra do bezerro, venda do magro e do gordo; pesos, GMD, lotação e suplemento nos detalhes |
| Alimentação e cocho | Silagem, vagas, milho comprado entregue, dieta; custos/composição nos detalhes |
| Lavouras irrigadas | Preço de venda e produtividade por cultura; acesso ao orçamento de cultivo |
| Investimentos e extras | CAPEX do pivô/cocho, TMA, prazo e hipóteses opcionais de vacas/efluente |

Recolher um grupo não desliga sua premissa. Resumos mostram os valores e indicam quando vacas ou efluente hipotético estão incluídos. Desligar a dieta calculada revela o custo manual; desligar vacas/efluente preserva seus parâmetros, mas não os aplica.

## Correções de consistência e usabilidade

- Removidos editores repetidos de capital, pesos, magro, vagas, milho entregue e preço/produtividade agrícolas. Nos estudos, o valor fica legível e o atalho leva ao campo central.
- Pesos usam as funções que sincronizam a premissa física e a linha do tempo; capital usa a função que renova as confirmações operacionais. A duplicação anterior permitia caminhos distintos de edição.
- Os atalhos de edição abrem também detalhes internos e direcionam o foco ao campo pedido.
- Preço de milho vendido continua separado de milho comprado entregue, custo próprio e oportunidade de venda. São grandezas econômicas diferentes.
- Capital disponível não foi confundido com reserva livre, preparação, CAPEX, custeio ou receita. Essas parcelas continuam separadas nas validações e nos relatórios.
- Resultado mostra primeiro a leitura econômica e a tabela comparativa. A memória física extensa fica recolhida; capacidade presumida/limitada e acesso às validações continuam visíveis.
- Ausência de alternativa no orçamento, prejuízos e faixa de indiferença têm explicações próprias; a interface não os descreve como aprovação de investimento.
- Mercado ganhou uma aba própria. O componente permanece montado quando oculto para preservar o mecanismo de atualização e a evidência usada no cenário. Consultar não aplica preços automaticamente.
- Cabeçalho reduzido, navegação principal com quatro destinos, controles com rótulos acessíveis e leitura de resumos por leitor de tela. O resultado fixo do editor é restrito ao desktop para não se sobrepor à navegação móvel.
- Mantidos formato pt-BR, proteção contra alteração por rolagem/toque e compatibilidade de importação com as versões anteriores aceitas.

## Validação realizada

Testes de modelo, regressão, decisão, mercado, negócio e controles; renderização React em servidor; checagem de tipos, lint, build de publicação e integridade PWA. A suíte de renderização verifica grupos iniciais, editor único das premissas básicas, navegação sem escrita de valores e permanência dos alertas. O workflow de publicação repete as verificações.

Esses testes não demonstram usabilidade em aparelhos reais. Não houve nova automação visual/de gestos nesta rodada. O cálculo mantém suas limitações documentadas: regime pleno não é lucro líquido nem caixa do primeiro ano; pasto presumido não comprova suporte; tendência observada não garante preço futuro.

## Próximas lacunas por prioridade

| Próxima melhoria | Impacto | Urgência | Esforço |
| --- | --- | --- | --- |
| Testar três tarefas com produtor em celular físico: editar peso, comparar capital e aplicar preço datado; medir erros e tempo até o resultado | Alto | Alta | Baixo |
| Agrupar os pré-requisitos de Validações por impedimento real e oferecer atalho ao campo exato, evitando leitura longa para corrigir uma única pendência | Alto | Média | Médio |
| Reunir a procedência dos valores alterados em uma revisão curta antes de salvar/exportar, distinguindo base, dado local e referência aplicada | Alto | Média | Médio |

Estas lacunas não foram apresentadas como funcionalidades concluídas.
