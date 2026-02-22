// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge UI — PRODUCTION (FINAL B-mode clean / duplicate-safe)
// ✅ ensureWaterGauge(): mount gauge once (idempotent, duplicate-safe)
// ✅ setWaterGauge(pct 0-100): update bar + label + zone
// ✅ zoneFrom(pct): GREEN / LOW / HIGH
// ✅ Reuse existing #hha-water-gauge if present
// ✅ Removes accidental duplicate gauges if any
// ✅ Works as ES module + optional window debug hook
//
// Notes:
// - Designed for HydrationVR but reusable.
// - Safe: never throws, no dependencies.

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v) || 0));

export function zoneFrom(pct){
  pct = clamp(pct, 0, 100);
  if (pct >= 40 && pct <= 70) return 'GREEN';
  if (pct < 40) return 'LOW';
  return 'HIGH';
}

function ensureStyles(){
  if (!DOC) return;
  if (DOC.getElementById('hha-water-style')) return;

  const st = DOC.createElement('style');
  st.id = 'hha-water-style';
  st.textContent = `
/* === HHA Water Gauge (Final) === */
#hha-water-gauge{
  position: fixed;
  left: calc(12px + env(safe-area-inset-left, 0px));
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 60; /* below crosshair (95) & overlay (100), above playfield */
  pointer-events: none;
  font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
  color: rgba(229,231,235,.92);
  filter: drop-shadow(0 14px 34px rgba(0,0,0,.45));
  max-width: calc(100vw - 24px);
}
#hha-water-gauge .card{
  width: min(320px, calc(100vw - 24px));
  border-radius: 18px;
  border: 1px solid rgba(148,163,184,.16);
  background: rgba(2,6,23,.62);
  backdrop-filter: blur(10px);
  padding: 10px 12px;
}
#hha-water-gauge .row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:10px;
}
#hha-water-gauge .title{
  font-weight: 900;
  letter-spacing: .2px;
  font-size: 12px;
  opacity: .95;
}
#hha-water-gauge .pct{
  font-weight: 900;
  font-size: 14px;
  white-space: nowrap;
}
#hha-water-gauge .zone{
  margin-left: 8px;
  font-weight: 900;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(15,23,42,.55);
}
#hha-water-gauge .barWrap{
  margin-top: 8px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148,163,184,.18);
  border: 1px solid rgba(148,163,184,.12);
  overflow: hidden;
}
#hha-water-gauge .bar{
  width: 50%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95));
  transform-origin: left center;
}
#hha-water-gauge .hint{
  margin-top: 8px;
  font-size: 11px;
  line-height: 1.25;
  opacity: .88;
  white-space: pre-line;
}

#hha-water-gauge.low  .zone{ border-color: rgba(245,158,11,.22); background: rgba(245,158,11,.10); }
#hha-water-gauge.high .zone{ border-color: rgba(239,68,68,.22);  background: rgba(239,68,68,.10); }
#hha-water-gauge.green .zone{ border-color: rgba(34,197,94,.22);  background: rgba(34,197,94,.10); }

/* Mobile tighten */
body.view-mobile #hha-water-gauge .card{
  width: min(290px, calc(100vw - 24px));
}

/* Cardboard split => center to avoid left-eye only feeling */
body.cardboard #hha-water-gauge{
  left: 50%;
  transform: translateX(-50%);
}

/* cVR: avoid covering center/bottom controls too much */
body.view-cvr #hha-water-gauge .card{
  width: min(300px, calc(100vw - 24px));
}

/* If some screen is very short, compact a bit */
@media (max-height: 560px){
  #hha-water-gauge .card{ padding: 8px 10px; border-radius: 16px; }
  #hha-water-gauge .hint{ display:none; }
  #hha-water-gauge .barWrap{ margin-top: 6px; }
}
`;
  DOC.head.appendChild(st);
}

