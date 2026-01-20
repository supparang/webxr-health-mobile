// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR SAFE — FAIR PACK
// 🎯 เด็ก ป.5 เล่นได้ / วิจัยได้ / ไม่โกง / ไม่ AI หลอก
// Emits: hha:start, hha:score, hha:time, hha:judge, hha:end

'use strict';

const WIN = window;
const DOC = document;

// --------------------------------------------------
// Utils
// --------------------------------------------------
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
const now = ()=>performance.now();
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

// --------------------------------------------------
// State
// --------------------------------------------------
const S = {
  started:false, ended:false,
  view:'mobile', run:'play', diff:'normal',
  timePlan:80, timeLeft:80,
  score:0, miss:0,
  hitGood:0, hitJunk:0, expireGood:0,
  combo:0, comboMax:0,
  lastSpawn:0,
  seed:null,
};

// --------------------------------------------------
// DOM
// --------------------------------------------------
const el = {};
function bindDOM(){
  [
    'hud-score','hud-time','hud-miss','hud-grade',
    'gj-layer'
  ].forEach(id=>el[id]=DOC.getElementById(id));
}

// --------------------------------------------------
// RNG (seeded – FAIR)
// --------------------------------------------------
function makeRNG(seed){
  let x = seed % 2147483647;
  if (x <= 0) x += 2147483646;
  return ()=> (x = x * 16807 % 2147483647) / 2147483647;
}

// --------------------------------------------------
// Spawn Area (กัน HUD บัง)
// --------------------------------------------------
function getSafeRect(){
  const r = DOC.documentElement.getBoundingClientRect();
  const top = parseInt(getComputedStyle(DOC.documentElement)
    .getPropertyValue('--gj-top-safe')) || 80;
  const bot = parseInt(getComputedStyle(DOC.documentElement)
    .getPropertyValue('--gj-bottom-safe')) || 120;

  return {
    x:20,
    y:top,
    w:r.width-40,
    h:r.height-top-bot
  };
}

// --------------------------------------------------
// Target
// --------------------------------------------------
function spawnTarget(kind){
  const layer = el['gj-layer'];
  if(!layer) return;

  const safe = getSafeRect();
  const x = safe.x + S.rng()*safe.w;
  const y = safe.y + S.rng()*safe.h;

  const t = DOC.createElement('div');
  t.className = 'gj-target';
  t.textContent = (kind==='good'?'🥦':'🍟');
  t.style.left = x+'px';
  t.style.top  = y+'px';

  let alive = true;
  const born = now();

  t.addEventListener('pointerdown',()=>{
    if(!alive) return;
    alive=false;
    t.remove();

    if(kind==='good'){
      S.hitGood++;
      S.combo++;
      S.comboMax = Math.max(S.comboMax,S.combo);
      S.score += 10 + Math.min(10,S.combo);
    }else{
      S.hitJunk++;
      S.miss++;
      S.combo=0;
    }
    updateHUD();
  });

  layer.appendChild(t);

  // expire (GOOD only = MISS)
  setTimeout(()=>{
    if(!alive) return;
    alive=false;
    t.remove();
    if(kind==='good'){
      S.expireGood++;
      S.miss++;
      S.combo=0;
      updateHUD();
    }
  },1600);
}

// --------------------------------------------------
// HUD
// --------------------------------------------------
function updateHUD(){
  if(el['hud-score']) el['hud-score'].textContent = S.score;
  if(el['hud-time'])  el['hud-time'].textContent  = Math.ceil(S.timeLeft);
  if(el['hud-miss'])  el['hud-miss'].textContent  = S.miss;

  let g='C';
  if(S.score>=160 && S.miss<=3) g='A';
  else if(S.score>=100) g='B';
  if(el['hud-grade']) el['hud-grade'].textContent = g;

  emit('hha:score',{score:S.score});
}

// --------------------------------------------------
// Loop
// --------------------------------------------------
function tick(ts){
  if(!S.started || S.ended) return;

  const dt = Math.min(0.25,(ts-S.lastTick)/1000);
  S.lastTick = ts;
  S.timeLeft -= dt;

  if(ts - S.lastSpawn > 900){
    S.lastSpawn = ts;
    spawnTarget(S.rng()<0.72?'good':'junk');
  }

  if(S.timeLeft<=0){
    endGame('timeup');
    return;
  }

  emit('hha:time',{left:S.timeLeft});
  requestAnimationFrame(tick);
}

// --------------------------------------------------
// End
// --------------------------------------------------
function endGame(reason){
  if(S.ended) return;
  S.ended=true;

  const summary = {
    game:'GoodJunkVR',
    run:S.run,
    diff:S.diff,
    score:S.score,
    miss:S.miss,
    comboMax:S.comboMax,
    hitGood:S.hitGood,
    hitJunk:S.hitJunk,
    expireGood:S.expireGood,
    duration:S.timePlan,
    reason
  };

  emit('hha:end',summary);
}

// --------------------------------------------------
// Boot
// --------------------------------------------------
export function boot(opts={}){
  bindDOM();

  S.view = opts.view || qs('view','mobile');
  S.run  = opts.run  || qs('run','play');
  S.diff = opts.diff || qs('diff','normal');
  S.timePlan = Number(opts.time || qs('time','80')) || 80;
  S.timeLeft = S.timePlan;

  S.seed = Number(opts.seed || Date.now());
  S.rng  = makeRNG(S.seed);

  S.started=true;
  S.lastTick = now();
  S.lastSpawn = 0;

  updateHUD();
  emit('hha:start',{view:S.view,run:S.run,diff:S.diff,seed:S.seed});
  requestAnimationFrame(tick);
}