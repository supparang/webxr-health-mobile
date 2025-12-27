/* === /herohealth/hydration-vr/hydration.safe.js ===
HydrationVR — PRODUCTION PATCH (P0+P1) + (1-3) + “สุดกว่าเดิม”
(1) Spawn กระจายจริง + anti-repeat cell + safe-zone + ไม่ทับ HUD/ขอบ
(2) Crosshair shoot: weighted-nearest + range gate (แม่น/ยุติธรรม)
(3) Long-press ~0.35s = Raise Shield (สถานะสั้นๆ) + FX/Stamp + ช่วยทำ mini timing

- Orb identity: GOOD(blue) / BAD(red) / SHIELD(violet)
- Water gauge: regression-to-mean + correct expire rules (no phantom +100)
- Goal: count time-in-GREEN reliably
- Storm cinematic: warn pre-roll + tick accel + thunder + flash + shake (beep/tick/thunder only)
- Storm mini: Shield Timing (block BAD in end-window) + clear checklist UI + pressure bar
- FX on hit: Particles (if available) + fallback DOM burst
- End summary: correct minis totals + save HHA_LAST_SUMMARY + Back to HUB button (inject)
*/

'use strict';

// ------------------------- helpers -------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v); if(!Number.isFinite(v)) v = 0; return Math.max(a, Math.min(b, v)); }
function now(){ return performance.now(); }
function qs(){ return new URLSearchParams(location.search); }
function pick(q, k, d){ const v = q.get(k); return (v==null || v==='') ? d : v; }
function int(v, d=0){ v = Number(v); return Number.isFinite(v) ? (v|0) : d; }
function num(v, d=0){ v = Number(v); return Number.isFinite(v) ? v : d; }
function $(id){ return DOC.getElementById(id); }
function safeText(el, s){ if(el) el.textContent = String(s ?? ''); }
function safeClass(el, cls, on){ if(!el) return; el.classList.toggle(cls, !!on); }

// ------------------------- seeded RNG (deterministic-ish) -------------------------
function makeRng(seed){
  let s = (seed >>> 0) || 0x12345678;
  return function rng(){
    s = (1664525 * s + 1013904223) >>> 0;
    return (s / 4294967296);
  };
}
function hashStrToU32(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// ------------------------- audio (beep/tick/thunder only) -------------------------
const AudioFX = (() => {
  let ctx = null;
  function ensure(){
    if (ctx) return ctx;
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function tone(type, freq, dur, gain){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.0001;

    o.connect(g);
    g.connect(c.destination);

    const t0 = c.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain || 0.05), t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.08));

    o.start(t0);
    o.stop(t0 + (dur || 0.08) + 0.02);
  }
  function beep(){ tone('sine', 780, 0.07, 0.06); }
  function tick(){ tone('square', 1200, 0.035, 0.035); }
  function thunder(){
    const c = ensure(); if(!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(80, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(38, c.currentTime + 0.7);
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, c.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.85);
    o.connect(g); g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.9);
  }
  function resume(){
    const c = ensure(); if(!c) return;
    if (c.state === 'suspended') c.resume().catch(()=>{});
  }
  return { resume, beep, tick, thunder };
})();

// ------------------------- Particles (optional) -------------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){}, judgeText(){} };

// ------------------------- DOM targets (orb) -------------------------
function ensureCrosshair(playfield){
  // HTML มี #crosshair แล้ว แต่กันไว้ถ้าไม่มี
  let ch = DOC.getElementById('crosshair');
  if (ch) return ch;
  ch = DOC.createElement('div');
  ch.id = 'crosshair';
  Object.assign(ch.style, {
    position:'absolute',
    left:'50%', top:'50%',
    width:'22px', height:'22px',
    transform:'translate(-50%,-50%)',
    borderRadius:'999px',
    border:'2px solid rgba(226,232,240,.55)',
    boxShadow:'0 0 0 6px rgba(34,211,238,.10), 0 0 22px rgba(34,211,238,.14)',
    pointerEvents:'none',
    zIndex:'5'
  });
  playfield.appendChild(ch);
  return ch;
}

function makeOrbEl(kind){
  const el = DOC.createElement('div');
  el.className = 'hvr-orb hvr-' + kind;
  const base = {
    position:'absolute',
    width:'86px', height:'86px',
    borderRadius:'999px',
    pointerEvents:'auto',
    transform:'translate(-50%,-50%)',
    zIndex:'6',
    boxShadow:'0 16px 50px rgba(0,0,0,.35)',
    willChange:'transform, left, top, filter, opacity'
  };
  Object.assign(el.style, base);

  const skin = DOC.createElement('div');
  skin.className = 'skin';
  Object.assign(skin.style, {
    position:'absolute', inset:'0',
    borderRadius:'999px',
    border:'1px solid rgba(226,232,240,.18)',
    overflow:'hidden'
  });

  let g1, g2, glow;
  if (kind === 'good'){
    g1 = 'rgba(34,211,238,.92)';
    g2 = 'rgba(59,130,246,.82)';
    glow = 'rgba(34,211,238,.22)';
  } else if (kind === 'bad'){
    g1 = 'rgba(239,68,68,.90)';
    g2 = 'rgba(249,115,22,.80)';
    glow = 'rgba(239,68,68,.20)';
  } else {
    g1 = 'rgba(167,139,250,.92)';
    g2 = 'rgba(34,211,238,.55)';
    glow = 'rgba(167,139,250,.18)';
  }

  skin.style.background =
    `radial-gradient(28px 28px at 30% 30%, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 60%),
     radial-gradient(90px 90px at 40% 35%, ${g1} 0%, ${g2} 62%, rgba(2,6,23,.25) 100%)`;
  skin.style.boxShadow = `inset 0 0 0 1px rgba(255,255,255,.08), 0 0 22px ${glow}`;

  const icon = DOC.createElement('div');
  icon.className = 'icon';
  Object.assign(icon.style, {
    position:'absolute', left:'50%', top:'110%',
    transform:'translate(-50%,-50%)',
    width:'34px', height:'34px',
    borderRadius:'14px',
    background:'rgba(2,6,23,.55)',
    border:'1px solid rgba(148,163,184,.16)',
    display:'flex', alignItems:'center', justifyContent:'center',
    fontSize:'18px',
    boxShadow:'0 16px 40px rgba(0,0,0,.35)'
  });
  icon.textContent = (kind === 'good') ? '💧' : (kind === 'bad') ? '☠️' : '🛡️';

  el.appendChild(skin);
  el.appendChild(icon);
  return el;
}

