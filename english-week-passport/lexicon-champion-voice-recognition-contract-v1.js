(()=>{
'use strict';
const RELEASE='20260809-LCA47-VOICE-RECOGNITION-CONTRACT-V1-CONTINUOUS-AGGREGATE';
const Native=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Native||window.__LCA_VOICE_RECOGNITION_CONTRACT__){return;}

function makeSyntheticEvent(nativeEvent, transcript){
  const alt={transcript:String(transcript||'').trim(),confidence:1};
  const result={0:alt,length:1,isFinal:false};
  return {resultIndex:0,results:[result],nativeEvent};
}

function aggregateTranscript(event){
  const parts=[];
  try{
    for(let i=0;i<event.results.length;i++){
      const t=String(event.results[i]?.[0]?.transcript||'').trim();
      if(t)parts.push(t);
    }
  }catch(_){ }
  return parts.join(' ').replace(/\s+/g,' ').trim();
}

function WrappedRecognition(){
  const native=new Native();
  try{native.continuous=true}catch(_){ }
  let userOnResult=null;

  const proxy=new Proxy(native,{
    set(target,prop,value){
      if(prop==='onresult'){
        userOnResult=typeof value==='function'?value:null;
        target.onresult=userOnResult?function(event){
          const transcript=aggregateTranscript(event);
          if(!transcript){userOnResult.call(proxy,event);return;}
          userOnResult.call(proxy,makeSyntheticEvent(event,transcript));
        }:null;
        return true;
      }
      try{target[prop]=value;return true}catch(_){return false}
    },
    get(target,prop){
      if(prop==='onresult')return userOnResult;
      if(prop==='start')return function(){
        try{target.continuous=true}catch(_){ }
        return target.start();
      };
      const value=target[prop];
      return typeof value==='function'?value.bind(target):value;
    }
  });
  return proxy;
}

WrappedRecognition.prototype=Native.prototype;
try{window.SpeechRecognition=WrappedRecognition}catch(_){ }
try{window.webkitSpeechRecognition=WrappedRecognition}catch(_){ }
window.__LCA_VOICE_RECOGNITION_CONTRACT__=Object.freeze({release:RELEASE,native:Native.name||'SpeechRecognition',continuous:true,aggregate:true});
console.info('[LEXICON Champion] Voice Recognition Contract V1 ready');
})();
