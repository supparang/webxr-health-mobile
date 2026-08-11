(()=>{
'use strict';
const VERSION='2026-08-11-CHAMPION-SPEECH-TRANSITION-GUARD-V4-NPC-END';
if(window.__LCA_SPEECH_TRANSITION_GUARD__?.version===VERSION)return;
window.__LCA_SPEECH_TRANSITION_GUARD__={version:VERSION};

const nativeSetTimeout=window.setTimeout.bind(window);
// Champion core advances options/gates/final-boss with short timers (about
// 330-650 ms). Those timers must never outrun Teacher/NPC speech.
const watchedDelaysMin=250;
const watchedDelaysMax=900;
const postSpeechGapMs=240;
const pollMs=60;
const maxSpeechWaitMs=15000;

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
  if(
    typeof fn!=='function' ||
    !isChampionRuntime() ||
    ms<watchedDelaysMin ||
    ms>watchedDelaysMax
  ){
    return nativeSetTimeout(fn,ms,...args);
  }

  const startedAt=Date.now();
  return nativeSetTimeout(function guardedTransition(){
    // Do not advance while Teacher/NPC speech is still speaking OR queued.
    // This applies to normal Gates and Final Boss alike; V3 incorrectly
    // bypassed the final-voice 350 ms transition.
    if(speechBusy() && (Date.now()-startedAt)<maxSpeechWaitMs){
      return nativeSetTimeout(guardedTransition,pollMs);
    }
    return nativeSetTimeout(()=>fn(...args),postSpeechGapMs);
  },ms);
};

try{document.documentElement.dataset.lcaSpeechGuard='v4-npc-end'}catch(_){}
console.info('[LEXICON Champion] Speech Transition Guard V4 NPC-end ready');
})();
