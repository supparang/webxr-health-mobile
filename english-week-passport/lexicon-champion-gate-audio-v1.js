(()=>{
'use strict';
const VERSION='2026-08-09-LCA47-GATE-AUDIO-V1';
if(window.__LCA_GATE_AUDIO__?.version===VERSION)return;
window.__LCA_GATE_AUDIO__={version:VERSION};

let lastKey='';
let speakTimer=0;
const $=id=>document.getElementById(id);

function audioEnabled(){
  return window.LEXICON_CHAMPION_V47?.state?.audio!==false;
}
function speak(text,key){
  text=String(text||'').trim();
  if(!text||!audioEnabled()||!('speechSynthesis' in window))return;
  if(lastKey===key)return;
  lastKey=key;
  clearTimeout(speakTimer);
  // Keep this delay below the global speech-transition-guard range.
  speakTimer=setTimeout(()=>{
    if(!audioEnabled())return;
    try{
      speechSynthesis.cancel();
      const u=new SpeechSynthesisUtterance(text);
      u.lang='en-US';
      u.rate=.84;
      u.pitch=1;
      u.volume=1;
      const voices=speechSynthesis.getVoices?.()||[];
      u.voice=voices.find(v=>/^en(-|_)/i.test(v.lang)&&/US/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang))||null;
      speechSynthesis.speak(u);
    }catch(_){ }
  },120);
}
function sync(){
  const api=window.LEXICON_CHAMPION_V47;
  const st=api?.state;
  const arena=$('arena');
  if(!api||!st||!arena)return;
  const text=String(arena.textContent||'');

  // Gate 2: the core renders the context but historically did not narrate it.
  // Cancel any lingering Body/Move command and read exactly the visible scenario.
  if(Number(st.phase)===1 && /Gate\s*2\s*•?\s*Understand/i.test(text)){
    const context=String(api.mission?.context||'').trim();
    if(context)speak(context,`gate2:${api.SET}:${context}`);
  }
}

const arena=$('arena');
if(arena)new MutationObserver(sync).observe(arena,{childList:true,subtree:true,characterData:true});
window.addEventListener('load',sync,{once:true});
sync();
console.info('[LEXICON Champion] Gate Audio V1 ready');
})();
