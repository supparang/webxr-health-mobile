(function(){
'use strict';
const VERSION='2026-08-14-BONUS-REWARD-FIRST20-V3-PASS80';
const COLLECTION='ewp_bonus_rewards';
const BONUS_PASS=80;
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
    try{
      const snap=await ref.get();
      if(snap.exists)return {created:false,row:{id:snap.id,...(snap.data()||{})}};
    }catch(_){}
    throw writeError;
  }
}
async function register(payload){
  const playerId=clean(payload?.playerId);if(!playerId)throw new Error('BONUS_REWARD_PLAYER_REQUIRED');
  const score=Math.max(0,Math.min(100,Math.round(Number(payload?.score||0))));
  if(!Number.isFinite(score)||score<BONUS_PASS){
    return {ok:true,created:false,eligible:false,reason:'BONUS_SCORE_BELOW_80',score,threshold:BONUS_PASS};
  }
  const {sessionId}=await readSession(playerId);
  const db=firebase.firestore();
  const rewardId=`${sessionId}__${playerId}`;
  const ref=db.collection(COLLECTION).doc(rewardId);
  const body={
    rewardId,playerId,sessionId,
    nickname:clean(payload?.nickname||payload?.fullName||playerId),
    bonusScore:score,
    bonusPassThreshold:BONUS_PASS,
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
  window.dispatchEvent(new CustomEvent('ew-bonus-reward-registered',{detail:{created:createdResult.created,row,version:VERSION,threshold:BONUS_PASS}}));
  return {ok:true,created:createdResult.created,eligible:true,row,sessionId,rewardId,threshold:BONUS_PASS};
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
        const reward=await register({playerId:payload.playerId,nickname:body.nickname,score:body.score});
        result.rewardEligible=reward.eligible===true;
        result.rewardThreshold=BONUS_PASS;
      }catch(error){
        console.error('[LEXICON X] Bonus reward registration failed',error);
        result.rewardError=String(error?.message||error);
      }
    }
    return result;
  }});
  window.EW_AUTHORITY=wrapped;
  installed=true;
  console.info('[LEXICON X] Bonus Reward First-20 V3 ready • pass >=80%');
}
install().catch(error=>console.error('[LEXICON X] Bonus Reward bootstrap failed',error));
window.EW_BONUS_REWARD=Object.freeze({version:VERSION,threshold:BONUS_PASS,register});
})();