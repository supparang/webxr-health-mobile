// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (CLEAN / NO DUP)
// ✅ view class (pc/mobile/vr/cvr) + layer-r toggle
// ✅ auto-load ../vr/vr-ui.js if missing (for Enter VR + crosshair -> hha:shoot)
// ✅ HUD-safe measure -> sets --gj-top-safe / --gj-bottom-safe (px)
// ✅ single End overlay renderer (listens hha:end only here)
// ✅ starts SAFE engine: ./goodjunk.safe.js
//
// v20260217c

'use strict';

import { boot as safeBoot } from './goodjunk.safe.js';

(function(){
  const WIN = window;
  const DOC = document;

  if(WIN.__GJ_BOOT__){
    console.warn('[GoodJunkVR] boot already initialized');
    return;
  }
  WIN.__GJ_BOOT__ = true;

  // ---------------- helpers ----------------
  const qs = (k, def=null)=>{
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  };
  const byId = (id)=> DOC.getElementById(id);
  const clamp = (v,min,max)=> (v<min?min:(v>max?max:v));
  const px = (n)=> `${Math.max(0, Math.floor(Number(n)||0))}px`;

  function hardReloadWithNewSeed(){
    const u = new URL(location.href);
    u.searchParams.set('seed', String(Date.now()));
    location.href = u.toString();
  }

  function safeHubUrl(){
    const h = (qs('hub', null) || '').trim();
    return h || '../hub.html';
  }

  // ---------------- view + run params ----------------
  const view = String(qs('view','mobile')||'mobile').toLowerCase();
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(Number(qs('time','80')||80), 20, 300);
  const seed = (qs('seed', null) || (run==='research' ? (qs('ts', null) || 'RESEARCH-SEED') : String(Date.now())));

  // ---------------- body view classes ----------------
  function applyViewClass(){
    DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    DOC.body.classList.add(
      view==='pc' ? 'view-pc' :
      view==='vr' ? 'view-vr' :
      view==='cvr'? 'view-cvr' : 'view-mobile'
    );

    // cVR uses both layers; otherwise hide right layer
    const r = byId('gj-layer-r');
    if(r){
      const isCVR = (view === 'cvr');
      r.setAttribute('aria-hidden', isCVR ? 'false' : 'true');
    }
  }
  applyViewClass();

  // ---------------- chip text (optional) ----------------
  const chipMode = byId('chipMode');
  const chipDiff = byId('chipDiff');
  const chipTime = byId('chipTime');
  if(chipMode) chipMode.textContent = `mode: ${run}`;
  if(chipDiff) chipDiff.textContent = `diff: ${diff}`;
  if(chipTime) chipTime.textContent = `time: ${time}s`;

  // ---------------- auto-load VR UI ----------------
  // vr-ui.js dispatches hha:shoot and provides Enter VR / Exit / Recenter buttons + crosshair
  function ensureVrUiLoaded(){
    return new Promise((resolve)=>{
      try{
        if(WIN.__HHA_VRUI_LOADED__ || WIN.__HHA_VRUI__){
          resolve(true);
          return;
        }

        // set default config (you can override via window.HHA_VRUI_CONFIG before load)
        WIN.HHA_VRUI_CONFIG = Object.assign({
          lockPx: 28,
          cooldownMs: 90,
          showCrosshair: true,
          showButtons: true,
          cvrStrict: true,   // in cVR: aim from center
        }, WIN.HHA_VRUI_CONFIG || {});

        const s = DOC.createElement('script');
        s.src = '../vr/vr-ui.js?v=20260217c';
        s.defer = true;
        s.onload = ()=> resolve(true);
        s.onerror = ()=> resolve(false);
        DOC.head.appendChild(s);
      }catch(_){
        resolve(false);
      }
    });
  }

  // ---------------- HUD-safe measurement ----------------
  // sets CSS vars used by safe.js: --gj-top-safe / --gj-bottom-safe
  function updateSafeVars(){
    try{
      const sat = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')) || 0;

      const topbar = DOC.querySelector('.gj-topbar');
      const hudTop  = DOC.querySelector('.gj-hud-top');
      const hudBot  = DOC.querySelector('.gj-hud-bot');

      const topbarH = topbar ? topbar.getBoundingClientRect().height : 0;
      const hudTopH = hudTop ? hudTop.getBoundingClientRect().height : 0;
      const botH    = hudBot ? hudBot.getBoundingClientRect().height : 0;

      // If HUD hidden, reduce safe area (spawn can use more space)
      const hudHidden = DOC.body.classList.contains('hud-hidden');

      const topSafe = hudHidden
        ? (topbarH + 10 + sat)            // minimal
        : (topbarH + hudTopH + 14 + sat); // comfortable

      const bottomSafe = hudHidden
        ? (90 + 10)                       // minimal (still allow low-time overlay feel)
        : (botH + 16);

      DOC.documentElement.style.setProperty('--gj-top-safe', px(topSafe));
      DOC.documentElement.style.setProperty('--gj-bottom-safe', px(bottomSafe));
    }catch(_){}
  }

  function attachSafeVarObservers(){
    updateSafeVars();
    WIN.addEventListener('resize', updateSafeVars, { passive:true });
    WIN.addEventListener('orientationchange', updateSafeVars, { passive:true });

    // run a few times early (fonts/layout settle)
    setTimeout(updateSafeVars, 0);
    setTimeout(updateSafeVars, 80);
    setTimeout(updateSafeVars, 180);
    setTimeout(updateSafeVars, 360);

    // if quest panel opens/closes, recalc
    const questPanel = byId('questPanel');
    if(questPanel){
      const mo = new MutationObserver(()=> updateSafeVars());
      mo.observe(questPanel, { attributes:true, attributeFilter:['aria-hidden'] });
    }

    // if HUD hidden toggled, recalc
    const btnHideHud = byId('btnHideHud');
    if(btnHideHud){
      btnHideHud.addEventListener('click', ()=> setTimeout(updateSafeVars, 0), { passive:true });
    }
  }
  attachSafeVarObservers();

  // ---------------- end overlay (single owner) ----------------
  function attachEndOverlay(){
    const endOverlay = byId('endOverlay');
    if(!endOverlay) return;

    const endTitle = byId('endTitle');
    const endSub   = byId('endSub');
    const endGrade = byId('endGrade');
    const endScore = byId('endScore');
    const endMiss  = byId('endMiss');
    const endTime  = byId('endTime');

    const btnRestartEnd = byId('btnRestartEnd');
    const btnBackHub    = byId('btnBackHub');

    btnRestartEnd && btnRestartEnd.addEventListener('click', hardReloadWithNewSeed);
    btnBackHub    && btnBackHub.addEventListener('click', ()=> { location.href = safeHubUrl(); });

    function showEnd(d){
      try{
        const reason = String(d?.reason || 'timeup');
        if(endTitle) endTitle.textContent = (reason === 'miss-limit' || reason === 'missLimit') ? 'Game Over' : 'Completed';

        if(endSub){
          endSub.textContent =
            `reason=${reason} | mode=${d?.runMode || run} | view=${d?.device || view} | diff=${d?.diff || diff}`;
        }
        if(endGrade) endGrade.textContent = d?.grade || '—';
        if(endScore) endScore.textContent = String(d?.scoreFinal ?? 0);
        if(endMiss)  endMiss.textContent  = String(d?.misses ?? 0);
        if(endTime)  endTime.textContent  = String(Math.round(Number(d?.durationPlayedSec || 0)));

        endOverlay.setAttribute('aria-hidden','false');
      }catch(_){}
    }

    // guard: avoid double-binding by using a flag
    if(WIN.__GJ_END_BIND__) return;
    WIN.__GJ_END_BIND__ = true;

    WIN.addEventListener('hha:end', (ev)=> showEnd(ev?.detail || null), { passive:true });
    DOC.addEventListener('hha:end', (ev)=> showEnd(ev?.detail || null), { passive:true });

    // top buttons (optional)
    const btnRestartTop = byId('btnRestartTop');
    const btnHubTop     = byId('btnHubTop');
    btnRestartTop && btnRestartTop.addEventListener('click', hardReloadWithNewSeed);
    btnHubTop && btnHubTop.addEventListener('click', ()=> { location.href = safeHubUrl(); });
  }
  attachEndOverlay();

  // ---------------- start SAFE engine ----------------
  async function startGame(){
    // ensure vr-ui for vr/cvr
    if(view === 'vr' || view === 'cvr'){
      await ensureVrUiLoaded();
    }

    // IMPORTANT: call safe engine once
    if(WIN.__GJ_SAFE_STARTED__) return;
    WIN.__GJ_SAFE_STARTED__ = true;

    safeBoot({
      view,
      run,
      diff,
      time,
      seed,
      hub: qs('hub', null),

      // research params passthrough (optional)
      studyId: qs('studyId', qs('study', null)),
      phase: qs('phase', null),
      conditionGroup: qs('conditionGroup', qs('cond', null)),
    });

    // one more safe-var update after start (HUD may reflow)
    setTimeout(updateSafeVars, 80);
  }

  // Start after DOM is ready enough
  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', startGame, { once:true });
  }else{
    startGame();
  }

})();