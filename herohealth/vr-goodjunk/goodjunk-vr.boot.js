// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Auto detect view (pc/mobile/vr/cvr) but allow ?view= override
// ✅ Adds body classes: view-pc/view-mobile/view-vr/view-cvr
// ✅ Keeps gj-layer-r visibility in cVR
// ✅ Sets safe-area vars --sat/--sab/--sal/--sar (best effort)
// ✅ Sets VR UI config (cooldown/lockPx)
// ✅ Boots engine: ./goodjunk.safe.js (export boot)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try{ return new URL(location.href).searchParams.get(k) ?? def; }
  catch{ return def; }
}

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

function detectView(){
  // Priority: explicit URL param
  const v = String(qs('view','')||'').toLowerCase().trim();
  if(v && v !== 'auto') return v;

  // Heuristics (no menu, auto)
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const isTouch  = (navigator.maxTouchPoints || 0) > 0;
  const hasXR = !!(navigator.xr);

  // cVR: usually user sets ?view=cvr explicitly; keep auto conservative
  if(hasXR) return 'vr';
  if(isMobile || isTouch) return 'mobile';
  return 'pc';
}

function applyBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'pc') b.classList.add('view-pc');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'cvr') b.classList.add('view-cvr');
  else b.classList.add('view-mobile');
}

function updateRightLayerVisibility(view){
  const r = DOC.getElementById('gj-layer-r');
  if(!r) return;
  if(view === 'cvr'){
    r.setAttribute('aria-hidden','false');
  }else{
    r.setAttribute('aria-hidden','true');
  }
}

function setSafeAreaVars(){
  // best-effort: CSS env() already in :root, but we mirror into px vars for JS reads if needed
  try{
    const cs = getComputedStyle(DOC.documentElement);
    const readPx = (name, fb=0)=>{
      const raw = String(cs.getPropertyValue(name) || '').trim();
      const n = Number(raw.replace('px',''));
      return Number.isFinite(n) ? n : fb;
    };
    const sat = readPx('--sat', 0);
    const sab = readPx('--sab', 0);
    const sal = readPx('--sal', 0);
    const sar = readPx('--sar', 0);
    DOC.documentElement.style.setProperty('--sat', `${sat}px`);
    DOC.documentElement.style.setProperty('--sab', `${sab}px`);
    DOC.documentElement.style.setProperty('--sal', `${sal}px`);
    DOC.documentElement.style.setProperty('--sar', `${sar}px`);
  }catch(_){}
}

function setVrUiConfig(){
  // tweakable: feel snappy but not spammy
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: 30, cooldownMs: 90 },
    WIN.HHA_VRUI_CONFIG || {}
  );
}

function readParams(){
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','80'), 20, 300);
  const seed = qs('seed', null);
  const hub  = qs('hub', null);

  // study passthrough
  const studyId = qs('studyId', qs('study', null));
  const phase = qs('phase', null);
  const conditionGroup = qs('conditionGroup', qs('cond', null));

  return { run, diff, time, seed, hub, studyId, phase, conditionGroup };
}

function syncChip(){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  const v = qs('view','auto');
  const run = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  el.textContent = `view=${v} · run=${run} · diff=${diff} · time=${time}`;
}

function start(){
  const view = detectView();
  applyBodyView(view);
  updateRightLayerVisibility(view);
  setSafeAreaVars();
  setVrUiConfig();
  syncChip();

  const p = readParams();

  // Boot engine
  engineBoot({
    view,
    run: p.run,
    diff: p.diff,
    time: p.time,
    seed: p.seed,
    hub: p.hub,
    studyId: p.studyId,
    phase: p.phase,
    conditionGroup: p.conditionGroup,
  });
}

// DOM ready
if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}else{
  start();
}

// keep layout in sync
WIN.addEventListener('resize', ()=>{ setSafeAreaVars(); }, { passive:true });
WIN.addEventListener('orientationchange', ()=>{ setSafeAreaVars(); }, { passive:true });