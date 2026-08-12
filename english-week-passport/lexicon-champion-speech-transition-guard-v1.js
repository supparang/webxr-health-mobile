(()=>{
'use strict';
const VERSION='2026-08-12-CHAMPION-SPEECH-TRANSITION-GUARD-V5-AUDIBLE-TAIL';
if(window.__LCA_SPEECH_TRANSITION_GUARD__?.version===VERSION)return;
window.__LCA_SPEECH_TRANSITION_GUARD__={version:VERSION};

const nativeSetTimeout=window.setTimeout.bind(window);
const synth=window.speechSynthesis;
const watchedDelaysMin=180;
const watchedDelaysMax=2400;
const postSpeechGapMs=280;
const pollMs=70;
const maxSpeechWaitMs=19000;
let minAudibleUntil=0;

function estimateMs(utterance){
  const text=String(utterance?.text||'').trim();
  const words=text?text.split(/\s+/).length:0;
  const rate=Math.max(.55,Number(utterance?.rate)||1);
  return Math.min(15000,Math.max(1300,650+(words*420/rate)+(text.length*20/rate)));
}
function installSpeechTracker(){
  if(!synth||synth.__lcaAudibleTailV5)return;
  const nativeSpeak=synth.speak.bind(synth);
  synth.speak=function(utterance){
    minAudibleUntil=Math.max(minAudibleUntil,Date.now()+estimateMs(utterance));
    return nativeSpeak(utterance);
  };
  synth.__lcaAudibleTailV5=true;
}
function speechBusy(){
  try{return Boolean(synth&&(synth.speaking||synth.pending||Date.now()<minAudibleUntil));}
  catch(_){return Date.now()<minAudibleUntil;}
}
function isChampionRuntime(){return !!(window.LEXICON_CHAMPION_V47||document.getElementById('arena'));}

installSpeechTracker();
window.setTimeout=function(fn,delay,...args){
  const ms=Number(delay)||0;
  if(typeof fn!=='function'||!isChampionRuntime()||ms<watchedDelaysMin||ms>watchedDelaysMax){
    return nativeSetTimeout(fn,ms,...args);
  }
  const startedAt=Date.now();
  return nativeSetTimeout(function guardedTransition(){
    if(speechBusy()&&(Date.now()-startedAt)<maxSpeechWaitMs){
      return nativeSetTimeout(guardedTransition,pollMs);
    }
    return nativeSetTimeout(()=>fn(...args),postSpeechGapMs);
  },ms);
};

try{document.documentElement.dataset.lcaSpeechGuard='v5-audible-tail'}catch(_){}
console.info('[LEXICON Champion] Speech Transition Guard V5 audible-tail ready');
})();
