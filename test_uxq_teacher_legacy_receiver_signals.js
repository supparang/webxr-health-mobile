/* Run: node test_uxq_teacher_legacy_receiver_signals.js
 * Read-only synthetic provenance diagnostics. NO student records or network.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const folder=path.join(__dirname,'sgnal-hunt','apps-script');
const context=vm.createContext({Date,Number,String,JSON,Object,Array,Math,RegExp});
vm.runInContext(fs.readFileSync(path.join(folder,'UXQuestIndividualProgress-v1.gs'),'utf8'),context);
const core=Array.from({length:8},(_,i)=>({key:'field_'+i,value:'Student Studio work '+i}));
function row(id,attrs={}) {
  return {studentid:id,studentname:'Synthetic '+id,section:'201',
    courseid:'UXQ-ACT1-2026',missionid:'w1',
    eventtype:'artifact_submitted',...attrs};
}
const events=[
  row('auth',{rawjson:JSON.stringify({artifactFields:[
    ...core,{key:'reflection',value:'Original independently authored text'}
  ]})}),
  row('fallback',{problemseen:'Seen',uxreason:'Reason',fixandtest:'Retested',
    reflection:'Seen | Reason | Retested',rawjson:JSON.stringify({artifactFields:core})}),
  row('rawfallback',{rawjson:JSON.stringify({artifactFields:[],
    problemSeen:'Question',uxReason:'Inference',fixAndTest:'Revision',
    reflection:'Question | Inference | Revision'})}),
  row('capped',{artifactfields:JSON.stringify(core),reflection:'Ambiguous saved text'}),
  row('missingcapped',{rawjson:JSON.stringify({artifactFields:core})}),
  row('top',{rawjson:JSON.stringify({artifactFields:core.slice(0,5),
    reflection:'Unproven separate top-level text'})}),
  row('absent',{rawjson:'{}'}),
  row('invalid',{rawjson:'{broken',artifactfields:'[broken'}),
  row('other',{section:'101',rawjson:JSON.stringify({artifactFields:core})}),
  row('othercourse',{courseid:'CSAI2102',rawjson:JSON.stringify({artifactFields:core})})
];
const originals=JSON.stringify(events);
const data=context.UXQ_ipBuild_(events,[],[],'201');
assert.equal(JSON.stringify(events),originals,'must never change source data');
const by=Object.fromEntries(data.students.map(s=>[s.studentId,s.nodes.w1]));
assert.equal(data.studentCount,8,'isolate section and course');
assert.ok(!by.other && !by.othercourse);
assert.equal(by.auth.reflectionSubmitted,true);
assert.equal(by.auth.reflectionEvidenceAudit.legacySignal,'explicit_field');
assert.equal(by.fallback.reflectionSubmitted,false);
assert.equal(by.fallback.reflectionEvidenceAudit.legacySignal,'matches_legacy_receiver_formula');
assert.equal(by.rawfallback.reflectionEvidenceAudit.legacySignal,'matches_legacy_receiver_formula');
assert.equal(by.capped.reflectionEvidenceAudit.legacySignal,'possible_eight_field_truncation');
assert.equal(by.missingcapped.reflectionEvidenceAudit.legacyEightFieldPossible,true);
assert.equal(by.top.reflectionEvidenceAudit.legacySignal,'unverified_top_level_text');
assert.equal(by.absent.reflectionEvidenceAudit.legacySignal,'no_independent_reflection_field');
assert.equal(by.invalid.reflectionEvidenceAudit.legacySignal,'unreadable');
assert.equal(data.reflectionAudit.legacySignals.matchesReceiverFormula,2);
assert.equal(data.reflectionAudit.legacySignals.possibleEightFieldTruncation,3);
assert.equal(data.reflectionAudit.legacySignals.explicitField,1);
assert.equal(data.reflectionAudit.byNode[0].matchesReceiverFormula,2);
assert.equal(data.reflectionAudit.byNode[0].possibleEightFieldTruncation,3);
assert.equal(data.reflectionAudit.byNode.length,19);
const serialized=JSON.stringify(data);
assert.doesNotMatch(serialized,/Original independently authored text|Seen \| Reason \| Retested|Ambiguous saved text/,
  'dashboard server result must not contain learner Reflection responses');

const html=fs.readFileSync(path.join(folder,'UXQuestIndividualProgressDashboard-v1.html'),'utf8');
assert.match(html,/LEGACY_SIGNAL_LABELS/);
assert.match(html,/ตรงสูตร Receiver รุ่นเก่า/);
const script=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
assert.equal(script.length,1);
const elements={};
function element(id) {
  return elements[id]||(elements[id]={value:id==='section'?'201':'',
    innerHTML:'',textContent:'',hidden:false,disabled:false,callbacks:{},
    addEventListener(type,fn){this.callbacks[type]=fn},scrollIntoView(){}});
}
const google={script:{run:{
  withSuccessHandler(fn){this.success=fn;return this},
  withFailureHandler(fn){this.failure=fn;return this},
  UXQ_ipGetDashboard(params){assert.equal(params.section,'201');this.success(data)}
}}};
new vm.Script(script[0][1]).runInNewContext({
  google,window:{google},document:{getElementById:element}
});
assert.match(element('reflectionAuditSummary').innerHTML,/ตรงสูตร Receiver เก่า/);
assert.match(element('reflectionAuditNodes').innerHTML,/W1/);
assert.match(element('reflectionAuditSource').textContent,/8 ช่อง/);
assert.doesNotMatch(element('reflectionAuditSummary').innerHTML,/Ambiguous saved text/);
element('student').value='201|fallback';
element('student').callbacks.change.call(element('student'));
assert.match(element('subReflectionProvenance').textContent,/Receiver รุ่นเก่า/);
assert.doesNotMatch(element('subReflectionProvenance').textContent,/Seen \| Reason \| Retested/);
console.log('PASS: Receiver formula, cap-8 indicator, authored-only Reflection, Section isolation, no student-text leakage, private UI');
