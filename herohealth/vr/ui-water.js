// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge Helper — PRODUCTION v2
// ✅ ensureWaterGauge(): no-op safe
// ✅ setWaterGauge(pct, opts): updates #water-bar/#water-pct/#water-zone if present
// ✅ zoneFrom(pct, kids?): kids => wider GREEN for P.5 comfort

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_UI_WATER_V2__) return;
  WIN.__HHA_UI_WATER_V2__ = true;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));

  // wider GREEN for kids
  function zoneFrom(pct, kids=false){
    const p = clamp(pct, 0, 100);
    if (kids){
      // Kids: GREEN wider => easier to “hold GREEN”
      if (p < 40) return 'LOW';
      if (p > 70) return 'HIGH';
      return 'GREEN';
    }
    // Default
    if (p < 45) return 'LOW';
    if (p > 65) return 'HIGH';
    return 'GREEN';
  }

  // internal smoothing (optional)
  const S = { cur: 50 };

  function ensureWaterGauge(){
    // kept for compatibility; DOM elements are in the game HUD
    return true;
  }

  function setWaterGauge(pct, opts={}){
    const fast = !!opts.fast;            // kids => fast response
    const immediate = !!opts.immediate;  // force set

    const target = clamp(pct, 0, 100);
    if (immediate) S.cur = target;
    else{
      // smoothing factor: fast = more responsive
      const alpha = fast ? 0.55 : 0.28; // 0..1
      S.cur = S.cur + (target - S.cur) * alpha;
    }

    const bar = DOC.getElementById('water-bar');
    const pctEl = DOC.getElementById('water-pct');
    const zoneEl = DOC.getElementById('water-zone');

    if (bar) bar.style.width = clamp(S.cur,0,100).toFixed(0) + '%';
    if (pctEl) pctEl.textContent = String(Math.round(S.cur));
    if (zoneEl){
      // try infer kids from body class or query
      let kids = false;
      try{
        const q = new URL(location.href).searchParams.get('kids');
        kids = (q==='1'||String(q).toLowerCase()==='true'||DOC.body.classList.contains('kids'));
      }catch(_){}
      zoneEl.textContent = zoneFrom(S.cur, kids);
    }
  }

  // expose globally AND module-style usage
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // for ESM imports (your hydration.safe.js uses import {...} from '../vr/ui-water.js')
  // We attach to window; bundlers aside, this file is also loaded as <script defer>.
})();
export function ensureWaterGauge(){ return window.ensureWaterGauge?.(); }
export function setWaterGauge(pct, opts){ return window.setWaterGauge?.(pct, opts||{}); }
export function zoneFrom(pct, kids=false){ return window.zoneFrom?.(pct, kids) || 'GREEN'; }