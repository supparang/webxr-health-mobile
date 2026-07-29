(()=>{'use strict';
const nativeRAF=window.requestAnimationFrame.bind(window);
const nativeSetTimeout=window.setTimeout.bind(window);
const nativeSetInterval=window.setInterval.bind(window);
const nativeClearInterval=window.clearInterval.bind(window);
const intervalWatchdogs=new Map();
const POSE_MIN_GAP_MS=95;
let lastPoseScheduleAt=0;

/* Limit body-pose inference to about 10 FPS on mobile. The game renderer remains full-speed. */
window.requestAnimationFrame=function(callback){
  if(typeof callback==='function'&&callback.name==='poseLoop'){
    const wait=Math.max(0,POSE_MIN_GAP_MS-(performance.now()-lastPoseScheduleAt));
    return nativeSetTimeout(()=>nativeRAF(timestamp=>{
      lastPoseScheduleAt=performance.now();
      callback(timestamp);
    }),wait);
  }
  return nativeRAF(callback);
};

/* Do not send the same camera frame repeatedly to MediaPipe. */
const NativePose=window.Pose;
if(typeof NativePose==='function'){
  function StablePose(options){
    const instance=new NativePose(options);
    const nativeSend=instance.send.bind(instance);
    let inFlight=false,lastVideoTime=-1,lastSendAt=0;
    instance.send=async payload=>{
      if(inFlight)return;
      const now=performance.now();
      const image=payload&&payload.image;
      const videoTime=Number(image&&image.currentTime);
      if(now-lastSendAt<80)return;
      if(Number.isFinite(videoTime)&&videoTime===lastVideoTime&&now-lastSendAt<500)return;
      inFlight=true;
      lastSendAt=now;
      if(Number.isFinite(videoTime))lastVideoTime=videoTime;
      try{return await nativeSend(payload)}finally{inFlight=false}
    };
    return instance;
  }
  StablePose.prototype=NativePose.prototype;
  try{Object.setPrototypeOf(StablePose,NativePose)}catch(_){ }
  window.Pose=StablePose;
}

/*
 * The old timer depended only on setInterval. On slower Android devices,
 * MediaPipe can delay that interval and leave the screen stuck at 1 second.
 * This watchdog compares the visible countdown with elapsed wall-clock time,
 * then invokes the original timer callback once to close the round safely.
 */
window.setInterval=function(callback,delay,...args){
  const source=typeof callback==='function'?String(callback):'';
  const isGameClock=Number(delay)===1000&&source.includes('timeLeft--')&&source.includes('finish()');
  if(!isGameClock)return nativeSetInterval(callback,delay,...args);

  const timeEl=document.getElementById('time');
  const resultEl=document.getElementById('result');
  const initial=Math.max(1,Number(timeEl&&timeEl.textContent)||60);
  const startedAt=Date.now();
  let intervalId;
  const guarded=(...callArgs)=>{
    const shown=Number(timeEl&&timeEl.textContent);
    const resultVisible=resultEl&&!resultEl.classList.contains('hidden');
    if(resultVisible||Number.isFinite(shown)&&shown<=0)return;
    return callback(...callArgs);
  };
  intervalId=nativeSetInterval(guarded,delay,...args);
  const watchdogId=nativeSetInterval(()=>{
    const resultVisible=resultEl&&!resultEl.classList.contains('hidden');
    const shown=Number(timeEl&&timeEl.textContent);
    if(resultVisible||Number.isFinite(shown)&&shown<=0){
      nativeClearInterval(watchdogId);
      intervalWatchdogs.delete(intervalId);
      return;
    }
    const elapsedMs=Date.now()-startedAt;
    const expectedTicks=Math.min(initial,Math.floor(Math.max(0,elapsedMs-450)/1000));
    const actualTicks=Math.max(0,initial-(Number.isFinite(shown)?shown:initial));
    if(expectedTicks>actualTicks)guarded();
  },250);
  intervalWatchdogs.set(intervalId,watchdogId);
  return intervalId;
};

window.clearInterval=function(id){
  const watchdogId=intervalWatchdogs.get(id);
  if(watchdogId!==undefined){
    nativeClearInterval(watchdogId);
    intervalWatchdogs.delete(id);
  }
  return nativeClearInterval(id);
};

/* Final safety net: if the UI reaches 1 second and stalls, finish on wall-clock. */
let oneSecondSeenAt=0;
nativeSetInterval(()=>{
  const timeEl=document.getElementById('time');
  const resultEl=document.getElementById('result');
  const gameEl=document.getElementById('game');
  if(!timeEl||!resultEl||!gameEl||gameEl.classList.contains('hidden')||!resultEl.classList.contains('hidden')){
    oneSecondSeenAt=0;
    return;
  }
  const shown=Number(timeEl.textContent);
  if(shown===1){
    if(!oneSecondSeenAt)oneSecondSeenAt=Date.now();
    if(Date.now()-oneSecondSeenAt>1800){
      const timerCallbacks=[...intervalWatchdogs.keys()];
      if(timerCallbacks.length){
        timeEl.textContent='0';
        /* The protected interval will close the game on its next watchdog pass. */
      }
    }
  }else oneSecondSeenAt=0;
},300);
})();
