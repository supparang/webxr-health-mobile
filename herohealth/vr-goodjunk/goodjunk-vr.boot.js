// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start Gate + Views + Auto Cardboard on Rotate)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function isMobile(){
  return /(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent || '');
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  try{ localStorage.setItem('HHA_LAST_VIEW', view); }catch(_){}
}

function getSavedView(){
  try{ return String(localStorage.getItem('HHA_LAST_VIEW')||''); }catch(_){}
  return '';
}

function show(el, on){
  if (!el) return;
  el.hidden = !on;
}

function isPortrait(){
  return (ROOT.innerHeight || 1) >= (ROOT.innerWidth || 1);
}
function isLandscape(){
  return !isPortrait();
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

/* ---------- Low-time toast (optional) ---------- */
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
  el.innerHTML = `<div>${html}</div>`;
  el.classList.add('show');
}
function toastHide(el){
  if (!el) return;
  el.classList.remove('show');
}
function bindVrTickToast(){
  const toastL = DOC.getElementById('gjToastL');
  const toastR = DOC.getElementById('gjToastR');
  if (!toastL && !toastR) return;

  let lastSec = null;
  let hideTimer = 0;

  ROOT.addEventListener('hha:vr_tick', (ev)=>{
    const sec = Number(ev?.detail?.sec);
    if (!sec || sec < 1 || sec > 10) return;

    const b = DOC.body;
    const isVr = b.classList.contains('view-vr') || b.classList.contains('view-cvr');
    if (!isVr) return;

    if (sec === lastSec) return;
    lastSec = sec;

    const danger = (sec <= 3);
    const cls = danger ? 'danger' : 'warn';

    const html = `
      ⏳ ใกล้หมดเวลา <b>${sec}</b> วินาที
      <div class="sub">${danger ? 'เร่งยิงเป้าใกล้กลาง (อย่าโดนขยะ!)' : 'ยิงต่อเนื่อง รักษาความแม่น'}</div>
    `;

    toastSet(toastL, html, cls);
    toastSet(toastR, html, cls);

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

/* ---------- Auto Cardboard on Rotate ---------- */
/*
  เป้าหมาย:
  - ถ้าเป็นมือถือ + หมุนเป็นแนวนอน => เข้า cVR อัตโนมัติ (best effort)
  - ถ้าผู้ใช้ตั้งใจเลือก PC/mobile เองแล้ว => ไม่ไปแย่ง (respect manual)
  - ช่วยให้ flow: เปิดลิงก์ -> หมุนมือถือ -> เข้า cVR -> ใส่ cardboard -> เล่น
*/
let manualViewChosen = false;

async function goCardboardAuto({force=false} = {}){
  if (!isMobile()) return;
  if (!isLandscape()) return;

  const cur = DOC.body.classList.contains('view-cvr') ? 'cvr'
           : DOC.body.classList.contains('view-vr') ? 'vr'
           : DOC.body.classList.contains('view-pc') ? 'pc' : 'mobile';

  if (!force){
    if (manualViewChosen) return;
    if (cur === 'cvr') return;
  }

  await enterFullscreen();
  await lockLandscapeBestEffort();
  setBodyView('cvr');
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

  // view default:
  // priority: ?view=... > last saved > device heuristic
  const viewQ = String(qs('view', '')||'').toLowerCase();
  const saved = getSavedView().toLowerCase();
  const heuristic = isMobile() ? 'mobile' : 'pc';
  const defaultView = viewQ || saved || heuristic;

  setBodyView(
    defaultView === 'cvr' ? 'cvr' :
    defaultView === 'vr'  ? 'vr'  :
    defaultView === 'pc'  ? 'pc'  : 'mobile'
  );

  // meta
  if (startMeta){
    startMeta.textContent = `diff=${diff} • time=${time}s • run=${run} • end=${end} • ch=${ch}`;
  }
  show(startOverlay, true);

  // peek default off
  if (gjPeek) gjPeek.setAttribute('aria-hidden', 'true');

  // optional low-time toast
  bindVrTickToast();

  // view setters
  function setView(v, {manual=true} = {}){
    if (manual) manualViewChosen = true;

    setBodyView(v);

    if (v === 'vr' || v === 'cvr'){
      DOC.body.classList.add('vr-compact');
    } else {
      DOC.body.classList.remove('vr-compact');
    }

    if (v === 'cvr'){
      // best effort stability
      enterFullscreen();
      lockLandscapeBestEffort();
      if (isPortrait()) show(vrHint, true);
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

  // HUD toggle
  btnToggleHud && btnToggleHud.addEventListener('click', ()=>{
    DOC.body.classList.toggle('hud-hidden');
  });

  // Fullscreen
  btnEnterFS && btnEnterFS.addEventListener('click', async ()=>{
    manualViewChosen = true;
    await enterFullscreen();
  });

  // Enter VR fallback button (forces cVR)
  btnEnterVR && btnEnterVR.addEventListener('click', async ()=>{
    manualViewChosen = true;
    await enterFullscreen();
    await lockLandscapeBestEffort();
    setView('cvr', {manual:true});
    if (isPortrait()) show(vrHint, true);
  });

  btnVrOk && btnVrOk.addEventListener('click', ()=>{
    show(vrHint, false);
  });

  // AUTO: on load, if mobile+landscape -> go cVR (unless user already chose manually)
  goCardboardAuto({force:false});

  // AUTO: on rotate/resize/orientationchange
  let rotTimer = 0;
  function onRotate(){
    clearTimeout(rotTimer);
    rotTimer = setTimeout(()=> goCardboardAuto({force:false}), 120);
  }
  ROOT.addEventListener('orientationchange', onRotate, { passive:true });
  ROOT.addEventListener('resize', onRotate, { passive:true });

  // Start game gate
  let started = false;
  let shootBound = false;

  btnStart && btnStart.addEventListener('click', async ()=>{
    if (started) return;
    started = true;

    show(startOverlay, false);

    const opts = {
      diff, run, time,
      endPolicy: end,
      challenge: ch,
      seed: seed || undefined,

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

    engineBoot(opts);

    // bind hha:shoot only once
    if (!shootBound){
      shootBound = true;
      ROOT.addEventListener('hha:shoot', ()=>{
        try{ ROOT.GoodJunkVR?.shoot?.(); }catch(_){}
      }, { passive:true });
    }
  });

  DOC.addEventListener('fullscreenchange', ()=>{
    DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
  }, { passive:true });
}

if (DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
} else {
  main();
}