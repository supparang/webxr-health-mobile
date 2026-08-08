(()=>{
'use strict';
const VERSION='20260808-LCA47-POSE-LAZY-LOADER-V2-NONBLOCKING';
const SRC='https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';
let ready=Boolean(window.Pose),loading=null;

function loadPose(){
  if(window.Pose){ready=true;return Promise.resolve(true)}
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-lca-pose-loader]');
    if(existing){
      const wait=()=>window.Pose?(ready=true,resolve(true)):setTimeout(wait,80);
      wait();
      setTimeout(()=>{if(!window.Pose)reject(new Error('POSE_EXISTING_SCRIPT_TIMEOUT'))},12000);
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

// Warm MediaPipe only after first paint. This must NEVER intercept or block #start.
const warm=()=>{
  const run=()=>loadPose().catch(()=>{});
  if('requestIdleCallback' in window)requestIdleCallback(run,{timeout:1800});
  else setTimeout(run,650);
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warm,{once:true});else warm();

// Start button is intentionally non-blocking. Core gameplay receives the user's tap immediately.
// We only kick the loader in parallel so Body Gate has the best chance of being ready.
document.addEventListener('pointerdown',event=>{
  const btn=event.target?.closest?.('#start');
  if(btn&&!window.Pose)loadPose().catch(()=>{});
},{capture:true,passive:true});

window.LEXICON_CHAMPION_POSE_LOADER=Object.freeze({version:VERSION,load:loadPose,isReady:()=>Boolean(window.Pose)});
})();
