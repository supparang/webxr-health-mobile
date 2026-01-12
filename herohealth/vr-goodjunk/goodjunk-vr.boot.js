// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Root launcher + folder run)
// ✅ Reads params: view/run/diff/time/seed/hub (+studyId/phase/cond)
// ✅ Applies body classes ONLY if ?view= not provided (no-override policy)
// ✅ Boots engine: goodjunk.safe.js
// ✅ Ensures vr-ui.js can emit hha:shoot for cVR/VR

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

function applyViewNoOverride(){
  const explicit = String(qs('view','')).toLowerCase();
  if (explicit) return; // respect explicit view

  // best-effort detect
  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);
  const landscape = w >= h;

  let v = 'pc';
  if (isTouch){
    v = (landscape && w >= 740) ? 'cvr' : 'mobile';
  }

  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','cardboard');
  b.classList.add(v==='pc'?'view-pc': v==='cvr'?'view-cvr':'view-mobile');
}

function boot(){
  try{
    applyViewNoOverride();

    const view = String(qs('view','') || '').toLowerCase() || (
      DOC.body?.classList.contains('view-cvr') ? 'cvr' :
      DOC.body?.classList.contains('view-mobile') ? 'mobile' : 'pc'
    );

    const payload = {
      view,
      run:  qs('run','play'),
      diff: qs('diff','normal'),
      time: Number(qs('time','80')||80),
      seed: qs('seed', null),
      hub:  qs('hub', null),

      // study logging passthrough (optional)
      studyId: qs('studyId', qs('study', null)),
      phase: qs('phase', null),
      conditionGroup: qs('conditionGroup', qs('cond', null)),
    };

    engineBoot(payload);
  }catch(e){
    console.error('[GoodJunkVR boot] failed', e);
  }
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', boot, { once:true });
}else{
  boot();
}