// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): safe create if missing (optional)
// ✅ setWaterGauge(pct, opts?): smooth/inertia so it "feels" responsive
// ✅ Fix: gauge looks stuck / hard to move (adds visual smoothing + tiny drift)
// ✅ Works across games (Hydration/others), but Hydration is primary consumer
// ✅ zoneFrom(pct): LOW/GREEN/HIGH
//
// Optional URL tuning:
//   ?waterSmooth=0.18     (0.05..0.45) higher = snappier
//   ?waterDrift=0.04      (0..0.20) per second, tiny auto movement
//   ?kids=1               makes it softer + more forgiving by default

(function(root){
  'use strict';

  const WIN = root;
  const DOC = WIN.document;
  if(!DOC) return;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const kidsQ = String(qs('kids','0')).toLowerCase();
  const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

  // --- default tuning (kids friendly) ---
  const smoothBase = clamp(parseFloat(qs('waterSmooth', KIDS ? '0.14' : '0.20')), 0.05, 0.45);
  const driftBase  = clamp(parseFloat(qs('waterDrift',  KIDS ? '0.06' : '0.03')), 0.00, 0.20);

  // Internal state for smoothing
  const S = {
    mounted:false,
    target:50,     // logical percent (from game)
    shown:50,      // what UI currently shows (smoothed)
    v:0,           // velocity for spring-ish smoothing
    lastT:0,
    raf:0,
    smooth:smoothBase,
    drift:driftBase,
    // drift aims gently toward mid so it doesn't feel "stuck"
    driftMid:55
  };

  function zoneFrom(pct){
    pct = clamp(pct,0,100);
    if (pct < 40) return 'LOW';
    if (pct > 70) return 'HIGH';
    return 'GREEN';
  }

  // Ensure minimal gauge exists (optional; your hydration-vr.html already has it)
  function ensureWaterGauge(){
    if (S.mounted) return true;

    const bar = DOC.getElementById('water-bar');
    const pct = DOC.getElementById('water-pct');
    const zone = DOC.getElementById('water-zone');

    if (!bar || !pct || !zone){
      // Create a tiny minimal gauge only if missing
      // (Normally you already have full HUD, so this is fallback-safe.)
      const hud = DOC.getElementById('hud') || DOC.body;
      const wrap = DOC.createElement('div');
      wrap.style.cssText = 'position:fixed;right:12px;top:12px;z-index:80;pointer-events:none;max-width:220px';
      wrap.innerHTML = `
        <div style="border:1px solid rgba(148,163,184,.18);background:rgba(2,6,23,.55);border-radius:14px;padding:10px 12px;backdrop-filter:blur(8px)">
          <div style="display:flex;justify-content:space-between;gap:10px;font:900 12px/1 system-ui;color:rgba(229,231,235,.92)">
            <span>Water</span><span>Zone: <b id="water-zone">GREEN</b></span>
          </div>
          <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10)">
            <div id="water-bar" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
          </div>
          <div style="margin-top:6px;text-align:right;font:900 12px/1 system-ui;color:rgba(229,231,235,.92)">
            <span id="water-pct">50</span>%
          </div>
        </div>
      `;
      hud.appendChild(wrap);
    }

    S.mounted = true;
    startLoop();
    return true;
  }

  function applyUI(p){
    p = clamp(p,0,100);
    const bar = DOC.getElementById('water-bar');
    const pct = DOC.getElementById('water-pct');
    const zone = DOC.getElementById('water-zone');
    if (bar) bar.style.width = p.toFixed(0) + '%';
    if (pct) pct.textContent = String(p|0);
    if (zone) zone.textContent = zoneFrom(p);
  }

  // Simple “spring-ish” smoothing:
  // - makes changes feel responsive (no sudden jumps)
  // - avoids getting visually stuck
  function tick(t){
    if(!S.lastT) S.lastT = t;
    const dt = Math.min(0.05, Math.max(0.001, (t - S.lastT)/1000));
    S.lastT = t;

    // Soft drift toward mid (VERY small)
    if (S.drift > 0){
      const d = (S.driftMid - S.target);
      // drift only when not already close to mid (avoid fighting game)
      if (Math.abs(d) > 8){
        S.target = clamp(S.target + Math.sign(d) * S.drift * 100 * dt, 0, 100);
      }
    }

    // Smoothing factor
    // higher smooth => snappier. For kids we want slightly softer feel.
    const k = S.smooth;

    // Spring toward target
    const a = (S.target - S.shown) * (10 * k);   // acceleration
    S.v = (S.v + a) * (1 - 2.5*dt);              // damp
    S.shown = S.shown + S.v * (60*dt);

    // Clamp
    S.shown = clamp(S.shown, 0, 100);
    applyUI(S.shown);

    S.raf = WIN.requestAnimationFrame(tick);
  }

  function startLoop(){
    if (S.raf) return;
    S.lastT = 0;
    S.raf = WIN.requestAnimationFrame(tick);
  }

  // Public API used by hydration.safe.js:
  // setWaterGauge(pct) or setWaterGauge(pct,{smooth,drift})
  function setWaterGauge(pct, opts){
    ensureWaterGauge();
    S.target = clamp(pct, 0, 100);

    if (opts && typeof opts === 'object'){
      if (opts.smooth != null) S.smooth = clamp(opts.smooth, 0.05, 0.45);
      if (opts.drift != null)  S.drift  = clamp(opts.drift,  0.00, 0.20);
      if (opts.driftMid != null) S.driftMid = clamp(opts.driftMid, 0, 100);
    }

    // immediate UI update for “feels responsive” (small snap)
    // (ไม่กระโดดแรง แต่ให้เด็กเห็นว่ามีผลทันที)
    const snap = KIDS ? 0.22 : 0.30;
    S.shown = S.shown + (S.target - S.shown) * snap;
    applyUI(S.shown);
  }

  // Expose
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // Also expose via GAME_MODULES for convenience (optional)
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.WaterGauge = { ensureWaterGauge, setWaterGauge, zoneFrom };

})(window);