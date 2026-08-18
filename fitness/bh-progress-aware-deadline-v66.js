(()=>{
'use strict';
if(window.HH_BALANCE_PROGRESS_AWARE_DEADLINE_V66?.active)return;
const BH=window.BH;
if(!BH||!BH.state)return;
const s=BH.state,e=BH.el||{};
const RELEASE='20260818-BALANCE-PROGRESS-AWARE-DEADLINE-V66';
let lastTick=performance.now();
let lastToken='';
let extendedMs=0;
const finite=v=>Number.isFinite(Number(v))?Number(v):0;
const total=()=>Array.isArray(s.sequence)?s.sequence.length:6;
const completed=()=>Array.isArray(s.results)?s.results.length:0;
const token=()=>`${finite(s.index)}|${completed()}|${String(s.currentKey||'')}|${String(s.bossKey||'')}`;
const speaking=()=>{try{return !!(speechSynthesis&&(speechSynthesis.speaking||speechSynthesis.pending))}catch(_){return false}};
const instructionLocked=()=>s.grade5InstructionLocked===true||speaking();
function remaining(){return Math.max(0,finite(s.timeLimit||60)-(s.startedAt?Math.max(0,(performance.now()-finite(s.startedAt))/1000):0))}
function addBudget(ms,reason){
  if(!(ms>0)||!s.startedAt)return;
  s.startedAt+=ms;
  extendedMs+=ms;
  s.progressAwareExtendedMs=extendedMs;
  s.progressAwareLastReason=reason;
}
function ensureAttemptWindow(){
  if(String(s.phase||'').toLowerCase()!=='play'||completed()>=total())return;
  const isBoss=finite(s.index)>=total()-1||String(s.currentKey||'')==='boss';
  const minLeft=isBoss?18:10;
  const left=remaining();
  if(left<minLeft)addBudget((minLeft-left)*1000,isBoss?'boss-minimum-window':'pose-minimum-window');
}
const guard=setInterval(()=>{
  const now=performance.now();
  const dt=Math.max(0,Math.min(500,now-lastTick));
  lastTick=now;
  if(String(s.phase||'').toLowerCase()!=='play')return;
  // Instruction audio is not learner performance time.
  if(instructionLocked())addBudget(dt,'instruction-pause');
  const t=token();
  if(t!==lastToken){lastToken=t;ensureAttemptWindow()}
  // Never let a still-pending final pose be killed with only a couple of seconds left.
  if(completed()<total()&&remaining()<3)ensureAttemptWindow();
},120);
addEventListener('pagehide',()=>clearInterval(guard),{once:true});
window.HH_BALANCE_PROGRESS_AWARE_DEADLINE_V66={release:RELEASE,active:true,instructionTimeExcluded:true,bossMinimumSeconds:18,poseMinimumSeconds:10,strictCompletion:'6/6'};
console.info('[BalanceHold] Progress-aware deadline V66 ready',window.HH_BALANCE_PROGRESS_AWARE_DEADLINE_V66);
})();