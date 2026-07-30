(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260730-BALANCE-CLASSROOM-ULTRALITE-AXIS-V45';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const s=BH.state;
const e=BH.el;
const SNAPSHOT_INTERVAL_MS=500;
const MAX_AI_SEC=48;
const ROUND_END_SEC=58;
const inputCanvas=document.createElement('canvas');
inputCanvas.width=192;
inputCanvas.height=144;
const inputContext=inputCanvas.getContext('2d',{alpha:false,desynchronized:true});
let timer=0;
let deadlineWorker=null;
let deadlineUrl='';
let poseBusy=false;
let lastPoseAt=0;
let aiStopped=false;
let finishing=false;
let runtimeErrors=0;

function isPlaying(){return String(s.phase||'').toLowerCase()==='play'}
function elapsed(){return s.startedAt?Math.max(0,(performance.now()-Number(s.startedAt))/1000):0}
function remaining(){return Math.max(0,Number(s.timeLimit||60)-elapsed())}
function setText(node,value){if(node)node.textContent=String(value)}
function visible(point,minimum=.22){return !!point&&Number(point.v||0)>=minimum}

BH.poseFresh=()=>!!(s.latest&&BH.now()-s.latestAt<1350);

// Lightweight body axis: head, shoulder line, torso, hips and knees only.
// This gives visible body-detection feedback without restoring the expensive full skeleton.
BH.drawPose=landmarks=>{
  try{
    const canvas=e.canvas;
    if(!canvas)return;
    const context=canvas.getContext('2d');
    if(!context)return;
    const dpr=Math.min(1.5,window.devicePixelRatio||1);
    const cssWidth=Math.max(1,canvas.clientWidth||canvas.width/dpr||1);
    const cssHeight=Math.max(1,canvas.clientHeight||canvas.height/dpr||1);
    const targetWidth=Math.round(cssWidth*dpr);
    const targetHeight=Math.round(cssHeight*dpr);
    if(canvas.width!==targetWidth||canvas.height!==targetHeight){canvas.width=targetWidth;canvas.height=targetHeight}
    context.clearRect(0,0,canvas.width,canvas.height);
    if(!Array.isArray(landmarks))return;

    const point=index=>{
      const p=landmarks[index];
      if(!p)return null;
      return {x:Number(p.x||0)*canvas.width,y:Number(p.y||0)*canvas.height,v:Number(p.v||0)};
    };
    const head=point(0),ls=point(11),rs=point(12),lh=point(23),rh=point(24),lk=point(25),rk=point(26);
    if(!visible(head)||!visible(ls)||!visible(rs)||!visible(lh)||!visible(rh))return;

    const shoulderMid={x:(ls.x+rs.x)/2,y:(ls.y+rs.y)/2};
    const hipMid={x:(lh.x+rh.x)/2,y:(lh.y+rh.y)/2};
    const axisPoints=[head,shoulderMid,hipMid];

    context.save();
    context.lineCap='round';
    context.lineJoin='round';
    context.shadowColor='rgba(0,0,0,.45)';
    context.shadowBlur=6*dpr;

    const drawSegment=(a,b,width=5,alpha=.95)=>{
      if(!a||!b)return;
      context.beginPath();
      context.moveTo(a.x,a.y);
      context.lineTo(b.x,b.y);
      context.lineWidth=width*dpr;
      context.strokeStyle=`rgba(52,211,153,${alpha})`;
      context.stroke();
    };

    drawSegment(ls,rs,5.5,1);
    drawSegment(lh,rh,5,1);
    drawSegment(axisPoints[0],axisPoints[1],6,1);
    drawSegment(axisPoints[1],axisPoints[2],6,1);
    if(visible(lk))drawSegment(lh,lk,5,.92);
    if(visible(rk))drawSegment(rh,rk,5,.92);

    [head,ls,rs,lh,rh,visible(lk)?lk:null,visible(rk)?rk:null].forEach((p,index)=>{
      if(!p)return;
      context.beginPath();
      context.arc(p.x,p.y,(index===0?7:5.5)*dpr,0,Math.PI*2);
      context.fillStyle=index===0?'#fde047':'#34d399';
      context.fill();
      context.lineWidth=2*dpr;
      context.strokeStyle='rgba(255,255,255,.95)';
      context.stroke();
    });

    context.restore();
    s.bodyAxisVisible=true;
  }catch(error){
    runtimeErrors++;
    console.warn('[BalanceHold V45] body axis draw skipped',error);
  }
};

if(e.showSkeleton)e.showSkeleton.checked=true;

function stopClock(){
  if(timer){clearInterval(timer);timer=0}
  if(deadlineWorker){try{deadlineWorker.postMessage({type:'stop'})}catch(_){}try{deadlineWorker.terminate()}catch(_){}deadlineWorker=null}
  if(deadlineUrl){try{URL.revokeObjectURL(deadlineUrl)}catch(_){}deadlineUrl=''}
}

function stopAI(reason='finish'){
  if(aiStopped)return;
  aiStopped=true;
  s.aiStoppedEarly=true;
  s.aiStopReason=reason;
  s.aiActiveMs=Math.round(elapsed()*1000);
  try{BH.stopPoseLoop?.()}catch(_){}
  if(!poseBusy){try{s.pose?.close?.()}catch(_){}s.pose=null}
}

function finishRound(reason='mobile_deadline'){
  if(finishing||!isPlaying())return;
  finishing=true;
  stopClock();
  stopAI(reason);
  s.timeLeft=0;
  setText(e.hudTime,0);
  if(e.timeBar)e.timeBar.style.width='0%';
  try{BH.finish(reason)}catch(error){
    console.error('[BalanceHold V45] normal finish failed',error);
    try{
      s.phase='summary';
      const summary=BH.calcSummary?.(reason)||{};
      summary.performanceProfile='snapshot-192x144-2fps-axis-v45';
      summary.runtimeErrors=runtimeErrors;
      BH.renderSummary?.(summary);
      BH.submitSummary?.(summary);
    }catch(inner){console.error('[BalanceHold V45] emergency summary failed',inner)}
  }
  window.setTimeout(()=>{try{BH.stopCamera?.()}catch(_){}},350);
}

function clockTick(){
  if(!isPlaying())return;
  const seconds=elapsed();
  const left=remaining();
  s.timeLeft=left;
  setText(e.hudTime,Math.ceil(left));
  if(e.timeBar)e.timeBar.style.width=Math.max(0,Math.min(100,left/Math.max(1,s.timeLimit)*100))+'%';
  if(!aiStopped&&seconds>=MAX_AI_SEC)stopAI('mobile_ai_limit_48s');
  if(seconds>=ROUND_END_SEC||left<=2)finishRound('mobile_deadline_v45');
}

function startClock(){
  stopClock();
  finishing=false;
  aiStopped=false;
  timer=window.setInterval(clockTick,350);
  try{
    const source=`let t=0,d=0;onmessage=e=>{const x=e.data||{};if(x.type==='start'){clearInterval(t);d=Date.now()+x.ms;t=setInterval(()=>postMessage(Math.max(0,d-Date.now())),300)}else if(x.type==='stop'){clearInterval(t);close()}}`;
    deadlineUrl=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));
    deadlineWorker=new Worker(deadlineUrl);
    deadlineWorker.onmessage=event=>{if(isPlaying()&&Number(event.data)<=2000)finishRound('worker_deadline_v45')};
    deadlineWorker.postMessage({type:'start',ms:Math.max(1000,Number(s.timeLimit||60)*1000)});
  }catch(error){console.warn('[BalanceHold V45] deadline worker unavailable',error)}
}

