/* Regression: teacher-only progress display and read-only discrepancy audit.
 * Run from repository root: node test_uxq_teacher_progress_display_qa.js
 * No student data or Google credentials are used.
 */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const base=path.join(__dirname,'sgnal-hunt','apps-script');
const ctx=vm.createContext({Date,Number,String,JSON,Object,Array,Math,RegExp});
vm.runInContext(fs.readFileSync(path.join(base,'UXQuestIndividualProgress-v1.gs'),'utf8'),ctx);
const row=(id,type,overrides={})=>({
  studentid:id,studentname:'Student '+id,section:'201',
  courseid:'UXQ-ACT1-2026',missionid:'w1',eventtype:type,
  receivedat:'2026-10-21T09:00:00Z',...overrides
});
const attempts=[
  row('S1','mission_completed',{
    passed:'false',stars:'1',score:'553',completedat:'2026-07-25T12:51:29Z',
    rawjson:JSON.stringify({answers:[
      {stageKey:'evidence',verified:true,correct:true},
      {stageKey:'evidence',verified:false,correct:true}
    ]})
  }),
  row('S2','mission_completed',{passed:'true',stars:'2'}),
  row('S3','reason_retry_submitted',{missionid:'w2'}),
  row('S4','other_event'),
  row('S5','mission_completed',{courseid:'unrelated'}),
  row('S6','mission_completed',{missionid:'invalid'}),
  row('OTHER_SECTION','mission_completed',{section:'101',passed:'true',stars:'3'})
];
const result=ctx.UXQ_ipBuild_(attempts,[],[],'201');
assert.equal(result.studentCount,3,'only eligible students in official matrix');
assert.equal(result.identityAudit.rawSheetStudentCount,6,'unique identities in source sheet for section');
assert.equal(result.identityAudit.excludedCount,3,'excluded identity count');
assert.deepEqual(Array.from(result.identityAudit.excluded,x=>x.studentId),['S4','S5','S6']);
assert.equal(result.students[0].nodes.w1.reviewScore,null);
assert.equal(result.students[0].nodes.w1.lastAt,'2026-07-25T12:51:29Z');
assert.equal(result.students[0].nodes.w1.artifactAt,'');
assert.equal(result.students[0].nodes.w1.status,'retry');
const html=fs.readFileSync(path.join(base,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
const js=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(js.length,1);
const nodes={};
function el(id) {
  return nodes[id] || (nodes[id]={
    value:id==='section'?'201':'',innerHTML:'',textContent:'',
    hidden:false,disabled:false,callbacks:{},
    addEventListener(type,fn){this.callbacks[type]=fn},
    scrollIntoView(){}
  });
}
const document={getElementById:el};
const google={script:{run:{
  withSuccessHandler(fn){this.success=fn;return this},
  withFailureHandler(fn){this.failure=fn;return this},
  UXQ_ipGetDashboard(options){assert.equal(options.section,'201');this.success(result)}
}}};
new vm.Script(js[0][1]).runInNewContext({window:{google},document,google});
el('student').value='201|S1';
el('student').callbacks.change.call(el('student'));
const detail=el('detailRows').innerHTML;
const sub=el('subParts').innerHTML;
assert.ok(el('detailTitle').textContent.includes('S1'));
assert.doesNotMatch(detail,/undefined\/100/);
assert.doesNotMatch(el('subReview').textContent,/undefined\/100/);
assert.match(detail,/2026-07-25T12:51:29Z<\/td><td>—<\/td>/,
  'Mission date must never be mislabeled as Studio submit date');
assert.match(sub,/เล่นแล้ว 1 ครั้ง ยังไม่ผ่าน/);
assert.match(sub,/สูงสุด 1 ดาว/);
assert.match(el('nextAdvice').textContent,/ทบทวนเหตุผลในขั้น หลักฐาน/);
assert.match(el('auditText').textContent,/6 คน/);
assert.match(el('auditRows').innerHTML,/S4/);
assert.doesNotMatch(el('auditRows').innerHTML,/OTHER_SECTION/);
console.log('PASS: no undefined review score, separate dates, retry detail, stage advice, per-section identity audit');
