'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../core.js');
const curriculum=require('../curriculum.js');
const assessment=require('../assessment.js');

class MemoryStorage{
 constructor(){this.values=new Map()}
 getItem(key){return this.values.has(key)?this.values.get(key):null}
 setItem(key,value){this.values.set(String(key),String(value))}
 removeItem(key){this.values.delete(String(key))}
}
function withStorage(fn){
 const previous=globalThis.localStorage;
 const store=new MemoryStorage();
 globalThis.localStorage=store;
 try{return fn(store)}
 finally{if(previous===undefined)delete globalThis.localStorage;else globalThis.localStorage=previous}
}
function setupPrereqs(store,end=5){
 store.setItem('csai2104_diag_v4',JSON.stringify({w1:true,ep:50,integrity:85}));
 store.setItem('csai2401_w1_lab_complete','true');
 for(let n=1;n<=end;n++){
  const result=core.recordLegacy(n,{source:'test-fixture'},store);
  assert.equal(result.ok,true,'fixture week '+n);
 }
}
function gatePack(week,scenario){
 const gate=curriculum.byWeek[week].gate;
 if(!gate)return null;
 return Object.fromEntries(gate.requiredEvidenceTags.map((tag,i)=>[tag,{
  statement:'ข้อพิสูจน์เชิงวิศวกรรมที่ต้องตรวจรับรองโดยผู้สอน สำหรับหัวข้อ '+tag+' #' +i,
  sourceId:scenario.evidence[i%scenario.evidence.length].id
 }]));
}
function answer(week,attempt,scores,store){
 const active=core.load(store).attempts['w'+week];
 const scenario=assessment.scenarioData(week,active.scenarioId);
 scores.forEach((score,idx)=>{
  const step=scenario.steps[idx];
  const option=step.options.find(o=>o.score===score);
  assert.ok(option);
  const refs=[scenario.evidence[0].id,'limitation:ยังมีความเสี่ยงคงเหลือต้องตรวจสอบ'];
  const pack=idx===2?gatePack(week,scenario):undefined;
  const result=core.submitStep(week,attempt,idx,option.id,score,refs,store,pack);
  assert.equal(result.ok,true,'step '+idx+' should persist: '+result.reason);
 });
}

test('curriculum keeps 15 weeks, 30 scenarios and consistent option/evidence references',()=>{
 const check=curriculum.validate();
 assert.equal(check.ok,true,JSON.stringify(check.errors));
 assert.equal(curriculum.weeks.length,15);
 assert.equal(curriculum.weeks.reduce((sum,w)=>sum+w.scenarios.length,0),30);
 assert.equal(curriculum.weeks.reduce((sum,w)=>sum+w.scenarios.reduce((s,sc)=>s+sc.steps.length,0),0),90);
});

test('Mission Control uses working W6-W15 week matcher and core progression',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const correct='if(/^W('+String.fromCharCode(92)+'d+)$/'+'.test(id))';
 const broken='if(/^W('+String.fromCharCode(92,92)+'d+)$/'+'.test(id))';
 assert.ok(source.includes(correct),'week matcher should recognize W6, W10, W15');
 assert.ok(!source.includes(broken),'escaped digit matcher must not recur');
 assert.ok(source.includes('CSAICore.isUnlocked(n,CSAICore.load())'));
 assert.ok(source.includes("if(id==='B1')return completed('W2')"));
});

test('W1 requires both incident and practice lab; legacy W2 completion is visible',()=>withStorage(store=>{
 assert.equal(core.isUnlocked(1,core.load(store)),true);
 assert.equal(core.recordLegacy(1,{source:'test'},store).ok,true);
 assert.notEqual(core.status(1,core.load(store)),'completed','W1 cannot pass without the lab');
 store.setItem('csai2401_w1_lab_complete','true');
 store.setItem('csai2104_diag_v4',JSON.stringify({w1:true}));
 assert.equal(core.status(1,core.load(store)),'completed');
 store.setItem('csai2104_w2_complete','true');
 assert.equal(core.status(2,core.load(store)),'completed');
 assert.equal(core.isUnlocked(3,core.load(store)),true,'B1 must not block the W3 course route');
}));

