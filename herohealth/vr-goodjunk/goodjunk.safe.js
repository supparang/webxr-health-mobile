// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE (PRODUCTION) — HHA Standard (FINAL PACK)
// ✅ Real-time grade (provisional) + final grade at end
// ✅ Deterministic RNG (seeded) for research (and optional for play via ?seed=)
// ✅ Boss hazards dodgeable (Ring gap + Laser line) using world-shift (drag/gyro)
// ✅ FEVER -> auto Shield (blocks junk/hazard; guarded junk does NOT count as miss)
// ✅ Miss definition: miss = good expired + junk hit (only if NOT blocked by shield)
// ✅ Magnet tuned (pull+repel+fx+bonus) "help not autoplay"
// ✅ Quest emits: quest:update + hha:quest (cache: window.__HHA_LAST_QUEST__)
// ✅ End policy: end=time (default) | end=all (play only)

'use strict';

// --------------------------- Utilities ---------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
function hypot(dx, dy){ return Math.hypot(dx, dy); }

function emitEvt(type, detail) {
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch (_) {}
  try { document.dispatchEvent(new CustomEvent(type, { detail })); } catch (_) {}
}

function getLayerOffset() {
  const o = ROOT.__GJ_LAYER_OFFSET__;
  if (o && isFinite(o.x) && isFinite(o.y)) return { x: o.x, y: o.y };
  return { x: 0, y: 0 };
}

function getAimPoint() {
  const a = ROOT.__GJ_AIM_POINT__;
  if (a && isFinite(a.x) && isFinite(a.y)) return { x: a.x, y: a.y };
  return { x: (innerWidth / 2), y: (innerHeight * 0.62) };
}

function getWorldShift(){
  const s = ROOT.__GJ_LAYER_SHIFT__;
  if (s && isFinite(s.x) && isFinite(s.y)) return { x: s.x, y: s.y };
  return { x: 0, y: 0 };
}

function viewportToLayerXY(x, y) {
  const off = getLayerOffset();
  return { x: x - off.x, y: y - off.y };
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// --------------------------- Deterministic RNG ---------------------------
function hash32(str){
  str = String(str ?? '');
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function makeRng(seedAny){
  const seed = (typeof seedAny === 'number' && isFinite(seedAny)) ? (seedAny >>> 0) : hash32(seedAny);
  const rand = mulberry32(seed);
  return {
    seed,
    random: () => rand(),
    rnd: (a,b) => a + rand() * (b - a),
    rndi: (a,b) => Math.floor(a + rand() * ((b + 1) - a)),
    pick: (arr) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(rand() * arr.length)))]
  };
}

// --------------------------- Style injection (stun/panic/magnet) ---------------------------
function ensureFXStyles() {
  if (document.getElementById('gj-safe-fx-style')) return;
  const style = document.createElement('style');
  style.id = 'gj-safe-fx-style';
  style.textContent = `
    @keyframes gjShake {
      0%{ transform: translate3d(0,0,0); }
      10%{ transform: translate3d(-2px, 1px,0); }
      20%{ transform: translate3d(3px, -1px,0); }
      30%{ transform: translate3d(-4px, 2px,0); }
      40%{ transform: translate3d(4px, -2px,0); }
      50%{ transform: translate3d(-3px, 2px,0); }
      60%{ transform: translate3d(3px, -1px,0); }
      70%{ transform: translate3d(-2px, 1px,0); }
      80%{ transform: translate3d(2px, -1px,0); }
      90%{ transform: translate3d(-1px, 1px,0); }
      100%{ transform: translate3d(0,0,0); }
    }
    body.gj-stun { animation: gjShake .55s linear both; }
    body.gj-stun::before{
      content:'';
      position:fixed; inset:-20px; pointer-events:none; z-index: 9999;
      background:
        radial-gradient(900px 600px at 50% 50%, rgba(239,68,68,.10), transparent 60%),
        radial-gradient(900px 600px at 50% 50%, transparent 55%, rgba(239,68,68,.24) 78%, transparent 92%);
      opacity: 0;
      animation: gjFlash .55s ease both;
      mix-blend-mode: screen;
    }
    @keyframes gjFlash{
      0%{ opacity:0; }
      15%{ opacity:.85; }
      35%{ opacity:.25; }
      55%{ opacity:.70; }
      100%{ opacity:0; }
    }
    body.gj-panic::after{
      content:'';
      position:fixed; inset:0; pointer-events:none; z-index: 9998;
      background:
        radial-gradient(900px 600px at 50% 50%, transparent 55%, rgba(245,158,11,.22) 78%, transparent 92%);
      opacity:.0;
      animation: gjPanic .9s ease-in-out infinite alternate;
      mix-blend-mode: screen;
    }
    @keyframes gjPanic{ from{ opacity:.10; } to{ opacity:.60; } }

    /* ---- Magnet mode FX ---- */
    body.gj-magnet #gj-crosshair{
      box-shadow:
        0 0 0 3px rgba(34,197,94,.18),
        0 0 26px rgba(34,197,94,.22),
        0 0 60px rgba(34,197,94,.10);
      border-color: rgba(255,255,255,.92);
    }
    body.gj-magnet::before{
      content:'';
      position:fixed; inset:0; pointer-events:none; z-index: 9997;
      background: radial-gradient(700px 500px at 50% 62%, rgba(34,197,94,.085), transparent 60%);
      opacity:.95;
      mix-blend-mode: screen;
    }

    /* ---- Magnet field lines layer ---- */
    .gj-mline-layer{
      position:fixed; inset:0;
      z-index: 32;
      pointer-events:none;
      overflow:hidden;
    }
    .gj-mline{
      position:absolute;
      left:0; top:0;
      height: 3px;
      border-radius: 999px;
      transform-origin: 0% 50%;
      background: linear-gradient(90deg,
        rgba(34,197,94,0.00),
        rgba(34,197,94,0.75),
        rgba(245,158,11,0.55),
        rgba(255,255,255,0.18)
      );
      filter: drop-shadow(0 10px 22px rgba(34,197,94,.20));
      mix-blend-mode: screen;
      opacity: 0;
      animation: gjMagLine .26s ease-out forwards;
    }
    @keyframes gjMagLine{
      0%{ opacity:0; transform: translate3d(0,0,0) scaleX(.82); }
      35%{ opacity:.95; }
      100%{ opacity:0; transform: translate3d(0,0,0) scaleX(1.02); }
    }
  `;
  document.head.appendChild(style);
}

// --------------------------- Optional globals (Particles/FeverUI) ---------------------------
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, celebrate() {} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  { setFever() {}, setShield() {}, setState() {} };

