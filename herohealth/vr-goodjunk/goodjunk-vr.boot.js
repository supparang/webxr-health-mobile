// === /herohealth/vr-groups/groups-vr.boot.js ===
// GroupsVR Boot — PRODUCTION
// ✅ Auto-detect view WITHOUT overriding explicit ?view=
// ✅ Tap-to-start (user gesture gate) + fullscreen best-effort
// ✅ Starts GroupsVR.GameEngine safely once DOM + layer ready
// ✅ Passes run/diff/time/seed/ai/style/hub to engine
//
// Query:
//   view=pc|mobile|vr|cvr   (optional; if missing -> auto detect)
//   run=play|research|practice (default play)
//   diff=easy|normal|hard (default normal)
//   time=90 (sec)
//   seed=123 (u32 string ok)
//   ai=0|1 (default 1 for play, 0 for research/practice)
//   style=feel|mix|clean (optional; just sets body class)
//   hub=<urlencoded> (optional; for "Back to HUB" in overlay)
//

import './groups.safe.js'; // ensures window.GroupsVR.GameEngine exists

const DOC = document;
const WIN = window;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

const toInt = (v, def=0)=>{
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : def;
};

function clamp(v, a, b){
  v = Number(v); if (!isFinite(v)) v = a;
  return v < a ? a : (v > b ? b : v);
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if (view === 'pc') b.classList.add('view-pc');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function detectViewNoOverride(){
  // ✅ do NOT override explicit param
  const explicit = String(qs('view','')).toLowerCase();
  if (explicit) return explicit;

  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);
  const landscape = w >= h;

  // Heuristic:
  // - Touch + wide landscape -> cVR (cardboard style)
  // - Touch -> mobile
  // - Non-touch -> pc
  if (isTouch){
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function applyStyleClass(style){
  style = String(style||'').toLowerCase().trim();
  const b = DOC.body;
  b.classList.remove('style-feel','style-mix','style-clean');
  if (style === 'feel') b.classList.add('style-feel');
  else if (style === 'clean') b.classList.add('style-clean');
  else if (style === 'mix') b.classList.add('style-mix');
}

async function requestFullscreenBestEffort(){
  const el = DOC.documentElement;
  try{
    if (!DOC.fullscreenElement && el.requestFullscreen) {
      await el.requestFullscreen({ navigationUI: 'hide' });
      DOC.body.classList.add('is-fs');
    }
  }catch(_){}
}

function ensureTapOverlay(){
  let ov = DOC.querySelector('.tapStart');
  if (ov) return ov;

  ov = DOC.createElement('div');
  ov.className = 'tapStart';
  ov.innerHTML = `
    <div class="tapCard">
      <div class="tapTitle">แตะเพื่อเริ่ม</div>
      <div class="tapSub">Tap-to-start เพื่อปลดล็อกเสียง/การควบคุม</div>
      <div class="tapHint">ถ้าเป็น Cardboard ให้หมุนเป็นแนวนอนก่อน</div>
      <button class="tapBtn" type="button">START</button>
    </div>
  `;
  DOC.body.appendChild(ov);

  const btn = ov.querySelector('.tapBtn');
  if (btn){
    btn.addEventListener('click', ()=>bootFromGesture(), { passive:false });
    btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); bootFromGesture(); }, { passive:false });
  }
  ov.addEventListener('click', ()=>bootFromGesture(), { passive:true });

  return ov;
}

function hideTapOverlay(){
  const ov = DOC.querySelector('.tapStart');
  if (!ov) return;
  ov.classList.add('hidden');
  setTimeout(()=>{ try{ ov.remove(); }catch(_){} }, 220);
}

function safeGetEngine(){
  try{
    return WIN.GroupsVR && WIN.GroupsVR.GameEngine;
  }catch(_){
    return null;
  }
}

function ensureLayerEl(){
  // Prefer #fg-layer; fallback create
  let layer = DOC.getElementById('fg-layer');
  if (layer) return layer;

  layer = DOC.createElement('div');
  layer.id = 'fg-layer';
  layer.className = 'playLayer';
  DOC.body.appendChild(layer);
  return layer;
}

