// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (ALL-IN / ULTIMATE / Layout v2 + Research Protocol)
//
// ✅ Research Protocol lock: run=research&protocol=1&pid=...&seed=...
//   - บังคับมี pid (ไม่มี = บล็อกและไม่เริ่ม)
//   - ซ่อน Pause/Restart + ล็อก compact + ปิดการ toggle panel
//   - ใช้ RNG แบบ seed ใน protocol เพื่อให้สุ่มนิ่งเทียบกันได้
// ✅ FIX _forceXY รองรับ spawn ตำแหน่ง
// ✅ Logger ส่ง pid/seed/protocol ไปด้วย

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
const PROTOCOL_LOCK = STRICT_RESEARCH && (Q.get('protocol') === '1' || Q.get('protocol') === 'true');
const PID = String(Q.get('pid') || '').trim();          // participant id (required in protocol)
const SEED_STR = String(Q.get('seed') || PID || 'plate').trim(); // seed (optional but recommended)

const LIVES_PARAM = parseInt(Q.get('lives') || '', 10);
const LIVES_START = Number.isFinite(LIVES_PARAM) && LIVES_PARAM > 0 ? LIVES_PARAM : (STRICT_RESEARCH ? 3 : 3);

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

// ---------- Seeded RNG (for protocol) ----------
function xfnv1a(str){
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a){
  return function(){
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const _rng = (PROTOCOL_LOCK ? mulberry32(xfnv1a(SEED_STR)) : Math.random);
const R = ()=>_rng();
const rnd = (a,b)=>a + R()*(b-a);
const rint = (n)=>Math.floor(R()*n);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const now = ()=>performance.now();
const fmt = (n)=>String(Math.max(0, Math.floor(n)));
function $(id){ return doc.getElementById(id); }
function setTxt(el, t){ if(el) el.textContent = String(t); }
function setShow(el, on){ if(!el) return; el.style.display = on ? '' : 'none'; }
function intersect(a,b){ return !(a.x+a.w < b.x || b.x+b.w < a.x || a.y+a.h < b.y || b.y+b.h < a.y); }

// ---------- Block overlay (pid required in protocol) ----------
function protocolBlock(message){
  const wrap = doc.createElement('div');
  wrap.style.cssText = `
    position:fixed; inset:0; z-index:5000; display:flex; align-items:center; justify-content:center;
    background:rgba(2,6,23,.86); backdrop-filter:blur(10px); padding:18px;`;
  const card = doc.createElement('div');
  card.style.cssText = `
    max-width:720px; width:100%;
    background:rgba(2,6,23,.92);
    border:1px solid rgba(148,163,184,.22);
    border-radius:22px;
    padding:16px;
    box-shadow:0 18px 46px rgba(0,0,0,.55);
    color:#e5e7eb;`;
  card.innerHTML = `
    <div style="font-weight:1000; font-size:18px; margin-bottom:10px;">🧪 Research Protocol</div>
    <div style="color:rgba(229,231,235,.80); font-weight:900; line-height:1.35;">
      ${message}
    </div>
    <div style="margin-top:10px; font-size:13px; color:rgba(229,231,235,.65); font-weight:900;">
      ตัวอย่างลิงก์: <span style="opacity:.9">?run=research&protocol=1&pid=STU001&seed=STU001&diff=easy&time=90</span>
    </div>`;
  wrap.appendChild(card);
  doc.body.appendChild(wrap);
}

// ---------- If protocol lock requires pid ----------
if (PROTOCOL_LOCK && !PID){
  // บล็อกก่อนจะเริ่มอะไร
  doc.addEventListener('DOMContentLoaded', ()=>protocolBlock('กรุณาใส่พารามิเตอร์ <b>pid</b> ในลิงก์ เพื่อเริ่มเก็บข้อมูล (ระบบจะไม่เริ่มเกมหากไม่มี pid)'));
}

// ---------- HUD ----------
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

const scene = doc.querySelector('a-scene');
const cam = doc.querySelector('#cam');

function inVR(){
  try { return !!(scene && scene.is && scene.is('vr-mode')); } catch(_) { return false; }
}

// ---------- Difficulty ----------
const DIFF_TABLE = {
  easy:   { size:92, life:3200, spawnMs:900, junkRate:0.18, goldRate:0.10, trapRate:0.045, bossRate:0.020, fakeRate:0.020, slowRate:0.045, noJunkRate:0.020, stormRate:0.020, aimAssist:160, bossHP:3, bossAtkMs:[2600,3400], bossPhase2At:0.45, bossPhase3At:0.22, stormDurMs:[4200,6500], slowDurMs:[3200,5200], noJunkDurMs:[4200,6200] },
  normal: { size:78, life:2700, spawnMs:780, junkRate:0.24, goldRate:0.12, trapRate:0.070, bossRate:0.028, fakeRate:0.040, slowRate:0.055, noJunkRate:0.028, stormRate:0.030, aimAssist:135, bossHP:4, bossAtkMs:[2200,3000], bossPhase2At:0.50, bossPhase3At:0.25, stormDurMs:[4200,7200], slowDurMs:[3200,5600], noJunkDurMs:[4200,6800] },
  hard:   { size:66, life:2300, spawnMs:660, junkRate:0.30, goldRate:0.14, trapRate:0.095, bossRate:0.036, fakeRate:0.070, slowRate:0.060, noJunkRate:0.026, stormRate:0.040, aimAssist:125, bossHP:5, bossAtkMs:[1850,2650], bossPhase2At:0.55, bossPhase3At:0.28, stormDurMs:[4800,8200], slowDurMs:[3200,5800], noJunkDurMs:[4200,7200] },
};
const BASE = DIFF_TABLE[DIFF] || DIFF_TABLE.normal;
const D = JSON.parse(JSON.stringify(BASE));

// Strict research: ตัดตัวแปรแทรกซ้อน
if (STRICT_RESEARCH){
  D.bossRate = 0; D.slowRate = 0; D.noJunkRate = 0; D.stormRate = 0; D.fakeRate = 0;
  D.trapRate = Math.min(D.trapRate, 0.06);
}

// ---------- State ----------
const S = {
  running:false, paused:false,
  tStart:0, timeLeft:TOTAL_TIME,
  score:0, combo:0, maxCombo:0, miss:0, perfectCount:0,
  fever:0, feverOn:false,
  shield:0, shieldMax:1,
  lives:LIVES_START, livesMax:Math.max(1, LIVES_START),
  goalsCleared:0, goalsTotal:2,
  minisCleared:0, minisTotal:7,
  plateHave:new Set(),
  groupsTotal:5,
  groupCounts:[0,0,0,0,0],
  nextSpawnAt:0,
  goalIndex:0, activeGoal:null, activeMini:null,
  miniEndsAt:0, miniUrgentArmed:false, miniTickAt:0,
  targets:[], aimedId:null,
  bossNextAt:0, bossActive:false,
  stormUntil:0, slowUntil:0, noJunkUntil:0,
  lowTimeLastSec:null,
  perfectZoneOn:false,
  sessionId:`PLATE-${Date.now()}-${Math.random().toString(16).slice(2)}`,
};

// ---------- Layout boot ----------
(function layoutBoot(){
  doc.body.classList.add('hha-compact');
  if (STRICT_RESEARCH) doc.body.classList.add('hha-research');

  // protocol lock: ห้าม toggle
  if (!STRICT_RESEARCH || (STRICT_RESEARCH && !PROTOCOL_LOCK)){
    const qp = doc.getElementById('questPanel');
    const mp = doc.getElementById('miniPanel');
    const toggle = ()=> doc.body.classList.toggle('hha-compact');
    if (qp) qp.addEventListener('click', toggle);
    if (mp) mp.addEventListener('click', toggle);
  } else {
    doc.body.classList.add('hha-compact');
  }
})();

// ---------- Camera view offset ----------
function getCamAngles(){
  const r = cam && cam.object3D ? cam.object3D.rotation : null;
  if (!r) return { yaw:0, pitch:0 };
  return { yaw:r.y || 0, pitch:r.x || 0 };
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

// ---------- Inject CSS targets & overlays (เหมือนเวอร์ชันก่อน) ----------
(function injectCss(){
  const st = doc.createElement('style');
  st.textContent = `
  .plate-layer{ position:fixed; inset:0; z-index:400; pointer-events:auto; touch-action:none; transform:translate3d(0,0,0); will-change:transform; }
  .plateTarget{
    position:absolute; width:var(--sz,80px); height:var(--sz,80px);
    left:0; top:0;
    transform:translate3d(var(--x,0px), var(--y,0px), 0) scale(var(--sc,1));
    transform-origin:center; border-radius:999px;
    pointer-events:auto; touch-action:manipulation; user-select:none;
    display:grid; place-items:center; font-weight:1000;
    box-shadow:0 18px 46px rgba(0,0,0,.35);
    backdrop-filter: blur(8px);
  }
  .plateTarget::before{ content:''; position:absolute; inset:-2px; border-radius:inherit; opacity:.95; pointer-events:none; }
  .plateTarget.good{ background:rgba(34,197,94,.16); border:1px solid rgba(34,197,94,.35); }
  .plateTarget.good::before{ border:3px solid rgba(34,197,94,.75); box-shadow:0 0 0 8px rgba(34,197,94,.12), 0 0 40px rgba(34,197,94,.18); }
  .plateTarget.junk{ background:rgba(251,113,133,.14); border:1px solid rgba(251,113,133,.35); }
  .plateTarget.junk::before{ border:3px solid rgba(251,113,133,.75); box-shadow:0 0 0 8px rgba(251,113,133,.10), 0 0 40px rgba(251,113,133,.16); }
  .plateTarget.gold{ background:rgba(250,204,21,.14); border:1px solid rgba(250,204,21,.42); }
  .plateTarget.gold::before{ border:3px solid rgba(250,204,21,.85); box-shadow:0 0 0 10px rgba(250,204,21,.12), 0 0 54px rgba(250,204,21,.18); }
  .plateTarget.trap{ background:rgba(147,51,234,.12); border:1px solid rgba(147,51,234,.38); }
  .plateTarget.trap::before{ border:3px solid rgba(147,51,234,.70); box-shadow:0 0 0 10px rgba(147,51,234,.12), 0 0 60px rgba(147,51,234,.14); }
  .plateTarget .emoji{
    font-size:calc(var(--sz,80px) * 0.52); line-height:1;
    filter: drop-shadow(0 10px 18px rgba(0,0,0,.28));
  }
  .plateTarget .tag{
    position:absolute; bottom:-10px; left:50%; transform:translateX(-50%);
    font-size:12px; font-weight:1000; padding:4px 10px; border-radius:999px;
    background:rgba(2,6,23,.72);
    border:1px solid rgba(148,163,184,.20); color:#e5e7eb; white-space:nowrap;
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
  body.hha-research #tipPanel{ display:none; }
  `;
  doc.head.appendChild(st);
})();

// ---------- Layer ----------
const layer = doc.createElement('div');
layer.className = 'plate-layer';
doc.body.appendChild(layer);

function applyLayerTransform(){
  const off = viewOffset();
  layer.style.transform = `translate3d(${off.x}px, ${off.y}px, 0)`;
}

// ---------- Safezone ----------
function getBlockedRects(){
  const rects = [];
  const ids = ['hudTop','hudLeft','hudRight','hudBottom'];
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
  const blocked = getBlockedRects();
  const tries = 70;
  const off = viewOffset();

  for (let i=0;i<tries;i++){
    const sx = rnd(m+half, vw-m-half);
    const sy = rnd(m+half+60, vh-m-half-60);
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

// ---------- Content ----------
const FOOD_BY_GROUP = {
  1: ['🍗','🥩','🐟','🍳','🥛','🧀','🥜'],
  2: ['🍚','🍞','🥔','🌽','🥨','🍜','🍙'],
  3: ['🥦','🥕','🥬','🥒','🌶️','🍅'],
  4: ['🍎','🍌','🍊','🍉','🍍','🍇'],
  5: ['🥑','🧈','🫒','🥥','🧀'],
};
const JUNK = ['🍩','🍟','🍔','🍕','🧋','🍭','🍫','🥤'];
const TRAPS = ['🎁','⭐','🍬','🍰','🧁'];
function randFrom(arr){ return arr[rint(arr.length)]; }

// ---------- Logger ----------
function dispatchEvt(name, detail){
  try { ROOT.dispatchEvent(new CustomEvent(name, { detail })); } catch(_) {}
}
function logSession(phase){
  dispatchEvt('hha:log_session', {
    sessionId: S.sessionId,
    game:'PlateVR',
    phase,
    pid: PID || null,
    seed: SEED_STR || null,
    protocol: PROTOCOL_LOCK ? 1 : 0,
    mode: MODE,
    diff: DIFF,
    strict: STRICT_RESEARCH ? 1 : 0,
    timeTotal: TOTAL_TIME,
    lives: S.livesMax,
    ts: Date.now(),
    ua: navigator.userAgent,

    score: S.score,
    maxCombo: S.maxCombo,
    miss: S.miss,
    perfect: S.perfectCount,
    goalsCleared: S.goalsCleared,
    minisCleared: S.minisCleared,
    g1: S.groupCounts[0], g2: S.groupCounts[1], g3: S.groupCounts[2], g4: S.groupCounts[3], g5: S.groupCounts[4],
  });
}
function logEvent(type, data){
  dispatchEvt('hha:log_event', {
    sessionId: S.sessionId,
    game:'PlateVR',
    pid: PID || null,
    seed: SEED_STR || null,
    protocol: PROTOCOL_LOCK ? 1 : 0,
    type,
    t: Math.round((now() - S.tStart) || 0),
    score: S.score,
    combo: S.combo,
    miss: S.miss,
    perfect: S.perfectCount,
    fever: Math.round(S.fever),
    lives: S.lives,
    strict: STRICT_RESEARCH ? 1 : 0,
    data: data || {},
  });
}

// ---------- HUD update ----------
function addScore(d){ S.score += d; setTxt(HUD.score, S.score); }
function addCombo(){ S.combo += 1; S.maxCombo = Math.max(S.maxCombo, S.combo); setTxt(HUD.combo, S.combo); }
function updateGrade(){
  const metric = S.score + S.perfectCount*120 + S.maxCombo*35 - S.miss*260 - (S.livesMax - S.lives)*180;
  const g = metric >= 8200 ? 'SSS' : metric >= 6200 ? 'SS' : metric >= 4600 ? 'S' : metric >= 3000 ? 'A' : metric >= 1700 ? 'B' : 'C';
  setTxt(HUD.grade, g);
}
function addFever(v){
  S.fever = clamp(S.fever + v, 0, 100);
  const pct = Math.round(S.fever);
  if (HUD.feverBar) HUD.feverBar.style.width = `${pct}%`;
  setTxt(HUD.feverPct, `${pct}%`);
  // research protocol: fever แสดงผลอย่างเดียว ไม่ปล่อย power/boss อยู่แล้ว
}

// ---------- Goals/Mini (คงเดิมแบบก่อน แต่ย่อให้สั้นในโปรโตคอลก็ได้) ----------
const GOALS = [
  { key:'plates2', title:'🍽️ เคลียร์ “จานสมดุล” ให้ได้ 2 ใบ', target:2 },
  { key:'perfect6', title:'⭐ ทำ PERFECT ให้ได้ 6 ครั้ง', target:6 },
];
const MINIS = [
  { key:'plateRush', title:'Plate Rush (8s)', hint:'ทำจานครบ 5 หมู่ภายใน 8 วิ • ห้ามโดนขยะระหว่างทำ', dur:8000,
    init(){ S._mini = { gotGroups:new Set(), fail:false, madePlate:false }; },
    onHit(rec){ if (rec.kind==='junk'||rec.kind==='trap') S._mini.fail=true; if(rec.kind==='good') S._mini.gotGroups.add(rec.group); if(S._mini.gotGroups.size>=5) S._mini.madePlate=true; },
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
    onHit(rec){ if(rec.kind==='junk'||rec.kind==='trap') S._mini.fail=true; if(rec.kind==='good') S._mini.good++; if(rec.kind==='gold') S._mini.good++; },
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
  logEvent('goal_clear', { goal: S.activeGoal && S.activeGoal.key });
  if (S.goalIndex+1 < GOALS.length) setGoal(S.goalIndex+1);
}

function startMini(){
  const idx = S.minisCleared % MINIS.length;
  const mini = MINIS[idx];
  S.activeMini = mini;
  S.miniEndsAt = now() + mini.dur;
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
  if (leftMs <= 0){
    const cleared = (typeof m.isClear === 'function') ? !!m.isClear() : false;
    if (cleared){
      S.minisCleared += 1;
      addScore(450);
      addFever(18);
      logEvent('mini_clear', { mini: m.key });
    } else {
      addScore(-120);
      addFever(-12);
      logEvent('mini_fail', { mini: m.key });
    }
    startMini();
  } else {
    updateMiniHud();
  }
}

// ---------- Aim / shoot ----------
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
  if (picked && picked.rec && picked.rec.el && !STRICT_RESEARCH) picked.rec.el.classList.add('aimed');
}

function isUIElement(target){
  if (!target) return false;
  return !!(target.closest && (target.closest('.btn') || target.closest('#hudRight') || target.closest('#resultBackdrop')));
}
function shootCrosshair(){
  if (!S.running || S.paused) return;
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

// ---------- Target spawn ----------
let targetSeq = 0;
function computeSizePx(kind){
  const vw = ROOT.innerWidth, vh = ROOT.innerHeight;
  const base = D.size;
  const scale = clamp(Math.min(vw, vh) / 820, 0.86, 1.12);
  let sz = clamp(base * scale, 52, 118);
  if (kind === 'gold') sz = clamp(sz * 1.05, 56, 128);
  return sz;
}
function decideGroup(){ return 1 + rint(5); }

function decideKind(){
  // protocol/research: คงที่ (ไม่มี power/boss/fake)
  if (STRICT_RESEARCH){
    const gold = clamp(D.goldRate, 0.06, 0.22);
    const junk = clamp(D.junkRate, 0.08, 0.40);
    const trap = clamp(D.trapRate, 0.02, 0.22);
    const r = R();
    let acc = 0;
    acc += gold; if (r < acc) return 'gold';
    acc += junk; if (r < acc) return 'junk';
    acc += trap; if (r < acc) return 'trap';
    return 'good';
  }
  // play: (เอาง่าย) สุ่มแบบเดิม
  const r = Math.random();
  let acc = 0;
  acc += D.goldRate; if (r < acc) return 'gold';
  acc += D.junkRate; if (r < acc) return 'junk';
  acc += D.trapRate; if (r < acc) return 'trap';
  return 'good';
}

function makeTarget(kind, group, opts = {}){
  const sizePx = computeSizePx(kind);

  let pos = null;
  if (opts && opts._forceXY && typeof opts._forceXY.x === 'number' && typeof opts._forceXY.y === 'number'){
    pos = { x: opts._forceXY.x, y: opts._forceXY.y };
  } else {
    pos = pickSafeXY(sizePx);
  }

  const el = doc.createElement('div');
  el.className = `plateTarget ${kind} spawn`;
  el.dataset.tid = String(++targetSeq);

  const sc = 0.92 + (PROTOCOL_LOCK ? R()*0.22 : Math.random()*0.22);
  el.style.setProperty('--sz', `${sizePx}px`);
  el.style.setProperty('--x', `${(pos.x - sizePx/2)}px`);
  el.style.setProperty('--y', `${(pos.y - sizePx/2)}px`);
  el.style.setProperty('--sc', `${sc}`);

  let emoji = '🍽️';
  let tag = '';

  if (kind === 'junk'){ emoji = randFrom(JUNK); tag = 'JUNK'; }
  else if (kind === 'gold'){ emoji = '⭐'; tag = 'GOLD'; }
  else if (kind === 'trap'){ emoji = randFrom(TRAPS); tag = 'TRAP'; }
  else { emoji = randFrom(FOOD_BY_GROUP[group] || ['🥗']); tag = `G${group}`; }

  el.innerHTML = `<div class="emoji">${emoji}</div>${tag ? `<div class="tag">${tag}</div>` : ``}`;

  const bornAt = now();
  const dieAt = bornAt + D.life;

  const rec = { el, kind, group, bornAt, dieAt, cx: pos.x, cy: pos.y, size: sizePx, dead:false };
  S.targets.push(rec);

  const hitHandler = (e)=>{ e.preventDefault(); e.stopPropagation(); hitTarget(rec, true); };
  el.addEventListener('pointerdown', hitHandler, { passive:false });
  el.addEventListener('click', hitHandler, { passive:false });
  el.addEventListener('touchstart', hitHandler, { passive:false });

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
      // good/gold หมดอายุถือว่า miss
      if (rec.kind === 'good' || rec.kind === 'gold'){
        S.combo = 0; setTxt(HUD.combo, 0);
        S.miss += 1; setTxt(HUD.miss, S.miss);
        S.lives = Math.max(0, S.lives - 1);
        updateGrade();
        logEvent('miss_expire', { kind: rec.kind, group: rec.group });
        if (S.lives <= 0) endGame(true);
      }
      removeTarget(rec);
    }
  }
}

// ---------- Hit logic ----------
function judgeFromDist(distPx, sizePx){
  const n = clamp(distPx / (sizePx * 0.55), 0, 1);
  return (n <= 0.38) ? 'PERFECT' : 'HIT';
}
function onGood(group){
  if (group >= 1 && group <= 5){
    S.plateHave.add(group);
    S.groupCounts[group-1] += 1;
  }
  setTxt(HUD.have, `${S.plateHave.size}/${S.groupsTotal}`);

  if (S.plateHave.size >= 5){
    S.goalsCleared += 1;
    S.plateHave.clear();
    setTxt(HUD.have, `0/5`);
    logEvent('plate_complete', { plates: S.goalsCleared });

    setGoal(S.goalIndex);
    if (S.activeGoal && S.activeGoal.key === 'plates2' && checkGoalClear()){
      onGoalCleared();
    }
  }
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
    S.combo = 0; setTxt(HUD.combo, 0);
    S.miss += 1; setTxt(HUD.miss, S.miss);
    S.lives = Math.max(0, S.lives - 1);
    addScore(rec.kind === 'trap' ? -240 : -180);
    addFever(-16);
    updateGrade();
    logEvent('hit_bad', { kind: rec.kind, dist, direct:!!direct });
    if (S.activeMini && S.activeMini.onHit) S.activeMini.onHit(rec, 'BAD');
    if (S.lives <= 0) endGame(true);
    removeTarget(rec);
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
  } else {
    addFever(8);
  }

  if (rec.kind === 'good') onGood(rec.group);
  if (rec.kind === 'gold'){
    // gold เติมหมู่แบบสุ่ม
    let g = 1 + rint(5);
    for (let k=0;k<5;k++){
      const gg = 1 + ((g-1+k)%5);
      if (!S.plateHave.has(gg)) { g = gg; break; }
    }
    onGood(g);
  }

  if (S.activeMini && S.activeMini.onHit) S.activeMini.onHit(rec, judge);
  if (S.activeMini && S.activeMini.onJudge) S.activeMini.onJudge(judge);

  if (S.activeGoal && S.activeGoal.key === 'perfect6'){
    if (checkGoalClear()) onGoalCleared();
  }

  updateGrade();
  setGoal(S.goalIndex);
  logEvent('hit_good', { kind: rec.kind, group: rec.group, judge, dist, direct:!!direct, delta });

  removeTarget(rec);
}

// ---------- Spawn loop ----------
function spawnTick(){
  const t = now();
  if (t < S.nextSpawnAt) return;

  const interval = D.spawnMs; // research/protocol คงที่
  const burst = 1;            // research/protocol คงที่

  for (let i=0;i<burst;i++){
    const kind = decideKind();
    const group = (kind === 'good') ? decideGroup() : 0;
    makeTarget(kind, group);
  }

  S.nextSpawnAt = t + Math.max(240, interval); // no jitter in protocol
}

function start(){
  S.running = true;
  S.tStart = now();
  S.nextSpawnAt = now() + 350;

  setTxt(HUD.mode, STRICT_RESEARCH ? (PROTOCOL_LOCK ? 'Research-P' : 'Research') : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));
  setTxt(HUD.have, `0/5`);
  setTxt(HUD.score, 0);
  setTxt(HUD.combo, 0);
  setTxt(HUD.miss, 0);
  setTxt(HUD.perfect, 0);
  if (HUD.feverBar) HUD.feverBar.style.width = `0%`;
  setTxt(HUD.feverPct, `0%`);
  updateGrade();

  setGoal(0);
  startMini();

  logSession('start');

  function frame(){
    if (!S.running) return;

    applyLayerTransform();
    updateAimHighlight();

    if (!S.paused){
      const elapsed = (now() - S.tStart) / 1000;
      S.timeLeft = Math.max(0, TOTAL_TIME - elapsed);
      setTxt(HUD.time, fmt(S.timeLeft));

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
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function endGame(isGameOver){
  if (!S.running) return;
  S.running = false;

  // remove targets
  for (const rec of [...S.targets]) removeTarget(rec);

  setTxt(HUD.rMode, STRICT_RESEARCH ? (PROTOCOL_LOCK ? 'Research-P' : 'Research') : 'Play');
  // grade
  const metric = S.score + S.perfectCount*120 + S.maxCombo*35 - S.miss*260 - (S.livesMax - S.lives)*180;
  const g = metric >= 8200 ? 'SSS' : metric >= 6200 ? 'SS' : metric >= 4600 ? 'S' : metric >= 3000 ? 'A' : metric >= 1700 ? 'B' : 'C';
  setTxt(HUD.rGrade, g);

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

  logSession(isGameOver ? 'gameover' : 'end');
}

function setPaused(on){
  S.paused = !!on;
  setShow(HUD.paused, S.paused);
  if (HUD.btnPause) HUD.btnPause.textContent = S.paused ? '▶️' : '⏸️';
}

// ---------- Bind UI ----------
function bindUI(){
  layer.addEventListener('pointerdown', onGlobalPointerDown, { passive:false });
  layer.addEventListener('touchstart', onGlobalPointerDown, { passive:false });
  layer.addEventListener('click', onGlobalPointerDown, { passive:false });

  if (HUD.btnEnterVR) HUD.btnEnterVR.addEventListener('click', ()=>{
    if (scene && scene.enterVR) { try { scene.enterVR(); } catch(_) {} }
  });

  // protocol lock: disable pause/restart
  if (PROTOCOL_LOCK){
    if (HUD.btnPause) { HUD.btnPause.style.display = 'none'; }
    if (HUD.btnRestart) { HUD.btnRestart.style.display = 'none'; }
  } else {
    if (HUD.btnPause) HUD.btnPause.addEventListener('click', ()=>{
      if (!S.running) return;
      setPaused(!S.paused);
      logEvent('pause', { paused: S.paused });
    });
    if (HUD.btnRestart) HUD.btnRestart.addEventListener('click', ()=>{
      location.reload();
    });
  }

  if (HUD.btnPlayAgain) HUD.btnPlayAgain.addEventListener('click', ()=>{
    // protocol lock: กัน “เล่นซ้ำ” อัตโนมัติ (ให้ครูคุมลิงก์)
    if (PROTOCOL_LOCK){
      setShow(HUD.resultBackdrop, false);
      return;
    }
    location.reload();
  });

  // protocol lock: ไม่ให้แตะพื้นหลังเพื่อปิดสรุป (กันกดยุ่ง)
  if (!PROTOCOL_LOCK && HUD.resultBackdrop){
    HUD.resultBackdrop.addEventListener('click', (e)=>{
      if (e.target === HUD.resultBackdrop) setShow(HUD.resultBackdrop, false);
    });
  }
}

// ---------- Boot ----------
(function boot(){
  // init cloud logger
  try {
    if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.init === 'function'){
      ROOT.HHACloudLogger.init({ debug: DEBUG });
    }
  } catch(_) {}

  bindUI();

  // set labels
  setTxt(HUD.mode, STRICT_RESEARCH ? (PROTOCOL_LOCK ? 'Research-P' : 'Research') : 'Play');
  setTxt(HUD.diff, DIFF[0].toUpperCase()+DIFF.slice(1));

  // protocol pid requirement
  if (PROTOCOL_LOCK && !PID){
    // อย่าเริ่มเกม
    if (DEBUG) console.warn('[PlateVR] protocol lock requires pid');
    return;
  }

  logEvent('boot', { pid: PID || null, protocol: PROTOCOL_LOCK ? 1 : 0, seed: SEED_STR || null });

  start();

  if (DEBUG) console.log('[PlateVR] boot ok', { MODE, DIFF, TOTAL_TIME, STRICT_RESEARCH, PROTOCOL_LOCK, PID, SEED_STR });
})();