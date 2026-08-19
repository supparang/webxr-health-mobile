(function(){
'use strict';
const VERSION='2026-08-19-PASSPORT-CHECKIN-UI-V4-AUTH-RACE-FAILSAFE';
const SCREEN=document.getElementById('screen');
const IDENTITY_KEY=window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1';
let attendance=null;
let syncing=false;
let lastSyncAt=0;
let decorateQueued=false;
let retryTimer=null;
let retryAttempt=0;
const MAX_RETRY_ATTEMPTS=6;

const clean=v=>String(v==null?'':v).trim();
function readIdentity(){try{return JSON.parse(localStorage.getItem(IDENTITY_KEY)||'null')}catch(_){return null}}
function sessionLabel(id){
  const map={'D1-AM':'Day 1 • Morning','D1-PM':'Day 1 • Afternoon','D2-AM':'Day 2 • Morning','D2-PM':'Day 2 • Afternoon','D3-AM':'Day 3 • Morning','D3-PM':'Day 3 • Afternoon'};
  return map[id]||id||'';
}
function entrySession(){
  try{return clean(window.EW_ATTENDANCE_CHECKIN?.currentEntrySession?.()||window.EW_SESSION_ASSIGNMENT?.currentEntrySession?.()||'')}catch(_){return ''}
}
function onLoginScreen(){return Boolean(document.getElementById('loginForm'))}
function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;decorate();});}
function isTransient(detail){
  const reason=clean(detail?.reason).toUpperCase();
  return reason==='AUTH_NOT_READY'||reason==='NOT_READY'||reason==='FIREBASE_AUTH_NOT_READY';
}
function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}}
function scheduleRetry(){
  if(onLoginScreen()||attendance?.checkedIn||!readIdentity()?.playerId)return;
  if(retryTimer||retryAttempt>=MAX_RETRY_ATTEMPTS)return;
  const delay=Math.min(1600,200*Math.pow(2,Math.min(retryAttempt,3)));
  retryAttempt+=1;
  retryTimer=setTimeout(()=>{
    retryTimer=null;
    refreshAttendance(true);
  },delay);
}
function setAttendance(detail){
  if(detail?.checkedIn){
    attendance=detail;
    retryAttempt=0;
    clearRetry();
    scheduleDecorate();
    return;
  }
  if(isTransient(detail)){
    attendance=null;
    scheduleDecorate();
    scheduleRetry();
    return;
  }
  attendance=detail||null;
  scheduleDecorate();
}

async function refreshAttendance(force=false){
  // Never use a cached identity to claim a check-in while the login form is visible.
  // Check-in is confirmed only after the app has authenticated/resumed the current player.
  if(onLoginScreen())return null;
  const identity=readIdentity();
  if(!identity?.playerId||typeof window.EW_ATTENDANCE_CHECKIN?.syncAttendance!=='function')return null;
  const now=Date.now();
  if(syncing||(!force&&now-lastSyncAt<1200))return attendance;
  syncing=true;lastSyncAt=now;
  try{
    const detail=await window.EW_ATTENDANCE_CHECKIN.syncAttendance(identity.playerId);
    setAttendance(detail);
    return detail;
  }catch(error){
    console.warn('[LEXICON X] Check-in UI refresh failed',error);
    if(!attendance?.checkedIn){attendance=null;scheduleDecorate();scheduleRetry();}
    return attendance;
  }finally{syncing=false;}
}

function removeOld(){document.querySelectorAll('[data-ew-checkin-ui]').forEach(el=>el.remove());}
function makeBadge(detail){
  const id=clean(detail.attendanceSessionId||detail.sessionId);
  const box=document.createElement('div');
  box.dataset.ewCheckinUi='badge';
  box.className='ew-checkin-badge';
  box.innerHTML=`<span class="ew-checkin-dot">✓</span><div><strong>Checked in: ${id}</strong><small>${sessionLabel(id)} • รอบถูกล็อกแล้ว</small></div>`;
  return box;
}
function makePendingRound(id,afterLogin=false){
  const box=document.createElement('section');
  box.dataset.ewCheckinUi='pending';
  box.className='ew-checkin-pending';
  box.innerHTML=afterLogin
    ?`<div class="ew-checkin-icon">🎟️</div><div><strong>กำลังยืนยัน Check-in: ${id}</strong><p>${sessionLabel(id)} • กำลังเชื่อมต่อ Firebase เพื่อยืนยันรอบกิจกรรม</p><small>กรุณารอสักครู่ ระบบจะลองยืนยันซ้ำอัตโนมัติ</small></div>`
    :`<div class="ew-checkin-icon">🎟️</div><div><strong>พบรอบกิจกรรม: ${id}</strong><p>${sessionLabel(id)} • กรุณา Login ด้วยรหัสผู้เล่นเพื่อยืนยัน Check-in</p><small>ระบบจะบันทึกรอบนี้ลง Firebase หลังตรวจสอบรหัสสำเร็จ</small></div>`;
  return box;
}
function makeBlocker(){
  const box=document.createElement('section');
  box.dataset.ewCheckinUi='blocker';
  box.className='ew-checkin-blocker';
  box.innerHTML=`<div class="ew-checkin-icon">📍</div><div><strong>ยังไม่ได้เลือกรอบกิจกรรม</strong><p>กรุณาสแกน QR Code ของรอบที่กำลังเข้าร่วม แล้ว Login ด้วยรหัสผู้เล่นของคุณ</p><small>ระบบจะไม่เดารอบให้อัตโนมัติ เพื่อให้ Fast Finisher และ Bonus Hunter แยกผลได้ถูกต้อง</small></div>`;
  return box;
}
function applyGate(checkedIn){
  const start=document.getElementById('startPreBtn');
  if(start){
    start.disabled=!checkedIn;
    start.setAttribute('aria-disabled',checkedIn?'false':'true');
    if(!checkedIn)start.dataset.checkinBlocked='1';else delete start.dataset.checkinBlocked;
  }
  document.querySelectorAll('.stage-card').forEach(card=>{
    if(!checkedIn){
      if(card.classList.contains('clickable')||card.classList.contains('ready')||card.classList.contains('passed')){
        card.dataset.checkinBlocked='1';
        card.setAttribute('aria-disabled','true');
      }
    }else{
      delete card.dataset.checkinBlocked;
      card.removeAttribute('aria-disabled');
    }
  });
}
function insertNearHero(node){
  const profile=document.querySelector('.profile-strip');
  const hero=document.querySelector('.hero-card');
  if(profile)profile.insertAdjacentElement('afterend',node);
  else if(hero){const heading=hero.querySelector('h1');if(heading)heading.insertAdjacentElement('afterend',node);else hero.prepend(node);}
}
function decorate(){
  if(!SCREEN)return;
  const requested=entrySession();
  removeOld();

  // Login screen is pre-authentication. Never show a green checked-in state here,
  // even when localStorage still contains the previous player's identity.
  if(onLoginScreen()){
    attendance=null;
    retryAttempt=0;
    clearRetry();
    if(requested)insertNearHero(makePendingRound(requested,false));
    else insertNearHero(makeBlocker());
    return;
  }

  const identity=readIdentity();
  if(!identity?.playerId)return;
  const checkedIn=Boolean(attendance?.checkedIn&&clean(attendance?.attendanceSessionId||attendance?.sessionId));
  applyGate(checkedIn);
  if(checkedIn){insertNearHero(makeBadge(attendance));return;}

  if(requested){insertNearHero(makePendingRound(requested,true));return;}
  insertNearHero(makeBlocker());
}

