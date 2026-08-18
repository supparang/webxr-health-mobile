import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260818-r76-authority';

const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'firebase').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const ACTIVE_KEY = 'herohealth_active_student_id';
const HYDRATED_KEY = 'firebaseHydratedR76';
const RELEASE = '20260818-FIREBASE-SESSION-R76-SERVER-AUTHORITY';
const RECEIPT_URL_KEYS = [
  'firebaseReceipt','returnedGame','gameCompleted','receiptToken','analyticsSchema',
  'gameSync','pendingGameSync','authorityRefresh','returnSessionPolicy'
];
const CLEAR_KEYS = [
  STATE_KEY, ACTIVE_KEY, 'HH_FIREBASE_LAST_STUDENT_ID', 'HH_FIREBASE_BOUND_STUDENT_ID',
  'HH_ACTIVE_STUDENT_ID', 'HH_CURRENT_STUDENT_ID', 'HH_PROFILE_CACHE',
  'herohealth_last_student_id', 'studentId', 'pid',
  'HHA_HANDWASH_LAST_RESULT', 'HHA_TOOTHBRUSH_LAST_RESULT', 'toothbrush_pending_result',
  'HHA_GROUPS_AR_LAST_RESULT', 'groups_ar_last_result', 'HHA_GOODJUNK_AR_LAST_RESULT',
  'GOODJUNK_AR_LAST_RESULT', 'goodjunk_pending_result', 'HHA_JUMPDUCK_LAST_RESULT',
  'HHA_BALANCE_HOLD_LAST_RESULT', 'HHA_TOOTHBRUSH_CLASSROOM_CHALLENGE_LAST'
];
const GAME_ALIASES = Object.freeze({
  handwash: ['handwash'],
  toothbrush: ['toothbrush','brush'],
  groups: ['groups','foodgroups','food-groups'],
  goodjunk: ['goodjunk','good-junk'],
  jumpduck: ['jumpduck','jump-duck'],
  balance: ['balance','balancehold','balance-hold']
});
const GAME_ZONES = Object.freeze({
  handwash: 'hygiene', toothbrush: 'hygiene',
  groups: 'nutrition', goodjunk: 'nutrition',
  jumpduck: 'fitness', balance: 'fitness'
});
let busy = false;
let loggingOut = false;

