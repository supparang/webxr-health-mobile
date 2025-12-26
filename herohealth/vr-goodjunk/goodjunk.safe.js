// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE (PRODUCTION) — Full module (MAGNET FULL PACK)
// ✅ Quest emits: quest:update + hha:quest (cache: window.__HHA_LAST_QUEST__)
// ✅ Stun: screen shake + edge flash
// ✅ Boss mode: boss + ring/laser hazards
// ✅ FEVER -> auto Shield (blocks junk/hazard; junk blocked does NOT count as miss)
// ✅ Miss definition: miss = good expired + junk hit (only if NOT blocked by shield)
// ✅ MAGNET FULL PACK:
//    - Real pull toward crosshair (good/gold/power only)
//    - Anti-junk field (push junk/trap away within radius while magnet active)
//    - Magnet field lines FX + crosshair glow + aura
//    - Magnet bonus: extra score + extra combo + fever boost on good hits

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

function hypot(dx, dy){ return Math.hypot(dx, dy); }

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
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index: 9997;
      background: radial-gradient(700px 500px at 50% 62%, rgba(34,197,94,.085), transparent 60%);
      opacity:.95;
      mix-blend-mode: screen;
    }

    /* ---- Magnet field lines layer ---- */
    .gj-mline-layer{
      position:fixed;
      inset:0;
      z-index: 32; /* above targets (20), under hazards (33) + HUD (40) */
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

  // rate limit for magnet lines
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
    line.style.height = `${rndi(2, 4)}px`;

    layer.appendChild(line);
    // cleanup
    setTimeout(() => { try { line.remove(); } catch(_) {} }, 320);
  }

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

    grade: '—',

    // magnet helpers
    __magCoachCdMs: 0
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
    try { FeverUI.setShield?.(Math.ceil(S.shield)); } catch(_) {}
    emitEvt('hha:fever', { fever: S.fever, shield: S.shield });
  }

  function stun(kind = 'junk') {
    S.stunnedUntilMs = nowMs() + 550;
    document.body.classList.add('gj-stun');
    setTimeout(() => document.body.classList.remove('gj-stun'), 560);

    if (kind === 'hazard') coach('โดนท่าไม้ตาย! ระวัง Ring/Laser 😵', 'sad', 'พยายามเก็บโล่หรือทำ FEVER เพื่อกันดาเมจ');
    else coach('โดนขยะ! ระวังนะ 😵', 'sad', 'เล็งดี ๆ เก็บของดีให้ต่อคอมโบ');
  }

  // Spawn system
  const targets = new Map();
  let nextId = 1;

  function makeTarget(type, emoji, xView, yView, ttlSec, extra = {}) {
    const id = String(nextId++);
    const p = viewportToLayerXY(xView, yView);

    const el = document.createElement('div');
    el.className = 'gj-target spawn';
    el.textContent = emoji;

    if (type === 'junk') el.classList.add('gj-junk');
    if (type === 'fake') el.classList.add('gj-fake');
    if (type === 'gold') el.classList.add('gj-gold');
    if (type === 'power') el.classList.add('gj-power');
    if (type === 'boss') el.classList.add('gj-boss');

    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;

    if (type === 'boss') {
      el.style.fontSize = '64px';
    } else {
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
      id,
      el,
      type,
      emoji,
      xView,
      yView,
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

  // Safe spawn coords (viewport)
  function randomSafeXY() {
    const w = Math.max(1, window.innerWidth);
    const h = Math.max(1, window.innerHeight);
    const x = rnd(safeMargins.left + 34, w - safeMargins.right - 34);
    const y = rnd(safeMargins.top + 34, h - safeMargins.bottom - 34);
    return { x, y };
  }

  // --------------------------- Magnet physics (REAL pull + anti-junk + FX lines) ---------------------------
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

  function applyMagnetPull(dtMs){
    if (S.magnet <= 0) return;

    const dt = Math.max(0.001, dtMs / 1000);
    const a  = getAimPoint(); // viewport coords
    const now = nowMs();

    // pull strength
    const strength = 4.2;
    const k = 1 - Math.exp(-strength * dt);

    // limit per frame
    const maxStep = 540 * dt;

    const tNow = now / 1000;
    let linesBudget = 2; // draw at most 2 lines per frame (safe)

    for (const t of targets.values()) {
      if (!t || !t.el) continue;

      // ✅ pull only these
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

      // wobble
      const idn = (Number(t.id) || 0);
      const wob = Math.min(1, dist / 260) * 18; // px/sec
      sx += Math.sin(tNow * 10 + idn * 0.77) * wob * dt;
      sy += Math.cos(tNow *  9 + idn * 0.61) * wob * dt;

      // power pull slightly less
      const mul = (t.type === 'power') ? 0.82 : 1.0;

      // move
      t.xView += sx * mul;
      t.yView += sy * mul;

      clampToSafe(t);
      repaintTarget(t);

      // field lines FX (rate-limited)
      if (linesBudget > 0 && now >= magLineNextMs && dist > 60) {
        magLineNextMs = now + 70; // ~14 lines/sec max
        linesBudget--;

        // draw from target -> aim (slightly jitter)
        spawnMagLine(
          t.xView + rnd(-6, 6),
          t.yView + rnd(-6, 6),
          a.x + rnd(-4, 4),
          a.y + rnd(-4, 4)
        );
      }
    }
  }

  function applyAntiJunkField(dtMs){
    if (S.magnet <= 0) return;

    const dt = Math.max(0.001, dtMs / 1000);
    const a = getAimPoint();
    const radius = 260;      // push range
    const r2 = radius * radius;

    const pushStrength = 6.0;  // higher = stronger repel
    const k = 1 - Math.exp(-pushStrength * dt);
    const maxStep = 520 * dt;

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

      // repel more when closer
      const closeness = 1 - Math.min(1, d / radius);
      let step = (radius * 0.95 * closeness) * k;

      // cap per frame
      step = Math.min(step, maxStep);

      // little swirl
      const swirl = 80 * closeness * dt;
      const sx = (-ny) * swirl * Math.sin(tNow * 7 + (Number(t.id)||0));
      const sy = ( nx) * swirl * Math.cos(tNow * 6 + (Number(t.id)||0));

      t.xView += nx * step + sx;
      t.yView += ny * step + sy;

      clampToSafe(t);
      repaintTarget(t);
    }
  }

  // Emojis
  const EMOJI_GOOD = ['🥦','🥬','🥕','🍎','🍌','🍇','🍊','🥒','🍅','🫐'];
  const EMOJI_JUNK = ['🍟','🍕','🍔','🌭','🍩','🍪','🧁','🍫'];
  const EMOJI_TRAP = ['☠️','💀','🧨','😈'];
  const EMOJI_GOLD = ['⭐','💎'];
  const EMOJI_POWER = ['🛡️','🧲','⏳'];
  const EMOJI_BOSS = ['😈','👹','🧟'];

  function spawnConfig() {
    const d = diff;
    const baseInterval = (d === 'easy') ? 780 : (d === 'hard' ? 520 : 640);
    const ttl = (d === 'easy') ? 2.9 : (d === 'hard' ? 1.9 : 2.3);
    const junkRatio = (challenge === 'survival') ? 0.40 : 0.30;
    const powerChance = (run === 'research') ? 0.10 : 0.14;
    const goldChance = (challenge === 'boss') ? 0.14 : 0.10;
    return { baseInterval, ttl, junkRatio, powerChance, goldChance };
  }

  let spawnAccMs = 0;
  let lastTickMs = nowMs();

  // Boss hazards timers
  let bossHazardAccMs = 0;
  let ringState = { phase: 'idle', t0: 0, fireAt: 0, gapStart: 0, gapSize: 80 };
  let laserState = { phase: 'idle', t0: 0, warnAt: 0, fireAt: 0 };

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

  function spawnBoss() {
    if (S.bossSpawned) return;
    S.bossSpawned = true;
    S.bossAlive = true;
    S.bossPhase = 1;

    const hp = (diff === 'easy') ? 14 : (diff === 'hard' ? 28 : 20);
    S.bossHpMax = hp;
    S.bossHp = hp;

    const p = randomSafeXY();
    const emoji = EMOJI_BOSS[rndi(0, EMOJI_BOSS.length - 1)];
    makeTarget('boss', emoji, p.x, p.y, 999, { hp });

    coach('บอสมาแล้ว! ยิงบอสให้แตกก่อนโดนไม้ตาย 😈', 'fever', 'ระวัง Ring/Laser แล้วเร่งคอมโบ!');
    emitEvt('hha:log_event', { kind:'boss_spawn', ts: Date.now(), hp });
  }

  function bossTakeHit(n=1) {
    if (!S.bossAlive) return;
    S.bossHp = Math.max(0, S.bossHp - (Number(n)||0));
    emitEvt('hha:log_event', { kind:'boss_hit', ts: Date.now(), hp: S.bossHp, hpMax: S.bossHpMax });

    const jitter = (diff === 'hard') ? 120 : (diff === 'easy' ? 70 : 95);
    for (const t of targets.values()) {
      if (t.type !== 'boss') continue;
      const nx = clamp(t.xView + rnd(-jitter, jitter), safeMargins.left + 60, innerWidth - safeMargins.right - 60);
      const ny = clamp(t.yView + rnd(-jitter, jitter), safeMargins.top + 60, innerHeight - safeMargins.bottom - 60);
      t.xView = nx; t.yView = ny;
      repaintTarget(t);
      break;
    }

    if (S.bossHp <= 0) {
      S.bossAlive = false;
      S.bossPhase = 0;
      for (const [id, t] of targets) {
        if (t.type === 'boss') removeTarget(id);
      }
      showRing(false);
      laserClass(null);

      Particles.celebrate?.('BOSS');
      coach('บอสแตกแล้ว! เก่งมาก 🔥', 'happy', 'กลับไปเก็บของดีต่อเลย!');
      emitEvt('hha:log_event', { kind:'boss_down', ts: Date.now() });

      // bonus: progress mini a bit
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

    if (ringState.phase === 'idle' && bossHazardAccMs > 2500) {
      bossHazardAccMs = 0;
      ringState.phase = 'warn';
      ringState.t0 = nowMs();
      ringState.gapStart = rndi(0, 359);
      ringState.gapSize = rndi(70, 110);
      setRingGap(ringState.gapStart, ringState.gapSize);
      showRing(true);
      emitEvt('hha:log_event', { kind:'ring_warn', ts: Date.now(), gapStart:ringState.gapStart, gapSize:ringState.gapSize });
    } else if (ringState.phase === 'warn') {
      const t = nowMs() - ringState.t0;
      if (t > 650) {
        ringState.phase = 'fire';
        ringState.fireAt = nowMs();
        emitEvt('hha:log_event', { kind:'ring_fire', ts: Date.now() });
      }
    } else if (ringState.phase === 'fire') {
      const t = nowMs() - ringState.fireAt;
      if (t > 800) {
        ringState.phase = 'idle';
        showRing(false);
        hazardDamage('ring');
      }
    }

    if (laserState.phase === 'idle' && Math.random() < (dtMs / 1000) * 0.12) {
      laserState.phase = 'warn';
      laserState.warnAt = nowMs();
      laserClass('warn');
      emitEvt('hha:log_event', { kind:'laser_warn', ts: Date.now() });
    } else if (laserState.phase === 'warn') {
      const t = nowMs() - laserState.warnAt;
      if (t > 450) {
        laserState.phase = 'fire';
        laserState.fireAt = nowMs();
        laserClass('fire');
        emitEvt('hha:log_event', { kind:'laser_fire', ts: Date.now() });
      }
    } else if (laserState.phase === 'fire') {
      const t = nowMs() - laserState.fireAt;
      if (t > 520) {
        laserState.phase = 'idle';
        laserClass(null);
        hazardDamage('laser');
      }
    }
  }

  // Quest director (always emits quest:update)
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
    }
  });

  // Start quest now (so Goal/Mini shows immediately)
  Q.start();

  // init push + cache + re-emit (0ms) กัน listener bind ช้า
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

  // --------------------------- Input (shoot) ---------------------------
  function canAct() {
    return nowMs() >= S.stunnedUntilMs;
  }

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
      if (d2 < bestD2) {
        bestD2 = d2;
        best = t;
      }
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
        makeTarget('boss', EMOJI_BOSS[rndi(0, EMOJI_BOSS.length - 1)], p.x, p.y, 999, { hp: S.bossHp });
      }

      emitScore();
      Q.addMiniProgress(1);
      return;
    }

    removeTarget(t.id);

    if (t.type === 'good') {
      S.nHitGood += 1;
      S.rtGood.push(rt);

      // base
      S.score += 120 + Math.min(120, (S.combo * 6));
      S.combo += 1;

      // ✅ Magnet bonus (ALL IN)
      if (S.magnet > 0) {
        S.score += 40;           // bonus score
        S.combo += 1;            // extra combo tick
        setFever(S.fever + 2);   // extra fever
        Particles.burstAt?.(t.xView, t.yView, 'POWER');

        // tiny coach cooldown
        const n = nowMs();
        if (n >= S.__magCoachCdMs) {
          S.__magCoachCdMs = n + 1800;
          coach('แม่เหล็กกำลังทำงาน! ดูดของดีเข้าศูนย์กลาง 🧲', 'happy', 'รีบโกยคอมโบให้สุด!');
        }
      }

      S.comboMax = Math.max(S.comboMax, S.combo);
      setFever(S.fever + 6);

      Particles.scorePop?.(t.xView, t.yView, '+');
      Particles.burstAt?.(t.xView, t.yView, 'GOOD');

      const gDone = Q.addGoalProgress(1).done;
      const mDone = Q.addMiniProgress(1).done;

      if (gDone) {
        Particles.celebrate?.('GOAL');
        coach('Goal ผ่านแล้ว! ไปต่อ 🔥', 'happy', 'เป้าถัดไปมาแล้ว!');
        Q.nextGoal();
      }

      if (mDone) {
        Particles.celebrate?.('MINI');
        coach('Mini ผ่าน! สุดจัด ⚡', 'happy', 'ต่ออีกอันเลย!');
        Q.nextMini();
      } else {
        if (S.combo % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!');
      }

      emitEvt('hha:log_event', { kind:'hit_good', ts: Date.now(), rtMs: Math.round(rt), direct: !!meta.direct, magnet: (S.magnet>0?1:0) });
      emitScore();
      return;
    }

    if (t.type === 'gold') {
      S.score += 350;
      S.combo += 2;
      if (S.magnet > 0) { S.score += 60; S.combo += 1; setFever(S.fever + 3); }
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
        // 🧲 magnet
        S.magnet = Math.max(S.magnet, 8.0);
        coach('พลังแม่เหล็ก! 🧲 ของดีจะไหลเข้าศูนย์กลาง', 'happy', 'ระวัง—ขยะจะโดนผลักออกด้วย!');
        Particles.celebrate?.('POWER');
      }
      emitEvt('hha:log_event', { kind:'hit_power', ts: Date.now(), power: tag });
      emitScore();
      return;
    }

    if (t.type === 'junk' || t.type === 'trap') {
      if (S.shield > 0) {
        // blocked => NO MISS
        S.nHitJunkGuard += 1;
        coach('โล่กันไว้! ไม่พลาด 🛡️', 'happy', 'ดีมาก!');
        emitEvt('hha:log_event', { kind:'hit_junk_guard', ts: Date.now(), type: t.type });
        emitScore();
        // ✅ guard แล้ว "ไม่" fail forbidJunk mini
        return;
      }

      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;
      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      emitEvt('hha:log_event', { kind:'hit_junk', ts: Date.now(), type: t.type });

      // forbid-junk minis fail
      Q.onJunkHit();

      emitScore();
      return;
    }
  }

  function shoot() {
    if (!canAct()) return;
    const baseR = 120;
    const radius = (S.magnet > 0) ? 260 : baseR; // ✅ magnet: wider lock
    const t = nearestTargetToAim(radius);

    if (!t) {
      emitEvt('hha:log_event', { kind:'shoot_empty', ts: Date.now() });
      return;
    }

    tryHitTarget(t.id, { direct: false });
  }

  shootEl.addEventListener('click', (ev) => { ev.preventDefault(); shoot(); }, { passive: false });

  let tap0 = null;
  layerEl.addEventListener('pointerdown', (ev) => {
    tap0 = { x: ev.clientX, y: ev.clientY, t: Date.now() };
  }, { passive: true });

  layerEl.addEventListener('pointerup', (ev) => {
    if (!tap0) return;
    const dt = Date.now() - tap0.t;
    const dx = Math.abs(ev.clientX - tap0.x);
    const dy = Math.abs(ev.clientY - tap0.y);
    tap0 = null;
    if (dt < 220 && dx < 12 && dy < 12) shoot();
  }, { passive: true });

  // --------------------------- Start session logging ---------------------------
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
    durationPlannedSec: timeLimitSec,
    sessionId: sessionId || undefined,
    ...context
  });

  // Initial HUD/Coach
  coach('พร้อมลุย! เก็บของดี หลีกขยะ 🥦🚫', 'neutral', 'เล็งกลางแล้วกดยิง / ลากจอเพื่อ “เอียงโลก” แบบ VR');
  emitScore();
  emitTime();

  // --------------------------- Main loop ---------------------------
  let rafId = 0;
  let ended = false;

  function spawnOne() {
    const cfg = spawnConfig();
    const { x, y } = randomSafeXY();

    const r = Math.random();

    if (r < cfg.powerChance) {
      const pr = Math.random();
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
      const emoji = (Math.random() < 0.55) ? '⭐' : '💎';
      makeTarget('gold', emoji, x, y, cfg.ttl + 0.8, {});
      emitEvt('hha:log_event', { kind:'spawn_gold', ts: Date.now() });
      return;
    }

    const junk = (Math.random() < cfg.junkRatio);
    if (junk) {
      const isTrap = (Math.random() < 0.22);
      const emoji = isTrap ? EMOJI_TRAP[rndi(0, EMOJI_TRAP.length - 1)] : EMOJI_JUNK[rndi(0, EMOJI_JUNK.length - 1)];
      makeTarget(isTrap ? 'trap' : 'junk', emoji, x, y, cfg.ttl, {});
      S.nTargetJunkSpawned += 1;
      emitEvt('hha:log_event', { kind:'spawn_junk', ts: Date.now(), trap: isTrap ? 1 : 0 });
      return;
    }

    const emoji = EMOJI_GOOD[rndi(0, EMOJI_GOOD.length - 1)];
    makeTarget('good', emoji, x, y, cfg.ttl, {});
    S.nTargetGoodSpawned += 1;
    emitEvt('hha:log_event', { kind:'spawn_good', ts: Date.now() });
  }

  function computeStats() {
    const goodTotal = Math.max(1, S.nHitGood + S.nExpireGood);
    const accuracyGoodPct = Math.round((S.nHitGood / goodTotal) * 100);

    const rt = S.rtGood.slice().sort((a,b)=>a-b);
    const avgRt = rt.length ? Math.round(rt.reduce((s,v)=>s+v,0) / rt.length) : 0;
    const medianRt = rt.length ? Math.round(rt[(rt.length/2)|0]) : 0;

    return { accuracyGoodPct, avgRtGoodMs: avgRt, medianRtGoodMs: medianRt };
  }

  function computeGrade(stats) {
    const acc = stats.accuracyGoodPct;
    const miss = S.misses;
    const gPct = (S.goalsTotal > 0) ? (S.goalsCleared / S.goalsTotal) : 0;
    const mPct = (S.miniTotal > 0) ? (S.miniCleared / S.miniTotal) : 0;

    let score = 0;
    score += Math.min(60, acc * 0.6);
    score += (gPct * 20);
    score += (mPct * 20);
    score -= Math.min(25, miss * 3.0);

    if (score >= 92) return 'SSS';
    if (score >= 84) return 'SS';
    if (score >= 76) return 'S';
    if (score >= 62) return 'A';
    if (score >= 48) return 'B';
    return 'C';
  }

  function endGame(reason = 'time') {
    if (ended) return;
    ended = true;

    document.body.classList.remove('gj-panic');
    document.body.classList.remove('gj-magnet');
    showRing(false);
    laserClass(null);

    for (const id of Array.from(targets.keys())) removeTarget(id);

    const endIso = new Date().toISOString();
    S.endedAtIso = endIso;

    const stats = computeStats();
    S.grade = computeGrade(stats);

    const missLimit = (diff === 'easy') ? 6 : (diff === 'hard' ? 3 : 4);
    if (S.goalsCleared < 2 && S.misses <= missLimit) {
      S.goalsCleared = Math.min(S.goalsTotal, S.goalsCleared + 1);

      const u = Object.assign(Q.getUIState('end-sync'), { goalsCleared: S.goalsCleared, goalsTotal: S.goalsTotal });
      cacheQuest(u);
      emitEvt('quest:update', u);
      emitEvt('hha:quest', u);
    }

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
      gameVersion: (context.gameVersion || 'safe-full-magnet'),

      reason,

      startTimeIso: S.startedAtIso,
      endTimeIso: S.endedAtIso,

      ...context
    };

    emitEvt('hha:log_session', { phase: 'end', ts: Date.now(), ...payload });
    emitEvt('hha:end', payload);

    coach(`จบเกม! เกรด ${S.grade} 🎉`, 'happy', `Accuracy ${stats.accuracyGoodPct}% • Miss ${S.misses} • ComboMax ${S.comboMax}`);
  }

  function update(dtMs) {
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs / 1000));
    S.durationPlayedSec = (timeLimitSec - S.timeLeftSec);

    if (S.timeLeftSec <= 8 && S.timeLeftSec > 0) document.body.classList.add('gj-panic');
    else document.body.classList.remove('gj-panic');

    if (S.shield > 0) setShield(S.shield - (dtMs / 1000));
    if (S.magnet > 0) S.magnet = Math.max(0, S.magnet - (dtMs / 1000));
    if (S.slowmo > 0) S.slowmo = Math.max(0, S.slowmo - (dtMs / 1000));

    // ✅ Magnet class toggle
    if (S.magnet > 0) document.body.classList.add('gj-magnet');
    else document.body.classList.remove('gj-magnet');

    if (S.fever >= 100 && S.shield <= 0.01) {
      setFever(0);
      setShield(6.0);
      Particles.celebrate?.('FEVER');
      coach('FEVER เต็ม! ได้โล่ 🛡️', 'fever', 'ช่วงนี้บวกให้สุด!');
    }

    Q.tick();

    // ✅ REAL magnet forces (ALL)
    applyAntiJunkField(dtMs);
    applyMagnetPull(dtMs);

    const cfg = spawnConfig();
    const slowFactor = (S.slowmo > 0) ? 0.7 : 1.0;
    spawnAccMs += dtMs;

    const interval = cfg.baseInterval / slowFactor;

    while (spawnAccMs >= interval && S.timeLeftSec > 0) {
      spawnAccMs -= interval;

      if ((challenge === 'boss') && !S.bossSpawned && S.timeLeftSec <= (timeLimitSec - 2)) {
        spawnBoss();
      } else if ((challenge === 'rush') && !S.bossSpawned && S.score >= 8000) {
        spawnBoss();
      }

      if (S.bossAlive) {
        if (Math.random() < 0.55) spawnOne();
      } else {
        spawnOne();
      }
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
    emitTime();
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
      grade: S.grade
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