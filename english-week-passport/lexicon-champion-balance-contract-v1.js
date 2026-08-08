(()=>{
'use strict';
const RELEASE='20260808-LCA47-BALANCE-CONTRACT-V2-LIFECYCLE';
const V=()=>window.LEXICON_CHAMPION_V47;
const $=id=>document.getElementById(id);
const HOLD_REAL_MS=1600;
const CORE_HOLD_MS=800;
const SLOW_FACTOR=CORE_HOLD_MS/HOLD_REAL_MS;
let lastTs=performance.now(),lastCmd='',speaking=false,unlockTimer=0,gateEpoch=0,timer=0;
function preferredVoice(){try{const vs=speechSynthesis.getVoices?.()||[];return vs.find(v=>/^en-(US|GB)/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null}catch(_){return null}}
function speakBarrier(text){const st=V()?.state;if(!st||!text||!('speechSynthesis'in window))return;const epoch=++gateEpoch;speaking=true;st.commandAt=0;st.holdStart=0;const bar=$('holdBar');if(bar)bar.style.width='0%';const status=$('poseStatus');if(status)status.textContent='🎧 ฟังคำสั่งให้จบก่อน';try{speechSynthesis.cancel()}catch(_){}const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.82;u.pitch=1;const voice=preferredVoice();if(voice)u.voice=voice;const arm=()=>{if(epoch!==gateEpoch)return;speaking=false;if(status)status.textContent='🧍 เตรียมทำท่า…';clearTimeout(unlockTimer);unlockTimer=setTimeout(()=>{if(epoch!==gateEpoch)return;const s=V()?.state;if(!s)return;s.holdStart=0;s.commandAt=performance.now();if(status)status.textContent='🎯 ทำท่าตามคำสั่งและค้างไว้'},350)};u.onend=arm;u.onerror=()=>setTimeout(arm,120);try{speechSynthesis.speak(u)}catch(_){setTimeout(arm,250)}}
function watchCommand(){const cmd=$('cmd');if(!cmd)return;const text=String(cmd.textContent||'').trim();if(!text||text==='เตรียมตัว'||text===lastCmd)return;lastCmd=text;setTimeout(()=>speakBarrier(text),30)}
function slowHoldClock(ts){const st=V()?.state;const dt=Math.max(0,Math.min(100,ts-lastTs));lastTs=ts;if(!st)return;if(speaking){st.commandAt=0;st.holdStart=0;const b=$('holdBar');if(b)b.style.width='0%';return}if(st.commandAt&&st.holdStart){st.holdStart+=dt*(1-SLOW_FACTOR);const effective=Math.max(0,performance.now()-st.holdStart);const pct=Math.min(100,Math.round(effective/CORE_HOLD_MS*100));const status=$('poseStatus');if(status&&pct>0)status.textContent=`⏳ ค้างท่าให้มั่นคง ${pct}%`}}
function style(){if($('lcaBalanceContractStyle'))return;const s=document.createElement('style');s.id='lcaBalanceContractStyle';s.textContent='#holdBar{transition:width .12s linear!important}.poseStage[data-audio-barrier="1"] .ghost{opacity:.22!important}';document.head.appendChild(s)}
function activeBodyGate(){return !!$('poseStage') && !$('game')?.classList.contains('hidden')}
function poll(){clearTimeout(timer);if(document.hidden||!activeBodyGate()){lastTs=performance.now();timer=setTimeout(poll,300);return}try{style();watchCommand();slowHoldClock(performance.now());const stage=$('poseStage');if(stage)stage.dataset.audioBarrier=speaking?'1':'0'}catch(e){console.warn('[LCA Balance Contract]',e)}timer=setTimeout(poll,66)}
poll();addEventListener('pagehide',()=>{clearTimeout(timer);clearTimeout(unlockTimer);gateEpoch++},{once:true});
window.LEXICON_CHAMPION_BALANCE_CONTRACT=Object.freeze({release:RELEASE,holdMs:HOLD_REAL_MS,audioBarrier:true,stableHold:true});
})();