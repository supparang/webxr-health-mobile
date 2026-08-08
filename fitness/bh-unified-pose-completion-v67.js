(()=>{
'use strict';
const BH=window.BH;
if(!BH?.state||!BH?.el||typeof BH.completePose!=='function'||typeof BH.updateGameUI!=='function')return;
if(window.BH_UNIFIED_POSE_COMPLETION_V67)return;
const s=BH.state,e=BH.el,C=BH.clamp||((v,a,b)=>Math.max(a,Math.min(b,v)));
const RELEASE='20260808-BALANCE-UNIFIED-POSE-COMPLETION-V67-FRAME-AWARE';
let committing=false,lastCommittedDone=-1;

function cfg(){return BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.easy||BH.CONFIG?.normal||{}}
function requiredMs(){
  const c=cfg();
  const assist=1-(Number(s.assistLevel)||0)*.075;
  return Math.max(1,((Number(c.hold)||1600)+(String(s.currentKey||'')==='boss'?450:0))*assist);
}
function inferenceIntervalMs(){
  const declared=Number(window.BH_SMOKE_PERFORMANCE_V59?.inferenceIntervalMs||window.BH_SMOKE_PERFORMANCE_V63?.inferenceIntervalMs||0);
  if(declared>0)return declared;
  const q=new URLSearchParams(location.search);
  return /^(1|true|yes)$/i.test(String(q.get('smoke')||''))?200:84;
}
function threshold(req=requiredMs()){
  // A valid pose must survive almost the entire requested hold. The small tolerance only
  // compensates for inference quantization: at 5fps the next pose sample is ~200ms later.
  const frame=inferenceIntervalMs();
  const tolerance=Math.min(180,Math.max(70,frame*.75));
  return C(1-tolerance/Math.max(1,req),.94,.985);
}
function coherent(){
  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  const done=Array.isArray(s.results)?s.results.length:0;
  if(total!==6)return{total,done,index:Number(s.index||0),ok:false};
  if(String(s.phase||'')==='play'&&Number(s.index||0)!==done){
    s.index=Math.min(done,total);
    if(s.index<total)s.currentKey=s.sequence[s.index];
  }
  return{total,done,index:Number(s.index||0),ok:true};
}
function syncHud(){
  const {total,done}=coherent();
  if(!total)return;
  if(e.hudPose)e.hudPose.textContent=`${Math.min(done+1,total)}/${total}`;
  if(e.poseBar)e.poseBar.style.width=`${C(done/total*100,0,100)}%`;
}
function synthesizeResult(ev,req,indexBefore){
  if(!Array.isArray(s.results))s.results=[];
  if(s.results.length>indexBefore)return;
  const a=s.currentAccumulator||{},n=Math.max(1,Number(a.samples)||0);
  const avg=(sum,fallback)=>Math.round((Number(sum)||0)/n)||Math.round(Number(fallback)||0);
  const poseAccuracy=avg(a.poseSum,ev?.pose),stability=avg(a.stabilitySum,ev?.stability),holdControl=avg(a.controlSum,ev?.control),safeZone=avg(a.safeSum,ev?.safe),confidence=avg(a.confidenceSum,ev?.confidence);
  const now=BH.now?.()||performance.now();
  const transitionMs=Math.max(0,(Number(s.firstValidAt)||now)-(Number(s.transitionStart)||now));
  const transitionEfficiency=C(100-Math.max(0,transitionMs-900)/38-(Number(s.currentLosses)||0)*7-(Number(s.assistLevel)||0)*4,35,100);
  const transitionControl=Math.round(holdControl*.45+transitionEfficiency*.55);
  const quality=C(Math.round(poseAccuracy*.35+stability*.30+transitionControl*.20+safeZone*.10+5),0,100);
  const key=typeof BH.currentPoseKey==='function'?BH.currentPoseKey():s.currentKey;
  s.results.push({index:indexBefore+1,key,title:BH.POSES?.[key]?.name||String(key||'Pose'),poseAccuracy,stability,transitionControl,holdControl,safeZone,confidence,quality,holdMs:Math.round(Math.max(Number(s.holdMs)||0,req)),validMs:Math.round(Number(a.validMs)||req),trackedMs:Math.round(Number(a.trackedMs)||req),requiredMs:Math.round(req),transitionMs:Math.round(transitionMs),losses:Number(s.currentLosses)||0,assistLevel:Number(s.assistLevel)||0,passed:true,recoveredBy:'UNIFIED-POSE-COMPLETION-V67'});
}

const nativeComplete=BH.completePose;
BH.completePose=(ev,req)=>{
  if(committing)return;
  const before=coherent(),indexBefore=before.done;
  if(indexBefore>=before.total)return;
  committing=true;
  try{
    nativeComplete(ev,req);
    synthesizeResult(ev,req,indexBefore);
    const done=s.results.length;
    s.index=done;
    if(done<before.total){
      s.currentKey=s.sequence[done];
      try{BH.setPoseUI?.()}catch(err){console.warn('[Balance V67] setPoseUI fallback',err)}
    }
    lastCommittedDone=done;
    syncHud();
  }finally{committing=false}
};

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  const result=baseUpdate(ev,p);
  const st=coherent();syncHud();
  if(!st.ok||st.done>=st.total||committing)return result;
  const req=requiredMs(),cutoff=threshold(req);
  const nearComplete=ev?.valid===true&&(Number(p)>=cutoff||Number(s.holdMs||0)>=req-(1-cutoff)*req);
  if(nearComplete&&lastCommittedDone!==st.done){
    s.holdMs=Math.max(Number(s.holdMs)||0,req);
    BH.completePose(ev,req);
  }
  return result;
};

const baseReset=BH.resetRoundState;
if(typeof baseReset==='function')BH.resetRoundState=()=>{committing=false;lastCommittedDone=-1;const r=baseReset();syncHud();return r};

window.BH_UNIFIED_POSE_COMPLETION_V67={release:RELEASE,requiredMs,coherent,syncHud,inferenceIntervalMs,threshold};
document.documentElement.dataset.bhUnifiedPoseCompletion='v67-frame-aware';
console.info('[BalanceHold] Unified Pose Completion V67 ready',window.BH_UNIFIED_POSE_COMPLETION_V67);
})();