test('weekly and boss prerequisites W6 -> W7 -> W10 -> W11 -> W15 hold',()=>withStorage(store=>{
 setupPrereqs(store);
 assert.equal(core.isUnlocked(6,core.load(store)),true);
 assert.equal(core.isUnlocked(7,core.load(store)),false);
 for(let n=6;n<=9;n++)core.recordLegacy(n,{source:'test-fixture'},store);
 assert.equal(core.isUnlocked(10,core.load(store)),true);
 assert.equal(core.isUnlocked(11,core.load(store)),false);
 core.recordLegacy(10,{source:'test-fixture'},store);
 assert.equal(core.isUnlocked(11,core.load(store)),true);
 assert.equal(core.isUnlocked(15,core.load(store)),false);
 for(let n=11;n<=14;n++)core.recordLegacy(n,{source:'test-fixture'},store);
 assert.equal(core.isUnlocked(15,core.load(store)),true);
}));

test('resuming a live attempt exposes the original scenario, not the newly selected one',()=>withStorage(store=>{
 setupPrereqs(store);
 const [firstScenario,otherScenario]=curriculum.byWeek[6].scenarios;
 const a=core.begin(6,firstScenario.id,store);
 assert.equal(a.ok,true);
 const b=core.begin(6,otherScenario.id,store);
 assert.equal(b.reason,'resumed');
 assert.equal(b.challengeId,a.challengeId);
 assert.equal(b.scenarioId,firstScenario.id);
}));

test('a failed replay preserves an earlier completed week and its evidence',()=>withStorage(store=>{
 setupPrereqs(store);
 const first=core.begin(6,curriculum.byWeek[6].scenarios[0].id,store);
 answer(6,first.challengeId,[2,2,2],store);
 const success=core.finish(6,first.challengeId,0,'Requirements Pack',store);
 assert.equal(success.ok,true);
 assert.equal(success.passed,true);
 assert.equal(success.score,6,'total supplied by UI is ignored');
 const second=core.begin(6,curriculum.byWeek[6].scenarios[1].id,store);
 answer(6,second.challengeId,[0,0,0],store);
 const failed=core.finish(6,second.challengeId,99,'Wrong attempt',store);
 assert.equal(failed.ok,true);
 assert.equal(failed.passed,false);
 const saved=core.load(store);
 assert.equal(saved.weeks.w6.status,'completed');
 assert.equal(saved.weeks.w6.score,6);
 assert.equal(saved.weeks.w6.artifact,'Requirements Pack');
 assert.equal(saved.weeks.w6.lastAttempt.score,0);
 assert.equal(core.isUnlocked(7,saved),true);
 assert.equal(saved.history.filter(h=>h.type==='attempt-finished').length,2);
}));

test('boss gate cannot pass with zero-score steps, even if total would otherwise pass',()=>withStorage(store=>{
 setupPrereqs(store,9);
 const r=core.begin(10,curriculum.byWeek[10].scenarios[0].id,store);
 assert.equal(r.ok,true);
 answer(10,r.challengeId,[2,2,0],store);
 const failed=core.finish(10,r.challengeId,4,'Debugging Pack',store);
 assert.equal(failed.passed,false);
 assert.deepEqual(failed.assessment.failedSteps,[3]);
 assert.equal(core.isUnlocked(11,core.load(store)),false);
}));

test('Learning Lab progress total uses canonical statuses and source scripts parse',()=>{
 const lab=fs.readFileSync(path.join(__dirname,'../learning-lab.html'),'utf8');
 assert.ok(lab.includes("filter(n=>CSAICore.status(n,st)==='completed')"));
 for(const file of ['index.html','learning-lab.html','w1-lab.html','b1.html','w2.html','w3.html','w4.html','w5.html']){
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const scripts=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
  assert.ok(scripts.length>0,file+' should have an inline game script');
  for(const inline of scripts)assert.doesNotThrow(()=>new vm.Script(inline,{filename:file}),file+' script must parse');
 }
});


