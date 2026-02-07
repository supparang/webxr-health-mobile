// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard) v2026-02-07
// ✅ PACK 1–10 ready (AI hooks + metrics + logger + hardened)
// ✅ FIX: Storm always triggers when off-green long enough (robust)
// ✅ FIX: Recovery bias — leaving GREEN will guide player back (no death spiral)
// ✅ Summary canonical schema: runMode/timePlannedSec/scoreFinal/miss/accuracyPct/comboMax (+ legacy aliases)

'use strict';

import { createMetrics } from '../vr/metrics.safe.js';
import { createLogger } from '../vr/logger.safe.js';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);

const qs = (k, d = null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };
const qn = (k, d = 0) => Number(qs(k, d)) || Number(d) || 0;

const nowMs = () => (performance && performance.now) ? performance.now() : Date.now();

function emit(name, detail) {
  try { WIN.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

function makeRNG(seed) {
  let x = (Number(seed) || Date.now()) >>> 0;
  return () => (x = (1664525 * x + 1013904223) >>> 0) / 4294967296;
}

function zoneFromPct(pct) {
  pct = clamp(pct, 0, 100);
  if (pct >= 40 && pct <= 70) return 'GREEN';
  if (pct < 40) return 'LOW';
  return 'HIGH';
}

function gradeFromScore(score) {
  if (score >= 2200) return 'S';
  if (score >= 1700) return 'A';
  if (score >= 1200) return 'B';
  if (score >= 700) return 'C';
  return 'D';
}

function safeText(id, txt) {
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(txt);
}

function safeDownload(filename, text, mime = 'text/plain') {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url;
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch {}
}

function safeCopy(text) {
  try { navigator.clipboard?.writeText(String(text)); } catch {}
}

/* =========================
   LAYERS
========================= */

function getLayerIds() {
  const cfg = WIN.HHA_VIEW || {};
  const ids = Array.isArray(cfg.layers) && cfg.layers.length ? cfg.layers : ['hydration-layer'];
  return ids.map(String);
}

function resolveLayers() {
  const ids = getLayerIds();
  const layers = [];
  for (const id of ids) {
    const el = DOC.getElementById(id);
    if (el) layers.push(el);
  }
  if (!layers.length) {
    const pf = DOC.getElementById('playfield') || DOC.body;
    const el = DOC.createElement('div');
    el.id = ids[0] || 'hydration-layer';
    el.style.position = 'absolute';
    el.style.inset = '0';
    pf.appendChild(el);
    layers.push(el);
  }
  for (const L of layers) {
    L.style.position = L.style.position || 'absolute';
    L.style.inset = L.style.inset || '0';
    L.style.pointerEvents = 'auto';
  }
  return layers;
}

/* =========================
   TARGETS
========================= */

function makeTargetEl(kind, x, y, sizePx, ttlMs) {
  const el = DOC.createElement('div');
  el.className = 'hvr-target';
  el.dataset.kind = kind;

  const emoji = (kind === 'GOOD') ? '💧' : (kind === 'BAD') ? '🥤' : '🌀';
  el.textContent = emoji;

  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${sizePx}px`;
  el.style.height = `${sizePx}px`;
  el.style.transform = 'translate(-50%,-50%)';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.borderRadius = '999px';
  el.style.userSelect = 'none';
  el.style.webkitUserSelect = 'none';
  el.style.pointerEvents = 'auto';

  el.style.fontSize = `${Math.max(22, (sizePx * 0.62) | 0)}px`;
  el.style.background = 'rgba(15,23,42,.32)';
  el.style.border = '1px solid rgba(148,163,184,.18)';
  el.style.boxShadow = '0 18px 50px rgba(0,0,0,.30)';
  el.style.backdropFilter = 'blur(8px)';
  el.style.opacity = '1';
  el.style.visibility = 'visible';
  el.style.zIndex = '42';

  if (kind === 'GOOD') el.style.outline = '2px solid rgba(34,197,94,.22)';
  if (kind === 'BAD') el.style.outline = '2px solid rgba(239,68,68,.22)';
  if (kind === 'STORM') el.style.outline = '2px dashed rgba(34,211,238,.26)';

  el.dataset.birth = String(nowMs());
  el.dataset.ttl = String(ttlMs || 1200);

  return el;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/* =========================
   ENGINE
========================= */

const Engine = {
  started:false, running:false, ended:false,
  t0:0, lastT:0, rafId:0,

  run:'play', runMode:'play',
  diff:'normal',
  timeSec:70, timePlannedSec:70,
  seed:0,
  view:'',

  layers:[],
  score:0,
  combo:0,
  comboMax:0,
  miss:0,

  waterPct:50,
  greenHoldMs:0,
  zone:'GREEN',

  phase:'MAIN', // MAIN|STORM|END|BOSS
  stormCycles:0, stormOk:0, stormLeftMs:0, stormNeed:0, stormHit:0,

  endWindowMs:0, endNeedGreenMs:0,
  bossMs:0, bossNeed:0, bossHit:0,

  targets:new Set(),
  spawnAcc:0,

  offGreenMs:0,
  _endGreenMs:0,

  coachLastMs:0,

  rng:null,

  // PACK 7
  metrics: createMetrics(),
  logger: createLogger(),

  // PACK 3–6 (AI hooks optional)
  AI: null,
  aiEnabled: false,
};

function cfgByDiff(diff) {
  const base = {
    easy:   { spawnPerSec: 0.95, size: 74, ttl: 1400, goodDelta: 9,  badDelta: -9,  drift: 0.22, lock: 28, stormDur: 8500, stormNeed: 6,  endMs: 9000,  endNeed: 5200, bossMs: 9000,  bossNeed: 7  },
    normal: { spawnPerSec: 1.15, size: 68, ttl: 1250, goodDelta: 8,  badDelta: -10, drift: 0.28, lock: 28, stormDur: 9000, stormNeed: 8,  endMs: 10000, endNeed: 6200, bossMs: 10000, bossNeed: 9  },
    hard:   { spawnPerSec: 1.35, size: 62, ttl: 1100, goodDelta: 7,  badDelta: -12, drift: 0.33, lock: 28, stormDur: 9500, stormNeed: 10, endMs: 11000, endNeed: 7200, bossMs: 11000, bossNeed: 11 },
  };
  return base[diff] || base.normal;
}

function readCtx() {
  Engine.run = String(qs('run', 'play')).toLowerCase() === 'research' ? 'research' : 'play';
  Engine.runMode = Engine.run;

  const diff = String(qs('diff', 'normal')).toLowerCase();
  Engine.diff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';

  Engine.timeSec = clamp(qn('time', 70), 20, 600) | 0;
  Engine.timePlannedSec = Engine.timeSec;

  const seedQ = qn('seed', 0);
  Engine.seed = seedQ ? seedQ : Date.now();

  Engine.view = String(qs('view','')).toLowerCase();

  // AI enabled? (default OFF) -> ?ai=1 to enable
  Engine.aiEnabled = String(qs('ai','0')) === '1' && Engine.runMode === 'play';

  // init AI hooks if available
  try{
    Engine.AI = WIN.HHA?.createAIHooks ? WIN.HHA.createAIHooks({
      game:'hydration',
      seed: Engine.seed,
      mode: Engine.runMode,
      enabled: Engine.aiEnabled
    }) : null;
  }catch(_){
    Engine.AI = null;
  }
}

function logEv(type, data) {
  Engine.logger.ev(type, data);
}

function coachTip(msg, cooldownMs = 2800) {
  const t = nowMs();
  if (t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;
  emit('hha:coach', { msg, game: 'hydration' });
  logEv('coach', { msg });
}

/* =========================
   HUD
========================= */

function setWaterUI(pct) {
  pct = clamp(pct, 0, 100);
  const z = zoneFromPct(pct);

  safeText('water-pct', pct | 0);
  safeText('water-zone', z);

  const bar = DOC.getElementById('water-bar');
  if (bar) bar.style.width = `${pct.toFixed(0)}%`;

  Engine.zone = z;
}

function setStatsUI(timeLeftSec) {
  safeText('stat-score', Engine.score | 0);
  safeText('stat-combo', Engine.combo | 0);
  safeText('stat-time', timeLeftSec | 0);
  safeText('stat-miss', Engine.miss | 0);
  safeText('stat-grade', gradeFromScore(Engine.score));
}

function setQuestUI() {
  const z = Engine.zone;
  const phase = Engine.phase;

  const l1 = (phase === 'MAIN')
    ? `คุมให้อยู่โซน GREEN ให้นานที่สุด`
    : (phase === 'STORM')
      ? `🌀 STORM! เก็บ GOOD ให้ครบ`
      : (phase === 'END')
        ? `⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา`
        : `👑 BOSS! เก็บ GOOD ต่อเนื่อง`;

  const l2 = (phase === 'STORM')
    ? `ต้องการ: ${Engine.stormHit}/${Engine.stormNeed} (เหลือ ${(Engine.stormLeftMs/1000).toFixed(1)}s)`
    : (phase === 'END')
      ? `GREEN: ${(Engine._endGreenMs/1000).toFixed(1)}s / ${(Engine.endNeedGreenMs/1000).toFixed(1)}s`
      : (phase === 'BOSS')
        ? `ต้องการ: ${Engine.bossHit}/${Engine.bossNeed} (เหลือ ${(Engine.bossMs/1000).toFixed(1)}s)`
        : `ตอนนี้: โซน ${z}`;

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm cycles: ${Engine.stormCycles} | Storm OK: ${Engine.stormOk}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax}`);
}

/* =========================
   GAMEPLAY HELPERS
========================= */

function doShock(x, y) {
  try {
    const layer = Engine.layers[0] || DOC.body;
    const fx = DOC.createElement('div');
    fx.className = 'hha-shock';
    fx.style.setProperty('--x', `${x}px`);
    fx.style.setProperty('--y', `${y}px`);
    layer.appendChild(fx);
    setTimeout(() => fx.remove(), 650);
  } catch {}
}

function adjustWater(delta) {
  Engine.waterPct = clamp(Engine.waterPct + delta, 0, 100);
  setWaterUI(Engine.waterPct);
}

function addScore(pts) {
  Engine.score += pts;
  emit('hha:score', { score: Engine.score, combo: Engine.combo, miss: Engine.miss });
}

function removeTarget(el) {
  try { Engine.targets.delete(el); } catch {}
  try { el.remove(); } catch {}
}

/* =========================
   PHASE
========================= */

function enterStorm(cfg) {
  Engine.phase = 'STORM';
  Engine.stormCycles += 1;
  Engine.stormLeftMs = cfg.stormDur;
  Engine.stormNeed = cfg.stormNeed;
  Engine.stormHit = 0;
  DOC.body.classList.add('hha-bossfx');
  coachTip('🌀 STORM! เก็บ GOOD ให้ครบ!', 0);
  logEv('phase', { phase: 'STORM', stormNeed: Engine.stormNeed });
}

function exitStorm(success) {
  Engine.phase = 'MAIN';
  DOC.body.classList.remove('hha-bossfx');
  if (success) Engine.stormOk += 1;
  coachTip(success ? 'ผ่าน STORM! กลับไปคุม GREEN ต่อ' : 'STORM ไม่ผ่าน! ระวัง BAD', 0);
  logEv('phase', { phase: 'MAIN', stormSuccess: !!success });
}

function enterEndWindow(cfg) {
  Engine.phase = 'END';
  Engine.endWindowMs = cfg.endMs;
  Engine.endNeedGreenMs = cfg.endNeed;
  Engine._endGreenMs = 0;
  DOC.body.classList.add('hha-endfx');
  coachTip('⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา', 0);
  logEv('phase', { phase: 'END', needGreenMs: Engine.endNeedGreenMs });
}

function enterBoss(cfg) {
  Engine.phase = 'BOSS';
  Engine.bossMs = cfg.bossMs;
  Engine.bossNeed = cfg.bossNeed;
  Engine.bossHit = 0;
  DOC.body.classList.add('hha-bossfx');
  coachTip('👑 BOSS! เก็บ GOOD ต่อเนื่อง ห้ามพลาด', 0);
  logEv('phase', { phase: 'BOSS', bossNeed: Engine.bossNeed });
}

/* =========================
   SPAWN (FIX: no death spiral)
========================= */

function spawnOne(rng, cfg, diffAdj) {
  const layers = Engine.layers;
  if (!layers.length) return;

  for (const layer of layers) {
    const rect = layer.getBoundingClientRect();

    // PACK 1: safe area (no HUD top) + fair pad
    const pad = Math.max(24, ((cfg.size* (diffAdj.sizeMul||1)) * 0.55) | 0);
    const x = clamp((rect.width  * (0.10 + rng() * 0.80)), pad, rect.width  - pad);
    const y = clamp((rect.height * (0.22 + rng() * 0.64)), pad, rect.height - pad); // top-safe

    const isStorm = (Engine.phase === 'STORM');
    const isBoss  = (Engine.phase === 'BOSS');

    // ✅ FIX: when off-green, reduce BAD chance (recovery bias)
    const z = Engine.zone;
    let pBad = 0.26;                 // base
    if(z === 'LOW' || z === 'HIGH') pBad = 0.18;       // recovery
    if(isStorm) pBad = 0.20;
    if(isBoss)  pBad = 0.32;

    // AI tweak
    pBad = clamp(pBad + (diffAdj.pBadAdd||0), 0.08, 0.58);

    let kind = (rng() < pBad) ? 'BAD' : 'GOOD';
    if (isStorm && rng() < 0.07) kind = 'STORM';

    const ttl  = (cfg.ttl  * (diffAdj.ttlMul||1)) + ((rng() * 240) | 0);
    const size = (cfg.size * (diffAdj.sizeMul||1)) + ((rng() * 6) | 0);

    const el = makeTargetEl(kind, x, y, size, ttl);
    layer.appendChild(el);
    Engine.targets.add(el);

    const birth = nowMs();
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      const rt = nowMs() - birth;
      hitTarget(el, { source: 'pointer', x: e.clientX, y: e.clientY, rtMs: rt });
    }, { passive:false });

    setTimeout(() => {
      if (!Engine.running) return;
      if (!el.isConnected) return;

      // timeout miss (only punish in STORM/BOSS and if GOOD)
      if (el.dataset.kind === 'GOOD' && (Engine.phase === 'STORM' || Engine.phase === 'BOSS')) {
        Engine.miss += 1;
        Engine.combo = 0;
        Engine.metrics.onMiss();
        logEv('miss', { phase: Engine.phase, source:'timeout', kind:'GOOD' });
        coachTip('พลาด 💧! ลองเล็งนิ่งขึ้นก่อนยิง');
      }
      removeTarget(el);
    }, ttl);
  }
}

