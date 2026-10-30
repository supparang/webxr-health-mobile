'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=require('../core.js');
const curriculum=require('../curriculum.js');

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
function answer(week,attempt,scores,store){
 scores.forEach((score,idx)=>{
  const result=core.submitStep(week,attempt,idx,'answer-'+idx,score,['evidence-'+idx],store);
  assert.equal(result.ok,true,'step '+idx+' should persist');
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
 const a=core.begin(6,'w6s1',store);
 assert.equal(a.ok,true);
 const b=core.begin(6,'w6s2',store);
 assert.equal(b.reason,'resumed');
 assert.equal(b.challengeId,a.challengeId);
 assert.equal(b.scenarioId,'w6s1');
}));

test('a failed replay preserves an earlier completed week and its evidence',()=>withStorage(store=>{
 setupPrereqs(store);
 const first=core.begin(6,'w6s1',store);
 answer(6,first.challengeId,[2,2,2],store);
 const success=core.finish(6,first.challengeId,0,'Requirements Pack',store);
 assert.equal(success.ok,true);
 assert.equal(success.passed,true);
 assert.equal(success.score,6,'total supplied by UI is ignored');
 const second=core.begin(6,'w6s2',store);
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
 const r=core.begin(10,'w10s1',store);
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
