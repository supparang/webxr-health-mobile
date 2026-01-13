// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot — auto-detect view WITHOUT overriding explicit ?view=
// ✅ PACK F: Smart Safe Spawn measure -> sets --gj-top-safe/--gj-bottom-safe
// ✅ PACK G: Compact UI default + Missions overlay
// ✅ Boots goodjunk.safe.js

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
  b.classList.add('gj'); // important (your css uses body.gj)
  b.classList.remove('view-pc','view-mobile','view-cvr','view-vr','cardboard');
  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr' || view === 'cardboard') b.classList.add('view-vr','cardboard');
  else if(view === 'pc') b.classList.add('view-pc');
  else b.classList.add('view-mobile');
}

/* =========================
   PACK F — Smart Safe Spawn
========================= */
function setRootPxVar(name, px){
  try{ DOC.documentElement.style.setProperty(name, `${Math.max(0, Math.round(px))}px`); }catch(_){}
}
function isVisible(el){
  if(!el) return false;
  const cs = getComputedStyle(el);
  if(cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity||1) < 0.05) return false;
  return true;
}
function measureSafeBands(){
  const H = Math.max(1, WIN.innerHeight||1);

  const topEls = [
    DOC.querySelector('.gj-topbar'),
    DOC.querySelector('.gj-hud'),
    DOC.querySelector('.gj-hud-top'),
    DOC.querySelector('.gj-cards')
  ].filter(Boolean);

  const botEls = [
    DOC.querySelector('.gj-hud-bot'),
    DOC.querySelector('.gj-bottom'),
    DOC.querySelector('.gj-bottombar')
  ].filter(Boolean);

  const csRoot = getComputedStyle(DOC.documentElement);
  const sat = parseFloat(csRoot.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(csRoot.getPropertyValue('--sab')) || 0;

  let topSafe = 120 + sat;
  let bottomSafe = 120 + sab;

  for(const el of topEls){
    if(!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if(r.bottom > 0 && r.top < H*0.55){
      topSafe = Math.max(topSafe, r.bottom + 12);
    }
  }

  for(const el of botEls){
    if(!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if(r.top < H && r.bottom > H*0.45){
      bottomSafe = Math.max(bottomSafe, (H - r.top) + 12);
    }
  }

  // missions open => กันเพิ่ม
  if(DOC.body.classList.contains('show-missions')){
    topSafe += 20;
    bottomSafe += 20;
  }

  // hud hidden => โล่งสุด
  if(DOC.body.classList.contains('hud-hidden')){
    topSafe = 80 + sat;
    bottomSafe = 80 + sab;
  }

  topSafe = Math.min(topSafe, H*0.55);
  bottomSafe = Math.min(bottomSafe, H*0.45);

  setRootPxVar('--gj-top-safe', topSafe);
  setRootPxVar('--gj-bottom-safe', bottomSafe);
}
function hookSafeMeasure(){
  measureSafeBands();
  setTimeout(measureSafeBands, 60);
  setTimeout(measureSafeBands, 240);
  setTimeout(measureSafeBands, 600);

  WIN.addEventListener('resize', ()=>{ try{ measureSafeBands(); }catch(_){} }, { passive:true });
  WIN.addEventListener('orientationchange', ()=>{ try{ measureSafeBands(); }catch(_){} }, { passive:true });

  try{
    const mo = new MutationObserver(()=>{ measureSafeBands(); });
    mo.observe(DOC.body, { attributes:true, attributeFilter:['class'] });
  }catch(_){}

  WIN.__HHA_GJ_MEASURE_SAFE__ = measureSafeBands;
}
/* =========================
   END PACK F
========================= */

function wireUi(){
  const btnM = DOC.getElementById('btnMissions');
  const btnClose = DOC.getElementById('btnCloseMissions');
  const btnHide = DOC.getElementById('btnHideHud');
  const btnBack = DOC.getElementById('btnBackHub');

  const peekGoal = DOC.getElementById('peekGoal');
  const peekMini = DOC.getElementById('peekMini');

  const hub = qs('hub', null);

  // chip meta
  const meta = DOC.getElementById('gjChipMeta');
  const view = qs('view','auto');
  const run  = qs('run','play');
  const diff = qs('diff','normal');
  const time = qs('time','80');
  if(meta) meta.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;

  function openMissions(){
    DOC.body.classList.add('show-missions');
    const goal = DOC.getElementById('hud-goal')?.textContent || '—';
    const mini = DOC.getElementById('hud-mini')?.textContent || '—';
    if(peekGoal) peekGoal.textContent = goal;
    if(peekMini) peekMini.textContent = mini;
    try{ WIN.__HHA_GJ_MEASURE_SAFE__ && WIN.__HHA_GJ_MEASURE_SAFE__(); }catch(_){}
  }
  function closeMissions(){
    DOC.body.classList.remove('show-missions');
    try{ WIN.__HHA_GJ_MEASURE_SAFE__ && WIN.__HHA_GJ_MEASURE_SAFE__(); }catch(_){}
  }
  function toggleHud(){
    DOC.body.classList.toggle('hud-hidden');
    try{ WIN.__HHA_GJ_MEASURE_SAFE__ && WIN.__HHA_GJ_MEASURE_SAFE__(); }catch(_){}
  }

  btnM?.addEventListener('click', openMissions);
  btnClose?.addEventListener('click', closeMissions);
  btnHide?.addEventListener('click', toggleHud);

  btnBack?.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else history.back();
  });

  // close missions by ESC
  WIN.addEventListener('keydown', (e)=>{
    if(e.key === 'Escape') closeMissions();
  }, { passive:true });
}

const viewDetected = detectViewNoOverride();
applyBodyView(viewDetected);
hookSafeMeasure();
wireUi();

// Boot engine
engineBoot({
  view: viewDetected,
  run: qs('run','play'),
  diff: qs('diff','normal'),
  time: Number(qs('time','80') || 80),
  seed: qs('seed', null),
  hub: qs('hub', null),
  studyId: qs('studyId', qs('study', null)),
  phase: qs('phase', null),
  conditionGroup: qs('conditionGroup', qs('cond', null)),
});