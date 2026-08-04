import { HHFirebaseClient } from './herohealth-firebase-client.js?cv=20260804-passport-r63';

const params = new URLSearchParams(location.search);
const mode = String(params.get('authority') || 'firebase').toLowerCase();
const enabled = mode === 'firebase' || mode === 'dual';
const STATE_KEY = 'herohealth_learning_platform_rc2';
const ACTIVE_KEY = 'herohealth_active_student_id';
const RELEASE = '20260804-PASSPORT-FIREBASE-R63-ATOMIC-LOGOUT';
const STUDENT_KEYS = ['studentId','sid','pid','firebaseUid','firebaseReady','firebaseLogin','firebaseHydrated','firebaseProgressApplied','firebaseReceipt','firebaseAssessmentReceipt','gameSync','pendingGameSync'];
const LOCAL_CONTEXT_KEYS = [
  STATE_KEY, ACTIVE_KEY, 'HH_FIREBASE_LAST_STUDENT_ID', 'HH_FIREBASE_BOUND_STUDENT_ID',
  'HH_ACTIVE_STUDENT_ID', 'HH_CURRENT_STUDENT_ID', 'HH_PROFILE_CACHE',
  'HHA_HANDWASH_LAST_RESULT', 'HHA_TOOTHBRUSH_LAST_RESULT', 'toothbrush_pending_result',
  'HHA_GROUPS_AR_LAST_RESULT', 'groups_ar_last_result', 'HHA_GOODJUNK_AR_LAST_RESULT',
  'GOODJUNK_AR_LAST_RESULT', 'goodjunk_pending_result', 'HHA_JUMPDUCK_LAST_RESULT',
  'HHA_BALANCE_HOLD_LAST_RESULT', 'HHA_TOOTHBRUSH_CLASSROOM_CHALLENGE_LAST'
];
let busy = false;
let loggingOut = false;

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function merge(base={},patch={}){const out={...base};Object.entries(patch||{}).forEach(([k,v])=>{out[k]=v&&typeof v==='object'&&!Array.isArray(v)?merge(out[k]||{},v):v});return out}
function badge(text){let n=document.getElementById('hh-firebase-authority-badge');if(!n){n=document.createElement('div');n.id='hh-firebase-authority-badge';Object.assign(n.style,{position:'fixed',left:'12px',bottom:'12px',zIndex:'99999',padding:'8px 11px',borderRadius:'999px',font:'700 12px system-ui',background:'#ecfdf5',color:'#166534',border:'1px solid #bbf7d0',boxShadow:'0 8px 24px rgba(15,23,42,.14)',pointerEvents:'none'});document.body.appendChild(n)}n.textContent=text}
function release(){document.querySelectorAll('#hh-sheet-login-status').forEach(n=>n.remove());document.documentElement.style.pointerEvents='auto';if(document.body){document.body.style.pointerEvents='auto';document.body.style.overflow=''}const app=document.getElementById('app');if(app)app.style.pointerEvents='auto'}
function normalizeRoster(r,sid){const group=String(r.group||r.rotationGroup||r.conditionGroup||'A');return{...r,studentId:sid,fullName:String(r.fullName||r.studentName||r.name||r.nickname||`นักเรียน ${sid}`),nickname:String(r.nickname||''),section:String(r.section||r.classId||'QA-P5'),group,rotationGroup:String(r.rotationGroup||group),active:r.active!==false}}
function resultPassed(r){return !!(r&&(r.completed===true||r.passed===true||r.progressionEligible===true||r.firebaseReceiptToken))}
function rebuild(remote={},existing={}){
 const results=remote.gameResults||{};
 const gc=merge(existing.gameCompleted||{hygiene:{},nutrition:{},fitness:{}},remote.gameCompleted||{});
 gc.hygiene=gc.hygiene||{};gc.nutrition=gc.nutrition||{};gc.fitness=gc.fitness||{};
 const aliases={handwash:['handwash'],toothbrush:['toothbrush','brush'],groups:['groups','foodgroups','food-groups'],goodjunk:['goodjunk','good-junk'],jumpduck:['jumpduck','jump-duck'],balance:['balance','balancehold','balance-hold']};
 const zones={handwash:'hygiene',toothbrush:'hygiene',groups:'nutrition',goodjunk:'nutrition',jumpduck:'fitness',balance:'fitness'};
 for(const [canonical,ids] of Object.entries(aliases)){
  const z=zones[canonical];
  if(ids.some(id=>gc[z]?.[id]===true)||ids.some(id=>resultPassed(results[id])))gc[z][canonical]=true;
 }
 const pre=remote.pretestCompleted===true||remote.assessments?.pretest?.completed===true;
 const post=remote.posttestCompleted===true||remote.assessments?.posttest?.completed===true;
 const completed={...(existing.completed||{}),pretest:pre,hygiene:gc.hygiene.handwash===true&&gc.hygiene.toothbrush===true,nutrition:gc.nutrition.groups===true&&gc.nutrition.goodjunk===true,fitness:gc.fitness.jumpduck===true&&gc.fitness.balance===true,posttest:post};
 return{completed,gameCompleted:gc,pretestCompleted:pre,posttestCompleted:post,assessmentScores:{...(existing.assessmentScores||{}),pretest:Number(remote.assessments?.pretest?.score||existing.assessmentScores?.pretest||0),posttest:Number(remote.assessments?.posttest?.score||existing.assessmentScores?.posttest||0)},gameScores:merge(existing.gameScores||{},Object.fromEntries(Object.entries(results).map(([id,r])=>[id,Number(r?.score||0)]))),firebaseGameResults:merge(existing.firebaseGameResults||{},results),firebaseLastGame:remote.lastGame||existing.firebaseLastGame||null,firebaseAssessments:merge(existing.firebaseAssessments||{},remote.assessments||{})}
}
async function hydrate(sid,profile=null){
 if(loggingOut||params.get('logout')==='1')return null;
 badge(`Firebase • กำลังกู้ความคืบหน้าของ ${sid}`);
 const loaded=await HHFirebaseClient.loadProgress(sid);
 if(!loaded?.ok)throw new Error('โหลดความคืบหน้าจาก Firebase ไม่สำเร็จ');
 if(loggingOut)return null;
 const current=readState();
 const recovered=rebuild(loaded.exists&&loaded.progress?loaded.progress:{},current);
 const next={...current,...recovered,profile:profile||current.profile,pendingProfile:null,group:(profile||current.profile)?.group||current.group||'A',view:'student',firebaseAuthority:{mode:'firebase',uid:loaded.user?.uid||'',studentId:sid,progressPath:loaded.path,progressExists:loaded.exists===true,hydratedAt:new Date().toISOString(),release:RELEASE}};
 localStorage.setItem(STATE_KEY,JSON.stringify(next));localStorage.setItem(ACTIVE_KEY,sid);localStorage.setItem('HH_AUTHORITY_MODE','firebase');sessionStorage.setItem('HH_AUTHORITY_MODE','firebase');
 console.info('[HeroHealth Firebase R63] hydrated',{sid,path:loaded.path,recovered});
 return next;
}
function loginForm(node){const form=node?.closest?.('form')||(node instanceof HTMLFormElement?node:null);if(!form)return null;const input=form.querySelector('[name="studentId"],input[inputmode="numeric"],input');return input?{form,input}:null}
async function login(form,button){if(busy||loggingOut)return;const input=form.querySelector('[name="studentId"],input[inputmode="numeric"],input');const sid=String(input?.value||'').trim().replace(/\s+/g,'');if(!sid){input?.focus();return}busy=true;if(button){button.disabled=true;button.textContent='กำลังกู้ความคืบหน้าจาก Firebase…'}try{const roster=await HHFirebaseClient.readRoster(sid);if(!roster?.ok)throw new Error(roster?.reason==='student-not-found'?'ไม่พบรหัสนี้ใน Firebase':roster?.reason==='student-inactive'?'รหัสนี้ถูกปิดใช้งาน':'ตรวจสอบรหัสไม่สำเร็จ');const profile=normalizeRoster(roster.roster||{},sid);await HHFirebaseClient.bindStudent(sid);await hydrate(sid,profile);const url=new URL(location.href);['logout','logoutAt','logoutNonce'].forEach(k=>url.searchParams.delete(k));url.searchParams.set('authority','firebase');url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.set('firebaseReady','1');url.searchParams.set('firebaseHydrated',String(Date.now()));url.searchParams.set('v','20260804-passport-r63');location.replace(url.href)}catch(e){console.error('[HeroHealth Firebase R63] login failed',e);badge(`Firebase • ${e.message||'เกิดข้อผิดพลาด'}`);alert(e.message||'ตรวจสอบ Firebase ไม่สำเร็จ');if(button){button.disabled=false;button.textContent='ตรวจสอบและเข้าสู่ภารกิจ'}busy=false}finally{release()}}
function installLogin(){const intercept=e=>{if(!enabled||loggingOut)return;const b=e.target?.closest?.('button');if(!b)return;const text=String(b.textContent||'');if(!text.includes('ตรวจสอบ')&&!text.includes('เข้าสู่ภารกิจ'))return;const info=loginForm(b);if(!info)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();login(info.form,b)};document.addEventListener('pointerup',intercept,true);document.addEventListener('click',intercept,true);document.addEventListener('submit',e=>{if(loggingOut)return;const info=loginForm(e.target);if(!info)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();login(info.form,info.form.querySelector('button[type="submit"],button.btn-primary'))},true)}
function clearStudentContext(){
 LOCAL_CONTEXT_KEYS.forEach(k=>{try{localStorage.removeItem(k)}catch(_){}});
 ['HH_FIREBASE_LAST_STUDENT_ID','HH_FIREBASE_BOUND_STUDENT_ID','HH_ACTIVE_STUDENT_ID','HH_CURRENT_STUDENT_ID'].forEach(k=>{try{sessionStorage.removeItem(k)}catch(_){}});
 try{sessionStorage.setItem('HH_AUTHORITY_MODE','firebase')}catch(_){}
 try{localStorage.setItem('HH_AUTHORITY_MODE','firebase')}catch(_){}
}
function logout(){
 if(loggingOut)return true;
 loggingOut=true;busy=true;
 document.documentElement.dataset.hhLoggingOut='1';
 badge('Firebase • กำลังออกจากผู้เล่น…');
 clearStudentContext();
 const url=new URL(location.href);
 STUDENT_KEYS.forEach(k=>url.searchParams.delete(k));
 url.searchParams.set('authority','firebase');
 url.searchParams.set('logout','1');
 url.searchParams.set('logoutAt',String(Date.now()));
 url.searchParams.set('logoutNonce',Math.random().toString(36).slice(2));
 url.searchParams.set('v','20260804-passport-r63');
 const target=url.href;
 try{history.replaceState(null,'',target)}catch(_){}
 setTimeout(()=>location.replace(target),0);
 setTimeout(()=>{if(location.href!==target)location.assign(target)},350);
 return true;
}
function isLogoutButton(node){const b=node?.closest?.('button,[role="button"],a');if(!b)return null;const text=String(b.textContent||'').replace(/\s+/g,' ').trim();const onclick=String(b.getAttribute?.('onclick')||'');return text.includes('ออกจากผู้เล่น')||onclick.includes('HH.logout')?b:null}
function installLogout(){
 const install=()=>{if(window.HH){window.HH.logout=logout;window.HH.logout.__hhFirebaseR63=true}};
 install();[50,150,400,900,1800,3000].forEach(d=>setTimeout(install,d));
 const intercept=e=>{if(!enabled)return;const b=isLogoutButton(e.target);if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();b.setAttribute('aria-disabled','true');if('disabled'in b)b.disabled=true;logout()};
 ['pointerdown','pointerup','touchend','click'].forEach(type=>document.addEventListener(type,intercept,{capture:true,passive:false}));
}
function updateCopy(){const form=document.querySelector('#app form');if(!form)return;const p=form.querySelector('p.muted');if(p)p.textContent='ระบบจะตรวจรหัส ชื่อ ห้อง กลุ่ม และกู้ความคืบหน้าจาก Firebase โดยอัตโนมัติ';const b=form.querySelector('button[type="submit"],button.btn-primary');if(b&&!b.disabled)b.textContent='ตรวจสอบและเข้าสู่ภารกิจ'}
if(enabled){window.HH_AUTHORITY_MODE=mode;window.HH_DISABLE_SHEET_RESUME=mode==='firebase';document.documentElement.dataset.hhAuthority=mode;const boot=async()=>{release();installLogin();installLogout();new MutationObserver(updateCopy).observe(document.getElementById('app')||document.body,{childList:true,subtree:true});updateCopy();const sid=String(params.get('studentId')||params.get('sid')||'').trim();if(sid&&params.get('logout')!=='1'){try{await hydrate(sid)}catch(e){console.error('[HeroHealth Firebase R63] boot hydrate failed',e);badge(`Firebase • ${e.message||'กู้ความคืบหน้าไม่สำเร็จ'}`)}}else badge(params.get('logout')==='1'?'Firebase • ออกจากผู้เล่นแล้ว • กรุณาใส่รหัสใหม่':'Firebase • พร้อมตรวจสอบรหัส');release()};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot()}
