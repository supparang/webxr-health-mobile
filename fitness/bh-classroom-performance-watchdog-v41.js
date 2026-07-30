(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260730-BALANCE-CLASSROOM-PERFORMANCE-WATCHDOG-V43';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const s=BH.state;
const e=BH.el;
const TARGET_INTERVAL_MS=165; // ~6 FPS, sufficient for slow balance poses
const SOFT_FINISH_SEC=56;     // stop before the common mobile renderer stall at 0 sec
const MAX_AI_SEC=44;          // release MediaPipe before long-run memory pressure
let worker=null;
let workerUrl='';
let intervalId=0;
let finishing=false;
let lastPoseSendAt=0;
let poseSendBusy=false;
let aiStopped=false;
let runtimeErrors=0;

function phaseIsPlay(){return String(s.phase||'').toLowerCase()==='play'}
function safeText(node,value){if(node)node.textContent=String(value)}
function elapsedSeconds(){return s.startedAt?Math.max(0,(performance.now()-Number(s.startedAt))/1000):0}

function stopDeadline(){
  if(worker){try{worker.postMessage({type:'stop'})}catch(_){}try{worker.terminate()}catch(_){}worker=null}
  if(workerUrl){try{URL.revokeObjectURL(workerUrl)}catch(_){}workerUrl=''}
  if(intervalId){clearInterval(intervalId);intervalId=0}
}

function stopAI(reason='ai_runtime_limit'){
  if(aiStopped)return;
  aiStopped=true;
  s.aiStoppedEarly=true;
  s.aiStopReason=reason;
  s.aiActiveMs=Math.round(elapsedSeconds()*1000);
  try{BH.stopPoseLoop?.()}catch(_){}
  try{s.pose?.close?.()}catch(_){}
  s.pose=null;
  poseSendBusy=false;
}

function remainingSeconds(){
  if(!s.startedAt||!s.timeLimit)return Math.max(0,Number(s.timeLeft||0));
  return Math.max(0,Number(s.timeLimit)-(performance.now()-Number(s.startedAt))/1000);
}

function completeCurrentAccumulator(){
  try{
    const acc=s.currentAccumulator;
    if(!acc)return;
    const samples=Math.max(1,Number(acc.samples||0));
    if(!Array.isArray(s.results))s.results=[];
    const already=s.results.some(item=>item&&item.key===s.currentKey&&item.technicalCompletion===true);
    if(already)return;
    s.results.push({
      key:s.currentKey,
      name:BH.POSES?.[s.currentKey]?.name||s.currentKey||'pose',
      pose:Math.round(Number(acc.poseSum||0)/samples),
      stability:Math.round(Number(acc.stabilitySum||0)/samples),
      control:Math.round(Number(acc.controlSum||0)/samples),
      safe:Math.round(Number(acc.safeSum||0)/samples),
      confidence:Math.round(Number(acc.confidenceSum||0)/samples),
      trackedMs:Number(acc.trackedMs||0),
      validMs:Number(acc.validMs||0),
      technicalCompletion:true,
      technicalReason:'mobile_soft_deadline'
    });
  }catch(error){console.warn('[BalanceHold V43] accumulator finalize skipped',error)}
}

function hardFinish(reason='timeup_watchdog'){
  if(finishing||!phaseIsPlay())return;
  finishing=true;
  stopDeadline();
  stopAI(reason);
  completeCurrentAccumulator();
  try{
    s.timeLeft=0;
    s.softDeadlineUsed=reason==='mobile_soft_deadline';
    safeText(e.hudTime,0);
    if(e.timeBar)e.timeBar.style.width='0%';
    BH.finish(reason);
  }catch(error){
    console.error('[BalanceHold V43] finish recovery failed',error);
    try{
      s.phase='summary';
      const summary=BH.calcSummary?.(reason)||{};
      summary.softDeadlineUsed=s.softDeadlineUsed===true;
      summary.aiStoppedEarly=s.aiStoppedEarly===true;
      summary.aiStopReason=s.aiStopReason||'';
      summary.aiActiveMs=s.aiActiveMs||0;
      BH.renderSummary?.(summary);
      BH.submitSummary?.(summary);
    }catch(inner){console.error('[BalanceHold V43] emergency summary failed',inner)}
  }
  window.setTimeout(()=>{try{BH.stopCamera?.()}catch(_){}},250);
}

function deadlineTick(){
  if(!phaseIsPlay())return;
  const elapsed=elapsedSeconds();
  const left=remainingSeconds();
  s.timeLeft=left;
  safeText(e.hudTime,Math.ceil(left));
  if(e.timeBar)e.timeBar.style.width=Math.max(0,Math.min(100,left/Math.max(1,s.timeLimit)*100))+'%';

  if(!aiStopped&&elapsed>=MAX_AI_SEC)stopAI('max_ai_runtime_44s');

  // End the round before Chrome reaches the known time-zero freeze point.
  if(elapsed>=SOFT_FINISH_SEC||left<=4.0){
    hardFinish('mobile_soft_deadline');
    return;
  }

  if(left<=0.02)hardFinish('timeup_watchdog');
}

function startDeadline(){
  stopDeadline();
  finishing=false;
  aiStopped=false;
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
      if(Number(event.data.leftMs)<=4000)hardFinish('mobile_soft_deadline');
    };
    const elapsed=Math.max(0,performance.now()-startedAt);
    worker.postMessage({type:'start',durationMs:Math.max(1000,durationMs-elapsed)});
  }catch(error){
    console.warn('[BalanceHold V43] Worker unavailable, using interval',error);
  }

  intervalId=window.setInterval(deadlineTick,300);
}

