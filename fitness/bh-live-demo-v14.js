(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-LIVE-DEMO-ENDSCREEN-V25';

BH.demoEvaluation=(key)=>BH.evaluatePose(s.latest,key);

function removeDemoEnd(){document.getElementById('bhDemoEndV25')?.remove()}

BH.startLiveDemo=async()=>{
  removeDemoEnd();
  BH.syncContext();BH.cancelCountdown();s.gameToken++;
  s.demo=true;s.demoFinalizing=false;s.demoSummaryShown=false;
  s.roundId=BH.stableId('BHLIVEDEMO');s.calValidMs=0;s.calLast=BH.now();s.calHistory=[];
  s.smooth=null;s.latest=null;s.latestAt=0;s.calibration=null;s.phase='camera';
  const ready=await BH.startCamera();
  if(!ready){s.demo=false;s.phase='setup';return}
  if(!BH.initPose()){s.demo=false;s.phase='setup';BH.stopCamera();return}
  BH.poseLoop();e.startOverlay.classList.add('hidden');e.calibrationOverlay.classList.remove('hidden');
  s.phase='calibration';e.status.textContent='🎥 Live Demo • Camera ON • Score OFF';
  BH.setCoach('Live Demo: ถอยให้เห็นทั้งตัว แล้วกางแขนระดับไหล่','ระบบตรวจท่าจริง แต่ไม่บันทึกคะแนนหรือส่งข้อมูล','🎥','LIVE DEMO');
};

function stopDemoCapture(){
  s.gameToken++;
  try{BH.stopCamera?.()}catch(_){}
  try{const ctx=e.poseCanvas?.getContext?.('2d');if(ctx)ctx.clearRect(0,0,e.poseCanvas.width,e.poseCanvas.height)}catch(_){}
}

function makeDemoSummary(reason='completed'){
  let x;
  try{x=BH.calcSummary(reason)}catch(err){
    console.warn('[BalanceHold] calcSummary fallback',err);
    x={reason,score:s.score||0,assessmentScore:0,poseAccuracy:0,stabilityScore:0,transitionScore:0,
      safeZoneScore:0,trackingCoverage:0,lostPoseCount:s.lostPoseCount||0,assistLevelMax:s.maxAssistUsed||0,
      completedPoses:s.results?.length||0,totalPoses:s.sequence?.length||0,poseResults:s.results||[],rank:'Demo',
      official:false,passed:true,isNewBest:false,previousBest:0,advice:'ทดลองระบบเรียบร้อยแล้ว'};
  }
  x.official=false;x.demoPolicy='live-camera-score-off';x.demoCompleted=true;x.releaseVersion=RELEASE;
  return x;
}

function showIndependentDemoEnd(x){
  removeDemoEnd();
  const done=Math.max(x.completedPoses||0,s.sequence?.length||0);
  const total=Math.max(1,x.totalPoses||s.sequence?.length||1);
  const screen=document.createElement('section');
  screen.id='bhDemoEndV25';
  screen.setAttribute('role','dialog');screen.setAttribute('aria-modal','true');
  screen.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:rgba(2,6,23,.94);backdrop-filter:blur(12px);font-family:inherit';
  screen.innerHTML=`<div style="width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:30px;padding:26px;background:linear-gradient(180deg,#effcff,#ffffff);color:#0f172a;border:3px solid #67e8f9;box-shadow:0 30px 100px rgba(0,0,0,.65);text-align:center">
    <div style="font-size:64px">🎬</div>
    <h2 style="font-size:clamp(28px,5vw,48px);margin:4px 0 8px">Live Demo Complete!</h2>
    <p style="font-size:18px;line-height:1.55;margin:0 0 18px">ทำครบทุกท่าแล้ว 🎉<br><b>รอบสาธิตนี้ไม่บันทึกคะแนน ไม่ส่ง Google Sheet และไม่เปลี่ยน Personal Best</b></p>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0">
      <div style="padding:14px;border-radius:18px;background:#ecfeff"><small>COMPLETION</small><div style="font-size:28px;font-weight:1000">${done}/${total}</div></div>
      <div style="padding:14px;border-radius:18px;background:#f0fdf4"><small>TRACKING</small><div style="font-size:28px;font-weight:1000">${Math.round(x.trackingCoverage||0)}%</div></div>
      <div style="padding:14px;border-radius:18px;background:#fefce8"><small>MODE</small><div style="font-size:22px;font-weight:1000">DEMO ONLY</div></div>
    </div>
    <div style="padding:12px;border-radius:16px;background:#dcfce7;color:#166534;font-weight:900;margin-bottom:18px">✅ Camera OFF • Not Saved</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      <button id="bhDemoReplayV25" type="button" style="min-height:56px;border:0;border-radius:17px;background:linear-gradient(135deg,#06b6d4,#2563eb);color:white;font-size:17px;font-weight:1000;cursor:pointer">🎥 ทดลอง Demo อีกครั้ง</button>
      <button id="bhDemoBackV25" type="button" style="min-height:56px;border:0;border-radius:17px;background:#0f172a;color:white;font-size:17px;font-weight:1000;cursor:pointer">🏠 กลับ Fitness</button>
    </div>
  </div>`;
  document.body.appendChild(screen);
  document.getElementById('bhDemoReplayV25').onclick=()=>{
    removeDemoEnd();
    e.resultOverlay?.classList.add('hidden');e.startOverlay.classList.remove('hidden');
    s.phase='setup';s.calibration=null;s.demo=false;s.demoFinalizing=false;s.demoSummaryShown=false;
  };
  document.getElementById('bhDemoBackV25').onclick=()=>{
    const hub=BH.q?.('hub','./hub.html')||'./hub.html';location.href=hub;
  };
  s.demoSummaryShown=true;
  e.status.textContent='✅ Live Demo Complete • Camera OFF • Not Saved';
}

function forceDemoEnd(reason='completed'){
  if(s.demoSummaryShown)return;
  s.phase='summary';stopDemoCapture();e.pauseBtn.textContent='Ⅱ';
  const x=makeDemoSummary(reason);
  showIndependentDemoEnd(x);
}

const officialFinish=BH.finish;
BH.finish=function(reason){
  if(!s.demo)return officialFinish(reason);
  forceDemoEnd(reason);
};

const baseSubmit=BH.submitSummary;
BH.submitSummary=async x=>{if(!s.demo)return baseSubmit(x)};

function finalizeDisplayedHundred(ev,p){
  if(!s.demo||s.demoFinalizing||s.demoSummaryShown||s.phase!=='play')return false;
  const lastPose=s.sequence?.length>0&&s.index===s.sequence.length-1;
  if(!lastPose||p<.995)return false;
  s.demoFinalizing=true;
  const cfg=BH.CONFIG[e.difficulty?.value]||BH.CONFIG.normal;
  const required=(cfg.hold+(s.currentKey==='boss'?450:0))*(1-(s.assistLevel||0)*.075);
  s.holdMs=Math.max(s.holdMs||0,required);
  e.holdText.textContent='100%';e.holdRing.style.setProperty('--hold','360deg');
  e.energyLabel.textContent='🎉 Demo Complete!';e.coachSub.textContent='ทำครบทุกท่าแล้ว • กำลังเปิดหน้าจบ Demo';
  setTimeout(()=>{
    try{
      if(s.phase==='play'&&s.results?.length<(s.sequence?.length||0))BH.completePose(ev,required);
    }catch(err){console.warn('[BalanceHold] completePose bypassed',err)}
    setTimeout(()=>forceDemoEnd('completed'),120);
  },60);
  return true;
}

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  if(s.demoSummaryShown||s.phase==='summary')return;
  baseUpdate(ev,p);
  if(s.demo){
    e.status.textContent=`🎥 Live Demo • Pose ${Math.round(ev.confidence)}% • Score OFF`;
    e.coachSub.textContent=ev.valid?'ตรวจด้วยกล้องจริง • ผลรอบนี้ไม่ถูกบันทึก':'ปรับตามคำแนะนำ • ผลรอบนี้ไม่ถูกบันทึก';
    const lastPose=s.sequence?.length>0&&s.index===s.sequence.length-1;
    if(lastPose&&p>=.92){e.energyLabel.textContent='ท่าสุดท้าย • ค้างให้ครบ 100%';e.coachSub.textContent='อีกนิดเดียว Demo จะจบและหยุดกล้องอัตโนมัติ'}
    finalizeDisplayedHundred(ev,p);
  }
};

const demoBtn=$('demoBtn');
if(demoBtn){demoBtn.textContent='🎥 Live Demo • กล้องจริง ไม่บันทึก';demoBtn.title='เปิดกล้องและตรวจ Pose จริง แต่ไม่ส่ง Sheet และไม่บันทึก Personal Best';demoBtn.onclick=BH.startLiveDemo}
if(e.status&&s.phase==='setup')e.status.textContent='📷 Pose Ready • Live Demo available';
console.info('[BalanceHold] Independent Demo End Screen v25 ready',RELEASE);
})();