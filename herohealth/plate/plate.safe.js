// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — PRODUCTION (HHA Standard + VR-feel + Plate Rush + Boss + Powerups + AI)
// ✅ Play: adaptive ON (AI Difficulty Director)
// ✅ Study/Research: deterministic seed + adaptive OFF + coach OFF + assist OFF + powerups OFF + boss OFF
// ✅ AI Coach: explainable micro-tips + rate-limit (+ personalization from history)
// ✅ AI Pattern Generator: scripted/seeded patterns (boss scripts) + mix in play
// ✅ Miss Danger meter + missLimit end (pressure like GoodJunk)
// ✅ Power-ups: SlowMo / Magnet / DoubleScore / Cleanse (play only)
// ✅ Boss phases: 2 scripted phases (last 20s & last 10s) (play only)
// ✅ Crosshair shooting: listens hha:shoot + aim assist lockPx (play configurable; research OFF)
// ✅ Emits: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end, hha:celebrate, hha:adaptive, hha:boss, hha:power
// ✅ End summary: localStorage HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ Flush-hardened: before end/back hub/reload
// ✅ Layout-stable spawn + resize/enterVR reflow + look-shift compensated spawn + clamp within viewport

'use strict';

// ------------------------- Utilities -------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a : (v>b?b:v); }
function nowMs(){ return (ROOT.performance && performance.now) ? performance.now() : Date.now(); }
function qs(id){ return DOC.getElementById(id); }
function on(el, ev, fn, opt){ if(el) el.addEventListener(ev, fn, opt||false); }
function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}
function setText(id, txt){
  const el = qs(id);
  if(el) el.textContent = String(txt);
}
function fmtPct(x){ x = Number(x)||0; return `${Math.round(x)}%`; }
function safeNum(x, d=0){ x = Number(x); return isFinite(x) ? x : d; }

// Seeded RNG (mulberry32)
function mulberry32(seed){
  let t = (seed >>> 0) || 1;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)] || arr[0]; }
function uid(){ return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2); }

// ------------------------- HHA Standard: storage -------------------------
const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

function loadJson(key, fallback){
  try{
    const s = localStorage.getItem(key);
    if(!s) return fallback;
    return JSON.parse(s);
  }catch(e){ return fallback; }
}
function saveJson(key, obj){
  try{ localStorage.setItem(key, JSON.stringify(obj)); }catch(e){}
}

// ------------------------- Query params / mode / policy -------------------------
const URLX = new URL(location.href);
const hubUrl = URLX.searchParams.get('hub') || '';
const runRaw = (URLX.searchParams.get('run') || URLX.searchParams.get('runMode') || 'play').toLowerCase();
const diff   = (URLX.searchParams.get('diff') || 'normal').toLowerCase();
const timePlannedSec = clamp(URLX.searchParams.get('time') || 90, 20, 9999);
const seedParam = URLX.searchParams.get('seed');
const policy = (URLX.searchParams.get('policy') || '').toLowerCase(); // 'research' strict
const patternParam = (URLX.searchParams.get('pattern') || 'mix').toLowerCase(); // mix/grid/ring/edges/center
const aiParam = (URLX.searchParams.get('ai') || 'on').toLowerCase();
const assistParam = (URLX.searchParams.get('assist') || 'on').toLowerCase();

const isStudy = (runRaw === 'study' || runRaw === 'research');
const runMode = isStudy ? 'study' : 'play';

// strict research policy: disable intervention even if run=play accidentally
const isResearchStrict = isStudy || (policy === 'research' || policy === 'strict');

const DEFAULT_STUDY_SEED = 13579;
const seed =
  isStudy ? (Number(seedParam)||DEFAULT_STUDY_SEED) :
  (seedParam != null ? (Number(seedParam)||DEFAULT_STUDY_SEED) : (Date.now() ^ (Math.random()*1e9)));

const rng = mulberry32(seed);

// Feature toggles
const AI_ENABLED = (!isResearchStrict) && (aiParam !== 'off');
const ASSIST_ENABLED = (!isResearchStrict) && (assistParam !== 'off');
const POWERUPS_ENABLED = (!isResearchStrict); // play only
const BOSS_ENABLED = (!isResearchStrict);     // play only

// ------------------------- Difficulty tuning -------------------------
const DIFF = {
  easy:   { size: 64, lifeMs: 1800, spawnPerSec: 1.5,  junkRate: 0.18, feverUpJunk: 12, feverUpMiss: 8,  feverDownGood: 2.8, missLimit: 10 },
  normal: { size: 56, lifeMs: 1600, spawnPerSec: 1.85, junkRate: 0.24, feverUpJunk: 14, feverUpMiss: 9,  feverDownGood: 2.4, missLimit: 9  },
  hard:   { size: 48, lifeMs: 1400, spawnPerSec: 2.2,  junkRate: 0.30, feverUpJunk: 16, feverUpMiss: 10, feverDownGood: 2.0, missLimit: 8  },
};
const base = DIFF[diff] || DIFF.normal;

// Adaptive (Play only)
let adaptiveOn = (!isResearchStrict);
let adapt = { sizeMul: 1.0, spawnMul: 1.0, junkMul: 1.0 };

// ------------------------- DOM handles -------------------------
const layer = qs('plate-layer');
const hitFx = qs('hitFx');

const btnStart = qs('btnStart');
const startOverlay = qs('startOverlay');
const btnPause = qs('btnPause');
const hudPaused = qs('hudPaused');
const btnRestart = qs('btnRestart');
const btnBackHub = qs('btnBackHub');
const btnPlayAgain = qs('btnPlayAgain');
const btnEnterVR = qs('btnEnterVR');

const resultBackdrop = qs('resultBackdrop');

const hudTop = qs('hudTop');
const miniPanel = qs('miniPanel');
const coachPanel = qs('coachPanel');
const hudBtns = qs('hudBtns');

// optional UI (may not exist in html; we will inject fallback)
let dangerBar = qs('dangerBar');
let bossBar = qs('bossBar');
let powerRow = qs('powerRow');

if(!layer){
  console.error('[PlateVR] missing #plate-layer');
}

// ------------------------- Minimal FX (CSS injection fallback) -------------------------
(function ensureFxCss(){
  const id = 'plate-safe-fx-css';
  if(DOC.getElementById(id)) return;
  const st = DOC.createElement('style');
  st.id = id;
  st.textContent = `
    .pfx-shake { animation:pfxShake .18s ease-in-out 0s 2; }
    @keyframes pfxShake { 0%{transform:translate(0,0)} 25%{transform:translate(2px,0)} 50%{transform:translate(-2px,1px)} 75%{transform:translate(1px,-1px)} 100%{transform:translate(0,0)} }
    .pfx-blink { animation:pfxBlink .26s ease-in-out 0s 6; }
    @keyframes pfxBlink { 0%,100%{filter:none} 50%{filter:brightness(1.35)} }
    .pfx-tick { animation:pfxTick .12s linear 0s 1; }
    @keyframes pfxTick { 0%{transform:scale(1)} 50%{transform:scale(1.03)} 100%{transform:scale(1)} }
    #hitFx.pfx-hit-good{opacity:1; background:radial-gradient(circle at center, rgba(34,197,94,.18), transparent 55%);}
    #hitFx.pfx-hit-bad {opacity:1; background:radial-gradient(circle at center, rgba(239,68,68,.18), transparent 55%);}

    /* fallback widgets */
    .plate-float-widgets{
      position:fixed; left:12px; right:12px; bottom:12px;
      display:flex; gap:10px; align-items:center; justify-content:space-between;
      pointer-events:none; z-index:80;
    }
    .plate-pill{
      pointer-events:none;
      padding:8px 10px;
      border-radius:999px;
      background:rgba(2,6,23,.70);
      border:1px solid rgba(148,163,184,.18);
      backdrop-filter: blur(8px);
      color:#e5e7eb;
      font:800 12px/1 system-ui;
      display:flex; gap:8px; align-items:center;
      box-shadow: 0 16px 36px rgba(0,0,0,.30);
      max-width:52vw;
      overflow:hidden;
      white-space:nowrap;
      text-overflow:ellipsis;
    }
    .plate-bar{
      width:160px; height:10px; border-radius:999px;
      background:rgba(148,163,184,.18);
      overflow:hidden;
      border:1px solid rgba(148,163,184,.14);
    }
    .plate-bar > i{ display:block; height:100%; width:0%; background:rgba(239,68,68,.60); }
    .plate-bossbar > i{ background:rgba(34,197,94,.60); }
    .plate-powerrow{
      pointer-events:none;
      display:flex; gap:6px; align-items:center;
      padding:6px 8px; border-radius:999px;
      background:rgba(2,6,23,.60);
      border:1px solid rgba(148,163,184,.18);
      backdrop-filter: blur(8px);
      box-shadow: 0 16px 36px rgba(0,0,0,.30);
      color:#e5e7eb;
      font:900 12px/1 system-ui;
    }
    .plate-power{
      display:flex; gap:6px; align-items:center;
      padding:4px 8px; border-radius:999px;
      border:1px solid rgba(148,163,184,.16);
      background:rgba(15,23,42,.55);
    }
  `;
  DOC.head.appendChild(st);
})();

