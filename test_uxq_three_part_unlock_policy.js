/* Run: node test_uxq_three_part_unlock_policy.js
 * Tests synthetic rows only. Does not read/write live student information.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dir=path.join(__dirname,'sgnal-hunt');
const app=path.join(dir,'apps-script');
const context=vm.createContext({Date,Number,String,JSON,Object,Array,Math});
function script(relative){
 return fs.readFileSync(path.join(dir,relative),'utf8');
}
const gateSource=script('apps-script/UXQuestThreePartWriteGate-v1.gs');
vm.runInContext(gateSource,context);
const row=(sid,node,type,extra={})=>({studentid:sid,section:'201',courseid:'UXQ-ACT1-2026',
 missionid:node,eventtype:type,passed:'',stars:'',artifactfields:'',...extra});
const mission=(sid,node,stars)=>row(sid,node,'mission_completed',{stars:String(stars)});
const artifact=(sid,node,reflect)=>row(sid,node,'artifact_submitted',{
 artifactfields:JSON.stringify([{key:'reflection',value:reflect}])});
const incoming=(missionId,studentId='S1',section='201')=>({
 missionId,studentId,section,courseId:'UXQ-ACT1-2026',eventType:'mission_completed'});
const verify=(history,target)=>context.UXQ_WG_assess_(history,incoming(target));
assert.equal(verify([mission('S1','w1',2)],'w2').missing,'studio');
assert.equal(verify([mission('S1','w1',2),artifact('S1','w1','')],'w2').missing,'reflection');
assert.equal(verify([mission('S1','w1',2),artifact('S1','w1','My original reflection')],'w2').ok,true);
assert.equal(verify([mission('S1','w1',2),artifact('S1','w1','A'),artifact('S1','w1','')],'w2').missing,'reflection');
assert.equal(verify([mission('S1','w1',2),{...artifact('S1','w1','Yes'),section:'101'}],'w2').missing,'studio');
assert.equal(verify([mission('S1','w1',2),{...artifact('S1','w1','Yes'),studentid:'S2'}],'w2').missing,'studio');
assert.equal(verify([mission('S1','w1',2),{...artifact('S1','w1','Yes'),courseid:'other'}],'w2').missing,'studio');
assert.equal(verify([mission('S1','w1',2),artifact('S1','w1','Yes')],'w3').blockedBy,'w2');
assert.equal(verify([], 'w1').ok,true);
assert.equal(verify([], 'w99').ok,false);
// A synthesized reflection column without an authored artifact field must not pass.
assert.equal(verify([mission('S1','w1',2),row('S1','w1','artifact_submitted',{reflection:'system autofill'})],'w2').missing,'reflection');

const progressSource=script('apps-script/UXQuestIndividualProgress-v1.gs');
vm.runInContext(progressSource,context);
const teacherRows=[
 {studentid:'S1',studentname:'Student S1',section:'201',courseid:'UXQ-ACT1-2026',
  missionid:'w1',eventtype:'mission_completed',passed:'true',stars:'2'}
];
const output=context.UXQ_ipBuild_(teacherRows,[],[],'201');
assert.equal(output.students[0].nodes.w1.status,'passed');
assert.equal(output.students[0].nodes.w2.accessStatus,'locked');
assert.equal(output.students[0].courseCompletedCount,0);
const full=context.UXQ_ipBuild_(teacherRows.concat([
 {studentid:'S1',studentname:'Student S1',section:'201',courseid:'UXQ-ACT1-2026',
  missionid:'w1',eventtype:'artifact_submitted',rawjson:JSON.stringify({
   artifactFields:[{key:'reflection',value:'Self-written reflection'}]})}
]),[],[],'201');
assert.equal(full.students[0].courseCompletedCount,1);
assert.equal(full.students[0].nodes.w2.accessStatus,'ready');

const confirmation=script('apps-script/UXQuestStudioConfirmationProductionPatch-v2.gs');
assert.match(confirmation,/reflectionEvidence/);
assert.match(confirmation,/explicit_artifact_field/);
assert.doesNotMatch(confirmation,/node\.reflectionSubmitted = Boolean\(String\(reflection/);
const direct=script('js/uxq-three-part-unlock-guard-v1.js');
assert.match(direct,/uxq_student_studio_progress/);
assert.match(direct,/canonicalPassedMissionIds/);
assert.match(direct,/reflectionEvidence==='explicit_artifact_field'/);
const hub=script('js/uxq-mission-control-unlock-policy-v1.js');
assert.match(hub,/missionUnlocked=index<=unlockedUntil/);
assert.doesNotMatch(hub,/missionUnlocked=index===0\|\|Boolean\(previous\?\.mission\)/);
const receiver=script('apps-script/UXQuestStudentReceiver-v4-Artifacts.gs');
assert.match(receiver,/UXQ_WG_check_\(sheet, row\)/);
assert.match(receiver,/if \(UXQ_hasEvent_\(sheet, row\.eventId\)\)/);
for(const f of ['js/uxq-three-part-unlock-guard-v1.js',
 'js/uxq-mission-control-unlock-policy-v1.js',
 'js/uxq-studio-status-v1.js','js/uxq-three-part-restore-authority-v1.js',
 'js/uxq-three-part-completion-v1.js',
 'apps-script/UXQuestStudentReceiver-v4-Artifacts.gs',
 'apps-script/UXQuestStudioConfirmationProductionPatch-v2.gs']){
 new vm.Script(script(f));
}
console.log('PASS: 3/3 write/restore/unlock rules, strict section, historical preservation, and source syntax');
