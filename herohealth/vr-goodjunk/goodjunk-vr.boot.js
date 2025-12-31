// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (GATED START + Quest Peek)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay OK -> hide (does NOT start engine)
// ✅ Engine starts ONLY after clicking "เริ่มเล่น" (fix: target flash / game not start)
// ✅ Quest Peek: show on demand + auto show when HUD hidden in VR/cVR

import { boot as engineBoot } from './goodjunk.safe.js';

const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
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

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);

  // default: VR/cVR = hide HUD (but keep Missions peek)
  const hudParam = String(qs('hud', '') || '').toLowerCase(); // hud=1 force show, hud=0 force hide
  const autoHide = (view === 'vr' || view === 'cvr');
  const wantHide =
    (hudParam === '0') ? true :
    (hudParam === '1') ? false :
    autoHide;

  b.classList.toggle('hud-hidden', wantHide);
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

function setOverlay(el, show){
  if (!el) return;
  el.hidden = !show;
}

function metaText(){
  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = qs('time', qs('duration','70'));
  const end  = qs('end','time');
  const ch   = qs('challenge','rush');
  const view = DOC.body.classList.contains('view-vr') ? 'vr'
            : DOC.body.classList.contains('view-cvr') ? 'cvr'
            : DOC.body.classList.contains('view-mobile') ? 'mobile' : 'pc';
  return `diff=${diff} • run=${run} • time=${time}s • end=${end} • challenge=${ch} • view=${view}`;
}

/* -------------------- Quest Peek -------------------- */
let peekTimer = 0;
function showPeek(ms=1600){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.add('show');
  peek.setAttribute('aria-hidden', 'false');
  clearTimeout(peekTimer);
  peekTimer = setTimeout(()=>hidePeek(), ms);
}
function hidePeek(){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.remove('show');
  peek.setAttribute('aria-hidden', 'true');
}
function hudHidden(){
  return DOC.body.classList.contains('hud-hidden');
}
function hookPeekEvents(){
  // auto show peek when quests update & HUD hidden
  let lastAuto = 0;

  window.addEventListener('quest:update', ()=>{
    if (!hudHidden()) return;
    const t = Date.now();
    if (t - lastAuto < 1100) return; // rate-limit
    lastAuto = t;
    showPeek(1400);
  }, { passive:true });

  window.addEventListener('hha:celebrate', ()=>{
    if (!hudHidden()) return;
    showPeek(2200);
  }, { passive:true });
}

/* -------------------- Engine gate -------------------- */
let started = false;

function bootEngine(){
  if (started) return;
  started = true;

  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');          // time | all | miss
  const challenge = qs('challenge','rush');    // rush | survive | boss

  engineBoot({
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
    context: {
      projectTag: qs('projectTag','HeroHealth')
    }
  });
}

function hookViewButtons(){
  const btnPC  = DOC.getElementById('btnViewPC');
  const btnM   = DOC.getElementById('btnViewMobile');
  const btnV   = DOC.getElementById('btnViewVR');
  const btnC   = DOC.getElementById('btnViewCVR');
  const btnFS  = DOC.getElementById('btnEnterFS');
  const btnVR  = DOC.getElementById('btnEnterVR');

  const btnPeek = DOC.getElementById('btnPeek');
  const btnHud  = DOC.getElementById('btnToggleHud');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ setOverlay(vrHint, true); }
  function hideVrHint(){ setOverlay(vrHint, false); }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); showPeek(2000); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); showPeek(2000); });

  vrOk && vrOk.addEventListener('click', ()=>{ hideVrHint(); showPeek(1600); });

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  btnVR && btnVR.addEventListener('click', ()=>{
    // placeholder (no A-Frame here)
  });

  btnPeek && btnPeek.addEventListener('click', ()=>{
    showPeek(2400);
  });

  btnHud && btnHud.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
    if (hudHidden()) showPeek(2000);
  });
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  const startMeta = DOC.getElementById('startMeta');
  const t = metaText();
  if (hudMeta) hudMeta.textContent = t;
  if (startMeta) startMeta.textContent = t;
}

function hookStartOverlay(){
  const overlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');

  // show start overlay on load (prevents target flash)
  setOverlay(overlay, true);

  btnStart && btnStart.addEventListener('click', ()=>{
    setOverlay(overlay, false);
    // show missions briefly on start (especially VR HUD hidden)
    if (hudHidden()) showPeek(2200);
    bootEngine();
  });
}

function main(){
  hookViewButtons();
  setBodyView(pickInitialView());
  syncMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  hookPeekEvents();
  hookStartOverlay();
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();