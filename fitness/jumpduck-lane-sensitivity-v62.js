(()=>{'use strict';
if(window.__JUMPDUCK_LANE_SENSITIVITY_V62__)return;
window.__JUMPDUCK_LANE_SENSITIVITY_V62__=true;

const pd=window.poseDetection;
if(!pd||typeof pd.createDetector!=='function')return;
const previousCreateDetector=pd.createDetector;
if(previousCreateDetector.__jumpduckLaneSensitivityV62Patched)return;

const LATERAL_GAIN=1.286; // 0.135 / 1.286 ≈ 0.105 effective exit threshold

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function inputWidth(input){
 return Math.max(1,Number(input?.videoWidth||input?.naturalWidth||input?.width||input?.clientWidth||320));
}
function amplifyPoseX(pose,width){
 if(!pose||!Array.isArray(pose.keypoints))return pose;
 const center=width/2;
 for(const kp of pose.keypoints){
  if(!kp||!Number.isFinite(Number(kp.x)))continue;
  kp.x=clamp(center+(Number(kp.x)-center)*LATERAL_GAIN,0,width);
 }
 return pose;
}

async function createDetectorWithLaneSensitivity(...args){
 const detector=await previousCreateDetector.apply(this,args);
 if(!detector||typeof detector.estimatePoses!=='function'||detector.__jumpduckLaneSensitivityV62Wrapped)return detector;
 const previousEstimate=detector.estimatePoses.bind(detector);
 detector.estimatePoses=async function(input,config){
  const poses=await previousEstimate(input,config);
  const width=inputWidth(input);
  if(Array.isArray(poses))for(const pose of poses)amplifyPoseX(pose,width);
  return poses;
 };
 detector.__jumpduckLaneSensitivityV62Wrapped=true;
 detector.jumpduckLaneSensitivity={
  version:'6.2',
  lateralGain:LATERAL_GAIN,
  effectiveExitThreshold:0.105,
  effectiveReturnThreshold:0.058,
  directionPolicy:'preserve-universal-direction-v55'
 };
 return detector;
}
createDetectorWithLaneSensitivity.__jumpduckLaneSensitivityV62Patched=true;
pd.createDetector=createDetectorWithLaneSensitivity;

try{
 const nativeSetItem=Storage.prototype.setItem;
 if(!nativeSetItem.__jumpduckLaneSensitivityV62StoragePatched){
  function resultSetItem(key,value){
   if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
    try{
     const payload=JSON.parse(String(value||'{}'));
     payload.gameVersion='jumpduck-production-v6.2-easier-lane-control';
     payload.laneSensitivityPolicy='lateral-gain-1.286-effective-0.105-exit-0.058-return-v62';
     payload.directionPolicy='front-camera-output-x-inversion-v55-preserved';
     value=JSON.stringify(payload);
    }catch(_){ }
   }
   return nativeSetItem.call(this,key,value);
  }
  resultSetItem.__jumpduckLaneSensitivityV62StoragePatched=true;
  Storage.prototype.setItem=resultSetItem;
 }
}catch(_){ }
})();
