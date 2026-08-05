(()=>{'use strict';
if(window.__JUMPDUCK_LANE_VISIBILITY_V67__)return;
window.__JUMPDUCK_LANE_VISIBILITY_V67__=true;

const OVERLAY_ID='jdLaneOverlayV67';
const STYLE_ID='jdLaneOverlayStyleV67';

function buildOverlay(){
 const overlay=document.createElement('div');
 overlay.id=OVERLAY_ID;
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML=`
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="presentation">
  <defs>
   <linearGradient id="jdRoadGradient67" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#314d62" stop-opacity=".94"/>
    <stop offset="1" stop-color="#091724" stop-opacity=".98"/>
   </linearGradient>
   <filter id="jdWhiteGlow67"><feGaussianBlur stdDeviation=".55" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   <filter id="jdGoldGlow67"><feGaussianBlur stdDeviation=".7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <polygon class="road" points="38,31 62,31 99,100 1,100"/>
  <path class="edge" d="M38 31 L1 100"/>
  <path class="edge" d="M62 31 L99 100"/>
  <path class="divider" d="M46 31 L33 100"/>
  <path class="divider" d="M54 31 L67 100"/>
 </svg>
 <div class="labels"><span>ซ้าย</span><span>กลาง</span><span>ขวา</span></div>`;
 return overlay;
}

function installStyle(){
 if(document.getElementById(STYLE_ID))return;
 for(const id of ['jdLaneOverlayStyleV65','jdLaneOverlayStyleV66'])document.getElementById(id)?.remove();
 const style=document.createElement('style');
 style.id=STYLE_ID;
 style.textContent=`
 #game{isolation:isolate!important;background:#06121d!important}
 #world{position:absolute!important;inset:0!important;z-index:1!important}
 #${OVERLAY_ID}{position:absolute!important;inset:0!important;z-index:40!important;pointer-events:none!important;overflow:hidden!important;display:block!important;visibility:visible!important;opacity:1!important;transform:none!important;filter:none!important}
 #${OVERLAY_ID} svg{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;display:block!important;visibility:visible!important;opacity:1!important}
 #${OVERLAY_ID} .road{fill:url(#jdRoadGradient67);stroke:rgba(250,204,21,.98);stroke-width:2.5;vector-effect:non-scaling-stroke}
 #${OVERLAY_ID} .divider{fill:none;stroke:#fff;stroke-opacity:.98;stroke-width:4;stroke-dasharray:17 13;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:url(#jdWhiteGlow67)}
 #${OVERLAY_ID} .edge{fill:none;stroke:#facc15;stroke-opacity:1;stroke-width:4.5;vector-effect:non-scaling-stroke;filter:url(#jdGoldGlow67)}
 #${OVERLAY_ID} .labels{position:absolute;left:4%;right:4%;bottom:11%;display:grid!important;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;font:900 13px/1 system-ui;color:#fff;text-shadow:0 2px 7px #000;visibility:visible!important;opacity:1!important}
 #${OVERLAY_ID} .labels span{justify-self:center;min-width:58px;padding:7px 10px;border-radius:999px;background:rgba(2,20,32,.82);border:1px solid rgba(255,255,255,.6);box-shadow:0 3px 10px #0009}
 #game>.hud,#game>.mission,#game>.warning,#game>.toast,#game>.pose,#game>.camera{position:relative;z-index:70!important}
 @media(max-width:560px){#${OVERLAY_ID} .labels{bottom:9%;font-size:12px}}
 `;
 document.head.appendChild(style);
}

function enforce(){
 const game=document.getElementById('game');
 const world=document.getElementById('world');
 if(!game||!world)return;
 installStyle();
 for(const id of ['jdLaneOverlayV65','jdLaneOverlayV66'])document.getElementById(id)?.remove();
 let overlay=document.getElementById(OVERLAY_ID);
 if(!overlay){overlay=buildOverlay();game.appendChild(overlay)}
 if(overlay.parentElement!==game)game.appendChild(overlay);
 overlay.style.setProperty('display','block','important');
 overlay.style.setProperty('visibility','visible','important');
 overlay.style.setProperty('opacity','1','important');
 overlay.style.setProperty('z-index','40','important');
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enforce,{once:true});else enforce();
new MutationObserver(enforce).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
setInterval(enforce,500);
window.addEventListener('resize',enforce,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(enforce,250),{passive:true});
console.info('[JumpDuck Lane Visibility V67] persistent top-layer lanes installed');
})();
