/* HeroHealth Firebase Authority Interaction Lock R2
 * Fail-closed guard against stale localStorage progression before the current
 * Passport navigation has been reconciled with Cloud Firestore.
 *
 * Policy:
 * - In Firebase/dual mode, the Passport is non-actionable until R76 hydration
 *   for the current learner is fresh for this navigation, or the login screen
 *   has explicitly taken control.
 * - Conflicting/missing URL identity never bypasses the lock.
 * - A recovery action is shown after a prolonged hydrate without ever treating
 *   local state as authoritative.
 */
(()=>{
'use strict';
const RELEASE='20260818-FIREBASE-AUTHORITY-INTERACTION-LOCK-R2-FAIL-CLOSED';
const KEY='herohealth_learning_platform_rc2';
const ACTIVE_KEY='herohealth_active_student_id';
const SESSION_RELEASE_MARKER='20260818-FIREBASE-SESSION-R76';
const startedAt=Date.now();
const q=new URLSearchParams(location.search);
const authority=String(q.get('authority')||'firebase').toLowerCase();
if(!['firebase','dual'].includes(authority))return;

function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}}
function urlIdentity(){
 const values=['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean);
 const unique=[...new Set(values)];
 return {values:unique,conflict:unique.length>1,sid:unique.length===1?unique[0]:''};
}
function storedIdentity(){
 const s=read();
 const values=[localStorage.getItem(ACTIVE_KEY),s?.firebaseAuthority?.studentId,s?.profile?.studentId]
  .map(v=>String(v||'').trim()).filter(Boolean);
 const unique=[...new Set(values)];
 return unique.length===1?unique[0]:'';
}
function intendedSid(){const u=urlIdentity();return u.sid||(!u.conflict?storedIdentity():'');}

let released=false,timer=0,recoveryShown=false;
function overlayMessage(){
 const u=urlIdentity();
 if(u.conflict)return 'กำลังป้องกันข้อมูลรหัสนักเรียนที่ขัดกัน';
 return 'กำลังตรวจความคืบหน้าจาก Firebase';
}
function ensureOverlay(){
 let box=document.getElementById('hh-firebase-authority-lock');
 if(!box){
  box=document.createElement('div');box.id='hh-firebase-authority-lock';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  box.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(244,251,250,.96);backdrop-filter:blur(4px);display:grid;place-items:center;padding:24px;color:#12302c;font:800 17px/1.55 system-ui;text-align:center';
  box.innerHTML='<div id="hh-firebase-authority-lock-card" style="max-width:380px;padding:22px 20px;border:1px solid #cde7e1;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(15,118,110,.18)"><div style="font-size:32px;margin-bottom:8px">☁️</div><div id="hh-firebase-authority-lock-title"></div><div id="hh-firebase-authority-lock-detail" style="margin-top:6px;font-size:13px;font-weight:600;color:#5f7470">กรุณารอสักครู่ ระบบจะเปิดภารกิจหลังยืนยันข้อมูลล่าสุดแล้ว</div></div>';
  (document.body||document.documentElement).appendChild(box);
 }
 const title=document.getElementById('hh-firebase-authority-lock-title');if(title)title.textContent=overlayMessage();
 const app=document.getElementById('app');if(app)try{app.inert=true}catch(_){}
 document.documentElement.dataset.hhFirebaseAuthorityReady='0';
 document.documentElement.dataset.hhFirebaseAuthorityRelease=RELEASE;
}
function showRecovery(){
 if(released||recoveryShown)return;recoveryShown=true;ensureOverlay();
 const detail=document.getElementById('hh-firebase-authority-lock-detail');
 if(detail)detail.innerHTML='ยังไม่ได้รับการยืนยันจาก Firebase จึงยังไม่เปิดภารกิจ<br><button id="hh-firebase-authority-recover" type="button" style="margin-top:12px;border:0;border-radius:12px;padding:10px 14px;background:#0f766e;color:#fff;font:800 14px system-ui">กลับหน้าเข้าสู่ระบบ</button>';
 const button=document.getElementById('hh-firebase-authority-recover');
 if(button)button.onclick=()=>{
  try{
   const u=new URL(location.href);
   for(const key of ['studentId','sid','pid','firebaseUid','firebaseReady','firebaseReceipt','returnedGame','gameCompleted','receiptToken','authorityRefresh','firebaseHydratedR76','firebaseHydratedR74'])u.searchParams.delete(key);
   u.searchParams.set('authority','firebase');u.searchParams.set('logout','1');u.searchParams.set('v',RELEASE);location.replace(u.href);
  }catch(_){location.reload();}
 };
}
function release(reason){
 if(released)return;released=true;clearInterval(timer);
 document.getElementById('hh-firebase-authority-lock')?.remove();
 const app=document.getElementById('app');if(app)try{app.inert=false}catch(_){}
 document.documentElement.dataset.hhFirebaseAuthorityReady='1';
 window.__HH_FIREBASE_AUTHORITY_READY__=true;
 window.dispatchEvent(new CustomEvent('hh:firebase-authority-ready',{detail:{studentId:intendedSid(),reason,release:RELEASE}}));
 console.info('[HeroHealth Firebase Authority Lock] released',RELEASE,{sid:intendedSid(),reason});
}
function currentHydrationIsFresh(){
 const sid=intendedSid();if(!sid||urlIdentity().conflict)return false;
 const s=read(),fa=s?.firebaseAuthority||{};const hydratedAt=Date.parse(String(fa.hydratedAt||''));
 return String(s?.profile?.studentId||'')===sid&&String(fa.studentId||'')===sid&&String(fa.sourceOfTruth||'')==='Cloud Firestore'&&String(fa.release||'').includes(SESSION_RELEASE_MARKER)&&Number.isFinite(hydratedAt)&&hydratedAt>=startedAt;
}
function check(){
 if(window.__HH_FIREBASE_LOGIN_REQUIRED__===true){release('login-required');return;}
 if(currentHydrationIsFresh()){release('current-navigation-firestore-hydrated');return;}
 ensureOverlay();
}

window.__HH_FIREBASE_AUTHORITY_READY__=false;
ensureOverlay();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureOverlay();check()},{once:true});else check();
timer=setInterval(check,100);
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===ACTIVE_KEY)check()});
window.addEventListener('hh:firebase-state-updated',check);
setTimeout(showRecovery,12000);
console.info('[HeroHealth Firebase Authority Lock] installed',RELEASE,{intendedSid:intendedSid(),identity:urlIdentity(),startedAt});
})();
