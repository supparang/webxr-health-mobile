/* HeroHealth Firebase Authority Interaction Lock R1
 * Prevents stale localStorage state from being actionable while the current
 * Passport navigation is still reconciling with Cloud Firestore.
 */
(()=>{
'use strict';
const RELEASE='20260818-FIREBASE-AUTHORITY-INTERACTION-LOCK-R1';
const KEY='herohealth_learning_platform_rc2';
const startedAt=Date.now();
const q=new URLSearchParams(location.search);
const authority=String(q.get('authority')||'firebase').toLowerCase();
if(!['firebase','dual'].includes(authority))return;
const values=['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean);
const ids=[...new Set(values)];
if(ids.length!==1)return;
const sid=ids[0];
let released=false,timer=0;

function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}}
function ensureOverlay(){
 let box=document.getElementById('hh-firebase-authority-lock');
 if(!box){
  box=document.createElement('div');box.id='hh-firebase-authority-lock';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  box.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(244,251,250,.94);backdrop-filter:blur(4px);display:grid;place-items:center;padding:24px;color:#12302c;font:800 17px/1.55 system-ui;text-align:center';
  box.innerHTML='<div style="max-width:360px;padding:22px 20px;border:1px solid #cde7e1;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(15,118,110,.18)"><div style="font-size:32px;margin-bottom:8px">☁️</div><div>กำลังตรวจความคืบหน้าจาก Firebase</div><div style="margin-top:6px;font-size:13px;font-weight:600;color:#5f7470">กรุณารอสักครู่ ระบบจะเปิดภารกิจหลังยืนยันข้อมูลล่าสุดแล้ว</div></div>';
  (document.body||document.documentElement).appendChild(box);
 }
 const app=document.getElementById('app');if(app)try{app.inert=true}catch(_){}
 document.documentElement.dataset.hhFirebaseAuthorityReady='0';
}
function release(reason){
 if(released)return;released=true;clearInterval(timer);
 document.getElementById('hh-firebase-authority-lock')?.remove();
 const app=document.getElementById('app');if(app)try{app.inert=false}catch(_){}
 document.documentElement.dataset.hhFirebaseAuthorityReady='1';
 window.__HH_FIREBASE_AUTHORITY_READY__=true;
 window.dispatchEvent(new CustomEvent('hh:firebase-authority-ready',{detail:{studentId:sid,reason,release:RELEASE}}));
 console.info('[HeroHealth Firebase Authority Lock] released',RELEASE,{sid,reason});
}
function currentHydrationIsFresh(){
 const s=read();const fa=s?.firebaseAuthority||{};
 const hydratedAt=Date.parse(String(fa.hydratedAt||''));
 return String(s?.profile?.studentId||'')===sid&&String(fa.studentId||'')===sid&&String(fa.release||'').includes('20260818-FIREBASE-SESSION-R76')&&Number.isFinite(hydratedAt)&&hydratedAt>=startedAt;
}
function check(){
 if(window.__HH_FIREBASE_LOGIN_REQUIRED__===true){release('login-required');return;}
 if(currentHydrationIsFresh()){release('current-navigation-firestore-hydrated');return;}
 ensureOverlay();
}
window.__HH_FIREBASE_AUTHORITY_READY__=false;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{ensureOverlay();check()},{once:true});else{ensureOverlay();check()}
timer=setInterval(check,100);
window.addEventListener('storage',e=>{if(e.key===KEY)check()});
setTimeout(()=>{if(!released&&window.__HH_FIREBASE_LOGIN_REQUIRED__===true)release('login-required-timeout-check')},12000);
console.info('[HeroHealth Firebase Authority Lock] installed',RELEASE,{sid,startedAt});
})();
