// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard) — FULL PACK 1–10
// ✅ PC/Mobile/cVR/Cardboard (multi-layer)
// ✅ Targets visible (class: hvr-target) + robust layer mounting
// ✅ Tap-to-shoot via hha:shoot {x,y,lockPx,source} (from vr-ui.js)
// ✅ Quest: Keep water in GREEN, STORM cycles (LOW/HIGH trigger), End Window, Boss 3 phases
// ✅ STORM rules (ตามที่ย้ำ):
//    - Enter STORM ONLY when leave GREEN -> LOW/HIGH continuously
//    - Must have 🛡 shield to hit ⚡ lightning (consume 1 shield)
//    - Count pass STORM + stormLevel increases -> more ⚡ needed
// ✅ Lightning telegraph: pre-warn 0.6s then strike
// ✅ Emits: hha:start, hha:time, hha:score, hha:rank, hha:coach, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// ✅ CSV download + JSON copy from result overlay buttons
// ✅ Research deterministic (seeded), Play adaptive (difficulty director lite)
// ✅ PATCH: Force-hide result overlay on boot + lock [hidden] + hardened auto-start
// ✅ PATCH: Standardize summary schema (runMode/timePlannedSec/scoreFinal/miss/accuracyPct/comboMax)
// ✅ PACK 9–10 UI hooks: stormLvUI/stormProg/stormNeedUI/stormBar/shieldUI/stormWarn + bossPhaseUI/bossProg/bossNeedUI/bossBar

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
  if (score >= 800) return 'C';
  return 'D';
}

function safeText(id, txt) {
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(txt);
}

