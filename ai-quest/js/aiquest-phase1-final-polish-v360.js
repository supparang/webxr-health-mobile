(function(){
  'use strict';
  const VERSION='v4.2.4-s2-thai418-loader';
  const STATE_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const PROFILE_KEY='CSAI2102_AIQUEST_PROFILE_V420';
  const $=id=>document.getElementById(id);
  const clean=v=>String(v||'').trim();
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(_){return {}}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function installStorage(){
    if(window.AIQuestStorage && window.AIQuestStorage.__v421)return;
    const getProfile=()=>{const p=read(PROFILE_KEY);if(p.studentId)return p;const s=read(STATE_KEY);return s.profile||s.student||{studentId:s.studentId||'',studentName:s.studentName||s.name||'',section:s.section||'101'};};
    const saveProfile=input=>{const p={studentId:clean(input?.studentId),studentName:clean(input?.studentName||input?.name),section:'101',updatedAt:new Date().toISOString()};if(!p.studentId||!p.studentName)return p;write(PROFILE_KEY,p);const s=read(STATE_KEY);s.studentId=p.studentId;s.studentName=p.studentName;s.name=p.studentName;s.section='101';s.profile=p;s.student=p;write(STATE_KEY,s);return p;};
    window.AIQuestStorage={__v421:true,getProfile,saveProfile,isProfileReady:p=>{p=p||getProfile();return !!(clean(p.studentId)&&clean(p.studentName));},uid:(q='id')=>q+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,10)};
  }
  function isTeacher(){try{return new URLSearchParams(location.search).get('teacher')==='1'||/Teacher Mode/i.test(document.body.innerText||'');}catch(_){return false;}}
  function passed(id){try{return !!(state.completed[id]||state.stars[id]||state.mastered[id]||Number(state.bestScore[id]||0)>=60);}catch(_){return false;}}
  function phase1Ready(){return ['m1','m2','b1','m3','m4','m5','b2'].every(passed);}
  function load(id,src){if(document.getElementById(id))return;const x=document.createElement('script');x.id=id;x.src=src;x.async=true;document.head.appendChild(x);}
  function refreshProfileUI(){const p=window.AIQuestStorage?.getProfile?.()||{};if($('studentIdInput')&&!clean($('studentIdInput').value))$('studentIdInput').value=p.studentId||'';if($('studentNameInput')&&!clean($('studentNameInput').value))$('studentNameInput').value=p.studentName||'';if($('sectionInput'))$('sectionInput').value='101';try{window.updateProfileStatus?.();window.refreshStudentProgressPanel?.(false);}catch(_) {}}
  function loadStudentTools(){
    if(isTeacher())return;
    load('aiquestDirectCloudV421','./js/aiquest-direct-cloud-v421.js?v=20260701-cloud421');
    load('aiquestS6AccessGateV412','./js/aiquest-s6-access-gate-v412.js?v=20260701-s6access412');
    load('aiquestS6ResultSyncV415','./js/aiquest-s6-result-sync-v415.js?v=20260701-s6sync415');
    load('aiquestThaiFirstSearchV418','./js/aiquest-search-knowledge-gameplay-v410.js?v=20260702-thai418');
    load('aiquestS2BossFeedbackPauseV1','./js/aiquest-s2-boss-feedback-pause-v1.js?v=20260702-s2bossfeedback2');
  }
  function normalize(){if(!isTeacher())return;Array.from(document.querySelectorAll('span,div,td,p,li')).forEach(el=>{if(/^Misconception:\s*automation$/i.test(String(el.textContent||'').trim()))el.textContent='Focus: automation';});}
  function refresh(){installStorage();loadStudentTools();refreshProfileUI();normalize();}
  window.AIQUEST_PHASE1_FINAL_POLISH={version:VERSION,refresh,phase1Ready};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,350));else setTimeout(refresh,350);
  setInterval(refresh,1200);
  console.log('[AIQuest] '+VERSION+' loaded');
})();