/* =========================
   HIT / SHOOT
========================= */

function hitTarget(el, info) {
  if (!Engine.running || Engine.ended) return;
  if (!el || !el.isConnected) return;

  const kind = el.dataset.kind || 'GOOD';
  const cfg = cfgByDiff(Engine.diff);

  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  if (kind === 'GOOD') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

    adjustWater(+cfg.goodDelta);
    const bonus = 60 + Math.min(240, Engine.combo * 10);
    addScore(80 + bonus);

    if (Engine.phase === 'STORM') Engine.stormHit += 1;
    if (Engine.phase === 'BOSS')  Engine.bossHit  += 1;

    Engine.metrics.onHit(info?.rtMs||0);
    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);
  } else if (kind === 'BAD') {
    Engine.miss += 1;
    Engine.combo = 0;

    // ✅ FIX: bad penalty is softer when already off-green (fair recovery)
    const soften = (Engine.zone !== 'GREEN') ? 0.65 : 1.0;
    adjustWater(cfg.badDelta * soften);

    addScore(-30);
    Engine.metrics.onMiss();
    coachTip('โดน 🥤! รีบกลับเข้า GREEN', 2300);
  } else {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+Math.max(4, (cfg.goodDelta - 3)));
    addScore(120);
    if (Engine.phase === 'STORM') Engine.stormHit += 2;
    Engine.metrics.onHit(info?.rtMs||0);
    coachTip('🌀 STORM core! ได้แต้มพิเศษ', 2200);
  }

  doShock(cx, cy);
  logEv('hit', { kind, phase: Engine.phase, score: Engine.score, water: Engine.waterPct, combo: Engine.combo, source: info?.source || 'unknown' });
  removeTarget(el);
}

