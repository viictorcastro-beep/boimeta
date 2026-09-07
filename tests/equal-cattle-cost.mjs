import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { equalCattleCost } from '../lib/equal-cattle-cost.ts';
import { photoReferenceAssumptions } from '../lib/photo-reference.ts';
import { calculateCore } from '../lib/livestock-model.ts';

const near=(a,b)=>assert.ok(Math.abs(a-b)<0.01,`${a} vs ${b}`);
const a=photoReferenceAssumptions(), snapshot=structuredClone(a), study=equalCattleCost(a);
const row=(s,route)=>s.rows.find(r=>r.route===route);
assert.equal(study.error,null);
assert.deepEqual(a,snapshot,'estudo não muda o cenário');
near(study.target,21318670.966);
near(row(study,'B').margin,7192780.400912002);
near(row(study,'A').area,238.1482868000279);
near(row(study,'A').margin,5629653.215619873);
near(row(study,'A').operatingReserve,13496548.695687462);
near(row(study,'B').operatingReserve,18175632.37);
for (const p of [{},{stockingUa:10,gmdFeedlot:1.5},{silageShare:40},{landLeaseHa:1000},
  {priceArroba:0},{gmdPivotA:0.4,gmdB:0.4},{totalArea:550},{totalArea:1050},
  {totalArea:1050,otherCostFactor:0},{includeCows:true},{feedlotCapacity:100}]) {
  const x={...a,...p}, s=equalCattleCost(x), r=row(s,'A');
  assert.ok(r,'configuração válida deve apresentar escala A');
  near(r.pasture+r.silage,r.area);
  near(r.revenue-r.cost,r.margin);
  assert.ok(r.cost<=s.target+0.01);
  if(!s.error) near(r.cost,s.target);
  assert.ok(r.feedlotOccupancy<=x.feedlotCapacity*x.feedlotUtilization/100+1e-6);
  const core=calculateCore({...x,totalArea:r.area,includeCows:false});
  near(core.soldA,r.sold);
  near(core.cashCostsA,r.cost);
  near(core.netRevenueA,r.revenue);
  if(x.priceArroba===0) assert.ok(r.margin<0,'não apagar prejuízo');
}
const limited=equalCattleCost({...a,totalArea:1050});
assert.match(limited.error,/cocho atual limita/);
near(row(limited,'A').area,412.5693348365276);
assert.ok(row(limited,'A').costGap < -19000000,'orçamento não usado permanece visível');
assert.equal(row(limited,'A').bottleneck,'vagas-dia de cocho');
for(const patch of [{totalArea:0},{stockingUa:0},{gmdB:0},{gmdPivotA:0},{feedlotCapacity:0},
  {feedlotCapacity:undefined},{silageShare:0},{silageShare:100},
  {pastureMortalityPercent:100},{feedlotMortalityPercent:100},
  {pastureExtraCostHa:-1},{calfCost:NaN},{dietPriceDm:Infinity},{feedlotUtilization:101}]) {
  assert.ok(equalCattleCost({...a,...patch}).error,'dados inválidos não recebem conclusão: '+JSON.stringify(patch));
}
const capitalChanged=equalCattleCost({...a,investment:50000000,pivotInvestment:20000000,discountRate:35,horizon:20});
assert.deepEqual(capitalChanged.rows,study.rows,'CAPEX/TMA não são custos operacionais; reserva exclui CAPEX');
assert.deepEqual(equalCattleCost({...a,includeCows:true,cowBuyCost:9000}).rows,study.rows,'nenhum lote de vacas nem crédito');
assert.deepEqual(equalCattleCost({...a,includeEffluentSavings:true,effluentValueM3:100}).rows,study.rows,'crédito de efluente não é transferido para outra área sem medição');
assert.equal(row(equalCattleCost(a,'inválida'),'A').operatingReserve,null,'data inválida não produz reserva datada');
// A pode exigir mais área que B: não travar no tamanho informado nem criar cocho.
const large=equalCattleCost({...a,dietPriceDm:0.01,calfCost:10,gmdB:3,feedlotCapacity:20000});
assert.equal(large.error,null);
assert.ok(row(large,'A').area>a.totalArea);
near(row(large,'A').extraArea,row(large,'A').area-a.totalArea);
const source=readFileSync(new URL('../app/page.tsx',import.meta.url),'utf8');
assert.match(source,/equalCattleCost\(modelAssumptions, animalTimelineInputs.entryDate\)/);
assert.match(source,/MESMO CUSTEIO ANUAL · A\/B com áreas independentes/);
assert.match(source,/<EqualCattleCostPanel study=\{equalCostStudy\} report/);
console.log('Mesmo custeio: inversa, conservação física, saturação, caixa, prejuízo, independência de área/CAPEX e CSV aprovados.');
