(()=>{
'use strict';
const VERSION='2026-08-12-BONUS-FIRESTORE-SYNC-V6-READ-BUDGET';
const SUMMARY_COLLECTION='ewp_game_summary';
const REWARD_COLLECTION='ewp_bonus_rewards';
const CACHE_TTL_MS=15*60*1000;
let syncing=false,lastPlayer='',lastSyncAt=0,timer=0;

function readIdentity(){
  try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
}
function bestKey(playerId){return `ew_bonus_lens_best::${playerId}`}
function syncKey(playerId){return `ew_bonus_sync_v6::${playerId}`}
function readLocalBest(playerId){
  try{return JSON.parse(localStorage.getItem(bestKey(playerId))||'null')}catch(_){return null}
}
function setLocalBest(playerId,best){
  try{if(best)localStorage.setItem(bestKey(playerId),JSON.stringify(best));else localStorage.removeItem(bestKey(playerId));}catch(_){}
}
function readSyncCache(playerId){
  try{return JSON.parse(localStorage.getItem(syncKey(playerId))||'null')}catch(_){return null}
}
function writeSyncCache(playerId,value){
  try{localStorage.setItem(syncKey(playerId),JSON.stringify({...value,checkedAt:Date.now(),version:VERSION}));}catch(_){}
}
function clearSyncCache(playerId){try{localStorage.removeItem(syncKey(playerId));}catch(_){}}
function normalizeBest(value){
  if(!value||value.score==null)return null;
  const score=Number(value.score);if(!Number.isFinite(score))return null;
  return {score,receipt:String(value.receipt||''),at:String(value.at||value.updatedAt||''),source:String(value.source||'firebase-summary')};
}
function sameBest(a,b){
  const x=normalizeBest(a),y=normalizeBest(b);
  if(!x&&!y)return true;if(!x||!y)return false;
  return Number(x.score)===Number(y.score)&&String(x.receipt||'')===String(y.receipt||'');
}
function decorate(best,status='firebase',reward=null){
  const card=document.querySelector('.stage-card[data-stage="bonus_lens"]');if(!card)return;
  const detail=card.querySelector('div:nth-child(2)>small'),state=card.querySelector('.stage-state');
  const source=document.querySelector('.stage-card[data-stage="word_detective"]');
  const ready=Boolean(source?.classList.contains('passed'));
  const base='Bonus Mission • QR Clue • 20 คนแรก/รอบมีรางวัล • ไม่บังคับ Certificate';
  if(best?.score!=null){
    const score=Number(best.score)||0;
    const rank=Number(reward?.rewardRank||0);
    const extra=reward?.rewardClaimed===true?' • รับรางวัลแล้ว':reward?.rewardEligible===true&&rank?` • Reward #${rank}`:'';
    if(detail)detail.textContent=`${base} • ดีที่สุด ${score}%${extra}`;
    if(state){
      if(reward?.rewardClaimed===true)state.textContent='🎁 รับรางวัลแล้ว ✓';
      else if(reward?.rewardEligible===true&&rank)state.textContent=`🎁 อันดับ #${rank} • มารับรางวัล`;
      else if(reward)state.textContent=`โบนัส ${score}% ✓ • รอจัดอันดับ`;
      else state.textContent=`โบนัส ${score}% ✓ • เช็กรางวัล`;
    }
    card.dataset.bonusSource=status==='cache'?'local-sync-cache':'firebase-summary';card.dataset.bonusScore=String(score);
    if(rank)card.dataset.rewardRank=String(rank);else delete card.dataset.rewardRank;
    card.dataset.rewardClaimed=reward?.rewardClaimed===true?'1':'0';
  }else{
    if(detail)detail.textContent=base;
    if(state)state.textContent=status==='syncing'?'กำลังซิงก์ Firebase…':ready?'พร้อมเล่นโบนัส 🎁':'ผ่าน Game 4 เพื่อเปิด';
    card.dataset.bonusSource=status==='cache'?'local-sync-cache':status==='syncing'?'firebase-syncing':'firebase-empty';delete card.dataset.bonusScore;delete card.dataset.rewardRank;delete card.dataset.rewardClaimed;
  }
}
async function ensureSession(playerId,identity){
  if(typeof window.EW_AUTHORITY?.resume!=='function')throw new Error('AUTHORITY_NOT_READY');
  const r=await window.EW_AUTHORITY.resume(playerId,identity?.nickname||identity?.fullName||'');if(!r?.ok)throw new Error(r?.error||'RESUME_FAILED');return r;
}
async function readSummaryBest(playerId){
  if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
  const snap=await firebase.firestore().collection(SUMMARY_COLLECTION).doc(playerId).get();return snap.exists?normalizeBest((snap.data()||{}).bonusBest):null;
}
async function readReward(playerId,sessionId){
  if(!sessionId)return null;
  const ref=firebase.firestore().collection(REWARD_COLLECTION).doc(`${sessionId}__${playerId}`);
  const snap=await ref.get();return snap.exists?{id:snap.id,...(snap.data()||{})}:null;
}
async function migrateLocalBest(playerId,best){
  const local=normalizeBest(best);if(!local)return null;
  const db=firebase.firestore(),ref=db.collection(SUMMARY_COLLECTION).doc(playerId),now=new Date().toISOString();
  await db.runTransaction(async tx=>{
    const snap=await tx.get(ref),data=snap.exists?(snap.data()||{}):{},existing=normalizeBest(data.bonusBest);
    const chosen=!existing||local.score>existing.score?{...local,source:'legacy-local-migration'}:existing;
    tx.set(ref,{playerId,bonusBest:chosen,bonusUpdatedAt:now,updatedAt:now,sourceVersion:VERSION},{merge:true});
  });
  return readSummaryBest(playerId);
}
function cacheUsable(playerId,localBest){
  const cached=readSyncCache(playerId);if(!cached)return null;
  if(!Number.isFinite(Number(cached.checkedAt))||Date.now()-Number(cached.checkedAt)>CACHE_TTL_MS)return null;
  // A newly completed/replayed bonus changes the local best marker; force one authoritative refresh.
  if(!sameBest(cached.best,localBest))return null;
  return cached;
}
async function syncNow(forceCloud=false){
  const identity=readIdentity(),playerId=String(identity?.playerId||'').trim();if(!playerId||syncing||!document.querySelector('.passport-map'))return;
  const localBest=readLocalBest(playerId);
  if(!forceCloud){
    const cached=cacheUsable(playerId,localBest);
    if(cached){decorate(normalizeBest(cached.best),'cache',cached.reward||null);lastPlayer=playerId;lastSyncAt=Date.now();return;}
  }
  const now=Date.now();if(!forceCloud&&playerId===lastPlayer&&now-lastSyncAt<15000)return;
  syncing=true;decorate(null,'syncing');
  try{
    const authority=await ensureSession(playerId,identity);const sessionId=String(authority?.progress?.attendanceSessionId||authority?.progress?.sessionId||'').trim();
    let best=await readSummaryBest(playerId);
    if(!best&&localBest)best=await migrateLocalBest(playerId,localBest);
    const reward=best?await readReward(playerId,sessionId):null;
    setLocalBest(playerId,best);writeSyncCache(playerId,{best,reward,sessionId});decorate(best,'firebase',reward);lastPlayer=playerId;lastSyncAt=Date.now();
    window.dispatchEvent(new CustomEvent('ew-bonus-firestore-synced',{detail:{playerId,best,reward,sessionId,version:VERSION}}));
  }catch(error){console.warn('Bonus Firestore sync failed',error);const cached=readSyncCache(playerId);if(cached)decorate(normalizeBest(cached.best),'cache',cached.reward||null);else decorate(null,'firebase');}finally{syncing=false;}
}
function schedule(forceCloud=false){clearTimeout(timer);timer=setTimeout(()=>syncNow(forceCloud),120)}
const observer=new MutationObserver(mutations=>{if(mutations.some(m=>m.type==='childList'))schedule(false)});
observer.observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
// Normal focus/pageshow use cache. Only events that can actually change bonus/reward invalidate Cloud state.
window.addEventListener('ew-authority-status',()=>schedule(false));
window.addEventListener('pageshow',()=>schedule(false));
window.addEventListener('focus',()=>schedule(false));
window.addEventListener('ew-bonus-summary-written',()=>{const id=String(readIdentity()?.playerId||'').trim();if(id)clearSyncCache(id);schedule(true)});
window.addEventListener('ew-bonus-reward-registered',()=>{const id=String(readIdentity()?.playerId||'').trim();if(id)clearSyncCache(id);schedule(true)});
window.addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect()},{once:true});schedule(false);
window.EW_BONUS_FIRESTORE_SYNC=Object.freeze({version:VERSION,sync:()=>syncNow(true),invalidate:()=>{const id=String(readIdentity()?.playerId||'').trim();if(id)clearSyncCache(id)}});
})();