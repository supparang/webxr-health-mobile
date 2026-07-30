(()=>{'use strict';
if(window.__JUMPDUCK_HYBRID_V48__)return;
window.__JUMPDUCK_HYBRID_V48__=true;

const MOBILE=matchMedia('(pointer:coarse)').matches||innerWidth<800;
if(!MOBILE)return;

const AI_ACTIVE_MS=12000;
const POSE_GAP_MS=520;
let gameStartedAt=0;
let aiPaused=false;
let pauseReason='';
let lastSendAt=0;
let inFlight=false;
let consecutiveSlow=0;

function $(id){return document.getElementById(id)}
function elapsed(){return gameStartedAt?Date.now()-gameStartedAt:0}
function setPoseText(text){const el=$('poseText');if(el)el.textContent=text}
function activateTouchMode(reason='scheduled'){
  if(aiPaused)return;
  aiPaused=true;
  pauseReason=reason;
  setPoseText('โหมดเสถียร ✅ • แตะ ซ้าย–กลาง–ขวา เพื่อขยับเป็ด');
  $('jdTouchControls')?.classList.add('show');
}

/* Use a low-resolution, low-frame-rate camera from the beginning. */
try{
  const media=navigator.mediaDevices;
  const nativeGet=media?.getUserMedia?.bind(media);
  if(nativeGet){
    media.getUserMedia=constraints=>nativeGet({
      ...(constraints&&typeof constraints==='object'?constraints:{}),
      video:{facingMode:'user',width:{ideal:320,max:320},height:{ideal:240,max:240},frameRate:{ideal:10,max:12}},
      audio:false
    });
  }
}catch(e){console.warn('[JumpDuck v4.8 camera]',e)}

/* Full-body Pose is used only during the opening movement sample. After 12 seconds,
   the game continues with deterministic touch lanes so MediaPipe cannot accumulate
   enough WASM/GPU pressure to freeze the Android tab. */
const NativePose=window.Pose;
if(typeof NativePose==='function'){
  function HybridPose(options){
    const instance=new NativePose(options);
    const nativeSend=instance.send.bind(instance);
    const input=document.createElement('canvas');
    input.width=192;input.height=144;
    const ictx=input.getContext('2d',{alpha:false,desynchronized:true});
    instance.send=async payload=>{
      if(aiPaused||inFlight)return;
      if(gameStartedAt&&elapsed()>=AI_ACTIVE_MS){activateTouchMode('scheduled-12s');return;}
      const now=performance.now();
      if(now-lastSendAt<POSE_GAP_MS)return;
      const image=payload?.image;
      if(!image)return;
      try{ictx.drawImage(image,0,0,input.width,input.height)}catch(_){return;}
      inFlight=true;lastSendAt=now;
      const started=performance.now();
      try{return await nativeSend({image:input})}
      catch(e){
        console.warn('[JumpDuck v4.8 pose]',e);
        consecutiveSlow++;
        if(consecutiveSlow>=2)activateTouchMode('pose-error');
      }finally{
        const latency=performance.now()-started;
        if(latency>850)consecutiveSlow++;else consecutiveSlow=Math.max(0,consecutiveSlow-1);
        if(consecutiveSlow>=3)activateTouchMode('pose-latency');
        inFlight=false;
      }
    };
    return instance;
  }
  HybridPose.prototype=NativePose.prototype;
  try{Object.setPrototypeOf(HybridPose,NativePose)}catch(_){ }
  window.Pose=HybridPose;
}

/* 22 FPS is sufficient for lane gameplay and protects the main thread. */
const nativeRAF=window.requestAnimationFrame.bind(window);
const nativeTimeout=window.setTimeout.bind(window);
let lastGameFrame=0;
window.requestAnimationFrame=function(callback){
  if(typeof callback==='function'&&callback.name==='loop'){
    const wait=Math.max(0,45-(performance.now()-lastGameFrame));
    return nativeTimeout(()=>nativeRAF(ts=>{lastGameFrame=performance.now();callback(ts)}),wait);
  }
  return nativeRAF(callback);
};

function addTouchControls(){
  if($('jdTouchControls'))return;
  const wrap=document.createElement('div');
  wrap.id='jdTouchControls';
  wrap.setAttribute('aria-label','ปุ่มช่วยขยับเป็ด');
  wrap.innerHTML='<button type="button" data-x="0.17">⬅️ ซ้าย</button><button type="button" data-x="0.50">กลาง</button><button type="button" data-x="0.83">ขวา ➡️</button>';
  const style=document.createElement('style');
  style.textContent=`#jdTouchControls{position:fixed;z-index:40;left:50%;bottom:calc(94px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,520px);display:grid;grid-template-columns:repeat(3,1fr);gap:7px;opacity:.28;transition:opacity .2s;pointer-events:auto}#jdTouchControls.show{opacity:.96}#jdTouchControls button{min-height:48px;border:2px solid #fff;border-radius:16px;background:#0f172dcc;color:#fff;font:900 15px system-ui;box-shadow:0 5px 14px #0005;touch-action:manipulation}#jdTouchControls button:active{transform:scale(.96);background:#047857}`;
  document.head.appendChild(style);
  document.body.appendChild(wrap);
  wrap.addEventListener('pointerdown',event=>{
    const button=event.target.closest('button[data-x]');
    if(!button)return;
    event.preventDefault();
    const world=$('world');
    if(!world)return;
    const x=innerWidth*Number(button.dataset.x||.5);
    world.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:innerHeight*.75,pointerType:'touch'}));
  });
}

function armGame(){
  if(gameStartedAt)return;
  gameStartedAt=Date.now();
  addTouchControls();
  setPoseText('AI กำลังช่วยจับตำแหน่งร่างกาย • แตะช่องช่วยได้');
  nativeTimeout(()=>activateTouchMode('scheduled-12s'),AI_ACTIVE_MS);
}
const game=$('game');
if(game)new MutationObserver(()=>{if(!game.classList.contains('hidden'))armGame()}).observe(game,{attributes:true,attributeFilter:['class']});

/* Preserve the hybrid-mode evidence in the official game payload. */
const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
      const payload=window.__JUMPDUCK_LAST_RESULT__||JSON.parse(String(value||'{}'));
      payload.gameVersion='jumpduck-production-v4.8-adaptive-hybrid';
      payload.inputMode=payload.touchLaneMoves>0?'body-touch-hybrid':'body-tracking-opening-sample';
      payload.aiActiveMs=Math.min(AI_ACTIVE_MS,Math.max(0,elapsed()));
      payload.aiFallbackActivated=aiPaused;
      payload.aiFallbackReason=pauseReason||'none';
      payload.poseInferencePolicy='192x144-max-2fps-first-12s';
      payload.mobileRenderPolicy='22fps';
      value=JSON.stringify(payload);
    }catch(_){ }
  }
  return nativeSetItem.call(this,key,value);
};
})();