test('tampered scores and arbitrary evidence cannot be accepted as canonical answers',()=>withStorage(store=>{
 setupPrereqs(store);
 const sc=curriculum.byWeek[6].scenarios[0];
 const a=core.begin(6,sc.id,store);
 const good=sc.steps[0].options.find(o=>o.score===2);
 const refs=[sc.evidence[0].id,'limitation:ต้องตรวจทานความเสี่ยงที่ยังคงอยู่'];
 const spoof=core.submitStep(6,a.challengeId,0,good.id,0,refs,store);
 assert.equal(spoof.ok,false);
 assert.equal(spoof.reason,'score-mismatch');
 const fake=core.submitStep(6,a.challengeId,0,good.id,2,['not-a-real-evidence','limitation:ต้องตรวจทานความเสี่ยงที่ยังคงอยู่'],store);
 assert.equal(fake.ok,false);
 assert.equal(fake.reason,'scenario-evidence-required');
 const valid=core.submitStep(6,a.challengeId,0,good.id,2,refs,store);
 assert.equal(valid.ok,true);
 assert.equal(core.load(store).attempts.w6.answers[0].score,2);
}));

test('W5, W10, W15 reject missing Boss Evidence Pack before final step and retain attempt',()=>withStorage(store=>{
 for(const week of [5,10,15]){
  store.values.clear();
  setupPrereqs(store,week-1);
  const sc=curriculum.byWeek[week].scenarios[0];
  const r=core.begin(week,sc.id,store);
  assert.equal(r.ok,true,'boss W'+week+' should unlock');
  for(let i=0;i<2;i++){
   const option=sc.steps[i].options.find(o=>o.score===2);
   assert.equal(core.submitStep(week,r.challengeId,i,option.id,2,[sc.evidence[0].id,'limitation:ต้องตรวจสอบความเสี่ยงอื่นด้วย'],store).ok,true);
  }
  const opt=sc.steps[2].options.find(o=>o.score===2);
  const refs=[sc.evidence[0].id,'limitation:ต้องตรวจสอบความเสี่ยงอื่นด้วย'];
  const missing=core.submitStep(week,r.challengeId,2,opt.id,2,refs,store,{});
  assert.equal(missing.ok,false);
  assert.equal(missing.reason,'gate-evidence-incomplete');
  assert.deepEqual(missing.missingTags,curriculum.byWeek[week].gate.requiredEvidenceTags);
  assert.equal(core.load(store).attempts['w'+week].stepIndex,2);
  assert.notEqual(core.status(week,core.load(store)),'completed');
  const evidence=core.submitStep(week,r.challengeId,2,opt.id,2,refs,store,gatePack(week,sc));
  assert.equal(evidence.ok,true,evidence.reason);
  const finish=core.finish(week,r.challengeId,6,curriculum.byWeek[week].artifact,store);
  assert.equal(finish.passed,true,'W'+week+' boss practice should pass locally');
  assert.equal(core.load(store).weeks['w'+week].official,false);
  assert.equal(core.load(store).weeks['w'+week].reviewStatus,'pending-instructor-review');
 }
}));

test('duplicated Boss claims and invalid provenance cannot satisfy an Evidence Pack',()=>{
 const sc=curriculum.byWeek[15].scenarios[0],pack=gatePack(15,sc);
 pack.rollback=pack.monitoring;
 const repeated=assessment.validateGateEvidence(15,sc.id,pack);
 assert.equal(repeated.ok,false);
 assert.ok(repeated.missingTags.includes('monitoring'));
 const valid=gatePack(15,sc);
 valid.monitoring.sourceId='not-in-scenario';
 const bogus=assessment.validateGateEvidence(15,sc.id,valid);
 assert.equal(bogus.ok,false);
 assert.ok(bogus.missingTags.includes('monitoring'));
});

test('Learning Lab loads assessment modules and requires Boss pack on final submission',()=>{
 const lab=fs.readFileSync(path.join(__dirname,'../learning-lab.html'),'utf8');
 assert.ok(lab.includes('<script src="./assessment.js"></script>'));
 assert.ok(lab.includes('<script src="./gate-evidence-ui.js"></script>'));
 assert.ok(lab.includes('CSAIGateUI.render(data,scenario)'));
 assert.ok(lab.includes('CSAIGateUI.collect(data)'));
 for(const file of ['assessment.js','gate-evidence-ui.js']){
  const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  assert.doesNotThrow(()=>new vm.Script(source,{filename:file}));
 }
});