// fallback burst (if particles not visible)
function fallbackBurst(x, y, kind){
  const layer = DOC.querySelector('.hha-fx-layer') || DOC.body;
  const p = DOC.createElement('div');
  const r = (kind === 'bad') ? 'rgba(239,68,68,.55)' : (kind === 'shield') ? 'rgba(167,139,250,.45)' : 'rgba(34,211,238,.45)';
  Object.assign(p.style, {
    position:'fixed',
    left: `${x}px`, top:`${y}px`,
    width:'10px', height:'10px',
    borderRadius:'999px',
    transform:'translate(-50%,-50%)',
    boxShadow:`0 0 0 0 ${r}`,
    border:`1px solid rgba(255,255,255,.12)`,
    pointerEvents:'none',
    zIndex:'9999',
    opacity:'1'
  });
  layer.appendChild(p);
  const t0 = now();
  const dur = 420;
  (function anim(){
    const t = now() - t0;
    const k = clamp(t/dur, 0, 1);
    const s = 1 + 7*k;
    p.style.transform = `translate(-50%,-50%) scale(${s})`;
    p.style.opacity = String(1 - k);
    p.style.boxShadow = `0 0 0 ${Math.round(40*k)}px ${r}`;
    if (k < 1) requestAnimationFrame(anim);
    else p.remove();
  })();
}
function burstAtClient(x, y, kind){
  try{ Particles.burstAt?.(x, y, kind); }catch(_){}
  fallbackBurst(x, y, kind);
}

// ------------------------- game constants -------------------------
const Q = qs();
const RUN = String(pick(Q, 'run', pick(Q,'runMode','play'))).toLowerCase(); // play|study
const DIFF = String(pick(Q, 'diff', 'normal')).toLowerCase();              // easy|normal|hard
const HUB  = String(pick(Q, 'hub', './hub.html'));
const DUR_SEC = clamp(num(pick(Q,'time', pick(Q,'durationPlannedSec', 70)), 70), 20, 180);

const sessionId = String(pick(Q,'sessionId', ''));
const seedParam = pick(Q,'seed', '');
const seed = (seedParam !== '') ? (hashStrToU32(seedParam)) : (sessionId ? hashStrToU32(sessionId) : hashStrToU32(String(Date.now())));
const rng = makeRng(seed);

// difficulty tuning
const TUNE = (() => {
  const base = {
    maxTargets: 2,
    spawnEveryMs: 850,
    ttlGoodMs: 2200,
    ttlBadMs: 2600,
    ttlShieldMs: 2400,
    waterStepGood: 9.5,
    waterStepBad: 7.5,
    greenHalfBand: 8,
    goalGreenNeedSec: 12,
    stormEverySec: 14,
    stormDurSec: 5.5,
    warnLeadSec: 2.2,
    endWindowSec: 1.25,
    pressureRisePerSec: 16,
    pressureDropOnGood: 10,
    pressureAddOnBad: 12,
    pressureThr: 65,
    miniBlocksNeed: 2,
    shieldSpawnChance: 0.08,
    badBiasInStorm: 0.72,

    // (1) spawn distribution controls
    safePad: 72,              // padding inside playfield
    cellSize: 140,            // anti-repeat cell grid
    minSpawnDist: 120,        // reject if too close to recent spawns
    recentSpawnKeep: 6,
  };

  if (DIFF === 'easy'){
    base.maxTargets = 2;
    base.spawnEveryMs = 900;
    base.ttlGoodMs = 2500;
    base.ttlBadMs = 2900;
    base.waterStepGood = 10.5;
    base.waterStepBad = 6.5;
    base.goalGreenNeedSec = 10;
    base.pressureRisePerSec = 14;
    base.pressureThr = 60;
    base.miniBlocksNeed = 2;
    base.badBiasInStorm = 0.64;
  } else if (DIFF === 'hard'){
    base.maxTargets = 3;
    base.spawnEveryMs = 760;
    base.ttlGoodMs = 1950;
    base.ttlBadMs = 2350;
    base.waterStepGood = 8.5;
    base.waterStepBad = 8.5;
    base.goalGreenNeedSec = 14;
    base.stormEverySec = 12;
    base.stormDurSec = 6.2;
    base.pressureRisePerSec = 18;
    base.pressureThr = 70;
    base.miniBlocksNeed = 3;
    base.badBiasInStorm = 0.78;
  }

  if (RUN === 'study'){
    base.maxTargets = Math.max(base.maxTargets, 3);
    base.spawnEveryMs = Math.max(640, base.spawnEveryMs - 80);
    base.ttlGoodMs = Math.max(1600, base.ttlGoodMs - 200);
    base.ttlBadMs = Math.max(1800, base.ttlBadMs - 150);
    base.goalGreenNeedSec = Math.max(12, base.goalGreenNeedSec);
  }

  return base;
})();

// ------------------------- state -------------------------
const S = {
  started:false,
  ended:false,

  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  water: 45,
  mean: 50,
  zone: 'GREEN',
  timeInGreen: 0,
  goalsDone: 0,
  goalsTotal: 2,

  stormActive:false,
  stormLeftSec: 0,
  nextStormInSec: TUNE.stormEverySec,
  warnActive:false,
  pressure: 0,
  miniBlocksDone: 0,
  miniBlocksNeed: TUNE.miniBlocksNeed,
  miniDone: 0,
  miniTotal: 0,
  lastBlockedAt: 0,

  shield: 0,

  liveGood: 0,
  liveBad: 0,
  liveShield: 0,

  tStart: 0,
  tLast: 0,
  tLeftSec: DUR_SEC,

  nHitGood: 0,
  nHitBad: 0,
  nHitShield: 0,
  nExpireGood: 0,
  nExpireBad: 0,
  nExpireShield: 0,

  spawnTimer: 0,

  // look/parallax
  lookX: 0,
  lookY: 0,
  dragOn: false,
  dragX: 0,
  dragY: 0,
  baseLookX: 0,
  baseLookY: 0,

  // (3) long-press shield raise
  pressDownAt: 0,
  pressActive: false,
  raisedShieldUntil: 0, // timestamp ms

  // (1) spawn distribution memory
  recentSpawns: [],     // [{x,y,cellKey,t}]
  cellUse: new Map(),   // cellKey -> count
};

