(function(){
  'use strict';
  const VERSION='2026-08-12-SC-SPEECH-TRANSITION-GUARD-V2';
  if(window.__SC_SPEECH_TRANSITION_GUARD_V2__)return;
  window.__SC_SPEECH_TRANSITION_GUARD_V2__=VERSION;

  const nativeSetTimeout=window.setTimeout.bind(window);
  const nativeClearTimeout=window.clearTimeout.bind(window);
  const synth=window.speechSynthesis;
  let audibleUntil=0;

  if(synth&&!synth.__scSpeechTrackerV2){
    try{
      const nativeSpeak=synth.speak.bind(synth);
      synth.speak=function(utterance){
        try{
          const text=String(utterance?.text||'').trim();
          const words=text?text.split(/\s+/).length:0;
          const rate=Math.max(.55,Number(utterance?.rate)||1);
          const estimate=Math.min(16000,Math.max(1400,650+(words*430/rate)+(text.length*22/rate)));
          audibleUntil=Math.max(audibleUntil,Date.now()+estimate);
          const oldEnd=utterance.onend;
          const oldError=utterance.onerror;
          utterance.onend=function(event){audibleUntil=Math.max(audibleUntil,Date.now()+450);if(typeof oldEnd==='function')oldEnd.call(this,event)};
          utterance.onerror=function(event){audibleUntil=Math.max(audibleUntil,Date.now()+250);if(typeof oldError==='function')oldError.call(this,event)};
        }catch(_){}
        return nativeSpeak(utterance);
      };
      synth.__scSpeechTrackerV2=true;
    }catch(error){console.warn('[Sentence City] speech tracker install failed',error)}
  }

  function isAdvanceCallback(fn){
    if(typeof fn!=='function')return false;
    let src='';
    try{src=Function.prototype.toString.call(fn)}catch(_){}
    return /S\s*\.\s*index\s*\+\+|showTask\s*\(/.test(src);
  }

  function speechBusy(){
    const now=Date.now();
    return Boolean((synth&&(synth.speaking||synth.pending))||now<audibleUntil);
  }

  function runWhenSpeechDone(fn,args){
    const started=Date.now();
    let idleSince=0;
    const tick=()=>{
      const now=Date.now();
      if(speechBusy())idleSince=0;
      else if(!idleSince)idleSince=now;
      if(idleSince&&now-idleSince>=500){
        try{fn(...args)}catch(error){nativeSetTimeout(()=>{throw error},0)}
        return;
      }
      if(now-started>=20000){
        console.warn('[Sentence City] speech gate safety timeout');
        try{fn(...args)}catch(error){nativeSetTimeout(()=>{throw error},0)}
        return;
      }
      nativeSetTimeout(tick,70);
    };
    nativeSetTimeout(tick,40);
  }

  window.setTimeout=function(callback,delay,...args){
    if(!isAdvanceCallback(callback))return nativeSetTimeout(callback,delay,...args);
    return nativeSetTimeout(()=>runWhenSpeechDone(callback,args),Math.max(0,Number(delay)||0));
  };
  window.clearTimeout=function(id){return nativeClearTimeout(id)};
  console.info('[LEXICON X] Sentence City Speech Transition Guard V2 ready');
})();