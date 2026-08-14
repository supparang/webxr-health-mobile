(()=>{
'use strict';
const VERSION='2026-08-14-QA-BONUS-REWARD-REPAIR-V4-PASS80';
const BONUS_PASS=80;
const clean=v=>String(v==null?'':v).trim();
let busy=false,lastPlayer='';
function readIdentity(){
  try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
}
function isQa(id){return /^(QA|TEST)[-_]/i.test(clean(id))||/^99\d{4,}$/.test(clean(id))}
async function createOnce(ref,data){
  try{
    await ref.set(data);
    return {created:true};
  }catch(writeError){
    try{
      const snap=await ref.get();
      if(snap.exists)return {created:false,row:{id:snap.id,...(snap.data()||{})}};
    }catch(_){}
    throw writeError;
  }
}
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
    const progressSnap=await db.collection('ewp_progress').doc(playerId).get();
    if(!progressSnap.exists)throw new Error('QA_REWARD_PROGRESS_NOT_FOUND');
    const rawProgress=progressSnap.data()||{};
    const sessionId=clean(rawProgress.attendanceSessionId||rawProgress.checkInSessionId||rawProgress.cohortId||rawProgress.roundId||rawProgress.sessionId);
    if(!sessionId)throw new Error('QA_REWARD_SESSION_REQUIRED');
    const summarySnap=await db.collection('ewp_game_summary').doc(playerId).get();
    const best=summarySnap.exists?(summarySnap.data()||{}).bonusBest:null;
    const score=Math.max(0,Math.min(100,Math.round(Number(best?.score))));
    if(!Number.isFinite(score))throw new Error('QA_REWARD_BONUS_SCORE_REQUIRED');
    if(score<BONUS_PASS){
      lastPlayer=playerId;
      console.info('[LEXICON X] QA bonus below reward threshold',playerId,score,'<',BONUS_PASS);
      return false;
    }
    const rewardId=`${sessionId}__${playerId}`;
    const ref=db.collection('ewp_bonus_rewards').doc(rewardId);
    const result=await createOnce(ref,{
      rewardId,playerId,sessionId,
      nickname:clean(identity?.nickname||identity?.fullName||playerId),
      bonusScore:score,
      bonusPassThreshold:BONUS_PASS,
      completed:true,
      firstCompletedAt:firebase.firestore.FieldValue.serverTimestamp(),
      rewardClaimed:false,
      source:'qa_bonus_reward_repair',
      sourceVersion:VERSION,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
    lastPlayer=playerId;
    try{window.EW_BONUS_FIRESTORE_SYNC?.invalidate?.();await window.EW_BONUS_FIRESTORE_SYNC?.sync?.();}catch(_){}
    window.dispatchEvent(new CustomEvent('ew-bonus-reward-registered',{detail:{playerId,sessionId,rewardId,repaired:true,created:result.created,version:VERSION,threshold:BONUS_PASS}}));
    console.info('[LEXICON X] QA bonus reward ready',rewardId,result.created?'created':'existing','pass >=80%');
    return true;
  }catch(error){console.warn('[LEXICON X] QA bonus reward repair failed',error);return false;}
  finally{busy=false;}
}
const schedule=()=>setTimeout(()=>{void repair();},500);
addEventListener('pageshow',schedule);
addEventListener('focus',schedule);
addEventListener('ew-authority-status',schedule);
setTimeout(()=>{void repair();},900);
window.EW_QA_BONUS_REWARD_REPAIR=Object.freeze({version:VERSION,threshold:BONUS_PASS,repair});
})();