(()=>{
'use strict';

const RELEASE='20260729-BALANCE-CALIBRATION-MOBILE-LAYOUT-V32';
const overlay=document.getElementById('calibrationOverlay');
if(!overlay)return;

function injectStyle(){
  if(document.getElementById('bhCalibrationMobileLayoutV32Style'))return;
  const style=document.createElement('style');
  style.id='bhCalibrationMobileLayoutV32Style';
  style.textContent=`
    body.bh-calibration-visible{
      overflow:hidden!important;
      background:#020617!important;
    }

    body.bh-calibration-visible .topbar,
    body.bh-calibration-visible .hud,
    body.bh-calibration-visible .poseBanner,
    body.bh-calibration-visible .energy,
    body.bh-calibration-visible .coach,
    body.bh-calibration-visible .qaPanel,
    body.bh-calibration-visible .crystalWorld,
    body.bh-calibration-visible .safeZone,
    body.bh-calibration-visible .poseGhost,
    body.bh-calibration-visible .crystal,
    body.bh-calibration-visible .holdRing,
    body.bh-calibration-visible .holdText,
    body.bh-calibration-visible .bhVideoLetterboxHint{
      display:none!important;
    }

    body.bh-calibration-visible .app,
    body.bh-calibration-visible .stage{
      width:100vw!important;
      height:100dvh!important;
      min-height:100dvh!important;
      max-height:100dvh!important;
      margin:0!important;
      border:0!important;
      border-radius:0!important;
      overflow:hidden!important;
    }

    body.bh-calibration-visible #camera{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:100%!important;
      object-fit:contain!important;
      background:#020617!important;
    }

    body.bh-calibration-visible #poseCanvas{
      position:absolute!important;
      inset:0!important;
      width:100%!important;
      height:100%!important;
      z-index:12!important;
      pointer-events:none!important;
    }

    body.bh-calibration-visible #calibrationOverlay{
      position:absolute!important;
      inset:0!important;
      z-index:120!important;
      display:block!important;
      padding:0!important;
      background:transparent!important;
      backdrop-filter:none!important;
      pointer-events:none!important;
    }

    body.bh-calibration-visible #calibrationOverlay .calibrationModal{
      position:absolute!important;
      left:10px!important;
      right:10px!important;
      bottom:calc(10px + env(safe-area-inset-bottom,0px))!important;
      width:auto!important;
      max-width:none!important;
      max-height:none!important;
      margin:0!important;
      padding:10px 12px!important;
      border-radius:20px!important;
      overflow:visible!important;
      background:rgba(255,255,255,.97)!important;
      border:2px solid rgba(125,211,252,.72)!important;
      box-shadow:0 16px 48px rgba(2,6,23,.45)!important;
      backdrop-filter:blur(5px)!important;
      pointer-events:auto!important;
    }

    body.bh-calibration-visible #calibrationOverlay .modalHead{
      display:block!important;
      margin:0!important;
    }

    body.bh-calibration-visible #calibrationOverlay .modalIcon{
      display:none!important;
    }

    body.bh-calibration-visible #calibrationOverlay h2{
      margin:0!important;
      font-size:18px!important;
      line-height:1.15!important;
      text-align:center!important;
      color:#0f172a!important;
    }

    body.bh-calibration-visible #calibrationOverlay .lead{
      margin:4px 0 0!important;
      font-size:12px!important;
      line-height:1.32!important;
      text-align:center!important;
      color:#334155!important;
      font-weight:900!important;
    }

    body.bh-calibration-visible #calibrationOverlay .calibrationSteps{
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:6px!important;
      margin-top:8px!important;
    }

    body.bh-calibration-visible #calibrationOverlay .calStep{
      min-height:38px!important;
      display:grid!important;
      place-items:center!important;
      padding:5px 4px!important;
      border-radius:12px!important;
      font-size:10.5px!important;
      line-height:1.2!important;
      text-align:center!important;
    }

    body.bh-calibration-visible #calibrationOverlay .calMeter{
      height:8px!important;
      margin-top:7px!important;
    }

    body.bh-calibration-visible #calibrationOverlay .cameraHints{
      display:none!important;
    }

    body.bh-calibration-visible #bhCameraDiagV15{
      max-height:44px!important;
      overflow:hidden!important;
      margin-top:7px!important;
      padding:7px 9px!important;
      border-radius:12px!important;
      font-size:10.5px!important;
      line-height:1.28!important;
      text-align:left!important;
    }

    body.bh-calibration-visible #calibrationOverlay .actions{
      display:grid!important;
      grid-template-columns:1fr auto!important;
      gap:7px!important;
      margin-top:7px!important;
    }

    body.bh-calibration-visible #calibrationOverlay .btn{
      min-height:42px!important;
      margin:0!important;
      padding:7px 12px!important;
      border-radius:14px!important;
      font-size:14px!important;
      line-height:1.15!important;
      white-space:nowrap!important;
    }

    body.bh-calibration-visible #bhCameraGuideV15{
      left:8px!important;
      right:8px!important;
      top:8px!important;
      bottom:calc(214px + env(safe-area-inset-bottom,0px))!important;
      width:auto!important;
      height:auto!important;
      inset:auto!important;
      border-radius:22px!important;
      z-index:18!important;
    }

    body.bh-calibration-visible #bhCameraGuideV15:before{
      top:6px!important;
      max-width:calc(100% - 18px)!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      font-size:11px!important;
      padding:6px 9px!important;
    }

    @media(min-width:761px){
      body.bh-calibration-visible #calibrationOverlay .calibrationModal{
        left:auto!important;
        right:18px!important;
        bottom:18px!important;
        width:min(430px,calc(100vw - 36px))!important;
      }
      body.bh-calibration-visible #bhCameraGuideV15{
        right:466px!important;
        bottom:18px!important;
      }
    }

    @media(max-height:700px){
      body.bh-calibration-visible #calibrationOverlay .calibrationModal{
        padding:8px 10px!important;
      }
      body.bh-calibration-visible #calibrationOverlay h2{
        font-size:16px!important;
      }
      body.bh-calibration-visible #calibrationOverlay .lead{
        font-size:11px!important;
      }
      body.bh-calibration-visible #bhCameraDiagV15{
        display:none!important;
      }
      body.bh-calibration-visible #bhCameraGuideV15{
        bottom:calc(166px + env(safe-area-inset-bottom,0px))!important;
      }
    }
  `;
  document.head.appendChild(style);
}

function sync(){
  const visible=!overlay.classList.contains('hidden') && getComputedStyle(overlay).display!=='none';
  document.body.classList.toggle('bh-calibration-visible',visible);
  if(!visible)document.body.classList.remove('bh-calibrating');
}

injectStyle();
sync();

const observer=new MutationObserver(sync);
observer.observe(overlay,{attributes:true,attributeFilter:['class','style','hidden']});

window.addEventListener('pageshow',sync);
window.addEventListener('resize',sync);

console.info('[BalanceHold] Calibration Mobile Layout v32 ready',RELEASE);
})();
