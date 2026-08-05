(()=>{'use strict';
if(window.__JUMPDUCK_BODY_CONTROL_RESCUE_V73__)return;
window.__JUMPDUCK_BODY_CONTROL_RESCUE_V73__=true;

const RELEASE='20260805-JUMPDUCK-BODY-CONTROL-RESCUE-V73-R2';
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
function synthetic(name,x,y,score=.30){return{name,x,y,score,jdSynthetic:true}}
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
 const realLS=usable(ls,.08),realRS=usable(rs,.08);
 if(realLS)boost(ls,.28);
 if(realRS)boost(rs,.28);
 if(realLS&&realRS)return{ls,rs};

 const nose=map.nose,le=map.left_ear,re=map.right_ear,ley=map.left_eye,rey=map.right_eye;
 const goodNose=usable(nose,.06),goodLE=usable(le,.06),goodRE=usable(re,.06),goodLEY=usable(ley,.06),goodREY=usable(rey,.06);
 const facePoints=[goodNose?nose:null,goodLE?le:null,goodRE?re:null,goodLEY?ley:null,goodREY?rey:null].filter(Boolean);
 if(!facePoints.length&&!realLS&&!realRS)return{ls:null,rs:null};

 let midX=goodLE&&goodRE?(Number(le.x)+Number(re.x))/2:NaN;
 if(!Number.isFinite(midX)&&goodLEY&&goodREY)midX=(Number(ley.x)+Number(rey.x))/2;
 if(!Number.isFinite(midX)&&goodNose)midX=Number(nose.x);
 if(!Number.isFinite(midX)&&realLS&&realRS)midX=(Number(ls.x)+Number(rs.x))/2;
 if(!Number.isFinite(midX)&&realLS)midX=clamp(Number(ls.x)+w*.12,0,w);
 if(!Number.isFinite(midX)&&realRS)midX=clamp(Number(rs.x)-w*.12,0,w);
 if(!Number.isFinite(midX))return{ls:null,rs:null};

 let faceWidth=goodLE&&goodRE?Math.abs(Number(re.x)-Number(le.x)):0;
 if(!faceWidth&&goodLEY&&goodREY)faceWidth=Math.abs(Number(rey.x)-Number(ley.x))*1.55;
 if(!faceWidth&&realLS&&realRS)faceWidth=Math.abs(Number(rs.x)-Number(ls.x))*.45;
 if(!faceWidth&&realLS&&goodNose)faceWidth=Math.abs(Number(ls.x)-midX)*.9;
 if(!faceWidth&&realRS&&goodNose)faceWidth=Math.abs(Number(rs.x)-midX)*.9;
 faceWidth=clamp(faceWidth||w*.09,w*.055,w*.19);

 const shoulderWidth=clamp(faceWidth*2.45,w*.18,w*.46);
 let shoulderY=average([realLS?ls:null,realRS?rs:null].filter(Boolean),'y');
 if(!Number.isFinite(shoulderY)){
  const faceY=goodNose?Number(nose.y):average(facePoints,'y');
  shoulderY=faceY+clamp(Math.max(h*.12,shoulderWidth*.42),h*.10,h*.24);
 }
 shoulderY=clamp(shoulderY,h*.20,h*.78);

 if(!realLS)ls=put(pose,map,'left_shoulder',clamp(midX-shoulderWidth/2,0,w),shoulderY,.30);
 if(!realRS)rs=put(pose,map,'right_shoulder',clamp(midX+shoulderWidth/2,0,w),shoulderY,.30);
 boost(ls,.28);boost(rs,.28);
 return{ls,rs};
}

function ensureHips(pose,map,w,h,ls,rs){
 let lh=map.left_hip,rh=map.right_hip;
 const realLH=usable(lh,.07),realRH=usable(rh,.07);
 if(realLH)boost(lh,.24);
 if(realRH)boost(rh,.24);
 if(realLH&&realRH)return{lh,rh};
 if(!finite(ls)||!finite(rs))return{lh:null,rh:null};

 const shoulderMidX=(Number(ls.x)+Number(rs.x))/2;
 const shoulderY=(Number(ls.y)+Number(rs.y))/2;
 const shoulderWidth=Math.max(w*.14,Math.abs(Number(rs.x)-Number(ls.x)));
 const hipWidth=clamp(shoulderWidth*.66,w*.12,w*.34);
 let hipMidX=average([realLH?lh:null,realRH?rh:null].filter(Boolean),'x');
 if(!Number.isFinite(hipMidX))hipMidX=shoulderMidX;
 let hipY=average([realLH?lh:null,realRH?rh:null].filter(Boolean),'y');
 if(!Number.isFinite(hipY))hipY=shoulderY+clamp(Math.max(h*.23,shoulderWidth*1.05),h*.20,h*.38);
 hipY=clamp(hipY,h*.43,h*.97);

 if(!realLH)lh=put(pose,map,'left_hip',clamp(hipMidX-hipWidth/2,0,w),hipY,.26);
 if(!realRH)rh=put(pose,map,'right_hip',clamp(hipMidX+hipWidth/2,0,w),hipY,.26);
 boost(lh,.24);boost(rh,.24);
 return{lh,rh};
}

function rescuePose(pose,input){
 if(!pose?.keypoints?.length)return pose;
 const w=Math.max(1,Number(input?.videoWidth||input?.naturalWidth||input?.width||320));
 const h=Math.max(1,Number(input?.videoHeight||input?.naturalHeight||input?.height||240));
 const map=mapOf(pose);
 for(const name of ['nose','left_eye','right_eye','left_ear','right_ear'])if(usable(map[name],.06))boost(map[name],.18);
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
   detector.jumpduckBodyControlRescue={version:'7.3-r2',release:RELEASE,policy:'continuous-face-shoulder-hip-fallback'};
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
