(()=>{
'use strict';
const VERSION='2026-08-19-LENS-ROUND-CONTINUITY-V1';
const ATTENDANCE_KEY='LEXICON_X_ATTENDANCE_CHECKIN_V2';
const VALID=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
const clean=v=>String(v==null?'':v).trim();
const normalize=value=>{
  const raw=clean(value).toUpperCase().replace(/\s+/g,'-').replace(/_/g,'-');
  if(VALID.includes(raw))return raw;
  const compact=raw.replace(/-/g,'');
  return VALID.find(id=>id.replace(/-/g,'')===compact)||'';
};
const params=new URLSearchParams(location.search);
let cachedRound='';
let resolving=null;
function readIdentity(){
  try{return JSON.parse(localStorage.getItem(window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1')||'null')}catch(_){return null}
}
function roundFromUrl(){
  for(const key of ['session','attendanceSessionId','checkin','sessionId','sessionCode','round','cohort']){
    const value=normalize(params.get(key));
    if(value)return value;
  }
  return '';
}
function readStored(playerId){
  try{
    const saved=JSON.parse(localStorage.getItem(ATTENDANCE_KEY)||'null');
    if(!saved||clean(saved.playerId)!==clean(playerId))return '';
    return normalize(saved.attendanceSessionId||saved.sessionId);
  }catch(_){return ''}
}
function saveStored(playerId,round,source){
  const sessionId=normalize(round);if(!playerId||!sessionId)return '';
  try{localStorage.setItem(ATTENDANCE_KEY,JSON.stringify({playerId:clean(playerId),attendanceSessionId:sessionId,sessionId,checkedIn:true,locked:true,source:source||'bonus-round-continuity',savedAt:new Date().toISOString(),version:VERSION}))}catch(_){}
  cachedRound=sessionId;
  return sessionId;
}
async function firebaseRound(playerId){
  if(!window.firebase?.auth||!window.firebase?.firestore)return '';
  let user=firebase.auth().currentUser;
  if(!user&&typeof window.EW_STUDENT_AUTH_ISOLATION?.ensure==='function'){
    try{user=await window.EW_STUDENT_AUTH_ISOLATION.ensure()}catch(_){}
  }
  user=user||firebase.auth().currentUser;if(!user)return '';
  try{
    const snap=await firebase.firestore().collection('ewp_player_sessions').doc(user.uid).get();
    if(!snap.exists)return '';
    const data=snap.data()||{};
    if(clean(data.playerId)!==clean(playerId))return '';
    return normalize(data.attendanceSessionId||data.checkInSessionId||data.sessionId||data.sessionCode||data.cohortId||data.roundId||data.round);
  }catch(_){return ''}
}
async function ensureRound(){
  const identity=readIdentity();const playerId=clean(identity?.playerId);
  if(!playerId)return '';
  const immediate=cachedRound||roundFromUrl()||readStored(playerId);
  if(immediate)return saveStored(playerId,immediate,'bonus-return-local');
  if(resolving)return resolving;
  resolving=(async()=>{
    const remote=await firebaseRound(playerId);
    return remote?saveStored(playerId,remote,'bonus-return-firebase'):'';
  })().finally(()=>{resolving=null});
  return resolving;
}
async function goPassportSafe(event){
  if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
  const round=await ensureRound();
  const q=new URLSearchParams({resume:'passport',fromGame:'bonus_lens',v:'20260819-lens-round-continuity-v1'});
  if(round)q.set('session',round);
  const receipt=new URLSearchParams(location.search).get('receipt');if(receipt)q.set('receipt',receipt);
  location.replace('./index.html?'+q.toString());
}
function isReturnTarget(target){return target?.closest?.('#backBtn,#introBackBtn,#summaryBack,#blockedBack')}
document.addEventListener('click',event=>{if(isReturnTarget(event.target))void goPassportSafe(event)},true);
document.addEventListener('pointerdown',event=>{if(isReturnTarget(event.target)){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}},true);
const identity=readIdentity();if(identity?.playerId){const initial=roundFromUrl()||readStored(identity.playerId);if(initial)saveStored(identity.playerId,initial,'bonus-page-bootstrap');void ensureRound();}
window.LEXICON_LENS_ROUND_CONTINUITY=Object.freeze({version:VERSION,ensureRound,goPassport:goPassportSafe,getRound:()=>cachedRound||roundFromUrl()||readStored(readIdentity()?.playerId||'')});
})();