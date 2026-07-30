(()=>{'use strict';
if(window.__JUMPDUCK_CALIBRATION_GUARD_V51__)return;
window.__JUMPDUCK_CALIBRATION_GUARD_V51__=true;

const nativeSetTimeout=window.setTimeout.bind(window);
const nativeClearTimeout=window.clearTimeout.bind(window);
let stuckTimer=0;

/* MoveNet Lightning can return only 2–3 usable poses during the original
   2.7-second calibration window on a mid-range Android phone. Extend only the
   visible 3–2–1 calibration pauses, without changing the 50-second game clock. */
window.setTimeout=function(callback,delay,...args){
  const countdown=document.getElementById('countdown');
  const count=document.getElementById('count');
  const calibrating=countdown&&!countdown.classList.contains('hidden')&&count&&/^[123]$/.test(String(count.textContent||'').trim());
  const actualDelay=calibrating&&Number(delay)>=850&&Number(delay)<=950?1450:delay;
  return nativeSetTimeout(callback,actualDelay,...args);
};

function installPreview(){
  const countdown=document.getElementById('countdown');
  const card=countdown?.querySelector('.card');
  if(!card||document.getElementById('jdCalibrationPreview'))return;
  const wrap=document.createElement('div');
  wrap.id='jdCalibrationPreview';
  wrap.innerHTML='<video id="jdCalibrationVideo" autoplay muted playsinline></video><div id="jdCalibrationGuide">ให้เห็นศีรษะ ไหล่ และสะโพกทั้งสองข้าง</div>';
  const style=document.createElement('style');
  style.textContent=`#jdCalibrationPreview{width:min(82vw,310px);margin:12px auto 8px;position:relative;border:4px solid #10b981;border-radius:22px;overflow:hidden;background:#0f172a;box-shadow:0 8px 20px #0003}#jdCalibrationVideo{display:block;width:100%;aspect-ratio:4/3;object-fit:cover;transform:scaleX(-1)}#jdCalibrationGuide{position:absolute;left:8px;right:8px;bottom:8px;padding:7px 9px;border-radius:12px;background:#0f172acc;color:#fff;font:800 13px/1.35 system-ui;text-align:center}#jdCalibrationRetry{display:none;width:min(78vw,300px);margin:12px auto 0;min-height:52px;border:0;border-radius:17px;background:linear-gradient(90deg,#10b981,#06b6d4);color:#fff;font:900 18px system-ui;box-shadow:0 6px 0 #047857;touch-action:manipulation}#jdCalibrationRetry.show{display:block}`;
  document.head.appendChild(style);
  const heading=card.querySelector('h2');
  heading?.insertAdjacentElement('afterend',wrap);
  const retry=document.createElement('button');
  retry.id='jdCalibrationRetry';retry.type='button';retry.textContent='↻ จัดตำแหน่งแล้วลองใหม่';
  card.appendChild(retry);
  retry.addEventListener('click',()=>location.reload());
}

function connectPreview(){
  const source=document.getElementById('video');
  const preview=document.getElementById('jdCalibrationVideo');
  if(!source||!preview)return;
  if(source.srcObject&&preview.srcObject!==source.srcObject){
    preview.srcObject=source.srcObject;
    preview.play().catch(()=>{});
  }
}

function restoreStart(message){
  const intro=document.getElementById('intro');
  const countdown=document.getElementById('countdown');
  const start=document.getElementById('start');
  const status=document.getElementById('startStatus');
  if(!intro||!countdown)return;
  countdown.classList.add('hidden');
  intro.classList.remove('hidden');
  if(start){start.disabled=false;start.textContent='▶ จัดตำแหน่งแล้วเริ่มใหม่'}
  if(status){status.textContent=message||'ยังเห็นร่างกายไม่ครบ กรุณาถอยให้เห็นตั้งแต่ศีรษะถึงสะโพก';status.className='status error'}
}

function armOneSecondWatch(){
  nativeClearTimeout(stuckTimer);
  stuckTimer=nativeSetTimeout(()=>{
    const countdown=document.getElementById('countdown');
    const count=document.getElementById('count');
    const game=document.getElementById('game');
    if(countdown&&!countdown.classList.contains('hidden')&&count?.textContent?.trim()==='1'&&game?.classList.contains('hidden')){
      const retry=document.getElementById('jdCalibrationRetry');
      retry?.classList.add('show');
      const guide=document.getElementById('jdCalibrationGuide');
      if(guide)guide.textContent='ยังเก็บตำแหน่งไหล่–สะโพกไม่ครบ กรุณาถอยกล้องแล้วกดลองใหม่';
      restoreStart('Calibration ยังไม่ครบ ระบบยุติแทนการค้าง กรุณาถอยให้เห็นไหล่และสะโพกทั้งสองข้าง');
    }
  },7500);
}

function boot(){
  installPreview();
  const video=document.getElementById('video');
  if(video){
    video.addEventListener('loadedmetadata',connectPreview);
    nativeSetTimeout(connectPreview,400);
  }
  const count=document.getElementById('count');
  if(count)new MutationObserver(()=>{
    connectPreview();
    if(String(count.textContent||'').trim()==='1')armOneSecondWatch();
  }).observe(count,{childList:true,characterData:true,subtree:true});
  const status=document.getElementById('startStatus');
  if(status)new MutationObserver(()=>{
    const text=String(status.textContent||'');
    if(/ไม่สำเร็จ|ยังไม่เห็น|กรุณาวางมือถือให้ไกล|เห็นช่วงไหล่ถึงสะโพก/i.test(text))restoreStart(text);
  }).observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['class']});
  const countdown=document.getElementById('countdown');
  if(countdown)new MutationObserver(()=>{if(!countdown.classList.contains('hidden'))nativeSetTimeout(connectPreview,150)}).observe(countdown,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