function calcZone(){
  const band = TUNE.greenHalfBand;
  const v = S.water;
  if (v < (S.mean - band)) return 'LOW';
  if (v > (S.mean + band)) return 'HIGH';
  return 'GREEN';
}
function setWater(v){
  S.water = clamp(v, 0, 100);
  S.zone = calcZone();
}
function regressionTowardMean(step){
  const d = S.mean - S.water;
  const n = S.water + clamp(d, -step, step);
  setWater(n);
}
function pushAwayFromMean(step){
  const d = S.water - S.mean;
  const dir = (Math.abs(d) < 0.0001) ? (rng() < 0.5 ? -1 : 1) : (d > 0 ? 1 : -1);
  setWater(S.water + dir * step);
}

// ------------------------- UI binding -------------------------
const UI = {
  score: $('stat-score'),
  combo: $('stat-combo'),
  comboMax: $('stat-combo-max'),
  miss: $('stat-miss'),
  time: $('stat-time'),
  grade: $('stat-grade'),

  coachText: $('coach-text'),
  coachSub: $('coach-sub'),

  waterZone: $('water-zone'),
  waterPct: $('water-pct'),
  waterBar: $('water-bar'),
  shield: $('shield-count'),
  stormLeft: $('storm-left'),

  q1: $('quest-line1'),
  q2: $('quest-line2'),
  q3: $('quest-line3'),
  q4: $('quest-line4'),

  miniStormIn: $('mini-storm-in'),
  miniPressurePct: $('mini-pressure-pct'),
  miniPressureBar: $('mini-pressure-bar'),
  cStorm: $('mini-c-storm'),
  vStorm: $('mini-v-storm'),
  cZone: $('mini-c-zone'),
  vZone: $('mini-v-zone'),
  cPressure: $('mini-c-pressure'),
  vPressure: $('mini-v-pressure'),
  cEnd: $('mini-c-end'),
  vEnd: $('mini-v-end'),
  cBlock: $('mini-c-block'),
  vBlock: $('mini-v-block'),

  startOverlay: $('start-overlay'),
  btnStart: $('btn-start'),
  btnVR: $('btn-vr'),
  btnStop: $('btn-stop'),

  endWrap: $('hvr-end'),
  btnRetry: $('btn-retry'),
  btnBack: $('btn-back'),
  endScore: $('end-score'),
  endGrade: $('end-grade'),
  endCombo: $('end-combo'),
  endMiss: $('end-miss'),
  endGoals: $('end-goals'),
  endMinis: $('end-minis'),

  playfield: $('playfield'),
  layer: $('hvr-layer'),

  stamp: $('hha-stamp'),
  stampBig: $('stamp-big'),
  stampSmall: $('stamp-small'),
};

function setBodyFx(){
  DOC.body.classList.toggle('fx-low', S.zone === 'LOW');
  DOC.body.classList.toggle('fx-high', S.zone === 'HIGH');
}
function setWarnAmp(v){
  v = clamp(v, 0, 1);
  DOC.documentElement.style.setProperty('--warnamp', String(v));
}
function setEdgeFx(v){
  v = clamp(v, 0, 0.85);
  DOC.documentElement.style.setProperty('--fx', String(v));
}
function flashEdge(strength){
  setEdgeFx(strength);
  const t0 = now();
  const dur = 420;
  (function decay(){
    const k = clamp((now()-t0)/dur, 0, 1);
    setEdgeFx(strength * (1-k));
    if (k < 1) requestAnimationFrame(decay);
  })();
}

function coachSay(main, sub){
  safeText(UI.coachText, main);
  safeText(UI.coachSub, sub || '');
}
function stamp(textBig, textSmall){
  if(!UI.stamp) return;
  safeText(UI.stampBig, textBig);
  safeText(UI.stampSmall, textSmall);
  UI.stamp.classList.add('show');
  setTimeout(()=> UI.stamp?.classList.remove('show'), 760);
}

function calcGrade(){
  const base = S.score;
  const goalBonus = S.goalsDone * 120;
  const miniBonus = S.miniDone * 80;
  const missPenalty = S.miss * 8;
  const total = base + goalBonus + miniBonus - missPenalty;

  if (total >= 900) return 'SSS';
  if (total >= 720) return 'SS';
  if (total >= 560) return 'S';
  if (total >= 420) return 'A';
  if (total >= 280) return 'B';
  return 'C';
}
function progressToS(){
  const base = S.score + (S.goalsDone*120) + (S.miniDone*80) - (S.miss*8);
  const pct = clamp((base / 560) * 100, 0, 100);
  return Math.round(pct);
}

