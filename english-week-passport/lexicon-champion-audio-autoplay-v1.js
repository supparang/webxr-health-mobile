(()=>{
'use strict';
const RELEASE='20260809-LCA47-AUDIO-AUTOPLAY-V2-GATE-NARRATION';
let unlocked=false,lastText='',lastAt=0,retryTimer=0,lastGateKey='';
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
function speakNow(text,key=''){
  text=String(text||'').trim();
  if(!text||!enabled()||!unlocked||!('speechSynthesis' in window))return;
  if(key&&lastGateKey===key)return;
  if(key)lastGateKey=key;
  clearTimeout(retryTimer);
  try{
    // A new gate owns the audio context. Never allow the previous Body command
    // to continue speaking over an Understand/Build/Respond screen.
    speechSynthesis.cancel();
    const u=new SpeechSynthesisUtterance(text);
    u.lang='en-US';u.rate=.84;u.pitch=1;u.volume=1;
    const v=chooseVoice();if(v)u.voice=v;
    speechSynthesis.speak(u);
    lastText=text;lastAt=Date.now();
  }catch(_){ }
}
function fallbackSpeak(text,force=false){
  text=String(text||'').trim();
  if(!text||text==='เตรียมตัว'||!enabled()||!unlocked||!('speechSynthesis' in window))return;
  const now=Date.now();
  if(!force&&text===lastText&&now-lastAt<5000)return;
  clearTimeout(retryTimer);
  retryTimer=setTimeout(()=>{
    if(!enabled())return;
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
function scanArena(){
  const api=window.LEXICON_CHAMPION_V47;
  const st=api?.state;
  const arena=$('arena');
  if(!arena)return;

  // Pose/Body command fallback.
  const cmd=$('cmd');
  if(cmd){
    const t=cmd.textContent?.trim();
    if(t&&t!=='เตรียมตัว')fallbackSpeak(t);
  }

  // Gate 2 previously rendered the scenario but never narrated it, so the
  // learner could still hear the previous Body instruction. Gate 2 now owns
  // the audio context and reads exactly the scenario displayed on screen.
  const arenaText=String(arena.textContent||'');
  if(Number(st?.phase)===1 && /Gate\s*2\s*•?\s*Understand/i.test(arenaText)){
    const context=String(api?.mission?.context||'').trim();
    if(context){
      const key=`gate2:${api?.SET||''}:${context}`;
      if(lastGateKey!==key){
        clearTimeout(retryTimer);
        // 80 ms lets the new Gate 2 DOM settle; it is below the transition
        // guard's watched range and therefore cannot be delayed by that guard.
        setTimeout(()=>speakNow(context,key),80);
      }
    }
  }
}
function watchArena(){
  const root=$('arena')||document.body;
  new MutationObserver(scanArena).observe(root,{childList:true,subtree:true,characterData:true});
  scanArena();
}
// Capture user gesture before the game's async start flow.
document.addEventListener('pointerdown',e=>{
  if(e.target?.closest?.('#start,#listen,#sample,#audio'))prime();
},{capture:true,passive:true});
document.addEventListener('click',e=>{
  if(e.target?.closest?.('#start')){prime();setTimeout(()=>{
    if(enabled()&&!speechSynthesis.speaking&&!speechSynthesis.pending){
      try{const u=new SpeechSynthesisUtterance('Get ready. Stand where the camera can see your body.');u.lang='en-US';u.rate=.86;const v=chooseVoice();if(v)u.voice=v;speechSynthesis.speak(u)}catch(_){ }
    }
  },120)}
},{capture:true});
if('speechSynthesis' in window){speechSynthesis.onvoiceschanged=()=>scanArena()}
watchArena();
window.LEXICON_CHAMPION_AUDIO_AUTOPLAY=Object.freeze({release:RELEASE,prime,force:t=>fallbackSpeak(t,true),scan:scanArena});
console.info('[LEXICON Champion] Audio Autoplay V2 gate narration ready');
})();
