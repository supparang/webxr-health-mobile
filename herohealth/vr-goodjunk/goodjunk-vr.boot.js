// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (AUTO VIEW + HHA Standard)
// ✅ If ?view= exists => DO NOT override
// ✅ Else auto-detect: cVR / VR / mobile / pc
// ✅ Sets body classes: view-pc | view-mobile | view-vr | view-cvr (+ run/diff)
// ✅ Ensures vr-ui.js is present (if not, injects it once)
// ✅ Boots engine: import { boot } from './goodjunk.safe.js' and calls with payload
// ✅ Pass-through: hub/run/diff/time/seed/studyId/phase/conditionGroup/style/log/etc.

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function hasParam(k){
  try { return new URL(location.href).searchParams.has(k); }
  catch { return false; }
}
function toLower(x, def=''){
  return String(x ?? def).toLowerCase();
}

function detectMobile(){
  const ua = (navigator.userAgent || '').toLowerCase();
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  const small = Math.min(DOC.documentElement.clientWidth||0, DOC.documentElement.clientHeight||0) <= 860;
  return touch && (small || /android|iphone|ipad|ipod|mobile/.test(ua));
}
function detectCardboardOrVRHint(){
  // Heuristic: if query says vr or cardboard in style/run links; or WebXR available
  // Not forcing VR mode; just helps pick view=vr when user uses VR pages.
  const style = toLower(qs('style',''));
  const v = toLower(qs('v',''));
  const hint = /vr|cardboard|stereo/.test(style) || /vr|cardboard/.test(v);
  const xr = !!(navigator.xr);
  return hint || xr;
}
function detectCVR(){
  // "cVR strict" = split-layer + crosshair shooting (phone-in-cardboard style)
  // If explicitly requested by ?view=cvr => handled elsewhere
  // Heuristic: if ?cvr=1 or ?stereo=1
  const cvr = qs('cvr', null);
  const stereo = qs('stereo', null);
  if(String(cvr) === '1' || String(stereo) === '1') return true;

  // If user uses split-layer in CSS or wants center shooting: ?view=cvr recommended
  // Here we keep heuristic conservative.
  return false;
}

function autoView(){
  // RULE: if user already set ?view=, DO NOT override
  if(hasParam('view')){
    return toLower(qs('view','mobile'), 'mobile');
  }

  // else detect
  if(detectCVR()) return 'cvr';

  // if mobile device: default mobile (unless VR hint strongly present)
  const isMob = detectMobile();
  if(isMob){
    // If VR hint and user likely in cardboard: choose cvr? We keep vr vs cvr separate.
    // If you want strict cvr, user should pass ?view=cvr explicitly.
    return detectCardboardOrVRHint() ? 'vr' : 'mobile';
  }

  // desktop
  return 'pc';
}

function ensureVrUi(){
  // If vr-ui.js already loaded (global guard), do nothing
  if(WIN.__HHA_VRUI_LOADED__) return;

  // If script tag already present, do nothing
  const existed = Array.from(DOC.scripts || []).some(s => (s.src||'').includes('/vr/vr-ui.js') || (s.src||'').includes('vr-ui.js'));
  if(existed) return;

  // Inject once
  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;
  DOC.head.appendChild(s);
}

function setBodyViewClasses(view){
  const b = DOC.body;
  if(!b) return;

  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');

  // Also add run/diff convenience classes (safe for CSS/FX tuning)
  const run = toLower(qs('run','play'));
  const diff = toLower(qs('diff','normal'));

  b.classList.remove('run-play','run-research','run-practice');
  b.classList.add(`run-${run}`);

  b.classList.remove('diff-easy','diff-normal','diff-hard');
  b.classList.add(`diff-${diff}`);

  // mark for debugging
  b.setAttribute('data-view', view);
  b.setAttribute('data-run', run);
  b.setAttribute('data-diff', diff);
}

function measureAndSetSafeVars(){
  // Sets CSS vars that goodjunk.safe.js uses for safe spawning
  // --gj-top-safe / --gj-bottom-safe in px
  try{
    const root = DOC.documentElement;
    if(!root) return;

    const css = getComputedStyle(root);
    const sat = parseFloat(css.getPropertyValue('--sat')) || 0;

    const topbar = DOC.getElementById('gjTopbar')?.getBoundingClientRect().height || 0;
    const hudTop = DOC.getElementById('gjHudTop')?.getBoundingClientRect().height || 0;
    const hudBot = DOC.getElementById('gjHudBot')?.getBoundingClientRect().height || 0;

    const topSafe = Math.max(90 + sat, topbar + hudTop + 14 + sat);
    const botSafe = Math.max(110, hudBot + 18);

    root.style.setProperty('--gj-top-safe', `${Math.floor(topSafe)}px`);
    root.style.setProperty('--gj-bottom-safe', `${Math.floor(botSafe)}px`);
  }catch(_){}
}

function buildPayload(view){
  // Pass-through + defaults
  const payload = {
    view,
    run: toLower(qs('run','play')),
    diff: toLower(qs('diff','normal')),
    time: Number(qs('time','80')) || 80,
    seed: qs('seed', null),
    hub: qs('hub', null),

    // research context passthrough
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),

    // optional
    style: qs('style', null),
    log: qs('log', null),
    ts: qs('ts', null),
  };

  // If in research mode and seed missing, use ts or stable tag
  if(payload.run === 'research' && !payload.seed){
    payload.seed = payload.ts || 'RESEARCH-SEED';
  }

  return payload;
}

function updateChipMeta(view){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  const run = toLower(qs('run','play'));
  const diff = toLower(qs('diff','normal'));
  const time = qs('time','80');
  el.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function bootNow(){
  const view = autoView();

  ensureVrUi();
  setBodyViewClasses(view);
  updateChipMeta(view);

  // measure safe vars for spawn
  measureAndSetSafeVars();
  WIN.addEventListener('resize', ()=>measureAndSetSafeVars(), { passive:true });
  WIN.addEventListener('orientationchange', ()=>setTimeout(measureAndSetSafeVars, 0), { passive:true });
  setTimeout(measureAndSetSafeVars, 50);
  setTimeout(measureAndSetSafeVars, 180);
  setTimeout(measureAndSetSafeVars, 520);

  // Boot engine
  const payload = buildPayload(view);

  try{
    engineBoot(payload);
  }catch(err){
    console.error('[GoodJunkVR boot] engineBoot failed:', err);
    // show quick fail overlay
    try{
      const d = DOC.createElement('div');
      d.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,.92);color:#e5e7eb;font:900 14px/1.5 system-ui;padding:18px;';
      d.innerHTML = `<div style="max-width:820px;"><div style="font-size:18px;margin-bottom:8px;">GoodJunkVR boot failed</div><div style="opacity:.85;white-space:pre-wrap;">${String(err && (err.stack||err.message||err))}</div></div>`;
      DOC.body.appendChild(d);
    }catch(_){}
  }
}

// Start when DOM ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', bootNow, { once:true });
}else{
  bootNow();
}