// --------------------------- Quest Director (embedded) ---------------------------
function makeQuestDirector(opts = {}) {
  const diff = String(opts.diff || 'normal').toLowerCase();
  const goalDefs = Array.isArray(opts.goalDefs) ? opts.goalDefs : [];
  const miniDefs = Array.isArray(opts.miniDefs) ? opts.miniDefs : [];
  const maxGoals = Math.max(1, opts.maxGoals || 2);
  const maxMini = Math.max(1, opts.maxMini || 7);
  const onUpdate = (typeof opts.onUpdate === 'function') ? opts.onUpdate : null;

  const Q = {
    started: false,
    goalIndex: 0,
    miniIndex: 0,
    goalsTotal: Math.min(maxGoals, goalDefs.length || maxGoals),
    minisTotal: Math.min(maxMini, miniDefs.length || maxMini),

    activeGoal: null,
    activeMini: null,

    goalsCleared: 0,
    minisCleared: 0,
    allDone: false
  };

  function normGoal(def){
    const title = String(def.title ?? def.name ?? 'เก็บของดี');
    const target = Math.max(1, Number(def.target ?? def.max ?? def.count ?? 1) || 1);
    const kind = String(def.kind ?? def.type ?? 'good');
    return { ...def, title, target, kind, cur: 0, done: false };
  }
  function normMini(def){
    const title = String(def.title ?? def.name ?? 'มินิเควส');
    const target = Math.max(1, Number(def.target ?? def.max ?? def.count ?? 1) || 1);
    const kind = String(def.kind ?? def.type ?? 'good');
    const timeLimitSec = (def.timeLimitSec != null) ? Math.max(0, Number(def.timeLimitSec) || 0) : null;
    const forbidJunk = !!def.forbidJunk;
    return { ...def, title, target, kind, cur: 0, done: false, timeLimitSec, forbidJunk, startedAt: null, tLeft: null };
  }
  function pickGoal(i){ return goalDefs[i] ? normGoal(goalDefs[i]) : normGoal(goalDefs[0] || { title:'เก็บของดี', target: 10, kind:'good' }); }
  function pickMini(i){ return miniDefs[i] ? normMini(miniDefs[i]) : normMini(miniDefs[0] || { title:'เก็บของดีให้ไว', target: 5, kind:'good', timeLimitSec: 8, forbidJunk:false }); }

  function ui(reason='update'){
    const g = Q.activeGoal;
    const m = Q.activeMini;
    return {
      reason,
      diff,

      goalTitle: g ? `Goal: ${g.title}` : 'Goal: —',
      goalCur: g ? (g.cur|0) : 0,
      goalMax: g ? (g.target|0) : 0,

      miniTitle: m ? `Mini: ${m.title}` : 'Mini: —',
      miniCur: m ? (m.cur|0) : 0,
      miniMax: m ? (m.target|0) : 0,
      miniTLeft: (m && m.tLeft != null) ? m.tLeft : null,

      goalsCleared: Q.goalsCleared|0,
      goalsTotal: Q.goalsTotal|0,
      minisCleared: Q.minisCleared|0,
      minisTotal: Q.minisTotal|0,

      goalIndex: Math.min(Q.goalIndex + 1, Q.goalsTotal),
      miniIndex: Math.min(Q.miniIndex + 1, Q.minisTotal),

      allDone: !!Q.allDone
    };
  }

  function push(reason){
    if(onUpdate) { try { onUpdate(ui(reason)); } catch(_) {} }
  }

  function start(){
    if(Q.started) return;
    Q.started = true;
    Q.goalIndex = 0;
    Q.miniIndex = 0;
    Q.goalsCleared = 0;
    Q.minisCleared = 0;
    Q.allDone = false;

    Q.activeGoal = pickGoal(Q.goalIndex);
    Q.activeMini = pickMini(Q.miniIndex);
    if (Q.activeMini) {
      Q.activeMini.startedAt = Date.now();
      if (Q.activeMini.timeLimitSec != null) Q.activeMini.tLeft = Math.ceil(Q.activeMini.timeLimitSec);
    }
    push('start');
  }

  function tick(){
    const m = Q.activeMini;
    if(!m || m.done || Q.allDone) return;
    if(m.timeLimitSec != null && m.startedAt != null){
      const t = (Date.now() - m.startedAt) / 1000;
      const left = Math.max(0, m.timeLimitSec - t);
      const ceil = Math.ceil(left);
      if(m.tLeft !== ceil){ m.tLeft = ceil; push('mini-tick'); }
      if(left <= 0){
        failMini('timeout');
      }
    }
  }

  function checkAllDone(){
    if (Q.goalsCleared >= Q.goalsTotal && Q.minisCleared >= Q.minisTotal){
      Q.allDone = true;
      Q.activeGoal = null;
      Q.activeMini = null;
      push('all-complete');
      return true;
    }
    return false;
  }

  function addGoalProgress(n=1){
    const g = Q.activeGoal;
    if(!g || g.done || Q.allDone) return { done:false };
    g.cur = clamp(g.cur + (Number(n)||0), 0, g.target);
    if(g.cur >= g.target){
      g.done = true;
      Q.goalsCleared++;
      push('goal-complete');
      checkAllDone();
      return { done:true };
    }
    push('goal-progress');
    return { done:false };
  }

  function addMiniProgress(n=1){
    const m = Q.activeMini;
    if(!m || m.done || Q.allDone) return { done:false };
    m.cur = clamp(m.cur + (Number(n)||0), 0, m.target);
    if(m.cur >= m.target){
      m.done = true;
      Q.minisCleared++;
      push('mini-complete');
      checkAllDone();
      return { done:true };
    }
    push('mini-progress');
    return { done:false };
  }

  function failMini(reason='fail'){
    const m = Q.activeMini;
    if(m && !m.done){ m.done = true; }
    push('mini-fail:'+reason);
    return nextMini();
  }

  function nextGoal(){
    if (Q.allDone) return { ended:true };
    Q.goalIndex++;
    if(Q.goalIndex >= Q.goalsTotal){
      Q.activeGoal = null;
      push('all-goals-done');
      checkAllDone();
      return { ended:true };
    }
    Q.activeGoal = pickGoal(Q.goalIndex);
    push('next-goal');
    return { ended:false };
  }

  function nextMini(){
    if (Q.allDone) return { ended:true };
    Q.miniIndex++;
    if(Q.miniIndex >= Q.minisTotal){
      Q.activeMini = null;
      push('all-minis-done');
      checkAllDone();
      return { ended:true };
    }
    Q.activeMini = pickMini(Q.miniIndex);
    if(Q.activeMini){
      Q.activeMini.startedAt = Date.now();
      if(Q.activeMini.timeLimitSec != null) Q.activeMini.tLeft = Math.ceil(Q.activeMini.timeLimitSec);
    }
    push('next-mini');
    return { ended:false };
  }

  function onJunkHit(){
    const m = Q.activeMini;
    if(m && !m.done && m.forbidJunk && !Q.allDone){
      failMini('hit-junk');
    }
  }

  function getUIState(reason='state'){ return ui(reason); }

  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, getUIState };
}

