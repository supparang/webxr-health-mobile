(function(){
'use strict';
const VERSION='2026-08-14-BONUS-REWARD-FIRST20-V2-BLIND-CREATE';
const COLLECTION='ewp_bonus_rewards';
let installed=false;
const clean=v=>String(v==null?'':v).trim();

function waitForAuthority(){
  return new Promise((resolve,reject)=>{
    let n=0;const tick=()=>{
      if(window.EW_AUTHORITY?.submitEvent&&window.firebase?.firestore)return resolve();
      if(++n>120)return reject(new Error('BONUS_REWARD_AUTHORITY_TIMEOUT'));
      setTimeout(tick,50);
    };tick();
  });
}
async function readSession(playerId){
  const db=firebase.firestore();
  const snap=await db.collection('ewp_progress').doc(playerId).get();
  if(!snap.exists)throw new Error('BONUS_REWARD_PROGRESS_NOT_FOUND');
  const p=snap.data()||{};
  const sessionId=clean(p.attendanceSessionId||p.sessionId||'');
  if(!sessionId)throw new Error('BONUS_REWARD_SESSION_REQUIRED');
  return {sessionId,progress:p};
}
async function createOnce(ref,data){
  try{
    await ref.set(data);
    return {created:true};
  }catch(writeError){
    // Firestore Rules intentionally deny student UPDATEs on reward records.
    // Therefore an idempotent replay may fail here because the immutable record already exists.
    // Only then is GET safe: an existing document has resource.data.playerId for owns(...).
    try{
      const snap=await ref.get();
      if(snap.exists)return {created:false,row:{id:snap.id,...(snap.data()||{})}};
    }catch(_){}
    throw writeError;
  }
}
async function register(payload){
  const playerId=clean(payload?.playerId);if(!playerId)throw new Error('BONUS_REWARD_PLAYER_REQUIRED');
  const {sessionId}=await readSession(playerId);
  const db=firebase.firestore();
  const rewardId=`${sessionId}__${playerId}`;
  const ref=db.collection(COLLECTION).doc(rewardId);
  const body={
    rewardId,playerId,sessionId,
    nickname:clean(payload?.nickname||payload?.fullName||playerId),
    bonusScore:Math.max(0,Math.min(100,Math.round(Number(payload?.score||0)))),
    completed:true,
    firstCompletedAt:firebase.firestore.FieldValue.serverTimestamp(),
    rewardClaimed:false,
    source:'lexicon_lens_hunt',sourceVersion:VERSION,
    createdAt:firebase.firestore.FieldValue.serverTimestamp()
  };
  const createdResult=await createOnce(ref,body);
  let row=createdResult.row||null;
  if(!row){
    const snap=await ref.get();
    row=snap.exists?{id:snap.id,...(snap.data()||{})}:null;
  }
  window.dispatchEvent(new CustomEvent('ew-bonus-reward-registered',{detail:{created:createdResult.created,row,version:VERSION}}));
  return {ok:true,created:createdResult.created,row,sessionId,rewardId};
}
async function install(){
  if(installed)return;await waitForAuthority();
  const authority=window.EW_AUTHORITY;
  const original=authority.submitEvent.bind(authority);
  const wrapped=Object.freeze({...authority,submitEvent:async payload=>{
    const result=await original(payload);
    if(payload?.eventName==='lens_result_summary'&&payload?.playerId){
      try{
        const body=payload.payload||{};
        await register({playerId:payload.playerId,nickname:body.nickname,score:body.score});
      }catch(error){
        console.error('[LEXICON X] Bonus reward registration failed',error);
        result.rewardError=String(error?.message||error);
      }
    }
    return result;
  }});
  window.EW_AUTHORITY=wrapped;
  installed=true;
  console.info('[LEXICON X] Bonus Reward First-20 V2 ready');
}
install().catch(error=>console.error('[LEXICON X] Bonus Reward bootstrap failed',error));
window.EW_BONUS_REWARD=Object.freeze({version:VERSION,register});
})();