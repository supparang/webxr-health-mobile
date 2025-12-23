// === /herohealth/plate/plate.safe.js ===
// Balanced Plate VR — ALL-IN (C5)
// ✅ C3: bottom HUD dodge targets ONLY when near
// ✅ C4: watchdog + visibility pause/resume + frame try/catch (no silent stop)
// ✅ D4: Auto-reconnect on A-Frame enter/exit VR (rebase target positions so they don't jump)
// ✅ D5: Anti-throttle timer (wall-clock + pause compensation) -> time stays accurate, not slow/drift

'use strict';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const doc = ROOT.document;

const URLX = new URL(location.href);
const Q = URLX.searchParams;

const MODE = String(Q.get('run') || 'play').toLowerCase();      // play | research
const DIFF = String(Q.get('diff') || 'normal').toLowerCase();   // easy | normal | hard
const TOTAL_TIME = Math.max(20, parseInt(Q.get('time') || '80', 10) || 80);
const DEBUG = (Q.get('debug') === '1');

const STRICT_RESEARCH = (MODE === 'research');

// deterministic seed for research: seed > sid > fixed
const SEED_STR = String(Q.get('seed') || Q.get('sid') || 'plate-research');

const LIVES_PARAM = parseInt(Q.get('lives') || '', 10);
const LIVES_START = Number.isFinite(LIVES_PARAM) && LIVES_PARAM > 0 ? LIVES_PARAM : 3;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