// --------------------------- Default quest defs (HHA Standard: 2 goals + 7 minis) ---------------------------
function makeDefaultQuestDefs(diff='normal', challenge='rush') {
  const d = String(diff).toLowerCase();
  const goalTarget = (d === 'easy') ? 12 : (d === 'hard' ? 20 : 16);

  const goals = [
    { title: `เก็บของดีให้ได้ ${goalTarget} ชิ้น`, kind: 'good', target: goalTarget },
    { title: `อยู่รอด! อย่าให้พลาดเกิน ${(d === 'easy') ? 6 : (d === 'hard' ? 3 : 4)} ครั้ง`, kind: 'survive', target: 1 }
  ];

  const minis = [
    { title: 'เก็บของดี 5 ชิ้นใน 8 วิ', kind: 'good', target: 5, timeLimitSec: 8, forbidJunk: false },
    { title: 'ห้ามโดนขยะ! เก็บของดี 5 ชิ้น', kind: 'good', target: 5, timeLimitSec: 12, forbidJunk: true },
    { title: 'คอมโบ! เก็บของดี 7 ชิ้น', kind: 'good', target: 7, timeLimitSec: 14, forbidJunk: true },
    { title: 'สปีดรัน! เก็บของดี 6 ชิ้นใน 9 วิ', kind: 'good', target: 6, timeLimitSec: 9, forbidJunk: false },
    { title: 'แม่น ๆ ! ยิงโดนของดี 8 ชิ้น', kind: 'good', target: 8, timeLimitSec: 18, forbidJunk: true },
    { title: (challenge === 'boss') ? 'บดบอส! ยิงบอส 6 ครั้ง' : 'หลบกับดัก! เก็บของดี 7 ชิ้น',
      kind: (challenge === 'boss') ? 'bossHit' : 'good',
      target: (challenge === 'boss') ? 6 : 7,
      timeLimitSec: 14, forbidJunk: (challenge !== 'boss') },
    { title: 'ปิดท้าย! เก็บของดี 10 ชิ้น', kind: 'good', target: 10, timeLimitSec: 22, forbidJunk: true }
  ];

  return { goals, minis };
}

