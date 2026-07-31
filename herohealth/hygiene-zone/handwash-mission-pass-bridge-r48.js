(()=>{
'use strict';
const RELEASE='20260731-HANDWASH-MISSION-PASS-BRIDGE-R48.1';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';
const RECOVERY_PREFIX='HH_HANDWASH_R48_RECOVERED:';
const MAX_RECOVERY_AGE_MS=30*60*1000;

const yes=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};
const clean=v=>String(v==null?'':v).trim();

function missionReady(result){
  const completed=yes(result?.procedureCompleted)||yes(result?.completed);
  const rub=num(result?.completedRubSteps??result?.whoStepsCompleted);
  const process=num(result?.completedProcessSteps);
  const wrists=yes(result?.wristsPassed);
  const analytics=num(result?.metricCompletenessPct)>=90;
  return completed&&rub>=7&&process>=5&&wrists&&analytics;
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
  input.independentSkillPassed=independentSkillPassed;
  input.skillAssessmentPassed=independentSkillPassed;
  input.missionPassed=missionPassed;
  input.missionCompletionPolicy='complete-12-steps-unlocks-skill-recorded-separately';
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
    input.skillCriteriaMet=true;
    input.retryRequired=false;
    input.completionLevel=independentSkillPassed?'independent':'completed_with_adaptive_assist';
  }
  return input;
}

function persist(result){
  try{localStorage.setItem(RESULT_KEY,JSON.stringify(result))}catch(_){}
  try{window.__HANDWASH_LAST_RESULT__=result}catch(_){}
}

function emit(result,source){
  const bridged=bridge(result);
  persist(bridged);
  if(!bridged?.missionPassed)return false;
  try{window.parent?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:bridged},location.origin)}catch(_){}
  console.info('[Handwash Mission Pass R48.1] mission completion emitted',{
    source,
    eventId:bridged.eventId,
    sourceEventId:bridged.sourceEventId||'',
    completedRubSteps:bridged.completedRubSteps,
    completedProcessSteps:bridged.completedProcessSteps,
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

function recoverFreshCompletedAttempt(){
  const stored=readStored();
  if(!eligibleForRecovery(stored))return false;
  const sourceEventId=clean(stored.sourceEventId||stored.eventId||stored.attemptId);
  const suffix='mission-r48-'+Date.now();
  const recovered={
    ...stored,
    sourceEventId,
    sourceAttemptId:clean(stored.attemptId||stored.roundId||''),
    eventId:`${sourceEventId}-${suffix}`.slice(0,160),
    attemptId:`${clean(stored.attemptId||stored.roundId||sourceEventId)}-${suffix}`.slice(0,160),
    recoveredFromCompletedAttempt:true,
    recoveryReason:'mission-pass-policy-compatibility',
    recoveredAt:new Date().toISOString(),
    missionPassRecoveryRelease:RELEASE
  };
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
    const suffix='mission-r48-'+Date.now();
    const recovered={
      ...capturedStored,
      sourceEventId,
      sourceAttemptId:clean(capturedStored.attemptId||capturedStored.roundId||''),
      eventId:`${sourceEventId}-${suffix}`.slice(0,160),
      attemptId:`${clean(capturedStored.attemptId||capturedStored.roundId||sourceEventId)}-${suffix}`.slice(0,160),
      recoveredFromCompletedAttempt:true,
      recoveryReason:'mission-pass-policy-compatibility',
      recoveredAt:new Date().toISOString(),
      missionPassRecoveryRelease:RELEASE
    };
    try{localStorage.setItem(RECOVERY_PREFIX+sourceEventId,'1')}catch(_){}
    emit(recovered,'captured-before-shell-clear');
  }
},180);

window.HHHandwashMissionPassBridgeR48={release:RELEASE,bridge,missionReady,recoverFreshCompletedAttempt};
document.documentElement.dataset.handwashMissionPassBridge=RELEASE;
console.info('[Handwash Mission Pass Bridge R48.1] installed',RELEASE);
})();
