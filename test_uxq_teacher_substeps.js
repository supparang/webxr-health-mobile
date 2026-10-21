/* Run from repo root: node test_uxq_teacher_substeps.js */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const folder=path.join(__dirname,'sgnal-hunt','apps-script');
const context=vm.createContext({Date,Number,String,JSON,Object,Array,Math});
vm.runInContext(fs.readFileSync(path.join(folder,'UXQuestIndividualProgress-v1.gs'),'utf8'),context);
const mission=(id,node,passed,stars,extras={})=>({
  studentid:id,studentname:'Student '+id,section:'201',courseid:'UXQ-ACT1-2026',
  missionid:node,eventtype:'mission_completed',passed:String(passed),stars:String(stars),
  receivedat:'2026-10-21T09:00:00+07:00',...extras
});
const artifact=(id,node,eventid,fields,extras={})=>({
  studentid:id,studentname:'Student '+id,section:'201',courseid:'UXQ-ACT1-2026',
  missionid:node,eventtype:'artifact_submitted',eventid,
  rawjson:JSON.stringify({artifactFields:fields}),...extras
});
const dataset=[
  mission('A','w1',false,2,{rawjson:JSON.stringify({answers:[
    {stageKey:'evidence',correct:true,verified:true},
    {stageKey:'fix',correct:true,verified:false},
    {stageKey:'fix',correct:false,verified:false}
  ]})}),
  {studentid:'A',studentname:'Student A',section:'201',courseid:'UXQ-ACT1-2026',
    missionid:'w1',eventtype:'reason_retry_submitted',reasonretrysubmittedat:'2026-10-21'},
  artifact('A','w1','a-v1',[
    {key:'figmaUrl',label:'Figma',required:true,value:'https://figma.com/example'},
    {key:'reflection',label:'Reflection',required:true,value:''},
    {key:'evidence',label:'Evidence',required:true,value:'Observed tapping'},
  ],{reflection:'auto-generated fallback; must NOT count as student reflection'}),
  artifact('B','w1','b-v1',[{key:'reflection',label:'Reflection',value:'I learned to retest',required:true}]),
  artifact('C','w1','c-v1',[],{reflection:'legacy fallback'}),
  mission('D','w2',true,3),
  mission('E','w1',true,0),
  artifact('E','w1','e-v1',[{key:'reflection',label:'Reflection',value:'Reflective text'}]),
  {...mission('FOREIGN','w1',true,3),section:'101'},
  {...mission('OTHER_COURSE','w1',true,3),courseid:'CSAI2102'}
];
const reviews=[
  {studentid:'B',section:'201',missionid:'w1',artifacteventid:'b-v1',reviewstatus:'approved',totalscore:'85'},
  {studentid:'C',section:'201',missionid:'w1',artifacteventid:'older-event',reviewstatus:'approved',totalscore:'97'}
];
const output=context.UXQ_ipBuild_(dataset,reviews,
  [{studentid:'NOATTEMPT',studentname:'Absent',section:'201'}],'201');
const s=Object.fromEntries(output.students.map(x=>[x.studentId,x]));
assert.equal(output.nodes.length,19);
assert.equal(s.A.nodes.w1.status,'passed','2 stars confirms mission');
assert.equal(s.A.nodes.w1.partsCompleted,2,'reflection fallback is not sufficient');
assert.equal(s.A.nodes.w1.reflectionSubmitted,false);
assert.equal(s.A.nodes.w1.reflectionStatus,'missing');
assert.equal(s.A.nodes.w1.studioFields.length,3);
assert.equal(s.A.nodes.w1.requiredMissing[0],'Reflection');
assert.equal(s.A.nodes.w1.missionStages.length,2);
assert.equal(s.A.nodes.w1.missionQuestions,3);
assert.equal(s.A.nodes.w1.missionVerified,1);
assert.equal(s.A.nodes.w1.reasonRetryCount,1);
assert.equal(s.B.nodes.w1.partsCompleted,2,'Studio + reflection recorded, but game not passed');
assert.equal(s.B.nodes.w1.reviewStatus,'approved');
assert.equal(s.C.nodes.w1.reflectionStatus,'unverified','ambiguous legacy reflection');
assert.equal(s.C.nodes.w1.reviewStatus,'submitted','stale review cannot approve a newer artifact');
assert.equal(s.D.nodes.w2.status,'out_of_sequence','W2 cannot count before W1');
assert.equal(s.D.nodes.w2.partsCompleted,0);
assert.equal(s.E.nodes.w1.fullThreePart,true);
assert.equal(s.E.fullThreePartCount,1);
assert.equal(s.NOATTEMPT.nodes.w1.status,'ready');
assert.equal(s.FOREIGN,undefined,'section must remain isolated');
assert.equal(s.OTHER_COURSE,undefined,'course must remain isolated');
const html=fs.readFileSync(path.join(folder,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
for(const match of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);
assert.match(html,/renderSubDetail/);
assert.match(html,/เหตุผลผ่าน/);
assert.match(html,/0\/3–3\/3/);
console.log('PASS: 19 nodes, 3-part substeps, answer stages, Studio fields, explicit Reflection, review freshness, and privacy');