function intercept(event){
  const target=event.target?.closest?.('#startPreBtn,.stage-card');
  if(!target||!target.dataset.checkinBlocked)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  scheduleDecorate();
  if(!attendance?.checkedIn)refreshAttendance(true);
  const notice=document.querySelector('.ew-checkin-blocker,.ew-checkin-pending');
  notice?.scrollIntoView?.({behavior:'smooth',block:'center'});
}

document.addEventListener('click',intercept,true);
document.addEventListener('pointerdown',intercept,true);
document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')intercept(event)},true);
window.addEventListener('lexicon-attendance-checkin',event=>setAttendance(event.detail));
window.addEventListener('lexicon-session-assignment',event=>setAttendance(event.detail));
window.addEventListener('ew-student-auth-ready',()=>{
  if(onLoginScreen()||!readIdentity()?.playerId)return;
  attendance=null;
  retryAttempt=0;
  clearRetry();
  refreshAttendance(true);
});
window.addEventListener('pageshow',()=>refreshAttendance(true));
window.addEventListener('focus',()=>refreshAttendance(false));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshAttendance(false)});

const observer=new MutationObserver(()=>{
  scheduleDecorate();
  if(!onLoginScreen()&&readIdentity()?.playerId&&!attendance)refreshAttendance(false);
});
observer.observe(SCREEN||document.body,{childList:true,subtree:true});

const style=document.createElement('style');
style.textContent=`
.ew-checkin-badge,.ew-checkin-blocker,.ew-checkin-pending{margin:12px 0 14px;border-radius:16px;padding:12px 14px;display:flex;gap:11px;align-items:center;text-align:left}
.ew-checkin-badge{border:1px solid #9bdcc8;background:linear-gradient(135deg,#effcf7,#eef8ff);color:#155f4b}
.ew-checkin-pending{border:1px solid #9fc8f4;background:linear-gradient(135deg,#eef7ff,#f7fbff);color:#235b92}
.ew-checkin-badge strong,.ew-checkin-badge small,.ew-checkin-blocker strong,.ew-checkin-blocker small,.ew-checkin-pending strong,.ew-checkin-pending small{display:block}
.ew-checkin-badge small{margin-top:2px;color:#56776d;font-size:.76rem}.ew-checkin-pending p{margin:4px 0 3px;line-height:1.45}.ew-checkin-pending small{color:#5e7894;line-height:1.4}
.ew-checkin-dot{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;background:#d8f5e9;font-weight:950}
.ew-checkin-blocker{border:1px solid #efc77f;background:linear-gradient(135deg,#fff8e9,#fffdf7);color:#755112}.ew-checkin-blocker p{margin:4px 0 3px;line-height:1.45}.ew-checkin-blocker small{color:#8a7148;line-height:1.4}.ew-checkin-icon{font-size:1.55rem}
#startPreBtn[data-checkin-blocked="1"]{opacity:.48;cursor:not-allowed}.stage-card[data-checkin-blocked="1"]{opacity:.62!important;cursor:not-allowed!important;pointer-events:auto!important}.stage-card[data-checkin-blocked="1"] .stage-state:after{content:' • รอ Check-in';color:#a56a18}
@media(max-width:560px){.ew-checkin-badge,.ew-checkin-blocker,.ew-checkin-pending{padding:11px 12px;margin:10px 0 12px}.ew-checkin-blocker p,.ew-checkin-pending p{font-size:.84rem}.ew-checkin-blocker small,.ew-checkin-badge small,.ew-checkin-pending small{font-size:.71rem}}
`;
document.head.appendChild(style);

scheduleDecorate();
setTimeout(()=>refreshAttendance(true),150);
window.EW_PASSPORT_CHECKIN_UI=Object.freeze({version:VERSION,refresh:()=>refreshAttendance(true),getAttendance:()=>attendance,getEntrySession:entrySession});
})();
