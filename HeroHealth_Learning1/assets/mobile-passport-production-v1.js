(()=>{
'use strict';
const VERSION='20260814-MOBILE-PASSPORT-V1.8-RESEARCH-FLOW';
const KEY='herohealth_learning_platform_rc2';
const C=window.HH_CONFIG||{};
const R=window.HHRotation;
if(!R)return;
function installResponsiveRuntime(){
 if(window.HHResponsiveRuntime||document.getElementById('hh-responsive-runtime-loader'))return;
 const script=document.createElement('script');script.id='hh-responsive-runtime-loader';script.src='./assets/hh-responsive-runtime-v1.js?v=20260807-r1';script.async=false;script.dataset.hhPatch='passport-responsive-r1';document.head.appendChild(script);
}
installResponsiveRuntime();
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(_){return{}}}
function authorityMode(){const q=String(new URLSearchParams(location.search).get('authority')||'').toLowerCase();return q||String(window.HH_AUTHORITY_MODE||localStorage.getItem('HH_AUTHORITY_MODE')||'firebase').toLowerCase()}
function isFirebase(){return authorityMode()==='firebase'||authorityMode()==='dual'}
function queryStudentId(){const q=new URLSearchParams(location.search);return String(q.get('studentId')||q.get('sid')||q.get('pid')||'').trim()}
function firebaseSessionReady(s){if(!isFirebase()||window.__HH_FIREBASE_LOGIN_REQUIRED__===true)return false;const sid=queryStudentId();if(!sid)return false;return String(s?.profile?.studentId||'')===sid&&String(s?.firebaseAuthority?.studentId||'')===sid&&s?.view==='student'}
function installLatestFirebaseRuntime(){
 if(!isFirebase()||window.__HH_FIREBASE_ASSESSMENT_RUNTIME_V1)return;
 window.__HH_FIREBASE_ASSESSMENT_RUNTIME_V1=true;
 import('../firebase/passport-index-integration.js?v=20260809-session-r74-e2e29-final2').catch(err=>console.error('[HeroHealth Firebase Passport loader]',err));
 const script=document.createElement('script');
 script.src='./assets/assessment-route-launcher-v4.js?v=20260814-research-flow-r16';
 script.async=false;script.dataset.hhPatch='firebase-assessment-route-r16';
 script.onload=()=>console.info('[HeroHealth Firebase Assessment Route R16] loaded');
 document.head.appendChild(script);
}
function gameMeta(step){if(!step||step.type!=='game')return null;return C.zones?.find(z=>z.id===step.zoneId)?.games?.find(g=>g.id===step.gameId)||null}
function syncStatus(s){if(navigator.onLine===false)return{key:'offline',text:'ออฟไลน์ — รอเชื่อมต่ออินเทอร์เน็ต'};if(isFirebase())return firebaseSessionReady(s)?{key:'ok',text:'✓ ซิงก์กับ Firebase แล้ว'}:{key:'pending',text:'กำลังตรวจสอบ Firebase…'};if(s?.offlineAuthority===true)return{key:'offline',text:'ออฟไลน์ — รอเชื่อมต่อ Google Sheet'};if(s?.sheetAuthority===true)return{key:'ok',text:'✓ ซิงก์กับ Google Sheet แล้ว'};return{key:'pending',text:'กำลังตรวจสอบ Google Sheet…'}}
function actionFor(s){
 const st=R.status(s),next=st.nextStep;
 if(next==='pretest')return{next,label:'เริ่มแบบทดสอบก่อนภารกิจ',description:'แบบทดสอบก่อนเริ่มภารกิจ',run:()=>window.HH?.openRoute?.('pretest')};
 const step=st.route.find(x=>x.id===next);
 if(step?.type==='game'){const meta=gameMeta(step),name=step.label||meta?.thai||meta?.title||'ภารกิจถัดไป';return{next,label:`เริ่ม ${name}`,description:name,run:()=>window.HH?.openNextGame?.(step.zoneId)}}
 if(next==='posttest')return{next,label:'เริ่มแบบทดสอบหลังภารกิจ',description:'แบบทดสอบหลังจบภารกิจ',run:()=>window.HH?.openRoute?.('posttest')};
 if(next==='postExperience')return{next,label:'เริ่มแบบประเมินหลังเล่น',description:'แบบประเมินประสบการณ์หลังเล่น',run:()=>window.HH?.openRoute?.('postexperience')};
 if(next==='reflection')return{next,label:'เริ่มสะท้อนการเรียนรู้',description:'สะท้อนการเรียนรู้',run:()=>window.HH?.openRoute?.('reflection')};
 return{next:'certificate',label:'ดูผลสำเร็จ',description:'ดูผลสำเร็จและใบประกาศ',run:()=>window.HH?.openRoute?.('certificate')}
}
function gateFor(s,action){if(navigator.onLine===false)return{ready:false,text:'ออฟไลน์ — รอเชื่อมต่ออินเทอร์เน็ต'};if(isFirebase()){if(!firebaseSessionReady(s))return{ready:false,text:window.__HH_FIREBASE_LOGIN_REQUIRED__===true?'กรุณาเข้าสู่ระบบก่อน':'กำลังโหลดความคืบหน้าจาก Firebase…'};return{ready:true,text:''}}const offline=s?.offlineAuthority===true;if(offline)return{ready:false,text:'ออฟไลน์ — รอเชื่อมต่อ Sheet'};if(action.next==='pretest'){const profileVerified=s?.profile?.sheetAuthority===true||s?.sheetAuthority===true;return profileVerified?{ready:true,text:''}:{ready:false,text:'กำลังยืนยันรหัสกับ Sheet…'}}return s?.sheetAuthority===true?{ready:true,text:''}:{ready:false,text:'กำลังตรวจสอบความคืบหน้าจาก Sheet…'}}
function hideStudentReleaseLabel(){const releaseLabel=document.querySelector('.topbar .brand .small.muted');if(releaseLabel){releaseLabel.hidden=true;releaseLabel.setAttribute('aria-hidden','true');releaseLabel.style.display='none'}}
function ensureSyncIndicator(s){const passport=document.querySelector('.hero-card .passport>div:last-child');if(!passport)return;let el=document.getElementById('hh-sheet-sync-indicator');if(!el){el=document.createElement('div');el.id='hh-sheet-sync-indicator';passport.appendChild(el)}const sync=syncStatus(s);if(el.dataset.status!==sync.key)el.dataset.status=sync.key;if(el.textContent!==sync.text)el.textContent=sync.text}
function syncDesktopNextCard(action,gate){const card=Array.from(document.querySelectorAll('main.container>.hero>.card')).find(c=>/ภารกิจถัดไป/.test(c.querySelector('h2')?.textContent||''));if(!card)return;const desc=card.querySelector('p.muted');if(desc&&desc.textContent!==action.description)desc.textContent=action.description;const button=Array.from(card.querySelectorAll('button')).find(b=>!/ออกจากผู้เล่น/.test(b.textContent||''));if(!button)return;button.disabled=!gate.ready;button.setAttribute('aria-disabled',String(!gate.ready));button.textContent=gate.ready?action.label:gate.text;button.removeAttribute('onclick');button.onclick=e=>{e.preventDefault();if(!gate.ready)return;action.run()};button.dataset.hhMobileResearchNext=action.next}
function applyTopButtonGate(s,action,gate){syncDesktopNextCard(action,gate);if(!matchMedia('(max-width:700px)').matches)return;const button=document.querySelector('.hero>.card:not(.hero-card) .btn-light');if(!button)return;button.disabled=!gate.ready;button.setAttribute('aria-disabled',String(!gate.ready));const label=gate.ready?action.label:gate.text;if(button.textContent!==label)button.textContent=label}
function ensureMobileCta(s){
 let bar=document.getElementById('hh-mobile-next-cta');const authenticated=!isFirebase()||firebaseSessionReady(s);
 if(!s?.profile||s?.view!=='student'||!authenticated){if(bar)bar.remove();return}
 if(!bar){bar=document.createElement('div');bar.id='hh-mobile-next-cta';bar.innerHTML='<span class="hh-mobile-sync-dot" aria-hidden="true"></span><button type="button"></button>';document.body.appendChild(bar)}
 const sync=syncStatus(s),action=actionFor(s),gate=gateFor(s,action),button=bar.querySelector('button');const readyLabel=action.label+' ›',label=gate.ready?readyLabel:gate.text;if(bar.dataset.sync!==sync.key)bar.dataset.sync=sync.key;if(button.dataset.busy!=='1'&&button.textContent!==label)button.textContent=label;button.disabled=!gate.ready||button.dataset.busy==='1';button.setAttribute('aria-disabled',String(!gate.ready));button.setAttribute('aria-label',gate.ready?action.label:gate.text);button.onclick=()=>{if(!gate.ready||button.dataset.busy==='1')return;button.dataset.busy='1';button.disabled=true;button.textContent='กำลังเปิด…';try{action.run()}catch(err){console.error('[HeroHealth mobile CTA]',err)}setTimeout(()=>{button.dataset.busy='0';button.disabled=false;button.textContent=readyLabel},2200)};applyTopButtonGate(s,action,gate)
}
function patch(){hideStudentReleaseLabel();const s=read();if(!s?.profile||s?.view!=='student'||(isFirebase()&&!firebaseSessionReady(s))){document.getElementById('hh-sheet-sync-indicator')?.remove();document.getElementById('hh-mobile-next-cta')?.remove();return}ensureSyncIndicator(s);ensureMobileCta(s);document.documentElement.dataset.hhMobilePassport='V1-8-RESEARCH'}
let queued=false;function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;patch()})}
addEventListener('DOMContentLoaded',()=>{installResponsiveRuntime();installLatestFirebaseRuntime();patch();const app=document.getElementById('app');if(app)new MutationObserver(schedule).observe(app,{childList:true,subtree:true})});if(document.readyState!=='loading'){installResponsiveRuntime();installLatestFirebaseRuntime()}addEventListener('storage',e=>{if(e.key===KEY)schedule()});addEventListener('online',schedule);addEventListener('offline',schedule);setInterval(schedule,1000);window.HHMobilePassportProduction={patch,gateFor,firebaseSessionReady,installResponsiveRuntime,actionFor,version:VERSION};console.info('[HeroHealth Mobile Passport]',VERSION);
})();