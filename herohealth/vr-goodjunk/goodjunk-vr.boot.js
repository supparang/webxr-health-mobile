// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (CLEAN / NO DUP LISTENERS) — v20260217c
// Purpose:
//  - Load VR UI (vr-ui.js) once
//  - Boot GoodJunk SAFE engine once
//  - Wire end overlay + basic buttons safely
//  - Keep it non-crashing even if optional modules missing

'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

(function(){
  const WIN = window;
  const DOC = document;

  if (WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  // ---------------- helpers ----------------
  const qs = (k, def=null)=>{
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };

  function clamp(v,min,max){
    v = Number(v);
    if(!Number.isFinite(v)) v = min;
    return Math.max(min, Math.min(max, v));
  }

  function pickView(){
    const v = String(qs('view','') || '').toLowerCase();
    if(v==='pc' || v==='mobile' || v==='vr' || v==='cvr') return v;

    // heuristic: wide => pc, otherwise mobile
    const W = DOC.documentElement.clientWidth || 360;
    if(W >= 900) return 'pc';
    return 'mobile';
  }

  function ensureQueryDefaults(){
    const u = new URL(location.href);
    let changed = false;

    if(!u.searchParams.get('run')){
      u.searchParams.set('run', 'play');
      changed = true;
    }
    if(!u.searchParams.get('diff')){
      u.searchParams.set('diff', 'normal');
      changed = true;
    }
    if(!u.searchParams.get('time')){
      u.searchParams.set('time', '80');
      changed = true;
    }

    // view default
    if(!u.searchParams.get('view')){
      u.searchParams.set('view', pickView());
      changed = true;
    }

    // seed default (play => now, research => keep)
    const run = String(u.searchParams.get('run')||'play').toLowerCase();
    if(!u.searchParams.get('seed') && run !== 'research'){
      u.searchParams.set('seed', String(Date.now()));
      changed = true;
    }

    if(changed){
      // replace to avoid history spam
      location.replace(u.toString());
      return true;
    }
    return false;
  }

  // If we injected defaults and reloaded, stop here.
  if(ensureQueryDefaults()) return;

  // ---------------- params ----------------
  const P = {
    run:  String(qs('run','play')||'play').toLowerCase(),
    diff: String(qs('diff','normal')||'normal').toLowerCase(),
    time: clamp(qs('time','80'), 20, 300),
    view: String(qs('view', pickView())||pickView()).toLowerCase(),
    seed: String(qs('seed','') || ''),
    hub:  qs('hub', '../hub.html'),
    api:  qs('api', null),

    // research passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  // ---------------- DOM refs ----------------
  const LAYER_R = DOC.getElementById('gj-layer-r');
  const chipMode = DOC.getElementById('chipMode');
  const chipDiff = DOC.getElementById('chipDiff');
  const chipTime = DOC.getElementById('chipTime');

  function setChip(el, txt){ if(el) el.textContent = txt; }

  setChip(chipMode, `mode: ${P.run}`);
  setChip(chipDiff, `diff: ${P.diff}`);
  setChip(chipTime, `time: ${P.time}s`);

  // cVR: show right-eye layer
  if(LAYER_R){
    const isCVR = (P.view === 'cvr');
    LAYER_R.setAttribute('aria-hidden', isCVR ? 'false' : 'true');
  }

  // ---------------- VR UI loader (once) ----------------
  function ensureVRUI(){
    // already loaded by something else
    if(WIN.__HHA_VRUI__ || WIN.__HHA_VRUI_LOADED__) return Promise.resolve(true);
    WIN.__HHA_VRUI_LOADED__ = true;

    // optional per-game tuning
    WIN.HHA_VRUI_CONFIG = WIN.HHA_VRUI_CONFIG || {
      lockPx: 28,
      cooldownMs: 90,
      showCrosshair: true,
      showButtons: true,
      cvrStrict: true
    };

    return new Promise((resolve)=>{
      const s = DOC.createElement('script');
      s.src = '../vr/vr-ui.js?v=20260217c';
      s.async = true;
      s.onload = ()=> resolve(true);
      s.onerror = ()=> resolve(false);
      DOC.head.appendChild(s);
    });
  }

  // ---------------- End overlay wiring (CLEAN) ----------------
  const endOverlay = DOC.getElementById('endOverlay');
  const endTitle   = DOC.getElementById('endTitle');
  const endSub     = DOC.getElementById('endSub');
  const endGrade   = DOC.getElementById('endGrade');
  const endScore   = DOC.getElementById('endScore');
  const endMiss    = DOC.getElementById('endMiss');
  const endTime    = DOC.getElementById('endTime');

  const btnRestartEnd = DOC.getElementById('btnRestartEnd');
  const btnBackHub    = DOC.getElementById('btnBackHub');

  function showEnd(summary){
    if(!endOverlay) return;

    const grade = summary?.grade ?? '—';
    const score = summary?.scoreFinal ?? summary?.score ?? 0;
    const miss  = summary?.misses ?? summary?.miss ?? 0;
    const dur   = summary?.durationPlayedSec ?? 0;
    const reason= summary?.reason ?? 'completed';

    if(endTitle) endTitle.textContent = 'Completed';
    if(endSub)   endSub.textContent = `เหตุผล: ${reason}`;
    if(endGrade) endGrade.textContent = String(grade);
    if(endScore) endScore.textContent = String(score);
    if(endMiss)  endMiss.textContent  = String(miss);
    if(endTime)  endTime.textContent  = String(dur);

    endOverlay.setAttribute('aria-hidden', 'false');
    DOC.body.classList.add('end-open');
  }

  function hideEnd(){
    if(!endOverlay) return;
    endOverlay.setAttribute('aria-hidden', 'true');
    DOC.body.classList.remove('end-open');
  }

  // Restart (force new seed in play mode)
  function restart(){
    const u = new URL(location.href);
    if(P.run !== 'research'){
      u.searchParams.set('seed', String(Date.now()));
    }
    // keep other params
    location.href = u.toString();
  }

  function goHub(){
    location.href = String(P.hub || '../hub.html');
  }

  // attach end buttons safely (avoid duplicate)
  function wireBtnOnce(id, fn){
    const el = DOC.getElementById(id);
    if(!el) return;
    const key = `__wired_${id}`;
    if(el[key]) return;
    el[key] = true;
    el.addEventListener('click', fn);
  }

  wireBtnOnce('btnRestartTop', restart);
  wireBtnOnce('btnHubTop', goHub);
  wireBtnOnce('btnRestartEnd', restart);
  wireBtnOnce('btnBackHub', goHub);

  // if user taps outside end card (optional close)
  if(endOverlay){
    endOverlay.addEventListener('click', (e)=>{
      if(e.target === endOverlay) hideEnd();
    });
  }

  // listen hha:end once
  WIN.addEventListener('hha:end', (ev)=>{
    try{
      const d = ev?.detail || null;
      showEnd(d);

      // optional: cloud logger flush if available
      if(WIN.HHACloudLogger && typeof WIN.HHACloudLogger.flush === 'function'){
        WIN.HHACloudLogger.flush();
      }
    }catch(_){}
  }, { passive:true });

  // ---------------- Optional cloud logger init ----------------
  function tryStartCloudLogger(){
    try{
      // if the logger script is present, it may expose one of these
      const L = WIN.HHACloudLogger || WIN.HeroHealthCloudLogger || null;
      if(!L) return;

      if(typeof L.setEndpoint === 'function' && P.api){
        L.setEndpoint(P.api);
      }
      if(typeof L.start === 'function'){
        L.start({ projectTag:'GoodJunkVR' });
      }
    }catch(_){}
  }

  // ---------------- Boot SAFE engine ----------------
  function bootGame(){
    // prevent duplicate
    if(WIN.__GJ_GAME_BOOTED__) return;
    WIN.__GJ_GAME_BOOTED__ = true;

    // start optional logger (won't crash if absent)
    tryStartCloudLogger();

    // call safe boot
    bootSafe({
      view: P.view,
      diff: P.diff,
      run:  P.run,
      time: P.time,
      seed: P.seed,
      hub:  P.hub,

      // research passthrough
      studyId: P.studyId,
      phase: P.phase,
      conditionGroup: P.conditionGroup
    });
  }

  // Ensure VRUI (for VR/cVR) then boot game.
  // For pc/mobile, VRUI can still exist (ENTER VR + recenter), harmless.
  ensureVRUI().finally(bootGame);

})();