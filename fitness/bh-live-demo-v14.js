(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-LIVE-DEMO-V14';

// Demo uses the same real MediaPipe evaluation as an official round.
// The only difference is that demo results are never persisted or submitted.
BH.demoEvaluation=(key)=>BH.evaluatePose(s.latest,key);

BH.startLiveDemo=async()=>{
  BH.syncContext();
  BH.cancelCountdown();
  s.gameToken++;
  s.demo=true;
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

// Keep demo completely outside local progress, latest result and Personal Best.
BH.finish=(()=>{
  return function(endReason){
    if(s.phase==='summary')return;
    s.phase='summary';s.gameToken++;e.pauseBtn.textContent='Ⅱ';
    const x=BH.calcSummary(endReason);
    x.demoPolicy=s.demo?'live-camera-score-off':'official';
    x.releaseVersion=BH.RELEASE_VERSION||RELEASE;
    if(!s.demo){
      try{
        localStorage.setItem(BH.KEY_LAST,JSON.stringify(x));
        if(x.isNewBest)localStorage.setItem(BH.KEY_BEST,String(x.score));
      }catch(_){}
    }
    BH.renderSummary(x);
    BH.submitSummary(x);
  };
})();

const baseSubmit=BH.submitSummary;
BH.submitSummary=async x=>{
  if(!s.demo)return baseSubmit(x);
  const n=$('sheetStatus');
  if(n){
    n.textContent='🎥 Live Demo • ตรวจ Pose ด้วยกล้องจริง • ไม่ส่ง Sheet ไม่บันทึกผล และไม่เปลี่ยน Personal Best';
    n.className='sheetStatus warn';
  }
};

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  baseUpdate(ev,p);
  if(s.demo){
    e.status.textContent=`🎥 Live Demo • Pose ${Math.round(ev.confidence)}% • Score OFF`;
    e.coachSub.textContent=ev.valid
      ?'ตรวจด้วยกล้องจริง • ผลรอบนี้ไม่ถูกบันทึก'
      :'ปรับตามคำแนะนำ • ผลรอบนี้ไม่ถูกบันทึก';
  }
};

const demoBtn=$('demoBtn');
if(demoBtn){
  demoBtn.textContent='🎥 Live Demo • กล้องจริง ไม่บันทึก';
  demoBtn.title='เปิดกล้องและตรวจ Pose จริง แต่ไม่ส่ง Sheet และไม่บันทึก Personal Best';
  demoBtn.onclick=BH.startLiveDemo;
}

if(e.status&&s.phase==='setup')e.status.textContent='📷 Pose Ready • Live Demo available';
console.info('[BalanceHold] Live Demo v14 ready',RELEASE);
})();