function handleShootEvent(detail) {
  if (!Engine.running || Engine.ended) return;
  if (!detail) return;

  const x = Number(detail.x);
  const y = Number(detail.y);
  if (!isFinite(x) || !isFinite(y)) return;

  // lockPx can be AI-tuned
  const baseLock = clamp(Number(detail.lockPx) || 28, 10, 90);
  const lock2 = baseLock * baseLock;

  let best = null;
  let bestD2 = Infinity;

  for (const el of Engine.targets) {
    if (!el || !el.isConnected) continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d2 = dist2(x, y, cx, cy);
    if (d2 < bestD2) { bestD2 = d2; best = el; }
  }

  if (best && bestD2 <= lock2) {
    hitTarget(best, { source: detail.source || 'hha:shoot', x, y, rtMs: 0 });
  } else {
    // missShot punish only in STORM/BOSS (fair)
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      Engine.metrics.onMiss();
      coachTip('พลาด! ลดการยิงรัว แล้วเล็งใหม่');
      logEv('miss', { phase: Engine.phase, source: detail.source || 'hha:shoot', kind:'shot' });
    }
    doShock(x, y);
  }
}

/* =========================
   LOOP (FIX Storm trigger robust)
========================= */

function step(t) {
  if (!Engine.running) return;

  const baseCfg = cfgByDiff(Engine.diff);

  // AI diff adjust (PACK 4)
  const m = Engine.metrics.snapshot();
  const stateForAI = {
    view: Engine.view,
    zone: Engine.zone,
    phase: Engine.phase,
    score: Engine.score,
    combo: Engine.combo,
    comboMax: Engine.comboMax,
    miss: Engine.miss,
    accuracyPct: m.accuracyPct,
    rtMedianMs: m.rtMedianMs,
    missBurst: m.missBurstMax,
    stormHit: Engine.stormHit,
    stormNeed: Engine.stormNeed,
    offGreenMs: Engine.offGreenMs
  };

  const diffAdj = Engine.AI?.getDifficulty ? Engine.AI.getDifficulty(stateForAI) : {spawnMul:1,ttlMul:1,sizeMul:1,driftMul:1,pBadAdd:0,lockPx:28};

  const cfg = Object.assign({}, baseCfg);
  const dt = Math.min(0.06, Math.max(0, (t - Engine.lastT) / 1000));
  Engine.lastT = t;

  const elapsed = (t - Engine.t0) / 1000;
  const left = Math.max(0, Engine.timePlannedSec - elapsed);

  emit('hha:time', { t: elapsed, left, phase: Engine.phase });
  setStatsUI(left);

  // drift toward 55 (play only) + AI drift help
  if (Engine.runMode === 'play') {
    const target = 55;
    const drift = cfg.drift * (diffAdj.driftMul||1);

    // ✅ stronger pull when far from target (recovery)
    const dist = Math.abs(target - Engine.waterPct);
    const extra = clamp(dist / 60, 0, 1) * 0.18; // 0..0.18
    Engine.waterPct += (target - Engine.waterPct) * (drift + extra) * dt;
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  }

  setWaterUI(Engine.waterPct);

  // green uptime
  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  // robust offGreen tracker
  if (Engine.zone === 'GREEN') Engine.offGreenMs = 0;
  else Engine.offGreenMs = (Engine.offGreenMs || 0) + dt * 1000;

  const leftMs = left * 1000;

  // enter END around last 18s
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // ✅ FIX: Storm triggers reliably when off-green long enough (and still MAIN)
  if (Engine.phase === 'MAIN') {
    if (Engine.offGreenMs >= 1700) { // was 2200; now tighter + reliable
      Engine.offGreenMs = 0;
      enterStorm(cfg);
    }
  }

  if (Engine.phase === 'STORM') {
    Engine.stormLeftMs -= dt * 1000;
    if (Engine.stormHit >= Engine.stormNeed) {
      exitStorm(true);
    } else if (Engine.stormLeftMs <= 0) {
      Engine.miss += 2;
      Engine.combo = 0;
      Engine.metrics.onMiss();
      exitStorm(false);
    }
  }

  if (Engine.phase === 'END') {
    Engine.endWindowMs -= dt * 1000;
    if (Engine.zone === 'GREEN') Engine._endGreenMs += dt * 1000;
    if (Engine.endWindowMs <= 0) {
      DOC.body.classList.remove('hha-endfx');
      enterBoss(cfg);
    }
  }

  if (Engine.phase === 'BOSS') {
    Engine.bossMs -= dt * 1000;
    if (Engine.bossHit >= Engine.bossNeed) Engine.bossMs = 0;
    if (Engine.bossMs <= 0) { endGame(); return; }
  }

  // spawn rate (PACK 4)
  let spawnRate = cfg.spawnPerSec * (diffAdj.spawnMul||1);

  // PACK 1: fairness - reduce spawn if too many targets alive
  const alive = Engine.targets.size || 0;
  if (alive > 18) spawnRate *= 0.75;
  if (alive > 26) spawnRate *= 0.55;

  // phase boost
  if (Engine.phase === 'STORM') spawnRate += 0.25;
  if (Engine.phase === 'BOSS')  spawnRate += 0.35;

  Engine.spawnAcc += dt * spawnRate;

  while (Engine.spawnAcc >= 1) {
    Engine.spawnAcc -= 1;
    spawnOne(Engine.rng, cfg, diffAdj);
  }

  // AI coach tips (PACK 5)
  const tip = Engine.AI?.getTip ? Engine.AI.getTip(stateForAI, Engine.logger.events.slice(-12)) : null;
  if (tip?.msg) coachTip(tip.msg);

  setQuestUI();

  if (left <= 0.001 && !Engine.ended) { endGame(); return; }

  Engine.rafId = requestAnimationFrame(step);
}

