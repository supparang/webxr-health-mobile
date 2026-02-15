// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — PRODUCTION v20260215b
// ✅ Parse ctx (hub/run/diff/time/seed/pid/view/gate/gateUrl/cdur/debug)
// ✅ Apply view classes: view-pc / view-mobile / view-cvr
// ✅ Auto-load ../vr/vr-ui.js (ENTER VR / EXIT / RECENTER + crosshair + hha:shoot)
// ✅ Calls safe.boot(opts) with robust fallbacks
// ✅ Never crash if vr-ui missing or DOM nodes missing

'use strict';

import { boot as safeBoot } from './goodjunk.safe.js';

(function(){
  const WIN = window, DOC = document;

  const qs = (k, d=null) => { try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const str = (v, d='') => (v==null ? d : String(v));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function ensureOnce(id){
    if(DOC.getElementById(id)) return false;
    return true;
  }

  function applyView(view){
    const v = (view || '').toLowerCase();
    DOC.body.classList.remove('view-pc','view-mobile','view-cvr','view-vr');
    if(v === 'pc') DOC.body.classList.add('view-pc');
    else if(v === 'cvr') DOC.body.classList.add('view-cvr');
    else if(v === 'vr') DOC.body.classList.add('view-vr');
    else DOC.body.classList.add('view-mobile');

    // optional attribute for CSS selectors
    try{ DOC.body.setAttribute('data-view', v || 'mobile'); }catch(_){}
  }

  function normalizeHub(h){
    const hub = str(h, '').trim();
    if(!hub) return '../hub.html';
    return hub;
  }

  function normalizeSeed(seed){
    const s = str(seed, '').trim();
    return s || String(Date.now());
  }

  function normalizePid(pid){
    const p = str(pid, '').trim();
    if(p) return p;
    try{
      const s = str(localStorage.getItem('HHA_PID') || '', '').trim();
      if(s) return s;
    }catch(_){}
    return 'anon';
  }

  function getCtx(){
    const view = str(qs('view', DOC.body.getAttribute('data-view') || 'mobile'), 'mobile').toLowerCase();
    const run  = str(qs('run',  DOC.body.getAttribute('data-run')  || 'play'),   'play').toLowerCase();
    const diff = str(qs('diff', DOC.body.getAttribute('data-diff') || 'normal'), 'normal').toLowerCase();

    const time = clamp(num(qs('time', '80'), 80), 20, 300);
    const seed = normalizeSeed(qs('seed', ''));
    const pid  = normalizePid(qs('pid', ''));

    const hub  = normalizeHub(qs('hub', '../hub.html'));

    // gate params passthrough (optional)
    const gate     = str(qs('gate',''), '').trim();          // "1" if using gate
    const gateUrl  = str(qs('gateUrl',''), '').trim();       // warmup-gate.html
    const cdGateUrl= str(qs('cdGateUrl',''), '').trim();     // cooldown gate (optional)
    const cdur     = clamp(num(qs('cdur','20'), 20), 5, 60);

    const debug = str(qs('debug','0'),'0') === '1';

    return { view, run, diff, time, seed, pid, hub, gate, gateUrl, cdGateUrl, cdur, debug };
  }

  function autoLoadVRUI(){
    // vr-ui.js lives at /herohealth/vr/vr-ui.js
    // This is safe to load multiple times; we guard id to avoid duplicates.
    if(!ensureOnce('hha-vr-ui-loader')) return;

    const s = DOC.createElement('script');
    s.id = 'hha-vr-ui-loader';
    s.src = '../vr/vr-ui.js';
    s.defer = true;
    s.onload = ()=>{ /* ok */ };
    s.onerror = ()=>{ /* ignore (no crash) */ };
    DOC.head.appendChild(s);
  }

  function start(){
    const ctx = getCtx();
    applyView(ctx.view);

    // Always try to load Universal VR UI (for cVR crosshair -> hha:shoot)
    autoLoadVRUI();

    // If user wants gating before play, let the launcher do it.
    // (We still pass through gateUrl/cdur so safe.js can redirect cooldown.)
    const opts = {
      view: ctx.view,
      run:  ctx.run,
      diff: ctx.diff,
      time: ctx.time,
      seed: ctx.seed,
      pid:  ctx.pid,
      hub:  ctx.hub,

      // passthrough optional gate params
      gate: ctx.gate,
      gateUrl: ctx.gateUrl || ctx.cdGateUrl || '../warmup-gate.html',
      cdur: ctx.cdur
    };

    try{
      safeBoot(opts);
    }catch(err){
      console.error('[GoodJunkVR boot] failed:', err);

      // fail-safe: show a minimal toast if possible
      try{
        const box = DOC.createElement('div');
        box.style.position='fixed';
        box.style.left='12px';
        box.style.right='12px';
        box.style.bottom='calc(12px + env(safe-area-inset-bottom,0px))';
        box.style.zIndex='99999';
        box.style.padding='12px 14px';
        box.style.borderRadius='16px';
        box.style.border='1px solid rgba(148,163,184,.18)';
        box.style.background='rgba(2,6,23,.78)';
        box.style.color='#e5e7eb';
        box.style.fontWeight='900';
        box.textContent='GoodJunkVR: Boot error (ดู console)';
        DOC.body.appendChild(box);
        setTimeout(()=>{ try{ box.remove(); }catch(_){} }, 3500);
      }catch(_){}
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', start, { once:true });
  }else{
    start();
  }
})();