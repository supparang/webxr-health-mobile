// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + VR-UI + SAFE-ZONE)
// v2026-02-18d + HUBFIX v2026-02-19b
//
// ✅ Auto detect view (pc/mobile/cvr/vr) + allow override via ?view=
// ✅ Auto load ../vr/vr-ui.js once (ENTER VR/EXIT/RECENTER + crosshair + hha:shoot)
// ✅ Compute safe zones -> sets :root CSS vars:
//    --gj-top-safe, --gj-bottom-safe, --sat/--sab/--sal/--sar
// ✅ HUD-safe spawn: prevents targets under topbar/hud/bottom meters
// ✅ No duplicate listeners (guards with window.GJ_BOOT)
// ✅ End overlay: CLEAN (safe.js controls aria-hidden; boot only binds buttons if present)
// ✅ FIX HUB: default ไป /herohealth/hub.html (absolute) + still respects ?hub=
// ✅ PATCH B: bindBasicButtons รองรับ id เดิม + id มาตรฐาน + onOnce
//
// Requires:
// - goodjunk.safe.js exports boot({view,diff,run,time,hub,seed,...})
// - goodjunk-vr.html includes IDs used by safe.js + optional end overlay buttons.

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
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const byId = (id)=>DOC.getElementById(id);

  function setRootVar(name, value){
    try{ DOC.documentElement.style.setProperty(name, String(value)); }catch(_){}
  }
  function getInsetPx(envName){
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const v = cs.getPropertyValue(envName).trim();
      const n = Number(String(v).replace('px','').trim());
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }

  // ✅ onOnce: ป้องกันการ bind ซ้ำ (คลิกแล้วยิงหลาย handler)
  function onOnce(el, type, handler, opts){
    if(!el) return;
    try{
      const key = `__onOnce_${type}`;
      if(el.dataset && el.dataset[key] === '1') return;
      if(el.dataset) el.dataset[key] = '1';
      el.addEventListener(type, handler, opts);
    }catch(_){}
  }

  // ✅ findFirst: หา element จากหลาย id (รองรับ id เดิม + มาตรฐาน)
  function findFirst(ids){
    for(const id of (ids || [])){
      const el = byId(id);
      if(el) return el;
    }
    return null;
  }

  function detectView(){
    const v = String(qs('view','')||'').toLowerCase().trim();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

    // heuristic: cvr if query view=cvr or stereo hint
    const hinted = String(qs('stereo','')||'').toLowerCase();
    if (hinted === '1' || hinted === 'true') return 'cvr';

    // PC if wide screen / has mouse
    const w = DOC.documentElement.clientWidth || innerWidth || 800;
    const hasCoarse = (typeof matchMedia === 'function') && matchMedia('(pointer: coarse)').matches;
    if (!hasCoarse && w >= 760) return 'pc';
    return 'mobile';
  }

  function computeSafeZones(){
    const topbar = DOC.querySelector('.gj-topbar');
    const hudTop = byId('hud') || DOC.querySelector('.gj-hud-top');
    const hudBot = DOC.querySelector('.gj-hud-bot');
    const controls = DOC.querySelector('.hha-controls'); // optional

    const H = DOC.documentElement.clientHeight || innerHeight || 700;

    const sat = getInsetPx('--sat') || 0;
    const sab = getInsetPx('--sab') || 0;
    const sal = getInsetPx('--sal') || 0;
    const sar = getInsetPx('--sar') || 0;

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

    const topbarH = rectH(topbar);
    const hudTopH = rectH(hudTop);

    const hudBotH = rectH(hudBot);
    const controlsH = rectH(controls);

    let topSafe = topbarH + hudTopH + 10;
    topSafe = clamp(topSafe, 110 + sat, Math.floor(H * 0.55));

    let bottomSafe = hudBotH + Math.max(0, controlsH - 8) + 10;
    bottomSafe = clamp(bottomSafe, 90 + sab, Math.floor(H * 0.50));

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
    const need = (view === 'vr' || view === 'cvr' || String(qs('vrui','0')) === '1');
    if(!need) return;

    WIN.HHA_VRUI_CONFIG = WIN.HHA_VRUI_CONFIG || {};
    if (view === 'cvr') {
      WIN.HHA_VRUI_CONFIG.cvrStrict = true;
      WIN.HHA_VRUI_CONFIG.lockPx = Number(qs('lockPx','28')) || 28;
      WIN.HHA_VRUI_CONFIG.cooldownMs = Number(qs('cooldownMs','90')) || 90;
      WIN.HHA_VRUI_CONFIG.showCrosshair = true;
      WIN.HHA_VRUI_CONFIG.showButtons = true;
    }

    await loadScriptOnce('../vr/vr-ui.js?v=20260216a');
  }

  // ✅ HUB url resolver (absolute default + respects ?hub=)
  function resolveHubUrl(){
    const raw = qs('hub', null);
    if (raw) return raw;

    // default to main hub in repo root:
    // https://supparang.github.io/webxr-health-mobile/herohealth/hub.html
    const base = location.origin + '/webxr-health-mobile';
    return base + '/herohealth/hub.html';
  }

  // ✅ PATCH B: รองรับ id เดิม + id มาตรฐาน + onOnce
  function bindBasicButtons(){
    // Restart buttons (support old+standard)
    const btnRestartTop = findFirst([
      'btnRestartTop',      // standard
      'btnRestart',         // old
      'btnRestartGame',     // alt
      'restartBtn',         // alt
      'restart'             // alt
    ]);

    const btnRestartEnd = findFirst([
      'btnRestartEnd',      // standard end overlay
      'btnRestartEndGame',  // alt
      'btnPlayAgain',       // alt
      'btnReplay',          // alt
      'replayBtn'           // alt
    ]);

    // Hub buttons (support old+standard)
    const btnHubTop = findFirst([
      'btnHubTop',          // standard
      'btnHub',             // old
      'btnHome',            // alt
      'btnBackToHub',       // alt
      'hubBtn'              // alt
    ]);

    const btnBackHub = findFirst([
      'btnBackHub',         // standard end overlay
      'btnBack',            // old
      'btnBackToHome',      // alt
      'btnExitToHub',       // alt
      'backBtn'             // alt
    ]);

    function restart(){
      const u = new URL(location.href);

      // bump seed only in play (avoid breaking research repeatability)
      if (String(qs('run','play')).toLowerCase() !== 'research') {
        u.searchParams.set('seed', String(Date.now()));
      }

      // remove hash to avoid weird caching on mobile
      u.hash = '';
      location.href = u.toString();
    }

    function goHub(){
      location.href = resolveHubUrl();
    }

    onOnce(btnRestartTop, 'click', restart, { passive:true });
    onOnce(btnRestartEnd, 'click', restart, { passive:true });

    onOnce(btnHubTop, 'click', goHub, { passive:true });
    onOnce(btnBackHub, 'click', goHub, { passive:true });
  }

  function guardIntervals(){
    // kept for future expansion
  }

  // ---------------- main ----------------
  async function main(){
    const view = detectView();
    WIN.GJ_BOOT.view = view;

    DOC.body.classList.toggle('view-pc', view === 'pc');
    DOC.body.classList.toggle('view-mobile', view === 'mobile');
    DOC.body.classList.toggle('view-vr', view === 'vr');
    DOC.body.classList.toggle('view-cvr', view === 'cvr');

    await ensureVrUi(view);

    computeSafeZones();
    bindBasicButtons();
    guardIntervals();

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
      if (id === 'btnHideHud' || id === 'btnQuestOpen' || id === 'btnQuestClose') {
        setTimeout(requestRecalc, 30);
        setTimeout(requestRecalc, 180);
      }
    }, { passive:true });

    setTimeout(requestRecalc, 180);
    setTimeout(requestRecalc, 600);

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