/* =========================
   SUMMARY (PACK 8)
========================= */

function buildSummary() {
  const m = Engine.metrics.snapshot();

  const grade = gradeFromScore(Engine.score);
  const tier = (grade === 'S' || grade === 'A') ? '🔥 Elite'
    : (grade === 'B') ? '⚡ Skilled'
    : (grade === 'C') ? '✅ Ok'
    : '🧊 Warm-up';

  const summary = {
    game: 'hydration',
    ts: Date.now(),

    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,

    scoreFinal: Engine.score | 0,
    grade,
    tier,
    comboMax: Engine.comboMax | 0,
    miss: Engine.miss | 0,
    accuracyPct: m.accuracyPct,

    greenHoldSec: Math.round((Engine.greenHoldMs / 1000) * 10) / 10,
    stormCycles: Engine.stormCycles | 0,
    stormOk: Engine.stormOk | 0,
    bossNeed: Engine.bossNeed | 0,
    bossHit: Engine.bossHit | 0,

    logs: Engine.logger.events.slice(0, 4000),

    // legacy aliases
    run: Engine.runMode,
    timeSec: Engine.timePlannedSec,
    score: Engine.score | 0,
  };

  return summary;
}

function saveSummary(summary) {
  try {
    localStorage.setItem(LS_LAST, JSON.stringify(summary));
    const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
    hist.unshift({
      ts: summary.ts,
      scoreFinal: summary.scoreFinal,
      grade: summary.grade,
      diff: summary.diff,
      runMode: summary.runMode
    });
    localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
  } catch {}
}

