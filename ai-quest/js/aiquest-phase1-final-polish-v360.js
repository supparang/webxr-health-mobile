(function(){
  'use strict';
  const VERSION='v4.1.9-inline-profile-hardfix';
  const STATE_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const BACKUP_KEY='AIQUEST_PROFILE_BACKUP_V419';
  const $=id=>document.getElementById(id);
  const clean=v=>String(v||'').trim();
  const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch(_){return {}}};
  const write=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  function isTeacher(){try{return new URLSearchParams(location.search).get('teacher')==='1'||/Teacher Mode/i.test(document.body.innerText||'');}catch(_){return false;}}
  function passed(id){try{return !!(state.completed[id]||state.stars[id]||state.mastered[id]||Number(state.bestScore[id]||0)>=60);}catch(_){return false;}}
  function phase1Ready(){return ['m1','m2','b1','m3','m4','m5','b2'].every(passed);}
  function load(id,src){if(document.getElementById(id))return;const x=document.createElement('script');x.id=id;x.src=src;x.async=true;document.head.appendChild(x);}
  function saveProfile(ev){
    const btn=ev.target?.closest?.('#btnSaveProfile'); if(!btn)return;
    ev.preventDefault(); ev.stopImmediatePropagation();
    const studentId=clean($('studentIdInput')?.value),studentName=clean($('studentNameInput')?.value),status=$('profileStatus');
    if(!studentId||!studentName){if(status)status.textContent='กรอก Student ID และ Name ให้ครบก่อนบันทึก';return;}
    const profile={studentId,studentName,name:studentName,section:'101',savedAt:new Date().toISOString()};
    const s=read(STATE_KEY);
    s.studentId=studentId;s.studentName=studentName;s.name=studentName;s.section='101';s.profile=profile;s.student=profile;
    write(STATE_KEY,s);write(BACKUP_KEY,profile);write('AIQUEST_PROFILE',profile);write('CSAI2102_AIQUEST_PROFILE',profile);
    if($('sectionInput'))$('sectionInput').value='101';
    if(status)status.textContent='บันทึก Profile แล้ว: '+studentId+' • '+studentName;
    btn.textContent='Saved ✓';btn.disabled=true;
    setTimeout(()=>location.reload(),300);
  }
  function restoreProfile(){
    const p=read(BACKUP_KEY);if(!p?.studentId)return;
    if($('studentIdInput')&&!clean($('studentIdInput').value))$('studentIdInput').value=p.studentId;
    if($('studentNameInput')&&!clean($('studentNameInput').value))$('studentNameInput').value=p.studentName||p.name;
    if($('sectionInput'))$('sectionInput').value='101';
  }
  function bindProfile(){if(isTeacher())return;restoreProfile();document.removeEventListener('click',saveProfile,true);document.addEventListener('click',saveProfile,true);}
  function loadStudentTools(){if(isTeacher())return;load('aiquestS6AccessGateV412','./js/aiquest-s6-access-gate-v412.js?v=20260701-s6access412');load('aiquestS6ResultSyncV415','./js/aiquest-s6-result-sync-v415.js?v=20260701-s6sync415');}
  function normalize(){if(!isTeacher())return;Array.from(document.querySelectorAll('span,div,td,p,li')).forEach(el=>{if(/^Misconception:\s*automation$/i.test(String(el.textContent||'').trim())){el.textContent='Focus: automation';}});}
  function refresh(){bindProfile();loadStudentTools();normalize();}
  window.AIQUEST_PHASE1_FINAL_POLISH={version:VERSION,refresh,phase1Ready};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(refresh,350));else setTimeout(refresh,350);
  setInterval(refresh,1200);
  console.log('[AIQuest] '+VERSION+' loaded');
})();