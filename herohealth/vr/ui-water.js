// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION (LATEST, kids-friendly)
// ✅ ensureWaterGauge(): build minimal gauge if page doesn't have it
// ✅ setWaterGauge(pct): sets target water% and animates smoothly
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ Smoothing: animated display value (prevents jumpy feel)
// ✅ Deadzone + micro-nudge: prevents "stuck looking" gauge near center
//
// Usage (in hydration.safe.js):
//   import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
//   ensureWaterGauge();
//   setWaterGauge(S.waterPct);

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // เด็ก ป.5: โซน GREEN กว้างขึ้นนิด ให้รู้สึกสบาย
  const kidsQ = String(qs('kids','0')).toLowerCase();
  const KIDS = (kidsQ==='1'||kidsQ==='true'||kidsQ==='yes');

  // default: 40-70, kids: 38-72
  const lo = KIDS ? 38 : 40;
  const hi = KIDS ? 72 : 70;

  if (p < lo) return 'LOW';
  if (p > hi) return 'HIGH';
  return 'GREEN';
}

function ensureNode(id, tag='div'){
  let el = DOC.getElementById(id);
  if (el) return el;
  el = DOC.createElement(tag);
  el.id = id;
  return el;
}

// Internal state for smoothing
const W = {
  inited:false,
  target:50,
  shown:50,
  lastShownInt:50,
  raf:0,
  lastT:0,

  // tuning
  smooth:0.14,       // higher = faster response (0.12-0.18 sweet)
  maxStepPerFrame:2.8,
  minVisibleStep:0.35, // micro movement so it never "looks stuck"
};

function getKids(){
  const kidsQ = String(qs('kids','0')).toLowerCase();
  return (kidsQ==='1'||kidsQ==='true'||kidsQ==='yes');
}

function applyDOM(pShown){
  // Prefer IDs that hydration-vr.html already has:
  const fill = DOC.getElementById('water-bar');  // in your CSS it is .wfill
  const pctEl = DOC.getElementById('water-pct');
  const zoneEl = DOC.getElementById('water-zone');

  if (fill) fill.style.width = `${clamp(pShown,0,100).toFixed(1)}%`;
  if (pctEl) pctEl.textContent = String(Math.round(clamp(pShown,0,100)));

  const z = zoneFrom(pShown);
  if (zoneEl) zoneEl.textContent = z;
}

function tick(t){
  if (!W.raf) return;
  if (!W.lastT) W.lastT = t;
  const dt = Math.min(0.05, Math.max(0.001, (t - W.lastT)/1000));
  W.lastT = t;

  const tgt = W.target;
  let cur = W.shown;

  // Easing toward target
  let diff = (tgt - cur);

  // Deadzone near target: but keep subtle motion for “ไม่ดูค้าง”
  const dead = getKids() ? 0.55 : 0.75;
  if (Math.abs(diff) < dead){
    // micro nudge to show life when integer display hasn't changed
    const curInt = Math.round(cur);
    if (curInt === W.lastShownInt){
      const micro = Math.sign(diff || 1) * W.minVisibleStep * (getKids()?1.05:1.0);
      cur += micro;
    } else {
      // snap if already visually updated
      cur = tgt;
    }
  } else {
    // normal smooth follow
    const k = W.smooth;
    let step = diff * (1 - Math.pow(1-k, dt*60));
    // clamp per frame step
    const lim = W.maxStepPerFrame * (getKids()?1.2:1.0);
    step = clamp(step, -lim, lim);
    cur += step;
  }

  cur = clamp(cur,0,100);
  W.shown = cur;

  const shownInt = Math.round(cur);
  W.lastShownInt = shownInt;
  applyDOM(cur);

  // stop if close enough
  if (Math.abs(W.target - W.shown) < 0.35){
    // keep a tiny tail only if it still looks frozen
    if (Math.round(W.shown) === Math.round(W.target)){
      W.raf = requestAnimationFrame(tick);
      return;
    }
    cancelAnimationFrame(W.raf);
    W.raf = 0;
    W.lastT = 0;
  } else {
    W.raf = requestAnimationFrame(tick);
  }
}

export function ensureWaterGauge(){
  if (!DOC || W.inited) return;
  W.inited = true;

  // If page already has the panel (#water-bar/#water-pct/#water-zone), do nothing.
  // But we still initialize smoothing state.
  const has = DOC.getElementById('water-bar') && DOC.getElementById('water-pct') && DOC.getElementById('water-zone');
  if (has) return;

  // Minimal fallback gauge (rare): attach to body
  const wrap = ensureNode('hhaWaterMini','div');
  wrap.style.cssText = `
    position:fixed; right:12px; top:calc(12px + env(safe-area-inset-top,0px));
    z-index:95; pointer-events:none;
    width:160px; padding:10px 12px; border-radius:16px;
    border:1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.55);
    color:#e5e7eb; font: 700 12px/1.2 system-ui;
    backdrop-filter: blur(10px);
  `;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline;">
      <div>Water</div>
      <div>Zone: <b id="water-zone">GREEN</b></div>
    </div>
    <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;
      background: rgba(148,163,184,.18); border:1px solid rgba(148,163,184,.10);">
      <div id="water-bar" style="height:100%;width:50%;border-radius:999px;
        background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));"></div>
    </div>
    <div style="margin-top:6px;text-align:right;font-weight:900;">
      <span id="water-pct">50</span>%
    </div>
  `;
  DOC.body.appendChild(wrap);
}

export function setWaterGauge(pct){
  const p = clamp(pct,0,100);

  // If user calls without ensureWaterGauge, try anyway:
  if (!W.inited) ensureWaterGauge();

  // update target and start anim if not running
  W.target = p;

  // Hard snap on first call
  if (!W.raf && Math.abs(W.shown - p) > 18){
    W.shown = p;
    W.lastShownInt = Math.round(p);
    applyDOM(p);
  }

  if (!W.raf){
    W.raf = requestAnimationFrame(tick);
  }
}