function summaryToCSV(summary) {
  const s = summary;
  const lines = [];
  lines.push('session_key,session_value');
  [
    ['ts', s.ts], ['game', s.game], ['runMode', s.runMode], ['diff', s.diff],
    ['timePlannedSec', s.timePlannedSec], ['seed', s.seed],
    ['scoreFinal', s.scoreFinal], ['grade', s.grade], ['tier', s.tier],
    ['accuracyPct', s.accuracyPct], ['comboMax', s.comboMax], ['miss', s.miss],
    ['greenHoldSec', s.greenHoldSec], ['stormCycles', s.stormCycles], ['stormOk', s.stormOk],
    ['bossNeed', s.bossNeed], ['bossHit', s.bossHit]
  ].forEach(([k,v])=> lines.push(`${k},${String(v).replace(/,/g,' ')}`));

  lines.push('');
  lines.push('event_t,event_type,event_phase,event_kind,event_score,event_water,event_combo,event_source,event_msg');

  for (const ev of (s.logs || [])) {
    const row = [
      ev.t || '', ev.type || '', ev.phase || '', ev.kind || '',
      (ev.score ?? ''), (ev.water ?? ''), (ev.combo ?? ''), (ev.source ?? ''), (ev.msg ?? '')
    ].map(x => String(x).replace(/\n/g, ' ').replace(/,/g, ' '));
    lines.push(row.join(','));
  }
  return lines.join('\n');
}

