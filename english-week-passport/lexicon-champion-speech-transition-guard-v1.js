(()=>{
'use strict';
const VERSION='2026-08-09-CHAMPION-SPEECH-TRANSITION-GUARD-V3-FINAL-VOICE';
if(window.__LCA_SPEECH_TRANSITION_GUARD__?.version===VERSION)return;
window.__LCA_SPEECH_TRANSITION_GUARD__={version:VERSION};

const nativeSetTimeout=window.setTimeout.bind(window);
const watchedDelaysMin=300;
const watchedDelaysMax=760;
const postSpeechGapMs=220;
const pollMs=70;
const maxSpeechWaitMs=1800;

function speechBusy(){
  try{
    return !!(window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending));
  }catch(_){return false}
}
function isChampionRuntime(){
  return !!(window.LEXICON_CHAMPION_V47 || document.getElementById('arena'));
}
function isFinalVoiceComplete(delay){
  const st=window.LEXICON_CHAMPION_V47?.state;
  return Number(delay)===350 && Number(st?.bossAttack||0)>=3;
}
function mustBypassGuard(fn,delay){
  // Final Voice success in the core uses setTimeout(finish,350). Do not rely
  // only on Function.name because wrappers/minification/browser bindings can
  // make that test unreliable. The game state is authoritative here.
  return fn?.name==='finish' || isFinalVoiceComplete(delay);
}

window.setTimeout=function(fn,delay,...args){
  const ms=Number(delay)||0;
  if(
    typeof fn!=='function' ||
    !isChampionRuntime() ||
    mustBypassGuard(fn,ms) ||
    ms<watchedDelaysMin ||
    ms>watchedDelaysMax
  ){
    return nativeSetTimeout(fn,ms,...args);
  }

  const startedAt=Date.now();
  return nativeSetTimeout(function guardedTransition(){
    if(speechBusy() && (Date.now()-startedAt)<maxSpeechWaitMs){
      return nativeSetTimeout(guardedTransition,pollMs);
    }
    return nativeSetTimeout(()=>fn(...args),postSpeechGapMs);
  },ms);
};

try{document.documentElement.dataset.lcaSpeechGuard='v3'}catch(_){}
console.info('[LEXICON Champion] Speech Transition Guard V3 final-voice ready');
})();
