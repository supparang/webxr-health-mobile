/* Run from repo root: node test_uxq_teacher_three_part_matrix.js
 * Synthetic fixtures only; does not call Google or edit student records.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const folder=path.join(__dirname,'sgnal-hunt','apps-script');
const ctx=vm.createContext({Date,Number,String,JSON,Object,Array,Math,RegExp});
vm.runInContext(fs.readFileSync(path.join(folder,'UXQuestIndividualProgress-v1.gs'),'utf8'),ctx);
const ORDER=['w1','w2','w3','b1','w4','w5','w6','w7','b2',
  'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
function event(student,id,type,extra={}) {
  return {studentid:student,studentname:'Synthetic Learner '+student,section:'201',
    courseid:'UXQ-ACT1-2026',missionid:id,eventtype:type,
    receivedat:'2026-10-26T10:00:00Z',...extra};
}
function mission(student,id){
  return event(student,id,'mission_completed',{passed:'true',stars:'2',score:'1112'});
}
function studio(student,id,reflection){
  return event(student,id,'artifact_submitted',{rawjson:JSON.stringify({artifactFields:[
    {key:'reflection',value:reflection,label:'Reflection',required:true}
  ]})});
}
const rows=[
  ...ORDER.slice(0,18).flatMap(id=>[mission('18p',id),studio('18p',id,'')]),
  mission('one','w1'),
  mission('three','w1'),studio('three','w1','self-authored learning reflection')
];
const output=ctx.UXQ_ipBuild_(rows,[],[],'201');
const by=Object.fromEntries(output.students.map(s=>[s.studentId,s]));
assert.equal(output.nodes.length,19);
assert.equal(by['18p'].completedCount,18,'historical 18 Mission passes preserved');
assert.equal(by['18p'].fullThreePartCount,0);
assert.equal(by['18p'].courseCompletedCount,0,'no 3/3 unlock despite past Mission passes');
assert.equal(by['18p'].nodes.w1.accessStatus,'ready','W1 remains accessible to finish Studio/Reflection');
assert.equal(by['18p'].nodes.w2.accessStatus,'locked','W2 must be locked');
assert.equal(by['18p'].nodes.w2.partsCompleted,2,'historical 2/3 is still visible');
assert.equal(by['18p'].nodes.w2.passedEvidence,true,'W2 historical Mission pass remains');
assert.equal(by['18p'].nodes.w15.accessStatus,'locked');
assert.equal(by['18p'].historicalLockedCount,17);
assert.equal(by.one.nodes.w2.accessStatus,'locked','W1 1/3 must not open W2');
assert.equal(by.three.nodes.w2.accessStatus,'ready','W1 3/3 opens W2');

const html=fs.readFileSync(path.join(folder,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
assert.match(html,/ผล Mission ย้อนหลัง/);
assert.match(html,/สิทธิ์ตามเกณฑ์ 3\/3/);
assert.match(html,/ไม่ใช่การยืนยันว่า Web App นักศึกษาใช้กฎนี้จริงแล้ว/);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(script.length,1);
const elMap={};
function el(id){
  return elMap[id]||(elMap[id]={
    value:id==='section'?'201':'',innerHTML:'',textContent:'',hidden:false,
    disabled:false,handlers:{},
    addEventListener(type,cb){this.handlers[type]=cb},
    scrollIntoView(){}
  });
}
const document={getElementById:el};
const google={script:{run:{
  withSuccessHandler(callback){this.success=callback;return this},
  withFailureHandler(callback){this.failure=callback;return this},
  UXQ_ipGetDashboard(input){assert.equal(input.section,'201');this.success(output)}
}}};
new vm.Script(script[0][1]).runInNewContext({window:{google},document,google});
const matrix=el('matrix').innerHTML;
assert.match(matrix,/ครบ 3\/3 \(ต่อเนื่อง\)/);
assert.match(matrix,/game-marker-should-not-exist|เกม✓/);
assert.match(matrix,/class="gate-locked"/);
el('student').value='201|18p';
el('student').handlers.change.call(el('student'));
const detail=el('detailRows').innerHTML;
assert.match(detail,/✓ ผ่าน Mission/);
assert.match(detail,/🔒 ยังล็อกตามเกณฑ์ 3\/3/);
assert.doesNotMatch(detail,/undefined\/100/);
console.log('PASS: 18/19 historical passes + 0/19 completed gates preserved, W2 locked, 3/3 unlock, clear teacher UI');
