(()=>{'use strict';
if(window.__JUMPDUCK_MOBILE_LITE_V47__)return;
window.__JUMPDUCK_MOBILE_LITE_V47__=true;

const MOBILE=matchMedia('(pointer:coarse)').matches||innerWidth<800;
if(!MOBILE)return;

/* Keep the camera stream intentionally small. The preview remains clear enough
   for alignment, while MediaPipe no longer receives a 640x480 frame 8–10 times/s. */
try{
  const media=navigator.mediaDevices;
  const nativeGet=media?.getUserMedia?.bind(media);
  if(nativeGet){
    media.getUserMedia=constraints=>{
      const requested=constraints&&typeof constraints==='object'?constraints:{};
      const video=requested.video===false?false:{
        facingMode:'user',
        width:{ideal:320,max:320},
        height:{ideal:240,max:240},
        frameRate:{ideal:12,max:15}
      };
      return nativeGet({...requested,video,audio:false});
    };
  }
}catch(e){console.warn('[JumpDuck v4.7 camera patch]',e)}

/* Downscale every inference frame to 256x192 and cap inference at about 4 FPS.
   This is the main stability change for Samsung/Android Chrome. */
const NativePose=window.Pose;
if(typeof NativePose==='function'){
  function LitePose(options){
    const instance=new NativePose(options);
    const nativeSend=instance.send.bind(instance);
    const input=document.createElement('canvas');
    input.width=256;input.height=192;
    const ictx=input.getContext('2d',{alpha:false,desynchronized:true});
    let inFlight=false,lastSendAt=0,lastVideoTime=-1;
    instance.send=async payload=>{
      const now=performance.now();
      if(inFlight||now-lastSendAt<240)return;
      const image=payload?.image;
      if(!image)return;
      const videoTime=Number(image.currentTime);
      if(Number.isFinite(videoTime)&&videoTime===lastVideoTime&&now-lastSendAt<900)return;
      try{
        ictx.drawImage(image,0,0,input.width,input.height);
      }catch(_){return;}
      inFlight=true;lastSendAt=now;
      if(Number.isFinite(videoTime))lastVideoTime=videoTime;
      try{return await nativeSend({image:input})}
      catch(e){console.warn('[JumpDuck v4.7 pose send]',e)}
      finally{inFlight=false}
    };
    return instance;
  }
  LitePose.prototype=NativePose.prototype;
  try{Object.setPrototypeOf(LitePose,NativePose)}catch(_){ }
  window.Pose=LitePose;
}

/* The game does not need a 60 FPS canvas on a classroom phone. 25 FPS is smooth
   for lane movement and leaves enough main-thread time for the clock and result UI. */
const nativeRAF=window.requestAnimationFrame.bind(window);
const nativeTimeout=window.setTimeout.bind(window);
let lastGameFrame=0;
window.requestAnimationFrame=function(callback){
  if(typeof callback==='function'&&callback.name==='loop'){
    const wait=Math.max(0,40-(performance.now()-lastGameFrame));
    return nativeTimeout(()=>nativeRAF(ts=>{lastGameFrame=performance.now();callback(ts)}),wait);
  }
  return nativeRAF(callback);
};
})();
