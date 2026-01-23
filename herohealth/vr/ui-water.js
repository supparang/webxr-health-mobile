// === /herohealth/vr/ui-water.js ===
// UI Water Gauge — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): creates gauge overlay if missing (optional)
// ✅ setWaterGauge(pct): hard set (0..100) with smoothing
// ✅ waterNudge(delta, opt): additive change with clamp + smoothing
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
// ✅ Internal physics: inertia + drag + deadzone + gravity drift (prevents "stuck")
// ✅ Kids-friendly defaults (can be tuned via window.HHA_WATER_CONFIG)
// ------------------------------------------------------------

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const lerp  = (a,b,t)=>a + (b-a)*t;

  // ---------- CONFIG ----------
  // You can override before loading:
  // window.HHA_WATER_CONFIG = { smooth:0.18, drag:0.86, gravity:0.12, dead:0.08, maxVel:6.5 }
  const CFG = Object.assign({
    // visual smoothing 0..1 (higher = faster)
    smooth: 0.18,

    // physics: velocity drag 0..1 (lower = stronger drag)
    drag: 0.86,

    // gravity drift towards mid to prevent "stuck"
    gravity: 0.12, // pct per sec pulling toward mid

    // deadzone around target to avoid jitter
    dead: 0.08, // pct threshold

    // max velocity change per frame
    maxVel: 6.5,

    // default mid setpoint
    mid: 55,

    // DOM ids (if you use your own panel)
    ids: {
      bar:  'water-bar',
      pct:  'water-pct',
      zone: 'water-zone'
    }
  }, WIN.HHA_WATER_CONFIG || {});

  // ---------- DOM helpers ----------
  function qs(id){ return DOC.getElementById(id); }

  // If you don't have the panel in HTML, this can create a minimal one.
  function ensureWaterGauge(){
    // only create if not present
    if (qs(CFG.ids.bar) && qs(CFG.ids.pct) && qs(CFG.ids.zone)) return;

    // If user has their own markup, do nothing
    // (we only create if *none* exists)
    const existing = DOC.querySelector('.waterpanel, #hud .waterpanel, #waterpanel');
    if (existing) return;

    const wrap = DOC.createElement('div');
    wrap.className = 'waterpanel';
    wrap.style.cssText = [
      'position:fixed',
      'right:14px',
      'top:calc(64px + env(safe-area-inset-top,0px))',
      'z-index:80',
      'pointer-events:none',
      'border:1px solid rgba(148,163,184,.16)',
      'background:rgba(2,6,23,.48)',
      'backdrop-filter:blur(10px)',
      'border-radius:18px',
      'padding:10px 12px',
      'box-shadow:0 16px 60px rgba(0,0,0,.35)',
      'min-width:160px'
    ].join(';');

    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <div style="font-weight:900;font-size:13px">Water</div>
        <div style="font-size:12px;color:rgba(148,163,184,.95)">Zone: <b id="${CFG.ids.zone}">GREEN</b></div>
      </div>
      <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10)">
        <div id="${CFG.ids.bar}" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));transition:width 120ms linear"></div>
      </div>
      <div style="margin-top:6px;font-weight:900;text-align:right;font-size:12px;color:rgba(229,231,235,.92)">
        <span id="${CFG.ids.pct}">50</span>%
      </div>
    `;
    DOC.body.appendChild(wrap);
  }

  function zoneFrom(pct){
    // GREEN is the healthy band around mid (kids-friendly)
    const p = clamp(pct, 0, 100);
    // band 45..65 (adjust if you want)
    if (p >= 45 && p <= 65) return 'GREEN';
    if (p < 45) return 'LOW';
    return 'HIGH';
  }

  // ---------- STATE ----------
  const ST = {
    // current (display)
    cur: 50,
    // target (requested)
    tgt: 50,
    // velocity (physics)
    vel: 0,
    // last update time
    last: 0,
    // dom cache
    elBar: null,
    elPct: null,
    elZone: null,
    // raf running
    rafOn: false
  };

  function bindEls(){
    ST.elBar  = qs(CFG.ids.bar);
    ST.elPct  = qs(CFG.ids.pct);
    ST.elZone = qs(CFG.ids.zone);
  }

  function syncDOM(){
    if (!ST.elBar || !ST.elPct || !ST.elZone) bindEls();
    const p = clamp(ST.cur, 0, 100);

    if (ST.elBar)  ST.elBar.style.width = (p.toFixed(0) + '%');
    if (ST.elPct)  ST.elPct.textContent = String(p|0);
    if (ST.elZone) ST.elZone.textContent = zoneFrom(p);
  }

  // ---------- PHYSICS LOOP ----------
  function step(t){
    if (!ST.rafOn) return;

    const now = Number(t)||performance.now();
    const dt = ST.last ? Math.min(0.05, Math.max(0.001, (now - ST.last)/1000)) : 0.016;
    ST.last = now;

    // error to target
    const err = (ST.tgt - ST.cur);

    // deadzone to avoid jitter
    let accel = 0;
    if (Math.abs(err) > CFG.dead){
      // proportional accel toward target
      accel = err * 9.0; // responsiveness
    }

    // gravity drift toward mid if "stuck" around a side
    // helps when gameplay stops changing water so it won't feel frozen
    const midErr = (CFG.mid - ST.cur);
    const g = clamp(midErr, -1.0, 1.0) * CFG.gravity; // pct/sec
    // only apply gravity strongly if close to target (not actively changing)
    const nearTarget = Math.abs(err) < 2.0;
    if (nearTarget){
      ST.vel += g;
    }

    // integrate accel
    ST.vel += accel * dt;

    // clamp velocity
    ST.vel = clamp(ST.vel, -CFG.maxVel, CFG.maxVel);

    // apply drag
    ST.vel *= Math.pow(CFG.drag, dt*60);

    // integrate position
    ST.cur = clamp(ST.cur + ST.vel, 0, 100);

    // visual smoothing (cur -> display feels smooth)
    // (we already update cur smoothly; this makes DOM update nicer)
    // no extra state needed, just sync
    syncDOM();

    requestAnimationFrame(step);
  }

  function ensureRAF(){
    if (ST.rafOn) return;
    ST.rafOn = true;
    ST.last = 0;
    requestAnimationFrame(step);
  }

  // ---------- API ----------
  function setWaterGauge(pct){
    ensureWaterGauge();
    bindEls();

    const p = clamp(pct, 0, 100);
    // set target
    ST.tgt = p;

    // if a huge jump, gently pull cur closer so it doesn't feel stuck
    if (Math.abs(ST.cur - ST.tgt) > 25){
      ST.cur = lerp(ST.cur, ST.tgt, 0.35);
      ST.vel *= 0.3;
    }

    ensureRAF();
    syncDOM();
  }

  // additive change with optional easing
  function waterNudge(delta, opt={}){
    ensureWaterGauge();
    bindEls();

    const d = Number(delta)||0;
    const strength = clamp(opt.strength ?? 1.0, 0.1, 3.0);

    // push target
    ST.tgt = clamp(ST.tgt + d*strength, 0, 100);

    // also add a bit of velocity so it "feels" responsive
    ST.vel += clamp(d*0.55, -3.2, 3.2);

    ensureRAF();
    syncDOM();
    return ST.tgt;
  }

  // allow game to query current water quickly
  function getWaterGauge(){
    return { cur: ST.cur, tgt: ST.tgt, zone: zoneFrom(ST.cur) };
  }

  // expose globally (and for ES module import usage, you already do import {..} in safe.js)
  // For module import compatibility: also export named in global object.
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.waterNudge = waterNudge;
  WIN.zoneFrom = zoneFrom;
  WIN.getWaterGauge = getWaterGauge;

  // Also provide CommonJS-ish namespace for clarity
  WIN.HHA_UI_WATER = {
    ensureWaterGauge,
    setWaterGauge,
    waterNudge,
    zoneFrom,
    getWaterGauge
  };

})();