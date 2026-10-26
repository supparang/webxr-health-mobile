/* Reproduction of the real W1 screen: eight Studio chips visible, Reflection
 * is the ninth field in rawJson. Run: node test_uxq_reflection_field_over_eight.js
 * ALL data are synthetic. This performs no Sheets writes or user-data edits.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.join(__dirname,'sgnal-hunt','apps-script');
const ctx=vm.createContext({Date,Number,String,JSON,Object,Array,Math});
vm.runInContext(fs.readFileSync(path.join(dir,'UXQuestIndividualProgress-v1.gs'),'utf8'),ctx);
const core=Array.from({length:8},(_,i)=>({
  key:'field'+i,label:'Studio evidence '+(i+1),value:i===3?'':'Filled evidence '+i,
  required:true
}));
const reflect=(v)=>({key:'reflection',label:'Weekly Reflection',value:v,required:true});
const mk=(sid,type,additional={})=>({
 studentid:sid,studentname:'Synthetic '+sid,section:'201',
 courseid:'UXQ-ACT1-2026',missionid:'w1',eventtype:type,
 receivedat:'2026-10-26T10:00:00Z',...additional
});
const mission=(sid)=>mk(sid,'mission_completed',{passed:'true',stars:'3',score:'1440'});
const studio=(sid,params)=>mk(sid,'artifact_submitted',params);
const rows=[
  mission('nine'),
  studio('nine',{rawjson:JSON.stringify({artifactFields:core.concat(reflect('My own W1 reflection'))})}),
  mission('column'),
  studio('column',{
    rawjson:JSON.stringify({artifactFields:core}),
    artifactfields:JSON.stringify(core.concat(reflect('Column-authored reflection')))
  }),
  mission('fallback'),
  studio('fallback',{
    rawjson:JSON.stringify({artifactFields:core}),
    reflection:'Observed problem | Rewritten reason | Retested',
    problemseen:'Observed problem',uxreason:'Rewritten reason',fixandtest:'Retested'
  }),
  mission('no-reflection'),
  studio('no-reflection',{rawjson:JSON.stringify({artifactFields:core})}),
  mission('newer-blank'),
  studio('newer-blank',{rawjson:JSON.stringify({artifactFields:core.concat(reflect('Old actual reflection'))})}),
  studio('newer-blank',{rawjson:JSON.stringify({artifactFields:core.concat(reflect(''))}),reflection:'Receiver fallback'}),
  {...studio('wrong-section',{rawjson:JSON.stringify({artifactFields:core.concat(reflect('Private'))})}),section:'101'}
];
const saved=JSON.stringify(rows);
const result=ctx.UXQ_ipBuild_(rows,[],[],'201');
assert.equal(JSON.stringify(rows),saved,'never mutate source Sheet rows');
assert.equal(result.nodes.length,19);
const m=Object.fromEntries(result.students.map(x=>[x.studentId,x.nodes.w1]));
const lookup=Object.fromEntries(result.students.map(x=>[x.studentId,x]));
assert.ok(!m['wrong-section'],'strict Section isolation');
assert.equal(m.nine.reflectionStatus,'submitted');
assert.equal(m.nine.reflectionSubmitted,true);
assert.equal(m.nine.partsCompleted,3);
assert.equal(m.nine.fullThreePart,true);
assert.equal(lookup.nine.nodes.w2.accessStatus,'ready');
assert.equal(m.nine.studioFields.length,9);
assert.equal(m.nine.studioFields[8].key,'reflection','ninth field no longer hidden');
assert.equal(m.nine.studioFields[8].filled,true);
assert.equal(m.nine.requiredMissing.includes('Weekly Reflection'),false);
assert.equal(m.column.reflectionStatus,'submitted','second column contains full explicit Reflection');
assert.equal(m.column.partsCompleted,3);
assert.equal(m.column.studioFields.length,9);
assert.equal(m.column.studioFields[8].filled,true);
assert.equal(m.fallback.reflectionStatus,'unverified','receiver synthesized top-level reflection is not enough');
assert.equal(m.fallback.partsCompleted,2);
assert.equal(lookup.fallback.nodes.w2.accessStatus,'locked');
assert.equal(m['no-reflection'].reflectionStatus,'missing');
assert.equal(m['no-reflection'].partsCompleted,2);
assert.equal(m['newer-blank'].reflectionStatus,'unverified','newer artifact overrides an older completed Reflection');
assert.equal(m['newer-blank'].partsCompleted,2);
assert.equal(result.reflectionAudit.explicitButNotCounted,0);
assert.equal(result.reflectionAudit.counts.explicit,2);
assert.equal(result.reflectionAudit.counts.field_empty_but_text,1);
assert.equal(result.reflectionAudit.counts.top_level_only,1);
const outputJSON=JSON.stringify(result);
assert.doesNotMatch(outputJSON,/My own W1 reflection|Column-authored reflection|Old actual reflection|Receiver fallback/,
  'Teacher dashboard receives presence/category, not Reflection response text');
const html=fs.readFileSync(path.join(dir,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
for(const p of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(p[1]);
console.log('PASS: ninth Reflection, column fallback, 2/3→3/3, W2 access, no synthetic false credit, history/privacy');
