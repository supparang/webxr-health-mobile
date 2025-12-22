// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PLAY) — Full (GoodJunk-like)
// ✅ FIX: no import initCloudLogger (hha-cloud-logger.js is IIFE)
// ✅ FIX: offset-not-double + safe-zone blocks HUD
// ✅ Tap-anywhere aim-assist + highlight nearest target
// ✅ Mini urgent FX (flash + gentle shake + tick sound)
// ✅ End summary modal wiring
// Requires in HTML: particles.js, hha-compat-input.js, hha-cloud-logger.js (defer), A-Frame
// HTML IDs used: hudTime hudScore hudCombo hudMiss hudFever hudFeverPct hudGrade hudMode hudDiff
//               hudGroupsHave hudPerfectCount hudGoalLine hudMiniLine hudMiniHint
//               btnEnterVR btnPause btnRestart resultBackdrop btnPlayAgain + r* fields

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const doc = ROOT.document;

const URLX = new URL(location.href);
const Q = URLX.searchParams;

const MODE = String(Q.get('run') || 'play').toLowerCase();      // play | research
const DIFF = String(Q.get('diff') || 'normal').toLowerCase();   // easy | normal | hard
const TOTAL_TIME = Math.max(20, parseInt(Q.get('time') || '80', 10) || 80);
const DEBUG = (Q.get('debug') === '1');

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

// ---------- Small utils ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = (a,b)=>a+Math.random()*(b-a);
const now = ()=>performance.now();
const fmt = (n)=>String(Math.max(0, Math.floor(n)));

function $(id){ return doc.getElementById(id); }
function setTxt(el, t){ if(el) el.textContent = String(t); }
function setShow(el, on){ if(!el) return; el.style.display = on ? '' : 'none'; }

function intersect(a,b){
  return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y);
}

// ---------- HUD elements ----------
const HUD = {
  time: $('hudTime'),
  score: $('hudScore'),
  combo: $('hudCombo'),
  miss: $('hudMiss'),
  feverBar: $('hudFever'),
  feverPct: $('hudFeverPct'),
  grade: $('hudGrade'),
  mode: $('hudMode'),
  diff: $('hudDiff'),
  have: $('hudGroupsHave'),
  perfect: $('hudPerfectCount'),
  goalLine: $('hudGoalLine'),
  miniLine: $('hudMiniLine'),
  miniHint: $('hudMiniHint'),

  paused: $('hudPaused'),

  btnEnterVR: $('btnEnterVR'),
  btnPause: $('btnPause'),
  btnRestart: $('btnRestart'),

  resultBackdrop: $('resultBackdrop'),
  btnPlayAgain: $('btnPlayAgain'),

  rMode: $('rMode'),
  rGrade: $('rGrade'),
  rScore: $('rScore'),
  rMaxCombo: $('rMaxCombo'),
  rMiss: $('rMiss'),
  rPerfect: $('rPerfect'),
  rGoals: $('rGoals'),
  rMinis: $('rMinis'),
  rG1: $('rG1'),
  rG2: $('rG2'),
  rG3: $('rG3'),
  rG4: $('rG4'),
  rG5: $('rG5'),
  rGTotal: $('rGTotal'),
};

