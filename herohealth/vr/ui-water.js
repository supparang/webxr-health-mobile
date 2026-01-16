// === /herohealth/vr/ui-water.js ===
// Water Gauge Helper — PRODUCTION (Hydration tuned, kids-friendly)
//
// ✅ ensureWaterGauge(): สร้าง/ผูก gauge ถ้ายังไม่มี
// ✅ setWaterGauge(pct, opts): อัปเดตค่า gauge แบบ "ลื่น" + deadband รอบ GREEN
// ✅ zoneFrom(pct): ให้โซน LOW / GREEN / HIGH
//
// Why (ทำเพื่ออะไร):
// - แยก logic “แสดงผล gauge” ออกจาก game engine (hydration.safe.js)
// - ทำ smoothing + deadband ให้เด็ก ป.5 รู้สึกคุมง่ายขึ้น
// - รองรับ kids mode (?kids=1) ให้ gauge ขึ้นลง “รู้สึกตอบสนอง” มากขึ้น แต่ยังไม่หลอก/ไม่สั่น

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

const kidsQ = String(qs('kids','0')).toLowerCase();
const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

// -------------------- Zone thresholds --------------------
// Default: GREEN ~ [45..65] (กว้างพอให้เด็ก “จับง่าย”)
// In non-kids you can tighten a bit.
const Z = {
  lowMax:  KIDS ? 44 : 42,
  greenMin:KIDS ? 45 : 43,
  greenMax:KIDS ? 65 : 63,
  highMin: KIDS ? 66 : 64
};

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct <= Z.lowMax) return 'LOW';
  if (pct >= Z.highMin) return 'HIGH';
  return 'GREEN';
}

// -------------------- DOM binding --------------------
function getEls(){
  return {
    bar:  DOC?.getElementById('water-bar') || null,
    pct:  DOC?.getElementById('water-pct') || null,
    zone: DOC?.getElementById('water-zone') || null,
  };
}

export function ensureWaterGauge(){
  // In your hydration-vr.html you already have the elements.
  // This function is defensive + allows reuse in other games later.
  if (!DOC) return false;

  const { bar, pct, zone } = getEls();
  // If missing, do nothing (caller can still use fallback DOM update)
  if (!bar || !pct || !zone) return false;

  // Mark ready
  try{ DOC.documentElement.dataset.hhaWaterGauge = '1'; }catch(_){}
  return true;
}

// -------------------- Smoothing + deadband --------------------
// We want gauge to feel responsive but not jittery.
// - `displayPct` is what we draw (smoothed).
// - `targetPct` is what game sets (raw).
const G = {
  displayPct: 50,
  targetPct: 50,
  lastAt: 0,

  // smoothing factor:
  // kids => more responsive (higher alpha)
  // non-kids => slightly smoother (lower alpha)
  alphaBase: KIDS ? 0.32 : 0.22,

  // deadband around GREEN to reduce “ขึ้นลงยาก/สั่น”
  // This does NOT change game waterPct; only affects displayed gauge easing
  deadband: KIDS ? 2.2 : 1.6,

  // rate limit for big jumps (avoid bar snapping)
  maxStepPerFrame: KIDS ? 3.8 : 3.0
};

function lerp(a,b,t){ return a + (b-a)*t; }

function paint(p){
  const { bar, pct, zone } = getEls();
  if (!bar || !pct || !zone) return;

  const pp = clamp(p, 0, 100);
  bar.style.width = pp.toFixed(0) + '%';
  pct.textContent = String(pp|0);

  const z = zoneFrom(pp);
  zone.textContent = z;

  // optional: subtly hint by bar gradient intensity (no hard colors change requested)
  // We'll keep it simple; the CSS already has a nice gradient.
}

function tick(){
  if (!DOC) return;

  const now = performance.now();
  const dt = Math.min(0.06, Math.max(0.001, (now - (G.lastAt||now))/1000));
  G.lastAt = now;

  // adaptive alpha: when far from target, move faster; near target, move slower
  const dist = Math.abs(G.targetPct - G.displayPct);
  const alpha = clamp(G.alphaBase + (dist > 18 ? 0.10 : dist > 8 ? 0.06 : 0.02), 0.10, 0.52);

  // deadband: if within small range, dampen movement strongly (prevents “สั่น”)
  if (dist <= G.deadband){
    // tiny drift only (keeps it stable)
    G.displayPct = lerp(G.displayPct, G.targetPct, alpha * 0.18);
  } else {
    // move with capped step to avoid snapping
    const next = lerp(G.displayPct, G.targetPct, alpha);
    const step = clamp(next - G.displayPct, -G.maxStepPerFrame, G.maxStepPerFrame);
    G.displayPct = clamp(G.displayPct + step, 0, 100);
  }

  paint(G.displayPct);

  // continue ticking only if still not converged
  if (Math.abs(G.targetPct - G.displayPct) > 0.25){
    requestAnimationFrame(tick);
    return;
  }

  // converge: final paint and stop
  G.displayPct = G.targetPct;
  paint(G.displayPct);
}

// Public setter
// opts:
// - immediate: true => no smoothing (rarely needed)
// - deadband: override deadband
// - alpha: override alphaBase
export function setWaterGauge(pct, opts = {}){
  pct = clamp(pct, 0, 100);
  G.targetPct = pct;

  if (opts && typeof opts.deadband === 'number') G.deadband = clamp(opts.deadband, 0, 6);
  if (opts && typeof opts.alpha === 'number') G.alphaBase = clamp(opts.alpha, 0.05, 0.8);

  if (opts && opts.immediate){
    G.displayPct = pct;
    paint(G.displayPct);
    return;
  }

  // If first call, sync quickly
  if (!G.lastAt){
    G.displayPct = pct;
    paint(G.displayPct);
    G.lastAt = performance.now();
    return;
  }

  // start/continue smoothing loop
  requestAnimationFrame(tick);
}