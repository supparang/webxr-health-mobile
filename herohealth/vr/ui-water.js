// === /herohealth/vr/ui-water.js ===
// Water Gauge Helper — PRODUCTION (LATEST)
// ✅ Works across games (safe no-op if elements missing)
// ✅ Hydration-friendly zone mapping + smooth update
//
// Expected DOM ids (optional):
//   #water-bar   (div) width set to %
//   #water-pct   (span) textContent set to integer
//   #water-zone  (b/span) GREEN/LOW/HIGH
//
// Exports (ESM): ensureWaterGauge, setWaterGauge, zoneFrom
// Also exposes window.HHA_WATER for non-module pages.

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}

let CACHE = null;

// Kids-friendly zones:
// - GREEN กว้างขึ้นนิด เพื่อให้เด็ก “อยู่โซนสำเร็จ” ได้ง่ายขึ้น
// - แต่ยังมี LOW/HIGH ชัดเจนพอให้เกมสอนสมดุล
function zoneFrom(pct){
  const p = clamp(pct,0,100);

  // allow override via query if you want later
  // e.g. ?greenLo=38&greenHi=72
  const gLo = clamp(parseFloat(qs('greenLo', '40')), 0, 100);
  const gHi = clamp(parseFloat(qs('greenHi', '70')), 0, 100);

  if (p < Math.min(gLo,gHi)) return 'LOW';
  if (p > Math.max(gLo,gHi)) return 'HIGH';
  return 'GREEN';
}

function findEls(){
  if (!DOC) return null;
  return {
    bar: DOC.getElementById('water-bar'),
    pct: DOC.getElementById('water-pct'),
    zone: DOC.getElementById('water-zone')
  };
}

function ensureWaterGauge(){
  // cache elements (safe if not present)
  CACHE = findEls();

  // expose small helper for non-module usage
  try{
    WIN.HHA_WATER = WIN.HHA_WATER || {};
    WIN.HHA_WATER.ensure = ensureWaterGauge;
    WIN.HHA_WATER.set = setWaterGauge;
    WIN.HHA_WATER.zoneFrom = zoneFrom;
  }catch(_){}

  return CACHE;
}

// Internal smooth state (to prevent harsh jumps in UI only)
let UI = { last: 50 };

function setWaterGauge(pct){
  const p = clamp(pct, 0, 100);
  if (!CACHE) CACHE = findEls();
  const els = CACHE;
  if (!els) return;

  // UI smoothing: small lerp to reduce flicker, but NOT too much (kids-friendly)
  // If you felt "ขึ้นลงยาก" previously, that was from GAME logic,
  // so here we keep UI smoothing very light.
  const alpha = 0.35; // higher = faster follow
  UI.last = UI.last + (p - UI.last) * alpha;

  const shown = clamp(UI.last, 0, 100);
  const z = zoneFrom(p);

  if (els.bar) els.bar.style.width = `${shown.toFixed(0)}%`;
  if (els.pct) els.pct.textContent = String(p|0);
  if (els.zone) els.zone.textContent = z;

  // Optional: add classes on body for styling if you want (safe)
  try{
    const b = DOC.body;
    if (b){
      b.classList.toggle('water-low', z==='LOW');
      b.classList.toggle('water-green', z==='GREEN');
      b.classList.toggle('water-high', z==='HIGH');
    }
  }catch(_){}
}

export { ensureWaterGauge, setWaterGauge, zoneFrom };