// ---------- A-Frame refs ----------
const scene = doc.querySelector('a-scene');
const cam = doc.querySelector('#cam');

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy:   { size: 92, life: 3200, spawnMs: 900, junkRate: 0.20, goldRate: 0.10, aimAssist: 140 },
  normal: { size: 78, life: 2700, spawnMs: 780, junkRate: 0.26, goldRate: 0.12, aimAssist: 120 },
  hard:   { size: 66, life: 2300, spawnMs: 660, junkRate: 0.32, goldRate: 0.14, aimAssist: 110 },
};
const D = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- State ----------
const S = {
  running: false,
  paused: false,

  tStart: 0,
  tNow: 0,
  timeLeft: TOTAL_TIME,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,
  perfectCount: 0,

  fever: 0,          // 0..100
  feverOn: false,

  goalsCleared: 0,
  goalsTotal: 2,
  minisCleared: 0,
  minisTotal: 7,

  // groups collected in current plate
  plateHave: new Set(),
  groupsTotal: 5,
  groupCounts: [0,0,0,0,0], // totals across session per group

  // spawn
  nextSpawnAt: 0,

  // current goal/mini
  goalIndex: 0,
  activeGoal: null,
  activeMini: null,

  // mini timer/urgent
  miniEndsAt: 0,
  miniUrgentArmed: false,
  miniTickAt: 0,

  // targets
  targets: [],         // {el, kind, group, bornAt, dieAt, cx, cy, size}
  aimedId: null,

  // logger
  sessionId: `PLATE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
};

// ---------- Inject CSS for targets + highlight + urgent FX ----------
(function injectCss(){
  const st = doc.createElement('style');
  st.textContent = `
  .plate-layer{
    position:fixed; inset:0;
    z-index:400;
    pointer-events:none; /* important */
    transform:translate3d(0,0,0);
    will-change:transform;
  }
  .plateTarget{
    position:absolute;
    width:var(--sz,80px);
    height:var(--sz,80px);
    left:0; top:0;
    transform:translate3d(calc(var(--x)*1px), calc(var(--y)*1px), 0) scale(var(--sc,1));
    transform-origin:center;
    border-radius:999px;
    pointer-events:auto;
    touch-action:manipulation;
    user-select:none;
    -webkit-tap-highlight-color: transparent;
    display:grid;
    place-items:center;
    font-weight:1000;
    letter-spacing:.02em;
    box-shadow:0 18px 46px rgba(0,0,0,.35);
    backdrop-filter: blur(8px);
  }
  .plateTarget::before{
    content:'';
    position:absolute; inset:-2px;
    border-radius:inherit;
    opacity:.95;
    pointer-events:none;
  }
  .plateTarget.good{
    background:rgba(34,197,94,.16);
    border:1px solid rgba(34,197,94,.35);
  }
  .plateTarget.good::before{
    border:3px solid rgba(34,197,94,.75);
    box-shadow:0 0 0 8px rgba(34,197,94,.12), 0 0 40px rgba(34,197,94,.18);
  }
  .plateTarget.junk{
    background:rgba(251,113,133,.14);
    border:1px solid rgba(251,113,133,.35);
  }
  .plateTarget.junk::before{
    border:3px solid rgba(251,113,133,.75);
    box-shadow:0 0 0 8px rgba(251,113,133,.10), 0 0 40px rgba(251,113,133,.16);
  }
  .plateTarget.gold{
    background:rgba(250,204,21,.14);
    border:1px solid rgba(250,204,21,.42);
  }
  .plateTarget.gold::before{
    border:3px solid rgba(250,204,21,.85);
    box-shadow:0 0 0 10px rgba(250,204,21,.12), 0 0 54px rgba(250,204,21,.18);
  }
  .plateTarget .emoji{
    font-size:calc(var(--sz,80px) * 0.52);
    line-height:1;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,.28));
  }
  .plateTarget .tag{
    position:absolute;
    bottom:-10px;
    left:50%;
    transform:translateX(-50%);
    font-size:12px;
    font-weight:1000;
    padding:4px 10px;
    border-radius:999px;
    background:rgba(2,6,23,.72);
    border:1px solid rgba(148,163,184,.20);
    color:#e5e7eb;
    white-space:nowrap;
  }

  /* spawn pop */
  @keyframes popIn{
    0%{ transform:translate3d(calc(var(--x)*1px), calc(var(--y)*1px), 0) scale(0.55); opacity:0; }
    70%{ transform:translate3d(calc(var(--x)*1px), calc(var(--y)*1px), 0) scale(calc(var(--sc,1) * 1.08)); opacity:1; }
    100%{ transform:translate3d(calc(var(--x)*1px), calc(var(--y)*1px), 0) scale(var(--sc,1)); opacity:1; }
  }
  .plateTarget.spawn{ animation: popIn 220ms ease-out both; }

  /* highlight near crosshair */
  @keyframes aimPulse{
    0%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,.0); }
    50%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 10px rgba(255,255,255,.14); }
    100%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,.0); }
  }
  .plateTarget.aimed{ animation: aimPulse 520ms ease-in-out infinite; }

  /* urgent mini */
  @keyframes urgentFlash{
    0%{ filter:brightness(1); }
    50%{ filter:brightness(1.18); }
    100%{ filter:brightness(1); }
  }
  @keyframes gentleShake{
    0%{ transform:translate3d(0,0,0); }
    25%{ transform:translate3d(0.8px,0,0); }
    50%{ transform:translate3d(0,-0.8px,0); }
    75%{ transform:translate3d(-0.8px,0,0); }
    100%{ transform:translate3d(0,0,0); }
  }
  body.hha-mini-urgent #miniPanel{
    animation: urgentFlash 320ms linear infinite;
    border-color: rgba(250,204,21,.55) !important;
    box-shadow: 0 18px 46px rgba(0,0,0,.35), 0 0 30px rgba(250,204,21,.12);
  }
  body.hha-mini-urgent #hudTop{
    animation: gentleShake 260ms ease-in-out infinite;
  }
  `;
  doc.head.appendChild(st);
})();

// ---------- Create target layer ----------
const layer = doc.createElement('div');
layer.className = 'plate-layer';
doc.body.appendChild(layer);

// ---------- View offset (GoodJunk-like) ----------
function getCamAngles(){
  // A-Frame rotation is in radians in object3D.rotation
  const r = cam && cam.object3D ? cam.object3D.rotation : null;
  if (!r) return { yaw:0, pitch:0 };
  // yaw around y, pitch around x
  return { yaw: r.y || 0, pitch: r.x || 0 };
}

function viewOffset(){
  // Convert yaw/pitch to pixel offset.
  // Tune per screen size: larger screens -> larger px per rad, but clamp.
  const { yaw, pitch } = getCamAngles();
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;

  const pxPerRadX = clamp(vw * 0.55, 180, 720);
  const pxPerRadY = clamp(vh * 0.48, 160, 640);

  // Invert so turning right moves layer left (world feels stable)
  const x = clamp(-yaw * pxPerRadX, -vw*1.2, vw*1.2);
  const y = clamp(+pitch * pxPerRadY, -vh*1.2, vh*1.2);
  return { x, y };
}

function applyLayerTransform(){
  const off = viewOffset();
  layer.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
}

// ---------- Blocked HUD rects ----------
function getBlockedRects(){
  const rects = [];
  const ids = ['hudTop','hudLeft','hudRight','hudBottom'];
  for (const id of ids){
    const el = $(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    // Only block if visible-ish
    if (r.width > 10 && r.height > 10){
      rects.push({ x:r.left, y:r.top, w:r.width, h:r.height });
    }
  }
  // Extra breathing margins
  return rects.map(b => ({
    x: b.x - 8, y: b.y - 8, w: b.w + 16, h: b.h + 16
  }));
}

// FIX: safe-zone must check in SCREEN coords, but return WORLD coords (subtract offset)
// (this is the crucial “no double offset” fix)
function pickSafeXY(sizePx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const m = 14;
  const half = sizePx * 0.5;

  const blocked = getBlockedRects();
  const tries = 44;
  const off = viewOffset(); // layer translate

  for (let i=0;i<tries;i++){
    const sx = rnd(m+half, vw-m-half);
    const sy = rnd(m+half+60, vh-m-half-60);

    const screenRect = { x: sx-half, y: sy-half, w: sizePx, h: sizePx };

    let ok = true;
    for (const br of blocked){
      if (intersect(screenRect, br)) { ok = false; break; }
    }
    if (!ok) continue;

    const x = sx - off.x;
    const y = sy - off.y;
    return { x, y };
  }

  const sx = vw*0.55;
  const sy = vh*0.55;
  return { x: sx - off.x, y: sy - off.y };
}

// ---------- Audio (WebAudio tick / hit) ----------
const AudioX = (function(){
  let ctx = null;
  function ensure(){
    if (ctx) return ctx;
    try { ctx = new (ROOT.AudioContext || ROOT.webkitAudioContext)(); } catch(_) {}
    return ctx;
  }
  function beep(freq=740, dur=0.06, gain=0.05){
    const c = ensure(); if(!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0);
    o.stop(t0+dur+0.01);
  }
  function tick(){ beep(860, 0.05, 0.04); }
  function warn(){ beep(520, 0.08, 0.06); }
  function good(){ beep(980, 0.045, 0.035); }
  function bad(){ beep(240, 0.07, 0.05); }
  return { ensure, tick, warn, good, bad };
})();

// ---------- Target content (emojis) ----------
const FOOD_BY_GROUP = {
  1: ['🍗','🥩','🐟','🍳','🥛','🧀','🥜'],
  2: ['🍚','🍞','🥔','🌽','🥨','🍜','🍙'],
  3: ['🥦','🥕','🥬','🥒','🌶️','🍅'],
  4: ['🍎','🍌','🍊','🍉','🍍','🍇'],
  5: ['🥑','🧈','🫒','🥥','🧀'],
};
const JUNK = ['🍩','🍟','🍔','🍕','🧋','🍭','🍫','🥤'];

function randFrom(arr){ return arr[(Math.random()*arr.length)|0]; }

// ---------- Target spawn / manage ----------
let targetSeq = 0;

function computeSizePx(){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const base = D.size;
  // scale slightly with screen but clamp so it never becomes “full screen”
  const scale = clamp(Math.min(vw, vh) / 820, 0.86, 1.12);
  return clamp(base * scale, 52, 118);
}

function makeTarget(kind, group){
  const sizePx = computeSizePx();
  const pos = pickSafeXY(sizePx);
  const el = doc.createElement('div');
  el.className = `plateTarget ${kind} spawn`;
  el.dataset.tid = String(++targetSeq);

  const sc = 0.92 + Math.random()*0.22;
  const sc2 = (kind === 'gold') ? (sc * 1.10) : sc;

  el.style.setProperty('--sz', `${sizePx}px`);
  el.style.setProperty('--x', `${pos.x - sizePx/2}`);
  el.style.setProperty('--y', `${pos.y - sizePx/2}`);
  el.style.setProperty('--sc', `${sc2}`);

  let emoji = '🍽️';
  let tag = '';
  if (kind === 'junk'){
    emoji = randFrom(JUNK);
    tag = 'JUNK';
  } else if (kind === 'gold'){
    emoji = '⭐';
    tag = 'GOLD';
  } else {
    emoji = randFrom(FOOD_BY_GROUP[group] || ['🥗']);
    tag = `G${group}`;
  }

  el.innerHTML = `
    <div class="emoji">${emoji}</div>
    ${tag ? `<div class="tag">${tag}</div>` : ``}
  `;

  const bornAt = now();
  const life = (kind === 'gold') ? (D.life * 0.92) : D.life;
  const dieAt = bornAt + life;

  const cx = pos.x;
  const cy = pos.y;

  const rec = { el, kind, group, bornAt, dieAt, cx, cy, size: sizePx, dead:false };
  S.targets.push(rec);

  // click / tap on target
  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    hitTarget(rec, true);
  }, { passive:false });

  layer.appendChild(el);

  // remove spawn class soon
  setTimeout(()=> el.classList.remove('spawn'), 260);

  // optional log
  logEvent('spawn', { kind, group, size: sizePx, x: cx, y: cy });

  return rec;
}

function removeTarget(rec){
  if (!rec || rec.dead) return;
  rec.dead = true;
  try { rec.el.remove(); } catch(_) {}
  const i = S.targets.indexOf(rec);
  if (i >= 0) S.targets.splice(i,1);
}

function expireTargets(){
  const t = now();
  for (let i=S.targets.length-1; i>=0; i--){
    const rec = S.targets[i];
    if (rec.dead) continue;
    if (t >= rec.dieAt){
      // expired good counts as MISS (as per rule: miss = good expired + junk hit)
      if (rec.kind === 'good' || rec.kind === 'gold'){
        S.miss += 1;
        S.combo = 0;
        Particles.judgeText && Particles.judgeText('MISS');
        logEvent('miss_expire', { kind: rec.kind, group: rec.group });
      }
      removeTarget(rec);
    }
  }
}

function pickNearCrosshair(radiusPx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const cx = vw/2, cy = vh/2;

  // NOTE: targets rec.cx/cy are in WORLD coords (layer local), need SCREEN coords = +offset
  const off = viewOffset();

  let best = null;
  let bestD = Infinity;
  for (const rec of S.targets){
    if (rec.dead) continue;
    const sx = rec.cx + off.x;
    const sy = rec.cy + off.y;
    const dx = sx - cx;
    const dy = sy - cy;
    const d = Math.hypot(dx,dy);
    if (d < bestD){
      bestD = d;
      best = rec;
    }
  }
  if (best && bestD <= radiusPx) return { rec: best, dist: bestD };
  return null;
}

function updateAimHighlight(){
  const picked = pickNearCrosshair(D.aimAssist); // highlight in the same radius
  const tid = picked ? picked.rec.el.dataset.tid : null;

  if (tid === S.aimedId) return;

  // remove previous
  if (S.aimedId){
    const prev = S.targets.find(r => r.el.dataset.tid === S.aimedId);
    if (prev && prev.el) prev.el.classList.remove('aimed');
  }
  S.aimedId = tid;
  if (picked && picked.rec && picked.rec.el){
    picked.rec.el.classList.add('aimed');
  }
}

// ---------- Scoring / Fever / Grade ----------
function addScore(delta){
  S.score += delta;
  setTxt(HUD.score, S.score);
}

function addCombo(){
  S.combo += 1;
  S.maxCombo = Math.max(S.maxCombo, S.combo);
  setTxt(HUD.combo, S.combo);
}

function resetCombo(){
  S.combo = 0;
  setTxt(HUD.combo, S.combo);
}

function addFever(v){
  S.fever = clamp(S.fever + v, 0, 100);
  const pct = Math.round(S.fever);
  if (HUD.feverBar) HUD.feverBar.style.width = `${pct}%`;
  setTxt(HUD.feverPct, `${pct}%`);
  if (!S.feverOn && S.fever >= 100){
    S.feverOn = true;
    // quick burst / celebrate
    Particles.celebrate && Particles.celebrate('FEVER!');
    logEvent('fever_on', {});
  }
  if (S.feverOn && S.fever <= 15){
    S.feverOn = false;
    logEvent('fever_off', {});
  }
}

function gradeFromScore(){
  // Simple, feels like GoodJunk: based on score+miss
  const s = S.score;
  const m = S.miss;
  const p = S.perfectCount;

  // weighted metric
  const metric = s + p*120 - m*260;

  if (metric >= 7200) return 'SSS';
  if (metric >= 5600) return 'SS';
  if (metric >= 4200) return 'S';
  if (metric >= 2800) return 'A';
  if (metric >= 1600) return 'B';
  return 'C';
}

function updateGrade(){
  const g = gradeFromScore();
  setTxt(HUD.grade, g);
}

// ---------- Goals / Minis (simple director) ----------
const GOALS = [
  {
    key: 'plates2',
    title: '🍽️ เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ',
    hint: 'เก็บครบ 5 หมู่ = 1 ใบ (อย่าโดนขยะ!)',
    target: 2,
  },
  {
    key: 'perfect6',
    title: '⭐ ทำ PERFECT ให้ได้ 6 ครั้ง',
    hint: 'เล็งกลางเป้าให้แม่น ๆ จะได้ PERFECT',
    target: 6,
  },
];

const MINIS = [
  {
    key: 'plateRush',
    title: 'Plate Rush (8s)',
    hint: 'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ',
    dur: 8000,
    init(){ S._mini = { gotGroups:new Set(), fail:false, madePlate:false }; },
    onHit(rec, judge){
      if (rec.kind === 'junk'){ S._mini.fail = true; }
      if (rec.kind === 'good'){ S._mini.gotGroups.add(rec.group); }
      if (S._mini.gotGroups.size >= 5) S._mini.madePlate = true;
    },
    isClear(){
      return S._mini.madePlate && !S._mini.fail;
    }
  },
  {
    key: 'perfectStreak',
    title: 'Perfect Streak',
    hint: 'ทำ PERFECT ติดต่อกัน 5 ครั้ง (พลาดแล้วนับใหม่)!',
    dur: 11000,
    init(){ S._mini = { streak:0 }; },
    onJudge(j){
      if (j === 'PERFECT') S._mini.streak++;
      else if (j !== 'HIT') S._mini.streak = 0;
    },
    progress(){ return `${S._mini.streak}/5`; },
    isClear(){ return S._mini.streak >= 5; }
  },
  {
    key: 'goldHunt',
    title: 'Gold Hunt (12s)',
    hint: 'เก็บ ⭐ Gold ให้ได้ 2 อันภายในเวลา!',
    dur: 12000,
    init(){ S._mini = { got:0 }; },
    onHit(rec){
      if (rec.kind === 'gold') S._mini.got++;
    },
    progress(){ return `${S._mini.got}/2`; },
    isClear(){ return S._mini.got >= 2; }
  },
  {
    key: 'comboSprint',
    title: 'Combo Sprint (15s)',
    hint: 'ทำคอมโบให้ถึง 8 ภายใน 15 วิ!',
    dur: 15000,
    init(){ S._mini = { best:0 }; },
    tick(){ S._mini.best = Math.max(S._mini.best, S.combo); },
    progress(){ return `${Math.max(S._mini.best, S.combo)}/8`; },
    isClear(){ return Math.max(S._mini.best, S.combo) >= 8; }
  },
  {
    key: 'cleanAndCount',
    title: 'Clean & Count (10s)',
    hint: 'เก็บของดี 4 ชิ้นใน 10 วิ • ห้ามโดนขยะ!',
    dur: 10000,
    init(){ S._mini = { good:0, fail:false }; },
    onHit(rec){
      if (rec.kind === 'junk') S._mini.fail = true;
      if (rec.kind === 'good') S._mini.good++;
      if (rec.kind === 'gold') S._mini.good++; // allow
    },
    progress(){ return `${S._mini.good}/4`; },
    isClear(){ return (S._mini.good >= 4) && !S._mini.fail; }
  },
  {
    key: 'noMiss',
    title: 'No-Miss (12s)',
    hint: '12 วิ ห้ามพลาด! (ห้ามโดนขยะ/ห้ามปล่อยหมดอายุ)',
    dur: 12000,
    init(){
      S._mini = { missAtStart: S.miss };
    },
    isClear(){ return S.miss === S._mini.missAtStart; }
  },
  {
    key: 'goldOrPerfect',
    title: 'Shine (10s)',
    hint: 'ภายใน 10 วิ ทำ PERFECT 2 หรือ Gold 1 ก็ผ่าน!',
    dur: 10000,
    init(){ S._mini = { perfect:0, gold:0 }; },
    onJudge(j){ if (j==='PERFECT') S._mini.perfect++; },
    onHit(rec){ if (rec.kind==='gold') S._mini.gold++; },
    progress(){ return `P:${S._mini.perfect}/2 • G:${S._mini.gold}/1`; },
    isClear(){ return S._mini.gold>=1 || S._mini.perfect>=2; }
  },
];

function setGoal(i){
  S.goalIndex = clamp(i, 0, GOALS.length-1);
  S.activeGoal = GOALS[S.goalIndex];
  // UI
  setTxt(HUD.goalLine, `Goal ${S.goalIndex+1}/${S.goalsTotal}: ${S.activeGoal.title} (${goalProgressText()})`);
}

function goalProgressText(){
  const g = S.activeGoal;
  if (!g) return '0';
  if (g.key === 'plates2') return `${S.goalsCleared}/${g.target}`;
  if (g.key === 'perfect6') return `${S.perfectCount}/${g.target}`;
  return '0';
}

function checkGoalClear(){
  const g = S.activeGoal;
  if (!g) return false;
  let clear = false;
  if (g.key === 'plates2'){
    clear = (S.goalsCleared >= g.target);
  } else if (g.key === 'perfect6'){
    clear = (S.perfectCount >= g.target);
  }
  return clear;
}

function onGoalCleared(){
  Particles.celebrate && Particles.celebrate('GOAL CLEAR!');
  logEvent('goal_clear', { goal: S.activeGoal && S.activeGoal.key });
  // next goal
  if (S.goalIndex+1 < GOALS.length){
    setGoal(S.goalIndex+1);
  } else {
    // all goals done -> still play until time ends (GoodJunk-like)
  }
}

function startMini(){
  // pick next mini by count (deterministic-ish)
  const idx = S.minisCleared % MINIS.length;
  const mini = MINIS[idx];
  S.activeMini = mini;
  S.miniEndsAt = now() + mini.dur;
  S.miniUrgentArmed = false;
  S.miniTickAt = 0;

  if (typeof mini.init === 'function') mini.init();
  updateMiniHud();

  logEvent('mini_start', { mini: mini.key, dur: mini.dur });
}

function updateMiniHud(){
  const m = S.activeMini;
  if (!m){
    setTxt(HUD.miniLine, '…');
    setTxt(HUD.miniHint, '…');
    return;
  }
  const left = Math.max(0, (S.miniEndsAt - now())/1000);
  const prog = (typeof m.progress === 'function') ? m.progress() : '';
  const progText = prog ? ` • ${prog}` : '';
  setTxt(HUD.miniLine, `MINI: ${m.title}${progText} • ${left.toFixed(1)}s`);
  setTxt(HUD.miniHint, m.hint || '');
}

function tickMini(){
  const m = S.activeMini;
  if (!m) return;

  if (typeof m.tick === 'function') m.tick();

  const leftMs = S.miniEndsAt - now();
  const left = leftMs / 1000;

  // urgent in last 3.0s
  const urgent = (leftMs <= 3000 && leftMs > 0);
  if (urgent && !S.miniUrgentArmed){
    S.miniUrgentArmed = true;
    doc.body.classList.add('hha-mini-urgent');
    AudioX.warn();
  }
  if (!urgent && S.miniUrgentArmed){
    S.miniUrgentArmed = false;
    doc.body.classList.remove('hha-mini-urgent');
  }

  // tick sound every 1s in last 3s
  if (urgent){
    const sec = Math.ceil(left);
    if (sec !== S.miniTickAt){
      S.miniTickAt = sec;
      AudioX.tick();
    }
  }

  // end mini
  if (leftMs <= 0){
    doc.body.classList.remove('hha-mini-urgent');

    const cleared = (typeof m.isClear === 'function') ? !!m.isClear() : false;
    if (cleared){
      S.minisCleared += 1;
      Particles.celebrate && Particles.celebrate('MINI CLEAR!');
      logEvent('mini_clear', { mini: m.key });
      // reward
      addScore(450);
      addFever(18);
    } else {
      logEvent('mini_fail', { mini: m.key });
      // small penalty but not harsh
      addScore(-120);
      addFever(-12);
    }

    // next mini chain
    startMini();
  } else {
    updateMiniHud();
  }
}

// ---------- Plate logic ----------
function onGood(group){
  if (group >= 1 && group <= 5){
    S.plateHave.add(group);
    S.groupCounts[group-1] += 1;
  }
  setTxt(HUD.have, `${S.plateHave.size}/${S.groupsTotal}`);

  // completed a plate
  if (S.plateHave.size >= S.groupsTotal){
    S.goalsCleared += 1; // each full plate counts
    S.plateHave.clear();
    setTxt(HUD.have, `${S.plateHave.size}/${S.groupsTotal}`);

    Particles.celebrate && Particles.celebrate('PLATE +1!');
    logEvent('plate_complete', { plates: S.goalsCleared });

    // update goal line (plates goal)
    setGoal(S.goalIndex);

    // if first goal cleared -> mark and move
    if (S.activeGoal && S.activeGoal.key === 'plates2' && checkGoalClear()){
      onGoalCleared();
    }
  }
}

// ---------- Hit handling ----------
function judgeFromDist(distPx, sizePx){
  // normalize 0..1
  const n = clamp(distPx / (sizePx * 0.55), 0, 1);
  if (n <= 0.38) return 'PERFECT';
  return 'HIT';
}

function hitTarget(rec, direct){
  if (!S.running || S.paused) return;
  if (!rec || rec.dead) return;

  // dist from crosshair (screen)
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const cx = vw/2, cy = vh/2;
  const off = viewOffset();
  const sx = rec.cx + off.x;
  const sy = rec.cy + off.y;
  const dist = Math.hypot(sx - cx, sy - cy);

  let judge = 'HIT';

  if (rec.kind === 'junk'){
    // penalty
    addScore(-180);
    S.miss += 1;
    setTxt(HUD.miss, S.miss);
    resetCombo();
    addFever(-16);
    Particles.burstAt && Particles.burstAt(sx, sy, 'BAD');
    Particles.scorePop && Particles.scorePop('-180', sx, sy);
    Particles.judgeText && Particles.judgeText('BAD');
    AudioX.bad();

    // mini hook
    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit(rec, judge);
    if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge('BAD');

    logEvent('hit', { kind:'junk', group: rec.group, dist, direct: !!direct });

    removeTarget(rec);
    updateGrade();
    setGoal(S.goalIndex);
    return;
  }

  // good / gold
  judge = judgeFromDist(dist, rec.size);

  const mult = S.feverOn ? 1.35 : 1.0;
  const base = (rec.kind === 'gold') ? 520 : 240;
  const bonus = (judge === 'PERFECT') ? 220 : 0;
  const delta = Math.round((base + bonus) * mult);

  addScore(delta);
  addCombo();

  if (judge === 'PERFECT'){
    S.perfectCount += 1;
    setTxt(HUD.perfect, S.perfectCount);
    addFever(14);
    Particles.judgeText && Particles.judgeText('PERFECT');
    Particles.scorePop && Particles.scorePop(`+${delta}`, sx, sy);
    AudioX.good();
  } else {
    addFever(8);
    Particles.judgeText && Particles.judgeText('GOOD');
    Particles.scorePop && Particles.scorePop(`+${delta}`, sx, sy);
    AudioX.good();
  }

  Particles.burstAt && Particles.burstAt(sx, sy, (rec.kind === 'gold') ? 'GOLD' : 'GOOD');

  if (rec.kind === 'good') onGood(rec.group);
  if (rec.kind === 'gold'){
    // gold also counts as group bonus: pick random group not yet collected to help plate
    let g = 1 + ((Math.random()*5)|0);
    if (!S.plateHave.has(g)) onGood(g);
  }

  // mini hooks
  if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit(rec, judge);
  if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge(judge);

  // goal perfect goal
  if (S.activeGoal && S.activeGoal.key === 'perfect6'){
    if (checkGoalClear()) onGoalCleared();
  }

  removeTarget(rec);
  updateGrade();
  setGoal(S.goalIndex);

  logEvent('hit', { kind: rec.kind, group: rec.group, judge, dist, direct: !!direct, delta });
}

// ---------- Spawn scheduler ----------
function decideKind(){
  const r = Math.random();
  // gold priority
  if (r < D.goldRate) return 'gold';
  if (r < D.goldRate + D.junkRate) return 'junk';
  return 'good';
}

function decideGroup(){
  return 1 + ((Math.random()*5)|0);
}

function spawnTick(){
  const t = now();
  if (t < S.nextSpawnAt) return;

  // fever: faster spawns
  const mul = S.feverOn ? 0.78 : 1.0;

  // spawn 1-2 sometimes for excitement
  const burst = (Math.random() < (S.feverOn ? 0.22 : 0.12)) ? 2 : 1;

  for (let i=0;i<burst;i++){
    const kind = decideKind();
    const group = (kind === 'good') ? decideGroup() : 0;
    makeTarget(kind, group);
  }

  const jitter = rnd(-120, 120);
  S.nextSpawnAt = t + Math.max(260, (D.spawnMs * mul) + jitter);
}

// ---------- Tap-anywhere shooting ----------
function isUIElement(target){
  if (!target) return false;
  return !!(target.closest && (target.closest('.btn') || target.closest('#hudRight') || target.closest('#resultBackdrop')));
}

function onGlobalPointerDown(e){
  if (!S.running || S.paused) return;
  if (isUIElement(e.target)) return;

  // Ensure audio on first touch
  AudioX.ensure();

  // choose nearest target near crosshair (bigger radius to feel GoodJunk)
  const picked = pickNearCrosshair(D.aimAssist);
  if (picked && picked.rec){
    hitTarget(picked.rec, false);
  }
}

// ---------- Pause / Restart / VR ----------
function setPaused(on){
  S.paused = !!on;
  setShow(HUD.paused, S.paused);
  if (HUD.btnPause) HUD.btnPause.textContent = S.paused ? '▶️ RESUME' : '⏸️ PAUSE';
}

function restart(){
  // wipe targets
  for (const rec of [...S.targets]) removeTarget(rec);

  // reset state
  S.running = false;
  S.paused = false;

  S.tStart = 0;
  S.timeLeft = TOTAL_TIME;

  S.score = 0;
  S.combo = 0;
  S.maxCombo = 0;
  S.miss = 0;
  S.perfectCount = 0;

  S.fever = 0;
  S.feverOn = false;

  S.goalsCleared = 0;
  S.minisCleared = 0;

  S.plateHave.clear();
  S.groupCounts = [0,0,0,0,0];

  setTxt(HUD.score, 0);
  setTxt(HUD.combo, 0);
  setTxt(HUD.miss, 0);
  setTxt(HUD.perfect, 0);
  setTxt(HUD.have, `0/5`);
  if (HUD.feverBar) HUD.feverBar.style.width = `0%`;
  setTxt(HUD.feverPct, `0%`);

  updateGrade();
  setPaused(false);
  setShow(HUD.resultBackdrop, false);
  doc.body.classList.remove('hha-mini-urgent');

  // reset goal/mini
  setGoal(0);
  startMini();

  // logger session start
  logSession('start');

  // start loop
  start();
}

function enterVR(){
  if (!scene || !scene.enterVR) return;
  try { scene.enterVR(); } catch(_) {}
}

// ---------- End summary ----------
function endGame(){
  if (!S.running) return;
  S.running = false;
  doc.body.classList.remove('hha-mini-urgent');

  // stop spawns
  S.nextSpawnAt = Infinity;

  // clear remaining targets
  for (const rec of [...S.targets]) removeTarget(rec);

  // fill modal
  setTxt(HUD.rMode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.rGrade, gradeFromScore());
  setTxt(HUD.rScore, S.score);
  setTxt(HUD.rMaxCombo, S.maxCombo);
  setTxt(HUD.rMiss, S.miss);
  setTxt(HUD.rPerfect, S.perfectCount);

  setTxt(HUD.rGoals, `${Math.min(S.goalsCleared, S.goalsTotal)}/${S.goalsTotal}`);
  setTxt(HUD.rMinis, `${Math.min(S.minisCleared, S.minisTotal)}/${S.minisTotal}`);

  setTxt(HUD.rG1, S.groupCounts[0]);
  setTxt(HUD.rG2, S.groupCounts[1]);
  setTxt(HUD.rG3, S.groupCounts[2]);
  setTxt(HUD.rG4, S.groupCounts[3]);
  setTxt(HUD.rG5, S.groupCounts[4]);
  setTxt(HUD.rGTotal, S.groupCounts.reduce((a,b)=>a+b,0));

  setShow(HUD.resultBackdrop, true);

  Particles.celebrate && Particles.celebrate('ALL DONE!');
  logSession('end');
}

// ---------- Logger (works with hha-cloud-logger.js IIFE) ----------
function dispatchEvt(name, detail){
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch(_) {}
}
function logSession(phase){
  dispatchEvt('hha:log_session', {
    sessionId: S.sessionId,
    game: 'PlateVR',
    phase,
    mode: MODE,
    diff: DIFF,
    timeTotal: TOTAL_TIME,
    ts: Date.now(),
    ua: navigator.userAgent,
  });
}
function logEvent(type, data){
  dispatchEvt('hha:log_event', {
    sessionId: S.sessionId,
    game: 'PlateVR',
    type,
    t: Math.round((now() - S.tStart) || 0),
    score: S.score,
    combo: S.combo,
    miss: S.miss,
    perfect: S.perfectCount,
    fever: Math.round(S.fever),
    data: data || {},
  });
}

// ---------- Main loop ----------
function start(){
  S.running = true;
  S.tStart = now();
  S.nextSpawnAt = now() + 350;

  // HUD constants
  setTxt(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));

  function frame(){
    if (!S.running) return;

    applyLayerTransform();
    updateAimHighlight();

    if (!S.paused){
      // time
      const elapsed = (now() - S.tStart) / 1000;
      S.timeLeft = Math.max(0, TOTAL_TIME - elapsed);
      setTxt(HUD.time, fmt(S.timeLeft));

      // spawn & expire
      spawnTick();
      expireTargets();

      // mini
      tickMini();

      // fever decay gently
      addFever(S.feverOn ? -0.22 : -0.10);

      // update goal line (live)
      setGoal(S.goalIndex);

      // end
      if (S.timeLeft <= 0){
        endGame();
        return;
      }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// ---------- Bind UI ----------
function bindUI(){
  // global shooting
  doc.addEventListener('pointerdown', onGlobalPointerDown, { passive:false });

  if (HUD.btnEnterVR) HUD.btnEnterVR.addEventListener('click', enterVR);
  if (HUD.btnPause) HUD.btnPause.addEventListener('click', ()=>{
    if (!S.running) return;
    setPaused(!S.paused);
    logEvent('pause', { paused: S.paused });
  });
  if (HUD.btnRestart) HUD.btnRestart.addEventListener('click', ()=>{
    logEvent('restart', {});
    restart();
  });

  if (HUD.btnPlayAgain) HUD.btnPlayAgain.addEventListener('click', ()=>{
    setShow(HUD.resultBackdrop, false);
    restart();
  });

  // tap backdrop to close? (optional)
  if (HUD.resultBackdrop){
    HUD.resultBackdrop.addEventListener('click', (e)=>{
      if (e.target === HUD.resultBackdrop){
        setShow(HUD.resultBackdrop, false);
      }
    });
  }
}

// ---------- Boot ----------
(function boot(){
  // cloud logger is IIFE; keep endpoint in sessionStorage; optional init call
  try {
    if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.init === 'function'){
      // auto-init already, but keep debug sync if needed
      ROOT.HHACloudLogger.init({ debug: DEBUG });
    }
  } catch(_) {}

  bindUI();

  // initial HUD
  setTxt(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));
  setTxt(HUD.have, `0/5`);
  updateGrade();

  // start quests
  setGoal(0);
  startMini();

  // start session
  logSession('start');

  // start loop
  start();

  if (DEBUG) console.log('[PlateVR] boot ok', { MODE, DIFF, TOTAL_TIME, D });
})();