function ensureWidgets(){
  // If html didn't provide, we inject minimal widgets so features are visible
  let wrap = qs('plateWidgets');
  if(!wrap){
    wrap = DOC.createElement('div');
    wrap.id = 'plateWidgets';
    wrap.className = 'plate-float-widgets';
    DOC.body.appendChild(wrap);
  }

  if(!dangerBar){
    const pill = DOC.createElement('div');
    pill.className = 'plate-pill';
    pill.innerHTML = `😱 Danger <span class="plate-bar"><i id="dangerFill"></i></span> <b id="dangerText">0%</b>`;
    wrap.appendChild(pill);
    dangerBar = qs('dangerFill');
  }

  if(!bossBar){
    const pill = DOC.createElement('div');
    pill.className = 'plate-pill';
    pill.innerHTML = `👑 Boss <span class="plate-bar plate-bossbar"><i id="bossFill"></i></span> <b id="bossText">—</b>`;
    wrap.appendChild(pill);
    bossBar = qs('bossFill');
  }

  if(!powerRow){
    powerRow = DOC.createElement('div');
    powerRow.id = 'powerRow';
    powerRow.className = 'plate-powerrow';
    powerRow.style.marginLeft = 'auto';
    powerRow.innerHTML = `⚡ <span id="powerList">—</span>`;
    wrap.appendChild(powerRow);
  }
}

function fxPulse(kind){
  if(!hitFx) return;
  hitFx.classList.remove('pfx-hit-good','pfx-hit-bad');
  hitFx.classList.add(kind === 'bad' ? 'pfx-hit-bad' : 'pfx-hit-good');
  clearTimeout(fxPulse._t);
  fxPulse._t = setTimeout(()=>{ hitFx.classList.remove('pfx-hit-good','pfx-hit-bad'); }, 140);
}
function fxShake(strength=1){
  DOC.body.classList.remove('pfx-shake');
  void DOC.body.offsetWidth;
  DOC.body.classList.add('pfx-shake');
  // scale shake frequency via repeated triggers
  clearTimeout(fxShake._t);
  const ms = clamp(450 / clamp(strength,1,3), 160, 520);
  fxShake._t = setTimeout(()=>DOC.body.classList.remove('pfx-shake'), ms);
}
function fxBlink(){
  DOC.body.classList.remove('pfx-blink');
  void DOC.body.offsetWidth;
  DOC.body.classList.add('pfx-blink');
  clearTimeout(fxBlink._t);
  fxBlink._t = setTimeout(()=>DOC.body.classList.remove('pfx-blink'), 1800);
}
function fxTick(){
  DOC.body.classList.remove('pfx-tick');
  void DOC.body.offsetWidth;
  DOC.body.classList.add('pfx-tick');
  clearTimeout(fxTick._t);
  fxTick._t = setTimeout(()=>DOC.body.classList.remove('pfx-tick'), 160);
}

function playTickSound(){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if(!AC) return;
    const ctx = playTickSound._ctx || (playTickSound._ctx = new AC());
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = 880;
    g.gain.value = 0.03;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.03);
  }catch(e){}
}

// ------------------------- VR-feel look (gyro + drag) -------------------------
let look = { x:0, y:0, dragging:false, lastX:0, lastY:0 };
let gyro = { gx:0, gy:0, ok:false };

// keep last applied shift (for spawn compensation)
let lookShift = { x:0, y:0 };

function computeLookShift(){
  const maxX = 24, maxY = 22;
  const x = clamp(look.x + gyro.gx, -maxX, maxX);
  const y = clamp(look.y + gyro.gy, -maxY, maxY);
  return { x, y };
}
function applyLook(){
  if(!layer) return;
  const sh = computeLookShift();
  lookShift.x = sh.x;
  lookShift.y = sh.y;
  layer.style.transform = `translate3d(${sh.x}px, ${sh.y}px, 0)`;
}

function enableGyroIfAllowed(){
  const DO = ROOT.DeviceOrientationEvent;
  if(!DO) return;
  if(typeof DO.requestPermission === 'function'){ return; }
  gyro.ok = true;
  ROOT.addEventListener('deviceorientation', (e)=>{
    const g = Number(e.gamma)||0;
    const b = Number(e.beta)||0;
    gyro.gx = clamp(g/90, -1, 1) * 14;
    gyro.gy = clamp(b/90, -1, 1) * 10;
    applyLook();
  }, { passive:true });
}
function requestGyroPermission(){
  const DO = ROOT.DeviceOrientationEvent;
  if(!DO || typeof DO.requestPermission !== 'function') { enableGyroIfAllowed(); return Promise.resolve(true); }
  return DO.requestPermission().then((res)=>{
    if(res === 'granted'){
      gyro.ok = true;
      ROOT.addEventListener('deviceorientation', (e)=>{
        const g = Number(e.gamma)||0;
        const b = Number(e.beta)||0;
        gyro.gx = clamp(g/90, -1, 1) * 14;
        gyro.gy = clamp(b/90, -1, 1) * 10;
        applyLook();
      }, { passive:true });
      return true;
    }
    return false;
  }).catch(()=>false);
}
function bindDragLook(){
  if(!layer) return;
  on(layer, 'pointerdown', (e)=>{
    look.dragging = true;
    look.lastX = e.clientX;
    look.lastY = e.clientY;
  }, { passive:true });
  on(ROOT, 'pointermove', (e)=>{
    if(!look.dragging) return;
    const dx = (e.clientX - look.lastX);
    const dy = (e.clientY - look.lastY);
    look.lastX = e.clientX;
    look.lastY = e.clientY;
    look.x = clamp(look.x + dx*0.12, -26, 26);
    look.y = clamp(look.y + dy*0.10, -24, 24);
    applyLook();
  }, { passive:true });
  on(ROOT, 'pointerup', ()=>{ look.dragging = false; }, { passive:true });
}

// ------------------------- Safe spawn geometry (avoid HUD overlap) -------------------------
function rectOf(el){
  if(!el) return null;
  const r = el.getBoundingClientRect();
  if(!r || !isFinite(r.width)) return null;
  return { x:r.left, y:r.top, w:r.width, h:r.height, r };
}
function expandRect(rr, pad){
  if(!rr) return rr;
  const p = Number(pad)||0;
  return { x: rr.x - p, y: rr.y - p, w: rr.w + p*2, h: rr.h + p*2 };
}
function intersects(a, b){
  return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
}

// cache layout (debounced)
let layoutCache = {
  W: 360, H: 640,
  playRect: { x:10, y:80, w:340, h:480 },
  noRects: [],
  stamp: 0
};

function viewportSize(){
  const vv = ROOT.visualViewport;
  const W = vv && vv.width ? vv.width : (ROOT.innerWidth || 360);
  const H = vv && vv.height ? vv.height : (ROOT.innerHeight || 640);
  return { W: Math.max(1, Math.round(W)), H: Math.max(1, Math.round(H)) };
}

function buildNoSpawnRects(){
  const rects = [];
  const PAD = 8;
  [hudTop, miniPanel, coachPanel, hudBtns].forEach(el=>{
    const rr = rectOf(el);
    if(rr) rects.push(expandRect(rr, PAD));
  });
  return rects;
}

function getPlayRect(){
  const { W, H } = viewportSize();
  const pad = 10;

  const topR = rectOf(hudTop);
  const miniR = rectOf(miniPanel);
  const btnR = rectOf(hudBtns);

  let top = pad;
  let bottom = H - pad;
  let left = pad;
  let right = W - pad;

  if(topR) top = Math.max(top, topR.y + topR.h + 10);
  if(miniR) top = Math.max(top, miniR.y + miniR.h + 10);
  if(btnR) bottom = Math.min(bottom, btnR.y - 10);

  top = clamp(top, 0, H-40);
  bottom = clamp(bottom, top+40, H);
  left = clamp(left, 0, W-40);
  right = clamp(right, left+40, W);

  return { x:left, y:top, w:(right-left), h:(bottom-top) };
}

function refreshLayout(){
  const { W, H } = viewportSize();
  let playRect = getPlayRect();
  let noRects = buildNoSpawnRects();

  if(playRect.w < 140 || playRect.h < 180){
    const coachR = rectOf(coachPanel);
    if(coachR){
      noRects = noRects.filter(rr=>{
        const same = Math.abs(rr.x - coachR.x) < 6 && Math.abs(rr.y - coachR.y) < 6;
        return !same;
      });
    }
  }

  layoutCache.W = W;
  layoutCache.H = H;
  layoutCache.playRect = playRect;
  layoutCache.noRects = noRects;
  layoutCache.stamp = nowMs();
}

function refreshLayoutSoon(ms){
  clearTimeout(refreshLayoutSoon._t);
  refreshLayoutSoon._t = setTimeout(()=>{ try{ refreshLayout(); }catch(e){} }, ms||80);
}

// ------------------------- Game State -------------------------
let running = false;
let paused = false;

let tStartMs = 0;
let tLastTickMs = 0;
let tLeftSec = Number(timePlannedSec) || 90;

let score = 0;
let combo = 0;
let comboMax = 0;
let miss = 0;

const groupEmojis = ['🥦','🍎','🐟','🍚','🥑'];
let gCount = [0,0,0,0,0];
let plateHave = [false,false,false,false,false];

let fever = 0;
let shield = 0;
let shieldActive = false;

let nTargetGoodSpawned = 0;
let nTargetJunkSpawned = 0;
let nTargetShieldSpawned = 0;
let nTargetPowerSpawned = 0;

let nHitGood = 0;
let nHitJunk = 0;
let nHitJunkGuard = 0;
let nExpireGood = 0;

let rtGood = [];
let perfectHits = 0;

const targets = new Map();
let spawnAccum = 0;

let goalsTotal = 2;
let goalsCleared = 0;

let minisTotal = 4;   // we now have defined minis (not 999)
let miniCleared = 0;

let activeGoal = null;
let activeMini = null;

// Miss danger system (pressure)
let missLimit = base.missLimit; // can be personalized
let missDangerPct = 0;

// Powerups state (play only)
let power = {
  slowmoUntil: 0,      // dt scaling
  magnetUntil: 0,      // auto-hit near crosshair
  doubleUntil: 0,      // score multiplier
  cleanseUntil: 0,     // lowers fever over time
  lastSpawnMs: 0,
  activeList: [],
  nPicked: 0,
};