BH.poseLoop=()=>{
  if(s.looping)return;
  s.looping=true;
  const run=async timestamp=>{
    if(!s.looping||aiStopped)return;
    if(e.camera?.readyState>=2&&s.pose&&!poseSendBusy&&timestamp-lastPoseSendAt>=TARGET_INTERVAL_MS){
      lastPoseSendAt=timestamp;
      poseSendBusy=true;
      try{await s.pose.send({image:e.camera})}
      catch(error){console.warn('[BalanceHold V43] pose frame skipped',error)}
      finally{poseSendBusy=false}
    }
    if(s.looping&&!aiStopped)requestAnimationFrame(run);
  };
  requestAnimationFrame(run);
};

const baseInitPose=BH.initPose;
BH.initPose=()=>{
  if(s.pose)return true;
  if(!window.Pose)return baseInitPose?.()||false;
  try{
    s.pose=new Pose({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`});
    s.pose.setOptions({modelComplexity:0,smoothLandmarks:true,enableSegmentation:false,minDetectionConfidence:.46,minTrackingConfidence:.46});
    s.pose.onResults(BH.onPoseResults);
    s.posePerformanceProfile='lite-6fps-soft-deadline-v43';
    return true;
  }catch(error){
    console.warn('[BalanceHold V43] lite pose init failed',error);
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
  stopAI(reason||'finish');
  const result=baseFinish(reason);
  window.setTimeout(()=>{try{BH.stopCamera?.()}catch(_){}},250);
  return result;
};

const baseCalcSummary=BH.calcSummary;
if(typeof baseCalcSummary==='function'){
  BH.calcSummary=reason=>{
    const summary=baseCalcSummary(reason)||{};
    summary.performanceProfile='lite-6fps-soft-deadline-v43';
    summary.softDeadlineUsed=s.softDeadlineUsed===true;
    summary.aiStoppedEarly=s.aiStoppedEarly===true;
    summary.aiStopReason=s.aiStopReason||'';
    summary.aiActiveMs=s.aiActiveMs||0;
    summary.runtimeErrors=runtimeErrors;
    return summary;
  };
}

const baseGameLoop=BH.gameLoop;
BH.gameLoop=(timestamp,token)=>{
  try{return baseGameLoop(timestamp,token)}
  catch(error){
    runtimeErrors+=1;
    console.error('[BalanceHold V43] game loop recovered',error);
    s.runtimeErrors=runtimeErrors;
    hardFinish('runtime_recovery');
  }
};

window.addEventListener('pagehide',()=>{stopDeadline();stopAI('pagehide')},{once:true});
window.addEventListener('beforeunload',()=>{stopDeadline();stopAI('beforeunload')},{once:true});

console.info('[BalanceHold] Performance watchdog ready',RELEASE);
})();