function parseConfig(){
  const run = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = clamp(toInt(qs('time', 90), 90), 5, 180);
  const seed = String(qs('seed', Date.now()));
  const view = String(detectViewNoOverride()).toLowerCase();
  const style = String(qs('style','')).toLowerCase();
  const hub = String(qs('hub','') || '');

  // ai:
  // - default: play=1, research/practice=0
  const aiParam = qs('ai', null);
  let aiOn = (run === 'play');
  if (aiParam != null) aiOn = String(aiParam) !== '0';

  return { run, diff, time, seed, view, style, aiOn, hub };
}

// ---- boot state ----
let __STARTED__ = false;
let __BOOTING__ = false;

function setHubLink(hub){
  if (!hub) return;
  try{
    const a = DOC.querySelector('[data-hub-link]');
    if (a) {
      a.setAttribute('href', hub);
      a.classList.remove('hidden');
    }
  }catch(_){}
}

function attachAIHooksIfNeeded(aiOn){
  // This is optional. If you later add ai-hooks.js that sets GroupsVR.__ai,
  // boot can just leave it alone when ai=0.
  try{
    if (!aiOn) {
      // ensure AI disabled if present
      if (WIN.GroupsVR && WIN.GroupsVR.__ai && WIN.GroupsVR.__ai.disableAll){
        WIN.GroupsVR.__ai.disableAll();
      }
      return;
    }
    // If aiOn, do nothing special. Hooks module (if loaded) can activate itself.
  }catch(_){}
}

function startEngine(cfg){
  if (__STARTED__) return;

  const engine = safeGetEngine();
  if (!engine || typeof engine.start !== 'function') {
    console.warn('[GroupsVR] Engine not ready');
    return;
  }

  const layer = ensureLayerEl();
  if (engine.setLayerEl) engine.setLayerEl(layer);

  // view classes + style
  setBodyView(cfg.view);
  applyStyleClass(cfg.style);

  // hub link for end overlay (if A has it)
  setHubLink(cfg.hub);

  attachAIHooksIfNeeded(cfg.aiOn);

  __STARTED__ = true;

  engine.start(cfg.diff, {
    runMode: cfg.run,
    time: cfg.time,
    seed: cfg.seed,
    view: cfg.view
  });

  hideTapOverlay();
}

function waitForDOMReady(){
  return new Promise((resolve)=>{
    if (DOC.readyState === 'complete' || DOC.readyState === 'interactive') return resolve();
    DOC.addEventListener('DOMContentLoaded', ()=>resolve(), { once:true });
  });
}

// ✅ Tap-to-start entry (user gesture gate)
async function bootFromGesture(){
  if (__BOOTING__ || __STARTED__) return;
  __BOOTING__ = true;

  const cfg = parseConfig();

  // best-effort fullscreen for cVR/VR/mobile
  if (cfg.view === 'cvr' || cfg.view === 'vr' || cfg.view === 'mobile'){
    await requestFullscreenBestEffort();
  }

  // IMPORTANT: any audio unlock would be done here if you add music
  // (create AudioContext/resume etc.)

  startEngine(cfg);

  __BOOTING__ = false;
}

// Auto show overlay immediately (so user knows to tap)
// But still allow “auto-start” for PC (no need gesture)
async function boot(){
  await waitForDOMReady();

  const cfg = parseConfig();

  // Always set body view early (so CSS bounds correct)
  setBodyView(cfg.view);
  applyStyleClass(cfg.style);

  // If PC (no gesture needed) => auto start
  if (cfg.view === 'pc'){
    ensureLayerEl();
    startEngine(cfg);
    return;
  }

  // For touch views -> require tap
  ensureTapOverlay();

  // Also allow “first tap anywhere” to start
  DOC.addEventListener('pointerdown', (e)=>{
    if (__STARTED__) return;
    // avoid starting when user is trying to click browser UI
    bootFromGesture();
  }, { once:true, passive:true });
}

boot();