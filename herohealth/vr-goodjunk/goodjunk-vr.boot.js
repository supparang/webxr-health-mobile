// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FAIR PACK)
// ✅ Reads qs: view/run/diff/time/seed/hub/log/style
// ✅ Sets body view class: view-pc / view-mobile / view-vr / view-cvr
// ✅ Updates chip meta + keep UI stable
// ✅ Boots goodjunk.safe.js exactly once
// ✅ Safe: delay until DOM ready + measure safe zones already handled by HTML

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};
const has = (k)=>{
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
};

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='cardboard') return 'vr';
  if(v==='vr') return 'vr';
  if(v==='cvr' || v==='view-cvr') return 'cvr';
  if(v==='pc') return 'pc';
  if(v==='mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function setChipMeta(){
  const chip = DOC.getElementById('gjChipMeta');
  if(!chip) return;
  const v = normalizeView(qs('view','auto'));
  const run  = String(qs('run','play')||'play');
  const diff = String(qs('diff','normal')||'normal');
  const time = String(qs('time','80')||'80');
  chip.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function applyRunStyle(){
  // optional style hook (e.g., style=mix) — keep safe if missing
  const style = String(qs('style','')||'').toLowerCase().trim();
  if(!style) return;
  DOC.documentElement.setAttribute('data-style', style);
}

function setupBackHub(){
  // HTML already wires btnBackHub, but keep fallback safety
  const hub = qs('hub', null);
  const btn = DOC.getElementById('btnBackHub');
  if(!btn) return;
  btn.addEventListener('click', ()=>{
    if(hub) location.href = hub;
  }, { passive:true });
}

function setupHideHudSafeRecalc(){
  // When HUD hidden, HTML toggles class + updateSafe(); this is a safe fallback
  const btn = DOC.getElementById('btnHideHud');
  if(!btn) return;

  function pokeResize(){
    try{
      WIN.dispatchEvent(new Event('resize'));
    }catch(_){}
  }

  btn.addEventListener('click', ()=>{
    // HTML already toggles and calls updateSafe; we just help layout settle
    setTimeout(pokeResize, 0);
    setTimeout(pokeResize, 120);
    setTimeout(pokeResize, 360);
  }, { passive:true });
}

function bootOnce(){
  if(WIN.__GJ_BOOTED__) return;
  WIN.__GJ_BOOTED__ = true;

  const view = normalizeView(qs('view', 'mobile'));
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = Number(qs('time','80')||'80') || 80;

  // Deterministic seed in research, otherwise allow param or timestamp
  let seed = qs('seed', null);
  if(!seed){
    seed = (run==='research') ? '12345' : String(Date.now());
  }

  setBodyView(view);
  setChipMeta();
  applyRunStyle();
  setupBackHub();
  setupHideHudSafeRecalc();

  // Engine boot
  engineBoot({ view, run, diff, time, seed });
}

function whenReady(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
    fn();
  }else{
    DOC.addEventListener('DOMContentLoaded', fn, { once:true });
  }
}

// Give HTML safe-zone measurement a beat to set CSS vars,
// but do NOT delay too long.
whenReady(()=>{
  setTimeout(bootOnce, 0);
  setTimeout(bootOnce, 120);
});