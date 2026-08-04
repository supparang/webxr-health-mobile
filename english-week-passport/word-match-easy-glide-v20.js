(function(){
"use strict";
const VERSION="2026-08-04-WORD-MATCH-EASY-GLIDE-V20";
const DEAD=1.35, MAX_TILT=11, MAX_SPEED=245, FOLLOW=.20, DAMP=.80, DWELL_MS=480, STILL_SPEED=78;
const synthetic=new WeakSet();
const s={seen:false,cal:false,count:0,sumG:0,sumB:0,g0:0,b0:0,g:0,b:0,vx:0,vy:0,x:innerWidth/2,y:innerHeight*.56,last:performance.now(),target:null,dwellAt:0,cursor:null,ring:null,raf:0};
const q=(x,r=document)=>r.querySelector(x),qa=(x,r=document)=>Array.from(r.querySelectorAll(x));
const finite=v=>Number.isFinite(Number(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ready=()=>!!q("#memoryGrid")&&!!q(".memory-card");
function relay(src){let e;try{e=new DeviceOrientationEvent("deviceorientation",{alpha:finite(src.alpha)?+src.alpha:0,beta:0,gamma:0,absolute:!!src.absolute});}catch(_){e=new Event("deviceorientation");Object.defineProperties(e,{alpha:{value:0},beta:{value:0},gamma:{value:0},absolute:{value:false}});}synthetic.add(e);try{window.dispatchEvent(e);}catch(_){}}
function cards(){return qa(".memory-card:not(.matched):not([disabled])").filter(c=>{const r=c.getBoundingClientRect();return r.width>20&&r.height>20;});}
function center(card){const r=card.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,r};}
function ensureCursor(){if(s.cursor?.isConnected)return;const el=document.createElement("div");el.id="smoothTiltCursor";el.innerHTML='<span class="stc-dot"></span><span class="stc-ring"></span><span class="stc-progress"></span>';document.body.appendChild(el);s.cursor=el;s.ring=el.querySelector(".stc-progress");}
function clearTargets(except){qa(".memory-card.smooth-target,.memory-card.opening-target,.memory-card.ew-tilt-focus").forEach(c=>{if(c!==except){c.classList.remove("smooth-target","opening-target","ew-tilt-focus");c.style.removeProperty("--open-progress");delete c.dataset.openPct;}});}
function nearestCard(){let best=null,dist=Infinity;for(const c of cards()){const p=center(c),d=Math.hypot(p.x-s.x,p.y-s.y);if(d<dist){dist=d;best=c;}}return {card:best,dist};}
function instruction(text){const el=q(".game-panel .instruction");if(el&&el.textContent!==text)el.textContent=text;}
function visual(pct){if(!s.cursor)return;s.cursor.style.transform=`translate3d(${s.x}px,${s.y}px,0)`;if(s.ring)s.ring.style.setProperty("--progress",`${clamp(pct,0,100)*3.6}deg`);}
function openTarget(){if(!s.target)return false;const id=s.target.dataset.cardId;if(!id||typeof window.EW_WORD_MATCH_OPEN_CARD!=="function")return false;window.EW_WORD_MATCH_OPEN_CARD(id);return true;}
function axis(value){const a=Math.abs(value);if(a<=DEAD)return 0;const n=clamp((a-DEAD)/(MAX_TILT-DEAD),0,1);return Math.sign(value)*(n*n*(3-2*n));}
function onOrientation(e){if(synthetic.has(e)||!ready()||!finite(e.gamma)||!finite(e.beta))return;e.stopImmediatePropagation();relay(e);s.seen=true;s.g=+e.gamma;s.b=+e.beta;if(!s.cal){s.sumG+=s.g;s.sumB+=s.b;s.count++;if(s.count>=12){s.g0=s.sumG/s.count;s.b0=s.sumB/s.count;s.cal=true;}return;}}
function reset(){s.seen=false;s.cal=false;s.count=0;s.sumG=0;s.sumB=0;s.vx=0;s.vy=0;s.target=null;s.dwellAt=0;s.cursor?.remove();s.cursor=null;s.ring=null;clearTargets();}
function loop(now){
  if(!ready()){reset();s.raf=requestAnimationFrame(loop);return;}
  ensureCursor();
  const dt=Math.min(.035,Math.max(.008,(now-s.last)/1000));s.last=now;
  if(!s.seen){instruction("กำลังรอ Motion Sensor…");visual(0);s.raf=requestAnimationFrame(loop);return;}
  if(!s.cal){instruction("ถือมือถือให้นิ่งครู่เดียวเพื่อเริ่มเล่น");visual(0);s.raf=requestAnimationFrame(loop);return;}
  const ix=axis(s.g-s.g0),iy=axis(s.b-s.b0);
  const desiredX=ix*MAX_SPEED,desiredY=iy*MAX_SPEED;
  s.vx=s.vx*DAMP+desiredX*(1-DAMP);s.vy=s.vy*DAMP+desiredY*(1-DAMP);
  s.x+=s.vx*dt;s.y+=s.vy*dt;
  const grid=q("#memoryGrid").getBoundingClientRect();
  s.x=clamp(s.x,grid.left+18,grid.right-18);s.y=clamp(s.y,grid.top+18,grid.bottom-18);
  const near=nearestCard();
  if(near.card&&near.dist<150){const p=center(near.card),magnet=near.dist<85?.24:.10;s.x+=(p.x-s.x)*magnet;s.y+=(p.y-s.y)*magnet;}
  const next=near.card;
  if(next!==s.target){clearTargets(next);s.target=next;s.dwellAt=0;if(next)next.classList.add("smooth-target");}
  const speed=Math.hypot(s.vx,s.vy);let pct=0;
  if(s.target&&!s.target.classList.contains("flipped")&&!s.target.classList.contains("matched")&&near.dist<92&&speed<STILL_SPEED){
    if(!s.dwellAt)s.dwellAt=now;pct=Math.min(100,(now-s.dwellAt)/DWELL_MS*100);
    s.target.classList.add("opening-target");s.target.style.setProperty("--open-progress",`${pct}%`);s.target.dataset.openPct=String(Math.round(pct));
    instruction(`หยุดบนการ์ด • กำลังเปิด ${Math.round(pct)}%`);
    if(pct>=100){const opened=openTarget();s.dwellAt=0;s.target.classList.remove("opening-target");instruction(opened?"เปิดแล้ว • เอียงต่อเพื่อเลือกอีกใบ":"เปิดไม่สำเร็จ กรุณาโหลดใหม่");}
  }else{
    s.dwellAt=0;if(s.target){s.target.classList.remove("opening-target");s.target.style.removeProperty("--open-progress");delete s.target.dataset.openPct;}
    instruction("เอียงเบา ๆ ให้เป้าไหลไปบนการ์ด แล้วชะลอเพื่อเปิดอัตโนมัติ");
  }
  visual(pct);s.raf=requestAnimationFrame(loop);
}
function copy(){const title=q(".memory-top .title strong"),sub=q(".memory-top .title small"),h=q(".intro-card h1"),lead=q(".intro-card .lead"),btn=q("#startBtn");if(title)title.textContent="Vocabulary Navigation Lab";if(sub)sub.textContent=sub.textContent.replace(/Tilt Snap|Smooth Tilt|Smooth Step|Smooth Hold|Smooth Open|Motion Map/g,"Easy Glide").replace("P?","Passport");if(h)h.textContent="Easy Glide Vocabulary Challenge";if(lead)lead.textContent="เอียงมือถือเบา ๆ ให้เป้าไหลอย่างนุ่มไปยังการ์ด ระบบช่วยดูดเป้าเข้ากึ่งกลาง แล้วชะลอประมาณครึ่งวินาทีเพื่อเปิดอัตโนมัติ";if(btn)btn.textContent="Start Easy Glide";}
copy();const poll=setInterval(()=>{copy();if(ready())clearInterval(poll);},250);window.addEventListener("deviceorientation",onOrientation,true);s.raf=requestAnimationFrame(loop);window.addEventListener("pagehide",()=>{clearInterval(poll);cancelAnimationFrame(s.raf);window.removeEventListener("deviceorientation",onOrientation,true);reset();},{once:true});
window.EW_WORD_MATCH_SMOOTH_TILT=Object.freeze({version:VERSION,interaction:"continuous-low-speed-magnetic-glide-easy-dwell",deadZone:DEAD,maxSpeed:MAX_SPEED,dwellMs:DWELL_MS,directOpen:true,touchFallback:false});
}());
