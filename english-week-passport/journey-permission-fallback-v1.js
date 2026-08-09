(function(){
'use strict';
const VERSION='2026-08-09-JOURNEY-PERMISSION-FALLBACK-V3-ROLLUP';
const GAME_META={
  word_match:{title:'LexiMatch Navigator',skill:'Vocabulary matching'},
  category_forest:{title:'Category Forest',skill:'Category & context'},
  sentence_city:{title:'Sentence City',skill:'Sentence building'},
  word_detective:{title:'Conversation Quest',skill:'Conversation & response'},
  final_boss:{title:'LEXICON Champion Arena',skill:'Integrated Move • Decide • Speak'}
};
function n(v,f=0){const x=Number(v);return Number.isFinite(x)?x:f}
function isPermissionError(error){
  const s=String(error?.code||'')+' '+String(error?.message||error||'');
  return /permission-denied|Missing or insufficient permissions/i.test(s);
}
function strongest(games){return games.reduce((best,g)=>g.bestAccuracy>(best?.accuracy??-1)?{stageId:g.stageId,accuracy:g.bestAccuracy,skill:g.skill}:best,null)}
async function rawProgress(playerId){
  try{
    const snap=await firebase.firestore().collection('ewp_progress').doc(playerId).get();
    return snap.exists?{playerId,...(snap.data()||{})}:{playerId};
  }catch(error){
    console.warn('[LEXICON X] raw per-player progress read failed',error);
    return {playerId};
  }
}
async function fallbackSummary(playerId){
  if(!window.EW_AUTHORITY?.resume)throw new Error('FIRESTORE_DIRECT_AUTHORITY_NOT_READY');
  const r=await window.EW_AUTHORITY.resume(playerId,'');
  if(!r?.ok)throw new Error('FIRESTORE_DIRECT_RESUME_REQUIRED');
  const raw=await rawProgress(playerId);
  const p={...(r.progress||{}),...raw};
  if(!(p.reflectionDone||p.finalReflection))throw new Error('FINAL_REFLECTION_REQUIRED');
  let gameSummary={};
  try{
    const snap=await firebase.firestore().collection('ewp_game_summary').doc(playerId).get();
    if(snap.exists)gameSummary=snap.data()||{};
  }catch(_){}
  const bestScores={...(gameSummary.bestScores||{}),...(p.bestScores||{})};
  const passed=new Set(Array.isArray(p.passed)?p.passed:[]);
  const attempts=gameSummary.attemptCounts||{};
  const durations=gameSummary.durationMsByStage||{};
  const firstScores=gameSummary.firstAttemptScores||{};
  const games=Object.entries(GAME_META).map(([stageId,meta])=>{
    const bestAccuracy=Math.max(0,n(bestScores[stageId]));
    const attemptCount=Math.max(0,n(attempts[stageId],bestAccuracy>0?1:0));
    const firstAttemptAccuracy=Math.max(0,n(firstScores[stageId],bestAccuracy));
    return {stageId,...meta,bestAccuracy,firstAttemptAccuracy,attempts:attemptCount,retryCount:Math.max(0,attemptCount-1),durationMs:Math.max(0,n(durations[stageId])),passed:passed.has(stageId)};
  });
  const played=games.filter(g=>g.attempts>0);
  const averageGameAccuracy=played.length?Math.round(played.reduce((sum,g)=>sum+g.bestAccuracy,0)/played.length):0;
  const preAccuracy=n(gameSummary.preAccuracy,p.preAccuracy??p.preScore??0);
  const postAccuracy=n(gameSummary.postAccuracy,p.postAccuracy??p.postScore??0);
  const totalAttempts=Math.max(n(gameSummary.totalGameAttempts),played.reduce((s,g)=>s+g.attempts,0));
  const totalDurationMs=Math.max(n(gameSummary.totalGameDurationMs),played.reduce((s,g)=>s+g.durationMs,0));
  const bonusBest=gameSummary.bonusBest||null;
  return {
    ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • Secure per-player rollup',
    summaryViewed:Boolean(p.summaryViewed),analyticsLimited:false,analyticsNotice:'Per-player analytics rollup used; no cross-player collection query required.',
    summary:{
      pre:{accuracy:preAccuracy,receiptId:String(gameSummary.preReceiptId||'')},
      post:{accuracy:postAccuracy,receiptId:String(gameSummary.postReceiptId||'')},
      learningGain:postAccuracy-preAccuracy,
      averageGameAccuracy,totalAttempts,totalDurationMs,games,strongestSkill:strongest(games),
      badge:p.certificate?.awardLevel||'LEXICON X Explorer',reflection:p.finalReflection||{},
      bonus:bonusBest?{played:true,score:n(bonusBest.score),correctContexts:n(bonusBest.correctContexts),totalScans:n(bonusBest.totalScans),durationMs:n(bonusBest.durationMs)}:{played:false}
    },version:VERSION
  };
}
function install(){
  const base=window.EW_JOURNEY;
  if(!base?.summary||base.permissionFallbackVersion===VERSION)return false;
  const originalSummary=base.summary.bind(base);
  const wrapped={...base,permissionFallbackVersion:VERSION,summary:async function(playerId){
    try{return await originalSummary(playerId)}catch(error){
      if(!isPermissionError(error))throw error;
      console.warn('[LEXICON X] Journey attempt analytics restricted; using secure per-player rollup',error);
      return fallbackSummary(playerId);
    }
  }};
  window.EW_JOURNEY=Object.freeze(wrapped);
  window.dispatchEvent(new CustomEvent('ew-journey-permission-fallback-ready',{detail:{version:VERSION}}));
  return true;
}
if(!install()){
  let i=0;const t=setInterval(()=>{i++;if(install()||i>120)clearInterval(t)},50);
}
})();
