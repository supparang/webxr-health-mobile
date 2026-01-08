// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION (shared)
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ ensureWaterGauge(): creates fallback mini gauge if page doesn't provide
// ✅ setWaterGauge(pct): updates both fallback + any known DOM ids if present
//
// Supported DOM ids (optional):
// - #water-bar, #water-pct, #water-zone, #water-tip
//
// Notes: ไม่บังคับ UI ของเกม แต่ช่วยให้ทุกเกมใช้มาตรฐานเดียวกัน

'use strict';

const WIN = window;
const DOC = document;

export function zoneFrom(pct){
  const p = Math.max(0, Math.min(100, Number(pct)||0));
  // ปรับ threshold ได้ถ้าต้องการ
  if (p < 45) return 'LOW';
  if (p > 65) return 'HIGH';
  return 'GREEN';
}

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function qs(sel){ try{ return DOC.querySelector(sel); } catch(_) { return null; } }

let FALLBACK = null;

export function ensureWaterGauge(){
  if (!DOC || FALLBACK) return FALLBACK;

  // ถ้าเกมมี panel ของตัวเองอยู่แล้ว ก็ไม่จำเป็นต้องสร้าง fallback
  const hasNative = DOC.getElementById('water-bar') || DOC.getElementById('water-pct') || DOC.getElementById('water-zone');
  if (hasNative) return null;

  // create fallback mini badge (top-left)
  const wrap = DOC.createElement('div');
  wrap.className = 'hha-water-fallback';
  wrap.style.cssText = `
    position:fixed; left:12px; top:12px; z-index:70;
    padding:10px 12px; border-radius:16px;
    background: rgba(2,6,23,.72);
    border: 1px solid rgba(148,163,184,.18);
    backdrop-filter: blur(10px);
    color:#e5e7eb;
    font: 800 12px/1.2 system-ui;
    pointer-events:none;
    box-shadow: 0 18px 70px rgba(0,0,0,.35);
    min-width: 160px;
  `;
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:baseline;">
      <div>Water</div>
      <div><span class="wPct">50</span><span style="opacity:.75">%</span></div>
    </div>
    <div style="margin-top:6px;opacity:.85">Zone <b class="wZone">GREEN</b></div>
    <div style="margin-top:8px;height:8px;border-radius:999px;background:rgba(148,163,184,.18);overflow:hidden;border:1px solid rgba(148,163,184,.12)">
      <div class="wBar" style="height:100%;width:50%;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
    </div>
  `;
  DOC.body.appendChild(wrap);
  FALLBACK = wrap;
  return FALLBACK;
}

export function setWaterGauge(pct, tipText){
  const p = clamp(pct, 0, 100);
  const zone = zoneFrom(p);

  // update native HUD if present
  const bar = DOC.getElementById('water-bar');
  const pctEl = DOC.getElementById('water-pct');
  const zoneEl = DOC.getElementById('water-zone');
  const tipEl = DOC.getElementById('water-tip');

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pctEl) pctEl.textContent = String(p|0);
  if (zoneEl) zoneEl.textContent = String(zone);

  if (tipEl && typeof tipText === 'string' && tipText.trim()) {
    tipEl.textContent = tipText.trim();
  }

  // update fallback if exists
  if (!FALLBACK) return;
  try{
    const wPct = FALLBACK.querySelector('.wPct');
    const wZone = FALLBACK.querySelector('.wZone');
    const wBar = FALLBACK.querySelector('.wBar');
    if (wPct) wPct.textContent = String(p|0);
    if (wZone) wZone.textContent = zone;
    if (wBar) wBar.style.width = p.toFixed(0) + '%';
  }catch(_){}
}