// --------------------------- Game boot ---------------------------
export function boot(opts = {}) {
  ensureFXStyles();

  const diff = String(opts.diff || 'normal').toLowerCase();
  const run = String(opts.run || 'play').toLowerCase();              // play | research
  const challenge = String(opts.challenge || 'rush').toLowerCase();  // rush | boss | survival
  const endPolicy = String(opts.endPolicy || 'time').toLowerCase();  // time | all
  const timeLimitSec = clamp(opts.time ?? 80, 20, 180) | 0;

  const layerEl = opts.layerEl || document.getElementById('gj-layer');
  const shootEl = opts.shootEl || document.getElementById('btnShoot');

  const ringEl = document.getElementById('atk-ring');
  const laserEl = document.getElementById('atk-laser');

  const safeMargins = Object.assign({ top: 128, bottom: 170, left: 26, right: 26 }, opts.safeMargins || {});
  const context = (opts.context && typeof opts.context === 'object') ? opts.context : {};
  const sessionId = opts.sessionId || context.sessionId || undefined;

  if (!layerEl) throw new Error('[GoodJunk] layerEl missing (#gj-layer)');
  if (!shootEl) throw new Error('[GoodJunk] shootEl missing (#btnShoot)');

  // ---------------- Seed policy (HHA Standard) ----------------
  // research: deterministic by default; play: deterministic only if provided seed
  let seedStr = (opts.seed != null && opts.seed !== '') ? String(opts.seed) : null;
  if (!seedStr && run === 'research'){
    const key = [
      context.studyId, context.phase, context.conditionGroup, context.sessionOrder,
      context.blockLabel, context.studentKey, context.studentNo
    ].filter(v => v != null && v !== '').join('|');
    seedStr = key || 'HHA|GoodJunk|research';
  }
  if (!seedStr) seedStr = String(Date.now()); // play fallback
  const RNG = makeRng(seedStr);

  // Quest defs
  const defs = makeDefaultQuestDefs(diff, challenge);

  // ---------------- magnet line layer ----------------
  let mlineLayer = null;
  function ensureMagnetLineLayer(){
    if (mlineLayer && mlineLayer.isConnected) return mlineLayer;
    mlineLayer = document.querySelector('.gj-mline-layer');
    if (mlineLayer) return mlineLayer;

    const el = document.createElement('div');
    el.className = 'gj-mline-layer';
    document.body.appendChild(el);
    mlineLayer = el;
    return mlineLayer;
  }

  let magLineNextMs = 0;
  function spawnMagLine(x1, y1, x2, y2){
    const layer = ensureMagnetLineLayer();
    if (!layer) return;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.max(10, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx) * 180 / Math.PI;

    const line = document.createElement('div');
    line.className = 'gj-mline';
    line.style.left = `${x1.toFixed(1)}px`;
    line.style.top  = `${y1.toFixed(1)}px`;
    line.style.width = `${len.toFixed(1)}px`;
    line.style.transform = `rotate(${ang.toFixed(2)}deg)`;
    line.style.height = `${RNG.rndi(2, 4)}px`;

    layer.appendChild(line);
    setTimeout(() => { try { line.remove(); } catch(_) {} }, 320);
  }

  // ---------------- Internal state ----------------
  const S = {
    startedAtIso: null,
    endedAtIso: null,

    gameMode: 'GoodJunkVR',
    diff, run, challenge,
    endPolicy,
    seed: RNG.seed,
    seedRaw: seedStr,

    durationPlannedSec: timeLimitSec,
    durationPlayedSec: 0,

    score: 0,
    combo: 0,
    comboMax: 0,

    misses: 0,

    timeLeftSec: timeLimitSec,

    fever: 0,
    shield: 0,
    magnet: 0,
    slowmo: 0,

    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    rtGood: [],

    bossAlive: false,
    bossPhase: 0,
    bossHp: 0,
    bossHpMax: 0,
    bossSpawned: false,

    stunnedUntilMs: 0,

    goalsCleared: 0,
    goalsTotal: 2,
    miniCleared: 0,
    miniTotal: 7,

    grade: '—',
    gradeProvisional: '—',
    _gradeNextMs: 0,
    _celebratedAll: false,

    __magCoachCdMs: 0
  };

  function cacheQuest(ui){
    try { window.__HHA_LAST_QUEST__ = ui; } catch(_) {}
  }

  function computeStatsLive(){
    const goodTotal = Math.max(1, S.nHitGood + S.nExpireGood);
    const accuracyGoodPct = Math.round((S.nHitGood / goodTotal) * 100);
    return { accuracyGoodPct };
  }

  function computeGrade(stats, isFinal=false){
    const acc = clamp(stats.accuracyGoodPct ?? 0, 0, 100);
    const miss = S.misses;

    const gPct = (S.goalsTotal > 0) ? (S.goalsCleared / S.goalsTotal) : 0;
    const mPct = (S.miniTotal > 0) ? (S.miniCleared / S.miniTotal) : 0;

    // ✅ HHA Standard score blend:
    // acc 60% + goals 20% + minis 20% - misses penalty
    let score = 0;
    score += Math.min(60, acc * 0.6);
    score += (gPct * 20);
    score += (mPct * 20);
    score -= Math.min(25, miss * 3.0);

    // final tighten a bit (optional): reward completion slightly
    if (isFinal && gPct >= 1 && mPct >= 1) score += 2;

    if (score >= 92) return 'SSS';
    if (score >= 84) return 'SS';
    if (score >= 76) return 'S';
    if (score >= 62) return 'A';
    if (score >= 48) return 'B';
    return 'C';
  }

  function updateGradeRealtime(force=false){
    const t = nowMs();
    if (!force && t < S._gradeNextMs) return;
    S._gradeNextMs = t + 450;

    const stats = computeStatsLive();
    const g = computeGrade(stats, false);
    S.gradeProvisional = g;
    // during play (not research UI) we can show it realtime
    if (run !== 'research') S.grade = g;
  }

  function emitScore() {
    updateGradeRealtime(false);
    emitEvt('hha:score', {
      score: S.score,
      combo: S.combo,
      misses: S.misses,
      fever: S.fever,
      shield: Math.max(0, Math.ceil(S.shield)),
      grade: (run === 'research') ? undefined : (S.grade ?? S.gradeProvisional), // ✅ realtime grade
      diff: S.diff,
      run: S.run,
      challenge: S.challenge,
      seed: S.seed
    });
  }

  function emitTime() {
    emitEvt('hha:time', {
      timeLeft: Math.max(0, Math.ceil(S.timeLeftSec)),
      timeLeftSec: S.timeLeftSec
    });
  }

  function coach(line, mood = 'neutral', sub = '') {
    emitEvt('hha:coach', { line, mood, sub });
  }

  function setFever(v) {
    S.fever = clamp(v, 0, 100);
    try { FeverUI.setFever?.(S.fever); } catch(_) {}
    emitEvt('hha:fever', { fever: S.fever, shield: S.shield });
  }

  function setShield(sec) {
    S.shield = Math.max(0, Number(sec) || 0);
    try { FeverUI.setShield?.(Math.ceil(S.shield)); } catch(_) {}
    emitEvt('hha:fever', { fever: S.fever, shield: S.shield });
  }

  function stun(kind = 'junk') {
    S.stunnedUntilMs = nowMs() + 550;
    document.body.classList.add('gj-stun');
    setTimeout(() => document.body.classList.remove('gj-stun'), 560);

    if (kind === 'hazard') coach('โดนท่าไม้ตาย! ระวัง Ring/Laser 😵', 'sad', 'ลาก/เอียงเพื่อ “หลบช่องว่าง” หรือเลี่ยงแนวเลเซอร์');
    else coach('โดนขยะ! ระวังนะ 😵', 'sad', 'เล็งดี ๆ เก็บของดีต่อคอมโบ');
  }

  // ---------------- Spawn system ----------------
  const targets = new Map();
  let nextId = 1;

  function makeTarget(type, emoji, xView, yView, ttlSec, extra = {}) {
    const id = String(nextId++);
    const p = viewportToLayerXY(xView, yView);

    const el = document.createElement('div');
    el.className = 'gj-target spawn';
    el.textContent = emoji;

    if (type === 'junk') el.classList.add('gj-junk');
    if (type === 'trap') el.classList.add('gj-fake');
    if (type === 'gold') el.classList.add('gj-gold');
    if (type === 'power') el.classList.add('gj-power');
    if (type === 'boss') el.classList.add('gj-boss');

    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;

    if (type === 'boss') el.style.fontSize = '64px';
    else {
      const base = (diff === 'easy') ? 54 : (diff === 'hard' ? 44 : 48);
      el.style.fontSize = `${base}px`;
    }

    el.dataset.id = id;
    el.dataset.type = type;
    el.setAttribute('role', 'button');

    el.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      tryHitTarget(id, { direct: true });
    }, { passive: false });

    layerEl.appendChild(el);

    const t = {
      id, el, type, emoji,
      xView, yView,
      spawnedMs: nowMs(),
      expireMs: nowMs() + (ttlSec * 1000),
      value: extra.value ?? 0,
      hp: extra.hp ?? 1,
      tag: extra.tag ?? ''
    };

    targets.set(id, t);
    requestAnimationFrame(() => el.classList.remove('spawn'));
    return t;
  }

  function removeTarget(id) {
    const t = targets.get(id);
    if (!t) return;
    targets.delete(id);
    t.el.classList.add('gone');
    setTimeout(() => { try { t.el.remove(); } catch(_) {} }, 160);
  }

  function randomSafeXY() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const x = RNG.rnd(safeMargins.left + 34, w - safeMargins.right - 34);
    const y = RNG.rnd(safeMargins.top + 34, h - safeMargins.bottom - 34);
    return { x, y };
  }

  function clampToSafe(t){
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const pad = 34;
    t.xView = clamp(t.xView, safeMargins.left + pad, w - safeMargins.right - pad);
    t.yView = clamp(t.yView, safeMargins.top + pad,  h - safeMargins.bottom - pad);
  }

  function repaintTarget(t){
    const p = viewportToLayerXY(t.xView, t.yView);
    t.el.style.left = `${p.x}px`;
    t.el.style.top  = `${p.y}px`;
  }

  // ---------------- Magnet physics (tuned) ----------------
  const MAGNET = {
    durationSec: 7.0,       // ✅ tuned (was 8)
    pullStrength: 3.6,      // ✅ tuned (was 4.2)
    antiRadius: 240,        // ✅ tuned (was 260)
    antiStrength: 5.0,      // ✅ tuned (was 6)
    lockRadius: 220         // ✅ tuned (was 260)
  };

  function applyMagnetPull(dtMs){
    if (S.magnet <= 0) return;

    const dt = Math.max(0.001, dtMs / 1000);
    const a  = getAimPoint();
    const now = nowMs();

    const k = 1 - Math.exp(-MAGNET.pullStrength * dt);
    const maxStep = 500 * dt;

    const tNow = now / 1000;
    let linesBudget = 2;

    for (const t of targets.values()) {
      if (!t || !t.el) continue;
      if (!(t.type === 'good' || t.type === 'gold' || t.type === 'power')) continue;

      const dx = a.x - t.xView;
      const dy = a.y - t.yView;
      const dist = hypot(dx, dy);
      if (dist < 10) continue;

      let sx = dx * k;
      let sy = dy * k;

      const stepLen = hypot(sx, sy);
      if (stepLen > maxStep) {
        const s = maxStep / stepLen;
        sx *= s; sy *= s;
      }

      const idn = (Number(t.id) || 0);
      const wob = Math.min(1, dist / 260) * 14;
      sx += Math.sin(tNow * 10 + idn * 0.77) * wob * dt;
      sy += Math.cos(tNow *  9 + idn * 0.61) * wob * dt;

      const mul = (t.type === 'power') ? 0.82 : 1.0;
      t.xView += sx * mul;
      t.yView += sy * mul;

      clampToSafe(t);
      repaintTarget(t);

      if (linesBudget > 0 && now >= magLineNextMs && dist > 70) {
        magLineNextMs = now + 90;
        linesBudget--;
        spawnMagLine(
          t.xView + RNG.rnd(-6, 6),
          t.yView + RNG.rnd(-6, 6),
          a.x + RNG.rnd(-4, 4),
          a.y + RNG.rnd(-4, 4)
        );
      }
    }
  }

  function applyAntiJunkField(dtMs){
    if (S.magnet <= 0) return;

    const dt = Math.max(0.001, dtMs / 1000);
    const a = getAimPoint();
    const radius = MAGNET.antiRadius;
    const r2 = radius * radius;

    const k = 1 - Math.exp(-MAGNET.antiStrength * dt);
    const maxStep = 460 * dt;

    const tNow = nowMs() / 1000;

    for (const t of targets.values()) {
      if (!t || !t.el) continue;
      if (!(t.type === 'junk' || t.type === 'trap')) continue;

      const dx = t.xView - a.x;
      const dy = t.yView - a.y;
      const d2 = dx*dx + dy*dy;
      if (d2 > r2) continue;

      const d = Math.max(1, Math.sqrt(d2));
      const nx = dx / d;
      const ny = dy / d;

      const closeness = 1 - Math.min(1, d / radius);
      let step = (radius * 0.85 * closeness) * k;
      step = Math.min(step, maxStep);

      const swirl = 70 * closeness * dt;
      const sx = (-ny) * swirl * Math.sin(tNow * 7 + (Number(t.id)||0));
      const sy = ( nx) * swirl * Math.cos(tNow * 6 + (Number(t.id)||0));

      t.xView += nx * step + sx;
      t.yView += ny * step + sy;

      clampToSafe(t);
      repaintTarget(t);
    }
  }

  // ---------------- Emojis ----------------
  const EMOJI_GOOD = ['🥦','🥬','🥕','🍎','🍌','🍇','🍊','🥒','🍅','🫐'];
  const EMOJI_JUNK = ['🍟','🍕','🍔','🌭','🍩','🍪','🧁','🍫'];
  const EMOJI_TRAP = ['☠️','💀','🧨','😈'];
  const EMOJI_BOSS = ['😈','👹','🧟'];

  function spawnConfig() {
    const baseInterval = (diff === 'easy') ? 780 : (diff === 'hard' ? 520 : 640);
    const ttl = (diff === 'easy') ? 2.9 : (diff === 'hard' ? 1.9 : 2.3);

    // ✅ research a bit more stable, less power variance
    const junkRatio = (challenge === 'survival') ? 0.40 : 0.30;
    const powerChance = (run === 'research') ? 0.10 : 0.14;
    const goldChance = (challenge === 'boss') ? 0.14 : 0.10;
    return { baseInterval, ttl, junkRatio, powerChance, goldChance };
  }

  // ---------------- Boss hazards (dodgeable) ----------------
  let spawnAccMs = 0;
  let lastTickMs = nowMs();

  let bossHazardAccMs = 0;
  let ringState = { phase: 'idle', t0: 0, fireAt: 0, gapStart: 0, gapSize: 80 };
  let laserState = { phase: 'idle', warnAt: 0, fireAt: 0, yWorld: null };

  function showRing(show) {
    if (!ringEl) return;
    ringEl.classList.toggle('show', !!show);
  }
  function setRingGap(startDeg, sizeDeg) {
    document.documentElement.style.setProperty('--ringGapStart', `${startDeg}deg`);
    document.documentElement.style.setProperty('--ringGapSize', `${sizeDeg}deg`);
  }
  function laserClass(c) {
    if (!laserEl) return;
    laserEl.classList.remove('warn','fire');
    if (c) laserEl.classList.add(c);
  }
  function updateHazardTransforms(){
    const sh = getWorldShift();
    if (ringEl){
      ringEl.style.transform = `translate(-50%,-50%) translate3d(${sh.x.toFixed(1)}px, ${sh.y.toFixed(1)}px, 0)`;
    }
    if (laserEl && laserState.yWorld != null){
      laserEl.style.top = `${(laserState.yWorld + sh.y).toFixed(1)}px`;
    }
  }
  function normalizeDeg(d){
    d = d % 360;
    if (d < 0) d += 360;
    return d;
  }
  function inGap(angleDeg, gapStart, gapSize){
    // gap sector is [gapStart, gapStart+gapSize] (wrap allowed)
    const a = normalizeDeg(angleDeg);
    const s = normalizeDeg(gapStart);
    const e = normalizeDeg(gapStart + gapSize);
    if (gapSize >= 360) return true;
    if (s <= e) return a >= s && a <= e;
    return (a >= s) || (a <= e);
  }
  function playerWorldPos(){
    const a = getAimPoint();
    const sh = getWorldShift();
    return { x: a.x - sh.x, y: a.y - sh.y };
  }
  function ringWouldHit(){
    // compute angle from center to playerWorld
    const p = playerWorldPos();
    const cx = innerWidth / 2;
    const cy = innerHeight / 2;
    const ang = normalizeDeg(Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI);
    const safe = inGap(ang, ringState.gapStart, ringState.gapSize);
    return !safe;
  }
  function laserWouldHit(){
    if (laserState.yWorld == null) return false;
    const p = playerWorldPos();
    const th = 26; // hit thickness
    return Math.abs(p.y - laserState.yWorld) <= th;
  }

  function spawnBoss() {
    if (S.bossSpawned) return;
    S.bossSpawned = true;
    S.bossAlive = true;
    S.bossPhase = 1;

    const hp = (diff === 'easy') ? 14 : (diff === 'hard' ? 28 : 20);
    S.bossHpMax = hp;
    S.bossHp = hp;

    const p = randomSafeXY();
    makeTarget('boss', RNG.pick(EMOJI_BOSS), p.x, p.y, 999, { hp });

    coach('บอสมาแล้ว! ยิงบอสให้แตกก่อนโดนไม้ตาย 😈', 'fever', 'ลาก/เอียงเพื่อหลบ Ring/Laser แล้วเร่งคอมโบ!');
    emitEvt('hha:log_event', { kind:'boss_spawn', ts: Date.now(), hp, seed:S.seed });
  }

  function bossTakeHit(n=1) {
    if (!S.bossAlive) return;
    S.bossHp = Math.max(0, S.bossHp - (Number(n)||0));
    emitEvt('hha:log_event', { kind:'boss_hit', ts: Date.now(), hp: S.bossHp, hpMax: S.bossHpMax });

    const jitter = (diff === 'hard') ? 120 : (diff === 'easy' ? 70 : 95);
    for (const t of targets.values()) {
      if (t.type !== 'boss') continue;
      t.xView = clamp(t.xView + RNG.rnd(-jitter, jitter), safeMargins.left + 60, innerWidth - safeMargins.right - 60);
      t.yView = clamp(t.yView + RNG.rnd(-jitter, jitter), safeMargins.top + 60, innerHeight - safeMargins.bottom - 60);
      repaintTarget(t);
      break;
    }

    if (S.bossHp <= 0) {
      S.bossAlive = false;
      S.bossPhase = 0;
      for (const [id, t] of targets) if (t.type === 'boss') removeTarget(id);

      showRing(false);
      laserClass(null);
      laserState.yWorld = null;

      Particles.celebrate?.('BOSS');
      coach('บอสแตกแล้ว! เก่งมาก 🔥', 'happy', 'กลับไปเก็บของดีต่อเลย!');
      emitEvt('hha:log_event', { kind:'boss_down', ts: Date.now() });

      Q.addMiniProgress(1);
    }
  }

  function hazardDamage(kind='hazard') {
    if (S.shield > 0) {
      coach('โล่กันไว้! ปลอดภัย 🛡️', 'happy', 'รีบเก็บของดีต่อ!');
      emitEvt('hha:log_event', { kind:'hazard_block', ts: Date.now(), hazard: kind });
      return;
    }
    S.misses += 1;
    S.combo = 0;
    setFever(S.fever - 14);
    stun('hazard');
    emitScore();
    emitEvt('hha:log_event', { kind:'hazard_hit', ts: Date.now(), hazard: kind });
  }

  function tickBossHazards(dtMs) {
    if (!S.bossAlive) return;

    bossHazardAccMs += dtMs;

    // Ring (deterministic)
    if (ringState.phase === 'idle' && bossHazardAccMs > 2500) {
      bossHazardAccMs = 0;
      ringState.phase = 'warn';
      ringState.t0 = nowMs();
      ringState.gapStart = RNG.rndi(0, 359);
      ringState.gapSize = RNG.rndi(70, 110);
      setRingGap(ringState.gapStart, ringState.gapSize);
      showRing(true);
      emitEvt('hha:log_event', { kind:'ring_warn', ts: Date.now(), gapStart:ringState.gapStart, gapSize:ringState.gapSize });
    } else if (ringState.phase === 'warn') {
      if ((nowMs() - ringState.t0) > 650) {
        ringState.phase = 'fire';
        ringState.fireAt = nowMs();
        emitEvt('hha:log_event', { kind:'ring_fire', ts: Date.now() });
      }
    } else if (ringState.phase === 'fire') {
      if ((nowMs() - ringState.fireAt) > 800) {
        ringState.phase = 'idle';
        showRing(false);
        // ✅ dodgeable: hit only if NOT in gap
        if (ringWouldHit()) hazardDamage('ring');
        else emitEvt('hha:log_event', { kind:'ring_dodge', ts: Date.now() });
      }
    }

    // Laser (deterministic chance)
    const pLaser = 0.11; // per second-ish
    if (laserState.phase === 'idle' && RNG.random() < (dtMs / 1000) * pLaser) {
      laserState.phase = 'warn';
      laserState.warnAt = nowMs();

      // choose world y inside safe
      const y = RNG.rnd(safeMargins.top + 80, innerHeight - safeMargins.bottom - 80);
      laserState.yWorld = y;

      laserClass('warn');
      emitEvt('hha:log_event', { kind:'laser_warn', ts: Date.now(), y: Math.round(y) });
    } else if (laserState.phase === 'warn') {
      if ((nowMs() - laserState.warnAt) > 450) {
        laserState.phase = 'fire';
        laserState.fireAt = nowMs();
        laserClass('fire');
        emitEvt('hha:log_event', { kind:'laser_fire', ts: Date.now() });
      }
    } else if (laserState.phase === 'fire') {
      if ((nowMs() - laserState.fireAt) > 520) {
        laserState.phase = 'idle';
        laserClass(null);
        // ✅ dodgeable: hit only if crossing the line
        if (laserWouldHit()) hazardDamage('laser');
        else emitEvt('hha:log_event', { kind:'laser_dodge', ts: Date.now() });
        laserState.yWorld = null;
      }
    }
  }

  // ---------------- Quest director ----------------
  const Q = makeQuestDirector({
    diff,
    goalDefs: defs.goals,
    miniDefs: defs.minis,
    maxGoals: 2,
    maxMini: 7,
    onUpdate: (ui) => {
      cacheQuest(ui);
      emitEvt('quest:update', ui);
      emitEvt('hha:quest', ui);

      S.goalsCleared = ui.goalsCleared|0;
      S.goalsTotal = ui.goalsTotal|0;
      S.miniCleared = ui.minisCleared|0;
      S.miniTotal = ui.minisTotal|0;

      if (ui.allDone && !S._celebratedAll){
        S._celebratedAll = true;
        Particles.celebrate?.('ALL');
        emitEvt('hha:celebrate', { type:'ALL', ts: Date.now() });
        coach('ครบทุกภารกิจแล้ว! 🔥 เข้า BONUS ได้เลย', 'happy', (endPolicy==='all' && run==='play') ? 'กำลังจบเกมแบบ All Complete' : 'เล่นต่อเพื่อเก็บคะแนนเพิ่มได้');
      }
    }
  });

  Q.start();

  const initUI = Q.getUIState('init');
  cacheQuest(initUI);
  emitEvt('quest:update', initUI);
  emitEvt('hha:quest', initUI);
  setTimeout(() => {
    try {
      const u2 = Q.getUIState('init-reemit');
      cacheQuest(u2);
      emitEvt('quest:update', u2);
      emitEvt('hha:quest', u2);
    } catch(_) {}
  }, 0);

  // ---------------- Input (shoot) ----------------
  function canAct() { return nowMs() >= S.stunnedUntilMs; }

  function nearestTargetToAim(radiusPx) {
    const a = getAimPoint();
    let best = null;
    let bestD2 = Infinity;

    for (const t of targets.values()) {
      if (!t || !t.el) continue;
      const allow =
        (t.type === 'boss') ||
        (t.type === 'good') ||
        (t.type === 'junk') ||
        (t.type === 'trap') ||
        (t.type === 'gold') ||
        (t.type === 'power');
      if (!allow) continue;

      const d2 = dist2(a.x, a.y, t.xView, t.yView);
      if (d2 < bestD2) { bestD2 = d2; best = t; }
    }
    if (!best) return null;
    return (bestD2 <= radiusPx * radiusPx) ? best : null;
  }

  function tryHitTarget(id, meta = {}) {
    if (!canAct()) return;
    const t = targets.get(String(id));
    if (!t) return;

    const rt = Math.max(0, (nowMs() - t.spawnedMs));
    const isBoss = (t.type === 'boss');

    if (isBoss) {
      S.score += 220;
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 5);
      Particles.burstAt?.(t.xView, t.yView, 'BOSS');
      bossTakeHit(1);
      removeTarget(t.id);

      if (S.bossAlive) {
        const p = randomSafeXY();
        makeTarget('boss', RNG.pick(EMOJI_BOSS), p.x, p.y, 999, { hp: S.bossHp });
      }

      emitScore();
      Q.addMiniProgress(1);
      return;
    }

    removeTarget(t.id);

    if (t.type === 'good') {
      S.nHitGood += 1;
      S.rtGood.push(rt);

      S.score += 120 + Math.min(120, (S.combo * 6));
      S.combo += 1;

      if (S.magnet > 0) {
        S.score += 32;
        S.combo += 1;
        setFever(S.fever + 1.5);
        Particles.burstAt?.(t.xView, t.yView, 'POWER');

        const n = nowMs();
        if (n >= S.__magCoachCdMs) {
          S.__magCoachCdMs = n + 1800;
          coach('แม่เหล็กทำงาน! ดูดของดีเข้าศูนย์กลาง 🧲', 'happy', 'รีบโกยคอมโบ!');
        }
      }

      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 6);

      Particles.scorePop?.(t.xView, t.yView, '+');
      Particles.burstAt?.(t.xView, t.yView, 'GOOD');

      const gDone = Q.addGoalProgress(1).done;
      const mDone = Q.addMiniProgress(1).done;

      if (gDone) { Particles.celebrate?.('GOAL'); coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!'); Q.nextGoal(); }
      if (mDone) { Particles.celebrate?.('MINI'); coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!'); Q.nextMini(); }
      else { if (S.combo % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!'); }

      emitEvt('hha:log_event', { kind:'hit_good', ts: Date.now(), rtMs: Math.round(rt), direct: !!meta.direct, magnet: (S.magnet>0?1:0) });
      emitScore();
      return;
    }

    if (t.type === 'gold') {
      S.score += 350;
      S.combo += 2;
      if (S.magnet > 0) { S.score += 50; S.combo += 1; setFever(S.fever + 2); }
      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 10);
      Particles.celebrate?.('GOLD');
      coach('เจอของพิเศษ! คะแนนพุ่ง ⭐', 'happy', 'รักษาคอมโบ!');
      emitEvt('hha:log_event', { kind:'hit_gold', ts: Date.now(), magnet:(S.magnet>0?1:0) });
      emitScore();
      return;
    }

    if (t.type === 'power') {
      const tag = t.tag || 'magnet';
      if (tag === 'shield') {
        setShield(Math.max(S.shield, 6.0));
        coach('ได้โล่! กันขยะ/ไม้ตายได้ 🛡️', 'happy', 'ช่วงนี้โหดแค่ไหนก็เอาอยู่');
      } else if (tag === 'time') {
        S.timeLeftSec = Math.min(S.durationPlannedSec + 30, S.timeLeftSec + 6);
        coach('บวกเวลา! ⏳', 'happy', 'รีบโกยของดี!');
      } else {
        S.magnet = Math.max(S.magnet, MAGNET.durationSec);
        coach('พลังแม่เหล็ก! 🧲 ของดีจะไหลเข้าศูนย์กลาง', 'happy', 'ขยะจะโดนผลักออกด้วย!');
        Particles.celebrate?.('POWER');
      }
      emitEvt('hha:log_event', { kind:'hit_power', ts: Date.now(), power: tag });
      emitScore();
      return;
    }

    if (t.type === 'junk' || t.type === 'trap') {
      if (S.shield > 0) {
        S.nHitJunkGuard += 1;
        coach('โล่กันไว้! ไม่พลาด 🛡️', 'happy', 'ดีมาก!');
        emitEvt('hha:log_event', { kind:'hit_junk_guard', ts: Date.now(), type: t.type });
        emitScore();
        return;
      }

      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;
      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      emitEvt('hha:log_event', { kind:'hit_junk', ts: Date.now(), type: t.type });

      Q.onJunkHit();
      emitScore();
      return;
    }
  }

  function shoot() {
    if (!canAct()) return;
    const radius = (S.magnet > 0) ? MAGNET.lockRadius : 120;
    const t = nearestTargetToAim(radius);
    if (!t) { emitEvt('hha:log_event', { kind:'shoot_empty', ts: Date.now() }); return; }
    tryHitTarget(t.id, { direct: false });
  }

  shootEl.addEventListener('click', (ev) => { ev.preventDefault(); shoot(); }, { passive: false });

  let tap0 = null;
  layerEl.addEventListener('pointerdown', (ev) => { tap0 = { x: ev.clientX, y: ev.clientY, t: Date.now() }; }, { passive: true });
  layerEl.addEventListener('pointerup', (ev) => {
    if (!tap0) return;
    const dt = Date.now() - tap0.t;
    const dx = Math.abs(ev.clientX - tap0.x);
    const dy = Math.abs(ev.clientY - tap0.y);
    tap0 = null;
    if (dt < 220 && dx < 12 && dy < 12) shoot();
  }, { passive: true });

  // ---------------- Session logging start ----------------
  const startIso = new Date().toISOString();
  S.startedAtIso = startIso;

  emitEvt('hha:log_session', {
    phase: 'start',
    ts: Date.now(),
    timestampIso: startIso,
    projectTag: 'GoodJunkVR',
    runMode: run,
    gameMode: 'GoodJunkVR',
    diff,
    challenge,
    endPolicy,
    seed: S.seed,
    seedRaw: S.seedRaw,
    durationPlannedSec: timeLimitSec,
    sessionId: sessionId || undefined,
    ...context
  });

  coach('พร้อมลุย! เก็บของดี หลีกขยะ 🥦🚫', 'neutral', 'เล็งกลางแล้วกดยิง / ลากจอเพื่อ “เอียงโลก” และหลบ Ring/Laser');
  emitScore();
  emitTime();

  // ---------------- Spawning ----------------
  function spawnOne() {
    const cfg = spawnConfig();
    const { x, y } = randomSafeXY();

    const r = RNG.random();

    if (r < cfg.powerChance) {
      const pr = RNG.random();
      let tag = 'magnet', emoji = '🧲';
      if (pr < 0.34) { tag = 'shield'; emoji = '🛡️'; }
      else if (pr < 0.62) { tag = 'magnet'; emoji = '🧲'; }
      else { tag = 'time'; emoji = '⏳'; }

      makeTarget('power', emoji, x, y, cfg.ttl + 0.5, { tag });
      S.nTargetShieldSpawned += (tag === 'shield') ? 1 : 0;
      S.nTargetDiamondSpawned += (tag === 'time') ? 1 : 0;
      S.nTargetStarSpawned += (tag === 'magnet') ? 1 : 0;

      emitEvt('hha:log_event', { kind:'spawn_power', ts: Date.now(), power: tag });
      return;
    }

    if (r < cfg.powerChance + cfg.goldChance) {
      const emoji = (RNG.random() < 0.55) ? '⭐' : '💎';
      makeTarget('gold', emoji, x, y, cfg.ttl + 0.8, {});
      emitEvt('hha:log_event', { kind:'spawn_gold', ts: Date.now() });
      return;
    }

    const junk = (RNG.random() < cfg.junkRatio);
    if (junk) {
      const isTrap = (RNG.random() < 0.22);
      const emoji = isTrap ? RNG.pick(EMOJI_TRAP) : RNG.pick(EMOJI_JUNK);
      makeTarget(isTrap ? 'trap' : 'junk', emoji, x, y, cfg.ttl, {});
      S.nTargetJunkSpawned += 1;
      emitEvt('hha:log_event', { kind:'spawn_junk', ts: Date.now(), trap: isTrap ? 1 : 0 });
      return;
    }

    makeTarget('good', RNG.pick(EMOJI_GOOD), x, y, cfg.ttl, {});
    S.nTargetGoodSpawned += 1;
    emitEvt('hha:log_event', { kind:'spawn_good', ts: Date.now() });
  }

  function computeStatsFinal() {
    const goodTotal = Math.max(1, S.nHitGood + S.nExpireGood);
    const accuracyGoodPct = Math.round((S.nHitGood / goodTotal) * 100);

    const rt = S.rtGood.slice().sort((a,b)=>a-b);
    const avgRt = rt.length ? Math.round(rt.reduce((s,v)=>s+v,0) / rt.length) : 0;
    const medianRt = rt.length ? Math.round(rt[(rt.length/2)|0]) : 0;

    return { accuracyGoodPct, avgRtGoodMs: avgRt, medianRtGoodMs: medianRt };
  }

  function endGame(reason = 'time') {
    if (ended) return;
    ended = true;

    document.body.classList.remove('gj-panic');
    document.body.classList.remove('gj-magnet');
    showRing(false);
    laserClass(null);
    laserState.yWorld = null;

    for (const id of Array.from(targets.keys())) removeTarget(id);

    const endIso = new Date().toISOString();
    S.endedAtIso = endIso;

    const stats = computeStatsFinal();
    S.grade = computeGrade(stats, true);

    const payload = {
      timestampIso: endIso,
      projectTag: 'GoodJunkVR',
      runMode: run,
      studyId: context.studyId,
      phase: context.phase,
      conditionGroup: context.conditionGroup,
      sessionOrder: context.sessionOrder,
      blockLabel: context.blockLabel,
      siteCode: context.siteCode,
      schoolYear: context.schoolYear,
      semester: context.semester,
      sessionId: sessionId,

      gameMode: 'GoodJunkVR',
      diff,
      challenge,
      endPolicy,
      seed: S.seed,
      durationPlannedSec: timeLimitSec,
      durationPlayedSec: Math.round(S.durationPlayedSec),

      scoreFinal: S.score,
      comboMax: S.comboMax,
      misses: S.misses,

      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal,

      nTargetGoodSpawned: S.nTargetGoodSpawned,
      nTargetJunkSpawned: S.nTargetJunkSpawned,
      nTargetStarSpawned: S.nTargetStarSpawned,
      nTargetDiamondSpawned: S.nTargetDiamondSpawned,
      nTargetShieldSpawned: S.nTargetShieldSpawned,

      nHitGood: S.nHitGood,
      nHitJunk: S.nHitJunk,
      nHitJunkGuard: S.nHitJunkGuard,
      nExpireGood: S.nExpireGood,

      accuracyGoodPct: stats.accuracyGoodPct,
      avgRtGoodMs: stats.avgRtGoodMs,
      medianRtGoodMs: stats.medianRtGoodMs,

      grade: S.grade,

      device: (navigator.userAgent || 'unknown'),
      gameVersion: (context.gameVersion || 'safe-final-pack'),

      reason,
      startTimeIso: S.startedAtIso,
      endTimeIso: S.endedAtIso,

      ...context
    };

    emitEvt('hha:log_session', { phase: 'end', ts: Date.now(), ...payload });
    emitEvt('hha:end', payload);

    coach(`จบเกม! เกรด ${S.grade} 🎉`, 'happy', `Accuracy ${stats.accuracyGoodPct}% • Miss ${S.misses} • ComboMax ${S.comboMax}`);
  }

  // ---------------- Main loop ----------------
  let rafId = 0;
  let ended = false;

  function update(dtMs) {
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs / 1000));
    S.durationPlayedSec = (timeLimitSec - S.timeLeftSec);

    if (S.timeLeftSec <= 8 && S.timeLeftSec > 0) document.body.classList.add('gj-panic');
    else document.body.classList.remove('gj-panic');

    if (S.shield > 0) setShield(S.shield - (dtMs / 1000));
    if (S.magnet > 0) S.magnet = Math.max(0, S.magnet - (dtMs / 1000));
    if (S.slowmo > 0) S.slowmo = Math.max(0, S.slowmo - (dtMs / 1000));

    if (S.magnet > 0) document.body.classList.add('gj-magnet');
    else document.body.classList.remove('gj-magnet');

    if (S.fever >= 100 && S.shield <= 0.01) {
      setFever(0);
      setShield(6.0);
      Particles.celebrate?.('FEVER');
      coach('FEVER เต็ม! ได้โล่ 🛡️', 'fever', 'ช่วงนี้บวกให้สุด!');
    }

    Q.tick();

    applyAntiJunkField(dtMs);
    applyMagnetPull(dtMs);

    const cfg = spawnConfig();
    spawnAccMs += dtMs;

    const interval = cfg.baseInterval;
    while (spawnAccMs >= interval && S.timeLeftSec > 0) {
      spawnAccMs -= interval;

      if ((challenge === 'boss') && !S.bossSpawned && S.timeLeftSec <= (timeLimitSec - 2)) spawnBoss();
      else if ((challenge === 'rush') && !S.bossSpawned && S.score >= 8000) spawnBoss();

      if (S.bossAlive) { if (RNG.random() < 0.55) spawnOne(); }
      else spawnOne();
    }

    const tNow = nowMs();
    for (const [id, t] of targets) {
      if (!t) continue;
      if (t.type === 'boss') continue;

      if (tNow >= t.expireMs) {
        if (t.type === 'good') {
          S.nExpireGood += 1;
          S.misses += 1;
          S.combo = 0;
          setFever(S.fever - 12);
          emitEvt('hha:log_event', { kind:'expire_good', ts: Date.now() });
          emitScore();
        }
        removeTarget(id);
      }
    }

    tickBossHazards(dtMs);
    updateHazardTransforms(); // ✅ keep hazards aligned to world shift
    emitTime();
    emitScore(); // ✅ keep grade fresh + HUD fresh

    // ✅ End policy
    if (run === 'play' && endPolicy === 'all'){
      if (S.goalsCleared >= S.goalsTotal && S.miniCleared >= S.miniTotal){
        endGame('all_complete');
      }
    }
  }

  function raf() {
    const t = nowMs();
    const dt = Math.min(60, Math.max(1, t - lastTickMs));
    lastTickMs = t;

    if (!ended) {
      update(dt);
      if (S.timeLeftSec <= 0) endGame('time');
    }
    rafId = requestAnimationFrame(raf);
  }

  rafId = requestAnimationFrame(raf);

  function getState() {
    return {
      score: S.score,
      combo: S.combo,
      misses: S.misses,
      fever: S.fever,
      shield: Math.ceil(S.shield),
      magnet: Math.ceil(S.magnet),
      bossAlive: S.bossAlive,
      bossPhase: S.bossPhase,
      bossHp: S.bossHp,
      bossHpMax: S.bossHpMax,
      goalsCleared: S.goalsCleared,
      goalsTotal: S.goalsTotal,
      miniCleared: S.miniCleared,
      miniTotal: S.miniTotal,
      grade: S.grade,
      seed: S.seed
    };
  }

  function stop() {
    try { cancelAnimationFrame(rafId); } catch(_) {}
    endGame('stop');
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && run === 'research' && !ended) endGame('hidden');
  }, { passive: true });

  return { getState, stop };
}
