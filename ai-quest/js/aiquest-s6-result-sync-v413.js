/* CSAI2102 AI Quest — S6 Direct Result Sync v4.1.3
   Sends one explicit S6 core attempt when the learner presses the normal
   result-save button. This closes the gap where S6 local progress updated
   but no session_attempts record was created.
*/
(function(){
  'use strict';
  const KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const RECEIPT='AIQUEST_S6_CORE_SYNC_V413';

  function state(){ try{return JSON.parse(localStorage.getItem(KEY)||'{}');}catch(_){return{};} }
  function clean(v){ return String(v==null?'':v); }
  function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
  function id(){ return 's6_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10); }
  function score(){ return num((document.getElementById('resultScore')||{}).textContent); }
  function stars(){ const s=(document.getElementById('resultStars')||{}).textContent||''; return (s.match(/★/g)||[]).length; }
  function reflection(id){ return clean((document.getElementById(id)||{}).value); }

  async function submit(){
    const st=state();
    const scoreNow=score() || num(st.bestScore&&st.bestScore.m6);
    const starNow=stars() || num(st.stars&&st.stars.m6);
    if(!scoreNow && !starNow && !(st.completed&&st.completed.m6)) return false;

    const token=[clean(st.studentId||st.profile?.studentId),scoreNow,starNow,clean(st.bestTime&&st.bestTime.m6)].join('|');
    if(localStorage.getItem(RECEIPT)===token) return true;

    const total=num(st.lastRun?.total||st.lastResult?.total||0);
    const correct=num(st.lastRun?.correct||st.lastResult?.correct||0);
    const payload={
      attemptId:id(), studentId:clean(st.studentId||st.profile?.studentId||st.id),
      studentName:clean(st.studentName||st.profile?.studentName||st.name), section:'101',
      sessionId:'s6', missionId:'m6', missionTitle:'Knowledge Base Forge',
      difficulty:clean(st.difficulty||'easy'), score:scoreNow, stars:starNow,
      mastered:!!(st.mastered&&st.mastered.m6) || scoreNow>=85,
      usedTimeSec:num(st.lastRun?.usedTimeSec||st.lastResult?.usedTimeSec||st.bestTime?.m6),
      timeLeftSec:0, accuracy: total>0 ? Math.round(correct/total*100) : '',
      correct:correct, total:total, wrong:total>0?Math.max(0,total-correct):0,
      maxCombo:num(st.lastRun?.maxCombo||st.lastResult?.maxCombo), helpUsed:num(st.lastRun?.helpUsed||st.lastResult?.helpUsed),
      bossWin:false, reflection1:reflection('ref1'), reflection2:reflection('ref2'), reflection3:reflection('ref3'),
      clientTs:new Date().toISOString(), userAgent:navigator.userAgent, pageUrl:location.href,
      schemaVersion:'s6-core-sync-v413', gateStatus:(scoreNow>=85?'mastered':'passed')
    };
    try{
      if(window.AIQuestSync && typeof window.AIQuestSync.submitAttempt==='function'){
        await window.AIQuestSync.submitAttempt(payload);
      }else if(window.AIQuestCloudLogger && typeof window.AIQuestCloudLogger.sendAttempt==='function'){
        await window.AIQuestCloudLogger.sendAttempt(payload);
      }else{return false;}
      localStorage.setItem(RECEIPT,token);
      const box=document.getElementById('saveStatusBox'); if(box) box.textContent='Save Status: S6 ส่งหลักฐานเข้า Teacher แล้ว';
      return true;
    }catch(err){
      console.warn('[AIQuest S6 sync]',err);
      return false;
    }
  }

  document.addEventListener('click',function(ev){
    const btn=ev.target&&ev.target.closest&&ev.target.closest('#btnSaveResult');
    if(!btn) return;
    setTimeout(submit,350);
  },true);
  window.AIQuestS6ResultSyncV413={submit};
  console.log('[AIQuest] S6 direct result sync v4.1.3 loaded');
})();