(()=>{
'use strict';
const VERSION='2026-08-08-BONUS-FIRESTORE-SYNC-V1';
const EVENT_COLLECTION='ewp_events';
let syncing=false,lastPlayer='',lastSyncAt=0,timer=0;

function readIdentity(){
  try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
}
function cacheKey(playerId){return `ew_bonus_lens_best::${playerId}`}
function setLocalBest(playerId,best){
  try{
    if(best)localStorage.setItem(cacheKey(playerId),JSON.stringify(best));
    else localStorage.removeItem(cacheKey(playerId));
  }catch(_){}
}
function decorate(best){
  const card=document.querySelector('.stage-card[data-stage="bonus_lens"]');
  if(!card)return;
  const detail=card.querySelector('div:nth-child(2)>small');
  const state=card.querySelector('.stage-state');
  const source=document.querySelector('.stage-card[data-stage="word_detective"]');
  const ready=Boolean(source?.classList.contains('passed'));
  if(best?.score!=null){
    const score=Number(best.score)||0;
    if(detail){
      const base='Bonus Mission • กล้องหลังค้นหา QR Clue • ไม่บังคับ Certificate';
      const wanted=`${base} • ดีที่สุด ${score}%`;
      if(detail.textContent!==wanted)detail.textContent=wanted;
    }
    if(state&&state.textContent!==`โบนัส ${score}% ✓`)state.textContent=`โบนัส ${score}% ✓`;
    card.dataset.bonusSource='firebase';
    card.dataset.bonusScore=String(score);
  }else{
    if(detail){
      const wanted='Bonus Mission • กล้องหลังค้นหา QR Clue • ไม่บังคับ Certificate';
      if(detail.textContent!==wanted)detail.textContent=wanted;
    }
    const wantedState=ready?'พร้อมเล่นโบนัส':'ผ่าน Game 4 เพื่อเปิด';
    if(state&&state.textContent!==wantedState)state.textContent=wantedState;
    card.dataset.bonusSource='firebase-empty';
    delete card.dataset.bonusScore;
  }
}
function bestFromSnapshot(snapshot){
  let best=null;
  snapshot.forEach(doc=>{
    const row=doc.data()||{};
    if(String(row.stageId||'')!=='bonus_lens')return;
    if(String(row.eventName||'')!=='lens_result_summary')return;
    const payload=row.payload&&typeof row.payload==='object'?row.payload:{};
    const score=Number(payload.score);
    if(!Number.isFinite(score))return;
    if(!best||score>best.score){
      best={score,receipt:String(row.eventId||doc.id||''),at:String(row.submittedAt||row.createdAt||'')};
    }
  });
  return best;
}
async function syncNow(force=false){
  const identity=readIdentity();
  const playerId=String(identity?.playerId||'').trim();
  if(!playerId||syncing)return;
  const now=Date.now();
  if(!force&&playerId===lastPlayer&&now-lastSyncAt<15000){decorate(JSON.parse(localStorage.getItem(cacheKey(playerId))||'null'));return;}
  if(!document.querySelector('.passport-map'))return;
  syncing=true;
  try{
    if(typeof window.EW_AUTHORITY?.resume==='function'){
      await window.EW_AUTHORITY.resume(playerId,identity?.nickname||identity?.fullName||'');
    }
    if(!window.firebase?.firestore)throw new Error('FIRESTORE_NOT_READY');
    const db=firebase.firestore();
    const snapshot=await db.collection(EVENT_COLLECTION).where('playerId','==',playerId).limit(200).get();
    const best=bestFromSnapshot(snapshot);
    setLocalBest(playerId,best);
    decorate(best);
    lastPlayer=playerId;lastSyncAt=Date.now();
    window.dispatchEvent(new CustomEvent('ew-bonus-firestore-synced',{detail:{playerId,best,version:VERSION}}));
  }catch(error){
    console.warn('Bonus Firestore sync failed',error);
    try{decorate(JSON.parse(localStorage.getItem(cacheKey(playerId))||'null'))}catch(_){}
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
window.addEventListener('pagehide',()=>{clearTimeout(timer);observer.disconnect()},{once:true});
schedule(true);
window.EW_BONUS_FIRESTORE_SYNC=Object.freeze({version:VERSION,sync:()=>syncNow(true)});
})();
