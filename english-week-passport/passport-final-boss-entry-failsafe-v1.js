(function(){
'use strict';
const VERSION='2026-08-19-FINAL-BOSS-ENTRY-FAILSAFE-V1';
const ATTENDANCE_KEY='LEXICON_X_ATTENDANCE_CHECKIN_V2';
const IDENTITY_KEY=window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1';
let navigating=false;

const clean=v=>String(v==null?'':v).trim();
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_){return null}}
function identity(){return readJson(IDENTITY_KEY)}
function round(){
  const q=new URLSearchParams(location.search);
  for(const key of ['session','attendanceSessionId','checkin','sessionId','sessionCode','round','cohort']){
    const value=clean(q.get(key)).toUpperCase().replace(/_/g,'-');
    if(/^D[1-3]-(AM|PM)$/.test(value))return value;
  }
  const who=identity();const saved=readJson(ATTENDANCE_KEY);
  if(saved&&clean(saved.playerId)===clean(who?.playerId)){
    const value=clean(saved.attendanceSessionId||saved.sessionId).toUpperCase().replace(/_/g,'-');
    if(/^D[1-3]-(AM|PM)$/.test(value))return value;
  }
  return '';
}
function openBoss(){
  if(navigating)return;
  const who=identity();if(!who?.playerId)return;
  navigating=true;
  const q=new URLSearchParams({pid:clean(who.playerId),playerId:clean(who.playerId),nickname:clean(who.nickname||who.fullName||'Player'),run:'1',stage:'final_boss',v:'20260819-boss-entry-failsafe-v1'});
  const session=round();if(session)q.set('session',session);
  if(new URLSearchParams(location.search).get('view')==='mobile')q.set('view','mobile');
  location.assign('./passport-final-boss-light-v1.html?'+q.toString());
}
function isReady(card){return !!card&&(card.classList.contains('ready')||card.classList.contains('passed')||/เริ่มได้|พร้อมเล่น/.test(card.querySelector('.stage-state')?.textContent||''));}
function intercept(event){
  const card=event.target?.closest?.('.stage-card[data-stage="final_boss"]');
  if(!card||!isReady(card))return;
  if(card.dataset.checkinBlocked==='1')return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();openBoss();
}
function decorate(){
  const card=document.querySelector('.stage-card[data-stage="final_boss"]');if(!card||!isReady(card))return;
  card.classList.add('clickable');card.tabIndex=0;card.setAttribute('role','button');card.style.pointerEvents='auto';
  card.dataset.bossEntryFailsafe=VERSION;
}
document.addEventListener('click',intercept,true);
document.addEventListener('pointerup',intercept,true);
document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')intercept(event)},true);
const root=document.getElementById('screen')||document.body;
new MutationObserver(()=>decorate()).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
decorate();
window.EW_FINAL_BOSS_ENTRY_FAILSAFE=Object.freeze({version:VERSION,open:openBoss});
})();
