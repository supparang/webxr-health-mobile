// === /herohealth/vr/ui-water.js ===
// UI Water Gauge — PRODUCTION (LATEST)
// ✅ ESM exports: ensureWaterGauge, setWaterGauge, zoneFrom, getWaterCfg
// ✅ Smooth + responsive display (no "stuck" feeling)
// ✅ Kids-friendly tuning: ?kids=1 widens GREEN + faster UI response
// ✅ Hydration-specific: ?waterGame=hydration (auto) + per-game overrides
// ✅ Optional drift helper (UI only) available via setWaterGauge(...,{drift:true})
//
// IMPORTANT:
// - This file is an ES module (used by hydration.safe.js import).
// - If you include it via <script>, use type="module" or remove the tag.

// -------------------------------------------------------
'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
const qbool = (k, def=false)=>{
  const v = String(qs(k, def ? '1':'0')).toLowerCase();
  return (v==='1'||v==='true'||v==='yes'||v==='on');
};
const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

// -------------------- Config --------------------
export function getWaterCfg(opts = {}){
  // Detect kids
  const kids = qbool('kids', !!opts.kids);

  // detect which game is driving gauge (optional)
  const gameQ = String(qs('waterGame', opts.game || opts.gameMode || '')).toLowerCase();
  const game = gameQ || (String(opts.game||'') || '').toLowerCase();

  // Default zone thresholds
  // Kids-friendly => wider GREEN for less frustration
  let lowMax  = kids ? 38 : 40;  // <= lowMax => LOW
  let highMin = kids ? 72 : 70;  // >= highMin => HIGH
  // If hydration, slightly wider green (more forgiving)
  if (game === 'hydration'){
    lowMax  = kids ? 36 : 38;
    highMin = kids ? 74 : 72;
  }

  // UI smoothing: higher = snappier
  let uiFollow = kids ? 0.28 : 0.22;   // lerp alpha per frame-ish
  // If hydration: feel more direct (bar follows quicker)
  if (game === 'hydration') uiFollow = kids ? 0.32 : 0.26;

  // Max lag safety: if UI is far from target, catch up
  const snapGap = kids ? 14 : 18;

  // Optional: allow user to tune
  const lowQ = qs('waterLow', null);
  const highQ = qs('waterHigh', null);
  if (lowQ != null) lowMax = clamp(parseFloat(lowQ), 5, 60);
  if (highQ != null) highMin = clamp(parseFloat(highQ), 40, 95);

  const followQ = qs('waterFollow', null);
  if (followQ != null) uiFollow = clamp(parseFloat(followQ), 0.08, 0.55);

  return {
    kids,
    game,
    lowMax,
    highMin,
    uiFollow,
    snapGap,
  };
}

export function zoneFrom(pct, cfg){
  const C = cfg || getWaterCfg();
  const p = clamp(pct, 0, 100);
  if (p <= C.lowMax) return 'LOW';
  if (p >= C.highMin) return 'HIGH';
  return 'GREEN';
}

// -------------------- DOM binding --------------------
const UI = {
  ready:false,
  // elements
  bar:null,
  pct:null,
  zone:null,
  // internal state
  target:50,
  shown:50,
  lastAt:0,
  raf:0,
  cfg:getWaterCfg({}),
  // optional drift mode (UI-only)
  driftOn:false,
  driftPerSec:0,
};

function bindExisting(){
  if (!DOC) return false;
  UI.bar  = DOC.getElementById('water-bar');
  UI.pct  = DOC.getElementById('water-pct');
  UI.zone = DOC.getElementById('water-zone');
  return !!(UI.bar || UI.pct || UI.zone);
}

