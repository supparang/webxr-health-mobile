// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — FINAL v20260220b
// ✅ Auto detect view (pc/mobile/cvr/vr) + ?view override
// ✅ Load ../vr/vr-ui.js only when needed (vr/cvr or ?vrui=1)
// ✅ Compute safe-zones -> CSS vars (--gj-top-safe / --gj-bottom-safe)
// ✅ Bind buttons in ONE place (supports old IDs + standard IDs)
// ✅ onOnce guard (กัน bind ซ้ำ)
// ✅ resolveHubUrl default -> /webxr-health-mobile/herohealth/hub.html (absolute)
// ✅ No duplicate engine boot

'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

(function(){
  const WIN = window;
  const DOC = document;

  // prevent duplicate boot (double module include / hot reload)
  if (WIN.GJ_BOOT && WIN.GJ_BOOT.started) {
    console.warn('[GJ BOOT] already started; skip duplicate');
    return;
  }
  WIN.GJ_BOOT = WIN.GJ_BOOT || {};
  WIN.GJ_BOOT.started = true;

  // ---------------- helpers ----------------
  const clamp = (v,min,max)=>Math.max(min, Math.min(max, v));
  const byId = (id)=>DOC.getElementById(id);
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

  function setRootVar(name, value){
    try { DOC.documentElement.style.setProperty(name, String(value)); } catch(_){}
  }

  function onOnce(el, type, fn, opts){
    if(!el || !type || !fn) return;
    try{
      const key = `__gj_once_${type}`;
      if (el[key]) return;
      el.addEventListener(type, fn, opts || false);
      el[key] = true;
    }catch(_){}
  }

  function getInsetPx(varName){
    // read computed custom property (--sat / --sab / ...)
    try{
      const v = getComputedStyle(DOC.documentElement).getPropertyValue(varName).trim();
      const n = Number(String(v).replace('px','').trim());
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }

  function detectView(){
    const qv = String(qs('view','') || '').toLowerCase().trim();
    if (['pc','mobile','vr','cvr'].includes(qv)) return qv;

    // heuristic stereo hint
    const stereo = String(qs('stereo','') || '').toLowerCase();
    if (stereo === '1' || stereo === 'true') return 'cvr';

    // very rough PC/mobile heuristic
    const w = DOC.documentElement.clientWidth || WIN.innerWidth || 800;
    const coarse = !!(WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches);
    if (!coarse && w >= 760) return 'pc';
    return 'mobile';
  }

  async function loadScriptOnce(src){
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
        s.onerror = ()=> resolve(false);
        DOC.head.appendChild(s);
      }catch(_){
        resolve(false);
      }
    });
  }

  async function ensureVrUi(view){
    const need = (view === 'vr' || view === 'cvr' || String(qs('vrui','0')) === '1');
    if (!need) return;

    WIN.HHA_VRUI_CONFIG = WIN.HHA_VRUI_CONFIG || {};
    if (view === 'cvr'){
      WIN.HHA_VRUI_CONFIG.cvrStrict   = true;
      WIN.HHA_VRUI_CONFIG.lockPx      = Number(qs('lockPx','28')) || 28;
      WIN.HHA_VRUI_CONFIG.cooldownMs  = Number(qs('cooldownMs','90')) || 90;
      WIN.HHA_VRUI_CONFIG.showCrosshair = true;
      WIN.HHA_VRUI_CONFIG.showButtons   = true;
    }

    await loadScriptOnce('../vr/vr-ui.js?v=20260216a');
  }

  // absolute default HUB (fix ../hub.html พลาด path)
  function resolveHubUrl(){
    const raw = qs('hub', null);
    if (raw) return raw;

    // repo root on GitHub Pages
    const base = location.origin + '/webxr-health-mobile';
    return base + '/herohealth/hub.html';
  }

  function computeSafeZones(){
    const topbar   = DOC.querySelector('.gj-topbar');
    const hudTop   = byId('hud') || DOC.querySelector('.gj-hud-top');
    const hudBot   = DOC.querySelector('.gj-hud-bot');
    const controls = DOC.querySelector('.hha-controls');

    const H = DOC.documentElement.clientHeight || WIN.innerHeight || 700;

    // ensure inset vars exist
    const sat = getInsetPx('--sat');
    const sab = getInsetPx('--sab');
    const sal = getInsetPx('--sal');
    const sar = getInsetPx('--sar');

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

    let topSafe = topbarH + hudTopH + 10;
    let botSafe = hudBotH + Math.max(0, controlsH - 8) + 10;

    topSafe = clamp(topSafe, 110 + sat, Math.floor(H * 0.56));
    botSafe = clamp(botSafe,  90 + sab, Math.floor(H * 0.52));

    if (H <= 740){
      topSafe = clamp(topSafe, 100 + sat, Math.floor(H * 0.52));
      botSafe = clamp(botSafe,  82 + sab, Math.floor(H * 0.46));
    }
    if (H <= 620){
      topSafe = clamp(topSafe,  90 + sat, Math.floor(H * 0.48));
      botSafe = clamp(botSafe,  70 + sab, Math.floor(H * 0.40));
    }

    setRootVar('--gj-top-safe', `${Math.round(topSafe)}px`);
    setRootVar('--gj-bottom-safe', `${Math.round(botSafe)}px`);

    WIN.GJ_BOOT.safe = {
      topSafe, botSafe, H,
      topbarH, hudTopH, hudBotH, controlsH,
      sat, sab, sal, sar
    };
  }

  function bindBasicButtons(){
    // รองรับ id เดิม + id มาตรฐาน
    const btnRestartTop = byId('btnRestartTop') || byId('btnRestart');
    const btnRestartEnd = byId('btnRestartEnd');
    const btnHubTop     = byId('btnHubTop') || byId('btnHub');
    const btnBackHub    = byId('btnBackHub');

    const btnMissions   = byId('btnMissions');
    const btnHideHud    = byId('btnHideHud');

    const missionsPeek  = byId('missionsPeek');
    const btnClosePeek  = byId('btnClosePeek');

    const chipMode      = byId('chipMode');
    const chipDiff      = byId('chipDiff');

    const peekGoal      = byId('peekGoal');
    const peekMini      = byId('peekMini');

    // chips
    if (chipMode) chipMode.textContent = `mode: ${String(qs('run','play'))}`;
    if (chipDiff) chipDiff.textContent = `diff: ${String(qs('diff','normal'))}`;

    function restart(){
      const u = new URL(location.href);

      // play mode -> bump seed to avoid same state/cache oddities
      const run = String(qs('run','play')).toLowerCase();
      if (run !== 'research'){
        u.searchParams.set('seed', String(Date.now()));
      }

      // optional: close overlay state (if any future params)
      location.href = u.toString();
    }

    function goHub(){
      location.href = resolveHubUrl();
    }

    function syncHudBtn(){
      const hidden = DOC.body.classList.contains('hud-hidden');
      if (btnHideHud) btnHideHud.textContent = hidden ? 'แสดง HUD' : 'ซ่อน HUD';
    }

    function toggleHud(){
      DOC.body.classList.toggle('hud-hidden');
      syncHudBtn();
      requestRecalcSafe();
    }

    function showPeek(on){
      if(!missionsPeek) return;
      if (on){
        missionsPeek.setAttribute('aria-hidden','false');
        DOC.body.classList.add('quest-open');
      }else{
        missionsPeek.setAttribute('aria-hidden','true');
        DOC.body.classList.remove('quest-open');
      }
      requestRecalcSafe();
    }

    function safeText(x){ return (x == null) ? '—' : String(x); }

    function onQuestUpdate(ev){
      try{
        const goal = ev?.detail?.goal || null;
        const mini = ev?.detail?.mini || null;

        if (peekGoal){
          if (goal){
            peekGoal.textContent = `GOAL: ${safeText(goal.title)} (${safeText(goal.cur)}/${safeText(goal.target)})`;
          }else{
            peekGoal.textContent = 'GOAL: —';
          }
        }

        if (peekMini){
          if (mini){
            if (mini.type === 'fast_hits'){
              peekMini.textContent =
                `MINI: ${safeText(mini.title)} (${safeText(mini.cur)}/${safeText(mini.target)}) < ${safeText(mini.thrMs)}ms`;
            } else if (typeof mini.timeLeftSec === 'number'){
              peekMini.textContent =
                `MINI: ${safeText(mini.title)} (${safeText(mini.cur)}/${safeText(mini.target)}) • ${Math.ceil(mini.timeLeftSec)}s`;
            } else if (mini.timerText) {
              peekMini.textContent =
                `MINI: ${safeText(mini.title)} • ${safeText(mini.timerText)}`;
            } else {
              peekMini.textContent =
                `MINI: ${safeText(mini.title)} (${safeText(mini.cur)}/${safeText(mini.target)})`;
            }
          }else{
            peekMini.textContent = 'MINI: —';
          }
        }
      }catch(_){}
    }

    // bind once
    onOnce(btnRestartTop, 'click', restart);
    onOnce(btnRestartEnd, 'click', restart);
    onOnce(btnHubTop, 'click', goHub);
    onOnce(btnBackHub, 'click', goHub);

    onOnce(btnHideHud, 'click', toggleHud);
    syncHudBtn();

    onOnce(btnMissions, 'click', ()=>showPeek(true));
    onOnce(btnClosePeek, 'click', ()=>showPeek(false));

    if (missionsPeek && !missionsPeek.__gj_bgclose_bound){
      missionsPeek.addEventListener('click', (e)=>{
        if (e.target === missionsPeek) showPeek(false);
      });
      missionsPeek.__gj_bgclose_bound = true;
    }

    if (!WIN.__gj_quest_update_bound){
      WIN.addEventListener('quest:update', onQuestUpdate, { passive:true });
      DOC.addEventListener('quest:update', onQuestUpdate, { passive:true });
      WIN.__gj_quest_update_bound = true;
    }

    // expose debug helpers
    WIN.GJ_BOOT.goHub = goHub;
    WIN.GJ_BOOT.restart = restart;
  }

  // throttled safe-zone recompute
  let recalcRAF = 0;
  function requestRecalcSafe(){
    if (recalcRAF) return;
    recalcRAF = requestAnimationFrame(()=>{
      recalcRAF = 0;
      computeSafeZones();
    });
  }

  function tagBodyView(view){
    DOC.body.classList.toggle('view-pc', view === 'pc');
    DOC.body.classList.toggle('view-mobile', view === 'mobile');
    DOC.body.classList.toggle('view-vr', view === 'vr');
    DOC.body.classList.toggle('view-cvr', view === 'cvr');
  }

  function makePayload(view){
    return {
      view,
      run: String(qs('run','play') || 'play'),
      diff: String(qs('diff','normal') || 'normal'),
      time: Number(qs('time','80') || 80),
      hub: qs('hub', null),
      seed: qs('seed', null) ?? qs('ts', null),
      studyId: qs('studyId', qs('study', null)),
      phase: qs('phase', null),
      conditionGroup: qs('conditionGroup', qs('cond', null)),
    };
  }

  async function main(){
    const view = detectView();
    WIN.GJ_BOOT.view = view;

    tagBodyView(view);

    // load vr-ui only when needed
    await ensureVrUi(view);

    // bind UI controls (single source of truth)
    bindBasicButtons();

    // compute safe zones after layout settles
    computeSafeZones();
    setTimeout(requestRecalcSafe, 80);
    setTimeout(requestRecalcSafe, 220);
    setTimeout(requestRecalcSafe, 600);

    // events -> recompute safe zones
    WIN.addEventListener('resize', requestRecalcSafe, { passive:true });
    WIN.addEventListener('orientationchange', requestRecalcSafe, { passive:true });

    // if user toggles VR UI buttons etc, layout may shift
    if (!DOC.__gj_click_watch_bound){
      DOC.addEventListener('click', (e)=>{
        const t = e.target;
        if (!t) return;
        const id = t.id || '';
        if (
          id === 'btnHideHud' ||
          id === 'btnMissions' ||
          id === 'btnClosePeek' ||
          id === 'btnQuestOpen' ||
          id === 'btnQuestClose'
        ){
          setTimeout(requestRecalcSafe, 16);
          setTimeout(requestRecalcSafe, 140);
        }
      }, { passive:true });
      DOC.__gj_click_watch_bound = true;
    }

    // boot engine once
    if (!WIN.GJ_BOOT.engineStarted){
      WIN.GJ_BOOT.engineStarted = true;
      try{
        bootSafe(makePayload(view));
      }catch(err){
        console.error('[GJ BOOT] bootSafe failed:', err);
        try{
          const div = DOC.createElement('div');
          div.style.cssText = [
            'position:fixed','left:12px','right:12px','bottom:12px','z-index:9999',
            'padding:10px 12px','border-radius:14px',
            'background:rgba(255,80,80,.18)','border:1px solid rgba(255,80,80,.35)',
            'color:#fff','font:600 13px system-ui'
          ].join(';');
          div.textContent = 'GoodJunkVR error: เปิด console ดูรายละเอียด';
          DOC.body.appendChild(div);
        }catch(_){}
      }
    } else {
      console.warn('[GJ BOOT] engine already started, skip bootSafe()');
    }
  }

  if (DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', main, { once:true });
  } else {
    main();
  }
})();