// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard)
// FULL PATCH — PACK 1–10 (A+B+C merged)
// ---------------------------------------------------
// ✅ PC/Mobile/cVR/Cardboard (multi-layer)
// ✅ Targets visible + robust layer mounting
// ✅ Tap-to-shoot via hha:shoot {x,y,lockPx,source} (from vr-ui.js)
// ✅ Core Loop: Keep water in GREEN, LOW/HIGH drives STORM, End Window, Boss 3 phases
// ✅ STORM RULES (as requested):
//    - Enter STORM only when player is in LOW or HIGH (off GREEN) for a short time
//    - Lightning (⚡) can ONLY be blocked if player has 🛡 Shield
//    - Storm success requires BOTH: collect enough 💧 AND block enough ⚡ (with shield)
//    - Storm level increases ⚡ requirement/spawn
// ✅ Shield:
//    - 🛡 pickup spawns in MAIN (and a little in STORM/BOSS)
//    - Shield consumed when blocking ⚡
// ✅ Emits: hha:start, hha:time, hha:score, hha:rank, hha:coach, hha:ai, hha:boss, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// ✅ CSV download + JSON copy from result overlay buttons
// ✅ Research deterministic (seeded), Play adaptive (difficulty director lite)
// ✅ PATCH A+B+C:
//    - Force-hide result overlay on boot + lock [hidden]
//    - Hardened auto-start when overlay exists but not visible
//    - Standardize summary schema (runMode/timePlannedSec/scoreFinal/miss/accuracyPct/comboMax) + keep legacy aliases
// ✅ PACK 9: AI Prediction hooks (safe stub)
// ✅ PACK 10: Boss 3 phases + progress bar hooks (auto inject if missing)

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
  if (score >= 2600) return 'S';
  if (score >= 2000) return 'A';
  if (score >= 1400) return 'B';
  if (score >= 850)  return 'C';
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

