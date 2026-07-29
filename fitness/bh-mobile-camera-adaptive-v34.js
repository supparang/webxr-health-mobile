(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260729-BALANCE-MOBILE-CAMERA-ADAPTIVE-V34';
const s=BH.state;
const e=BH.el;
const C=BH.clamp;
const q=new URLSearchParams(location.search);
const adaptive=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth'||matchMedia('(max-width:760px)').matches;
if(!adaptive)return;

function vis(p){return Number(p?.v||0)}
function clonePoint(p){return{x:Number(p?.x||0),y:Number(p?.y||0),z:Number(p?.z||0),v:Number(p?.v||0)}}
function midpoint(a,b){return{x:(a.x+b.x)/2,y:(a.y+b.y)/2}}

function lowerLegLength(lm,side){
  const hip=lm[side==='left'?23:24];
  const knee=lm[side==='left'?25:26];
  if(!hip||!knee)return .16;
  return C(BH.dist(hip,knee)*.92,.10,.24);
}

function adaptiveLandmarks(lm){
  if(!Array.isArray(lm))return lm;
  const out=lm.map(clonePoint);
  const leftKnee=out[25],rightKnee=out[26];

  if(vis(out[27])<.28&&vis(leftKnee)>.25){
    out[27]={
      x:C(leftKnee.x-.012,0.02,.98),
      y:C(leftKnee.y+lowerLegLength(out,'left'),0.05,.985),
      z:leftKnee.z,
      v:C(vis(leftKnee)*.82,.36,.70)
    };
  }

  if(vis(out[28])<.28&&vis(rightKnee)>.25){
    out[28]={
      x:C(rightKnee.x+.012,0.02,.98),
      y:C(rightKnee.y+lowerLegLength(out,'right'),0.05,.985),
      z:rightKnee.z,
      v:C(vis(rightKnee)*.82,.36,.70)
    };
  }

  return out;
}

function injectStyle(){
  if(document.getElementById('bhMobileCameraAdaptiveV34Style'))return;
  const style=document.createElement('style');
  style.id='bhMobileCameraAdaptiveV34Style';
  style.textContent=`
    body.bh-calibration-visible #bhCameraGuideV15:before{
      content:'ให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง • ไม่ต้องเห็นข้อเท้า'!important;
    }
    body.bh-calibration-visible #bhCameraGuideV15{
      bottom:calc(206px + env(safe-area-inset-bottom,0px))!important;
    }
    @media(max-height:700px){
      body.bh-calibration-visible #bhCameraGuideV15{
        bottom:calc(158px + env(safe-area-inset-bottom,0px))!important;
      }
    }
  `;
  document.head.appendChild(style);
}

async function openWideFrontCamera(){
  const attempts=[
    {
      video:{
        facingMode:{ideal:'user'},
        width:{ideal:640},
        height:{ideal:480},
        aspectRatio:{ideal:4/3},
        frameRate:{ideal:24,min:15}
      },
      audio:false
    },
    {
      video:{
        facingMode:{ideal:'user'},
        width:{ideal:960},
        height:{ideal:720},
        aspectRatio:{ideal:4/3},
        frameRate:{ideal:24,min:15}
      },
      audio:false
    },
    {video:{facingMode:{ideal:'user'},frameRate:{ideal:24,min:15}},audio:false},
    {video:true,audio:false}
  ];

  let lastError=null;
  for(const constraints of attempts){
    try{
      return await navigator.mediaDevices.getUserMedia(constraints);
    }catch(error){
      lastError=error;
      console.warn('[BalanceHold v34] camera attempt failed',constraints,error);
    }
  }
  throw lastError||new Error('camera_unavailable');
}

BH.startCamera=async({restart=false}={})=>{
  if(restart)BH.stopCamera();
  if(s.stream)return true;
  if(!navigator.mediaDevices?.getUserMedia){
    e.status.textContent='❌ Camera API unavailable';
    BH.toast('เบราว์เซอร์นี้ไม่รองรับกล้อง กรุณาใช้ Chrome ผ่าน HTTPS');
    return false;
  }

  try{
    s.stream=await openWideFrontCamera();
    e.camera.srcObject=s.stream;
    await e.camera.play();

    const track=s.stream.getVideoTracks()[0];
    const caps=track?.getCapabilities?.()||{};
    if(caps.zoom&&Number.isFinite(caps.zoom.min)){
      try{await track.applyConstraints({advanced:[{zoom:caps.zoom.min}]})}catch(_){}
    }

    BH.resizeCanvas();
    const settings=track?.getSettings?.()||{};
    s.cameraProfile='front-wide-4x3-adaptive-knee';
    s.cameraSettings={
      width:settings.width||0,
      height:settings.height||0,
      aspectRatio:settings.aspectRatio||0,
      facingMode:settings.facingMode||'user',
      resizeMode:settings.resizeMode||''
    };
    e.status.textContent=`📷 Wide ${settings.width||''}×${settings.height||''}`.trim();
    return true;
  }catch(error){
    console.warn('[BalanceHold v34] camera failed',error);
    e.status.textContent='⚠️ Camera blocked';
    BH.toast('เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์กล้องและลองใหม่');
    return false;
  }
};

BH.keyConfidence=lm=>{
  const indices=[0,11,12,15,16,23,24,25,26];
  return indices.reduce((sum,index)=>sum+vis(lm?.[index]),0)/indices.length;
};

BH.calibrationQuality=lm=>{
  const conf=BH.keyConfidence(lm);
  const shoulderWidth=BH.dist(lm[11],lm[12]);
  const arms=(BH.dist(lm[11],lm[15])+BH.dist(lm[12],lm[16]))/(Math.max(.01,shoulderWidth)*2);
  const armsLevel=(Math.abs(lm[15].y-lm[11].y)+Math.abs(lm[16].y-lm[12].y))/2;
  const kneeConfidence=(vis(lm[25])+vis(lm[26]))/2;
  const hipConfidence=(vis(lm[23])+vis(lm[24]))/2;
  const required=[0,11,12,15,16,23,24,25,26];
  const bounds={
    left:Math.min(...required.map(index=>lm[index].x)),
    right:Math.max(...required.map(index=>lm[index].x)),
    top:lm[0].y,
    bottom:Math.max(lm[25].y,lm[26].y)
  };
  const inFrame=bounds.left>.01&&bounds.right<.99&&bounds.top>.005&&bounds.bottom<.995;
  const bodyOk=conf>.40&&hipConfidence>.30&&kneeConfidence>.27&&shoulderWidth>.050&&inFrame;
  const armsOk=arms>.76&&armsLevel<.20;
  const center=BH.mid(lm[23],lm[24]);

  s.calHistory.push({x:center.x,y:center.y,t:BH.now()});
  if(s.calHistory.length>22)s.calHistory.shift();

  let jitter=1;
  if(s.calHistory.length>=8){
    const mean=s.calHistory.reduce((acc,p)=>({x:acc.x+p.x,y:acc.y+p.y}),{x:0,y:0});
    mean.x/=s.calHistory.length;
    mean.y/=s.calHistory.length;
    jitter=Math.sqrt(s.calHistory.reduce((total,p)=>total+(p.x-mean.x)**2+(p.y-mean.y)**2,0)/s.calHistory.length);
  }

  return{
    bodyOk,
    armsOk,
    stable:jitter<.012,
    center,
    sh:shoulderWidth,
    conf,
    jitter,
    bounds,
    kneeConfidence,
    ankleObserved:vis(lm[27])>.30&&vis(lm[28])>.30
  };
};

BH.updateCalibration=lm=>{
  const quality=BH.calibrationQuality(lm);
  const cfg=BH.CONFIG[e.difficulty.value]||BH.CONFIG.easy;
  const time=BH.now();
  const delta=Math.min(100,time-(s.calLast||time));
  s.calLast=time;

  e.calBody.className='calStep '+(quality.bodyOk?'ok':'warn');
  e.calBody.textContent=quality.bodyOk?'✅ 1. เห็นศีรษะ–เข่า':'⚠️ 1. ให้เห็นศีรษะ–เข่า';
  e.calArms.className='calStep '+(quality.armsOk?'ok':'warn');
  e.calArms.textContent=quality.armsOk?'✅ 2. กางแขนแล้ว':'⚠️ 2. กางแขนระดับไหล่';
  e.calStable.className='calStep '+(quality.stable?'ok':'warn');

  if(quality.bodyOk&&quality.armsOk&&quality.stable&&quality.conf>=Math.max(.40,cfg.confidence-.06)){
    s.calValidMs+=delta;
  }else{
    s.calValidMs=Math.max(0,s.calValidMs-delta*.55);
  }

  const percent=C(s.calValidMs/1400*100,0,100);
  e.calibrationBar.style.width=percent+'%';
  e.calStable.textContent=percent>=100?'✅ 3. พร้อมเล่น':quality.stable?`3. ค้างนิ่ง ${Math.round(percent)}%`:'⚠️ 3. ค้างนิ่ง';
  e.calibrationText.textContent=!quality.bodyOk
    ?'ให้กล้องเห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง — ไม่ต้องถอยจนเห็นข้อเท้า'
    :!quality.armsOk
      ?'กางแขนให้อยู่ใกล้ระดับไหล่'
      :!quality.stable
        ?'ค้างนิ่งและมองตรง'
        :'ดีมาก ค้างต่ออีกเล็กน้อย';

  if(percent>=100){
    const adapted=adaptiveLandmarks(lm);
    const shoulderMid=BH.mid(adapted[11],adapted[12]);
    const ankleMid=BH.mid(adapted[27],adapted[28]);
    const kneeMid=BH.mid(adapted[25],adapted[26]);
    s.calibration={
      center:quality.center,
      shoulderCenter:shoulderMid,
      shoulderWidth:quality.sh,
      bodyHeight:Math.max(.2,ankleMid.y-adapted[0].y),
      ankleL:{...adapted[27]},
      ankleR:{...adapted[28]},
      ankleMid,
      ankleSpread:Math.max(.05,BH.dist(adapted[27],adapted[28])),
      kneeMid,
      lowerBodyMode:quality.ankleObserved?'ankle-observed':'knee-inferred',
      ankleObserved:quality.ankleObserved,
      cameraProfile:s.cameraProfile||'front-adaptive',
      cameraSettings:s.cameraSettings||{},
      ts:Date.now()
    };
    s.phase='ready';
    BH.startCountdown();
  }
};

const baseEvaluate=BH.evaluatePose;
BH.evaluatePose=(lm,key)=>{
  if(!lm||!s.calibration||!BH.poseFresh()){
    return{
      valid:false,
      tracked:false,
      confidence:0,
      pose:0,
      stability:0,
      control:0,
      safe:0,
      feedback:'จัดให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง',
      feetStable:false,
      movementSpeed:0,
      lowerBodyMode:'not-detected'
    };
  }

  const adapted=adaptiveLandmarks(lm);
  const result=baseEvaluate(adapted,key);
  if(/ทั้งตัว|เพิ่มแสง/.test(result.feedback||'')){
    result.feedback='จัดให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง';
  }
  result.lowerBodyMode=(vis(lm[27])>.30&&vis(lm[28])>.30)?'ankle-observed':'knee-inferred';
  result.cameraProfile=s.cameraProfile||'front-adaptive';
  return result;
};

function sanitizeDiagnostics(){
  const node=document.getElementById('bhCameraDiagV15');
  if(!node)return;
  let text=node.textContent||'';
  text=text
    .replace(/ยังไม่พบคนทั้งตัว[^•]*•?/g,'กำลังค้นหาศีรษะ ไหล่ สะโพก และเข่าทั้งสอง •')
    .replace(/ถอย 1\.5–2 เมตร[^•]*/g,'จัดตำแหน่งให้อยู่ในกรอบ')
    .replace(/ให้เห็นศีรษะถึงข้อเท้า/g,'ให้เห็นศีรษะถึงเข่าทั้งสอง')
    .replace(/ให้ทั้งตัวอยู่ในกรอบ/g,'ให้ช่วงศีรษะถึงเข่าอยู่ในกรอบ');
  if(node.textContent!==text)node.textContent=text;
}

const diagObserver=new MutationObserver(sanitizeDiagnostics);
const observeDiag=()=>{
  const node=document.getElementById('bhCameraDiagV15');
  if(node){diagObserver.observe(node,{childList:true,characterData:true,subtree:true});sanitizeDiagnostics()}
  else setTimeout(observeDiag,80);
};

injectStyle();
e.calibrationText.textContent='ให้เห็นศีรษะ ไหล่ สะโพก และเข่าทั้งสอง — ไม่ต้องเห็นข้อเท้า';
e.calBody.textContent='1. เห็นศีรษะ–เข่า';
observeDiag();

console.info('[BalanceHold] Mobile Camera Adaptive v34 ready',RELEASE);
})();
