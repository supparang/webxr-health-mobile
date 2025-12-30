// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start Gate + View + FS + Quest Peek)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay OK -> hide (does NOT start engine)
// ✅ Starts engine once AFTER pressing "เริ่มเล่น" (fix overlay issues / flash)
// ✅ Stealth HUD toggle + Quest Peek (missions still visible)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
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

async function tryLockLandscape(){
  try{
    const o = screen.orientation;
    if (o && o.lock) await o.lock('landscape');
  }catch(_){}
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  hudMeta.textContent = `[BOOT] ready • dual=${dual} • v=${v}`;
}

function show(el){ if (el) el.hidden = false; }
function hide(el){ if (el) el.hidden = true; }

function bindQuestPeek(){
  const peek = DOC.getElementById('questPeek');
  const t1 = DOC.getElementById('qpTitle');
  const t2 = DOC.getElementById('qpSub');
  const tc = DOC.getElementById('qpCount');
  if (!peek || !t1 || !t2 || !tc) return;

  let hideTm = 0;

  function setText(d){
    const goalTitle = d?.goalTitle ?? 'Goal: —';
    const miniTitle = d?.miniTitle ?? 'Mini: —';
    const gNow = d?.goalNow ?? 0, gTot = d?.goalTotal ?? 0;
    const mNow = d?.miniNow ?? 0, mTot = d?.miniTotal ?? 0;
    t1.textContent = goalTitle;
    t2.textContent = miniTitle;
    tc.textContent = `${gNow}/${gTot} • ${mNow}/${mTot}`;
  }

  function showFor(ms=2200){
    peek.hidden = false;
    peek.classList.remove('hide');
    peek.classList.add('show');
    clearTimeout(hideTm);
    hideTm = setTimeout(()=>{
      peek.classList.remove('show');
      peek.classList.add('hide');
      setTimeout(()=>{ peek.hidden = true; }, 170);
    }, ms);
  }

  // auto peek on quest updates
  ROOT.addEventListener('quest:update', (ev)=>{
    setText(ev.detail || {});
    showFor(2400);
  });

  // Hold-to-show: press & hold Shoot button
  const shoot = DOC.getElementById('btnShoot');
  if (shoot){
    let holdTimer = 0;
    const down = ()=>{
      clearTimeout(holdTimer);
      holdTimer = setTimeout(()=>{
        peek.hidden = false;
        peek.classList.remove('hide');
        peek.classList.add('show');
      }, 480);
    };
    const up = ()=>{
      clearTimeout(holdTimer);
      peek.classList.remove('show');
      peek.classList.add('hide');
      setTimeout(()=>{ peek.hidden = true; }, 170);
    };
    shoot.addEventListener('pointerdown', down, { passive:true });
    shoot.addEventListener('pointerup', up, { passive:true });
    shoot.addEventListener('pointercancel', up, { passive:true });
    shoot.addEventListener('mouseleave', up, { passive:true });
  }

  // Keyboard: Q peek
  DOC.addEventListener('keydown', (e)=>{
    if (String(e.key||'').toLowerCase() === 'q') showFor(2500);
  });
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches);
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

let ENGINE_STARTED = false;

function bootEngine(){
  if (ENGINE_STARTED) return;
  ENGINE_STARTED = true;

  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time'); // time | all | miss
  const challenge = qs('challenge','rush');

  // safe margins are interpreted INSIDE each layer rect (safe.js uses layer.getBoundingClientRect)
  const safeMargins = (() => {
    const view = DOC.body.classList.contains('view-vr') ? 'vr'
              : DOC.body.classList.contains('view-cvr') ? 'cvr'
              : DOC.body.classList.contains('view-mobile') ? 'mobile'
              : 'pc';
    if (view === 'vr' || view === 'cvr') return { top: 14, bottom: 14, left: 14, right: 14 };
    if (view === 'mobile') return { top: 14, bottom: 14, left: 14, right: 14 };
    return { top: 14, bottom: 14, left: 14, right: 14 };
  })();

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
    safeMargins,
    context: { projectTag: qs('projectTag','HeroHealth') }
  });

  const hudMeta = DOC.getElementById('hudMeta');
  if (hudMeta) hudMeta.textContent = `[BOOT] running • diff=${diff} • time=${time}s`;
}

function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');
  const btnHud = DOC.getElementById('btnHudToggle');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ show(vrHint); }
  function hideVrHint(){ hide(vrHint); }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // “Enter VR” here means: go cVR + fullscreen + landscape lock
  btnVR && btnVR.addEventListener('click', async ()=>{
    setBodyView('cvr');
    showVrHint();
    await enterFs();
    syncFsClass();
    await tryLockLandscape();
  });

  // HUD toggle (stealth)
  function toggleHud(){
    DOC.body.classList.toggle('stealth-hud');
  }
  btnHud && btnHud.addEventListener('click', toggleHud);

  // keyboard H toggle
  DOC.addEventListener('keydown', (e)=>{
    if (String(e.key||'').toLowerCase() === 'h') toggleHud();
  });

  // allow ?hud=stealth
  if (String(qs('hud','')||'').toLowerCase() === 'stealth'){
    DOC.body.classList.add('stealth-hud');
  }
}

function hookStartGate(){
  const startOverlay = DOC.getElementById('startOverlay');
  const btnStart = DOC.getElementById('btnStart');
  const meta = DOC.getElementById('startMeta');

  show(startOverlay);

  const diff = qs('diff','normal');
  const time = Number(qs('time', qs('duration','70'))) || 70;
  const view = pickInitialView();
  if (meta) meta.textContent = `diff=${diff} • time=${time}s • view=${view} • (กดเริ่มเพื่อเริ่มจริง)`;

  btnStart && btnStart.addEventListener('click', async ()=>{
    hide(startOverlay);

    // best UX on mobile cardboard
    if (DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr')){
      await tryLockLandscape();
    }

    // make sure first user gesture can unlock audio/FS if needed
    bootEngine();
  });

  // optional autostart (debug)
  if (String(qs('autostart','')||'') === '1'){
    hide(startOverlay);
    bootEngine();
  }
}

function main(){
  hookViewButtons();
  bindQuestPeek();

  setBodyView(pickInitialView());
  syncMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // start gate (engine starts after click)
  hookStartGate();
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();