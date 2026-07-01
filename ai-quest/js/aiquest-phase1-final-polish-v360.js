(function(){
  'use strict';
  const VERSION='v4.2.0-storage-runtime-repair';
  const STATE_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const PROFILE_KEY='CSAI2102_AIQUEST_PROFILE_V420';
  const $=id=>document.getElementById(id);
  const clean=v=>String(v||'').trim();
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(_){return {}}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));

  /* The current student index calls AIQuestStorage but did not load its runtime.
     Restore that runtime here so the original inline saveStudentProfile() works. */
  function installStorage(){
    if(window.AIQuestStorage && window.AIQuestStorage.__v420) return;
    const getProfile=()=>{
      const p=read(PROFILE_KEY);
      if(p.studentId) return p;
      const s=read(STATE_KEY);
      return s.profile||s.student||{studentId:s.studentId||'',studentName:s.studentName||s.name||'',section:s.section||'101'};
    };
    const saveProfile=(input)=>{
      const profile={studentId:clean(input?.studentId),studentName:clean(input?.studentName||input?.name),section:'101',updatedAt:new Date().toISOString()};
      if(!profile.studentId||!profile.studentName) return profile;
      write(PROFILE_KEY,profile);
      const s=read(STATE_KEY);
      s.studentId=profile.studentId;s.studentName=profile.studentName;s.name=profile.studentName;s.section='101';s.profile=profile;s.student=profile;
      write(STATE_KEY,s);
      return profile;
    };
    window.AIQuestStorage={__v420:true,getProfile,saveProfile,isProfileReady:(p)=>{p=p||getProfile();return !!(clean(p.studentId)&&clean(p.studentName)&&String(p.section||'101')==='101');}};
  }

  function isTeacher(){try{return new URLSearchParams(location.search).get('teacher')==='1'||/Teacher Mode/i.test(document.body.innerText||'');}catch(_){return false;}}
  function passed(id){try{return !!(state.completed[id]||state.stars[id]||state.mastered[id]||Number(state.bestScore[id]||0)>=60);}catch(_){return false;}}
  function phase1Ready(){return ['m1','m2','b1','m3','m4','m5','b2'].every(passed);}
  function load(id,src){if(document.getElementById(id))return;const x=document.createElement('script');x.id=id;x.src=src;x.async=true;document.head.appendChild(x);}

  function refreshProfileUI(){
    const p=window.AIQuestStorage?.getProfile?.()||{};
    if($('studentIdInput')&&!clean($('studentIdInput').value))$('studentIdInput').value=p.studentId||'';
    if($('studentNameInput')&&!clean($('studentNameInput').value))$('studentNameInput').value=p.studentName||'';
    if($('sectionInput'))$('sectionInput').value='101';
    try{window.refreshStudentProgressPanel?.(false);}catch(_){}
  }

  function loadStudentTools(){
    if(isTeacher())return;
    load('aiquestS6AccessGateV412','./js/aiquest-s6-access-gate-v412.js?v=20260701-s6access412');
    load('aiquestS6ResultSyncV415','./js/aiquest-s6-result-sync-v415.js?v=20260701-s6sync415');
  }
  function normalize(){if(!isTeacher())return;Array.from(document.querySelectorAll('span,div,td,p,li')).forEach(el=>{if(/^Misconception:\s*automation$/i.test(String(el.textContent||'').trim()))el.textContent='Focus: automation';});}
  function refresh(){installStorage();refreshProfileUI();loadStudentTools();normalize();}
  window.AIQUEST_PHASE1_FINAL_POLISH={version:VERSION,refresh,phase1Ready};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,350));else setTimeout(refresh,350);
  setInterval(refresh,1200);
  console.log('[AIQuest] '+VERSION+' loaded');
})();