(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-LIVE-DEMO-FINALIZE-V23';

// Demo uses the same real MediaPipe evaluation as an official round.
// The only difference is that demo results are never persisted or submitted.
BH.demoEvaluation=(key)=>BH.evaluatePose(s.latest,key);

BH.startLiveDemo=async()=>{
  BH.syncContext();
  BH.cancelCountdown();
  s.gameToken++;
  s.demo=true;
  s.demoFinalizing=false;
  s.roundId=BH.stableId('BHLIVEDEMO');
  s.calValidMs=0;
  s.calLast=BH.now();
  s.calHistory=[];
  s.smooth=null;
  s.latest=null;
  s.latestAt=0;
  s.calibration=null;
  s.phase='camera';

  const ready=await BH.startCamera();
  if(!ready){s.demo=false;s.phase='setup';return}
  if(!BH.initPose()){
    s.demo=false;s.phase='setup';
    BH.stopCamera();
    return;
  }

  BH.poseLoop();
  e.startOverlay.classList.add('hidden');
  e.calibrationOverlay.classList.remove('hidden');
  s.phase='calibration';
  e.status.textContent='🎥 Live Demo • Camera ON • Score OFF';
  BH.setCoach(
    'Live Demo: ถอยให้เห็นทั้งตัว แล้วกางแขนระดับไหล่',
    'ระบบตรวจท่าจริง แต่ไม่บันทึกคะแนนหรือส่งข้อมูล',
    '🎥','LIVE DEMO'
  );
};

function stopDemoCapture(){
  s.gameToken++;
  try{BH.stopCamera?.()}catch(_){ }
  try{
    const ctx=e.poseCanvas?.getContext?.('2d');
    if(ctx)ctx.clearRect(0,0,e.poseCanvas.width,e.poseCanvas.height);
  }catch(_){ }
}

function decorateDemoSummary(x){
  if(!s.demo)return;
  const modal=e.resultOverlay?.querySelector('.modal');
  const icon=modal?.querySelector('.modalIcon');
  const title=modal?.querySelector('h2');
  const lead=modal?.querySelector('.lead');
  const scoreCard=modal?.querySelector('.bigScore');
  const replay=$('replayBtn');
  const csv=$('csvBtn');

  if(icon)icon.textContent='🎬';
  if(title)title.textContent='Live Demo Complete!';
  if(lead)lead.innerHTML='ทำครบทุกท่าแล้ว 🎉<br><b>รอบสาธิตนี้ไม่บันทึกคะแนน ไม่ส่ง Sheet และไม่เปลี่ยน Personal Best</b>';
  if(scoreCard){
    const p=scoreCard.querySelector('p');
    if(p)p.textContent='🎥 DEMO ONLY • ผลสำหรับทดลองระบบเท่านั้น';
  }
  if(replay){
    replay.textContent='🎥 ทดลอง Demo อีกครั้ง';
    replay.title='กลับไปเริ่ม Live Demo ใหม่';
  }
  if(csv)csv.style.display='none';
  e.status.textContent='✅ Live Demo Complete • Camera OFF • Not Saved';
  e.holdText.textContent='100%';
  e.holdRing.style.setProperty('--hold','360deg');
  e.poseBar.style.width='100%';
  e.hudPose.textContent=`${x.totalPoses}/${x.totalPoses}`;
}

// Keep demo completely outside local progress, latest result and Personal Best.
BH.finish=(()=>{
  return function(endReason){
    if(s.phase==='summary')return;
    const wasDemo=!!s.demo;
    s.phase='summary';
    s.gameToken++;
    e.pauseBtn.textContent='Ⅱ';
    if(wasDemo)stopDemoCapture();

    const x=BH.calcSummary(endReason);
    x.demoPolicy=wasDemo?'live-camera-score-off':'official';
    x.releaseVersion=BH.RELEASE_VERSION||RELEASE;
    x.demoCompleted=wasDemo&&endReason==='completed';

    if(!wasDemo){
      try{
        localStorage.setItem(BH.KEY_LAST,JSON.stringify(x));
        if(x.isNewBest)localStorage.setItem(BH.KEY_BEST,String(x.score));
      }catch(_){ }
    }

    BH.renderSummary(x);
    if(wasDemo)decorateDemoSummary(x);
    BH.submitSummary(x);
  };
})();

const baseSubmit=BH.submitSummary;
BH.submitSummary=async x=>{
  if(!s.demo)return baseSubmit(x);
  const n=$('sheetStatus');
  if(n){
    n.textContent='✅ Demo Complete • ไม่ส่ง Google Sheet ไม่บันทึกผล และไม่เปลี่ยน Personal Best';
    n.className='sheetStatus ok';
  }
};

function finalizeDisplayedHundred(ev,p){
  if(!s.demo||s.demoFinalizing||s.phase!=='play')return false;
  const lastPose=s.sequence?.length>0&&s.index===s.sequence.length-1;
  if(!lastPose||p<.995)return false;

  s.demoFinalizing=true;
  const cfg=BH.CONFIG[e.difficulty?.value]||BH.CONFIG.normal;
  const assistHoldFactor=1-(s.assistLevel||0)*.075;
  const required=(cfg.hold+(s.currentKey==='boss'?450:0))*assistHoldFactor;
  s.holdMs=Math.max(s.holdMs||0,required);
  e.holdText.textContent='100%';
  e.holdRing.style.setProperty('--hold','360deg');
  e.energyLabel.textContent='🎉 Demo Complete!';
  e.coachSub.textContent='ทำครบทุกท่าแล้ว • กำลังปิดกล้องและเปิดหน้าสรุป';

  // Complete through the normal path so the final pose is included in 7/7 results.
  setTimeout(()=>{
    if(s.phase!=='play')return;
    try{BH.completePose(ev,required)}
    catch(err){console.warn('[BalanceHold] demo finalizer fallback',err);BH.finish('completed')}
  },80);
  return true;
}

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  baseUpdate(ev,p);
  if(s.demo){
    e.status.textContent=`🎥 Live Demo • Pose ${Math.round(ev.confidence)}% • Score OFF`;
    e.coachSub.textContent=ev.valid
      ?'ตรวจด้วยกล้องจริง • ผลรอบนี้ไม่ถูกบันทึก'
      :'ปรับตามคำแนะนำ • ผลรอบนี้ไม่ถูกบันทึก';

    const lastPose=s.sequence?.length>0&&s.index===s.sequence.length-1;
    if(lastPose&&p>=.92){
      e.energyLabel.textContent='ท่าสุดท้าย • ค้างให้ครบ 100%';
      e.coachSub.textContent='อีกนิดเดียว Demo จะจบและหยุดกล้องอัตโนมัติ';
    }
    finalizeDisplayedHundred(ev,p);
  }
};

const demoBtn=$('demoBtn');
if(demoBtn){
  demoBtn.textContent='🎥 Live Demo • กล้องจริง ไม่บันทึก';
  demoBtn.title='เปิดกล้องและตรวจ Pose จริง แต่ไม่ส่ง Sheet และไม่บันทึก Personal Best';
  demoBtn.onclick=BH.startLiveDemo;
}

if(e.status&&s.phase==='setup')e.status.textContent='📷 Pose Ready • Live Demo available';
console.info('[BalanceHold] Live Demo Finalize v23 ready',RELEASE);
})();