function uiUpdate(){
  safeText(UI.time, Math.max(0, Math.ceil(S.tLeftSec)));

  safeText(UI.score, S.score|0);
  safeText(UI.combo, S.combo|0);
  safeText(UI.comboMax, S.comboMax|0);
  safeText(UI.miss, S.miss|0);

  safeText(UI.grade, calcGrade());

  safeText(UI.waterZone, S.zone);
  safeText(UI.waterPct, `${Math.round(S.water)}%`);
  if (UI.waterBar){
    UI.waterBar.style.width = `${clamp(S.water,0,100)}%`;
    UI.waterBar.classList.toggle('red', (S.zone !== 'GREEN'));
  }
  safeText(UI.shield, S.shield|0);
  safeText(UI.stormLeft, S.stormActive ? Math.ceil(S.stormLeftSec) : 0);

  safeText(UI.q1, `Goal: อยู่ GREEN รวม ${TUNE.goalGreenNeedSec}s 🟢`);
  safeText(UI.q2, `สะสม GREEN: ${Math.floor(S.timeInGreen)} / ${TUNE.goalGreenNeedSec}s  • Goals: ${S.goalsDone}/${S.goalsTotal}`);
  const ns = S.stormActive ? 'Storm อยู่!' : `Next storm in ~${Math.max(0, Math.ceil(S.nextStormInSec))}s`;
  safeText(UI.q3, `Mini (Storm): บล็อก BAD ช่วงท้ายพายุ ${S.miniBlocksDone}/${S.miniBlocksNeed} • ${ns}`);

  const raiseOn = (now() < S.raisedShieldUntil);
  const raiseTxt = raiseOn ? '✋ RAISE SHIELD' : '—';
  safeText(UI.q4, `State: To S = ${progressToS()}% • Minis: ${S.miniDone}/${Math.max(0,S.miniTotal|0)} • Hold: ${raiseTxt}`);

  // mini checklist
  const stormIn = S.stormActive ? 0 : Math.max(0, Math.ceil(S.nextStormInSec));
  safeText(UI.miniStormIn, (S.stormActive ? '0' : String(stormIn)));

  const okStorm = S.stormActive;
  const okZone = (S.zone !== 'GREEN');
  const okPressure = (S.pressure >= TUNE.pressureThr);
  const endWindow = S.stormActive && (S.stormLeftSec <= TUNE.endWindowSec + 0.02);
  const okBlock = (S.miniBlocksDone >= S.miniBlocksNeed);

  safeClass(UI.cStorm, 'ok', okStorm); safeText(UI.vStorm, okStorm ? 'YES' : '—');
  safeClass(UI.cZone, 'ok', okZone && okStorm); safeText(UI.vZone, okStorm ? S.zone : '—');
  safeClass(UI.cPressure, 'ok', okPressure && okStorm); safeText(UI.vPressure, okStorm ? `${Math.round(S.pressure)}% / ${TUNE.pressureThr}%` : '—');
  safeClass(UI.cEnd, 'ok', endWindow); safeText(UI.vEnd, okStorm ? (endWindow ? 'NOW' : `${Math.max(0, Math.ceil(S.stormLeftSec - TUNE.endWindowSec))}s`) : '—');
  safeClass(UI.cBlock, 'ok', okBlock); safeText(UI.vBlock, `${S.miniBlocksDone}/${S.miniBlocksNeed}`);

  if (UI.miniPressureBar) UI.miniPressureBar.style.width = `${clamp(S.pressure,0,100)}%`;
  safeText(UI.miniPressurePct, String(Math.round(S.pressure)));

  setBodyFx();
}

// ------------------------- gameplay: spawning -------------------------
const Live = new Map(); // id -> obj
let nextId = 1;

function playRect(){
  const r = UI.playfield.getBoundingClientRect();

  // (1) safe pad inside playfield + กันทับ HUD ด้วย “top/bottom bias”
  // top HUD สูง ~ (safe-area + card) => กันไว้เพิ่ม
  const pad = TUNE.safePad;
  const topExtra = 110;     // กัน HUD ด้านบน
  const botExtra = 130;     // กัน HUD ด้านล่าง
  const leftExtra = 18;
  const rightExtra = 18;

  return {
    left: r.left + pad + leftExtra,
    top: r.top + pad + topExtra,
    right: r.right - pad - rightExtra,
    bottom: r.bottom - pad - botExtra,
    w: Math.max(1, (r.width - (pad*2 + leftExtra + rightExtra))),
    h: Math.max(1, (r.height - (pad*2 + topExtra + botExtra))),
    raw: r
  };
}

function spawnKind(){
  const wantGood = (S.zone === 'LOW') ? 0.68 : (S.zone === 'HIGH') ? 0.68 : 0.56;
  const inStorm = S.stormActive;

  // occasional shield
  if (!inStorm && S.shield < 2 && rng() < TUNE.shieldSpawnChance) return 'shield';

  // in storm -> more bad, but keep at least one good alive
  if (inStorm){
    if (S.liveGood <= 0) return 'good';
    if (S.liveBad <= 0) return 'bad';
    return (rng() < TUNE.badBiasInStorm) ? 'bad' : 'good';
  }

  // normal ensure both
  if (S.liveGood <= 0) return 'good';
  if (S.liveBad <= 0) return 'bad';

  return (rng() < wantGood) ? 'good' : 'bad';
}

// (1) choose spawn point with anti-repeat & distance checks
function cellKeyFor(x, y){
  const cs = TUNE.cellSize;
  const cx = Math.floor(x / cs);
  const cy = Math.floor(y / cs);
  return `${cx},${cy}`;
}
function tooCloseToRecent(x, y){
  for (const p of S.recentSpawns){
    const dx = x - p.x;
    const dy = y - p.y;
    if ((dx*dx + dy*dy) < (TUNE.minSpawnDist*TUNE.minSpawnDist)) return true;
  }
  return false;
}
function pickSpawnPoint(){
  const rect = playRect();
  const pf = rect.raw;
  // หากพื้นที่แคบมาก fallback กลาง
  if (rect.w < 40 || rect.h < 40){
    return { cx: pf.left + pf.width/2, cy: pf.top + pf.height/2, px: pf.width/2, py: pf.height/2, cell:'0,0' };
  }

  let best = null;
  let bestScore = -1;

  // ลองสุ่มหลายครั้ง แล้วเลือกจุดที่ “ห่างจาก recent + ใช้ cell น้อย + ห่าง center พอดี”
  for (let i=0;i<18;i++){
    const cx = rect.left + rng() * rect.w;
    const cy = rect.top + rng() * rect.h;

    const px = cx - pf.left;
    const py = cy - pf.top;

    const cell = cellKeyFor(px, py);
    const used = (S.cellUse.get(cell) || 0);

    // distance to recent
    const close = tooCloseToRecent(px, py);

    // center bias: ไม่ให้กองตรงกลางตลอด (แต่ก็ไม่ไปมุมสุด)
    const dxC = (px - pf.width/2);
    const dyC = (py - pf.height/2);
    const dC = Math.sqrt(dxC*dxC + dyC*dyC);
    const norm = clamp(dC / Math.max(1, Math.min(pf.width, pf.height)*0.45), 0, 1);

    // scoring
    let sc = 0;
    sc += (close ? -2.5 : 1.0);
    sc += (1.2 - used*0.35);
    sc += (0.65 + (norm*0.45)); // ชอบออกจากกลางนิดๆ
    sc += (rng()*0.25);

    if (sc > bestScore){
      bestScore = sc;
      best = { cx, cy, px, py, cell };
    }
  }

  if (!best){
    const cx = rect.left + rect.w/2;
    const cy = rect.top + rect.h/2;
    const px = cx - rect.raw.left;
    const py = cy - rect.raw.top;
    return { cx, cy, px, py, cell: cellKeyFor(px,py) };
  }
  return best;
}

