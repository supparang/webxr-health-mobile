(()=>{
'use strict';
const VERSION='2026-08-12-CATEGORY-SPEECH-HARD-GATE-V2-AUDIBLE-TAIL';
if(window.__CATEGORY_SPEECH_HARD_GATE_V2)return;
window.__CATEGORY_SPEECH_HARD_GATE_V2={version:VERSION};
const synth=window.speechSynthesis;
let queued=false,minAudibleUntil=0;

function estimateMs(utterance){
  const text=String(utterance?.text||'');
  const words=text.trim()?text.trim().split(/\s+/).length:0;
  const rate=Math.max(.55,Number(utterance?.rate)||1);
  return Math.min(14000,Math.max(1500,700+(words*430/rate)+(text.length*22/rate)));
}
function installSpeechTracker(){
  if(!synth||synth.__categoryAudibleTailV2)return;
  const nativeSpeak=synth.speak.bind(synth);
  synth.speak=function(utterance){
    minAudibleUntil=Math.max(minAudibleUntil,Date.now()+estimateMs(utterance));
    return nativeSpeak(utterance);
  };
  synth.__categoryAudibleTailV2=true;
}
function speechBusy(){return Boolean(synth&&(synth.speaking||synth.pending||Date.now()<minAudibleUntil));}
function waitSpeechIdle(done,maxWait=18000){
  const started=Date.now();let idleSince=0;
  const tick=()=>{
    const now=Date.now();
    const engineBusy=Boolean(synth&&(synth.speaking||synth.pending));
    if(engineBusy||now<minAudibleUntil)idleSince=0;else if(!idleSince)idleSince=now;
    if(!engineBusy&&now>=minAudibleUntil&&idleSince&&now-idleSince>=450){done();return;}
    if(now-started>=maxWait){done();return;}
    setTimeout(tick,80);
  };
  tick();
}
function install(){
  installSpeechTracker();
  if(typeof window.judge!=='function'){setTimeout(install,60);return;}
  if(window.judge.__speechHardGateV2)return;
  const original=window.judge;
  function guardedJudge(portal,dragData){
    if(speechBusy()){
      if(queued)return;
      queued=true;
      const instruction=document.getElementById('instruction');
      if(instruction)instruction.textContent='🔊 ฟัง Teacher ให้จบก่อนตรวจคำตอบ…';
      waitSpeechIdle(()=>{queued=false;original(portal,dragData)});
      return;
    }
    original(portal,dragData);
  }
  guardedJudge.__speechHardGateV2=true;
  window.judge=guardedJudge;
  console.info('[LEXICON X] Category Forest Speech Hard Gate ready',VERSION);
}
install();
})();
