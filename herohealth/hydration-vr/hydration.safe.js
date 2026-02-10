// === /herohealth/hydration-vr/hydration.safe.js ===
// HydrationVR SAFE Engine — PRODUCTION (HHA Standard) — FULL (PACK 1–10)
// ✅ PC/Mobile/cVR/Cardboard (multi-layer)
// ✅ Targets always visible (class: hvr-target) + robust layer mounting
// ✅ Tap-to-shoot via hha:shoot {x,y,lockPx,source} (from vr-ui.js)
// ✅ Quest: Keep water in GREEN, Storm cycles, End Window, Boss 3 phases
// ✅ STORM RULE (per request):
//    - เข้า STORM เมื่อ “หลุด GREEN ไป LOW/HIGH ต่อเนื่อง”
//    - ต้องมี 🛡 ถึงจะ “ตี ⚡” ได้
//    - ผ่าน STORM ด้วยการตี ⚡ ให้ครบ (Lightning objective)
//    - ผ่านมากขึ้น -> Storm Level สูงขึ้น -> ⚡ มากขึ้น
// ✅ Boss 3 เฟส + progress bar hooks (optional IDs)
// ✅ Emits: hha:start, hha:time, hha:score, hha:coach, hha:end
// ✅ Stores: HHA_LAST_SUMMARY, HHA_SUMMARY_HISTORY
// ✅ CSV download + JSON copy from result overlay buttons
// ✅ Research deterministic (seeded), Play adaptive (difficulty director lite)
// ✅ Fix: “ไม่เข้า storm” (trigger จาก off-green) + “ออก green แล้วไม่กลับ” (auto-recover)

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
  // deterministic LCG
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
  if (score >= 1900) return 'A';
  if (score >= 1300) return 'B';
  if (score >= 800)  return 'C';
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
   PACK 9 FX + SFX
========================= */

function fxFlash(ms=120){
  try{
    DOC.body.classList.add('hha-flash');
    setTimeout(()=>DOC.body.classList.remove('hha-flash'), ms);
  }catch(_){}
}
function fxShake(){
  try{
    DOC.body.classList.remove('hha-shake');
    void DOC.body.offsetHeight;
    DOC.body.classList.add('hha-shake');
    setTimeout(()=>DOC.body.classList.remove('hha-shake'), 220);
  }catch(_){}
}
let __ac=null;
function sfx(freq=440, dur=0.06, vol=0.08){
  try{
    const AC = WIN.AudioContext || WIN.webkitAudioContext;
    if(!AC) return;
    __ac = __ac || new AC();
    const o = __ac.createOscillator();
    const g = __ac.createGain();
    o.type='sine';
    o.frequency.value=freq;
    g.gain.value=vol;
    o.connect(g); g.connect(__ac.destination);
    o.start();
    o.stop(__ac.currentTime + dur);
  }catch(_){}
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
    if (!L.style.position) L.style.position = 'absolute';
    if (!L.style.inset) L.style.inset = '0';
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
    (kind === 'SHIELD') ? '🛡' : '💧';
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
  if (kind === 'LIGHTNING') el.style.outline = '2px solid rgba(59,130,246,.55)';
  if (kind === 'SHIELD') el.style.outline = '2px solid rgba(245,158,11,.45)';

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

  run: 'play',       // legacy alias
  runMode: 'play',   // canonical
  diff: 'normal',    // easy | normal | hard
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

  targets: new Set(),
  spawnAcc: 0,

  logs: [],
  coachLastMs: 0,

  // PACK 9 (Shield + Lightning Objective)
  stormLevel: 1,
  shield: 0,
  lightningNeed: 0,
  lightningHit: 0,

  // PACK 10 (Boss 3 phases)
  bossPhase: 1,
  bossMs: 0,
  bossNeedGood: 0,
  bossGoodHit: 0,

  // helpers
  _offGreenMs: 0,
  _endGreenMs: 0,
  _gcAcc: 0
};

