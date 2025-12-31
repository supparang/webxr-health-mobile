// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Start Gate + VR HUD UX)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ VR hint overlay OK -> hide (does NOT start engine)
// ✅ Engine autostart=false, starts after pressing "เริ่มเล่น"
// ✅ VR mini HUD + Quest Peek + Quest Toast on quest:update

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}

function fatalScreen(msg){
  const d = document;
  const box = d.createElement('div');
  box.style.cssText = `
    position:fixed; inset:0; z-index:9999;
    background:#020617; color:#e5e7eb;
    display:flex; align-items:center; justify-content:center;
    padding:20px; text-align:left;
    font:800 14px/1.45 system-ui;
  `;
  box.innerHTML = `
    <div style="max-width:760px;background:rgba(15,23,42,.86);border:1px solid rgba(148,163,184,.22);
      border-radius:18px;padding:16px;box-shadow:0 20px 60px rgba(0,0,0,.6)">
      <div style="font-size:18px;font-weight:1000">GoodJunkVR โหลดไม่ครบ</div>
      <div style="margin-top:8px;opacity:.92;white-space:pre-wrap">${msg}</div>
      <div style="margin-top:12px;opacity:.75;font-size:12px">
        แนะนำ: เปิด URL เต็ม / เพิ่ม ?v=ใหม่ / ล้างแคช Chrome (Settings → Site settings → Storage)
      </div>
    </div>
  `;
  d.body.appendChild(box);
}

function selfCheck(){
  const needIds = [
    'gj-stage','gj-layer-l','btnShoot',
    'startOverlay','btnStart','vrHint','btnVrOk',
    'vrMiniHud','btnQuestPeek','questPeek','btnPeekClose'
  ];
  const miss = needIds.filter(id => !document.getElementById(id));
  if (miss.length){
    fatalScreen(
      `ไม่พบ element สำคัญ: ${miss.join(', ')}\n` +
      `เหมือนเปิดผิดไฟล์/ผิด path หรือ deploy ยังไม่อัปเดต\n` +
      `URL ที่ควรเป็น: /webxr-health-mobile/herohealth/goodjunk-vr.html`
    );
    return false;
  }
  return true;
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  // toggle mini hud visibility based on view
  const mini = DOC.getElementById('vrMiniHud');
  if (mini) mini.hidden = !(view === 'vr' || view === 'cvr');
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

function isLandscape(){
  return (ROOT.innerWidth || 0) >= (ROOT.innerHeight || 0);
}

function syncMeta(){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  hudMeta.textContent = `[BOOT] ready • dual=${dual} • v=${v}`;
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  const coarse = ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches;
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
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

  function showVrHint(){
    if (!vrHint) return;
    vrHint.hidden = false;
  }
  function hideVrHint(){
    if (!vrHint) return;
    vrHint.hidden = true;
  }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // reserved for future WebXR; safe no-op
  btnVR && btnVR.addEventListener('click', ()=>{
    // (optional) If later you add A-Frame/WebXR, call enter-vr here.
    // For cardboard now: use VR/cVR buttons (dual-eye split).
  });
}

function hookQuestUX(){
  const btnPeek = DOC.getElementById('btnQuestPeek');
  const peek = DOC.getElementById('questPeek');
  const close = DOC.getElementById('btnPeekClose');

  const peekGoal = DOC.getElementById('peekGoal');
  const peekMini = DOC.getElementById('peekMini');
  const peekProg = DOC.getElementById('peekProgress');

  const toast = DOC.getElementById('questToast');
  const toastLine = DOC.getElementById('toastLine');

  let toastTimer = 0;

  function inVR(){
    return DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
  }

  function showPeek(){
    if (!peek) return;
    peek.hidden = false;
  }
  function hidePeek(){
    if (!peek) return;
    peek.hidden = true;
  }

  btnPeek && btnPeek.addEventListener('click', ()=>{
    if (!inVR()) return;
    showPeek();
  });
  close && close.addEventListener('click', hidePeek);

  // mirror HUD to mini HUD
  const mScore = DOC.getElementById('mScore');
  const mMiss  = DOC.getElementById('mMiss');
  const mTime  = DOC.getElementById('mTime');

  ROOT.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if (mScore) mScore.textContent = String(d.score ?? 0);
    if (mMiss)  mMiss.textContent  = String(d.misses ?? d.miss ?? 0);
  }, { passive:true });

  ROOT.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    if (mTime) mTime.textContent = String(d.left ?? 0);
  }, { passive:true });

  ROOT.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    const gTitle = d.goalTitle ?? 'Goal: —';
    const gNow   = d.goalNow ?? 0;
    const gTot   = d.goalTotal ?? 0;
    const mTitle = d.miniTitle ?? 'Mini: —';
    const mNow   = d.miniNow ?? 0;
    const mTot   = d.miniTotal ?? 0;

    if (peekGoal) peekGoal.textContent = `${gTitle}  ${gNow}/${gTot}`;
    if (peekMini) peekMini.textContent = `${mTitle}  ${mNow}/${mTot}`;
    if (peekProg) peekProg.textContent = `Goals ${gNow}/${gTot} • Minis ${mNow}/${mTot}`;

    // VR toast
    if (inVR() && toast && toastLine){
      toastLine.textContent = `${gTitle} ${gNow}/${gTot} • ${mTitle} ${mNow}/${mTot}`;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(()=>{ toast.hidden = true; }, 2200);
    }
  }, { passive:true });
}

function bootEngine(){
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
    autostart: false,   // ✅ gate start
    context: { projectTag: qs('projectTag','GoodJunkVR') }
  });

  return api;
}

function hookStartButton(api){
  const overlay = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');
  const meta = DOC.getElementById('startMeta');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = qs('time','70');
  const view = DOC.body.classList.contains('view-vr') ? 'vr'
            : DOC.body.classList.contains('view-cvr') ? 'cvr'
            : DOC.body.classList.contains('view-mobile') ? 'mobile' : 'pc';

  if (meta){
    meta.textContent = `diff=${diff} • run=${run} • time=${time}s • view=${view}`;
  }

  function startNow(){
    if (!api || typeof api.start !== 'function') return;
    overlay && (overlay.style.display = 'none');
    api.start();
  }

  btn && btn.addEventListener('click', ()=>{
    // If VR mode but portrait -> show hint and block start until user rotates
    if ((DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr')) && !isLandscape()){
      const vrHint = DOC.getElementById('vrHint');
      if (vrHint) vrHint.hidden = false;
      return;
    }
    startNow();
  });

  // optional: autoStart=1 for kiosk
  const auto = String(qs('autoStart','0')) === '1';
  if (auto) setTimeout(startNow, 60);
}

function main(){
  if (!selfCheck()) return;

  hookViewButtons();
  hookQuestUX();

  setBodyView(pickInitialView());
  syncMeta();
  syncFsClass();

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // show VR hint initially if query says view=vr/cvr
  const v = String(qs('view','')).toLowerCase();
  if (v === 'vr' || v === 'cvr'){
    const vrHint = DOC.getElementById('vrHint');
    if (vrHint) vrHint.hidden = false;
  }

  const api = bootEngine();
  hookStartButton(api);
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();