import { defaultAssumptions, type Assumptions } from './livestock-model.ts';

/** Escopo da operação ativa. Preserva a fonte/arquivo histórico e não cria crédito. */
export function withoutOpportunityCows(a: Assumptions): Assumptions {
  return { ...a, includeCows: false };
}

/** Transcrição não é calibração de resultados. Lacunas permanecem hipóteses. */
export function photoReferenceAssumptions(): Assumptions {
  return { ...defaultAssumptions, totalArea: 400, silageShare: 25,
    entryWeight: 240, pivotExitWeight: 400, saleWeight: 540,
    gmdPivotA: 0.9, gmdFeedlot: 1.48, gmdB: 1,
    priceArroba: 349.5, calfCost: 3288.09, supplementPrice: 5.08,
    dietPriceDm: 1.1239, dietDmDay: 11.14, linkFeedToCropCosts: false,
    includeCows: false, cowBuyCost: 3673.33, cowSaleArroba: 300,
    cowCostBasis: 'reported-per-sold', includeEffluentSavings: false,
    effluentArea: 50, effluentDepthMm: 150, investment: 10859939,
    discountRate: 12, horizon: 10,
    pastureMortalityPercent: 0.2, feedlotMortalityPercent: 0.2,
    feedlotCapacity: 2000, feedlotUtilization: 90,
    otherIngredientSharePercent: 0 };
}

export const photoParameterNotes = [
  ['Área', '400 ha: 300 de pasto + 100 de silagem', 'Foto', 'B utiliza os 400 ha como pasto.'],
  ['Pesos', '240 → 400 → 540 kg', 'Foto', 'A: recria seguida de cocho. B: 240 → 540 kg no pivô.'],
  ['GMD A / cocho / B', '0,90 / 1,48 / 1,00 kg/dia', 'Foto', 'Dias calculados a partir do ganho, arredondados para cima; não são fixados para atingir uma margem.'],
  ['Bezerro / boi gordo', 'R$ 3.288,09/cab / R$ 349,50/@', 'Fotos', 'Referência histórica; data da cotação e praça não comprovadas. Não é preço de hoje.'],
  ['Dieta do cocho', '11,14 kg MS/dia × R$ 1,1239/kg MS', 'Foto', 'Dieta manual: milho local não substitui o preço ao carregar esta base.'],
  ['Suplemento', 'R$ 5,08/kg; A 28,4 kg; B 105,3 kg no período-base', 'Fotos', 'O consumo é ajustado pela duração calculada da fase.'],
  ['Escopo da operação', 'Somente bois; sem lote de vacas pós-silagem', 'Escolha do projeto', 'Receita, custo, margem e necessidade de capital desse lote são excluídos. Dinheiro não comprometido não é receita nem crédito adicional.'],
  ['Lotação média', '7,8 UA/ha de pasto', 'Hipótese complementar', 'Parâmetro preexistente do motor, não comprovado nestas fotos. A área de silagem não reduz a UA/ha digitada.'],
  ['Rendimento / deduções', '54% no pasto; +2 p.p. no cocho; 4% de deduções', 'Hipóteses complementares', 'Não confundir com premissas integralmente documentadas pela apresentação.'],
  ['Perdas e cocho', '0,2% em cada fase; 2.000 vagas × 90%', 'Hipóteses complementares', 'Limites explícitos do cálculo operacional dos bois. Não há vagas ilimitadas.'],
  ['Silagem', 'R$ 5.450/ha/corte; 18 t MS/ha/corte; 2 cortes; 88,7% recuperação; 45% da dieta', 'Hipóteses complementares', 'Mantidas do modelo; estas fotos não apresentam todo o balanço alimentar. Toda a área é custeada.'],
  ['Investimento / TMA / horizonte', 'R$ 10.859.939 / 12% a.a. / 10 anos', 'Resumo', 'Investimento incremental, não compra da terra nem todo o capital de giro.'],
  ['Capital e calendário', 'Orçamento editável; marco inicial 10/09/2026', 'Convenções do simulador', 'Não são valores comprovados pela apresentação. A base pode exceder o capital informado.'],
] as const;

export const photoReferenceLimit = 'As fotos não fecham todos os totais: a diferença de R$ 341.528,76 entre a soma das margens unitárias e o EBITDA do resumo não entra como receita, custo ou ajuste. R$ 32.261/ha de pasto corresponde a R$ 24.195,75/ha total/ano; não é alvo imposto ao motor.';
