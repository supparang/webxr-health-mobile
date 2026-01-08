// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (shared)
// ✅ ensureWaterGauge(): สร้าง gauge แบบเบา ๆ (ถ้ายังไม่มี) + ไม่บัง VR UI
// ✅ setWaterGauge(pct): sync DOM (#water-pct/#water-bar/#water-zone/#water-tip) + fallback gauge overlay
// ✅ zoneFrom(pct): GREEN / LOW / HIGH (standard)
// ✅ tipFrom(zone, ctx): สร้าง tip สั้น ๆ explainable
//
// Designed to work with your Hydration HTML:
// - #water-bar (width %)
// - #water-pct (number)
// - #water-zone (GREEN/LOW/HIGH)
// - #water-tip (string)
//
// If those elements do not exist, it will create a small overlay gauge (top-right by default).

'use strict';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  // Standard: 45–65 is GREEN
  if (p >= 45 && p <= 65) return 'GREEN';
  return (p < 45) ? 'LOW' : 'HIGH';
}

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch(_){ return def; }
}

function isHydrationPage(){
  // heuristic only; not required
  const t = (DOC && DOC.title) ? DOC.title.toLowerCase() : '';
  return t.includes('hydration');
}

function ensureStyle(){
  if (!DOC || DOC.getElementById('hha-water-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
  .hha-waterGauge{
    position:fixed;
    z-index:60;
    pointer-events:none;
    top: calc(10px + env(safe-area-inset-top, 0px));
    right: calc(10px + env(safe-area-inset-right, 0px));
    width: 210px;
    max-width: min(44vw, 240px);
    border-radius: 16px;
    border: 1px solid rgba(148,163,184,.18);
    background: rgba(2,6,23,.62);
    box-shadow: 0 18px 70px rgba(0,0,0,.42);
    backdrop-filter: blur(10px);
    padding: 10px 10px 9px 10px;
    font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
    color: rgba(229,231,235,.92);
  }
  .hha-waterGauge[hidden]{ display:none !important; }

  .hha-waterTop{
    display:flex; justify-content:space-between; align-items:flex-start; gap:10px;
  }
  .hha-waterTitle{
    font-weight:900; font-size:13px; letter-spacing:.2px;
    margin:0; padding:0;
  }
  .hha-waterZone{
    margin-top:2px;
    font-size:12px;
    color: rgba(148,163,184,.95);
  }
  .hha-waterPct{
    font-weight:900;
    font-size:20px;
    line-height:1;
    text-align:right;
  }
  .hha-waterPct span{
    font-size:12px;
    color: rgba(148,163,184,.95);
    font-weight:800;
  }
  .hha-waterBarWrap{
    margin-top:8px;
    height:10px;
    border-radius:999px;
    background: rgba(148,163,184,.18);
    overflow:hidden;
    border: 1px solid rgba(148,163,184,.12);
  }
  .hha-waterBar{
    height:100%;
    width:50%;
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
    transform-origin:left center;
  }
  .hha-waterTip{
    margin-top:8px;
    font-size:12px;
    line-height:1.25;
    color: rgba(229,231,235,.85);
    white-space:pre-line;
  }

  /* Zone accent */
  .hha-waterGauge[data-zone="GREEN"] .hha-waterBar{
    background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  }
  .hha-waterGauge[data-zone="LOW"] .hha-waterBar{
    background: linear-gradient(90deg, rgba(34,211,238,.95), rgba(56,189,248,.95));
  }
  .hha-waterGauge[data-zone="HIGH"] .hha-waterBar{
    background: linear-gradient(90deg, rgba(245,158,11,.95), rgba(239,68,68,.90));
  }

  /* Keep tiny on very small screens */
  @media (max-width: 420px){
    .hha-waterGauge{ width: 190px; padding: 9px; }
    .hha-waterPct{ font-size:18px; }
  }

  /* If view=cvr, keep it away from center */
  body.view-cvr .hha-waterGauge{
    top: calc(10px + env(safe-area-inset-top, 0px));
    right: calc(10px + env(safe-area-inset-right, 0px));
  }
  `;
  DOC.head.appendChild(st);
}

function ensureOverlayGauge(){
  if (!DOC) return null;
  let el = DOC.getElementById('hha-waterGauge');
  if (el) return el;

  ensureStyle();

  el = DOC.createElement('div');
  el.id = 'hha-waterGauge';
  el.className = 'hha-waterGauge';
  el.setAttribute('data-zone', 'GREEN');
  el.innerHTML = `
    <div class="hha-waterTop">
      <div>
        <div class="hha-waterTitle">Water</div>
        <div class="hha-waterZone">Zone <b class="hha-waterZoneVal">GREEN</b></div>
      </div>
      <div class="hha-waterPct"><b class="hha-waterPctVal">50</b><span>%</span></div>
    </div>
    <div class="hha-waterBarWrap"><div class="hha-waterBar"></div></div>
    <div class="hha-waterTip">Tip: คุมให้อยู่ GREEN</div>
  `;
  DOC.body.appendChild(el);
  return el;
}

function getHydrationDOM(){
  // Prefer the game's built-in panel if present.
  const bar  = DOC.getElementById('water-bar');
  const pct  = DOC.getElementById('water-pct');
  const zone = DOC.getElementById('water-zone');
  const tip  = DOC.getElementById('water-tip');

  const ok = !!(bar || pct || zone || tip);
  return { ok, bar, pct, zone, tip };
}

export function ensureWaterGauge(){
  if (!DOC) return;
  // If hydration panel exists, do nothing; else create overlay gauge.
  const { ok } = getHydrationDOM();
  if (!ok) ensureOverlayGauge();
}

// Explainable short tips (safe generic)
export function tipFrom(zone, ctx = {}){
  const z = String(zone || '').toUpperCase();
  const inStorm = !!ctx.inStorm;
  const inEndWindow = !!ctx.inEndWindow;
  const shield = Number(ctx.shield || 0) || 0;

  if (inEndWindow){
    if (shield > 0) return 'End Window: ใช้ 🛡️ BLOCK ให้คุ้ม (ผ่าน Mini/Boss)';
    return 'End Window: เสี่ยง! รีบเก็บ 🛡️ หรือหลบ 🥤';
  }

  if (inStorm){
    if (z === 'GREEN') return 'Storm: ต้อง LOW/HIGH เพื่อผ่าน Mini (อย่าอยู่ GREEN)';
    if (shield <= 0) return 'Storm: ไม่มี 🛡️ → หลีกเลี่ยง 🥤 แล้วรีบเก็บ 🛡️';
    return 'Storm: LOW/HIGH แล้วรอท้ายพายุค่อย BLOCK';
  }

  if (z === 'GREEN') return 'Tip: คุม GREEN ให้นาน ๆ เพื่อผ่าน Stage1';
  if (z === 'LOW') return 'Tip: น้ำต่ำไป ยิง 💧 เพิ่มเพื่อกลับเข้า GREEN';
  if (z === 'HIGH') return 'Tip: น้ำสูงไป ระวัง 🥤 และคุมกลับเข้า GREEN';
  return 'Tip: คุมให้อยู่ GREEN';
}

export function setWaterGauge(pct, ctx = {}){
  if (!DOC) return;

  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p);

  // 1) Sync hydration panel if present
  const dom = getHydrationDOM();
  if (dom.ok){
    try{
      if (dom.bar)  dom.bar.style.width = p.toFixed(0) + '%';
      if (dom.pct)  dom.pct.textContent = String(p|0);
      if (dom.zone) dom.zone.textContent = z;

      // Tip: only set if element exists; caller can override by setting #water-tip itself.
      if (dom.tip){
        const tip = tipFrom(z, ctx);
        // Respect manual tips if caller sets ctx.tip explicitly
        dom.tip.textContent = String(ctx.tip || tip);
      }
    }catch(_){}
    return;
  }

  // 2) Fallback overlay gauge
  const g = ensureOverlayGauge();
  if (!g) return;

  try{
    g.setAttribute('data-zone', z);

    const pctEl = g.querySelector('.hha-waterPctVal');
    const zoneEl = g.querySelector('.hha-waterZoneVal');
    const barEl = g.querySelector('.hha-waterBar');
    const tipEl = g.querySelector('.hha-waterTip');

    if (pctEl) pctEl.textContent = String(p|0);
    if (zoneEl) zoneEl.textContent = z;
    if (barEl) barEl.style.width = p.toFixed(0) + '%';
    if (tipEl){
      const tip = tipFrom(z, ctx);
      tipEl.textContent = String(ctx.tip || tip);
    }
  }catch(_){}
}

// Optional: convenience helper
export function setWaterZoneByPct(pct, ctx = {}){
  const p = clamp(pct,0,100);
  setWaterGauge(p, ctx);
  return zoneFrom(p);
}