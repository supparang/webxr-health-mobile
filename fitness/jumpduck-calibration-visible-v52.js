(()=>{'use strict';
if(window.__JUMPDUCK_CALIBRATION_VISIBLE_V52__)return;
window.__JUMPDUCK_CALIBRATION_VISIBLE_V52__=true;

const nativeSetTimeout=window.setTimeout.bind(window);
const nativeClearTimeout=window.clearTimeout.bind(window);
let stuckTimer=0;
let cameraHome=null;
let cameraNext=null;
let cameraMoved=false;

/* Give MoveNet enough time to collect several real poses on mid-range Android. */
window.setTimeout=function(callback,delay,...args){
  const countdown=document.getElementById('countdown');
  const count=document.getElementById('count');
  const calibrating=countdown&&!countdown.classList.contains('hidden')&&count&&/^[123]$/.test(String(count.textContent||'').trim());
  const actualDelay=calibrating&&Number(delay)>=850&&Number(delay)<=950?1800:delay;
  return nativeSetTimeout(callback,actualDelay,...args);
};

function installStyles(){
  if(document.getElementById('jdCalibrationV52Style'))return;
  const style=document.createElement('style');
  style.id='jdCalibrationV52Style';
  style.textContent=`
    #countdown .card{max-height:calc(100dvh - 28px);overflow-y:auto;padding:16px 16px 22px}
    #countdown .count{font-size:clamp(72px,22vw,108px);line-height:.92;margin-bottom:4px}
    #countdown h2{margin:6px 0 8px;font-size:clamp(28px,7vw,38px);line-height:1.15}
    #countdown p.muted{margin:8px 0 0;font-size:clamp(16px,4.5vw,22px);line-height:1.4}
    .camera.jd-calibration-camera{position:relative!important;right:auto!important;bottom:auto!important;width:min(82vw,330px)!important;margin:12px auto 8px!important;aspect-ratio:4/3!important;border:5px solid #10b981!important;border-radius:24px!important;box-shadow:0 12px 28px #0004!important;z-index:3!important;background:#071827!important}
    .camera.jd-calibration-camera:after{content:'ให้เห็นศีรษะ ไหล่ และสะโพกทั้งสองข้าง';position:absolute;z-index:4;left:9px;right:9px;bottom:9px;padding:8px 10px;border-radius:13px;background:#0f172ad9;color:#fff;font:900 14px/1.35 system-ui;text-align:center;pointer-events:none}
    #jdCalibrationState{margin:8px auto 0;width:min(82vw,330px);padding:9px 11px;border-radius:14px;background:#ecfdf5;color:#047857;font:900 14px/1.35 system-ui}
    #jdCalibrationRetry{display:none;width:min(82vw,330px);min-height:52px;margin:10px auto 0;border:0;border-radius:17px;background:linear-gradient(90deg,#10b981,#06b6d4);color:#fff;font:900 18px system-ui;box-shadow:0 6px 0 #047857;touch-action:manipulation}
    #jdCalibrationRetry.show{display:block}
  `;
  document.head.appendChild(style);
}

function installStateUI(){
  const card=document.querySelector('#countdown .card');
  if(!card)return;
  if(!document.getElementById('jdCalibrationState')){
    const state=document.createElement('div');
    state.id='jdCalibrationState';
    state.textContent='กำลังเปิดภาพกล้องจริง…';
    card.appendChild(state);
  }
  if(!document.getElementById('jdCalibrationRetry')){
    const retry=document.createElement('button');
    retry.id='jdCalibrationRetry';retry.type='button';retry.textContent='↻ ถอยกล้องแล้วลองใหม่';
    retry.addEventListener('click',()=>location.reload());
    card.appendChild(retry);
  }
}

function moveRealCameraToCalibration(){
  const camera=document.querySelector('#game .camera')||document.querySelector('.camera.jd-calibration-camera');
  const card=document.querySelector('#countdown .card');
  const heading=card?.querySelector('h2');
  if(!camera||!card)return;
  if(!cameraHome){cameraHome=camera.parentNode;cameraNext=camera.nextSibling}
  if(camera.parentNode!==card){
    heading?.insertAdjacentElement('afterend',camera);
  }
  camera.classList.add('jd-calibration-camera');
  cameraMoved=true;
  const video=camera.querySelector('video');
  if(video){video.muted=true;video.playsInline=true;video.play().catch(()=>{})}
  nativeSetTimeout(()=>window.dispatchEvent(new Event('resize')),80);
  updateCameraState();
}

function restoreCameraToGame(){
  const camera=document.querySelector('.camera.jd-calibration-camera');
  if(!camera||!cameraHome)return;
  camera.classList.remove('jd-calibration-camera');
  if(cameraNext&&cameraNext.parentNode===cameraHome)cameraHome.insertBefore(camera,cameraNext);else cameraHome.appendChild(camera);
  cameraMoved=false;
  nativeSetTimeout(()=>window.dispatchEvent(new Event('resize')),80);
}

function updateCameraState(){
  const video=document.getElementById('video');
  const state=document.getElementById('jdCalibrationState');
  if(!state||!video)return;
  const hasStream=!!video.srcObject;
  const ready=video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0;
  state.textContent=ready?`ภาพกล้องพร้อม ${video.videoWidth}×${video.videoHeight} • ยืนตรงกลางนิ่ง ๆ`:hasStream?'กำลังรอภาพจากกล้อง…':'ยังไม่พบสัญญาณกล้อง';
  state.style.background=ready?'#dcfce7':'#fef3c7';
  state.style.color=ready?'#166534':'#92400e';
}

function showRetry(message){
  const retry=document.getElementById('jdCalibrationRetry');
  const state=document.getElementById('jdCalibrationState');
  if(state){state.textContent=message;state.style.background='#fee2e2';state.style.color='#991b1b'}
  retry?.classList.add('show');
}

function armStuckGuard(){
  nativeClearTimeout(stuckTimer);
  stuckTimer=nativeSetTimeout(()=>{
    const countdown=document.getElementById('countdown');
    const count=document.getElementById('count');
    const game=document.getElementById('game');
    if(countdown&&!countdown.classList.contains('hidden')&&count?.textContent?.trim()==='1'&&game?.classList.contains('hidden')){
      showRetry('ยังเก็บตำแหน่งไหล่–สะโพกไม่ครบ กรุณาถอยให้เห็นถึงสะโพก แล้วกดลองใหม่');
    }
  },6500);
}

function boot(){
  installStyles();installStateUI();
  const countdown=document.getElementById('countdown');
  const game=document.getElementById('game');
  const count=document.getElementById('count');
  const video=document.getElementById('video');
  if(video){
    ['loadedmetadata','playing','canplay'].forEach(name=>video.addEventListener(name,updateCameraState));
    nativeSetTimeout(updateCameraState,500);
  }
  if(countdown)new MutationObserver(()=>{
    if(!countdown.classList.contains('hidden')){
      moveRealCameraToCalibration();
      nativeSetTimeout(updateCameraState,250);
    }
  }).observe(countdown,{attributes:true,attributeFilter:['class']});
  if(game)new MutationObserver(()=>{
    if(!game.classList.contains('hidden'))restoreCameraToGame();
  }).observe(game,{attributes:true,attributeFilter:['class']});
  if(count)new MutationObserver(()=>{
    updateCameraState();
    if(String(count.textContent||'').trim()==='1')armStuckGuard();
  }).observe(count,{childList:true,characterData:true,subtree:true});
  nativeSetTimeout(()=>{
    if(countdown&&!countdown.classList.contains('hidden'))moveRealCameraToCalibration();
  },100);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
