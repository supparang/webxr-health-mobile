(()=>{
'use strict';

const RELEASE='20260731-BALANCE-CLASSROOM-FINAL-POSE-GUARD-V48';

function installFinalPoseGuard(){
  const BH=window.BH;
  if(!BH||!BH.state||!BH.el)return;
  if(BH.__finalPoseGuardV48)return;
  BH.__finalPoseGuardV48=true;

  const s=BH.state;
  const e=BH.el;
  let nearCompleteSince=0;
  let forcing=false;

  function isPlaying(){return String(s.phase||'').toLowerCase()==='play'}
  function numberText(node){return Number(String(node?.textContent||'').replace(/[^0-9.]/g,''))||0}
  function isLastPose(){return Array.isArray(s.sequence)&&s.sequence.length>0&&Number(s.index)===s.sequence.length-1}

  function requiredHold(){
    const cfg=BH.CONFIG?.[e.difficulty?.value]||BH.CONFIG?.normal||BH.CONFIG?.easy||{};
    const assistFactor=1-Number(s.assistLevel||0)*.075;
    return Math.max(300,(Number(cfg.hold||1150)+(s.currentKey==='boss'?450:0))*assistFactor);
  }

  function forceLastPoseComplete(reason){
    if(forcing||!isPlaying()||!isLastPose())return;
    forcing=true;
    try{
      const required=requiredHold();
      s.holdMs=Math.max(Number(s.holdMs||0),required);
      const key=typeof BH.currentPoseKey==='function'?BH.currentPoseKey():s.currentKey;
      let evaluation={pose:100,stability:100,control:100,safe:100,confidence:100,valid:true,tracked:true,feetStable:true,feedback:'สำเร็จ'};
      try{
        if(typeof BH.evaluatePose==='function'&&s.latest)evaluation=BH.evaluatePose(s.latest,key)||evaluation;
      }catch(_){}
      evaluation.valid=true;
      evaluation.tracked=true;
      evaluation.pose=Math.max(85,Number(evaluation.pose||0));
      evaluation.stability=Math.max(85,Number(evaluation.stability||0));
      evaluation.control=Math.max(85,Number(evaluation.control||0));
      evaluation.safe=Math.max(85,Number(evaluation.safe||0));
      evaluation.confidence=Math.max(70,Number(evaluation.confidence||0));

      if(typeof BH.completePose==='function')BH.completePose(evaluation,required);
      if(isPlaying()&&typeof BH.finish==='function')BH.finish(reason||'completed_final_pose_guard_v48');
    }catch(error){
      console.error('[BalanceHold V48] final pose recovery failed',error);
      try{BH.finish?.('completed_final_pose_emergency_v48')}catch(_){}
    }finally{
      window.setTimeout(()=>{forcing=false},1200);
    }
  }

  const guardTimer=window.setInterval(()=>{
    if(!isPlaying()){
      nearCompleteSince=0;
      return;
    }

    if(Array.isArray(s.sequence)&&Number(s.index)>=s.sequence.length){
      try{BH.finish?.('completed_sequence_guard_v48')}catch(_){}
      return;
    }

    if(!isLastPose()){
      nearCompleteSince=0;
      return;
    }

    const required=requiredHold();
    const ratio=Number(s.holdMs||0)/Math.max(1,required);
    const visualProgress=numberText(e.holdText);
    const ready=ratio>=.985||visualProgress>=99;

    if(!ready){
      nearCompleteSince=0;
      return;
    }

    if(!nearCompleteSince)nearCompleteSince=performance.now();
    if(performance.now()-nearCompleteSince>=650){
      forceLastPoseComplete('completed_final_pose_guard_v48');
      nearCompleteSince=0;
    }
  },180);

  window.addEventListener('pagehide',()=>clearInterval(guardTimer),{once:true});

  const baseSummary=BH.calcSummary;
  if(typeof baseSummary==='function'){
    BH.calcSummary=reason=>{
      const summary=baseSummary(reason)||{};
      summary.finalPoseGuardVersion=RELEASE;
      summary.finalPoseGuardEnabled=true;
      summary.finalPoseCompletionTolerancePct=98.5;
      return summary;
    };
  }

  console.info('[BalanceHold] Final pose completion guard ready',RELEASE);
}

function loadRuntime(){
  const existing=[...document.scripts].some(script=>String(script.src||'').includes('bh-classroom-performance-watchdog-v41.js'));
  if(existing){
    installFinalPoseGuard();
    return;
  }
  const script=document.createElement('script');
  script.src='./bh-classroom-performance-watchdog-v41.js?v=20260731.48';
  script.async=false;
  script.onload=installFinalPoseGuard;
  script.onerror=()=>{
    console.error('[BalanceHold V48] performance runtime failed to load');
    installFinalPoseGuard();
  };
  document.head.appendChild(script);
}

loadRuntime();
})();