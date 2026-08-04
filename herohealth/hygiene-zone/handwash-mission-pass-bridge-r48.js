(()=>{
'use strict';
const RELEASE='20260804-HANDWASH-MISSION-PASS-BRIDGE-R50-FIREBASE-GATE';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const RECOVERY_PREFIX='HH_HANDWASH_R50_RECOVERED:';
const MAX_RECOVERY_AGE_MS=30*60*1000;
const ANALYTICS_SCHEMA='HH-UNIFIED-GAME-ANALYTICS-V2';

const yes=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clean=v=>String(v==null?'':v).trim();

function missionReady(result){
  const completed=yes(result?.procedureCompleted)||yes(result?.completed);
  const rub=num(result?.completedRubSteps??result?.whoStepsCompleted);
  const process=num(result?.completedProcessSteps);
  const wrists=yes(result?.wristsPassed);
  const analytics=num(result?.metricCompletenessPct)>=90;
  const rows=Array.isArray(result?.steps)?result.steps:Array.isArray(result?.stepResults)?result.stepResults:[];
  const events=Array.isArray(result?.events)||Array.isArray(result?.eventLog);
  return completed&&rub>=7&&process>=5&&wrists&&analytics&&rows.length>=12&&events;
}

function preserveResearchSkill(result){
  if(result.independentSkillPassed!==undefined)return yes(result.independentSkillPassed);
  if(result.research?.skillPass!==undefined)return num(result.research.skillPass)===1;
  return yes(result.skillCriteriaMet??result.passed);
}

function bridge(input){
  if(!input||typeof input!=='object')return input;
  const independentSkillPassed=preserveResearchSkill(input);
  const missionPassed=missionReady(input);
  const originalSchema=clean(input.analyticsSchemaVersion);
  input.analyticsSchemaVersion=ANALYTICS_SCHEMA;
  if(originalSchema&&originalSchema!==ANALYTICS_SCHEMA)input.analyticsSchemaVersionOriginal=originalSchema;
  input.independentSkillPassed=independentSkillPassed;
  input.skillAssessmentPassed=independentSkillPassed;
  input.missionPassed=missionPassed;
  input.classroomMissionPassed=missionPassed;
  input.missionCompletionPolicy='server-validated-7-rub-5-process-wrists-analytics-r50';
  input.missionPassBridgeRelease=RELEASE;
  if(input.research&&typeof input.research==='object'){
    input.research.independentSkillPass=independentSkillPassed?1:0;
    input.research.missionPass=missionPassed?1:0;
  }
  if(missionPassed){
    input.completed=true;
    input.procedureCompleted=true;
    input.progressionEligible=true;
    input.passed=true;
    input.skillPassed=true;
    input.skillCriteriaMet=true;
    input.retryRequired=false;
    input.completionLevel=independentSkillPassed?'independent':'completed_with_adaptive_assist';
    input.adaptiveAssistUsed=!independentSkillPassed;
  }
  return input;
}

function persist(result){
  try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}
  try{window.__HANDWASH_LAST_RESULT__=result}catch(_){}
}

function firebaseReceiptGateActive(){
  const release=String(document.documentElement.dataset.handwashSummaryReturn||'');
  return /R51-FIREBASE-RECEIPT/i.test(release)||Boolean(window.HHHandwashSummaryPassportReturnR51);
}

function emit(result,source){
  const bridged=bridge(result);
  persist(bridged);
  if(!bridged?.missionPassed)return false;
  if(firebaseReceiptGateActive()){
    console.info('[Handwash Mission Pass R50] persisted for Firebase receipt gate',{source,eventId:bridged.eventId||'',metricCompletenessPct:bridged.metricCompletenessPct});
    return true;
  }
  try{window.parent?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:bridged},location.origin)}catch(_){}
  console.info('[Handwash Mission Pass R50] legacy shell completion emitted',{
    source,
    eventId:bridged.eventId,
    sourceEventId:bridged.sourceEventId||'',
    analyticsSchemaVersion:bridged.analyticsSchemaVersion,
    completedRubSteps:bridged.completedRubSteps,
    completedProcessSteps:bridged.completedProcessSteps,
    skillPassed:bridged.skillPassed,
    independentSkillPassed:bridged.independentSkillPassed,
    metricCompletenessPct:bridged.metricCompletenessPct
  });
  return true;
}

function readStored(){
  try{return JSON.parse(localStorage.getItem(RESULT_KEY)||'null')}catch(_){return null}
}

function currentStudentId(){
  const q=new URLSearchParams(location.search);
  return clean(q.get('studentId')||q.get('sid')||q.get('pid'));
}

function finishedAtMs(result){
  const raw=result?.finishedAt||result?.timestamp||result?.endedAt||result?.clientTs||'';
  const ms=Date.parse(raw);
  return Number.isFinite(ms)?ms:0;
}

function eligibleForRecovery(result){
  if(!missionReady(result))return false;
  const age=Date.now()-finishedAtMs(result);
  if(!Number.isFinite(age)||age<0||age>MAX_RECOVERY_AGE_MS)return false;
  const currentSid=currentStudentId();
  const storedSid=clean(result?.studentId||result?.participantId||result?.pid||result?.profile?.studentId);
  if(currentSid&&storedSid&&currentSid!==storedSid)return false;
  const sourceEventId=clean(result?.sourceEventId||result?.eventId||result?.attemptId);
  if(!sourceEventId)return false;
  try{if(localStorage.getItem(RECOVERY_PREFIX+sourceEventId)==='1')return false}catch(_){}
  return true;
}

function buildRecovery(stored){
  const sourceEventId=clean(stored.sourceEventId||stored.eventId||stored.attemptId);
  const suffix='mission-r50-'+Date.now();
  return bridge({
    ...stored,
    sourceEventId,
    sourceAttemptId:clean(stored.attemptId||stored.roundId||''),
    eventId:`${sourceEventId}-${suffix}`.slice(0,160),
    attemptId:`${clean(stored.attemptId||stored.roundId||sourceEventId)}-${suffix}`.slice(0,160),
    recoveredFromCompletedAttempt:true,
    recoveryReason:'analytics-schema-v2-contract-recovery',
    recoveredAt:new Date().toISOString(),
    missionPassRecoveryRelease:RELEASE
  });
}

function recoverFreshCompletedAttempt(){
  const stored=readStored();
  if(!eligibleForRecovery(stored))return false;
  const sourceEventId=clean(stored.sourceEventId||stored.eventId||stored.attemptId);
  const recovered=buildRecovery(stored);
  try{localStorage.setItem(RECOVERY_PREFIX+sourceEventId,'1')}catch(_){}
  return emit(recovered,'fresh-stored-attempt-recovery');
}

window.addEventListener('herohealth:game-result',event=>{
  emit(event.detail||{},'live-game-result');
},{capture:false});

const capturedStored=readStored();
setTimeout(()=>{
  if(capturedStored&&eligibleForRecovery(capturedStored)){
    const sourceEventId=clean(capturedStored.sourceEventId||capturedStored.eventId||capturedStored.attemptId);
    const recovered=buildRecovery(capturedStored);
    try{localStorage.setItem(RECOVERY_PREFIX+sourceEventId,'1')}catch(_){}
    emit(recovered,'captured-before-shell-clear');
  }
},180);

window.HHHandwashMissionPassBridgeR50={release:RELEASE,bridge,missionReady,recoverFreshCompletedAttempt};
document.documentElement.dataset.handwashMissionPassBridge=RELEASE;
console.info('[Handwash Mission Pass Bridge R50] installed',RELEASE);
})();
