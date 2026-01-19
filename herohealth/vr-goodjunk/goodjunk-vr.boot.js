// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (PACK-FAIR)
// ✅ View modes: pc / mobile / vr / cvr (from ?view=)
// ✅ DO NOT override view (launcher already respects it)
// ✅ Sets body class: view-pc/view-mobile/view-vr/view-cvr
// ✅ Init vr-ui config (lockPx + cooldown)
// ✅ Wait for DOM + Particles ready (fix "effects missing" race)
// ✅ Starts engine: import { boot } from './goodjunk.safe.js'
// ✅ Emits: hha:boot (debug)

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

function qs(k, def = null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
  try{ DOC.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){}
}

function normView(v){
  v = String(v || '').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr') return 'cvr';
  if(v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  if(v === 'mobile') return 'mobile';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(
    view === 'pc' ? 'view-pc' :
    view === 'vr' ? 'view-vr' :
    view === 'cvr' ? 'view-cvr' :
    'view-mobile'
  );
}

function isParticlesReady(){
  // supports both minimal and ultra particles module shapes
  const P = (WIN.GAME_MODULES && WIN.GAME_MODULES.Particles) || WIN.Particles;
  return !!(P && (typeof P.popText === 'function' || typeof P.burstAt === 'function' || typeof P.celebrate === 'function'));
}

function waitForParticles(timeoutMs = 900){
  const t0 = performance.now();
  return new Promise((resolve)=>{
    const tick = ()=>{
      if(isParticlesReady()) return resolve(true);
      if(performance.now() - t0 >= timeoutMs) return resolve(false);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function waitDom(){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') return Promise.resolve(true);
  return new Promise((resolve)=>{
    DOC.addEventListener('DOMContentLoaded', ()=>resolve(true), { once:true });
  });
}

async function boot(){
  await waitDom();

  // view/diff/run/time/seed passthrough
  const view = normView(qs('view','mobile'));
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const time = Number(qs('time','80') || 80) || 80;
  const seed = qs('seed', null) ?? qs('ts', null) ?? String(Date.now());

  // apply body view class
  setBodyView(view);

  // vr-ui config: make mobile/cVR feel snappy but fair
  WIN.HHA_VRUI_CONFIG = Object.assign(
    { lockPx: (view === 'cvr' ? 30 : 28), cooldownMs: (view === 'pc' ? 70 : 90) },
    WIN.HHA_VRUI_CONFIG || {}
  );

  // IMPORTANT: wait for particles (fix "FX missing" race)
  const fxOk = await waitForParticles(1200);

  emit('hha:boot', { game:'goodjunk', view, diff, run, time, seed, fxOk });

  // start engine
  engineBoot({
    view,
    diff,
    run,
    time,
    seed
  });
}

boot();