function makeFallbackPanel(){
  // If a game forgets to add waterpanel, create a tiny HUD widget.
  if (!DOC) return false;
  if (DOC.getElementById('hha-water-mini')) return true;

  const wrap = DOC.createElement('div');
  wrap.id = 'hha-water-mini';
  wrap.style.cssText = `
    position:fixed; z-index:70;
    right: calc(10px + env(safe-area-inset-right,0px));
    top:   calc(120px + env(safe-area-inset-top,0px));
    width: 160px;
    pointer-events:none;
    border:1px solid rgba(148,163,184,.16);
    background: rgba(2,6,23,.48);
    backdrop-filter: blur(10px);
    border-radius: 18px;
    padding: 10px 12px;
    box-shadow: 0 16px 60px rgba(0,0,0,.35);
    font: 900 12px/1.2 system-ui;
    color: rgba(229,231,235,.92);
  `;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
      <div style="font-weight:950">Water</div>
      <div style="color:rgba(148,163,184,.95)">Zone: <b id="water-zone">GREEN</b></div>
    </div>
    <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10)">
      <div id="water-bar" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
    </div>
    <div style="margin-top:6px;text-align:right"><span id="water-pct">50</span>%</div>
  `;
  DOC.body.appendChild(wrap);
  return true;
}

function syncImmediate(){
  const p = clamp(UI.shown, 0, 100);
  if (UI.bar) UI.bar.style.width = p.toFixed(0) + '%';
  if (UI.pct) UI.pct.textContent = String(p|0);

  const z = zoneFrom(p, UI.cfg);
  if (UI.zone) UI.zone.textContent = z;
}

function frame(t){
  UI.raf = 0;
  if (!DOC) return;

  const dt = UI.lastAt ? Math.min(0.05, Math.max(0.001, (t - UI.lastAt)/1000)) : 0.016;
  UI.lastAt = t;

  // optional UI-only drift (mostly for demos; real "dehydration" should be in hydration.safe.js)
  if (UI.driftOn && UI.driftPerSec > 0){
    UI.target = clamp(UI.target - UI.driftPerSec*dt, 0, 100);
  }

  const gap = Math.abs(UI.target - UI.shown);

  // snap if too far (prevents "ไม่ลดลงไปอีกเลย" feeling from heavy smoothing)
  if (gap >= UI.cfg.snapGap){
    UI.shown = UI.shown + (UI.target - UI.shown) * Math.min(0.55, UI.cfg.uiFollow*2.2);
  } else {
    UI.shown = UI.shown + (UI.target - UI.shown) * UI.cfg.uiFollow;
  }

  // micro snap near target
  if (Math.abs(UI.target - UI.shown) < 0.35) UI.shown = UI.target;

  syncImmediate();

  // keep running while not exactly at target or drift on
  if (UI.driftOn || Math.abs(UI.target - UI.shown) > 0.01){
    UI.raf = WIN.requestAnimationFrame(frame);
  }
}

// -------------------- Public API --------------------
export function ensureWaterGauge(opts = {}){
  if (!DOC) return;

  UI.cfg = getWaterCfg(opts);

  // try bind existing
  const ok = bindExisting();
  if (!ok) makeFallbackPanel();
  bindExisting();

  UI.ready = true;

  // initialize once
  if (!Number.isFinite(UI.target)) UI.target = 50;
  if (!Number.isFinite(UI.shown)) UI.shown = UI.target;

  syncImmediate();
}

export function setWaterGauge(pct, opts = {}){
  if (!DOC) return;

  if (!UI.ready) ensureWaterGauge(opts);

  // refresh cfg if caller provides opts (e.g. hydration)
  UI.cfg = getWaterCfg(Object.assign({}, { game: opts.game || opts.gameMode }, opts));

  // set target
  UI.target = clamp(pct, 0, 100);

  // Optional: allow UI-only drift if someone wants it
  // (Again: real game drift should be in hydration.safe.js, see patch below)
  if (opts && opts.drift){
    UI.driftOn = true;
    UI.driftPerSec = clamp(opts.driftPerSec ?? 0, 0, 30);
  }

  // start animation loop if needed
  if (!UI.raf){
    UI.raf = WIN.requestAnimationFrame(frame);
  }
}