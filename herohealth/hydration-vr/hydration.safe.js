// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard)
// ✅ FULL (One-file) = includes PATCH A + PATCH B + PATCH C + PACK 1–10
//
// PATCH A: “Storm ไม่เข้าเลย” -> hardened storm trigger (off-green decay + far-trigger + time-based safeguard)
// PATCH B: “ออก GREEN แล้วไม่กลับมาเลย” -> micro-recovery (research) + comeback boost (play/research) + drift clamp
// PATCH C: “Tap / shoot / overlay / double-start” -> anti double-start + overlay visibility harden + shoot lock aim
//
// PACK 1–10 (Fun/Challenge/AI):
// 1) Storm hardened trigger + clear storm rules
// 2) Research micro-recovery so it never gets stuck off-green
// 3) Comeback boost when far from 55 (kids feel “กู้เกมได้”)
// 4) Boss escalation tempo + pressure
// 5) Shield pickup blocks BAD once (HUD id already exists)
// 6) Fever streak (score boost + visual)
// 7) AI Prediction-lite (rule-based) -> emits hha:rank
// 8) ML/DL stub hook (optional window.HHA_AI, OFF unless ?ai=1)
// 9) Logging expanded (miss, phase, rank, coach)
// 10) QA hardening (hidden display lock + force targets visible)
//
// Emits: hha:start, hha:time, hha:score, hha:rank, hha:coach, hha:end
// Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
//
// NOTE: This file is ESM-safe (import './hydration.safe.js' works). No external deps required.

'use strict';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));
const clamp01 = (v) => clamp(v, 0, 1);

const qs = (k, d = null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };
const qn = (k, d = 0) => Number(qs(k, d)) || Number(d) || 0;
const nowMs = () => (performance && performance.now) ? performance.now() : Date.now();

function emit(name, detail) { try { WIN.dispatchEvent(new CustomEvent(name, { detail })); } catch {} }
function safeText(id, txt) { const el = DOC.getElementById(id); if (el) el.textContent = String(txt); }

