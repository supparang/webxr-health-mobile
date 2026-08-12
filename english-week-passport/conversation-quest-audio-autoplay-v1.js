(()=>{
'use strict';
const VERSION='2026-08-12-CQ-AUDIO-HARD-GATE-V3-AUDIBLE-END';
if(window.__CQ_AUDIO_AUTOPLAY_V1)return;
window.__CQ_AUDIO_AUTOPLAY_V1={version:VERSION};

const synth=window.speechSynthesis;
if(!synth||typeof window.SpeechSynthesisUtterance!=='function')return;

let primed=false;
let lastLine='';
let speakTimer=0;
let token=0;
let minAudibleUntil=0;
const nativeSpeak=synth.speak.bind(synth);
const nativeCancel=synth.cancel.bind(synth);
const nativeSetTimeout=window.setTimeout.bind(window);

function audioEnabled(){return window.CONVERSATION_QUEST?.state?.audioOn!==false;}
function currentLine(){return String(document.getElementById('line')?.textContent||'').trim();}
function estimateMs(utterance){
  const text=String(utterance?.text||'');
  const words=text.trim()?text.trim().split(/\s+/).length:0;
  const rate=Math.max(.55,Number(utterance?.rate)||1);
  return Math.min(18000,Math.max(2200,850+(words*440/rate)+(text.length*24/rate)));
}
function speechBusy(){return Boolean(synth.speaking||synth.pending||Date.now()<minAudibleUntil);}
function waitUntilTeacherDone(callback,maxWait=20000){
  const started=Date.now();let idleSince=0;
  const tick=()=>{
    const now=Date.now();const engineBusy=Boolean(synth.speaking||synth.pending);
    if(engineBusy||now<minAudibleUntil)idleSince=0;else if(!idleSince)idleSince=now;
    if(!engineBusy&&now>=minAudibleUntil&&idleSince&&now-idleSince>=480){callback();return;}
    if(now-started>=maxWait){callback();return;}
    nativeSetTimeout(tick,90);
  };
  tick();
}

/* Hard gate for Android Chrome:
   1) track an audible-tail window for every utterance,
   2) refuse early cancel while Teacher audio is active,
   3) delay any utterance onend callback until the audible tail is truly done.
   The third rule is what prevents the next Conversation turn from rendering
   before Teacher Maya has audibly finished her reply. */
if(!synth.__cqSpeechHardGateV3){
  synth.speak=function(utterance){
    const deadline=Date.now()+estimateMs(utterance);
    minAudibleUntil=Math.max(minAudibleUntil,deadline);
    const originalEnd=typeof utterance?.onend==='function'?utterance.onend:null;
    if(originalEnd&&!utterance.__cqAudibleEndWrapped){
      utterance.__cqAudibleEndWrapped=true;
      utterance.onend=(event)=>{
        waitUntilTeacherDone(()=>{try{originalEnd.call(utterance,event)}catch(error){console.warn(error)}});
      };
    }
    return nativeSpeak(utterance);
  };
  synth.cancel=function(){
    if(audioEnabled()&&(synth.speaking||synth.pending)&&Date.now()<minAudibleUntil)return;
    minAudibleUntil=0;
    return nativeCancel();
  };
  synth.__cqSpeechHardGateV3=true;
}

/* Safety net for an older cached runtime that still uses the 2100 ms
   `state.index++ -> renderTurn()` timer after a successful spoken reply. */
if(!window.__CQ_TRANSITION_TIMER_GATE_V3){
  window.__CQ_TRANSITION_TIMER_GATE_V3=true;
  window.setTimeout=function(callback,delay,...args){
    const source=typeof callback==='function'?Function.prototype.toString.call(callback):'';
    const isTurnAdvance=/state\.index\+\+/.test(source)&&/(renderTurn|finish)\s*\(/.test(source);
    if(isTurnAdvance){
      return nativeSetTimeout(()=>waitUntilTeacherDone(()=>callback(...args)),Math.max(0,Number(delay)||0));
    }
    return nativeSetTimeout(callback,delay,...args);
  };
}

function chooseVoice(){
  const voices=synth.getVoices?.()||[];
  return voices.find(v=>/^en-US$/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
}
function speakNow(text,{force=false}={}){
  text=String(text||'').trim();
  if(!text||!audioEnabled()||(!primed&&!force))return false;
  clearTimeout(speakTimer);
  const myToken=++token;
  try{synth.cancel();synth.resume?.()}catch{}
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='en-US';utterance.rate=.84;utterance.pitch=1.03;
  const voice=chooseVoice();if(voice)utterance.voice=voice;
  utterance.onerror=()=>{
    if(myToken!==token||!audioEnabled())return;
    speakTimer=nativeSetTimeout(()=>{if(myToken===token&&audioEnabled()){try{synth.resume?.();synth.speak(utterance)}catch{}}},180);
  };
  try{synth.speak(utterance);return true}catch{return false}
}
function scheduleCurrent(delay=180){
  const line=currentLine();if(!line||line===lastLine)return;
  lastLine=line;clearTimeout(speakTimer);speakTimer=nativeSetTimeout(()=>speakNow(line),delay);
}
function primeAudio(){
  primed=true;try{synth.resume?.()}catch{}
  nativeSetTimeout(()=>{const line=currentLine();if(line){lastLine=line;speakNow(line,{force:true})}},120);
}

function bind(){
  const start=document.getElementById('start');
  const replay=document.getElementById('replay');
  const question=document.getElementById('speakQuestion');
  const audio=document.getElementById('audio');
  const line=document.getElementById('line');
  const mic=document.getElementById('mic');

  start?.addEventListener('click',primeAudio,{capture:true});
  replay?.addEventListener('click',primeAudio,{capture:true});
  question?.addEventListener('click',()=>{primed=true;const text=currentLine();if(text){lastLine=text;speakNow(text,{force:true})}},{capture:true});
  audio?.addEventListener('click',()=>{
    nativeSetTimeout(()=>{
      if(audioEnabled()){primed=true;scheduleCurrent(60)}
      else{minAudibleUntil=0;try{nativeCancel()}catch{}}
    },0);
  },{capture:true});

  mic?.addEventListener('click',event=>{
    if(!audioEnabled()||!speechBusy())return;
    event.preventDefault();event.stopImmediatePropagation();
    mic.disabled=true;mic.textContent='🔊 ฟัง Teacher ให้จบ…';
    const feedback=document.getElementById('feedback');
    if(feedback){feedback.className='feedback';feedback.textContent='ฟัง Teacher Maya ให้จบก่อน แล้วจึงกดไมค์';}
    waitUntilTeacherDone(()=>{mic.disabled=false;mic.textContent='🎤 กดแล้วพูด';});
  },{capture:true});

  if(line){const observer=new MutationObserver(()=>scheduleCurrent(160));observer.observe(line,{childList:true,characterData:true,subtree:true});}
  synth.addEventListener?.('voiceschanged',()=>{if(primed&&audioEnabled()&&!synth.speaking)scheduleCurrent(80);});

  window.addEventListener('pagehide',()=>{clearTimeout(speakTimer);minAudibleUntil=0;try{nativeCancel()}catch{}},{once:true});
  window.CQ_AUDIO_AUTOPLAY=Object.freeze({version:VERSION,speakCurrent:()=>speakNow(currentLine(),{force:true}),waitUntilTeacherDone,get primed(){return primed},get speechBusy(){return speechBusy()}});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
