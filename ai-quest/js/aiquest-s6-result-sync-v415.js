/* CSAI2102 AI Quest — S6 Result Sync v4.1.5
   Profile recovery + retry queue. Uses the exact direct POST strategy proven by S1 AR.
*/
(() => {
  'use strict';
  const VERSION='v4.1.5-s6-profile-recovery-retry';
  const STATE_KEY='CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const PENDING_KEY='AIQUEST_S6_PENDING_V415';
  const RECEIPT_KEY='AIQUEST_S6_RECEIPT_V415';
  const FALLBACK_ENDPOINT='https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec';
  let busy=false;
  const read=(k)=>{try{return JSON.parse(localStorage.getItem(k)||'null');}catch(_){return null;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}};
  const num=(v)=>{const n=Number(v);return Number.isFinite(n)?n:0;};
  const str=(v)=>String(v==null?'':v);
  const state=()=>read(STATE_KEY)||{};
  function endpoint(){try{return window.AIQuestDataContract?.loadConfig?.().appsScriptUrl||FALLBACK_ENDPOINT;}catch(_){return FALLBACK_ENDPOINT;}}
  function profile(){
    try{const p=window.AIQuestStorage?.getProfile?.()||{};if(p.studentId)return p;}catch(_){}
    const st=state();
    if(st.studentId||st.profile?.studentId)return {studentId:st.studentId||st.profile?.studentId,studentName:st.studentName||st.profile?.studentName||st.name||'',section:st.section||st.profile?.section||'101'};
    try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!/aiquest|profile|classroom/i.test(k))continue;const x=read(k);if(x?.studentId)return x;}}catch(_){}
    return {};
  }
  function onS6Result(){
    const st=state();
    const heading=str(document.getElementById('resultHeading')?.textContent).toLowerCase();
    return /knowledge base|forge|s6|session 6/.test(heading)||!!st.completed?.m6||num(st.bestScore?.m6)>0;
  }
  function build(){
    const st=state(), p=profile(), r=st.lastRun||st.lastResult||st.currentResult||{};
    const score=num(document.getElementById('resultScore')?.textContent)||num(st.bestScore?.m6)||num(r.score);
    const stars=(str(document.getElementById('resultStars')?.textContent).match(/★/g)||[]).length||num(st.stars?.m6);
    const total=num(r.total||r.questionTotal||r.itemsTotal||st.s6Total),correct=num(r.correct||r.correctCount||r.itemsCorrect||st.s6Correct);
    return {attemptId:'s6_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,10),studentId:str(p.studentId),studentName:str(p.studentName||p.name),section:'101',sessionId:'s6',missionId:'m6',missionTitle:'Knowledge Base Forge',difficulty:str(st.difficulty||'normal'),score,stars,mastered:!!st.mastered?.m6||score>=85,usedTimeSec:num(r.usedTimeSec||r.usedSec||st.bestTime?.m6),timeLeftSec:num(r.timeLeftSec),accuracy:total?Math.round(correct*100/total):'',correct,total,wrong:total?Math.max(0,total-correct):0,maxCombo:num(r.maxCombo),helpUsed:num(r.helpUsed),trickCorrect:num(r.trickCorrect),trickTotal:num(r.trickTotal),explainCorrect:num(r.explainCorrect),explainTotal:num(r.explainTotal),bossWin:false,reflection1:str(document.getElementById('ref1')?.value),reflection2:str(document.getElementById('ref2')?.value),reflection3:str(document.getElementById('ref3')?.value),clientTs:new Date().toISOString(),userAgent:navigator.userAgent,pageUrl:location.href,schemaVersion:VERSION,gateStatus:score>=85?'mastered':'passed',submitStatus:'queued',isPractice:false,isGraded:true};
  }
  function status(msg){const b=document.getElementById('saveStatusBox');if(b)b.textContent='Save Status: '+msg;}
  async function send(payload){
    if(!payload?.studentId) return false;
    await fetch(endpoint(),{method:'POST',mode:'no-cors',cache:'no-store',keepalive:true,headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify({action:'sync_v23',kind:'attempt',payload})});
    return true;
  }
  async function flush(){
    if(busy)return false; const pending=read(PENDING_KEY); if(!pending?.payload)return false; busy=true;
    try{await send(pending.payload);write(RECEIPT_KEY,{attemptId:pending.payload.attemptId,status:'queued',at:new Date().toISOString(),version:VERSION});localStorage.removeItem(PENDING_KEY);status('S6 ส่งข้อมูลเข้า Teacher แล้ว');return true;}
    catch(err){write(PENDING_KEY,{...pending,lastError:String(err),retryAt:new Date().toISOString()});status('S6 เก็บคิวไว้ กำลังลองส่งใหม่');return false;}
    finally{busy=false;}
  }
  function queueCurrent(){
    if(!onS6Result())return false;const p=build();
    if(!p.studentId){status('ไม่พบ Student Profile: กรุณากลับเมนู ตรวจ Profile แล้วเปิด S6 ใหม่');return false;}
    if(!p.score&&!p.stars&&!state().completed?.m6){status('ไม่พบผล S6 สำหรับส่ง');return false;}
    write(PENDING_KEY,{payload:p,queuedAt:new Date().toISOString(),version:VERSION});status('กำลังส่งผล S6 เข้า Google Sheets…');flush();return true;
  }
  document.addEventListener('click',(ev)=>{if(ev.target?.closest?.('#btnSaveResult'))queueCurrent();},true);
  setInterval(flush,3500);
  window.addEventListener('online',flush);
  setTimeout(flush,900);
  window.AIQuestS6ResultSyncV415={queueCurrent,flush,profile};
  console.log('[AIQuest] '+VERSION+' loaded');
})();