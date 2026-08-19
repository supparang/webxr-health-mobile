(function(){
'use strict';
const VERSION='2026-08-19-BONUS-SYNC-ULTRALIGHT-V2-RESTORE-ON-RESUME';
const SUMMARY='ewp_game_summary',REWARDS='ewp_bonus_rewards',SESSIONS='ewp_player_sessions';
const clean=v=>String(v==null?'':v).trim();
function identity(){try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}}
function bestKey(id){return `ew_bonus_lens_best::${id}`}
function rewardKey(id){return `ew_bonus_reward_cache_v1::${id}`}
function read(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(_){return null}}
function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
function decorate(){
  const id=clean(identity()?.playerId),card=document.querySelector('.stage-card[data-stage="bonus_lens"]');if(!id||!card)return;
  const best=read(bestKey(id)),reward=read(rewardKey(id));const detail=card.querySelector('div:nth-child(2)>small'),state=card.querySelector('.stage-state');
  const base='Bonus Mission • QR Clue • 20 คนแรก/รอบมีรางวัล • ไม่บังคับ Certificate';
  if(best?.score!=null){
    const score=Number(best.score)||0,rank=Number(reward?.rewardRank||0);
    if(detail)detail.textContent=`${base} • ดีที่สุด ${score}%`;
    if(state)state.textContent=reward?.rewardClaimed===true?'🎁 รับรางวัลแล้ว ✓':reward?.rewardEligible===true&&rank?`🎁 อันดับ #${rank} • มารับรางวัล`:`โบนัส ${score}% ✓`;
  }
}
async function currentSessionId(id,db,summaryData){
  try{
    const uid=window.firebase?.auth?.().currentUser?.uid||'';
    if(uid){
      const snap=await db.collection(SESSIONS).doc(uid).get();
      const data=snap.exists?(snap.data()||{}):{};
      if(clean(data.playerId)===id){
        const sid=clean(data.attendanceSessionId||data.checkInSessionId||data.sessionId||data.sessionCode||data.roundId||data.round);
        if(sid)return sid;
      }
    }
  }catch(error){console.warn('EW bonus session restore failed',error)}
  return clean(
    summaryData?.attendanceSessionId||summaryData?.sessionId||
    read('LEXICON_X_ATTENDANCE_CHECKIN_V2')?.attendanceSessionId||
    read('ew_current_session')?.sessionId
  );
}
async function refreshAfterBonus(){
  const who=identity(),id=clean(who?.playerId);if(!id||!window.firebase?.firestore)return;
  try{
    const db=firebase.firestore();
    const s=await db.collection(SUMMARY).doc(id).get();
    const data=s.exists?(s.data()||{}):{};
    if(data.bonusBest)write(bestKey(id),data.bonusBest);
    const sessionId=await currentSessionId(id,db,data);
    if(sessionId){
      const r=await db.collection(REWARDS).doc(`${sessionId}__${id}`).get();
      if(r.exists)write(rewardKey(id),{id:r.id,...(r.data()||{})});
    }
    decorate();
  }catch(error){console.warn('EW bonus ultra-light refresh failed',error);decorate()}
}
new MutationObserver(()=>{decorate();}).observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
window.addEventListener('pageshow',()=>{decorate();void refreshAfterBonus();});
window.addEventListener('focus',()=>{void refreshAfterBonus();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void refreshAfterBonus();});
window.addEventListener('ew-bonus-summary-written',refreshAfterBonus);
window.addEventListener('ew-bonus-reward-registered',refreshAfterBonus);
decorate();
setTimeout(()=>{void refreshAfterBonus();},250);
window.EW_BONUS_SYNC_ULTRALIGHT=Object.freeze({version:VERSION,refresh:refreshAfterBonus});
}());