function safeDownload(filename, text, mime = 'text/plain') {
  try {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url; a.download = filename;
    DOC.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch {}
}
function safeCopy(text) { try { navigator.clipboard?.writeText(String(text)); } catch {} }

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

function getLayerIds() {
  const cfg = WIN.HHA_VIEW || {};
  const ids = (Array.isArray(cfg.layers) && cfg.layers.length) ? cfg.layers : ['hydration-layer'];
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
    if (!L.style.position) L.style.position = 'absolute';
    if (!L.style.inset) L.style.inset = '0';
    L.style.pointerEvents = 'auto';
  }
  return layers;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

function cfgByDiff(diff) {
  const base = {
    easy:   { spawnPerSec: 0.95, size: 74, ttl: 1400, goodDelta: 9,  badDelta: -9,  drift: 0.22, lock: 28, stormDur: 8500, stormNeed: 6,  endMs: 9000,  endNeed: 5200, bossMs: 9000,  bossNeed: 7  },
    normal: { spawnPerSec: 1.15, size: 68, ttl: 1250, goodDelta: 8,  badDelta: -10, drift: 0.28, lock: 28, stormDur: 9000, stormNeed: 8,  endMs: 10000, endNeed: 6200, bossMs: 10000, bossNeed: 9  },
    hard:   { spawnPerSec: 1.35, size: 62, ttl: 1100, goodDelta: 7,  badDelta: -12, drift: 0.33, lock: 28, stormDur: 9500, stormNeed: 10, endMs: 11000, endNeed: 7200, bossMs: 11000, bossNeed: 11 },
  };
  return base[diff] || base.normal;
}

function makeTargetEl(kind, x, y, sizePx, ttlMs) {
  const el = DOC.createElement('div');
  el.className = 'hvr-target';
  el.dataset.kind = kind;

  const emoji =
    (kind === 'GOOD') ? '💧' :
    (kind === 'BAD') ? '🥤' :
    (kind === 'SHIELD') ? '🛡️' :
    '🌀';

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

  if (kind === 'GOOD')   el.style.outline = '2px solid rgba(34,197,94,.22)';
  if (kind === 'BAD')    el.style.outline = '2px solid rgba(239,68,68,.22)';
  if (kind === 'STORM')  el.style.outline = '2px dashed rgba(34,211,238,.26)';
  if (kind === 'SHIELD') el.style.outline = '2px solid rgba(245,158,11,.30)';

  el.dataset.birth = String(nowMs());
  el.dataset.ttl = String(ttlMs || 1200);

  return el;
}

const Engine = {
  started: false,
  running: false,
  ended: false,

  t0: 0,
  lastT: 0,
  rafId: 0,

  run: 'play',
  runMode: 'play',
  diff: 'normal',
  timeSec: 70,
  timePlannedSec: 70,
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
  _endGreenMs: 0,

  bossMs: 0,
  bossNeed: 0,
  bossHit: 0,

  targets: new Set(),
  spawnAcc: 0,

  logs: [],
  coachLastMs: 0,

  shield: 0, // PACK5
  feverOn: false, // PACK6
  feverLeftMs: 0,

  // prediction-lite (PACK7)
  _shots: 0,
  _hits: 0,
  _emaAcc: 0.60,
  _emaZone: 0.55,
  _risk: 0.25,
  _rank: '—',
  _rankTick: 0,
  _aiTipTick: 0,

  // storm trigger state (PATCH A)
  _offGreenMs: 0,
  _sinceStormMs: 0,

  // QA (PATCH C)
  _startLock: false,
};

function logEv(type, data) { Engine.logs.push({ t: Date.now(), type, ...data }); }

function readCtx() {
  Engine.run = String(qs('run', 'play')).toLowerCase() === 'research' ? 'research' : 'play';
  Engine.runMode = Engine.run;

  const diff = String(qs('diff', 'normal')).toLowerCase();
  Engine.diff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';

  Engine.timeSec = clamp(qn('time', 70), 20, 600) | 0;
  Engine.timePlannedSec = Engine.timeSec;

  const seedQ = qn('seed', 0);
  Engine.seed = seedQ ? seedQ : Date.now();
}

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

function coachTip(msg, cooldownMs = 2800) {
  const t = nowMs();
  if (t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;
  emit('hha:coach', { msg, game: 'hydration' });
  logEv('coach', { msg });
}

function setQuestUI() {
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
        : `ตอนนี้: โซน ${Engine.zone}`;

  const feverTxt = Engine.feverOn ? ` | FEVER ${(Engine.feverLeftMs/1000).toFixed(1)}s` : '';
  const rankTxt  = Engine._rank ? ` | Rank: ${Engine._rank}` : '';

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm cycles: ${Engine.stormCycles} | Storm OK: ${Engine.stormOk}${feverTxt}${rankTxt}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax} | Shield: ${Engine.shield}`);

  safeText('storm-left', (Engine.phase === 'STORM') ? Math.ceil(Engine.stormLeftMs/1000) : 0);
  safeText('shield-count', Engine.shield | 0);
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

function computePrediction(dt) {
  const alpha = clamp(dt * 0.9, 0.01, 0.12);

  const accNow = Engine._shots ? (Engine._hits / Engine._shots) : 0.6;
  Engine._emaAcc = Engine._emaAcc + (accNow - Engine._emaAcc) * alpha;

  const zNow = clamp01(Engine.waterPct / 100);
  Engine._emaZone = Engine._emaZone + (zNow - Engine._emaZone) * alpha;

  const off = (Engine.zone === 'GREEN') ? 0 : 1;
  const phaseRisk =
    (Engine.phase === 'BOSS') ? 0.25 :
    (Engine.phase === 'STORM') ? 0.15 :
    0.05;

  let r = 0.10 + off * 0.35 + (1 - Engine._emaAcc) * 0.35 + phaseRisk;
  const dist = Math.abs(55 - Engine.waterPct);
  r += Math.min(0.18, dist / 220);
  Engine._risk = clamp01(Engine._risk + (r - Engine._risk) * alpha);

  const risk = Engine._risk;
  Engine._rank =
    (risk < 0.22) ? '✅ Safe' :
    (risk < 0.45) ? '⚠️ Risk' :
    '🔥 Danger';

  Engine._rankTick += dt;
  if (Engine._rankTick > 1.2) {
    Engine._rankTick = 0;
    emit('hha:rank', {
      game: 'hydration',
      runMode: Engine.runMode,
      diff: Engine.diff,
      risk: Number(Engine._risk.toFixed(3)),
      emaAcc: Number(Engine._emaAcc.toFixed(3)),
      zone: Engine.zone,
      waterPct: Engine.waterPct | 0,
      rank: Engine._rank
    });
    logEv('rank', { risk: Engine._risk, emaAcc: Engine._emaAcc, zone: Engine.zone, water: Engine.waterPct, rank: Engine._rank });
  }

  // PACK8: optional external hook (OFF unless ?ai=1)
  const aiOn = String(qs('ai', '0') || '0') === '1';
  if (aiOn) {
    try {
      const api = WIN.HHA_AI;
      if (api && typeof api.predictHydration === 'function') {
        const out = api.predictHydration({
          state: {
            runMode: Engine.runMode,
            diff: Engine.diff,
            phase: Engine.phase,
            waterPct: Engine.waterPct,
            zone: Engine.zone,
            score: Engine.score,
            combo: Engine.combo,
            miss: Engine.miss,
            stormHit: Engine.stormHit,
            stormNeed: Engine.stormNeed,
            bossHit: Engine.bossHit,
            bossNeed: Engine.bossNeed,
            emaAcc: Engine._emaAcc,
            risk: Engine._risk,
            seed: Engine.seed
          }
        }) || {};
        if (typeof out.risk === 'number') Engine._risk = clamp01(out.risk);
        Engine._aiTipTick += dt;
        if (out.tip && Engine._aiTipTick > 3.0) {
          Engine._aiTipTick = 0;
          coachTip(String(out.tip), 0);
          logEv('ai_tip', { tip: String(out.tip), risk: Engine._risk });
        }
      }
    } catch {}
  }
}

function removeTarget(el) {
  try { Engine.targets.delete(el); } catch {}
  try { el.remove(); } catch {}
}

function hitTarget(el, info) {
  if (!Engine.running || Engine.ended) return;
  if (!el || !el.isConnected) return;

  const kind = el.dataset.kind || 'GOOD';
  const cfg = cfgByDiff(Engine.diff);

  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  const feverMult = Engine.feverOn ? 1.15 : 1.0;

  if (kind === 'GOOD') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

    // PATCH B + PACK3: comeback boost when far from 55
    const dist = Math.abs(55 - Engine.waterPct);
    const boost = Math.min(4, Math.floor(dist / 18)); // 0..4
    adjustWater(+cfg.goodDelta + boost);

    const bonus = 60 + Math.min(240, Engine.combo * 10);
    addScore(Math.round((80 + bonus) * feverMult));

    if (Engine.phase === 'STORM') Engine.stormHit += 1;
    if (Engine.phase === 'BOSS')  Engine.bossHit += 1;

    // PACK6: fever on streak
    if (!Engine.feverOn && Engine.combo >= 8) {
      Engine.feverOn = true;
      Engine.feverLeftMs = 4200;
      DOC.body.classList.add('hha-fever');
      coachTip('🔥 FEVER! ช่วงนี้ได้แต้มเพิ่ม อย่าพลาด!', 0);
      logEv('fever', { on: true, combo: Engine.combo });
    }

    Engine._shots += 1;
    Engine._hits  += 1;

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);

  } else if (kind === 'BAD') {
    Engine._shots += 1;

    // PACK5: shield blocks BAD once
    if (Engine.shield > 0) {
      Engine.shield = Math.max(0, Engine.shield - 1);
      addScore(Math.round(25 * feverMult));
      coachTip('🛡️ SHIELD ป้องกัน BAD ได้ 1 ครั้ง!', 0);
      logEv('block', { kind: 'BAD', phase: Engine.phase, shield: Engine.shield, score: Engine.score, water: Engine.waterPct });
    } else {
      Engine.miss += 1;
      Engine.combo = 0;

      if (Engine.feverOn) {
        Engine.feverOn = false;
        Engine.feverLeftMs = 0;
        DOC.body.classList.remove('hha-fever');
        logEv('fever', { on: false, reason: 'bad_hit' });
      }

      adjustWater(cfg.badDelta);
      addScore(-30);
      coachTip('โดน BAD! รีบกลับเข้า GREEN', 2300);
      logEv('miss', { phase: Engine.phase, reason: 'bad_hit', score: Engine.score, water: Engine.waterPct });
    }

  } else if (kind === 'STORM') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

    adjustWater(+Math.max(4, (cfg.goodDelta - 3)));
    addScore(Math.round(120 * feverMult));
    if (Engine.phase === 'STORM') Engine.stormHit += 2;

    Engine._shots += 1;
    Engine._hits  += 1;

    coachTip('🌀 STORM core! ได้แต้มพิเศษ', 2200);

  } else { // SHIELD
    Engine.shield = clamp((Engine.shield | 0) + 1, 0, 3);
    addScore(Math.round(40 * feverMult));
    Engine._shots += 1;
    Engine._hits  += 1;
    coachTip('🛡️ ได้ SHIELD! กัน BAD ได้ 1 ครั้ง', 0);
    logEv('pickup', { kind: 'SHIELD', shield: Engine.shield, phase: Engine.phase });
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
    // PACK9: shot-miss logs (storm/boss adds punishment)
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      Engine._shots += 1;
      logEv('miss', { phase: Engine.phase, reason: 'aim_miss', source: detail.source || 'hha:shoot', score: Engine.score, water: Engine.waterPct });
      coachTip('พลาด! ลองปรับมือถือให้เล็งนิ่งขึ้น');
    } else {
      Engine._shots += 1;
      logEv('miss', { phase: Engine.phase, reason: 'aim_miss_main', source: detail.source || 'hha:shoot' });
    }
    doShock(x, y);
  }
}

function spawnOne(rng, cfg) {
  const layers = Engine.layers;
  if (!layers.length) return;

  for (const layer of layers) {
    const rect = layer.getBoundingClientRect();

    const pad = Math.max(24, (cfg.size * 0.55) | 0);
    const x = clamp((rect.width * (0.10 + rng() * 0.80)), pad, rect.width - pad);
    const y = clamp((rect.height * (0.18 + rng() * 0.68)), pad, rect.height - pad);

    const isStorm = (Engine.phase === 'STORM');
    const isBoss  = (Engine.phase === 'BOSS');

    let pBad = (Engine.zone === 'GREEN') ? 0.26 : 0.36;
    if (isStorm) pBad = 0.22;
    if (isBoss)  pBad = 0.42;

    // PACK4: boss escalation -> more BAD later
    if (isBoss) {
      const prog = clamp01(1 - (Engine.bossMs / Math.max(1, cfg.bossMs)));
      pBad = clamp(pBad + prog * 0.08, 0.10, 0.62);
    }

    let kind = (rng() < pBad) ? 'BAD' : 'GOOD';
    if (isStorm && rng() < 0.10) kind = 'STORM';

    // PACK5: shield spawn (rare), avoid in storm
    if (!isStorm && rng() < 0.045 && Engine.shield <= 1) kind = 'SHIELD';

    const ttl  = cfg.ttl + ((rng() * 300) | 0);
    const size = cfg.size + ((rng() * 8) | 0);

    const el = makeTargetEl(kind, x, y, size, ttl);
    layer.appendChild(el);
    Engine.targets.add(el);

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      hitTarget(el, { source: 'pointer', x: e.clientX, y: e.clientY });
    }, { passive: false });

    setTimeout(() => {
      if (!Engine.running) return;
      if (!el.isConnected) return;

      // storm/boss pressure: missing GOOD counts miss
      if (el.dataset.kind === 'GOOD' && (Engine.phase === 'STORM' || Engine.phase === 'BOSS')) {
        Engine.miss += 1;
        Engine.combo = 0;
        Engine._shots += 1;
        logEv('miss', { phase: Engine.phase, reason: 'ttl_miss_good', score: Engine.score, water: Engine.waterPct });
        coachTip('พลาด GOOD! ลองเล็งกลางเป้าให้ชัดขึ้น');
      }
      removeTarget(el);
    }, ttl);
  }
}

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

function step(t) {
  if (!Engine.running) return;

  const cfg = cfgByDiff(Engine.diff);
  const dt = Math.min(0.06, Math.max(0, (t - Engine.lastT) / 1000));
  Engine.lastT = t;

  const elapsed = (t - Engine.t0) / 1000;
  const left = Math.max(0, Engine.timePlannedSec - elapsed);

  emit('hha:time', { t: elapsed, left, phase: Engine.phase });
  setStatsUI(left);

  // adaptive spawn (play)
  let spawnRate = cfg.spawnPerSec;
  if (Engine.runMode === 'play') {
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 55);
    spawnRate = cfg.spawnPerSec * (0.9 + perf * 0.35);
  }

  // boss escalation
  if (Engine.phase === 'BOSS') {
    const prog = clamp01(1 - (Engine.bossMs / Math.max(1, cfg.bossMs)));
    spawnRate *= (1.05 + prog * 0.20);
  }

  // PATCH B (never stuck) drift:
  // play: stronger drift, research: micro drift
  {
    const target = 55;
    if (Engine.runMode === 'play') {
      Engine.waterPct += (target - Engine.waterPct) * cfg.drift * dt;
    } else {
      Engine.waterPct += (target - Engine.waterPct) * 0.06 * dt; // micro-recovery
    }
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  }
  setWaterUI(Engine.waterPct);

  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  // fever countdown
  if (Engine.feverOn) {
    Engine.feverLeftMs -= dt * 1000;
    if (Engine.feverLeftMs <= 0) {
      Engine.feverOn = false;
      Engine.feverLeftMs = 0;
      DOC.body.classList.remove('hha-fever');
      logEv('fever', { on: false, reason: 'timeout' });
    }
  }

  const leftMs = left * 1000;

  // Enter END window late-game
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // PATCH A: storm trigger hardened
  if (Engine.phase === 'MAIN') {
    // track time since last storm trigger opportunity
    Engine._sinceStormMs += dt * 1000;

    if (Engine.zone === 'GREEN') {
      // decay off-green timer (not instant reset)
      Engine._offGreenMs = Math.max(0, Engine._offGreenMs - dt * 1000 * 0.85);
    } else {
      Engine._offGreenMs += dt * 1000;
    }

    const far = (Engine.waterPct < 32 || Engine.waterPct > 78); // far from green
    const timeSafeguard = (Engine._sinceStormMs > 14000);       // ensure storm eventually happens
    const trigger = (Engine._offGreenMs > 1600) || far || timeSafeguard;

    if (trigger) {
      Engine._offGreenMs = 0;
      Engine._sinceStormMs = 0;
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
      Engine._shots += 2;
      logEv('miss', { phase: 'STORM', reason: 'storm_fail', score: Engine.score, water: Engine.waterPct });
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

  // spawn
  Engine.spawnAcc += dt * spawnRate;
  if (Engine.phase === 'STORM') Engine.spawnAcc += dt * 0.45;
  if (Engine.phase === 'BOSS')  Engine.spawnAcc += dt * 0.65;

  const rng = Engine.rng;
  while (Engine.spawnAcc >= 1) {
    Engine.spawnAcc -= 1;
    spawnOne(rng, cfg);
  }

  // GC
  Engine._gcAcc = (Engine._gcAcc || 0) + dt;
  if (Engine._gcAcc > 0.7) {
    Engine._gcAcc = 0;
    for (const el of Array.from(Engine.targets)) {
      if (!el || !el.isConnected) Engine.targets.delete(el);
    }
  }

  computePrediction(dt);
  setQuestUI();

  if (left <= 0.001 && !Engine.ended) {
    endGame();
    return;
  }

  Engine.rafId = requestAnimationFrame(step);
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

function buildSummary() {
  const shots = Engine._shots | 0;
  const hits  = Engine._hits  | 0;
  const acc = shots ? Math.round((hits / shots) * 100) : 0;

  const grade = gradeFromScore(Engine.score);
  const tier = (grade === 'S' || grade === 'A') ? '🔥 Elite'
    : (grade === 'B') ? '⚡ Skilled'
    : (grade === 'C') ? '✅ Ok'
    : '🧊 Warm-up';

  return {
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
    accuracyPct: acc,

    greenHoldSec: Math.round((Engine.greenHoldMs / 1000) * 10) / 10,
    stormCycles: Engine.stormCycles | 0,
    stormOk: Engine.stormOk | 0,
    bossNeed: Engine.bossNeed | 0,
    bossHit: Engine.bossHit | 0,

    rankFinal: Engine._rank || '—',
    riskFinal: Number((Engine._risk || 0).toFixed(3)),
    emaAccFinal: Number((Engine._emaAcc || 0).toFixed(3)),

    logs: Engine.logs.slice(0, 4000),

    // legacy aliases
    run: Engine.runMode,
    timeSec: Engine.timePlannedSec,
    score: Engine.score | 0
  };
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
  const sessionRows = [
    ['ts', s.ts],
    ['game', s.game],
    ['runMode', s.runMode],
    ['diff', s.diff],
    ['timePlannedSec', s.timePlannedSec],
    ['seed', s.seed],
    ['scoreFinal', s.scoreFinal],
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
    ['rankFinal', s.rankFinal ?? '—'],
    ['riskFinal', s.riskFinal ?? ''],
    ['emaAccFinal', s.emaAccFinal ?? ''],
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

  if (stormRate < 60) tips.push('• เคล็ดลับ: พอหลุด GREEN ให้รีบยิง GOOD 1–2 ครั้งเพื่อดึงกลับ');
  if (summary.miss > 6) tips.push('• เลี่ยง BAD: อย่ายิงรัวตอนเป้าแน่น ให้หยุดครึ่งจังหวะแล้วเล็งใหม่');
  if (summary.comboMax < 6) tips.push('• ทำคอมโบ: เลือกยิง GOOD ที่ใกล้ศูนย์กลางก่อน จะติดง่ายขึ้นในมือถือ');
  if ((summary.riskFinal ?? 0) > 0.45) tips.push('• AI Rank: ถ้า Danger บ่อย ให้โฟกัส “กลับเข้า GREEN” ก่อนคอมโบ');
  if (!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่มความยากหรือโหมด research เพื่อเก็บข้อมูล');

  const tipsEl = DOC.getElementById('rTips');
  if (tipsEl) tipsEl.textContent = tips.join('\n');

  const nextEl = DOC.getElementById('rNext');
  if (nextEl) nextEl.textContent = `Next: diff=${summary.diff} | runMode=${summary.runMode} | seed=${summary.seed} | rank=${summary.rankFinal ?? '—'}`;

  const back = DOC.getElementById('resultBackdrop');
  if (back) back.hidden = false;

  bindResultButtons(summary);
}

function endGame() {
  if (Engine.ended) return;
  Engine.ended = true;

  stopGame();

  const summary = buildSummary();
  saveSummary(summary);

  logEv('end', { scoreFinal: summary.scoreFinal, grade: summary.grade, miss: summary.miss, acc: summary.accuracyPct });
  emit('hha:end', summary);

  showResult(summary);
}

function startGame() {
  // PATCH C: anti double-start
  if (Engine._startLock) return;
  Engine._startLock = true;
  setTimeout(() => { Engine._startLock = false; }, 250);

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
  Engine._offGreenMs = 0;
  Engine._sinceStormMs = 0;

  Engine.targets = new Set();
  Engine.spawnAcc = 0;

  Engine.logs = [];
  Engine.coachLastMs = 0;

  Engine.ended = false;
  Engine.running = true;
  Engine.started = true;

  Engine.shield = 0;
  Engine.feverOn = false;
  Engine.feverLeftMs = 0;
  DOC.body.classList.remove('hha-fever');

  Engine._shots = 0;
  Engine._hits = 0;
  Engine._emaAcc = 0.60;
  Engine._emaZone = 0.55;
  Engine._risk = 0.25;
  Engine._rank = '—';
  Engine._rankTick = 0;
  Engine._aiTipTick = 0;

  // hide summary overlay on start
  try { const back = DOC.getElementById('resultBackdrop'); if (back) back.hidden = true; } catch {}

  setWaterUI(Engine.waterPct);
  setQuestUI();

  Engine.t0 = nowMs();
  Engine.lastT = Engine.t0;

  logEv('start', { runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed });

  emit('hha:start', {
    game: 'hydration',
    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,
    run: Engine.runMode,
    time: Engine.timePlannedSec
  });

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });

  for (const L of Engine.layers) {
    L.addEventListener('pointerdown', onLayerPointerDown, { passive: false });
  }

  Engine.rafId = requestAnimationFrame(step);
  coachTip('เริ่มเลย! คุมให้อยู่ GREEN แล้วเตรียมรับ STORM', 0);
}

function onShoot(e) { handleShootEvent(e?.detail); }
function onLayerPointerDown(e) {
  if (!Engine.running || Engine.ended) return;
  e.preventDefault();
  handleShootEvent({ x: e.clientX, y: e.clientY, lockPx: 28, source: 'layer' });
}

// BOOT (PATCH C hardened)
(function boot(){
  // ensure [hidden] and targets visibility robustness
  try {
    if (!DOC.getElementById('hydration-safe-style')) {
      const st = DOC.createElement('style');
      st.id = 'hydration-safe-style';
      st.textContent = `
        .hvr-target{ opacity:1 !important; visibility:visible !important; display:flex !important; }
        [hidden]{ display:none !important; }
        body.hha-fever::before{
          content:"";
          position:fixed; inset:-40px;
          background: radial-gradient(circle at 30% 25%, rgba(245,158,11,.12), transparent 58%),
                      radial-gradient(circle at 70% 70%, rgba(34,197,94,.10), transparent 60%);
          pointer-events:none;
          z-index: 1;
          opacity: .9;
        }
      `;
      DOC.head.appendChild(st);
    }
  } catch {}

  // always hide result overlay on boot
  try { const back = DOC.getElementById('resultBackdrop'); if (back) back.hidden = true; } catch {}

  // page overlay triggers start by dispatching hha:start — we listen and start
  WIN.addEventListener('hha:start', () => startGame(), { passive: true });

  // fallback autostart if overlay not visible
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
  setTimeout(() => {
    const ov = DOC.getElementById('startOverlay');
    const visible = isOverlayActuallyVisible(ov);
    if (!visible && !Engine.started) startGame();
  }, 260);

  // wire result buttons (in case template exists early)
  try{
    const hub = String(qs('hub','../hub.html'));
    DOC.querySelectorAll('.btnBackHub')?.forEach(b => b.addEventListener('click', ()=> location.href = hub));
    DOC.getElementById('btnCopyJSON')?.addEventListener('click', ()=>{
      try{ safeCopy(localStorage.getItem(LS_LAST) || ''); }catch(_){}
    });
    DOC.getElementById('btnDownloadCSV')?.addEventListener('click', ()=>{
      try{
        const s = JSON.parse(localStorage.getItem(LS_LAST) || '{}');
        safeDownload(`hydration-last.csv`, summaryToCSV(s), 'text/csv');
      }catch(_){}
    });
  }catch(_){}

  // expose debug
  try {
    WIN.HydrationVR = {
      start: startGame,
      stop: stopGame,
      end: endGame,
      getState: () => JSON.parse(JSON.stringify({
        runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed,
        score: Engine.score, combo: Engine.combo, miss: Engine.miss,
        waterPct: Engine.waterPct, zone: Engine.zone, phase: Engine.phase,
        stormCycles: Engine.stormCycles, stormOk: Engine.stormOk,
        shield: Engine.shield, feverOn: Engine.feverOn,
        risk: Engine._risk, rank: Engine._rank
      }))
    };
  } catch {}
})();

export {}; // ESM marker