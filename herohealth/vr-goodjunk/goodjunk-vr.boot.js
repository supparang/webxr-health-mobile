// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (FULL)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay OK -> hide (does NOT start game)
// ✅ START GATE: starts engine only after pressing "เริ่มเล่น"
// ✅ HUD Peek: tap to toggle HUD in VR/cVR

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
function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  hudMeta.textContent = `[BOOT] ready • dual=${dual} • v=${v}`;
}

function ensureHudPeek(){
  let el = DOC.querySelector('.hud-peek');
  if (el) return el;

  el = DOC.createElement('div');
  el.className = 'hud-peek';
  el.innerHTML = `
    <span class="tag good" id="peekGood">GOOD 0</span>
    <span class="tag bad" id="peekBad" style="display:none;">BAD 0</span>
    <span class="p" id="peekMini">Mini —</span>
    <span class="m" id="peekTime">Time 0</span>
    <span class="m">• แตะเพื่อซ่อน/โชว์ HUD</span>
  `;
  DOC.body.appendChild(el);

  el.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
  });

  // bind via events
  window.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    const g = DOC.getElementById('peekGood');
    if (g) g.textContent = `Score ${(d.score ?? 0)|0}`;
  });

  window.addEventListener('quest:update', (ev)=>{
    const d = ev?.detail || {};
    const mini = DOC.getElementById('peekMini');
    if (mini) mini.textContent = String(d.miniTitle || 'Mini —');

    // show boss bad counter only during boss
    const bad = DOC.getElementById('peekBad');
    const txt = String(d.miniTitle || '');
    const isBoss = txt.includes('BOSS');
    if (bad){
      bad.style.display = isBoss ? 'inline-flex' : 'none';
      // best effort: parse "≥ N"
      const m = txt.match(/≥\s*(\d+)/);
      if (isBoss && m) bad.textContent = `BAD < ${m[1]}`;
      else if (!isBoss) bad.textContent = 'BAD 0';
    }
  });

  window.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    const t = DOC.getElementById('peekTime');
    if (t) t.textContent = `Time ${(d.left ?? 0)|0}`;
  });

  return el;
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

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
    // placeholder for future A-Frame
  });
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = matchMedia && matchMedia('(pointer: coarse)').matches;
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

function prepareStartOverlay(){
  const ov = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');
  const meta = DOC.getElementById('startMeta');

  if (meta){
    const diff = qs('diff','normal');
    const time = qs('time', qs('duration','70'));
    const run  = qs('run','play');
    meta.textContent = `diff=${diff} • time=${time}s • run=${run}`;
  }

  if (ov) ov.hidden = false;

  return { ov, btn };
}

function bootEngineStartGated(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');   // time | all | miss
  const challenge = qs('challenge','rush');

  const api = engineBoot({
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
    autoStart: false, // IMPORTANT
    context: { projectTag: qs('projectTag','HeroHealth') }
  });

  return api;
}

function main(){
  hookViewButtons();
  setBodyView(pickInitialView());
  syncMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // ensure peek (for VR/cVR)
  ensureHudPeek();

  // start overlay gate
  const { ov, btn } = prepareStartOverlay();

  const api = bootEngineStartGated();

  btn && btn.addEventListener('click', async ()=>{
    // hide overlay then start
    if (ov) ov.hidden = true;

    // optional: if in VR/cVR and not fullscreen, suggest FS first but do not block
    if ((DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr')) && !isFs()){
      // soft: do nothing; user can press Enter Fullscreen
    }

    try{ api && api.start && api.start(); }catch(_){}
    syncMeta();
  });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();