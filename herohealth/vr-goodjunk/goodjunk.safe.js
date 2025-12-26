// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE (PRODUCTION) — Full module
// ✅ Emits quest:update + hha:quest -> Goal/Mini always visible
// ✅ Quest cache: window.__HHA_LAST_QUEST__ (late-bind HUD ไม่พลาด)
// ✅ Stun: screen shake + edge flash
// ✅ Boss mode: boss + ring/laser hazards
// ✅ FEVER -> auto Shield (blocks junk/hazard; junk blocked does NOT count as miss)
// ✅ Miss definition: miss = good expired + junk hit (only if NOT blocked by shield)
// ✅ Works with GoodJunkVR HTML that sets:
//    - window.__GJ_LAYER_OFFSET__
//    - window.__GJ_AIM_POINT__
// and provides #gj-layer, #btnShoot, #atk-ring, #atk-laser

'use strict';

// --------------------------- Utilities ---------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }
function rnd(a, b) { return a + Math.random() * (b - a); }
function rndi(a, b) { return Math.floor(rnd(a, b + 1)); }
function nowMs() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }

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

function viewportToLayerXY(x, y) {
  const off = getLayerOffset();
  return { x: x - off.x, y: y - off.y };
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

// --------------------------- Style injection (stun/panic) ---------------------------
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
    body.gj-stun {
      animation: gjShake .55s linear both;
    }
    body.gj-stun::before{
      content:'';
      position:fixed;
      inset:-20px;
      pointer-events:none;
      z-index: 9999;
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
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index: 9998;
      background:
        radial-gradient(900px 600px at 50% 50%, transparent 55%, rgba(245,158,11,.22) 78%, transparent 92%);
      opacity:.0;
      animation: gjPanic .9s ease-in-out infinite alternate;
      mix-blend-mode: screen;
    }
    @keyframes gjPanic{
      from{ opacity:.10; }
      to{ opacity:.60; }
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
  {
    setFever() {},
    setShield() {},
    setState() {},
  };

// --------------------------- Quest Director (embedded, no dependency) ---------------------------
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
    minisCleared: 0
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
      miniIndex: Math.min(Q.miniIndex + 1, Q.minisTotal)
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
    if(!m || m.done) return;
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

  function addGoalProgress(n=1){
    const g = Q.activeGoal;
    if(!g || g.done) return { done:false };
    g.cur = clamp(g.cur + (Number(n)||0), 0, g.target);
    if(g.cur >= g.target){
      g.done = true;
      Q.goalsCleared++;
      push('goal-complete');
      return { done:true };
    }
    push('goal-progress');
    return { done:false };
  }

  function addMiniProgress(n=1){
    const m = Q.activeMini;
    if(!m || m.done) return { done:false };
    m.cur = clamp(m.cur + (Number(n)||0), 0, m.target);
    if(m.cur >= m.target){
      m.done = true;
      Q.minisCleared++;
      push('mini-complete');
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
    Q.goalIndex++;
    if(Q.goalIndex >= Q.goalsTotal){
      Q.activeGoal = null;
      push('all-goals-done');
      return { ended:true };
    }
    Q.activeGoal = pickGoal(Q.goalIndex);
    push('next-goal');
    return { ended:false };
  }

  function nextMini(){
    Q.miniIndex++;
    if(Q.miniIndex >= Q.minisTotal){
      Q.activeMini = null;
      push('all-minis-done');
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
    if(m && !m.done && m.forbidJunk){
      failMini('hit-junk');
    }
  }

  function getUIState(reason='state'){ return ui(reason); }

  return { start, tick, addGoalProgress, addMiniProgress, nextGoal, nextMini, failMini, onJunkHit, getUIState };
}

// --------------------------- Default quest defs (2 goals + 7 minis) ---------------------------
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
      target: 6, timeLimitSec: 14, forbidJunk: (challenge !== 'boss') },
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

  // Quest defs
  const defs = makeDefaultQuestDefs(diff, challenge);

  // Internal state
  const S = {
    startedAtIso: null,
    endedAtIso: null,
    gameMode: 'GoodJunkVR',
    diff,
    run,
    challenge,
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

    grade: '—'
  };

  // ✅ helper: cache quest state for late-bind HUD
  function cacheQuest(ui){
    try { window.__HHA_LAST_QUEST__ = ui; } catch(_) {}
  }

  function emitScore() {
    emitEvt('hha:score', {
      score: S.score,
      combo: S.combo,
      misses: S.misses,
      fever: S.fever,
      shield: Math.max(0, Math.ceil(S.shield)),
      diff: S.diff,
      run: S.run,
      challenge: S.challenge
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
    try { FeverUI.setShield