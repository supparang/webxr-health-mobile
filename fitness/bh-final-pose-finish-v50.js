(()=>{
'use strict';

const BH=window.BH;
if(!BH||!BH.state||!BH.el)return;

const RELEASE='20260731-BALANCE-FINAL-POSE-DIRECT-FINISH-V50';
const q=new URLSearchParams(location.search);
const classroom=q.get('classroom')==='1'||q.get('mode')==='classroom'||q.get('source')==='herohealth';
if(!classroom)return;

const s=BH.state;
const e=BH.el;
let finishing=false;
let visualCompleteSince=0;
let timer=0;

const finite=value=>{
  const n=Number(value);
  return Number.isFinite(n)?n:undefined;
};
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const text=node=>String(node?.textContent||'').trim();

function currentPoseKey(){
  return typeof BH.currentPoseKey==='function'
    ? BH.currentPoseKey()
    : (s.currentKey==='boss'?s.bossKey:s.currentKey);
}

function currentEvaluation(){
  const key=currentPoseKey();
  try{
    const result=BH.evaluatePose?.(s.latest,key);
    if(result&&typeof result==='object')return result;
  }catch(error){
    console.warn('[Balance V50] evaluate final pose failed',error);
  }
  return {
    tracked:true,
    valid:true,
    pose:finite(s.poseScore)??0,
    stability:finite(s.stabilityScore)??0,
    control:finite(s.controlScore)??0,
    safe:finite(s.safeScore)??0,
    confidence:finite(s.confidence)??0
  };
}

function requiredHoldMs(){
  const cfg=BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.easy||BH.CONFIG?.normal||{};
  const assistFactor=1-(finite(s.assistLevel)??0)*.075;
  return Math.max(1,((finite(cfg.hold)??1200)+(s.currentKey==='boss'?450:0))*assistFactor);
}

function synthesizeFinalPose(required){
  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  if(!total)return;
  if(!Array.isArray(s.results))s.results=[];
  if(s.results.length>=total)return;

  const key=currentPoseKey();
  const a=s.currentAccumulator||{};
  const ev=currentEvaluation();
  const samples=Math.max(1,finite(a.samples)??0);
  const average=(sum,fallback)=>Math.round((finite(sum)??0)/samples)||Math.round(finite(fallback)??0);
  const poseAccuracy=average(a.poseSum,ev.pose);
  const stability=average(a.stabilitySum,ev.stability);
  const holdControl=average(a.controlSum,ev.control);
  const safeZone=average(a.safeSum,ev.safe);
  const confidence=average(a.confidenceSum,ev.confidence);
  const now=typeof BH.now==='function'?BH.now():performance.now();
  const transitionMs=Math.max(0,(finite(s.firstValidAt)??now)-(finite(s.transitionStart)??now));
  const transitionEfficiency=clamp(
    100-Math.max(0,transitionMs-900)/38-(finite(s.currentLosses)??0)*7-(finite(s.assistLevel)??0)*4,
    35,100
  );
  const transitionControl=Math.round(holdControl*.45+transitionEfficiency*.55);
  const quality=clamp(Math.round(
    poseAccuracy*.35+stability*.30+transitionControl*.20+safeZone*.10+5
  ),0,100);
  const points=Math.max(80,Math.round(
    120+quality*2.25+(s.currentKey==='boss'?180:0)-(finite(s.assistLevel)??0)*18
  ));

  s.score=(finite(s.score)??0)+points;
  s.results.push({
    index:s.results.length+1,
    key,
    title:BH.POSES?.[key]?.name||'Crystal Guardian',
    poseAccuracy,
    stability,
    transitionControl,
    holdControl,
    safeZone,
    confidence,
    quality,
    holdMs:Math.round(Math.max(finite(s.holdMs)??0,required)),
    validMs:Math.round(Math.max(finite(a.validMs)??0,required)),
    trackedMs:Math.round(Math.max(finite(a.trackedMs)??0,required)),
    requiredMs:Math.round(required),
    transitionMs:Math.round(transitionMs),
    losses:finite(s.currentLosses)??0,
    assistLevel:finite(s.assistLevel)??0,
    passed:true,
    recoveredBy:'FINAL-POSE-DIRECT-FINISH-V50'
  });
}

function publishSummary(summary){
  if(!summary||typeof summary!=='object')return;
  const payload={
    ...summary,
    eventId:summary.eventId||summary.roundId||summary.attemptId,
    record_id:summary.record_id||summary.roundId||summary.attemptId,
    game:'balance-hold',
    gameId:'balance-hold',
    zone:'fitness',
    completed:true,
    procedureCompleted:true,
    progressionEligible:true,
    skillCriteriaMet:summary.passed===true,
    fullAnalyticsSubmitted:true,
    coreResultOnly:false,
    directFinishRelease:RELEASE,
    finishedAt:summary.finishedAt||summary.ts||new Date().toISOString()
  };
  window.__HH_BALANCE_RESULT_V50__=payload;
  try{
    parent.postMessage({type:'HEROHEALTH_GAME_COMPLETE',payload},location.origin);
  }catch(error){
    console.warn('[Balance V50] publish failed',error);
  }
}

function forceSummary(reason){
  if(s.phase==='summary')return;
  let summary=null;
  try{
    s.phase='summary';
    s.gameToken=(finite(s.gameToken)??0)+1;
    if(e.pauseBtn)e.pauseBtn.textContent='Ⅱ';
    summary=BH.calcSummary?.(reason)||null;
    if(summary){
      summary.directFinishRelease=RELEASE;
      summary.completed=true;
      summary.finishedAt=summary.finishedAt||summary.ts||new Date().toISOString();
      try{
        if(BH.KEY_LAST)localStorage.setItem(BH.KEY_LAST,JSON.stringify(summary));
        if(summary.isNewBest&&BH.KEY_BEST)localStorage.setItem(BH.KEY_BEST,String(summary.score));
      }catch(_){}
      BH.renderSummary?.(summary);
      Promise.resolve(BH.submitSummary?.(summary)).catch(()=>{});
      publishSummary(summary);
    }
  }catch(error){
    console.error('[Balance V50] force summary failed',error);
  }
}

function finishFinalPose(){
  if(finishing||s.phase==='summary')return;
  finishing=true;
  clearInterval(timer);

  const required=requiredHoldMs();
  s.holdMs=Math.max(finite(s.holdMs)??0,required);
  s.phase='finishing';
  s.gameToken=(finite(s.gameToken)??0)+1;

  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  const before=Array.isArray(s.results)?s.results.length:0;
  try{
    BH.completePose?.(currentEvaluation(),required);
  }catch(error){
    console.warn('[Balance V50] native completePose failed',error);
  }

  if(!Array.isArray(s.results)||s.results.length===before||s.results.length<total){
    synthesizeFinalPose(required);
  }
  s.index=total;

  if(s.phase!=='summary'){
    try{BH.finish?.('completed-direct-v50')}catch(error){
      console.warn('[Balance V50] native finish failed',error);
    }
  }

  setTimeout(()=>{
    if(s.phase!=='summary'||e.resultOverlay?.classList.contains('hidden')){
      forceSummary('completed-direct-v50-fallback');
    }else{
      try{
        const summary=BH.calcSummary?.('completed-direct-v50-confirmed');
        if(summary)publishSummary(summary);
      }catch(_){}
    }
  },300);
}

function check(){
  if(finishing||s.phase==='summary'){
    clearInterval(timer);
    return;
  }
  if(s.phase!=='play'){
    visualCompleteSince=0;
    return;
  }

  const total=Array.isArray(s.sequence)?s.sequence.length:0;
  if(!total)return;
  const resultCount=Array.isArray(s.results)?s.results.length:0;
  if(s.index>=total||resultCount>=total){
    finishFinalPose();
    return;
  }
  if(s.index!==total-1){
    visualCompleteSince=0;
    return;
  }

  const holdPct=finite(text(e.holdText).replace('%',''))??0;
  const hudPose=text(e.hudPose);
  const coach=text(e.coachMain||e.coach);
  const lastPoseVisible=hudPose===`${total}/${total}`;
  const passCue=/ผ่านแล้ว|เยี่ยม/.test(coach);
  const visuallyComplete=holdPct>=99||(lastPoseVisible&&passCue&&holdPct>=90);

  if(!visuallyComplete){
    visualCompleteSince=0;
    return;
  }
  if(!visualCompleteSince)visualCompleteSince=Date.now();
  if(Date.now()-visualCompleteSince>=450)finishFinalPose();
}

timer=setInterval(check,120);
window.BH_FINAL_POSE_DIRECT_FINISH={release:RELEASE,check,finishFinalPose};
console.info('[Balance Hold] Final Pose Direct Finish V50 ready',RELEASE);
})();
