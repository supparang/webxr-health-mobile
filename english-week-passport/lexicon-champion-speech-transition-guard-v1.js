(()=>{
'use strict';
const VERSION='2026-08-08-CHAMPION-SPEECH-TRANSITION-GUARD-V1';
if(window.__LCA_SPEECH_TRANSITION_GUARD__)return;
window.__LCA_SPEECH_TRANSITION_GUARD__={version:VERSION};

const nativeSetTimeout=window.setTimeout.bind(window);
const watchedDelaysMin=300;
const watchedDelaysMax=760;
const postSpeechGapMs=220;
const pollMs=70;

function speechBusy(){
  try{
    return !!(window.speechSynthesis && (speechSynthesis.speaking || speechSynthesis.pending));
  }catch(_){return false}
}
function isChampionRuntime(){
  return !!(window.LEXICON_CHAMPION_V47 || document.getElementById('arena'));
}

window.setTimeout=function(fn,delay,...args){
  const ms=Number(delay)||0;
  if(typeof fn!=='function' || !isChampionRuntime() || ms<watchedDelaysMin || ms>watchedDelaysMax){
    return nativeSetTimeout(fn,ms,...args);
  }
  return nativeSetTimeout(function guardedTransition(){
    if(speechBusy()){
      return nativeSetTimeout(guardedTransition,pollMs);
    }
    return nativeSetTimeout(()=>fn(...args),postSpeechGapMs);
  },ms);
};

// Diagnostic signal for QA. This does not affect game progression.
try{document.documentElement.dataset.lcaSpeechGuard='v1'}catch(_){}
console.info('[LEXICON Champion] Speech Transition Guard V1 ready');
})();
