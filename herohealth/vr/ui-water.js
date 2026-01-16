// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION
// ✅ ensureWaterGauge(): สร้าง/ผูก DOM ของ gauge (ถ้ามีอยู่แล้วจะไม่สร้างซ้ำ)
// ✅ setWaterGauge(pct, opts): ตั้งค่า % แบบลื่น (smooth animation)
// ✅ zoneFrom(pct): LOW / GREEN / HIGH (Hydration-friendly)
// ✅ kids presets A/B/C: ทำให้การขยับเกจ "ชัด + สบายตา" สำหรับเด็ก
// ------------------------------------------------------

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// Hydration zones (match hydration.safe.js)
function zoneFrom(p){
  p = clamp(p,0,100);
  if (p < 40) return 'LOW';
  if (p <= 70) return 'GREEN';
  return 'HIGH';
}

// internal state
const W = {
  mounted:false,
  el:null,
  bar:null,
  labelPct:null,
  labelZone:null,

  cur:55,
  target:55,
  v:0,

  raf:0,
  lastT:0,

  // animation tuning
  // (kids preset will tweak these)
  cfg:{
    speed: 9.5,     // higher = faster response
    damp: 0.86,     // 0..1 , higher = more damping (less overshoot)
    snap: 0.10,     // snap threshold (%)
    maxStep: 22,    // maximum change per second
  },

  preset:''
};

function applyPreset(preset){
  const p = String(preset||'').toUpperCase();
  W.preset = p;

  // Default (adult-ish)
  let cfg = { speed: 9.5, damp: 0.86, snap: 0.10, maxStep: 22 };

  // Kids presets
  // A: easiest & very responsive, minimal bounce
  // B: comfy default (recommended)
  // C: more challenging (slower response)
  if (p === 'A'){
    cfg = { speed: 12.5, damp: 0.90, snap: 0.12, maxStep: 28 };
  } else if (p === 'B'){
    cfg = { speed: 11.0, damp: 0.88, snap: 0.11, maxStep: 26 };
  } else if (p === 'C'){
    cfg = { speed: 9.2, damp: 0.84, snap: 0.10, maxStep: 22 };
  }

  W.cfg = cfg;
}

