(()=>{'use strict';
if(window.__JUMPDUCK_IOS_DIRECTION_V53__)return;
window.__JUMPDUCK_IOS_DIRECTION_V53__=true;

const ua=navigator.userAgent||'';
const platform=navigator.platform||'';
const touchPoints=Number(navigator.maxTouchPoints||0);
const isIOS=/iPhone|iPad|iPod/i.test(ua)||(platform==='MacIntel'&&touchPoints>1);
window.__JUMPDUCK_IS_IOS__=isIOS;
window.__JUMPDUCK_HORIZONTAL_POLICY__=isIOS?'ios-raw-pose-mirrored-overlay':'default-movenet-flip';
if(!isIOS)return;

function patchPoseDetection(){
  const pd=window.poseDetection;
  if(!pd||typeof pd.createDetector!=='function')return false;
  if(pd.__jumpduckIOSPatched)return true;
  const nativeCreate=pd.createDetector.bind(pd);
  pd.createDetector=async function(...args){
    const detector=await nativeCreate(...args);
    if(detector&&typeof detector.estimatePoses==='function'&&!detector.__jumpduckIOSPatched){
      const nativeEstimate=detector.estimatePoses.bind(detector);
      detector.estimatePoses=function(image,config={}){
        /* iOS front-camera coordinates already follow the physical movement axis
           used by this game. A second horizontal flip reverses left and right. */
        return nativeEstimate(image,{...config,flipHorizontal:false});
      };
      detector.__jumpduckIOSPatched=true;
    }
    return detector;
  };
  pd.__jumpduckIOSPatched=true;
  return true;
}

function installVisualAlignment(){
  if(document.getElementById('jdIOSDirectionV53Style'))return;
  const style=document.createElement('style');
  style.id='jdIOSDirectionV53Style';
  /* Video is mirrored for selfie-view. Mirror only the skeleton overlay as well;
     the coordinates used for gameplay remain raw and therefore move correctly. */
  style.textContent='.camera #poseCanvas{transform:scaleX(-1);transform-origin:center}';
  document.head.appendChild(style);
}

function patchPayload(){
  const nativeSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
      try{
        const payload=JSON.parse(String(value||'{}'));
        payload.gameVersion='jumpduck-production-v5.3-ios-direction-fix';
        payload.horizontalDirectionPolicy='ios-front-camera-no-double-flip';
        payload.deviceIOS=true;
        value=JSON.stringify(payload);
      }catch(_){ }
    }
    return nativeSetItem.call(this,key,value);
  };
}

installVisualAlignment();
patchPayload();
if(!patchPoseDetection()){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(patchPoseDetection()||tries>40)clearInterval(timer);
  },50);
}
})();
