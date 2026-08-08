(()=>{
'use strict';
const VERSION='20260808-LCA47-POSE-LAZY-LOADER-V1';
const SRC='https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';
let ready=Boolean(window.Pose),loading=null,replay=false;

function loadPose(){
  if(window.Pose){ready=true;return Promise.resolve(true)}
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
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

// Start fetching only after the DOM has been parsed so first paint is never blocked by MediaPipe compilation.
const warm=()=>setTimeout(()=>loadPose().catch(()=>{}),120);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',warm,{once:true});else warm();

// If the player taps Start before Pose is ready, hold that click, finish loading, then replay once.
document.addEventListener('click',async event=>{
  const btn=event.target?.closest?.('#start');
  if(!btn||ready||window.Pose||replay)return;
  event.preventDefault();
  event.stopImmediatePropagation();
  replay=true;
  const original=btn.textContent;
  btn.disabled=true;
  btn.textContent='กำลังเตรียม Body Tracking…';
  try{
    await loadPose();
    btn.disabled=false;
    btn.textContent=original||'Start Final Challenge';
    setTimeout(()=>btn.click(),0);
  }catch(err){
    btn.disabled=false;
    btn.textContent='ลองเตรียม Body Tracking อีกครั้ง';
    console.error('[LCA Pose Loader] start blocked',err);
  }finally{
    setTimeout(()=>{replay=false},250);
  }
},true);

window.LEXICON_CHAMPION_POSE_LOADER=Object.freeze({version:VERSION,load:loadPose,isReady:()=>Boolean(window.Pose)});
})();