function cfgByDiff(diff) {
  const base = {
    easy:   { spawnPerSec: 0.95, size: 74, ttl: 1400, goodDelta: 9,  badDelta: -9,  drift: 0.22, lock: 28, stormDur: 9000,  endMs: 9000,  endNeed: 5200, bossMs: 10000, bossNeed: 8,
              lightningBase: 2, lightningInc: 1, shieldCap: 3, shieldDropP: 0.42 },
    normal: { spawnPerSec: 1.15, size: 68, ttl: 1250, goodDelta: 8,  badDelta: -10, drift: 0.28, lock: 28, stormDur: 9500,  endMs: 10000, endNeed: 6200, bossMs: 11000, bossNeed: 10,
              lightningBase: 3, lightningInc: 1, shieldCap: 3, shieldDropP: 0.35 },
    hard:   { spawnPerSec: 1.35, size: 62, ttl: 1100, goodDelta: 7,  badDelta: -12, drift: 0.33, lock: 28, stormDur: 10000, endMs: 11000, endNeed: 7200, bossMs: 12000, bossNeed: 12,
              lightningBase: 4, lightningInc: 2, shieldCap: 3, shieldDropP: 0.30 },
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
}

function setQuestUI() {
  const phase = Engine.phase;

  const l1 = (phase === 'MAIN')
    ? `คุมให้อยู่โซน GREEN ให้นานที่สุด`
    : (phase === 'STORM')
      ? `🌀 STORM Lv${Engine.stormLevel}! หา 🛡 แล้วตี ⚡ ให้ครบ`
      : (phase === 'END')
        ? `⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา`
        : `👑 BOSS! เก็บ 💧GOOD ให้ครบ (3 เฟส)`;

  const l2 = (phase === 'STORM')
    ? `⚡: ${Engine.lightningHit}/${Engine.lightningNeed} | 🛡: ${Engine.shield} | เหลือ ${(Engine.stormLeftMs/1000).toFixed(1)}s`
    : (phase === 'END')
      ? `GREEN: ${(Engine._endGreenMs/1000).toFixed(1)}s / ${(Engine.endNeedGreenMs/1000).toFixed(1)}s`
      : (phase === 'BOSS')
        ? `Phase ${Engine.bossPhase} | 💧: ${Engine.bossGoodHit}/${Engine.bossNeedGood} | เหลือ ${(Engine.bossMs/1000).toFixed(1)}s`
        : `ตอนนี้: โซน ${Engine.zone}`;

  safeText('quest-line1', l1);
  safeText('quest-line2', l2);
  safeText('quest-line3', `Storm cycles: ${Engine.stormCycles} | Storm OK: ${Engine.stormOk}`);
  safeText('quest-line4', `ComboMax: ${Engine.comboMax}`);

  // ===== progress bar hooks (optional IDs in RUN) =====
  try{
    const stormOn = Engine.phase === 'STORM';
    const bossOn  = Engine.phase === 'BOSS';

    const stormMeter = DOC.getElementById('stormMeter');
    const bossMeter  = DOC.getElementById('bossMeter');

    if (stormMeter) stormMeter.style.display = stormOn ? 'block' : 'none';
    if (bossMeter)  bossMeter.style.display  = bossOn ? 'block' : 'none';

    if (stormOn){
      const need = Engine.lightningNeed || 0;
      const hit  = Engine.lightningHit || 0;
      const pct  = need ? Math.round((hit/need)*100) : 0;

      DOC.getElementById('stormProg') && (DOC.getElementById('stormProg').textContent = String(hit));
      DOC.getElementById('stormNeedUI') && (DOC.getElementById('stormNeedUI').textContent = String(need));
      DOC.getElementById('stormLvUI') && (DOC.getElementById('stormLvUI').textContent = String(Engine.stormLevel || 1));
      DOC.getElementById('shieldUI') && (DOC.getElementById('shieldUI').textContent = String(Engine.shield || 0));
      DOC.getElementById('stormBar') && (DOC.getElementById('stormBar').style.width = `${pct}%`);

      const warn = DOC.getElementById('stormWarn');
      if (warn) warn.classList.toggle('on', (Engine.shield||0) <= 0);
    }

    if (bossOn){
      const need = Engine.bossNeedGood || 0;
      const hit  = Engine.bossGoodHit || 0;
      const pct  = need ? Math.round((hit/need)*100) : 0;

      DOC.getElementById('bossPhaseUI') && (DOC.getElementById('bossPhaseUI').textContent = String(Engine.bossPhase || 1));
      DOC.getElementById('bossProg') && (DOC.getElementById('bossProg').textContent = String(hit));
      DOC.getElementById('bossNeedUI') && (DOC.getElementById('bossNeedUI').textContent = String(need));
      DOC.getElementById('bossBar') && (DOC.getElementById('bossBar').style.width = `${pct}%`);
    }
  }catch(_){}
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

    let kind;

    if (isStorm) {
      const needShield = (Engine.shield || 0) < (cfg.shieldCap || 3);
      const pShield = needShield ? (cfg.shieldDropP || 0.35) : 0.05;
      const pLightning = 0.22 + Math.min(0.18, (Math.max(1,Engine.stormLevel)-1)*0.03);
      const r = rng();

      if (r < pShield) kind = 'SHIELD';
      else if (r < pShield + pLightning) kind = 'LIGHTNING';
      else kind = (rng() < 0.28) ? 'BAD' : 'GOOD';
    }
    else if (isBoss) {
      const z = Engine.zone;
      let pBad = (z === 'GREEN') ? 0.34 : 0.44;

      if (Engine.bossPhase === 2) pBad += 0.06;
      if (Engine.bossPhase === 3) pBad += 0.10;

      kind = (rng() < pBad) ? 'BAD' : 'GOOD';

      if (Engine.bossPhase === 3 && rng() < 0.12) kind = 'LIGHTNING'; // bonus lightning in phase3
    }
    else {
      const z = Engine.zone;
      let pBad = (z === 'GREEN') ? 0.26 : 0.36;
      kind = (rng() < pBad) ? 'BAD' : 'GOOD';
    }

    const phaseSizeBoost =
      (Engine.phase === 'BOSS' && Engine.bossPhase === 3) ? -8 :
      (Engine.phase === 'BOSS' && Engine.bossPhase === 2) ? -4 : 0;

    const ttl = cfg.ttl + ((rng() * 300) | 0);
    const size = Math.max(48, cfg.size + ((rng() * 8) | 0) + phaseSizeBoost);

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

      // miss penalty in storm/boss for GOOD only
      if (el.dataset.kind === 'GOOD' && (Engine.phase === 'STORM' || Engine.phase === 'BOSS')) {
        Engine.miss += 1;
        Engine.combo = 0;
        coachTip('พลาด 💧GOOD! ลองเล็งกลางเป้าให้ชัดขึ้น', 1800);
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

  if (kind === 'GOOD') {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+cfg.goodDelta);

    const bonus = 60 + Math.min(260, Engine.combo * 10);
    addScore(90 + bonus);

    if (Engine.phase === 'BOSS') Engine.bossGoodHit += 1;

    coachTip('ดีมาก! รักษาให้อยู่ GREEN ต่อเนื่อง', 2300);

  } else if (kind === 'BAD') {
    Engine.miss += 1;
    Engine.combo = 0;
    adjustWater(cfg.badDelta);
    addScore(-35);
    fxShake(); sfx(180,0.06,0.10);
    coachTip('โดน 🥤BAD! รีบกลับเข้า GREEN', 2200);

  } else if (kind === 'SHIELD') {
    Engine.shield = Math.min(cfg.shieldCap || 3, (Engine.shield || 0) + 1);
    addScore(60);
    fxFlash(90); sfx(520,0.05,0.08);
    coachTip(`เก็บ 🛡 แล้ว! ตอนนี้มี ${Engine.shield}`, 1400);
    logEv('shield', { shield: Engine.shield, phase: Engine.phase });

  } else if (kind === 'LIGHTNING') {
    if (Engine.phase === 'BOSS') {
      // bonus lightning in boss (no shield required)
      addScore(90);
      fxFlash(100); sfx(740,0.05,0.08);
      coachTip('⚡ BONUS! (บอสตีได้ฟรี)', 1200);
      logEv('lightning_bonus', { phase:'BOSS' });
    } else {
      // STORM: must have shield
      if ((Engine.shield || 0) <= 0) {
        Engine.miss += 1;
        Engine.combo = 0;
        adjustWater(-10);
        addScore(-40);
        fxFlash(160); fxShake(); sfx(120,0.08,0.12);
        coachTip('⚡ ต้องมี 🛡 ก่อนถึงตีได้! รีบหาโล่!', 1600);
        logEv('lightning_fail', { phase: Engine.phase, shield: Engine.shield || 0 });
      } else {
        Engine.shield -= 1;
        Engine.lightningHit += 1;
        addScore(180);
        fxFlash(120); fxShake(); sfx(880,0.06,0.10);
        coachTip(`ตี ⚡ สำเร็จ! ${Engine.lightningHit}/${Engine.lightningNeed} (🛡 เหลือ ${Engine.shield})`, 1200);
        logEv('lightning_hit', { phase: Engine.phase, hit: Engine.lightningHit, need: Engine.lightningNeed, shield: Engine.shield });
      }
    }

  } else {
    Engine.combo += 1;
    Engine.comboMax = Math.max(Engine.comboMax, Engine.combo);
    adjustWater(+Math.max(4, (cfg.goodDelta - 3)));
    addScore(120);
    coachTip('ดีมาก!', 2000);
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
    // miss penalty only in STORM/BOSS
    if (Engine.phase === 'STORM' || Engine.phase === 'BOSS') {
      Engine.miss += 1;
      Engine.combo = 0;
      fxShake(); sfx(160,0.05,0.08);
      coachTip('พลาด! ลองปรับมือถือให้เล็งนิ่งขึ้น', 1600);
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

  Engine.stormLevel = Math.max(1, (Engine.stormLevel || 1));
  Engine.lightningNeed = (cfg.lightningBase || 3) + (Engine.stormLevel - 1) * (cfg.lightningInc || 1);
  Engine.lightningHit = 0;

  Engine.stormLeftMs = cfg.stormDur;

  DOC.body.classList.add('hha-bossfx');
  fxFlash(140); fxShake(); sfx(220,0.08,0.10);

  coachTip(`🌀 STORM Lv${Engine.stormLevel}! หา 🛡 แล้วตี ⚡ ให้ครบ ${Engine.lightningNeed} ครั้ง`, 0);
  logEv('phase', { phase: 'STORM', stormLevel: Engine.stormLevel, lightningNeed: Engine.lightningNeed });
}

function exitStorm(success) {
  Engine.phase = 'MAIN';
  DOC.body.classList.remove('hha-bossfx');

  if (success) {
    Engine.stormOk += 1;
    Engine.stormLevel = Math.min(9, (Engine.stormLevel || 1) + 1);
    sfx(660,0.06,0.10);
  } else {
    Engine.stormLevel = Math.max(1, (Engine.stormLevel || 1) - 1);
    sfx(160,0.08,0.10);
  }

  coachTip(success ? 'ผ่าน STORM! กลับไปคุม GREEN ต่อ' : 'STORM ไม่ผ่าน! ระวัง BAD และหา 🛡 ก่อน', 0);
  logEv('phase', { phase: 'MAIN', stormSuccess: !!success, stormLevel: Engine.stormLevel });
}

function enterEndWindow(cfg) {
  Engine.phase = 'END';
  Engine.endWindowMs = cfg.endMs;
  Engine.endNeedGreenMs = cfg.endNeed;
  Engine._endGreenMs = 0;
  DOC.body.classList.add('hha-endfx');
  fxFlash(120); sfx(420,0.06,0.08);
  coachTip('⏱ END WINDOW! อยู่ GREEN ให้ครบเวลา', 0);
  logEv('phase', { phase: 'END', needGreenMs: Engine.endNeedGreenMs });
}

function enterBoss(cfg) {
  Engine.phase = 'BOSS';

  Engine.bossPhase = 1;
  Engine.bossMs = cfg.bossMs;
  Engine.bossNeedGood = (cfg.bossNeed || 9) + Math.min(6, (Engine.stormLevel-1));
  Engine.bossGoodHit = 0;

  DOC.body.classList.add('hha-bossfx');
  fxFlash(160); fxShake(); sfx(330,0.10,0.12);

  coachTip(`👑 BOSS! ผ่านได้ด้วยการเก็บ 💧GOOD ให้ครบ ${Engine.bossNeedGood} (มี 3 เฟส)`, 0);
  logEv('phase', { phase:'BOSS', bossNeedGood: Engine.bossNeedGood });
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

  // difficulty director lite (play only)
  let spawnRate = cfg.spawnPerSec;
  if (Engine.runMode === 'play') {
    const perf = clamp01((Engine.score / Math.max(1, elapsed)) / 60);
    spawnRate = cfg.spawnPerSec * (0.9 + perf * 0.35);
  }

  // Boss modifiers (Phase 2/3 faster)
  if (Engine.phase === 'BOSS') {
    if (Engine.bossPhase === 2) spawnRate *= 1.18;
    if (Engine.bossPhase === 3) spawnRate *= 1.32;
  }

  // water auto-recover:
  // play: drift -> 55 (feel good)
  // research: gentle -> 50 (deterministic safety) prevent "หลุดแล้วไม่กลับ"
  if (Engine.runMode === 'play') {
    const target = 55;
    Engine.waterPct += (target - Engine.waterPct) * cfg.drift * dt;
  } else {
    const target = 50;
    Engine.waterPct += (target - Engine.waterPct) * 0.10 * dt;
  }
  Engine.waterPct = clamp(Engine.waterPct, 0, 100);
  setWaterUI(Engine.waterPct);

  if (Engine.zone === 'GREEN') Engine.greenHoldMs += dt * 1000;

  const leftMs = left * 1000;

  // enter END around last 18s (only if not already storm/boss)
  if (!Engine.ended && leftMs <= 18000 && Engine.phase === 'MAIN') {
    enterEndWindow(cfg);
  }

  // STORM TRIGGER: off-green continuous (fix: make it reliable)
  if (Engine.phase === 'MAIN') {
    if (Engine.zone === 'GREEN') {
      Engine._offGreenMs = 0;
    } else {
      Engine._offGreenMs = (Engine._offGreenMs || 0) + dt * 1000;
      if (Engine._offGreenMs > 1400) { // ~1.4s off-green => storm
        Engine._offGreenMs = 0;
        enterStorm(cfg);
      }
    }
  }

  // STORM (pass by lightning objective)
  if (Engine.phase === 'STORM') {
    Engine.stormLeftMs -= dt * 1000;

    if (Engine.lightningHit >= Engine.lightningNeed) {
      exitStorm(true);
    } else if (Engine.stormLeftMs <= 0) {
      Engine.miss += 2;
      Engine.combo = 0;
      exitStorm(false);
    }
  }

  // END window -> then BOSS
  if (Engine.phase === 'END') {
    Engine.endWindowMs -= dt * 1000;
    if (Engine.zone === 'GREEN') Engine._endGreenMs += dt * 1000;

    if (Engine.endWindowMs <= 0) {
      DOC.body.classList.remove('hha-endfx');
      enterBoss(cfg);
    }
  }

  // BOSS (3 phases) + win by bossGoodHit
  if (Engine.phase === 'BOSS') {
    Engine.bossMs -= dt * 1000;

    const total = cfg.bossMs || 11000;
    const ratio = total ? (Engine.bossMs / total) : 0;

    const newPhase = (ratio > 0.66) ? 1 : (ratio > 0.33) ? 2 : 3;
    if (newPhase !== Engine.bossPhase){
      Engine.bossPhase = newPhase;
      fxFlash(140);
      sfx(newPhase===2 ? 520 : 760, 0.07, 0.10);
      coachTip(newPhase===2 ? 'BOSS Phase 2: เป้าแน่นขึ้น ระวัง 🥤BAD!' : 'BOSS Phase 3: เล็กลง+เร็วขึ้น โฟกัสกลางจอ!', 0);
      logEv('boss_phase', { bossPhase: newPhase });
    }

    if (Engine.bossGoodHit >= Engine.bossNeedGood) Engine.bossMs = 0;
    if (Engine.bossMs <= 0) {
      endGame();
      return;
    }
  }

  // spawn accel
  Engine.spawnAcc += dt * spawnRate;
  if (Engine.phase === 'STORM') Engine.spawnAcc += dt * 0.55;
  if (Engine.phase === 'BOSS')  Engine.spawnAcc += dt * 0.65;

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

    // PACK 9
    stormMaxLevel: Engine.stormLevel | 0,
    shieldEnd: Engine.shield | 0,
    lightningNeed: Engine.lightningNeed | 0,
    lightningHit: Engine.lightningHit | 0,

    // PACK 10
    bossPhaseEnd: Engine.bossPhase | 0,
    bossNeedGood: Engine.bossNeedGood | 0,
    bossGoodHit: Engine.bossGoodHit | 0,

    logs: Engine.logs.slice(0, 4000),

    // legacy keep
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
    ['stormMaxLevel', s.stormMaxLevel],
    ['shieldEnd', s.shieldEnd],
    ['lightningNeed', s.lightningNeed],
    ['lightningHit', s.lightningHit],
    ['bossPhaseEnd', s.bossPhaseEnd],
    ['bossNeedGood', s.bossNeedGood],
    ['bossGoodHit', s.bossGoodHit],
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
  safeText('rMinis', `${summary.stormOk}/${summary.stormCycles} | LvMax ${summary.stormMaxLevel}`);
  safeText('rTier', summary.tier);

  const tips = [];
  const stormRate = summary.stormCycles ? Math.round((summary.stormOk / summary.stormCycles) * 100) : 0;

  if (stormRate < 60) tips.push('• STORM: หา 🛡 ก่อน แล้วค่อยตี ⚡ จะผ่านง่ายขึ้น');
  if (summary.miss > 6) tips.push('• อย่ายิงรัวตอนเป้าแน่น ให้หยุดครึ่งจังหวะแล้วเล็งใหม่');
  if (summary.comboMax < 6) tips.push('• ทำคอมโบ: เลือกยิง 💧GOOD ใกล้กลางจอก่อน');
  if (!tips.length) tips.push('• ฟอร์มดีมาก! ลองเพิ่ม diff หรือโหมด research เก็บข้อมูล');

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
  Engine.stormLeftMs = 0;

  Engine.stormLevel = 1;
  Engine.shield = 0;
  Engine.lightningNeed = 0;
  Engine.lightningHit = 0;

  Engine.bossPhase = 1;
  Engine.bossNeedGood = 0;
  Engine.bossGoodHit = 0;

  Engine.targets = new Set();
  Engine.spawnAcc = 0;

  Engine.logs = [];
  Engine.coachLastMs = 0;

  Engine._offGreenMs = 0;
  Engine._endGreenMs = 0;
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
  try{
    const back = DOC.getElementById('resultBackdrop');
    if (back) back.hidden = true;
  }catch(_){}

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

  try {
    WIN.HydrationVR = {
      start: startGame,
      stop: stopGame,
      end: endGame,
      getState: () => JSON.parse(JSON.stringify({
        runMode: Engine.runMode, diff: Engine.diff, timePlannedSec: Engine.timePlannedSec, seed: Engine.seed,
        score: Engine.score, combo: Engine.combo, miss: Engine.miss,
        waterPct: Engine.waterPct, zone: Engine.zone, phase: Engine.phase,
        stormLevel: Engine.stormLevel, shield: Engine.shield, lightning: `${Engine.lightningHit}/${Engine.lightningNeed}`,
        bossPhase: Engine.bossPhase, boss: `${Engine.bossGoodHit}/${Engine.bossNeedGood}`
      }))
    };
  } catch {}
})();

export {}; // ESM marker