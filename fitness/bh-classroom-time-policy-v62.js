(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el;
const RELEASE='20260808-BALANCE-CLASSROOM-TIME-POLICY-V62';
const ROUND_SECONDS=90;
const BOSS_MIN_SECONDS=10;

function forceNinetySeconds(){
  if(e.duration){
    if(![...e.duration.options].some(o=>o.value===String(ROUND_SECONDS))){
      const option=document.createElement('option');option.value=String(ROUND_SECONDS);option.textContent=String(ROUND_SECONDS);e.duration.appendChild(option);
    }
    e.duration.value=String(ROUND_SECONDS);
    e.duration.disabled=true;
    e.duration.dataset.classroomTimePolicy='90s-fixed';
  }
}
forceNinetySeconds();

if(typeof BH.resetRoundState==='function'){
  const baseReset=BH.resetRoundState;
  BH.resetRoundState=()=>{
    const result=baseReset();
    s.timeLimit=ROUND_SECONDS;
    s.timeLeft=ROUND_SECONDS;
    s.bossEnteredAt=0;
    s.bossDeadlineAt=0;
    s.classroomRoundSeconds=ROUND_SECONDS;
    s.classroomBossMinSeconds=BOSS_MIN_SECONDS;
    return result;
  };
}

if(typeof BH.setPoseUI==='function'){
  const baseSetPoseUI=BH.setPoseUI;
  BH.setPoseUI=()=>{
    const result=baseSetPoseUI();
    if(String(s.currentKey||'')==='boss'){
      const now=BH.now?.()||performance.now();
      s.bossEnteredAt=now;
      s.bossDeadlineAt=Math.max(Number(s.startedAt||0)+ROUND_SECONDS*1000,now+BOSS_MIN_SECONDS*1000);
      s.timeLeft=Math.max(Number(s.timeLeft||0),BOSS_MIN_SECONDS);
      if(e.coachSub)e.coachSub.textContent=`Boss • มีเวลาอย่างน้อย ${BOSS_MIN_SECONDS} วินาทีเพื่อค้างท่าให้ครบ`;
    }
    return result;
  };
}

if(typeof BH.gameLoop==='function'){
  const baseGameLoop=BH.gameLoop;
  BH.gameLoop=(ts,token)=>{
    if(String(s.currentKey||'')==='boss'&&s.bossDeadlineAt){
      const remaining=(Number(s.bossDeadlineAt)-ts)/1000;
      if(remaining>Number(s.timeLeft||0)){
        // Shift the effective round start so the legacy loop cannot expire before the guaranteed Boss window.
        s.startedAt=ts-(s.timeLimit-Math.max(0,remaining))*1000;
      }
    }
    return baseGameLoop(ts,token);
  };
}

if(typeof BH.calcSummary==='function'){
  const baseCalc=BH.calcSummary;
  BH.calcSummary=reason=>{
    const x=baseCalc(reason)||{};
    x.classroomTimePolicyVersion=RELEASE;
    x.classroomRoundSeconds=ROUND_SECONDS;
    x.classroomBossMinimumSeconds=BOSS_MIN_SECONDS;
    x.classroomBossTimeProtected=true;
    return x;
  };
}

window.BH_CLASSROOM_TIME_POLICY_V62={release:RELEASE,roundSeconds:ROUND_SECONDS,bossMinimumSeconds:BOSS_MIN_SECONDS};
document.documentElement.dataset.bhClassroomTimePolicy='v62-90s-boss10s';
console.info('[BalanceHold] Classroom Time Policy V62 ready',window.BH_CLASSROOM_TIME_POLICY_V62);
})();
