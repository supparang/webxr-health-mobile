(()=>{
'use strict';
const BH=window.BH;if(!BH||!BH.el||!BH.state)return;
const e=BH.el,$=BH.$;
const RELEASE='20260717-BALANCE-HOLD-FULLBODY-FIT-V16';

function injectStyle(){
  if($('bhFullBodyFitV16Style'))return;
  const st=document.createElement('style');st.id='bhFullBodyFitV16Style';st.textContent=`
    #camera{object-fit:contain!important;background:#020617!important}
    body.bh-calibrating #camera{object-fit:contain!important}
    body.bh-calibrating #bhCameraGuideV15{left:var(--bh-video-left,4%)!important;right:auto!important;top:var(--bh-video-top,4%)!important;bottom:auto!important;width:var(--bh-video-width,92%)!important;height:var(--bh-video-height,88%)!important;inset:auto!important}
    body.bh-calibrating #calibrationOverlay .calibrationModal{z-index:75!important}
    body.bh-calibrating #poseCanvas{z-index:12!important}
    .bhVideoLetterboxHint{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);z-index:11;color:#e2e8f0;background:rgba(2,6,23,.72);border:1px solid rgba(148,163,184,.35);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:900;pointer-events:none}
    @media(max-width:760px){.bhVideoLetterboxHint{bottom:47dvh}}
  `;document.head.appendChild(st);
}

function videoRect(){
  const stage=e.stage.getBoundingClientRect();
  const vw=e.camera.videoWidth||1280,vh=e.camera.videoHeight||720;
  const scale=Math.min(stage.width/vw,stage.height/vh);
  const width=vw*scale,height=vh*scale,left=(stage.width-width)/2,top=(stage.height-height)/2;
  return{left,top,width,height,stageWidth:stage.width,stageHeight:stage.height};
}

function applyRect(){
  const r=videoRect(),style=e.stage.style;
  style.setProperty('--bh-video-left',r.left+'px');style.setProperty('--bh-video-top',r.top+'px');
  style.setProperty('--bh-video-width',r.width+'px');style.setProperty('--bh-video-height',r.height+'px');
  if(e.safeZone){
    e.safeZone.style.left=(r.left+r.width/2)+'px';
    e.safeZone.style.bottom=Math.max(12,r.stageHeight-(r.top+r.height)+10)+'px';
  }
  return r;
}

const baseResize=BH.resizeCanvas;
BH.resizeCanvas=()=>{baseResize();applyRect()};

BH.drawPose=lm=>{
  const c=e.canvas.getContext('2d'),dpr=Math.min(2,devicePixelRatio||1),r=applyRect();
  c.clearRect(0,0,e.canvas.width,e.canvas.height);if(!lm||!e.showSkeleton.checked)return;
  c.save();c.scale(dpr,dpr);c.lineWidth=4;c.lineCap='round';
  const xy=p=>({x:r.left+p.x*r.width,y:r.top+p.y*r.height});
  [[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]].forEach(([a,b])=>{
    if((lm[a]?.v||0)<.35||(lm[b]?.v||0)<.35)return;
    const A=xy(lm[a]),B=xy(lm[b]);c.strokeStyle='rgba(255,255,255,.94)';c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.stroke();
  });
  [0,11,12,15,16,23,24,25,26,27,28].forEach(i=>{
    if((lm[i]?.v||0)<.35)return;const P=xy(lm[i]);c.fillStyle=i===15||i===16?'#fde047':'#34d399';c.beginPath();c.arc(P.x,P.y,6,0,Math.PI*2);c.fill();
  });
  c.restore();
};

function hint(){let n=$('bhVideoLetterboxHint');if(!n){n=document.createElement('div');n.id='bhVideoLetterboxHint';n.className='bhVideoLetterboxHint';n.textContent='Fit Full Body • ภาพกล้องไม่ถูกตัดส่วนบน–ล่าง';e.stage.appendChild(n)}return n}

const baseStart=BH.startCamera;
BH.startCamera=async opts=>{const ok=await baseStart(opts);if(ok){requestAnimationFrame(()=>{applyRect();hint().style.display='block'})}return ok};
const baseStop=BH.stopCamera;
BH.stopCamera=()=>{const n=$('bhVideoLetterboxHint');if(n)n.style.display='none';baseStop()};
const baseCountdown=BH.startCountdown;
BH.startCountdown=()=>{const n=hint();n.textContent='Fit Full Body • ระบบใช้ภาพกล้องเต็มเฟรม';baseCountdown()};

window.addEventListener('resize',applyRect);
e.camera.addEventListener('loadedmetadata',()=>requestAnimationFrame(applyRect));
injectStyle();hint().style.display='none';
console.info('[BalanceHold] Full-body camera fit v16 ready',RELEASE);
})();