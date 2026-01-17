// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (A+B+C compatible)
// ✅ Auto view detect (pc/mobile/vr/cvr) — never override if ?view= exists
// ✅ Loads vr-ui.js already included in HTML (adds ENTER VR/EXIT/RECENTER + crosshair + tap-to-shoot)
// ✅ Sets body classes: view-* and hud-hidden sync
// ✅ Passes params to goodjunk.safe.js boot()
// ✅ No duplicate end overlay handlers here (safe.js owns end overlay)
// ✅ Emits: hha:boot meta for debugging

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function qsn(k, def=0){
  const v = qs(k, null);
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}
function lower(x){ return String(x||'').toLowerCase(); }

function detectView(){
  // Respect explicit view if provided
  const explicit = lower(qs('view', ''));
  if(explicit) return explicit;

  // Auto detect
  const ua = navigator.userAgent || '';
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const isStandalone = !!(navigator.standalone || matchMedia('(display-mode: standalone)').matches);

  // If WebXR supported & likely headset -> vr
  // NOTE: on mobile Cardboard, we still call it 'vr' only when user enters VR;
  // default to 'mobile' to avoid layout surprises.
  const xr = (navigator.xr ? true : false);

  // If user opened with ?cvr=1 or dual-eye layout hint
  const cvr = lower(qs('cvr', ''));
  if(cvr === '1' || cvr === 'true') return 'cvr';

  // If big screen -> pc
  const w = DOC.documentElement.clientWidth || innerWidth;
  if(!isMobile && w >= 920) return 'pc';

  // if mobile + standalone + xr -> still mobile (user can enter VR)
  if(isMobile) return 'mobile';

  // fallback
  return 'pc';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function syncHudHidden(){
  // allow ?hud=0 to hide
  const hud = qs('hud', null);
  if(hud === '0' || hud === 'false'){
    DOC.body.classList.add('hud-hidden');
  }
}

function updateSafeVars(){
  // If HTML already measures and sets vars, this will just be overwritten/confirmed.
  // Goodjunk.safe.js uses:
  //  --gj-top-safe / --gj-bottom-safe
  try{
    const sat = parseFloat(getComputedStyle(DOC.documentElement).getPropertyValue('--sat')) || 0;

    const topbar = DOC.getElementById('gjTopbar')?.getBoundingClientRect().height || 0;
    const hudTop = DOC.getElementById('gjHudTop')?.getBoundingClientRect().height || 0;
    const hudBot = DOC.getElementById('gjHudBot')?.getBoundingClientRect().height || 0;

    const topSafe = Math.floor(topbar + hudTop + 16 + sat);
    const botSafe = Math.floor(Math.max(110, hudBot + 18));

    DOC.documentElement.style.setProperty('--gj-top-safe', `${topSafe}px`);
    DOC.documentElement.style.setProperty('--gj-bottom-safe', `${botSafe}px`);
  }catch(_){}
}

function bootOnce(){
  if(ROOT.__GJ_BOOTED__) return;
  ROOT.__GJ_BOOTED__ = true;

  const view = lower(qs('view', '')) || detectView();
  setBodyView(view);
  syncHudHidden();

  // Make sure safe vars are set early (spawn won't hit HUD)
  updateSafeVars();
  setTimeout(updateSafeVars, 120);
  setTimeout(updateSafeVars, 360);

  // Gather run params
  const payload = {
    view, // pc/mobile/vr/cvr
    run:  lower(qs('run','play')),
    diff: lower(qs('diff','normal')),
    time: qsn('time', 80),

    // research passthrough
    seed: qs('seed', null),
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),

    // hub passthrough
    hub: qs('hub', null),
  };

  // Expose meta (debug)
  try{
    ROOT.__GJ_META__ = payload;
    ROOT.dispatchEvent(new CustomEvent('hha:boot', { detail: { game:'GoodJunkVR', payload } }));
  }catch(_){}

  // Safety: if vr-ui.js exists, optionally tweak config per game
  // (Do not hard override; only if not set by page)
  try{
    ROOT.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, ROOT.HHA_VRUI_CONFIG || {});
  }catch(_){}

  // Start engine
  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR] engine boot failed:', err);
    // minimal visible error
    try{
      const el = DOC.createElement('div');
      el.style.cssText = `
        position:fixed; inset:0; z-index:9999;
        display:flex; align-items:center; justify-content:center;
        padding:24px; background:rgba(2,6,23,.92); color:#e5e7eb;
        font: 700 14px/1.4 system-ui;
      `;
      el.innerHTML = `<div style="max-width:720px">
        <div style="font-size:18px;margin-bottom:8px">Boot error</div>
        <div style="opacity:.8">เปิด console ดูรายละเอียด แล้วส่ง error message มาได้เลย</div>
        <pre style="white-space:pre-wrap;margin-top:12px;opacity:.9">${String(err && err.message || err)}</pre>
      </div>`;
      DOC.body.appendChild(el);
    }catch(_){}
  }
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(bootOnce);
window.addEventListener('resize', ()=>{ updateSafeVars(); }, { passive:true });
window.addEventListener('orientationchange', ()=>{ setTimeout(updateSafeVars, 0); }, { passive:true });