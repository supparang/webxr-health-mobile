(()=>{'use strict';
if(window.__JUMPDUCK_HORIZONTAL_FIX_V55__)return;
window.__JUMPDUCK_HORIZONTAL_FIX_V55__=true;
window.__JUMPDUCK_HORIZONTAL_POLICY__='front-camera-output-x-inversion-v55';

function patchPoseDetection(){
  const pd=window.poseDetection;
  if(!pd||typeof pd.createDetector!=='function')return false;
  if(pd.__jumpduckHorizontalV55Patched)return true;
  const nativeCreate=pd.createDetector.bind(pd);
  pd.createDetector=async function(...args){
    const detector=await nativeCreate(...args);
    if(detector&&typeof detector.estimatePoses==='function'&&!detector.__jumpduckHorizontalV55Patched){
      const nativeEstimate=detector.estimatePoses.bind(detector);
      detector.estimatePoses=async function(image,config={}){
        const poses=await nativeEstimate(image,config);
        const width=Number(image?.videoWidth||image?.width||0);
        if(!width||!Array.isArray(poses))return poses;
        for(const pose of poses){
          if(!Array.isArray(pose?.keypoints))continue;
          for(const kp of pose.keypoints){
            if(Number.isFinite(kp?.x))kp.x=width-kp.x;
          }
        }
        return poses;
      };
      detector.__jumpduckHorizontalV55Patched=true;
    }
    return detector;
  };
  pd.__jumpduckHorizontalV55Patched=true;
  return true;
}

function removeLegacyMirror(){
  document.getElementById('jdIOSDirectionV53Style')?.remove();
}

function patchPayload(){
  const nativeSetItem=Storage.prototype.setItem;
  if(nativeSetItem.__jumpduckHorizontalV55Patched)return;
  function patchedSetItem(key,value){
    if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
      try{
        const payload=JSON.parse(String(value||'{}'));
        payload.gameVersion='jumpduck-production-v5.5-universal-horizontal-fix';
        payload.horizontalDirectionPolicy='front-camera-output-x-inversion-v55';
        value=JSON.stringify(payload);
      }catch(_){ }
    }
    return nativeSetItem.call(this,key,value);
  }
  patchedSetItem.__jumpduckHorizontalV55Patched=true;
  Storage.prototype.setItem=patchedSetItem;
}

removeLegacyMirror();
patchPayload();
if(!patchPoseDetection()){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(patchPoseDetection()||tries>60)clearInterval(timer);
  },50);
}
})();