(()=>{
'use strict';
const RELEASE='20260731-HANDWASH-MISSION-PASS-BRIDGE-R48';
const RESULT_KEY='HHA_HANDWASH_LAST_RESULT';

const yes=v=>v===true||v===1||String(v||'').toLowerCase()==='true'||String(v||'')==='1';
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:0};

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

window.addEventListener('herohealth:game-result',event=>{
  const result=bridge(event.detail||{});
  persist(result);
  if(result?.missionPassed){
    try{window.parent?.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload:result},location.origin)}catch(_){}
    console.info('[Handwash Mission Pass R48] mission completion emitted',{
      completedRubSteps:result.completedRubSteps,
      completedProcessSteps:result.completedProcessSteps,
      independentSkillPassed:result.independentSkillPassed,
      metricCompletenessPct:result.metricCompletenessPct
    });
  }
},{capture:false});

window.HHHandwashMissionPassBridgeR48={release:RELEASE,bridge,missionReady};
document.documentElement.dataset.handwashMissionPassBridge=RELEASE;
console.info('[Handwash Mission Pass Bridge R48] installed',RELEASE);
})();