// Boss state (play only)
let boss = {
  phase: 0,            // 0 none, 1 phase1, 2 phase2
  active: false,
  key: '',
  title: '',
  startedMs: 0,
  durationSec: 0,
  target: 0,
  cur: 0,
  forbidJunk: false,
  requireGroups: null, // array of groupIdx required
  done: false,
  fail: false,
  reason: '',
  rewardScore: 0,
};

let shootStats = { nShootEvents:0, nAssistLocks:0, lastAssistTargetKind:'' };

// ------------------------- Personalization from history (HHA_SUMMARY_HISTORY) -------------------------
function summarizeHistory(){
  const hist = loadJson(LS_HIST, []);
  const arr = Array.isArray(hist) ? hist : [];
  // Use last 12 plate sessions
  const plate = arr.filter(x => x && (x.game==='plate' || x.gameMode==='plate')).slice(0, 12);

  if(!plate.length) return {
    accMed: 80, rtMed: 650, gradeMed: 'A',
    missMed: 4, scoreMed: 1500, n:0
  };

  function medianNum(a){
    if(!a.length) return 0;
    const b = a.slice().sort((x,y)=>x-y);
    const m = Math.floor(b.length/2);
    return (b.length%2)? b[m] : (b[m-1]+b[m])/2;
  }

  const accs = plate.map(s => safeNum(s.accuracyGoodPct, 0)).filter(x=>x>0 && x<=100);
  const rts  = plate.map(s => safeNum(s.medianRtGoodMs, 0)).filter(x=>x>0);
  const misss= plate.map(s => safeNum(s.misses, 0));
  const scores=plate.map(s => safeNum(s.scoreFinal, 0));

  // grade median by frequency
  const grades = plate.map(s => String(s.grade||'').toUpperCase()).filter(Boolean);
  const freq = {};
  grades.forEach(g => freq[g]=(freq[g]||0)+1);
  const gradeMed = Object.keys(freq).sort((a,b)=>freq[b]-freq[a])[0] || 'A';

  return {
    accMed: medianNum(accs) || 80,
    rtMed: medianNum(rts) || 650,
    gradeMed,
    missMed: medianNum(misss) || 4,
    scoreMed: medianNum(scores) || 1500,
    n: plate.length
  };
}
const histProfile = summarizeHistory();

// Personalize missLimit slightly (play only)
if(!isResearchStrict && histProfile.n >= 4){
  // if user is strong, lower missLimit slightly for tension; if struggling, raise a bit
  const strong = (histProfile.accMed >= 90 && histProfile.missMed <= 3);
  const weak   = (histProfile.accMed <= 75 || histProfile.missMed >= 7);
  if(strong) missLimit = Math.max(6, base.missLimit - 1);
  if(weak)   missLimit = Math.min(12, base.missLimit + 1);
}

// ------------------------- Goals -------------------------
const GOALS = [
  { key:'fill-plate', title:'เติมจานให้ครบ 5 หมู่', target:5, cur:0, done:false },
  { key:'accuracy',   title:'จบเกมด้วยความแม่นยำ ≥ 80%', target:80, cur:0, done:false },
];

function accuracyPct(){
  const denom = (nHitGood + nHitJunk + nExpireGood);
  if(denom <= 0) return 0;
  return (nHitGood / denom) * 100;
}

function calcGrade(){
  const acc = accuracyPct();
  const m = miss;
  const baseScore = score;

  if(acc >= 95 && m <= 1 && baseScore >= 2200) return 'SSS';
  if(acc >= 92 && m <= 2 && baseScore >= 1800) return 'SS';
  if(acc >= 88 && m <= 3) return 'S';
  if(acc >= 82 && m <= 5) return 'A';
  if(acc >= 72 && m <= 8) return 'B';
  return 'C';
}

function updateDanger(){
  missDangerPct = clamp((missLimit>0 ? (miss/missLimit*100) : 0), 0, 120);
  if(dangerBar){
    dangerBar.style.width = `${clamp(missDangerPct,0,100)}%`;
  }
  const dt = qs('dangerText');
  if(dt) dt.textContent = `${Math.round(clamp(missDangerPct,0,999))}%`;
}

function updatePowerUI(){
  const list = [];
  const t = nowMs();
  if(t < power.slowmoUntil) list.push('⏱️');
  if(t < power.magnetUntil) list.push('🧲');
  if(t < power.doubleUntil) list.push('✨');
  if(t < power.cleanseUntil) list.push('🧊');
  const pl = qs('powerList');
  if(pl) pl.textContent = list.length ? list.join(' ') : '—';
}

function updateBossUI(){
  const bf = bossBar;
  const bt = qs('bossText');
  if(!bf || !bt) return;

  if(!boss.active){
    bf.style.width = '0%';
    bt.textContent = '—';
    return;
  }
  const pct = boss.target>0 ? (boss.cur/boss.target*100) : 0;
  bf.style.width = `${clamp(pct,0,100)}%`;
  bt.textContent = `${boss.title} ${boss.cur}/${boss.target}`;
}

function updateHUD(){
  updateDanger();
  updatePowerUI();
  updateBossUI();

  emit('hha:score', {
    game:'plate',
    runMode,
    diff,
    timeLeftSec: tLeftSec,
    score,
    combo,
    comboMax,
    miss,
    missLimit,
    missDangerPct,
    plateHave: plateHave.filter(Boolean).length,
    gCount: [...gCount],
    fever,
    shield,
    accuracyGoodPct: accuracyPct(),
    grade: calcGrade(),
    powerActive: {
      slowmo: nowMs()<power.slowmoUntil,
      magnet: nowMs()<power.magnetUntil,
      double: nowMs()<power.doubleUntil,
      cleanse: nowMs()<power.cleanseUntil
    },
    boss: boss.active ? { phase: boss.phase, key: boss.key, cur: boss.cur, target: boss.target } : null,
    shootStats: { ...shootStats }
  });

  setText('uiScore', score);
  setText('uiCombo', combo);
  setText('uiComboMax', comboMax);
  setText('uiMiss', miss);
  setText('uiPlateHave', plateHave.filter(Boolean).length);
  setText('uiG1', gCount[0]); setText('uiG2', gCount[1]); setText('uiG3', gCount[2]); setText('uiG4', gCount[3]); setText('uiG5', gCount[4]);
  setText('uiAcc', fmtPct(accuracyPct()));
  setText('uiGrade', calcGrade());
  setText('uiTime', Math.ceil(tLeftSec));
  const ff = qs('uiFeverFill');
  if(ff) ff.style.width = `${clamp(fever,0,100)}%`;
  setText('uiShieldN', shield);
}

function coach(msg, mood){
  emit('hha:coach', { game:'plate', msg, mood: mood || 'neutral' });
  const cm = qs('coachMsg');
  if(cm) cm.textContent = msg;
  const img = qs('coachImg');
  if(img){
    const m = mood || 'neutral';
    const map = {
      happy: './img/coach-happy.png',
      neutral:'./img/coach-neutral.png',
      sad: './img/coach-sad.png',
      fever: './img/coach-fever.png',
    };
    img.src = map[m] || map.neutral;
  }
}

function judge(text, kind){
  emit('hha:judge', { game:'plate', text, kind: kind||'info' });
}

// ------------------------- AI Coach (rate-limited) -------------------------
let coachState = { lastSayMs: 0, cooldownMs: 2200, lastHintKey: '' };

function sayCoach(msg, mood='neutral', key=''){
  if(!AI_ENABLED) return;
  const t = nowMs();
  // personalization: if user is strong, speak less (let them flow); if struggling, speak more
  let cd = coachState.cooldownMs;
  if(histProfile.n>=4){
    const strong = histProfile.accMed>=88 && histProfile.rtMed<=600;
    const weak = histProfile.accMed<=78 || histProfile.rtMed>=780;
    if(strong) cd = 3000;
    if(weak) cd = 1700;
  }
  if((t - coachState.lastSayMs) < cd) return;
  if(key && key === coachState.lastHintKey && (t - coachState.lastSayMs) < (cd*1.5)) return;

  coachState.lastSayMs = t;
  coachState.lastHintKey = key || coachState.lastHintKey;
  coach(msg, mood);
}

function aiPulse(){
  if(!AI_ENABLED) return;

  const acc = accuracyPct();
  const danger = missDangerPct;
  const t = nowMs();

  if(fever >= 88){
    sayCoach('🔥 FEVER สูงมาก! ช้าลงนิด เล็งให้ชัวร์ก่อนยิง', 'fever', 'fever-hi');
  } else if(danger >= 85){
    sayCoach('😱 ใกล้พลาดเกินลิมิตแล้ว! เก็บ GOOD ก่อน หลีก JUNK', 'sad', 'danger-hi');
  } else if(acc < 70 && (nHitGood+nHitJunk+nExpireGood) >= 8){
    sayCoach('ทริค: รอจังหวะแล้วค่อยยิง — ลดพลาด = คะแนนพุ่ง', 'neutral', 'acc-low');
  } else if(combo >= 12 && (t - coachState.lastSayMs) > 2400){
    sayCoach('โคตรดี! รักษา combo ต่ออีกนิด จะได้ S/SS เลย', 'happy', 'combo');
  }
}

