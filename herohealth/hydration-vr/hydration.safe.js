// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard) — FULL (PACK 1–8)
//
// ✅ PC/Mobile/cVR/Cardboard (multi-layer)
// ✅ Targets always visible (class: hvr-target) + robust layer mounting
// ✅ Tap-to-shoot via hha:shoot {x,y,lockPx,source} (from vr-ui.js)
// ✅ Quest: Keep water in GREEN, Storm cycles (LOW/HIGH), Boss-ish end
// ✅ Emits: hha:start, hha:time, hha:score, hha:rank, hha:coach, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// ✅ CSV download + JSON copy from result overlay buttons (RUN page)
// ✅ Research deterministic (seeded), Play adaptive (difficulty director lite)
// ✅ PATCH: Force-hide result overlay on boot + lock [hidden] + hardened auto-start when overlay exists but not visible
// ✅ PATCH: Standardize summary schema (runMode/timePlannedSec/scoreFinal/miss/accuracyPct/comboMax) + keep backward aliases
//
// -------------------------
// PACK 1–3 (Storm + Shield + Lightning)
// 1) เข้า STORM เฉพาะเมื่ออยู่ LOW/HIGH ต่อเนื่อง (ไม่เข้าใน GREEN)
// 2) STORM มีฟ้าผ่า ⚡ (kind=LIGHT)
// 3) ต้องมี Shield 🛡 ก่อนถึงจะตีฟ้าผ่าได้ (consume 1 shield ต่อ 1 lightning hit)
//    - ไม่มี shield แล้วยิงโดน ⚡ => ลงโทษ + ไม่นับ progress
//    - ผ่าน STORM ด้วยการ “ตีฟ้าผ่าได้ครบตาม need”
//    - Level STORM ยิ่งผ่านมาก ยิ่งต้องตีฟ้าผ่าเพิ่ม + โอกาส ⚡ มากขึ้น + เวลา STORM ลดลงนิดหน่อย
//
// PACK 4 (Anti-stuck return-to-GREEN)
// - ถ้าออก GREEN แล้ว “ไม่กลับมาเลย” => เปิด Assist:
//   • ลด BAD rate ชั่วคราว + เพิ่ม GOOD rate
//   • เพิ่มแรง drift กลับ 55 เมื่อห่างมาก
//   • spawn bias เอื้อให้ “ดึงกลับ”
//   • (ยัง deterministic ใน research — แค่เปลี่ยน probabilities แบบคงที่จาก seed)
//
// PACK 5 (End Window + Boss-ish finish)
// - END WINDOW ช่วงท้าย: ต้องอยู่ GREEN ให้ครบเวลาที่กำหนด (สะสม)
// - จากนั้นเข้า BOSS: เก็บ GOOD ต่อเนื่อง + ถ้าพลาดจะยากขึ้น
//
// PACK 6 (Shield pickup system)
// - Shield เป็นไอเท็ม (kind=SHIELD 🛡) เก็บเพื่อใช้ตี ⚡ ใน STORM
// - Cap shield: 0..3, HUD อัปเดตที่ #shield-count
//
// PACK 7 (AI hooks: Prediction/ML/DL placeholder-ready)
// - รองรับ window.HHA.createAIHooks({game}) หรือ window.HHA_AI_HOOKS
// - ส่ง feature events ให้ AI: zone, perf, accuracy, streak, stormLevel ฯลฯ
// - มี coach micro-tips แบบ rate-limit
//
// PACK 8 (Logging + flush-hardened)
// - logEv event schema มาตรฐาน
// - flush ก่อนออก/ซ่อนหน้า (best-effort) + keep last summary

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
  if (score >= 2400) return 'S';
  if (score >= 1800) return 'A';
  if (score >= 1250) return 'B';
  if (score >= 750)  return 'C';
  return 'D';
}

function safeText(id, txt) {
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(txt);
}

function safeCopy(text) {
  try { navigator.clipboard?.writeText(String(text)); } catch {}
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}

/* =========================
   AI HOOKS (PACK 7)
========================= */

