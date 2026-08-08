(()=>{
'use strict';
const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;
const q=new URLSearchParams(location.search);
const smoke=/^(1|true|yes)$/i.test(String(q.get('smoke')||q.get('smokeTest')||''));
if(!smoke)return;
if(window.BH_SMOKE_PERFORMANCE_V59)return;
const RELEASE='20260808-BALANCE-PC-SMOKE-PERFORMANCE-V59';
const s=BH.state,e=BH.el;

// PC smoke validates layout/flow/detection behavior; it does not need 720p/24fps inference.
const originalStartCamera=BH.startCamera;
BH.startCamera=async({restart=false}={})=>{
  if(restart)BH.stopCamera?.();
  if(s.stream)return true;
  if(!navigator.mediaDevices?.getUserMedia)return originalStartCamera?.({restart});
  try{
    s.stream=await navigator.mediaDevices.getUserMedia({
      video:{facingMode:'user',width:{ideal:640,max:640},height:{ideal:480,max:480},frameRate:{ideal:15,max:15,min:10}},
      audio:false
    });
    e.camera.srcObject=s.stream;
    await e.camera.play();
    BH.resizeCanvas?.();
    const settings=s.stream.getVideoTracks()[0]?.getSettings?.()||{};
    if(e.status)e.status.textContent=`📷 Smoke ${settings.width||640}×${settings.height||480}`;
    return true;
  }catch(err){
    console.warn('[Balance V59] low-res camera fallback',err);
    return originalStartCamera?.({restart});
  }
};

const originalInitPose=BH.initPose;
BH.initPose=()=>{
  const ok=originalInitPose?.();
  if(ok&&s.pose){
    try{s.pose.setOptions({modelComplexity:0,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.50,minTrackingConfidence:.50})}catch(_){}
  }
  return ok;
};

// Replace inference loop with a governed ~12fps loop. requestAnimationFrame still owns scheduling,
// but pose.send is not called more often than every 84ms.
BH.poseLoop=async()=>{
  if(s.looping)return;
  s.looping=true;
  const run=async()=>{
    if(!s.looping)return;
    const t=BH.now();
    if(e.camera.readyState>=2&&s.pose&&t-s.lastFrame>=84){
      s.lastFrame=t;
      try{await s.pose.send({image:e.camera})}catch(err){console.warn('[Balance V59] pose frame failed',err)}
    }
    requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};

const originalDrawPose=BH.drawPose;
let lastDraw=0;
BH.drawPose=lm=>{
  const now=BH.now();
  if(now-lastDraw<84)return;
  lastDraw=now;
  return originalDrawPose?.(lm);
};

document.documentElement.dataset.bhSmokePerformance='v59';
window.BH_SMOKE_PERFORMANCE_V59={release:RELEASE,inferenceIntervalMs:84,camera:'640x480@15',modelComplexity:0};
console.info('[BalanceHold] PC Smoke Performance V59 ready',window.BH_SMOKE_PERFORMANCE_V59);
})();