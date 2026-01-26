// === /herohealth/vr/calibration-helper.js ===
// HHA Calibration Helper — PRODUCTION (Pack 13)
// ✅ Cardboard/VR/cVR calibration overlay (simple, kid-friendly)
// ✅ One-tap "Recenter now" (best-effort)
// ✅ Auto-show on first user gesture when view=vr/cvr (unless disabled)
// ✅ Rate-limited (won't spam), remembers "dismissed" for this session
// ✅ Exposes: window.HHACalib = { show, hide, recenter, prime }
//
// Notes:
// - Works with vr-ui.js (ENTER VR / RECENTER button) but can run standalone.
// - Recenter is "best-effort": triggers WebXR reference-space reset when possible,
//   and also dispatches a generic event for your engine to handle if needed.

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_CALIB_LOADED__) return;
  WIN.__HHA_CALIB_LOADED__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  const STATE = {
    mounted:false,
    visible:false,
    dismissed:false,
    lastShowAt:0,
    cooldownMs: 8000
  };

  function isVRView(){
    const v = String(qs('view','') || '').toLowerCase();
    return (v === 'vr' || v === 'cvr' || v === 'view-cvr' || v === 'cardboard');
  }

  function el(id){ return DOC.getElementById(id); }

  function mount(){
    if(STATE.mounted) return;
    STATE.mounted = true;

    const wrap = DOC.createElement('div');
    wrap.id = 'hha-calib';
    wrap.setAttribute('aria-hidden','true');
    wrap.style.cssText = `
      position:fixed; inset:0; z-index:9999;
      display:flex; align-items:center; justify-content:center;
      padding: env(safe-area-inset-top,0px) env(safe-area-inset-right,0px)
               env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px);
      pointer-events:none; opacity:0; transition:opacity .18s ease;
      background: radial-gradient(circle at center, rgba(0,0,0,.42), rgba(0,0,0,.62));
      font-family: system-ui,-apple-system,"Segoe UI","Noto Sans Thai",sans-serif;
    `;

    wrap.innerHTML = `
      <div id="hha-calib-card" style="
        width:min(720px, 94vw);
        border-radius:22px;
        border:1px solid rgba(148,163,184,.22);
        background: rgba(2,6,23,.76);
        box-shadow: 0 18px 55px rgba(0,0,0,.55);
        padding:14px;
        pointer-events:auto;
        color:#e5e7eb;
      ">
        <div style="display:flex; gap:10px; align-items:center; justify-content:space-between;">
          <div style="font-weight:1200; font-size:16px;">
            🎯 ตั้งท่าก่อนเริ่ม (Calibration)
          </div>
          <button id="hha-calib-close" type="button" style="
            height:38px; padding:0 12px;
            border-radius:14px; border:1px solid rgba(148,163,184,.22);
            background: rgba(15,23,42,.55);
            color:#e5e7eb; font-weight:1100; cursor:pointer;
          ">ปิด</button>
        </div>

        <div style="margin-top:10px; font-weight:900; color:rgba(229,231,235,.92); line-height:1.45; font-size:13px;">
          1) จับมือถือให้อยู่กึ่งกลางหน้า / ใส่แว่นให้พอดี<br/>
          2) มองตรงไปข้างหน้า แล้วกด <b>Recenter</b><br/>
          3) ถ้า HUD บัง: กด <b>Hide HUD</b> (หรือขยับหัวให้พ้น HUD)
        </div>

        <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
          <button id="hha-calib-recenter" type="button" style="
            height:44px; padding:0 14px;
            border-radius:16px; border:1px solid rgba(34,197,94,.40);
            background: rgba(34,197,94,.16);
            color:#eafff3; font-weight:1200; cursor:pointer;
          ">✅ Recenter now</button>

          <button id="hha-calib-tryfs" type="button" style="
            height:44px; padding:0 14px;
            border-radius:16px; border:1px solid rgba(148,163,184,.22);
            background: rgba(15,23,42,.55);
            color:#e5e7eb; font-weight:1100; cursor:pointer;
          ">⛶ Fullscreen</button>

          <button id="hha-calib-dismiss" type="button" style="
            height:44px; padding:0 14px;
            border-radius:16px; border:1px solid rgba(148,163,184,.22);
            background: rgba(15,23,42,.55);
            color:#e5e7eb; font-weight:1100; cursor:pointer;
          ">อย่าแสดงอีก (รอบนี้)</button>
        </div>

        <div id="hha-calib-note" style="
          margin-top:10px; font-size:11px; font-weight:900;
          color: rgba(148,163,184,.92);
          line-height:1.35;
        ">
          ทิป: ถ้าเป็น <b>cVR</b> ให้เล็งด้วยเป้ากลางจอแล้วยิง (ไม่ต้องแตะเป้า)
        </div>
      </div>
    `;

    DOC.body.appendChild(wrap);

    el('hha-calib-close')?.addEventListener('click', hide);
    el('hha-calib-dismiss')?.addEventListener('click', ()=>{
      STATE.dismissed = true;
      hide();
    });

    el('hha-calib-tryfs')?.addEventListener('click', async ()=>{
      try{
        // integrate with ViewHelper if available
        if(WIN.HHAView && typeof WIN.HHAView.requestImmersion === 'function'){
          await WIN.HHAView.requestImmersion({ preferLandscape:true });
        }else{
          // fallback fullscreen
          const root = DOC.documentElement;
          if(!DOC.fullscreenElement && root.requestFullscreen) await root.requestFullscreen();
        }
      }catch(_){}
    });

    el('hha-calib-recenter')?.addEventListener('click', recenter);
  }

  function show(){
    if(STATE.dismissed) return;
    const t = Date.now();
    if(t - STATE.lastShowAt < STATE.cooldownMs) return;
    STATE.lastShowAt = t;

    mount();
    const w = el('hha-calib');
    if(!w) return;

    w.setAttribute('aria-hidden','false');
    w.style.opacity = '1';
    w.style.pointerEvents = 'auto';
    STATE.visible = true;
  }

  function hide(){
    const w = el('hha-calib');
    if(!w) return;

    w.setAttribute('aria-hidden','true');
    w.style.opacity = '0';
    w.style.pointerEvents = 'none';
    STATE.visible = false;
  }

  async function recenter(){
    // 1) ask vr-ui.js to recenter if it exposed anything (not required)
    try{ WIN.dispatchEvent(new CustomEvent('hha:recenter', { detail:{ source:'calib' } })); }catch(_){}

    // 2) best-effort WebXR reference space reset if scene exists
    try{
      const scene = DOC.querySelector('a-scene');
      const xr = scene && scene.renderer && scene.renderer.xr;
      if(xr && xr.getSession){
        const sess = xr.getSession();
        if(sess && sess.requestReferenceSpace){
          // "local" reference space refresh attempt
          await sess.requestReferenceSpace('local');
        }
      }
    }catch(_){}

    // tiny feedback: auto-hide after recenter
    try{ setTimeout(hide, 450); }catch(_){}
  }

  function prime(){
    // show on first gesture ONLY when VR-ish view
    if(!isVRView()) return;

    const once = ()=>{
      DOC.removeEventListener('pointerdown', once, true);
      // only show if not already hidden by user
      show();
    };
    DOC.addEventListener('pointerdown', once, true);
  }

  WIN.HHACalib = Object.freeze({ show, hide, recenter, prime });

  // auto prime (soft)
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', prime, { once:true });
  }else{
    prime();
  }
})();