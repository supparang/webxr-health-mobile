(()=>{'use strict';
if(window.__JUMPDUCK_CALIBRATION_MOBILE_RESCUE_V64__)return;
window.__JUMPDUCK_CALIBRATION_MOBILE_RESCUE_V64__=true;
const RELEASE='20260805-JUMPDUCK-CALIBRATION-MOBILE-RESCUE-V64';

function finitePoint(kp){return kp&&Number.isFinite(Number(kp.x))&&Number.isFinite(Number(kp.y));}
function mapOf(pose){const out={};for(const kp of pose?.keypoints||[])if(kp?.name)out[kp.name]=kp;return out;}
function boost(kp,min){if(!finitePoint(kp))return kp;kp.score=Math.max(Number(kp.score)||0,min);return kp;}
function synthetic(name,x,y,score=.32){return{name,x,y,score};}
function makeCalibrationFriendly(pose){
  if(!pose?.keypoints?.length)return pose;
  const map=mapOf(pose);
  boost(map.nose,.20);boost(map.left_shoulder,.30);boost(map.right_shoulder,.30);
  boost(map.left_hip,.24);boost(map.right_hip,.24);
  const ls=map.left_shoulder,rs=map.right_shoulder;
  if(finitePoint(ls)&&finitePoint(rs)){
    const shoulderWidth=Math.max(24,Math.abs(Number(rs.x)-Number(ls.x)));
    const midX=(Number(ls.x)+Number(rs.x))/2;
    const shoulderY=(Number(ls.y)+Number(rs.y))/2;
    const estimatedHipY=shoulderY+Math.max(70,shoulderWidth*1.15);
    if(!finitePoint(map.left_hip)){
      const kp=synthetic('left_hip',midX-shoulderWidth*.34,estimatedHipY);
      pose.keypoints.push(kp);map.left_hip=kp;
    }
    if(!finitePoint(map.right_hip)){
      const kp=synthetic('right_hip',midX+shoulderWidth*.34,estimatedHipY);
      pose.keypoints.push(kp);map.right_hip=kp;
    }
    boost(map.left_hip,.24);boost(map.right_hip,.24);
  }
  return pose;
}

function installDetectorWrapper(){
  const pd=window.poseDetection;
  if(!pd?.createDetector||pd.createDetector.__jdV64Wrapped)return false;
  const native=pd.createDetector.bind(pd);
  const wrapped=async(...args)=>{
    const detector=await native(...args);
    if(detector?.estimatePoses&&!detector.estimatePoses.__jdV64Wrapped){
      const nativeEstimate=detector.estimatePoses.bind(detector);
      const estimate=async(...estimateArgs)=>{
        const poses=await nativeEstimate(...estimateArgs);
        const countdown=document.getElementById('countdown');
        const calibrating=countdown&&!countdown.classList.contains('hidden');
        if(calibrating&&Array.isArray(poses))poses.forEach(makeCalibrationFriendly);
        return poses;
      };
      estimate.__jdV64Wrapped=true;
      detector.estimatePoses=estimate;
    }
    return detector;
  };
  wrapped.__jdV64Wrapped=true;
  pd.createDetector=wrapped;
  return true;
}

function updateHint(){
  const state=document.getElementById('jdCalibrationState');
  const count=document.getElementById('count');
  const countdown=document.getElementById('countdown');
  if(!state||!count||!countdown||countdown.classList.contains('hidden'))return;
  if(String(count.textContent||'').trim()==='1'){
    state.textContent='กำลังยืนยันตำแหน่งร่างกาย • ยืนนิ่งตรงกลางอีกเล็กน้อย';
    state.style.background='#dcfce7';state.style.color='#166534';
  }
}

if(!installDetectorWrapper()){
  let tries=0;
  const timer=setInterval(()=>{tries++;if(installDetectorWrapper()||tries>80)clearInterval(timer)},50);
}
const boot=()=>{
  const count=document.getElementById('count');
  if(count)new MutationObserver(updateHint).observe(count,{childList:true,characterData:true,subtree:true});
  console.info('[JumpDuck Calibration Rescue V64] installed',{release:RELEASE});
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
