(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.state||!BH.el)return;
const s=BH.state,e=BH.el,$=BH.$;
let lastLandmarksAt=0,watchTimer=0;
function ensureStatus(){
  let n=$('bhCalibrationStatusV15');
  if(n)return n;
  n=document.createElement('div');n.id='bhCalibrationStatusV15';n.className='bh-cal-status warn';
  n.textContent='⏳ กำลังเริ่มระบบตรวจจับท่าทาง...';
  const hints=e.calibrationOverlay?.querySelector('.cameraHints');
  hints?.insertAdjacentElement('afterend',n);
  return n;
}
function setStatus(text,type='warn'){
  const n=ensureStatus();n.className='bh-cal-status '+type;n.textContent=text;
}
function enterCalibration(){document.body.classList.add('bh-calibrating');ensureStatus();startWatch()}
function leaveCalibration(){document.body.classList.remove('bh-calibrating');stopWatch()}
function startWatch(){
  stopWatch();const started=performance.now();
  watchTimer=setInterval(()=>{
    if(s.phase!=='calibration'){leaveCalibration();return}
    const hasVideo=!!(s.stream&&e.camera?.readyState>=2);
    const age=performance.now()-lastLandmarksAt;
    if(!hasVideo){setStatus('⚠️ ยังไม่พบภาพกล้อง กด “เปิดกล้องใหม่” แล้วตรวจสิทธิ์กล้อง','warn');return}
    if(lastLandmarksAt&&age<1200){setStatus('✅ พบภาพกล้องและตรวจจับร่างกายแล้ว','ok');return}
    if(performance.now()-started<4500){setStatus('⏳ กล้องเปิดแล้ว กำลังโหลด MediaPipe Pose...','warn');return}
    setStatus('👤 กล้องเปิดแล้ว แต่ยังไม่พบทั้งตัว — ถอยให้เห็นศีรษะถึงข้อเท้าและเพิ่มแสงด้านหน้า','warn');
  },500);
}
function stopWatch(){if(watchTimer){clearInterval(watchTimer);watchTimer=0}}
const baseResults=BH.onPoseResults;
BH.onPoseResults=function(results){
  if(results?.poseLandmarks)lastLandmarksAt=performance.now();
  return baseResults.call(this,results);
};
function wrapAsync(name){
  const base=BH[name];if(typeof base!=='function')return;
  BH[name]=async function(...args){const out=await base.apply(this,args);if(s.phase==='calibration')enterCalibration();return out};
}
wrapAsync('beginCalibration');
wrapAsync('startLiveDemo');
wrapAsync('restartCalibration');
const baseCountdown=BH.startCountdown;
BH.startCountdown=function(...args){leaveCalibration();return baseCountdown.apply(this,args)};
const baseFinish=BH.finish;
BH.finish=function(...args){leaveCalibration();return baseFinish.apply(this,args)};
const cancel=$('cancelCalibrationBtn');if(cancel){const old=cancel.onclick;cancel.onclick=function(ev){leaveCalibration();return old?.call(this,ev)}}
const retry=$('retryCameraBtn');if(retry){const old=retry.onclick;retry.onclick=async function(ev){setStatus('🔄 กำลังเปิดกล้องและเริ่ม Pose ใหม่...','warn');const out=await old?.call(this,ev);enterCalibration();return out}}
window.addEventListener('beforeunload',leaveCalibration);
console.info('[BalanceHold] Calibration visibility/watchdog v15 ready');
})();