// ------------------------- Mini quests -------------------------
function makeMiniPlateRush(){
  return {
    key:'plate-rush',
    title:'Plate Rush: ครบ 5 หมู่ใน 8 วิ + ห้ามโดนขยะ',
    forbidJunk:true,
    forbidExpireGood:false,
    durationSec: 8,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
    snapPlateHave: null,
  };
}
function makeMiniCleanSweep(){
  return {
    key:'clean-sweep',
    title:'Clean Sweep: 10 วิ ห้ามปล่อย GOOD หมดอายุ',
    forbidJunk:false,
    forbidExpireGood:true,
    durationSec: 10,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
  };
}
function makeMiniJunkStorm(){
  return {
    key:'junk-storm',
    title:'Junk Storm: 8 วิ ห้ามโดนขยะ (พายุขยะ)',
    forbidJunk:true,
    forbidExpireGood:false,
    durationSec: 8,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
  };
}
function makeMiniComboSprint(){
  return {
    key:'combo-sprint',
    title:'Combo Sprint: 6 วิ ทำคอมโบ +6',
    forbidJunk:false,
    forbidExpireGood:false,
    durationSec: 6,
    startedMs: 0,
    done:false,
    fail:false,
    reason:'',
    startCombo: 0,
    needAdd: 6
  };
}

function startMini(mini){
  activeMini = mini;
  activeMini.startedMs = nowMs();
  if(activeMini.key === 'combo-sprint') activeMini.startCombo = combo;

  emit('quest:update', {
    game:'plate',
    goal: activeGoal ? { title: activeGoal.title, cur: activeGoal.cur, target: activeGoal.target, done: activeGoal.done } : null,
    mini: { title: activeMini.title, cur:0, target:activeMini.durationSec, timeLeft: activeMini.durationSec, done:false }
  });
  setText('uiMiniTitle', activeMini.title);
  setText('uiMiniTime', `${activeMini.durationSec}s`);
  setText('uiHint', 'ภารกิจพิเศษ! ทำให้ผ่านเพื่อรับโล่/คะแนนโบนัส');
  judge('⚡ MINI START!', 'warn');
  sayCoach('เริ่ม MINI แล้ว! อ่านกติกาแล้วลุยเลย ✨', 'neutral', 'mini-start');
}

function finishMini(ok, reason){
  if(!activeMini || activeMini.done) return;
  activeMini.done = true;
  activeMini.fail = !ok;
  activeMini.reason = reason || (ok ? 'ok' : 'fail');

  if(ok){
    miniCleared++;
    emit('hha:celebrate', { game:'plate', kind:'mini' });
    sayCoach('สุดยอด! MINI ผ่าน! รับโล่+คะแนนโบนัส 🔥', 'happy', 'mini-win');
    judge('✅ MINI COMPLETE!', 'good');
    shield = clamp(shield + 1, 0, 9);
    score += 120;
  }else{
    sayCoach('พลาดนิดเดียว! เดี๋ยวมีโอกาสแก้มือ 💪', (fever>70?'fever':'sad'), 'mini-fail');
    judge('❌ MINI FAILED', 'bad');
  }
  activeMini = null;
  emitQuestUpdate();
}

function miniTimeLeft(){
  if(!activeMini) return null;
  const elapsed = (nowMs() - activeMini.startedMs) / 1000;
  return Math.max(0, activeMini.durationSec - elapsed);
}

function emitQuestUpdate(){
  if(activeGoal){
    emit('quest:update', {
      game:'plate',
      goal: { title: activeGoal.title, cur: activeGoal.cur, target: activeGoal.target, done: activeGoal.done },
      mini: activeMini
        ? { title: activeMini.title, cur: 0, target: activeMini.durationSec, timeLeft: miniTimeLeft(), done:false }
        : { title:'—', cur:0, target:0, timeLeft:null, done:false }
    });
    setText('uiGoalTitle', activeGoal.title);
    setText('uiGoalCount', `${activeGoal.cur}/${activeGoal.target}`);
    const gf = qs('uiGoalFill');
    if(gf) gf.style.width = `${(activeGoal.target? (activeGoal.cur/activeGoal.target*100):0)}%`;
  }else{
    setText('uiGoalTitle', '—'); setText('uiGoalCount', '0/0');
  }

  if(activeMini){
    setText('uiMiniTitle', activeMini.title);
    setText('uiMiniCount', `${miniCleared}/${minisTotal}`);
    const tl = miniTimeLeft();
    setText('uiMiniTime', tl==null?'--':`${Math.ceil(tl)}s`);
    const mf = qs('uiMiniFill');
    if(mf){
      const pct = activeMini.durationSec ? ((activeMini.durationSec - (tl||0)) / activeMini.durationSec) * 100 : 0;
      mf.style.width = `${clamp(pct,0,100)}%`;
    }
  }else{
    setText('uiMiniTitle','—');
    setText('uiMiniTime','--');
    setText('uiMiniCount', `${miniCleared}/${minisTotal}`);
    const mf = qs('uiMiniFill'); if(mf) mf.style.width = `0%`;
  }
}

// ------------------------- Goals -------------------------
function startGoals(){
  goalsCleared = 0;
  activeGoal = { ...GOALS[0] };
  emitQuestUpdate();
}
function updateGoals(){
  if(!activeGoal || activeGoal.done) return;

  if(activeGoal.key === 'fill-plate'){
    activeGoal.cur = plateHave.filter(Boolean).length;
    if(activeGoal.cur >= activeGoal.target){
      activeGoal.done = true;
      goalsCleared++;
      emit('hha:celebrate', { game:'plate', kind:'goal' });
      sayCoach('ครบ 5 หมู่แล้ว! ต่อไปคุมความแม่นยำ 😎', 'happy', 'goal1');
      judge('🎯 GOAL COMPLETE!', 'good');

      // sequence minis (play only) — but still deterministic about which mini
      if(!activeMini){
        startMini(makeMiniPlateRush());
      }
      activeGoal = { ...GOALS[1] };
    }
  } else if(activeGoal.key === 'accuracy'){
    activeGoal.cur = Math.round(accuracyPct());
  }

  emitQuestUpdate();
}

// ------------------------- Fever/Shield logic -------------------------
function addFever(amount){
  fever = clamp(fever + (Number(amount)||0), 0, 100);
  updateHUD();
}
function coolFever(amount){
  fever = clamp(fever - (Number(amount)||0), 0, 100);
  updateHUD();
}
function ensureShieldActive(){
  shieldActive = (shield > 0);
}

// ------------------------- AI Pattern Generator -------------------------
const PATTERNS = ['grid','center','edges','ring','mix'];

function choosePattern(){
  // Research strict: deterministic and fixed pattern
  if(isResearchStrict){
    return (patternParam === 'mix') ? 'grid' : (PATTERNS.includes(patternParam) ? patternParam : 'grid');
  }

  // If user explicitly chooses non-mix, respect it
  if(patternParam !== 'mix' && PATTERNS.includes(patternParam)) return patternParam;

  // Play mix: choose based on state (still seeded rng -> reproducible per seed)
  // Boss overrides pattern
  if(boss.active){
    return (boss.phase === 1) ? 'edges' : 'ring';
  }

  // Mini override: plate-rush => center+grid, clean-sweep => edges, junk-storm => ring
  if(activeMini){
    if(activeMini.key === 'plate-rush') return (rng()<0.6 ? 'center' : 'grid');
    if(activeMini.key === 'clean-sweep') return 'edges';
    if(activeMini.key === 'junk-storm') return 'ring';
    if(activeMini.key === 'combo-sprint') return (rng()<0.5 ? 'center' : 'grid');
  }

  // Use fever/danger to bias
  const f = fever/100;
  const d = missDangerPct/100;
  const p = rng();
  if(d > 0.75) return (p<0.6 ? 'center' : 'grid');
  if(f > 0.75) return (p<0.6 ? 'edges' : 'grid');
  if(p < 0.34) return 'grid';
  if(p < 0.62) return 'center';
  if(p < 0.84) return 'edges';
  return 'ring';
}

function candidatePoint(pattern, playRect, size){
  const pad = 6;
  const w = Math.max(1, playRect.w - size - pad*2);
  const h = Math.max(1, playRect.h - size - pad*2);

  if(pattern === 'grid'){
    // 3x3 grid jitter
    const gx = Math.floor(rng()*3);
    const gy = Math.floor(rng()*3);
    const cx = playRect.x + pad + (gx+0.5)*(w/3) + (rng()-0.5)*16;
    const cy = playRect.y + pad + (gy+0.5)*(h/3) + (rng()-0.5)*16;
    return { x: cx, y: cy };
  }

  if(pattern === 'center'){
    const cx = playRect.x + playRect.w/2 + (rng()-0.5)*64;
    const cy = playRect.y + playRect.h/2 + (rng()-0.5)*64;
    return { x: cx, y: cy };
  }

  if(pattern === 'edges'){
    // pick an edge band
    const edge = Math.floor(rng()*4); // 0 top,1 right,2 bottom,3 left
    let x = playRect.x + pad + rng()*w;
    let y = playRect.y + pad + rng()*h;
    const band = 54;
    if(edge===0) y = playRect.y + pad + rng()*band;
    if(edge===2) y = playRect.y + playRect.h - size - pad - rng()*band;
    if(edge===3) x = playRect.x + pad + rng()*band;
    if(edge===1) x = playRect.x + playRect.w - size - pad - rng()*band;
    return { x, y };
  }

  if(pattern === 'ring'){
    // random ring around center
    const cx = playRect.x + playRect.w/2;
    const cy = playRect.y + playRect.h/2;
    const rMin = Math.min(playRect.w, playRect.h) * 0.18;
    const rMax = Math.min(playRect.w, playRect.h) * 0.42;
    const rr = rMin + rng()*(Math.max(6, rMax-rMin));
    const ang = rng()*Math.PI*2;
    const x = cx + Math.cos(ang)*rr + (rng()-0.5)*12;
    const y = cy + Math.sin(ang)*rr + (rng()-0.5)*12;
    return { x, y };
  }

  // fallback uniform
  return {
    x: playRect.x + pad + rng()*w,
    y: playRect.y + pad + rng()*h
  };
}