function gaugeHTML(){
  return `
    <div class="card" role="status" aria-label="Water gauge">
      <div class="row">
        <div class="title">💧 Water</div>
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="pct"><span id="hha-water-pct">50</span>%</div>
          <div class="zone" id="hha-water-zone">GREEN</div>
        </div>
      </div>
      <div class="barWrap" aria-hidden="true"><div class="bar" id="hha-water-bar"></div></div>
      <div class="hint" id="hha-water-hint">Zone GREEN = สมดุลดี\nLOW/HIGH = ทำ Storm Mini ได้ แต่ระวังโดน BAD</div>
    </div>
  `;
}

function getAllGaugeNodes(){
  if (!DOC) return [];
  // primary id + accidental duplicates with same id or data hook
  const byId = Array.from(DOC.querySelectorAll('#hha-water-gauge'));
  const byData = Array.from(DOC.querySelectorAll('[data-hha-water-gauge="1"]'));
  const seen = new Set();
  const out = [];
  for (const el of [...byId, ...byData]){
    if (!el || seen.has(el)) continue;
    seen.add(el);
    out.push(el);
  }
  return out;
}

function normalizeGaugeRoot(root){
  if (!root || !DOC) return null;
  try{
    root.id = 'hha-water-gauge';
    root.setAttribute('data-hha-water-gauge', '1');
    if (!root.classList.contains('green') &&
        !root.classList.contains('low') &&
        !root.classList.contains('high')){
      root.classList.add('green');
    }

    // if someone created an empty root, fill it
    if (!root.querySelector('#hha-water-pct') || !root.querySelector('#hha-water-zone') || !root.querySelector('#hha-water-bar')){
      root.innerHTML = gaugeHTML();
    }
    return root;
  }catch(_){
    return null;
  }
}

function dedupeGauges(){
  if (!DOC) return null;
  const nodes = getAllGaugeNodes();
  if (!nodes.length) return null;

  // Prefer the first connected visible node in DOM order
  const keep = nodes[0];
  normalizeGaugeRoot(keep);

  for (let i = 1; i < nodes.length; i++){
    const el = nodes[i];
    try{ el.remove(); }catch(_){}
  }
  return keep;
}

export function ensureWaterGauge(){
  try{
    if (!DOC || !DOC.body) return null;

    ensureStyles();

    // Hard dedupe first (important if old page + new module both injected)
    let root = dedupeGauges();
    if (root) return root;

    // Create fresh
    root = DOC.createElement('div');
    root.id = 'hha-water-gauge';
    root.setAttribute('data-hha-water-gauge', '1');
    root.className = 'green';
    root.innerHTML = gaugeHTML();

    DOC.body.appendChild(root);

    // Final sanity dedupe (race-safe)
    root = dedupeGauges() || root;
    return root;
  }catch(_){
    return null;
  }
}

export function setWaterGauge(pct){
  try{
    if (!DOC) return;

    // Ensure exists (safe/idempotent)
    const root = ensureWaterGauge();
    if (!root) return;

    pct = clamp(pct, 0, 100);
    const z = zoneFrom(pct);

    const pctEl  = DOC.getElementById('hha-water-pct');
    const zoneEl = DOC.getElementById('hha-water-zone');
    const barEl  = DOC.getElementById('hha-water-bar');

    if (pctEl)  pctEl.textContent = String(pct | 0);
    if (zoneEl) zoneEl.textContent = z;
    if (barEl)  barEl.style.width = `${pct.toFixed(0)}%`;

    root.classList.remove('low','high','green');
    root.classList.add(z === 'LOW' ? 'low' : z === 'HIGH' ? 'high' : 'green');
  }catch(_){}
}

// Optional helper (useful if future page wants to remove gauge explicitly)
export function removeWaterGauge(){
  try{
    const nodes = getAllGaugeNodes();
    for (const el of nodes){
      try{ el.remove(); }catch(_){}
    }
  }catch(_){}
}

/* window debug hook (best-effort, no duplicate global overwrite issues) */
try{
  WIN.HHA_UI_WATER = Object.assign({}, WIN.HHA_UI_WATER || {}, {
    ensureWaterGauge,
    setWaterGauge,
    zoneFrom,
    removeWaterGauge
  });
}catch(_){}