function logEv(type, data) {
  Engine.logs.push({ t: Date.now(), type, ...data });
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

  const emoji =
    (kind === 'GOOD') ? '💧' :
    (kind === 'BAD') ? '🥤' :
    (kind === 'STORM') ? '🌀' :
    (kind === 'LIGHTNING') ? '⚡' :
    (kind === 'SHIELD') ? '🛡' :
    '❓';

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
  if (kind === 'LIGHTNING') el.style.outline = '2px solid rgba(245,158,11,.26)';
  if (kind === 'SHIELD') el.style.outline = '2px solid rgba(168,85,247,.26)';

  el.dataset.birth = String(nowMs());
  el.dataset.ttl = String(ttlMs || 1200);

  return el;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/* =========================
   PROGRESS BAR (PACK 10)
========================= */

function ensureProgressBar(){
  try{
    if (DOC.getElementById('hha-progress')) return;

    const wrap = DOC.createElement('div');
    wrap.id = 'hha-progress';
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.right = '12px';
    wrap.style.top = 'calc(64px + var(--sat, 0px))';
    wrap.style.height = '10px';
    wrap.style.borderRadius = '999px';
    wrap.style.background = 'rgba(148,163,184,.14)';
    wrap.style.border = '1px solid rgba(148,163,184,.12)';
    wrap.style.zIndex = '1500';
    wrap.style.pointerEvents = 'none';

    const bar = DOC.createElement('i');
    bar.id = 'hha-progress-bar';
    bar.style.display = 'block';
    bar.style.height = '100%';
    bar.style.width = '0%';
    bar.style.borderRadius = '999px';
    bar.style.background = 'rgba(34,197,94,.55)';
    wrap.appendChild(bar);

    DOC.body.appendChild(wrap);
  }catch(_){}
}

function setProgress(pct){
  try{
    ensureProgressBar();
    const b = DOC.getElementById('hha-progress-bar');
    if (b) b.style.width = `${clamp(pct,0,100).toFixed(1)}%`;
  }catch(_){}
}

/* =========================
   AI HOOKS (PACK 9)
========================= */

function getAI(){
  try{
    if (WIN.HHA?.createAIHooks) return WIN.HHA.createAIHooks({ game:'hydration' }) || null;
  }catch(_){}
  return null;
}
function aiSafeCall(fn, payload){
  try{ return fn ? fn(payload) : null; }catch(_){ return null; }
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

  run: 'play',       // legacy
  runMode: 'play',   // canonical
  diff: 'normal',
  timeSec: 70,       // legacy
  timePlannedSec: 70,// canonical
  seed: 0,

  layers: [],
  score: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  waterPct: 50,
  greenHoldMs: 0,
  zone: 'GREEN',

  // Shield system
  shield: 0,
  shieldMax: 5,
  shieldPickups: 0,
  lightningBlocked: 0,

  // Phases
  phase: 'MAIN', // MAIN | STORM | END | BOSS
  stormCycles: 0,
  stormOk: 0,
  stormLevel: 1,
  stormLeftMs: 0,
  stormNeedWater: 0,
  stormHitWater: 0,
  stormNeedLightning: 0,
  stormHitLightning: 0,

  endWindowMs: 0,
  endNeedGreenMs: 0,
  _endGreenMs: 0,

  // Boss 3 phases
  bossPhase: 0,
  bossTimerTotalMs: 0,
  bossMs: 0,
  bossNeedWater: 0,
  bossHitWater: 0,
  bossNeedLightning: 0,
  bossHitLightning: 0,
  bossProgressPct: 0,

  targets: new Set(),
  spawnAcc: 0,

  logs: [],
  coachLastMs: 0,

  // off-green tracker (storm gate)
  _offGreenMs: 0,

  // ai
  aiOn: false,
  aiMode: 'off', // off | pred | full
  aiHooks: null,
  _aiLastMs: 0,
  aiPred: { riskOffGreen: 0, recommend: null, tip: null }
};

function cfgByDiff(diff) {
  const base = {
    easy:   { spawnPerSec: 0.95, size: 74, ttl: 1500, goodDelta: 9,  badDelta: -8,  drift: 0.26, lock: 28, stormDur: 9000, endMs: 9000,  endNeed: 5200, bossPhaseMs: 9000  },
    normal: { spawnPerSec: 1.15, size: 68, ttl: 1350, goodDelta: 8,  badDelta: -9,  drift: 0.30, lock: 28, stormDur: 9500, endMs: 10000, endNeed: 6200, bossPhaseMs: 10000 },
    hard:   { spawnPerSec: 1.35, size: 62, ttl: 1200, goodDelta: 7,  badDelta: -10, drift: 0.34, lock: 28, stormDur: 10000,endMs: 11000, endNeed: 7200, bossPhaseMs: 11000 },
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

  // AI toggles:
  // ?ai=1  => play only, full (pred+recommend)
  // ?ai=pred => prediction only (allowed in research)
  const aiQ = String(qs('ai','0')||'0').toLowerCase();
  Engine.aiOn = (aiQ === '1' || aiQ === 'pred');
  Engine.aiMode = (aiQ === 'pred') ? 'pred' : (aiQ === '1') ? 'full' : 'off';
  Engine.aiHooks = getAI();

  // research: allow pred-only if requested, but NEVER auto-tune difficulty
  if (Engine.runMode === 'research' && Engine.aiMode === 'full') Engine.aiMode = 'pred';
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

  Engine.zone = z;
}

function setStatsUI(timeLeftSec) {
  safeText('stat-score', Engine.score | 0);
  safeText('stat-combo', Engine.combo | 0);
  safeText('stat-time', timeLeftSec | 0);
  safeText('stat-miss', Engine.miss | 0);
  safeText('stat-grade', gradeFromScore(Engine.score));
  safeText('shield-count', Engine.shield | 0);
}

function setQuestUI() {
  const z = Engine.zone;
  const phase = Engine.phase;

  const l1 =
    (phase === 'MAIN') ? `คุมให้อยู่โซน GREEN ให้นานที่สุด` :
    (phase === 'STORM') ? `🌀 STORM L${Engine.stormLevel}! เก็บ 💧 + กัน ⚡ (ต้องมี 🛡)` :
    (phase === 'END') ? `⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา` :
    `👑 BOSS PHASE ${Engine.bossPhase}/3: เก็บ 💧 + กัน ⚡`;

  const l2 =
    (phase === 'STORM')
      ? `💧 ${Engine.stormHitWater}/${Engine.stormNeedWater}  |  ⚡ ${Engine.stormHitLightning}/${Engine.stormNeedLightning}  (เหลือ ${(Engine.stormLeftMs/1000).toFixed(1)}s)`
      : (phase === 'END')
        ? `GREEN: ${(Engine._endGreenMs/1000).toFixed(1)}s / ${(Engine.endNeedGreenMs/1000).toFixed(1)}s`
        : (phase === 'BOSS')
          ? `💧 ${Engine.bossHitWater}/${Engine.bossNeedWater}  |  ⚡ ${Engine.bossHitLightning}/${Engine.bossNeedLightning}  (เหลือ ${(Engine.bossMs/1000).toFixed(1)}s)`
          : `ตอนนี้: โซน ${z}  |  🛡 ${Engine.shield}/${Engine.shieldMax}`;

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm: ${Engine.stormOk}/${Engine.stormCycles}  |  Level: ${Engine.stormLevel}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax}  |  ⚡ blocked: ${Engine.lightningBlocked}`);
  safeText('storm-left', (Engine.phase === 'STORM') ? Math.ceil(Engine.stormLeftMs/1000) : 0);
}

function coachTip(msg, cooldownMs = 2800) {
  const t = nowMs();
  if (t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;
  emit('hha:coach', { msg, game: 'hydration' });
  logEv('coach', { msg });
}

/* =========================
   FX
========================= */

function doShock(x, y, cls = 'hha-shock') {
  try {
    const layer = Engine.layers[0] || DOC.body;
    const fx = DOC.createElement('div');
    fx.className = cls;
    fx.style.setProperty('--x', `${x}px`);
    fx.style.setProperty('--y', `${y}px`);
    layer.appendChild(fx);
    setTimeout(() => fx.remove(), 650);
  } catch {}
}

function removeTarget(el) {
  try { Engine.targets.delete(el); } catch {}
  try { el.remove(); } catch {}
}

/* =========================
   CORE MECHANICS
========================= */

function adjustWater(delta) {
  Engine.waterPct = clamp(Engine.waterPct + delta, 0, 100);
  setWaterUI(Engine.waterPct);
}

function addScore(pts) {
  Engine.score += pts;
  emit('hha:score', { score: Engine.score, combo: Engine.combo, miss: Engine.miss, shield: Engine.shield });
}

function giveShield(n = 1){
  const before = Engine.shield;
  Engine.shield = clamp(Engine.shield + n, 0, Engine.shieldMax);
  if (Engine.shield > before) Engine.shieldPickups += (Engine.shield - before);
}

/* =========================
   SPAWNING
========================= */

function pickKind(rng){
  const z = Engine.zone;
  const inStorm = (Engine.phase === 'STORM');
  const inBoss  = (Engine.phase === 'BOSS');
  const inMain  = (Engine.phase === 'MAIN');

  // base bad probability
  let pBad = (z === 'GREEN') ? 0.24 : 0.32;
  if (inStorm) pBad = 0.18;
  if (inBoss)  pBad = 0.34;

  // recovery assist: when off-green, bias MORE GOOD to help return (fix: "ออก green แล้วไม่กลับ")
  if (!inStorm && !inBoss && z !== 'GREEN') pBad = Math.max(0.18, pBad - 0.10);

  // shield pickups: MAIN is primary source (prepare for storm)
  let pShield = 0.06; // MAIN
  if (inStorm) pShield = 0.05;
  if (inBoss)  pShield = 0.05;
  if (Engine.shield >= Engine.shieldMax) pShield = 0.0;

  // lightning spawn: STORM/BOSS only (scales by storm level / boss phase)
  let pLightning = 0.0;
  if (inStorm) {
    const lvl = Engine.stormLevel || 1;
    pLightning = clamp(0.10 + lvl*0.04, 0.10, 0.30);
  }
  if (inBoss) {
    const ph = Engine.bossPhase || 1;
    pLightning = clamp(0.10 + ph*0.06, 0.10, 0.34);
  }

  // storm core occasionally
  let pStormCore = 0.0;
  if (inStorm && rng() < 0.08) return 'STORM';

  // decide
  const r = rng();
  if (pLightning > 0 && r < pLightning) return 'LIGHTNING';
  if (pShield > 0 && r < (pLightning + pShield)) return 'SHIELD';

  return (rng() < pBad) ? 'BAD' : 'GOOD';
}

function spawnOne(rng, cfg) {
  const layers = Engine.layers;
  if (!layers.length) return;

  for (const layer of layers) {
    const rect = layer.getBoundingClientRect();
    const pad = Math.max(24, (cfg.size * 0.55) | 0);

    const x = clamp((rect.width * (0.10 + rng() * 0.80)), pad, rect.width - pad);
    const y = clamp((rect.height * (0.18 + rng() * 0.68)), pad, rect.height - pad);

    const kind = pickKind(rng);
    const ttlBase =
      (kind === 'LIGHTNING') ? (cfg.ttl * 0.72) :
      (kind === 'SHIELD') ? (cfg.ttl * 1.15) :
      cfg.ttl;

    const ttl  = (ttlBase + ((rng() * 260) | 0)) | 0;
    const size = (cfg.size + ((rng() * 8) | 0)) | 0;

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

      // penalties for missing key targets during STORM/BOSS
      if ((Engine.phase === 'STORM' || Engine.phase === 'BOSS')) {
        const k = el.dataset.kind;
        if (k === 'GOOD') {
          Engine.miss += 1;
          Engine.combo = 0;
          coachTip('พลาด 💧! ลองเล็งกลางเป้าให้ชัดขึ้น', 2300);
        }
        if (k === 'LIGHTNING') {
          // if lightning times out: counts as fail pressure
          Engine.miss += 1;
          Engine.combo = 0;
          adjustWater(-5);
          coachTip('⚡ หลุด! ถ้ามี 🛡 ต้องรีบกัน/ตี ⚡', 2300);
          logEv('lightning_timeout', { phase: Engine.phase, shield: Engine.shield });
        }
      }
      removeTarget(el);
    }, ttl);
  }
}

/* =========================
   HIT LOGIC
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

    // stronger recovery when off-green (fix stuck LOW/HIGH)
    const boost = (Engine.zone === 'GREEN') ? 0 : 2;
    adjustWater(+cfg.goodDelta + boost);

    const bonus = 60 + Math.min(260, Engine.combo * 10);
    addScore(90 + bonus);

    if (Engine.phase === 'STORM') Engine.stormHitWater += 1;
    if (Engine.phase === 'BOSS') Engine.bossHitWater += 1;

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);
    logEv('hit', { kind, phase: Engine.phase, score: Engine.score, water: Engine.waterPct, combo: Engine.combo, source: info?.source || 'unknown' });
    doShock(cx, cy);

  } else if (kind === 'BAD') {
    Engine.miss += 1;
    Engine.combo = 0;

    // not too harsh => still recoverable
    adjustWater(cfg.badDelta);
    addScore(-35);

    coachTip('โดน 🥤! รีบกลับเข้า GREEN', 2300);
    logEv('hit', { kind, phase: Engine.phase, score: Engine.score, water: Engine.waterPct, combo: Engine.combo, source: info?.source || 'unknown' });
    doShock(cx, cy);

  } else if (kind === 'STORM') {
    // storm core: water + score bonus
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+Math.max(4, (cfg.goodDelta - 3)));
    addScore(140);
    if (Engine.phase === 'STORM') Engine.stormHitWater += 2;
    coachTip('🌀 STORM core! ได้แต้มพิเศษ', 2200);
    logEv('hit', { kind, phase: Engine.phase, score: Engine.score, water: Engine.waterPct, combo: Engine.combo, source: info?.source || 'unknown' });
    doShock(cx, cy);

  } else if (kind === 'SHIELD') {
    giveShield(1);
    addScore(80);
    coachTip(`ได้ 🛡! ตอนนี้มี ${Engine.shield}/${Engine.shieldMax} (ใช้กัน ⚡ ใน STORM)`, 1800);
    logEv('pickup', { kind:'SHIELD', shield: Engine.shield, phase: Engine.phase });
    doShock(cx, cy);

  } else if (kind === 'LIGHTNING') {
    // as requested: must have shield to block lightning
    if (Engine.shield > 0) {
      Engine.shield -= 1;
      Engine.lightningBlocked += 1;

      addScore(160);
      adjustWater(+3);

      if (Engine.phase === 'STORM') Engine.stormHitLightning += 1;
      if (Engine.phase === 'BOSS')  Engine.bossHitLightning += 1;

      coachTip(`กัน ⚡ สำเร็จ! 🛡 เหลือ ${Engine.shield}`, 1600);
      logEv('lightning_block', { phase: Engine.phase, shieldLeft: Engine.shield, stormL: Engine.stormLevel, bossPhase: Engine.bossPhase });
      doShock(cx, cy);
    } else {
      // no shield => cannot pass lightning objective
      Engine.miss += 1;
      Engine.combo = 0;
      addScore(-60);
      adjustWater(-8);
      coachTip('ต้องมี 🛡 ถึงจะกัน/ตี ⚡ ได้! รีบเก็บ 🛡 ก่อน', 2000);
      logEv('lightning_fail_no_shield', { phase: Engine.phase, shield: 0 });
      doShock(cx, cy, 'hha-shock');
    }
  }

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
    // miss penalty only meaningful in storm/boss (pressure)
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      coachTip('พลาด! ลองเล็งนิ่งขึ้น', 2300);
      logEv('miss', { phase: Engine.phase, source: detail.source || 'hha:shoot' });
    }
    doShock(x, y);
  }
}

/* =========================
   PHASE LOGIC
========================= */

function calcStormNeedWater(diff){
  // water targets required in storm
  const base = (diff === 'easy') ? 6 : (diff === 'hard') ? 10 : 8;
  const lvl = Engine.stormLevel || 1;
  return base + Math.floor((lvl-1) * 1.2);
}

function calcStormNeedLightning(diff){
  // as requested: storm level increases lightning count
  const base = (diff === 'easy') ? 2 : (diff === 'hard') ? 4 : 3;
  const lvl = Engine.stormLevel || 1;
  return base + Math.floor((lvl-1) * 1.1);
}

function enterStorm(cfg) {
  Engine.phase = 'STORM';
  Engine.stormCycles += 1;

  Engine.stormLeftMs = cfg.stormDur;

  Engine.stormNeedWater = calcStormNeedWater(Engine.diff);
  Engine.stormHitWater = 0;

  Engine.stormNeedLightning = calcStormNeedLightning(Engine.diff);
  Engine.stormHitLightning = 0;

  DOC.body.classList.add('hha-bossfx');
  coachTip(`🌀 STORM L${Engine.stormLevel}! ต้องเก็บ 💧 ${Engine.stormNeedWater} และกัน ⚡ ${Engine.stormNeedLightning} (ต้องมี 🛡)`, 0);
  logEv('phase', { phase: 'STORM', level: Engine.stormLevel, needWater: Engine.stormNeedWater, needL: Engine.stormNeedLightning, shield: Engine.shield });
}

function exitStorm(success) {
  Engine.phase = 'MAIN';
  DOC.body.classList.remove('hha-bossfx');

  if (success) {
    Engine.stormOk += 1;
    Engine.stormLevel = 1 + Engine.stormOk; // ✅ level increases with passes
    addScore(220 + Engine.stormLevel * 25);
    giveShield(1); // reward: +1 shield
    coachTip(`ผ่าน STORM! ตอนนี้ STORM Level = ${Engine.stormLevel} (+🛡 โบนัส)`, 0);
  } else {
    // fail penalty
    Engine.miss += 2;
    Engine.combo = 0;
    adjustWater(-8);
    coachTip('STORM ไม่ผ่าน! รอบหน้าเก็บ 🛡 แล้วกัน ⚡ ให้ครบ', 0);
  }

  logEv('storm_end', { success: !!success, level: Engine.stormLevel, hitWater: Engine.stormHitWater, hitL: Engine.stormHitLightning, shield: Engine.shield });
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

  Engine.bossPhase = 1;
  Engine.bossTimerTotalMs = cfg.bossPhaseMs * 3;
  Engine.bossMs = cfg.bossPhaseMs;

  // Phase 1: warm up boss (still hard)
  Engine.bossNeedWater = Math.max(7, 10 + Engine.stormLevel);
  Engine.bossHitWater = 0;

  Engine.bossNeedLightning = Math.max(2, 2 + Math.floor(Engine.stormLevel/2));
  Engine.bossHitLightning = 0;

  DOC.body.classList.add('hha-bossfx');
  coachTip(`👑 BOSS PHASE 1/3: 💧 ${Engine.bossNeedWater} + ⚡ ${Engine.bossNeedLightning} (ต้องมี 🛡)`, 0);
  logEv('phase', { phase: 'BOSS', bossPhase: 1, needWater: Engine.bossNeedWater, needL: Engine.bossNeedLightning });
  setProgress(0);
  emit('hha:boss', { phase: 1, progressPct: 0 });
}

function advanceBossPhase(cfg){
  Engine.bossPhase += 1;
  Engine.bossMs = cfg.bossPhaseMs;

  if (Engine.bossPhase === 2) {
    Engine.bossNeedWater = Math.round((12 + Engine.stormLevel) * 1.15);
    Engine.bossNeedLightning = Math.min(10, Engine.bossNeedLightning + 1);
    coachTip(`👑 BOSS PHASE 2/3: 💧 ${Engine.bossNeedWater} + ⚡ ${Engine.bossNeedLightning}`, 0);
  } else {
    Engine.bossNeedWater = Math.round((14 + Engine.stormLevel) * 1.30);
    Engine.bossNeedLightning = Math.min(12, Engine.bossNeedLightning + 2);
    coachTip(`🔥 FINAL PHASE 3/3: 💧 ${Engine.bossNeedWater} + ⚡ ${Engine.bossNeedLightning} (อย่าพลาด!)`, 0);
  }

  Engine.bossHitWater = 0;
  Engine.bossHitLightning = 0;

  logEv('boss_phase', { bossPhase: Engine.bossPhase, needWater: Engine.bossNeedWater, needL: Engine.bossNeedLightning });
}

/* =========================
   AI FEATURES (PACK 9)
========================= */

function buildFeatures(elapsedSec, leftSec){
  const shots = Engine.logs.filter(x => x.type === 'hit' || x.type === 'miss').length;
  const hits  = Engine.logs.filter(x => x.type === 'hit').length;
  const acc   = shots ? (hits / shots) : 0;

  const z = Engine.zone;
  const zCode = (z === 'GREEN') ? 0 : (z === 'LOW') ? -1 : 1;
  const scoreRate = elapsedSec > 1 ? (Engine.score / elapsedSec) : 0;

  return {
    t: Math.round(elapsedSec*10)/10,
    left: Math.round(leftSec*10)/10,
    zone: z, zCode,
    waterPct: Math.round(Engine.waterPct),
    score: Engine.score|0,
    scoreRate: Math.round(scoreRate*10)/10,
    combo: Engine.combo|0,
    comboMax: Engine.comboMax|0,
    miss: Engine.miss|0,
    acc: Math.round(acc*1000)/1000,
    phase: Engine.phase,
    stormLevel: Engine.stormLevel||1,
    stormCycles: Engine.stormCycles|0,
    stormOk: Engine.stormOk|0,
    shield: Engine.shield|0,
    shieldMax: Engine.shieldMax|0
  };
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
  const left = Math.max(0, Engine.timePlannedSec - elapsed);

  emit('hha:time', { t: elapsed, left, phase: Engine.phase, zone: Engine.zone, shield: Engine.shield });
  setStatsUI(left);

  // Difficulty director lite (play only)
  let spawnRate = cfg.spawnPerSec;
  if (Engine.runMode === 'play') {
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 60);
    spawnRate = cfg.spawnPerSec * (0.92 + perf * 0.35);
  }

  // AI tick (PACK 9)
  if (Engine.aiOn && Engine.aiHooks && (t - (Engine._aiLastMs||0)) > 900) {
    Engine._aiLastMs = t;
    const feat = buildFeatures(elapsed, left);
    const pred = aiSafeCall(Engine.aiHooks.predict, { feat, state: Engine }) || null;

    if (pred && typeof pred === 'object') {
      if (typeof pred.riskOffGreen === 'number') Engine.aiPred.riskOffGreen = clamp01(pred.riskOffGreen);
      if (pred.tip) Engine.aiPred.tip = String(pred.tip);
      if (pred.recommend) Engine.aiPred.recommend = pred.recommend;

      emit('hha:ai', { game:'hydration', pred: Engine.aiPred, feat });
      logEv('ai_pred', { risk: Engine.aiPred.riskOffGreen, tip: Engine.aiPred.tip || '' });

      if (Engine.aiPred.tip) coachTip(Engine.aiPred.tip, 3200);

      // apply recommend only in play AND aiMode=full
      if (Engine.runMode === 'play' && Engine.aiMode === 'full' && Engine.aiPred.recommend) {
        const r = Engine.aiPred.recommend;
        if (typeof r.spawnMul === 'number') spawnRate *= clamp(r.spawnMul, 0.85, 1.25);
      }
    }
  }

  // Natural recovery/drift (FIX stuck LOW/HIGH):
  // - play: drift stronger
  // - research: small drift but deterministic (depends only on dt, no randomness)
  const target = 55;
  const driftK = (Engine.runMode === 'play') ? cfg.drift : 0.12;
  Engine.waterPct += (target - Engine.waterPct) * driftK * dt;
  Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  setWaterUI(Engine.waterPct);

  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  const leftMs = left * 1000;

  // Enter END around last 18s
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // STORM entry rule (as requested): ONLY when in LOW/HIGH (off GREEN)
  if (Engine.phase === 'MAIN') {
    if (Engine.zone !== 'GREEN') {
      Engine._offGreenMs = (Engine._offGreenMs || 0) + dt * 1000;
      if (Engine._offGreenMs > 1800) {
        Engine._offGreenMs = 0;
        enterStorm(cfg);
      }
    } else {
      Engine._offGreenMs = 0;
    }
  }

  // STORM
  if (Engine.phase === 'STORM') {
    Engine.stormLeftMs -= dt * 1000;

    const okWater = Engine.stormHitWater >= Engine.stormNeedWater;
    const okL = Engine.stormHitLightning >= Engine.stormNeedLightning;

    if (okWater && okL) {
      exitStorm(true);
    } else if (Engine.stormLeftMs <= 0) {
      exitStorm(false);
    }
  }

  // END WINDOW
  if (Engine.phase === 'END') {
    Engine.endWindowMs -= dt * 1000;
    if (Engine.zone === 'GREEN') Engine._endGreenMs += dt * 1000;
    if (Engine.endWindowMs <= 0) {
      DOC.body.classList.remove('hha-endfx');
      enterBoss(cfg);
    }
  }

  // BOSS 3 phases + progress (PACK 10)
  if (Engine.phase === 'BOSS') {
    Engine.bossMs -= dt * 1000;

    const okWater = Engine.bossHitWater >= Engine.bossNeedWater;
    const okL = Engine.bossHitLightning >= Engine.bossNeedLightning;

    // progress = across 3 phases
    const total = Math.max(1, Engine.bossTimerTotalMs || (cfg.bossPhaseMs*3));
    const phaseIndex = Math.max(1, Engine.bossPhase || 1); // 1..3
    const elapsedBoss =
      (cfg.bossPhaseMs * (phaseIndex-1)) + (cfg.bossPhaseMs - Engine.bossMs);
    Engine.bossProgressPct = clamp((elapsedBoss / total) * 100, 0, 100);
    setProgress(Engine.bossProgressPct);
    emit('hha:boss', { phase: Engine.bossPhase, progressPct: Engine.bossProgressPct });

    if ((okWater && okL) || Engine.bossMs <= 0) {
      if ((Engine.bossPhase || 1) >= 3) {
        endGame();
        return;
      }
      advanceBossPhase(cfg);
    }
  }

  // Spawn accel
  Engine.spawnAcc += dt * spawnRate;

  if (Engine.phase === 'STORM') Engine.spawnAcc += dt * (0.55 + (Engine.stormLevel||1)*0.08);
  if (Engine.phase === 'BOSS') {
    const ph = Engine.bossPhase || 1;
    Engine.spawnAcc += dt * (0.55 + ph * 0.25);
  }

  const rng = Engine.rng;
  while (Engine.spawnAcc >= 1) {
    Engine.spawnAcc -= 1;
    spawnOne(rng, cfg);
  }

  // GC
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

    // canonical
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
    stormLevel: Engine.stormLevel | 0,

    shieldPickups: Engine.shieldPickups | 0,
    lightningBlocked: Engine.lightningBlocked | 0,

    bossPhase: Engine.bossPhase | 0,

    logs: Engine.logs.slice(0, 4000),

    // legacy aliases
    run: Engine.runMode,
    timeSec: Engine.timePlannedSec,
    score: Engine.score | 0,
    accuracyPctLegacy: acc
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
    ['stormLevel', s.stormLevel],
    ['shieldPickups', s.shieldPickups],
    ['lightningBlocked', s.lightningBlocked],
    ['bossPhase', s.bossPhase],
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
  safeText('rTier', summary.tier);

  safeText('rGoals', `${Math.round(summary.greenHoldSec)}s GREEN`);
  safeText('rMinis', `${summary.stormOk}/${summary.stormCycles} (L${summary.stormLevel})`);

  const tips = [];
  const stormRate = summary.stormCycles ? Math.round((summary.stormOk / summary.stormCycles) * 100) : 0;

  if (stormRate < 60) tips.push('• STORM: ก่อนเข้าพายุ พยายามเก็บ 🛡 ไว้ 2–3 อัน แล้วค่อยรับ ⚡');
  if (summary.miss > 6) tips.push('• อย่ายิงรัวตอนเป้าแน่น: หยุดครึ่งจังหวะ แล้วเล็งใหม่');
  if (summary.comboMax < 6) tips.push('• ทำคอมโบ: เลือกยิง 💧 ที่ใกล้ศูนย์กลางก่อน (มือถือจะติดง่าย)');
  if (!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่ม diff หรือเปิด ?ai=1 เพื่อความท้าทาย');

  const tipsEl = DOC.getElementById('rTips');
  if (tipsEl) tipsEl.textContent = tips.join('\n');

  const nextEl = DOC.getElementById('rNext');
  if (nextEl) nextEl.textContent = `Next: diff=${summary.diff} | runMode=${summary.runMode} | seed=${summary.seed} | ai=${String(qs('ai','0'))}`;

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

  Engine.shield = 0;
  Engine.shieldPickups = 0;
  Engine.lightningBlocked = 0;

  Engine.phase = 'MAIN';
  Engine.stormCycles = 0;
  Engine.stormOk = 0;
  Engine.stormLevel = 1;

  Engine._offGreenMs = 0;

  Engine.targets = new Set();
  Engine.spawnAcc = 0;

  Engine.logs = [];
  Engine.coachLastMs = 0;

  Engine.bossPhase = 0;
  Engine.bossProgressPct = 0;
  setProgress(0);

  Engine.ended = false;
  Engine.running = true;
  Engine.started = true;

  // hide summary when starting (extra safety)
  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

  setWaterUI(Engine.waterPct);
  setQuestUI();

  Engine.t0 = nowMs();
  Engine.lastT = Engine.t0;

  logEv('start', { runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed, ai: Engine.aiMode });

  emit('hha:start', {
    game: 'hydration',
    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,
    ai: Engine.aiMode,

    // legacy
    run: Engine.runMode,
    time: Engine.timePlannedSec
  });

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });

  for (const L of Engine.layers) {
    L.addEventListener('pointerdown', onLayerPointerDown, { passive: false });
  }

  Engine.rafId = requestAnimationFrame(step);

  coachTip('เริ่มเลย! คุมให้อยู่ GREEN แล้วสะสม 🛡 ไว้กัน ⚡ ตอน STORM', 0);
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
  // Fix: summary overlay should never show on boot
  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

  // Lock hidden behavior + force targets visible
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

  // Progress bar
  ensureProgressBar();
  setProgress(0);

  // Engine listens to hha:start
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
        runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed,
        score: Engine.score, combo: Engine.combo, miss: Engine.miss,
        waterPct: Engine.waterPct, zone: Engine.zone, phase: Engine.phase,
        stormLevel: Engine.stormLevel, shield: Engine.shield, bossPhase: Engine.bossPhase
      }))
    };
  } catch {}
})();

export {}; // ESM marker