(()=>{'use strict';
const nativeRAF=window.requestAnimationFrame.bind(window);
const nativeSetTimeout=window.setTimeout.bind(window);
const nativeSetInterval=window.setInterval.bind(window);
const nativeClearInterval=window.clearInterval.bind(window);
const intervalWatchdogs=new Map();
const POSE_MIN_GAP_MS=125;
const RENDER_MIN_GAP_MS=32;
let lastPoseScheduleAt=0,lastRenderScheduleAt=0;
let posePaused=false,renderPaused=false;
let activeGameClockTick=null,activeGameClockId=null;
let guardWorker=null,guardStarted=false,forceAttempts=0;

function resultVisible(){const el=document.getElementById('result');return !!el&&!el.classList.contains('hidden')}
function gameVisible(){const el=document.getElementById('game');return !!el&&!el.classList.contains('hidden')}
function timeValue(){return Number(document.getElementById('time')?.textContent)}
function stopCameraLoad(){
  posePaused=true;
  const video=document.getElementById('video');
  try{video?.pause()}catch(_){ }
  try{video?.srcObject?.getTracks?.().forEach(track=>track.stop())}catch(_){ }
}
function showEmergencyFinish(){
  if(resultVisible()||document.getElementById('jumpduckEmergencyFinish'))return;
  const btn=document.createElement('button');
  btn.id='jumpduckEmergencyFinish';
  btn.type='button';
  btn.textContent='จบรอบและดูผล';
  Object.assign(btn.style,{position:'fixed',zIndex:'9999',left:'50%',bottom:'calc(18px + env(safe-area-inset-bottom))',transform:'translateX(-50%)',width:'min(88vw,420px)',minHeight:'58px',border:'0',borderRadius:'20px',background:'linear-gradient(90deg,#f59e0b,#f97316)',color:'#fff',font:'900 20px system-ui',boxShadow:'0 8px 0 #c2410c,0 12px 28px #0006'});
  btn.addEventListener('click',()=>forceFinish('student-emergency'));
  document.body.appendChild(btn);
}
function hideEmergencyFinish(){document.getElementById('jumpduckEmergencyFinish')?.remove()}
function forceFinish(reason='deadline'){
  if(resultVisible()){hideEmergencyFinish();return true}
  posePaused=true;renderPaused=true;stopCameraLoad();
  const timeEl=document.getElementById('time');
  if(typeof activeGameClockTick==='function'){
    for(let i=0;i<70&&!resultVisible();i++){
      const shown=Number(timeEl?.textContent);
      if(Number.isFinite(shown)&&shown<=0&&timeEl)timeEl.textContent='1';
      try{activeGameClockTick()}catch(e){console.warn('[JumpDuck force finish]',reason,e);break}
      const nowShown=Number(timeEl?.textContent);
      if(resultVisible()||Number.isFinite(nowShown)&&nowShown<=0)break;
    }
  }
  if(resultVisible()){hideEmergencyFinish();return true}
  forceAttempts++;
  if(forceAttempts>=2)showEmergencyFinish();
  nativeSetTimeout(()=>{
    if(!resultVisible()&&typeof activeGameClockTick==='function'){
      try{const el=document.getElementById('time');if(el)el.textContent='1';activeGameClockTick()}catch(_){ }
    }
    if(!resultVisible())showEmergencyFinish();
  },180);
  return resultVisible();
}

/* Throttle AI and renderer independently so low-end Android devices keep UI time available. */
window.requestAnimationFrame=function(callback){
  if(typeof callback==='function'&&callback.name==='poseLoop'){
    if(posePaused)return 0;
    const wait=Math.max(0,POSE_MIN_GAP_MS-(performance.now()-lastPoseScheduleAt));
    return nativeSetTimeout(()=>nativeRAF(timestamp=>{
      if(posePaused)return;
      lastPoseScheduleAt=performance.now();
      callback(timestamp);
    }),wait);
  }
  if(typeof callback==='function'&&callback.name==='loop'){
    if(renderPaused)return 0;
    const wait=Math.max(0,RENDER_MIN_GAP_MS-(performance.now()-lastRenderScheduleAt));
    return nativeSetTimeout(()=>nativeRAF(timestamp=>{
      if(renderPaused)return;
      lastRenderScheduleAt=performance.now();
      callback(timestamp);
    }),wait);
  }
  return nativeRAF(callback);
};

/* Do not send duplicated frames and stop inference before the hard deadline. */
const NativePose=window.Pose;
if(typeof NativePose==='function'){
  function StablePose(options){
    const instance=new NativePose(options);
    const nativeSend=instance.send.bind(instance);
    let inFlight=false,lastVideoTime=-1,lastSendAt=0;
    instance.send=async payload=>{
      if(posePaused||inFlight)return;
      const now=performance.now();
      const image=payload&&payload.image;
      const videoTime=Number(image&&image.currentTime);
      if(now-lastSendAt<110)return;
      if(Number.isFinite(videoTime)&&videoTime===lastVideoTime&&now-lastSendAt<700)return;
      inFlight=true;lastSendAt=now;
      if(Number.isFinite(videoTime))lastVideoTime=videoTime;
      try{return await nativeSend(payload)}finally{inFlight=false}
    };
    return instance;
  }
  StablePose.prototype=NativePose.prototype;
  try{Object.setPrototypeOf(StablePose,NativePose)}catch(_){ }
  window.Pose=StablePose;
}

/* Capture the original game clock so it can be advanced synchronously at the deadline. */
window.setInterval=function(callback,delay,...args){
  const source=typeof callback==='function'?String(callback):'';
  const isGameClock=Number(delay)===1000&&source.includes('timeLeft--')&&source.includes('finish()');
  if(!isGameClock)return nativeSetInterval(callback,delay,...args);
  const timeEl=document.getElementById('time');
  const resultEl=document.getElementById('result');
  const initial=Math.max(1,Number(timeEl?.textContent)||60);
  const startedAt=Date.now();
  let intervalId;
  const guarded=(...callArgs)=>{
    const shown=Number(timeEl?.textContent);
    if(resultEl&&!resultEl.classList.contains('hidden'))return;
    if(Number.isFinite(shown)&&shown<=0)return;
    return callback(...callArgs);
  };
  intervalId=nativeSetInterval(guarded,delay,...args);
  activeGameClockTick=guarded;activeGameClockId=intervalId;
  const watchdogId=nativeSetInterval(()=>{
    if(resultVisible()){
      nativeClearInterval(watchdogId);intervalWatchdogs.delete(intervalId);
      if(activeGameClockId===intervalId){activeGameClockTick=null;activeGameClockId=null}
      return;
    }
    const shown=Number(timeEl?.textContent);
    const elapsedMs=Date.now()-startedAt;
    const expectedTicks=Math.min(initial,Math.floor(Math.max(0,elapsedMs-300)/1000));
    const actualTicks=Math.max(0,initial-(Number.isFinite(shown)?shown:initial));
    if(expectedTicks>actualTicks)guarded();
    if(elapsedMs>=60100)forceFinish('interval-wall-clock');
  },200);
  intervalWatchdogs.set(intervalId,watchdogId);
  startWorkerGuard(initial*1000);
  return intervalId;
};
window.clearInterval=function(id){
  const watchdogId=intervalWatchdogs.get(id);
  if(watchdogId!==undefined){nativeClearInterval(watchdogId);intervalWatchdogs.delete(id)}
  if(activeGameClockId===id){activeGameClockTick=null;activeGameClockId=null}
  return nativeClearInterval(id);
};

function startWorkerGuard(durationMs=60000){
  if(guardStarted)return;guardStarted=true;
  const workerCode=`let s=0,t=null;onmessage=e=>{if(e.data&&e.data.type==='start'){s=Date.now();clearInterval(t);t=setInterval(()=>postMessage(Date.now()-s),200)}if(e.data&&e.data.type==='stop'){clearInterval(t);close()}}`;
  try{
    guardWorker=new Worker(URL.createObjectURL(new Blob([workerCode],{type:'text/javascript'})));
    guardWorker.onmessage=e=>{
      const elapsed=Number(e.data)||0;
      if(resultVisible()){guardWorker.postMessage({type:'stop'});hideEmergencyFinish();return}
      if(elapsed>=56000)posePaused=true;
      if(elapsed>=58500)stopCameraLoad();
      if(elapsed>=59200)renderPaused=true;
      if(elapsed>=durationMs+80)forceFinish('worker-deadline');
      if(elapsed>=durationMs+1200&&!resultVisible())showEmergencyFinish();
    };
    guardWorker.postMessage({type:'start'});
  }catch(e){
    console.warn('[JumpDuck worker unavailable]',e);
    nativeSetTimeout(()=>forceFinish('timeout-fallback'),durationMs+120);
  }
}

/* Watch for the visible 1-second state even when the browser delays normal timers. */
let oneSecondSeenAt=0;
nativeSetInterval(()=>{
  if(!gameVisible()||resultVisible()){oneSecondSeenAt=0;hideEmergencyFinish();return}
  const shown=timeValue();
  if(shown===1){
    if(!oneSecondSeenAt)oneSecondSeenAt=Date.now();
    if(Date.now()-oneSecondSeenAt>700)posePaused=true;
    if(Date.now()-oneSecondSeenAt>1200)forceFinish('one-second-stall');
  }else oneSecondSeenAt=0;
},180);

new MutationObserver(()=>{if(resultVisible()){renderPaused=true;posePaused=true;hideEmergencyFinish();try{guardWorker?.postMessage({type:'stop'})}catch(_){ }}}).observe(document.getElementById('result'),{attributes:true,attributeFilter:['class']});
})();