// ------------------------- Power-ups -------------------------
const POWER_POOL = [
  { key:'slowmo',  emoji:'⏱️', title:'SlowMo',  durSec:6.0 },
  { key:'magnet',  emoji:'🧲', title:'Magnet',  durSec:6.5 },
  { key:'double',  emoji:'✨', title:'Double',  durSec:7.0 },
  { key:'cleanse', emoji:'🧊', title:'Cleanse', durSec:6.0 },
];

function hasActivePower(){
  const t = nowMs();
  return (t<power.slowmoUntil || t<power.magnetUntil || t<power.doubleUntil || t<power.cleanseUntil);
}

function powerMultiplier(){
  return (nowMs() < power.doubleUntil) ? 2 : 1;
}

function applyPower(pkey){
  if(!POWERUPS_ENABLED) return;

  const t = nowMs();
  const p = POWER_POOL.find(x=>x.key===pkey);
  if(!p) return;

  if(pkey==='slowmo') power.slowmoUntil = Math.max(power.slowmoUntil, t + p.durSec*1000);
  if(pkey==='magnet') power.magnetUntil = Math.max(power.magnetUntil, t + p.durSec*1000);
  if(pkey==='double') power.doubleUntil = Math.max(power.doubleUntil, t + p.durSec*1000);
  if(pkey==='cleanse') power.cleanseUntil = Math.max(power.cleanseUntil, t + p.durSec*1000);

  power.nPicked++;
  emit('hha:power', { game:'plate', key:pkey, until:{
    slowmo:power.slowmoUntil, magnet:power.magnetUntil, double:power.doubleUntil, cleanse:power.cleanseUntil
  }});

  judge(`⚡ POWER UP: ${p.title}!`, 'good');
  sayCoach(`ได้ ${p.title}! ใช้ให้คุ้มเลย 🔥`, 'happy', `p-${pkey}`);
  updatePowerUI();
}

function maybeSpawnPower(){
  if(!POWERUPS_ENABLED) return;
  if(!running || paused) return;

  const t = nowMs();
  // cooldown
  if(t - power.lastSpawnMs < 5200) return;
  // don't spam when many targets
  if(targets.size > 12) return;
  // chance increases with fever/danger (comeback mechanic)
  const chance = clamp(0.012 + (fever/100)*0.018 + (missDangerPct/100)*0.020, 0.012, 0.06);
  if(rng() < chance){
    power.lastSpawnMs = t;
    spawnTarget('power');
  }
}

// ------------------------- Boss phases (play only) -------------------------
function startBossPhase(phase){
  if(!BOSS_ENABLED) return;
  if(boss.active) return;

  boss.active = true;
  boss.phase = phase;
  boss.startedMs = nowMs();
  boss.done = false;
  boss.fail = false;
  boss.reason = '';
  boss.cur = 0;

  if(phase === 1){
    boss.key = 'boss-collect3';
    boss.title = 'Collect 3 missing groups';
    boss.durationSec = 10;
    // determine missing groups now (snapshot)
    const missing = [];
    for(let i=0;i<5;i++) if(!plateHave[i]) missing.push(i);
    // if already full, pick random 3 groups to “confirm”
    if(missing.length < 3){
      const all = [0,1,2,3,4].sort(()=>rng()-0.5);
      while(missing.length < 3) missing.push(all[missing.length]);
    }
    boss.requireGroups = missing.slice(0,3);
    boss.target = boss.requireGroups.length;
    boss.forbidJunk = false;
    boss.rewardScore = 280;
    sayCoach(`👑 BOSS1! เก็บ ${boss.requireGroups.map(i=>groupEmojis[i]).join(' ')} ให้ครบใน ${boss.durationSec}s`, 'neutral', 'boss1');
    judge('👑 BOSS PHASE 1!', 'warn');
  } else {
    boss.key = 'boss-survive';
    boss.title = 'Survive: no junk hit';
    boss.durationSec = 8;
    boss.target = 8; // seconds survive
    boss.forbidJunk = true;
    boss.requireGroups = null;
    boss.rewardScore = 360;
    sayCoach(`👑 BOSS2! ${boss.durationSec}s ห้ามโดนขยะ — โฟกัสดี ๆ!`, 'fever', 'boss2');
    judge('👑 BOSS PHASE 2!', 'warn');
  }

  emit('hha:boss', { game:'plate', state:{...boss, requireGroups: boss.requireGroups ? [...boss.requireGroups] : null }});
  updateBossUI();
}

function bossTimeLeft(){
  if(!boss.active) return null;
  const elapsed = (nowMs() - boss.startedMs) / 1000;
  return Math.max(0, boss.durationSec - elapsed);
}

function finishBoss(ok, reason){
  if(!boss.active || boss.done) return;
  boss.done = true;
  boss.fail = !ok;
  boss.reason = reason || (ok ? 'ok' : 'fail');

  if(ok){
    score += boss.rewardScore * powerMultiplier();
    shield = clamp(shield + 1, 0, 9);
    emit('hha:celebrate', { game:'plate', kind:'boss' });
    sayCoach('👑 โค่นบอสสำเร็จ! รับโบนัส+โล่ 🔥', 'happy', 'boss-win');
    judge('👑 BOSS CLEAR!', 'good');
  } else {
    sayCoach('บอสยังไม่ผ่าน แต่ยังมีเวลาแก้คะแนน! 💪', 'sad', 'boss-fail');
    judge('👑 BOSS FAILED', 'bad');
    // add a bit of fever as penalty
    addFever(8);
  }

  emit('hha:boss', { game:'plate', state:{...boss, requireGroups: boss.requireGroups ? [...boss.requireGroups] : null }});
  boss.active = false;
  boss.phase = 0;
  boss.key = '';
  boss.title = '';
  boss.requireGroups = null;
  boss.target = 0;
  boss.cur = 0;
  boss.forbidJunk = false;

  updateBossUI();
}

// ------------------------- Target spawning -------------------------
const goodPool = groupEmojis.map((e,i)=>({ emoji:e, groupIdx:i, kind:'good' }));
const junkPool = ['🍟','🍕','🥤','🍩','🍭','🧁','🍔','🌭','🍫','🧋'].map(e=>({ emoji:e, kind:'junk' }));
const shieldEmoji = { emoji:'🛡️', kind:'shield' };

function currentTunings(){
  let size = base.size * adapt.sizeMul;
  let lifeMs = base.lifeMs;
  let spawnPerSec = base.spawnPerSec * adapt.spawnMul;
  let junkRate = clamp(base.junkRate * adapt.junkMul, 0.08, 0.55);

  // boss pressure in play only
  if(boss.active){
    spawnPerSec *= (boss.phase===2 ? 1.22 : 1.12);
    junkRate = clamp(junkRate + (boss.phase===2 ? 0.10 : 0.04), 0.10, 0.70);
  }

  // fever increases intensity (play only)
  if(!isResearchStrict){
    const f = fever/100;
    spawnPerSec *= (1 + f*0.15);
    junkRate = clamp(junkRate + f*0.05, 0.08, 0.60);
  }

  size = clamp(size, 38, 86);
  spawnPerSec = clamp(spawnPerSec, 0.8, 3.8);
  return { size, lifeMs, spawnPerSec, junkRate };
}

function maybeSpawnShield(){
  if(isResearchStrict) return;
  if(shield >= 3) return;
  const chance = (fever >= 70 || missDangerPct>=70) ? 0.06 : 0.02;
  if(rng() < chance){
    spawnTarget('shield');
  }
}

function spawnTarget(forcedKind){
  if(!layer) return;

  if(!layoutCache.stamp || (nowMs() - layoutCache.stamp) > 800){
    try{ refreshLayout(); }catch(e){}
  }

  const tune = currentTunings();
  const { W, H } = layoutCache;
  const playRect = layoutCache.playRect;
  const noRects = layoutCache.noRects;

  let kind = forcedKind;
  if(!kind){
    ensureShieldActive();
    // boss phase 2 forbids junk: reduce junk spawn a little but keep pressure
    if(boss.active && boss.forbidJunk && rng() < 0.10) kind = 'shield';
    else if(!isResearchStrict && shield < 2 && fever >= 65 && rng() < 0.05) kind = 'shield';
    else kind = (rng() < tune.junkRate) ? 'junk' : 'good';
  }

  // power kind
  if(kind === 'power'){
    const p = pick(rng, POWER_POOL);
    const size = clamp(tune.size + 6, 44, 92);
    return spawnElement({
      kind:'power',
      emoji:p.emoji,
      powerKey:p.key,
      size,
      playRect, noRects, W, H
    });
  }

  let spec;
  if(kind === 'good') spec = pick(rng, goodPool);
  else if(kind === 'junk') spec = pick(rng, junkPool);
  else spec = shieldEmoji;

  return spawnElement({
    kind: spec.kind,
    emoji: spec.emoji,
    groupIdx: spec.kind==='good' ? spec.groupIdx : null,
    size: tune.size,
    lifeMs: tune.lifeMs,
    playRect, noRects, W, H
  });
}

