(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.el||!BH.state)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-CAMERA-CALIBRATION-V15';

function injectStyle(){
  if(document.getElementById('bhCameraFixV15Style'))return;
  const st=document.createElement('style');st.id='bhCameraFixV15Style';st.textContent=`
  #calibrationOverlay{background:rgba(2,6,23,.08)!important;backdrop-filter:none!important;place-items:start end!important;padding:14px!important;pointer-events:none}
  #calibrationOverlay .calibrationModal{width:min(460px,calc(100% - 12px))!important;max-height:calc(100dvh - 100px)!important;margin-top:6px!important;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(4px);pointer-events:auto}
  #calibrationOverlay .modalHead{grid-template-columns:54px 1fr!important}.calibrationModal .modalIcon{width:54px!important;height:54px!important;border-radius:18px!important;font-size:26px!important}
  #bhCameraDiagV15{margin-top:10px;padding:10px 12px;border-radius:16px;background:#eff6ff;border:2px solid #93c5fd;color:#1e3a8a;font-weight:900;font-size:12px;line-height:1.45}
  #bhCameraDiagV15.ok{background:#ecfdf5;border-color:#86efac;color:#047857}#bhCameraDiagV15.warn{background:#fff7ed;border-color:#fdba74;color:#9a3412}#bhCameraDiagV15.bad{background:#fff1f2;border-color:#fda4af;color:#be123c}
  #bhCameraGuideV15{position:absolute;inset:7% 8% 5%;border:3px dashed rgba(255,255,255,.75);border-radius:38px;z-index:8;pointer-events:none;box-shadow:0 0 0 9999px rgba(2,6,23,.08)}
  #bhCameraGuideV15:before{content:'ยืนให้ศีรษะและข้อเท้าอยู่ในกรอบ';position:absolute;left:50%;top:8px;transform:translateX(-50%);white-space:nowrap;background:rgba(15,23,42,.82);color:#fff;padding:7px 11px;border-radius:999px;font-weight:1000;font-size:12px}
  body.bh-calibrating #camera{opacity:1!important;filter:none!important}body.bh-calibrating .tint{background:rgba(2,6,23,.05)!important}body.bh-calibrating .crystalWorld,body.bh-calibrating .safeZone,body.bh-calibrating .poseGhost,body.bh-calibrating .crystal,body.bh-calibrating .holdRing,body.bh-calibrating .holdText,body.bh-calibrating .hud,body.bh-calibrating .poseBanner,body.bh-calibrating .energy,body.bh-calibrating .coach{opacity:0!important;pointer-events:none!important}
  @media(max-width:760px){#calibrationOverlay{place-items:end center!important;padding:8px!important}#calibrationOverlay .calibrationModal{width:100%!important;max-height:46dvh!important;margin:0!important;padding:12px!important}.calibrationSteps{grid-template-columns:repeat(3,1fr)!important}.calStep{padding:7px!important;font-size:11px!important}.cameraHints{display:none!important}#bhCameraGuideV15{inset:4% 5% 43%;border-radius:24px}}
  `;document.head.appendChild(st);
}

function diagBox(){
  let n=$('bhCameraDiagV15');if(n)return n;
  n=document.createElement('div');n.id='bhCameraDiagV15';n.className='warn';n.textContent='กำลังเริ่มระบบ Pose…';
  const meter=document.querySelector('#calibrationOverlay .calMeter');meter?.insertAdjacentElement('afterend',n);
  return n;
}
function guide(){let g=$('bhCameraGuideV15');if(!g){g=document.createElement('div');g.id='bhCameraGuideV15';e.stage.appendChild(g)}return g}
function setDiag(text,kind='warn'){const n=diagBox();n.className=kind;n.textContent=text}

let processed=0,landmarkFrames=0,lastLandmarkAt=0,lastError='',startedAt=0;
const baseResults=BH.onPoseResults;
BH.onPoseResults=results=>{
  processed++;if(results?.poseLandmarks){landmarkFrames++;lastLandmarkAt=performance.now()}
  baseResults(results);
};
if(s.pose?.onResults)s.pose.onResults(BH.onPoseResults);

const baseInit=BH.initPose;
BH.initPose=()=>{
  const ok=baseInit();
  if(ok&&s.pose?.onResults)s.pose.onResults(BH.onPoseResults);
  return ok;
};