function spawnOne(){
  if (!UI.layer || !UI.playfield) return;
  const totalLive = Live.size;
  if (totalLive >= TUNE.maxTargets) return;

  const kind = spawnKind();
  const pt = pickSpawnPoint();

  const id = nextId++;
  const el = makeOrbEl(kind);
  UI.layer.appendChild(el);

  el.style.left = `${pt.px}px`;
  el.style.top  = `${pt.py}px`;

  const size = (DIFF === 'easy') ? 92 : (DIFF === 'hard') ? 78 : 86;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;

  const bornAt = now();
  const ttl = (kind === 'good') ? TUNE.ttlGoodMs : (kind === 'bad') ? TUNE.ttlBadMs : TUNE.ttlShieldMs;

  const obj = {
    id, kind, el,
    bornAt,
    ttl,
    // float params + (สุดกว่าเดิม) drift
    a: 7 + rng()*11,
    b: 6 + rng()*9,
    sp: 0.9 + rng()*1.0,
    ph: rng()*Math.PI*2,
    driftX: (rng()*2 - 1) * (DIFF==='hard'? 18 : 12),
    driftY: (rng()*2 - 1) * (DIFF==='hard'? 14 : 10),
  };
  Live.set(id, obj);

  if (kind === 'good') S.liveGood++;
  else if (kind === 'bad') S.liveBad++;
  else S.liveShield++;

  // record spawn usage
  S.recentSpawns.unshift({ x: pt.px, y: pt.py, cellKey: pt.cell, t: bornAt });
  if (S.recentSpawns.length > TUNE.recentSpawnKeep) S.recentSpawns.pop();
  S.cellUse.set(pt.cell, (S.cellUse.get(pt.cell)||0) + 1);

  el.addEventListener('pointerdown', (e)=>{
    e.preventDefault();
    e.stopPropagation();
    onHitOrb(obj, e);
  }, { passive:false });
}

function removeOrb(obj, reason){
  if (!obj || !obj.el) return;
  if (!Live.has(obj.id)) return;
  Live.delete(obj.id);
  obj.el.remove();

  if (obj.kind === 'good') S.liveGood = Math.max(0, S.liveGood - 1);
  else if (obj.kind === 'bad') S.liveBad = Math.max(0, S.liveBad - 1);
  else S.liveShield = Math.max(0, S.liveShield - 1);

  if (reason === 'expire'){
    if (obj.kind === 'good') S.nExpireGood++;
    else if (obj.kind === 'bad') S.nExpireBad++;
    else S.nExpireShield++;
  }
}

function onExpire(obj){
  if (obj.kind === 'good'){
    S.miss++;
    S.combo = 0;
    S.nExpireGood++;
    pushAwayFromMean(TUNE.waterStepBad * 0.55);
    flashEdge(0.22);
    coachSay('พลาดน้ำดี! 💧', 'คุมให้อยู่ GREEN ให้นิ่งขึ้น');
  } else if (obj.kind === 'bad'){
    S.nExpireBad++;
    if (RUN === 'study'){
      S.miss++;
      S.combo = 0;
      pushAwayFromMean(TUNE.waterStepBad * 0.25);
      flashEdge(0.18);
    }
  } else {
    S.nExpireShield++;
  }
  removeOrb(obj, 'expire');
}

// ------------------------- hits / scoring -------------------------
function clientXYFromEvent(e, fallbackEl){
  let x = 0, y = 0;
  if (e && typeof e.clientX === 'number'){
    x = e.clientX; y = e.clientY;
  } else if (fallbackEl){
    const r = fallbackEl.getBoundingClientRect();
    x = r.left + r.width/2;
    y = r.top + r.height/2;
  }
  return { x, y };
}

function onHitOrb(obj, e){
  if (!S.started || S.ended) return;

  const { x, y } = clientXYFromEvent(e, obj.el);
  const inEndWindow = (S.stormActive && S.stormLeftSec <= TUNE.endWindowSec + 0.02);

  if (obj.kind === 'good'){
    AudioFX.beep();
    S.nHitGood++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);

    S.score += 10 + Math.min(12, S.combo);
    regressionTowardMean(TUNE.waterStepGood);
    S.pressure = clamp(S.pressure - TUNE.pressureDropOnGood, 0, 100);

    burstAtClient(x, y, 'good');
    coachSay('ดีมาก! 💧', 'คุมให้อยู่ GREEN จะผ่าน Goal เร็วมาก');

  } else if (obj.kind === 'shield'){
    AudioFX.beep();
    S.nHitShield++;
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);
    S.score += 14;

    S.shield = clamp(S.shield + 1, 0, 9);
    regressionTowardMean(TUNE.waterStepGood * 0.35);

    burstAtClient(x, y, 'shield');
    stamp('SHIELD +1', 'เก็บไว้บล็อก BAD ช่วงท้ายพายุ!');
    coachSay('ได้ Shield แล้ว! 🛡️', 'ยิ่งมีเยอะ ยิ่งมั่นใจตอน Storm');

  } else { // bad
    S.nHitBad++;

    // (3) Raise-shield state: long press ทำให้ “กัน” ได้แม้ไม่กดโดน orb ตรงๆ (feel VR)
    const raised = (now() < S.raisedShieldUntil);

    if ((S.shield > 0 || raised) && S.stormActive){
      if (!raised){
        S.shield--;
      }
      AudioFX.beep();
      S.score += 18;
      S.combo++;
      S.comboMax = Math.max(S.comboMax, S.combo);

      S.pressure = clamp(S.pressure + (TUNE.pressureAddOnBad * 0.35), 0, 100);
      burstAtClient(x, y, 'shield');

      stamp('BLOCK!', inEndWindow ? 'ถูกจังหวะ! ✅' : 'ยังไม่ใช่ท้ายพายุ');

      if (inEndWindow){
        S.miniBlocksDone++;
        S.lastBlockedAt = now();
        coachSay('บล็อกถูกจังหวะ! ✅', `Mini: ${S.miniBlocksDone}/${S.miniBlocksNeed}`);
        flashEdge(0.28);
      } else {
        coachSay('บล็อกได้ แต่ยังไม่ใช่ “ท้ายพายุ”', 'รอ End-window แล้วค่อยบล็อกให้นับ mini');
      }

    } else {
      AudioFX.beep();
      S.combo = 0;
      S.miss++;
      S.score -= 12;
      pushAwayFromMean(TUNE.waterStepBad);
      S.pressure = clamp(S.pressure + TUNE.pressureAddOnBad, 0, 100);

      burstAtClient(x, y, 'bad');
      flashEdge(0.52);
      coachSay('โดน BAD! ☠️', 'เก็บ Shield ไว้บล็อกช่วงท้ายพายุ');
    }
  }

  removeOrb(obj, 'hit');
  uiUpdate();
}

