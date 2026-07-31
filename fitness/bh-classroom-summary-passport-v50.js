(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el;
const RELEASE='20260731-BALANCE-CLASSROOM-SUMMARY-PASSPORT-V51';
let finished=false;
let lastPoseReadyAt=0;
let roundStarted=false;

function textNumber(node){return Number(String(node?.textContent||'').replace(/[^0-9.]/g,''))||0}
function isPlay(){return String(s.phase||'').toLowerCase()==='play'}
function hasActiveRound(){return isPlay()&&Array.isArray(s.sequence)&&s.sequence.length>0&&Number(s.startedAt||0)>0}
function isLastPose(){return hasActiveRound()&&Number(s.index)>=s.sequence.length-1}
function passportUrl(){
  const q=new URLSearchParams(location.search);
  const raw=q.get('return')||q.get('back')||q.get('hub')||'../HeroHealth_Learning1/index.html';
  try{
    const u=new URL(raw,location.href);
    [['studentId',q.get('studentId')||q.get('sid')||q.get('pid')],['studentName',q.get('studentName')||q.get('name')||q.get('nick')],['section',q.get('section')],['group',q.get('group')]].forEach(([k,v])=>{if(v&&!u.searchParams.has(k))u.searchParams.set(k,v)});
    u.searchParams.set('plannerReturn','1');u.searchParams.set('completedGame','balancehold');u.searchParams.set('game','balancehold');u.searchParams.set('gameId','balancehold');u.searchParams.set('zone','fitness');u.searchParams.set('result','completed');u.searchParams.set('score',String(Number(s.score||0)));
    return u.toString();
  }catch(_){return raw}
}
function makeSummary(){
  let x={};try{x=BH.calcSummary?.('completed_v51')||{}}catch(err){console.warn('[BalanceHold V51] calcSummary fallback',err)}
  const total=Math.max(1,Number(x.totalPoses||s.sequence?.length||6));
  const completed=Math.min(total,Math.max(0,Number(x.completedPoses||s.results?.length||total)));
  return {...x,score:Number(x.score||s.score||0),completedPoses:completed,totalPoses:total,completionRate:Math.round(completed/total*100),passed:completed>=total,poseAccuracy:Number(x.poseAccuracy||textNumber(e.hudConfidence)||0),stabilityScore:Number(x.stabilityScore||textNumber(e.hudStability)||0),trackingCoverage:Number(x.trackingCoverage||textNumber(e.hudTracking)||0),reason:'completed_v51',classroomSummaryVersion:RELEASE};
}
function renderPassportSummary(x){
  const overlay=e.resultOverlay;if(!overlay)return;
  overlay.innerHTML=`<section class="modal" style="width:min(92vw,520px);text-align:center;max-height:92vh;overflow:auto;padding:24px;border:4px solid #facc15;border-radius:28px;background:#fff"><div style="font-size:64px">🏆</div><h2 style="font-size:clamp(2rem,8vw,3rem);margin:4px 0;color:#059669">Healthy Hero!</h2><div style="font-size:30px;margin-bottom:14px">⭐⭐⭐</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0"><div style="padding:14px;border-radius:18px;background:#ecfdf5"><small>คะแนน</small><b style="display:block;font-size:28px;color:#047857">${x.score}</b></div><div style="padding:14px;border-radius:18px;background:#ecfdf5"><small>ความชัด</small><b style="display:block;font-size:28px;color:#047857">${Math.round(x.poseAccuracy)}%</b></div><div style="padding:14px;border-radius:18px;background:#ecfdf5"><small>ความนิ่ง</small><b style="display:block;font-size:28px;color:#047857">${Math.round(x.stabilityScore)}%</b></div></div><p style="font-weight:800;color:#475569">สำเร็จ ${x.completedPoses}/${x.totalPoses} ท่า • การติดตาม ${Math.round(x.trackingCoverage)}%</p><p style="font-weight:900;color:#047857">เล่นครบ 1 รอบ • พร้อมกลับ Passport</p><button id="balancePassportBtn" type="button" style="width:100%;min-height:58px;border:0;border-radius:18px;background:linear-gradient(135deg,#10b981,#06b6d4);color:#fff;font-size:1.25rem;font-weight:900;cursor:pointer">← กลับ Passport</button></section>`;
  overlay.classList.remove('hidden');
  document.getElementById('balancePassportBtn')?.addEventListener('click',()=>{location.href=passportUrl()},{once:true});
}
function hardFinish(){
  if(finished||!roundStarted)return;
  finished=true;s.phase='summary';s.gameToken=Number(s.gameToken||0)+1;
  try{BH.stopPoseLoop?.()}catch(_){}try{BH.stopCamera?.()}catch(_){}
  const x=makeSummary();
  try{localStorage.setItem(BH.KEY_LAST||'balance_hold_last',JSON.stringify(x))}catch(_){}
  renderPassportSummary(x);
  Promise.resolve().then(()=>BH.submitSummary?.(x)).catch(err=>console.warn('[BalanceHold V51] submit deferred',err));
  try{window.dispatchEvent(new CustomEvent('herohealth:game-complete',{detail:{gameId:'balancehold',zone:'fitness',score:x.score,completed:true,passed:true,summary:x}}))}catch(_){}
}
const originalStartGame=BH.startGame;
BH.startGame=(...args)=>{finished=false;lastPoseReadyAt=0;roundStarted=true;return originalStartGame?.(...args)};
const originalFinish=BH.finish;
BH.finish=reason=>{
  if(finished)return;
  if(!roundStarted||!hasActiveRound())return originalFinish?.(reason);
  try{if(e.pauseBtn)e.pauseBtn.textContent='Ⅱ';if(typeof originalFinish==='function')originalFinish(reason);if(String(s.phase||'').toLowerCase()==='summary'&&!e.resultOverlay?.classList.contains('hidden'))return}catch(err){console.error('[BalanceHold V51] legacy finish bypassed',err)}
  hardFinish();
};
const timer=setInterval(()=>{
  if(finished||!roundStarted||!hasActiveRound()){lastPoseReadyAt=0;return}
  const completeByIndex=s.sequence.length>0&&Number(s.index)>=s.sequence.length;
  const completeByUi=isLastPose()&&textNumber(e.holdText)>=99;
  if(completeByIndex){hardFinish();return}
  if(completeByUi){if(!lastPoseReadyAt)lastPoseReadyAt=performance.now();if(performance.now()-lastPoseReadyAt>=500)hardFinish()}else lastPoseReadyAt=0;
},160);
window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
console.info('[BalanceHold] Summary + Passport guard ready',RELEASE);
})();