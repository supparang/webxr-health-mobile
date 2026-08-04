(function(){
"use strict";
const VERSION="2026-08-04-WORD-MATCH-MOTION-MAP-V18";
const MOVE_MS=460, SETTLE_MS=180, DWELL_MS=680, CAL_TRIGGER=3.2, NAV_TRIGGER=2.7, RETURN_RADIUS=2.4, MOTION_LIMIT=.52;
const synthetic=new WeakSet();
const STEPS=[
  {key:"left",label:"เอียงซ้าย",icon:"←"},
  {key:"right",label:"เอียงขวา",icon:"→"},
  {key:"up",label:"เอียงขึ้น",icon:"↑"},
  {key:"down",label:"เอียงลง",icon:"↓"}
];
const s={seen:false,active:false,baseReady:false,baseCount:0,baseG:0,baseB:0,g0:0,b0:0,g:0,b:0,pg:null,pb:null,motion:9,phase:"base",step:0,vectors:{},captured:false,returnAt:0,current:null,pending:null,moving:false,moveAt:0,fx:0,fy:0,tx:0,ty:0,x:0,y:0,stableAt:0,dwellAt:0,canOpen:false,armed:false,cursor:null,ring:null,raf:0};
const q=(x,r=document)=>r.querySelector(x),qa=(x,r=document)=>Array.from(r.querySelectorAll(x));
const finite=v=>Number.isFinite(Number(v));
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ready=()=>!!q("#memoryGrid")&&!!q(".memory-card");
function clearOld(){qa(".memory-card.ew-tilt-focus").forEach(c=>c.classList.remove("ew-tilt-focus"));}
function relay(src){let e;try{e=new DeviceOrientationEvent("deviceorientation",{alpha:finite(src.alpha)?+src.alpha:0,beta:0,gamma:0,absolute:!!src.absolute});}catch(_){e=new Event("deviceorientation");Object.defineProperties(e,{alpha:{value:0},beta:{value:0},gamma:{value:0},absolute:{value:false}});}synthetic.add(e);try{window.dispatchEvent(e);}catch(_){}}
function cards(){return qa(".memory-card:not(.matched):not([disabled])").filter(c=>c.getBoundingClientRect().width>20);}
function center(c){const r=c.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};}
function nearest(cs){const x=innerWidth/2,y=innerHeight*.56;return cs.slice().sort((a,b)=>{const A=center(a),B=center(b);return Math.hypot(A.x-x,A.y-y)-Math.hypot(B.x-x,B.y-y);})[0]||null;}
function neighbor(cur,dir){if(!cur)return nearest(cards());const o=center(cur),v=dir==="left"?[-1,0]:dir==="right"?[1,0]:dir==="up"?[0,-1]:[0,1];return cards().filter(c=>c!==cur).map(c=>{const p=center(c),dx=p.x-o.x,dy=p.y-o.y,f=dx*v[0]+dy*v[1],lat=Math.abs(dx*v[1]-dy*v[0]);return{c,f,score:Math.hypot(dx,dy)+(lat/Math.max(f,1))*260+lat*.4};}).filter(x=>x.f>8).sort((a,b)=>a.score-b.score)[0]?.c||cur;}
function ensureCursor(){if(s.cursor?.isConnected)return;const el=document.createElement("div");el.id="smoothTiltCursor";el.innerHTML='<span class="stc-dot"></span><span class="stc-ring"></span><span class="stc-progress"></span>';document.body.appendChild(el);s.cursor=el;s.ring=el.querySelector(".stc-progress");}
function clearTargets(except){qa(".memory-card.smooth-target,.memory-card.opening-target,.memory-card.moving-target").forEach(c=>{if(c!==except){c.classList.remove("smooth-target","opening-target","moving-target");c.style.removeProperty("--open-progress");delete c.dataset.openPct;}});}
function setInitial(card){if(!card)return;const p=center(card);s.current=card;s.x=p.x;s.y=p.y;clearTargets(card);card.classList.add("smooth-target");}
function beginMove(card){if(!card||card===s.current)return;const p=center(card);clearTargets();s.fx=s.x;s.fy=s.y;s.tx=p.x;s.ty=p.y;s.pending=card;s.moveAt=performance.now();s.moving=true;s.canOpen=false;s.dwellAt=0;s.stableAt=0;try{navigator.vibrate?.(12);}catch(_){}}
function finishMove(now){if(!s.pending)return;s.current=s.pending;s.pending=null;s.x=s.tx;s.y=s.ty;s.moving=false;clearTargets(s.current);s.current.classList.add("smooth-target");s.g0=s.g;s.b0=s.b;s.pg=s.g;s.pb=s.b;s.motion=9;s.stableAt=now;s.dwellAt=0;s.canOpen=true;s.armed=false;try{navigator.vibrate?.(8);}catch(_){}}
function instruction(t){const el=q(".game-panel .instruction");if(el&&el.textContent!==t)el.textContent=t;}
function visual(p=0){if(!s.cursor)return;s.cursor.style.transform=`translate3d(${s.x}px,${s.y}px,0)`;if(s.ring)s.ring.style.setProperty("--progress",`${clamp(p,0,100)*3.6}deg`);}
function calibrationText(){if(s.phase==="base")return "ถือมือถือให้นิ่งในท่าที่ถนัด เพื่อเริ่มปรับทิศทาง";const step=STEPS[s.step];if(!step)return "ปรับทิศทางสำเร็จ";if(s.captured)return `รับทิศ ${step.icon} แล้ว • คืนมือถือใกล้ท่ากลาง`;return `ปรับทิศ ${s.step+1}/4 • ${step.label} ${step.icon} แล้วถือชั่วครู่`;}
function norm(v){const m=Math.hypot(v.g,v.b)||1;return{g:v.g/m,b:v.b/m};}
function dot(a,b){return a.g*b.g+a.b*b.b;}
function mappedDirection(dg,db){const mag=Math.hypot(dg,db);if(mag<NAV_TRIGGER)return"";const u={g:dg/mag,b:db/mag};let best="",score=-Infinity,second=-Infinity;for(const [key,v] of Object.entries(s.vectors)){const sc=dot(u,norm(v));if(sc>score){second=score;score=sc;best=key;}else if(sc>second)second=sc;}return score>.58&&score-second>.08?best:"";}
function captureCalibration(now){if(s.phase==="base"){
  if(s.motion<=MOTION_LIMIT){s.baseG+=s.g;s.baseB+=s.b;s.baseCount++;if(s.baseCount>=12){s.g0=s.baseG/s.baseCount;s.b0=s.baseB/s.baseCount;s.phase="steps";s.step=0;s.captured=false;s.returnAt=0;try{navigator.vibrate?.(20);}catch(_){}}}
  return;
}
if(s.phase!=="steps")return;
const dg=s.g-s.g0,db=s.b-s.b0,mag=Math.hypot(dg,db);
if(!s.captured&&mag>=CAL_TRIGGER&&s.motion<=1.25){const key=STEPS[s.step].key;s.vectors[key]={g:dg,b:db};s.captured=true;s.returnAt=0;try{navigator.vibrate?.([18,35,18]);}catch(_){}}
if(s.captured){if(mag<=RETURN_RADIUS&&s.motion<=MOTION_LIMIT){if(!s.returnAt)s.returnAt=now;if(now-s.returnAt>=180){s.step++;s.captured=false;s.returnAt=0;s.g0=s.g;s.b0=s.b;if(s.step>=STEPS.length){s.phase="play";s.armed=true;s.canOpen=false;try{navigator.vibrate?.([25,40,25]);}catch(_){}}}}else{s.returnAt=0;}}
}
function orient(e){if(synthetic.has(e)||!ready()||!finite(e.gamma)||!finite(e.beta))return;e.stopImmediatePropagation();relay(e);const now=performance.now(),g=+e.gamma,b=+e.beta;s.seen=true;s.g=g;s.b=b;if(s.pg!==null){const delta=Math.hypot(g-s.pg,b-s.pb);s.motion=s.motion*.64+delta*.36;}s.pg=g;s.pb=b;if(!s.active){s.active=true;s.phase="base";s.baseCount=0;s.baseG=0;s.baseB=0;s.motion=9;}if(s.phase!=="play"){captureCalibration(now);return;}if(s.moving)return;if(s.motion<=MOTION_LIMIT){if(!s.stableAt)s.stableAt=now;if(now-s.stableAt>=SETTLE_MS){s.g0=s.g;s.b0=s.b;s.armed=true;}}else{s.stableAt=0;}if(!s.armed)return;const d=mappedDirection(s.g-s.g0,s.b-s.b0);if(!d)return;s.armed=false;s.stableAt=0;const n=neighbor(s.current,d);if(n!==s.current)beginMove(n);}
const ease=t=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
function openCurrent(){if(!s.current)return false;const id=s.current.dataset.cardId;if(!id||typeof window.EW_WORD_MATCH_OPEN_CARD!=="function")return false;window.EW_WORD_MATCH_OPEN_CARD(id);return true;}
function loop(now){if(!ready()){s.active=false;s.seen=false;s.current=null;s.pending=null;s.cursor?.remove();s.cursor=null;s.ring=null;clearTargets();s.raf=requestAnimationFrame(loop);return;}clearOld();ensureCursor();if(!s.current||!s.current.isConnected||s.current.classList.contains("matched"))setInitial(nearest(cards()));if(!s.seen){instruction("กำลังรอ Motion Sensor…");visual();s.raf=requestAnimationFrame(loop);return;}if(s.phase!=="play"){instruction(calibrationText());visual();s.raf=requestAnimationFrame(loop);return;}if(s.moving){const t=clamp((now-s.moveAt)/MOVE_MS,0,1),e=ease(t);s.x=s.fx+(s.tx-s.fx)*e;s.y=s.fy+(s.ty-s.fy)*e;instruction(`กำลังเลื่อนไปยังการ์ดถัดไป ${Math.round(t*100)}%`);visual();if(t>=1)finishMove(now);s.raf=requestAnimationFrame(loop);return;}let pct=0;const stable=s.motion<=MOTION_LIMIT;if(s.current&&!s.current.classList.contains("flipped")&&!s.current.classList.contains("matched")){
  if(s.canOpen&&stable){if(!s.stableAt)s.stableAt=now;if(now-s.stableAt>=SETTLE_MS){if(!s.dwellAt)s.dwellAt=now;pct=Math.min(100,(now-s.dwellAt)/DWELL_MS*100);s.current.classList.add("opening-target");s.current.style.setProperty("--open-progress",`${pct}%`);s.current.dataset.openPct=String(Math.round(pct));instruction(`หยุดนิ่ง • กำลังเปิด ${Math.round(pct)}%`);if(pct>=100){s.dwellAt=0;s.canOpen=false;s.current.classList.remove("opening-target");const ok=openCurrent();instruction(ok?"เปิดการ์ดแล้ว • เอียงตามทิศที่ปรับไว้เพื่อเลือกใบถัดไป":"เปิดการ์ดไม่สำเร็จ • กรุณาโหลดใหม่");}}}
  else if(!s.canOpen){instruction("เอียงไปหนึ่งทิศเพื่อเลือกการ์ด แล้วหยุดนิ่งเพื่อเปิด");}
  else{ s.stableAt=0;s.dwellAt=0;s.current.classList.remove("opening-target");instruction("หยุดมือถือให้นิ่งเพื่อเปิดการ์ด"); }
}else{instruction("เอียงตามทิศที่ปรับไว้เพื่อเลือกการ์ดใบถัดไป");}
visual(pct);s.raf=requestAnimationFrame(loop);}
function copy(){const title=q(".memory-top .title strong"),sub=q(".memory-top .title small"),h=q(".intro-card h1"),lead=q(".intro-card .lead"),btn=q("#startBtn");if(title)title.textContent="Vocabulary Navigation Lab";if(sub)sub.textContent=sub.textContent.replace(/Tilt Snap|Smooth Tilt|Smooth Step|Smooth Hold|Smooth Open/g,"Motion Map").replace("P?","Passport");if(h)h.textContent="Motion-Mapped Vocabulary Challenge";if(lead)lead.textContent="ระบบจะเรียนรู้ทิศการเอียงของมือถือเครื่องนี้ก่อนเล่น จากนั้นเอียงหนึ่งทิศเพื่อเลื่อนไปหนึ่งใบ และหยุดนิ่งเพื่อเปิดอัตโนมัติ";if(btn)btn.textContent="Start Motion Calibration";}
copy();const poll=setInterval(()=>{copy();if(ready())clearInterval(poll);},300);window.addEventListener("deviceorientation",orient,true);s.raf=requestAnimationFrame(loop);window.addEventListener("pagehide",()=>{clearInterval(poll);cancelAnimationFrame(s.raf);window.removeEventListener("deviceorientation",orient,true);s.cursor?.remove();clearTargets();},{once:true});window.EW_WORD_MATCH_SMOOTH_TILT=Object.freeze({version:VERSION,interaction:"four-direction-device-specific-motion-map",calibrationSteps:4,moveDurationMs:MOVE_MS,dwellMs:DWELL_MS,directOpen:true,touchFallback:false});
}());
