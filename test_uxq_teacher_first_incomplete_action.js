/* Run: node test_uxq_teacher_first_incomplete_action.js
 * Synthetic fixtures. Reads only source files; no external requests or
 * Google Sheet modifications.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=path.join(__dirname,'sgnal-hunt','apps-script');
const ctx=vm.createContext({Date,Number,String,JSON,Object,Array,Math,RegExp});
vm.runInContext(fs.readFileSync(path.join(app,'UXQuestIndividualProgress-v1.gs'),'utf8'),ctx);
const ids=['w1','w2','w3','b1','w4','w5','w6','w7','b2',
  'w8','w9','w10','w11','b3','w12','w13','w14','b4','w15'];
function row(student,node,type,extra={}) {
  return {studentid:student,studentname:'Synthetic '+student,
    section:'201',courseid:'UXQ-ACT1-2026',missionid:node,
    eventtype:type,receivedat:'2026-10-26T09:00:00Z',...extra};
}
const mission=(s,n)=>row(s,n,'mission_completed',{stars:'3',passed:'true'});
const studio=(s,n,v,text='')=>row(s,n,'artifact_submitted',{
  rawjson:JSON.stringify({artifactFields:[{key:'reflection',value:v}]}),
  reflection:text
});
const events=[
  mission('STUDIO','w1'),
  mission('BLANK','w1'),studio('BLANK','w1',''),
  mission('AMBIG','w1'),studio('AMBIG','w1','','legacy receiver text'),
  mission('W2','w1'),studio('W2','w1','Personally authored reflection'),
  ...ids.flatMap(id=>[mission('COMPLETE',id),studio('COMPLETE',id,'Own reflection')]),
  ...ids.slice(0,18).flatMap(id=>[mission('HIST',id),studio('HIST',id,'')]),
  mission('W2REF','w1'),studio('W2REF','w1','good'),
  mission('W2REF','w2'),studio('W2REF','w2',''),
  {...mission('FOREIGN','w1'),section:'101'}
];
const unchanged=JSON.stringify(events);
const out=ctx.UXQ_ipBuild_(events,[],[],'201');
assert.equal(JSON.stringify(events),unchanged,'source rows must never be mutated');
const by=Object.fromEntries(out.students.map(s=>[s.studentId,s]));
assert.equal(out.studentCount,7,'strict Section isolation');
assert.equal(by.STUDIO.nextAction.kind,'studio');
assert.equal(by.STUDIO.nextAction.nodeId,'w1');
assert.equal(by.BLANK.nextAction.kind,'reflection_missing');
assert.equal(by.AMBIG.nextAction.kind,'reflection_review','ambiguous Receiver text must be verified');
assert.equal(by.W2.nextAction.kind,'mission');
assert.equal(by.W2.nextAction.nodeId,'w2');
assert.equal(by.COMPLETE.nextAction.kind,'complete');
assert.equal(by.COMPLETE.courseCompletedCount,19);
assert.equal(by.HIST.completedCount,18,'history never erased');
assert.equal(by.HIST.courseCompletedCount,0);
assert.equal(by.HIST.nextAction.kind,'reflection_missing');
assert.equal(by.HIST.nextAction.historicalFutureCount,17);
assert.equal(by.HIST.nodes.w2.passedEvidence,true);
assert.equal(by.HIST.nodes.w2.accessStatus,'locked');
assert.equal(by.W2REF.nextAction.nodeId,'w2');
assert.equal(by.W2REF.nextAction.kind,'reflection_missing');
assert.equal(by.W2REF.courseCompletedCount,1);
assert.equal(by.AMBIG.nextAction.historicalFutureCount,0);
const html=fs.readFileSync(path.join(app,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
assert.match(html,/งานที่ควรติดตามต่อ/);
assert.match(html,/ตรวจหลักฐาน Reflection ก่อน/);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(script.length,1);
const nodes={};
function el(id) {
  return nodes[id]||(nodes[id]={
    value:id==='section'?'201':'',textContent:'',innerHTML:'',
    hidden:false,disabled:false,listeners:{},
    addEventListener(type,fn){this.listeners[type]=fn},
    scrollIntoView(){}
  });
}
const document={getElementById:el};
const google={script:{run:{
  withSuccessHandler(fn){this.success=fn;return this},
  withFailureHandler(fn){this.failure=fn;return this},
  UXQ_ipGetDashboard(opts){assert.equal(opts.section,'201');this.success(out)}
}}};
new vm.Script(script[0][1]).runInNewContext({window:{google},document,google});
assert.match(el('actionRows').innerHTML,/Synthetic HIST/);
assert.match(el('actionRows').innerHTML,/ตรวจการส่งงาน Studio/);
assert.match(el('actionTotals').innerHTML,/ตรวจ Reflection/);
el('actionFilter').value='reflection_review';
el('actionFilter').listeners.change();
assert.match(el('actionRows').innerHTML,/Synthetic AMBIG/);
assert.doesNotMatch(el('actionRows').innerHTML,/Synthetic BLANK/);
assert.match(el('actionFilterSummary').textContent,/1 จาก 7/);
el('actionFilter').value='all';
el('actionFilter').listeners.change();
el('search').value='STUDIO';
el('search').listeners.input();
assert.match(el('actionFilterSummary').textContent,/1 จาก 1/);
assert.match(el('actionRows').innerHTML,/Synthetic STUDIO/);
el('search').value='';
el('search').listeners.input();
assert.doesNotMatch(el('actionRows').innerHTML,/legacy receiver text/,
  'never display Reflection response text to the cohort queue');
assert.match(el('policyNotice').textContent||html,/ไม่ใช่การยืนยันว่า Web App นักศึกษาใช้กฎนี้จริงแล้ว/);
console.log('PASS: earliest W/B action, evidence ambiguity, history preservation, Section/search/type filters and private UI');
