// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// HydrationVR Loader — PRODUCTION (FULL)
// ✅ Auto-detect view (pc/mobile/cvr/cardboard) if no ?view=
// ✅ Respects explicit ?view= if provided
// ✅ Sets body classes: view-pc / view-mobile / view-cvr / cardboard
// ✅ Exposes window.HHA_VIEW = { view, layers:[...] } (used by hydration.safe.js for split layers)
// ✅ Robust import + error display on start overlay
// ✅ Does NOT start game automatically (start button triggers hha:start in hydration-vr.html)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch(_){ return def; }
  };

  const setText = (id, v)=>{
    const el = DOC.getElementById(id);
    if (el) el.textContent = String(v);
  };

  const addBodyClass = (...cls)=>{ try{ DOC.body.classList.add(...cls); }catch(_){ } };
  const remBodyClass = (...cls)=>{ try{ DOC.body.classList.remove(...cls); }catch(_){ } };

  function isMobileCoarse(){
    try{
      return !!(matchMedia && matchMedia('(pointer:coarse)').matches);
    }catch(_){
      return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
    }
  }

  function supportsWebXR(){
    // Best-effort: if WebXR exists, consider VR-capable
    try{ return !!(navigator && navigator.xr); }catch(_){ return false; }
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (v === 'vr') v = 'cardboard';       // allow alias
    if (v === 'cb') v = 'cardboard';       // alias
    if (v === 'cvr') v = 'cvr';
    if (v === 'pc') v = 'pc';
    if (v === 'mobile') v = 'mobile';
    if (v === 'cardboard') v = 'cardboard';
    return v;
  }

  function detectView(){
    // If user explicitly provides ?view=, respect it.
    const explicit = normalizeView(qs('view',''));
    if (explicit) return explicit;

    // Auto-detect:
    // - If ?force=cvr or ?cvr=1 -> cvr
    const cvr1 = String(qs('cvr','')).toLowerCase();
    if (cvr1 === '1' || cvr1 === 'true') return 'cvr';

    // - If VR device exists and mobile coarse pointer -> default to cvr (fast crosshair mode)
    //   (ผู้ใช้ส่วนใหญ่: มือถือ + cardboard = cvr / cardboard แล้วแต่ root launcher ส่งมา)
    const mobile = isMobileCoarse();
    const xr = supportsWebXR();

    // Heuristic:
    // - If explicit cardboard requested via ?vr=1 or ?cardboard=1
    const cb1 = String(qs('cardboard','')).toLowerCase();
    const vr1 = String(qs('vr','')).toLowerCase();
    if (cb1 === '1' || cb1 === 'true' || vr1 === '1' || vr1 === 'true') return 'cardboard';

    // If mobile + xr -> cvr (ยิงกลางจอ ใช้ง่ายกว่า)
    if (mobile && xr) return 'cvr';

    // If mobile without xr -> mobile
    if (mobile) return 'mobile';

    // else PC
    return 'pc';
  }

  function applyView(view){
    // clear all known classes first
    remBodyClass('view-pc','view-mobile','view-cvr','cardboard');

    if (view === 'cardboard'){
      // split L/R
      addBodyClass('cardboard');
      WIN.HHA_VIEW = { view:'cardboard', layers:['hydration-layerL','hydration-layerR'] };

      // ensure cbPlayfield visible (CSS will do via .cardboard)
      // nothing else needed
      return;
    }

    if (view === 'cvr'){
      addBodyClass('view-cvr');
      WIN.HHA_VIEW = { view:'cvr', layers:['hydration-layer'] };
      return;
    }

    if (view === 'mobile'){
      addBodyClass('view-mobile');
      WIN.HHA_VIEW = { view:'mobile', layers:['hydration-layer'] };
      return;
    }

    // default pc
    addBodyClass('view-pc');
    WIN.HHA_VIEW = { view:'pc', layers:['hydration-layer'] };
  }

  function prettyViewLabel(){
    const b = DOC.body;
    if (b.classList.contains('cardboard')) return 'VR Cardboard (Split)';
    if (b.classList.contains('view-cvr')) return 'cVR (Crosshair ยิงกลางจอ)';
    if (b.classList.contains('view-mobile')) return 'Mobile';
    return 'PC';
  }

  function showBootStatus(){
    const overlay = DOC.getElementById('startOverlay');
    // overlay is visible by default; we just update subtitle
    setText('start-sub', `โหมดตรวจจับแล้ว: ${prettyViewLabel()}  •  แตะ ▶️ เพื่อเริ่ม`);
    if (!overlay) return;
  }

  async function boot(){
    try{
      // Ensure body exists
      if (!DOC.body){
        await new Promise(r=>setTimeout(r, 10));
      }

      const v = detectView();
      applyView(v);
      showBootStatus();

      // Import engine (hydration.safe.js) — it will wait for 'hha:start'
      // NOTE: keep path relative to this loader file
      await import('./hydration.safe.js');

      // (Optional) let UI know everything loaded
      try{
        WIN.dispatchEvent(new CustomEvent('hha:loader_ready', {
          detail:{ view: (WIN.HHA_VIEW && WIN.HHA_VIEW.view) || v }
        }));
      }catch(_){}

    }catch(err){
      console.error('[HydrationVR Loader] failed:', err);

      // Show error on start overlay
      const msg =
        (err && (err.message || String(err))) || 'Unknown error';

      setText('start-sub', `โหลดไม่สำเร็จ ❌\n${msg}\n(ตรวจสอบ path / module import / cache)`);
      // keep overlay visible; user can still press Back HUB
    }
  }

  boot();
})();