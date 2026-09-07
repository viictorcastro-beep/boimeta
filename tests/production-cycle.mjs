import assert from 'node:assert/strict';
import { defaultAssumptions, calculateCore } from '../lib/livestock-model.ts';
import { rearingOnly } from '../lib/rearing-model.ts';
import { productionCycles } from '../lib/production-cycle.ts';
import { closeCampaign } from '../lib/closed-campaign.ts';
const a = { ...defaultAssumptions, totalArea: 400, stockingUa: 10, pivotExitWeight: 399.999,
  gmdPivotA: 0.9, gmdB: 0.9, gmdFeedlot: 1.6, dietPriceDm: 1.5170909996242017,
  feedlotCapacity: 2000, feedlotUtilization: 90, includeCows: false,
  pastureMortalityPercent: 0.2, feedlotMortalityPercent: 0.2 };
const near = (x, expected, label) => assert.ok(Math.abs(x - expected) < 0.01, `${label}: ${x} vs ${expected}`);
const rows = productionCycles(a, 12.5);
for (const [i, days, margin, perHead] of [[0,266,8370941.998560,1158.772147],[1,334,8594372.679139,1707.376679],[2,178,12811283.319484,1112.925330]]) {
  assert.equal(rows[i].cycleDays, days, 'duração do animal, sem mais364dias');
  near(rows[i].annualMargin, margin, 'mesmos parâmetros do texto fornecido');
  near(rows[i].marginPerSold, perHead, 'rateio por vendido');
}
for (const patch of [{}, {landLeaseHa: 1000}, {includeCows:true}, {feedlotCapacity:0},
  {pastureMortalityPercent:100}, {feedlotMortalityPercent:100}, {priceArroba:0},
  {gmdPivotA:0.3,gmdB:0.3}, {otherCostFactor:130}, {silageShare:0}]) {
  const p = {...a,...patch}; const core = calculateCore(p); const rear = rearingOnly(p,12.5);
  const expected = [core.ebitdaA,core.ebitdaB,rear.margin];
  for (const [i,r] of productionCycles(p,12.5).entries()) {
    near(r.annualMargin,expected[i],'motor anual preservado');
    near(r.costLines.reduce((s,l)=>s+l.total,0),r.annualCost,'memória soma todos os custos');
    if (r.sold>0) near(r.marginPerSold*r.sold+r.extraCowMargin,r.annualMargin,'ponte cabeça/ano sem multiplicarporgiro');
    else { assert.equal(r.costPerSold,null); assert.equal(r.marginPerSold,null); }
  }
}
const lease = productionCycles({...a,landLeaseHa:1000},12.5);
const blended = productionCycles({...a,calfCost:2500},12.5,3288);
near(blended[2].annualMargin,rows[2].annualMargin,'C preserva compra de terceiros mesmo se A/B usam mistura de reposição');
near(blended[2].costLines.reduce((s,l)=>s+l.total,0),blended[2].annualCost,'memória C preserva preço não misturado');
near(lease[0].marginPerSold,1103.400976,'arrendamento incluído no rateio de A');
near(lease[1].marginPerSold,1627.911813,'arrendamento incluído no rateio de B');
const campaign = closeCampaign({a,anchor:'2026-09-10',gateNetPrice:12.5,setupDays:0,setupCost:0,reserveCash:0,
  openingSilageTonnesDm:0,silageFirstReleaseDays:150,silageCutIntervalDays:180},'A').result;
assert.equal(campaign.elapsedDays,630);
near(campaign.margin,6161155.8239,'estudo opcional continua identificado');
near(rows[0].annualMargin-campaign.margin,rows[0].annualPastureCost*(630-365)/365,'diferença de custeio da cauda, não preço alterado');
assert.equal(productionCycles({...a,gmdPivotA:0.4},12.5)[0].cycleDays,488,'ciclo longo não vira um ano');
assert.equal(productionCycles({...a,gmdPivotA:0},12.5)[0].valid,false);
console.log('Ciclo/ano: reprodução do caso, custos, perdas, arrendamento, rateio, extras e período longo aprovados.');
