// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (START GATED + HUD TOGGLE 3 LEVELS)
// ✅ HUD mode: FULL / COMPACT / HIDE + Hold-to-Peek
// ✅ remembers last HUD mode via localStorage

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;
const LS_HUD = 'HHA_GJ_HUD_MODE'; // full | compact | hide

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);

  const map = { pc:'btnViewPC', mobile:'btnViewMobile', vr:'btnViewVR', cvr:'btnViewCVR' };
  Object.entries(map).forEach(([v,id])=>{
    const el = DOC.getElementById(id);
    if (el) el.classList.toggle('on', v===view);
  });
}

function setHudMode(mode){
  mode = String(mode||'full').toLowerCase();
  if (!['full','compact','hide'].includes(mode)) mode = 'full';

  const b = DOC.body;
  b.classList.remove('hud-full','hud-compact','hud-hide','hud-peek-on');
  b.classList.add(`hud-${mode}`);

  // show/hide peek container (so it doesn't take layout)
  const hudPeek = DOC.getElementById('hudPeek');
  if (hudPeek) hudPeek.hidden = (mode !== 'hide');

  // button label
  const btnHud = DOC.getElementById('btnHudMode');
  if (btnHud){
    btnHud.textContent = (mode === 'full') ? 'HUD: Full'
                     : (mode === 'compact') ? 'HUD: Compact'
                     : 'HUD: Hide';
  }

  try{ localStorage.setItem(LS_HUD, mode); }catch(_){}
}

function getHudModeDefaultByView(view){
  // VR/cVR = compact by default; PC/mobile = full by default
  const saved = (()=>{ try{ return localStorage.getItem(LS_HUD); }catch(_){ return null; } })();
  if (saved && ['full','compact','hide'].includes(saved)) return saved;
  return (view === 'vr' || view === 'cvr') ? 'compact' : 'full';
}

function cycleHudMode(){
  const b = DOC.body;
  const cur =
    b.classList.contains('hud-hide') ? 'hide' :
    b.classList.contains('hud-compact') ? 'compact' : 'full';

  const next = (cur === 'full') ? 'compact' : (cur === 'compact') ? 'hide' : 'full';
  setHudMode(next);
}

function bindPeekHold(){
  const btnPeek = DOC.getElementById('btnHudPeek');
  if (!btnPeek) return;

  const on = ()=>{
    DOC.body.classList.add('hud-peek-on');
  };
  const off = ()=>{
    DOC.body.classList.remove('hud-peek-on');
  };

  // pointer hold
  btnPeek.addEventListener('pointerdown', (e)=>{ e.preventDefault?.(); on(); }, { passive:false });
  btnPeek.addEventListener('pointerup', off, { passive:true });
  btnPeek.addEventListener('pointercancel', off, { passive:true });
  btnPeek.addEventListener('pointerleave', off, { passive:true });

  // fallback touch
  btnPeek.addEventListener('touchstart', (e)=>{ e.preventDefault?.(); on(); }, { passive:false });
  btnPeek.addEventListener('touchend', off, { passive:true });
}

function isFs(){
  return !!(DOC.fullscreenElement || DOC.webkitFullscreenElement);
}
async function enterFs(){
  try{
    const el = DOC.documentElement;
    if (el.requestFullscreen) await el.requestFullscreen();
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
  }catch(_){}
}
function syncFsClass(){
  DOC.body.classList.toggle('is-fs', isFs());
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches) || false;
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

function syncMeta(tag='[BOOT]'){
  const hudMeta = DOC.getElementById('hudMeta');
  const startMeta = DOC.getElementById('startMeta');
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = qs('time', qs('duration','70'));

  const line = `${tag} dual=${dual} • diff=${diff} • run=${run} • time=${time}s • v=${v}`;
  if (hudMeta) hudMeta.textContent = line;
  if (startMeta) startMeta.textContent = line;
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');

  const btnHud = DOC.getElementById('btnHudMode');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

  btnPC && btnPC.addEventListener('click', ()=>{
    setBodyView('pc'); hideVrHint();
    // keep current HUD mode (user preference)
    syncMeta('[BOOT]');
  });
  btnM && btnM.addEventListener('click', ()=>{
    setBodyView('mobile'); hideVrHint();
    syncMeta('[BOOT]');
  });
  btnV && btnV.addEventListener('click', ()=>{
    setBodyView('vr'); showVrHint();
    syncMeta('[BOOT]');
  });
  btnC && btnC.addEventListener('click', ()=>{
    setBodyView('cvr'); showVrHint();
    syncMeta('[BOOT]');
  });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  btnVR && btnVR.addEventListener('click', ()=>{
    showVrHint();
  });

  // ✅ HUD toggle
  btnHud && btnHud.addEventListener('click', ()=> cycleHudMode());
}

function bootEngineController(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');   // time | all
  const challenge = qs('challenge','rush');

  return engineBoot({
    layerEl: layerL,
    layerElR: layerR,
    crosshairEl: crossL,
    crosshairElR: crossR,
    shootEl,
    diff,
    run,
    time,
    endPolicy,
    challenge,
    autoStart: false,
    context: { projectTag: qs('projectTag','HeroHealth') }
  }) || null;
}

function hookStartOverlay(ctrlRef){
  const startOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  if (!startOverlay || !btnStart) return;

  const autoplay = String(qs('autoplay','0')) === '1';
  startOverlay.hidden = autoplay ? true : false;

  btnStart.addEventListener('click', ()=>{
    startOverlay.hidden = true;
    try{ ctrlRef?.start?.(); }catch(_){}
    syncMeta('[RUN]');
  });

  if (autoplay){
    setTimeout(()=>{
      try{ ctrlRef?.start?.(); }catch(_){}
      syncMeta('[RUN]');
    }, 0);
  }
}

function main(){
  hookViewButtons();

  const view = pickInitialView();
  setBodyView(view);

  // ✅ HUD initial mode: saved preference, else defaults by view
  setHudMode(getHudModeDefaultByView(view));
  bindPeekHold();

  syncMeta('[BOOT]');
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // create controller now (but not running)
  const ctrl = bootEngineController();

  // start gate
  hookStartOverlay(ctrl);
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();