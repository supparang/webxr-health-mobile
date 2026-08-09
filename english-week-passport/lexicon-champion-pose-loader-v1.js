(()=>{
'use strict';
const VERSION='20260809-LCA47-POSE-LAZY-V6-UPPER-BODY-RELAX';
const SRC='https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/pose.js';
let ready=Boolean(window.Pose),loading=null,wrapped=false;

function nextPaint(){return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))}
function v(p){return Number(p?.visibility??p?.v??0)}
function softenKnees(res){
  const l=res?.poseLandmarks;
  if(!Array.isArray(l)||l.length<27)return res;
  const upperReady=v(l[0])>=.18&&v(l[11])>=.20&&v(l[12])>=.20&&v(l[23])>=.16&&v(l[24])>=.16;
  if(!upperReady)return res;
  [[25,23],[26,24]].forEach(([k,h])=>{
    if(v(l[k])>=.12)return;
    const hip=l[h]; if(!hip)return;
    const old=l[k]||{};
    l[k]={...old,x:Number.isFinite(old.x)?old.x:hip.x,y:Math.max(Number(old.y)||0,Math.min(.98,(Number(hip.y)||.62)+.24)),z:Number(old.z)||Number(hip.z)||0,visibility:.13};
  });
  return res;
}
function installRelaxedPose(){
  if(wrapped||!window.Pose||window.Pose.__lcaUpperBodyRelax)return;
  const Native=window.Pose;
  function RelaxedPose(...args){
    const inst=new Native(...args);
    if(inst&&typeof inst.onResults==='function'){
      const nativeOnResults=inst.onResults.bind(inst);
      inst.onResults=function(cb){return nativeOnResults(res=>cb(softenKnees(res)))};
    }
    return inst;
  }
  try{Object.setPrototypeOf(RelaxedPose,Native)}catch(_){}
  RelaxedPose.prototype=Native.prototype;
  Object.defineProperty(RelaxedPose,'__lcaUpperBodyRelax',{value:true});
  window.Pose=RelaxedPose;wrapped=true;
  console.info('[LCA Pose Loader] Upper-body relaxed knee contract active');
}
function poseReady(){if(window.Pose){installRelaxedPose();ready=true;return true}return false}
function loadPose(){
  if(poseReady())return Promise.resolve(true);
  if(loading)return loading;
  loading=new Promise((resolve,reject)=>{
    const existing=document.querySelector('script[data-lca-pose-loader]');
    if(existing){
      const started=Date.now();
      const wait=()=>{if(poseReady()){resolve(true);return}if(Date.now()-started>12000){reject(new Error('POSE_EXISTING_SCRIPT_TIMEOUT'));return}setTimeout(wait,100)};
      wait();return;
    }
    const s=document.createElement('script');s.src=SRC;s.async=true;s.crossOrigin='anonymous';s.dataset.lcaPoseLoader=VERSION;
    s.onload=()=>poseReady()?resolve(true):reject(new Error('POSE_GLOBAL_MISSING'));
    s.onerror=()=>reject(new Error('POSE_SCRIPT_LOAD_FAILED'));document.head.appendChild(s);
  }).catch(err=>{console.warn('[LCA Pose Loader]',err);loading=null;throw err});
  return loading;
}
const media=navigator.mediaDevices;
if(media&&typeof media.getUserMedia==='function'&&!media.__lcaPoseCameraGate){
  const original=media.getUserMedia.bind(media);
  try{
    media.getUserMedia=async function(constraints){
      const wantsVideo=Boolean(constraints&&constraints.video);
      if(wantsVideo&&!poseReady()){
        const status=document.getElementById('poseStatus');if(status)status.textContent='⏳ กำลังเตรียม Body Tracking…';
        await nextPaint();try{await loadPose()}catch(error){console.warn('[LCA Pose Camera Gate]',error)}
      }
      return original(constraints);
    };
    Object.defineProperty(media,'__lcaPoseCameraGate',{value:true,configurable:true});
  }catch(error){console.warn('[LCA Pose Loader] cannot wrap getUserMedia',error)}
}
window.LEXICON_CHAMPION_POSE_LOADER=Object.freeze({version:VERSION,load:loadPose,isReady:()=>poseReady(),upperBodyRelax:true});
})();
