// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start Gate + Views + VR Tick Toast + Universal VR UI bridge)
// ✅ Enter VR (viewbar + vr-ui.js) => cVR (dual-eye)
// ✅ Exit (vr-ui.js) => back to mobile + exit fullscreen (best-effort)
// ✅ Auto-rotate: landscape => cVR (mobile only) + 1-tap overlay for fullscreen/lock
// ✅ HUD policy: auto-hide in VR/cVR, HUD button cycles Auto/Show/Hide
// ✅ Start Gate preserved (engine starts ONLY after pressing "เริ่มเล่น")

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

async function exitFullscreenBestEffort(){
  try{
    if (DOC.fullscreenElement && DOC.exitFullscreen) await DOC.exitFullscreen();
  }catch(_){}
  DOC.body.classList.toggle('is-fs', !!DOC.fullscreenElement);
}

async function lockLandscapeBestEffort(){
  try{
    if (screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

/* ---------- User view lock (prevent auto-rotate from overriding user choice) ---------- */
let userLockedView = false;

function setViewUnlocked(v){
  userLockedView = false;
  setBodyView(v);
  if (v === 'vr' || v === 'cvr') DOC.body.classList.add('vr-compact');
  else DOC.body.classList.remove('vr-compact');
}

function setViewLocked(v){
  userLockedView = true;
  setBodyView(v);
  if (v === 'vr' || v === 'cvr') DOC.body.classList.add('vr-compact');
  else DOC.body.classList.remove('vr-compact');
}

/* ---------- 1-tap overlay for fullscreen/lock (shown on rotate to cVR) ---------- */
function ensureAutoCvrOverlay(){
  let el = DOC.getElementById('hhaAutoCvr');
  if (el) return el;

  el = DOC.createElement('div');
  el.id = 'hhaAutoCvr';
  el.hidden = true;
  el.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    display:flex; align-items:center; justify-content:center;
    background:rgba(0,0,0,.55);
    padding:22px;
    color:#fff;
    font:1000 18px/1.25 system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
    text-align:center;
  `;
  el.innerHTML = `
    <div style="max-width:520px;width:100%">
      <div style="font-size:22px;margin-bottom:10px">Cardboard พร้อมแล้ว</div>
      <div style="opacity:.92;margin-bottom:14px">
        เข้าโหมด 2 ตา (cVR) ให้แล้ว ✅<br/>
        แตะ 1 ครั้งเพื่อ “เต็มจอ/ล็อกแนวนอน” (ถ้ารองรับ)
      </div>
      <button id="btnAutoCvrGo" style="
        width:100%; padding:14px 16px; border:0; border-radius:14px;
        font:1000 18px/1 system-ui; cursor:pointer;
      ">แตะเพื่อเต็มจอ</button>
      <div style="opacity:.75;margin-top:10px;font-size:13px">
        หมายเหตุ: บางเครื่องต้อง “แตะ” ก่อนถึงจะ fullscreen/lock ได้
      </div>
    </div>
  `;
  DOC.body.appendChild(el);
  return el;
}

function showAutoCvrOverlay(on){
  const el = ensureAutoCvrOverlay();
  el.hidden = !on;
}

function bindAutoCvrOverlay(){
  const el = ensureAutoCvrOverlay();
  const btn = el.querySelector('#btnAutoCvrGo');
  if (!btn || btn.__bound__) return;
  btn.__bound__ = true;

  btn.addEventListener('click', async (e)=>{
    e.preventDefault();
    await enterFullscreen();
    await lockLandscapeBestEffort();
    showAutoCvrOverlay(false);
  }, { passive:false });

  // tap outside card => close only
  el.addEventListener('click', (e)=>{
    if (e.target === el) showAutoCvrOverlay(false);
  }, { passive:true });
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

  bindAutoCvrOverlay();

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
  setViewUnlocked(defaultView === 'cvr' ? 'cvr' : (defaultView === 'vr' ? 'vr' : (defaultView === 'pc' ? 'pc' : 'mobile')));

  // HUD policy for VR/cVR
  let hudUserOverride = null; // null=auto, true=force show, false=force hide
  function applyHudPolicy(){
    const b = DOC.body;
    const isVr = b.classList.contains('view-vr') || b.classList.contains('view-cvr');

    const shouldHide = (hudUserOverride == null) ? isVr : (hudUserOverride === false);
    const forceShow  = (hudUserOverride === true);

    if(forceShow){
      b.classList.remove('hud-hidden');
      return;
    }
    b.classList.toggle('hud-hidden', !!shouldHide);
  }

  // missions peek default off
  if (gjPeek) gjPeek.setAttribute('aria-hidden', 'true');

  // start meta
  if (startMeta){
    startMeta.textContent = `diff=${diff} • time=${time}s • run=${run} • end=${end} • ch=${ch}`;
  }
  show(startOverlay, true);

  // bind low-time toast
  bindVrTickToast();

  // view buttons (USER LOCK)
  function setView(v){
    setViewLocked(v);
    applyHudPolicy();

    // entering VR/cVR => keep peek off by default (user can open with Missions)
    if (v === 'vr' || v === 'cvr'){
      DOC.body.classList.remove('peek-on');
      if (gjPeek) gjPeek.setAttribute('aria-hidden', 'true');
    }
  }

  btnViewPC && btnViewPC.addEventListener('click', ()=> setView('pc'));
  btnViewMobile && btnViewMobile.addEventListener('click', async ()=>{
    // treat as "exit" style: go mobile + (optional) exit fullscreen
    await exitFullscreenBestEffort();
    show(vrHint, false);
    showAutoCvrOverlay(false);
    setView('mobile');
  });
  btnViewVR && btnViewVR.addEventListener('click', ()=> setView('vr'));
  btnViewCVR && btnViewCVR.addEventListener('click', ()=> setView('cvr'));

  // Missions peek
  btnPeek && btnPeek.addEventListener('click', ()=>{
    const on = !(DOC.body.classList.contains('peek-on'));
    DOC.body.classList.toggle('peek-on', on);
    if (gjPeek) gjPeek.setAttribute('aria-hidden', on ? 'false' : 'true');
  });

  // HUD toggle => cycles Auto -> Show -> Hide -> Auto
  btnToggleHud && btnToggleHud.addEventListener('click', ()=>{
    if (hudUserOverride == null) hudUserOverride = true;
    else if (hudUserOverride === true) hudUserOverride = false;
    else hudUserOverride = null;
    applyHudPolicy();
  });

  // Fullscreen
  btnEnterFS && btnEnterFS.addEventListener('click', async ()=>{
    await enterFullscreen();
  });

  // Enter VR fallback button => enter cVR (dual-eye)
  btnEnterVR && btnEnterVR.addEventListener('click', async ()=>{
    await enterFullscreen();
    await lockLandscapeBestEffort();
    setView('cvr');
    if (isPortrait()) show(vrHint, true);
  });

  btnVrOk && btnVrOk.addEventListener('click', ()=>{
    show(vrHint, false);
  });

  // Universal VR UI bridge
  ROOT.addEventListener('hha:enter_vr', async ()=>{
    await enterFullscreen();
    await lockLandscapeBestEffort();
    // do NOT lock user on auto-enter, but this is user gesture (button press)
    setView('cvr');
    if (isPortrait()) show(vrHint, true);
  }, { passive:true });

  ROOT.addEventListener('hha:exit_vr', async ()=>{
    await exitFullscreenBestEffort();
    show(vrHint, false);
    showAutoCvrOverlay(false);
    setView('mobile');
  }, { passive:true });

  ROOT.addEventListener('hha:recenter', ()=>{
    // DOM game: just hide hint
    show(vrHint, false);
  }, { passive:true });

  // Auto rotate: landscape => cVR, portrait => mobile (mobile only), unless user locked
  const isMobileUA = (/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent));
  function autoRotateToCVR(){
    if(!isMobileUA) return;
    if(userLockedView) return;

    const landscape = !isPortrait();
    if(landscape){
      setViewUnlocked('cvr');
      applyHudPolicy();
      showAutoCvrOverlay(true);
    }else{
      setViewUnlocked('mobile');
      applyHudPolicy();
      showAutoCvrOverlay(false);
    }
  }
  ROOT.addEventListener('orientationchange', autoRotateToCVR, { passive:true });
  ROOT.addEventListener('resize', autoRotateToCVR, { passive:true });
  autoRotateToCVR();

  // apply HUD policy initially
  applyHudPolicy();

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

    // Hook universal shoot event (from vr-ui.js) -> engine shoot (bind once)
    if (!ROOT.__HHA_GJ_SHOOT_BOUND__){
      ROOT.__HHA_GJ_SHOOT_BOUND__ = true;
      ROOT.addEventListener('hha:shoot', ()=>{
        try{ ROOT.GoodJunkVR?.shoot?.(); }catch(_){}
      }, { passive:true });
    }
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