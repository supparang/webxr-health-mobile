(()=>{
'use strict';
const VERSION='2026-08-12-CQ-AUDIO-HARD-GATE-V2';
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

function audioEnabled(){return window.CONVERSATION_QUEST?.state?.audioOn!==false;}
function currentLine(){return String(document.getElementById('line')?.textContent||'').trim();}
function estimateMs(utterance){
  const text=String(utterance?.text||'');
  const rate=Math.max(.55,Number(utterance?.rate)||1);
  return Math.min(16000,Math.max(3800,1100+(text.length*135/rate)));
}
function speechBusy(){return Boolean(synth.speaking||synth.pending||Date.now()<minAudibleUntil);}

/* Hard gate: Android Chrome may report onend/idle a little before the audible
   tail actually finishes. Track a conservative audible window for every
   utterance and refuse early cancel while audio is enabled. A new utterance
   is then queued instead of cutting the Teacher mid-sentence. */
if(!synth.__cqSpeechHardGate){
  synth.speak=function(utterance){
    minAudibleUntil=Math.max(minAudibleUntil,Date.now()+estimateMs(utterance));
    return nativeSpeak(utterance);
  };
  synth.cancel=function(){
    if(audioEnabled()&&(synth.speaking||synth.pending)&&Date.now()<minAudibleUntil)return;
    minAudibleUntil=0;
    return nativeCancel();
  };
  synth.__cqSpeechHardGate=true;
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
    speakTimer=setTimeout(()=>{if(myToken===token&&audioEnabled()){try{synth.resume?.();synth.speak(utterance)}catch{}}},180);
  };
  try{synth.speak(utterance);return true}catch{return false}
}
function scheduleCurrent(delay=180){
  const line=currentLine();if(!line||line===lastLine)return;
  lastLine=line;clearTimeout(speakTimer);speakTimer=setTimeout(()=>speakNow(line),delay);
}
function primeAudio(){
  primed=true;try{synth.resume?.()}catch{}
  setTimeout(()=>{const line=currentLine();if(line){lastLine=line;speakNow(line,{force:true})}},120);
}
function waitUntilTeacherDone(callback,maxWait=18000){
  const started=Date.now();let idleSince=0;
  const tick=()=>{
    const now=Date.now();const active=Boolean(synth.speaking||synth.pending);
    if(active)idleSince=0;else if(!idleSince)idleSince=now;
    if(!active&&now>=minAudibleUntil&&idleSince&&now-idleSince>=420){callback();return;}
    if(now-started>=maxWait){callback();return;}
    setTimeout(tick,90);
  };
  tick();
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
    setTimeout(()=>{
      if(audioEnabled()){primed=true;scheduleCurrent(60)}
      else{minAudibleUntil=0;try{nativeCancel()}catch{}}
    },0);
  },{capture:true});

  /* Do not let learner start recognition while Maya/sample audio is still
     audible. This also prevents recognition from triggering an early cancel. */
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
