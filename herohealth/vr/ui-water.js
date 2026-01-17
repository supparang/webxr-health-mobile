// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — ESM (Cross-game)
// ✅ ensureWaterGauge(): creates small corner gauge (non-intrusive)
// ✅ setWaterGauge(pct): update
// ✅ zoneFrom(pct): LOW/GREEN/HIGH (default thresholds tuned for kids-safe feel)

'use strict';

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // โซน GREEN กว้างหน่อยสำหรับ ป.5
  if (p < 40) return 'LOW';
  if (p > 70) return 'HIGH';
  return 'GREEN';
}

export function ensureWaterGauge(){
  const d = document;
  if (!d || d.getElementById('hha-waterg')) return;

  const wrap = d.createElement('div');
  wrap.id = 'hha-waterg';
  wrap.style.cssText = `
    position:fixed;
    left: calc(10px + env(safe-area-inset-left, 0px));
    bottom: calc(10px + env(safe-area-inset-bottom, 0px));
    z-index: 95;
    pointer-events:none;
    display:flex; align-items:center; gap:8px;
    font: 800 12px/1 system-ui,-apple-system,Segoe UI,Roboto,Arial;
    color: rgba(229,231,235,.92);
    padding: 8px 10px;
    border-radius: 999px;
    border: 1px solid rgba(148,163,184,.16);
    background: rgba(2,6,23,.55);
    backdrop-filter: blur(10px);
    box-shadow: 0 16px 60px rgba(0,0,0,.35);
  `;

  const label = d.createElement('span');
  label.textContent = 'Water Gauge';

  const pct = d.createElement('span');
  pct.id = 'hha-waterg-pct';
  pct.textContent = '50%';
  pct.style.cssText = `font-weight:950; margin-left:6px;`;

  const bar = d.createElement('div');
  bar.style.cssText = `
    width: 120px; height: 8px; border-radius:999px; overflow:hidden;
    background: rgba(148,163,184,.18);
    border: 1px solid rgba(148,163,184,.10);
  `;

  const fill = d.createElement('div');
  fill.id = 'hha-waterg-fill';
  fill.style.cssText = `
    height:100%;
    width:50%;
    border-radius:999px;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  `;
  bar.appendChild(fill);

  wrap.appendChild(label);
  wrap.appendChild(bar);
  wrap.appendChild(pct);
  d.body.appendChild(wrap);
}

export function setWaterGauge(pct){
  const d = document;
  const p = clamp(pct,0,100);
  const fill = d.getElementById('hha-waterg-fill');
  const t = d.getElementById('hha-waterg-pct');
  if (fill) fill.style.width = p.toFixed(0)+'%';
  if (t) t.textContent = p.toFixed(0)+'%';
}