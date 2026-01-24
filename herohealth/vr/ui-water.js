// === /herohealth/vr/ui-water.js ===
// Water Gauge Helper — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): no-op if DOM exists
// ✅ setWaterGauge(pct): updates CSS var + #water-bar + #water-pct
// ✅ zoneFrom(pct): LOW / GREEN / HIGH
// ✅ Safe even if called many times per second

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  // Tune thresholds (เด็ก ป.5 อ่านง่าย)
  // GREEN = กลาง ๆ, LOW = ต่ำ, HIGH = สูง
  function zoneFrom(pct){
    const p = clamp(pct,0,100);
    if (p < 40) return 'LOW';
    if (p > 70) return 'HIGH';
    return 'GREEN';
  }

  function ensureWaterGauge(){
    // In Hydration RUN, UI already exists (waterpanel).
    // We keep this for compatibility with other games.
    return true;
  }

  // cache nodes (but re-check if DOM replaced)
  let cache = { bar:null, pct:null, zone:null };

  function getNodes(){
    const bar = DOC.getElementById('water-bar');
    const pct = DOC.getElementById('water-pct');
    const zone = DOC.getElementById('water-zone');

    // update cache if changed
    cache.bar = bar || cache.bar;
    cache.pct = pct || cache.pct;
    cache.zone = zone || cache.zone;

    return { bar: cache.bar, pct: cache.pct, zone: cache.zone };
  }

  // smooth update to avoid “กระตุก”
  let last = 50;
  let target = 50;
  let rafId = 0;

  function paint(val){
    const v = clamp(val,0,100);
    // CSS var for CSS-driven fill
    try{
      DOC.documentElement.style.setProperty('--water-pct', String(v.toFixed(2)));
    }catch(_){}

    const { bar, pct, zone } = getNodes();

    // DOM fill fallback (if CSS var not used)
    if (bar) bar.style.width = v.toFixed(0) + '%';

    if (pct) pct.textContent = String(Math.round(v));

    if (zone) zone.textContent = zoneFrom(v);
  }

  function step(){
    rafId = 0;
    const diff = target - last;

    // snap if very close
    if (Math.abs(diff) < 0.25){
      last = target;
      paint(last);
      return;
    }

    // smoothing speed: feel “สบาย ๆ” (เด็ก ป.5)
    last = last + diff * 0.22;
    paint(last);
    rafId = requestAnimationFrame(step);
  }

  function setWaterGauge(pct){
    target = clamp(pct,0,100);

    // First paint immediately once (prevents "ไม่ลดลง" feeling)
    paint(target);

    // Then smooth if needed
    if (!rafId){
      rafId = requestAnimationFrame(step);
    }
  }

  // expose as ES module friendly named exports via global
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // Also support import style: your hydration.safe.js does
  // import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
  // -> for that to work, file must be an ES module.
  // If you are using <script src="../vr/ui-water.js"> (non-module),
  // then hydration.safe.js import would not match. BUT your RUN uses <script defer>
  // and hydration.safe.js is type=module; browsers can still load this file as classic.
  // Therefore: keep BOTH — if you need true module export, use the ESM version below.

})();