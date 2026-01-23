// === /herohealth/vr/ui-water.js ===
// UI Water Gauge — PRODUCTION (Smooth + Kids-friendly)
// ✅ ensureWaterGauge(): safe init (works even if panel already exists)
// ✅ setWaterGauge(pct, opts?): smooth animate + snap to target
// ✅ zoneFrom(pct): LOW/GREEN/HIGH
// ✅ Plays nice with existing DOM ids: #water-bar #water-pct #water-zone
//
// URL params:
//   ?kids=1                 => smoother + more forgiving
//   ?waterSmooth=0.22       => 0..1 (higher = faster catch-up)
//   ?waterSnap=0.8          => snap threshold (%)
//   ?waterMinStep=0.35      => minimum visual step per frame (%)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  // prevent double load
  if (WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  // Detect kids mode
  const kidsQ = String(qs('kids','0')).toLowerCase();
  const KIDS = (kidsQ==='1' || kidsQ==='true' || kidsQ==='yes');

  // Tune smoothing
  const smoothBase = clamp(parseFloat(qs('waterSmooth', KIDS ? '0.28' : '0.22')), 0.05, 0.60);
  const snapBase   = clamp(parseFloat(qs('waterSnap',   KIDS ? '1.2'  : '0.8')),  0.0,  6.0);
  const minStep    = clamp(parseFloat(qs('waterMinStep',KIDS ? '0.45' : '0.35')), 0.0,  3.0);

  // state
  const S = {
    ready:false,
    target:50,
    shown:50,
    lastT:0,
    raf:0,
    // cached nodes
    bar:null,
    pct:null,
    zone:null
  };

  function zoneFrom(pct){
    // คุณใช้ GREEN เป็นโซนกลาง: ให้ “พอดี” ที่ 45..65 (ปรับได้ถ้าต้องการ)
    const p = clamp(pct,0,100);
    if (p < 45) return 'LOW';
    if (p > 65) return 'HIGH';
    return 'GREEN';
  }

  function grabNodes(){
    S.bar  = DOC.getElementById('water-bar');
    S.pct  = DOC.getElementById('water-pct');
    S.zone = DOC.getElementById('water-zone');
    S.ready = !!(S.bar || S.pct || S.zone);
  }

  function paint(){
    // write DOM (safe even if some nodes missing)
    const shown = clamp(S.shown, 0, 100);
    const z = zoneFrom(shown);

    if (S.bar){
      // no layout thrash: just width
      S.bar.style.width = shown.toFixed(0) + '%';
      // เพิ่มความ “นิ่ม” ด้วย transition เบา ๆ (ไม่หน่วง)
      S.bar.style.transition = 'width 120ms linear';
    }
    if (S.pct) S.pct.textContent = String(shown|0);
    if (S.zone) S.zone.textContent = z;
  }

  function step(t){
    if (!S.ready){
      grabNodes();
      if (!S.ready){
        S.raf = WIN.requestAnimationFrame(step);
        return;
      }
    }

    const dt = Math.min(0.05, Math.max(0.001, (t - (S.lastT||t))/1000));
    S.lastT = t;

    const target = clamp(S.target, 0, 100);
    let shown = clamp(S.shown, 0, 100);

    const diff = target - shown;
    const adiff = Math.abs(diff);

    // SNAP: ถ้าใกล้มากแล้วให้ติดเป้าทันที ป้องกัน “ค้าง”
    if (adiff <= snapBase){
      shown = target;
      S.shown = shown;
      paint();
      // ถ้าติดเป้าแล้ว ไม่ต้องวิ่งต่อ ถ้า target เปลี่ยนอีกจะ start ใหม่
      S.raf = 0;
      return;
    }

    // SMOOTH: exponential-ish catch-up (นิ่ม แต่ไปถึงแน่)
    // speed = smoothBase per frame-ish, scaled by dt
    const k = 1 - Math.pow(1 - smoothBase, dt*60); // normalize to ~60fps
    let move = diff * k;

    // minimum move: กันสถานการณ์ diff น้อยแล้ว “เหมือนไม่ขยับ”
    if (minStep > 0){
      const m = Math.sign(move) * Math.max(Math.abs(move), Math.min(adiff, minStep));
      move = m;
    }

    shown = clamp(shown + move, 0, 100);
    S.shown = shown;

    paint();
    S.raf = WIN.requestAnimationFrame(step);
  }

  function ensureWaterGauge(){
    // ไม่สร้าง UI ใหม่ เพราะ Hydration มี panel อยู่แล้ว
    // แต่เราจะ “จับ node” ให้แน่นและเริ่ม paint หนึ่งครั้ง
    grabNodes();
    if (S.ready) paint();
  }

  function setWaterGauge(pct, opts={}){
    // opts: { immediate:boolean, smooth:number, snap:number }
    const immediate = !!opts.immediate;

    // allow per-call override
    if (typeof opts.smooth === 'number'){
      // (ไม่เก็บถาวร) — ใช้เป็น multiplier เล็กน้อย
    }

    const p = clamp(pct, 0, 100);
    S.target = p;

    if (!S.ready) grabNodes();

    // immediate: ใช้ตอน boot หรือ reset
    if (immediate){
      S.shown = p;
      paint();
      if (S.raf){ try{ WIN.cancelAnimationFrame(S.raf); }catch(_){ } }
      S.raf = 0;
      return;
    }

    // start animator if not running
    if (!S.raf){
      S.lastT = 0;
      S.raf = WIN.requestAnimationFrame(step);
    }
  }

  // expose globally + ES module style compatibility
  WIN.ensureWaterGauge = ensureWaterGauge;
  WIN.setWaterGauge = setWaterGauge;
  WIN.zoneFrom = zoneFrom;

  // also support module import pattern used in your hydration.safe.js
  // (บาง bundler จะมองหา exports ใน globalThis)
  try{
    if (!WIN.__HHA_UI_WATER_EXPORTS__){
      WIN.__HHA_UI_WATER_EXPORTS__ = { ensureWaterGauge, setWaterGauge, zoneFrom };
    }
  }catch(_){}

})();