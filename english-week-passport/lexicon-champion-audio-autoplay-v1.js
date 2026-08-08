(()=>{
'use strict';
const RELEASE='20260808-LCA47-AUDIO-AUTOPLAY-V1';
let unlocked=false,lastText='',lastAt=0,retryTimer=0;
const $=id=>document.getElementById(id);
function enabled(){return window.LEXICON_CHAMPION_V47?.state?.audio!==false}
function prime(){
  if(!('speechSynthesis' in window))return;
  unlocked=true;
  try{
    speechSynthesis.resume?.();
    const u=new SpeechSynthesisUtterance(' ');
    u.lang='en-US';u.volume=.01;u.rate=1;
    speechSynthesis.speak(u);
  }catch(_){ }
}
function chooseVoice(){
  try{
    const vs=speechSynthesis.getVoices?.()||[];
    return vs.find(v=>/^en(-|_)/i.test(v.lang)&&/US/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
  }catch(_){return null}
}
function fallbackSpeak(text,force=false){
  text=String(text||'').trim();
  if(!text||text==='เตรียมตัว'||!enabled()||!unlocked||!('speechSynthesis' in window))return;
  const now=Date.now();
  if(!force&&text===lastText&&now-lastAt<5000)return;
  clearTimeout(retryTimer);
  retryTimer=setTimeout(()=>{
    if(!enabled())return;
    // The core game already calls say(). Only intervene when it stayed silent.
    if(speechSynthesis.speaking||speechSynthesis.pending)return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='en-US';u.rate=.84;u.pitch=1;u.volume=1;
      const v=chooseVoice();if(v)u.voice=v;
      speechSynthesis.speak(u);
      lastText=text;lastAt=Date.now();
    }catch(_){ }
  },220);
}
function watchCommand(){
  const root=$('arena')||document.body;
  const scan=()=>{
    const cmd=$('cmd');
    if(cmd){
      const t=cmd.textContent?.trim();
      if(t&&t!=='เตรียมตัว')fallbackSpeak(t);
    }
  };
  new MutationObserver(scan).observe(root,{childList:true,subtree:true,characterData:true});
  scan();
}
// Capture user gesture before the game's async start flow.
document.addEventListener('pointerdown',e=>{
  if(e.target?.closest?.('#start,#listen,#sample,#audio'))prime();
},{capture:true,passive:true});
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#start')){prime();setTimeout(()=>{
    // Brief orientation cue; actual action command is still spoken after calibration/countdown.
    if(enabled()&&!speechSynthesis.speaking&&!speechSynthesis.pending){
      try{const u=new SpeechSynthesisUtterance('Get ready. Stand where the camera can see your body.');u.lang='en-US';u.rate=.86;const v=chooseVoice();if(v)u.voice=v;speechSynthesis.speak(u)}catch(_){ }
    }
  },120)}
},{capture:true});
if('speechSynthesis' in window){speechSynthesis.onvoiceschanged=()=>{const t=$('cmd')?.textContent?.trim();if(t&&t!=='เตรียมตัว')fallbackSpeak(t)}}
watchCommand();
window.LEXICON_CHAMPION_AUDIO_AUTOPLAY=Object.freeze({release:RELEASE,prime,force:t=>fallbackSpeak(t,true)});
})();
