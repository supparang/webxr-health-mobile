(()=>{'use strict';
if(window.__JUMPDUCK_LANE_VISIBILITY_V65__)return;
window.__JUMPDUCK_LANE_VISIBILITY_V65__=true;

function install(){
 const game=document.getElementById('game');
 const world=document.getElementById('world');
 if(!game||!world)return;
 if(document.getElementById('jdLaneOverlayV65'))return;

 const style=document.createElement('style');
 style.id='jdLaneOverlayStyleV65';
 style.textContent=`
 #game{isolation:isolate;background:#071827!important}
 #world{position:absolute!important;inset:0!important;z-index:1!important}
 #jdLaneOverlayV65{position:absolute;inset:0;z-index:2;pointer-events:none;overflow:hidden}
 #jdLaneOverlayV65 .road{position:absolute;left:2%;right:2%;top:31%;bottom:0;clip-path:polygon(36% 0,64% 0,100% 100%,0 100%);background:linear-gradient(180deg,rgba(35,63,82,.82),rgba(5,18,30,.96));border-bottom:5px solid rgba(255,255,255,.18);box-shadow:inset 0 0 45px rgba(56,189,248,.12)}
 #jdLaneOverlayV65 .edge{position:absolute;top:31%;bottom:-2%;width:5px;background:linear-gradient(180deg,rgba(250,204,21,.18),rgba(250,204,21,.95));filter:drop-shadow(0 0 7px rgba(250,204,21,.55));transform-origin:top center}
 #jdLaneOverlayV65 .edge.left{left:37%;transform:rotate(18.5deg)}
 #jdLaneOverlayV65 .edge.right{right:37%;transform:rotate(-18.5deg)}
 #jdLaneOverlayV65 .divider{position:absolute;top:36%;bottom:-4%;width:4px;background:repeating-linear-gradient(180deg,rgba(255,255,255,.95) 0 20px,transparent 20px 39px);transform-origin:top center;filter:drop-shadow(0 0 5px rgba(255,255,255,.45))}
 #jdLaneOverlayV65 .divider.d1{left:45.2%;transform:rotate(8.8deg)}
 #jdLaneOverlayV65 .divider.d2{right:45.2%;transform:rotate(-8.8deg)}
 #jdLaneOverlayV65 .lane-labels{position:absolute;left:7%;right:7%;bottom:12%;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;text-align:center;font:900 13px/1 system-ui;color:rgba(255,255,255,.78);text-shadow:0 2px 6px #000}
 #jdLaneOverlayV65 .lane-labels span{padding:7px 4px;border-radius:999px;background:rgba(15,23,42,.42);border:1px solid rgba(255,255,255,.2)}
 #game>.hud,#game>.mission,#game>.warning,#game>.toast,#game>.pose,#game>.camera{z-index:5!important}
 @media(max-width:560px){
  #jdLaneOverlayV65 .road{top:34%}
  #jdLaneOverlayV65 .edge{top:34%}
  #jdLaneOverlayV65 .divider{top:39%}
  #jdLaneOverlayV65 .lane-labels{bottom:10%;font-size:12px}
 }
 `;
 document.head.appendChild(style);

 const overlay=document.createElement('div');
 overlay.id='jdLaneOverlayV65';
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<div class="road"></div><i class="edge left"></i><i class="edge right"></i><i class="divider d1"></i><i class="divider d2"></i><div class="lane-labels"><span>ซ้าย</span><span>กลาง</span><span>ขวา</span></div>';
 game.insertBefore(overlay,world.nextSibling);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
console.info('[JumpDuck Lane Visibility V65] installed');
})();
