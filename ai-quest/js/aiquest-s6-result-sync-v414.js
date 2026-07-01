/* CSAI2102 AI Quest — S6 Result Sync v4.1.4
   Uses the proven direct Apps Script POST pattern used by AR bridges.
   Captures S6 result before the normal save handler returns to the menu.
*/
(() => {
  'use strict';
  const VERSION = 'v4.1.4-s6-direct-post';
  const STORAGE_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const RECEIPT_KEY = 'AIQUEST_S6_ATTEMPT_SYNC_V414';
  const FALLBACK_ENDPOINT = 'https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';

  function json(key){ try{return JSON.parse(localStorage.getItem(key)||'null');}catch(_){return null;} }
  function state(){ return json(STORAGE_KEY)||{}; }
  function n(v){ const x=Number(v); return Number.isFinite(x)?x:0; }
  function s(v){ return String(v==null?'':v); }
  function endpoint(){
    try { return window.AIQuestDataContract?.loadConfig?.().appsScriptUrl || FALLBACK_ENDPOINT; }
    catch(_) { return FALLBACK_ENDPOINT; }
  }
  function profile(st){
    try {
      const p=window.AIQuestStorage?.getProfile?.()||{};
      if(p.studentId) return p;
    } catch(_) {}
    return {
      studentId:st.studentId||st.profile?.studentId||'',
      studentName:st.studentName||st.profile?.studentName||st.name||'',
      section:st.section||st.profile?.section||'101'
    };
  }
  function resultScore(){ return n(document.getElementById('resultScore')?.textContent); }
  function resultStars(){ return (String(document.getElementById('resultStars')?.textContent||'').match(/★/g)||[]).length; }
  function currentS6(st){
    const heading=s(document.getElementById('resultHeading')?.textContent).toLowerCase();
    return /knowledge base|s6|session 6/.test(heading) || !!(st.completed&&st.completed.m6) || n(st.bestScore?.m6)>0;
  }
  function token(payload){ return ['s6',payload.studentId,payload.score,payload.stars,payload.clientTs].join('|'); }
  function show(message, ok){
    const box=document.getElementById('saveStatusBox');
    if(box) box.textContent='Save Status: '+message;
    if(typeof window.showToast==='function') window.showToast(message);
    console.log('[AIQuest S6 Sync]',ok?'OK':'WARN',message);
  }
  function payload(){
    const st=state();
    const p=profile(st);
    const last=st.lastRun||st.lastResult||st.currentResult||{};
    const total=n(last.total||last.questionTotal||st.s6Total);
    const correct=n(last.correct||last.correctCount||st.s6Correct);
    const score=resultScore()||n(st.bestScore?.m6)||n(last.score);
    const stars=resultStars()||n(st.stars?.m6);
    return {
      attemptId:'s6_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10),
      studentId:s(p.studentId), studentName:s(p.studentName), section:'101',
      sessionId:'s6', missionId:'m6', missionTitle:'Knowledge Base Forge',
      difficulty:s(st.difficulty||'easy'), score, stars,
      mastered:!!(st.mastered&&st.mastered.m6)||score>=85,
      usedTimeSec:n(last.usedTimeSec||last.usedSec||st.bestTime?.m6), timeLeftSec:n(last.timeLeftSec),
      accuracy:total>0?Math.round(correct*100/total):'', correct,total,
      wrong:total>0?Math.max(0,total-correct):0, maxCombo:n(last.maxCombo), helpUsed:n(last.helpUsed),
      trickCorrect:n(last.trickCorrect), trickTotal:n(last.trickTotal), explainCorrect:n(last.explainCorrect), explainTotal:n(last.explainTotal), bossWin:false,
      reflection1:s(document.getElementById('ref1')?.value), reflection2:s(document.getElementById('ref2')?.value), reflection3:s(document.getElementById('ref3')?.value),
      clientTs:new Date().toISOString(), userAgent:navigator.userAgent, pageUrl:location.href,
      schemaVersion:VERSION, gateStatus:score>=85?'mastered':'passed', submitStatus:'submitted', isPractice:false, isGraded:true
    };
  }
  async function submit(){
    const st=state();
    if(!currentS6(st)) return false;
    const p=payload();
    if(!p.studentId){ show('S6 ยังไม่พบ Student Profile จึงยังส่งไม่ได้',false); return false; }
    if(!p.score && !p.stars && !(st.completed&&st.completed.m6)){ show('ยังไม่พบผล S6 สำหรับส่ง',false); return false; }
    const sig=token(p);
    const old=json(RECEIPT_KEY)||{};
    if(old.sig===sig && old.status==='queued') return true;
    show('กำลังส่งผล S6 เข้า Google Sheets…',false);
    try{
      await fetch(endpoint(),{
        method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,
        headers:{'Content-Type':'text/plain;charset=UTF-8'},
        body:JSON.stringify({action:'sync_v23',kind:'attempt',payload:p})
      });
      localStorage.setItem(RECEIPT_KEY,JSON.stringify({sig,status:'queued',attemptId:p.attemptId,at:new Date().toISOString(),version:VERSION}));
      show('S6 ส่งข้อมูลเข้า Teacher แล้ว',true);
      return true;
    }catch(err){
      console.warn('[AIQuest S6 Sync] failed',err);
      localStorage.setItem(RECEIPT_KEY,JSON.stringify({sig,status:'failed',error:String(err),at:new Date().toISOString(),version:VERSION}));
      show('S6 ส่งไม่สำเร็จ ระบบเก็บไว้ให้ลองส่งใหม่',false);
      return false;
    }
  }
  document.addEventListener('click',(ev)=>{
    const btn=ev.target?.closest?.('#btnSaveResult');
    if(!btn) return;
    submit();
  },true);
  window.AIQuestS6ResultSyncV414={submit};
  console.log('[AIQuest] '+VERSION+' loaded');
})();