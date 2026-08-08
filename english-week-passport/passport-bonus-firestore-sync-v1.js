(()=>{
'use strict';
const VERSION='2026-08-08-BONUS-FIRESTORE-SYNC-V2-SUMMARY-DOC';
const SUMMARY_COLLECTION='ewp_game_summary';
let syncing=false,lastPlayer='',lastSyncAt=0,timer=0;

function readIdentity(){
  try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
}
function cacheKey(playerId){return `ew_bonus_lens_best::${playerId}`}
function readLocalBest(playerId){
  try{return JSON.parse(localStorage.getItem(cacheKey(playerId))||'null')}catch(_){return null}
}
function setLocalBest(playerId,best){
  try{
    if(best)localStorage.setItem(cacheKey(playerId),JSON.stringify(best));
    else localStorage.removeItem(cacheKey(playerId));
  }catch(_){}
}
function normalizeBest(value){
  if(!value||value.score==null)return null;
  const score=Number(value.score);
  if(!Number.isFinite(score))return null;
  return {
    score,
    receipt:String(value.receipt||''),
    at:String(value.at||value.updatedAt||''),
    source:String(value.source||'firebase-summary')
  };
}
function decorate(best){
  const card=document.querySelector('.stage-card[data-stage="bonus_lens"]');
  if(!card)return;
  const detail=card.querySelector('div:nth-child(2)>small');
  const state=card.querySelector('.stage-state');
  const source=document.querySelector('.stage-card[data-stage="word_detective"]');
  const ready=Boolean(source?.classList.contains('passed'));
  const base='Bonus Mission • กล้องหลังค้นหา QR Clue • ไม่บังคับ Certificate';
  if(best?.score!=null){
    const score=Number(best.score)||0;
    const wanted=`${base} • ดีที่สุด ${score}%`;
    if(detail&&detail.textContent!==wanted)detail.textContent=wanted;
    if(state&&state.textContent!==`โบนัส ${score}% ✓`)state.textContent=`โบนัส ${score}% ✓`;
    card.dataset.bonusSource='firebase-summary';
    card.dataset.bonusScore=String(score);
  }else{
    if(detail&&detail.textContent!==base)detail.textContent=base;
    const wantedState=ready?'พร้อมเล่นโบนัส':'ผ่าน Game 4 เพื่อเปิด';
    if(state&&state.textContent!==wantedState)state.textContent=wantedState;
    card.dataset.bonusSource='firebase-empty';
    delete card.dataset.bonusScore;
  }
}
async function ensureSession(playerId,identity){
  if(typeof window.EW_AUTHORITY?.resume!=='function')throw new Error('AUTHORITY_NOT_READY');
  const r=await window.EW_AUTHORITY.resume(playerId,identity?.nickname||identity?.fullName||'');
  if(!r?.ok)throw new Error(r?.error||'RESUME_FAILED');
  return r;
}
async function readSummaryBest(playerId){
  if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
  const snap=await firebase.firestore().collection(SUMMARY_COLLECTION).doc(playerId).get();
  if(!snap.exists)return null;
  return normalizeBest((snap.data()||{}).bonusBest);
}
async function migrateLocalBest(playerId,best){
  const local=normalizeBest(best);
  if(!local)return null;
  const db=firebase.firestore();
  const ref=db.collection(SUMMARY_COLLECTION).doc(playerId);
  const payload={
    playerId,
    bonusBest:{...local,source:'legacy-local-migration'},
    bonusUpdatedAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    sourceVersion:VERSION
  };
  await ref.set(payload,{merge:true});
  return {...local,source:'legacy-local-migration'};
}
async function syncNow(force=false){
  const identity=readIdentity();
  const playerId=String(identity?.playerId||'').trim();
  if(!playerId||syncing)return;
  const now=Date.now();
  if(!force&&playerId===lastPlayer&&now-lastSyncAt<8000){decorate(readLocalBest(playerId));return;}
  if(!document.querySelector('.passport-map'))return;
  syncing=true;
  try{
    await ensureSession(playerId,identity);
    let best=await readSummaryBest(playerId);
    if(!best){
      const legacy=readLocalBest(playerId);
      if(legacy)best=await migrateLocalBest(playerId,legacy);
    }
    setLocalBest(playerId,best);
    decorate(best);
    lastPlayer=playerId;lastSyncAt=Date.now();
    window.dispatchEvent(new CustomEvent('ew-bonus-firestore-synced',{detail:{playerId,best,version:VERSION}}));
  }catch(error){
    console.warn('Bonus Firestore summary sync failed',error);
    decorate(readLocalBest(playerId));
  }finally{syncing=false;}
}
function schedule(force=false){
  clearTimeout(timer);
  timer=setTimeout(()=>syncNow(force),120);
}
const observer=new MutationObserver(mutations=>{
  if(mutations.some(m=>m.type==='childList'))schedule(false);
});
observer.observe(document.getElementById('screen')||document.body,{childList:true,subtree:true});
window.addEventListener('ew-authority-status',()=>schedule(false));
window.addEventListener('pageshow',()=>schedule(true));
window.addEventListener('focus',()=>schedule(false));
window.addEventListener('ew-bonus-summary-written',()=>schedule(true));
window.addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect()},{once:true});
schedule(true);
window.EW_BONUS_FIRESTORE_SYNC=Object.freeze({version:VERSION,sync:()=>syncNow(true)});
})();
