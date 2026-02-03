// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard)
// ✅ PC/Mobile/cVR/Cardboard (multi-layer)
// ✅ Targets always visible (class: hvr-target) + robust layer mounting
// ✅ Tap-to-shoot via hha:shoot {x,y,lockPx,source} (from vr-ui.js)
// ✅ Quest: Keep water in GREEN, Storm cycles, End Window, Boss-ish block
// ✅ Emits: hha:start, hha:time, hha:score, hha:rank, hha:coach, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// ✅ CSV download + JSON copy from result overlay buttons
// ✅ Research deterministic (seeded), Play adaptive (difficulty director lite)
// ✅ PATCH: Force-hide result overlay on boot + lock [hidden] + hardened auto-start when overlay exists but not visible

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);

const qs = (k, d = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; }
};
const qn = (k, d = 0) => Number(qs(k, d)) || Number(d) || 0;

const nowMs = () => (performance && performance.now) ? performance.now() : Date.now();

function emit(name, detail) {
  try { WIN.dispatchEvent(new CustomEvent(name, { detail })); } catch {}
}

function makeRNG(seed) {
  // LCG deterministic
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
   LAYER RESOLUTION
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
  // fallback: create if none
  if (!layers.length) {
    const pf = DOC.getElementById('playfield') || DOC.body;
    const el = DOC.createElement('div');
    el.id = ids[0] || 'hydration-layer';
    el.style.position = 'absolute';
    el.style.inset = '0';
    pf.appendChild(el);
    layers.push(el);
  }
  // ensure style
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
   ENGINE STATE
========================= */

const Engine = {
  started: false,
  running: false,
  ended: false,

  t0: 0,
  lastT: 0,
  rafId: 0,

  run: 'play',       // play | research
  diff: 'normal',    // easy | normal | hard
  timeSec: 70,
  seed: 0,

  layers: [],
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  waterPct: 50,
  greenHoldMs: 0,
  zone: 'GREEN',

  phase: 'MAIN', // MAIN | STORM | END | BOSS
  stormCycles: 0,
  stormOk: 0,
  stormLeftMs: 0,
  stormNeed: 0,
  stormHit: 0,

  endWindowMs: 0,
  endNeedGreenMs: 0,

  bossMs: 0,
  bossNeed: 0,
  bossHit: 0,

  targets: new Set(),
  spawnAcc: 0,

  logs: [],
  coachLastMs: 0,
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
  const diff = String(qs('diff', 'normal')).toLowerCase();
  Engine.diff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';
  Engine.timeSec = clamp(qn('time', 70), 20, 600) | 0;

  const seedQ = qn('seed', 0);
  Engine.seed = seedQ ? seedQ : Date.now();
}

function logEv(type, data) {
  Engine.logs.push({ t: Date.now(), type, ...data });
}

/* =========================
   HUD UPDATE
========================= */

function setWaterUI(pct) {
  pct = clamp(pct, 0, 100);
  const z = zoneFromPct(pct);

  safeText('water-pct', pct | 0);
  safeText('water-zone', z);

  const bar = DOC.getElementById('water-bar');
  if (bar) bar.style.width = `${pct.toFixed(0)}%`;

  // optional gauge module
  try {
    if (WIN.HHA_UI_WATER?.ensureWaterGauge) WIN.HHA_UI_WATER.ensureWaterGauge();
    if (WIN.HHA_UI_WATER?.setWaterGauge) WIN.HHA_UI_WATER.setWaterGauge(pct);
  } catch {}

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

  safeText('storm-left', (Engine.phase === 'STORM') ? Math.ceil(Engine.stormLeftMs/1000) : 0);
  safeText('shield-count', 0);
}

function coachTip(msg, cooldownMs = 2800) {
  const t = nowMs();
  if (t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;
  emit('hha:coach', { msg, game: 'hydration' });
  logEv('coach', { msg });
}

/* =========================
   SPAWNING & HIT
========================= */

function spawnOne(rng, cfg) {
  const layers = Engine.layers;
  if (!layers.length) return;

  for (const layer of layers) {
    const rect = layer.getBoundingClientRect();

    const pad = Math.max(24, (cfg.size * 0.55) | 0);
    const x = clamp((rect.width * (0.10 + rng() * 0.80)), pad, rect.width - pad);
    const y = clamp((rect.height * (0.18 + rng() * 0.68)), pad, rect.height - pad);

    const isStorm = (Engine.phase === 'STORM');
    const isBoss = (Engine.phase === 'BOSS');

    let kind;
    const z = Engine.zone;
    let pBad = (z === 'GREEN') ? 0.26 : 0.36;
    if (isStorm) pBad = 0.22;
    if (isBoss) pBad = 0.40;

    kind = (rng() < pBad) ? 'BAD' : 'GOOD';
    if (isStorm && rng() < 0.08) kind = 'STORM';

    const ttl = cfg.ttl + ((rng() * 300) | 0);
    const size = cfg.size + ((rng() * 8) | 0);

    const el = makeTargetEl(kind, x, y, size, ttl);
    layer.appendChild(el);
    Engine.targets.add(el);

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hitTarget(el, { source: 'pointer', x: e.clientX, y: e.clientY });
    }, { passive: false });

    setTimeout(() => {
      if (!Engine.running) return;
      if (!el.isConnected) return;

      if (el.dataset.kind === 'GOOD' && (Engine.phase === 'STORM' || Engine.phase === 'BOSS')) {
        Engine.miss += 1;
        Engine.combo = 0;
        coachTip('พลาด GOOD! ลองเล็งกลางเป้าให้ชัดขึ้น');
      }
      removeTarget(el);
    }, ttl);
  }
}

