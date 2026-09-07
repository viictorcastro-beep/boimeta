# Auditoria — versão 2026-09-06.1

Esta rodada combina revisão do responsável e duas revisões independentes somente leitura. Não é certificação de campo nem auditoria financeira independente.

| Camada | Correção / verificação |
|---|---|
| 1. Área | Zero hectares e 100% de silagem não criam hectare fictício de pasto. |
| 2. Custo fixado | R$ 1,09 milhão/ano de silagem permanece como custo no caso-base mesmo sem gado. |
| 3. Tempo do alimento | Estoque anterior é reconhecido; recebimento e consumo são reconciliados diariamente e apresentados por semana. |
| 4. Pico financeiro | Compra de R$ 6 milhões dia 1 e venda de R$ 7 milhões dia 30 exigem R$ 6 milhões de financiamento, mesmo no mesmo mês. |
| 5. Implantação | Estrutura existente zero gera o CAPEX integral; ausência de informação é tratada separadamente. |
| 6. Carcaça | Prêmio do confinamento agora chega às projeções datadas; não modifica a receita do animal terminado no pasto. |
| 7. Governança | Ranking nominal não herda pré-validação de outra rota; dieta manual e alocação por ingredientes são distinguidas. |
| 8. Segurança | CSV neutraliza fórmulas; JSON valida forma, números, limites, URLs e versão. Datas de lotes sobrevivem ao compartilhamento. |
| 9. Mercado | Fonte CONAB compartilhada entre API e publicação estática, preservando datas, falhas parciais e último arquivo válido. |
| 10. Publicação | Build estático separado preserva o alvo Sites; workflow automatiza testes e publicação; pacote público sem histórico privado. |

## Testes

- Suíte histórica `test:model`, com regressão adicional do rendimento por rota.
- Suíte `test:regression`: estoque anterior, colheita tardia na semana, compra desligada, recebimento na saída, pico intramês, CAPEX inicial, área zero, silagem ociosa, TIR indefinida, validade de preços/datas, resposta parcial, CSV e importação.
- Lint, TypeScript e builds dos dois alvos.
- Verificação HTTP da página e dos arquivos de mercado.
- Não houve teste manual em navegador nem validação de campo nesta rodada.

## Pontos ainda relevantes, por impacto / urgência / esforço

Rodada adicional BoiMeta/app: navegação inferior, formulário recolhível, margem durante ajustes, campos sem clamp durante digitação, nomes acessíveis nos sliders, alvos de toque, tabelas com rolagem por teclado, safe-area e movimento reduzido. PWA com manifest/ícones, cache por versão e escopo, operação offline com datas preservadas e atualização por escolha do usuário. Testes adicionais verificam cache, fallback, isolamento e artefatos; não equivalem a testes visuais em aparelhos.

1. **Alto / alta / alto — caixa pecuário datado e implantação.** O giro pecuário ainda contém aproximações. Não converter margem anual em retorno do primeiro ano nem alocar todo capital à compra de animais.
2. **Alto / alta / alto — integração temporal dentro da otimização.** O diagnóstico diário existe, mas compras adicionais antes da safra e estoque futuro residual ainda exigem conciliação econômica; a pré-validação é suspensa nesses casos. O simulador continua rodando hipóteses.
3. **Alto / média / alto — dieta completa e efluente líquido.** Necessários nutrientes, matéria seca de cada ingrediente e fertilizante efetivamente substituído. O crédito bruto por m³ não é lucro automaticamente.
4. **Alto / média / alto — reposição e curvas licenciadas.** Preço de bezerro/boi magro é diferente do boi gordo. CONAB é observação semanal, não curva futura. Sem histórico calibrado, não oferecer probabilidades ou previsão de preço máximo/mínimo.
5. **Médio / média / médio — interface e desempenho.** O arquivo inicial ainda concentra módulos e gráficos. Divisão por abas e teste visual responsivo são a próxima melhoria técnica.

Não se declarou a eliminação de todos os bugs. Os testes cobrem os critérios descritos; cenários novos e dados importados continuam sujeitos a limites e revisão.
