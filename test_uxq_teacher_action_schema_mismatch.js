/* Run from repo root: node test_uxq_teacher_action_schema_mismatch.js
 * Synthetic teacher dashboard schema compatibility tests. READ ONLY.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),
      path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'sgnal-hunt','apps-script');
const ctx=vm.createContext({Date,Number,String,JSON,Object,Array,Math});
vm.runInContext(fs.readFileSync(path.join(dir,'UXQuestIndividualProgress-v1.gs'),'utf8'),ctx);
const ids=['w1','w2','w3','b1','w4','w5','w6','w7','b2',
'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
function event(s,n,t,other={}){
 return {studentid:s,studentname:'Student '+s,section:'201',
  courseid:'UXQ-ACT1-2026',missionid:n,eventtype:t,...other};
}
const mission=(s,n)=>event(s,n,'mission_completed',{passed:'true',stars:'3'});
const studio=(s,n,reflection)=>event(s,n,'artifact_submitted',{
 rawjson:JSON.stringify({artifactFields:[{key:'reflection',value:reflection}]})});
const rows=[
 ...ids.slice(0,7).flatMap(n=>[mission('SEVEN',n),studio('SEVEN',n,'own reflection')]),
 ...ids.slice(0,18).flatMap(n=>[mission('EIGHTEEN',n),studio('EIGHTEEN',n,'')]),
 ...ids.flatMap(n=>[mission('DONE',n),studio('DONE',n,'personal reflection')]),
 mission('STUDIO','w1'),
 mission('LEGACY','w1'),studio('LEGACY','w1','')
];
const live=ctx.UXQ_ipBuild_(rows,[],[],'201');
const copy=JSON.parse(JSON.stringify(live));
for(const s of copy.students)delete s.nextAction; // reproduces old deployed Apps Script
const one=copy.students.find(s=>s.studentId==='SEVEN');
assert.equal(one.courseCompletedCount,7);
const html=fs.readFileSync(path.join(dir,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
const code=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)][0][1];
assert.ok(code);
const els={};
function el(id){
 return els[id]||(els[id]={value:id==='section'?'201':'',innerHTML:'',textContent:'',
 hidden:false,disabled:false,listeners:{},
 addEventListener(t,cb){this.listeners[t]=cb},scrollIntoView(){}});
}
const document={getElementById:el};
const google={script:{run:{
 withSuccessHandler(fn){this.success=fn;return this},
 withFailureHandler(fn){this.fail=fn;return this},
 UXQ_ipGetDashboard(){this.success(copy)}
}}};
new vm.Script(code).runInNewContext({window:{google},document,google});
const action=el('actionRows').innerHTML;
assert.match(el('actionSchemaAlert').textContent,/คนละรุ่น/);
assert.equal(el('actionSchemaAlert').hidden,false);
assert.match(action,/Student SEVEN/);
assert.match(action,/W7/,'7/19 should point at W7 in the 19-node pathway, not "complete"');
assert.match(action,/Student EIGHTEEN/);
assert.match(action,/Student DONE/);
assert.match(action,/ประเมินสำรองจากข้อมูลรายด่าน/);
assert.match(action,/Student STUDIO/);
assert.match(action,/ยังไม่ส่ง Studio/);
assert.match(el('actionTotals').innerHTML,/รอ Mission/);
const sevenRow=(action.match(/<tr><td>Student SEVEN[\s\S]*?<\/tr>/)||[])[0]||'';
assert.ok(sevenRow,'must render the selected 7/19 learner');
assert.doesNotMatch(sevenRow,/ครบทุกด่าน/,
 '7/19 must not be displayed as complete');
el('actionFilter').value='reflection_missing';
el('actionFilter').listeners.change();
assert.match(el('actionRows').innerHTML,/Student EIGHTEEN/);
assert.doesNotMatch(el('actionRows').innerHTML,/Student SEVEN/);
// No counts or histories may be modified by client-side derivation.
assert.equal(JSON.stringify(copy.students.find(s=>s.studentId==='SEVEN')),JSON.stringify(one));
// Unsupported/incomplete records must NOT be interpreted as complete.
const broken=copy.students.find(s=>s.studentId==='LEGACY');
broken.nodes={};
el('actionFilter').value='all';
el('actionFilter').listeners.change();
assert.match(el('actionRows').innerHTML,/ข้อมูลตรวจงานไม่ครบ/);
assert.match(el('actionRows').innerHTML,/ต้องตรวจข้อมูล/);
assert.match(el('actionSchemaAlert').textContent,/ไม่มีข้อมูลเพียงพอ/);
console.log('PASS: old GS schema fallback, 7/19 to W8, 18/19 to W1, completed safe, no false course completion or student-data edits');