function removeTarget(el) {
  try { Engine.targets.delete(el); } catch {}
  try { el.remove(); } catch {}
}

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
    if (Engine.phase === 'BOSS') Engine.bossHit += 1;

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);
  } else if (kind === 'BAD') {
    Engine.miss += 1;
    Engine.combo = 0;
    adjustWater(cfg.badDelta);
    addScore(-30);
    coachTip('โดน BAD! รีบกลับเข้า GREEN', 2300);
  } else {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+Math.max(4, (cfg.goodDelta - 3)));
    addScore(120);
    if (Engine.phase === 'STORM') Engine.stormHit += 2;
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

  const lockPx = clamp(Number(detail.lockPx) || 28, 10, 90);
  const lock2 = lockPx * lockPx;

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
    hitTarget(best, { source: detail.source || 'hha:shoot', x, y });
  } else {
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      coachTip('พลาด! ลองปรับมือถือให้เล็งนิ่งขึ้น');
      logEv('miss', { phase: Engine.phase, source: detail.source || 'hha:shoot' });
    }
    doShock(x, y);
  }
}

/* =========================
   PHASE LOGIC
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
   MAIN LOOP
========================= */

function step(t) {
  if (!Engine.running) return;

  const cfg = cfgByDiff(Engine.diff);
  const dt = Math.min(0.06, Math.max(0, (t - Engine.lastT) / 1000));
  Engine.lastT = t;

  const elapsed = (t - Engine.t0) / 1000;
  const left = Math.max(0, Engine.timeSec - elapsed);

  emit('hha:time', { t: elapsed, left, phase: Engine.phase });
  setStatsUI(left);

  // difficulty director lite (play only)
  let spawnRate = cfg.spawnPerSec;
  if (Engine.run === 'play') {
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 55);
    spawnRate = cfg.spawnPerSec * (0.9 + perf * 0.35);
  }

  // drift toward 55
  if (Engine.run === 'play') {
    const target = 55;
    Engine.waterPct += (target - Engine.waterPct) * cfg.drift * dt;
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  }
  setWaterUI(Engine.waterPct);

  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  const leftMs = left * 1000;

  // enter END around last 18s
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // storm trigger when off-green too long
  if (Engine.phase === 'MAIN') {
    Engine._offGreenMs = (Engine.zone === 'GREEN') ? 0 : ((Engine._offGreenMs || 0) + dt * 1000);
    if ((Engine._offGreenMs || 0) > 2200) {
      Engine._offGreenMs = 0;
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
    if (Engine.bossMs <= 0) {
      endGame();
      return;
    }
  }

  // spawn accel
  Engine.spawnAcc += dt * spawnRate;
  if (Engine.phase === 'STORM') Engine.spawnAcc += dt * 0.45;
  if (Engine.phase === 'BOSS') Engine.spawnAcc += dt * 0.65;

  const rng = Engine.rng;
  while (Engine.spawnAcc >= 1) {
    Engine.spawnAcc -= 1;
    spawnOne(rng, cfg);
  }

  // gc
  if ((Engine._gcAcc = (Engine._gcAcc || 0) + dt) > 0.7) {
    Engine._gcAcc = 0;
    for (const el of Array.from(Engine.targets)) {
      if (!el || !el.isConnected) Engine.targets.delete(el);
    }
  }

  setQuestUI();

  if (left <= 0.001 && !Engine.ended) {
    endGame();
    return;
  }

  Engine.rafId = requestAnimationFrame(step);
}

