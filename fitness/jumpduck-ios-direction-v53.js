(()=>{'use strict';
if(window.__JUMPDUCK_IOS_DIRECTION_V531__)return;
window.__JUMPDUCK_IOS_DIRECTION_V531__=true;

const ua=navigator.userAgent||'';
const platform=navigator.platform||'';
const touchPoints=Number(navigator.maxTouchPoints||0);
const isIOS=/iPhone|iPad|iPod/i.test(ua)||(platform==='MacIntel'&&touchPoints>1);
window.__JUMPDUCK_IS_IOS__=isIOS;
window.__JUMPDUCK_HORIZONTAL_POLICY__=isIOS?'ios-selfie-movenet-flip-on':'default-movenet-flip';
if(!isIOS)return;

/*
 * The game preview is mirrored with CSS (selfie view). The gameplay coordinate
 * must therefore also use MoveNet's horizontal flip. v5.3 incorrectly forced
 * flipHorizontal=false on iOS, which made physical left move the duck right.
 * This patch preserves/forces flipHorizontal=true only on iOS. Android and
 * other devices are untouched because the file returns above for non-iOS.
 */
function patchPoseDetection(){
  const pd=window.poseDetection;
  if(!pd||typeof pd.createDetector!=='function')return false;
  if(pd.__jumpduckIOSDirection531Patched)return true;
  const nativeCreate=pd.createDetector.bind(pd);
  pd.createDetector=async function(...args){
    const detector=await nativeCreate(...args);
    if(detector&&typeof detector.estimatePoses==='function'&&!detector.__jumpduckIOSDirection531Patched){
      const nativeEstimate=detector.estimatePoses.bind(detector);
      detector.estimatePoses=function(image,config={}){
        return nativeEstimate(image,{...config,flipHorizontal:true});
      };
      detector.__jumpduckIOSDirection531Patched=true;
    }
    return detector;
  };
  pd.__jumpduckIOSDirection531Patched=true;
  return true;
}

function patchPayload(){
  const nativeSetItem=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){
    if(String(key)==='HHA_JUMPDUCK_LAST_RESULT'){
      try{
        const payload=JSON.parse(String(value||'{}'));
        payload.gameVersion='jumpduck-production-v5.3.1-ios-direction-correction';
        payload.horizontalDirectionPolicy='ios-selfie-movenet-flip-on';
        payload.deviceIOS=true;
        value=JSON.stringify(payload);
      }catch(_){ }
    }
    return nativeSetItem.call(this,key,value);
  };
}

patchPayload();
if(!patchPoseDetection()){
  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    if(patchPoseDetection()||tries>40)clearInterval(timer);
  },50);
}
})();
