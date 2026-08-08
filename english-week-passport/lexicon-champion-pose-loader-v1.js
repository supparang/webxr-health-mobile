(()=>{
'use strict';
const VERSION='20260808-LCA47-POSE-LAZY-LOADER-V5-CAMERA-GATE';
const SRC='https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';
let ready=Boolean(window.Pose),loading=null;

function nextPaint(){
  return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
}

function loadPose(){
  if(window.Pose){ready=true;return Promise.resolve(true)}
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-lca-pose-loader]');
    if(existing){
      const started=Date.now();
      const wait=()=>{
        if(window.Pose){ready=true;resolve(true);return}
        if(Date.now()-started>12000){reject(new Error('POSE_EXISTING_SCRIPT_TIMEOUT'));return}
        setTimeout(wait,100);
      };
      wait();
      return;
    }
    const s=document.createElement('script');
    s.src=SRC;
    s.async=true;
    s.crossOrigin='anonymous';
    s.dataset.lcaPoseLoader=VERSION;
    s.onload=()=>{ready=Boolean(window.Pose);ready?resolve(true):reject(new Error('POSE_GLOBAL_MISSING'))};
    s.onerror=()=>reject(new Error('POSE_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(s);
  }).catch(err=>{console.warn('[LCA Pose Loader]',err);loading=null;throw err});
  return loading;
}

// Mobile-safe rule: never compile MediaPipe from Start/Pointer events.
// Gate it at camera-open time, after the game screen has already changed.
const media=navigator.mediaDevices;
if(media&&typeof media.getUserMedia==='function'&&!media.__lcaPoseCameraGate){
  const original=media.getUserMedia.bind(media);
  try{
    media.getUserMedia=async function(constraints){
      const wantsVideo=Boolean(constraints&&constraints.video);
      if(wantsVideo&&!window.Pose){
        const status=document.getElementById('poseStatus');
        if(status)status.textContent='⏳ กำลังเตรียม Body Tracking…';
        // Guarantee at least one visible game paint before MediaPipe compilation.
        await nextPaint();
        try{await loadPose()}catch(error){console.warn('[LCA Pose Camera Gate]',error)}
      }
      return original(constraints);
    };
    Object.defineProperty(media,'__lcaPoseCameraGate',{value:true,configurable:true});
  }catch(error){
    console.warn('[LCA Pose Loader] cannot wrap getUserMedia',error);
  }
}

window.LEXICON_CHAMPION_POSE_LOADER=Object.freeze({
  version:VERSION,
  load:loadPose,
  isReady:()=>Boolean(window.Pose)
});
})();
