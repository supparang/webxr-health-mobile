(()=>{
'use strict';
if(window.HH_BALANCE_INSTRUCTION_HARD_GATE_V62?.active){
  console.info('[BalanceHold] instruction hard gate already active');
  return;
}
const BH=window.BH;
if(!BH||!BH.state||typeof BH.evaluatePose!=='function')return;
const s=BH.state,e=BH.el||{};
const RELEASE='20260818-BALANCE-INSTRUCTION-HARD-GATE-V62-R3-SINGLE-INSTALL';
const baseEvaluate=BH.evaluatePose;
let lastToken='';
let postSpeechUntil=0;
function speaking(){try{return !!(window.speechSynthesis&&(speechSynthesis.speaking||speechSynthesis.pending));}catch(_){return false}}
function token(){return `${Number(s.index)||0}|${String(s.currentKey||'')}|${String(s.bossKey||'')}`}
function hardLocked(){
  const t=token();
  if(t!==lastToken){lastToken=t;postSpeechUntil=performance.now()+250}
  const coachLocked=s.grade5InstructionLocked===true;
  const voiceBusy=speaking();
  if(voiceBusy)postSpeechUntil=performance.now()+320;
  return coachLocked||voiceBusy||performance.now()<postSpeechUntil;
}
function resetAccumulation(){
  s.holdMs=0;s.gateMs=0;s.invalidSince=0;s.lastValidAt=0;
  if(e.holdText)e.holdText.textContent='0%';
  if(e.holdRing)e.holdRing.style.setProperty('--hold','0deg');
  if(e.coachMain)e.coachMain.textContent='🔊 ฟังคำสั่งให้จบก่อน';
  if(e.coachSub)e.coachSub.textContent='ระบบจะเริ่มตรวจท่าหลังเสียงคำสั่งจบ';
  if(e.coachBadge)e.coachBadge.textContent='ฟัง';
}
BH.evaluatePose=(...args)=>{
  if(hardLocked()){
    resetAccumulation();
    const r=baseEvaluate(...args)||{};
    r.valid=false;r.instructionLocked=true;
    r.feedback='🔊 ฟังคำสั่งให้จบก่อน • จากนั้นระบบจะเริ่มตรวจท่า';
    return r;
  }
  return baseEvaluate(...args)||{};
};
const guard=setInterval(()=>{if(hardLocked())resetAccumulation()},80);
addEventListener('pagehide',()=>clearInterval(guard),{once:true});
window.HH_BALANCE_INSTRUCTION_HARD_GATE_V62={release:RELEASE,active:true,singleInstall:true};
console.info('[BalanceHold] instruction hard gate ready',window.HH_BALANCE_INSTRUCTION_HARD_GATE_V62);
})();