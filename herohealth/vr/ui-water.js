// === /herohealth/vr/ui-water.js ===
// HHA Water Gauge — PRODUCTION (LATEST)
// ✅ ensureWaterGauge(): create minimal gauge if missing (safe)
// ✅ setWaterGauge(pct, opts?): updates UI with smoothing
// ✅ zoneFrom(pct): LOW/GREEN/HIGH
// ✅ Optional: internal gentle decay helper (engine may call tickWater)

(function(root){
  'use strict';

  const DOC = root.document;
  if(!DOC) return;

  // -------------------- zone logic --------------------
  // ปรับ threshold ให้เด็ก ป.5 รู้สึก “อยู่โซนเขียวได้ง่าย” แต่ยังมี LOW/HIGH ชัด
  function zoneFrom(pct){
    const p = clamp(pct, 0, 100);
    if (p < 40) return 'LOW';
    if (p > 78) return 'HIGH';
    return 'GREEN';
  }

  // -------------------- UI hooks --------------------
  let UI = null;

  function qs(sel){ return DOC.querySelector(sel); }
  function byId(id){ return DOC.getElementById(id); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // smoothing state
  const SM = { cur: 50, tgt: 50, lastAt: 0, raf: 0 };

  function ensureWaterGauge(){
    // If the game already has water panel ids -> bind to them
    const bar = byId('water-bar');
    const pct = byId('water-pct');
    const zone = byId('water-zone');
    if (bar && pct && zone){
      UI = { bar, pct, zone };
      return UI;
    }

    // Otherwise create a tiny gauge (fallback) - safe for other games
    let host = qs('#hud') || DOC.body;
    const wrap = DOC.createElement('div');
    wrap.id = 'hha-water-fallback';
    wrap.style.cssText = `
      position:fixed;
      right:12px; bottom:12px;
      z-index:80;
      pointer-events:none;
      width:180px;
      padding:10px;
      border-radius:14px;
      border:1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.55);
      backdrop-filter: blur(10px);
      color: rgba(229,231,235,.92);
      font: 800 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Arial;
      box-shadow: 0 16px 60px rgba(0,0,0,.35);
    `;
    wrap.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <span>Water</span>
        <span>Zone: <b id="water-zone">GREEN</b></span>
      </div>
      <div style="margin-top:8px;height:10px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.18);border:1px solid rgba(148,163,184,.10)">
        <div id="water-bar" style="height:100%;width:50%;border-radius:999px;background:linear-gradient(90deg, rgba(34,197,94,.95), rgba(34,211,238,.95))"></div>
      </div>
      <div style="margin-top:6px;text-align:right"><span id="water-pct">50</span>%</div>
    `;
    host.appendChild(wrap);

    UI = {
      bar: wrap.querySelector('#water-bar'),
      pct: wrap.querySelector('#water-pct'),
      zone: wrap.querySelector('#water-zone')
    };
    return UI;
  }

  function paint(p){
    if(!UI) ensureWaterGauge();
    if(!UI) return;

    const pp = clamp(p, 0, 100);
    if (UI.bar) UI.bar.style.width = pp.toFixed(0) + '%';
    if (UI.pct) UI.pct.textContent = String(pp|0);
    if (UI.zone) UI.zone.textContent = zoneFrom(pp);
  }

  // Smooth update (kids-friendly): ลดความกระตุกเวลาน้ำขึ้นลงเร็ว ๆ
  function setWaterGauge(pct, opts){
    if(!UI) ensureWaterGauge();
    const target = clamp(pct, 0, 100);
    SM.tgt = target;

    // immediate option (for init)
    const immediate = !!(opts && opts.immediate);
    if (immediate){
      SM.cur = SM.tgt;
      paint(SM.cur);
      return;
    }

    if (!SM.raf){
      SM.lastAt = performance.now();
      SM.raf = requestAnimationFrame(step);
    }
  }

  function step(t){
    const dt = Math.min(0.05, Math.max(0.001, (t - SM.lastAt)/1000));
    SM.lastAt = t;

    // smoothing speed: เด็ก ป.5 ควรรู้สึกนิ่ม ๆ ไม่กระชาก
    // เร่งนิดหน่อยถ้าห่างมาก
    const d = SM.tgt - SM.cur;
    const ad = Math.abs(d);

    let speed = 10.0;          // base response
    if (ad > 25) speed = 18.0; // big jumps converge faster
    else if (ad > 10) speed = 14.0;

    // critically-damped-ish approach
    SM.cur += d * Math.min(1, speed * dt);

    // snap if very close
    if (Math.abs(SM.tgt - SM.cur) < 0.25){
      SM.cur = SM.tgt;
    }

    paint(SM.cur);

    if (SM.cur === SM.tgt){
      SM.raf = 0;
      return;
    }
    SM.raf = requestAnimationFrame(step);
  }

  // Optional helper: water “ไหลลงตามเวลา” แบบนิ่ม ๆ
  // ให้ engine เรียกทุกเฟรม/ทุก tick ได้:
  //   pct = tickWater(pct, dt, { decayPerSec: 2.0, floor: 20 })
  function tickWater(pct, dt, cfg){
    const c = cfg || {};
    const decay = clamp(c.decayPerSec ?? 1.6, 0, 12); // % ต่อวินาที
    const floor = clamp(c.floor ?? 18, 0, 100);       // กันไม่ให้ลงไป 0 ง่ายเกิน
    const p = clamp(pct, 0, 100);
    const next = clamp(p - decay * clamp(dt,0,0.2), floor, 100);
    return next;
  }

  // Export globals (compatible with current imports)
  // hydration.safe.js uses: ensureWaterGauge, setWaterGauge, zoneFrom
  root.ensureWaterGauge = ensureWaterGauge;
  root.setWaterGauge = setWaterGauge;
  root.zoneFrom = zoneFrom;
  root.tickWater = tickWater;

  // Also support module-style usage via window.GAME_MODULES if needed
  root.GAME_MODULES = root.GAME_MODULES || {};
  root.GAME_MODULES.WaterUI = { ensureWaterGauge, setWaterGauge, zoneFrom, tickWater };

})(typeof window !== 'undefined' ? window : globalThis);