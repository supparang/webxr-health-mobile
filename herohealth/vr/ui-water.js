// === /herohealth/vr/ui-water.js ===
// Water UI (Gauge + helpers) — PRODUCTION
// Exports: ensureWaterGauge, setWaterGauge, zoneFrom
// ✅ Safe if DOM elements missing
// ✅ Auto-mount gauge into waterPanel if no mount exists
// ✅ Updates: #water-pct, #water-zone, #water-bar (best-effort)
// ✅ zoneFrom: LOW / GREEN / HIGH (configurable thresholds)

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function qs(sel){
  try{ return DOC.querySelector(sel); }catch(_){ return null; }
}
function byId(id){
  try{ return DOC.getElementById(id); }catch(_){ return null; }
}

const DEFAULTS = {
  greenMin: 45,
  greenMax: 65
};

export function zoneFrom(pct, opt){
  const cfg = Object.assign({}, DEFAULTS, opt || {});
  const p = clamp(pct, 0, 100);
  if (p < cfg.greenMin) return 'LOW';
  if (p > cfg.greenMax) return 'HIGH';
  return 'GREEN';
}

const STATE = {
  mounted: false,
  svg: null,
  arc: null,
  dot: null,
  label: null,
  sub: null,
  lastPct: null,
  greenMin: DEFAULTS.greenMin,
  greenMax: DEFAULTS.greenMax
};

function ensureRoot(){
  if (!DOC || !DOC.body) return null;

  // Prefer explicit mount if exists
  let mount = byId('waterGaugeMount');

  // If not found, try to create mount inside the water panel
  if (!mount){
    // Try find water panel by known ids first
    const bar = byId('water-bar');
    const waterPanel = bar ? bar.closest('.waterPanel') : null;

    if (waterPanel){
      mount = DOC.createElement('div');
      mount.id = 'waterGaugeMount';
      mount.style.cssText = 'margin-top:10px; display:flex; justify-content:center; align-items:center;';
      // place after barWrap if possible, else append
      const barWrap = bar.closest('.barWrap');
      if (barWrap && barWrap.parentElement){
        barWrap.parentElement.insertBefore(mount, barWrap.nextSibling);
      } else {
        waterPanel.appendChild(mount);
      }
    } else {
      // Last resort: create a fixed tiny mount (won’t break)
      mount = DOC.createElement('div');
      mount.id = 'waterGaugeMount';
      mount.style.cssText = 'position:fixed; right:12px; bottom:12px; z-index:9999; opacity:.001;';
      DOC.body.appendChild(mount);
    }
  }

  return mount;
}

function buildGauge(mount){
  // Small, readable circular gauge via SVG
  const wrap = DOC.createElement('div');
  wrap.style.cssText = [
    'width:120px',
    'height:120px',
    'display:flex',
    'align-items:center',
    'justify-content:center'
  ].join(';');

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = DOC.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('width', '120');
  svg.setAttribute('height', '120');
  svg.style.overflow = 'visible';

  const bg = DOC.createElementNS(svgNS, 'circle');
  bg.setAttribute('cx', '60');
  bg.setAttribute('cy', '60');
  bg.setAttribute('r', '44');
  bg.setAttribute('fill', 'none');
  bg.setAttribute('stroke', 'rgba(148,163,184,.22)');
  bg.setAttribute('stroke-width', '10');

  const arc = DOC.createElementNS(svgNS, 'circle');
  arc.setAttribute('cx', '60');
  arc.setAttribute('cy', '60');
  arc.setAttribute('r', '44');
  arc.setAttribute('fill', 'none');
  arc.setAttribute('stroke', 'rgba(34,211,238,.95)');
  arc.setAttribute('stroke-width', '10');
  arc.setAttribute('stroke-linecap', 'round');
  arc.setAttribute('transform', 'rotate(-90 60 60)');

  // circumference
  const C = 2 * Math.PI * 44;
  arc.setAttribute('stroke-dasharray', String(C));
  arc.setAttribute('stroke-dashoffset', String(C));

  const dot = DOC.createElementNS(svgNS, 'circle');
  dot.setAttribute('cx', '60');
  dot.setAttribute('cy', '16');
  dot.setAttribute('r', '4');
  dot.setAttribute('fill', 'rgba(229,231,235,.92)');
  dot.setAttribute('opacity', '0.9');

  const gText = DOC.createElement('div');
  gText.style.cssText = [
    'position:absolute',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:2px',
    'transform: translateY(-2px)',
    'text-align:center'
  ].join(';');

  const label = DOC.createElement('div');
  label.style.cssText = 'font-weight:900; font-size:22px; line-height:1;';
  label.textContent = '50%';

  const sub = DOC.createElement('div');
  sub.style.cssText = 'font-size:12px; color:rgba(148,163,184,.95); font-weight:800; letter-spacing:.2px;';
  sub.textContent = 'GREEN';

  svg.appendChild(bg);
  svg.appendChild(arc);
  svg.appendChild(dot);

  wrap.style.position = 'relative';
  wrap.appendChild(svg);
  wrap.appendChild(gText);
  gText.appendChild(label);
  gText.appendChild(sub);

  mount.appendChild(wrap);

  STATE.svg = svg;
  STATE.arc = arc;
  STATE.dot = dot;
  STATE.label = label;
  STATE.sub = sub;
}

