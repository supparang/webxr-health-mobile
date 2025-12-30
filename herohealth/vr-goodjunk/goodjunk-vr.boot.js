// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start-gated + HUD modes + Peek)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay OK -> hide
// ✅ HUD modes: full/compact/hide + hold-to-peek
// ✅ Starts engine only AFTER pressing "เริ่มเล่น"

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function setHudMode(mode){
  const b = DOC.body;
  b.classList.remove('hud-full','hud-compact','hud-hide','hud-peek-on');
  if (mode === 'compact') b.classList.add('hud-compact');
  else if (mode === 'hide') b.classList.add('hud-hide');
  else b.classList.add('hud-full');
  try{ localStorage.setItem('GJ_HUD_MODE', mode); }catch(_){}
  syncHudButtons(mode);
}

function getHudMode(){
  try{
    const s = localStorage.getItem('GJ_HUD_MODE');
    if (s === 'compact' || s === 'hide' || s === 'full') return s;
  }catch(_){}
  return 'full';
}

function syncHudButtons(mode){
  const f = DOC.getElementById('btnHudFull');
  const c = DOC.getElementById('btnHudCompact');
  const h = DOC.getElementById('btnHudHide');
  [f,c,h].forEach(x=>x && x.classList.remove('on'));
  if (mode === 'compact') c && c.classList.add('on');
  else if (mode === 'hide') h && h.classList.add('on');
  else f && f.classList.add('on');
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

  const coarse = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

function show(el){ if (el) el.hidden = false; }
function hide(el){ if (el) el.hidden = true; }

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  const showVrHint = ()=> show(vrHint);
  const hideVrHint = ()=> hide(vrHint);

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  btnVR && btnVR.addEventListener('click', ()=>{
    // placeholder for A-Frame enterVR; safe no-op
  });
}

function hookHudButtons(){
  const f = DOC.getElementById('btnHudFull');
  const c = DOC.getElementById('btnHudCompact');
  const h = DOC.getElementById('btnHudHide');

  f && f.addEventListener('click', ()=> setHudMode('full'));
  c && c.addEventListener('click', ()=> setHudMode('compact'));
  h && h.addEventListener('click', ()=> setHudMode('hide'));
}

function hookPeek(){
  const btn = DOC.getElementById('btnPeekHud');
  if (!btn) return;

  const on = ()=>{
    if (!DOC.body.classList.contains('hud-hide')) return;
    DOC.body.classList.add('hud-peek-on');
  };
  const off = ()=>{
    DOC.body.classList.remove('hud-peek-on');
  };

  btn.addEventListener('pointerdown', (e)=>{ e.preventDefault(); on(); }, { passive:false });
  btn.addEventListener('pointerup', off, { passive:true });
  btn.addEventListener('pointercancel', off, { passive:true });
  btn.addEventListener('pointerleave', off, { passive:true });

  // mobile fallback
  btn.addEventListener('touchstart', (e)=>{ e.preventDefault(); on(); }, { passive:false });
  btn.addEventListener('touchend', off, { passive:true });
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('view','');
  hudMeta.textContent = `[BOOT] dual=${dual} • view=${v||'-'} • hud=${getHudMode()}`;
}

function bootEngineOnce(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');
  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');
  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');       // time | all | miss
  const challenge = qs('challenge','rush'); // rush default

  // IMPORTANT: autoStart false => startOverlay controls start()
  const controller = engineBoot({
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
  });

  return controller;
}

function main(){
  hookViewButtons();
  hookHudButtons();
  hookPeek();

  setBodyView(pickInitialView());
  setHudMode(getHudMode());

  syncMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  const startOverlay = DOC.getElementById('startOverlay');
  const startMeta    = DOC.getElementById('startMeta');
  const btnStart     = DOC.getElementById('btnStart');

  const controller = bootEngineOnce();

  if (startMeta){
    const diff = qs('diff','normal');
    const run  = qs('run','play');
    const end  = qs('end','time');
    const time = qs('time', qs('duration','70'));
    startMeta.textContent = `diff=${diff} • run=${run} • end=${end} • time=${time}s`;
  }

  show(startOverlay);

  btnStart && btnStart.addEventListener('click', ()=>{
    hide(startOverlay);
    try{ controller && controller.start && controller.start(); }catch(_){}
    syncMeta();
  }, { passive:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();