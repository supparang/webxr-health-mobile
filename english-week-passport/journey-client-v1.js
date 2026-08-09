(function(){
'use strict';
const VERSION='2026-08-09-JOURNEY-CLIENT-V5-REAL-ANALYTICS';
const cfg=window.EW_CONFIG||{};
const COL={progress:'ewp_progress',summary:'ewp_game_summary',events:'ewp_events',assessments:'ewp_assessments',gameResults:'ewp_game_results'};
const GAME_META={
  word_match:{title:'LexiMatch Navigator',skill:'Vocabulary matching'},
  category_forest:{title:'Category Forest',skill:'Category & context'},
  sentence_city:{title:'Sentence City',skill:'Sentence building'},
  word_detective:{title:'Conversation Quest',skill:'Conversation & response'},
  final_boss:{title:'LEXICON Champion Arena',skill:'Integrated Move • Decide • Speak'}
};
const nowIso=()=>new Date().toISOString();
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function loadScript(src,ready){
  try{if(ready?.())return Promise.resolve()}catch(_){}
  const key=src.split('?')[0];
  const existing=[...document.scripts].find(s=>s.src&&s.src.includes(key));
  if(existing)return (async()=>{for(let i=0;i<100;i++){try{if(!ready||ready())return}catch(_){}await sleep(50)}throw new Error('JOURNEY_SCRIPT_READY_TIMEOUT:'+key)})();
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('JOURNEY_SCRIPT_LOAD_FAILED:'+src));document.head.appendChild(s)})
    .then(async()=>{if(!ready)return;for(let i=0;i<100;i++){try{if(ready())return}catch(_){}await sleep(50)}throw new Error('JOURNEY_SCRIPT_READY_TIMEOUT:'+key)});
}
async function bootstrap(){
  if(cfg.authorityMode!=='firestore-direct')throw new Error('FIRESTORE_DIRECT_MODE_REQUIRED');
  await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',()=>Boolean(window.firebase?.initializeApp));
  await Promise.all([
    loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',()=>Boolean(window.firebase?.auth)),
    loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',()=>Boolean(window.firebase?.firestore))
  ]);
  await loadScript('./firebase-web-config.js?v=20260809-journey-direct7',()=>Boolean(window.EW_FIREBASE_WEB_CONFIG?.projectId==='englishweek-95869'));
  if(!window.EW_AUTHORITY?.directFirestoreVersion)await loadScript('./firestore-direct-authority-v1.js?v=20260807-inline-config1',()=>Boolean(window.EW_AUTHORITY?.directFirestoreVersion));
  if(!window.EW_AUTHORITY?.resume)throw new Error('FIRESTORE_DIRECT_AUTHORITY_NOT_READY');
}
const readyPromise=bootstrap().catch(error=>{console.error('[LEXICON X] Journey bootstrap failed',error);throw error});
function endpointReady(){return cfg.authorityMode==='firestore-direct'}
async function readRawProgress(playerId){const s=await firebase.firestore().collection(COL.progress).doc(playerId).get();return s.exists?{playerId,...(s.data()||{})}:{playerId}}
async function ensure(playerId,nickname=''){
  await readyPromise;
  const r=await window.EW_AUTHORITY.resume(playerId,nickname);
  if(!r?.ok||r.mode!=='firebase')throw new Error(r?.firebaseError||'FIRESTORE_DIRECT_RESUME_REQUIRED');
  return {...r,progress:{...(r.progress||{}),...(await readRawProgress(playerId))}};
}
async function ownRows(collection,playerId){
  const snap=await firebase.firestore().collection(collection).where('playerId','==',playerId).get();
  return snap.docs.map(d=>({id:d.id,...(d.data()||{})}));
}
function latest(rows,type){
  return rows.filter(r=>String(r.assessmentType||'').toLowerCase()===type)
    .sort((a,b)=>String(b.submittedAt||'').localeCompare(String(a.submittedAt||'')))[0]||null;
}
function accuracyOf(row){
  if(!row)return 0;
  if(Number.isFinite(Number(row.accuracy)))return Math.round(Number(row.accuracy));
  const total=Number(row.total||0),score=Number(row.score||0);
  return total>0?Math.round(score/total*100):0;
}
function gameAnalytics(rows){
  return Object.entries(GAME_META).map(([stageId,meta])=>{
    const attempts=rows.filter(r=>r.stageId===stageId).sort((a,b)=>String(a.submittedAt||'').localeCompare(String(b.submittedAt||'')));
    const accuracies=attempts.map(accuracyOf);
    return {
      stageId,...meta,
      bestAccuracy:accuracies.length?Math.max(...accuracies):0,
      firstAttemptAccuracy:accuracies[0]||0,
      attempts:attempts.length,
      retryCount:Math.max(0,attempts.length-1),
      durationMs:attempts.reduce((n,r)=>n+Math.max(0,Number(r.durationMs||0)),0),
      passed:attempts.some(r=>r.passed===true)
    };
  });
}
async function event(playerId,type,payload={}){
  const receiptId=uid(type);
  await firebase.firestore().collection(COL.events).doc(receiptId).set({playerId,type,receiptId,...payload,createdAt:nowIso(),sourceVersion:VERSION});
  return receiptId;
}
async function status(playerId){
  const r=await ensure(playerId),p=r.progress||{};
  return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority + Raw Progress',playerId,reflectionDone:Boolean(p.reflectionDone||p.finalReflection),summaryViewed:Boolean(p.summaryViewed),certificateEligible:Boolean(p.certificateEligible),version:VERSION};
}
async function submitReflection(payload){
  const playerId=String(payload?.playerId||'').trim();if(!playerId)throw new Error('PLAYER_ID_REQUIRED');
  const r=await ensure(playerId);if(!r.progress?.postDone)throw new Error('POST_CHALLENGE_REQUIRED');
  const reflection={confidence:Number(payload.confidence||0),mostUsefulMission:String(payload.mostUsefulMission||''),helpedMost:String(payload.helpedMost||''),takeaway:String(payload.takeaway||'').trim(),submittedAt:nowIso(),sourceVersion:payload.sourceVersion||VERSION};
  if(!reflection.confidence||!reflection.mostUsefulMission||!reflection.helpedMost)throw new Error('REFLECTION_INCOMPLETE');
  await firebase.firestore().collection(COL.progress).doc(playerId).set({playerId,reflectionDone:true,finalReflection:reflection,updatedAt:nowIso(),journeySourceVersion:VERSION},{merge:true});
  const receiptId=await event(playerId,'final_reflection',{reflectionDone:true});
  return {ok:true,mode:'firebase',receiptId,reflectionDone:true,sourceOfTruth:'Cloud Firestore Direct Authority',version:VERSION};
}
function strongest(games){return games.reduce((best,g)=>g.bestAccuracy>(best?.accuracy??-1)?{stageId:g.stageId,accuracy:g.bestAccuracy,skill:g.skill}:best,null)}
async function summary(playerId){
  const r=await ensure(playerId),p=r.progress||{};
  if(!(p.reflectionDone||p.finalReflection))throw new Error('FINAL_REFLECTION_REQUIRED');
  const [assessments,results,summarySnap]=await Promise.all([
    ownRows(COL.assessments,playerId),
    ownRows(COL.gameResults,playerId),
    firebase.firestore().collection(COL.summary).doc(playerId).get().catch(()=>null)
  ]);
  const pre=latest(assessments,'pre'),post=latest(assessments,'post');
  const games=gameAnalytics(results);
  const played=games.filter(g=>g.attempts>0);
  const averageGameAccuracy=played.length?Math.round(played.reduce((n,g)=>n+g.bestAccuracy,0)/played.length):0;
  const totalAttempts=games.reduce((n,g)=>n+g.attempts,0);
  const totalDurationMs=games.reduce((n,g)=>n+g.durationMs,0);
  const gameSummary=summarySnap?.exists?(summarySnap.data()||{}):{};
  const bonusBest=gameSummary.bonusBest||null;
  const preAccuracy=accuracyOf(pre),postAccuracy=accuracyOf(post);
  return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority + Real Attempt Analytics',summaryViewed:Boolean(p.summaryViewed),summary:{
    pre:{accuracy:preAccuracy,receiptId:pre?.receiptId||pre?.id||''},
    post:{accuracy:postAccuracy,receiptId:post?.receiptId||post?.id||''},
    learningGain:postAccuracy-preAccuracy,averageGameAccuracy,totalAttempts,totalDurationMs,games,strongestSkill:strongest(games),
    badge:p.certificate?.awardLevel||'LEXICON X Explorer',reflection:p.finalReflection||{},
    bonus:bonusBest?{played:true,score:Number(bonusBest.score||0),correctContexts:Number(bonusBest.correctContexts||0),totalScans:Number(bonusBest.totalScans||0),durationMs:Number(bonusBest.durationMs||0)}:{played:false}
  },version:VERSION};
}
async function completeSummary(playerId){
  const r=await ensure(playerId);if(!(r.progress?.reflectionDone||r.progress?.finalReflection))throw new Error('FINAL_REFLECTION_REQUIRED');
  await firebase.firestore().collection(COL.progress).doc(playerId).set({playerId,summaryViewed:true,summaryViewedAt:nowIso(),updatedAt:nowIso(),journeySourceVersion:VERSION},{merge:true});
  const receiptId=await event(playerId,'journey_summary',{summaryViewed:true});
  return {ok:true,mode:'firebase',receiptId,summaryViewed:true,sourceOfTruth:'Cloud Firestore Direct Authority',version:VERSION};
}
window.EW_JOURNEY=Object.freeze({version:VERSION,endpointReady,status,submitReflection,summary,completeSummary,health:async()=>{await readyPromise;return {ok:true,mode:'firebase',version:VERSION}}});
console.info('[LEXICON X] Journey Client V5 Real Analytics ready');
}());
