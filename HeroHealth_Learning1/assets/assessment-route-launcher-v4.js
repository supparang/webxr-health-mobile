(()=>{
'use strict';
const RELEASE='20260809-ASSESSMENT-FIREBASE-ROUTE-R13-E2E29';
const STATE_KEY='herohealth_learning_platform_rc2';
const STUDY_ID='HEROHEALTH-P5-2026';
const SANDBOX_STUDENT_IDS=new Set(Array.from({length:29},(_,i)=>String(990001+i)));
const isSandboxStudent=sid=>SANDBOX_STUDENT_IDS.has(String(sid||'').trim());
const SHEET_ROUTES={pretest:'./assessment/pretest.html?v=20260731-assessment-stable-v6',posttest:'./assessment/posttest.html?v=20260805-authority-gate-v4',reflection:'./assessment/reflection.html?v=20260731-reflection-r54'};
const FIREBASE_ROUTES={pretest:'./assessment/pretest-firebase.html?v=20260804-firebase-assessment-r2',posttest:'./assessment/posttest-firebase.html?v=20260805-firebase-posttest-r3',reflection:'./assessment/reflection-firebase.html?v=20260809-firebase-reflection-r4-e2e29'};
const COMMON_ROUTES={certificate:'./assessment/certificate.html?v=20260809-mission-summary-r7-e2e29'};
if(!window.HH||typeof window.HH.openRoute!=='function')return;
if(window.HHAssessmentRouteLauncher?.version===RELEASE)return;
const baseOpenRoute=window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__||window.HH.openRoute.bind(window.HH);
window.__HH_ASSESSMENT_BASE_OPEN_ROUTE__=baseOpenRoute;
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')}catch(_){return{}}}
function save(value){try{localStorage.setItem(STATE_KEY,JSON.stringify(value));return true}catch(_){return false}}
function hash(str){let h=2166136261>>>0;const text=String(str??'');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function stableAttempt(prefix,sid){return `${prefix}-${sid}-${hash(`${RELEASE}|${STUDY_ID}|${prefix}|${sid}`).toString(36).toUpperCase()}`}
function sessionId(sid){const key=`HH_ASSESSMENT_STUDY_SESSION_${STUDY_ID}_${sid}`;let value='';try{value=localStorage.getItem(key)||''}catch(_){}if(!value){value=`HH-STUDY-${hash(`${STUDY_ID}|${sid}`).toString(36).toUpperCase()}`;try{localStorage.setItem(key,value)}catch(_){}}return value}
function smokeMode(url=location.href){const q=new URL(url,location.href).searchParams;return /^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))}

async function recoverFirebaseReflection(){
 const s=state(),q=new URLSearchParams(location.search),sid=String(q.get('studentId')||q.get('sid')||s.profile?.studentId||'').trim();
 const mode=String(q.get('authority')||s?.firebaseAuthority?.mode||localStorage.getItem('HH_AUTHORITY_MODE')||'firebase').toLowerCase();
 if(!sid||!(mode==='firebase'||mode==='dual')||s.completed?.reflection===true||s.reflectionCompleted===true)return;
 if(sessionStorage.getItem(`HH_REFLECTION_RECOVERY_BUSY_${sid}`)==='1')return;
 sessionStorage.setItem(`HH_REFLECTION_RECOVERY_BUSY_${sid}`,'1');
 try{
  const [{initializeApp,getApps},{getAuth,signInAnonymously},{getFirestore,doc,getDoc},{HEROHEALTH_FIREBASE_CONFIG}]=await Promise.all([
   import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
   import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
   import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js'),
   import('../firebase/firebase-config.js')
  ]);
  const app=getApps().length?getApps()[0]:initializeApp(HEROHEALTH_FIREBASE_CONFIG);
  const auth=getAuth(app);if(!auth.currentUser)await signInAnonymously(auth);
  const db=getFirestore(app);
  const sandbox=isSandboxStudent(sid);
  const assessmentCollection=sandbox?'studentAssessmentsSandbox':'studentAssessments';
  const progressCollection=sandbox?'studentProgressSandbox':'studentProgress';
  const [assessmentSnap,progressSnap]=await Promise.all([
   getDoc(doc(db,assessmentCollection,`${sid}_REFLECTION`)).catch(()=>null),
   getDoc(doc(db,progressCollection,sid)).catch(()=>null)
  ]);
  const evidence=assessmentSnap?.exists?.()?assessmentSnap.data():null;
  const progress=progressSnap?.exists?.()?progressSnap.data():null;
  const reflectionRecord=progress?.reflection||evidence?.reflection||evidence?.response||null;
  const receipt=progress?.reflectionReceiptToken||progress?.reflection?.firebaseReceiptToken||evidence?.firebaseReceiptToken||evidence?.reflectionReceiptToken||'';
  const completed=progress?.reflectionCompleted===true||progress?.completed?.reflection===true||progress?.reflection?.completed===true||evidence?.completed===true||!!receipt;
  if(!completed)return;
  const current=state();
  const next={...current,reflection:reflectionRecord||current.reflection||null,reflectionCompleted:true,completed:{...(current.completed||{}),reflection:true,certificate:true},certificateCompleted:true,firebaseReflection:{...(current.firebaseReflection||{}),receipt,confirmedAt:new Date().toISOString(),release:RELEASE,evidencePath:`${assessmentCollection}/${sid}_REFLECTION`}};
  if(!save(next))return;
  const marker=`HH_REFLECTION_RECOVERED_${sid}`;
  if(sessionStorage.getItem(marker)!=='1'){
   sessionStorage.setItem(marker,'1');
   const url=new URL(location.href);url.searchParams.set('reflectionRecovered','1');url.searchParams.set('v',RELEASE);if(smokeMode())url.searchParams.set('smoke','1');location.replace(url.href);
  }
 }catch(error){console.warn('[HeroHealth Reflection Recovery]',error)}
 finally{sessionStorage.removeItem(`HH_REFLECTION_RECOVERY_BUSY_${sid}`)}
}

window.HH.openRoute=function(id){
 const s=state(),profile=s.profile||{};
 if(!profile.studentId)return baseOpenRoute(id);
 const current=new URL(location.href),mode=String(current.searchParams.get('authority')||s?.firebaseAuthority?.mode||localStorage.getItem('HH_AUTHORITY_MODE')||'firebase').toLowerCase();
 const firebaseMode=mode==='firebase'||mode==='dual',smoke=smokeMode(current.href);
 const route=COMMON_ROUTES[id]||(firebaseMode?FIREBASE_ROUTES[id]:SHEET_ROUTES[id]);
 if(!route)return baseOpenRoute(id);
 const url=new URL(route,location.href),sid=String(profile.studentId).trim(),testSessionId=sessionId(sid);
 url.searchParams.set('studentId',sid);url.searchParams.set('sid',sid);url.searchParams.set('fullName',profile.fullName||'');url.searchParams.set('section',profile.section||'');url.searchParams.set('group',profile.group||s.group||'');url.searchParams.set('studyId',STUDY_ID);url.searchParams.set('testSessionId',testSessionId);url.searchParams.set('authority',firebaseMode?'firebase':mode);
 if(s?.firebaseAuthority?.uid)url.searchParams.set('firebaseUid',s.firebaseAuthority.uid);if(smoke)url.searchParams.set('smoke','1');
 const returnUrl=new URL('./index.html',location.href);returnUrl.searchParams.set('authority',firebaseMode?'firebase':mode);returnUrl.searchParams.set('studentId',sid);returnUrl.searchParams.set('sid',sid);if(firebaseMode)returnUrl.searchParams.set('firebaseReady','1');if(smoke)returnUrl.searchParams.set('smoke','1');
 url.searchParams.set('return',returnUrl.href);url.searchParams.set('routeRelease',RELEASE);url.searchParams.set('_',Date.now());
 if(id==='pretest'){const attempt=stableAttempt('PRE',sid);localStorage.setItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`,attempt);localStorage.setItem(`HH_ASSESSMENT_TEST_SESSION_ACTIVE_${sid}`,testSessionId);url.searchParams.set('attemptId',attempt)}
 if(id==='posttest'){const attempt=stableAttempt('POST',sid);const preAttempt=localStorage.getItem(`HH_ASSESSMENT_PRE_ATTEMPT_${sid}`)||stableAttempt('PRE',sid);localStorage.setItem(`HH_ASSESSMENT_POST_ATTEMPT_${sid}`,attempt);url.searchParams.set('attemptId',attempt);url.searchParams.set('preAttemptId',preAttempt)}
 location.assign(url.href);
};
window.HHAssessmentRouteLauncher={version:RELEASE,studyId:STUDY_ID,sheetRoutes:SHEET_ROUTES,firebaseRoutes:FIREBASE_ROUTES,stableAttempt,recoverFirebaseReflection,smokeMode,isSandboxStudent};
recoverFirebaseReflection();
console.info('[HeroHealth Assessment Route] installed',RELEASE,{smoke:smokeMode()});
})();