(function(){
'use strict';
const VERSION='2026-08-19-PASSPORT-CHECKIN-UI-V6-LOCAL-FIRST-RESUME';
const SCREEN=document.getElementById('screen');
const IDENTITY_KEY=window.EW_CONFIG?.cacheKeys?.identity||'ew_passport_identity_v1';
const ATTENDANCE_KEY='LEXICON_X_ATTENDANCE_CHECKIN_V2';
let attendance=null;
let syncing=false;
let lastSyncAt=0;
let decorateQueued=false;
let retryTimer=null;
let retryAttempt=0;
const MAX_RETRY_ATTEMPTS=6;

const clean=v=>String(v==null?'':v).trim();
function readIdentity(){try{return JSON.parse(localStorage.getItem(IDENTITY_KEY)||'null')}catch(_){return null}}
function normalizeSession(value){
  const raw=clean(value).toUpperCase().replace(/\s+/g,'-').replace(/_/g,'-');
  const ids=['D1-AM','D1-PM','D2-AM','D2-PM','D3-AM','D3-PM'];
  if(ids.includes(raw))return raw;
  const compact=raw.replace(/-/g,'');
  return ids.find(id=>id.replace(/-/g,'')===compact)||'';
}
function readLocalAttendance(){
  const identity=readIdentity();
  if(!identity?.playerId)return null;
  try{
    const saved=JSON.parse(localStorage.getItem(ATTENDANCE_KEY)||'null');
    if(!saved||clean(saved.playerId)!==clean(identity.playerId))return null;
    const id=normalizeSession(saved.attendanceSessionId||saved.sessionId);
    if(!id)return null;
    return {ok:true,checkedIn:true,assigned:true,playerId:clean(identity.playerId),attendanceSessionId:id,sessionId:id,status:'CHECKED_IN_LOCAL_OPTIMISTIC',source:'local-first-resume',locked:true,localFirst:true,version:VERSION};
  }catch(_){return null;}
}
function sessionLabel(id){
  const map={'D1-AM':'Day 1 • Morning','D1-PM':'Day 1 • Afternoon','D2-AM':'Day 2 • Morning','D2-PM':'Day 2 • Afternoon','D3-AM':'Day 3 • Morning','D3-PM':'Day 3 • Afternoon'};
  return map[id]||id||'';
}
function entrySession(){
  try{return clean(window.EW_ATTENDANCE_CHECKIN?.currentEntrySession?.()||window.EW_SESSION_ASSIGNMENT?.currentEntrySession?.()||'')}catch(_){return ''}
}
function onLoginScreen(){return Boolean(document.getElementById('loginForm'))}
function scheduleDecorate(){if(decorateQueued)return;decorateQueued=true;requestAnimationFrame(()=>{decorateQueued=false;decorate();});}
function reasonOf(detail){return clean(detail?.reason).toUpperCase()}
function isTransient(detail){
  const reason=reasonOf(detail);
  return ['AUTH_NOT_READY','NOT_READY','FIREBASE_AUTH_NOT_READY','UNAVAILABLE','DEADLINE_EXCEEDED','FIRESTORE_REQUEST_TIMEOUT','FIRESTORE_ERROR'].includes(reason);
}
function clearRetry(){if(retryTimer){clearTimeout(retryTimer);retryTimer=null;}}
function scheduleRetry(){
  if(onLoginScreen()||attendance?.checkedIn||!readIdentity()?.playerId)return;
  if(retryTimer||retryAttempt>=MAX_RETRY_ATTEMPTS)return;
  const delay=Math.min(2000,250*Math.pow(2,Math.min(retryAttempt,3)));
  retryAttempt+=1;
  retryTimer=setTimeout(()=>{retryTimer=null;refreshAttendance(true);},delay);
}
function setAttendance(detail){
  if(detail?.checkedIn){attendance=detail;retryAttempt=0;clearRetry();scheduleDecorate();return;}
  const local=readLocalAttendance();
  if(local && isTransient(detail)){
    attendance={...local,degraded:true,verifyReason:reasonOf(detail)||'VERIFY_PENDING'};
    scheduleDecorate();
    return;
  }
  attendance=detail||null;
  scheduleDecorate();
  if(isTransient(detail))scheduleRetry();else clearRetry();
}

async function refreshAttendance(force=false){
  if(onLoginScreen())return null;
  const identity=readIdentity();
  if(!identity?.playerId||typeof window.EW_ATTENDANCE_CHECKIN?.syncAttendance!=='function')return null;
  const local=readLocalAttendance();
  if(!attendance && local){attendance=local;scheduleDecorate();}
  const now=Date.now();
  if(syncing||(!force&&now-lastSyncAt<1200))return attendance;
  syncing=true;lastSyncAt=now;
  try{
    const detail=await window.EW_ATTENDANCE_CHECKIN.syncAttendance(identity.playerId);
    setAttendance(detail);
    return detail;
  }catch(error){
    console.warn('[LEXICON X] Check-in UI refresh failed',error);
    const fallback=readLocalAttendance();
    if(fallback){attendance={...fallback,degraded:true,verifyReason:clean(error?.code||'FIRESTORE_ERROR').toUpperCase()};scheduleDecorate();return attendance;}
    attendance={ok:false,checkedIn:false,reason:clean(error?.code||'FIRESTORE_ERROR').toUpperCase(),message:clean(error?.message)};
    scheduleDecorate();scheduleRetry();
    return attendance;
  }finally{syncing=false;}
}

function removeOld(){document.querySelectorAll('[data-ew-checkin-ui]').forEach(el=>el.remove());}
function makeBadge(detail){
  const id=clean(detail.attendanceSessionId||detail.sessionId);
  const box=document.createElement('div');
  box.dataset.ewCheckinUi='badge';box.className='ew-checkin-badge';
  const tail=detail?.degraded?' • ยืนยันรอบจากเครื่องแล้ว ระบบกำลังตรวจ Firebase เบื้องหลัง':' • รอบถูกล็อกแล้ว';
  box.innerHTML=`<span class="ew-checkin-dot">✓</span><div><strong>Checked in: ${id}</strong><small>${sessionLabel(id)}${tail}</small></div>`;
  return box;
}
function makePendingRound(id,afterLogin=false){
  const box=document.createElement('section');
  box.dataset.ewCheckinUi='pending';box.className='ew-checkin-pending';
  box.innerHTML=afterLogin
    ?`<div class="ew-checkin-icon">🎟️</div><div><strong>กำลังยืนยัน Check-in: ${id}</strong><p>${sessionLabel(id)} • กำลังเชื่อมต่อ Firebase เพื่อยืนยันรอบกิจกรรม</p><small>กรุณารอสักครู่ ระบบจะลองยืนยันซ้ำอัตโนมัติ</small></div>`
    :`<div class="ew-checkin-icon">🎟️</div><div><strong>พบรอบกิจกรรม: ${id}</strong><p>${sessionLabel(id)} • กรุณา Login ด้วยรหัสผู้เล่นเพื่อยืนยัน Check-in</p><small>ระบบจะบันทึกรอบนี้ลง Firebase หลังตรวจสอบรหัสสำเร็จ</small></div>`;
  return box;
}
function makeError(id,detail){
  const reason=reasonOf(detail)||'FIRESTORE_ERROR';
  const map={PERMISSION_DENIED:'Firebase ปฏิเสธสิทธิ์การบันทึก',UNAVAILABLE:'Firebase ยังไม่พร้อมให้บริการ',DEADLINE_EXCEEDED:'Firebase ตอบกลับช้าเกินกำหนด',FIRESTORE_REQUEST_TIMEOUT:'การยืนยัน Check-in ใช้เวลานานเกินกำหนด',AUTH_NOT_READY:'กำลังรอ Firebase Authentication'};
  const box=document.createElement('section');
  box.dataset.ewCheckinUi='error';box.className='ew-checkin-error';
  box.innerHTML=`<div class="ew-checkin-icon">⚠️</div><div><strong>Check-in ${id} ยังไม่สำเร็จ</strong><p>${map[reason]||'เกิดข้อผิดพลาดระหว่างยืนยัน Check-in'} <code>${reason}</code></p><small>${isTransient(detail)&&retryAttempt<MAX_RETRY_ATTEMPTS?'ระบบกำลังลองใหม่อัตโนมัติ':'กรุณาแตะการ์ดภารกิจเพื่อทดลองยืนยันอีกครั้ง'}</small></div>`;
  return box;
}
function makeBlocker(){
  const box=document.createElement('section');box.dataset.ewCheckinUi='blocker';box.className='ew-checkin-blocker';
  box.innerHTML=`<div class="ew-checkin-icon">📍</div><div><strong>ยังไม่ได้เลือกรอบกิจกรรม</strong><p>กรุณาสแกน QR Code ของรอบที่กำลังเข้าร่วม แล้ว Login ด้วยรหัสผู้เล่นของคุณ</p><small>ระบบจะไม่เดารอบให้อัตโนมัติ เพื่อให้ Fast Finisher และ Bonus Hunter แยกผลได้ถูกต้อง</small></div>`;
  return box;
}
function applyGate(checkedIn){
  const start=document.getElementById('startPreBtn');
  if(start){start.disabled=!checkedIn;start.setAttribute('aria-disabled',checkedIn?'false':'true');if(!checkedIn)start.dataset.checkinBlocked='1';else delete start.dataset.checkinBlocked;}
  document.querySelectorAll('.stage-card').forEach(card=>{
    if(!checkedIn){if(card.classList.contains('clickable')||card.classList.contains('ready')||card.classList.contains('passed')){card.dataset.checkinBlocked='1';card.setAttribute('aria-disabled','true');}}
    else{delete card.dataset.checkinBlocked;card.removeAttribute('aria-disabled');}
  });
}
function insertNearHero(node){
  const profile=document.querySelector('.profile-strip');const hero=document.querySelector('.hero-card');
  if(profile)profile.insertAdjacentElement('afterend',node);
  else if(hero){const heading=hero.querySelector('h1');if(heading)heading.insertAdjacentElement('afterend',node);else hero.prepend(node);}
}
function decorate(){
  if(!SCREEN)return;
  const requested=entrySession();removeOld();
  if(onLoginScreen()){
    attendance=null;retryAttempt=0;clearRetry();
    if(requested)insertNearHero(makePendingRound(requested,false));else insertNearHero(makeBlocker());
    return;
  }
  const identity=readIdentity();if(!identity?.playerId)return;
  if(!attendance){const local=readLocalAttendance();if(local)attendance=local;}
  const checkedIn=Boolean(attendance?.checkedIn&&clean(attendance?.attendanceSessionId||attendance?.sessionId));
  applyGate(checkedIn);
  if(checkedIn){insertNearHero(makeBadge(attendance));return;}
  if(attendance && !attendance.checkedIn && reasonOf(attendance) && !['NOT_READY','FIREBASE_AUTH_NOT_READY'].includes(reasonOf(attendance))){insertNearHero(makeError(requested||clean(attendance.sessionId),attendance));return;}
  if(requested){insertNearHero(makePendingRound(requested,true));return;}
  insertNearHero(makeBlocker());
}

function intercept(event){
  const target=event.target?.closest?.('#startPreBtn,.stage-card');
  if(!target||!target.dataset.checkinBlocked)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  scheduleDecorate();refreshAttendance(true);
  document.querySelector('.ew-checkin-blocker,.ew-checkin-pending,.ew-checkin-error')?.scrollIntoView?.({behavior:'smooth',block:'center'});
}

document.addEventListener('click',intercept,true);
document.addEventListener('pointerdown',intercept,true);
document.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')intercept(event)},true);
window.addEventListener('lexicon-attendance-checkin',event=>setAttendance(event.detail));
window.addEventListener('lexicon-session-assignment',event=>setAttendance(event.detail));
window.addEventListener('ew-student-auth-ready',()=>{if(onLoginScreen()||!readIdentity()?.playerId)return;retryAttempt=0;clearRetry();refreshAttendance(true);});
window.addEventListener('pageshow',()=>{const local=readLocalAttendance();if(local){attendance=local;scheduleDecorate();}refreshAttendance(true);});
window.addEventListener('focus',()=>refreshAttendance(false));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshAttendance(false)});