function spawnElement(opts){
  const kind = opts.kind;
  const size = opts.size;

  // compensate look shift
  const shX = lookShift.x || 0;
  const shY = lookShift.y || 0;

  const pattern = choosePattern();

  // screen-space test box
  const screenBox = { x:0, y:0, w:size, h:size };
  let ok = false;

  const tries = 48;
  for(let i=0;i<tries;i++){
    const pt = candidatePoint(pattern, opts.playRect, size);
    const sx = clamp(pt.x, opts.playRect.x, opts.playRect.x + Math.max(1, opts.playRect.w - size));
    const sy = clamp(pt.y, opts.playRect.y, opts.playRect.y + Math.max(1, opts.playRect.h - size));
    screenBox.x = sx; screenBox.y = sy;

    let hit = false;
    for(const rr of opts.noRects){
      if(intersects(screenBox, rr)){ hit = true; break; }
    }
    if(!hit){ ok = true; break; }
  }

  if(!ok){
    const pt = candidatePoint(pattern, opts.playRect, size);
    screenBox.x = clamp(pt.x, opts.playRect.x, opts.playRect.x + Math.max(1, opts.playRect.w - size));
    screenBox.y = clamp(pt.y, opts.playRect.y, opts.playRect.y + Math.max(1, opts.playRect.h - size));
  }

  let lx = screenBox.x - shX;
  let ly = screenBox.y - shY;

  lx = clamp(lx, 6, opts.W - size - 6);
  ly = clamp(ly, 6, opts.H - size - 6);

  const el = DOC.createElement('button');
  const id = `t_${uid()}`;
  el.className = 'plateTarget';
  el.type = 'button';
  el.tabIndex = -1;
  el.setAttribute('data-id', id);
  el.setAttribute('data-kind', kind);
  if(kind === 'good') el.setAttribute('data-group', String(opts.groupIdx));
  if(kind === 'power') el.setAttribute('data-power', String(opts.powerKey || ''));

  el.textContent = opts.emoji;

  el.style.position = 'absolute';
  el.style.left = `${Math.round(lx)}px`;
  el.style.top  = `${Math.round(ly)}px`;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '999px';
  el.style.border = '1px solid rgba(148,163,184,.18)';
  el.style.background = (kind==='power')
    ? 'rgba(2,6,23,.72)'
    : 'rgba(2,6,23,.55)';
  el.style.backdropFilter = 'blur(8px)';
  el.style.boxShadow = (kind==='power')
    ? '0 18px 44px rgba(34,197,94,.10), 0 18px 44px rgba(0,0,0,.28)'
    : '0 18px 44px rgba(0,0,0,.28)';
  el.style.font = '900 28px/1 system-ui';
  el.style.display = 'grid';
  el.style.placeItems = 'center';
  el.style.userSelect = 'none';
  el.style.webkitTapHighlightColor = 'transparent';
  el.style.outline = 'none';
  el.style.transform = 'translateZ(0)';

  // cVR strict: allow disabling pointer events via body class
  if(DOC.body && DOC.body.classList.contains('view-cvr')){
    el.style.pointerEvents = 'none';
  }

  on(el, 'pointerdown', (e)=>{
    e.preventDefault();
    if(!running || paused) return;
    // in cVR, pointerdown may not happen; crosshair will hit via shoot
    onHit(id);
  }, { passive:false });

  layer.appendChild(el);

  const born = nowMs();
  // life: powerups live a bit longer
  const lifeMs = (kind==='power') ? 2400 : (opts.lifeMs || base.lifeMs);

  targets.set(id, {
    id,
    el,
    kind,
    groupIdx: (kind==='good') ? opts.groupIdx : null,
    powerKey: (kind==='power') ? (opts.powerKey||'') : '',
    bornMs: born,
    lifeMs,
    size,
  });

  if(kind === 'good') nTargetGoodSpawned++;
  else if(kind === 'junk') nTargetJunkSpawned++;
  else if(kind === 'shield') nTargetShieldSpawned++;
  else if(kind === 'power') nTargetPowerSpawned++;

  return id;
}

function despawn(id){
  const t = targets.get(id);
  if(!t) return;
  targets.delete(id);
  try{ t.el.remove(); }catch(e){}
}
function clearAllTargets(){
  for(const [id] of targets) despawn(id);
}

// ------------------------- Crosshair shoot + aim assist -------------------------
function findTargetNearCrosshair(lockPx=60){
  const { W, H } = layoutCache;
  const cx = (W/2) - (lookShift.x||0);
  const cy = (H/2) - (lookShift.y||0);

  let best = null;
  let bestD = Infinity;

  for(const [id, t] of targets){
    // ignore expired soon? no
    const r = t.el.getBoundingClientRect();
    const tx = r.left + r.width/2;
    const ty = r.top + r.height/2;
    const dx = tx - cx;
    const dy = ty - cy;
    const d = Math.sqrt(dx*dx + dy*dy);
    if(d < bestD){
      bestD = d;
      best = { id, kind: t.kind, d };
    }
  }
  if(best && best.d <= lockPx) return best;
  return null;
}

function shootFromCrosshair(lockPx=60){
  if(!running || paused) return;
  shootStats.nShootEvents++;

  if(!ASSIST_ENABLED){
    // no assist: still try to hit exact closest within tiny radius
    const hit = findTargetNearCrosshair(36);
    if(hit){
      shootStats.nAssistLocks += 1;
      shootStats.lastAssistTargetKind = hit.kind;
      onHit(hit.id);
    }
    return;
  }

  const hit = findTargetNearCrosshair(clamp(lockPx, 34, 120));
  if(hit){
    shootStats.nAssistLocks += 1;
    shootStats.lastAssistTargetKind = hit.kind;
    onHit(hit.id);
  }else{
    // small penalty? keep fair: no penalty
    fxTick();
  }
}

// listen hha:shoot from /herohealth/vr/vr-ui.js
on(ROOT, 'hha:shoot', (e)=>{
  const d = (e && e.detail) ? e.detail : {};
  const lockPx = safeNum(d.lockPx, 64);
  shootFromCrosshair(lockPx);
}, { passive:true });

// ------------------------- Hit / Miss handling -------------------------
function onHit(id){
  const t = targets.get(id);
  if(!t) return;

  const rt = Math.max(0, nowMs() - t.bornMs);
  const kind = t.kind;

  despawn(id);

  if(kind === 'good'){
    nHitGood++;
    combo++;
    comboMax = Math.max(comboMax, combo);

    const gi = Number(t.groupIdx);
    if(gi>=0 && gi<5){
      gCount[gi] += 1;
      if(!plateHave[gi]){
        plateHave[gi] = true;
        judge(`+ หมู่ใหม่! ${groupEmojis[gi]}`, 'good');
      }
      // boss phase 1: collect required groups
      if(boss.active && boss.phase===1 && boss.requireGroups){
        if(boss.requireGroups.includes(gi)){
          // mark as collected by removing
          boss.requireGroups = boss.requireGroups.filter(x=>x!==gi);
          boss.cur = boss.target - boss.requireGroups.length;
          emit('hha:boss', { game:'plate', state:{...boss, requireGroups:[...boss.requireGroups]} });
          updateBossUI();
          if(boss.cur >= boss.target){
            finishBoss(true, 'collected');
          }
        }
      }
    }

    let add = 50;
    if(rt <= 420){ add += 35; perfectHits++; }
    else if(rt <= 650){ add += 20; }
    add += Math.min(40, combo * 2);

    // power multipliers
    add *= powerMultiplier();

    score += add;
    rtGood.push(rt);
    fxPulse('good');
    coolFever(base.feverDownGood);

    if(activeMini){
      if(activeMini.key === 'plate-rush'){
        const haveN = plateHave.filter(Boolean).length;
        const tl = miniTimeLeft();
        if(haveN >= 5 && (tl != null && tl > 0)){
          finishMini(true, 'rush-complete');
        }
      } else if(activeMini.key === 'combo-sprint'){
        const tl = miniTimeLeft();
        if(tl != null && tl > 0){
          if((combo - (activeMini.startCombo||0)) >= (activeMini.needAdd||6)){
            finishMini(true, 'combo-sprint');
          }
        }
      }
    }

  } else if(kind === 'junk'){
    ensureShieldActive();

    // boss phase 2 forbids junk
    if(boss.active && boss.phase===2 && boss.forbidJunk){
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        sayCoach('🛡️ โล่ช่วยไว้! (บอสยังอยู่)', 'neutral', 'boss2-block');
        judge('🛡️ BLOCKED!', 'warn');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 70);
        addFever(base.feverUpJunk + 4);
        fxPulse('bad'); fxShake(2);
        finishBoss(false, 'hit-junk');
      }
    } else if(activeMini && activeMini.forbidJunk){
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        sayCoach('โล่ช่วยไว้! 🛡️ (mini ยังอยู่)', 'neutral', 'mini-block');
        judge('🛡️ BLOCKED!', 'warn');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake(2);
        finishMini(false, 'hit-junk');
      }
    }else{
      if(shieldActive){
        shield = Math.max(0, shield - 1);
        nHitJunkGuard++;
        sayCoach('โล่กันขยะ! 🛡️', 'neutral', 'block');
        judge('🛡️ BLOCK!', 'warn');
        fxPulse('good');
      }else{
        nHitJunk++;
        miss++;
        combo = 0;
        score = Math.max(0, score - 60);
        addFever(base.feverUpJunk);
        fxPulse('bad'); fxShake(2);
        sayCoach('โอ๊ย! โดนขยะ 😵 ระวังนะ', (fever>70?'fever':'sad'), 'junk');
        judge('💥 JUNK!', 'bad');
      }
    }
    ensureShieldActive();

  } else if(kind === 'shield'){
    shield = clamp(shield + 1, 0, 9);
    ensureShieldActive();
    score += 40 * powerMultiplier();
    fxPulse('good');
    sayCoach('ได้โล่แล้ว! 🛡️', 'happy', 'shield');
    judge('🛡️ +1 SHIELD', 'good');

  } else if(kind === 'power'){
    score += 60 * powerMultiplier();
    fxPulse('good');
    const pkey = t.powerKey || pick(rng, POWER_POOL).key;
    applyPower(pkey);
  }

  if(adaptiveOn) updateAdaptive();

  updateGoals();
  updateHUD();

  // miss limit end
  if(missLimit > 0 && miss >= missLimit){
    endGame('miss-limit');
  }

  aiPulse();
}