function ensureStyles(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-water{
    position: fixed;
    right: calc(14px + env(safe-area-inset-right, 0px));
    top: calc(120px + env(safe-area-inset-top, 0px));
    width: 160px;
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.72);
    box-shadow: 0 24px 90px rgba(0,0,0,.45);
    backdrop-filter: blur(10px);
    padding: 10px;
    z-index: 60;
    pointer-events: none;
    color: rgba(229,231,235,.96);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;
  }
  .hha-water .head{
    display:flex; align-items:baseline; justify-content:space-between;
    gap:10px;
    font-weight: 900;
    font-size: 12px;
    opacity: .95;
  }
  .hha-water .meta{
    display:flex; gap:8px; align-items:center;
    margin-top: 6px;
    font-size: 12px;
    color: rgba(148,163,184,.95);
  }
  .hha-water .pill{
    border:1px solid rgba(148,163,184,.16);
    background: rgba(15,23,42,.55);
    border-radius: 999px;
    padding: 2px 8px;
    font-weight: 900;
    color: rgba(229,231,235,.92);
  }
  .hha-water .track{
    margin-top: 8px;
    height: 12px;
    border-radius: 999px;
    background: rgba(15,23,42,.75);
    border: 1px solid rgba(148,163,184,.14);
    overflow: hidden;
  }
  .hha-water .bar{
    height: 100%;
    width: 55%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    transform-origin: left center;
  }
  .hha-water.low .bar{
    background: linear-gradient(90deg, rgba(251,191,36,.95), rgba(239,68,68,.95));
  }
  .hha-water.high .bar{
    background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(59,130,246,.95));
  }

  /* small for mobile */
  @media (max-width: 520px){
    .hha-water{ width: 150px; top: calc(108px + env(safe-area-inset-top,0px)); }
  }

  /* avoid EnterVR overlap */
  body.is-vr .hha-water{ opacity: .88; top: calc(150px + env(safe-area-inset-top,0px)); }
  `;
  DOC.head.appendChild(st);
}

function mount(){
  if (!DOC || W.mounted) return;

  ensureStyles();

  // If hydration already has its own water panel (#water-bar etc.), reuse it (preferred)
  // This module will update those IDs if found.
  const existingBar  = DOC.getElementById('water-bar');
  const existingPct  = DOC.getElementById('water-pct');
  const existingZone = DOC.getElementById('water-zone');

  // If no hydration water panel found, create floating widget
  if (!existingBar || !existingPct || !existingZone){
    const box = DOC.createElement('div');
    box.className = 'hha-water';
    box.id = 'hhaWaterGauge';

    box.innerHTML = `
      <div class="head">
        <div>WATER</div>
        <div class="pill" id="hhaWaterPct">55%</div>
      </div>
      <div class="meta">
        <div class="pill" id="hhaWaterZone">GREEN</div>
        <div style="opacity:.85">balance</div>
      </div>
      <div class="track">
        <div class="bar" id="hhaWaterBar"></div>
      </div>
    `;

    DOC.body.appendChild(box);

    W.el = box;
    W.bar = DOC.getElementById('hhaWaterBar');
    W.labelPct = DOC.getElementById('hhaWaterPct');
    W.labelZone = DOC.getElementById('hhaWaterZone');
  } else {
    // use hydration panel
    W.el = DOC.getElementById('water-panel') || null;
    W.bar = existingBar;
    W.labelPct = existingPct;
    W.labelZone = existingZone;
  }

  W.mounted = true;
}

function paint(){
  const p = clamp(W.cur, 0, 100);
  const z = zoneFrom(p);

  // update bar width
  if (W.bar){
    // bar might be a div used by hydration (width based)
    W.bar.style.width = p.toFixed(0) + '%';
  }

  if (W.labelPct){
    const txt = (W.labelPct.id === 'hhaWaterPct') ? (p.toFixed(0)+'%') : (p.toFixed(0));
    W.labelPct.textContent = txt;
  }

  if (W.labelZone){
    W.labelZone.textContent = z;
  }

  // class reflect zone (if floating gauge)
  if (W.el){
    W.el.classList.toggle('low', z==='LOW');
    W.el.classList.toggle('high', z==='HIGH');
  }
}

function step(t){
  if (!W.lastT) W.lastT = t;
  const dt = Math.min(0.05, Math.max(0.001, (t - W.lastT)/1000));
  W.lastT = t;

  const target = clamp(W.target, 0, 100);
  const cur = clamp(W.cur, 0, 100);

  // second-order-ish smoothing
  const cfg = W.cfg || { speed: 9.5, damp: 0.86, snap: 0.10, maxStep: 22 };
  const err = target - cur;

  // snap near
  if (Math.abs(err) <= cfg.snap){
    W.cur = target;
    W.v = 0;
    paint();
    W.raf = 0;
    return;
  }

  // velocity approach
  const accel = err * cfg.speed;         // toward target
  W.v = (W.v + accel*dt) * cfg.damp;     // damp

  // clamp max delta per second
  const maxDelta = cfg.maxStep * dt;
  const delta = clamp(W.v*dt, -maxDelta, +maxDelta);

  W.cur = clamp(cur + delta, 0, 100);

  paint();
  W.raf = requestAnimationFrame(step);
}

function ensureWaterGauge(opts={}){
  mount();
  if (opts && opts.preset) applyPreset(opts.preset);
  paint();
  return true;
}

function setWaterGauge(pct, opts={}){
  mount();

  // preset change on the fly
  if (opts && opts.preset){
    applyPreset(opts.preset);
  }

  const p = clamp(pct, 0, 100);
  W.target = p;

  // immediate paint option (rare)
  if (opts && opts.immediate){
    W.cur = p;
    W.v = 0;
    paint();
    return;
  }

  // run animator
  if (!W.raf){
    W.lastT = 0;
    W.raf = requestAnimationFrame(step);
  }
}

ROOT.ensureWaterGauge = ensureWaterGauge;
ROOT.setWaterGauge = setWaterGauge;
ROOT.zoneFrom = zoneFrom;

export { ensureWaterGauge, setWaterGauge, zoneFrom };