// ---------- deterministic RNG (research only) ----------
function xmur3(str){
  let h = 1779033703 ^ str.length;
  for (let i=0;i<str.length;i++){
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function(){
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= (h >>> 16);
    return h >>> 0;
  };
}
function mulberry32(a){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _seedGen = xmur3(SEED_STR);
const _seedU32 = _seedGen();
const _rngResearch = mulberry32(_seedU32);
const rand = STRICT_RESEARCH ? _rngResearch : Math.random;

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const rnd = (a,b)=>a + rand()*(b-a);
const rint = (a,b)=>Math.floor(rnd(a,b+1)); // inclusive
const choice = (arr)=>arr[(rand()*arr.length)|0];

const now = ()=>performance.now();
const fmt = (n)=>String(Math.max(0, Math.floor(n)));
function $(id){ return doc.getElementById(id); }
function setTxt(el, t){ if(el) el.textContent = String(t); }
function setShow(el, on){ if(!el) return; el.style.display = on ? '' : 'none'; }
function intersect(a,b){ return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y); }

// ---------- HUD refs ----------
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

  // result ids
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

function inVR(){
  try { return !!(scene && scene.is && scene.is('vr-mode')); } catch(_) { return false; }
}

// ---------- Difficulty tuning ----------
const DIFF_TABLE = {
  easy: {
    size: 92, life: 3200, spawnMs: 900,
    junkRate: 0.18, goldRate: 0.10, trapRate: 0.045,
    aimAssist: 160,
  },
  normal: {
    size: 78, life: 2700, spawnMs: 780,
    junkRate: 0.24, goldRate: 0.12, trapRate: 0.070,
    aimAssist: 135,
  },
  hard: {
    size: 66, life: 2300, spawnMs: 660,
    junkRate: 0.30, goldRate: 0.14, trapRate: 0.095,
    aimAssist: 125,
  },
};
const D = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;

// ---------- State ----------
const S = {
  running: false,
  paused: false,

  tStart: 0,                // perf baseline (for log t)
  timeLeft: TOTAL_TIME,

  // D5: wall timer (anti-throttle + pause compensation)
  wallStart: 0,
  pauseAccum: 0,
  pauseWallAt: 0,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,
  perfectCount: 0,

  fever: 0,
  feverOn: false,

  lives: LIVES_START,
  livesMax: Math.max(1, LIVES_START),

  goalsCleared: 0,
  goalsTotal: 2,
  minisCleared: 0,
  minisTotal: 7,

  plateHave: new Set(),
  groupsTotal: 5,
  groupCounts: [0,0,0,0,0],

  nextSpawnAt: 0,

  goalIndex: 0,
  activeGoal: null,
  activeMini: null,

  miniEndsAt: 0,
  miniUrgentArmed: false,
  miniTickAt: 0,

  targets: [],
  aimedId: null,

  lowTimeLastSec: null,

  // C3 dodge for #hudBottom
  hbX: 0,
  hbY: 0,

  // C4: loop safety
  rafId: 0,
  lastFrameAt: 0,
  lastTickWall: Date.now(),
  visPaused: false,
  watchdogId: 0,

  // D4: offset tracking for VR rebase
  _off: { x:0, y:0 },

  sessionId: `PLATE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
};

// ---------- VR feel: view offset (mobile look) ----------
function getCamAngles(){
  const r = cam && cam.object3D ? cam.object3D.rotation : null;
  if (!r) return { yaw:0, pitch:0 };
  return { yaw: r.y || 0, pitch: r.x || 0 };
}
function viewOffset(){
  if (inVR()) return { x:0, y:0 };
  const { yaw, pitch } = getCamAngles();
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const pxPerRadX = clamp(vw * 0.55, 180, 720);
  const pxPerRadY = clamp(vh * 0.48, 160, 640);
  const x = clamp(-yaw * pxPerRadX, -vw*1.2, vw*1.2);
  const y = clamp(+pitch * pxPerRadY, -vh*1.2, vh*1.2);
  return { x, y };
}

// ---------- Layer ----------
const layer = doc.createElement('div');
layer.className = 'plate-layer';
doc.body.appendChild(layer);

(function injectCss(){
  const st = doc.createElement('style');
  st.textContent = `
  .plate-layer{
    position:fixed; inset:0;
    z-index:400;
    pointer-events:auto;
    touch-action:none;
    transform:translate3d(0,0,0);
    will-change:transform;
  }
  .plateTarget{
    position:absolute;
    width:var(--sz,80px);
    height:var(--sz,80px);
    left:0; top:0;
    transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(var(--sc,1));
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
  .plateTarget.good{ background:rgba(34,197,94,.16); border:1px solid rgba(34,197,94,.35); }
  .plateTarget.good::before{ border:3px solid rgba(34,197,94,.75); box-shadow:0 0 0 8px rgba(34,197,94,.12), 0 0 40px rgba(34,197,94,.18); }
  .plateTarget.junk{ background:rgba(251,113,133,.14); border:1px solid rgba(251,113,133,.35); }
  .plateTarget.junk::before{ border:3px solid rgba(251,113,133,.75); box-shadow:0 0 0 8px rgba(251,113,133,.10), 0 0 40px rgba(251,113,133,.16); }
  .plateTarget.gold{ background:rgba(250,204,21,.14); border:1px solid rgba(250,204,21,.42); }
  .plateTarget.gold::before{ border:3px solid rgba(250,204,21,.85); box-shadow:0 0 0 10px rgba(250,204,21,.12), 0 0 54px rgba(250,204,21,.18); }
  .plateTarget.trap{ background:rgba(147,51,234,.12); border:1px solid rgba(147,51,234,.38); }
  .plateTarget.trap::before{ border:3px solid rgba(147,51,234,.70); box-shadow:0 0 0 10px rgba(147,51,234,.12), 0 0 60px rgba(147,51,234,.14); }

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

  @keyframes popIn{
    0%{ transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(0.55); opacity:0; }
    70%{ transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(calc(var(--sc,1) * 1.08)); opacity:1; }
    100%{ transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(var(--sc,1)); opacity:1; }
  }
  .plateTarget.spawn{ animation: popIn 220ms ease-out both; }

  @keyframes aimPulse{
    0%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,.0); }
    50%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 10px rgba(255,255,255,.14); }
    100%{ box-shadow:0 18px 46px rgba(0,0,0,.35), 0 0 0 0 rgba(255,255,255,.0); }
  }
  .plateTarget.aimed{ animation: aimPulse 520ms ease-in-out infinite; }

  @keyframes urgentFlash{ 0%{ filter:brightness(1); } 50%{ filter:brightness(1.18); } 100%{ filter:brightness(1); } }
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
  body.hha-mini-urgent #hudTop{ animation: gentleShake 260ms ease-in-out infinite; }
  `;
  doc.head.appendChild(st);
})();

// ---------- Audio ----------
const AudioX = (function(){
  let ctx = null;
  function ensure(){ if (ctx) return ctx; try { ctx = new (ROOT.AudioContext || ROOT.webkitAudioContext)(); } catch(_) {} return ctx; }
  function unlock(){ const c = ensure(); if (!c) return; if (c.state === 'suspended') { try { c.resume(); } catch(_) {} } }
  function beep(freq=740, dur=0.06, gain=0.05, type='sine'){
    const c = ensure(); if(!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0+dur+0.01);
  }
  return {
    unlock,
    tick(){ beep(860, 0.05, 0.04, 'square'); },
    warn(){ beep(520, 0.08, 0.06, 'sawtooth'); },
    good(){ beep(980, 0.045, 0.035, 'sine'); },
    perfect(){ beep(1180, 0.06, 0.04, 'triangle'); },
    bad(){ beep(220, 0.08, 0.06, 'sawtooth'); },
  };
})();
function vibe(ms){ try { if (navigator.vibrate) navigator.vibrate(ms); } catch(_) {} }

// ---------- Logger ----------
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
    strictResearch: STRICT_RESEARCH,
    seed: STRICT_RESEARCH ? SEED_STR : null,
    seedU32: STRICT_RESEARCH ? _seedU32 : null,
    timeTotal: TOTAL_TIME,
    lives: S.livesMax,
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
    lives: S.lives,
    data: data || {},
  });
}

// ---------- D5: wall-clock elapsed (anti-throttle, pause compensation) ----------
function elapsedSec(){
  if (!S.wallStart) return 0;
  const wallNow = Date.now();
  const pausedAdd = (S.paused && S.pauseWallAt) ? (wallNow - S.pauseWallAt) : 0;
  const raw = (wallNow - S.wallStart - S.pauseAccum - pausedAdd) / 1000;
  return Math.max(0, raw);
}

// ---------- Camera offset apply ----------
function applyLayerTransform(){
  const off = viewOffset();
  S._off = off;
  layer.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
}

// ---------- Content pools ----------
const FOOD_BY_GROUP = {
  1: ['🍗','🥩','🐟','🍳','🥛','🧀','🥜'],
  2: ['🍚','🍞','🥔','🌽','🥨','🍜','🍙'],
  3: ['🥦','🥕','🥬','🥒','🌶️','🍅'],
  4: ['🍎','🍌','🍊','🍉','🍍','🍇'],
  5: ['🥑','🧈','🫒','🥥','🧀'],
};
const JUNK = ['🍩','🍟','🍔','🍕','🧋','🍭','🍫','🥤'];
const TRAPS = ['🎁','⭐','🍬','🍰','🧁'];
function isBadKind(kind){ return (kind === 'junk' || kind === 'trap'); }

// ---------- Goals / Minis ----------
const GOALS = [
  { key:'plates2', title:'🍽️ เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ', target:2 },
  { key:'perfect6', title:'⭐ ทำ PERFECT ให้ได้ 6 ครั้ง', target:6 },
];

const MINIS = [
  { key:'plateRush', title:'Plate Rush (8s)', hint:'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ', dur:8000,
    init(){ S._mini = { gotGroups:new Set(), fail:false, madePlate:false }; },
    onHit(rec){ if (isBadKind(rec.kind)) S._mini.fail=true; if(rec.kind==='good') S._mini.gotGroups.add(rec.group); if(S._mini.gotGroups.size>=5) S._mini.madePlate=true; },
    isClear(){ return S._mini.madePlate && !S._mini.fail; }
  },
  { key:'perfectStreak', title:'Perfect Streak', hint:'ทำ PERFECT ติดต่อกัน 5 ครั้ง (พลาดแล้วนับใหม่)!', dur:11000,
    init(){ S._mini = { streak:0 }; },
    onJudge(j){ if(j==='PERFECT') S._mini.streak++; else if(j!=='HIT') S._mini.streak=0; },
    progress(){ return `${S._mini.streak}/5`; },
    isClear(){ return S._mini.streak>=5; }
  },
  { key:'goldHunt', title:'Gold Hunt (12s)', hint:'เก็บ ⭐ Gold ให้ได้ 2 อันภายในเวลา!', dur:12000,
    init(){ S._mini = { got:0 }; },
    onHit(rec){ if(rec.kind==='gold') S._mini.got++; },
    progress(){ return `${S._mini.got}/2`; },
    isClear(){ return S._mini.got>=2; }
  },
  { key:'comboSprint', title:'Combo Sprint (15s)', hint:'ทำคอมโบให้ถึง 8 ภายใน 15 วิ!', dur:15000,
    init(){ S._mini = { best:0 }; },
    tick(){ S._mini.best = Math.max(S._mini.best, S.combo); },
    progress(){ return `${Math.max(S._mini.best, S.combo)}/8`; },
    isClear(){ return Math.max(S._mini.best, S.combo) >= 8; }
  },
  { key:'cleanAndCount', title:'Clean & Count (10s)', hint:'เก็บของดี 4 ชิ้นใน 10 วิ • ห้ามโดนขยะ!', dur:10000,
    init(){ S._mini = { good:0, fail:false }; },
    onHit(rec){ if(isBadKind(rec.kind)) S._mini.fail=true; if(rec.kind==='good') S._mini.good++; if(rec.kind==='gold') S._mini.good++; },
    progress(){ return `${S._mini.good}/4`; },
    isClear(){ return (S._mini.good>=4)&&!S._mini.fail; }
  },
  { key:'noMiss', title:'No-Miss (12s)', hint:'12 วิ ห้ามพลาด! (ห้ามโดนขยะ/ห้ามปล่อยหมดอายุ)', dur:12000,
    init(){ S._mini = { missAtStart: S.miss, lifeAtStart:S.lives }; },
    isClear(){ return (S.miss === S._mini.missAtStart) && (S.lives === S._mini.lifeAtStart); }
  },
  { key:'shine', title:'Shine (10s)', hint:'ภายใน 10 วิ ทำ PERFECT 2 ก็ผ่าน!', dur:10000,
    init(){ S._mini = { perfect:0 }; },
    onJudge(j){ if(j==='PERFECT') S._mini.perfect++; },
    progress(){ return `P:${S._mini.perfect}/2`; },
    isClear(){ return S._mini.perfect>=2; }
  },
];

// ---------- Safe spawn (avoid top HUD / right buttons roughly) ----------
function getBlockedRects(){
  const rects = [];
  const ids = ['hudTop','hudRight']; // bottom will dodge dynamically (C3)
  for (const id of ids){
    const el = doc.getElementById(id);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 10 && r.height > 10) rects.push({ x:r.left, y:r.top, w:r.width, h:r.height });
  }
  return rects.map(b => ({ x:b.x-10, y:b.y-10, w:b.w+20, h:b.h+20 }));
}
function pickSafeXY(sizePx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const m = 14;
  const half = sizePx * 0.5;
  const blocked = inVR() ? [] : getBlockedRects();
  const tries = 70;
  const off = viewOffset();

  for (let i=0;i<tries;i++){
    const sx = rnd(m+half, vw-m-half);
    const sy = rnd(m+half+70, vh-m-half-70);
    const screenRect = { x: sx-half, y: sy-half, w: sizePx, h: sizePx };

    let ok = true;
    for (const br of blocked){
      if (intersect(screenRect, br)) { ok = false; break; }
    }
    if (!ok) continue;

    return { x: (sx - off.x), y: (sy - off.y) };
  }
  return { x: vw*0.55 - off.x, y: vh*0.55 - off.y };
}

// ---------- extra HUD pill ----------
let hudLivesVal = null;
function ensurePills(){
  const top = doc.getElementById('hudTop');
  if (!top) return;
  const card = top.querySelector('.card') || top;
  const rows = card.querySelectorAll('.row');
  if (!rows || !rows.length) return;

  const row = rows[1]; // second row
  if (!row) return;

  if (!doc.getElementById('hudLivesPill')){
    const pill = doc.createElement('div');
    pill.className = 'pill small';
    pill.id = 'hudLivesPill';
    pill.innerHTML = `❤️ <span class="k">LIVES</span> <span id="hudLives" class="v">${S.lives}</span>`;
    row.appendChild(pill);
    hudLivesVal = pill.querySelector('#hudLives');
  } else hudLivesVal = doc.getElementById('hudLives');

  setTxt(hudLivesVal, S.lives);
}
function setLives(n){
  S.lives = clamp(n, 0, S.livesMax);
  ensurePills();
  setTxt(hudLivesVal, S.lives);
}

// ---------- Score/Fever/Grade ----------
function addScore(delta){ S.score += delta; setTxt(HUD.score, S.score); }
function addCombo(){ S.combo += 1; S.maxCombo = Math.max(S.maxCombo, S.combo); setTxt(HUD.combo, S.combo); }
function addFever(v){
  const prev = S.fever;
  S.fever = clamp(S.fever + v, 0, STRICT_RESEARCH ? 99 : 100);
  const pct = Math.round(S.fever);
  if (HUD.feverBar) HUD.feverBar.style.width = `${pct}%`;
  setTxt(HUD.feverPct, `${pct}%`);
  if (STRICT_RESEARCH){
    S.feverOn = false;
    if (prev !== S.fever) logEvent('fever', { pct });
    return;
  }
}
function gradeFromScore(){
  const metric =
    S.score +
    S.perfectCount*120 +
    S.maxCombo*35 -
    S.miss*260 -
    (S.livesMax - S.lives)*180;
  if (metric >= 8200) return 'SSS';
  if (metric >= 6200) return 'SS';
  if (metric >= 4600) return 'S';
  if (metric >= 3000) return 'A';
  if (metric >= 1700) return 'B';
  return 'C';
}
function updateGrade(){ setTxt(HUD.grade, gradeFromScore()); }

// ---------- Goals/Mini HUD ----------
function goalProgressText(){
  const g = S.activeGoal;
  if (!g) return '0';
  if (g.key === 'plates2') return `${S.goalsCleared}/${g.target}`;
  if (g.key === 'perfect6') return `${S.perfectCount}/${g.target}`;
  return '0';
}
function setGoal(i){
  S.goalIndex = clamp(i, 0, GOALS.length-1);
  S.activeGoal = GOALS[S.goalIndex];
  setTxt(HUD.goalLine, `Goal ${S.goalIndex+1}/${S.goalsTotal}: ${S.activeGoal.title} (${goalProgressText()})`);
}
function checkGoalClear(){
  const g = S.activeGoal;
  if (!g) return false;
  if (g.key === 'plates2') return (S.goalsCleared >= g.target);
  if (g.key === 'perfect6') return (S.perfectCount >= g.target);
  return false;
}
function onGoalCleared(){
  Particles.celebrate && Particles.celebrate('GOAL CLEAR!');
  vibe(45);
  logEvent('goal_clear', { goal: S.activeGoal && S.activeGoal.key });
  if (S.goalIndex+1 < GOALS.length) setGoal(S.goalIndex+1);
}

function startMini(){
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
  if (!m){ setTxt(HUD.miniLine, '…'); setTxt(HUD.miniHint, '…'); return; }
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

  const urgent = (leftMs <= 3000 && leftMs > 0);
  if (urgent && !S.miniUrgentArmed){
    S.miniUrgentArmed = true;
    doc.body.classList.add('hha-mini-urgent');
    AudioX.warn(); vibe(18);
  }
  if (!urgent && S.miniUrgentArmed){
    S.miniUrgentArmed = false;
    doc.body.classList.remove('hha-mini-urgent');
  }

  if (urgent){
    const sec = Math.ceil(left);
    if (sec !== S.miniTickAt){
      S.miniTickAt = sec;
      AudioX.tick();
    }
  }

  if (leftMs <= 0){
    doc.body.classList.remove('hha-mini-urgent');

    const cleared = (typeof m.isClear === 'function') ? !!m.isClear() : false;
    if (cleared){
      S.minisCleared += 1;
      Particles.celebrate && Particles.celebrate('MINI CLEAR!');
      vibe(35);
      logEvent('mini_clear', { mini: m.key });
      addScore(450);
      addFever(18);
    } else {
      logEvent('mini_fail', { mini: m.key });
      addScore(-120);
      addFever(-12);
    }
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

  if (S.plateHave.size >= S.groupsTotal){
    S.goalsCleared += 1;
    S.plateHave.clear();
    setTxt(HUD.have, `0/5`);
    Particles.celebrate && Particles.celebrate('PLATE +1!');
    vibe(25);
    logEvent('plate_complete', { plates: S.goalsCleared });

    setGoal(S.goalIndex);
    if (S.activeGoal && S.activeGoal.key === 'plates2' && checkGoalClear()){
      onGoalCleared();
    }
  }
}

// ---------- Aim assist ----------
function pickNearCrosshair(radiusPx){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const cx = vw/2, cy = vh/2;
  const off = viewOffset();

  let best = null;
  let bestD = Infinity;
  for (const rec of S.targets){
    if (rec.dead) continue;
    const sx = rec.cx + off.x;
    const sy = rec.cy + off.y;
    const d = Math.hypot(sx - cx, sy - cy);
    if (d < bestD){ bestD = d; best = rec; }
  }
  if (best && bestD <= radiusPx) return { rec: best, dist: bestD };
  return null;
}
function updateAimHighlight(){
  const assist = inVR() ? Math.max(D.aimAssist, 170) : D.aimAssist;
  const picked = pickNearCrosshair(assist);
  const tid = picked ? picked.rec.el.dataset.tid : null;

  if (tid === S.aimedId) return;
  if (S.aimedId){
    const prev = S.targets.find(r => r.el.dataset.tid === S.aimedId);
    if (prev && prev.el) prev.el.classList.remove('aimed');
  }
  S.aimedId = tid;
  if (picked && picked.rec && picked.rec.el) picked.rec.el.classList.add('aimed');
}

// ---------- C3: bottom HUD dodge ONLY when targets near ----------
function lerp(a,b,t){ return a + (b-a)*t; }
function tickHudBottomDodge(){
  const hb = doc.getElementById('hudBottom');
  if (!hb) return;

  if (S.paused){
    hb.style.setProperty('--hb-x', `0px`);
    hb.style.setProperty('--hb-y', `0px`);
    return;
  }

  const off = viewOffset();
  const r = hb.getBoundingClientRect();
  if (r.width < 10 || r.height < 10) return;

  const pad = 18;
  const rr = { left:r.left-pad, top:r.top-pad, right:r.right+pad, bottom:r.bottom+pad };

  let hit = null;
  for (const rec of S.targets){
    if (rec.dead) continue;
    const sx = rec.cx + off.x;
    const sy = rec.cy + off.y;
    if (sx >= rr.left && sx <= rr.right && sy >= rr.top && sy <= rr.bottom){
      hit = { sx, sy };
      break;
    }
  }

  if (!hit){
    S.hbX = lerp(S.hbX, 0, 0.18);
    S.hbY = lerp(S.hbY, 0, 0.18);
    hb.style.setProperty('--hb-x', `${S.hbX.toFixed(1)}px`);
    hb.style.setProperty('--hb-y', `${S.hbY.toFixed(1)}px`);
    return;
  }

  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const centerX = (r.left + r.right) * 0.5;
  const centerY = (r.top + r.bottom) * 0.5;

  const awayX = (centerX - hit.sx);
  const awayY = (centerY - hit.sy);

  const dirX = awayX >= 0 ? 1 : -1;
  const dirY = awayY >= 0 ? 1 : -1;

  const maxX = clamp(vw * 0.22, 60, 160);
  const maxY = clamp(vh * 0.12, 30, 110);

  const nearBottom = hit.sy > vh * 0.65;
  const tx = dirX * maxX;
  const ty = (nearBottom ? -1 : dirY) * maxY * 0.65;

  S.hbX = lerp(S.hbX, tx, 0.35);
  S.hbY = lerp(S.hbY, ty, 0.35);

  hb.style.setProperty('--hb-x', `${S.hbX.toFixed(1)}px`);
  hb.style.setProperty('--hb-y', `${S.hbY.toFixed(1)}px`);
}

// ---------- Target spawn/manage ----------
let targetSeq = 0;
function computeSizePx(kind){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const base = D.size;
  const scale = clamp(Math.min(vw, vh) / 820, 0.86, 1.12);
  let sz = clamp(base * scale, 52, 118);
  if (kind === 'gold') sz = clamp(sz * 1.05, 56, 128);
  if (kind === 'trap') sz = clamp(sz * 1.06, 56, 132);
  return sz;
}
function decideGroup(){ return 1 + ((rand()*5)|0); }
function decideKind(){
  const gold = D.goldRate;
  const junk = D.junkRate;
  const trap = D.trapRate;

  const r = rand();
  let acc = 0;
  acc += gold; if (r < acc) return 'gold';
  acc += junk; if (r < acc) return 'junk';
  acc += trap; if (r < acc) return 'trap';
  return 'good';
}

function syncTargetCSS(rec){
  if (!rec || !rec.el) return;
  rec.el.style.setProperty('--x', `${(rec.cx - rec.size/2)}px`);
  rec.el.style.setProperty('--y', `${(rec.cy - rec.size/2)}px`);
}

function makeTarget(kind, group){
  const sizePx = computeSizePx(kind);
  const pos = pickSafeXY(sizePx);

  const el = doc.createElement('div');
  el.className = `plateTarget ${kind} spawn`;
  el.dataset.tid = String(++targetSeq);

  const sc = 0.92 + rand()*0.22;
  el.style.setProperty('--sz', `${sizePx}px`);
  el.style.setProperty('--x', `${(pos.x - sizePx/2)}px`);
  el.style.setProperty('--y', `${(pos.y - sizePx/2)}px`);
  el.style.setProperty('--sc', `${sc}`);

  let emoji = '🥗';
  let tag = '';
  if (kind === 'junk'){ emoji = choice(JUNK); tag = 'JUNK'; }
  else if (kind === 'gold'){ emoji = '⭐'; tag = 'GOLD'; }
  else if (kind === 'trap'){ emoji = choice(TRAPS); tag = 'TRAP'; }
  else { emoji = choice(FOOD_BY_GROUP[group] || ['🥗']); tag = `G${group}`; }

  el.innerHTML = `<div class="emoji">${emoji}</div>${tag ? `<div class="tag">${tag}</div>`:''}`;

  const bornAt = now();
  const lifeBase = D.life;
  const life =
    (kind === 'gold') ? (lifeBase * 0.92) :
    (kind === 'trap') ? (lifeBase * 0.95) :
    lifeBase;

  const rec = {
    el, kind, group,
    bornAt,
    dieAt: bornAt + life,
    cx: pos.x, cy: pos.y,
    size: sizePx,
    dead:false,
  };

  const hitHandler = (e)=>{
    e.preventDefault(); e.stopPropagation();
    AudioX.unlock();
    hitTarget(rec, true);
  };
  el.addEventListener('pointerdown', hitHandler, { passive:false });
  el.addEventListener('click', hitHandler, { passive:false });
  el.addEventListener('touchstart', hitHandler, { passive:false });

  S.targets.push(rec);
  layer.appendChild(el);
  setTimeout(()=> el.classList.remove('spawn'), 260);

  logEvent('spawn', { kind, group, size: sizePx, x: rec.cx, y: rec.cy });
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
      if (rec.kind === 'good' || rec.kind === 'gold'){
        onMiss('expire_good', { kind: rec.kind, group: rec.group });
        Particles.judgeText && Particles.judgeText('MISS');
        logEvent('miss_expire', { kind: rec.kind, group: rec.group });
      }
      removeTarget(rec);
    }
  }
}

// ---------- MISS/LIFE ----------
function onMiss(reason, extra = {}){
  S.combo = 0;
  setTxt(HUD.combo, S.combo);

  S.miss += 1;
  setTxt(HUD.miss, S.miss);

  setLives(S.lives - 1);
  updateGrade();

  logEvent('miss', { reason, ...extra });

  if (S.lives <= 0) endGame(true);
}
function punishBad(reason){
  S.combo = 0;
  setTxt(HUD.combo, S.combo);

  S.miss += 1;
  setTxt(HUD.miss, S.miss);

  addScore(reason === 'trap' ? -240 : -180);
  addFever(-14);

  Particles.judgeText && Particles.judgeText('BAD');
  AudioX.bad(); vibe(40);

  onMiss(reason, {});
}

// ---------- Hit rules ----------
function judgeFromDist(distPx, sizePx){
  const n = clamp(distPx / (sizePx * 0.55), 0, 1);
  return (n <= 0.38) ? 'PERFECT' : 'HIT';
}
function hitTarget(rec, direct){
  if (!S.running || S.paused) return;
  if (!rec || rec.dead) return;

  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const cx = vw/2, cy = vh/2;
  const off = viewOffset();
  const sx = rec.cx + off.x;
  const sy = rec.cy + off.y;
  const dist = Math.hypot(sx - cx, sy - cy);

  if (rec.kind === 'junk' || rec.kind === 'trap'){
    Particles.burstAt && Particles.burstAt(sx, sy, 'BAD');
    Particles.scorePop && Particles.scorePop(rec.kind==='trap' ? '-240' : '-180', sx, sy);
    punishBad(rec.kind);
    logEvent('hit', { kind: rec.kind, judge:'BAD', dist, direct:!!direct });
    if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit(rec, 'BAD');
    if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge('BAD');
    removeTarget(rec);
    setGoal(S.goalIndex);
    return;
  }

  const judge = judgeFromDist(dist, rec.size);
  const base = (rec.kind === 'gold') ? 520 : 240;
  const bonus = (judge === 'PERFECT') ? 220 : 0;
  const delta = Math.round(base + bonus);

  addScore(delta);
  addCombo();

  if (judge === 'PERFECT'){
    S.perfectCount += 1;
    setTxt(HUD.perfect, S.perfectCount);
    addFever(14);
    Particles.judgeText && Particles.judgeText('PERFECT');
    AudioX.perfect(); vibe(25);
  } else {
    addFever(8);
    Particles.judgeText && Particles.judgeText('GOOD');
    AudioX.good();
  }

  Particles.scorePop && Particles.scorePop(`+${delta}`, sx, sy);
  Particles.burstAt && Particles.burstAt(sx, sy, (rec.kind === 'gold') ? 'GOLD' : 'GOOD');

  if (rec.kind === 'good') onGood(rec.group);
  if (rec.kind === 'gold'){
    let g = 1 + ((rand()*5)|0);
    for (let k=0;k<5;k++){
      const gg = 1 + ((g-1+k)%5);
      if (!S.plateHave.has(gg)) { g = gg; break; }
    }
    onGood(g);
  }

  if (S.activeMini && typeof S.activeMini.onHit === 'function') S.activeMini.onHit(rec, judge);
  if (S.activeMini && typeof S.activeMini.onJudge === 'function') S.activeMini.onJudge(judge);

  if (S.activeGoal && S.activeGoal.key === 'perfect6' && checkGoalClear()) onGoalCleared();

  removeTarget(rec);
  updateGrade();
  setGoal(S.goalIndex);

  logEvent('hit', { kind: rec.kind, group: rec.group, judge, dist, direct: !!direct, delta });
}

// ---------- Spawn tick ----------
function spawnTick(){
  const t = now();
  if (t < S.nextSpawnAt) return;

  let interval = D.spawnMs;
  const burst = (DIFF === 'hard') ? (rand() < 0.12 ? 2 : 1) : 1;

  for (let i=0;i<burst;i++){
    const kind = decideKind();
    const group = (kind === 'good') ? decideGroup() : 0;
    makeTarget(kind, group);
  }

  const jitter = rnd(-60, 60);
  S.nextSpawnAt = t + Math.max(240, interval + jitter);
}

// ---------- Tap-anywhere shooting ----------
function isUIElement(target){
  if (!target) return false;
  return !!(target.closest && (target.closest('.btn') || target.closest('#hudRight') || target.closest('#resultBackdrop')));
}
function shootCrosshair(){
  if (!S.running || S.paused) return;
  AudioX.unlock();

  const assist = inVR() ? Math.max(D.aimAssist, 170) : D.aimAssist;
  const picked = pickNearCrosshair(assist);
  if (picked && picked.rec) hitTarget(picked.rec, false);
}
function onGlobalPointerDown(e){
  if (!S.running || S.paused) return;
  if (isUIElement(e.target)) return;
  e.preventDefault();
  shootCrosshair();
}

// ---------- Pause/Restart/VR ----------
function setPaused(on, meta='manual'){
  const was = S.paused;
  S.paused = !!on;

  // D5: pause accounting
  if (!was && S.paused){
    S.pauseWallAt = Date.now();
  } else if (was && !S.paused){
    if (S.pauseWallAt){
      S.pauseAccum += (Date.now() - S.pauseWallAt);
      S.pauseWallAt = 0;
    }
  }

  setShow(HUD.paused, S.paused);
  if (HUD.btnPause) HUD.btnPause.textContent = S.paused ? '▶️ RESUME' : '⏸️ PAUSE';
  if (was !== S.paused) logEvent('pause', { paused: S.paused, meta });
}
function enterVR(){
  if (!scene || !scene.enterVR) return;
  try { scene.enterVR(); } catch(_) {}
}

function restart(){
  for (const rec of [...S.targets]) removeTarget(rec);

  S.running = false;
  S.paused = false;

  S.tStart = 0;
  S.timeLeft = TOTAL_TIME;

  // D5 reset
  S.wallStart = 0;
  S.pauseAccum = 0;
  S.pauseWallAt = 0;

  S.score = 0; S.combo = 0; S.maxCombo = 0; S.miss = 0; S.perfectCount = 0;
  S.fever = 0; S.feverOn = false;

  S.goalsCleared = 0; S.minisCleared = 0;
  S.plateHave.clear();
  S.groupCounts = [0,0,0,0,0];

  setLives(S.livesMax);

  S.nextSpawnAt = now() + 350;
  S.lowTimeLastSec = null;
  doc.body.classList.remove('hha-mini-urgent');

  setTxt(HUD.score, 0); setTxt(HUD.combo, 0); setTxt(HUD.miss, 0);
  setTxt(HUD.perfect, 0); setTxt(HUD.have, `0/5`);
  if (HUD.feverBar) HUD.feverBar.style.width = `0%`;
  setTxt(HUD.feverPct, `0%`);

  updateGrade();
  setPaused(false, 'restart');
  setShow(HUD.resultBackdrop, false);

  setGoal(0);
  startMini();

  logSession('start');
  start();
}

function endGame(isGameOver){
  if (!S.running) return;
  S.running = false;
  doc.body.classList.remove('hha-mini-urgent');

  S.nextSpawnAt = Infinity;
  for (const rec of [...S.targets]) removeTarget(rec);

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
  vibe(isGameOver ? 60 : 45);
  logSession(isGameOver ? 'gameover' : 'end');
}

// ---------- D4: VR mode auto-reconnect (rebase targets) ----------
function rebaseTargetsForOffset(oldOff, newOff){
  if (!oldOff) oldOff = { x:0, y:0 };
  if (!newOff) newOff = { x:0, y:0 };
  const dx = (oldOff.x - newOff.x);
  const dy = (oldOff.y - newOff.y);
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

  for (const rec of S.targets){
    if (rec.dead) continue;
    // keep same screen position: cx' + newOff = cx + oldOff
    rec.cx = rec.cx + dx;
    rec.cy = rec.cy + dy;
    syncTargetCSS(rec);
  }
  logEvent('vr_rebase', { dx, dy, from: oldOff, to: newOff });
}

function bindVRReconnect(){
  if (!scene || !scene.addEventListener) return;

  const onEnter = ()=>{
    const oldOff = S._off || { x:0, y:0 };
    // event fires after vr-mode toggled; viewOffset() now returns new
    const newOff = viewOffset();
    rebaseTargetsForOffset(oldOff, newOff);
    applyLayerTransform();
    updateAimHighlight();
    tickHudBottomDodge();
    safeKickLoop('enter-vr');
  };

  const onExit = ()=>{
    const oldOff = S._off || { x:0, y:0 };
    const newOff = viewOffset();
    rebaseTargetsForOffset(oldOff, newOff);
    applyLayerTransform();
    updateAimHighlight();
    tickHudBottomDodge();
    safeKickLoop('exit-vr');
  };

  scene.addEventListener('enter-vr', onEnter);
  scene.addEventListener('exit-vr', onExit);

  // some devices trigger enter-vr/exit-vr late; also watch vrdisplaypresentchange
  doc.addEventListener('vrdisplaypresentchange', ()=>{
    const oldOff = S._off || { x:0, y:0 };
    const newOff = viewOffset();
    rebaseTargetsForOffset(oldOff, newOff);
    applyLayerTransform();
    safeKickLoop('vrdisplaypresentchange');
  }, { passive:true });
}

// ---------- C4: Visibility + Watchdog ----------
function setupVisibilityGuard(){
  try{
    doc.addEventListener('visibilitychange', ()=>{
      if (!S.running) return;
      if (doc.hidden){
        S.visPaused = true;
        setPaused(true, 'visibility');
      } else {
        if (S.visPaused){
          S.visPaused = false;
          setPaused(false, 'visibility');
          safeKickLoop('visibility-return');
        }
      }
    }, { passive:true });
  } catch(_){}
}

function safeKickLoop(reason){
  const dt = Date.now() - (S.lastTickWall || 0);
  if (!S.running) return;
  if (dt < 500) return;
  if (DEBUG) console.log('[PlateVR] kickLoop', reason, 'dt=', dt);
  S.lastTickWall = Date.now();
  try { startFrameOnce(); } catch(_) {}
}

function setupWatchdog(){
  if (S.watchdogId) clearInterval(S.watchdogId);
  S.watchdogId = setInterval(()=>{
    if (!S.running) return;
    const dt = Date.now() - (S.lastTickWall || 0);
    if (!doc.hidden && !S.paused && dt > 2200){
      logEvent('watchdog_kick', { dt });
      safeKickLoop('watchdog');
    }
  }, 900);
}

// ---------- Main loop ----------
function start(){
  S.running = true;

  // perf baseline for log
  S.tStart = now();

  // D5: wall baseline for timer
  S.wallStart = Date.now();
  S.pauseAccum = 0;
  S.pauseWallAt = 0;

  S.nextSpawnAt = now() + 350;

  ensurePills();
  setTxt(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));

  setupWatchdog();
  startFrameOnce();
}

function startFrameOnce(){
  if (!S.running) return;

  const frame = ()=>{
    if (!S.running) return;

    try{
      S.lastFrameAt = now();
      S.lastTickWall = Date.now();

      applyLayerTransform();
      updateAimHighlight();
      tickHudBottomDodge();

      if (!S.paused){
        const elapsed = elapsedSec();                 // D5
        S.timeLeft = Math.max(0, TOTAL_TIME - elapsed);
        setTxt(HUD.time, fmt(S.timeLeft));

        if (S.timeLeft <= 10){
          const sec = Math.ceil(S.timeLeft);
          if (sec !== S.lowTimeLastSec){
            S.lowTimeLastSec = sec;
            AudioX.tick();
          }
        } else {
          S.lowTimeLastSec = null;
        }

        spawnTick();
        expireTargets();
        tickMini();

        addFever(-0.10);

        setGoal(S.goalIndex);

        if (S.timeLeft <= 0){
          endGame(false);
          return;
        }
      }

    } catch(err){
      console.error('[PlateVR] frame error:', err);
      logEvent('frame_error', { msg: String(err && err.message || err), stack: String(err && err.stack || '') });
      setPaused(true, 'error');
      setTimeout(()=>{
        if (!S.running) return;
        setPaused(false, 'error-recover');
        safeKickLoop('error-recover');
      }, 180);
    }

    S.rafId = requestAnimationFrame(frame);
  };

  if (S.rafId) cancelAnimationFrame(S.rafId);
  S.rafId = requestAnimationFrame(frame);
}

// ---------- Bind UI ----------
function bindUI(){
  layer.addEventListener('pointerdown', onGlobalPointerDown, { passive:false });
  layer.addEventListener('touchstart', onGlobalPointerDown, { passive:false });
  layer.addEventListener('click', onGlobalPointerDown, { passive:false });

  if (HUD.btnEnterVR) HUD.btnEnterVR.addEventListener('click', enterVR);
  if (HUD.btnPause) HUD.btnPause.addEventListener('click', ()=>{
    if (!S.running) return;
    setPaused(!S.paused, 'manual');
  });
  if (HUD.btnRestart) HUD.btnRestart.addEventListener('click', ()=>{
    logEvent('restart', {});
    restart();
  });

  if (HUD.btnPlayAgain) HUD.btnPlayAgain.addEventListener('click', ()=>{
    setShow(HUD.resultBackdrop, false);
    restart();
  });

  if (HUD.resultBackdrop){
    HUD.resultBackdrop.addEventListener('click', (e)=>{
      if (e.target === HUD.resultBackdrop) setShow(HUD.resultBackdrop, false);
    });
  }

  doc.addEventListener('pointerdown', ()=>AudioX.unlock(), { passive:true });
  doc.addEventListener('touchstart', ()=>AudioX.unlock(), { passive:true });
}

// ---------- Boot ----------
(function boot(){
  try {
    if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.init === 'function'){
      ROOT.HHACloudLogger.init({ debug: DEBUG });
    }
  } catch(_) {}

  bindUI();
  setupVisibilityGuard();
  bindVRReconnect();        // D4

  setLives(S.livesMax);

  setTxt(HUD.mode, MODE === 'research' ? 'Research' : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));
  setTxt(HUD.have, `0/5`);
  updateGrade();

  setGoal(0);
  startMini();

  logSession('start');
  start();

  if (DEBUG) console.log('[PlateVR] boot', { MODE, DIFF, TOTAL_TIME, STRICT_RESEARCH, SEED_STR, seedU32:_seedU32 });
})();