function onExpireTarget(id){
  const t = targets.get(id);
  if(!t) return;
  const kind = t.kind;
  despawn(id);

  if(kind === 'good'){
    nExpireGood++;
    miss++;
    combo = 0;
    addFever(base.feverUpMiss);
    fxPulse('bad');

    if(activeMini && activeMini.forbidExpireGood){
      finishMini(false, 'expire-good');
    }
  }

  updateGoals();
  updateHUD();

  if(missLimit > 0 && miss >= missLimit){
    endGame('miss-limit');
  }
}

// ------------------------- AI Difficulty Director (Explainable) -------------------------
let ddLast = { sizeMul:1.0, spawnMul:1.0, junkMul:1.0, acc:0, rtAvg:0, explain:'' };

function updateAdaptive(){
  if(isResearchStrict) return;

  const acc = accuracyPct();
  const rtN = rtGood.length;
  const rtAvg = rtN ? (rtGood.reduce((a,b)=>a+b,0)/rtN) : 800;

  // personalization baseline: compare with user's history to tune aggressiveness
  let accT = 86;   // neutral threshold
  let rtT  = 650;
  if(histProfile.n>=4){
    accT = clamp(histProfile.accMed, 78, 92);
    rtT  = clamp(histProfile.rtMed, 520, 820);
  }

  const sizeMul =
    (acc < (accT-18) ? 1.20 :
     acc < (accT-10) ? 1.12 :
     acc > (accT+10) ? 0.92 :
     acc > (accT+4)  ? 0.96 : 1.0);

  let spawnMul = 1.0;
  if(acc > (accT+8) && rtAvg < (rtT-90)) spawnMul = 1.14;
  else if(acc > (accT+4) && rtAvg < (rtT-40)) spawnMul = 1.10;
  else if(acc < (accT-12)) spawnMul = 0.92;

  let junkMul = 1.0;
  if(acc > (accT+8) && miss <= Math.max(2, Math.floor(missLimit/4))) junkMul = 1.12;
  else if(acc < (accT-12)) junkMul = 0.92;

  adapt.sizeMul = clamp(sizeMul, 0.85, 1.25);
  adapt.spawnMul = clamp(spawnMul, 0.78, 1.28);
  adapt.junkMul  = clamp(junkMul, 0.82, 1.28);

  // explainable
  let explain = 'stable';
  if(adapt.sizeMul > 1.05) explain = 'help-aim';
  if(adapt.sizeMul < 0.98) explain = 'challenge-aim';
  if(adapt.spawnMul > 1.05) explain += '+faster';
  if(adapt.spawnMul < 0.98) explain += '+slower';
  if(adapt.junkMul > 1.05) explain += '+more-junk';
  if(adapt.junkMul < 0.98) explain += '+less-junk';

  ddLast = { sizeMul:adapt.sizeMul, spawnMul:adapt.spawnMul, junkMul:adapt.junkMul, acc, rtAvg, explain };

  emit('hha:adaptive', { game:'plate', adapt:{...adapt}, acc, rtAvg, explain, baseline:{ accT, rtT } });
}

// ------------------------- Timer / loop -------------------------
function dtScale(){
  // slowmo in play only
  if(nowMs() < power.slowmoUntil) return 0.62;
  return 1.0;
}

function cleanseTick(dt){
  if(nowMs() < power.cleanseUntil){
    // cool fever gently
    fever = clamp(fever - dt*7.5, 0, 100);
  }
}

function magnetTick(){
  if(nowMs() >= power.magnetUntil) return;
  // auto-hit nearest GOOD near crosshair sometimes (assistive, but fun)
  if(targets.size < 1) return;
  if(rng() < 0.22){
    const hit = findTargetNearCrosshair(86);
    if(hit && hit.kind==='good'){
      shootStats.nAssistLocks += 1;
      shootStats.lastAssistTargetKind = hit.kind;
      onHit(hit.id);
    }
  }
}

function maybeStartMinisMidgame(){
  if(isResearchStrict) return;
  if(activeMini) return;

  // after first mini, sprinkle extras
  // schedule based on time left & randomness (seeded)
  const played = (nowMs()-tStartMs)/1000;
  if(played < 14) return;

  // probability bump when boredom risk
  const chance = clamp(0.006 + (fever/100)*0.010 + (missDangerPct/100)*0.010, 0.006, 0.03);
  if(rng() < chance){
    const pool = [makeMiniCleanSweep, makeMiniComboSprint];
    if(diff === 'hard') pool.push(makeMiniJunkStorm);
    const mk = pick(rng, pool);
    startMini(mk());
  }
}

function tick(){
  if(!running) return;

  const t = nowMs();
  let dt = (t - tLastTickMs) / 1000;
  tLastTickMs = t;

  if(paused){
    requestAnimationFrame(tick);
    return;
  }

  // apply slowmo scaling
  dt *= dtScale();

  // timer
  if(dt > 0 && isFinite(dt)){
    const newLeft = Math.max(0, tLeftSec - dt);
    if(Math.floor(newLeft) !== Math.floor(tLeftSec)){
      emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(newLeft) });
    }
    tLeftSec = newLeft;
  }

  // boss triggers (play only)
  if(BOSS_ENABLED){
    if(!boss.active && tLeftSec <= 20 && tLeftSec > 10){
      // start phase1 once
      if(!tick._boss1){
        tick._boss1 = true;
        startBossPhase(1);
      }
    }
    if(!boss.active && tLeftSec <= 10){
      // start phase2 once
      if(!tick._boss2){
        tick._boss2 = true;
        startBossPhase(2);
      }
    }
  }

  // boss clock
  if(boss.active){
    const tl = bossTimeLeft();
    if(tl != null){
      boss.cur = (boss.phase===2) ? Math.round(clamp((boss.durationSec - tl), 0, boss.durationSec)) : boss.cur;
      emit('hha:boss', { game:'plate', state:{...boss, requireGroups: boss.requireGroups ? [...boss.requireGroups] : null }});
      updateBossUI();

      // end boss timeout
      if(tl <= 0){
        finishBoss(boss.phase===2 ? true : false, 'timeout');
      }
    }
  }

  // mini clock + end-window FX
  if(activeMini){
    const tl = miniTimeLeft();
    if(tl != null){
      // end-window FX
      if(tl <= 3.2 && tl > 0){
        fxTick();
        if(Math.ceil(tl) !== playTickSound._lastSec){
          playTickSound._lastSec = Math.ceil(tl);
          playTickSound();
        }
        const str = 1 + (fever/100)*1.6 + (missDangerPct/100)*1.2;
        if(tl <= 1.2) fxShake(str);
        if(tl <= 2.0) fxBlink();
      }
      if(tl <= 0){
        finishMini(false, 'timeout');
      }
    }
  }

  // cleanse
  cleanseTick(dt);

  // magnet
  if(POWERUPS_ENABLED) magnetTick();

  // spawn
  const tune = currentTunings();
  spawnAccum += dt * tune.spawnPerSec;
  while(spawnAccum >= 1){
    spawnAccum -= 1;
    spawnTarget();
    maybeSpawnShield();
    maybeSpawnPower();
  }

  // expire
  for(const [id, tObj] of targets){
    if((t - tObj.bornMs) >= tObj.lifeMs){
      onExpireTarget(id);
    }
  }

  // sprinkle minis
  maybeStartMinisMidgame();

  // update
  updateGoals();
  updateHUD();
  aiPulse();

  // end conditions
  if(tLeftSec <= 0){
    endGame('time');
    return;
  }
  if(missLimit > 0 && miss >= missLimit){
    endGame('miss-limit');
    return;
  }

  requestAnimationFrame(tick);
}

// ------------------------- Pause / Start / Restart / VR -------------------------
function setPaused(p){
  paused = !!p;
  if(hudPaused) hudPaused.style.display = paused ? 'grid' : 'none';
  judge(paused ? '⏸ Paused' : '▶️ Resume', paused ? 'warn' : 'good');
}

function bootButtons(){
  on(btnPause, 'click', ()=>{
    if(!running) return;
    setPaused(!paused);
  }, { passive:true });

  on(btnRestart, 'click', ()=>{
    restartGame('restart');
  }, { passive:true });

  on(btnEnterVR, 'click', ()=>{
    try{
      const scene = DOC.querySelector('a-scene');
      if(scene && scene.enterVR) scene.enterVR();
    }catch(e){}
    refreshLayoutSoon(120);
    refreshLayoutSoon(360);
  }, { passive:true });

  on(btnBackHub, 'click', async ()=>{
    await flushHardened('back-hub');
    if(hubUrl){
      location.href = hubUrl;
    }else{
      location.href = './hub.html';
    }
  }, { passive:true });

  on(btnPlayAgain, 'click', async ()=>{
    await flushHardened('play-again');
    const u = new URL(location.href);
    if(!isStudy){
      u.searchParams.set('seed', String(Date.now() ^ (Math.random()*1e9)));
    }
    location.href = u.toString();
  }, { passive:true });

  on(btnStart, 'click', async ()=>{
    await requestGyroPermission();
    startGame();
  }, { passive:true });

  on(ROOT, 'beforeunload', ()=>{
    try{ flushHardened('beforeunload'); }catch(err){}
  });

  on(ROOT, 'resize', ()=> refreshLayoutSoon(90), { passive:true });
  on(ROOT, 'orientationchange', ()=> refreshLayoutSoon(140), { passive:true });

  const vv = ROOT.visualViewport;
  if(vv){
    on(vv, 'resize', ()=> refreshLayoutSoon(60), { passive:true });
    on(vv, 'scroll', ()=> refreshLayoutSoon(80), { passive:true });
  }
}