function safeWidth(id, pct) {
  const el = DOC.getElementById(id);
  if (el) el.style.width = `${clamp(pct, 0, 100).toFixed(0)}%`;
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
   TARGETS / FX
========================= */

function makeTargetEl(kind, x, y, sizePx, ttlMs) {
  const el = DOC.createElement('div');
  el.className = 'hvr-target';
  el.dataset.kind = kind;

  const emoji =
    (kind === 'GOOD') ? '💧' :
    (kind === 'BAD') ? '🥤' :
    (kind === 'SHIELD') ? '🛡' :
    (kind === 'LIGHTNING') ? '⚡' :
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

  if (kind === 'GOOD') el.style.outline = '2px solid rgba(34,197,94,.22)';
  if (kind === 'BAD') el.style.outline = '2px solid rgba(239,68,68,.22)';
  if (kind === 'SHIELD') el.style.outline = '2px solid rgba(168,85,247,.22)';
  if (kind === 'LIGHTNING') el.style.outline = '2px dashed rgba(245,158,11,.28)';

  el.dataset.birth = String(nowMs());
  el.dataset.ttl = String(ttlMs || 1200);

  return el;
}

function dist2(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
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

function doTelegraph(x, y) {
  // simple warning ring (0.6s)
  try {
    const layer = Engine.layers[0] || DOC.body;
    const tg = DOC.createElement('div');
    tg.className = 'hvr-telegraph';
    tg.style.position = 'absolute';
    tg.style.left = `${x}px`;
    tg.style.top = `${y}px`;
    tg.style.width = `18px`;
    tg.style.height = `18px`;
    tg.style.transform = 'translate(-50%,-50%)';
    tg.style.borderRadius = '999px';
    tg.style.border = '2px solid rgba(245,158,11,.9)';
    tg.style.boxShadow = '0 0 0 0 rgba(245,158,11,.35)';
    tg.style.pointerEvents = 'none';
    tg.style.zIndex = '60';
    tg.style.animation = 'hvrTg .6s ease-out forwards';

    if (!DOC.getElementById('hvr-telegraph-style')) {
      const st = DOC.createElement('style');
      st.id = 'hvr-telegraph-style';
      st.textContent = `
        @keyframes hvrTg{
          0%{ opacity:1; transform:translate(-50%,-50%) scale(1); box-shadow:0 0 0 0 rgba(245,158,11,.35); }
          100%{ opacity:0; transform:translate(-50%,-50%) scale(7.2); box-shadow:0 0 0 14px rgba(245,158,11,0); }
        }
      `;
      DOC.head.appendChild(st);
    }

    layer.appendChild(tg);
    setTimeout(() => tg.remove(), 650);
  } catch {}
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

  run: 'play',       // legacy alias
  runMode: 'play',   // canonical
  diff: 'normal',
  timeSec: 70,       // legacy alias
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

  phase: 'MAIN', // MAIN | STORM | END | BOSS
  stormCycles: 0,
  stormOk: 0,
  stormLeftMs: 0,

  // storm objective (⚡)
  stormLevel: 0,      // starts at 0, increments when entering STORM
  stormNeed: 0,
  stormHit: 0,        // lightning hit count (shield-only)
  stormTeleMs: 0,     // telegraph scheduler

  // shield
  shield: 0,
  shieldMax: 3,
  shieldDrops: 0,
  shieldUsed: 0,

  // END
  endWindowMs: 0,
  endNeedGreenMs: 0,
  _endGreenMs: 0,

  // BOSS
  bossTotalMs: 0,
  bossMs: 0,
  bossNeed: 0,
  bossHit: 0,
  bossPhase: 1,

  targets: new Set(),
  spawnAcc: 0,

  logs: [],
  coachLastMs: 0,

  // internal
  _offGreenMs: 0,
  _gcAcc: 0,
};

function cfgByDiff(diff) {
  const base = {
    easy: {
      spawnPerSec: 0.95, size: 74, ttl: 1400,
      goodDelta: 9, badDelta: -9,
      drift: 0.22,
      lock: 28,

      // STORM base
      stormDur: 9000,
      stormNeedBase: 2,
      stormNeedInc: 1,      // per level
      stormStrikeEvery: 1150, // ms baseline

      // END/BOSS
      endMs: 9000, endNeed: 5200,
      bossMs: 11000, bossNeed: 7,
    },
    normal: {
      spawnPerSec: 1.15, size: 68, ttl: 1250,
      goodDelta: 8, badDelta: -10,
      drift: 0.28,
      lock: 28,

      stormDur: 9500,
      stormNeedBase: 3,
      stormNeedInc: 1,
      stormStrikeEvery: 1050,

      endMs: 10000, endNeed: 6200,
      bossMs: 12000, bossNeed: 9,
    },
    hard: {
      spawnPerSec: 1.35, size: 62, ttl: 1100,
      goodDelta: 7, badDelta: -12,
      drift: 0.33,
      lock: 28,

      stormDur: 10000,
      stormNeedBase: 4,
      stormNeedInc: 2,
      stormStrikeEvery: 950,

      endMs: 11000, endNeed: 7200,
      bossMs: 13000, bossNeed: 11,
    },
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
}

function logEv(type, data) {
  Engine.logs.push({ t: Date.now(), type, ...data });
}

/* =========================
   UI UPDATES
========================= */

function setWaterUI(pct) {
  pct = clamp(pct, 0, 100);
  const z = zoneFromPct(pct);

  safeText('water-pct', pct | 0);
  safeText('water-zone', z);
  safeWidth('water-bar', pct);

  Engine.zone = z;
}

function setStatsUI(timeLeftSec) {
  safeText('stat-score', Engine.score | 0);
  safeText('stat-combo', Engine.combo | 0);
  safeText('stat-time', timeLeftSec | 0);
  safeText('stat-miss', Engine.miss | 0);
  safeText('stat-grade', gradeFromScore(Engine.score));
}

function setStormBossHUD() {
  // STORM UI
  safeText('stormLvUI', Engine.stormLevel | 0);
  safeText('stormProg', Engine.stormHit | 0);
  safeText('stormNeedUI', Engine.stormNeed | 0);
  safeText('shieldUI', Engine.shield | 0);

  const pct = Engine.stormNeed ? (Engine.stormHit / Engine.stormNeed) * 100 : 0;
  safeWidth('stormBar', pct);

  // warn text
  const warn =
    (Engine.phase === 'STORM')
      ? (Engine.shield > 0
          ? `STORM! มีโล่แล้ว ตี ⚡ ให้ครบ`
          : `STORM! ต้องหา 🛡 ก่อน ถึงตี ⚡ ได้`)
      : (Engine.phase === 'BOSS')
        ? `BOSS Phase ${Engine.bossPhase} — เร่งคอมโบ/กันหลุด GREEN`
        : `—`;
  safeText('stormWarn', warn);

  // BOSS UI
  safeText('bossPhaseUI', Engine.phase === 'BOSS' ? `P${Engine.bossPhase}` : '—');
  safeText('bossProg', Engine.bossHit | 0);
  safeText('bossNeedUI', Engine.bossNeed | 0);
  const bpct = Engine.bossNeed ? (Engine.bossHit / Engine.bossNeed) * 100 : 0;
  safeWidth('bossBar', bpct);
}

function setQuestUI() {
  const z = Engine.zone;
  const phase = Engine.phase;

  const l1 = (phase === 'MAIN')
    ? `คุมให้อยู่โซน GREEN ให้นานที่สุด`
    : (phase === 'STORM')
      ? `🌀 STORM! หา 🛡 แล้วตี ⚡ ให้ครบ`
      : (phase === 'END')
        ? `⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา`
        : `👑 BOSS! ผ่าน 3 เฟสให้ได้`;

  const l2 = (phase === 'STORM')
    ? `⚡: ${Engine.stormHit}/${Engine.stormNeed} | 🛡: ${Engine.shield} | เหลือ ${(Engine.stormLeftMs/1000).toFixed(1)}s`
    : (phase === 'END')
      ? `GREEN: ${(Engine._endGreenMs/1000).toFixed(1)}s / ${(Engine.endNeedGreenMs/1000).toFixed(1)}s`
      : (phase === 'BOSS')
        ? `Goal: ${Engine.bossHit}/${Engine.bossNeed} | P${Engine.bossPhase} | เหลือ ${(Engine.bossMs/1000).toFixed(1)}s`
        : `ตอนนี้: โซน ${z}`;

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm cycles: ${Engine.stormCycles} | Storm OK: ${Engine.stormOk} | Lv: ${Engine.stormLevel}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax} | Shields used: ${Engine.shieldUsed}`);

  safeText('storm-left', (Engine.phase === 'STORM') ? Math.ceil(Engine.stormLeftMs/1000) : 0);

  setStormBossHUD();
}

function coachTip(msg, cooldownMs = 2400) {
  const t = nowMs();
  if (t - Engine.coachLastMs < cooldownMs) return;
  Engine.coachLastMs = t;
  emit('hha:coach', { msg, game: 'hydration' });
  logEv('coach', { msg, phase: Engine.phase });
}

/* =========================
   CORE GAME MECHANICS
========================= */

function adjustWater(delta) {
  Engine.waterPct = clamp(Engine.waterPct + delta, 0, 100);
  setWaterUI(Engine.waterPct);
}

function addScore(pts) {
  Engine.score += pts;
  emit('hha:score', { score: Engine.score, combo: Engine.combo, miss: Engine.miss, phase: Engine.phase });
}

/* =========================
   SPAWN HELPERS
========================= */

function removeTarget(el) {
  try { Engine.targets.delete(el); } catch {}
  try { el.remove(); } catch {}
}

function spawnAt(kind, x, y, size, ttl) {
  const layers = Engine.layers;
  if (!layers.length) return null;
  const layer = layers[(Math.random() * layers.length) | 0] || layers[0];

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

    // miss handling for critical items
    const k = el.dataset.kind;
    if (Engine.phase === 'STORM') {
      if (k === 'LIGHTNING') {
        // missed lightning opportunity
        Engine.miss += 1;
        Engine.combo = 0;
        coachTip('พลาด ⚡! รีบหา 🛡 แล้วเล็งให้ชัด', 1900);
        logEv('miss', { kind: 'LIGHTNING', phase: 'STORM' });
      }
      if (k === 'SHIELD') {
        logEv('miss', { kind: 'SHIELD', phase: 'STORM' });
      }
    }

    removeTarget(el);
  }, ttl);

  return el;
}

function pickXY(layer, rng, pad) {
  const rect = layer.getBoundingClientRect();
  const x = clamp((rect.width * (0.10 + rng() * 0.80)), pad, rect.width - pad);
  const y = clamp((rect.height * (0.18 + rng() * 0.68)), pad, rect.height - pad);
  return { x, y, rect };
}

function spawnOne(rng, cfg) {
  const layers = Engine.layers;
  if (!layers.length) return;

  for (const layer of layers) {
    const pad = Math.max(24, (cfg.size * 0.55) | 0);
    const { x, y } = pickXY(layer, rng, pad);

    const isStorm = (Engine.phase === 'STORM');
    const isBoss  = (Engine.phase === 'BOSS');

    // In STORM: focus on SHIELD + LIGHTNING (telegraphed) + some GOOD/BAD
    if (isStorm) {
      // allow shield spawn
      const wantShield = (Engine.shield < Engine.shieldMax) && (rng() < (Engine.shield === 0 ? 0.22 : 0.12));
      if (wantShield) {
        const el = spawnAt('SHIELD', x, y, (cfg.size + 6), cfg.ttl + 450);
        if (el) Engine.shieldDrops += 1;
        return;
      }

      // occasional GOOD/BAD to manage zone (but storm objective is lightning)
      const z = Engine.zone;
      let pBad = (z === 'GREEN') ? 0.22 : 0.32;
      const kind = (rng() < pBad) ? 'BAD' : 'GOOD';
      spawnAt(kind, x, y, cfg.size, cfg.ttl);
      return;
    }

    // MAIN/END/BOSS: classic GOOD/BAD balance
    let pBad = (Engine.zone === 'GREEN') ? 0.26 : 0.36;
    if (Engine.phase === 'END') pBad = 0.32;
    if (isBoss) {
      // phase personality
      if (Engine.bossPhase === 1) pBad = 0.30;
      if (Engine.bossPhase === 2) pBad = 0.40;
      if (Engine.bossPhase === 3) pBad = 0.48;
    }

    const kind = (rng() < pBad) ? 'BAD' : 'GOOD';
    const ttl  = cfg.ttl + ((rng() * 280) | 0);
    const size = cfg.size + ((rng() * 8) | 0);

    spawnAt(kind, x, y, size, ttl);
  }
}

function scheduleLightning(cfg, rng) {
  // Lightning happens only in STORM
  if (Engine.phase !== 'STORM') return;

  // if no shield, still can spawn lightning (pressure), but warn user
  const every = Math.max(520, cfg.stormStrikeEvery - (Engine.stormLevel * 70));
  Engine.stormTeleMs -= Engine._dtMs;

  if (Engine.stormTeleMs > 0) return;
  Engine.stormTeleMs = every;

  // pattern: at higher level, sometimes double/triple telegraph
  const bursts =
    (Engine.stormLevel >= 5 && rng() < 0.33) ? 3 :
    (Engine.stormLevel >= 3 && rng() < 0.40) ? 2 : 1;

  const layers = Engine.layers;
  if (!layers.length) return;
  const layer = layers[0];

  const pad = Math.max(26, (cfg.size * 0.55) | 0);

  for (let i=0;i<bursts;i++){
    const { x, y } = pickXY(layer, rng, pad);
    doTelegraph(x, y);

    // after 600ms, spawn lightning target for short ttl
    setTimeout(() => {
      if (!Engine.running || Engine.phase !== 'STORM') return;
      spawnAt('LIGHTNING', x, y, Math.max(58, cfg.size - 6), 900);
      logEv('spawn', { kind:'LIGHTNING', phase:'STORM', stormLevel: Engine.stormLevel });
    }, 600 + i*90);
  }
}

/* =========================
   HIT LOGIC
========================= */

function awardShield(n=1) {
  const before = Engine.shield;
  Engine.shield = clamp(Engine.shield + n, 0, Engine.shieldMax);
  if (Engine.shield > before) coachTip('ได้ 🛡! ตอน STORM ใช้ตี ⚡ ได้', 0);
  logEv('shield_gain', { shield: Engine.shield, add: n, phase: Engine.phase });
}

function consumeShield(n=1) {
  if (Engine.shield <= 0) return false;
  Engine.shield = clamp(Engine.shield - n, 0, Engine.shieldMax);
  Engine.shieldUsed += n;
  logEv('shield_use', { shield: Engine.shield, used: n, phase: Engine.phase });
  return true;
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

    // recover assist: if off-green, good gives extra pull back (solve "ไม่กลับมาเลย")
    if (Engine.zone !== 'GREEN') {
      adjustWater(+Math.max(2, (cfg.goodDelta * 0.35) | 0));
    }

    const bonus = 60 + Math.min(260, Engine.combo * 12);
    addScore(90 + bonus);

    // boss progress = GOOD hits
    if (Engine.phase === 'BOSS') Engine.bossHit += 1;

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2200);
  }
  else if (kind === 'BAD') {
    Engine.miss += 1;
    Engine.combo = 0;
    adjustWater(cfg.badDelta);
    addScore(-40);

    // in boss phase 3, penalty heavier
    if (Engine.phase === 'BOSS' && Engine.bossPhase === 3) {
      Engine.miss += 1;
      addScore(-20);
    }

    coachTip('โดน BAD! รีบกลับเข้า GREEN', 2200);
  }
  else if (kind === 'SHIELD') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    addScore(120);
    awardShield(1);
  }
  else if (kind === 'LIGHTNING') {
    // ⚡ only counts if shield exists AND in STORM
    if (Engine.phase === 'STORM') {
      if (consumeShield(1)) {
        Engine.combo += 1;
        Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
        Engine.stormHit += 1;
        addScore(180);
        coachTip('⚡ ได้! ใช้โล่ 1 อัน', 1400);
        logEv('storm_lightning', { ok:true, stormHit: Engine.stormHit, stormNeed: Engine.stormNeed, shield: Engine.shield });
      } else {
        // no shield: fail strike, big penalty
        Engine.miss += 2;
        Engine.combo = 0;
        addScore(-80);
        coachTip('ไม่มี 🛡! ต้องหาโล่ก่อนถึงตี ⚡ ได้', 0);
        logEv('storm_lightning', { ok:false, reason:'no_shield' });
      }
    } else {
      // outside storm: treat as bonus good
      Engine.combo += 1;
      Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
      addScore(120);
    }
  }

  doShock(cx, cy);
  logEv('hit', { kind, phase: Engine.phase, score: Engine.score, water: Engine.waterPct, combo: Engine.combo, source: info?.source || 'unknown' });
  removeTarget(el);
}

/* =========================
   SHOOT EVENT (crosshair)
========================= */

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
    // miss penalty only in STORM/BOSS
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      coachTip('พลาด! เล็งนิ่ง ๆ แล้วค่อยยิง', 1800);
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

  Engine.stormLevel = Math.max(1, (Engine.stormLevel | 0) + 1);
  Engine.stormLeftMs = cfg.stormDur;
  Engine.stormHit = 0;

  Engine.stormNeed = cfg.stormNeedBase + (Engine.stormLevel - 1) * cfg.stormNeedInc;
  Engine.stormNeed = clamp(Engine.stormNeed, 1, 30) | 0;

  Engine.stormTeleMs = 420; // quick first strike

  DOC.body.classList.add('hha-bossfx');
  coachTip(`🌀 STORM Lv${Engine.stormLevel}! หา 🛡 แล้วตี ⚡ ให้ครบ`, 0);
  logEv('phase', { phase: 'STORM', stormLevel: Engine.stormLevel, stormNeed: Engine.stormNeed });
}

function exitStorm(success) {
  Engine.phase = 'MAIN';
  DOC.body.classList.remove('hha-bossfx');

  if (success) {
    Engine.stormOk += 1;
    // reward: small water normalization + score bonus
    adjustWater(+6);
    addScore(220 + Engine.stormLevel * 20);
    coachTip('ผ่าน STORM! กลับไปคุม GREEN ต่อ', 0);
  } else {
    // fail: reduce water and clear shield
    Engine.miss += 2;
    Engine.combo = 0;
    Engine.shield = 0;
    adjustWater(-8);
    coachTip('STORM ไม่ผ่าน! รีบกลับ GREEN แล้วเตรียมใหม่', 0);
  }

  logEv('phase', { phase: 'MAIN', stormSuccess: !!success, stormLevel: Engine.stormLevel });
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
  Engine.bossTotalMs = cfg.bossMs;
  Engine.bossMs = cfg.bossMs;

  Engine.bossNeed = cfg.bossNeed;
  Engine.bossHit = 0;

  Engine.bossPhase = 1;
  DOC.body.classList.add('hha-bossfx');
  coachTip('👑 BOSS! ผ่าน 3 เฟสให้ได้', 0);
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
  Engine._dtMs = dt * 1000;

  const elapsed = (t - Engine.t0) / 1000;
  const left = Math.max(0, Engine.timePlannedSec - elapsed);

  emit('hha:time', { t: elapsed, left, phase: Engine.phase, zone: Engine.zone });
  setStatsUI(left);

  // difficulty director lite (play only)
  let spawnRate = cfg.spawnPerSec;
  if (Engine.runMode === 'play') {
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 60);
    spawnRate = cfg.spawnPerSec * (0.9 + perf * 0.40);
  }

  // drift / recovery (solve "ออก green แล้วไม่กลับมาเลย")
  if (Engine.runMode === 'play') {
    const target = 55;
    const z = Engine.zone;
    const drift = cfg.drift * (z === 'GREEN' ? 0.55 : 1.15);
    Engine.waterPct += (target - Engine.waterPct) * drift * dt;
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  } else {
    // research: very mild drift to avoid "stuck" but keep determinism feel
    const target = 50;
    Engine.waterPct += (target - Engine.waterPct) * 0.06 * dt;
    Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  }
  setWaterUI(Engine.waterPct);

  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  const leftMs = left * 1000;

  // enter END around last 18s
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // STORM trigger: ONLY when leave GREEN -> LOW/HIGH continuously
  if (Engine.phase === 'MAIN' || Engine.phase === 'END') {
    if (Engine.zone === 'GREEN') Engine._offGreenMs = 0;
    else Engine._offGreenMs = (Engine._offGreenMs || 0) + dt * 1000;

    // stricter gate: must be LOW/HIGH for a bit
    if ((Engine._offGreenMs || 0) > 1450 && Engine.phase !== 'STORM' && Engine.phase !== 'BOSS') {
      Engine._offGreenMs = 0;
      enterStorm(cfg);
    }
  }

  // STORM loop
  if (Engine.phase === 'STORM') {
    Engine.stormLeftMs -= dt * 1000;

    // schedule lightning strikes (telegraph)
    scheduleLightning(cfg, Engine.rng);

    // pass condition
    if (Engine.stormHit >= Engine.stormNeed) {
      exitStorm(true);
    } else if (Engine.stormLeftMs <= 0) {
      exitStorm(false);
    }
  }

  // END window
  if (Engine.phase === 'END') {
    Engine.endWindowMs -= dt * 1000;
    if (Engine.zone === 'GREEN') Engine._endGreenMs += dt * 1000;

    if (Engine.endWindowMs <= 0) {
      DOC.body.classList.remove('hha-endfx');
      enterBoss(cfg);
    }
  }

  // BOSS 3 phases + progress hooks
  if (Engine.phase === 'BOSS') {
    Engine.bossMs -= dt * 1000;

    const total = Math.max(1, Engine.bossTotalMs);
    const passed = total - Math.max(0, Engine.bossMs);
    const pct = clamp01(passed / total);

    // phase split: 0-35%, 35-70%, 70-100%
    Engine.bossPhase = (pct < 0.35) ? 1 : (pct < 0.70) ? 2 : 3;

    // phase 3 “mini-storm inside boss”: occasional lightning appears but counts as bonus (no shield req)
    if (Engine.bossPhase === 3 && (Engine._bossZapMs = (Engine._bossZapMs || 0) - Engine._dtMs) <= 0) {
      Engine._bossZapMs = 1600 + (Engine.rng() * 800);
      const layer = Engine.layers[0];
      if (layer) {
        const pad = Math.max(26, (cfg.size * 0.55) | 0);
        const { x, y } = pickXY(layer, Engine.rng, pad);
        doTelegraph(x, y);
        setTimeout(() => {
          if (!Engine.running || Engine.phase !== 'BOSS') return;
          // lightning becomes bonus in boss (still fun)
          spawnAt('LIGHTNING', x, y, Math.max(56, cfg.size - 8), 760);
        }, 560);
      }
    }

    // boss clear rule: reach bossNeed OR time out
    if (Engine.bossHit >= Engine.bossNeed) Engine.bossMs = 0;

    if (Engine.bossMs <= 0) {
      endGame();
      return;
    }
  }

  // spawn accel (not in STORM? still spawn some to keep busy)
  Engine.spawnAcc += dt * spawnRate;
  if (Engine.phase === 'END') Engine.spawnAcc += dt * 0.10;
  if (Engine.phase === 'BOSS') Engine.spawnAcc += dt * (Engine.bossPhase === 3 ? 0.55 : 0.35);
  if (Engine.phase === 'STORM') Engine.spawnAcc += dt * 0.20;

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
    stormLevelMax: Engine.stormLevel | 0,
    shieldDrops: Engine.shieldDrops | 0,
    shieldUsed: Engine.shieldUsed | 0,

    bossNeed: Engine.bossNeed | 0,
    bossHit: Engine.bossHit | 0,

    logs: Engine.logs.slice(0, 4000),

    // legacy
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
    ['stormLevelMax', s.stormLevelMax],
    ['shieldDrops', s.shieldDrops],
    ['shieldUsed', s.shieldUsed],
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
  safeText('rMinis', `Storm OK: ${summary.stormOk}/${summary.stormCycles} | LvMax: ${summary.stormLevelMax}`);
  safeText('rTier', summary.tier);

  const tips = [];
  const stormRate = summary.stormCycles ? Math.round((summary.stormOk / summary.stormCycles) * 100) : 0;

  if (stormRate < 60) tips.push('• STORM: รีบหา 🛡 ก่อน แล้วค่อยตี ⚡ ตามสัญญาณเตือน');
  if (summary.shieldUsed < Math.max(1, summary.stormOk)) tips.push('• โล่: อยู่ GREEN ต่อเนื่อง + ยิงดี ๆ จะได้โล่ทัน STORM');
  if (summary.miss > 8) tips.push('• เล็ง: อย่ายิงรัวตอนเป้าแน่น หยุดครึ่งจังหวะแล้วเล็งใหม่');
  if (summary.comboMax < 6) tips.push('• คอมโบ: เลือกยิงเป้าที่ใกล้ศูนย์กลางก่อน จะติดง่ายในมือถือ');
  if (!tips.length) tips.push('• ฟอร์มดีมาก! ลอง diff=hard หรือโหมด research เพื่อเก็บข้อมูล');

  const tipsEl = DOC.getElementById('rTips');
  if (tipsEl) tipsEl.textContent = tips.join('\n');

  const nextEl = DOC.getElementById('rNext');
  if (nextEl) nextEl.textContent = `Next: diff=${summary.diff} | runMode=${summary.runMode} | seed=${summary.seed}`;

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

  Engine.stormLevel = 0;
  Engine.stormNeed = 0;
  Engine.stormHit = 0;
  Engine.stormTeleMs = 0;

  Engine.shield = 0;
  Engine.shieldDrops = 0;
  Engine.shieldUsed = 0;

  Engine.endWindowMs = 0;
  Engine.endNeedGreenMs = 0;
  Engine._endGreenMs = 0;

  Engine.bossTotalMs = 0;
  Engine.bossMs = 0;
  Engine.bossNeed = 0;
  Engine.bossHit = 0;
  Engine.bossPhase = 1;

  Engine.targets = new Set();
  Engine.spawnAcc = 0;

  Engine.logs = [];
  Engine.coachLastMs = 0;

  Engine._offGreenMs = 0;
  Engine._gcAcc = 0;

  Engine.ended = false;
  Engine.running = true;
  Engine.started = true;

  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

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

  WIN.addEventListener('hha:shoot', onShoot, { passive: true });

  for (const L of Engine.layers) {
    L.addEventListener('pointerdown', onLayerPointerDown, { passive: false });
  }

  Engine.rafId = requestAnimationFrame(step);
  coachTip('เริ่มเลย! คุมให้อยู่ GREEN — ถ้าหลุด LOW/HIGH จะเข้า STORM', 0);
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
  // summary overlay never show on boot
  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

  // lock hidden + force targets visible
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
        runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed,
        score: Engine.score, combo: Engine.combo, miss: Engine.miss,
        waterPct: Engine.waterPct, zone: Engine.zone, phase: Engine.phase,
        stormLevel: Engine.stormLevel, stormHit: Engine.stormHit, stormNeed: Engine.stormNeed,
        shield: Engine.shield, bossPhase: Engine.bossPhase, bossHit: Engine.bossHit, bossNeed: Engine.bossNeed
      }))
    };
  } catch {}
})();

export {}; // ESM marker