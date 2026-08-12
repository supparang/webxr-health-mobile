(()=>{
'use strict';
const VERSION='2026-08-12-CATEGORY-SPEECH-HARD-GATE-V1';
if(window.__CATEGORY_SPEECH_HARD_GATE_V1)return;
window.__CATEGORY_SPEECH_HARD_GATE_V1={version:VERSION};
let queued=false;
function waitSpeechIdle(done){
  const synth=window.speechSynthesis;
  const started=Date.now();
  let idleSince=0;
  const tick=()=>{
    const now=Date.now();
    const active=Boolean(synth&&(synth.speaking||synth.pending));
    if(active)idleSince=0;
    else if(!idleSince)idleSince=now;
    if((!active&&idleSince&&now-idleSince>=420)||now-started>=12000){done();return;}
    setTimeout(tick,80);
  };
  tick();
}
function install(){
  if(typeof window.judge!=='function'){setTimeout(install,60);return;}
  if(window.judge.__speechHardGate)return;
  const original=window.judge;
  function guardedJudge(portal,dragData){
    const synth=window.speechSynthesis;
    if(synth&&(synth.speaking||synth.pending)){
      if(queued)return;
      queued=true;
      const instruction=document.getElementById('instruction');
      if(instruction)instruction.textContent='🔊 ฟัง Teacher ให้จบก่อนตรวจคำตอบ…';
      waitSpeechIdle(()=>{queued=false;original(portal,dragData)});
      return;
    }
    original(portal,dragData);
  }
  guardedJudge.__speechHardGate=true;
  window.judge=guardedJudge;
  console.info('[LEXICON X] Category Forest Speech Hard Gate ready',VERSION);
}
install();
})();