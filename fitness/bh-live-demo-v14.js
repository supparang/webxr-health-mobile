(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-ATOMIC-END-V29';
const officialFinish=BH.finish;
const officialSubmit=BH.submitSummary;
const baseStartGame=BH.startGame;

BH.demoEvaluation=key=>BH.evaluatePose(s.latest,key);

function stopCapture(){
  s.gameToken++;
  try{BH.stopCamera?.()}catch(_){ }
  try{
    const c=e.poseCanvas,ctx=c?.getContext?.('2d');
    if(ctx)ctx.clearRect(0,0,c.width,c.height);
  }catch(_){ }
}

function demoStats(){
  let tracking=0;
  try{tracking=Math.round(BH.clamp(s.roundDetectedMs/Math.max(1,s.roundTrackedMs)*100,0,100))}catch(_){ }
  return{score:Number(s.score||0),tracking,total:Math.max(1,s.sequence?.length||0)};
}

function showAtomicDemoEnd(){
  if(s.demoEndShown)return;
  s.demoEndShown=true;s.demoFinalizing=true;s.phase='summary';stopCapture();
  const x=demoStats();
  const hub=(()=>{try{return new URL(BH.q?.('hub','./hub.html')||'./hub.html',location.href).href}catch(_){return './hub.html'}})();
  const screen=document.createElement('main');
  screen.id='bhDemoAtomicEnd';
  screen.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:linear-gradient(160deg,#061326,#0f2745);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a';
  screen.innerHTML=`<section style="width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:30px;padding:28px;background:#fff;border:4px solid #67e8f9;box-shadow:0 30px 100px rgba(0,0,0,.65);text-align:center">
    <div style="font-size:68px">🎬</div><h1 style="font-size:clamp(30px,5vw,50px);margin:4px 0 8px">Live Demo Complete!</h1>
    <p style="font-size:18px;line-height:1.55;margin:0 0 18px">ทำครบทุกท่าแล้ว 🎉<br><b>รอบนี้เป็นการทดลอง ไม่บันทึกคะแนน ไม่ส่ง Google Sheet และไม่เปลี่ยน Personal Best</b></p>
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0">
      <div style="padding:15px;border-radius:18px;background:#ecfeff"><small>COMPLETION</small><div style="font-size:30px;font-weight:1000">${x.total}/${x.total}</div></div>
      <div style="padding:15px;border-radius:18px;background:#f0fdf4"><small>TRACKING</small><div style="font-size:30px;font-weight:1000">${x.tracking}%</div></div>
      <div style="padding:15px;border-radius:18px;background:#fefce8"><small>MODE</small><div style="font-size:22px;font-weight:1000">DEMO ONLY</div></div>
    </div>
    <div style="padding:13px;border-radius:16px;background:#dcfce7;color:#166534;font-weight:950;margin-bottom:18px">✅ Camera OFF • Not Saved</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><button id="bhAtomicReplay" type="button" style="min-height:58px;border:0;border-radius:17px;background:linear-gradient(135deg,#06b6d4,#2563eb);color:#fff;font-size:17px;font-weight:1000;cursor:pointer">🎥 ทดลอง Demo อีกครั้ง</button><button id="bhAtomicBack" type="button" style="min-height:58px;border:0;border-radius:17px;background:#0f172a;color:#fff;font-size:17px;font-weight:1000;cursor:pointer">🏠 กลับ Fitness</button></div>
  </section>`;
  document.body.replaceChildren(screen);
  document.getElementById('bhAtomicReplay').onclick=()=>location.reload();
  document.getElementById('bhAtomicBack').onclick=()=>{location.href=hub};
  document.title='Live Demo Complete • Balance Hold';
}

BH.startGame=function(){
  s.officialFinalizing=false;
  s.demoFinalizing=false;
  s.demoEndShown=false;
  return baseStartGame();
};

BH.startLiveDemo=async()=>{
  BH.syncContext();BH.cancelCountdown();s.gameToken++;
  s.demo=true;s.demoFinalizing=false;s.demoEndShown=false;s.officialFinalizing=false;
  s.roundId=BH.stableId('BHLIVEDEMO');s.calValidMs=0;s.calLast=BH.now();s.calHistory=[];
  s.smooth=null;s.latest=null;s.latestAt=0;s.calibration=null;s.phase='camera';
  const ready=await BH.startCamera();
  if(!ready){s.demo=false;s.phase='setup';return}
  if(!BH.initPose()){s.demo=false;s.phase='setup';BH.stopCamera();return}
  BH.poseLoop();e.startOverlay.classList.add('hidden');e.calibrationOverlay.classList.remove('hidden');
  s.phase='calibration';e.status.textContent='🎥 Live Demo • Camera ON • Score OFF';
  BH.setCoach('Live Demo: ถอยให้เห็นทั้งตัว แล้วกางแขนระดับไหล่','ระบบตรวจท่าจริง แต่ไม่บันทึกคะแนนหรือส่งข้อมูล','🎥','LIVE DEMO');
};

BH.finish=reason=>{
  if(!s.demo)return officialFinish(reason);
  showAtomicDemoEnd();
};

BH.submitSummary=async x=>{if(!s.demo)return officialSubmit(x)};

function finalizeOfficial(ev,p){
  if(s.demo||s.phase!=='play'||s.officialFinalizing)return false;
  const last=s.sequence?.length>0&&s.index===s.sequence.length-1;
  if(!last||p<.99)return false;
  s.officialFinalizing=true;
  const cfg=BH.CONFIG[e.difficulty?.value]||BH.CONFIG.normal;
  const required=(cfg.hold+(s.currentKey==='boss'?450:0))*(1-(s.assistLevel||0)*.075);
  s.holdMs=Math.max(s.holdMs||0,required);
  e.holdText.textContent='100%';e.holdRing.style.setProperty('--hold','360deg');
  e.energyLabel.textContent='🎉 ภารกิจสำเร็จ!';e.coachSub.textContent='กำลังบันทึกผลและเปิดหน้าสรุป';
  try{
    BH.completePose(ev,required);
  }catch(err){
    console.error('[BalanceHold] official complete error',err);
    try{officialFinish('completed')}catch(inner){console.error('[BalanceHold] official finish error',inner)}
  }
  requestAnimationFrame(()=>{
    if(s.phase!=='summary'){
      console.warn('[BalanceHold] official summary watchdog');
      try{officialFinish('completed')}catch(err){console.error('[BalanceHold] watchdog finish error',err)}
    }
  });
  return true;
}

const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{
  if(s.demoEndShown||s.phase==='summary')return;
  baseUpdate(ev,p);
  const last=s.sequence?.length>0&&s.index===s.sequence.length-1;
  if(!s.demo){
    if(last&&p>=.99)finalizeOfficial(ev,p);
    return;
  }
  e.status.textContent=`🎥 Live Demo • Pose ${Math.round(ev.confidence)}% • Score OFF`;
  if(last&&p>=.99){
    e.holdText.textContent='100%';e.holdRing.style.setProperty('--hold','360deg');e.energyLabel.textContent='🎉 Demo Complete!';showAtomicDemoEnd();return;
  }
  e.coachSub.textContent=ev.valid?'ตรวจด้วยกล้องจริง • ผลรอบนี้ไม่ถูกบันทึก':'ปรับตามคำแนะนำ • ผลรอบนี้ไม่ถูกบันทึก';
};

const demoBtn=$('demoBtn');
if(demoBtn){demoBtn.textContent='🎥 Live Demo • กล้องจริง ไม่บันทึก';demoBtn.title='เปิดกล้องและตรวจ Pose จริง แต่ไม่ส่ง Sheet และไม่บันทึก Personal Best';demoBtn.onclick=BH.startLiveDemo}
if(e.status&&s.phase==='setup')e.status.textContent='📷 Pose Ready • Live Demo available';
console.info('[BalanceHold] Atomic Demo + Official End v29 ready',RELEASE);
})();