(()=>{'use strict';
if(window.__JUMPDUCK_LANE_VISIBILITY_V68__)return;
window.__JUMPDUCK_LANE_VISIBILITY_V68__=true;

const OVERLAY_ID='jdLaneOverlayV68';
const STYLE_ID='jdLaneOverlayStyleV68';
const query=new URLSearchParams(location.search);
const testMode=query.get('gameTestMode')==='1'||query.get('mode')==='game-test'||query.get('isTestAttempt')==='true';

function installStyle(){
 if(document.getElementById(STYLE_ID))return;
 ['jdLaneOverlayStyleV65','jdLaneOverlayStyleV66','jdLaneOverlayStyleV67'].forEach(id=>document.getElementById(id)?.remove());
 const style=document.createElement('style');
 style.id=STYLE_ID;
 style.textContent=`
 #intro,#intro .card,#intro #start{position:relative!important;z-index:120!important;pointer-events:auto!important;touch-action:manipulation!important}
 #intro #start{display:block!important;visibility:visible!important;opacity:1!important;min-height:58px!important}
 #game{isolation:isolate!important;background:#06121d!important}
 #world{position:absolute!important;inset:0!important;z-index:1!important}
 #${OVERLAY_ID}{position:absolute!important;inset:0!important;z-index:12!important;pointer-events:none!important;overflow:hidden!important}
 #${OVERLAY_ID} svg{position:absolute;inset:0;width:100%;height:100%;display:block}
 #${OVERLAY_ID} .road{fill:url(#jdRoadGradient68);stroke:#facc15;stroke-width:2.4;vector-effect:non-scaling-stroke}
 #${OVERLAY_ID} .divider{fill:none;stroke:#fff;stroke-width:4;stroke-dasharray:17 13;stroke-linecap:round;vector-effect:non-scaling-stroke}
 #${OVERLAY_ID} .edge{fill:none;stroke:#facc15;stroke-width:4.5;vector-effect:non-scaling-stroke}
 #${OVERLAY_ID} .labels{position:absolute;left:4%;right:4%;bottom:9%;display:grid;grid-template-columns:repeat(3,1fr);text-align:center;font:900 12px system-ui;color:#fff;text-shadow:0 2px 7px #000}
 #${OVERLAY_ID} .labels span{justify-self:center;min-width:56px;padding:7px 9px;border-radius:999px;background:rgba(2,20,32,.8);border:1px solid rgba(255,255,255,.55)}
 #game>.hud,#game>.mission,#game>.warning,#game>.toast,#game>.pose,#game>.camera{z-index:30!important}
 `;
 document.head.appendChild(style);
}

function buildOverlay(){
 const overlay=document.createElement('div');
 overlay.id=OVERLAY_ID;
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="presentation"><defs><linearGradient id="jdRoadGradient68" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#314d62" stop-opacity=".95"/><stop offset="1" stop-color="#091724" stop-opacity=".99"/></linearGradient></defs><polygon class="road" points="38,31 62,31 99,100 1,100"/><path class="edge" d="M38 31 L1 100"/><path class="edge" d="M62 31 L99 100"/><path class="divider" d="M46 31 L33 100"/><path class="divider" d="M54 31 L67 100"/></svg><div class="labels"><span>ซ้าย</span><span>กลาง</span><span>ขวา</span></div>`;
 return overlay;
}

function syncOverlay(){
 const game=document.getElementById('game');
 if(!game)return;
 const active=!game.classList.contains('hidden');
 let overlay=document.getElementById(OVERLAY_ID);
 if(!active){overlay?.remove();return;}
 if(!overlay){overlay=buildOverlay();game.appendChild(overlay);}
}

function configureTestReturn(){
 if(!testMode)return;
 const button=document.getElementById('passportBtn');
 if(button){button.textContent='← กลับหน้าเลือกเกม';button.setAttribute('aria-label','กลับหน้าเลือกเกมทดสอบ');}
 const note=document.querySelector('#result .result-note');
 if(note)note.textContent='ผลรอบนี้บันทึกเป็น Test Attempt และไม่กระทบ Progress หลัก';
}

function install(){
 installStyle();
 ['jdLaneOverlayV65','jdLaneOverlayV66','jdLaneOverlayV67'].forEach(id=>document.getElementById(id)?.remove());
 const game=document.getElementById('game');
 if(game){
  new MutationObserver(()=>requestAnimationFrame(syncOverlay)).observe(game,{attributes:true,attributeFilter:['class']});
 }
 syncOverlay();
 configureTestReturn();
 const start=document.getElementById('start');
 if(start){
  start.style.setProperty('pointer-events','auto','important');
  start.style.setProperty('touch-action','manipulation','important');
 }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('resize',()=>requestAnimationFrame(syncOverlay),{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncOverlay,250),{passive:true});
console.info('[JumpDuck Lane Visibility V68] gameplay-only overlay installed',{testMode});
})();
