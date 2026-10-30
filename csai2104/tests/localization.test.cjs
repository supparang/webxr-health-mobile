'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const thai=/[ก-๙]/;

test('Mission Control uses Thai-first names for every week and optional B1',()=>{
 const source=read('index.html');
 for(const english of ['SYSTEM DOWN!','SOURCE OF TRUTH','THE FALSE SUCCESS','PROCESS RUSH','STAKEHOLDER CHAOS','THE HIDDEN REQUIREMENT']){
   assert.ok(!source.includes("title:'"+english+"'"),english+' should not remain English-only');
 }
 const fixedTitles=[...source.matchAll(/title:'([^']+)'/g)].map(x=>x[1]);
 assert.ok(fixedTitles.filter(x=>thai.test(x)).length>=6);
 const weeksBlock=source.match(/const names={([sS]*?)};return {id:'W'+n/);
 assert.ok(weeksBlock,'W6-W15 catalog must exist');
 const names=[...weeksBlock[1].matchAll(/(?:6|7|8|9|10|11|12|13|14|15):['([^']+)'/g)].map(x=>x[1]);
 assert.equal(names.length,10);
 for(const name of names)assert.ok(thai.test(name),name+' should be Thai-first');
 assert.ok(source.includes('ตอบเป็นภาษาไทย อังกฤษ หรือผสมกันได้'));
});

test('W1 Investigation Pack has Thai-first labels and unchanged evidence keys',()=>{
 const source=read('w1-lab.html');
 for(const label of [
 'อาการที่พบ (Observed Symptom)',
 'สาเหตุราก (Root Cause)',
 'หลักฐาน (Evidence)',
 'การทดสอบป้องกันปัญหาซ้ำ (Regression Guard)',
 'ความเสี่ยงคงเหลือ (Residual Risk)'
 ])assert.ok(source.includes(label),label);
 for(const key of [
 'csai2401_w1_lab_complete','csai2401_w1_incident_pack',
 "symptom:$('symptom').value.trim()","rootCause:$('root').value.trim()",
 'evidence,regressionGuard:guard,residualRisk:risk'
 ])assert.ok(source.includes(key),'W1 evidence schema changed: '+key);
 assert.ok(source.includes('ภาษาไทย ภาษาอังกฤษ หรือผสมกันได้'));
});

test('Every mission W2-W5 and B1 presents Thai first in headings and action labels',()=>{
 const titles={
 'w2.html':'แหล่งข้อมูลหลัก',
 'w3.html':'เลือกกระบวนการภายใต้แรงกดดัน',
 'w4.html':'ความขัดแย้งของผู้มีส่วนได้ส่วนเสีย',
 'w5.html':'ค้นหาข้อกำหนดที่ซ่อนอยู่',
 'b1.html':'ความสำเร็จลวง'
 };
 for(const [file,title] of Object.entries(titles)){
  const s=read(file);
  assert.ok(s.includes(title),file+' missing Thai-first heading');
  assert.ok(!s.includes('← Mission Control'),file+' still has English-only back action');
  assert.ok(/ขั้นที่ [1-4]/.test(s),file+' must show Thai stage labels');
 }
});

test('Learning Lab remains bilingual and preserves canonical assessment wiring',()=>{
 const source=read('learning-lab.html');
 assert.ok(source.includes('ห้องเรียนปฏิบัติการ'));
 assert.ok(source.includes('ตอบไทย/อังกฤษ/ผสมกันได้'));
 assert.ok(source.includes('CSAICore.submitStep('));
 assert.ok(source.includes('CSAIGateUI.collect(data)'));
 assert.ok(source.includes('CSAIAssessment.GATE_LABELS'));
 assert.ok(source.includes("statusText(stat(n))"));
 assert.ok(read('gate-evidence-ui.js').includes('ชุดหลักฐาน (Evidence Pack)'));
});

test('All translated browser scripts still parse as JavaScript',()=>{
 for(const file of ['index.html','w1-lab.html','w2.html','w3.html','w4.html','w5.html','b1.html','learning-lab.html']){
  const source=read(file);
  const inline=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(x=>x.trim());
  assert.ok(inline.length>0,file);
  for(const script of inline)assert.doesNotThrow(()=>new vm.Script(script,{filename:file}),file);
 }
 for(const file of ['gate-evidence-ui.js','legacy-bridge.js','w2-feedback-polish.js']){
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
 }
});
