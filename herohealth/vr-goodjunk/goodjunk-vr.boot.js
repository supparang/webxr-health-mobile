// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start Gate + Views + VR Tick Toast)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
}

function show(el, on){
  if (!el) return;
  el.hidden = !on;
}

function isPortrait(){
  return (ROOT.innerHeight || 1) >= (ROOT.innerWidth || 1);
}

async function enterFullscreen(){
  const el = DOC.documentElement;
  try{
    if (!DOC.fullscreenElement && el.requestFullscreen) await el.requestFullscreen();
    DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
  }catch(_){}
}

async function lockLandscapeBestEffort(){
  try{
    if (screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

/* ---------- VR Tick Toast (comfort safe) ---------- */
let audioCtx = null;
function beepTiny(freq=880, durMs=34, gain=0.035){
  try{
    audioCtx = audioCtx || new (ROOT.AudioContext || ROOT.webkitAudioContext)();
    const t0 = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t0);
    o.stop(t0 + durMs/1000);
  }catch(_){}
}

function toastSet(el, html, cls){
  if (!el) return;
  el.className = `gj-vr-toast ${cls||''}`.trim();
  el.innerHTML = html;
  el.classList.add('show');
}

function toastHide(el){
  if (!el) return;
  el.classList.remove('show');
}

function bindVrTickToast(){
  const toastL = DOC.getElementById('gjToastL');
  const toastR = DOC.getElementById('gjToastR');

  let lastSec = null;
  let hideTimer = 0;

  ROOT.addEventListener('hha:vr_tick', (ev)=>{
    const sec = Number(ev?.detail?.sec);
    if (!sec || sec < 1 || sec > 10) return;

    // show toast only in VR/cVR views
    const b = DOC.body;
    const isVr = b.classList.contains('view-vr') || b.classList.contains('view-cvr');
    if (!isVr) return;

    if (sec === lastSec) return;
    lastSec = sec;

    const danger = (sec <= 3);
    const cls = danger ? 'danger' : 'warn';

    const html = `
      <div>⏳ ใกล้หมดเวลา <b>${sec}</b> วินาที</div>
      <div class="sub">${danger ? 'เร่งยิงเป้าใกล้กลาง (อย่าโดนขยะ!)' : 'ยิงต่อเนื่อง รักษาความแม่น'}</div>
    `;

    toastSet(toastL, html, cls);
    toastSet(toastR, html, cls);

    // tick sound (soft) — important secs only
    if (sec === 10 || sec === 5 || sec === 3 || sec === 2 || sec === 1){
      beepTiny(danger ? 1040 : 900, 34, danger ? 0.045 : 0.035);
    }

    clearTimeout(hideTimer);
    hideTimer = setTimeout(()=>{
      toastHide(toastL);
      toastHide(toastR);
    }, 900);
  }, { passive:true });
}

/* ---------- Main ---------- */
function main(){
  const btnStart = DOC.getElementById('btnStart');
  const startOverlay = DOC.getElementById('startOverlay');
  const startMeta = DOC.getElementById('startMeta');

  const btnViewPC = DOC.getElementById('btnViewPC');
  const btnViewMobile = DOC.getElementById('btnViewMobile');
  const btnViewVR = DOC.getElementById('btnViewVR');
  const btnViewCVR = DOC.getElementById('btnViewCVR');

  const btnPeek = DOC.getElementById('btnPeek');
  const gjPeek = DOC.getElementById('gjPeek');

  const btnToggleHud = DOC.getElementById('btnToggleHud');
  const btnEnterFS = DOC.getElementById('btnEnterFS');
  const btnEnterVR = DOC.getElementById('btnEnterVR');

  const vrHint = DOC.getElementById('vrHint');
  const btnVrOk = DOC.getElementById('btnVrOk');

  // defaults
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const run  = String(qs('run','play')).toLowerCase();
  const end  = String(qs('end','time')).toLowerCase();
  const ch   = String(qs('ch', qs('challenge','rush'))).toLowerCase();
  const hub  = String(qs('hub','') || '');
  const seed = qs('seed', null);
  const miss = qs('miss', null);

  // view default (mobile first)
  const viewQ = String(qs('view', '')||'').toLowerCase();
  const defaultView = viewQ || (/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent) ? 'mobile' : 'pc');
  setBodyView(defaultView === 'cvr' ? 'cvr' : (defaultView === 'vr' ? 'vr' : (defaultView === 'pc' ? 'pc' : 'mobile')));

  // start meta
  if (startMeta){
    startMeta.textContent = `diff=${diff} • time=${time}s • run=${run} • end=${end} • ch=${ch}`;
  }
  show(startOverlay, true);

  // peek default off
  if (gjPeek) gjPeek.setAttribute('aria-hidden', 'true');

  // bind low-time toast
  bindVrTickToast();

  // view buttons
  function setView(v){
    setBodyView(v);
    if (v === 'vr' || v === 'cvr'){
      DOC.body.classList.add('vr-compact');
    } else {
      DOC.body.classList.remove('vr-compact');
    }
  }
  btnViewPC && btnViewPC.addEventListener('click', ()=> setView('pc'));
  btnViewMobile && btnViewMobile.addEventListener('click', ()=> setView('mobile'));
  btnViewVR && btnViewVR.addEventListener('click', ()=> setView('vr'));
  btnViewCVR && btnViewCVR.addEventListener('click', ()=> setView('cvr'));

  // Missions peek
  btnPeek && btnPeek.addEventListener('click', ()=>{
    const on = !(DOC.body.classList.contains('peek-on'));
    DOC.body.classList.toggle('peek-on', on);
    if (gjPeek) gjPeek.setAttribute('aria-hidden', on ? 'false' : 'true');
  });

  // HUD toggle (hide/unhide)
  btnToggleHud && btnToggleHud.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
  });

  // Fullscreen
  btnEnterFS && btnEnterFS.addEventListener('click', async ()=>{
    await enterFullscreen();
  });

  // Enter VR (use cVR for mobile cardboard feel)
  btnEnterVR && btnEnterVR.addEventListener('click', async ()=>{
    await enterFullscreen();
    await lockLandscapeBestEffort();
    setView('cvr');
    if (isPortrait()) show(vrHint, true);
  });

  btnVrOk && btnVrOk.addEventListener('click', ()=>{
    show(vrHint, false);
  });

  // Start game gate
  let started = false;
  btnStart && btnStart.addEventListener('click', async ()=>{
    if (started) return;
    started = true;

    // hide overlay first (fast)
    show(startOverlay, false);

    // build opts for engine
    const opts = {
      diff, run, time,
      endPolicy: end,
      challenge: ch,
      seed: seed || undefined,

      // dual-eye wiring
      layerEl:  DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer'),
      layerElR: DOC.getElementById('gj-layer-r'),
      crosshairEl:  DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair'),
      crosshairElR: DOC.getElementById('gj-crosshair-r'),
      shootEl: DOC.getElementById('btnShoot'),

      context: {
        projectTag: 'GoodJunkVR',
        hub
      }
    };

    if (miss != null) opts.miss = Number(miss)||0;

    // Start engine
    engineBoot(opts);

    // Hook universal shoot event (from vr-ui.js) -> engine shoot
    ROOT.addEventListener('hha:shoot', ()=>{
      try{ ROOT.GoodJunkVR?.shoot?.(); }catch(_){}
    }, { passive:true });
  });

  // keep fs class in sync
  DOC.addEventListener('fullscreenchange', ()=>{
    DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
  }, { passive:true });
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}