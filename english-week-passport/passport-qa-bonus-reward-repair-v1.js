(()=>{
'use strict';
const VERSION='2026-08-14-QA-BONUS-REWARD-REPAIR-V2-RAW-PROGRESS';
const clean=v=>String(v==null?'':v).trim();
let busy=false,lastPlayer='';
function readIdentity(){
  try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
}
function isQa(id){return /^(QA|TEST)[-_]/i.test(clean(id))||/^99\d{4,}$/.test(clean(id))}
async function repair(){
  if(busy)return false;
  const identity=readIdentity(),playerId=clean(identity?.playerId);
  if(!playerId||!isQa(playerId)||!window.firebase?.firestore||typeof window.EW_AUTHORITY?.resume!=='function')return false;
  if(lastPlayer===playerId)return false;
  busy=true;
  try{
    const auth=await window.EW_AUTHORITY.resume(playerId,identity?.nickname||identity?.fullName||'');
    if(!auth?.ok)throw new Error(auth?.error||'RESUME_FAILED');
    const db=firebase.firestore();

    // IMPORTANT: EW_AUTHORITY.resume() returns reconciled progress and intentionally
    // strips attendance/session fields. Read the raw Firestore progress document here.
    const progressSnap=await db.collection('ewp_progress').doc(playerId).get();
    if(!progressSnap.exists)throw new Error('QA_REWARD_PROGRESS_NOT_FOUND');
    const rawProgress=progressSnap.data()||{};
    const sessionId=clean(rawProgress.attendanceSessionId||rawProgress.checkInSessionId||rawProgress.cohortId||rawProgress.roundId||rawProgress.sessionId);
    if(!sessionId)throw new Error('QA_REWARD_SESSION_REQUIRED');

    const summarySnap=await db.collection('ewp_game_summary').doc(playerId).get();
    const best=summarySnap.exists?(summarySnap.data()||{}).bonusBest:null;
    const score=Number(best?.score);
    if(!Number.isFinite(score))throw new Error('QA_REWARD_BONUS_SCORE_REQUIRED');

    const rewardId=`${sessionId}__${playerId}`;
    const ref=db.collection('ewp_bonus_rewards').doc(rewardId);
    const existing=await ref.get();
    if(existing.exists){
      lastPlayer=playerId;
      try{window.EW_BONUS_FIRESTORE_SYNC?.invalidate?.();await window.EW_BONUS_FIRESTORE_SYNC?.sync?.();}catch(_){}
      return true;
    }

    await ref.set({
      rewardId,playerId,sessionId,
      nickname:clean(identity?.nickname||identity?.fullName||playerId),
      bonusScore:Math.max(0,Math.min(100,Math.round(score))),
      completed:true,
      firstCompletedAt:firebase.firestore.FieldValue.serverTimestamp(),
      rewardClaimed:false,
      source:'qa_bonus_reward_repair',
      sourceVersion:VERSION,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });

    lastPlayer=playerId;
    try{window.EW_BONUS_FIRESTORE_SYNC?.invalidate?.();await window.EW_BONUS_FIRESTORE_SYNC?.sync?.();}catch(_){}
    window.dispatchEvent(new CustomEvent('ew-bonus-reward-registered',{detail:{playerId,sessionId,rewardId,repaired:true,version:VERSION}}));
    console.info('[LEXICON X] QA bonus reward repaired',rewardId);
    return true;
  }catch(error){console.warn('[LEXICON X] QA bonus reward repair failed',error);return false;}
  finally{busy=false;}
}
const schedule=()=>setTimeout(()=>{void repair();},500);
addEventListener('pageshow',schedule);
addEventListener('focus',schedule);
addEventListener('ew-authority-status',schedule);
setTimeout(()=>{void repair();},900);
window.EW_QA_BONUS_REWARD_REPAIR=Object.freeze({version:VERSION,repair});
})();