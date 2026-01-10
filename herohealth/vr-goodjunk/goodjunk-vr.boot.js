// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ sets body view class
// ✅ toggles cVR dual layers (L/R)
// ✅ passes params to goodjunk.safe.js boot()
// ✅ does NOT duplicate listeners (safe handles gameplay + end)

import { boot as safeBoot } from './goodjunk.safe.js';

(function(){
  'use strict';
  const DOC = document;
  const ROOT = window;

  const qs = (k, def=null)=>{ try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; } };

  function setBodyView(view){
    const v = String(view||'mobile').toLowerCase();
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

    b.classList.add(
      v==='pc' ? 'view-pc' :
      v==='vr' ? 'view-vr' :
      v==='cvr'? 'view-cvr' : 'view-mobile'
    );
    return v;
  }

  function toggleEyeLayers(view){
    // L always visible, R only for cVR (split)
    const r = DOC.getElementById('gj-layer-r');
    if(!r) return;

    if(view === 'cvr'){
      r.setAttribute('aria-hidden','false');
      r.style.display = '';
    }else{
      r.setAttribute('aria-hidden','true');
      r.style.display = 'none';
    }
  }

  function buildPayload(){
    const view = setBodyView(qs('view','mobile'));
    toggleEyeLayers(view);

    const run = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = Number(qs('time','80') || 80);
    const seed = qs('seed', null);
    const hub  = qs('hub', null);

    // research context passthrough (optional)
    const studyId = qs('studyId', qs('study', null));
    const phase = qs('phase', null);
    const conditionGroup = qs('conditionGroup', qs('cond', null));

    // ✅ NEW: gradeMode passthrough
    const gradeMode = qs('gradeMode', null);

    return { view, run, diff, time, seed, hub, studyId, phase, conditionGroup, gradeMode };
  }

  function startOnce(){
    if(ROOT.__GJ_BOOTED__) return;
    ROOT.__GJ_BOOTED__ = true;

    const payload = buildPayload();

    // optional: expose for debug
    ROOT.__GJ_BOOT_PAYLOAD__ = payload;

    // start engine
    safeBoot(payload);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', startOnce, { once:true });
  }else{
    startOnce();
  }
})();