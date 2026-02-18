// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION (AUTO VIEW + AUTO VR-UI + SAFE-ZONE MEASURE)
// v2026-02-18b
//
// ✅ Auto view: pc/mobile/vr/cvr (from ?view=)
// ✅ Auto load ../vr/vr-ui.js when view=vr|cvr (safe, idempotent)
// ✅ Compute safe-zone from DOM heights (topbar + HUD top + HUD bottom + safe-area insets)
// ✅ Set CSS vars: --gj-top-safe, --gj-bottom-safe (used by goodjunk.safe.js spawn)
// ✅ Recompute on resize/orientation + HUD toggle + quest open/close
// ✅ Pointer-events hardening: HUD won't block targets; top buttons still clickable
// ✅ NO duplicate hha:end listeners here (HTML handles end overlay UI)
//
// Requires:
//  - ./goodjunk.safe.js exports boot(payload)
//  - HTML has #gj-layer (and optional #gj-layer-r)
//  - CSS uses --gj-top-safe/--gj-bottom-safe for spawn safe rect (safe.js reads them)

'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

(function(){
  const WIN = window;
  const DOC = document;
  const ROOT = DOC.documentElement;

  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const now = ()=> (performance?.now?.() ?? Date.now());

  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function toNum(x, def=0){
    const n = Number(x);
    return Number.isFinite(n) ? n : def;
  }

  // ---------- read params ----------
  const view = String(qs('view','mobile') || 'mobile').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const time = clamp(toNum(qs('time','80'), 80), 20, 300);

  const hub  = (qs('hub', null) || null);
  const seed = (qs('seed', null) || qs('ts', null) || null);

  // ---------- body classes (optional) ----------
  try{
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add(
      view==='pc' ? 'view-pc' :
      view==='vr' ? 'view-vr' :
      view==='cvr'? 'view-cvr' : 'view-mobile'
    );
  }catch(_){}

  // ---------- auto VR-UI loader ----------
  function ensureVRUI(){
    if(!(view === 'vr' || view === 'cvr')) return;

    // already loaded latch
    if(WIN.__HHA_VRUI_LOADED__) return;

    // if script already in DOM, mark loaded-ish
    const existed = Array.from(DOC.scripts || []).some(s => (s?.src || '').includes('/vr/vr-ui.js'));
    if(existed){
      WIN.__HHA_VRUI_LOADED__ = true;
      return;
    }

    // set config before loading
    WIN.HHA_VRUI_CONFIG = Object.assign({
      lockPx: 30,
      cooldownMs: 90,
      showCrosshair: true,
      showButtons: true,
      cvrStrict: (view === 'cvr')
    }, WIN.HHA_VRUI_CONFIG || {});

    const s = DOC.createElement('script');
    s.src = '../vr/vr-ui.js?v=20260218b';
    s.defer = true;
    s.onload = ()=>{ WIN.__HHA_VRUI_LOADED__ = true; };
    s.onerror = ()=>{ /* fail-safe */ };
    DOC.head.appendChild(s);
  }

  // ---------- safe-area helpers ----------
  function pxFromCssVar(name, fallback=0){
    try{
      const v = String(getComputedStyle(ROOT).getPropertyValue(name) || '').trim();
      const n = Number(String(v).replace('px',''));
      return Number.isFinite(n) ? n : fallback;
    }catch(_){ return fallback; }
  }
  function setRootVar(name, px){
    try{ ROOT.style.setProperty(name, `${Math.max(0, Math.round(px))}px`); }catch(_){}
  }
  function rectH(el){
    try{
      if(!el) return 0;
      const r = el.getBoundingClientRect();
      return (r && Number.isFinite(r.height)) ? Math.max(0, r.height) : 0;
    }catch(_){ return 0; }
  }
  function isVisible(el){
    if(!el) return false;
    const st = getComputedStyle(el);
    return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
  }

  // ---------- pointer-events hardening ----------
  function hardenPointerEvents(){
    // Goal: HUD shouldn't block clicking targets in the field
    // - HUD containers => pointer-events:none
    // - Buttons/panels => pointer-events:auto
    try{
      const topbar = DOC.querySelector('.gj-topbar');
      const hudTop = DOC.querySelector('.gj-hud-top');
      const hudBot = DOC.querySelector('.gj-hud-bot');

      if(topbar) topbar.style.pointerEvents = 'auto';
      if(hudTop) hudTop.style.pointerEvents = 'none';
      if(hudBot) hudBot.style.pointerEvents = 'none';

      // allow buttons
      const allow = [
        '#btnQuestOpen','#btnHideHud','#btnRestartTop','#btnHubTop',
        '#btnQuestClose','#questPanel .gj-quest-card',
        '.gj-topbar button','.gj-topbar .gj-btn',
      ];
      allow.forEach(sel=>{
        DOC.querySelectorAll(sel).forEach(el=>{
          try{ el.style.pointerEvents = 'auto'; }catch(_){}
        });
      });

      // ensure playfield layers are clickable
      const L = DOC.getElementById('gj-layer');
      const R = DOC.getElementById('gj-layer-r');
      if(L) L.style.pointerEvents = 'auto';
      if(R) R.style.pointerEvents = 'auto';
    }catch(_){}
  }

  // ---------- cVR right-eye handling ----------
  function applyEyeMode(){
    try{
      const R = DOC.getElementById('gj-layer-r');
      if(!R) return;
      if(view === 'cvr'){
        R.setAttribute('aria-hidden','false');
      }else{
        R.setAttribute('aria-hidden','true');
      }
    }catch(_){}
  }

  // ---------- safe-zone measurement ----------
  function measureSafeZone(){
    // Base safe-area insets (assumes your CSS defines --sat/--sab/--sar)
    const sat = pxFromCssVar('--sat', 0);
    const sab = pxFromCssVar('--sab', 0);

    const topbar = DOC.querySelector('.gj-topbar');
    const hudTop = DOC.querySelector('.gj-hud-top');
    const hudBot = DOC.querySelector('.gj-hud-bot');

    const hudHidden = DOC.body.classList.contains('hud-hidden');

    // buffers
    const PAD_TOP = 14;
    const PAD_BOT = 14;

    // dynamic buffer for short screens
    const vh = DOC.documentElement.clientHeight || 800;
    const dynamic = clamp(vh * 0.015, 6, 18);

    const hTopbar = rectH(topbar);
    const hHudTop = (!hudHidden && isVisible(hudTop)) ? rectH(hudTop) : 0;
    const hHudBot = (!hudHidden && isVisible(hudBot)) ? rectH(hudBot) : 0;

    const topSafe = sat + hTopbar + hHudTop + PAD_TOP + dynamic;
    const botSafe = sab + hHudBot + PAD_BOT + dynamic;

    setRootVar('--gj-top-safe', topSafe);
    setRootVar('--gj-bottom-safe', botSafe);

    WIN.__GJ_SAFEZONE__ = {
      topSafe, botSafe, sat, sab,
      hTopbar, hHudTop, hHudBot,
      hudHidden,
      t: now()
    };
  }

  function settleMeasure(){
    // measure repeatedly during first frames (fonts/layout settle)
    let n = 0;
    const max = 18;
    function step(){
      measureSafeZone();
      n++;
      if(n < max) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function watchBodyClass(){
    // if hud-hidden / quest-open toggles => recompute safe zone
    try{
      const mo = new MutationObserver(()=> measureSafeZone());
      mo.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
    }catch(_){}
  }

  function attachResize(){
    let raf = 0;
    const on = ()=>{
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(()=> measureSafeZone());
    };
    WIN.addEventListener('resize', on, { passive:true });
    WIN.addEventListener('orientationchange', on, { passive:true });
  }

  // ---------- init ----------
  ensureVRUI();
  applyEyeMode();
  hardenPointerEvents();

  measureSafeZone();
  settleMeasure();
  watchBodyClass();
  attachResize();

  // ---------- boot safe engine ----------
  // NOTE: do NOT bind end overlay listeners here
  bootSafe({
    view,
    diff,
    run,
    time,
    hub,
    seed
  });

})();