const baseBegin=BH.beginCalibration;
BH.beginCalibration=async()=>{startedAt=performance.now();processed=0;landmarkFrames=0;lastLandmarkAt=0;lastError='';document.body.classList.add('bh-calibrating');guide().style.display='block';setDiag('กำลังเปิดกล้องและโหลด MediaPipe Pose…','warn');return baseBegin()};
if(BH.startLiveDemo){
  const baseDemo=BH.startLiveDemo;
  BH.startLiveDemo=async()=>{startedAt=performance.now();processed=0;landmarkFrames=0;lastLandmarkAt=0;lastError='';document.body.classList.add('bh-calibrating');guide().style.display='block';setDiag('Live Demo: กำลังเปิดกล้องและโหลด Pose…','warn');return baseDemo()};
  const b=$('demoBtn');if(b)b.onclick=BH.startLiveDemo;
}

const baseCountdown=BH.startCountdown;
BH.startCountdown=()=>{document.body.classList.remove('bh-calibrating');const g=guide();g.style.display='none';baseCountdown()};

const baseStop=BH.stopCamera;
BH.stopCamera=()=>{document.body.classList.remove('bh-calibrating');const g=$('bhCameraGuideV15');if(g)g.style.display='none';baseStop()};

// Replace pose loop with visible diagnostics while preserving one-frame-at-a-time sending.
BH.poseLoop=async()=>{
  if(s.looping)return;s.looping=true;
  const run=async()=>{
    if(!s.looping)return;
    const t=performance.now();
    if(e.camera.readyState>=2&&s.pose&&t-s.lastFrame>42){
      s.lastFrame=t;
      try{await s.pose.send({image:e.camera})}
      catch(err){lastError=String(err?.message||err);console.warn('[BalanceHold v15] pose frame failed',err)}
    }
    requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};

setInterval(()=>{
  if(s.phase!=='calibration')return;
  const elapsed=Math.round((performance.now()-startedAt)/1000);
  if(lastError){setDiag(`กล้องเปิดแล้ว แต่ Pose Engine ผิดพลาด: ${lastError.slice(0,120)} • กด “เปิดกล้องใหม่”`,'bad');return}
  if(!s.stream){setDiag('ยังไม่มีกล้อง • กด “เปิดกล้องใหม่” และอนุญาต Camera','bad');return}
  if(e.camera.readyState<2){setDiag('กล้องได้รับสิทธิ์แล้ว แต่ภาพยังไม่พร้อม • รอสักครู่','warn');return}
  if(processed===0){setDiag(`กล้องเปิด ${e.camera.videoWidth||''}×${e.camera.videoHeight||''} • กำลังโหลด Pose Engine ${elapsed}s`,'warn');return}
  if(landmarkFrames===0){setDiag(`กล้องเปิดแล้ว • Pose ทำงาน ${s.fps||processed} FPS • ยังไม่พบคนทั้งตัว — ถอย 1.5–2 เมตร ให้เห็นศีรษะถึงข้อเท้า`,'warn');return}
  const age=Math.round(performance.now()-lastLandmarkAt);
  if(age>1200){setDiag(`เคยพบ Pose แต่หลุด ${age} ms • เพิ่มแสงและให้ทั้งตัวอยู่ในกรอบ`,'warn');return}
  setDiag(`✅ กล้องและ Pose ทำงาน • ${s.fps||'-'} FPS • Confidence ${Math.round(s.confidence||0)}% • กางแขนระดับไหล่และค้างนิ่ง`,'ok');
},350);

// Retry resets both camera and pose instance, useful when WASM/model initialization stalls.
const retry=$('retryCameraBtn');if(retry)retry.onclick=async()=>{
  setDiag('กำลังรีสตาร์ตกล้องและ Pose Engine…','warn');
  try{s.pose?.close?.()}catch(_){}
  s.pose=null;s.looping=false;s.lastFrame=0;s.smooth=null;s.latest=null;s.latestAt=0;
  await BH.startCamera({restart:true});
  if(BH.initPose()){BH.poseLoop();startedAt=performance.now();processed=0;landmarkFrames=0;lastError=''}
};

injectStyle();diagBox();guide().style.display='none';
console.info('[BalanceHold] Camera Calibration Fix v15 ready',RELEASE);
})();