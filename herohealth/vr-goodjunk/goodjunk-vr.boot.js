// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (auto view + load SAFE engine)
// ✅ respects explicit ?view= (no override)
// ✅ if no ?view= -> best-effort auto class (pc/mobile/cvr)
// ✅ passes through run/diff/time/seed/hub/study fields to goodjunk.safe.js

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function detectView(){
  const explicit = String(qs('view','')).toLowerCase();
  if (explicit) return explicit;

  const isTouch = ('ontouchstart' in WIN) || ((navigator.maxTouchPoints|0) > 0);
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);
  const landscape = w >= h;

  if (isTouch){
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function applyView(view){
  const b = DOC.body;
  if (!b) return;
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');
  if (view === 'mobile') b.classList.add('view-mobile');
  else if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'cardboard') b.classList.add('cardboard');
  else b.classList.add('view-pc');
}

function start(){
  const view = String(qs('view', detectView()) || 'mobile').toLowerCase();
  // apply class only when user didn't explicitly set view OR even if set, keep consistent
  applyView(view);

  // pass-through params
  const payload = {
    view,
    run: qs('run','play'),
    diff: qs('diff','normal'),
    time: Number(qs('time','80') || 80),
    seed: qs('seed', null),
    hub: qs('hub', null),

    // study params (optional)
    studyId: qs('studyId', qs('study', null)),
    phase: qs('phase', null),
    conditionGroup: qs('conditionGroup', qs('cond', null)),
  };

  engineBoot(payload);
}

// DOM ready
if (DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  start();
} else {
  DOC.addEventListener('DOMContentLoaded', start, { once:true });
}