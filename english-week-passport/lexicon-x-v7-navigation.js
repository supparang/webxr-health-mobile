(function(){
"use strict";
const VERSION='2026-08-09-LEXIMATCH-NAV-V9-DIRECTIONAL-CORNERS';
const style=document.createElement('style');style.textContent=`
.card.target{border-color:#2b536b!important;box-shadow:none!important}.card.target:not(.flipped):not(.matched)::before{display:none!important}
#selectionGlider{position:absolute;left:0;top:0;z-index:12;pointer-events:none;border:3px solid #ffe36e;border-radius:13px;box-shadow:0 0 0 3px rgba(255,227,110,.18),0 0 18px rgba(255,227,110,.28);will-change:transform,width,height;transform:translate3d(0,0,0);animation:lexiIdle 1.65s ease-in-out infinite}
#selectionGlider::before{content:'SELECTED';position:absolute;top:4px;left:50%;transform:translateX(-50%);padding:2px 6px;border-radius:999px;background:#ffe36e;color:#12293c;font-size:.48rem;font-weight:950;letter-spacing:.06em;white-space:nowrap}
#selectionGlider.moving{animation:none}#selectionGlider.moving::before{content:'MOVING';background:#70e7ff}#selectionGlider.skipping::before{content:'SKIPPING OPEN';background:#70e7ff}#selectionGlider.rescue::before{content:'LAST CARD';background:#63f0b9}
#selectionGlider.opening-now{animation:none;border-color:#70e7ff;box-shadow:0 0 0 3px rgba(112,231,255,.20),0 0 22px rgba(112,231,255,.34)}
@keyframes lexiIdle{0%,100%{filter:brightness(1);opacity:.9}50%{filter:brightness(1.18);opacity:1}}
@media(prefers-reduced-motion:reduce){#selectionGlider{animation:none!important}.inner{transition-duration:.01ms!important}}
`;document.head.appendChild(style);
const MOVE=390,SKIP=85,SETTLE=420,OPEN=900,TILT=6,REARM=2.8,COOLDOWN=650,COLS=3;
let raf=0,motion=null,dwell=0,canOpen=false,swipe=null,g0=null,b0=null,armed=true,lastTilt=0,currentGrid=null;
const api=()=>window.LEXICON_V7,card=i=>Number.isInteger(i)?document.querySelector(`.card[data-index="${i}"]`):null,glider=()=>document.getElementById('selectionGlider');
function normalizeCurrent(){const s=api()?.S;if(!s)return 0;if(!Number.isInteger(s.current)||s.current<0||s.current>=s.deck.length)s.current=0;return s.current;}
function box(i){const e=card(i);return e?{x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight}:null;}
function draw(b){const g=glider();if(!g||!b)return;g.style.width=b.w+'px';g.style.height=b.h+'px';g.style.transform=`translate3d(${b.x}px,${b.y}px,0)`;}
function clearOpen(){canOpen=false;dwell=0;document.querySelectorAll('.card.opening').forEach(e=>{e.classList.remove('opening');e.style.removeProperty('--p');delete e.dataset.pct;});glider()?.classList.remove('opening-now');}
function resetInteraction(){motion=null;swipe=null;clearOpen();glider()?.classList.remove('moving','skipping','rescue');}
function isClosed(x){return !!(x&&!x.flipped&&!x.matched);}
function straightClosed(from,dir){
  const d=api().S.deck,rows=Math.ceil(d.length/COLS);let r=Math.floor(from/COLS),c=from%COLS;
  const dr=dir==='up'?-1:dir==='down'?1:0,dc=dir==='left'?-1:dir==='right'?1:0;let skipped=0;
  while(true){r+=dr;c+=dc;if(r<0||r>=rows||c<0||c>=COLS)return{index:-1,skipped};const i=r*COLS+c;if(i>=d.length)return{index:-1,skipped};if(isClosed(d[i]))return{index:i,skipped};skipped++;}
}
function directionalClosed(from,dir){
  const d=api().S.deck,fr=Math.floor(from/COLS),fc=from%COLS;let best=-1,bestPrimary=Infinity,bestLateral=Infinity;
  for(let i=0;i<d.length;i++){
    if(i===from||!isClosed(d[i]))continue;
    const r=Math.floor(i/COLS),c=i%COLS,vr=r-fr,vc=c-fc;
    const primary=dir==='up'?-vr:dir==='down'?vr:dir==='left'?-vc:vc;
    if(primary<=0)continue;
    const lateral=(dir==='up'||dir==='down')?Math.abs(vc):Math.abs(vr);
    if(primary<bestPrimary||(primary===bestPrimary&&(lateral<bestLateral||(lateral===bestLateral&&i<best)))){
      best=i;bestPrimary=primary;bestLateral=lateral;
    }
  }
  return{index:best,skipped:best>=0?Math.max(0,bestPrimary+bestLateral-1):0,lateral:bestLateral};
}
function onlyClosed(from){const d=api().S.deck;const left=[];for(let i=0;i<d.length;i++)if(i!==from&&isClosed(d[i]))left.push(i);return left.length===1?left[0]:-1;}
function move(dir,source){
  const a=api(),s=a?.S;if(!s||!document.getElementById('grid')||s.locked||motion)return false;
  const current=normalizeCurrent();clearOpen();let found=straightClosed(current,dir),rescue=false,cornerAssist=false;
  if(found.index<0){found=directionalClosed(current,dir);cornerAssist=found.index>=0;}
  if(found.index<0){const last=onlyClosed(current);if(last>=0){found={index:last,skipped:0};rescue=true;}else{a.instruction('ทิศนี้ไม่มีการ์ดปิด • ลองปัดอีกทิศ');return false;}}
  const fromBox=box(current),toBox=box(found.index);if(!fromBox||!toBox)return false;
  motion={targetIndex:found.index,fromBox,toBox,start:performance.now(),duration:MOVE+Math.min(240,found.skipped*SKIP),skipped:found.skipped,rescue,cornerAssist};
  const g=glider();g?.classList.add('moving');if(found.skipped)g?.classList.add('skipping');if(rescue)g?.classList.add('rescue');
  a.instruction(rescue?'เหลือการ์ดปิดใบสุดท้าย • กำลังพาไป':cornerAssist?'ช่องตรงทิศเปิดแล้ว • เลื่อนไปการ์ดปิดด้านนั้น':found.skipped?`ข้ามการ์ดที่เปิดแล้ว ${found.skipped} ใบ`:`${source==='TILT'?'เอียง':'ปัด'}แล้ว • กำลังเลื่อนไป 1 ใบ`);
  a.sfx?.('move');return true;
}
function onDown(e){clearOpen();swipe={x:e.clientX,y:e.clientY,t:performance.now()};}
function onUp(e){if(!swipe)return;const start=swipe;swipe=null;const dx=e.clientX-start.x,dy=e.clientY-start.y,dt=performance.now()-start.t;if(dt>1000||Math.hypot(dx,dy)<24)return;if(Math.abs(dx)>Math.abs(dy))move(dx>0?'right':'left','SWIPE');else move(dy>0?'down':'up','SWIPE');}
function onCancel(){swipe=null;}
function onTilt(e){const g=Number(e.gamma),b=Number(e.beta);if(!Number.isFinite(g)||!Number.isFinite(b)||!document.getElementById('grid'))return;if(g0===null){g0=g;b0=b;return;}const dx=g-g0,dy=b-b0,mag=Math.max(Math.abs(dx),Math.abs(dy)),now=performance.now();if(!armed){if(mag<REARM){armed=true;g0=g;b0=b;}return;}if(mag<TILT||now-lastTilt<COOLDOWN)return;const dir=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up');if(move(dir,'TILT')){armed=false;lastTilt=now;}}
function easeOutQuint(t){return 1-Math.pow(1-t,5);}
function loop(now){const a=api();if(!a||!document.getElementById('grid')){raf=requestAnimationFrame(loop);return;}const s=a.S;normalizeCurrent();if(motion){const t=Math.min(1,(now-motion.start)/motion.duration),e=easeOutQuint(t);draw({x:motion.fromBox.x+(motion.toBox.x-motion.fromBox.x)*e,y:motion.fromBox.y+(motion.toBox.y-motion.fromBox.y)*e,w:motion.fromBox.w+(motion.toBox.w-motion.fromBox.w)*e,h:motion.fromBox.h+(motion.toBox.h-motion.fromBox.h)*e});if(t>=1){const targetIndex=motion.targetIndex;motion=null;document.querySelectorAll('.card.target').forEach(x=>x.classList.remove('target'));s.current=targetIndex;card(s.current)?.classList.add('target');glider()?.classList.remove('moving','skipping','rescue');const c=s.deck[s.current];canOpen=!!isClosed(c);dwell=canOpen?now+SETTLE:0;a.instruction('ถึงการ์ดแล้ว • หยุดนิ่ง ระบบจะเปิดให้อัตโนมัติ');}}
else if(canOpen&&!s.locked){const c=s.deck[s.current],el=card(s.current);if(c&&el&&isClosed(c)&&now>=dwell){const p=Math.min(100,(now-dwell)/OPEN*100);el.classList.add('opening');el.dataset.pct=String(Math.round(p));el.style.setProperty('--p',p+'%');glider()?.classList.add('opening-now');a.instruction('กำลังเปิด '+Math.round(p)+'%');if(p>=100){clearOpen();a.flip(s.current);}}}raf=requestAnimationFrame(loop);}
function unbindGrid(){if(!currentGrid)return;currentGrid.removeEventListener('pointerdown',onDown);currentGrid.removeEventListener('pointerup',onUp);currentGrid.removeEventListener('pointercancel',onCancel);currentGrid=null;}
function setup(){resetInteraction();unbindGrid();const grid=document.getElementById('grid');if(!grid)return;currentGrid=grid;grid.style.touchAction='none';grid.addEventListener('pointerdown',onDown,{passive:true});grid.addEventListener('pointerup',onUp,{passive:true});grid.addEventListener('pointercancel',onCancel,{passive:true});requestAnimationFrame(()=>draw(box(normalizeCurrent())));api().instruction('ปัดหรือเอียงตามทิศ • ช่องที่เปิดแล้วจะถูกข้ามไปยังการ์ดปิดด้านนั้น');}
function realign(){requestAnimationFrame(()=>draw(box(normalizeCurrent())));}
window.addEventListener('deviceorientation',onTilt,true);window.addEventListener('resize',realign,{passive:true});window.addEventListener('orientationchange',realign,{passive:true});window.addEventListener('lexicon-v7-ready',setup);window.addEventListener('lexicon-v7-pair-resolved',()=>{resetInteraction();realign();});window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);unbindGrid();window.removeEventListener('deviceorientation',onTilt,true);},{once:true});raf=requestAnimationFrame(loop);window.LEXICON_V7_NAV={version:VERSION,moveMs:MOVE,settleMs:SETTLE,openingMs:OPEN,tiltThreshold:TILT,lastCardRescue:true,directionalCornerAssist:true,neverReverseDirection:true,stableGestureLifecycle:true};
}());