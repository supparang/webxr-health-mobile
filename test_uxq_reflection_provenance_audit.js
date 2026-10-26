/* Run: node test_uxq_reflection_provenance_audit.js
 * Teacher-only synthetic read-only diagnostic QA.
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=path.join(__dirname,'sgnal-hunt','apps-script');
const ctx=vm.createContext({Date,Number,String,JSON,Object,Array,Math,RegExp});
vm.runInContext(fs.readFileSync(path.join(dir,'UXQuestIndividualProgress-v1.gs'),'utf8'),ctx);
const mk=(student,mission,overrides={})=>({
  studentid:student,studentname:'Student '+student,
  section:'201',courseid:'UXQ-ACT1-2026',missionid:mission,
  eventtype:'artifact_submitted',eventid:student+mission,
  receivedat:'2026-10-26T10:00:00Z',...overrides
});
const artifact=fields=>JSON.stringify({artifactFields:fields});
const field=value=>[{key:'reflection',label:'Reflection',value}];
const rows=[
  mk('A','w1',{rawjson:artifact(field('Original reflection by student'))}),
  mk('B','w1',{artifactfields:JSON.stringify(field('Original from column'))}),
  mk('C','w1',{reflection:'observed | reasoned | revised',
    problemseen:'observed',uxreason:'reasoned',fixandtest:'revised'}),
  mk('D','w1',{rawjson:artifact(field(''))}),
  mk('E','w1',{rawjson:artifact(field('')),reflection:'Old top-level reflection'}),
  mk('F','w1',{rawjson:'{}'}),
  mk('G','w1',{rawjson:'not-json',artifactfields:'not-json'}),
  mk('H','w1',{rawjson:artifact(field('')),artifactfields:JSON.stringify(field('Present in independent column'))}),
  mk('I','w1',{rawjson:artifact(field('Earlier authored reflection'))}),
  mk('I','w1',{rawjson:'{}',reflection:'later top-level text'}),
  mk('OTHER','w1',{section:'101',rawjson:artifact(field('not from this section'))}),
  mk('OTHER_COURSE','w1',{courseid:'CSAI2102',rawjson:artifact(field('not from this course'))})
];
const result=ctx.UXQ_ipBuild_(rows,[],[],'201');
const a=result.reflectionAudit,student=Object.fromEntries(result.students.map(s=>[s.studentId,s]));
assert.equal(result.studentCount,9);
assert.equal(a.studentCount,9);
assert.equal(a.submissionRows,10);
assert.equal(a.latestSubmittedNodeCount,9);
assert.equal(a.counts.explicit,3);
assert.equal(a.counts.field_empty_but_text,1);
assert.equal(a.counts.explicit_field_empty,1);
assert.equal(a.counts.top_level_only,2);
assert.equal(a.counts.unreadable,1);
assert.equal(a.counts.missing,1);
assert.equal(a.possibleReceiverFallbackCount,1);
assert.equal(a.explicitSources.rawFields,1);
assert.equal(a.explicitSources.sheetFields,2);
assert.equal(a.byNode.length,19);
assert.equal(a.byNode[0].missionId,'w1');
assert.equal(a.byNode[0].submitted,9);
assert.equal(student.I.nodes.w1.reflectionEvidenceAudit.type,'top_level_only','latest appended submission controls audit');
assert.equal(student.C.nodes.w1.reflectionEvidenceAudit.mayBeSynthesized,true,'receiver-synthesized text is ambiguous');
assert.equal(student.A.nodes.w1.reflectionEvidenceAudit.source,'raw_artifactFields');
assert.equal(student.B.nodes.w1.reflectionEvidenceAudit.source,'sheet_artifactFields');
assert.equal(student.H.nodes.w1.reflectionEvidenceAudit.source,'sheet_artifactFields');
assert.equal(student.D.nodes.w1.reflectionSubmitted,false);
assert.equal(student.F.nodes.w1.reflectionSubmitted,false);
assert.equal(a.diagnosticOnly,true);

const html=fs.readFileSync(path.join(dir,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(script.length,1);
const ui={};
function el(id){return ui[id]||(ui[id]={value:id==='section'?'201':'',
  textContent:'',innerHTML:'',hidden:false,disabled:false,listeners:{},
  addEventListener(type,fn){this.listeners[type]=fn},scrollIntoView(){}})}
const document={getElementById:el};
const google={script:{run:{withSuccessHandler(fn){this.success=fn;return this},
  withFailureHandler(fn){this.failure=fn;return this},
  UXQ_ipGetDashboard(){this.success(result)}}}};
new vm.Script(script[0][1]).runInNewContext({window:{google},document,google});
assert.match(el('reflectionAuditSummary').innerHTML,/ช่อง Reflection/);
assert.match(el('reflectionAuditNodes').innerHTML,/W1/);
assert.match(el('reflectionAuditSource').textContent,/10/);
assert.doesNotMatch(el('reflectionAuditSummary').innerHTML,/Original reflection by student/,
  'never display student response text in cohort audit');
el('student').value='201|C';
el('student').listeners.change.call(el('student'));
assert.match(el('subReflectionProvenance').textContent,/ข้อความตรงกับรูปแบบที่ Receiver อาจสร้างขึ้น/);
assert.doesNotMatch(el('subReflectionProvenance').textContent,/observed \| reasoned \| revised/);
console.log('PASS: Reflection provenance, raw vs column, synthesized top-level text, latest submission, cohort counts, privacy & dashboard');