BH.poseLoop=()=>{
  if(s.looping)return;
  s.looping=true;
  const run=async timestamp=>{
    if(!s.looping||aiStopped)return;
    if(e.camera?.readyState>=2&&s.pose&&!poseBusy&&timestamp-lastPoseAt>=SNAPSHOT_INTERVAL_MS){
      lastPoseAt=timestamp;
      poseBusy=true;
      try{
        inputContext.setTransform(1,0,0,1,0,0);
        inputContext.fillStyle='#000';
        inputContext.fillRect(0,0,inputCanvas.width,inputCanvas.height);
        inputContext.drawImage(e.camera,0,0,inputCanvas.width,inputCanvas.height);
        await s.pose.send({image:inputCanvas});
      }catch(error){
        runtimeErrors++;
        console.warn('[BalanceHold V45] pose snapshot skipped',error);
      }finally{
        poseBusy=false;
        if(aiStopped){try{s.pose?.close?.()}catch(_){}s.pose=null}
      }
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
    s.pose.setOptions({modelComplexity:0,smoothLandmarks:false,enableSegmentation:false,minDetectionConfidence:.42,minTrackingConfidence:.42});
    s.pose.onResults(BH.onPoseResults);
    s.posePerformanceProfile='snapshot-192x144-2fps-axis-v45';
    return true;
  }catch(error){
    console.warn('[BalanceHold V45] pose init failed',error);
    s.pose=null;
    return baseInitPose?.()||false;
  }
};

const baseStartGame=BH.startGame;
BH.startGame=()=>{const result=baseStartGame();startClock();return result};

const baseFinish=BH.finish;
BH.finish=reason=>{
  if(finishing&&String(s.phase||'').toLowerCase()==='summary')return;
  finishing=true;stopClock();stopAI(reason||'finish');
  const result=baseFinish(reason);
  window.setTimeout(()=>{try{BH.stopCamera?.()}catch(_){}},350);
  return result;
};

const baseSummary=BH.calcSummary;
if(typeof baseSummary==='function'){
  BH.calcSummary=reason=>{
    const summary=baseSummary(reason)||{};
    summary.performanceProfile='snapshot-192x144-2fps-axis-v45';
    summary.poseInferenceFps=2;
    summary.poseInferenceWidth=192;
    summary.poseInferenceHeight=144;
    summary.bodyAxisOverlay=true;
    summary.bodyAxisProfile='head-shoulders-torso-hips-knees-lite';
    summary.aiStoppedEarly=s.aiStoppedEarly===true;
    summary.aiStopReason=s.aiStopReason||'';
    summary.aiActiveMs=s.aiActiveMs||0;
    summary.runtimeErrors=runtimeErrors;
    return summary;
  };
}

const baseGameLoop=BH.gameLoop;
BH.gameLoop=(timestamp,token)=>{
  try{return baseGameLoop(timestamp,token)}catch(error){
    runtimeErrors++;
    console.error('[BalanceHold V45] game loop error',error);
    finishRound('runtime_recovery_v45');
  }
};

window.addEventListener('pagehide',()=>{stopClock();stopAI('pagehide')},{once:true});
window.addEventListener('beforeunload',()=>{stopClock();stopAI('beforeunload')},{once:true});

console.info('[BalanceHold] Ultra-lite body-axis runtime ready',RELEASE);
})();
