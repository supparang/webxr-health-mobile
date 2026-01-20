// === /herohealth/vr/ui-water.js ===
// HHA UI Water Gauge — PRODUCTION (Hydration-tuned)
// ✅ ensureWaterGauge(): no-op if game has its own panel (kept for compatibility)
// ✅ setWaterGauge(pct): updates HUD panel + optional internal smoothing target
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
//
// ✅ NEW (Hydration only):
//    waterTick(dtSec): auto-drain + gentle recenter (kids-friendly, smooth)
//    waterSetTuning(opts): override tuning per game
//
// URL controls (optional):
//   ?kids=1                -> easier control, softer drain
//   ?run=research|study    -> auto-drain OFF by default (deterministic)
//   ?waterDrain=0          -> force drain off
//   ?waterDrain=0.20       -> drain rate %/sec
//   ?waterSmooth=0.18      -> smoothing 0..1 (higher = faster follow)
//   ?waterRecenter=0.06    -> pull toward mid when idle (0..0.2)
//   ?waterMid=55           -> mid point
//
// Notes:
// - Engine (hydration.safe.js) owns the "true" S.waterPct.
// - This module helps UI feel: smoothing + gentle auto-drain (only if enabled).
// - If you don't want any behavior change, simply never call waterTick().

(function(root){
  'use strict';
  const WIN = root || window;
  const DOC = WIN.document;
  if(!DOC || WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---- Zone thresholds (simple + stable for kids) ----
  // GREEN band around mid: 45..65 by default
  function zoneFrom(pct){
    const p = clamp(pct,0,100);
    const mid = clamp(parseFloat(qs('waterMid', 55)), 40, 60);
    const band = clamp(parseFloat(qs('waterBand', 10)), 6, 16); // +/- band
    const lo = mid - band;
    const hi = mid + band;
    if (p < lo) return 'LOW';
    if (p > hi) return 'HIGH';
    return 'GREEN';
  }

  // ---- DOM bindings (optional panel already in hydration-vr.html) ----
  function ensureWaterGauge(){
    // Kept for compatibility; hydration-vr.html already has:
    // #water-bar, #water-pct, #water-zone
    return true;
  }

  function setPanel(pct){
    const bar = DOC.getElementById('water-bar');
    const pctEl = DOC.getElementById('water-pct');
    const zoneEl = DOC.getElementById('water-zone');

    if (bar) bar.style.width = clamp(pct,0,100).toFixed(0)+'%';
    if (pctEl) pctEl.textContent = String(clamp(pct,0,100)|0);
    if (zoneEl) zoneEl.textContent = zoneFrom(pct);
  }

  // ---- Internal smoothing (UI only) ----
  const STATE = {
    uiPct: 50,
    targetPct: 50,

    // tuning (defaults)
    mid: 55,
    smooth: 0.18,       // how fast ui follows target (0..1)
    drainOn: true,
    drainRate: 0.22,    // % per second toward "down" (gentle)
    recenter: 0.055,    // pull toward mid when idle
    freezeInGreen: false,

    // derived flags
    kids: false,
    inResearch: false,
  };

  function readFlags(){
    const kidsQ = String(qs('kids','0')).toLowerCase();
    STATE.kids = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

    const run = String(qs('run', qs('runMode','play')) || 'play').toLowerCase();
    STATE.inResearch = (run==='research' || run==='study');

    // base mid
    STATE.mid = clamp(parseFloat(qs('waterMid', 55)), 40, 60);

    // smooth
    STATE.smooth = clamp(parseFloat(qs('waterSmooth', STATE.kids ? 0.22 : 0.18)), 0.05, 0.60);

    // recenter (kids slightly stronger to feel "easier")
    STATE.recenter = clamp(parseFloat(qs('waterRecenter', STATE.kids ? 0.075 : 0.055)), 0.0, 0.18);

    // drain: OFF by default in research for determinism
    const drainQ = qs('waterDrain', null);
    if (drainQ === null){
      STATE.drainOn = !STATE.inResearch; // default
      STATE.drainRate = STATE.kids ? 0.18 : 0.22;
    } else {
      const s = String(drainQ).toLowerCase();
      if (s==='0' || s==='false' || s==='off') {
        STATE.drainOn = false;
      } else {
        STATE.drainOn = true;
        STATE.drainRate = clamp(parseFloat(drainQ), 0.02, 1.2);
      }
    }

    // optional: if you want GREEN to be "sticky" (not recommended)
    STATE.freezeInGreen = (String(qs('waterFreezeGreen','0')).toLowerCase()==='1');
  }

  readFlags();

  function waterSetTuning(opts={}){
    // allow engine to override without URL
    if (typeof opts.mid === 'number') STATE.mid = clamp(opts.mid, 40, 60);
    if (typeof opts.smooth === 'number') STATE.smooth = clamp(opts.smooth, 0.05, 0.60);
    if (typeof opts.recenter === 'number') STATE.recenter = clamp(opts.recenter, 0.0, 0.18);
    if (typeof opts.drainOn === 'boolean') STATE.drainOn = !!opts.drainOn;
    if (typeof opts.drainRate === 'number') STATE.drainRate = clamp(opts.drainRate, 0.02, 1.2);
    if (typeof opts.freezeInGreen === 'boolean') STATE.freezeInGreen = !!opts.freezeInGreen;
  }

  function setWaterGauge(pct){
    // Engine calls this with the "true" pct.
    const p = clamp(pct,0,100);
    STATE.targetPct = p;

    // Immediate UI update for first paint, then smoothing handles the rest
    if (!Number.isFinite(STATE.uiPct)) STATE.uiPct = p;

    // Keep panel updated with smoothed value (nicer feeling)
    // BUT: for crisp UI you could setPanel(p) — we choose smoothed.
    // We'll set at least once here:
    setPanel(STATE.uiPct);
  }

  function waterTick(dtSec){
    const dt = clamp(dtSec, 0, 0.2);
    if (dt <= 0) return;

    // 1) optional auto-drain (gentle downward) to prevent "stuck at high"
    // This is UI helper only; engine should apply the returned value if desired.
    // To keep backward compatibility: we DO NOT mutate targetPct here.
    // Instead we return a suggested adjustment you can apply in hydration.safe.js.
    //
    // However, for "ไม่ลดลง" symptom, we also expose the suggestedPct.

    let suggested = STATE.targetPct;

    // freeze in GREEN (optional)
    const z = zoneFrom(suggested);
    if (STATE.freezeInGreen && z==='GREEN'){
      // no drain/recenter inside green
    } else {
      if (STATE.drainOn){
        // drain always nudges down a bit (prevents endless climb)
        suggested = clamp(suggested - STATE.drainRate*dt, 0, 100);
      }

      // 2) gentle recenter toward mid (helps kids feel controllable)
      const d = (STATE.mid - suggested);
      suggested = clamp(suggested + d*STATE.recenter*dt*6.0, 0, 100);
    }

    // 3) UI smoothing follow target (but follow suggested, not raw)
    // UI follows suggested so the bar looks alive even if engine updates are discrete.
    STATE.uiPct = clamp(
      STATE.uiPct + (suggested - STATE.uiPct) * (1 - Math.pow(1-STATE.smooth, dt*60)),
      0, 100
    );

    setPanel(STATE.uiPct);

    return { suggestedPct: suggested, uiPct: STATE.uiPct, zone: zoneFrom(STATE.uiPct) };
  }

  // export
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // named exports for module import compatibility
  // (your hydration.safe.js uses: import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
  //  This file is non-module; but you also load it as <script src=... defer>. To support BOTH:
  //  - keep globals above
  //  - also attach to WIN.GAME_MODULES for engines that want it)
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.UIWater = { ensureWaterGauge, setWaterGauge, zoneFrom, waterTick, waterSetTuning };

  // Also attach plain functions
  WIN.waterTick = waterTick;
  WIN.waterSetTuning = waterSetTuning;

})(typeof window !== 'undefined' ? window : globalThis);