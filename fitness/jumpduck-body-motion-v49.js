(()=>{'use strict';
if(window.__JUMPDUCK_BODY_MOTION_V49__)return;
window.__JUMPDUCK_BODY_MOTION_V49__=true;

const W=96,H=72,PROCESS_GAP_MS=120;
let callback=null,lastAt=0,previous=null,centerX=.5,centerY=.5,confidence=.92;
const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
const ctx=canvas.getContext('2d',{alpha:false,desynchronized:true,willReadFrequently:true});

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function landmarks(){
  const dy=clamp((centerY-.5)*1.25,-.14,.14);
  const shoulderY=.38+dy*.88,hipY=.62+dy*.66,noseY=.22+dy;
  const span=.065;
  const lm=[];
  lm[0]={x:centerX,y:noseY,visibility:confidence};
  lm[11]={x:centerX-span,y:shoulderY,visibility:confidence};
  lm[12]={x:centerX+span,y:shoulderY,visibility:confidence};
  lm[23]={x:centerX-span*.72,y:hipY,visibility:confidence};
  lm[24]={x:centerX+span*.72,y:hipY,visibility:confidence};
  return lm;
}
function analyze(image){
  ctx.drawImage(image,0,0,W,H);
  const data=ctx.getImageData(0,0,W,H).data;
  const gray=new Uint8Array(W*H);
  for(let i=0,p=0;i<data.length;i+=4,p++)gray[p]=(data[i]*3+data[i+1]*6+data[i+2])*.1;
  if(previous){
    let sum=0,sx=0,sy=0,count=0;
    for(let y=5;y<H-5;y++){
      for(let x=5;x<W-5;x++){
        const p=y*W+x,d=Math.abs(gray[p]-previous[p]);
        if(d<16)continue;
        const weight=Math.min(42,d)-15;
        sum+=weight;sx+=x*weight;sy+=y*weight;count++;
      }
    }
    if(sum>520&&count>34){
      const mx=clamp(sx/sum/W,.08,.92),my=clamp(sy/sum/H,.14,.88);
      centerX=centerX*.64+mx*.36;
      centerY=centerY*.68+my*.32;
      confidence=clamp(.68+Math.min(.3,sum/7000),.68,.98);
    }else{
      confidence=Math.max(.78,confidence*.995);
      centerY=centerY*.985+.5*.015;
    }
  }
  previous=gray;
}

/* Replace the heavy MediaPipe Pose class with a lightweight continuous camera-motion detector.
   The existing JumpDuck core still receives Pose-like landmarks, so lane and jump/duck logic stay unchanged. */
class BodyMotionPose{
  constructor(){ }
  setOptions(){ }
  onResults(fn){callback=fn}
  async send(payload){
    const now=performance.now();
    if(now-lastAt<PROCESS_GAP_MS)return;
    lastAt=now;
    const image=payload&&payload.image;
    if(!image)return;
    try{analyze(image)}catch(e){console.warn('[JumpDuck v4.9 body motion]',e)}
    callback&&callback({poseLandmarks:landmarks(),bodyMotion:true});
  }
  close(){callback=null;previous=null}
}
window.Pose=BodyMotionPose;

/* Constrain the camera and renderer for predictable mobile performance. */
try{
  const media=navigator.mediaDevices;
  const nativeGet=media&&media.getUserMedia&&media.getUserMedia.bind(media);
  if(nativeGet)media.getUserMedia=constraints=>nativeGet({
    ...(constraints&&typeof constraints==='object'?constraints:{}),
    video:{facingMode:'user',width:{ideal:320,max:320},height:{ideal:240,max:240},frameRate:{ideal:12,max:15}},
    audio:false
  });
}catch(e){console.warn('[JumpDuck v4.9 camera]',e)}

const nativeRAF=window.requestAnimationFrame.bind(window),nativeTimeout=window.setTimeout.bind(window);
let lastFrame=0;
window.requestAnimationFrame=function(fn){
  if(typeof fn==='function'&&fn.name==='loop'){
    const wait=Math.max(0,40-(performance.now()-lastFrame));
    return nativeTimeout(()=>nativeRAF(ts=>{lastFrame=performance.now();fn(ts)}),wait);
  }
  return nativeRAF(fn);
};

function patchPayload(payload){
  if(!payload||typeof payload!=='object')return payload;
  payload.gameVersion='jumpduck-production-v4.9-continuous-body-motion';
  payload.inputMode='continuous-camera-body-motion';
  payload.bodyDetectionEngine='frame-difference-centroid-v1';
  payload.bodyDetectionContinuous=true;
  payload.touchFallbackVisible=false;
  payload.inferenceInput='96x72';
  payload.inferenceRateHz=Math.round(1000/PROCESS_GAP_MS);
  return payload;
}
const nativeSetItem=Storage.prototype.setItem;
Storage.prototype.setItem=function(key,value){
  if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{value=JSON.stringify(patchPayload(JSON.parse(String(value||'{}'))))}catch(_){ }
  }
  return nativeSetItem.call(this,key,value);
};
try{
  const nativePost=Window.prototype.postMessage;
  Window.prototype.postMessage=function(message,targetOrigin,transfer){
    if(message&&message.type==='HEROHEALTH_GAME_COMPLETE'&&message.payload)patchPayload(message.payload);
    return nativePost.call(this,message,targetOrigin,transfer);
  };
}catch(_){ }
})();
