// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (Tap-to-start + ctx + view normalize + stable overlays)
// PATCH v20260306-BRUSH-BOOT-ROOTFIX-NOSCROLL
// ✅ Tap-to-start unlock (mobile/vr)
// ✅ Parse ctx + passthrough hub/seed/time/view/diff/run/pid/studyId/phase/conditionGroup/log/api/ai/debug
// ✅ Normalize view: pc/mobile/cvr (auto if missing)
// ✅ Set documentElement.dataset.view + body data-view for vr-ui strict CSS
// ✅ Ensure menu shown first, end/quiz hidden (prevents "open summary on load")
// ✅ Safe: no crash if engine missing

(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return Number.isFinite(n)? n : d; };

  function detectViewAuto(){
    const qv = String(qs('view','')||'').toLowerCase().trim();
    if(qv) return qv;

    const ua = navigator.userAgent || '';
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(ua) ||
      (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches) ||
      (Math.min(screen.width, screen.height) <= 520);

    // มือถือปกติ: mobile (ให้ผู้ใช้ส่ง view=cvr เองถ้าเป็น cardboard)
    return isMobile ? 'mobile' : 'pc';
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase();
    if(v==='cardboard') return 'cvr';
    if(v==='vr') return 'cvr';
    if(v==='cvr') return 'cvr';
    if(v==='mobile') return 'mobile';
    return 'pc';
  }

  function buildCtx(){
    const view = normalizeView(detectViewAuto());

    // base params
    const hub  = qs('hub','') || '';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 80), 80);
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const run  = String(qs('run', qs('mode','play')||'play')||'play').toLowerCase();

    // passthrough research params
    const pid = String(qs('pid', qs('participantId','')||'')||'').trim();
    const studyId = String(qs('studyId','')||'').trim();
    const phase = String(qs('phase','')||'').trim();
    const conditionGroup = String(qs('conditionGroup','')||'').trim();
    const log = String(qs('log', qs('api','')||'')||'').trim(); // บางทีส่ง api มา
    const api = String(qs('api','')||'').trim();
    const ai  = String(qs('ai','1')) !== '0';
    const debug = String(qs('debug','0')) === '1';

    return {
      view, hub, seed, time, diff, run,
      pid, studyId, phase, conditionGroup,
      log, api, ai, debug
    };
  }

  function hardenInitialOverlays(){
    // กัน "เข้าแล้วเด้งสรุป" ด้วยการบังคับสถานะเริ่มต้น
    const wrap = DOC.getElementById('br-wrap');
    if(wrap){
      wrap.dataset.state = 'menu';
      wrap.dataset.view = wrap.dataset.view || '';
    }
    const menu = DOC.getElementById('br-menu');
    if(menu) menu.style.display = 'grid';

    const end = DOC.getElementById('br-end');
    if(end){
      end.hidden = true;
      end.style.display = 'none';
    }
    const quiz = DOC.getElementById('br-quiz');
    if(quiz){
      quiz.hidden = true;
      quiz.style.display = 'none';
    }
  }

  function applyViewToDOM(view){
    // สำคัญ: ให้ CSS (cVR strict) และ vr-ui.js เห็น view เดียวกัน
    try{ DOC.documentElement.dataset.view = view; }catch(_){}
    try{ DOC.body.setAttribute('data-view', view); }catch(_){}
    const wrap = DOC.getElementById('br-wrap');
    if(wrap) wrap.dataset.view = view;
  }

  // --- Tap-to-start (mobile unlock) ---
  function needTapStart(view){
    // บนมือถือ/คาร์ดบอร์ดควร unlock interaction ก่อน
    return (view === 'mobile' || view === 'cvr');
  }

  function setupTapStartThen(startFn, view){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    if(!needTapStart(view)){
      if(tap) tap.style.display = 'none';
      startFn();
      return;
    }

    // show overlay
    if(tap){
      tap.style.display = 'grid';
      tap.style.pointerEvents = 'auto';
    }

    const go = ()=>{
      try{ if(tap) tap.style.display='none'; }catch(_){}
      startFn();
    };

    if(btn){
      btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    }
    if(tap){
      tap.addEventListener('click', (e)=>{
        // allow tap outside card
        if(e.target === tap){ e.preventDefault(); go(); }
      }, {passive:false});
    }
  }

  // --- Boot engine ---
  function bootEngine(ctx){
    hardenInitialOverlays();
    applyViewToDOM(ctx.view);

    // optional: prevent page scroll via JS too (extra safety)
    try{
      DOC.body.style.overflow = 'hidden';
      DOC.documentElement.style.overflow = 'hidden';
    }catch(_){}

    // start engine
    if(!WIN.HHA_BRUSH || typeof WIN.HHA_BRUSH.boot !== 'function'){
      // allow direct IIFE safe.js (it runs immediately) OR namespaced boot (optional)
      // If safe.js is IIFE, then this will be fine; just no-op.
      if(ctx.debug) console.warn('[BrushVR] HHA_BRUSH.boot() not found (safe.js may be IIFE)');
      return;
    }

    WIN.HHA_BRUSH.boot({ ctx });
  }

  function main(){
    const ctx = buildCtx();

    // also expose for debugging
    WIN.HHA_BRUSH_CTX = ctx;

    // If url had view missing, we do NOT rewrite URL; only apply to DOM.
    applyViewToDOM(ctx.view);

    setupTapStartThen(()=> bootEngine(ctx), ctx.view);
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', main, {once:true});
  }else{
    main();
  }
})();