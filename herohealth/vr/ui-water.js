// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION (smooth + robust)
// ✅ ensureWaterGauge(): safe init (no-op if DOM already has elements)
// ✅ setWaterGauge(pct): sets target value (0..100), smooth animate
// ✅ zoneFrom(pct): returns LOW / GREEN / HIGH (for hydration.safe.js)
// ✅ Works with existing DOM:
//    #water-bar (inner fill), #water-pct, #water-zone

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // thresholds (tuneable)
  const CFG = Object.assign({
    greenMin: 45,
    greenMax: 65,
    smooth: true,
    smoothSpeed: 10.5, // higher = faster response
  }, WIN.HHA_WATER_CONFIG || {});

  let target = 50;
  let shown  = 50;
  let rafId  = 0;
  let lastAt = 0;

  function qs(sel){ return DOC.querySelector(sel); }

  function zoneFrom(pct){
    pct = clamp(pct,0,100);
    if (pct < CFG.greenMin) return 'LOW';
    if (pct > CFG.greenMax) return 'HIGH';
    return 'GREEN';
  }

  function apply(val){
    val = clamp(val,0,100);
    const bar = DOC.getElementById('water-bar');
    const pct = DOC.getElementById('water-pct');
    const zone = DOC.getElementById('water-zone');

    // IMPORTANT: update style in a way that forces refresh
    if (bar){
      // width + transform combo avoids some mobile repaint weirdness
      const w = val.toFixed(0) + '%';
      bar.style.width = w;
      bar.style.transform = 'translateZ(0)';
    }
    if (pct) pct.textContent = String(val|0);
    if (zone) zone.textContent = zoneFrom(val);
  }

  function tick(t){
    rafId = 0;
    const now = t || performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - (lastAt||now))/1000));
    lastAt = now;

    const k = clamp(CFG.smoothSpeed, 2.5, 20);
    const a = 1 - Math.exp(-k * dt);  // exp smoothing
    shown = shown + (target - shown) * a;

    // snap if close
    if (Math.abs(target - shown) < 0.15){
      shown = target;
      apply(shown);
      return;
    }

    apply(shown);
    rafId = requestAnimationFrame(tick);
  }

  function ensureWaterGauge(){
    // If HUD already has water panel elements, do nothing.
    // If missing, we can silently skip (hydration.safe.js also updates its own DOM panel).
    // This helper exists to keep API consistent across games.
    return true;
  }

  function setWaterGauge(pct){
    target = clamp(pct,0,100);

    // first call: sync shown to target for stable start
    if (!lastAt && !rafId){
      shown = target;
      apply(shown);
      // still start smooth loop for later changes
      rafId = requestAnimationFrame(tick);
      return;
    }

    // if smoothing disabled, apply immediately
    if (!CFG.smooth){
      shown = target;
      apply(shown);
      return;
    }

    // start RAF if not running
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  // expose globals for module imports
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // also provide GAME_MODULES hook (same style as particles.js)
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.WaterGauge = { ensureWaterGauge, setWaterGauge, zoneFrom };

})();