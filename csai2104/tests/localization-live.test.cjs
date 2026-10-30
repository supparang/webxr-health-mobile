'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const dir=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');

test('Mission Control renders Thai-first entry for W1, W2, B1 and all fifteen weeks',()=>{
 const s=read('index.html');
 assert.ok(s.includes('วิกฤตระบบ AI'));
 assert.ok(s.includes("title:'ระบบล่ม! (System Down)'"));
 assert.ok(s.includes("title:'แหล่งข้อมูลหลัก (Source of Truth)'"));
 assert.ok(s.includes("title:'ความสำเร็จลวง (False Success)'"));
 const names=s.split('const names={')[1]?.split("};return {id:'W'+n")[0];
 assert.ok(names,'W6-W15 catalog not found');
 const titles=names.split('],').map(x=>x.split("['")[1]?.split("'")[0]).filter(Boolean);
 assert.equal(titles.length,10);
 for(const title of titles)assert.match(title,/[ก-๙]/,'Missing Thai-first week title: '+title);
 assert.ok(s.includes('ตอบเป็นภาษาไทย อังกฤษ หรือผสมกันได้'));
});

test('Localization preserves existing main-branch unlock and W1 progress semantics',()=>{
 const s=read('index.html');
 assert.ok(s.includes("if(id==='W3')return completed('B1')"));
 assert.ok(s.includes("if(id==='W5')return completed('W4')"));
 assert.ok(s.includes("localStorage.csai2401_w1_lab_complete==='true'"));
 assert.ok(s.includes("if(!state.w1)state.ep+=50"));
 assert.ok(s.includes("localStorage.getItem('csai2104_diag_v4')"));
});

test('W1 investigation labels are bilingual, keys untouched, original evidence can remain valid',()=>{
 const s=read('w1-lab.html');
 for(const label of ['อาการที่พบ (Observed Symptom)','สาเหตุราก (Root Cause)',
 'หลักฐาน (Evidence)','การทดสอบป้องกันปัญหาซ้ำ (Regression Guard)',
 'ความเสี่ยงคงเหลือ (Residual Risk)']){
   assert.ok(s.includes(label),label);
 }
 for(const key of ['csai2401_w1_incident_pack','csai2401_w1_lab_complete',
 'symptom:$(\'symptom\').value.trim()','rootCause:$(\'root\').value.trim()',
 'evidence,regressionGuard:guard,residualRisk:risk']){
   assert.ok(s.includes(key),'W1 evidence contract changed: '+key);
 }
});

test('Standalone W2-W5 and B1 show Thai-first headings and Thai navigation',()=>{
 const terms={'w2.html':'แหล่งข้อมูลหลัก','w3.html':'เลือกกระบวนการภายใต้แรงกดดัน',
 'w4.html':'ความขัดแย้งของผู้มีส่วนได้ส่วนเสีย','w5.html':'ค้นหาข้อกำหนดที่ซ่อนอยู่',
 'b1.html':'ความสำเร็จลวง'};
 for(const [file,title] of Object.entries(terms)){
   const s=read(file);
   assert.ok(s.includes(title),file+' lacks Thai-first heading');
   assert.ok(!s.includes('← Mission Control'),file+' still English only');
   assert.match(s,/ขั้นที่ [1-4]/,file+' stage not localized');
 }
});

test('Learning Lab remains free of unmerged assessment changes and translates key statuses',()=>{
 const s=read('learning-lab.html');
 assert.ok(s.includes('ห้องเรียนปฏิบัติการ'));
 assert.ok(s.includes('สถานะด่านบอส (Boss Gates)'));
 assert.ok(s.includes('ผลฝึกในเครื่อง'));
 assert.ok(s.includes('statusText(stat(n))'));
 assert.ok(s.includes('CSAICore.submitStep('));
 assert.ok(s.includes('CSAICore.finish('));
 assert.ok(!s.includes('src="./assessment.js"'));
 assert.ok(!s.includes('CSAIGateUI.collect'));
});

test('All game HTML inline scripts and shared scripts parse after localization',()=>{
 const pages=['index.html','w1-lab.html','w2.html','w3.html','w4.html',
 'w5.html','b1.html','learning-lab.html'];
 for(const file of pages){
  const html=read(file);
  const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).filter(x=>x.trim());
  assert.ok(inline.length,file+' missing inline script');
  for(const script of inline)assert.doesNotThrow(()=>new vm.Script(script,{filename:file}),file+' contains invalid JavaScript');
 }
 for(const file of ['core.js','curriculum.js','legacy-bridge.js','w2-feedback-polish.js']){
  assert.doesNotThrow(()=>new vm.Script(read(file),{filename:file}),file);
 }
});
