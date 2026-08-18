/* HeroHealth Firebase Authority Interaction Lock R5
 * Fail-closed UI guard. Passport remains the authority owner.
 *
 * R5 fixes the R78 redirect deadlock by accepting only verifiable handoffs:
 * - current-navigation Firestore hydration
 * - explicit fresh Passport handoff
 * - recent same-student Firebase login commit in this browser session
 *
 * Receipt returns / forced refreshes never use stale handoff shortcuts.
 * If the Passport module fails to load, show a visible diagnostic instead of
 * leaving children on an endless loading overlay.
 */
(()=>{
'use strict';
const RELEASE='20260818-FIREBASE-AUTHORITY-INTERACTION-LOCK-R5-SESSION-HANDOFF-DIAG';
const KEY='herohealth_learning_platform_rc2';
const ACTIVE_KEY='herohealth_active_student_id';
const HYDRATED_KEY='firebaseHydratedR76';
const LOGIN_COMMIT_KEY='HH_FIREBASE_RECENT_LOGIN_COMMIT_R74';
const SUPPORTED_SESSION_RELEASE=/^20260818-FIREBASE-SESSION-R(?:76|77|78|79)(?:-|$)/;
const FRESH_HANDOFF_TTL_MS=30000;
const LOGIN_COMMIT_TTL_MS=20000;
const WATCHDOG_MS=9000;
const startedAt=Date.now();
const q=new URLSearchParams(location.search);
const authority=String(q.get('authority')||'firebase').toLowerCase();
if(!['firebase','dual'].includes(authority))return;

function readState(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch(_){return{}}}
function readSession(key){try{return JSON.parse(sessionStorage.getItem(key)||'null')}catch(_){return null}}
function urlIdentity(){
 const values=['studentId','sid','pid'].map(k=>String(q.get(k)||'').trim()).filter(Boolean);
 const unique=[...new Set(values)];
 return {values:unique,conflict:unique.length>1,sid:unique.length===1?unique[0]:''};
}
function storedIdentity(){
 const s=readState();
 const values=[localStorage.getItem(ACTIVE_KEY),s?.firebaseAuthority?.studentId,s?.profile?.studentId]
  .map(v=>String(v||'').trim()).filter(Boolean);
 const unique=[...new Set(values)];
 return unique.length===1?unique[0]:'';
}
function intendedSid(){const u=urlIdentity();return u.sid||(!u.conflict?storedIdentity():'')}
function forcedNavigation(){
 return q.get('firebaseReceipt')==='1'
  || q.has('authorityRefresh')
  || String(q.get('returnSessionPolicy')||'').startsWith('force-firebase-rehydrate');
}
function explicitHydratedHandoff(){
 return q.get('firebaseReady')==='1'&&q.get(HYDRATED_KEY)==='1'&&!forcedNavigation();
}
function recentLoginCommit(sid){
 if(!sid||forcedNavigation()||q.get('logout')==='1')return false;
 const c=readSession(LOGIN_COMMIT_KEY);if(!c)return false;
 const age=Date.now()-Number(c.at||0);
 return String(c.sid||'')===sid&&age>=0&&age<=LOGIN_COMMIT_TTL_MS;
}

let released=false,timer=0,terminal=false;
function ensureOverlay(){
 let box=document.getElementById('hh-firebase-authority-lock');
 if(!box){
  box=document.createElement('div');box.id='hh-firebase-authority-lock';box.setAttribute('role','status');box.setAttribute('aria-live','polite');
  box.style.cssText='position:fixed;inset:0;z-index:2147483600;background:rgba(244,251,250,.97);backdrop-filter:blur(4px);display:grid;place-items:center;padding:24px;color:#12302c;font:800 17px/1.55 system-ui;text-align:center';
  box.innerHTML='<div id="hh-firebase-authority-lock-card" style="width:min(390px,100%);padding:22px 20px;border:1px solid #cde7e1;border-radius:22px;background:#fff;box-shadow:0 18px 50px rgba(15,118,110,.18)"><div id="hh-firebase-authority-lock-icon" style="font-size:32px;margin-bottom:8px">☁️</div><div id="hh-firebase-authority-lock-title">กำลังตรวจความคืบหน้าจาก Firebase</div><div id="hh-firebase-authority-lock-detail" style="margin-top:6px;font-size:13px;font-weight:600;color:#5f7470">กรุณารอสักครู่ ระบบจะเปิดภารกิจหลังยืนยันข้อมูลล่าสุดแล้ว</div></div>';
  (document.body||document.documentElement).appendChild(box);
 }
 const u=urlIdentity();
 const title=document.getElementById('hh-firebase-authority-lock-title');
 if(title&&!terminal)title.textContent=u.conflict?'กำลังป้องกันข้อมูลรหัสนักเรียนที่ขัดกัน':'กำลังตรวจความคืบหน้าจาก Firebase';
 const app=document.getElementById('app');if(app)try{app.inert=true}catch(_){}
 document.documentElement.dataset.hhFirebaseAuthorityReady='0';
 document.documentElement.dataset.hhFirebaseAuthorityRelease=RELEASE;
}
function cleanLoginUrl(){
 const u=new URL(location.href);
 for(const key of ['studentId','sid','pid','firebaseUid','firebaseReady','firebaseReceipt','returnedGame','gameCompleted','receiptToken','authorityRefresh','firebaseHydratedR76','firebaseHydratedR74','returnSessionPolicy'])u.searchParams.delete(key);
 u.searchParams.set('authority','firebase');u.searchParams.set('logout','1');u.searchParams.set('v',RELEASE);return u;
}
function showTerminal(titleText,detailText){
 if(released)return;terminal=true;clearInterval(timer);ensureOverlay();
 const icon=document.getElementById('hh-firebase-authority-lock-icon');if(icon)icon.textContent='⚠️';
 const title=document.getElementById('hh-firebase-authority-lock-title');if(title)title.textContent=titleText;
 const detail=document.getElementById('hh-firebase-authority-lock-detail');
 if(detail)detail.innerHTML=`${String(detailText||'').replace(/[<>]/g,'')}<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px"><button id="hh-firebase-retry" type="button" style="border:0;border-radius:12px;padding:11px 10px;background:#0f766e;color:#fff;font:800 13px system-ui">ลองเชื่อมใหม่</button><button id="hh-firebase-login" type="button" style="border:1px solid #b8ddd6;border-radius:12px;padding:11px 10px;background:#eefaf7;color:#0f766e;font:800 13px system-ui">เข้าสู่ระบบใหม่</button></div>`;
 const retry=document.getElementById('hh-firebase-retry');if(retry)retry.onclick=()=>{const u=new URL(location.href);u.searchParams.set('lockRetry',Date.now().toString());u.searchParams.set('v',RELEASE);location.replace(u.href)};
 const login=document.getElementById('hh-firebase-login');if(login)login.onclick=()=>location.replace(cleanLoginUrl().href);
}
function release(reason){
 if(released)return;released=true;clearInterval(timer);
 document.getElementById('hh-firebase-authority-lock')?.remove();
 const app=document.getElementById('app');if(app)try{app.inert=false}catch(_){}
 document.documentElement.dataset.hhFirebaseAuthorityReady='1';
 window.__HH_FIREBASE_AUTHORITY_READY__=true;
 window.dispatchEvent(new CustomEvent('hh:firebase-authority-ready',{detail:{studentId:intendedSid(),reason,release:RELEASE}}));
 console.info('[HeroHealth Firebase Authority Lock R5] released',{sid:intendedSid(),reason});
}
function hydrationDecision(){
 const sid=intendedSid();if(!sid||urlIdentity().conflict)return{ok:false,reason:'identity-not-ready'};
 const s=readState(),fa=s?.firebaseAuthority||{},sessionRelease=String(fa.release||'');
 const hydratedAt=Date.parse(String(fa.hydratedAt||''));
 const base=String(s?.profile?.studentId||'')===sid
  &&String(fa.studentId||'')===sid
  &&String(fa.sourceOfTruth||'')==='Cloud Firestore'
  &&SUPPORTED_SESSION_RELEASE.test(sessionRelease)
  &&Number.isFinite(hydratedAt);
 if(!base)return{ok:false,reason:'canonical-state-not-ready'};
 if(hydratedAt>=startedAt)return{ok:true,reason:'current-navigation-firestore-hydrated'};
 const age=Date.now()-hydratedAt;
 if(age<0||age>FRESH_HANDOFF_TTL_MS)return{ok:false,reason:'hydration-too-old'};
 if(explicitHydratedHandoff())return{ok:true,reason:'trusted-url-firestore-handoff'};
 if(recentLoginCommit(sid))return{ok:true,reason:'trusted-session-login-commit'};
 return{ok:false,reason:'fresh-state-without-handoff'};
}
function check(){
 if(released||terminal)return;
 if(window.__HH_FIREBASE_LOGIN_REQUIRED__===true){release('login-required');return;}
 if(window.__HH_FIREBASE_PASSPORT_IMPORT_ERROR__){showTerminal('โหลดระบบ Firebase ไม่สำเร็จ',String(window.__HH_FIREBASE_PASSPORT_IMPORT_ERROR__));return;}
 const decision=hydrationDecision();if(decision.ok){release(decision.reason);return;}
 ensureOverlay();
}

window.__HH_FIREBASE_AUTHORITY_READY__=false;
ensureOverlay();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',check,{once:true});else check();
timer=setInterval(check,120);
window.addEventListener('storage',e=>{if(e.key===KEY||e.key===ACTIVE_KEY)check()});
window.addEventListener('hh:firebase-state-updated',check);
window.addEventListener('hh:firebase-authority-error',e=>showTerminal('โหลดระบบ Firebase ไม่สำเร็จ',String(e?.detail?.message||'Passport module error')));
setTimeout(()=>{
 if(released||terminal)return;
 const booted=Boolean(window.__HH_FIREBASE_PASSPORT_BOOT_R78__||window.__HH_FIREBASE_PASSPORT_BOOT_R79__);
 const d=hydrationDecision();
 const sid=intendedSid()||'ไม่พบรหัส';
 if(!booted)showTerminal('โหลด HeroHealth Passport ไม่สำเร็จ',`โมดูล Firebase ไม่เริ่มทำงาน • รหัส ${sid}`);
 else showTerminal('Firebase ยังไม่ยืนยันข้อมูล',`ระบบเริ่มทำงานแล้ว แต่ยังไม่ได้รับ authority ที่ถูกต้อง • ${d.reason} • รหัส ${sid}`);
},WATCHDOG_MS);
console.info('[HeroHealth Firebase Authority Lock R5] installed',{release:RELEASE,intendedSid:intendedSid(),startedAt});
})();
