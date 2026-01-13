// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot — auto-detect view WITHOUT overriding explicit ?view=
// + PATCH: map cardboard->cvr, and upgrade to view=vr when WebXR enters

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const WIN = window;

const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch(_){ return def; } };

function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(!v) return '';
  if(v === 'cardboard') return 'cvr';
  return v;
}

function detectViewNoOverride(){
  const explicit = normalizeView(qs('view',''));
  if (explicit) return explicit;

  const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  const w = Math.max(1, WIN.innerWidth||1);
  const h = Math.max(1, WIN.innerHeight||1);
  const landscape = w >= h;

  if (isTouch){
    // heuristic: wide-landscape touch -> cVR
    if (landscape && w >= 740) return 'cvr';
    return 'mobile';
  }
  return 'pc';
}

function applyBodyView(view){
  const b = DOC.body;
  if(!b) return;
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');
  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

let view = detectViewNoOverride();
applyBodyView(view);

// If A-Frame present: switch to view-vr when entering WebXR
function hookWebXR(){
  try{
    const scene = DOC.querySelector('a-scene');
    if(!scene) return;

    scene.addEventListener('enter-vr', ()=>{
      const explicit = normalizeView(qs('view',''));
      // ถ้าผู้ใช้ตั้ง view=mobile/pc เอง ก็ไม่ฝืน; แต่ถ้า auto/cvr ให้สลับเป็น vr เมื่อเข้า WebXR จริง
      if(!explicit || explicit === 'vr' || explicit === 'cvr'){
        view = 'vr';
        applyBodyView('vr');
      }
    });

    scene.addEventListener('exit-vr', ()=>{
      const explicit = normalizeView(qs('view',''));
      // ออกจาก VR -> กลับตาม explicit หรือ auto-detect
      const next = explicit || detectViewNoOverride();
      view = next;
      applyBodyView(next);
    });
  }catch(_){}
}
hookWebXR();

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