function readState(){
  try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}') || {}; }
  catch (_) { return {}; }
}
function safeSet(key,value){ try { localStorage.setItem(key,value); } catch (_) {} }
function normalizeRoster(r,sid){
  const group=String(r.group||r.rotationGroup||r.conditionGroup||'A');
  return {...r,studentId:sid,fullName:String(r.fullName||r.studentName||r.name||r.nickname||`นักเรียน ${sid}`),nickname:String(r.nickname||''),section:String(r.section||r.classId||'QA-P5'),group,rotationGroup:String(r.rotationGroup||group),active:r.active!==false};
}
function canonicalGameId(value=''){
  const raw=String(value||'').trim().toLowerCase().replace(/[_\s]+/g,'-');
  for(const [canonical,ids] of Object.entries(GAME_ALIASES)) if(canonical===raw||ids.includes(raw)) return canonical;
  return raw;
}
function remoteResultComplete(result){
  return Boolean(result && result.completed===true && result.passed!==false && result.progressionEligible!==false);
}
function canonicalRemoteState(remote={}){
  const results = remote && typeof remote.gameResults === 'object' ? remote.gameResults : {};
  const sourceGc = remote && typeof remote.gameCompleted === 'object' ? remote.gameCompleted : {};
  const gc = { hygiene:{}, nutrition:{}, fitness:{} };
  for(const [canonical,ids] of Object.entries(GAME_ALIASES)){
    const zone=GAME_ZONES[canonical];
    const done = ids.some(id=>sourceGc?.[zone]?.[id]===true) || sourceGc?.[zone]?.[canonical]===true || ids.some(id=>remoteResultComplete(results[id])) || remoteResultComplete(results[canonical]);
    gc[zone][canonical]=done;
    for(const id of ids) gc[zone][id]=done;
  }
  const pre = remote.pretestCompleted===true || remote.assessments?.pretest?.completed===true;
  const post = remote.posttestCompleted===true || remote.assessments?.posttest?.completed===true;
  const gameScores={};
  for(const [id,result] of Object.entries(results)) gameScores[id]=Number(result?.score||0);
  return {
    completed:{
      pretest:pre,
      hygiene:gc.hygiene.handwash===true && gc.hygiene.toothbrush===true,
      nutrition:gc.nutrition.groups===true && gc.nutrition.goodjunk===true,
      fitness:gc.fitness.jumpduck===true && gc.fitness.balance===true,
      posttest:post
    },
    gameCompleted:gc,
    pretestCompleted:pre,
    posttestCompleted:post,
    assessmentScores:{
      pretest:Number(remote.assessments?.pretest?.score||0),
      posttest:Number(remote.assessments?.posttest?.score||0)
    },
    gameScores,
    firebaseGameResults:results,
    firebaseLastGame:remote.lastGame||null,
    firebaseAssessments:remote.assessments&&typeof remote.assessments==='object'?remote.assessments:{},
    firebaseCanonicalUpdatedAt:remote.updatedAt||null
  };
}
function progressionFingerprint(state={}){
  try {
    return JSON.stringify({
      completed:state.completed||{},
      gameCompleted:state.gameCompleted||{},
      pretestCompleted:state.pretestCompleted===true,
      posttestCompleted:state.posttestCompleted===true,
      assessmentScores:state.assessmentScores||{},
      gameScores:state.gameScores||{}
    });
  } catch (_) { return ''; }
}
function receiptApplied(state,returnedGame){
  const canonical=canonicalGameId(returnedGame);
  if(!canonical) return true;
  const zone=GAME_ZONES[canonical];
  if(!zone) return true;
  return state?.gameCompleted?.[zone]?.[canonical]===true && remoteResultComplete(state?.firebaseGameResults?.[canonical] || GAME_ALIASES[canonical].map(id=>state?.firebaseGameResults?.[id]).find(Boolean));
}
function urlIdentity(){
  const values=['studentId','sid','pid'].map(key=>String(params.get(key)||'').trim()).filter(Boolean);
  const unique=[...new Set(values)];
  if(unique.length>1) throw new Error(`IDENTITY_CONFLICT:${unique.join('|')}`);
  return unique[0]||'';
}
function storedStudentId(){
  const state=readState();
  const values=[localStorage.getItem(ACTIVE_KEY),state?.firebaseAuthority?.studentId,state?.profile?.studentId].map(v=>String(v||'').trim()).filter(Boolean);
  const unique=[...new Set(values)];
  return unique.length===1?unique[0]:'';
}
function badge(text,error=false){
  let n=document.getElementById('hh-firebase-authority-badge');
  if(!n){
    n=document.createElement('div');n.id='hh-firebase-authority-badge';
    Object.assign(n.style,{position:'fixed',left:'12px',bottom:'12px',zIndex:'99999',padding:'8px 11px',borderRadius:'999px',font:'700 12px system-ui',border:'1px solid',boxShadow:'0 8px 24px rgba(15,23,42,.14)',pointerEvents:'none'});
    document.body.appendChild(n);
  }
  n.style.background=error?'#fef2f2':'#ecfdf5';n.style.color=error?'#991b1b':'#166534';n.style.borderColor=error?'#fecaca':'#bbf7d0';n.textContent=text;
}
function release(){
  document.documentElement.style.pointerEvents='auto';
  if(document.body){document.body.style.pointerEvents='auto';document.body.style.overflow='';}
  const app=document.getElementById('app');if(app)app.style.pointerEvents='auto';
}
function markLoginRequired(required){
  window.__HH_FIREBASE_LOGIN_REQUIRED__=required===true;
  document.documentElement.dataset.hhFirebaseSession=required?'login-required':'authenticated';
  if(required){document.getElementById('hh-mobile-next-cta')?.remove();document.getElementById('hh-sheet-sync-indicator')?.remove();}
}
function renderLogin(prefill='',message=''){
  markLoginRequired(true);const app=document.getElementById('app');if(!app)return;
  app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><div class="logo">♥</div><div>HeroHealth Learning Platform</div></div></header><main class="container"><section class="hero"><div class="card hero-card"><span class="badge">ภารกิจห้องเรียน 60 นาที</span><h1 style="font-size:clamp(2.4rem,7vw,4.5rem);margin:28px 0 18px;line-height:1.15">เป็นฮีโร่สุขภาพ<br>ใน 60 นาที</h1><p class="muted" style="font-size:1.25rem">ภารกิจเดียวสำหรับคาบนี้ • Mobile Only • Firebase เป็นข้อมูลหลัก</p></div><form id="hh-firebase-login-form" class="card"><h2>ใส่รหัสนักเรียนเพื่อเริ่มภารกิจ</h2><p class="muted">ระบบจะตรวจรหัส ชื่อ ห้อง กลุ่ม และกู้ความคืบหน้าจาก Firebase โดยอัตโนมัติ</p>${message?`<p style="color:#991b1b;font-weight:800">${String(message).replace(/[<>]/g,'')}</p>`:''}<label class="field"><b>รหัสนักเรียน</b><input name="studentId" inputmode="numeric" autocomplete="off" placeholder="กรอกรหัสนักเรียน" value="${String(prefill||'').replace(/[^0-9A-Za-z_-]/g,'')}" /></label><button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px;min-height:56px">ตรวจสอบและเข้าสู่ภารกิจ</button></form></section></main></div>`;
  release();badge(message?'Firebase • ต้องยืนยันรหัสใหม่':'Firebase • กรุณาใส่รหัสนักเรียน',Boolean(message));
}
function clearContext(){
  for(const key of CLEAR_KEYS){try{localStorage.removeItem(key)}catch(_){}try{sessionStorage.removeItem(key)}catch(_){}}
  safeSet('HH_AUTHORITY_MODE','firebase');try{sessionStorage.setItem('HH_AUTHORITY_MODE','firebase')}catch(_){}
}
function cleanLogoutUrl(){
  const url=new URL(location.href);
  for(const key of ['studentId','sid','pid','firebaseUid','firebaseReady','firebaseLogin','firebaseHydrated','firebaseHydratedR71','firebaseHydratedR72','firebaseHydratedR73','firebaseHydratedR74',HYDRATED_KEY,'firebaseProgressApplied','firebaseAssessmentReceipt',...RECEIPT_URL_KEYS,'receiptApplied','receiptAppliedGame','receiptAppliedAt']) url.searchParams.delete(key);
  url.searchParams.set('authority','firebase');url.searchParams.set('logout','1');url.searchParams.set('v',RELEASE);return url;
}
function logout(event){
  event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.();if(loggingOut)return false;
  loggingOut=true;busy=false;clearContext();const url=cleanLogoutUrl();try{history.replaceState(null,'',url.href)}catch(_){}renderLogin();loggingOut=false;return false;
}
function isLogout(el){
  if(!el||el.nodeType!==1)return false;const text=String(el.textContent||'').replace(/\s+/g,' ').trim();const onclick=String(el.getAttribute?.('onclick')||'');
  return text.includes('ออกจากผู้เล่น')||onclick.includes('HH.logout');
}
function bindLogout(){
  if(window.HH){window.HH.logout=logout;window.HH.logout.__hhFirebaseR76=true;}
  document.querySelectorAll('button,a,[role="button"],.btn').forEach(el=>{
    if(!isLogout(el)||el.dataset.hhLogoutR76==='1')return;el.dataset.hhLogoutR76='1';el.disabled=false;el.removeAttribute('disabled');el.removeAttribute('aria-disabled');el.style.pointerEvents='auto';el.style.touchAction='manipulation';el.onclick=logout;el.addEventListener('pointerup',logout,{capture:true,passive:false});el.addEventListener('click',logout,{capture:true,passive:false});
  });
}
async function writeSession(sid){
  markLoginRequired(false);
  const rosterResult=await HHFirebaseClient.readRoster(sid,{force:true});
  if(!rosterResult?.ok) throw new Error(rosterResult?.reason==='student-not-found'?'ไม่พบรหัสนี้ใน Firebase':rosterResult?.reason==='student-inactive'?'รหัสนี้ถูกปิดใช้งาน':'ตรวจสอบรหัสไม่สำเร็จ');
  const profile=normalizeRoster(rosterResult.roster||{},sid);
  const bindingResult=await HHFirebaseClient.bindStudent(sid,{rosterResult});
  if(!bindingResult?.ok) throw new Error('ยืนยันตัวตนกับ Firebase ไม่สำเร็จ');
  const loaded=await HHFirebaseClient.loadProgress(sid);
  if(!loaded?.ok) throw new Error('โหลดความคืบหน้าจาก Firebase ไม่สำเร็จ');
  const existing=readState();
  const current=String(existing?.profile?.studentId||'')===sid?existing:{};
  const canonical=canonicalRemoteState(loaded.exists&&loaded.progress?loaded.progress:{});
  const next={...current,...canonical,profile,pendingProfile:null,group:profile.group,view:'student',firebaseAuthority:{mode:'firebase',sourceOfTruth:'Cloud Firestore',uid:loaded.user?.uid||bindingResult.user?.uid||rosterResult.user?.uid||'',studentId:sid,progressPath:loaded.path,progressExists:loaded.exists===true,hydratedAt:new Date().toISOString(),release:RELEASE}};
  safeSet(STATE_KEY,JSON.stringify(next));safeSet(ACTIVE_KEY,sid);safeSet('HH_AUTHORITY_MODE','firebase');try{sessionStorage.setItem('HH_AUTHORITY_MODE','firebase')}catch(_){}
  markLoginRequired(false);return next;
}
async function hydrateReceipt(sid,returnedGame){
  const waits=[0,250,650,1250,2200];let state=null;
  for(const wait of waits){if(wait)await new Promise(resolve=>setTimeout(resolve,wait));state=await writeSession(sid);if(receiptApplied(state,returnedGame))return state;}
  throw new Error(`Firebase ยังไม่ยืนยันผล ${returnedGame||'เกมล่าสุด'} จึงยังไม่ปลดล็อกด่านถัดไป`);
}
async function login(form,button){
  if(busy||loggingOut)return;const input=form.querySelector('[name="studentId"],input');const sid=String(input?.value||'').trim().replace(/\s+/g,'');if(!sid){input?.focus();return;}
  busy=true;if(button){button.disabled=true;button.textContent='กำลังตรวจ Firebase…';}
  try{
    await writeSession(sid);const url=new URL(location.href);
    for(const key of ['logout','logoutAt','logoutNonce','firebaseHydratedR71','firebaseHydratedR72','firebaseHydratedR73','firebaseHydratedR74',...RECEIPT_URL_KEYS])url.searchParams.delete(key);
    url.searchParams.set('authority','firebase');url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.delete('pid');url.searchParams.set('firebaseReady','1');url.searchParams.set(HYDRATED_KEY,'1');url.searchParams.set('v',RELEASE);location.replace(url.href);
  }catch(error){console.error('[HeroHealth Firebase R76] login failed',error);renderLogin(sid,error?.message||'เข้าสู่ภารกิจไม่สำเร็จ');busy=false;}
}
function bindLogin(){
  document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement)||!form.querySelector('[name="studentId"],input'))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();login(form,form.querySelector('button[type="submit"],button.btn-primary'));},true);
}
async function boot(){
  if(!enabled)return;if(window.__HH_FIREBASE_PASSPORT_BOOT_R76__)return;window.__HH_FIREBASE_PASSPORT_BOOT_R76__=true;
  window.HH_AUTHORITY_MODE=mode;window.HH_FIREBASE_MODE=true;window.HH_DISABLE_SHEET_RESUME=mode==='firebase';release();bindLogin();bindLogout();
  const observer=new MutationObserver(()=>bindLogout());observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});[100,300,700,1500,3000].forEach(delay=>setTimeout(bindLogout,delay));
  if(params.get('logout')==='1'){renderLogin();return;}
  let sid='';
  try{sid=urlIdentity();}catch(error){console.error('[HeroHealth Firebase R76] identity conflict',error);clearContext();renderLogin('', 'พบรหัสผู้เรียนขัดกันในลิงก์ ระบบจึงหยุดเพื่อป้องกันการบันทึกผิดคน');return;}
  if(!sid){
    const stored=storedStudentId();
    if(stored){const url=new URL(location.href);url.searchParams.set('authority','firebase');url.searchParams.set('studentId',stored);url.searchParams.set('sid',stored);url.searchParams.delete('pid');url.searchParams.set('firebaseReady','1');url.searchParams.delete(HYDRATED_KEY);url.searchParams.set('sessionRecovery','server-authority-r76');url.searchParams.set('v',RELEASE);location.replace(url.href);return;}
    renderLogin();return;
  }
  const before=readState();const beforeFingerprint=progressionFingerprint(before);
  const receiptReturn=params.get('firebaseReceipt')==='1';const returnedGame=canonicalGameId(params.get('returnedGame')||'');
  try{
    badge(receiptReturn?`Firebase • ${sid} • กำลังยืนยัน ${returnedGame||'เกมล่าสุด'}…`:`Firebase • ${sid} • กำลังตรวจความคืบหน้า…`);
    const state=receiptReturn?await hydrateReceipt(sid,returnedGame):await writeSession(sid);
    const changed=beforeFingerprint!==progressionFingerprint(state);
    const hydrated=params.get(HYDRATED_KEY)==='1';
    if(!hydrated||receiptReturn||changed||params.has('authorityRefresh')||String(params.get('returnSessionPolicy')||'').startsWith('force-firebase-rehydrate')){
      const url=new URL(location.href);
      for(const key of ['firebaseHydratedR71','firebaseHydratedR72','firebaseHydratedR73','firebaseHydratedR74',...RECEIPT_URL_KEYS])url.searchParams.delete(key);
      url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.delete('pid');url.searchParams.set('authority','firebase');url.searchParams.set('firebaseReady','1');url.searchParams.set(HYDRATED_KEY,'1');url.searchParams.set('v',RELEASE);
      if(receiptReturn){url.searchParams.set('receiptApplied','1');if(returnedGame)url.searchParams.set('receiptAppliedGame',returnedGame);url.searchParams.set('receiptAppliedAt',Date.now().toString());}
      location.replace(url.href);return;
    }
    markLoginRequired(false);const applied=params.get('receiptAppliedGame');badge(applied?`Firebase • ${sid} • ${applied} ยืนยันแล้ว • ด่านถัดไปพร้อม`:`Firebase • ${sid} • ความคืบหน้าตรงกับ Firestore`);bindLogout();
  }catch(error){console.error('[HeroHealth Firebase R76] hydrate failed',error);renderLogin(sid,error?.message||'กู้ข้อมูลจาก Firebase ไม่สำเร็จ');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
