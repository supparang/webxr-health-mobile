// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (Smooth + Kids-friendly)
// Fixes:
// ✅ Gauge ไม่ค้าง / ลดได้จริง
// ✅ ขึ้น-ลงนิ่ม (display smoothing)
// ✅ Zone stable (ไม่สั่น GREEN/LOW/HIGH)
// ✅ ใช้ได้ทุกเกม แต่ preset สำหรับ Hydration

'use strict';

const WIN = window;
const DOC = document;

if (WIN.__HHA_UI_WATER__) {
  // prevent double load
} else {
  WIN.__HHA_UI_WATER__ = true;
}

/* -------------------------------------------------------
   Internal state
------------------------------------------------------- */
const W = {
  real: 50,        // ค่าจริง (logic)
  shown: 50,       // ค่าที่แสดง (smooth)
  zone: 'GREEN',
  lastUpdate: 0,
  raf: null
};

/* -------------------------------------------------------
   Config (จูนสำหรับ ป.5)
------------------------------------------------------- */
const CFG = {
  // display smoothing
  lerp: 0.18,          // ยิ่งต่ำ = นิ่มขึ้น (0.15–0.25 ดีสุด)
  snapEps: 0.15,       // ใกล้พอแล้วให้ snap

  // zones
  LOW_MAX: 39,
  GREEN_MIN: 40,
  GREEN_MAX: 70,
  HIGH_MIN: 71,

  // safety
  min: 0,
  max: 100
};

/* -------------------------------------------------------
   Helpers
------------------------------------------------------- */
function clamp(v, a, b) {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

export function zoneFrom(pct) {
  if (pct <= CFG.LOW_MAX) return 'LOW';
  if (pct >= CFG.HIGH_MIN) return 'HIGH';
  return 'GREEN';
}

/* -------------------------------------------------------
   DOM ensure
------------------------------------------------------- */
export function ensureWaterGauge() {
  // nothing heavy — DOM already in hydration-vr.html
  // this function exists for API consistency
  return true;
}

/* -------------------------------------------------------
   Core API
------------------------------------------------------- */
export function setWaterGauge(pct) {
  // ✅ จุดสำคัญ: อัปเดต "ค่าจริง" เท่านั้น
  W.real = clamp(pct, CFG.min, CFG.max);
  if (!W.raf) startRAF();
}

export function getWater() {
  return {
    real: W.real,
    shown: W.shown,
    zone: W.zone
  };
}

/* -------------------------------------------------------
   RAF loop (smooth display)
------------------------------------------------------- */
function startRAF() {
  W.raf = requestAnimationFrame(tick);
}

function tick(ts) {
  const dt = ts - (W.lastUpdate || ts);
  W.lastUpdate = ts;

  // smooth interpolate shown -> real
  const d = W.real - W.shown;
  W.shown += d * CFG.lerp;

  if (Math.abs(d) < CFG.snapEps) {
    W.shown = W.real;
  }

  // update zone จากค่าที่แสดง (นิ่งกว่า)
  W.zone = zoneFrom(W.shown);

  syncDOM();

  if (Math.abs(W.real - W.shown) > CFG.snapEps) {
    W.raf = requestAnimationFrame(tick);
  } else {
    W.raf = null;
  }
}

/* -------------------------------------------------------
   DOM sync
------------------------------------------------------- */
function syncDOM() {
  const bar  = DOC.getElementById('water-bar');
  const pct  = DOC.getElementById('water-pct');
  const zone = DOC.getElementById('water-zone');

  if (bar) {
    bar.style.width = clamp(W.shown, 0, 100).toFixed(1) + '%';
  }
  if (pct) {
    pct.textContent = Math.round(W.shown);
  }
  if (zone) {
    zone.textContent = W.zone;
    zone.className = ''; // reset
    zone.classList.add('zone-' + W.zone.toLowerCase());
  }
}

/* -------------------------------------------------------
   Optional helpers (Hydration-friendly)
------------------------------------------------------- */

// ลดน้ำแบบนิ่ม (ใช้ใน Storm / MISS ต่อเนื่อง)
export function drainWaterSoft(amount = 3) {
  setWaterGauge(W.real - Math.abs(amount));
}

// เพิ่มน้ำแบบนิ่ม
export function fillWaterSoft(amount = 3) {
  setWaterGauge(W.real + Math.abs(amount));
}