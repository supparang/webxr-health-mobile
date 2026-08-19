(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state)return;
if(window.HH_BALANCE_COACH_FINISH_SPEECH_STOP_V67?.active)return;
const s=BH.state;
const RELEASE='20260819-BALANCE-COACH-FINISH-SPEECH-STOP-V67';
let terminal=false;
let cancelTimers=[];
function cancelSpeech(){
  try{if('speechSynthesis' in window)window.speechSynthesis.cancel()}catch(_){}
}
function clearCancelTimers(){cancelTimers.forEach(id=>clearTimeout(id));cancelTimers=[]}
function terminalEvidence(){
  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  const results=Array.isArray(s.results)?s.results.length:0;
  const index=Number(s.index||0);
  const phase=String(s.phase||'').toLowerCase();
  return total>0&&(results>=total||index>=total||['summary','finishing','finished','done','result'].includes(phase));
}
function silenceTerminalSpeech(reason='terminal'){
  terminal=true;
  s.coachSpeechTerminalStopped=true;
  s.coachSpeechTerminalStopReason=reason;
  clearCancelTimers();
  cancelSpeech();
  // Legacy Grade-5 coach schedules applyInstruction() ~450 ms after completePose().
  // Cancel repeatedly across that window so no stale instruction is spoken after 6/6.
  [220,480,720,1050,1500].forEach(ms=>cancelTimers.push(setTimeout(cancelSpeech,ms)));
}
const baseCompletePose=BH.completePose;
if(typeof baseCompletePose==='function'){
  BH.completePose=(...args)=>{
    const out=baseCompletePose(...args);
    if(terminalEvidence())silenceTerminalSpeech('complete-pose-terminal');
    return out;
  };
}
const baseFinish=BH.finish;
if(typeof baseFinish==='function'){
  BH.finish=(...args)=>{
    silenceTerminalSpeech('finish-called');
    const out=baseFinish(...args);
    cancelSpeech();
    return out;
  };
}
const phaseGuard=setInterval(()=>{
  if(terminalEvidence()){
    if(!terminal)silenceTerminalSpeech('phase-terminal');
    cancelSpeech();
    if(['summary','finished','done','result'].includes(String(s.phase||'').toLowerCase()))clearInterval(phaseGuard);
  }
},120);
addEventListener('pagehide',()=>{clearInterval(phaseGuard);clearCancelTimers();cancelSpeech()},{once:true});
window.HH_BALANCE_COACH_FINISH_SPEECH_STOP_V67={release:RELEASE,active:true,terminalOnly:true};
console.info('[BalanceHold] Coach finish speech stop V67 ready',window.HH_BALANCE_COACH_FINISH_SPEECH_STOP_V67);
})();