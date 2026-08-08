(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const q=new URLSearchParams(location.search);const smoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''));if(!smoke)return;
if(window.BH_SMOKE_PERFORMANCE_V59)return;
const RELEASE='20260808-BALANCE-PC-SMOKE-PERFORMANCE-V63-5FPS';
const s=BH.state,e=BH.el;
const originalStartCamera=BH.startCamera;
BH.startCamera=async({restart=false}={})=>{
  if(restart)BH.stopCamera?.();if(s.stream)return true;
  if(!navigator.mediaDevices?.getUserMedia)return originalStartCamera?.({restart});
  try{
    s.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:480,max:640},height:{ideal:360,max:480},frameRate:{ideal:12,max:15,min:8}},audio:false});
    e.camera.srcObject=s.stream;await e.camera.play();BH.resizeCanvas?.();const settings=s.stream.getVideoTracks()[0]?.getSettings?.()||{};
    if(e.status)e.status.textContent=`📷 Smoke ${settings.width||480}×${settings.height||360}`;return true;
  }catch(err){console.warn('[Balance V63] low-res camera fallback',err);return originalStartCamera?.({restart})}
};
const originalInitPose=BH.initPose;
BH.initPose=()=>{const ok=originalInitPose?.();if(ok&&s.pose){try{s.pose.setOptions({modelComplexity:0,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.46,minTrackingConfidence:.46})}catch(_){}}return ok};
let poseBusy=false,lastPoseAt=0;
BH.poseLoop=async()=>{
  if(s.looping)return;s.looping=true;
  const run=async timestamp=>{
    if(!s.looping)return;
    if(e.camera.readyState>=2&&s.pose&&!poseBusy&&timestamp-lastPoseAt>=200){
      lastPoseAt=timestamp;poseBusy=true;
      try{await s.pose.send({image:e.camera})}catch(err){console.warn('[Balance V63] pose frame skipped',err)}finally{poseBusy=false}
    }
    if(s.looping)requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};
const originalDrawPose=BH.drawPose;let lastDraw=0;
BH.drawPose=lm=>{const now=BH.now();if(now-lastDraw<200)return;lastDraw=now;return originalDrawPose?.(lm)};
document.documentElement.dataset.bhSmokePerformance='v63-5fps';
window.BH_SMOKE_PERFORMANCE_V59={release:RELEASE,inferenceIntervalMs:200,camera:'480x360@12',modelComplexity:0};
console.info('[BalanceHold] PC Smoke Performance ready',window.BH_SMOKE_PERFORMANCE_V59);
})();