/* =========================
   RESULT + STORAGE
========================= */

function buildSummary() {
  const shots = Engine.logs.filter(x => x.type === 'hit' || x.type === 'miss').length;
  const hits = Engine.logs.filter(x => x.type === 'hit').length;
  const acc = shots ? Math.round((hits / shots) * 100) : 0;

  const grade = gradeFromScore(Engine.score);
  const tier = (grade === 'S' || grade === 'A') ? '🔥 Elite'
    : (grade === 'B') ? '⚡ Skilled'
    : (grade === 'C') ? '✅ Ok'
    : '🧊 Warm-up';

  return {
    game: 'hydration',
    ts: Date.now(),
    run: Engine.run,
    diff: Engine.diff,
    timeSec: Engine.timeSec,
    seed: Engine.seed,

    score: Engine.score | 0,
    grade,
    tier,
    comboMax: Engine.comboMax | 0,
    miss: Engine.miss | 0,
    accuracyPct: acc,

    greenHoldSec: Math.round((Engine.greenHoldMs / 1000) * 10) / 10,
    stormCycles: Engine.stormCycles | 0,
    stormOk: Engine.stormOk | 0,
    bossNeed: Engine.bossNeed | 0,
    bossHit: Engine.bossHit | 0,

    logs: Engine.logs.slice(0, 4000),
  };
}

function saveSummary(summary) {
  try {
    localStorage.setItem(LS_LAST, JSON.stringify(summary));
    const hist = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
    hist.unshift({ ts: summary.ts, score: summary.score, grade: summary.grade, diff: summary.diff, run: summary.run });
    localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
  } catch {}
}

function summaryToCSV(summary) {
  const s = summary;
  const sessionRows = [
    ['ts', s.ts],
    ['game', s.game],
    ['run', s.run],
    ['diff', s.diff],
    ['timeSec', s.timeSec],
    ['seed', s.seed],
    ['score', s.score],
    ['grade', s.grade],
    ['tier', s.tier],
    ['accuracyPct', s.accuracyPct],
    ['comboMax', s.comboMax],
    ['miss', s.miss],
    ['greenHoldSec', s.greenHoldSec],
    ['stormCycles', s.stormCycles],
    ['stormOk', s.stormOk],
    ['bossNeed', s.bossNeed],
    ['bossHit', s.bossHit],
  ];

  const lines = [];
  lines.push('session_key,session_value');
  for (const [k, v] of sessionRows) lines.push(`${k},${String(v).replace(/,/g, ' ')}`);

  lines.push('');
  lines.push('event_t,event_type,event_phase,event_kind,event_score,event_water,event_combo,event_source,event_msg');

  for (const ev of (s.logs || [])) {
    const row = [
      ev.t || '',
      ev.type || '',
      ev.phase || '',
      ev.kind || '',
      (ev.score ?? ''),
      (ev.water ?? ''),
      (ev.combo ?? ''),
      (ev.source ?? ''),
      (ev.msg ?? ''),
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
    safeDownload(`hydration-${summary.diff}-${summary.run}-${summary.ts}.csv`, summaryToCSV(summary), 'text/csv');
  });

  DOC.querySelectorAll('.btnBackHub')?.forEach((b) =>
    b.addEventListener('click', () => { location.href = hub; })
  );
}

