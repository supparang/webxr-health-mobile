(()=>{
'use strict';
const q=new URLSearchParams(location.search);
const smoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''))&&String(q.get('balanceRoute')||'').startsWith('direct-smoke');
if(!smoke||window.BH_SMOKE_NATIVE_RUNTIME_RESET_V70)return;
const RELEASE='20260808-BALANCE-SMOKE-NATIVE-RUNTIME-RESET-V70';
const BH=window.BH;
if(!BH?.state||!BH?.el){console.error('[Balance V70] BH core unavailable');return}

function load(src,id){
  return new Promise((resolve,reject)=>{
    const old=document.getElementById(id);if(old)old.remove();
    const s=document.createElement('script');s.id=id;s.async=false;s.src=new URL(src,location.href).href;
    s.onload=()=>resolve(s);s.onerror=reject;(document.head||document.documentElement).appendChild(s);
  });
}
function killAudio(){
  try{speechSynthesis.cancel()}catch(_){}
  try{const ac=BH.beep?.ac;if(ac&&ac.state!=='closed')ac.close()}catch(_){}
  try{if(BH.beep)BH.beep.ac=null}catch(_){}
  document.querySelectorAll('audio').forEach(a=>{try{a.pause();a.currentTime=0}catch(_){}});
}

(async()=>{
  try{
    // Re-apply the canonical game + result modules after all legacy page patches.
    // These files own gameLoop, completePose, finish and renderSummary.
    await load('./bh-twin-game-v11.js?v=20260808-v70-native-reset','bh-v70-native-game');
    await load('./bh-twin-results-v11.js?v=20260808-v70-native-reset','bh-v70-native-results');
    // Guard the one legacy DOM assumption that previously crashed summary.
    const nativeFinish=BH.finish;
    BH.finish=reason=>{
      if(BH.el&&!BH.el.pauseBtn)BH.el.pauseBtn=document.getElementById('pauseBtn')||null;
      killAudio();
      return nativeFinish(reason);
    };
    addEventListener('pagehide',killAudio,{once:true});
    window.BH_SMOKE_NATIVE_RUNTIME_RESET_V70={release:RELEASE,ready:true};
    document.documentElement.dataset.bhSmokeNativeRuntime='v70';
    console.info('[BalanceHold] Smoke Native Runtime Reset V70 ready',RELEASE);
    dispatchEvent(new CustomEvent('bh-smoke-native-runtime-ready',{detail:{release:RELEASE}}));
  }catch(error){
    console.error('[Balance V70] native runtime reset failed',error);
  }
})();
})();