function bindResultButtons(summary) {
  const hub = String(qs('hub', '../hub.html'));

  DOC.getElementById('btnRetry')?.addEventListener('click', () => location.reload());
  DOC.getElementById('btnCloseSummary')?.addEventListener('click', () => {
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  });

  DOC.getElementById('btnCopyJSON')?.addEventListener('click', () => safeCopy(JSON.stringify(summary, null, 2)));
  DOC.getElementById('btnDownloadCSV')?.addEventListener('click', () => {
    safeDownload(`hydration-${summary.diff}-${summary.runMode}-${summary.ts}.csv`, summaryToCSV(summary), 'text/csv');
  });

  DOC.querySelectorAll('.btnBackHub')?.forEach((b) =>
    b.addEventListener('click', () => { location.href = hub; })
  );
}

function showResult(summary) {
  safeText('rScore', summary.scoreFinal);
  safeText('rGrade', summary.grade);
  safeText('rAcc', `${summary.accuracyPct}%`);
  safeText('rComboMax', summary.comboMax);
  safeText('rMiss', summary.miss);

  safeText('rGoals', `${Math.round(summary.greenHoldSec)}s GREEN`);
  safeText('rMinis', `${summary.stormOk}/${summary.stormCycles}`);
  safeText('rTier', summary.tier);

  const tips = [];
  const stormRate = summary.stormCycles ? Math.round((summary.stormOk / summary.stormCycles) * 100) : 0;

  if (stormRate < 60) tips.push('• STORM: ยิง 💧 ที่ใกล้กลางจอก่อน จะผ่านง่ายขึ้น');
  if (summary.miss > 6) tips.push('• ลดพลาด: หยุดครึ่งจังหวะก่อนยิง อย่ายิงรัว');
  if (summary.comboMax < 6) tips.push('• ทำคอมโบ: เริ่มจากเป้าที่อยู่ในเขตกลาง ๆ ของจอ');
  if (!tips.length) tips.push('• ฟอร์มดีมาก! ลอง diff=hard หรือเปิด ai=1');

  const tipsEl = DOC.getElementById('rTips');
  if (tipsEl) tipsEl.textContent = tips.join('\n');

  const nextEl = DOC.getElementById('rNext');
  if (nextEl) nextEl.textContent = `Next: diff=${summary.diff} | runMode=${summary.runMode} | seed=${summary.seed} | ai=${Engine.aiEnabled?1:0}`;

  const back = DOC.getElementById('resultBackdrop');
  if (back) back.hidden = false;

  bindResultButtons(summary);
}

