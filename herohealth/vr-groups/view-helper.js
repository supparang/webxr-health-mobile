// === /herohealth/vr-groups/view-helper.js ===
// ViewHelper — PRODUCTION (GroupsVR)
// ✅ set body class: view-pc / view-mobile / view-vr / view-cvr
// ✅ best-effort fullscreen + landscape (cVR)
// ✅ safe-area CSS vars + HUD safe top zone for vr-ui buttons
// ✅ mount helpers: getLayerEl(), ensureLayer(), ensureHudSafe()
// ✅ optional debug overlay (?debug=1) for "HUD up but no events" diagnosis
// Exposes: window.GroupsVR.ViewHelper

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC || WIN.__HHA_GROUPS_VIEWHELPER_LOADED__) return;
  WIN.__HHA_GROUPS_VIEWHELPER_LOADED__ = true;

  WIN.GroupsVR = WIN.GroupsVR || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const qs = (k, def=null)=>{
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  };

  function isLikelyMobile(){
    const ua = navigator.userAgent || '';
    return /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer: coarse)').matches);
  }

  function normalizeView(v){
    v = String(v||'').toLowerCase().trim();
    if (v === 'cardboard') v = 'cvr';
    if (v === 'vr') v = 'vr';
    if (v === 'cvr') return 'cvr';
    if (v === 'mobile') return 'mobile';
    if (v === 'pc') return 'pc';
    if (v === 'desktop') return 'pc';
    // fallback heuristic
    return isLikelyMobile() ? 'mobile' : 'pc';
  }

  // -----------------------------
  // Safe-area helpers
  // -----------------------------
  function setSafeAreaVars(){
    // CSS env() is handled by browser; here we add JS px vars for calculations if needed
    try{
      const r = DOC.documentElement;
      // visualViewport may exist on mobile
      const vv = WIN.visualViewport;
      const vw = vv ? vv.width : WIN.innerWidth;
      const vh = vv ? vv.height : WIN.innerHeight;

      r.style.setProperty('--hha-vw', Math.round(vw) + 'px');
      r.style.setProperty('--hha-vh', Math.round(vh) + 'px');
    }catch(_){}
  }

  // -----------------------------
  // Layer mount helpers
  // -----------------------------
  function getLayerEl(){
    return DOC.getElementById('playLayer') || DOC.querySelector('.playLayer') || DOC.body;
  }

  function ensureLayer(){
    // Make sure playLayer exists and is above the XR scene but below HUD/overlays
    let el = DOC.getElementById('playLayer');
    if (!el){
      el = DOC.createElement('div');
      el.id = 'playLayer';
      el.className = 'playLayer';
      DOC.body.appendChild(el);
    }
    // harden styles in case css failed to load
    try{
      const st = el.style;
      st.position = 'fixed';
      st.inset = '0';
      st.zIndex = '20';         // XR scene is behind, HUD usually 40+, overlays 80+
      st.pointerEvents = 'none';// targets inside will set pointer-events individually
    }catch(_){}
    return el;
  }

  // -----------------------------
  // HUD safe zone for vr-ui
  // -----------------------------
  function ensureHudSafe(view){
    // We leave actual layout to CSS, but we can set a "safe top" variable
    // so HUD doesn't cover EnterVR/Exit/Recenter (usually top-right / top).
    try{
      const b = DOC.body;
      const topBase = (view === 'cvr' || view === 'vr') ? 64 : 10; // px
      b.style.setProperty('--hha-hud-safe-top', topBase + 'px');
    }catch(_){}
  }

  // -----------------------------
  // Fullscreen / orientation (best effort)
  // -----------------------------
  async function requestFullscreen(){
    const el = DOC.documentElement;
    try{
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    }catch(_){}
  }

  async function lockLandscape(){
    try{
      const o = screen.orientation;
      if (o && o.lock) await o.lock('landscape');
    }catch(_){}
  }

  async function tryImmersiveForCVR(){
    // cVR usually needs fullscreen to feel "VR-like" even without true WebXR headset
    await requestFullscreen();
    await lockLandscape();
  }

  // -----------------------------
  // Debug overlay (optional)
  // -----------------------------
  let dbg = null;
  let dbgOn = false;

  function ensureDebug(){
    if (dbg) return dbg;
    dbg = DOC.createElement('div');
    dbg.id = 'hha-debug';
    dbg.style.cssText =
      'position:fixed;left:10px;bottom:10px;z-index:9999;' +
      'background:rgba(2,6,23,.72);color:#e5e7eb;border:1px solid rgba(148,163,184,.22);' +
      'border-radius:14px;padding:8px 10px;font:12px ui-monospace,monospace;' +
      'max-width:min(92vw,520px);pointer-events:none;backdrop-filter:blur(8px);';
    dbg.textContent = 'debug…';
    DOC.body.appendChild(dbg);
    return dbg;
  }

  function setDbg(text){
    if (!dbgOn) return;
    ensureDebug().textContent = String(text||'');
  }

  function installDebugListeners(){
    if (!dbgOn) return;

    let last = { time:0, score:0, quest:0, end:0 };
    const bump = (k)=>{ last[k] = Date.now(); };

    WIN.addEventListener('hha:time', ()=> bump('time'), { passive:true });
    WIN.addEventListener('hha:score',()=> bump('score'),{ passive:true });
    WIN.addEventListener('quest:update',()=> bump('quest'),{ passive:true });
    WIN.addEventListener('hha:end', ()=> bump('end'),  { passive:true });

    setInterval(()=>{
      const now = Date.now();
      const age = (t)=> t ? (now - t) : 999999;
      const view = String(qs('view','')||'').toLowerCase();
      const run  = String(qs('run','play')||'play').toLowerCase();
      const hasEngine = !!(WIN.GroupsVR && WIN.GroupsVR.GameEngine);
      const hasParticles = !!WIN.Particles;
      const hasFX = !!(WIN.GroupsVR && (WIN.GroupsVR.Effects || WIN.GroupsVR.EffectsPack));
      const hasUI = !!WIN.__HHA_VRUI_LOADED__;

      setDbg(
        `view=${view||'-'} run=${run} engine=${hasEngine?'OK':'NO'} ` +
        `vrui=${hasUI?'OK':'NO'} fx=${hasFX?'OK':'NO'} particles=${hasParticles?'OK':'NO'}\n` +
        `evt: time ${age(last.time)}ms | score ${age(last.score)}ms | quest ${age(last.quest)}ms | end ${age(last.end)}ms`
      );
    }, 600);
  }

  // -----------------------------
  // Main init
  // -----------------------------
  const ViewHelper = {
    _inited:false,
    _view:'pc',

    init(opts){
      if (this._inited) return;
      this._inited = true;

      const v = normalizeView((opts && opts.view) || qs('view',''));
      this._view = v;

      // set body classes
      const b = DOC.body;
      try{
        b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
        b.classList.add('view-'+v);
      }catch(_){}

      // always ensure layer exists (even if CSS fails)
      ensureLayer();
      ensureHudSafe(v);
      setSafeAreaVars();

      // respond to viewport changes
      try{
        WIN.addEventListener('resize', ()=>{ setSafeAreaVars(); ensureHudSafe(this._view); }, { passive:true });
        if (WIN.visualViewport){
          WIN.visualViewport.addEventListener('resize', ()=>{ setSafeAreaVars(); }, { passive:true });
        }
      }catch(_){}

      // optional debug
      const debug = String(qs('debug','0')||'0');
      dbgOn = (debug === '1' || debug === 'true');
      if (dbgOn) installDebugListeners();
    },

    getView(){ return this._view; },

    getLayerEl,
    ensureLayer,
    ensureHudSafe,

    async tryImmersiveForCVR(){
      // only apply for cVR
      if (normalizeView(qs('view','')) !== 'cvr' && this._view !== 'cvr') return;
      await tryImmersiveForCVR();
    }
  };

  WIN.GroupsVR.ViewHelper = ViewHelper;

  // tiny ready event
  try{
    WIN.dispatchEvent(new CustomEvent('groups:viewhelper_ready', { detail:{ ok:true } }));
  }catch(_){}
})();