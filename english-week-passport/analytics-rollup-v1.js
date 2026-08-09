(function(){
'use strict';
const VERSION='2026-08-09-ANALYTICS-ROLLUP-V1';
const SUMMARY='ewp_game_summary';

function num(v,f=0){const n=Number(v);return Number.isFinite(n)?n:f}
function now(){return new Date().toISOString()}
function accuracyFromAssessment(payload){
  if(Number.isFinite(Number(payload?.accuracy))) return Math.max(0,Math.min(100,Math.round(Number(payload.accuracy))));
  const correct=num(payload?.correct,payload?.correctCount);
  const total=num(payload?.total,payload?.totalItems||payload?.questionCount);
  if(total>0) return Math.max(0,Math.min(100,Math.round(correct/total*100)));
  const score=num(payload?.score);
  const maxScore=num(payload?.maxScore||payload?.totalScore);
  if(maxScore>0) return Math.max(0,Math.min(100,Math.round(score/maxScore*100)));
  return 0;
}
function gameDuration(payload){return Math.max(0,Math.round(num(payload?.durationMs)))}
async function summaryRef(playerId){
  if(!window.firebase?.firestore) throw new Error('FIRESTORE_NOT_READY');
  return firebase.firestore().collection(SUMMARY).doc(String(playerId||'').trim());
}
async function rollupAssessment(payload,response){
  if(!response?.ok)return;
  const playerId=String(payload?.playerId||'').trim();
  const type=String(payload?.assessmentType||'').trim().toLowerCase();
  if(!playerId||!['pre','post'].includes(type))return;
  const ref=await summaryRef(playerId),db=firebase.firestore();
  const accuracy=accuracyFromAssessment(payload);
  const durationMs=Math.max(0,Math.round(num(payload?.durationMs||payload?.elapsedMs)));
  const patch={playerId,updatedAt:now(),sourceVersion:VERSION};
  patch[`${type}Accuracy`]=accuracy;
  patch[`${type}DurationMs`]=durationMs;
  patch[`${type}ReceiptId`]=String(response?.receiptId||'');
  patch[`${type}CompletedAt`]=now();
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),data=snap.exists?(snap.data()||{}):{};
    const assessmentAttempts={...(data.assessmentAttempts||{})};
    assessmentAttempts[type]=Math.max(1,num(assessmentAttempts[type])+1);
    tx.set(ref,{...patch,assessmentAttempts},{merge:true});
  });
}
async function rollupGame(payload,response){
  if(!response?.ok)return;
  const playerId=String(payload?.playerId||'').trim();
  const stageId=String(payload?.stageId||'').trim();
  if(!playerId||!stageId)return;
  const ref=await summaryRef(playerId),db=firebase.firestore();
  const accuracy=Math.max(0,Math.min(100,Math.round(num(response?.accuracy, payload?.accuracy))));
  const durationMs=gameDuration(payload);
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),data=snap.exists?(snap.data()||{}):{};
    const attempts={...(data.attemptCounts||{})};
    const durations={...(data.durationMsByStage||{})};
    const firstScores={...(data.firstAttemptScores||{})};
    const lastScores={...(data.lastAttemptScores||{})};
    const previousAttempts=num(attempts[stageId]);
    attempts[stageId]=previousAttempts+1;
    durations[stageId]=Math.max(0,num(durations[stageId]))+durationMs;
    if(previousAttempts===0)firstScores[stageId]=accuracy;
    lastScores[stageId]=accuracy;
    const totalGameAttempts=Object.values(attempts).reduce((s,v)=>s+num(v),0);
    const totalGameDurationMs=Object.values(durations).reduce((s,v)=>s+num(v),0);
    tx.set(ref,{
      playerId,
      attemptCounts:attempts,
      durationMsByStage:durations,
      firstAttemptScores:firstScores,
      lastAttemptScores:lastScores,
      totalGameAttempts,
      totalGameDurationMs,
      lastGameReceiptId:String(response?.receiptId||''),
      updatedAt:now(),sourceVersion:VERSION
    },{merge:true});
  });
}
function install(){
  const base=window.EW_AUTHORITY;
  if(!base?.submitAssessment||!base?.submitGame||base.analyticsRollupVersion===VERSION)return false;
  const originalAssessment=base.submitAssessment.bind(base);
  const originalGame=base.submitGame.bind(base);
  const wrapped={...base,analyticsRollupVersion:VERSION,
    submitAssessment:async function(payload){
      const response=await originalAssessment(payload);
      try{await rollupAssessment(payload,response)}catch(error){console.warn('[LEXICON X] assessment rollup failed',error)}
      return response;
    },
    submitGame:async function(payload){
      const response=await originalGame(payload);
      try{await rollupGame(payload,response)}catch(error){console.warn('[LEXICON X] game rollup failed',error)}
      return response;
    }
  };
  window.EW_AUTHORITY=Object.freeze(wrapped);
  window.dispatchEvent(new CustomEvent('ew-analytics-rollup-ready',{detail:{version:VERSION}}));
  return true;
}
if(!install()){
  let tries=0;const t=setInterval(()=>{tries++;if(install()||tries>160)clearInterval(t)},50);
}
})();