/* =========================
   START/STOP (PACK 9)
========================= */

function startGame() {
  if (Engine.running) return;

  readCtx();
  Engine.layers = resolveLayers();
  Engine.rng = makeRNG(Engine.seed);

  Engine.score = 0;
  Engine.combo = 0;
  Engine.comboMax = 0;
  Engine.miss = 0;

  Engine.waterPct = 50;
  Engine.greenHoldMs = 0;
  Engine.zone = zoneFromPct(Engine.waterPct);

  Engine.phase = 'MAIN';
  Engine.stormCycles = 0;
  Engine.stormOk = 0;

  Engine.targets = new Set();
  Engine.spawnAcc = 0;

  Engine.offGreenMs = 0;
  Engine._endGreenMs = 0;

  Engine.metrics = createMetrics();
  Engine.logger = createLogger();

  Engine.ended = false;
  Engine.running = true;
  Engine.started = true;

  // hide summary safety
  try{ const back = DOC.getElementById('resultBackdrop'); if (back) back.hidden = true; }catch(_){}

  setWaterUI(Engine.waterPct);
  setQuestUI();

  Engine.t0 = nowMs();
  Engine.lastT = Engine.t0;

  logEv('start', { runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed, ai: Engine.aiEnabled?1:0 });

  emit('hha:start', {
    game: 'hydration',
    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,
    ai: Engine.aiEnabled?1:0,
    // legacy
    run: Engine.runMode,
    time: Engine.timePlannedSec
  });

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });
  for (const L of Engine.layers) L.addEventListener('pointerdown', onLayerPointerDown, { passive: false });

  Engine.rafId = requestAnimationFrame(step);
  coachTip('เริ่มเลย! คุมให้อยู่ GREEN แล้วเตรียมรับ STORM', 0);
}

