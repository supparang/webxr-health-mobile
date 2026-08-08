(()=>{
'use strict';
const RELEASE='20260808-LCA47-BALANCE-CONTRACT-V1';
const V=()=>window.LEXICON_CHAMPION_V47;
const $=id=>document.getElementById(id);
const HOLD_REAL_MS=1600;
const CORE_HOLD_MS=800;
const SLOW_FACTOR=CORE_HOLD_MS/HOLD_REAL_MS; // 0.5 => core 800ms becomes ~1600ms real time
let lastTs=performance.now();
let lastCmd='';
let speaking=false;
let unlockTimer=0;
let gateEpoch=0;

function preferredVoice(){
  try{
    const vs=speechSynthesis.getVoices?.()||[];
    return vs.find(v=>/^en-(US|GB)/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;
  }catch(_){return null}
}
function speakBarrier(text){
  const api=V(),st=api?.state;
  if(!st||!text||!('speechSynthesis' in window))return;
  const epoch=++gateEpoch;
  speaking=true;
  st.commandAt=0;
  st.holdStart=0;
  const bar=$('holdBar'); if(bar)bar.style.width='0%';
  const status=$('poseStatus'); if(status)status.textContent='🎧 ฟังคำสั่งให้จบก่อน';
  try{speechSynthesis.cancel()}catch(_){}
  const u=new SpeechSynthesisUtterance(text);
  u.lang='en-US';u.rate=.82;u.pitch=1;
  const voice=preferredVoice();if(voice)u.voice=voice;
  const arm=()=>{
    if(epoch!==gateEpoch)return;
    speaking=false;
    if(status)status.textContent='🧍 เตรียมทำท่า…';
    clearTimeout(unlockTimer);
    unlockTimer=setTimeout(()=>{
      if(epoch!==gateEpoch)return;
      const s=V()?.state;if(!s)return;
      s.holdStart=0;
      s.commandAt=performance.now();
      if(status)status.textContent='🎯 ทำท่าตามคำสั่งและค้างไว้';
    },350);
  };
  u.onend=arm;
  u.onerror=()=>setTimeout(arm,120);
  try{speechSynthesis.speak(u)}catch(_){setTimeout(arm,250)}
}

function watchCommand(){
  const cmd=$('cmd');
  if(!cmd)return;
  const text=String(cmd.textContent||'').trim();
  if(!text||text==='เตรียมตัว'||text===lastCmd)return;
  lastCmd=text;
  // Core sets commandAt before/while speaking. Force an audio barrier so pose detection cannot start early.
  setTimeout(()=>speakBarrier(text),30);
}

function slowHoldClock(ts){
  const st=V()?.state;
  const dt=Math.max(0,Math.min(80,ts-lastTs));lastTs=ts;
  if(!st)return;
  if(speaking){st.commandAt=0;st.holdStart=0;const b=$('holdBar');if(b)b.style.width='0%';return}
  if(st.commandAt&&st.holdStart){
    // Core completes at 800 ms. Move holdStart forward each frame so effective elapsed advances at 50% speed.
    st.holdStart += dt*(1-SLOW_FACTOR);
    const effective=Math.max(0,performance.now()-st.holdStart);
    const pct=Math.min(100,Math.round(effective/HOLD_REAL_MS*100/SLOW_FACTOR));
    const status=$('poseStatus');
    if(status&&pct>0)status.textContent=`⏳ ค้างท่าให้มั่นคง ${Math.min(100,Math.round(effective/CORE_HOLD_MS*100))}%`;
  }
}

function style(){
  if($('lcaBalanceContractStyle'))return;
  const s=document.createElement('style');s.id='lcaBalanceContractStyle';s.textContent=`
    #holdBar{transition:width .12s linear!important}
    .poseStage[data-audio-barrier="1"] .ghost{opacity:.22!important}
  `;document.head.appendChild(s);
}

function loop(ts){
  try{style();watchCommand();slowHoldClock(ts);const stage=$('poseStage');if(stage)stage.dataset.audioBarrier=speaking?'1':'0'}catch(e){console.warn('[LCA Balance Contract]',e)}
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.LEXICON_CHAMPION_BALANCE_CONTRACT=Object.freeze({release:RELEASE,holdMs:HOLD_REAL_MS,audioBarrier:true,stableHold:true});
})();