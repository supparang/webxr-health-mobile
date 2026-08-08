/* HeroHealth Firebase Game Test Analytics R2
 * Append-only QA attempts. Never changes Passport progression or latest official result.
 * R2: Handwash strict evidence gate prevents premature Smoke Hub return.
 */
(()=>{'use strict';
const RELEASE='20260808-FIREBASE-GAME-TEST-ANALYTICS-R2-HANDWASH-STRICT';
const SCHEMA='HH-GAME-TEST-ANALYTICS-V1';
const q=new URLSearchParams(location.search);
if(String(q.get('gameTestMode')||'')!=='1')return;
if(window.__HH_GAME_TEST_ANALYTICS_R2__)return;window.__HH_GAME_TEST_ANALYTICS_R2__=true;
const cfg={apiKey:'AIzaSyBdlWEf91s2gzUQf7H1pPB8c_hF807CpAc',authDomain:'herohealth-learning.firebaseapp.com',projectId:'herohealth-learning',storageBucket:'herohealth-learning.firebasestorage.app',messagingSenderId:'161380004818',appId:'1:161380004818:web:7d8ef81c55eebd6b1a8e0b'};
const sid=String(q.get('studentId')||q.get('sid')||'').trim();
const gameId=String(q.get('gameId')||'unknown').toLowerCase();
const zone=String(q.get('zone')||'').toLowerCase();
const collection=sid==='990014'?'studentProgressSandbox':'studentProgress';
let saving=false,saved='';
const safe=(v,d=0)=>{if(v==null)return v;if(['string','boolean'].includes(typeof v))return v;if(typeof v==='number')return Number.isFinite(v)?v:null;if(Array.isArray(v))return d>1?JSON.stringify(v):v.slice(0,200).map(x=>safe(x,d+1));if(typeof v==='object'){const o={};for(const[k,x]of Object.entries(v)){const y=safe(x,d+1);if(y!==undefined)o[String(k).replace(/[.$#[\]/]/g,'_').slice(0,100)]=y}return o}return String(v)};
const num=(...a)=>{for(const x of a){const n=Number(x);if(Number.isFinite(n))return n}return null};
const bool=v=>v===true||v===1||String(v).toLowerCase()==='true';
function status(t,e=false){const n=document.getElementById('receiptStatus');if(n){n.textContent=t;n.style.color=e?'#fecaca':''}const b=document.getElementById('back');if(b)b.disabled=false}
function unwrap(raw){const src=raw?.payload&&typeof raw.payload==='object'?raw.payload:raw||{};return src.game&&typeof src.game==='object'?{...src,...src.game}:{...src}}
function handwashEvidence(data){
  const rub=num(data.completedRubSteps,data.whoStepsCompleted)??0;
  const process=num(data.completedProcessSteps)??0;
  const wrists=bool(data.wristsPassed);
  const analytics=(num(data.metricCompletenessPct)??0)>=90;
  const rows=Array.isArray(data.steps)?data.steps:Array.isArray(data.stepResults)?data.stepResults:[];
  const hasEvents=Array.isArray(data.events)||Array.isArray(data.eventLog);
  const procedure=bool(data.procedureCompleted)||bool(data.missionPassed)||bool(data.classroomMissionPassed);
  const valid=procedure&&rub>=7&&process>=5&&wrists&&analytics&&rows.length>=12&&hasEvents;
  return{valid,rub,process,wrists,analytics,rowCount:rows.length,hasEvents,procedure};
}
function normalize(raw){
  const data=unwrap(raw);
  const genericCompleted=bool(data.completed??data.passed??data.missionCompleted??data.skillPassed);
  const hw=gameId==='handwash'?handwashEvidence(data):null;
  const completed=gameId==='handwash'?hw.valid:genericCompleted;
  const score=Math.max(0,Math.min(100,num(data.normalizedScore,data.score,data.accuracy,data.percentage)??0));
  const attemptId=String(q.get('testRunId')||`TEST-${sid}-${gameId}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`);
  return safe({...data,attemptId,studentId:sid,gameId,zone,mode:'game-test',isTestAttempt:true,affectsProgression:false,completed,passed:gameId==='handwash'?completed:bool(data.passed??completed),score,scoreScale:100,analyticsSchemaVersion:SCHEMA,bridgeRelease:RELEASE,handwashSmokeEvidence:hw||undefined,completedAtClient:new Date().toISOString(),device:{userAgent:navigator.userAgent.slice(0,300),viewportWidth:innerWidth,viewportHeight:innerHeight,devicePixelRatio:devicePixelRatio||1,touchPoints:navigator.maxTouchPoints||0}})}
async function persist(raw){
  if(saving||!sid)return;
  const r=normalize(raw);
  if(gameId==='handwash'&&!r.completed){
    const ev=r.handwashSmokeEvidence||{};
    status(`Handwash กำลังเล่น • ${ev.rub||0}/7 rub • ${ev.process||0}/5 process`);
    console.warn('[Game Test Analytics R2] blocked premature Handwash completion',ev);
    return;
  }
  if(!r.completed||saved===r.attemptId)return;
  saving=true;status(`กำลังบันทึก ${gameId} เป็น Test Attempt…`);
  try{
    const[{initializeApp,getApps},{getAuth,signInAnonymously},{getFirestore,doc,setDoc,getDoc,serverTimestamp}]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js'),import('https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js')]);
    const app=getApps().length?getApps()[0]:initializeApp(cfg);const auth=getAuth(app);if(!auth.currentUser)await signInAnonymously(auth);const db=getFirestore(app);
    const token=`TEST-${gameId.toUpperCase()}-${sid}-${Date.now()}`;const ref=doc(db,collection,sid);
    const record=safe({...r,firebaseReceiptToken:token,firebaseSavedByUid:auth.currentUser.uid,serverWriteRequestedAtClient:new Date().toISOString()});
    await setDoc(ref,{studentId:sid,gameTestAttempts:{[r.attemptId]:record},gameTestSummary:{[gameId]:{lastAttemptId:r.attemptId,lastScore:r.score,lastCompletedAtClient:r.completedAtClient,affectsProgression:false,schemaVersion:SCHEMA}},lastGameTestAttemptId:r.attemptId,lastGameTestId:gameId,lastGameTestUpdatedAt:serverTimestamp()},{merge:true});
    const check=await getDoc(ref);if(check.data()?.gameTestAttempts?.[r.attemptId]?.firebaseReceiptToken!==token)throw new Error('test_attempt_receipt_not_found');
    saved=r.attemptId;status(`✓ บันทึก Test Attempt แล้ว • คะแนน ${r.score}/100`);
    setTimeout(()=>location.replace(q.get('return')||q.get('back')||'./game-test-mode.html'),900);
  }catch(e){saving=false;status(`บันทึก Test Attempt ไม่สำเร็จ: ${e.message||e}`,true);console.error('[Game Test Analytics R2]',e)}
}
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;const m=e.data||{};if(['HEROHEALTH_GAME_COMPLETE','HH_GAME_COMPLETE','game_complete'].includes(m.type))persist(m.payload||m)},true);
for(const n of ['HEROHEALTH_GAME_COMPLETE','HH_GAME_COMPLETE','herohealth:game-complete'])window.addEventListener(n,e=>persist(e.detail||e),true);
window.HH_firebasePersistGameTestResult=persist;window.HH_GAME_TEST_SCHEMA=SCHEMA;
console.info('[Game Test Analytics R2] installed',{sid,gameId,zone,handwashStrict:gameId==='handwash'});
})();