function showResult(summary) {
  safeText('rScore', summary.score);
  safeText('rGrade', summary.grade);
  safeText('rAcc', `${summary.accuracyPct}%`);
  safeText('rComboMax', summary.comboMax);
  safeText('rMiss', summary.miss);

  safeText('rGoals', `${Math.round(summary.greenHoldSec)}s GREEN`);
  safeText('rMinis', `${summary.stormOk}/${summary.stormCycles}`);
  safeText('rTier', summary.tier);

  const tips = [];
  const stormRate = summary.stormCycles ? Math.round((summary.stormOk / summary.stormCycles) * 100) : 0;

  if (stormRate < 60) tips.push('• เคล็ดลับ: พอหลุด GREEN ให้รีบยิง GOOD 1–2 ครั้งเพื่อดึงกลับ');
  if (summary.miss > 6) tips.push('• เลี่ยง BAD: อย่ายิงรัวตอนเป้าแน่น ให้หยุดครึ่งจังหวะแล้วเล็งใหม่');
  if (summary.comboMax < 6) tips.push('• ทำคอมโบ: เลือกยิง GOOD ที่ใกล้ศูนย์กลางก่อน จะติดง่ายขึ้นในมือถือ');
  if (!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่มความยากหรือโหมด research เพื่อเก็บข้อมูล');

  const tipsEl = DOC.getElementById('rTips');
  if (tipsEl) tipsEl.textContent = tips.join('\n');

  const nextEl = DOC.getElementById('rNext');
  if (nextEl) nextEl.textContent = `Next: diff=${summary.diff} | run=${summary.run} | seed=${summary.seed}`;

  const back = DOC.getElementById('resultBackdrop');
  if (back) back.hidden = false;

  bindResultButtons(summary);
}

/* =========================
   START/STOP
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

  Engine.logs = [];
  Engine.coachLastMs = 0;

  Engine.ended = false;
  Engine.running = true;
  Engine.started = true;

  // ✅ hide summary when starting (extra safety)
  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

  setWaterUI(Engine.waterPct);
  setQuestUI();

  Engine.t0 = nowMs();
  Engine.lastT = Engine.t0;

  logEv('start', { run: Engine.run, diff: Engine.diff, timeSec: Engine.timeSec, seed: Engine.seed });
  emit('hha:start', { game: 'hydration', run: Engine.run, diff: Engine.diff, time: Engine.timeSec, seed: Engine.seed });

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });

  for (const L of Engine.layers) {
    L.addEventListener('pointerdown', onLayerPointerDown, { passive: false });
  }

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

  logEv('end', { score: summary.score, grade: summary.grade, miss: summary.miss });
  emit('hha:end', summary);

  showResult(summary);
}

/* =========================
   INPUT HANDLERS
========================= */

function onShoot(e) {
  handleShootEvent(e?.detail);
}

function onLayerPointerDown(e) {
  if (!Engine.running || Engine.ended) return;
  e.preventDefault();
  handleShootEvent({ x: e.clientX, y: e.clientY, lockPx: 28, source: 'layer' });
}

/* =========================
   AUTO-BOOT (HARDENED)
========================= */

(function boot(){
  // ✅ Fix: summary overlay should never show on boot
  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

  // ✅ Lock hidden behavior + force targets visible
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

  // Start by event from page overlay
  WIN.addEventListener('hha:start', () => startGame(), { passive: true });

  // HARDEN: startOverlay might exist but not visible -> auto start anyway
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
    }catch(_){
      return true;
    }
  }

  // fallback auto start
  setTimeout(() => {
    const ov = DOC.getElementById('startOverlay');
    const visible = isOverlayActuallyVisible(ov);
    if (!visible && !Engine.started) startGame();
  }, 260);

  // expose debug
  try {
    WIN.HydrationVR = {
      start: startGame,
      stop: stopGame,
      end: endGame,
      getState: () => JSON.parse(JSON.stringify({
        run: Engine.run, diff: Engine.diff, timeSec: Engine.timeSec, seed: Engine.seed,
        score: Engine.score, combo: Engine.combo, miss: Engine.miss,
        waterPct: Engine.waterPct, zone: Engine.zone, phase: Engine.phase
      }))
    };
  } catch {}
})();

export {}; // ESM marker