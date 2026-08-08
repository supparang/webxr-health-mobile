(()=>{
'use strict';
const VERSION='2026-08-08-CQ-AUDIO-AUTOPLAY-V1';
if(window.__CQ_AUDIO_AUTOPLAY_V1)return;
window.__CQ_AUDIO_AUTOPLAY_V1={version:VERSION};

const synth=window.speechSynthesis;
if(!synth||typeof window.SpeechSynthesisUtterance!=='function')return;

let primed=false;
let lastLine='';
let speakTimer=0;
let token=0;

function audioEnabled(){
  return window.CONVERSATION_QUEST?.state?.audioOn!==false;
}
function currentLine(){
  return String(document.getElementById('line')?.textContent||'').trim();
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
  utterance.lang='en-US';
  utterance.rate=.84;
  utterance.pitch=1.03;
  const voice=chooseVoice();
  if(voice)utterance.voice=voice;
  utterance.onerror=()=>{
    if(myToken!==token||!audioEnabled())return;
    speakTimer=setTimeout(()=>{
      if(myToken===token&&audioEnabled()){
        try{synth.resume?.();synth.speak(utterance)}catch{}
      }
    },180);
  };
  try{synth.speak(utterance);return true}catch{return false}
}
function scheduleCurrent(delay=180){
  const line=currentLine();
  if(!line||line===lastLine)return;
  lastLine=line;
  clearTimeout(speakTimer);
  speakTimer=setTimeout(()=>speakNow(line),delay);
}
function primeAudio(){
  primed=true;
  try{synth.resume?.()}catch{}
  // Use the same user gesture to speak the first visible prompt as soon as it is rendered.
  setTimeout(()=>{
    const line=currentLine();
    if(line){lastLine=line;speakNow(line,{force:true})}
  },120);
}

function bind(){
  const start=document.getElementById('start');
  const replay=document.getElementById('replay');
  const question=document.getElementById('speakQuestion');
  const audio=document.getElementById('audio');
  const line=document.getElementById('line');

  start?.addEventListener('click',primeAudio,{capture:true});
  replay?.addEventListener('click',primeAudio,{capture:true});
  question?.addEventListener('click',()=>{primed=true;const text=currentLine();if(text){lastLine=text;speakNow(text,{force:true})}},{capture:true});
  audio?.addEventListener('click',()=>{
    setTimeout(()=>{
      if(audioEnabled()){primed=true;scheduleCurrent(60)}
      else{try{synth.cancel()}catch{}}
    },0);
  },{capture:true});

  if(line){
    const observer=new MutationObserver(()=>scheduleCurrent(160));
    observer.observe(line,{childList:true,characterData:true,subtree:true});
  }
  synth.addEventListener?.('voiceschanged',()=>{
    if(primed&&audioEnabled()&&!synth.speaking)scheduleCurrent(80);
  });

  window.addEventListener('pagehide',()=>{clearTimeout(speakTimer);try{synth.cancel()}catch{}},{once:true});
  window.CQ_AUDIO_AUTOPLAY=Object.freeze({version:VERSION,speakCurrent:()=>speakNow(currentLine(),{force:true}),get primed(){return primed}});
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
else bind();
})();
