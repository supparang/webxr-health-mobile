// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + VR-UI + SAFE-ZONE)
// FULL v2026-02-20-bootB-onceHub
//
// ✅ Auto detect view (pc/mobile/cvr/vr) + allow override via ?view=
// ✅ Auto load ../vr/vr-ui.js once (ENTER VR/EXIT/RECENTER + crosshair + hha:shoot)
// ✅ Compute safe zones -> sets :root CSS vars:
//    --gj-top-safe, --gj-bottom-safe, --sat/--sab/--sal/--sar
// ✅ HUD-safe spawn: prevents targets under topbar/hud/bottom meters
// ✅ No duplicate listeners (guards with window.GJ_BOOT)
// ✅ End overlay: CLEAN (safe.js controls aria-hidden; boot only binds buttons if present)
// ✅ HUB: default ไป /herohealth/hub.html (absolute) + still respects ?hub=
// ✅ PATCH: bindBasicButtons รองรับ "id เดิม + id มาตรฐาน" + onOnce + กัน bind ซ้ำ
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
  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const byId = (id)=>DOC.getElementById(id);

  function setRootVar(name, value){
    try{ DOC.documentElement.style.setProperty(name, String(value)); }catch(_){}
  }
  function getInsetPx(varName){
    // read resolved CSS var from :root (expects CSS sets --sat/--sab/...)
    try{
      const cs = getComputedStyle(DOC.documentElement);
      const v = cs.getPropertyValue(varName).trim();
      const n = Number(String(v).replace('px','').trim());
      return Number.isFinite(n) ? n : 0;
    }catch(_){ return 0; }
  }

  // onOnce: prevent duplicate listener binding per-element + event type
  function onOnce(el, type, handler, opts){
    if(!el) return false;
    try{
      const key = '__once_' + type;
      if (el[key]) return false;
      el[key] = true;
      el.addEventListener(type, handler, opts || false);
      return true;
    }catch(_){
      try{ el.addEventListener(type, handler, opts || false); }catch(__){}
      return true;
    }
  }

  function detectView(){
    const v = String(qs('view','')||'').toLowerCase().trim();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') return v;

    // heuristic: cvr if query stereo=1/true (hub may pass this)
    const hinted = String(qs('stereo','')||'').toLowerCase();
    if (hinted === '1' || hinted === 'true') return 'cvr';

    // PC if wide screen / has mouse (not coarse pointer)
    const w = DOC.documentElement.clientWidth || innerWidth || 800;
    const hasCoarse = (typeof matchMedia === 'function') && matchMedia('(pointer: coarse)').matches;
    if (!hasCoarse && w >= 760) return 'pc';
    return 'mobile';
  }

  function computeSafeZones(){
    // measure fixed UI blocks to compute safe spawn zones
    const topbar = DOC.querySelector('.gj-topbar');
    const hudTop = byId('hud') || DOC.querySelector('.gj-hud-top');
    const hudBot = DOC.querySelector('.gj-hud-bot');
    const controls = DOC.querySelector('.hha-controls'); // optional (topbar right cluster)

    const H = DOC.documentElement.clientHeight || innerHeight || 700;

    const sat = getInsetPx('--sat') || 0;
    const sab = getInsetPx('--sab') || 0;
    const sal = getInsetPx('--sal') || 0;
    const sar = getInsetPx('--sar') || 0;

    // write insets anyway (if CSS didn't define them)
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

    // bottom: meters + optional controls cluster; add sab
    const hudBotH = rectH(hudBot);
    const controlsH = rectH(controls);

    // top safe: topbar + (some hud) + margin
    let topSafe = topbarH + hudTopH + 10;
    topSafe = clamp(topSafe, 110 + sat, Math.floor(H * 0.55));

    // bottom safe: bottom meters + controls + margin
    let bottomSafe = hudBotH + Math.max(0, controlsH - 8) + 10;
    bottomSafe = clamp(bottomSafe, 90 + sab, Math.floor(H * 0.50));

    // If very short screen, shrink to leave play room
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

    // Provide optional config for vr-ui
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
    if (raw) return raw; // trust explicit hub param

    // default to main hub (repo root)
    // https://supparang.github.io/webxr-health-mobile/herohealth/hub.html
    const base = location.origin + '/webxr-health-mobile';
    return base + '/herohealth/hub.html';
  }

  // PATCH: supports legacy ids + standard ids
  function bindBasicButtons(){
    // Standard ids (in-folder run html)
    const btnRestart = byId('btnRestart');
    const btnHub     = byId('btnHub');

    // Legacy ids (older templates)
    const btnRestartTop = byId('btnRestartTop');
    const btnRestartEnd = byId('btnRestartEnd');
    const btnHubTop     = byId('btnHubTop');
    const btnBackHub    = byId('btnBackHub');

    const restartEls = [btnRestart, btnRestartTop, btnRestartEnd].filter(Boolean);
    const hubEls     = [btnHub, btnHubTop, btnBackHub].filter(Boolean);

    function restart(){
      const u = new URL(location.href);
      // avoid freeze/cached state: bump seed in play mode
      if (String(qs('run','play')).toLowerCase() !== 'research') {
        u.searchParams.set('seed', String(Date.now()));
      }
      location.href = u.toString();
    }

    function goHub(){
      location.href = resolveHubUrl();
    }

    // bind once each element
    for(const el of restartEls) onOnce(el, 'click', restart);
    for(const el of hubEls)     onOnce(el, 'click', goHub);
  }

  // Prevent "ค้าง" from stacking intervals (future expansion)
  function guardIntervals(){}

  // ---------------- main ----------------
  async function main(){
    const view = detectView();
    WIN.GJ_BOOT.view = view;

    DOC.body.classList.toggle('view-pc', view === 'pc');
    DOC.body.classList.toggle('view-mobile', view === 'mobile');
    DOC.body.classList.toggle('view-vr', view === 'vr');
    DOC.body.classList.toggle('view-cvr', view === 'cvr');

    await ensureVrUi(view);

    // compute safe zones (after VR UI buttons may inject)
    computeSafeZones();

    // bind base buttons (once)
    bindBasicButtons();
    guardIntervals();

    // re-compute safe zone on resize/orientation + when HUD toggled
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

    // When user toggles HUD or quest panel, update safe rect quickly
    DOC.addEventListener('click', (e)=>{
      const t = e.target;
      if(!t) return;
      const id = t.id || '';
      if (id === 'btnHideHud' || id === 'btnQuestOpen' || id === 'btnQuestClose' || id === 'btnMissions' || id === 'btnClosePeek') {
        setTimeout(requestRecalc, 30);
        setTimeout(requestRecalc, 180);
      }
    }, { passive:true });

    // also update after fonts/layout settle
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