// ------------------------- storm system -------------------------
function stormSet(on){
  S.stormActive = !!on;
  DOC.body.classList.toggle('storm', S.stormActive);

  if (S.stormActive){
    S.stormLeftSec = TUNE.stormDurSec;
    S.miniTotal++;
    AudioFX.thunder();

    // สุดกว่าเดิม: เข้า storm แล้ว shake แรงขึ้นนิด
    DOC.body.classList.add('fx-shake');
    flashEdge(0.62);

    coachSay('🌪️ Storm มาแล้ว!', 'ห้ามอยู่ GREEN • อัด Pressure • “ท้ายพายุ” ค่อยบล็อก BAD');
  } else {
    DOC.body.classList.remove('fx-shake');
    DOC.body.classList.remove('storm-warn');
    setWarnAmp(0);
    S.warnActive = false;

    if (S.miniBlocksDone >= S.miniBlocksNeed){
      S.miniDone++;
      stamp('MINI CLEARED!', `ผ่าน (${S.miniBlocksDone}/${S.miniBlocksNeed})`);
      try{ Particles.celebrate?.('mini'); }catch(_){}
      coachSay('Mini ผ่านแล้ว! 🎉', 'กลับไปคุม GREEN ให้ครบเพื่อผ่าน Goal');
    } else {
      coachSay('Storm จบแล้ว', `Mini ยังไม่ครบ (${S.miniBlocksDone}/${S.miniBlocksNeed}) รอบหน้าต้องเอาให้ได้`);
    }

    S.miniBlocksDone = 0;
    S.pressure = clamp(S.pressure * 0.35, 0, 100);
  }

  uiUpdate();
}

function setWarn(on){
  S.warnActive = !!on;
  DOC.body.classList.toggle('storm-warn', S.warnActive);
  if (!S.warnActive) setWarnAmp(0);
}

// tick sound accel during warn (สุดกว่าเดิม: เร่งมากขึ้น + flash เล็กๆ)
let warnTickT = 0;
function warnTickUpdate(dt){
  if (!S.warnActive) return;
  warnTickT += dt;

  const remain = Math.max(0.001, S.nextStormInSec);
  const n = clamp(1 - clamp(remain / TUNE.warnLeadSec, 0, 1), 0, 1); // 0..1
  const rate = clamp(0.22 - (0.16 * n), 0.055, 0.22);

  if (warnTickT >= rate){
    warnTickT = 0;
    AudioFX.tick();
    if (n > 0.65) flashEdge(0.16 + 0.10*n);
  }
  setWarnAmp(n);

  // (สุดกว่าเดิม) shake ใน warn ใกล้พายุ
  if (n > 0.25) DOC.body.classList.add('fx-shake');
  else DOC.body.classList.remove('fx-shake');
}

// ------------------------- goal logic -------------------------
function onGoalCleared(){
  S.goalsDone++;
  stamp('GOAL CLEARED!', `GREEN สำเร็จ ${S.goalsDone}/${S.goalsTotal}`);
  try{ Particles.celebrate?.('goal'); }catch(_){}
  S.score += 120;
  coachSay('สุดยอด! 🟢', 'อย่าหลุด GREEN นาน เดี๋ยวเป้าหนักขึ้น');
  S.timeInGreen = 0;
}
function updateGreenTime(dtSec){
  if (S.zone === 'GREEN'){
    S.timeInGreen += dtSec;
    if (S.timeInGreen >= TUNE.goalGreenNeedSec){
      onGoalCleared();
    }
  }
}

// ------------------------- loop (movement + expire + storm) -------------------------
let tickHandle = 0;

function moveOrbs(t){
  const pf = UI.playfield.getBoundingClientRect();

  // look offset from drag/gyro: apply to playfield transform (targets move with it)
  const lx = clamp(S.lookX, -1, 1);
  const ly = clamp(S.lookY, -1, 1);
  const tx = lx * 16; // สุดกว่าเดิม: มากขึ้นนิด
  const ty = ly * 12;
  UI.playfield.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;

  // per-orb float + (สุดกว่าเดิม) drift ไหลเบาๆ
  for (const obj of Live.values()){
    const age = (t - obj.bornAt) / 1000;
    const wobX = Math.sin(age*obj.sp + obj.ph) * obj.a;
    const wobY = Math.cos(age*(obj.sp*0.92) + obj.ph) * obj.b;

    const drift = (Math.sin(age*0.45 + obj.ph) * 0.5 + 0.5);
    const dX = obj.driftX * drift * 0.18;
    const dY = obj.driftY * drift * 0.18;

    const pulse = 1 + (Math.sin(age*4.2 + obj.ph)*0.022);

    obj.el.style.transform = `translate(-50%,-50%) translate3d(${wobX + dX}px, ${wobY + dY}px, 0) scale(${pulse})`;
  }
}

