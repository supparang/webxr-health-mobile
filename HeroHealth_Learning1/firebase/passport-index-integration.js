import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260804-session-r71';

const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'firebase').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const ACTIVE_KEY = 'herohealth_active_student_id';
const RELEASE = '20260804-FIREBASE-SESSION-R71-STABLE-LOGOUT';
const CLEAR_KEYS = [
  STATE_KEY, ACTIVE_KEY, 'HH_FIREBASE_LAST_STUDENT_ID', 'HH_FIREBASE_BOUND_STUDENT_ID',
  'HH_ACTIVE_STUDENT_ID', 'HH_CURRENT_STUDENT_ID', 'HH_PROFILE_CACHE',
  'herohealth_last_student_id', 'studentId', 'pid',
  'HHA_HANDWASH_LAST_RESULT', 'HHA_TOOTHBRUSH_LAST_RESULT', 'toothbrush_pending_result',
  'HHA_GROUPS_AR_LAST_RESULT', 'groups_ar_last_result', 'HHA_GOODJUNK_AR_LAST_RESULT',
  'GOODJUNK_AR_LAST_RESULT', 'goodjunk_pending_result', 'HHA_JUMPDUCK_LAST_RESULT',
  'HHA_BALANCE_HOLD_LAST_RESULT', 'HHA_TOOTHBRUSH_CLASSROOM_CHALLENGE_LAST'
];
let busy = false;
let loggingOut = false;

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function merge(base={},patch={}){const out={...base};for(const [k,v] of Object.entries(patch||{}))out[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(out[k]||{},v):v;return out}
function normalizeRoster(r,sid){const group=String(r.group||r.rotationGroup||r.conditionGroup||'A');return{...r,studentId:sid,fullName:String(r.fullName||r.studentName||r.name||r.nickname||`นักเรียน ${sid}`),nickname:String(r.nickname||''),section:String(r.section||r.classId||'QA-P5'),group,rotationGroup:String(r.rotationGroup||group),active:r.active!==false}}
function resultPassed(r){return !!(r&&(r.completed===true||r.passed===true||r.progressionEligible===true||r.firebaseReceiptToken))}
function rebuild(remote={},existing={}){
  const results=remote.gameResults||{};
  const gc=merge(existing.gameCompleted||{hygiene:{},nutrition:{},fitness:{}},remote.gameCompleted||{});
  gc.hygiene=gc.hygiene||{};gc.nutrition=gc.nutrition||{};gc.fitness=gc.fitness||{};
  const aliases={handwash:['handwash'],toothbrush:['toothbrush','brush'],groups:['groups','foodgroups','food-groups'],goodjunk:['goodjunk','good-junk'],jumpduck:['jumpduck','jump-duck'],balance:['balance','balancehold','balance-hold']};
  const zones={handwash:'hygiene',toothbrush:'hygiene',groups:'nutrition',goodjunk:'nutrition',jumpduck:'fitness',balance:'fitness'};
  for(const [canonical,ids] of Object.entries(aliases)){
    const zone=zones[canonical];
    if(ids.some(id=>gc[zone]?.[id]===true)||ids.some(id=>resultPassed(results[id])))gc[zone][canonical]=true;
  }
  const pre=remote.pretestCompleted===true||remote.assessments?.pretest?.completed===true;
  const post=remote.posttestCompleted===true||remote.assessments?.posttest?.completed===true;
  return {
    completed:{...(existing.completed||{}),pretest:pre,hygiene:gc.hygiene.handwash===true&&gc.hygiene.toothbrush===true,nutrition:gc.nutrition.groups===true&&gc.nutrition.goodjunk===true,fitness:gc.fitness.jumpduck===true&&gc.fitness.balance===true,posttest:post},
    gameCompleted:gc,pretestCompleted:pre,posttestCompleted:post,
    assessmentScores:{...(existing.assessmentScores||{}),pretest:Number(remote.assessments?.pretest?.score||existing.assessmentScores?.pretest||0),posttest:Number(remote.assessments?.posttest?.score||existing.assessmentScores?.posttest||0)},
    gameScores:merge(existing.gameScores||{},Object.fromEntries(Object.entries(results).map(([id,r])=>[id,Number(r?.score||0)]))),
    firebaseGameResults:merge(existing.firebaseGameResults||{},results),
    firebaseLastGame:remote.lastGame||existing.firebaseLastGame||null,
    firebaseAssessments:merge(existing.firebaseAssessments||{},remote.assessments||{})
  };
}
function badge(text){let n=document.getElementById('hh-firebase-authority-badge');if(!n){n=document.createElement('div');n.id='hh-firebase-authority-badge';Object.assign(n.style,{position:'fixed',left:'12px',bottom:'12px',zIndex:'99999',padding:'8px 11px',borderRadius:'999px',font:'700 12px system-ui',background:'#ecfdf5',color:'#166534',border:'1px solid #bbf7d0',boxShadow:'0 8px 24px rgba(15,23,42,.14)',pointerEvents:'none'});document.body.appendChild(n)}n.textContent=text}
function release(){document.documentElement.style.pointerEvents='auto';if(document.body){document.body.style.pointerEvents='auto';document.body.style.overflow=''}const app=document.getElementById('app');if(app)app.style.pointerEvents='auto'}
function renderLogin(){
  const app=document.getElementById('app');if(!app)return;
  app.innerHTML=`<div class="shell"><header class="topbar"><div class="brand"><div class="logo">♥</div><div>HeroHealth Learning Platform</div></div></header><main class="container"><section class="hero"><div class="card hero-card"><span class="badge">ภารกิจห้องเรียน 60 นาที</span><h1 style="font-size:clamp(2.4rem,7vw,4.5rem);margin:28px 0 18px;line-height:1.15">เป็นฮีโร่สุขภาพ<br>ใน 60 นาที</h1><p class="muted" style="font-size:1.25rem">ภารกิจเดียวสำหรับคาบนี้ • Mobile Only • ระบบจัดลำดับฐานให้อัตโนมัติ</p></div><form id="hh-firebase-login-form" class="card"><h2>ใส่รหัสนักเรียนเพื่อเริ่มภารกิจ</h2><p class="muted">ระบบจะตรวจรหัส ชื่อ ห้อง กลุ่ม และกู้ความคืบหน้าจาก Firebase โดยอัตโนมัติ</p><label class="field"><b>รหัสนักเรียน</b><input name="studentId" inputmode="numeric" autocomplete="off" placeholder="กรอกรหัสนักเรียน" /></label><button type="submit" class="btn btn-primary" style="width:100%;margin-top:16px;min-height:56px">ตรวจสอบและเข้าสู่ภารกิจ</button></form></section></main></div>`;
  release();badge('Firebase • กรุณาใส่รหัสนักเรียน');
}
function clearContext(){for(const key of CLEAR_KEYS){try{localStorage.removeItem(key)}catch(_){}try{sessionStorage.removeItem(key)}catch(_){}}try{localStorage.setItem('HH_AUTHORITY_MODE','firebase');sessionStorage.setItem('HH_AUTHORITY_MODE','firebase')}catch(_){}}
function cleanLogoutUrl(){const url=new URL(location.href);for(const key of ['studentId','sid','pid','firebaseUid','firebaseReady','firebaseLogin','firebaseHydrated','firebaseHydratedR71','firebaseProgressApplied','firebaseReceipt','firebaseAssessmentReceipt','gameSync','pendingGameSync'])url.searchParams.delete(key);url.searchParams.set('authority','firebase');url.searchParams.set('logout','1');url.searchParams.set('v','20260804-session-r71');return url}
function logout(event){
  event?.preventDefault?.();event?.stopPropagation?.();event?.stopImmediatePropagation?.();
  if(loggingOut)return false;loggingOut=true;busy=false;
  clearContext();
  const url=cleanLogoutUrl();try{history.replaceState(null,'',url.href)}catch(_){}
  renderLogin();loggingOut=false;
  return false;
}
function isLogout(el){if(!el||el.nodeType!==1)return false;const text=String(el.textContent||'').replace(/\s+/g,' ').trim();const onclick=String(el.getAttribute?.('onclick')||'');return text.includes('ออกจากผู้เล่น')||onclick.includes('HH.logout')}
function bindLogout(){
  const install=()=>{if(window.HH){window.HH.logout=logout;window.HH.logout.__hhFirebaseR71=true}}
  install();
  document.querySelectorAll('button,a,[role="button"],.btn').forEach(el=>{if(!isLogout(el)||el.dataset.hhLogoutR71==='1')return;el.dataset.hhLogoutR71='1';el.disabled=false;el.removeAttribute('disabled');el.removeAttribute('aria-disabled');el.style.pointerEvents='auto';el.style.touchAction='manipulation';el.onclick=logout;el.addEventListener('pointerup',logout,{capture:true,passive:false});el.addEventListener('click',logout,{capture:true,passive:false})});
}
async function writeSession(sid){
  const rosterResult=await HHFirebaseClient.readRoster(sid);if(!rosterResult?.ok)throw new Error(rosterResult?.reason==='student-not-found'?'ไม่พบรหัสนี้ใน Firebase':rosterResult?.reason==='student-inactive'?'รหัสนี้ถูกปิดใช้งาน':'ตรวจสอบรหัสไม่สำเร็จ');
  const profile=normalizeRoster(rosterResult.roster||{},sid);await HHFirebaseClient.bindStudent(sid);
  const loaded=await HHFirebaseClient.loadProgress(sid);if(!loaded?.ok)throw new Error('โหลดความคืบหน้าจาก Firebase ไม่สำเร็จ');
  const current=readState(), recovered=rebuild(loaded.exists&&loaded.progress?loaded.progress:{},current);
  const next={...current,...recovered,profile,pendingProfile:null,group:profile.group,view:'student',firebaseAuthority:{mode:'firebase',uid:loaded.user?.uid||rosterResult.user?.uid||'',studentId:sid,progressPath:loaded.path,progressExists:loaded.exists===true,hydratedAt:new Date().toISOString(),release:RELEASE}};
  localStorage.setItem(STATE_KEY,JSON.stringify(next));localStorage.setItem(ACTIVE_KEY,sid);localStorage.setItem('HH_AUTHORITY_MODE','firebase');sessionStorage.setItem('HH_AUTHORITY_MODE','firebase');
}
async function login(form,button){
  if(busy||loggingOut)return;const input=form.querySelector('[name="studentId"],input');const sid=String(input?.value||'').trim().replace(/\s+/g,'');if(!sid){input?.focus();return}busy=true;if(button){button.disabled=true;button.textContent='กำลังกู้ความคืบหน้าจาก Firebase…'}
  try{await writeSession(sid);const url=new URL(location.href);for(const key of ['logout','logoutAt','logoutNonce'])url.searchParams.delete(key);url.searchParams.set('authority','firebase');url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.set('firebaseReady','1');url.searchParams.set('firebaseHydratedR71','1');url.searchParams.set('v','20260804-session-r71');location.replace(url.href)}catch(error){console.error('[HeroHealth Firebase R71] login failed',error);alert(error?.message||'เข้าสู่ภารกิจไม่สำเร็จ');busy=false;if(button){button.disabled=false;button.textContent='ตรวจสอบและเข้าสู่ภารกิจ'}}
}
function bindLogin(){document.addEventListener('submit',event=>{const form=event.target;if(!(form instanceof HTMLFormElement)||!form.querySelector('[name="studentId"],input'))return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();login(form,form.querySelector('button[type="submit"],button.btn-primary'))},true)}
async function boot(){
  if(!enabled)return;window.HH_AUTHORITY_MODE=mode;window.HH_DISABLE_SHEET_RESUME=mode==='firebase';release();bindLogin();bindLogout();
  const observer=new MutationObserver(()=>bindLogout());observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  [100,300,700,1500,3000,6000].forEach(delay=>setTimeout(bindLogout,delay));
  if(params.get('logout')==='1'){renderLogin();return}
  const sid=String(params.get('studentId')||params.get('sid')||'').trim();
  if(!sid){renderLogin();return}
  if(params.get('firebaseHydratedR71')!=='1'){
    try{await writeSession(sid);const url=new URL(location.href);url.searchParams.set('firebaseHydratedR71','1');url.searchParams.set('v','20260804-session-r71');location.replace(url.href);return}catch(error){console.error('[HeroHealth Firebase R71] hydrate failed',error);badge(`Firebase • ${error?.message||'กู้ข้อมูลไม่สำเร็จ'}`)}
  }
  badge(`Firebase • ${sid} • ความคืบหน้าพร้อมใช้งาน`);bindLogout();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
