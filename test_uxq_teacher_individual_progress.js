/* Run: node test_uxq_teacher_individual_progress.js
 * No access to real student data, Google credentials or deployed services.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const appDir = path.join(__dirname, 'sgnal-hunt', 'apps-script');
const ctx = vm.createContext({Date, Number, String, JSON, Object, Array, RegExp, Math, PropertiesService:null, Session:null});
const source = fs.readFileSync(path.join(appDir,'UXQuestIndividualProgress-v1.gs'),'utf8');
vm.runInContext(source,ctx,{filename:'UXQuestIndividualProgress-v1.gs'});
function attempt(id,mission,passed,stars) {
  return {studentid:id,studentname:'Student '+id,section:'101',courseid:'UXQ-ACT1-2026',
    eventtype:'mission_completed',missionid:mission,passed:String(passed),
    stars:String(stars),score:'75',accuracy:'80',verifiedaccuracy:'65',
    receivedat:'2026-10-20 10:00'};
}
function submitted(id,mission,eventid){
  return {studentid:id,studentname:'Student '+id,section:'101',courseid:'UXQ-ACT1-2026',
    eventtype:'artifact_submitted',missionid:mission,eventid:eventid,
    receivedat:'2026-10-20 10:10',rawjson:'{"figmaUrl":"https://www.figma.com/file/abc"}'};
}
const rows=[
  attempt('S1','w1',false,2),attempt('S1','w2',false,0),
  attempt('S2','w2',true,3),submitted('S3','w1','artifact-1'),
  submitted('S5','w1','artifact-old'),submitted('S5','w1','artifact-new'),
  attempt('S6','w1',true,0),
  {...attempt('FOREIGN','w1',true,3),section:'102'},
  {...attempt('WRONG_COURSE','w1',true,3),courseid:'CSAI2102'}
];
const review=[
  {studentid:'S3',section:'101',missionid:'w1',artifacteventid:'artifact-1',reviewstatus:'approved',totalscore:'90'},
  {studentid:'S5',section:'101',missionid:'w1',artifacteventid:'artifact-old',reviewstatus:'approved',totalscore:'95'}
];
const roster=[{studentid:'S4',studentname:'Never played',section:'101'}];
const d=ctx.UXQ_ipBuild_(rows,review,roster,'101');
const s=Object.fromEntries(d.students.map(x=>[x.studentId,x]));
assert.equal(d.nodes.length,19);
assert.equal(s.S1.completedCount,1);
assert.equal(s.S1.nodes.w1.status,'passed');
assert.equal(s.S1.nodes.w2.status,'retry');
assert.equal(s.S1.nodes.w3.status,'locked');
assert.equal(s.S2.completedCount,0);
assert.equal(s.S2.nodes.w2.status,'out_of_sequence');
assert.equal(s.S3.completedCount,0,'Studio must not unlock gameplay');
assert.equal(s.S3.nodes.w1.reviewStatus,'approved');
assert.equal(s.S4.completedCount,0,'roster-only student must remain visible');
assert.equal(s.S4.nodes.w1.status,'ready');
assert.equal(s.S5.nodes.w1.reviewStatus,'submitted','old approval must not carry to new artifact');
assert.equal(s.S6.nodes.w1.status,'passed');
assert.equal(s.FOREIGN,undefined,'section isolation');
assert.equal(s.WRONG_COURSE,undefined,'course isolation');
assert.equal(d.studentCount,6);

ctx.PropertiesService={getScriptProperties(){return {getProperty(key){
  return key==='UXQ_TEACHER_EMAILS'?'teacher@example.edu':null;
}}}};
ctx.Session={getActiveUser(){return {getEmail(){return 'attacker@example.edu';}}}};
assert.throws(()=>ctx.UXQ_ipAuthorize_(),/ไม่ได้รับอนุญาต/);
ctx.Session={getActiveUser(){return {getEmail(){return '';}}}};
assert.throws(()=>ctx.UXQ_ipAuthorize_(),/ไม่ได้รับอนุญาต/);
ctx.Session={getActiveUser(){return {getEmail(){return 'teacher@example.edu';}}}};
assert.equal(ctx.UXQ_ipAuthorize_(),'teacher@example.edu');

const html=fs.readFileSync(path.join(appDir,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
for (const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
const router=fs.readFileSync(path.join(appDir,'UXQuestStudioRouterPatch-v1.gs'),'utf8');
assert.match(router,/view === 'progress'/);
assert.match(router,/UXQ_ipAuthorize_\(\)/);
const manifest=JSON.parse(fs.readFileSync(path.join(appDir,'teacher-dashboard','appsscript.json'),'utf8'));
assert.equal(manifest.webapp.access,'MYSELF');

console.log('PASS: 19 W/B statuses, contiguous completion, Studio review, roster, course/section isolation, teacher guard, HTML syntax and private manifest');