function updateExpire(t){
  for (const obj of Array.from(Live.values())){
    if ((t - obj.bornAt) > obj.ttl){
      onExpire(obj);
    }
  }
}

function spawnLoop(t){
  if (!S.started || S.ended) return;
  if (!S.spawnTimer) S.spawnTimer = t;

  while (t - S.spawnTimer >= TUNE.spawnEveryMs){
    S.spawnTimer += TUNE.spawnEveryMs;
    spawnOne();
  }

  // guarantee: at least 1 good + 1 bad visible (ตามสเปค)
  if (S.started && !S.ended){
    if (S.liveGood <= 0) spawnOne();
    if (S.liveBad <= 0) spawnOne();
  }
}

function updateStorm(dtSec){
  if (!S.stormActive){
    S.nextStormInSec -= dtSec;

    if (S.nextStormInSec <= TUNE.warnLeadSec && S.nextStormInSec > 0){
      if (!S.warnActive){
        setWarn(true);
        coachSay('⚠️ Storm กำลังมา!', 'เตรียม: ห้ามอยู่ GREEN • เก็บ Shield • กดค้าง=ยกโล่');
      }
    }

    if (S.warnActive){
      warnTickUpdate(dtSec);
    } else {
      DOC.body.classList.remove('fx-shake');
    }

    if (S.nextStormInSec <= 0){
      setWarn(false);
      DOC.body.classList.remove('fx-shake');
      stormSet(true);
      S.nextStormInSec = TUNE.stormEverySec + (rng()*2.2 - 1.1);
    }

  } else {
    S.stormLeftSec -= dtSec;
    S.pressure = clamp(S.pressure + (TUNE.pressureRisePerSec * dtSec), 0, 100);

    if (S.zone !== 'GREEN'){
      S.pressure = clamp(S.pressure + (6*dtSec), 0, 100);
    }

    if (S.stormLeftSec <= 0){
      stormSet(false);
    }
  }
}

function mainLoop(t){
  if (!S.started || S.ended){
    tickHandle = requestAnimationFrame(mainLoop);
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (t - (S.tLast || t)) / 1000));
  S.tLast = t;

  S.tLeftSec = Math.max(0, S.tLeftSec - dt);
  if (S.tLeftSec <= 0){
    endGame('timeout');
    tickHandle = requestAnimationFrame(mainLoop);
    return;
  }

  S.zone = calcZone();
  updateGreenTime(dt);

  updateStorm(dt);

  moveOrbs(t);
  updateExpire(t);
  spawnLoop(t);

  uiUpdate();
  tickHandle = requestAnimationFrame(mainLoop);
}

// ------------------------- (2) Crosshair shooting: weighted nearest -------------------------
function pickTargetForCrosshair(){
  const pf = UI.playfield.getBoundingClientRect();
  const cx = pf.left + pf.width/2;
  const cy = pf.top + pf.height/2;

  let best = null;
  let bestScore = -1;

  for (const obj of Live.values()){
    const r = obj.el.getBoundingClientRect();
    const ox = r.left + r.width/2;
    const oy = r.top + r.height/2;

    const dx = ox - cx;
    const dy = oy - cy;
    const d2 = dx*dx + dy*dy;

    // range gate: ไม่ยิงไกลเกิน (ยุติธรรม)
    const maxR = 140;
    if (d2 > maxR*maxR) continue;

    // weight: ใกล้กว่าได้คะแนนสูง + ชอบเป้าที่อยู่ “บนเส้นกลาง” มากขึ้นนิด
    const d = Math.sqrt(d2);
    const near = 1 - clamp(d / maxR, 0, 1);
    const line = 1 - clamp(Math.abs(dy) / maxR, 0, 1);
    const kindBias = (obj.kind === 'bad' && S.stormActive) ? 0.12 : (obj.kind === 'good') ? 0.08 : 0.10;

    const sc = near*0.72 + line*0.18 + kindBias + rng()*0.05;

    if (sc > bestScore){
      bestScore = sc;
      best = obj;
    }
  }
  return best;
}

// ------------------------- (3) Long press: Raise Shield -------------------------
function raiseShield(){
  const t = now();
  S.raisedShieldUntil = Math.max(S.raisedShieldUntil, t + 520); // short window
  stamp('RAISE SHIELD', 'บล็อก BAD ได้ใน Storm (ช่วงสั้นๆ)');
  flashEdge(0.22);
}

// ------------------------- input: drag + gyro + shoot + long-press -------------------------
function bindLookAndInput(){
  const pf = UI.playfield;
  if (!pf) return;

  pf.addEventListener('pointerdown', (e)=>{
    AudioFX.resume();

    S.dragOn = true;
    S.dragX = e.clientX;
    S.dragY = e.clientY;
    S.baseLookX = S.lookX;
    S.baseLookY = S.lookY;

    // long-press start
    S.pressDownAt = now();
    S.pressActive = true;
  }, { passive:true });

  pf.addEventListener('pointermove', (e)=>{
    if (!S.dragOn) return;
    const dx = (e.clientX - S.dragX) / 220;
    const dy = (e.clientY - S.dragY) / 220;
    S.lookX = clamp(S.baseLookX + dx, -1, 1);
    S.lookY = clamp(S.baseLookY + dy, -1, 1);
  }, { passive:true });

  function endPress(e){
    if (!S.pressActive) return;
    const held = now() - (S.pressDownAt || now());
    S.pressActive = false;

    // long press => raise shield
    if (held >= 350){
      raiseShield();
      coachSay('ยกโล่! ✋🛡️', 'ตอน Storm ถ้าเจอ BAD จะกันได้แม้ไม่กดโดนโล่ในคลัง');
      return;
    }

    // short tap => shoot crosshair
    if (!S.started || S.ended) return;
    const target = pickTargetForCrosshair();
    if (target){
      const pfR = UI.playfield.getBoundingClientRect();
      const cx = pfR.left + pfR.width/2;
      const cy = pfR.top + pfR.height/2;
      onHitOrb(target, { clientX: cx, clientY: cy });
    } else {
      flashEdge(0.10);
    }
  }

  pf.addEventListener('pointerup', endPress, { passive:true });
  pf.addEventListener('pointercancel', ()=>{ S.dragOn=false; S.pressActive=false; }, { passive:true });

  ROOT.addEventListener('deviceorientation', (ev)=>{
    const g = num(ev.gamma, 0) / 35;
    const b = num(ev.beta, 0) / 45;
    if (!S.dragOn){
      S.lookX = clamp(g, -1, 1);
      S.lookY = clamp(b, -1, 1);
    }
  }, { passive:true });
}

