// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR BOOT — FAIR PACK (B / v2.0)
// ✅ Sets body view class (view=pc/mobile/vr/cvr) without overriding existing params
// ✅ Waits a beat for safe-zone measure (--gj-top-safe/--gj-bottom-safe) before boot()
// ✅ Wires Missions Peek + Hide HUD already in HTML (this file doesn't duplicate)
// ✅ Starts goodjunk.safe.js boot()
// Notes:
// - vr-ui.js emits hha:shoot (crosshair/tap-to-shoot). Engine listens inside goodjunk.safe.js.

'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; } };
const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch{ return false; } };

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'mobile') return 'mobile';
  if(v === 'pc') return 'pc';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(view === 'pc' ? 'view-pc'
    : view === 'vr' ? 'view-vr'
    : view === 'cvr' ? 'view-cvr'
    : 'view-mobile');
}

function updateChipMeta(){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  const v = qs('view','auto');
  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  el.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

// Wait until DOM ready
function onReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    fn();
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

// Ensure safe vars exist (HTML wiring sets them later; we just wait a bit)
function waitForSafeVars(timeoutMs=900){
  const start = performance.now();
  return new Promise((resolve)=>{
    const tick = ()=>{
      const top = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-top-safe')) || 0;
      const bot = parseInt(getComputedStyle(DOC.documentElement).getPropertyValue('--gj-bottom-safe')) || 0;

      // "good enough": both numbers non-trivial
      if(top >= 80 && bot >= 80){
        resolve(true);
        return;
      }
      if(performance.now() - start > timeoutMs){
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function parseOpts(){
  const view = normalizeView(qs('view','mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||80) || 80;
  const seed = qs('seed', null) || String(Date.now());

  return { view, run, diff, time, seed };
}

async function bootNow(){
  updateChipMeta();

  const opts = parseOpts();
  setBodyView(opts.view);

  // Give UI a moment to measure safe zone and apply CSS vars
  await waitForSafeVars(900);

  // Also re-check after HUD toggle / resize: engine uses vars each spawn via getSafeRect()
  // (no need to re-init engine; it reads vars live)

  // Start engine
  try{
    engineBoot(opts);
  }catch(err){
    console.error('[GoodJunkVR] boot failed:', err);
    alert('GoodJunkVR boot error — ดู console ได้เลย');
  }
}

onReady(()=>{
  // If user opens with run=menu or something later, you can branch here.
  // For now: always boot.
  bootNow();
});