(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el;
const RELEASE='20260731-BALANCE-CLASSROOM-SUMMARY-PASSPORT-V52';
let finished=false;
let lastPoseReadyAt=0;
let completionPayload=null;

function textNumber(node){return Number(String(node?.textContent||'').replace(/[^0-9.]/g,''))||0}
function isPlay(){return String(s.phase||'').toLowerCase()==='play'}
function hasRound(){return !!s.startedAt&&Array.isArray(s.sequence)&&s.sequence.length>0}
function isLastPose(){return hasRound()&&Number(s.index)>=s.sequence.length-1}
function query(){return new URLSearchParams(location.search)}
function identity(){
  const q=query();
  return {
    studentId:q.get('studentId')||q.get('sid')||q.get('pid')||s.ctx?.studentId||'',
    studentName:q.get('studentName')||q.get('fullName')||q.get('name')||q.get('nick')||s.ctx?.studentName||'',
    section:q.get('section')||s.ctx?.section||'',
    group:q.get('group')||q.get('classId')||s.ctx?.classId||'',
    zone:q.get('zone')||'fitness',
    gameId:q.get('gameId')||'balance-hold'
  };
}
function passportUrl(){
  const q=query(),id=identity();
  const raw=q.get('return')||q.get('back')||q.get('hub')||'../HeroHealth_Learning1/index.html';
  try{
    const u=new URL(raw,location.href);
    [['studentId',id.studentId],['studentName',id.studentName],['section',id.section],['group',id.group]].forEach(([k,v])=>{if(v&&!u.searchParams.has(k))u.searchParams.set(k,v)});
    u.searchParams.set('plannerReturn','1');
    u.searchParams.set('completedGame','balance-hold');
    u.searchParams.set('game','balance-hold');
    u.searchParams.set('gameId','balance-hold');
    u.searchParams.set('zone','fitness');
    u.searchParams.set('result','completed');
    u.searchParams.set('passed','1');
    u.searchParams.set('completionRate','100');
    u.searchParams.set('score',String(Number(s.score||0)));
    u.searchParams.set('receipt','balance-v52');
    return u.toString();
  }catch(_){return raw}
}
function makeSummary(){
  let x={};
  try{x=BH.calcSummary?.('completed_v52')||{}}catch(err){console.warn('[BalanceHold V52] calcSummary fallback',err)}
  const total=Math.max(1,Number(x.totalPoses||s.sequence?.length||6));
  const completed=Math.max(total,Number(x.completedPoses||s.results?.length||total));
  return {
    ...x,score:Number(x.score||s.score||0),completedPoses:completed,totalPoses:total,
    completionRate:100,completed:true,passed:true,
    assessmentScore:Number(x.assessmentScore||Math.round((Number(x.poseAccuracy||0)+Number(x.stabilityScore||0)+Number(x.trackingCoverage||0))/3)||100),
    poseAccuracy:Number(x.poseAccuracy||textNumber(e.hudConfidence)||0),
    stabilityScore:Number(x.stabilityScore||textNumber(e.hudStability)||0),
    trackingCoverage:Number(x.trackingCoverage||textNumber(e.hudTracking)||0),
    reason:'completed_v52',classroomSummaryVersion:RELEASE
  };
}
function buildCompletionPayload(x){
  const id=identity();
  return {
    ...x,...id,
    game:'balancehold',routeName:'balancehold',completed:true,passed:true,
    eventId:x.eventId||`HH-game-fitness-balance-hold-${id.studentId||'qa'}-${Date.now()}`,
    inputMode:'fullbody-pose',gameVersion:RELEASE,autoSubmit:true,
    completionPolicy:'one-round-completes',progressionByCompletion:true,
    score:Number(x.score||0),accuracy:Number(x.poseAccuracy||0)
  };
}
function publishCompletion(x){
  completionPayload=completionPayload||buildCompletionPayload(x);
  try{localStorage.setItem('HHA_BALANCE_HOLD_LAST_RESULT',JSON.stringify(completionPayload))}catch(_){}
  try{localStorage.setItem(BH.KEY_LAST||'balance_hold_last',JSON.stringify(completionPayload))}catch(_){}
  try{window.__BALANCE_HOLD_LAST_RESULT__=completionPayload}catch(_){}
  try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:completionPayload},location.origin)}catch(_){}
  try{window.dispatchEvent(new CustomEvent('herohealth:game-complete',{detail:completionPayload}))}catch(_){}
  return completionPayload;
}
function renderPassportSummary(x){
  const overlay=e.resultOverlay;if(!overlay)return;
  overlay.innerHTML=`<section class="modal" style="width:min(92vw,520px);text-align:center;max-height:92vh;overflow:auto;padding:24px;border:4px solid #facc15;border-radius:28px;background:#fff">
    <div style="font-size:64px">🏆</div><h2 style="font-size:clamp(2rem,8vw,3rem);margin:4px 0;color:#059669">Healthy Hero!</h2>
    <div style="font-size:30px;margin-bottom:14px">⭐⭐⭐</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0">
      <div style="padding:14px;border-radius:18px;background:#ecfdf5"><small>คะแนน</small><b style="display:block;font-size:28px;color:#047857">${x.score}</b></div>
      <div style="padding:14px;border-radius:18px;background:#ecfdf5"><small>ความชัด</small><b style="display:block;font-size:28px;color:#047857">${Math.round(x.poseAccuracy)}%</b></div>
      <div style="padding:14px;border-radius:18px;background:#ecfdf5"><small>ความนิ่ง</small><b style="display:block;font-size:28px;color:#047857">${Math.round(x.stabilityScore)}%</b></div>
    </div>
    <p style="font-weight:800;color:#475569">สำเร็จ ${x.completedPoses}/${x.totalPoses} ท่า • การติดตาม ${Math.round(x.trackingCoverage)}%</p>
    <p id="balanceReceiptText" style="font-weight:900;color:#047857">บันทึกผลแล้ว • พร้อมกลับ Passport</p>
    <button id="balancePassportBtn" type="button" style="width:100%;min-height:58px;border:0;border-radius:18px;background:linear-gradient(135deg,#10b981,#06b6d4);color:#fff;font-size:1.25rem;font-weight:900;cursor:pointer">← กลับ Passport</button>
  </section>`;
  overlay.classList.remove('hidden');
  const btn=document.getElementById('balancePassportBtn');
  if(btn)btn.onclick=()=>{
    btn.disabled=true;btn.textContent='กำลังบันทึกผล...';
    const p=publishCompletion(x);
    try{window.parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:p},location.origin)}catch(_){}
    setTimeout(()=>{
      try{
        const parentReturn=window.parent!==window&&window.parent.document?.getElementById('returnBtn');
        if(parentReturn){parentReturn.click();return}
      }catch(_){}
      location.href=passportUrl();
    },900);
  };
}
function hardFinish(){
  if(finished||!hasRound())return;
  finished=true;s.phase='summary';s.gameToken=Number(s.gameToken||0)+1;
  try{BH.stopPoseLoop?.()}catch(_){}try{BH.stopCamera?.()}catch(_){}
  const x=makeSummary();publishCompletion(x);renderPassportSummary(x);
  try{BH.submitSummary?.(x)}catch(err){console.warn('[BalanceHold V52] submit deferred',err)}
}
const originalFinish=BH.finish;
BH.finish=reason=>{
  if(finished)return;
  try{
    if(e.pauseBtn)e.pauseBtn.textContent='Ⅱ';
    if(typeof originalFinish==='function')originalFinish(reason);
    if(String(s.phase||'').toLowerCase()==='summary'&&!e.resultOverlay?.classList.contains('hidden')){
      const x=makeSummary();publishCompletion(x);return;
    }
  }catch(err){console.error('[BalanceHold V52] legacy finish bypassed',err)}
  hardFinish();
};
const timer=setInterval(()=>{
  if(finished||!hasRound()||!isPlay())return;
  const completeByIndex=Number(s.index)>=s.sequence.length;
  const completeByUi=isLastPose()&&(textNumber(e.holdText)>=99||Number(s.holdMs||0)>0&&textNumber(e.hudPose)>=6);
  if(completeByIndex){hardFinish();return}
  if(completeByUi){if(!lastPoseReadyAt)lastPoseReadyAt=performance.now();if(performance.now()-lastPoseReadyAt>=500)hardFinish()}
  else lastPoseReadyAt=0;
},160);
window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
console.info('[BalanceHold] Summary + Passport receipt ready',RELEASE);
})();