'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const thai=/[ก-๙]/;

test('Mission Control presents Thai-first names for W1-W15 and optional B1',()=>{
 const source=read('index.html');
 for(const english of ['SYSTEM DOWN!','SOURCE OF TRUTH','THE FALSE SUCCESS','PROCESS RUSH','STAKEHOLDER CHAOS','THE HIDDEN REQUIREMENT']){
  assert.ok(!source.includes("title:'"+english+"'"),english+' must not remain English-only');
 }
 const nameTail=source.split('const names={')[1];
 assert.ok(nameTail,'W6-W15 names catalog must exist');
 const namesBlock=nameTail.split("};return {id:'W'+n")[0];
 const titles=namesBlock.split('],').map(piece=>piece.split("['")[1]?.split("'")[0]).filter(Boolean);
 assert.equal(titles.length,10,'W6-W15 should have 10 translated names');
 for(const title of titles)assert.ok(thai.test(title),'Thai-first heading required: '+title);
 assert.ok(source.includes('ตอบเป็นภาษาไทย อังกฤษ หรือผสมกันได้'));
});

test('W1 Incident Investigation Pack labels are Thai-first and evidence schema remains unchanged',()=>{
 const s=read('w1-lab.html');
 for(const label of ['อาการที่พบ (Observed Symptom)','สาเหตุราก (Root Cause)','หลักฐาน (Evidence)','การทดสอบป้องกันปัญหาซ้ำ (Regression Guard)','ความเสี่ยงคงเหลือ (Residual Risk)']){
  assert.ok(s.includes(label),label);
 }
 for(const key of ['csai2401_w1_lab_complete','csai2401_w1_incident_pack',
  "symptom:$('symptom').value.trim()","rootCause:$('root').value.trim()",
  'evidence,regressionGuard:guard,residualRisk:risk']){
  assert.ok(s.includes(key),'W1 persistence schema must remain stable: '+key);
 }
 assert.ok(s.includes('ภาษาไทย ภาษาอังกฤษ หรือผสมกันได้'));
});

test('W2-W5 and B1 show Thai-first headings, stages and navigation',()=>{
 const headings={
  'w2.html':'แหล่งข้อมูลหลัก',
  'w3.html':'เลือกกระบวนการภายใต้แรงกดดัน',
  'w4.html':'ความขัดแย้งของผู้มีส่วนได้ส่วนเสีย',
  'w5.html':'ค้นหาข้อกำหนดที่ซ่อนอยู่',
  'b1.html':'ความสำเร็จลวง'
 };
 for(const [file,title] of Object.entries(headings)){
  const s=read(file);
  assert.ok(s.includes(title),file+' missing Thai heading');
  assert.ok(!s.includes('← Mission Control'),file+' still has untranslated back button');
  assert.ok(/ขั้นที่ [1-4]/.test(s),file+' still has English-only stage labels');
 }
});

test('Learning Lab and Boss Pack show Thai without changing scoring interfaces',()=>{
 const s=read('learning-lab.html');
 assert.ok(s.includes('ห้องเรียนปฏิบัติการ'));
 assert.ok(s.includes('ตอบไทย/อังกฤษ/ผสมกันได้'));
 assert.ok(s.includes('CSAICore.submitStep('));
 assert.ok(s.includes('CSAIGateUI.collect(data)'));
 assert.ok(s.includes('CSAIAssessment.GATE_LABELS'));
 assert.ok(s.includes('statusText(stat(n))'));
 assert.ok(read('gate-evidence-ui.js').includes('ชุดหลักฐาน (Evidence Pack)'));
});

test('Translated browser scripts and dynamic labels parse as JavaScript',()=>{
 const pages=['index.html','w1-lab.html','w2.html','w3.html','w4.html','w5.html','b1.html','learning-lab.html'];
 for(const file of pages){
  const source=read(file);
  const inline=[...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
  assert.ok(inline.length>0,file+' missing inline script');
  for(const script of inline)assert.doesNotThrow(()=>new vm.Script(script,{filename:file}),file);
 }
 for(const file of ['gate-evidence-ui.js','legacy-bridge.js','w2-feedback-polish.js']){
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}));
 }
});
