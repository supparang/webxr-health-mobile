// === /herohealth/hydration-vr/hydration-vr.loader.js ===
// Hydration VR Loader — PRODUCTION (path-safe + view autodetect)
// ✅ Auto view: pc / mobile / cardboard (cVR)
// ✅ Sets body classes + HHA_VIEW.layers for safe.js (L/R)
// ✅ Robust dynamic import with multiple candidate paths (case-sensitive safe)
// ✅ Emits hha:start when user taps Start (or auto if overlay hidden)
//
// Usage in HTML (module):
// <script type="module" src="./hydration-vr.loader.js"></script>

'use strict';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };
const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

function detectView(){
  // Priority: explicit view param
  const v = String(qs('view','')||'').toLowerCase();
  if (v) return v;

  // Heuristic
  const ua = (navigator.userAgent||'').toLowerCase();
  const isMobile = /android|iphone|ipad|ipod|mobile/.test(ua) || (Math.min(screen.width,screen.height) <= 820);
  return isMobile ? 'mobile' : 'pc';
}

function wantsCardboard(){
  // allow explicit cardboard/cvr
  const v = String(qs('view','')||'').toLowerCase();
  if (v === 'cvr' || v === 'cardboard') return true;

  // optional flag
  const cb = String(qs('cardboard','')||'').toLowerCase();
  if (cb === '1' || cb === 'true') return true;

  return false;
}

function setBodyClasses(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-cvr','cardboard');
  if (view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');

  if (wantsCardboard()){
    b.classList.add('view-cvr','cardboard');
  }
}

function setupLayers(){
  // Expect these IDs in HTML:
  // - hydration-layer (normal)
  // - hydration-layerL / hydration-layerR (cardboard)
  const main = DOC.getElementById('hydration-layer');
  const L = DOC.getElementById('hydration-layerL');
  const R = DOC.getElementById('hydration-layerR');

  const isCB = DOC.body.classList.contains('cardboard');

  // expose to safe.js
  WIN.HHA_VIEW = WIN.HHA_VIEW || {};
  if (isCB && L && R){
    WIN.HHA_VIEW.layers = ['hydration-layerL','hydration-layerR'];
    if (main) main.style.display = 'none';
    L.style.display = '';
    R.style.display = '';
  } else {
    WIN.HHA_VIEW.layers = ['hydration-layer'];
    if (main) main.style.display = '';
    if (L) L.style.display = 'none';
    if (R) R.style.display = 'none';
  }
}

function bindStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');

  function start(){
    try{ WIN.dispatchEvent(new CustomEvent('hha:start')); }catch(_){}
    if (ov) ov.classList.add('hide');
  }

  if (btn){
    btn.addEventListener('click', (e)=>{
      try{ e.preventDefault(); }catch(_){}
      start();
    });
  }

  // If overlay hidden already -> auto start (safety)
  setTimeout(()=>{
    const hidden = !ov || getComputedStyle(ov).display === 'none' || ov.classList.contains('hide');
    if (hidden) start();
  }, 650);
}

async function importSafe(){
  // ✅ IMPORTANT: correct local file path is ./hydration.safe.js
  // We'll still try a couple of legacy candidates for resilience.
  const tried = [];

  const candidates = [
    './hydration.safe.js',
    './hydration.safe.mjs',
    '../hydration-vr/hydration.safe.js',
    '../hydration.safe.js'
  ];

  for (const p of candidates){
    tried.push(p);
    try{
      await import(p);
      return { ok:true, path:p, tried };
    }catch(err){
      // keep trying
    }
  }
  return { ok:false, path:'', tried };
}

function showImportError(info){
  const box = DOC.getElementById('importError');
  if (!box) return;

  box.hidden = false;
  const urlEl = box.querySelector('[data-k="url"]');
  const baseEl = box.querySelector('[data-k="base"]');
  const triedEl = box.querySelector('[data-k="tried"]');
  const errEl = box.querySelector('[data-k="err"]');

  if (urlEl) urlEl.textContent = location.href;
  if (baseEl) baseEl.textContent = location.href;
  if (triedEl) triedEl.textContent = info?.tried?.map((s,i)=>`${i+1}. ${s}`).join('\n') || '';
  if (errEl) errEl.textContent = 'Error: All candidate imports failed.';
}

async function main(){
  const view = detectView(); // pc/mobile
  setBodyClasses(view);
  setupLayers();
  bindStartOverlay();

  const res = await importSafe();
  if (!res.ok){
    showImportError(res);
    return;
  }

  // optional: debug stamp
  WIN.__HHA_HYDRATION_SAFE_PATH__ = res.path;
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}