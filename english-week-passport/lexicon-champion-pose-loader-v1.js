(()=>{
'use strict';
const VERSION='20260808-LCA47-POSE-LAZY-LOADER-V4-AFTER-CLICK';
const SRC='https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';
let ready=Boolean(window.Pose),loading=null;

function loadPose(){
  if(window.Pose){ready=true;return Promise.resolve(true)}
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-lca-pose-loader]');
    if(existing){
      let settled=false;
      const started=Date.now();
      const wait=()=>{
        if(settled)return;
        if(window.Pose){settled=true;ready=true;resolve(true);return}
        if(Date.now()-started>12000){settled=true;reject(new Error('POSE_EXISTING_SCRIPT_TIMEOUT'));return}
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

// Critical mobile rule:
// Never start MediaPipe on pointerdown/touchstart because compilation can block
// the main thread before the browser dispatches the button's click event.
// The button's own onclick runs at the target first; this document bubble listener
// warms Pose only AFTER Start/Retry/Listen has already received the click.
function afterClickWarm(event){
  const target=event.target?.closest?.('#start,#retry');
  if(!target||window.Pose)return;
  loadPose().catch(()=>{});
}
document.addEventListener('click',afterClickWarm,{capture:false,passive:true});

window.LEXICON_CHAMPION_POSE_LOADER=Object.freeze({
  version:VERSION,
  load:loadPose,
  isReady:()=>Boolean(window.Pose)
});
})();
