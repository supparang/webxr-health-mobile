(()=>{'use strict';
const nativeRAF=window.requestAnimationFrame.bind(window);
const nativeSetTimeout=window.setTimeout.bind(window);
const nativeSetInterval=window.setInterval.bind(window);
const nativeClearInterval=window.clearInterval.bind(window);
const POSE_MIN_GAP_MS=145;
const RENDER_MIN_GAP_MS=34;
let lastPoseAt=0,lastRenderAt=0;
let poseStopped=false,renderStopped=false;
let gameStartedAt=0;
let rawClockTick=null;
let clockIntervalId=null;
let forceRunning=false;

function $(id){return document.getElementById(id)}
function resultVisible(){const el=$('result');return !!el&&!el.classList.contains('hidden')}
function gameVisible(){const el=$('game');return !!el&&!el.classList.contains('hidden')}
function elapsedMs(){return gameStartedAt?Date.now()-gameStartedAt:0}
function stopPose(){
  if(poseStopped)return;
  poseStopped=true;
  const video=$('video');
  try{video?.pause()}catch(_){ }
  try{video?.srcObject?.getTracks?.().forEach(track=>track.stop())}catch(_){ }
}
function showVersion(){
  if($('jdRuntimeBadge'))return;
  const el=document.createElement('div');
  el.id='jdRuntimeBadge';
  el.textContent='JD v4.2';
  Object.assign(el.style,{position:'fixed',zIndex:'9998',right:'8px',top:'calc(8px + env(safe-area-inset-top))',padding:'5px 9px',borderRadius:'999px',background:'#0f172dcc',color:'#fff',font:'800 11px system-ui',pointerEvents:'none'});
  document.body.appendChild(el);
}
function showFinishButton(){
  let btn=$('jumpduckHardFinish');
  if(btn)return btn;
  btn=document.createElement('button');
  btn.id='jumpduckHardFinish';
  btn.type='button';
  btn.textContent='จบรอบและดูผล';
  Object.assign(btn.style,{position:'fixed',zIndex:'9999',left:'50%',bottom:'calc(18px + env(safe-area-inset-bottom))',transform:'translateX(-50%)',width:'min(88vw,420px)',minHeight:'60px',border:'0',borderRadius:'20px',background:'linear-gradient(90deg,#f59e0b,#f97316)',color:'#fff',font:'900 20px system-ui',boxShadow:'0 8px 0 #c2410c,0 12px 30px #0007'});
  btn.addEventListener('click',()=>hardFinish('manual'));
  document.body.appendChild(btn);
  return btn;
}
function hideFinishButton(){$('jumpduckHardFinish')?.remove()}
function hardFinish(reason='deadline'){
  if(forceRunning||resultVisible())return;
  forceRunning=true;
  stopPose();renderStopped=true;
  const timeEl=$('time');
  try{
    if(typeof rawClockTick==='function'){
      for(let i=0;i<70&&!resultVisible();i++)rawClockTick();
    }
  }catch(e){console.warn('[JumpDuck hard finish]',reason,e)}
  if(!resultVisible())showFinishButton();
  else hideFinishButton();
  forceRunning=false;
}
function deadlineCheck(){
  if(!gameVisible()||resultVisible())return;
  const shown=Number($('time')?.textContent);
  const elapsed=elapsedMs();
  if((Number.isFinite(shown)&&shown<=5)||elapsed>=55000)stopPose();
  if((Number.isFinite(shown)&&shown<=2)||elapsed>=58500)hardFinish('visible-or-wall-clock');
  if(elapsed>=57000)showFinishButton();
}

/* Directly check the wall clock inside every available game frame. */
window.requestAnimationFrame=function(callback){
  if(typeof callback==='function'&&callback.name==='poseLoop'){
    if(poseStopped)return 0;
    const wait=Math.max(0,POSE_MIN_GAP_MS-(performance.now()-lastPoseAt));
    return nativeSetTimeout(()=>nativeRAF(ts=>{
      if(poseStopped)return;
      lastPoseAt=performance.now();
      deadlineCheck();
      callback(ts);
    }),wait);
  }
  if(typeof callback==='function'&&callback.name==='loop'){
    if(renderStopped)return 0;
    const wait=Math.max(0,RENDER_MIN_GAP_MS-(performance.now()-lastRenderAt));
    return nativeSetTimeout(()=>nativeRAF(ts=>{
      if(renderStopped)return;
      lastRenderAt=performance.now();
      deadlineCheck();
      callback(ts);
      deadlineCheck();
    }),wait);
  }
  return nativeRAF(callback);
};

/* Capture the real closure callback, not a guarded wrapper. */
window.setInterval=function(callback,delay,...args){
  const source=typeof callback==='function'?String(callback):'';
  const isGameClock=Number(delay)===1000&&source.includes('timeLeft--')&&source.includes('finish()');
  if(!isGameClock)return nativeSetInterval(callback,delay,...args);
  rawClockTick=callback;
  clockIntervalId=nativeSetInterval(()=>{
    deadlineCheck();
    if(!resultVisible())callback();
    deadlineCheck();
  },delay,...args);
  return clockIntervalId;
};
window.clearInterval=function(id){
  if(id===clockIntervalId){clockIntervalId=null;rawClockTick=null}
  return nativeClearInterval(id);
};

/* Reduce inference duplication. */
const NativePose=window.Pose;
if(typeof NativePose==='function'){
  function StablePose(options){
    const instance=new NativePose(options);
    const send=instance.send.bind(instance);
    let inFlight=false,lastVideoTime=-1,lastSendAt=0;
    instance.send=async payload=>{
      if(poseStopped||inFlight)return;
      const now=performance.now();
      const image=payload?.image;
      const videoTime=Number(image?.currentTime);
      if(now-lastSendAt<130)return;
      if(Number.isFinite(videoTime)&&videoTime===lastVideoTime&&now-lastSendAt<900)return;
      inFlight=true;lastSendAt=now;
      if(Number.isFinite(videoTime))lastVideoTime=videoTime;
      try{return await send(payload)}finally{inFlight=false}
    };
    return instance;
  }
  StablePose.prototype=NativePose.prototype;
  try{Object.setPrototypeOf(StablePose,NativePose)}catch(_){ }
  window.Pose=StablePose;
}

function arm(){
  if(gameStartedAt)return;
  gameStartedAt=Date.now();
  showVersion();
  nativeSetTimeout(()=>{if(gameVisible()&&!resultVisible())showFinishButton()},57000);
  nativeSetTimeout(()=>{if(gameVisible()&&!resultVisible())hardFinish('timeout-59s')},59000);
}
const gameEl=$('game');
if(gameEl)new MutationObserver(()=>{
  if(!gameEl.classList.contains('hidden'))arm();
}).observe(gameEl,{attributes:true,attributeFilter:['class']});
const resultEl=$('result');
if(resultEl)new MutationObserver(()=>{
  if(resultVisible()){stopPose();renderStopped=true;hideFinishButton()}
}).observe(resultEl,{attributes:true,attributeFilter:['class']});

nativeSetInterval(deadlineCheck,120);
showVersion();
})();