export function ensureWaterGauge(opt){
  if (!DOC || !DOC.body) return false;

  const cfg = Object.assign({}, DEFAULTS, opt || {});
  STATE.greenMin = clamp(cfg.greenMin, 0, 100);
  STATE.greenMax = clamp(cfg.greenMax, 0, 100);

  if (STATE.mounted && STATE.arc && STATE.label && STATE.sub) return true;

  const mount = ensureRoot();
  if (!mount) return false;

  // If already exists from previous run, try reuse
  if (mount.dataset && mount.dataset.hhaWaterGauge === '1'){
    STATE.mounted = true;
    return true;
  }

  // Clear only if it’s our mount
  try{
    mount.innerHTML = '';
    mount.dataset.hhaWaterGauge = '1';
  }catch(_){}

  buildGauge(mount);
  STATE.mounted = true;
  return true;
}

function setArc(pct){
  if (!STATE.arc) return;

  const p = clamp(pct, 0, 100) / 100;
  const r = 44;
  const C = 2 * Math.PI * r;
  const off = C * (1 - p);
  STATE.arc.setAttribute('stroke-dashoffset', String(off));

  // dot position (simple polar)
  if (STATE.dot){
    const ang = (-90 + 360 * p) * (Math.PI / 180);
    const cx = 60 + Math.cos(ang) * r;
    const cy = 60 + Math.sin(ang) * r;
    STATE.dot.setAttribute('cx', cx.toFixed(2));
    STATE.dot.setAttribute('cy', cy.toFixed(2));
  }
}

function setColorByZone(z){
  if (!STATE.arc) return;
  // Keep consistent with existing theme (no CSS dependency required)
  if (z === 'GREEN') STATE.arc.setAttribute('stroke', 'rgba(34,197,94,.95)');
  else if (z === 'LOW') STATE.arc.setAttribute('stroke', 'rgba(34,211,238,.95)');
  else STATE.arc.setAttribute('stroke', 'rgba(245,158,11,.95)');
}

export function setWaterGauge(pct, opt){
  const cfg = Object.assign({}, { updateDom: true }, opt || {});
  const p = clamp(pct, 0, 100);
  const z = zoneFrom(p, { greenMin: STATE.greenMin, greenMax: STATE.greenMax });

  // ensure gauge exists
  ensureWaterGauge({ greenMin: STATE.greenMin, greenMax: STATE.greenMax });

  if (STATE.label) STATE.label.textContent = `${p.toFixed(0)}%`;
  if (STATE.sub) STATE.sub.textContent = z;

  setArc(p);
  setColorByZone(z);

  // Best-effort sync to existing Hydration DOM
  if (cfg.updateDom){
    const elPct = byId('water-pct');
    const elZone = byId('water-zone');
    const elBar = byId('water-bar');

    if (elPct) elPct.textContent = String(p | 0);
    if (elZone) elZone.textContent = z;
    if (elBar) elBar.style.width = `${p.toFixed(0)}%`;
  }

  STATE.lastPct = p;
  return { pct: p, zone: z };
}