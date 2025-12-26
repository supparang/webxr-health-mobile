// === /herohealth/vr-goodjunk/goodjunk.safe.js ===
// GoodJunkVR — SAFE (PRODUCTION) — Full module (Quest = external)
// ✅ Emits quest:update -> Goal/Mini always visible (via quest-goodjunk.js)
// ✅ Stun: screen shake + edge flash
// ✅ Boss mode: boss + ring/laser hazards
// ✅ FEVER -> auto Shield (blocks junk/hazard; junk blocked does NOT count as miss)
// ✅ Miss definition: miss = good expired + junk hit (only if NOT blocked by shield)
// ✅ Works with GoodJunkVR HTML that sets:
//    - window.__GJ_LAYER_OFFSET__
//    - window.__GJ_AIM_POINT__
// and provides #gj-layer, #btnShoot, #atk-ring, #atk-laser

'use strict';

import { createVRGoodjunkQuest } from './quest-goodjunk.js';

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

  // Internal state
  const S = {
    // meta
    startedAtIso: null,
    endedAtIso: null,
    gameMode: 'GoodJunkVR',
    diff,
    run,
    challenge,
    durationPlannedSec: timeLimitSec,
    durationPlayedSec: 0,

    // scoring
    score: 0,
    combo: 0,
    comboMax: 0,

    // miss (per spec)
    misses: 0,

    // time
    timeLeftSec: timeLimitSec,

    // fever/shield
    fever: 0,       // 0..100
    shield: 0,      // seconds left
    magnet: 0,      // seconds left
    slowmo: 0,      // seconds left

    // quest helpers (for defs eval)
    streakGood: 0,
    goldHitsThisMini: false,
    safeNoJunkSeconds: 0, // นับวินาที “ไม่โดน junk แบบไม่ guard” ตั้งแต่เริ่ม mini/หลังโดนครั้งล่าสุด

    // counts for research/logging
    nTargetGoodSpawned: 0,
    nTargetJunkSpawned: 0,
    nTargetStarSpawned: 0,
    nTargetDiamondSpawned: 0,
    nTargetShieldSpawned: 0,

    nHitGood: 0,
    nHitJunk: 0,
    nHitJunkGuard: 0,
    nExpireGood: 0,

    // reaction time
    rtGood: [],

    // boss
    bossAlive: false,
    bossPhase: 0,
    bossHp: 0,
    bossHpMax: 0,
    bossSpawned: false,

    // control
    stunnedUntilMs: 0,

    // quest derived (for end summary)
    goalsCleared: 0,
    goalsTotal: 0,
    miniCleared: 0,
    miniTotal: 0,

    // grade
    grade: '—'
  };

  // UI update helper (score/coach/time)
  function emitScore() {
    emitEvt('hha:score', {
      score: S.score,
      combo: S.combo,
      misses: S.misses,
      fever: S.fever,
      shield: Math.max(0, Math.ceil(S.shield)),
      grade: S.grade,
      diff: S.diff,
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
  const targets = new Map(); // id -> {el,type,x,y,spawnedMs,expireMs,value,hp,...}
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
    if (type === 'trap') el.classList.add('gj-trap');

    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;

    // Size tuning
    if (type === 'boss') {
      el.style.fontSize = '64px';
    } else {
      const base = (diff === 'easy') ? 54 : (diff === 'hard' ? 44 : 48);
      el.style.fontSize = `${base}px`;
    }

    el.dataset.id = id;
    el.dataset.type = type;
    el.setAttribute('role', 'button');

    // tap directly => hit that target (mobile friendly)
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

  // Choose emojis
  const EMOJI_GOOD = ['🥦','🥬','🥕','🍎','🍌','🍇','🍊','🥒','🍅','🫐'];
  const EMOJI_JUNK = ['🍟','🍕','🍔','🌭','🍩','🍪','🧁','🍫'];
  const EMOJI_TRAP = ['☠️','💀','🧨','😈'];
  const EMOJI_GOLD = ['⭐','💎'];
  const EMOJI_POWER = ['🛡️','🧲','⏳']; // shield, magnet, time
  const EMOJI_BOSS = ['😈','👹','🧟'];

  // Spawn pacing
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

    // move boss a bit (more in hard)
    const jitter = (diff === 'hard') ? 120 : (diff === 'easy' ? 70 : 95);
    for (const t of targets.values()) {
      if (t.type !== 'boss') continue;
      const nx = clamp(t.xView + rnd(-jitter, jitter), safeMargins.left + 60, innerWidth - safeMargins.right - 60);
      const ny = clamp(t.yView + rnd(-jitter, jitter), safeMargins.top + 60, innerHeight - safeMargins.bottom - 60);
      t.xView = nx; t.yView = ny;
      const p = viewportToLayerXY(nx, ny);
      t.el.style.left = `${p.x}px`;
      t.el.style.top = `${p.y}px`;
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
    }
  }

  function hazardDamage(kind='hazard') {
    if (S.shield > 0) {
      coach('โล่กันไว้! ปลอดภัย 🛡️', 'happy', 'รีบเก็บของดีต่อ!');
      emitEvt('hha:log_event', { kind:'hazard_block', ts: Date.now(), hazard: kind });
      return;
    }
    // hazard hit counts as miss (เหมือน junk hit)
    S.misses += 1;
    S.combo = 0;
    S.streakGood = 0;
    S.safeNoJunkSeconds = 0;

    setFever(S.fever - 14);
    stun('hazard');
    emitScore();
    emitEvt('hha:log_event', { kind:'hazard_hit', ts: Date.now(), hazard: kind });
  }

  function tickBossHazards(dtMs) {
    if (!S.bossAlive) return;

    bossHazardAccMs += dtMs;

    // Ring cycle: warn 650ms, fire 800ms
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

    // Laser cycle: warn 450ms, fire 520ms
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

  // --------------------------- Quest (external) ---------------------------
  function questSnapshot(){
    return {
      goodHits: S.nHitGood|0,
      comboMax: S.comboMax|0,
      streakGood: S.streakGood|0,
      goldHitsThisMini: S.goldHitsThisMini ? 1 : 0,
      safeNoJunkSeconds: (S.safeNoJunkSeconds|0),
      misses: S.misses|0
    };
  }

  function resetMiniTrackers(){
    S.goldHitsThisMini = false;
    S.safeNoJunkSeconds = 0;
    S.streakGood = 0;
  }

  const Q = createVRGoodjunkQuest(diff, {
    onUpdate: (ui) => {
      emitEvt('quest:update', ui);

      // sync totals for end summary
      S.goalsCleared = ui.goalsCleared|0;
      S.goalsTotal   = ui.goalsTotal|0;
      S.miniCleared  = ui.minisCleared|0;
      S.miniTotal    = ui.minisTotal|0;

      // reset trackers at mini boundaries
      const r = String(ui.reason || '');
      if (r.startsWith('start') || r.startsWith('next-mini') || r.startsWith('mini-fail')) {
        resetMiniTrackers();
      }
    }
  });

  Q.start();
  emitEvt('quest:update', Q.getUIState('init'));

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

      const allow = (t.type === 'boss') || (t.type === 'good') || (t.type === 'junk') || (t.type === 'trap') || (t.type === 'gold') || (t.type === 'power');
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

      emitEvt('hha:log_event', { kind:'boss_hit', ts: Date.now(), rtMs: Math.round(rt), direct: !!meta.direct });
      emitScore();

      // quest eval tick
      Q.updateFromState?.(questSnapshot(), 'boss_hit');
      return;
    }

    removeTarget(t.id);

    if (t.type === 'good') {
      S.nHitGood += 1;
      S.rtGood.push(rt);

      S.score += 120 + Math.min(120, (S.combo * 6));
      S.combo += 1;
      S.comboMax = Math.max(S.comboMax, S.combo);

      S.streakGood += 1;

      setFever(S.fever + 6);

      Particles.scorePop?.(t.xView, t.yView, '+');
      Particles.burstAt?.(t.xView, t.yView, 'GOOD');

      emitEvt('hha:log_event', { kind:'hit_good', ts: Date.now(), rtMs: Math.round(rt), direct: !!meta.direct });
      emitScore();

      Q.updateFromState?.(questSnapshot(), 'hit_good');

      if (S.combo % 7 === 0) coach('คอมโบมาแล้ว! ดีมาก 🔥', 'happy', 'รักษาจังหวะ!');
      return;
    }

    if (t.type === 'gold') {
      S.score += 350;
      S.combo += 2;
      S.comboMax = Math.max(S.comboMax, S.combo);

      S.goldHitsThisMini = true;

      setFever(S.fever + 10);
      Particles.celebrate?.('GOLD');
      coach('เจอของพิเศษ! คะแนนพุ่ง ⭐', 'happy', 'รักษาคอมโบ!');
      emitEvt('hha:log_event', { kind:'hit_gold', ts: Date.now() });
      emitScore();

      Q.updateFromState?.(questSnapshot(), 'hit_gold');
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
        S.magnet = Math.max(S.magnet, 8.0);
        coach('พลังแม่เหล็ก! 🧲 เก็บของดีให้ไว!', 'happy', 'เล็งกลางแล้วกดยิงรัวได้เลย');
      }
      Particles.celebrate?.('POWER');
      emitEvt('hha:log_event', { kind:'hit_power', ts: Date.now(), power: tag });
      emitScore();

      Q.updateFromState?.(questSnapshot(), 'hit_power');
      return;
    }

    // junk/trap
    if (t.type === 'junk' || t.type === 'trap') {
      if (S.shield > 0) {
        // blocked => NO MISS
        S.nHitJunkGuard += 1;
        coach('โล่กันไว้! ไม่พลาด 🛡️', 'happy', 'ดีมาก!');
        emitEvt('hha:log_event', { kind:'hit_junk_guard', ts: Date.now(), type: t.type });

        // ✅ fair: guarded junk does NOT fail forbidJunk mini
        Q.onJunkHit?.({ guarded: true });
        Q.updateFromState?.(questSnapshot(), 'hit_junk_guard');

        emitScore();
        return;
      }

      // counts as MISS
      S.nHitJunk += 1;
      S.misses += 1;
      S.combo = 0;

      S.streakGood = 0;
      S.safeNoJunkSeconds = 0;

      setFever(S.fever - 18);
      stun('junk');
      Particles.burstAt?.(t.xView, t.yView, 'JUNK');
      emitEvt('hha:log_event', { kind:'hit_junk', ts: Date.now(), type: t.type });

      // forbid-junk minis fail
      Q.onJunkHit?.({ guarded: false });
      Q.updateFromState?.(questSnapshot(), 'hit_junk');

      emitScore();
      return;
    }
  }

  function shoot() {
    if (!canAct()) return;

    const baseR = 120;
    const radius = (S.magnet > 0) ? 240 : baseR;

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
  let questAccMs = 0;

  function spawnOne() {
    const cfg = spawnConfig();
    const { x, y } = randomSafeXY();

    const r = Math.random();

    // power
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

    // gold
    if (r < cfg.powerChance + cfg.goldChance) {
      const emoji = (Math.random() < 0.55) ? '⭐' : '💎';
      makeTarget('gold', emoji, x, y, cfg.ttl + 0.8, {});
      emitEvt('hha:log_event', { kind:'spawn_gold', ts: Date.now() });
      return;
    }

    // trap/junk/good
    const junk = (Math.random() < cfg.junkRatio);
    if (junk) {
      const isTrap = (Math.random() < 0.22);
      const emoji = isTrap ? EMOJI_TRAP[rndi(0, EMOJI_TRAP.length - 1)] : EMOJI_JUNK[rndi(0, EMOJI_JUNK.length - 1)];
      makeTarget(isTrap ? 'trap' : 'junk', emoji, x, y, cfg.ttl, {});
      S.nTargetJunkSpawned += 1;
      emitEvt('hha:log_event', { kind:'spawn_junk', ts: Date.now(), trap: isTrap ? 1 : 0 });
      return;
    }

    // good
    const emoji = EMOJI_GOOD[rndi(0, EMOJI_GOOD.length - 1)];
    makeTarget('good', emoji, x, y, cfg.ttl, {});
    S.nTargetGoodSpawned += 1;
    emitEvt('hha:log_event', { kind:'spawn_good', ts: Date.now() });
  }

  function update(dtMs) {
    // time
    S.timeLeftSec = Math.max(0, S.timeLeftSec - (dtMs / 1000));
    S.durationPlayedSec = (timeLimitSec - S.timeLeftSec);

    // panic edge near end
    if (S.timeLeftSec <= 8 && S.timeLeftSec > 0) document.body.classList.add('gj-panic');
    else document.body.classList.remove('gj-panic');

    // timers
    if (S.shield > 0) setShield(S.shield - (dtMs / 1000));
    if (S.magnet > 0) S.magnet = Math.max(0, S.magnet - (dtMs / 1000));
    if (S.slowmo > 0) S.slowmo = Math.max(0, S.slowmo - (dtMs / 1000));

    // FEVER -> auto shield
    if (S.fever >= 100 && S.shield <= 0.01) {
      setFever(0);
      setShield(6.0);
      Particles.celebrate?.('FEVER');
      coach('FEVER เต็ม! ได้โล่ 🛡️', 'fever', 'ช่วงนี้บวกให้สุด!');
    }

    // Quest tick (mini timer)
    Q.tick?.();

    // safeNoJunkSeconds count
    S.safeNoJunkSeconds += (dtMs / 1000);

    // throttle quest evaluation
    questAccMs += dtMs;
    if (questAccMs >= 120) {
      questAccMs = 0;
      Q.updateFromState?.(questSnapshot(), 'tick');
    }

    // spawn pacing
    const cfg = spawnConfig();
    const slowFactor = (S.slowmo > 0) ? 0.7 : 1.0;
    spawnAccMs += dtMs;

    const interval = cfg.baseInterval / slowFactor;

    while (spawnAccMs >= interval && S.timeLeftSec > 0) {
      spawnAccMs -= interval;

      // spawn boss condition
      if ((challenge === 'boss') && !S.bossSpawned && S.timeLeftSec <= (timeLimitSec - 2)) {
        spawnBoss();
      } else if ((challenge === 'rush') && !S.bossSpawned && S.score >= 8000) {
        spawnBoss();
      }

      // In boss mode: reduce normal spawns a bit while boss alive
      if (S.bossAlive) {
        if (Math.random() < 0.55) spawnOne();
      } else {
        spawnOne();
      }
    }

    // expire targets
    const tNow = nowMs();
    for (const [id, t] of targets) {
      if (!t) continue;
      if (t.type === 'boss') continue;

      if (tNow >= t.expireMs) {
        if (t.type === 'good') {
          S.nExpireGood += 1;
          S.misses += 1;
          S.combo = 0;

          S.streakGood = 0;

          setFever(S.fever - 12);
          emitEvt('hha:log_event', { kind:'expire_good', ts: Date.now() });
          emitScore();

          Q.updateFromState?.(questSnapshot(), 'expire_good');
        }
        removeTarget(id);
      }
    }

    // boss hazards
    tickBossHazards(dtMs);

    // emit time
    emitTime();
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
    showRing(false);
    laserClass(null);

    for (const id of Array.from(targets.keys())) removeTarget(id);

    const endIso = new Date().toISOString();
    S.endedAtIso = endIso;

    // finalize quest (for end-goals if any)
    Q.finalize?.(questSnapshot());
    const qEnd = Q.getUIState?.('end') || null;
    if (qEnd) {
      emitEvt('quest:update', qEnd);
      S.goalsCleared = qEnd.goalsCleared|0;
      S.goalsTotal   = qEnd.goalsTotal|0;
      S.miniCleared  = qEnd.minisCleared|0;
      S.miniTotal    = qEnd.minisTotal|0;
    }

    const stats = computeStats();
    S.grade = computeGrade(stats);

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
      gameVersion: (context.gameVersion || 'safe-full'),

      reason,

      startTimeIso: S.startedAtIso,
      endTimeIso: S.endedAtIso,

      ...context
    };

    emitEvt('hha:log_session', { phase: 'end', ts: Date.now(), ...payload });
    emitEvt('hha:end', payload);

    coach(`จบเกม! เกรด ${S.grade} 🎉`, 'happy', `Accuracy ${stats.accuracyGoodPct}% • Miss ${S.misses} • ComboMax ${S.comboMax}`);
    emitScore();
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

  // --------------------------- Public API ---------------------------
  function getState() {
    return {
      score: S.score,
      combo: S.combo,
      misses: S.misses,
      fever: S.fever,
      shield: Math.ceil(S.shield),
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

export default { boot };