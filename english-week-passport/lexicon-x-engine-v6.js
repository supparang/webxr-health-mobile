(function(){
"use strict";

const VERSION="2026-08-05-LEXICON-X-FUN-V6";
const root=document.getElementById("screen");
const cfg=window.EW_CONFIG;
const rotation=window.EW_ROTATION;
const BANK=[
{id:"lx01",a:"reliable",b:"น่าเชื่อถือ",level:"B1"},
{id:"lx02",a:"deadline",b:"กำหนดส่ง",level:"A2+"},
{id:"lx03",a:"conduct research",b:"ดำเนินการวิจัย",level:"B1+"},
{id:"lx04",a:"submit",b:"ส่งงาน",level:"A2"},
{id:"lx05",a:"collaboration",b:"การทำงานร่วมกัน",level:"B1+"},
{id:"lx06",a:"feedback",b:"ข้อมูลป้อนกลับ",level:"B1"},
{id:"lx07",a:"academic",b:"เชิงวิชาการ",level:"B1"},
{id:"lx08",a:"presentation",b:"การนำเสนอ",level:"A2+"},
{id:"lx09",a:"responsibility",b:"ความรับผิดชอบ",level:"B1+"},
{id:"lx10",a:"opportunity",b:"โอกาส",level:"B1"},
{id:"lx11",a:"schedule",b:"ตารางเวลา",level:"A2"},
{id:"lx12",a:"evidence",b:"หลักฐาน",level:"B1"}
];

const S={identity:null,pairs:[],deck:[],current:0,first:null,locked:false,matched:0,mistakes:0,flips:0,combo:0,bestCombo:0,score:0,startedAt:0,timer:0,raf:0,dwellAt:0,swipe:null,tiltReady:false,g0:null,b0:null,lastTiltAt:0,audio:null};

const h=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;"," ":" ",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]||m));
function identity(){try{return JSON.parse(localStorage.getItem(cfg?.cacheKeys?.identity||"ew_identity")||"null");}catch(_){return null;}}
function shell(body){root.innerHTML=`<section class="panel">${body}</section>`;}
function goPassport(){stop();location.href="./index.html?resume=memory&v=20260805-fun6";}
function logout(){stop();try{localStorage.removeItem(cfg?.cacheKeys?.identity||"ew_identity");}catch(_){}location.href="./index.html?v=20260805-fun6";}
function vibrate(p){try{navigator.vibrate?.(p);}catch(_){} }
function tone(freq,duration=.07,type="sine",gain=.035){try{S.audio=S.audio||new (window.AudioContext||window.webkitAudioContext)();const o=S.audio.createOscillator(),g=S.audio.createGain();o.type=type;o.frequency.value=freq;g.gain.value=gain;o.connect(g);g.connect(S.audio.destination);o.start();g.gain.exponentialRampToValueAtTime(.0001,S.audio.currentTime+duration);o.stop(S.audio.currentTime+duration);}catch(_){} }
function safeButton(id,fn){const el=document.getElementById(id);if(!el)return;el.addEventListener("click",fn);el.addEventListener("pointerup",fn);}

document.getElementById("back").onclick=goPassport;
document.getElementById("exit").onclick=logout;

function intro(){
  S.identity=identity();
  if(!S.identity?.playerId){location.replace("./index.html?v=20260805-fun6");return;}
  shell(`<div class="intro">
    <div class="xmark">LX</div>
    <h1>LEXICON X</h1>
    <p class="lead">จับคู่คำศัพท์มหาวิทยาลัยให้ครบ 6 คู่ • ปัดเพื่อเลื่อน • ระบบเปิดให้อัตโนมัติ</p>
    <div class="notice"><strong>${h(S.identity.nickname||S.identity.fullName||"Player")}</strong><br><small>Player ID: ${h(S.identity.playerId)}</small></div>
    <div class="actions">
      <button id="start" class="btn primary" type="button">Start Challenge</button>
      <button id="how" class="btn secondary" type="button">How to Play</button>
      <button id="home" class="btn secondary" type="button">Back to Passport</button>
    </div>
  </div>`);
  safeButton("start",start);
  safeButton("home",goPassport);
  safeButton("how",()=>{
    const n=document.querySelector(".notice");
    if(n)n.innerHTML="<strong>วิธีเล่น</strong><br>ปัดซ้าย–ขวา–ขึ้น–ลงเพื่อเลือกการ์ด • หยุดครู่เดียว ระบบจะเปิดอัตโนมัติ • จับคู่คำอังกฤษกับความหมายไทย";
  });
}

function choosePairs(){
  const pool=rotation?.balancedSample?rotation.balancedSample(BANK,8,"lexicon_x:v6:pool",x=>x.level):BANK.slice(0,8);
  return rotation?.balancedSample?rotation.balancedSample(pool,6,"lexicon_x:v6:play",x=>x.level):pool.slice(0,6);
}
function order(items){return rotation?.order?rotation.order(items,"lexicon_x_v6","deck"):items.slice().sort(()=>Math.random()-.5);}
function start(){
  S.pairs=choosePairs();
  S.deck=order(S.pairs.flatMap(p=>[
    {id:p.id+"a",pair:p.id,text:p.a,side:"word",level:p.level,flipped:false,matched:false},
    {id:p.id+"b",pair:p.id,text:p.b,side:"meaning",level:p.level,flipped:false,matched:false}
  ]));
  Object.assign(S,{current:0,first:null,locked:false,matched:0,mistakes:0,flips:0,combo:0,bestCombo:0,score:0,startedAt:Date.now(),dwellAt:0,swipe:null,tiltReady:false,g0:null,b0:null,lastTiltAt:0});
  renderGame();
  window.addEventListener("deviceorientation",onTilt,true);
  S.timer=setInterval(updateHud,500);
  S.raf=requestAnimationFrame(loop);
  tone(520,.09,"triangle",.04);
}

function renderGame(){
  shell(`<div class="hud">
    <div class="stat"><small>PROGRESS</small><strong id="progress">0 / 6</strong></div>
    <div class="stat"><small>SCORE</small><strong id="score">0</strong></div>
    <div class="stat"><small>TIME</small><strong id="time">0:00</strong></div>
  </div>
  <p id="instruction" class="instruction">ปัดเพื่อเลือกการ์ด • ระบบจะเปิดให้อัตโนมัติ</p>
  <div id="combo" class="feedback">COMBO ×1</div>
  <div id="grid" class="grid">${S.deck.map((c,i)=>`<button class="card${i===0?" target":""}" data-id="${c.id}" data-index="${i}" type="button" tabindex="-1"><span class="inner"><span class="face back">LEXICON X<small>${c.level}</small></span><span class="face front">${h(c.text)}<small>${c.side==="word"?"ENGLISH":"THAI MEANING"}</small></span></span></button>`).join("")}</div>
  <div id="feedback" class="feedback">SWIPE NAVIGATION READY</div>`);
  const grid=document.getElementById("grid");
  grid.style.touchAction="none";
  grid.addEventListener("pointerdown",e=>{S.swipe={x:e.clientX,y:e.clientY,t:performance.now()};},{passive:true});
  grid.addEventListener("pointerup",onSwipe,{passive:true});
  grid.addEventListener("pointercancel",()=>S.swipe=null,{passive:true});
  S.dwellAt=performance.now()+420;
}

function updateHud(){
  const sec=Math.floor((Date.now()-S.startedAt)/1000);
  const p=document.getElementById("progress"),sc=document.getElementById("score"),t=document.getElementById("time"),c=document.getElementById("combo");
  if(p)p.textContent=`${S.matched} / 6`;
  if(sc)sc.textContent=String(S.score);
  if(t)t.textContent=`${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}`;
  if(c)c.textContent=`COMBO ×${Math.max(1,S.combo)}`;
}

function cardAt(i){return document.querySelector(`.card[data-index="${i}"]`);}
function gridCols(){return 3;}
function move(dir,source="SWIPE"){
  if(S.locked)return;
  const cols=gridCols(),rows=Math.ceil(S.deck.length/cols),r=Math.floor(S.current/cols),c=S.current%cols;
  let nr=r,nc=c;
  if(dir==="left")nc=Math.max(0,c-1);
  if(dir==="right")nc=Math.min(cols-1,c+1);
  if(dir==="up")nr=Math.max(0,r-1);
  if(dir==="down")nr=Math.min(rows-1,r+1);
  const next=Math.min(S.deck.length-1,nr*cols+nc);
  if(next===S.current){vibrate(8);tone(180,.05,"square",.018);return;}
  document.querySelectorAll(".card.target,.card.opening").forEach(el=>{el.classList.remove("target","opening");el.style.removeProperty("--p");delete el.dataset.pct;});
  S.current=next;
  const el=cardAt(next);el?.classList.add("target");
  S.dwellAt=performance.now()+360;
  const text={left:"ซ้าย",right:"ขวา",up:"ขึ้น",down:"ลง"}[dir];
  setInstruction(`เลื่อนไป${text} • ${source}`);
  vibrate(10);tone(300,.045,"triangle",.02);
}

function onSwipe(e){
  if(!S.swipe)return;
  const dx=e.clientX-S.swipe.x,dy=e.clientY-S.swipe.y,dt=performance.now()-S.swipe.t;S.swipe=null;
  if(dt>1000||Math.hypot(dx,dy)<26)return;
  if(Math.abs(dx)>Math.abs(dy))move(dx>0?"right":"left","SWIPE");else move(dy>0?"down":"up","SWIPE");
}

function onTilt(e){
  const g=Number(e.gamma),b=Number(e.beta);if(!Number.isFinite(g)||!Number.isFinite(b))return;
  if(S.g0===null){S.g0=g;S.b0=b;return;}
  S.tiltReady=true;
  const now=performance.now();if(now-S.lastTiltAt<650)return;
  const dx=g-S.g0,dy=b-S.b0;
  if(Math.max(Math.abs(dx),Math.abs(dy))<7)return;
  S.lastTiltAt=now;S.g0=g;S.b0=b;
  if(Math.abs(dx)>Math.abs(dy))move(dx>0?"right":"left","TILT");else move(dy>0?"down":"up","TILT");
}

function setInstruction(t){const el=document.getElementById("instruction");if(el)el.textContent=t;}
function loop(now){
  if(!document.getElementById("grid"))return;
  const el=cardAt(S.current),card=S.deck[S.current];
  if(el&&!S.locked&&card&&!card.flipped&&!card.matched&&S.dwellAt&&now>=S.dwellAt){
    const pct=Math.min(100,(now-S.dwellAt)/430*100);
    el.classList.add("opening");el.dataset.pct=String(Math.round(pct));el.style.setProperty("--p",pct+"%");
    setInstruction(`กำลังเปิด ${Math.round(pct)}%`);
    if(pct>=100){S.dwellAt=0;el.classList.remove("opening");flip(S.current);}
  }
  S.raf=requestAnimationFrame(loop);
}

function flip(index){
  const card=S.deck[index],el=cardAt(index);if(!card||!el||card.flipped||card.matched||S.locked)return;
  card.flipped=true;S.flips++;el.classList.add("flipped");tone(620,.07,"sine",.035);vibrate(16);
  if(!S.first){S.first=index;setInstruction("เปิดใบแรกแล้ว • ปัดหาอีกใบเพื่อจับคู่");return;}
  const firstIndex=S.first,first=S.deck[firstIndex];S.first=null;S.locked=true;
  setTimeout(()=>{
    if(first.pair===card.pair){
      first.matched=card.matched=true;first.flipped=card.flipped=true;
      cardAt(firstIndex)?.classList.add("matched");el.classList.add("matched");
      S.matched++;S.combo++;S.bestCombo=Math.max(S.bestCombo,S.combo);S.score+=100+(S.combo-1)*25;
      setInstruction(S.combo>=3?`🔥 COMBO ×${S.combo}!`:`✓ MATCH! +${100+(S.combo-1)*25}`);
      tone(880,.11,"triangle",.05);setTimeout(()=>tone(1100,.10,"triangle",.04),80);vibrate([20,35,30]);
      if(S.matched>=6)return finish();
    }else{
      first.flipped=card.flipped=false;cardAt(firstIndex)?.classList.remove("flipped");el.classList.remove("flipped");
      S.mistakes++;S.combo=0;S.score=Math.max(0,S.score-15);setInstruction("ยังไม่ตรงกัน • จำตำแหน่งแล้วลองใหม่");
      tone(170,.12,"sawtooth",.022);vibrate([18,30,18]);
    }
    S.locked=false;S.dwellAt=performance.now()+520;
  },620);
}

function finish(){
  stop();const sec=Math.max(1,Math.floor((Date.now()-S.startedAt)/1000));const accuracy=Math.round((12/Math.max(12,S.flips))*100);const rank=accuracy>=92&&sec<=75?"S":accuracy>=84?"A":accuracy>=70?"B":"C";
  shell(`<div class="summary"><div class="rank">${rank}</div><h1>Challenge Complete</h1><p class="lead">จับคู่ครบ 6 คู่แล้ว</p>
    <div class="hud"><div class="stat"><small>ACCURACY</small><strong>${accuracy}%</strong></div><div class="stat"><small>BEST COMBO</small><strong>×${Math.max(1,S.bestCombo)}</strong></div><div class="stat"><small>TIME</small><strong>${Math.floor(sec/60)}:${String(sec%60).padStart(2,"0")}</strong></div></div>
    <div class="notice">Score <strong>${S.score}</strong> • Errors <strong>${S.mistakes}</strong></div>
    <div class="actions"><button id="again" class="btn primary" type="button">Play Again</button><button id="done" class="btn secondary" type="button">Back to Passport</button></div></div>`);
  safeButton("again",start);safeButton("done",goPassport);tone(740,.12,"triangle",.05);setTimeout(()=>tone(980,.16,"triangle",.045),110);vibrate([30,40,50]);
}

function stop(){clearInterval(S.timer);cancelAnimationFrame(S.raf);window.removeEventListener("deviceorientation",onTilt,true);}
window.addEventListener("pagehide",stop,{once:true});
window.EW_LEXICON_X=Object.freeze({version:VERSION,mode:"swipe-primary-tilt-bonus-auto-open",funPass:true});
intro();
}());