function resetState(){
  running = false;
  paused = false;

  tStartMs = 0;
  tLastTickMs = 0;
  tLeftSec = Number(timePlannedSec)||90;

  score = 0;
  combo = 0;
  comboMax = 0;
  miss = 0;

  gCount = [0,0,0,0,0];
  plateHave = [false,false,false,false,false];

  fever = 0;
  shield = 0;
  shieldActive = false;

  nTargetGoodSpawned = 0;
  nTargetJunkSpawned = 0;
  nTargetShieldSpawned = 0;
  nTargetPowerSpawned = 0;

  nHitGood = 0;
  nHitJunk = 0;
  nHitJunkGuard = 0;
  nExpireGood = 0;
  rtGood = [];
  perfectHits = 0;

  spawnAccum = 0;

  adapt.sizeMul = 1.0;
  adapt.spawnMul = 1.0;
  adapt.junkMul  = 1.0;
  adaptiveOn = (!isResearchStrict);

  goalsTotal = 2;
  goalsCleared = 0;
  miniCleared = 0;

  activeGoal = null;
  activeMini = null;

  missDangerPct = 0;

  power.slowmoUntil = 0;
  power.magnetUntil = 0;
  power.doubleUntil = 0;
  power.cleanseUntil = 0;
  power.lastSpawnMs = 0;
  power.nPicked = 0;

  boss.phase = 0;
  boss.active = false;
  boss.key = '';
  boss.title = '';
  boss.startedMs = 0;
  boss.durationSec = 0;
  boss.target = 0;
  boss.cur = 0;
  boss.forbidJunk = false;
  boss.requireGroups = null;
  boss.done = false;
  boss.fail = false;
  boss.reason = '';
  boss.rewardScore = 0;

  shootStats = { nShootEvents:0, nAssistLocks:0, lastAssistTargetKind:'' };

  tick._boss1 = false;
  tick._boss2 = false;

  clearAllTargets();
  if(resultBackdrop) resultBackdrop.style.display = 'none';
  if(hudPaused) hudPaused.style.display = 'none';
}

function startGame(){
  if(running) return;
  resetState();

  ensureWidgets();

  if(startOverlay) startOverlay.style.display = 'none';

  enableGyroIfAllowed();
  bindDragLook();

  refreshLayoutSoon(20);
  refreshLayoutSoon(160);

  applyLook();

  startGoals();

  // opening coach (respect policy)
  if(isResearchStrict){
    coach('เริ่มโหมดวิจัย (deterministic) — เล่นตามเงื่อนไขได้เลย', 'neutral');
  }else{
    sayCoach('พร้อมลุย! เติมจานให้ครบ 5 หมู่ แล้วคุมความแม่นยำ 💪', 'neutral', 'start');
  }
  judge('▶️ START!', 'good');

  running = true;
  paused = false;

  tStartMs = nowMs();
  tLastTickMs = tStartMs;

  updateHUD();
  emit('hha:time', { game:'plate', timeLeftSec: Math.ceil(tLeftSec) });

  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      for(let i=0;i<4;i++) spawnTarget();
      requestAnimationFrame(tick);
    });
  });
}

async function restartGame(reason){
  await flushHardened(reason || 'restart');
  const u = new URL(location.href);
  if(!isStudy){
    u.searchParams.set('seed', String(Date.now() ^ (Math.random()*1e9)));
  }
  location.href = u.toString();
}

// ------------------------- End summary + flush-hardened -------------------------
function median(arr){
  if(!arr || !arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y);
  const mid = Math.floor(a.length/2);
  return (a.length%2) ? a[mid] : (a[mid-1]+a[mid])/2;
}

function buildSummary(reason){
  const playedSec = Math.max(0, (nowMs() - tStartMs) / 1000);
  const acc = accuracyPct();
  const junkErrorPct = (nHitGood + nHitJunk) ? (nHitJunk / (nHitGood+nHitJunk) * 100) : 0;

  const avgRt = rtGood.length ? (rtGood.reduce((a,b)=>a+b,0)/rtGood.length) : 0;
  const medRt = rtGood.length ? median(rtGood) : 0;
  const fastHitRatePct = (nHitGood>0) ? (perfectHits/nHitGood*100) : 0;

  if(activeGoal && activeGoal.key === 'accuracy'){
    activeGoal.cur = Math.round(acc);
    if(acc >= activeGoal.target){
      activeGoal.done = true;
      goalsCleared++;
    }
  }

  const grade = calcGrade();
  const sessionId = `PLATE_${Date.now()}_${uid().slice(0,6)}`;

  return {
    timestampIso: new Date().toISOString(),
    projectTag: 'HHA',
    sessionId,
    game: 'plate',
    gameMode: 'plate',
    runMode,
    diff,
    durationPlannedSec: Number(timePlannedSec)||0,
    durationPlayedSec: Math.round(playedSec),
    scoreFinal: score,
    comboMax,
    misses: miss,
    missLimit,
    missDangerPct: Math.round(missDangerPct*10)/10,
    goalsCleared,
    goalsTotal,
    miniCleared,
    miniTotal: minisTotal,
    bossCleared: (tick._boss1 ? 1:0) + (tick._boss2 ? 1:0),
    nTargetGoodSpawned,
    nTargetJunkSpawned,
    nTargetShieldSpawned,
    nTargetPowerSpawned,
    nHitGood,
    nHitJunk,
    nHitJunkGuard,
    nExpireGood,
    accuracyGoodPct: Math.round(acc*10)/10,
    junkErrorPct: Math.round(junkErrorPct*10)/10,
    avgRtGoodMs: Math.round(avgRt),
    medianRtGoodMs: Math.round(medRt),
    fastHitRatePct: Math.round(fastHitRatePct*10)/10,
    grade,
    seed,
    reason: reason || 'end',
    ai: {
      enabled: AI_ENABLED,
      assistEnabled: ASSIST_ENABLED,
      policy: isResearchStrict ? 'research' : 'play',
      ddLast: { ...ddLast }
    },
    powerups: {
      enabled: POWERUPS_ENABLED,
      nPicked: power.nPicked
    },
    shootStats: { ...shootStats },
    plate: {
      have: plateHave.map(Boolean),
      counts: [...gCount],
      total: gCount.reduce((a,b)=>a+b,0)
    },
    device: (navigator && navigator.userAgent) ? navigator.userAgent : '',
    gameVersion: URLX.searchParams.get('v') || URLX.searchParams.get('ver') || '',
    hub: hubUrl || '',
  };
}

function showResult(summary){
  if(!resultBackdrop) return;
  resultBackdrop.style.display = 'grid';

  setText('rMode', summary.runMode);
  setText('rGrade', summary.grade);
  setText('rScore', summary.scoreFinal);
  setText('rMaxCombo', summary.comboMax);
  setText('rMiss', summary.misses);
  setText('rPerfect', Math.round(summary.fastHitRatePct) + '%');
  setText('rGoals', `${summary.goalsCleared}/${summary.goalsTotal}`);
  setText('rMinis', `${summary.miniCleared}/${summary.miniTotal}`);

  setText('rG1', summary.plate.counts[0]||0);
  setText('rG2', summary.plate.counts[1]||0);
  setText('rG3', summary.plate.counts[2]||0);
  setText('rG4', summary.plate.counts[3]||0);
  setText('rG5', summary.plate.counts[4]||0);
  setText('rGTotal', summary.plate.total||0);
}

function storeSummary(summary){
  saveJson(LS_LAST, summary);

  const hist = loadJson(LS_HIST, []);
  const next = Array.isArray(hist) ? hist : [];
  next.unshift(summary);
  while(next.length > 50) next.pop();
  saveJson(LS_HIST, next);
}

async function flushHardened(reason){
  try{
    const L = ROOT.HHACloudLogger || ROOT.HHA_CloudLogger || ROOT.HHA_LOGGER || null;
    if(L){
      if(typeof L.flushNow === 'function'){
        await Promise.race([
          Promise.resolve(L.flushNow({ reason })),
          new Promise(res=>setTimeout(res, 650))
        ]);
      } else if(typeof L.flush === 'function'){
        await Promise.race([
          Promise.resolve(L.flush({ reason })),
          new Promise(res=>setTimeout(res, 650))
        ]);
      }
    }
  }catch(e){}
}

async function endGame(reason){
  if(!running) return;
  running = false;
  paused = false;

  clearAllTargets();

  const summary = buildSummary(reason);
  storeSummary(summary);

  emit('hha:end', { game:'plate', summary });
  emit('hha:celebrate', { game:'plate', kind:'end' });

  const mood = (summary.grade==='C' || reason==='miss-limit') ? 'sad' : 'happy';
  coach('จบเกมแล้ว! ดูสรุปผลได้เลย 🏁', mood);
  judge(reason==='miss-limit' ? '💥 MISS LIMIT' : '🏁 END', reason==='miss-limit' ? 'bad' : 'good');

  showResult(summary);
  updateHUD();

  await flushHardened(reason || 'end');
}

// ------------------------- Init -------------------------
(function init(){
  setText('uiDiffPreview', diff);
  setText('uiTimePreview', timePlannedSec);
  setText('uiRunPreview', runMode);

  ensureWidgets();

  try{ refreshLayout(); }catch(e){}
  resetState();
  updateHUD();
  emitQuestUpdate();

  bootButtons();

  if(startOverlay) startOverlay.style.display = 'grid';
  applyLook();

  // quick info to UI if available
  const hint = qs('uiHint');
  if(hint){
    if(isResearchStrict){
      hint.textContent = 'Research mode: deterministic (AI/assist/powerups/boss ปิด)';
    }else{
      hint.textContent = 'Play mode: Boss + Power-ups + AI เปิด (ยิงกลางจอได้ถ้ามี VR UI)';
    }
  }
})();