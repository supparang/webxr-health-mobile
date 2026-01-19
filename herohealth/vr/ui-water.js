// === /herohealth/vr/ui-water.js ===
// Water Gauge Helper — PRODUCTION (Hydration tuned, kids-friendly)
// ✅ ensureWaterGauge(): bind DOM ids if present
// ✅ setWaterGauge(pct): set target water value 0..100 (engine calls often)
// ✅ Smooth display (separate "target" vs "displayed") to avoid jerky / hard control feeling
// ✅ kids mode: softer smoothing, less twitch
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
//
// DOM IDs used (optional):
//   #water-bar, #water-pct, #water-zone
//
// Optional CSS classes on body:
//   body.water-low / body.water-green / body.water-high  (for styling hooks)

(function (root) {
  'use strict';

  const WIN = root;
  const DOC = root.document;
  if (!DOC) return;

  // Export surface
  const API = {};
  const GAME = (WIN.GAME_MODULES = WIN.GAME_MODULES || {});
  GAME.WaterUI = API;

  // --- helpers ---
  const qs = (k, def = null) => {
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };
  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };

  // kids detect (shared convention)
  const kidsQ = String(qs('kids', '0')).toLowerCase();
  const KIDS = (kidsQ === '1' || kidsQ === 'true' || kidsQ === 'yes');

  // --- state ---
  const S = {
    inited: false,
    bar: null,
    pct: null,
    zone: null,

    // target & displayed
    target: 50,
    shown: 50,
    lastPaint: 0,

    // smoothing params
    // alpha: 0..1 (higher = faster follow)
    alpha: KIDS ? 0.12 : 0.16,
    alphaFast: KIDS ? 0.22 : 0.28,  // when change is big
    dead: KIDS ? 0.25 : 0.35,       // deadzone to prevent jitter
    snap: KIDS ? 18 : 22,           // if delta > snap => faster follow

    raf: 0,
    dirty: false,
    lastZone: ''
  };

  function zoneFrom(pct) {
    // You can tune thresholds here later if needed
    // Current: GREEN is the "good range" in the middle
    pct = clamp(pct, 0, 100);
    if (pct < 40) return 'LOW';
    if (pct > 70) return 'HIGH';
    return 'GREEN';
  }

  function setBodyZoneClass(z) {
    try {
      DOC.body.classList.toggle('water-low', z === 'LOW');
      DOC.body.classList.toggle('water-green', z === 'GREEN');
      DOC.body.classList.toggle('water-high', z === 'HIGH');
    } catch (_) {}
  }

  function bind() {
    if (S.inited) return;
    S.inited = true;
    S.bar = DOC.getElementById('water-bar');
    S.pct = DOC.getElementById('water-pct');
    S.zone = DOC.getElementById('water-zone');
  }

  function paint(nowTs) {
    // Smooth follow target -> shown
    const dt = Math.min(0.05, Math.max(0.001, (nowTs - (S.lastPaint || nowTs)) / 1000));
    S.lastPaint = nowTs;

    const t = clamp(S.target, 0, 100);
    let s = clamp(S.shown, 0, 100);
    const d = t - s;
    const ad = Math.abs(d);

    if (ad <= S.dead) {
      // tiny jitter ignore
      S.dirty = false;
    } else {
      const a = (ad >= S.snap) ? S.alphaFast : S.alpha;
      // smooth toward target; dt makes it consistent across devices
      s = s + d * (1 - Math.pow(1 - a, dt * 60));
      S.shown = clamp(s, 0, 100);
      S.dirty = true;
    }

    // Update DOM only if needed (reduce layout cost)
    if (S.bar) S.bar.style.width = (S.shown).toFixed(0) + '%';
    if (S.pct) S.pct.textContent = String(Math.round(S.shown));

    const z = zoneFrom(S.shown);
    if (S.zone) S.zone.textContent = z;
    if (z !== S.lastZone) {
      S.lastZone = z;
      setBodyZoneClass(z);
    }

    // Continue RAF if still moving
    if (S.dirty) {
      S.raf = requestAnimationFrame(paint);
    } else {
      S.raf = 0;
    }
  }

  function ensureRAF() {
    if (S.raf) return;
    S.lastPaint = 0;
    S.raf = requestAnimationFrame(paint);
  }

  function ensureWaterGauge() {
    bind();
    // initial paint (in case engine calls late)
    ensureRAF();
    return true;
  }

  function setWaterGauge(pct) {
    bind();
    const v = clamp(pct, 0, 100);
    S.target = v;

    // If first time or DOM not moving, kick RAF
    ensureRAF();
  }

  // expose
  API.ensureWaterGauge = ensureWaterGauge;
  API.setWaterGauge = setWaterGauge;
  API.zoneFrom = zoneFrom;

  // Also expose named exports for module import style (hydration.safe.js uses import)
  // If loaded as classic script, hydration.safe.js (module) still can import from file path.
  // In that case, we also attach functions to window for safety.
  WIN.ensureWaterGauge = WIN.ensureWaterGauge || ensureWaterGauge;
  WIN.setWaterGauge = WIN.setWaterGauge || setWaterGauge;
  WIN.zoneFrom = WIN.zoneFrom || zoneFrom;

})(typeof window !== 'undefined' ? window : globalThis);


// --- ESM named exports support (for type=module importers) ---
export function ensureWaterGauge(){ return (window.ensureWaterGauge && window.ensureWaterGauge()) || true; }
export function setWaterGauge(pct){ if(window.setWaterGauge) window.setWaterGauge(pct); }
export function zoneFrom(pct){
  const fn = window.zoneFrom;
  return fn ? fn(pct) : ((pct<40)?'LOW':(pct>70)?'HIGH':'GREEN');
}