(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-ATOMIC-END-V30';
const officialSubmit=BH.submitSummary;
const baseStartGame=BH.startGame;

BH.demoEvaluation=key=>BH.evaluatePose(s.latest,key);

function stopCapture(){
  s.gameToken++;
  try{BH.stopCamera?.()}catch(_){}
  try{const c=e.poseCanvas,ctx=c?.getContext?.('2d');if(ctx)ctx.clearRect(0,0,c.width,c.height)}catch(_){}
}
function hubUrl(){try{return new URL(BH.q?.('hub','./hub.html')||'./hub.html',location.href).href}catch(_){return './hub.html'}}
function metricBox(label,value,bg){return `<div style="padding:14px;border-radius:18px;background:${bg}"><small>${label}</small><div style="font-size:28px;font-weight:1000">${value}</div></div>`}
function showScreen({demo,x}){
  stopCapture();s.phase='summary';
  const screen=document.createElement('main');
  screen.id=demo?'bhDemoAtomicEnd':'bhOfficialAtomicEnd';
  screen.style.cssText='position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:18px;background:linear-gradient(160deg,#061326,#0f2745);font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#0f172a';
  if(demo){
    const total=Math.max(1,s.sequence?.length||0),tracking=Math.round(BH.clamp(s.roundDetectedMs/Math.max(1,s.roundTrackedMs)*100,0,100));
    screen.innerHTML=`<section style="width:min(720px,100%);max-height:92vh;overflow:auto;border-radius:30px;padding:28px;background:#fff;border:4px solid #67e8f9;box-shadow:0 30px 100px rgba(0,0,0,.65);text-align:center"><div style="font-size:68px">🎬</div><h1 style="font-size:clamp(30px,5vw,50px);margin:4px 0 8px">Live Demo Complete!</h1><p style="font-size:18px;line-height:1.55">ทำครบทุกท่าแล้ว 🎉<br><b>ไม่บันทึกคะแนน ไม่ส่ง Google Sheet และไม่เปลี่ยน Personal Best</b></p><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0">${metricBox('COMPLETION',`${total}/${total}`,'#ecfeff')}${metricBox('TRACKING',`${tracking}%`,'#f0fdf4')}${metricBox('MODE','DEMO ONLY','#fefce8')}</div><div style="padding:13px;border-radius:16px;background:#dcfce7;color:#166534;font-weight:950;margin-bottom:18px">✅ Camera OFF • Not Saved</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><button id="bhAtomicReplay" style="min-height:58px;border:0;border-radius:17px;background:linear-gradient(135deg,#06b6d4,#2563eb);color:#fff;font-size:17px;font-weight:1000">🎥 ทดลอง Demo อีกครั้ง</button><button id="bhAtomicBack" style="min-height:58px;border:0;border-radius:17px;background:#0f172a;color:#fff;font-size:17px;font-weight:1000">🏠 กลับ Fitness</button></div></section>`;
  }else{
    const stars=x.assessmentScore>=88?'⭐⭐⭐':x.assessmentScore>=70?'⭐⭐☆':'⭐☆☆';
    screen.innerHTML=`<section style="width:min(800px,100%);max-height:94vh;overflow:auto;border-radius:30px;padding:26px;background:#fff;border:4px solid #34d399;box-shadow:0 30px 100px rgba(0,0,0,.65);text-align:center"><div style="font-size:66px">🏆</div><h1 style="font-size:clamp(30px,5vw,50px);margin:4px 0 6px">Balance Hold Summary</h1><p style="font-size:19px;font-weight:850;margin:0 0 8px">ภารกิจสำเร็จ! ${stars}</p><div style="font-size:54px;font-weight:1000">${x.score}</div><b>${x.rank} • Assessment ${x.assessmentScore}/100</b><div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin:18px 0">${metricBox('POSE',`${x.poseAccuracy}%`,'#ecfeff')}${metricBox('STABILITY',`${x.stabilityScore}%`,'#f0fdf4')}${metricBox('CONTROL',`${x.transitionScore}%`,'#eef2ff')}${metricBox('SAFE ZONE',`${x.safeZoneScore}%`,'#fefce8')}${metricBox('TRACKING',`${x.trackingCoverage}%`,'#f0fdfa')}${metricBox('COMPLETION',`${x.completedPoses}/${x.totalPoses}`,'#fff7ed')}</div><div id="bhOfficialSheet" style="padding:13px;border-radius:16px;background:#e0f2fe;color:#075985;font-weight:950;margin-bottom:12px">📤 กำลังส่งผลเข้า Google Sheet...</div><div style="padding:12px;border-radius:16px;background:#f8fafc;text-align:left;margin-bottom:16px"><b>คำแนะนำ:</b> ${x.advice}</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px"><button id="bhOfficialReplay" style="min-height:56px;border:0;border-radius:17px;background:linear-gradient(135deg,#06b6d4,#2563eb);color:#fff;font-size:16px;font-weight:1000">🔁 เล่นอีกครั้ง</button><button id="bhOfficialCooldown" style="min-height:56px;border:0;border-radius:17px;background:linear-gradient(135deg,#22c55e,#14b8a6);color:#fff;font-size:16px;font-weight:1000">🧘 Cooldown</button><button id="bhOfficialBack" style="min-height:56px;border:0;border-radius:17px;background:#0f172a;color:#fff;font-size:16px;font-weight:1000">🏠 กลับ Fitness</button></div></section>`;
  }
  document.body.appendChild(screen);
  if(demo){$('bhAtomicReplay').onclick=()=>location.reload();$('bhAtomicBack').onclick=()=>location.href=hubUrl();document.title='Live Demo Complete • Balance Hold';return}
  $('bhOfficialReplay').onclick=()=>location.reload();$('bhOfficialBack').onclick=()=>location.href=hubUrl();
  $('bhOfficialCooldown').onclick=()=>{const u=new URL('/webxr-health-mobile/herohealth/warmup-gate.html',location.origin);u.searchParams.set('phase','cooldown');u.searchParams.set('game','balance-hold');u.searchParams.set('gameId','balance-hold');u.searchParams.set('zone','fitness');u.searchParams.set('next',hubUrl());u.searchParams.set('hub',hubUrl());u.searchParams.set('score',String(x.score));location.href=u.href};
  document.title='Balance Hold Summary';
}
function persistAndSubmit(x){
  try{localStorage.setItem(BH.KEY_LAST,JSON.stringify(x));if(x.isNewBest)localStorage.setItem(BH.KEY_BEST,String(x.score))}catch(_){}
  Promise.resolve(officialSubmit(x)).then(()=>{const n=$('bhOfficialSheet');if(n){n.textContent=BH.ENDPOINT?'✅ ส่งคำขอเข้า Google Sheet แล้ว':'⚠️ ยังไม่ได้ตั้งค่า Sheet endpoint';n.style.background=BH.ENDPOINT?'#dcfce7':'#fef3c7';n.style.color=BH.ENDPOINT?'#166534':'#92400e'}}).catch(()=>{const n=$('bhOfficialSheet');if(n){n.textContent='⚠️ เก็บคิวผลไว้บนเครื่องแล้ว';n.style.background='#fef3c7';n.style.color='#92400e'}})
}
function atomicOfficialEnd(ev){
  if(s.officialEndShown)return;s.officialEndShown=true;s.officialFinalizing=true;
  const cfg=BH.CONFIG[e.difficulty?.value]||BH.CONFIG.normal,required=(cfg.hold+(s.currentKey==='boss'?450:0))*(1-(s.assistLevel||0)*.075);
  s.holdMs=Math.max(s.holdMs||0,required);
  if((s.results?.length||0)<(s.sequence?.length||0)){
    const savedFinish=BH.finish;BH.finish=()=>{};
    try{BH.completePose(ev,required)}finally{BH.finish=savedFinish}
  }
  const x=BH.calcSummary('completed');showScreen({demo:false,x});persistAndSubmit(x);
}
BH.startGame=function(){s.officialFinalizing=false;s.officialEndShown=false;s.demoFinalizing=false;s.demoEndShown=false;return baseStartGame()};
BH.startLiveDemo=async()=>{BH.syncContext();BH.cancelCountdown();s.gameToken++;s.demo=true;s.demoEndShown=false;s.officialEndShown=false;s.roundId=BH.stableId('BHLIVEDEMO');s.calValidMs=0;s.calLast=BH.now();s.calHistory=[];s.smooth=null;s.latest=null;s.latestAt=0;s.calibration=null;s.phase='camera';const ready=await BH.startCamera();if(!ready){s.demo=false;s.phase='setup';return}if(!BH.initPose()){s.demo=false;s.phase='setup';BH.stopCamera();return}BH.poseLoop();e.startOverlay.classList.add('hidden');e.calibrationOverlay.classList.remove('hidden');s.phase='calibration';e.status.textContent='🎥 Live Demo • Camera ON • Score OFF';BH.setCoach('Live Demo: ถอยให้เห็นทั้งตัว แล้วกางแขนระดับไหล่','ระบบตรวจท่าจริง แต่ไม่บันทึกคะแนนหรือส่งข้อมูล','🎥','LIVE DEMO')};
const baseUpdate=BH.updateGameUI;
BH.updateGameUI=(ev,p)=>{if(s.demoEndShown||s.officialEndShown||s.phase==='summary')return;baseUpdate(ev,p);const last=s.sequence?.length>0&&s.index===s.sequence.length-1;if(!last||p<.99)return;if(s.demo){s.demoEndShown=true;showScreen({demo:true});return}atomicOfficialEnd(ev)};
const demoBtn=$('demoBtn');if(demoBtn){demoBtn.textContent='🎥 Live Demo • กล้องจริง ไม่บันทึก';demoBtn.onclick=BH.startLiveDemo}
console.info('[BalanceHold] Atomic Demo + Official Summary v30 ready',RELEASE);
})();