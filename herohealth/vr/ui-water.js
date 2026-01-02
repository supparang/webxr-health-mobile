// === /herohealth/vr/ui-water.js ===
// HeroHealth Water UI — PRODUCTION
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
// ✅ ensureWaterGauge(): inject minimal gauge if page doesn't have water panel
// ✅ setWaterGauge(pct): update DOM ids (water-bar/water-pct/water-zone) + CSS vars

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

// Zone thresholds (ปรับได้ แต่ค่าชุดนี้เล่นแล้วรู้สึกชัด)
// GREEN = balanced range
export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  if (p < 38) return 'LOW';
  if (p > 72) return 'HIGH';
  return 'GREEN';
}

function setText(id, v){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(v);
}

function ensureStylesOnce(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
    .hha-water-fallback{
      position:fixed;
      right:12px;
      bottom:12px;
      z-index:999;
      pointer-events:none;
      width:min(280px, 44vw);
      border-radius:16px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.70);
      backdrop-filter: blur(10px);
      box-shadow: 0 18px 70px rgba(0,0,0,.45);
      padding:10px 12px;
      color:rgba(229,231,235,.92);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;
    }
    .hha-water-fallback .row{ display:flex; justify-content:space-between; gap:10px; align-items:baseline; }
    .hha-water-fallback .ttl{ font-weight:900; font-size:13px; letter-spacing:.2px; }
    .hha-water-fallback .zone{ font-size:12px; color:rgba(148,163,184,.95); }
    .hha-water-fallback .pct{ font-weight:900; font-size:20px; }
    .hha-water-fallback .barWrap{
      margin-top:8px;
      height:9px;
      border-radius:999px;
      overflow:hidden;
      background:rgba(148,163,184,.18);
      border:1px solid rgba(148,163,184,.12);
    }
    .hha-water-fallback .bar{
      height:100%;
      width:50%;
      background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    }
    .hha-water-fallback.low .bar{ background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(56,189,248,.95)); }
    .hha-water-fallback.high .bar{ background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(244,63,94,.95)); }
  `;
  DOC.head.appendChild(st);
}

function hasWaterPanel(){
  return !!(DOC.getElementById('water-bar') || DOC.getElementById('water-zone') || DOC.getElementById('water-pct'));
}

// Inject fallback gauge only when missing (กัน “ไม่เห็นอะไรเลย” ในหน้าเก่า)
export function ensureWaterGauge(){
  if (!DOC) return;
  if (hasWaterPanel()) return;

  ensureStylesOnce();

  if (DOC.querySelector('.hha-water-fallback')) return;
  const box = DOC.createElement('div');
  box.className = 'hha-water-fallback';
  box.innerHTML = `
    <div class="row">
      <div>
        <div class="ttl">Water</div>
        <div class="zone">Zone <b id="water-zone">GREEN</b></div>
      </div>
      <div class="pct"><span id="water-pct">50</span>%</div>
    </div>
    <div class="barWrap"><div id="water-bar" class="bar"></div></div>
  `;
  DOC.body.appendChild(box);
}

export function setWaterGauge(pct){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const zone = zoneFrom(p);

  // Update DOM ids if present
  const bar = DOC.getElementById('water-bar');
  if (bar) bar.style.width = p.toFixed(0) + '%';
  setText('water-pct', p.toFixed(0));
  setText('water-zone', zone);

  // CSS vars (เผื่อบางหน้าใช้)
  try{
    DOC.documentElement.style.setProperty('--hha-water', String(p));
    DOC.documentElement.style.setProperty('--hha-water-zone', zone);
  }catch(_){}

  // If fallback box exists, tint by zone
  const fb = DOC.querySelector('.hha-water-fallback');
  if (fb){
    fb.classList.toggle('low', zone==='LOW');
    fb.classList.toggle('high', zone==='HIGH');
  }
}