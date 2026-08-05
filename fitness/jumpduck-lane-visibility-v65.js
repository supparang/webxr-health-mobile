(()=>{'use strict';
if(window.__JUMPDUCK_LANE_VISIBILITY_V70__)return;
window.__JUMPDUCK_LANE_VISIBILITY_V70__=true;

const OVERLAY_ID='jdLaneOverlayV70';
const STYLE_ID='jdLaneOverlayStyleV70';
const query=new URLSearchParams(location.search);
const testMode=query.get('gameTestMode')==='1'||query.get('mode')==='game-test'||query.get('isTestAttempt')==='true';

function installStyle(){
 if(document.getElementById(STYLE_ID))return;
 ['jdLaneOverlayStyleV65','jdLaneOverlayStyleV66','jdLaneOverlayStyleV67','jdLaneOverlayStyleV68','jdLaneOverlayStyleV69'].forEach(id=>document.getElementById(id)?.remove());
 const style=document.createElement('style');
 style.id=STYLE_ID;
 style.textContent=`
 #intro,#intro .card,#intro #start{position:relative!important;z-index:120!important;pointer-events:auto!important;touch-action:manipulation!important}
 #intro #start{display:block!important;visibility:visible!important;opacity:1!important;min-height:58px!important}
 #game{isolation:isolate!important}
 #world{position:absolute!important;inset:0!important;z-index:1!important}
 #${OVERLAY_ID}{position:absolute!important;inset:0!important;z-index:2!important;pointer-events:none!important;overflow:hidden!important;background:transparent!important}
 #${OVERLAY_ID} svg{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none!important;background:transparent!important}
 #${OVERLAY_ID} .divider{fill:none;stroke:rgba(255,255,255,.94);stroke-width:3.5;stroke-dasharray:17 13;stroke-linecap:round;vector-effect:non-scaling-stroke}
 #${OVERLAY_ID} .edge{fill:none;stroke:#facc15;stroke-width:4;vector-effect:non-scaling-stroke}
 #${OVERLAY_ID} .labels{position:absolute;left:4%;right:4%;bottom:9%;display:grid;grid-template-columns:repeat(3,1fr);text-align:center;font:900 12px system-ui;color:#fff;text-shadow:0 2px 7px #000;pointer-events:none!important}
 #${OVERLAY_ID} .labels span{justify-self:center;min-width:56px;padding:7px 9px;border-radius:999px;background:rgba(2,20,32,.42);border:1px solid rgba(255,255,255,.38)}
 #game>.hud,#game>.mission,#game>.warning,#game>.toast,#game>.pose,#game>.camera{z-index:30!important}
 `;
 document.head.appendChild(style);
}

function buildOverlay(){
 const overlay=document.createElement('div');
 overlay.id=OVERLAY_ID;
 overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML=`<svg viewBox="0 0 100 100" preserveAspectRatio="none" role="presentation"><path class="edge" d="M38 31 L1 100"/><path class="edge" d="M62 31 L99 100"/><path class="divider" d="M46 31 L33 100"/><path class="divider" d="M54 31 L67 100"/></svg><div class="labels"><span>ซ้าย</span><span>กลาง</span><span>ขวา</span></div>`;
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
 ['jdLaneOverlayV65','jdLaneOverlayV66','jdLaneOverlayV67','jdLaneOverlayV68','jdLaneOverlayV69'].forEach(id=>document.getElementById(id)?.remove());
 const game=document.getElementById('game');
 if(game)new MutationObserver(()=>requestAnimationFrame(syncOverlay)).observe(game,{attributes:true,attributeFilter:['class']});
 syncOverlay();
 configureTestReturn();
 const start=document.getElementById('start');
 if(start){start.style.setProperty('pointer-events','auto','important');start.style.setProperty('touch-action','manipulation','important');}
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
window.addEventListener('resize',()=>requestAnimationFrame(syncOverlay),{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(syncOverlay,250),{passive:true});
console.info('[JumpDuck Lane Visibility V70] line-only overlay installed',{testMode});
})();