const observer=new MutationObserver(()=>{scheduleDecorate();if(!onLoginScreen()&&readIdentity()?.playerId&&!attendance)refreshAttendance(false);});
observer.observe(SCREEN||document.body,{childList:true,subtree:true});

const style=document.createElement('style');
style.textContent=`
.ew-checkin-badge,.ew-checkin-blocker,.ew-checkin-pending,.ew-checkin-error{margin:12px 0 14px;border-radius:16px;padding:12px 14px;display:flex;gap:11px;align-items:center;text-align:left}
.ew-checkin-badge{border:1px solid #9bdcc8;background:linear-gradient(135deg,#effcf7,#eef8ff);color:#155f4b}
.ew-checkin-pending{border:1px solid #9fc8f4;background:linear-gradient(135deg,#eef7ff,#f7fbff);color:#235b92}
.ew-checkin-error{border:1px solid #efb1aa;background:linear-gradient(135deg,#fff2f0,#fff9f7);color:#8d3128}
.ew-checkin-badge strong,.ew-checkin-badge small,.ew-checkin-blocker strong,.ew-checkin-blocker small,.ew-checkin-pending strong,.ew-checkin-pending small,.ew-checkin-error strong,.ew-checkin-error small{display:block}
.ew-checkin-badge small{margin-top:2px;color:#56776d;font-size:.76rem}.ew-checkin-pending p,.ew-checkin-error p{margin:4px 0 3px;line-height:1.45}.ew-checkin-pending small{color:#5e7894;line-height:1.4}.ew-checkin-error small{color:#95615c;line-height:1.4}.ew-checkin-error code{font-size:.72rem}
.ew-checkin-dot{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;background:#d8f5e9;font-weight:950}
.ew-checkin-blocker{border:1px solid #efc77f;background:linear-gradient(135deg,#fff8e9,#fffdf7);color:#755112}.ew-checkin-blocker p{margin:4px 0 3px;line-height:1.45}.ew-checkin-blocker small{color:#8a7148;line-height:1.4}.ew-checkin-icon{font-size:1.55rem}
#startPreBtn[data-checkin-blocked="1"]{opacity:.48;cursor:not-allowed}.stage-card[data-checkin-blocked="1"]{opacity:.62!important;cursor:not-allowed!important;pointer-events:auto!important}.stage-card[data-checkin-blocked="1"] .stage-state:after{content:' • รอ Check-in';color:#a56a18}
@media(max-width:560px){.ew-checkin-badge,.ew-checkin-blocker,.ew-checkin-pending,.ew-checkin-error{padding:11px 12px;margin:10px 0 12px}.ew-checkin-blocker p,.ew-checkin-pending p,.ew-checkin-error p{font-size:.84rem}.ew-checkin-blocker small,.ew-checkin-badge small,.ew-checkin-pending small,.ew-checkin-error small{font-size:.71rem}}
`;
document.head.appendChild(style);

const initialLocal=readLocalAttendance();if(initialLocal)attendance=initialLocal;
scheduleDecorate();setTimeout(()=>refreshAttendance(true),150);
window.EW_PASSPORT_CHECKIN_UI=Object.freeze({version:VERSION,refresh:()=>refreshAttendance(true),getAttendance:()=>attendance,getEntrySession:entrySession});
})();
