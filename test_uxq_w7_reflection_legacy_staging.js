/* Synthetic contract test: read-only checks, no live Student Receiver calls.
 * Run: node test_uxq_w7_reflection_legacy_staging.js
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname;
function file(p){return fs.readFileSync(path.join(root,p),'utf8');}
const order=['W1','W2','W3','B1','W4','W5','W6','W7','B2','W8','W9',
 'W10','W11','B3','W12','W13','W14','B4','W15'];
const nodes=order.map(id=>({id,title:'Teaching mission '+id,focus:'Study '+id,
 artifact:'Artifact '+id,artifactChecklist:['evidence','rationale','decision','test'],
 missionRounds:['1','2','3','4','5']}));
const canonical={window:{
 CSAI2601_UXQ_CANONICAL_CONTENT_V1:{version:'test',nodes},
 CSAI2601_UXQ_CANONICAL_SNAPSHOT_V1:{version:'test',nodes}
}};
vm.runInNewContext(file('sgnal-hunt/js/uxq-course-alignment-bridge-v1.js'),canonical);
const pack=canonical.window.CSAI2601_UXQ_STUDIO_PRACTICE_V1;
assert.equal(pack.items.length,19);
assert.deepEqual(Array.from(pack.items,x=>x.id),order);
for(const item of pack.items){
 const names=Array.from(item.fields,x=>x.key);
 assert.equal(names.at(-1),'reflection',item.id+' missing final Reflection');
 assert.equal(names.filter(k=>k==='reflection').length,1,item.id+' duplicate Reflection');
 assert.equal(item.fields.at(-1).required,true,item.id+' Reflection not required');
 assert.ok(item.reflectionPrompt.length>=30,item.id+' missing learner prompt');
 assert.equal(names.length,9,item.id+' reflection ninth for four task groups');
}
// These are the fields actually present in older W7 studio submissions.
const five={
 fiveScreens:'A clear five-screen main user flow design',
 gridSpacing:'Consistent layout and spacing between cards',
 visualHierarchy:'Hierarchy prioritizes the user goal and task',
 ctaPlacement:'Calls to action remain visible on mobile',
 mobileConsideration:'Mobile first adaptation for all five screens'
};
const callbacks={};
const localStorage={getItem(){return null},setItem(){},removeItem(){}};
const doc={
 readyState:'loading',
 addEventListener(type,cb){callbacks[type]=cb},
 querySelector(){return null}
};
const win={
 UXQIdentity:{get(){return {studentId:'SYNTH',studentName:'QA',section:'201'}}},
 UXQ_CLASSROOM_CONFIG:{courseId:'UXQ-ACT1-2026',defaultSection:'201'},
 UXQProgress:{get(){return {missions:{w7:{lastResult:{total:5,score:900,
   stars:2,passed:true,correct:4,accuracy:80}}}}}},
 addEventListener(){}
};
const sandbox={
 window:win,document:doc,location:{search:'?node=W7',href:'https://test.invalid/w7'},
 localStorage,URLSearchParams,Date,Math,Intl,JSON,Object,Array,Number,String,
 MutationObserver:class{observe(){}},setTimeout(){},clearTimeout(){},
 navigator:{onLine:false}
};
vm.runInNewContext(file('sgnal-hunt/js/uxq-w7-production-hardening-v2.js'),sandbox);
const legacy=win.UXQW7ProductionV2;
assert.ok(legacy,'W7 legacy module missing');
const authored='I revised the visual hierarchy after checking the user task and will validate it with a real user.';
const payload=legacy.artifactPayload({...five,reflection:authored});
assert.equal(payload.eventType,'artifact_submitted');
assert.equal(payload.reflection,authored,'must read standalone authored field');
assert.equal(payload.learnedPoint,authored);
assert.equal(payload.artifactFields.length,6,'five Studio evidence + authored Reflection');
assert.equal(payload.artifactFields[5].key,'reflection');
assert.equal(payload.artifactFields[5].value,authored);
assert.notEqual(payload.reflection,Object.values(five).join(' | '),'never synthesize Reflection');
// Never assume a previous five-field W7 Studio contains a validated Reflection.
const oldFields=Object.entries(five).map(([key,value])=>({key,value}));
assert.equal(oldFields.filter(x=>x.key==='reflection').length,0);
// Validate click blocking when student did not type an independent Reflection.
const evidence=Object.values(five).map(value=>({value}));
const artifact={
 dataset:{},querySelector(sel){
   if(sel==='[data-w7-weekly-reflection]')return {value:''};
   if(sel==='[data-studio-key="reflection"]')return null;
   return null;
 },querySelectorAll(){return evidence}
};
let prevented=0,stopped=0;
const button={disabled:false,closest(selector){
 if(selector==='[data-save-artifact]')return this;
 if(selector==='.artifact[data-studio-practice-v1]')return null;
 if(selector==='.artifact')return artifact;
 return null;
}};
doc.querySelector=function(sel){
 if(sel==='.artifact:not([data-studio-practice-v1])')return artifact;
 if(sel==='.artifact')return artifact;
 if(sel==='[data-save-status]')return {dataset:{},textContent:''};
 return null;
};
callbacks.click({target:button,preventDefault(){prevented++},stopImmediatePropagation(){stopped++}});
assert.equal(prevented,1);
assert.equal(stopped,1);
assert.equal(button.disabled,false,'missing Reflection must not dispatch');
// Guard against overriding the current canonical 19-node Studio submit button.
const canonicalArtifact={dataset:{studioPracticeV1:'1'},querySelector(){return null}};
const canonicalButton={closest(selector){
 if(selector==='[data-save-artifact]')return this;
 if(selector==='.artifact[data-studio-practice-v1]')return canonicalArtifact;
 if(selector==='.artifact')return canonicalArtifact;
 return null;
}};
callbacks.click({target:canonicalButton,preventDefault(){throw Error('canonical blocked')},
 stopImmediatePropagation(){throw Error('canonical blocked')}});
console.log('PASS: 19/19 canonical explicit Reflections; old W7 authored field, no auto-reflection, blank blocked, canonical untouched');
