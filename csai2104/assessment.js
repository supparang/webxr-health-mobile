/* CSAI2401 local practice assessment: structural checks only.
 * This module is NOT an official score authority; browser state is editable.
 */
(function(root,factory){
 'use strict';
 const curriculum=(root&&root.CSAICurriculum)||(typeof module==='object'&&module.exports&&typeof require==='function'?require('./curriculum.js'):null);
 const api=factory(curriculum);
 if(typeof module==='object'&&module.exports)module.exports=api;
 else if(root)root.CSAIAssessment=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(curriculum){
 'use strict';
 const VERSION='20261030-local-assessment-v1';
 const GATE_LABELS={
  need:'ความต้องการของผู้มีส่วนได้ส่วนเสีย',requirement:'ข้อกำหนดที่ตรวจสอบได้',acceptance:'เกณฑ์การยอมรับ',
  reproduction:'ขั้นตอนทำซ้ำข้อบกพร่อง', 'injected-failure':'การจำลองความล้มเหลว',
  'root-cause':'สาเหตุราก', regression:'การทดสอบป้องกันปัญหาซ้ำ',
  traceability:'ความเชื่อมโยงข้อกำหนดกับหลักฐาน','release-decision':'Go / Pilot / No-Go พร้อมเหตุผล',
  rollback:'แผนย้อนกลับ',monitoring:'แผนติดตามระบบ',
  'privacy-security':'ความเป็นส่วนตัวและความมั่นคงปลอดภัย',
  'human-oversight':'การกำกับดูแลโดยมนุษย์','residual-risk':'ความเสี่ยงคงเหลือ'
 };
 function weekData(n){
  if(!Number.isInteger(Number(n))||Number(n)<1||Number(n)>15)return null;
  return curriculum&&Array.isArray(curriculum.weeks)?curriculum.weeks.find(w=>w.week===Number(n))||null:null;
 }
 function scenarioData(week,scenarioId){
  const w=weekData(week);
  return w&&Array.isArray(w.scenarios)?w.scenarios.find(s=>s.id===scenarioId)||null:null;
 }
 function scoreStep(week,scenarioId,stepIndex,optionId,evidenceRefs){
  const scenario=scenarioData(week,scenarioId),step=scenario&&scenario.steps[Number(stepIndex)];
  if(!step||!Number.isInteger(Number(stepIndex)))return {ok:false,reason:'unknown-scenario-or-step'};
  const option=step.options.find(o=>o.id===String(optionId));
  if(!option)return {ok:false,reason:'invalid-option-id'};
  if(!Array.isArray(evidenceRefs))return {ok:false,reason:'evidence-required'};
  const allowed=new Set(scenario.evidence.map(e=>e.id));
  const refs=[...new Set(evidenceRefs.map(String))];
  if(!refs.some(ref=>allowed.has(ref)))return {ok:false,reason:'scenario-evidence-required'};
  if(refs.some(ref=>!allowed.has(ref)&&!ref.startsWith('limitation:')))return {ok:false,reason:'invalid-evidence-ref'};
  const limitations=refs.filter(ref=>ref.startsWith('limitation:')).map(ref=>ref.slice('limitation:'.length).trim());
  if(!limitations.some(v=>v.length>=8&&v.length<=1000))return {ok:false,reason:'limitation-required'};
  if(refs.length>10)return {ok:false,reason:'too-many-evidence-refs'};
  return {ok:true,score:option.score,evidenceRefs:refs};
 }
 function validateGateEvidence(week,scenarioId,pack){
  const w=weekData(week);
  if(!w)return {ok:false,reason:'unknown-week',missingTags:[]};
  if(!w.gate)return {ok:true,normalized:null,missingTags:[]};
  const scenario=scenarioData(week,scenarioId);
  if(!scenario)return {ok:false,reason:'unknown-scenario',missingTags:w.gate.requiredEvidenceTags.slice()};
  const available=new Set(scenario.evidence.map(e=>e.id));
  const entries=pack&&typeof pack==='object'&&!Array.isArray(pack)?pack:{};
  const normalized={};const missingTags=[];const seen=new Set();
  for(const tag of w.gate.requiredEvidenceTags){
   const value=entries[tag];const statement=value&&typeof value.statement==='string'?value.statement.trim():'';
   const sourceId=value&&typeof value.sourceId==='string'?value.sourceId.trim():'';
   const unique=statement&&!seen.has(statement);
   if(statement.length<24||statement.length>1200||!available.has(sourceId)||!unique){
    missingTags.push(tag);continue;
   }
   seen.add(statement);
   normalized[tag]={statement,sourceId};
  }
  return missingTags.length?
   {ok:false,reason:'gate-evidence-incomplete',missingTags}:
   {ok:true,normalized,missingTags:[]};
 }
 return Object.freeze({VERSION,GATE_LABELS,weekData,scenarioData,scoreStep,validateGateEvidence});
});
