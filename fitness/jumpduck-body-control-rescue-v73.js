(()=>{'use strict';
if(window.__JUMPDUCK_BODY_CONTROL_RESCUE_V73__)return;
window.__JUMPDUCK_BODY_CONTROL_RESCUE_V73__=true;

const RELEASE='20260805-JUMPDUCK-BODY-CONTROL-RESCUE-V73';
const MIN_REAL_SCORE=.10;

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function finite(kp){return !!kp&&Number.isFinite(Number(kp.x))&&Number.isFinite(Number(kp.y))}
function usable(kp,min=MIN_REAL_SCORE){return finite(kp)&&Number(kp.score||0)>=min}
function mapOf(pose){
 const map={};
 for(const kp of pose?.keypoints||[])if(kp?.name)map[kp.name]=kp;
 return map;
}
function boost(kp,min){
 if(!finite(kp))return kp;
 kp.score=Math.max(Number(kp.score)||0,min);
 return kp;
}
function synthetic(name,x,y,score=.30){
 return{name,x,y,score,jdSynthetic:true};
}
function put(pose,map,name,x,y,score=.30){
 const kp=synthetic(name,x,y,score);
 pose.keypoints.push(kp);map[name]=kp;return kp;
}
function average(points,axis){
 const valid=points.filter(finite);
 if(!valid.length)return NaN;
 return valid.reduce((sum,kp)=>sum+Number(kp[axis]),0)/valid.length;
}

function ensureShoulders(pose,map,w,h){
 let ls=map.left_shoulder,rs=map.right_shoulder;
 if(finite(ls))boost(ls,.28);
 if(finite(rs))boost(rs,.28);
 if(usable(ls,.08)&&usable(rs,.08))return{ls,rs};

 const nose=map.nose,le=map.left_ear,re=map.right_ear,ley=map.left_eye,rey=map.right_eye;
 const facePoints=[nose,le,re,ley,rey].filter(kp=>usable(kp,.06));
 if(!facePoints.length&&!finite(ls)&&!finite(rs))return{ls,rs};

 let midX=average([le,re], 'x');
 if(!Number.isFinite(midX))midX=average([ley,rey], 'x');
 if(!Number.isFinite(midX))midX=finite(nose)?Number(nose.x):average([ls,rs],'x');
 if(!Number.isFinite(midX))return{ls,rs};

 let faceWidth=usable(le,.06)&&usable(re,.06)?Math.abs(Number(re.x)-Number(le.x)):0;
 if(!faceWidth&&usable(ley,.06)&&usable(rey,.06))faceWidth=Math.abs(Number(rey.x)-Number(ley.x))*1.55;
 if(!faceWidth&&finite(ls)&&finite(rs))faceWidth=Math.abs(Number(rs.x)-Number(ls.x))*.45;
 if(!faceWidth&&finite(ls))faceWidth=Math.abs(Number(ls.x)-midX)*.9;
 if(!faceWidth&&finite(rs))faceWidth=Math.abs(Number(rs.x)-midX)*.9;
 faceWidth=clamp(faceWidth||w*.09,w*.055,w*.19);

 let shoulderWidth=clamp(faceWidth*2.45,w*.18,w*.46);
 let shoulderY;
 if(finite(ls)||finite(rs))shoulderY=average([ls,rs],'y');
 if(!Number.isFinite(shoulderY)){
  const faceY=finite(nose)?Number(nose.y):average(facePoints,'y');
  shoulderY=faceY+clamp(Math.max(h*.12,shoulderWidth*.42),h*.10,h*.24);
 }
 shoulderY=clamp(shoulderY,h*.20,h*.78);

 if(!finite(ls))ls=put(pose,map,'left_shoulder',clamp(midX-shoulderWidth/2,0,w),shoulderY,.30);
 if(!finite(rs))rs=put(pose,map,'right_shoulder',clamp(midX+shoulderWidth/2,0,w),shoulderY,.30);
 boost(ls,.28);boost(rs,.28);
 return{ls,rs};
}

function ensureHips(pose,map,w,h,ls,rs){
 let lh=map.left_hip,rh=map.right_hip;
 if(finite(lh))boost(lh,.24);
 if(finite(rh))boost(rh,.24);
 if(usable(lh,.08)&&usable(rh,.08))return{lh,rh};
 if(!finite(ls)||!finite(rs))return{lh,rh};

 const shoulderMidX=(Number(ls.x)+Number(rs.x))/2;
 const shoulderY=(Number(ls.y)+Number(rs.y))/2;
 const shoulderWidth=Math.max(w*.14,Math.abs(Number(rs.x)-Number(ls.x)));
 const hipWidth=clamp(shoulderWidth*.66,w*.12,w*.34);
 let hipMidX=average([lh,rh],'x');
 if(!Number.isFinite(hipMidX))hipMidX=shoulderMidX;
 let hipY=average([lh,rh],'y');
 if(!Number.isFinite(hipY))hipY=shoulderY+clamp(Math.max(h*.23,shoulderWidth*1.05),h*.20,h*.38);
 hipY=clamp(hipY,h*.43,h*.97);

 if(!finite(lh))lh=put(pose,map,'left_hip',clamp(hipMidX-hipWidth/2,0,w),hipY,.26);
 if(!finite(rh))rh=put(pose,map,'right_hip',clamp(hipMidX+hipWidth/2,0,w),hipY,.26);
 boost(lh,.24);boost(rh,.24);
 return{lh,rh};
}

function rescuePose(pose,input){
 if(!pose?.keypoints?.length)return pose;
 const w=Math.max(1,Number(input?.videoWidth||input?.naturalWidth||input?.width||320));
 const h=Math.max(1,Number(input?.videoHeight||input?.naturalHeight||input?.height||240));
 const map=mapOf(pose);
 for(const name of ['nose','left_eye','right_eye','left_ear','right_ear'])if(finite(map[name]))boost(map[name],.18);
 const {ls,rs}=ensureShoulders(pose,map,w,h);
 ensureHips(pose,map,w,h,ls,rs);
 return pose;
}

function install(){
 const pd=window.poseDetection;
 if(!pd?.createDetector||pd.createDetector.__jdV73Wrapped)return false;
 const nativeCreate=pd.createDetector.bind(pd);
 const wrapped=async(...args)=>{
  const detector=await nativeCreate(...args);
  if(detector?.estimatePoses&&!detector.estimatePoses.__jdV73Wrapped){
   const nativeEstimate=detector.estimatePoses.bind(detector);
   const estimate=async(input,...rest)=>{
    const poses=await nativeEstimate(input,...rest);
    if(Array.isArray(poses))for(const pose of poses)rescuePose(pose,input);
    return poses;
   };
   estimate.__jdV73Wrapped=true;
   detector.estimatePoses=estimate;
   detector.jumpduckBodyControlRescue={version:'7.3',release:RELEASE,policy:'continuous-face-shoulder-hip-fallback'};
  }
  return detector;
 };
 wrapped.__jdV73Wrapped=true;
 pd.createDetector=wrapped;
 return true;
}

if(!install()){
 let tries=0;
 const timer=setInterval(()=>{tries++;if(install()||tries>100)clearInterval(timer)},40);
}
console.info('[JumpDuck Body Control Rescue V73] installed',{release:RELEASE});
})();
