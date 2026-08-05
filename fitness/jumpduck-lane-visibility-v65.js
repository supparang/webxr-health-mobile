(()=>{'use strict';
if(window.__JUMPDUCK_LANE_VISIBILITY_V66__)return;
window.__JUMPDUCK_LANE_VISIBILITY_V66__=true;

function install(){
 const game=document.getElementById('game');
 const world=document.getElementById('world');
 if(!game||!world)return;
 document.getElementById('jdLaneOverlayV65')?.remove();
 document.getElementById('jdLaneOverlayStyleV65')?.remove();
 if(document.getElementById('jdLaneOverlayV66'))return;

 const style=document.createElement('style');
 style.id='jdLaneOverlayStyleV66';
 style.textContent=`
 #game{isolation:isolate;background:#06121d!important}
 #world{position:absolute!important;inset:0!important;z-index:1!important}
 #jdLaneOverlayV66{position:absolute;inset:0;z-index:3;pointer-events:none;overflow:hidden}
 #jdLaneOverlayV66 svg{position:absolute;inset:0;width:100%;height:100%;display:block}
 #jdLaneOverlayV66 .road{fill:url(#jdRoadGradient);stroke:rgba(250,204,21,.92);stroke-width:2.2;vector-effect:non-scaling-stroke}
 #jdLaneOverlayV66 .divider{fill:none;stroke:rgba(255,255,255,.96);stroke-width:3.5;stroke-dasharray:18 15;stroke-linecap:round;vector-effect:non-scaling-stroke;filter:url(#jdGlow)}
 #jdLaneOverlayV66 .edge{fill:none;stroke:rgba(250,204,21,.96);stroke-width:4;vector-effect:non-scaling-stroke;filter:url(#jdGoldGlow)}
 #jdLaneOverlayV66 .labels{position:absolute;left:5%;right:5%;bottom:12%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;font:900 13px/1 system-ui;color:#fff;text-shadow:0 2px 7px #000}
 #jdLaneOverlayV66 .labels span{justify-self:center;min-width:58px;padding:7px 10px;border-radius:999px;background:rgba(2,20,32,.72);border:1px solid rgba(255,255,255,.42);box-shadow:0 3px 10px #0007}
 #game>.hud,#game>.mission,#game>.warning,#game>.toast,#game>.pose,#game>.camera{z-index:6!important}
 @media(max-width:560px){#jdLaneOverlayV66 .labels{bottom:10%;font-size:12px}.jdLaneFar{transform:translateY(3%)}}
 `;
 document.head.appendChild(style);

 const overlay=document.createElement('div');
 overlay.id='jdLaneOverlayV66';
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML=`
 <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="presentation">
  <defs>
   <linearGradient id="jdRoadGradient" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#23384a" stop-opacity=".88"/>
    <stop offset="1" stop-color="#07131f" stop-opacity=".98"/>
   </linearGradient>
   <filter id="jdGlow"><feGaussianBlur stdDeviation=".45" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
   <filter id="jdGoldGlow"><feGaussianBlur stdDeviation=".6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <polygon class="road" points="39,34 61,34 98,100 2,100"/>
  <path class="edge" d="M39 34 L2 100"/>
  <path class="edge" d="M61 34 L98 100"/>
  <path class="divider" d="M46.3 34 L34 100"/>
  <path class="divider" d="M53.7 34 L66 100"/>
 </svg>
 <div class="labels"><span>ซ้าย</span><span>กลาง</span><span>ขวา</span></div>`;
 game.insertBefore(overlay,world.nextSibling);
 console.info('[JumpDuck Lane Visibility V66] responsive SVG installed');
}

function ensure(){
 install();
 const game=document.getElementById('game');
 if(game&&!game.classList.contains('hidden')&&!document.getElementById('jdLaneOverlayV66'))install();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensure,{once:true});else ensure();
new MutationObserver(ensure).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
})();
