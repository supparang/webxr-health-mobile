// === /herohealth/hydration-vr/hydration.safezone.js ===
// HUD Safezone Auto-Measure — PRODUCTION
// ✅ Measure HUD panels & reserve safe insets (top/right/bottom/left)
// ✅ Works for PC/Mobile/cVR + Cardboard (split L/R)
// ✅ Exposes: window.HHA_SAFE = { insetsPx, playRect, measure() }
// ✅ Writes CSS vars on :root:
//    --hvr-safe-top / --hvr-safe-right / --hvr-safe-bottom / --hvr-safe-left
// ✅ Optional debug: add ?safeDebug=1 to draw playRect overlay

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_HYDRATION_SAFEZONE__) return;
  WIN.__HHA_HYDRATION_SAFEZONE__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const safeDebug = String(qs('safeDebug','0')) === '1';

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function rootStyleSet(k,v){
    try{ DOC.documentElement.style.setProperty(k, v); }catch(_){}
  }

  function getPlayfieldEl(){
    const body = DOC.body;
    if (body && body.classList.contains('cardboard')) return DOC.getElementById('cbPlayfield');
    return DOC.getElementById('playfield');
  }

  function getHUD(){
    return DOC.querySelector('.hud');
  }

  function collectPanels(){
    // ทุก panel ใน HUD ถือเป็น "พื้นที่กันเกิดเป้า"
    // แต่ถ้าอยากยกเว้นบางอัน ให้เพิ่ม data-safe="ignore"
    return Array.from(DOC.querySelectorAll('.hud .panel')).filter(el=>{
      return el && el.isConnected && el.getAttribute('data-safe') !== 'ignore';
    });
  }

  function rectIntersect(a,b){
    const x1 = Math.max(a.left, b.left);
    const y1 = Math.max(a.top, b.top);
    const x2 = Math.min(a.right, b.right);
    const y2 = Math.min(a.bottom, b.bottom);
    const w = Math.max(0, x2-x1);
    const h = Math.max(0, y2-y1);
    return { left:x1, top:y1, right:x2, bottom:y2, width:w, height:h };
  }

  function measure(){
    const pf = getPlayfieldEl();
    if (!pf) return null;

    const pfRect = pf.getBoundingClientRect();
    const w = Math.max(1, pfRect.width);
    const h = Math.max(1, pfRect.height);

    const panels = collectPanels();
    let top=0, right=0, bottom=0, left=0;

    // เผื่อ padding กันเป้าชิดขอบ/ชิด HUD
    const PAD = 14;

    for (const p of panels){
      const r = p.getBoundingClientRect();
      const inter = rectIntersect(pfRect, r);
      if (inter.width <= 0 || inter.height <= 0) continue;

      // ถ้าชนด้านบนของ playfield -> เพิ่ม top inset
      if (inter.top <= pfRect.top + 2){
        top = Math.max(top, inter.bottom - pfRect.top);
      }
      // ชนด้านล่าง
      if (inter.bottom >= pfRect.bottom - 2){
        bottom = Math.max(bottom, pfRect.bottom - inter.top);
      }
      // ชนด้านซ้าย
      if (inter.left <= pfRect.left + 2){
        left = Math.max(left, inter.right - pfRect.left);
      }
      // ชนด้านขวา
      if (inter.right >= pfRect.right - 2){
        right = Math.max(right, pfRect.right - inter.left);
      }
    }

    // + padding
    top += PAD; right += PAD; bottom += PAD; left += PAD;

    // กันเหลือพื้นที่เล่นน้อยเกิน: relax อัตโนมัติ
    const minW = 220;
    const minH = 220;
    let playLeft = pfRect.left + left;
    let playTop  = pfRect.top + top;
    let playRight = pfRect.right - right;
    let playBottom= pfRect.bottom - bottom;

    if ((playRight - playLeft) < minW){
      const need = minW - (playRight - playLeft);
      left = Math.max(0, left - need/2);
      right= Math.max(0, right- need/2);
      playLeft = pfRect.left + left;
      playRight= pfRect.right - right;
    }
    if ((playBottom - playTop) < minH){
      const need = minH - (playBottom - playTop);
      top = Math.max(0, top - need/2);
      bottom = Math.max(0, bottom - need/2);
      playTop = pfRect.top + top;
      playBottom = pfRect.bottom - bottom;
    }

    // write CSS vars (px)
    rootStyleSet('--hvr-safe-top', top.toFixed(0)+'px');
    rootStyleSet('--hvr-safe-right', right.toFixed(0)+'px');
    rootStyleSet('--hvr-safe-bottom', bottom.toFixed(0)+'px');
    rootStyleSet('--hvr-safe-left', left.toFixed(0)+'px');

    const out = {
      insetsPx:{ top, right, bottom, left },
      playRect:{
        left: playLeft, top: playTop,
        right: playRight, bottom: playBottom,
        width: Math.max(1, playRight-playLeft),
        height: Math.max(1, playBottom-playTop)
      },
      pfRect:{ left:pfRect.left, top:pfRect.top, right:pfRect.right, bottom:pfRect.bottom, width:w, height:h }
    };

    // debug overlay
    if (safeDebug){
      let dbg = DOC.getElementById('hha-safe-debug');
      if (!dbg){
        dbg = DOC.createElement('div');
        dbg.id = 'hha-safe-debug';
        dbg.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99998;';
        DOC.body.appendChild(dbg);
      }
      dbg.innerHTML = `
        <div style="position:fixed;left:${out.playRect.left}px;top:${out.playRect.top}px;width:${out.playRect.width}px;height:${out.playRect.height}px;
          border:2px dashed rgba(34,211,238,.85);border-radius:18px;box-shadow:0 0 0 9999px rgba(0,0,0,.12) inset;"></div>
      `;
    }

    return out;
  }

  // public API
  const API = WIN.HHA_SAFE || (WIN.HHA_SAFE = {});
  API.insetsPx = { top:0,right:0,bottom:0,left:0 };
  API.playRect = null;
  API.measure = function(){
    const m = measure();
    if (m){
      API.insetsPx = m.insetsPx;
      API.playRect = m.playRect;
    }
    return m;
  };

  function scheduleMeasure(){
    // วัดหลายเฟส: DOM ready + หลังเริ่มเกม + หลัง resize/orientation/fullscreen
    API.measure();
    setTimeout(()=>API.measure(), 120);
    setTimeout(()=>API.measure(), 420);
  }

  WIN.addEventListener('resize', ()=>setTimeout(API.measure, 120));
  WIN.addEventListener('orientationchange', ()=>setTimeout(API.measure, 160));
  WIN.addEventListener('fullscreenchange', ()=>setTimeout(API.measure, 120));
  WIN.addEventListener('hha:start', ()=>setTimeout(scheduleMeasure, 60), { once:false });

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', scheduleMeasure, { once:true });
  } else {
    scheduleMeasure();
  }
})();