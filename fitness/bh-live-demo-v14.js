(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-LIVE-DEMO-SUMMARY-GUARD-V24';

BH.demoEvaluation=(key)=>BH.evaluatePose(s.latest,key);

BH.startLiveDemo=async()=>{
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

function decorateDemoSummary(x){
  const modal=e.resultOverlay?.querySelector('.modal');
  const icon=modal?.querySelector('.modalIcon'),title=modal?.querySelector('h2'),lead=modal?.querySelector('.lead');
  const scoreCard=modal?.querySelector('.bigScore'),replay=$('replayBtn'),csv=$('csvBtn');
  if(icon)icon.textContent='🎬';
  if(title)title.textContent='Live Demo Complete!';
  if(lead)lead.innerHTML='ทำครบทุกท่าแล้ว 🎉<br><b>รอบสาธิตนี้ไม่บันทึกคะแนน ไม่ส่ง Sheet และไม่เปลี่ยน Personal Best</b>';
  if(scoreCard){const p=scoreCard.querySelector('p');if(p)p.textContent='🎥 DEMO ONLY • ผลสำหรับทดลองระบบเท่านั้น'}
  if(replay){replay.textContent='🎥 ทดลอง Demo อีกครั้ง';replay.title='กลับไปเริ่ม Live Demo ใหม่'}
  if(csv)csv.style.display='none';
  e.status.textContent='✅ Live Demo Complete • Camera OFF • Not Saved';
  e.holdText.textContent='100%';e.holdRing.style.setProperty('--hold','360deg');e.poseBar.style.width='100%';
  e.hudPose.textContent=`${x.totalPoses}/${x.totalPoses}`;
  e.resultOverlay.classList.remove('hidden');
  s.demoSummaryShown=true;
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

function forceDemoSummary(reason='completed'){
  if(s.demoSummaryShown)return;
  s.phase='summary';stopDemoCapture();e.pauseBtn.textContent='Ⅱ';
  const x=makeDemoSummary(reason);
  try{BH.renderSummary(x)}catch(err){
    console.warn('[BalanceHold] renderSummary fallback',err);
    e.resultOverlay.innerHTML=`<section class="modal"><div class="modalHead"><div class="modalIcon">🎬</div><div><h2>Live Demo Complete!</h2><p class="lead">ทำครบทุกท่าแล้ว 🎉<br><b>ไม่บันทึกคะแนน ไม่ส่ง Sheet และไม่เปลี่ยน Personal Best</b></p></div></div><div class="summaryGrid"><div class="resultCard bigScore"><div><div class="scoreNum">${x.score||0}</div><b>DEMO ONLY</b><p>ผลสำหรับทดลองระบบเท่านั้น</p></div></div><div class="metrics"><div class="metricRow"><span>Completion</span><b>${x.completedPoses||0}/${x.totalPoses||0}</b></div><div class="metricRow"><span>Tracking</span><b>${x.trackingCoverage||0}%</b></div></div></div><div class="sheetStatus ok">✅ Demo Complete • ไม่ส่ง Google Sheet</div><div class="actions"><button class="btn primary" id="replayBtn">🎥 ทดลอง Demo อีกครั้ง</button><button class="btn blue" id="backBtn">🏠 กลับ Fitness</button></div></section>`;
    e.resultOverlay.classList.remove('hidden');
    $('replayBtn').onclick=()=>{e.resultOverlay.classList.add('hidden');e.startOverlay.classList.remove('hidden');s.phase='setup';s.calibration=null;s.demo=false};
    $('backBtn').onclick=()=>BH.plannerReturn?.(x);
  }
  decorateDemoSummary(x);
  try{BH.submitSummary(x)}catch(_){}
}

const officialFinish=BH.finish;
BH.finish=function(reason){
  if(!s.demo)return officialFinish(reason);
  if(s.demoSummaryShown)return;
  forceDemoSummary(reason);
};

const baseSubmit=BH.submitSummary;
BH.submitSummary=async x=>{
  if(!s.demo)return baseSubmit(x);
  const n=$('sheetStatus');if(n){n.textContent='✅ Demo Complete • ไม่ส่ง Google Sheet ไม่บันทึกผล และไม่เปลี่ยน Personal Best';n.className='sheetStatus ok'}
};

function finalizeDisplayedHundred(ev,p){
  if(!s.demo||s.demoFinalizing||s.demoSummaryShown||s.phase!=='play')return false;
  const lastPose=s.sequence?.length>0&&s.index===s.sequence.length-1;
  if(!lastPose||p<.995)return false;
  s.demoFinalizing=true;
  const cfg=BH.CONFIG[e.difficulty?.value]||BH.CONFIG.normal;
  const required=(cfg.hold+(s.currentKey==='boss'?450:0))*(1-(s.assistLevel||0)*.075);
  s.holdMs=Math.max(s.holdMs||0,required);e.holdText.textContent='100%';e.holdRing.style.setProperty('--hold','360deg');
  e.energyLabel.textContent='🎉 Demo Complete!';e.coachSub.textContent='ทำครบทุกท่าแล้ว • กำลังปิดกล้องและเปิดหน้าสรุป';
  setTimeout(()=>{
    if(s.demoSummaryShown)return;
    try{if(s.phase==='play')BH.completePose(ev,required)}catch(err){console.warn('[BalanceHold] completePose fallback',err)}
    setTimeout(()=>{if(!s.demoSummaryShown)forceDemoSummary('completed')},250);
  },80);
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
console.info('[BalanceHold] Live Demo Summary Guard v24 ready',RELEASE);
})();