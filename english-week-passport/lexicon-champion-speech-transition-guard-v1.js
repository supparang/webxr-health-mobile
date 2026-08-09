(()=>{
'use strict';
const VERSION='2026-08-09-CHAMPION-SPEECH-TRANSITION-GUARD-V2-BOUNDED';
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
function mustBypassGuard(fn){
  // Final Voice success uses setTimeout(finish,350). It must never be held
  // behind speechSynthesis state because Chrome can leave speaking/pending
  // true briefly (or stale) after recognition/audio cancellation.
  return fn?.name==='finish';
}

window.setTimeout=function(fn,delay,...args){
  const ms=Number(delay)||0;
  if(
    typeof fn!=='function' ||
    !isChampionRuntime() ||
    mustBypassGuard(fn) ||
    ms<watchedDelaysMin ||
    ms>watchedDelaysMax
  ){
    return nativeSetTimeout(fn,ms,...args);
  }

  const startedAt=Date.now();
  return nativeSetTimeout(function guardedTransition(){
    // Preserve the intended speech-complete UX for ordinary gate transitions,
    // but never allow a stale SpeechSynthesis state to freeze progression.
    if(speechBusy() && (Date.now()-startedAt)<maxSpeechWaitMs){
      return nativeSetTimeout(guardedTransition,pollMs);
    }
    return nativeSetTimeout(()=>fn(...args),postSpeechGapMs);
  },ms);
};

try{document.documentElement.dataset.lcaSpeechGuard='v2'}catch(_){}
console.info('[LEXICON Champion] Speech Transition Guard V2 bounded ready');
})();
