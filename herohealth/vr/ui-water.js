// === /herohealth/vr/ui-water.js ===
// Water Gauge Helper — LATEST (smooth + responsive + superkids)
// ✅ setWaterGauge(pct) smooth-follow (not laggy)
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// URL:
//   ?kids=1, ?kids=2|super

'use strict';

const WIN = (typeof window !== 'undefined') ? window : globalThis;
const DOC = WIN.document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

export function zoneFrom(pct){
  const p = clamp(pct,0,100);
  if (p < 40) return 'LOW';
  if (p > 70) return 'HIGH';
  return 'GREEN';
}

let mounted = false;
let cur = 50;
let target = 50;
let rafId = 0;

function getKidsLevel(){
  const v = String(qs('kids','')).toLowerCase().trim();
  if (v==='2' || v==='super') return 2;
  if (v==='1' || v==='true' || v==='yes') return 1;
  return 0;
}

function getEls(){
  return {
    bar: DOC?.getElementById('water-bar'),
    pct: DOC?.getElementById('water-pct'),
    zone: DOC?.getElementById('water-zone')
  };
}

function step(){
  rafId = 0;
  const { bar, pct, zone } = getEls();
  if (!bar && !pct && !zone) return;

  const lvl = getKidsLevel(); // 0/1/2
  const follow = (lvl===2) ? 0.36 : (lvl===1 ? 0.28 : 0.20);
  const snap   = (lvl===2) ? 2.6  : (lvl===1 ? 2.0  : 1.3);

  const d = target - cur;
  if (Math.abs(d) < snap) cur = target;
  else cur = cur + d * follow;

  const p = clamp(cur,0,100);
  const z = zoneFrom(p);

  if (bar) bar.style.width = p.toFixed(0) + '%';
  if (pct) pct.textContent = String(p|0);
  if (zone) zone.textContent = z;

  if (Math.abs(target - cur) > 0.25){
    rafId = requestAnimationFrame(step);
  }
}

export function ensureWaterGauge(){
  if (!DOC || mounted) return;
  mounted = true;
  cur = 50; target = 50;

  const { bar, pct, zone } = getEls();
  if (bar) bar.style.width = '50%';
  if (pct) pct.textContent = '50';
  if (zone) zone.textContent = zoneFrom(50);
}

export function setWaterGauge(pct){
  target = clamp(pct,0,100);
  if (!rafId) rafId = requestAnimationFrame(step);
}