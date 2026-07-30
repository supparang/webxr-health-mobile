(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260730-BALANCE-CLASSROOM-PERFORMANCE-WATCHDOG-V41';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const s=BH.state;
const e=BH.el;
const TARGET_INTERVAL_MS=118; // about 8.5 FPS: enough for slow balance poses, far lighter on mobile
let worker=null;
let workerUrl='';
let intervalId=0;
let finishing=false;
let lastPoseSendAt=0;
let poseSendBusy=false;
let runtimeErrors=0;

function phaseIsPlay(){return String(s.phase||'').toLowerCase()==='play'}
function safeText(node,value){if(node)node.textContent=String(value)}

function stopDeadline(){
  if(worker){try{worker.postMessage({type:'stop'})}catch(_){}try{worker.terminate()}catch(_){}worker=null}
  if(workerUrl){try{URL.revokeObjectURL(workerUrl)}catch(_){}workerUrl=''}
  if(intervalId){clearInterval(intervalId);intervalId=0}
}

function remainingSeconds(){
  if(!s.startedAt||!s.timeLimit)return Math.max(0,Number(s.timeLeft||0));
  return Math.max(0,Number(s.timeLimit)-(performance.now()-Number(s.startedAt))/1000);
}

function hardFinish(reason='timeup_watchdog'){
  if(finishing||!phaseIsPlay())return;
  finishing=true;
  stopDeadline();
  try{BH.stopPoseLoop?.()}catch(_){}
  try{
    s.timeLeft=0;
    safeText(e.hudTime,0);
    if(e.timeBar)e.timeBar.style.width='0%';
    BH.finish(reason);
  }catch(error){
    console.error('[BalanceHold V41] finish recovery failed',error);
    try{
      s.phase='summary';
      const summary=BH.calcSummary?.(reason)||{};
      BH.renderSummary?.(summary);
      BH.submitSummary?.(summary);
    }catch(inner){console.error('[BalanceHold V41] emergency summary failed',inner)}
  }
  window.setTimeout(()=>{try{BH.stopCamera?.()}catch(_){}},650);
}

function deadlineTick(){
  if(!phaseIsPlay())return;
  const left=remainingSeconds();
  s.timeLeft=left;
  safeText(e.hudTime,Math.ceil(left));
  if(e.timeBar)e.timeBar.style.width=Math.max(0,Math.min(100,left/Math.max(1,s.timeLimit)*100))+'%';
  if(left<=0.02)hardFinish('timeup_watchdog');
}

function startDeadline(){
  stopDeadline();
  finishing=false;
  const durationMs=Math.max(1000,Number(s.timeLimit||60)*1000);
  const startedAt=Number(s.startedAt||performance.now());

  try{
    const source=`
      let timer=0,deadline=0;
      self.onmessage=e=>{
        const d=e.data||{};
        if(d.type==='start'){
          clearInterval(timer);
          deadline=Date.now()+Math.max(1000,Number(d.durationMs)||60000);
          timer=setInterval(()=>self.postMessage({type:'tick',leftMs:Math.max(0,deadline-Date.now())}),250);
        }else if(d.type==='stop'){
          clearInterval(timer);close();
        }
      };`;
    workerUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    worker=new Worker(workerUrl);
    worker.onmessage=event=>{
      if(event.data?.type!=='tick'||!phaseIsPlay())return;
      deadlineTick();
      if(Number(event.data.leftMs)<=0)hardFinish('timeup_worker');
    };
    const elapsed=Math.max(0,performance.now()-startedAt);
    worker.postMessage({type:'start',durationMs:Math.max(1000,durationMs-elapsed)});
  }catch(error){
    console.warn('[BalanceHold V41] Worker unavailable, using interval',error);
  }

  intervalId=window.setInterval(deadlineTick,400);
}

// Replace the high-frequency rAF inference loop. Slow balance poses do not need 24 FPS.
BH.poseLoop=()=>{
  if(s.looping)return;
  s.looping=true;
  const run=async timestamp=>{
    if(!s.looping)return;
    if(e.camera?.readyState>=2&&s.pose&&!poseSendBusy&&timestamp-lastPoseSendAt>=TARGET_INTERVAL_MS){
      lastPoseSendAt=timestamp;
      poseSendBusy=true;
      try{await s.pose.send({image:e.camera})}
      catch(error){console.warn('[BalanceHold V41] pose frame skipped',error)}
      finally{poseSendBusy=false}
    }
    if(s.looping)requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};

const baseInitPose=BH.initPose;
BH.initPose=()=>{
  if(s.pose)return true;
  if(!window.Pose)return baseInitPose?.()||false;
  try{
    s.pose=new Pose({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`});
    s.pose.setOptions({
      modelComplexity:0,
      smoothLandmarks:true,
      enableSegmentation:false,
      minDetectionConfidence:.48,
      minTrackingConfidence:.48
    });
    s.pose.onResults(BH.onPoseResults);
    s.posePerformanceProfile='lite-8fps-v41';
    return true;
  }catch(error){
    console.warn('[BalanceHold V41] lite pose init failed',error);
    s.pose=null;
    return baseInitPose?.()||false;
  }
};

const baseStartGame=BH.startGame;
BH.startGame=()=>{
  const result=baseStartGame();
  startDeadline();
  return result;
};

const baseFinish=BH.finish;
BH.finish=reason=>{
  if(finishing&&String(s.phase||'').toLowerCase()==='summary')return;
  finishing=true;
  stopDeadline();
  try{BH.stopPoseLoop?.()}catch(_){}
  const result=baseFinish(reason);
  window.setTimeout(()=>{try{BH.stopCamera?.()}catch(_){}},650);
  return result;
};

const baseGameLoop=BH.gameLoop;
BH.gameLoop=(timestamp,token)=>{
  try{return baseGameLoop(timestamp,token)}
  catch(error){
    runtimeErrors+=1;
    console.error('[BalanceHold V41] game loop recovered',error);
    s.runtimeErrors=runtimeErrors;
    hardFinish('runtime_recovery');
  }
};

window.addEventListener('pagehide',stopDeadline,{once:true});
window.addEventListener('beforeunload',stopDeadline,{once:true});

console.info('[BalanceHold] Performance watchdog ready',RELEASE);
})();
