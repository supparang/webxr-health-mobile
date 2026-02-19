// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + VR-UI + SAFE-ZONE)
// PATCH v2026-02-19e
//
// ✅ FIX: use WIN.GJ_BOOT consistently (no __GJ_BOOT__ mismatch)
// ✅ FIX: safe-zone measure uses .hud-top / .hud-bottom (not #hud full block)
// ✅ FIX: body.dataset.view set for UI wiring
// ✅ FIX: safer matchMedia check
// ✅ Keeps: auto view, vr-ui auto load, safe vars, resize/orientation recalc
'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

(function(){
  const WIN = window;
  const DOC = document;

  // Guard: avoid duplicate boot on hot reload / double script include
  if (WIN.GJ_BOOT && WIN.GJ_BOOT.started) {
    console.warn('[GJ BOOT] already started, skip');
    return;
  }
  WIN.GJ_BOOT = WIN.GJ_BOOT || {};
  WIN.GJ_BOOT.started = true;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const byId = (id)=>DOC.getElementById(id);

  function setRootVar(name, value){
    try{ DOC.documentElement.style.setProperty(name, String(value)); }catch(_){}
  }

  function getInsetPx(varName){
    // Reads CSS custom property if CSS already mapped env(safe-area-*)
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const raw = String(cs.getPropertyValue(varName) || '').trim();
      const n = Number(raw.replace('px','').trim());
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }

  function detectView(){
    const v = String(qs('view','')||'').toLowerCase().trim();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

    // heuristic: cvr if query hints stereo
    const hinted = String(qs('stereo','')||'').toLowerCase();
    if (hinted === '1' || hinted === 'true') return 'cvr';

    // PC if wide screen / no coarse pointer
    const w = DOC.documentElement.clientWidth || WIN.innerWidth || 800;
    let hasCoarse = false;
    try { hasCoarse = !!(WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches); } catch(_){}
    if (!hasCoarse && w >= 760) return 'pc';
    return 'mobile';
  }

  function computeSafeZones(){
    // ✅ Measure only top/bottom HUD sections, not #hud whole block
    const topbar   = DOC.querySelector('.gj-topbar');
    const hudTop   = DOC.querySelector('.hud-top') || DOC.querySelector('.gj-hud-top');
    const hudBot   = DOC.querySelector('.hud-bottom') || DOC.querySelector('.gj-hud-bot');
    const controls = DOC.querySelector('.hha-controls'); // topbar controls cluster (optional)

    const H = DOC.documentElement.clientHeight || WIN.innerHeight || 700;

    const sat = getInsetPx('--sat') || 0;
    const sab = getInsetPx('--sab') || 0;
    const sal = getInsetPx('--sal') || 0;
    const sar = getInsetPx('--sar') || 0;

    // write insets anyway (if CSS didn't define them, stays 0)
    setRootVar('--sat', `${sat}px`);
    setRootVar('--sab', `${sab}px`);
    setRootVar('--sal', `${sal}px`);
    setRootVar('--sar', `${sar}px`);

    function rectH(el){
      if(!el) return 0;
      try{
        const r = el.getBoundingClientRect();
        return Math.max(0, r.height || 0);
      }catch(_){ return 0; }
    }

    const topbarH   = rectH(topbar);
    const hudTopH   = rectH(hudTop);
    const hudBotH   = rectH(hudBot);
    const controlsH = rectH(controls);

    // top safe: topbar + top HUD + margin
    let topSafe = topbarH + hudTopH + 10;
    topSafe = clamp(topSafe, 110 + sat, Math.floor(H * 0.55));

    // bottom safe: bottom HUD + controls cluster + margin
    let bottomSafe = hudBotH + Math.max(0, controlsH - 8) + 10;
    bottomSafe = clamp(bottomSafe, 90 + sab, Math.floor(H * 0.50));

    // Short screens: squeeze safely
    if (H <= 640) {
      bottomSafe = clamp(bottomSafe, 80 + sab, Math.floor(H * 0.42));
      topSafe    = clamp(topSafe, 100 + sat, Math.floor(H * 0.50));
    }
    if (H <= 560) {
      bottomSafe = clamp(bottomSafe, 70 + sab, Math.floor(H * 0.38));
      topSafe    = clamp(topSafe, 92 + sat, Math.floor(H * 0.46));
    }

    setRootVar('--gj-top-safe', `${Math.round(topSafe)}px`);
    setRootVar('--gj-bottom-safe', `${Math.round(bottomSafe)}px`);

    // debug hook
    WIN.GJ_BOOT.safe = { topSafe, bottomSafe, topbarH, hudTopH, hudBotH, controlsH, H, sat, sab, sal, sar };
  }

  // Load script once (for vr-ui.js)
  function loadScriptOnce(src){
    return new Promise((resolve)=>{
      try{
        const key = '__LOADED__' + src;
        if (WIN[key]) return resolve(true);

        const exists = Array.from(DOC.scripts || []).some(s => (s.src || '').includes(src));
        if (exists){
          WIN[key] = true;
          return resolve(true);
        }

        const s = DOC.createElement('script');
        s.src = src;
        s.defer = true;
        s.onload = ()=>{ WIN[key] = true; resolve(true); };
        s.onerror = ()=>{ resolve(false); };
        DOC.head.appendChild(s);
      }catch(_){
        resolve(false);
      }
    });
  }

  async function ensureVrUi(view){
    // only load if VR/cVR or explicitly asked
    const need = (view === 'vr' || view === 'cvr' || String(qs('vrui','0')) === '1');
    if(!need) return;

    WIN.HHA_VRUI_CONFIG = WIN.HHA_VRUI_CONFIG || {};

    // stricter for cvr
    if (view === 'cvr') {
      WIN.HHA_VRUI_CONFIG.cvrStrict = true;
      WIN.HHA_VRUI_CONFIG.lockPx = Number(qs('lockPx','28')) || 28;
      WIN.HHA_VRUI_CONFIG.cooldownMs = Number(qs('cooldownMs','90')) || 90;
      WIN.HHA_VRUI_CONFIG.showCrosshair = true;
      WIN.HHA_VRUI_CONFIG.showButtons = true;
    }

    await loadScriptOnce('../vr/vr-ui.js?v=20260216a');
  }

  function bindBasicButtons(){
    // Optional end-overlay buttons (if page has them)
    const btnRestartTop = byId('btnRestartTop');
    const btnRestartEnd = byId('btnRestartEnd');
    const btnHubTop     = byId('btnHubTop');
    const btnBackHub    = byId('btnBackHub');

    function hubUrl(){
      return (qs('hub','../hub.html') || '../hub.html');
    }

    function restart(){
      const u = new URL(location.href);
      // bump seed in play mode to avoid cached/frozen feel
      if (String(qs('run','play')).toLowerCase() !== 'research') {
        u.searchParams.set('seed', String(Date.now()));
      }
      location.href = u.toString();
    }

    btnRestartTop && btnRestartTop.addEventListener('click', restart);
    btnRestartEnd && btnRestartEnd.addEventListener('click', restart);

    btnHubTop  && btnHubTop.addEventListener('click', ()=> location.href = hubUrl());
    btnBackHub && btnBackHub.addEventListener('click', ()=> location.href = hubUrl());
  }

  function guardIntervals(){
    // placeholder; keep no-op to avoid hidden duplicate interval logic
  }

  // ---------------- main ----------------
  async function main(){
    const view = detectView();
    WIN.GJ_BOOT.view = view;

    // Tag body for CSS + UI scripts
    DOC.body.classList.toggle('view-pc', view === 'pc');
    DOC.body.classList.toggle('view-mobile', view === 'mobile');
    DOC.body.classList.toggle('view-vr', view === 'vr');
    DOC.body.classList.toggle('view-cvr', view === 'cvr');
    DOC.body.dataset.view = view;

    // ensure VR UI if needed
    await ensureVrUi(view);

    // compute safe zones (after VR UI may inject controls)
    computeSafeZones();

    // bind base buttons
    bindBasicButtons();
    guardIntervals();

    // re-compute safe zone on resize/orientation + HUD toggle
    let raf = 0;
    const requestRecalc = ()=>{
      if (raf) return;
      raf = requestAnimationFrame(()=>{
        raf = 0;
        computeSafeZones();
      });
    };

    WIN.addEventListener('resize', requestRecalc, { passive:true });
    WIN.addEventListener('orientationchange', requestRecalc, { passive:true });

    DOC.addEventListener('click', (e)=>{
      const t = e.target;
      if(!t) return;
      const id = t.id || '';
      if (id === 'btnHideHud' || id === 'btnQuestOpen' || id === 'btnQuestClose' || id === 'btnMissions') {
        setTimeout(requestRecalc, 30);
        setTimeout(requestRecalc, 180);
      }
    }, { passive:true });

    // after fonts/layout settle
    setTimeout(requestRecalc, 180);
    setTimeout(requestRecalc, 600);

    // payload -> safe engine
    const payload = {
      view,
      run:  String(qs('run','play') || 'play'),
      diff: String(qs('diff','normal') || 'normal'),
      time: Number(qs('time','80') || 80),
      hub:  qs('hub', null),
      seed: qs('seed', null) ?? qs('ts', null),
      studyId: qs('studyId', qs('study', null)),
      phase: qs('phase', null),
      conditionGroup: qs('conditionGroup', qs('cond', null)),
    };

    // Start SAFE engine
    try{
      bootSafe(payload);
    }catch(err){
      console.error('[GJ BOOT] bootSafe failed:', err);
      try{
        const div = DOC.createElement('div');
        div.style.position = 'fixed';
        div.style.left = '12px';
        div.style.right = '12px';
        div.style.bottom = '12px';
        div.style.zIndex = '9999';
        div.style.padding = '10px 12px';
        div.style.borderRadius = '14px';
        div.style.background = 'rgba(255,80,80,.18)';
        div.style.border = '1px solid rgba(255,80,80,.35)';
        div.textContent = 'GoodJunkVR error: เปิด console ดูรายละเอียด';
        DOC.body.appendChild(div);
      }catch(_){}
    }
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', main, { once:true });
  } else {
    main();
  }
})();