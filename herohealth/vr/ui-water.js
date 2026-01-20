// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): makes a small fixed HUD gauge if missing (optional)
// ✅ setWaterGauge(pct, opts?): smooth animate to pct
// ✅ zoneFrom(pct): LOW/GREEN/HIGH
// ✅ Fix: "stuck gauge" by forcing style update + rAF commit
// ✅ Kids-friendly smoothing defaults (can override via URL)
// URL params (optional):
//   ?waterSmooth=0.16   (0.05..0.5) higher=faster response
//   ?waterDead=0.35     (0..2) deadzone in pct
//   ?waterEase=1        enable smooth anim (default 1)
//   ?waterUI=1          auto create gauge if missing (default 0; hydration already has panel)

(function(root){
  'use strict';
  const WIN = root;
  const DOC = WIN.document;
  if(!DOC) return;

  // expose modules
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  if (WIN.GAME_MODULES.UIWater) return;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // ---- config (tunable) ----
  const CFG = {
    enabled: String(qs('waterEase','1')).toLowerCase() !== '0',
    smooth: clamp(parseFloat(qs('waterSmooth','0.16')), 0.05, 0.50),
    dead: clamp(parseFloat(qs('waterDead','0.35')), 0.0, 2.0),
    autoUI: String(qs('waterUI','0')).toLowerCase() === '1'
  };

  // ---- zone helper ----
  function zoneFrom(pct){
    pct = clamp(pct, 0, 100);
    // keep GREEN wide for kids (feels fair)
    if (pct < 42) return 'LOW';
    if (pct > 68) return 'HIGH';
    return 'GREEN';
  }

  // ---- UI creation (optional) ----
  function ensureWaterGauge(){
    // Hydration has its own panel, so this is optional.
    if (!CFG.autoUI) return false;

    if (DOC.getElementById('hha-water-gauge')) return true;

    const wrap = DOC.createElement('div');
    wrap.id = 'hha-water-gauge';
    wrap.style.cssText = `
      position:fixed;
      right: calc(12px + env(safe-area-inset-right,0px));
      bottom: calc(12px + env(safe-area-inset-bottom,0px));
      z-index: 80;
      pointer-events:none;
      width: 160px;
      border-radius: 16px;
      border: 1px solid rgba(148,163,184,.16);
      background: rgba(2,6,23,.55);
      backdrop-filter: blur(10px);
      box-shadow: 0 16px 60px rgba(0,0,0,.35);
      padding: 10px;
      color: rgba(229,231,235,.92);
      font: 900 12px/1.2 system-ui;
    `;
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <div>Water</div>
        <div style="color:rgba(148,163,184,.95)">Zone: <b id="hha-water-zone">GREEN</b></div>
      </div>
      <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10)">
        <div id="hha-water-fill" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
      </div>
      <div style="margin-top:6px;text-align:right"><span id="hha-water-pct">50</span>%</div>
    `;
    DOC.body.appendChild(wrap);
    return true;
  }

  // ---- internal state ----
  const S = {
    target: 50,
    shown: 50,
    lastCommit: -999,
    raf: 0
  };

  function getDomRefs(){
    // Prefer hydration's panel IDs if present:
    const bar  = DOC.getElementById('water-bar') || DOC.getElementById('hha-water-fill');
    const pct  = DOC.getElementById('water-pct') || DOC.getElementById('hha-water-pct');
    const zone = DOC.getElementById('water-zone')|| DOC.getElementById('hha-water-zone');
    return { bar, pct, zone };
  }

  function commit(pct){
    const { bar, pct:elPct, zone:elZone } = getDomRefs();

    const p = clamp(pct, 0, 100);
    const z = zoneFrom(p);

    // IMPORTANT: force style update to avoid "stuck" look on some browsers
    // (especially when many DOM updates happen per frame)
    if (bar){
      bar.style.width = p.toFixed(0) + '%';
      // force repaint nudge
      bar.style.transform = 'translateZ(0)';
    }
    if (elPct) elPct.textContent = String(p|0);
    if (elZone) elZone.textContent = z;

    S.lastCommit = performance.now ? performance.now() : Date.now();
  }

  function tick(){
    S.raf = 0;

    // if smoothing disabled: commit immediately
    if (!CFG.enabled){
      S.shown = S.target;
      commit(S.shown);
      return;
    }

    // smooth toward target
    const d = (S.target - S.shown);

    // deadzone: prevent tiny jitter that looks like "stuck"
    if (Math.abs(d) <= CFG.dead){
      S.shown = S.target;
      commit(S.shown);
      return;
    }

    // exponential smoothing (feels "นิ่ม")
    S.shown += d * CFG.smooth;

    // clamp and commit
    S.shown = clamp(S.shown, 0, 100);

    // commit now + one more commit next frame (anti-stuck trick)
    commit(S.shown);

    // keep animating until close
    if (Math.abs(S.target - S.shown) > CFG.dead){
      S.raf = requestAnimationFrame(tick);
    }
  }

  // Public API
  function setWaterGauge(pct){
    S.target = clamp(pct, 0, 100);

    // Make sure UI exists if autoUI requested
    ensureWaterGauge();

    // Schedule animation commit
    if (S.raf) return;
    // commit in next frame so layout is ready (prevents "ไม่ลดเลย" illusion)
    S.raf = requestAnimationFrame(tick);
  }

  // export
  const API = { ensureWaterGauge, setWaterGauge, zoneFrom, _cfg:CFG };
  WIN.GAME_MODULES.UIWater = API;

  // also support named imports pattern used in hydration.safe.js
  // (works when bundled via module wrapper; in plain script, hydration imports won't use this)
  WIN.ensureWaterGauge = WIN.ensureWaterGauge || ensureWaterGauge;
  WIN.setWaterGauge = WIN.setWaterGauge || setWaterGauge;
  WIN.zoneFrom = WIN.zoneFrom || zoneFrom;

})(window);