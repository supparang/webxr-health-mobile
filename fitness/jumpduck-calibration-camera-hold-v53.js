(()=>{'use strict';
if(window.__JUMPDUCK_CALIBRATION_CAMERA_HOLD_V53__)return;
window.__JUMPDUCK_CALIBRATION_CAMERA_HOLD_V53__=true;

const countdown=()=>document.getElementById('countdown');
const game=()=>document.getElementById('game');
const video=()=>document.getElementById('video');
const isCalibrating=()=>{
  const c=countdown(),g=game();
  return !!c&&!c.classList.contains('hidden')&&!!g&&g.classList.contains('hidden');
};

/* v5.0 calls releaseResources() when calibration has too few valid samples.
   On iOS/Android that immediately pauses the video and stops the camera track,
   leaving the calibration screen at 1 with a black preview. During calibration
   only, defer those destructive calls; normal result/page-exit cleanup is unchanged. */
const nativePause=HTMLMediaElement.prototype.pause;
HTMLMediaElement.prototype.pause=function(){
  if(this===video()&&isCalibrating())return;
  return nativePause.call(this);
};

const TrackProto=window.MediaStreamTrack&&window.MediaStreamTrack.prototype;
const nativeStop=TrackProto&&TrackProto.stop;
if(nativeStop){
  TrackProto.stop=function(){
    if(isCalibrating()&&video()?.srcObject?.getTracks?.().includes(this))return;
    return nativeStop.call(this);
  };
}

function showRecovery(){
  const c=countdown(),g=game(),v=video();
  if(!c||c.classList.contains('hidden')||!g?.classList.contains('hidden'))return;
  const count=document.getElementById('count');
  if(String(count?.textContent||'').trim()!=='1')return;

  const state=document.getElementById('jdCalibrationState');
  const retry=document.getElementById('jdCalibrationRetry');
  if(state){
    state.textContent='ยังเก็บตำแหน่งไหล่–สะโพกไม่ครบ แต่กล้องยังเปิดอยู่ กรุณาถอยให้เห็นถึงสะโพกแล้วกดลองใหม่';
    state.style.background='#fee2e2';state.style.color='#991b1b';
  }
  if(retry){
    retry.classList.add('show');
    retry.textContent='↻ ถอยให้เห็นสะโพก แล้วเริ่มตรวจใหม่';
  }
  if(v?.srcObject){
    v.muted=true;v.playsInline=true;
    v.play().catch(()=>{});
  }
}

const observer=new MutationObserver(()=>{
  if(isCalibrating()&&String(document.getElementById('count')?.textContent||'').trim()==='1'){
    setTimeout(showRecovery,2600);
  }
});
function boot(){
  const count=document.getElementById('count');
  if(count)observer.observe(count,{childList:true,characterData:true,subtree:true});
  const retry=document.getElementById('jdCalibrationRetry');
  if(retry){
    retry.addEventListener('click',()=>{
      const v=video();
      if(v?.srcObject){
        try{sessionStorage.setItem('JD_V53_REUSE_CAMERA','1')}catch(_){ }
      }
    },true);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
