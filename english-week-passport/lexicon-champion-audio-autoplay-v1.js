(()=>{
'use strict';
const RELEASE='20260809-LCA47-AUDIO-AUTOPLAY-V3-ALL-GATES';
let unlocked=false,lastText='',lastAt=0,retryTimer=0,lastScreenKey='';
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
  if(key&&lastScreenKey===key)return;
  if(key)lastScreenKey=key;
  clearTimeout(retryTimer);
  try{
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
function visibleContext(arena){
  const nodes=[...arena.querySelectorAll('.context')].filter(el=>{
    const s=getComputedStyle(el);return s.display!=='none'&&s.visibility!=='hidden';
  });
  return String(nodes.at(-1)?.textContent||'').trim();
}
function scheduleNarration(text,key,delay=90){
  if(!text||lastScreenKey===key)return;
  clearTimeout(retryTimer);
  retryTimer=setTimeout(()=>speakNow(text,key),delay);
}
function scanArena(){
  const api=window.LEXICON_CHAMPION_V47;
  const st=api?.state;
  const arena=$('arena');
  if(!api||!st||!arena)return;
  const phase=Number(st.phase||0),bossAttack=Number(st.bossAttack||0);
  const arenaText=String(arena.textContent||'');

  // Gate 1 and Final Boss Command: Body command is spoken by the core after
  // calibration/countdown. Only provide a fallback if the command stayed silent.
  const cmd=$('cmd');
  if(cmd){
    const t=String(cmd.textContent||'').trim();
    if(t&&t!=='เตรียมตัว')fallbackSpeak(t);
    return;
  }

  // Every non-body screen owns the audio context. When screen identity changes,
  // stale Body/previous-gate speech must not continue over the new task.
  if(phase===1){
    const second=/What\s+does/i.test(arenaText);
    const text=second?visibleContext(arena):String(api.mission?.context||'').trim();
    const key=`gate2:${second?'meaning':'context'}:${api.SET||''}:${text}`;
    scheduleNarration(text,key);
    return;
  }

  if(phase===2){
    const text=visibleContext(arena)||`Help the visitor with the ${api.mission?.place||'message'}.`;
    const key=`gate3:build:${api.SET||''}:${text}`;
    scheduleNarration(text,key);
    return;
  }

  if(phase===3){
    // Core already calls say(M.conversation). Do not duplicate it. We only make
    // this screen own the audio key so delayed narration from Gate 2/3 is cancelled.
    const text=String(api.mission?.conversation||visibleContext(arena)||'').trim();
    const key=`gate4:respond:${api.SET||''}:${text}`;
    if(lastScreenKey!==key){
      clearTimeout(retryTimer);
      lastScreenKey=key;
      // Do not cancel here: the core's say(M.conversation) is fired during render.
    }
    return;
  }

  if(phase>=4&&bossAttack===1){
    const text=String(api.mission?.bossPrompt||visibleContext(arena)||'').trim();
    const key=`boss:decision:${api.SET||''}:${text}`;
    scheduleNarration(text,key);
    return;
  }

  if(phase>=4&&bossAttack===2){
    // Core bossVoice() already calls say(M.bossAnswer). Own the key only; do not
    // duplicate the model sentence or interrupt SpeechRecognition preparation.
    const text=String(api.mission?.bossAnswer||visibleContext(arena)||'').trim();
    const key=`boss:voice:${api.SET||''}:${text}`;
    if(lastScreenKey!==key){clearTimeout(retryTimer);lastScreenKey=key}
    return;
  }
}
function watchArena(){
  const root=$('arena')||document.body;
  new MutationObserver(scanArena).observe(root,{childList:true,subtree:true,characterData:true});
  scanArena();
}
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
console.info('[LEXICON Champion] Audio Autoplay V3 all-gates narration ready');
})();