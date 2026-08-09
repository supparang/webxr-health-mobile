(function(){
'use strict';
const VERSION='2026-08-09-JOURNEY-CLIENT-V4-RAW-PROGRESS';
const cfg=window.EW_CONFIG||{};
const COL={progress:'ewp_progress',summary:'ewp_game_summary',events:'ewp_events'};
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
  if(existing){return (async()=>{for(let i=0;i<100;i++){try{if(!ready||ready())return}catch(_){}await sleep(50)}throw new Error('JOURNEY_SCRIPT_READY_TIMEOUT:'+key)})()}
  return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.async=false;s.onload=resolve;s.onerror=()=>reject(new Error('JOURNEY_SCRIPT_LOAD_FAILED:'+src));document.head.appendChild(s)}).then(async()=>{if(!ready)return;for(let i=0;i<100;i++){try{if(ready())return}catch(_){}await sleep(50)}throw new Error('JOURNEY_SCRIPT_READY_TIMEOUT:'+key)});
}
async function bootstrap(){
  if(cfg.authorityMode!=='firestore-direct')throw new Error('FIRESTORE_DIRECT_MODE_REQUIRED');
  await loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',()=>Boolean(window.firebase?.initializeApp));
  await Promise.all([
    loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js',()=>Boolean(window.firebase?.auth)),
    loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',()=>Boolean(window.firebase?.firestore))
  ]);
  await loadScript('./firebase-web-config.js?v=20260809-journey-direct6',()=>Boolean(window.EW_FIREBASE_WEB_CONFIG?.projectId==='englishweek-95869'));
  if(!window.EW_AUTHORITY?.directFirestoreVersion){
    await loadScript('./firestore-direct-authority-v1.js?v=20260807-inline-config1',()=>Boolean(window.EW_AUTHORITY?.directFirestoreVersion));
  }
  if(!window.EW_AUTHORITY?.resume)throw new Error('FIRESTORE_DIRECT_AUTHORITY_NOT_READY');
  return true;
}
const readyPromise=bootstrap().catch(error=>{console.error('[LEXICON X] Journey bootstrap failed',error);throw error});
function endpointReady(){return cfg.authorityMode==='firestore-direct'}
async function readRawProgress(playerId){
  const snap=await firebase.firestore().collection(COL.progress).doc(playerId).get();
  return snap.exists?{playerId,...(snap.data()||{})}:{playerId};
}
async function ensure(playerId,nickname=''){
  await readyPromise;
  const r=await window.EW_AUTHORITY.resume(playerId,nickname);
  if(!r?.ok||r.mode!=='firebase')throw new Error(r?.firebaseError||'FIRESTORE_DIRECT_RESUME_REQUIRED');
  const rawProgress=await readRawProgress(playerId);
  return {...r,progress:{...(r.progress||{}),...rawProgress}};
}
async function event(playerId,type,payload={}){
  try{
    const receiptId=uid(type);
    await firebase.firestore().collection(COL.events).doc(receiptId).set({playerId,type,receiptId,...payload,createdAt:nowIso(),sourceVersion:VERSION});
    return receiptId;
  }catch(_){return uid(type)}
}
async function status(playerId){
  const r=await ensure(playerId);
  const p=r.progress||{};
  return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority + Raw Progress',playerId,reflectionDone:Boolean(p.reflectionDone||p.finalReflection),summaryViewed:Boolean(p.summaryViewed),certificateEligible:Boolean(p.certificateEligible),version:VERSION};
}
async function submitReflection(payload){
  const playerId=String(payload?.playerId||'').trim();
  if(!playerId)throw new Error('PLAYER_ID_REQUIRED');
  const r=await ensure(playerId);
  if(!r.progress?.postDone)throw new Error('POST_CHALLENGE_REQUIRED');
  const reflection={confidence:Number(payload.confidence||0),mostUsefulMission:String(payload.mostUsefulMission||''),helpedMost:String(payload.helpedMost||''),takeaway:String(payload.takeaway||'').trim(),submittedAt:nowIso(),sourceVersion:payload.sourceVersion||VERSION};
  if(!reflection.confidence||!reflection.mostUsefulMission||!reflection.helpedMost)throw new Error('REFLECTION_INCOMPLETE');
  await firebase.firestore().collection(COL.progress).doc(playerId).set({playerId,reflectionDone:true,finalReflection:reflection,updatedAt:nowIso(),journeySourceVersion:VERSION},{merge:true});
  const receiptId=await event(playerId,'final_reflection',{reflectionDone:true});
  return {ok:true,mode:'firebase',receiptId,reflectionDone:true,sourceOfTruth:'Cloud Firestore Direct Authority',version:VERSION};
}
function strongest(bestScores){let best=null;Object.entries(bestScores||{}).forEach(([stageId,value])=>{const accuracy=Number(value||0);if(!best||accuracy>best.accuracy)best={stageId,accuracy,skill:GAME_META[stageId]?.skill||stageId}});return best}
async function summary(playerId){
  const r=await ensure(playerId);
  const p=r.progress||{};
  if(!(p.reflectionDone||p.finalReflection))throw new Error('FINAL_REFLECTION_REQUIRED');
  let gameSummary={};
  try{const s=await firebase.firestore().collection(COL.summary).doc(playerId).get();if(s.exists)gameSummary=s.data()||{}}catch(_){}
  const bestScores={...(p.bestScores||{}),...(gameSummary.bestScores||{})};
  const games=Object.keys(GAME_META).map(stageId=>({stageId,title:GAME_META[stageId].title,skill:GAME_META[stageId].skill,bestAccuracy:Number(bestScores[stageId]||0),attempts:Number(bestScores[stageId]!=null?1:0),durationMs:0}));
  const values=games.map(g=>g.bestAccuracy).filter(v=>v>0);const averageGameAccuracy=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;
  const preAccuracy=Number(p.preAccuracy??p.preScore??0),postAccuracy=Number(p.postAccuracy??p.postScore??0),bonusBest=gameSummary.bonusBest||null;
  return {ok:true,mode:'firebase',sourceOfTruth:'Cloud Firestore Direct Authority + Raw Progress',summaryViewed:Boolean(p.summaryViewed),summary:{pre:{accuracy:preAccuracy},post:{accuracy:postAccuracy},learningGain:postAccuracy-preAccuracy,averageGameAccuracy,totalAttempts:games.reduce((n,g)=>n+g.attempts,0),totalDurationMs:0,games,strongestSkill:strongest(bestScores),badge:p.certificate?.awardLevel||'LEXICON X Explorer',reflection:p.finalReflection||{},bonus:bonusBest?{played:true,score:Number(bonusBest.score||0),correctContexts:Number(bonusBest.correctContexts||0),totalScans:Number(bonusBest.totalScans||0),durationMs:Number(bonusBest.durationMs||0)}:{played:false}},version:VERSION};
}
async function completeSummary(playerId){
  const r=await ensure(playerId);
  if(!(r.progress?.reflectionDone||r.progress?.finalReflection))throw new Error('FINAL_REFLECTION_REQUIRED');
  await firebase.firestore().collection(COL.progress).doc(playerId).set({playerId,summaryViewed:true,summaryViewedAt:nowIso(),updatedAt:nowIso(),journeySourceVersion:VERSION},{merge:true});
  const receiptId=await event(playerId,'journey_summary',{summaryViewed:true});
  return {ok:true,mode:'firebase',receiptId,summaryViewed:true,sourceOfTruth:'Cloud Firestore Direct Authority',version:VERSION};
}
window.EW_JOURNEY=Object.freeze({version:VERSION,endpointReady,status,submitReflection,summary,completeSummary,health:async()=>{await readyPromise;return {ok:true,mode:'firebase',version:VERSION}}});
console.info('[LEXICON X] Journey Client V4 Raw Firestore Progress ready');
}());