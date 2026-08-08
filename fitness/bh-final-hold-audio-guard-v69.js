(()=>{
'use strict';
const BH=window.BH;
if(!BH?.state||!BH?.el||typeof BH.completePose!=='function'||typeof BH.updateGameUI!=='function')return;
if(window.BH_FINAL_HOLD_AUDIO_GUARD_V69)return;
const s=BH.state,e=BH.el;
const RELEASE='20260808-BALANCE-FINAL-HOLD-AUDIO-GUARD-V69';
let bossLatchedAt=0,bossLatchedIndex=-1,finishing=false;
const GRACE_MS=700;
const LATCH_PCT=.90;

function cfg(){return BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.easy||BH.CONFIG?.normal||{}}
function requiredMs(){
  const c=cfg();
  const assist=1-(Number(s.assistLevel)||0)*.075;
  return Math.max(1,((Number(c.hold)||1600)+(String(s.currentKey||'')==='boss'?450:0))*assist);
}
function stopAudio(){
  try{
    const ac=BH.beep?.ac;
    if(ac&&ac.state!=='closed')ac.close().catch(()=>{});
    if(BH.beep)BH.beep.ac=null;
  }catch(_){}
  try{
    document.querySelectorAll('audio,video').forEach(m=>{try{m.pause();m.currentTime=0}catch(_){}});
  }catch(_){}
  try{
    if(window.speechSynthesis)window.speechSynthesis.cancel();
  }catch(_){}
  document.documentElement.dataset.bhAudio='stopped-v69';
}

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  const result=baseUpdate(ev,p);
  if(String(s.phase||'')!=='play'||String(s.currentKey||'')!=='boss'||finishing)return result;
  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  const done=Array.isArray(s.results)?s.results.length:0;
  const index=Number(s.index||0);
  if(total!==6||index!==5||done!==5)return result;
  const pct=Math.max(Number(p)||0,(Number(s.holdMs)||0)/requiredMs());
  const now=BH.now?.()||performance.now();
  if(ev?.valid===true&&pct>=LATCH_PCT){bossLatchedAt=now;bossLatchedIndex=index}
  const latched=bossLatchedIndex===index&&bossLatchedAt>0&&(now-bossLatchedAt)<=GRACE_MS;
  if(pct>=.93&&(ev?.valid===true||latched)){
    finishing=true;
    const req=requiredMs();
    s.holdMs=Math.max(Number(s.holdMs)||0,req);
    try{
      BH.completePose(ev||{},req);
      document.documentElement.dataset.bhFinalHold='boss-completed-v69';
    }catch(err){
      finishing=false;
      console.error('[Balance V69] final hold completion failed',err);
    }
  }
  return result;
};

const baseSetPoseUI=BH.setPoseUI;
if(typeof baseSetPoseUI==='function')BH.setPoseUI=()=>{bossLatchedAt=0;bossLatchedIndex=-1;finishing=false;return baseSetPoseUI()};
const baseReset=BH.resetRoundState;
if(typeof baseReset==='function')BH.resetRoundState=()=>{bossLatchedAt=0;bossLatchedIndex=-1;finishing=false;stopAudio();return baseReset()};
const baseFinish=BH.finish;
if(typeof baseFinish==='function')BH.finish=reason=>{stopAudio();return baseFinish(reason)};
addEventListener('pagehide',stopAudio);
addEventListener('beforeunload',stopAudio);

window.BH_FINAL_HOLD_AUDIO_GUARD_V69={release:RELEASE,graceMs:GRACE_MS,latchPct:LATCH_PCT,stopAudio};
document.documentElement.dataset.bhFinalHoldAudioGuard='v69';
console.info('[BalanceHold] Final Hold + Audio Guard V69 ready',window.BH_FINAL_HOLD_AUDIO_GUARD_V69);
})();
