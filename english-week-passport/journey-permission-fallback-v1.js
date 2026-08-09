(function(){
'use strict';
const VERSION='2026-08-09-JOURNEY-PERMISSION-FALLBACK-V2-RAW-PROGRESS';
const GAME_META={
  word_match:{title:'LexiMatch Navigator',skill:'Vocabulary matching'},
  category_forest:{title:'Category Forest',skill:'Category & context'},
  sentence_city:{title:'Sentence City',skill:'Sentence building'},
  word_detective:{title:'Conversation Quest',skill:'Conversation & response'},
  final_boss:{title:'LEXICON Champion Arena',skill:'Integrated Move • Decide • Speak'}
};
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
  const games=Object.entries(GAME_META).map(([stageId,meta])=>{
    const bestAccuracy=Math.max(0,Number(bestScores[stageId]||0));
    return {stageId,...meta,bestAccuracy,firstAttemptAccuracy:bestAccuracy,attempts:bestAccuracy>0?1:0,retryCount:0,durationMs:0,passed:passed.has(stageId)};
  });
  const played=games.filter(g=>g.attempts>0);
  const averageGameAccuracy=played.length?Math.round(played.reduce((n,g)=>n+g.bestAccuracy,0)/played.length):0;
  const preAccuracy=Number(p.preAccuracy??p.preScore??0)||0;
  const postAccuracy=Number(p.postAccuracy??p.postScore??0)||0;
  const bonusBest=gameSummary.bonusBest||null;
  return {
    ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority • Secure per-player fallback',
    summaryViewed:Boolean(p.summaryViewed),analyticsLimited:true,analyticsNotice:'Attempt-level query is restricted by Firestore Rules; showing verified per-player best-score summary.',
    summary:{
      pre:{accuracy:preAccuracy,receiptId:''},post:{accuracy:postAccuracy,receiptId:''},learningGain:postAccuracy-preAccuracy,
      averageGameAccuracy,totalAttempts:played.length,totalDurationMs:0,games,strongestSkill:strongest(games),
      badge:p.certificate?.awardLevel||'LEXICON X Explorer',reflection:p.finalReflection||{},
      bonus:bonusBest?{played:true,score:Number(bonusBest.score||0),correctContexts:Number(bonusBest.correctContexts||0),totalScans:Number(bonusBest.totalScans||0),durationMs:Number(bonusBest.durationMs||0)}:{played:false}
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
      console.warn('[LEXICON X] Journey attempt analytics restricted; using secure fallback',error);
      return fallbackSummary(playerId);
    }
  }};
  window.EW_JOURNEY=Object.freeze(wrapped);
  window.dispatchEvent(new CustomEvent('ew-journey-permission-fallback-ready',{detail:{version:VERSION}}));
  return true;
}
if(!install()){
  let n=0;const t=setInterval(()=>{n++;if(install()||n>120)clearInterval(t)},50);
}
})();