function getAI(){
  // Prefer factory creator if exists (allows per-game instances)
  try {
    if (WIN.HHA?.createAIHooks) {
      const ai = WIN.HHA.createAIHooks({ game: 'hydration' });
      if (ai && typeof ai === 'object') return ai;
    }
  } catch {}

  // Or global hooks object
  try {
    if (WIN.HHA_AI_HOOKS && typeof WIN.HHA_AI_HOOKS === 'object') return WIN.HHA_AI_HOOKS;
  } catch {}

  // Stub fallback
  return {
    getDifficulty: (_features)=> null,     // return {spawnMul, badMul, driftMul, lockPx} or null
    getTip: (_features)=> null,            // return string tip or null
    onEvent: (_ev)=> {},                   // ev contains {type, features, t}
  };
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

function emojiForKind(kind){
  if (kind === 'GOOD') return '💧';
  if (kind === 'BAD') return '🥤';
  if (kind === 'STORM') return '🌀';
  if (kind === 'SHIELD') return '🛡';
  if (kind === 'LIGHT') return '⚡';
  return '💧';
}

function makeTargetEl(kind, x, y, sizePx, ttlMs) {
  const el = DOC.createElement('div');
  el.className = 'hvr-target';
  el.dataset.kind = kind;
  el.textContent = emojiForKind(kind);

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
  if (kind === 'SHIELD') el.style.outline = '2px solid rgba(168,85,247,.22)';
  if (kind === 'LIGHT')  el.style.outline = '2px dashed rgba(245,158,11,.40)';

  el.dataset.birth = String(nowMs());
  el.dataset.ttl = String(ttlMs || 1200);

  return el;
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

  // legacy aliases kept
  run: 'play',
  timeSec: 70,

  // canonical
  runMode: 'play',        // play | research
  diff: 'normal',         // easy | normal | hard
  timePlannedSec: 70,
  seed: 0,

  layers: [],
  rng: null,
  ai: null,

  // score/state
  score: 0,
  scoreFinal: 0,
  combo: 0,
  comboMax: 0,
  miss: 0,

  waterPct: 50,
  greenHoldMs: 0,
  zone: 'GREEN',

  // shield (PACK 6)
  shield: 0,              // 0..3

  // phases
  phase: 'MAIN',          // MAIN | STORM | END | BOSS
  stormCycles: 0,
  stormOk: 0,
  stormLeftMs: 0,
  stormNeed: 0,           // lightning hits needed
  stormHit: 0,            // lightning hits done
  stormLevel: 1,

  endWindowMs: 0,
  endNeedGreenMs: 0,
  _endGreenMs: 0,

  bossMs: 0,
  bossNeedGood: 0,
  bossGoodHit: 0,

  targets: new Set(),
  spawnAcc: 0,

  // anti-stuck assist
  _offGreenMs: 0,
  _assist: 0,            // 0..1

  // logs & coach
  logs: [],
  coachLastMs: 0,

  // session id for logging (PACK 8)
  sessionId: '',
};

function cfgByDiff(diff) {
  const base = {
    easy:   { spawnPerSec: 0.95, size: 74, ttl: 1450, goodDelta: 9,  badDelta: -9,  drift: 0.22, lock: 28,
              stormDur: 9500, stormNeed: 5,  endMs: 9500,  endNeed: 5200, bossMs: 9500,  bossNeedGood: 7 },
    normal: { spawnPerSec: 1.15, size: 68, ttl: 1300, goodDelta: 8,  badDelta: -10, drift: 0.28, lock: 28,
              stormDur: 9000, stormNeed: 7,  endMs: 10000, endNeed: 6200, bossMs: 10000, bossNeedGood: 9 },
    hard:   { spawnPerSec: 1.35, size: 62, ttl: 1150, goodDelta: 7,  badDelta: -12, drift: 0.33, lock: 28,
              stormDur: 8500, stormNeed: 9,  endMs: 11000, endNeed: 7200, bossMs: 11000, bossNeedGood: 11 },
  };
  return base[diff] || base.normal;
}

function readCtx() {
  Engine.runMode = String(qs('run', 'play')).toLowerCase() === 'research' ? 'research' : 'play';
  Engine.run = Engine.runMode; // legacy alias

  const diff = String(qs('diff', 'normal')).toLowerCase();
  Engine.diff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';

  Engine.timePlannedSec = clamp(qn('time', 70), 20, 600) | 0;
  Engine.timeSec = Engine.timePlannedSec; // legacy alias

  const seedQ = qn('seed', 0);
  Engine.seed = seedQ ? seedQ : Date.now();

  Engine.sessionId = `hydr-${Engine.seed}-${(Math.random()*1e6|0).toString(36)}`;
}

function logEv(type, data = {}) {
  Engine.logs.push({
    t: Date.now(),
    type,
    phase: Engine.phase,
    zone: Engine.zone,
    water: Math.round(Engine.waterPct),
    score: Engine.score|0,
    combo: Engine.combo|0,
    shield: Engine.shield|0,
    ...data
  });

  // feed AI
  try {
    Engine.ai?.onEvent?.({ type, t: Date.now(), features: getFeatures(), data });
  } catch {}
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
    (phase === 'MAIN')
      ? `คุมให้อยู่โซน GREEN ให้นานที่สุด`
      : (phase === 'STORM')
        ? `⚡ STORM (Level ${Engine.stormLevel}) — ต้องมี 🛡 เพื่อ “ตีฟ้าผ่า”`
        : (phase === 'END')
          ? `⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา`
          : `👑 BOSS! เก็บ GOOD ต่อเนื่อง`;

  let l2 = '';
  if (phase === 'STORM') {
    l2 = `ฟ้าผ่า: ${Engine.stormHit}/${Engine.stormNeed}  |  🛡=${Engine.shield}  |  เหลือ ${(Engine.stormLeftMs/1000).toFixed(1)}s`;
  } else if (phase === 'END') {
    l2 = `GREEN: ${(Engine._endGreenMs/1000).toFixed(1)}s / ${(Engine.endNeedGreenMs/1000).toFixed(1)}s`;
  } else if (phase === 'BOSS') {
    l2 = `GOOD: ${Engine.bossGoodHit}/${Engine.bossNeedGood}  |  เหลือ ${(Engine.bossMs/1000).toFixed(1)}s`;
  } else {
    l2 = `ตอนนี้: โซน ${z}  |  🛡=${Engine.shield}`;
  }

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm cycles: ${Engine.stormCycles} | Storm OK: ${Engine.stormOk}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax}`);

  safeText('storm-left', (Engine.phase === 'STORM') ? Math.ceil(Engine.stormLeftMs/1000) : 0);
}

function coachTip(msg, cooldownMs = 2600) {
  const t = nowMs();
  if (t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;
  emit('hha:coach', { msg, game: 'hydration' });
  logEv('coach', { msg });
}

/* =========================
   FEATURES for AI (PACK 7)
========================= */

function getFeatures(){
  const elapsed = Math.max(0, (nowMs() - Engine.t0) / 1000);
  const shots = Engine.logs.reduce((a,ev)=> a + ((ev.type==='hit'||ev.type==='miss') ? 1 : 0), 0);
  const hits  = Engine.logs.reduce((a,ev)=> a + ((ev.type==='hit') ? 1 : 0), 0);
  const acc   = shots ? (hits / shots) : 0;

  return {
    game: 'hydration',
    runMode: Engine.runMode,
    diff: Engine.diff,
    phase: Engine.phase,
    zone: Engine.zone,
    waterPct: Engine.waterPct,
    score: Engine.score,
    combo: Engine.combo,
    comboMax: Engine.comboMax,
    miss: Engine.miss,
    shield: Engine.shield,
    stormLevel: Engine.stormLevel,
    stormHit: Engine.stormHit,
    stormNeed: Engine.stormNeed,
    stormOk: Engine.stormOk,
    stormCycles: Engine.stormCycles,
    elapsedSec: elapsed,
    scorePerSec: elapsed > 0.1 ? (Engine.score / elapsed) : 0,
    accuracy: acc,
    assist: Engine._assist,
  };
}

/* =========================
   SPAWNING & HIT
========================= */

function removeTarget(el) {
  try { Engine.targets.delete(el); } catch {}
  try { el.remove(); } catch {}
}

function doShock(x, y, kind = 'HIT') {
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

function addShield(n=1){
  const before = Engine.shield|0;
  Engine.shield = clamp((Engine.shield|0) + (n|0), 0, 3);
  if (Engine.shield !== before) {
    coachTip(`ได้ 🛡 Shield (${Engine.shield}/3)`, 1200);
    logEv('shield_gain', { before, after: Engine.shield });
  }
}

function consumeShield(){
  const before = Engine.shield|0;
  Engine.shield = clamp((Engine.shield|0) - 1, 0, 3);
  if (before !== Engine.shield) logEv('shield_use', { before, after: Engine.shield });
}

function stormLevelParams(baseNeed, baseDur){
  // PACK 1–3: level scales by stormOk
  const lv = clamp((Engine.stormOk|0) + 1, 1, 12);
  Engine.stormLevel = lv;

  const need = baseNeed + (lv-1) * 2;             // more lightning needed
  const dur  = Math.max(5200, baseDur - (lv-1)*350); // slightly less time
  return { lv, need, dur };
}

function spawnOne(rng, cfg) {
  const layers = Engine.layers;
  if (!layers.length) return;

  // dynamic adjustments (PACK 4 + 7 AI difficulty)
  let spawnMul = 1.0, badMul = 1.0, driftMul = 1.0;
  let lockPx = cfg.lock;

  // anti-stuck assist factor (0..1)
  const assist = Engine._assist || 0;

  // AI difficulty director (optional)
  try {
    const d = Engine.ai?.getDifficulty?.(getFeatures());
    if (d && typeof d === 'object') {
      if (Number.isFinite(d.spawnMul)) spawnMul *= clamp(d.spawnMul, 0.6, 1.8);
      if (Number.isFinite(d.badMul))   badMul   *= clamp(d.badMul,   0.6, 1.6);
      if (Number.isFinite(d.driftMul)) driftMul *= clamp(d.driftMul, 0.7, 2.0);
      if (Number.isFinite(d.lockPx))   lockPx    = clamp(d.lockPx, 18, 60);
    }
  } catch {}

  // store lockPx for shoot handler
  Engine._lockPx = lockPx;

  for (const layer of layers) {
    const rect = layer.getBoundingClientRect();

    const pad = Math.max(24, (cfg.size * 0.55) | 0);
    // spawn bias: keep playable area (avoid very top HUD)
    const x = clamp((rect.width * (0.10 + rng() * 0.80)), pad, rect.width - pad);
    const y = clamp((rect.height * (0.18 + rng() * 0.68)), pad, rect.height - pad);

    const isStorm = (Engine.phase === 'STORM');
    const isBoss  = (Engine.phase === 'BOSS');

    // base probabilities
    let pBad = (Engine.zone === 'GREEN') ? 0.26 : 0.38;
    let pShield = 0.045;     // PACK 6 (pickup)
    let pLight  = 0.00;      // only in STORM
    let pStormCore = 0.00;

    // assist: make it easier to return to GREEN
    if (!isStorm && !isBoss && assist > 0.01) {
      pBad = pBad * (1.0 - 0.55*assist);
      pShield = pShield + 0.020*assist;
    }

    // storm: lightning mission
    if (isStorm) {
      // scale by level
      pBad = 0.20;
      pShield = 0.085;
      pLight = clamp(0.18 + 0.02*(Engine.stormLevel-1), 0.18, 0.36);
      pStormCore = 0.05; // optional storm core (bonus)
    }

    // boss: more chaos
    if (isBoss) {
      pBad = 0.42;
      pShield = 0.035;
      pLight = 0.0;
      pStormCore = 0.0;
    }

    // apply badMul from AI director
    pBad = clamp(pBad * badMul, 0.08, 0.72);

    let kind = 'GOOD';
    const r = rng();

    // choose kind
    // order: LIGHT (storm) -> SHIELD -> BAD -> STORM(core) -> GOOD
    if (isStorm && r < pLight) kind = 'LIGHT';
    else if (r < (isStorm ? (pLight + pShield) : pShield)) kind = 'SHIELD';
    else if (r < (isStorm ? (pLight + pShield + pBad) : (pShield + pBad))) kind = 'BAD';
    else if (isStorm && r < (pLight + pShield + pBad + pStormCore)) kind = 'STORM';
    else kind = 'GOOD';

    const ttl = cfg.ttl + ((rng() * 320) | 0);
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

      // penalty for missing lightning during storm? (soft)
      if (Engine.phase === 'STORM' && el.dataset.kind === 'LIGHT') {
        // ถ้าฟ้าผ่าหายไปเอง = เสียจังหวะเล็กน้อย
        Engine.miss += 1;
        Engine.combo = 0;
        coachTip('⚡ ฟ้าผ่าหายไป! รีบหา 🛡 แล้วตีให้ทัน', 2000);
        logEv('miss_light_timeout', {});
      }

      removeTarget(el);
    }, ttl);
  }
}

function hitTarget(el, info) {
  if (!Engine.running || Engine.ended) return;
  if (!el || !el.isConnected) return;

  const kind = el.dataset.kind || 'GOOD';
  const cfg = cfgByDiff(Engine.diff);

  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;

  // === KIND LOGIC ===
  if (kind === 'GOOD') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

    // water + score
    adjustWater(+cfg.goodDelta);
    const bonus = 55 + Math.min(260, Engine.combo * 10);
    addScore(85 + bonus);

    // boss objective counts GOOD
    if (Engine.phase === 'BOSS') Engine.bossGoodHit += 1;

    // occasional shield from streak (soft)
    if (Engine.combo % 9 === 0 && Engine.shield < 3) addShield(1);

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);
    logEv('hit', { kind, source: info?.source || 'unknown' });

  } else if (kind === 'BAD') {
    Engine.miss += 1;
    Engine.combo = 0;

    // PACK 4: reduce harshness when stuck far from GREEN
    const stuck = clamp01((Engine._offGreenMs || 0) / 2500);
    const soften = (Engine.runMode === 'play') ? (0.25 * stuck) : 0;
    const badDelta = cfg.badDelta * (1.0 - soften);

    adjustWater(badDelta);
    addScore(-35);

    coachTip('โดน BAD! รีบกลับเข้า GREEN', 2300);
    logEv('hit', { kind, source: info?.source || 'unknown' });

  } else if (kind === 'SHIELD') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

    addShield(1);
    addScore(120);
    adjustWater(+Math.max(3, cfg.goodDelta - 4));

    coachTip('🛡 เก็บ Shield ไว้ตีฟ้าผ่าใน STORM!', 1800);
    logEv('hit', { kind, source: info?.source || 'unknown' });

  } else if (kind === 'LIGHT') {
    // PACK 1–3: must have shield to “ตีฟ้าผ่า”
    if ((Engine.shield|0) > 0) {
      consumeShield();
      Engine.combo += 1;
      Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);

      Engine.stormHit += 1;          // ✅ progress
      addScore(160);
      adjustWater(+Math.max(2, cfg.goodDelta - 5));

      coachTip('⚡ ตีฟ้าผ่าได้! ไปต่ออีก!', 1400);
      logEv('hit', { kind, lightOk: true, source: info?.source || 'unknown' });

    } else {
      // no shield -> penalty
      Engine.miss += 1;
      Engine.combo = 0;

      addScore(-55);
      adjustWater(Math.min(-6, cfg.badDelta * 0.7));

      coachTip('ต้องมี 🛡 ก่อนถึงจะตี ⚡ ได้! หา 🛡 ก่อนนะ', 1800);
      logEv('hit', { kind, lightOk: false, source: info?.source || 'unknown' });
    }

  } else {
    // STORM core (bonus target)
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+Math.max(4, (cfg.goodDelta - 2)));
    addScore(140);
    coachTip('🌀 Core! ได้แต้มพิเศษ', 2000);
    logEv('hit', { kind, source: info?.source || 'unknown' });
  }

  doShock(cx, cy);
  removeTarget(el);

  // Coach AI tip (optional)
  try {
    const tip = Engine.ai?.getTip?.(getFeatures());
    if (tip && typeof tip === 'string' && tip.trim()) coachTip(tip.trim(), 3200);
  } catch {}
}

function handleShootEvent(detail) {
  if (!Engine.running || Engine.ended) return;
  if (!detail) return;

  const x = Number(detail.x);
  const y = Number(detail.y);
  if (!isFinite(x) || !isFinite(y)) return;

  const lockPx = clamp(Number(detail.lockPx) || Engine._lockPx || 28, 10, 90);
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
    // miss penalty only in STORM/BOSS (keeps casual friendly)
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      coachTip('พลาด! หยุดครึ่งจังหวะแล้วเล็งใหม่', 2200);
      logEv('miss', { source: detail.source || 'hha:shoot' });
    }
    doShock(x, y, 'MISS');
  }
}

/* =========================
   PHASE LOGIC (PACK 1–5)
========================= */

function enterStorm(cfg) {
  Engine.phase = 'STORM';
  Engine.stormCycles += 1;

  const sp = stormLevelParams(cfg.stormNeed, cfg.stormDur);
  Engine.stormNeed = sp.need;
  Engine.stormLeftMs = sp.dur;
  Engine.stormHit = 0;

  DOC.body.classList.add('hha-bossfx');
  coachTip('⚡ STORM! หา 🛡 แล้วตีฟ้าผ่าให้ครบ!', 0);
  logEv('phase', { phase: 'STORM', stormNeed: Engine.stormNeed, stormLevel: Engine.stormLevel });
}

function exitStorm(success) {
  Engine.phase = 'MAIN';
  DOC.body.classList.remove('hha-bossfx');

  if (success) Engine.stormOk += 1;

  coachTip(success ? 'ผ่าน STORM! กลับไปคุม GREEN ต่อ' : 'STORM ไม่ผ่าน! ระวังโซน LOW/HIGH', 0);
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
  Engine.bossNeedGood = cfg.bossNeedGood;
  Engine.bossGoodHit = 0;

  DOC.body.classList.add('hha-bossfx');
  coachTip('👑 BOSS! เก็บ 💧GOOD ต่อเนื่อง ห้ามพลาด', 0);
  logEv('phase', { phase: 'BOSS', bossNeedGood: Engine.bossNeedGood });
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

  emit('hha:time', { t: elapsed, left, phase: Engine.phase });
  setStatsUI(left);

  // difficulty director lite (play only) + AI spawn multiplier
  let spawnRate = cfg.spawnPerSec;

  // base perf heuristic
  if (Engine.runMode === 'play') {
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 55);
    spawnRate = cfg.spawnPerSec * (0.9 + perf * 0.35);
  }

  // anti-stuck (PACK 4)
  // offGreenMs accumulates only in MAIN
  if (Engine.phase === 'MAIN') {
    Engine._offGreenMs = (Engine.zone === 'GREEN') ? 0 : ((Engine._offGreenMs || 0) + dt * 1000);
  } else {
    Engine._offGreenMs = 0;
  }

  // assist ramps when off-green too long (fix "ออก green แล้วไม่กลับมา")
  if (Engine.runMode === 'play' && Engine.phase === 'MAIN') {
    const og = (Engine._offGreenMs || 0);
    Engine._assist = clamp01((og - 900) / 1800); // starts after ~0.9s, full at ~2.7s
  } else {
    Engine._assist = 0;
  }

  // drift toward 55 (PACK 4 stronger when stuck)
  if (Engine.runMode === 'play') {
    const target = 55;
    const far = Math.abs(target - Engine.waterPct) / 45; // 0..~1
    const extra = (Engine._assist || 0) * (0.55 + 0.65*clamp01(far));
    const drift = cfg.drift * (1 + extra); // stronger when stuck
    Engine.waterPct += (target - Engine.waterPct) * drift * dt;
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  }

  setWaterUI(Engine.waterPct);

  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  const leftMs = left * 1000;

  // PACK 5: enter END around last 18s
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // PACK 1: STORM triggers only when LOW/HIGH for long enough (MAIN only)
  if (Engine.phase === 'MAIN') {
    // must be LOW/HIGH continuously
    if (Engine.zone === 'LOW' || Engine.zone === 'HIGH') {
      const needMs = 1600; // threshold
      if ((Engine._offGreenMs || 0) > needMs) {
        Engine._offGreenMs = 0;
        enterStorm(cfg);
      }
    }
  }

  // STORM update
  if (Engine.phase === 'STORM') {
    Engine.stormLeftMs -= dt * 1000;

    // success condition: lightning hits completed
    if (Engine.stormHit >= Engine.stormNeed) {
      exitStorm(true);
    } else if (Engine.stormLeftMs <= 0) {
      Engine.miss += 2;
      Engine.combo = 0;
      exitStorm(false);
    }
  }

  // END window update
  if (Engine.phase === 'END') {
    Engine.endWindowMs -= dt * 1000;
    if (Engine.zone === 'GREEN') Engine._endGreenMs += dt * 1000;

    if (Engine.endWindowMs <= 0) {
      DOC.body.classList.remove('hha-endfx');
      enterBoss(cfg);
    }
  }

  // BOSS update
  if (Engine.phase === 'BOSS') {
    Engine.bossMs -= dt * 1000;
    // win early if achieved objective
    if (Engine.bossGoodHit >= Engine.bossNeedGood) Engine.bossMs = 0;
    if (Engine.bossMs <= 0) {
      endGame();
      return;
    }
  }

  // spawn accel (+ extra during storm/boss)
  Engine.spawnAcc += dt * spawnRate;
  if (Engine.phase === 'STORM') Engine.spawnAcc += dt * 0.55;
  if (Engine.phase === 'BOSS')  Engine.spawnAcc += dt * 0.70;

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

  // hint when stuck
  if (Engine.phase === 'MAIN' && Engine._assist > 0.75) {
    coachTip('ทริค: เล็งยิง 💧GOOD ใกล้กลางจอ 1–2 ครั้ง จะดึงกลับ GREEN ได้เร็ว', 4200);
  }

  if (left <= 0.001 && !Engine.ended) {
    endGame();
    return;
  }

  Engine.rafId = requestAnimationFrame(step);
}

/* =========================
   RESULT + STORAGE (PACK 8)
========================= */

function buildSummary() {
  const shots = Engine.logs.filter(x => x.type === 'hit' || x.type === 'miss').length;
  const hits = Engine.logs.filter(x => x.type === 'hit').length;
  const accPct = shots ? Math.round((hits / shots) * 100) : 0;

  const grade = gradeFromScore(Engine.score);
  const tier =
    (grade === 'S' || grade === 'A') ? '🔥 Elite' :
    (grade === 'B') ? '⚡ Skilled' :
    (grade === 'C') ? '✅ Ok' : '🧊 Warm-up';

  // canonical schema + legacy aliases
  return {
    game: 'hydration',
    ts: Date.now(),
    sessionId: Engine.sessionId,

    runMode: Engine.runMode,
    diff: Engine.diff,
    timePlannedSec: Engine.timePlannedSec,
    seed: Engine.seed,

    scoreFinal: Engine.score | 0,
    grade,
    tier,
    comboMax: Engine.comboMax | 0,
    miss: Engine.miss | 0,
    accuracyPct: accPct,

    greenHoldSec: Math.round((Engine.greenHoldMs / 1000) * 10) / 10,
    stormCycles: Engine.stormCycles | 0,
    stormOk: Engine.stormOk | 0,
    stormMaxLevel: Engine.stormLevel | 0,
    shieldEnd: Engine.shield | 0,

    bossNeedGood: Engine.bossNeedGood | 0,
    bossGoodHit: Engine.bossGoodHit | 0,

    logs: Engine.logs.slice(0, 4000),

    // legacy
    run: Engine.runMode,
    timeSec: Engine.timePlannedSec,
    score: Engine.score | 0,
    accuracyPctLegacy: accPct
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
      runMode: summary.runMode,
      stormOk: summary.stormOk,
      greenHoldSec: summary.greenHoldSec
    });
    localStorage.setItem(LS_HIST, JSON.stringify(hist.slice(0, 50)));
  } catch {}
}

function flushSafety(summaryMaybe){
  // best-effort flush for cases leaving early
  try {
    const s = summaryMaybe || buildSummary();
    localStorage.setItem(LS_LAST, JSON.stringify(s));
  } catch {}
}

/* =========================
   START/STOP
========================= */

function startGame() {
  if (Engine.running) return;

  readCtx();
  Engine.layers = resolveLayers();
  Engine.rng = makeRNG(Engine.seed);
  Engine.ai = getAI();

  Engine.score = 0;
  Engine.combo = 0;
  Engine.comboMax = 0;
  Engine.miss = 0;

  Engine.waterPct = 50;
  Engine.greenHoldMs = 0;
  Engine.zone = zoneFromPct(Engine.waterPct);

  Engine.shield = 0;

  Engine.phase = 'MAIN';
  Engine.stormCycles = 0;
  Engine.stormOk = 0;
  Engine.stormHit = 0;
  Engine.stormNeed = 0;
  Engine.stormLevel = 1;

  Engine.endWindowMs = 0;
  Engine._endGreenMs = 0;

  Engine.bossMs = 0;
  Engine.bossNeedGood = 0;
  Engine.bossGoodHit = 0;

  Engine.targets = new Set();
  Engine.spawnAcc = 0;

  Engine.logs = [];
  Engine.coachLastMs = 0;

  Engine._offGreenMs = 0;
  Engine._assist = 0;

  Engine.ended = false;
  Engine.running = true;
  Engine.started = true;

  // hide summary (extra safety)
  try {
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  } catch {}

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

    // legacy
    run: Engine.runMode,
    time: Engine.timePlannedSec
  });

  // input
  WIN.addEventListener('hha:shoot', onShoot, { passive: true });
  for (const L of Engine.layers) {
    L.addEventListener('pointerdown', onLayerPointerDown, { passive: false });
  }

  // flush safety hooks (PACK 8)
  try {
    WIN.addEventListener('pagehide', ()=> flushSafety(null), { passive: true });
    DOC.addEventListener('visibilitychange', ()=> {
      if (DOC.visibilityState === 'hidden') flushSafety(null);
    }, { passive: true });
    WIN.addEventListener('beforeunload', ()=> flushSafety(null));
  } catch {}

  Engine.rafId = requestAnimationFrame(step);
  coachTip('เริ่มเลย! คุมให้อยู่ GREEN แล้วระวัง STORM ตอนอยู่ LOW/HIGH', 0);
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

  // UI overlay handled by RUN page (showResult exists there),
  // but we keep compatibility: if RUN page has showResult(summary) global, call it.
  try {
    if (typeof WIN.showResult === 'function') WIN.showResult(summary);
  } catch {}

  // ensure last summary always saved
  flushSafety(summary);
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
  handleShootEvent({ x: e.clientX, y: e.clientY, lockPx: Engine._lockPx || 28, source: 'layer' });
}

/* =========================
   AUTO-BOOT (HARDENED)
========================= */

(function boot(){
  // ✅ never show summary on boot
  try {
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  } catch {}

  // ✅ Force targets visible + [hidden] robust
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
        runMode: Engine.runMode,
        diff: Engine.diff,
        timePlannedSec: Engine.timePlannedSec,
        seed: Engine.seed,
        score: Engine.score,
        combo: Engine.combo,
        miss: Engine.miss,
        waterPct: Engine.waterPct,
        zone: Engine.zone,
        phase: Engine.phase,
        shield: Engine.shield,
        stormLevel: Engine.stormLevel,
        stormHit: Engine.stormHit,
        stormNeed: Engine.stormNeed,
      }))
    };
  } catch {}
})();

export {}; // ESM marker