function stopGame() {
  Engine.running = false;
  try { cancelAnimationFrame(Engine.rafId); } catch {}

  WIN.removeEventListener('hha:shoot', onShoot);
  for (const L of Engine.layers || []) {
    try { L.removeEventListener('pointerdown', onLayerPointerDown); } catch {}
  }
  for (const el of Array.from(Engine.targets)) removeTarget(el);
  Engine.targets.clear();
}

function endGame() {
  if (Engine.ended) return;
  Engine.ended = true;

  stopGame();

  const summary = buildSummary();
  saveSummary(summary);

  logEv('end', { scoreFinal: summary.scoreFinal, grade: summary.grade, miss: summary.miss });
  emit('hha:end', summary);

  showResult(summary);
}

/* =========================
   INPUT
========================= */

function onShoot(e) { handleShootEvent(e?.detail); }

function onLayerPointerDown(e) {
  if (!Engine.running || Engine.ended) return;
  e.preventDefault();
  handleShootEvent({ x: e.clientX, y: e.clientY, lockPx: 28, source: 'layer' });
}

/* =========================
   AUTO-BOOT (HARDENED)
========================= */

(function boot(){
  // force-hide result overlay
  try{ const back = DOC.getElementById('resultBackdrop'); if (back) back.hidden = true; }catch(_){}

  // lock hidden + force target visible
  try {
    if (!DOC.getElementById('hydration-safe-style')) {
      const st = DOC.createElement('style');
      st.id = 'hydration-safe-style';
      st.textContent = `
        .hvr-target{ opacity:1 !important; visibility:visible !important; display:flex !important; }
        [hidden]{ display:none !important; }
      `;
      DOC.head.appendChild(st);
    }
  } catch {}

  WIN.addEventListener('hha:start', () => startGame(), { passive: true });

  function isOverlayActuallyVisible(el){
    try{
      if (!el) return false;
      if (el.hidden) return false;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return false;
      if (cs.visibility === 'hidden') return false;
      if (Number(cs.opacity || '1') <= 0) return false;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      return true;
    }catch(_){ return true; }
  }

  setTimeout(() => {
    const ov = DOC.getElementById('startOverlay');
    const visible = isOverlayActuallyVisible(ov);
    if (!visible && !Engine.started) startGame();
  }, 260);

  try {
    WIN.HydrationVR = {
      start: startGame, stop: stopGame, end: endGame,
      getState: () => JSON.parse(JSON.stringify({
        runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed,
        score: Engine.score, combo: Engine.combo, miss: Engine.miss,
        waterPct: Engine.waterPct, zone: Engine.zone, phase: Engine.phase,
        offGreenMs: Engine.offGreenMs
      }))
    };
  } catch {}
})();

export {};