// ------------------------- lifecycle -------------------------
function startGame(){
  if (S.started) return;
  S.started = true;
  S.ended = false;

  AudioFX.resume();

  S.score = 0; S.combo = 0; S.comboMax = 0; S.miss = 0;
  setWater(45);
  S.timeInGreen = 0;
  S.goalsDone = 0;
  S.miniDone = 0;
  S.miniTotal = 0;
  S.miniBlocksDone = 0;
  S.miniBlocksNeed = TUNE.miniBlocksNeed;
  S.pressure = 0;
  S.shield = 0;

  S.tLeftSec = DUR_SEC;
  S.tStart = now();
  S.tLast = now();
  S.nextStormInSec = TUNE.stormEverySec;

  setWarn(false);
  stormSet(false);

  for (const obj of Array.from(Live.values())) removeOrb(obj, 'clear');
  S.recentSpawns.length = 0;
  S.cellUse.clear();

  // guarantee initial mix
  spawnOne(); spawnOne();

  coachSay('พร้อมแล้ว! เก็บน้ำดี 💧', 'แตะ=ยิง • กดค้าง=ยกโล่ (ช่วยบล็อก BAD ตอน Storm)');
  uiUpdate();
}

function injectBackToHub(){
  if (!UI.endWrap) return;
  if (UI.endWrap.querySelector('[data-hha-backhub="1"]')) return;

  const btn = DOC.createElement('button');
  btn.className = 'btn secondary';
  btn.type = 'button';
  btn.textContent = '🏠 Back to HUB';
  btn.setAttribute('data-hha-backhub', '1');
  btn.style.marginLeft = '8px';
  btn.style.pointerEvents = 'auto';

  btn.addEventListener('click', ()=>{
    location.href = HUB || './hub.html';
  });

  const topRow = UI.endWrap.querySelector('.endCard > div');
  if (topRow) topRow.appendChild(btn);
}

function endGame(reason){
  if (S.ended) return;
  S.ended = true;
  S.started = false;

  DOC.body.classList.remove('storm-warn','storm','fx-shake');
  setWarnAmp(0);
  setEdgeFx(0);

  if (UI.startOverlay) UI.startOverlay.style.display = 'none';
  if (UI.endWrap) UI.endWrap.style.display = 'flex';

  safeText(UI.endScore, S.score|0);
  safeText(UI.endGrade, calcGrade());
  safeText(UI.endCombo, S.comboMax|0);
  safeText(UI.endMiss, S.miss|0);
  safeText(UI.endGoals, `${S.goalsDone}/${S.goalsTotal}`);

  const totalStorms = Math.max(0, S.miniTotal|0);
  safeText(UI.endMinis, `${S.miniDone}/${totalStorms}`);

  const summary = {
    gameMode: 'hydration',
    diff: DIFF,
    run: RUN,
    durationPlannedSec: DUR_SEC,
    durationPlayedSec: Math.max(0, Math.round(DUR_SEC - S.tLeftSec)),
    scoreFinal: S.score|0,
    comboMax: S.comboMax|0,
    misses: S.miss|0,
    goalsCleared: S.goalsDone|0,
    goalsTotal: S.goalsTotal|0,
    miniCleared: S.miniDone|0,
    miniTotal: totalStorms|0,
    waterEndPct: Math.round(S.water),
    reason,
    timestampIso: new Date().toISOString(),
    hub: HUB
  };

  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary)); }catch(_){}
  try{ ROOT.dispatchEvent(new CustomEvent('hha:end', { detail: summary })); }catch(_){}

  injectBackToHub();

  coachSay('จบเกมแล้ว', 'กด Retry หรือกลับ HUB ได้เลย');
  uiUpdate();
}

// ------------------------- buttons -------------------------
function bindButtons(){
  UI.btnStart?.addEventListener('click', ()=>{
    AudioFX.resume();
    if (UI.startOverlay) UI.startOverlay.style.display = 'none';
    if (UI.endWrap) UI.endWrap.style.display = 'none';
    startGame();
  }, { passive:true });

  UI.btnStop?.addEventListener('click', ()=>{
    AudioFX.resume();
    endGame('stop');
  }, { passive:true });

  UI.btnRetry?.addEventListener('click', ()=>{
    AudioFX.resume();
    location.reload();
  }, { passive:true });

  UI.btnBack?.addEventListener('click', ()=>{
    AudioFX.resume();
    location.href = HUB || './hub.html';
  }, { passive:true });

  UI.btnVR?.addEventListener('click', ()=>{
    AudioFX.resume();
    const scene = DOC.querySelector('a-scene');
    if (scene && scene.enterVR) {
      try{ scene.enterVR(); }catch(_){}
    } else {
      stamp('VR', 'อุปกรณ์นี้อาจไม่รองรับ WebXR เต็มรูปแบบ');
    }
  }, { passive:true });
}

// ------------------------- init -------------------------
(function init(){
  if (!DOC || !UI.playfield || !UI.layer){
    console.warn('[HydrationVR] missing DOM nodes');
    return;
  }

  ensureCrosshair(UI.playfield);

  coachSay('แตะ START เพื่อเริ่ม', 'แตะ=ยิง • กดค้าง~0.35s=ยกโล่ (ช่วยบล็อก BAD ตอน Storm)');
  uiUpdate();

  bindButtons();
  bindLookAndInput();

  if (UI.endWrap) UI.endWrap.style.display = 'none';

  tickHandle = requestAnimationFrame(mainLoop);

  ROOT.__HVR__ = { S, TUNE };
})();
