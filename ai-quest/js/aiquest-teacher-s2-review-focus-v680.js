/* CSAI2102 Teacher Review Focus v6.8.2
   Maintains S2 skill review focus and loads both S2 and Core reflection-evidence overlays.
*/
(()=>{'use strict';
  if(window.__AIQUEST_TEACHER_REVIEW_FOCUS_V682__)return;
  window.__AIQUEST_TEACHER_REVIEW_FOCUS_V682__=true;
  const runtime=()=>window.AIQUEST_TEACHER_SAFE_V533||window.AIQUEST_TEACHER_SAFE_V532||null;
  const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
  const parse=value=>{if(!value)return null;if(typeof value==='object')return value;try{return JSON.parse(String(value));}catch(e){return null;}};
  const stamp=attempt=>Date.parse(String(attempt?.serverTs||attempt?.clientTs||attempt?.timestamp||''))||0;
  const isS2=attempt=>String(attempt?.sessionId||attempt?.missionId||'').trim().toLowerCase()==='s2';
  const PREFIX='S2 Skill review: ';
  function latestS2Meta(student){
    const attempts=(student?.attempts||[]).filter(isS2).slice().sort((a,b)=>stamp(b)-stamp(a));
    for(const attempt of attempts){for(const candidate of [attempt.extraJson,attempt.extra,attempt.metrics,attempt.detail,attempt.payload]){const meta=parse(candidate);if(meta?.s2Skills&&typeof meta.s2Skills==='object')return meta;}}
    return null;
  }
  function label(skill){const map={'PEAS ครบองค์ประกอบ':'PEAS Board','Sensor / Actuator':'Sensor / Actuator','Performance measure':'Performance Measure','Rational action':'Rational Action','Human oversight':'Human Oversight','Trade-off':'Safety Trade-off','Scope boundary':'Scope Boundary','Human override':'Human Override','Audit trail':'Audit Trail','Agent test':'Agent Testing'};return map[skill]||skill;}
  function lines(student){
    const meta=latestS2Meta(student);if(!meta)return [];
    return Object.entries(meta.s2Skills||{})
      .filter(([,row])=>row&&num(row.total)>0&&num(row.correct)<num(row.total))
      .sort((a,b)=>(num(a[1].correct)/Math.max(1,num(a[1].total)))-(num(b[1].correct)/Math.max(1,num(b[1].total))))
      .slice(0,3)
      .map(([skill,row])=>PREFIX+label(skill)+' '+num(row.correct)+'/'+num(row.total));
  }
  function apply(){
    const students=runtime()?.state?.students;if(!Array.isArray(students)||!students.length)return;
    let changed=false;
    students.forEach(student=>{const old=Array.isArray(student.risks)?student.risks.map(String):[],keep=old.filter(item=>!item.startsWith(PREFIX)&&item!=='คะแนนล่าสุดควรทบทวน'),derived=lines(student),next=[...derived,...keep];if(next.join('|')!==old.join('|')){student.risks=next;changed=true;}});
    if(changed){const search=document.getElementById('studentSearch');if(search&&typeof search.oninput==='function')search.oninput();}
  }
  function load(id,src,flag){
    if(window[flag]||document.getElementById(id))return;
    const script=document.createElement('script');script.id=id;script.src=src;script.async=false;document.head.appendChild(script);
  }
  function loadEvidenceOverlays(){
    load('aiquestTeacherS2ReviewEvidenceV681','./js/aiquest-teacher-s2-reflection-evidence-v681.js?v=20260707-s2evidence681','__AIQUEST_TEACHER_S2_REFLECTION_EVIDENCE_V681__');
    load('aiquestTeacherCoreReflectionEvidenceV676','./js/aiquest-teacher-core-reflection-evidence-v676.js?v=20260707-coreevidence676','__AIQUEST_TEACHER_CORE_REFLECTION_EVIDENCE_V676__');
  }
  const state=document.getElementById('loadState');if(state)new MutationObserver(()=>setTimeout(apply,80)).observe(state,{childList:true,characterData:true,subtree:true});
  setInterval(apply,300);apply();loadEvidenceOverlays();
})();