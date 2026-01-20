// === /herohealth/vr/ui-water.js ===
// Water Gauge UI — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): เตรียมโหนด/ตัวแปรให้พร้อม (ไม่พังถ้าไม่มี element)
// ✅ setWaterGauge(pct): ตั้งค่า "target" (ค่าจริงจากเกม)
// ✅ zoneFrom(pct): คืนโซน LOW/GREEN/HIGH (ใช้ร่วมทุกเกม)
// ✅ Smoothing: displayPct วิ่งเข้าหา targetPct แบบนิ่ม (kids-friendly)
// ✅ Fix "ไม่ลด/ขึ้นลงยาก":
//    - อัปเดตด้วย RAF loop แยกจากเกม
//    - มี deadzone เล็ก ๆ กันสั่น แต่ยังขยับได้เสมอ
//    - clamp + numeric safety
//
// Elements expected (optional):
//   #water-bar (div)  -> width %
//   #water-pct (span) -> number
//   #water-zone (b/span) -> text zone
//
// You can call setWaterGauge() บ่อยแค่ไหนก็ได้ (ทุกเฟรมก็ได้)
// ระบบจะทำ smoothing เอง

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_UI_WATER__) return;
  WIN.__HHA_UI_WATER__ = true;

  const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  function zoneFrom(pct){
    const p = clamp(pct,0,100);
    // ให้ GREEN กว้างพอสำหรับเด็ก ป.5 (รู้สึก "คุมง่าย")
    // ปรับได้ในอนาคต แต่ตอนนี้ใช้มาตรฐานเดียวกับเกม
    if (p < 40) return 'LOW';
    if (p > 70) return 'HIGH';
    return 'GREEN';
  }

  // ----- internal state -----
  const S = {
    ready:false,
    targetPct:50,
    displayPct:50,
    lastZone:'GREEN',
    raf:0,
    // tuning
    // speed: ยิ่งมากยิ่งไว (เด็กต้อง "เห็นขยับ" แต่ไม่กระตุก)
    // dt smoothing: based on 60fps
    speed: 10.5,
    // deadzone: กัน jitter เล็ก ๆ
    dead: 0.15,
    // minStep: บังคับให้ขยับขั้นต่ำต่อเฟรมเมื่อยังไม่ถึง (กัน "เหมือนไม่ขยับ")
    minStep: 0.04,
  };

  function getEls(){
    return {
      bar: DOC.getElementById('water-bar'),
      pct: DOC.getElementById('water-pct'),
      zone: DOC.getElementById('water-zone'),
    };
  }

  function paint(p){
    const els = getEls();
    const pp = clamp(p,0,100);
    if (els.bar) els.bar.style.width = pp.toFixed(1) + '%';
    if (els.pct) els.pct.textContent = String(pp|0);

    const z = zoneFrom(pp);
    if (els.zone) els.zone.textContent = z;

    // Optional: ให้ dev เอาไปใช้แต่งสีด้วย CSS (ถ้าต้องการ)
    try{
      DOC.body?.classList?.toggle('water-low', z==='LOW');
      DOC.body?.classList?.toggle('water-green', z==='GREEN');
      DOC.body?.classList?.toggle('water-high', z==='HIGH');
    }catch(_){}
  }

  function tick(){
    // smoothing loop
    const t = S.targetPct;
    let d = t - S.displayPct;

    // deadzone กันสั่น แต่ยังให้ “ไหล” หากค้างนาน
    if (Math.abs(d) <= S.dead){
      // ถ้าใกล้มาก ให้ snap ไปเลย (กันค้าง)
      S.displayPct = t;
    } else {
      // smooth toward target
      const step = Math.sign(d) * Math.max(S.minStep, Math.abs(d) * (S.speed/60));
      // ป้องกัน overshoot
      if (Math.abs(step) > Math.abs(d)) S.displayPct = t;
      else S.displayPct = clamp(S.displayPct + step, 0, 100);
    }

    paint(S.displayPct);
    S.raf = WIN.requestAnimationFrame(tick);
  }

  function ensureWaterGauge(){
    if (S.ready) return true;
    S.ready = true;

    // allow per-game overrides via window.HHA_WATER_CFG
    try{
      const cfg = WIN.HHA_WATER_CFG || {};
      if (cfg && typeof cfg === 'object'){
        if (cfg.speed != null) S.speed = clamp(cfg.speed, 2, 30);
        if (cfg.dead  != null) S.dead  = clamp(cfg.dead, 0.02, 1.2);
        if (cfg.minStep != null) S.minStep = clamp(cfg.minStep, 0.01, 0.5);
      }
    }catch(_){}

    // initialize from DOM if exists
    try{
      const els = getEls();
      const domPct = els.pct ? parseFloat(els.pct.textContent||'') : NaN;
      if (!Number.isNaN(domPct)) {
        S.targetPct = clamp(domPct,0,100);
        S.displayPct = S.targetPct;
      }
    }catch(_){}

    paint(S.displayPct);

    // start loop once
    if (!S.raf) S.raf = WIN.requestAnimationFrame(tick);
    return true;
  }

  function setWaterGauge(pct){
    const p = clamp(pct,0,100);
    S.targetPct = p;

    // ถ้ายังไม่ได้ ensure ก็จะเรียกให้เอง
    if (!S.ready) ensureWaterGauge();
  }

  // Export (รองรับทั้ง ESM import *และ* global)
  // - hydration.safe.js ใช้ import { ensureWaterGauge, setWaterGauge, zoneFrom } ...
  // แต่ในบางเกมเราโหลดเป็น <script> ก็ยังใช้ global ได้
  try{
    WIN.ensureWaterGauge = ensureWaterGauge;
    WIN.setWaterGauge = setWaterGauge;
    WIN.zoneFrom = zoneFrom;
  }catch(_){}

  // Provide module-style global registry (optional)
  WIN.GAME_MODULES = WIN.GAME_MODULES || {};
  WIN.GAME_MODULES.uiWater = { ensureWaterGauge, setWaterGauge, zoneFrom };

  // Also expose as "named exports" shim for bundler-less ESM import pattern:
  // (หมายเหตุ: browser ESM จริงจะ import จากไฟล์ได้เลยอยู่แล้ว)
  WIN.__HHA_UI_WATER_EXPORTS__ = { ensureWaterGauge, setWaterGauge, zoneFrom };

})();