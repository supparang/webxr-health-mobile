// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot — auto-detect view WITHOUT overriding explicit ?view=
// Loads goodjunk.safe.js and passes payload

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

function detectViewNoOverride(){
  const explicit = String(qs('view','')).toLowerCase();
  if (explicit) return explicit;

  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);
  const landscape = w >= h;

  if (isTouch){
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function applyBodyView(view){
  const b = DOC.body;
  if(!b) return;

  // always keep "gj" class
  b.classList.add('gj');

  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');
  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr' || view === 'cardboard') b.classList.add('view-vr','cardboard');
  else if(view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

const view = detectViewNoOverride();
applyBodyView(view);

// Pass params to engine
engineBoot({
  view,
  run: qs('run','play'),
  diff: qs('diff','normal'),
  time: Number(qs('time','80') || 80),
  seed: qs('seed', null),
  hub: qs('hub', null),
  studyId: qs('studyId', qs('study', null)),
  phase: qs('phase', null),
  conditionGroup: qs('conditionGroup', qs('cond', null)),
});