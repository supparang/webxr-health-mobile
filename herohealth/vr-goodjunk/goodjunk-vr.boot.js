// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (START-GATED + VR MINI HUD + PEEK + LOWTIME HOOK)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ Enter VR => fullscreen + cVR + hint + auto hide HUD
// ✅ Toggle HUD (body.hud-hidden) + Missions Peek always available
// ✅ VR Mini HUD shows Score/Time/Grade (compact, readable)
// ✅ Starts engine ONLY after pressing "เริ่มเล่น"

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
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
  syncReserves();
}

/* ===== Peek (Missions) ===== */
function showPeek(ms=1400){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.add('show');
  peek.setAttribute('aria-hidden','false');
  if (ms > 0){
    clearTimeout(showPeek._t);
    showPeek._t = setTimeout(()=> hidePeek(), ms);
  }
}
function hidePeek(){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.remove('show');
  peek.setAttribute('aria-hidden','true');
}
function hookPeek(){
  const btnPeek = DOC.getElementById('btnPeek');
  const vrBtnPeek = DOC.getElementById('vrBtnPeek');
  const btnClose = DOC.getElementById('btnPeekClose');
  const peek = DOC.getElementById('gjPeek');

  btnPeek && btnPeek.addEventListener('click', ()=> showPeek(0));
  vrBtnPeek && vrBtnPeek.addEventListener('click', ()=> showPeek(0));
  btnClose && btnClose.addEventListener('click', ()=> hidePeek());

  // click outside card to close
  peek && peek.addEventListener('click', (e)=>{
    if (e.target === peek) hidePeek();
  });

  // esc close
  DOC.addEventListener('keydown', (e)=>{
    if (String(e.key||'').toLowerCase() === 'escape') hidePeek();
  });
}

/* ===== HUD toggle ===== */
function toggleHud(force){
  const b = DOC.body;
  const next = (typeof force === 'boolean') ? force : !b.classList.contains('hud-hidden');
  b.classList.toggle('hud-hidden', next);

  const btn = DOC.getElementById('btnToggleHud');
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';

  const vrBtn = DOC.getElementById('vrBtnHud');
  if (vrBtn) vrBtn.textContent = next ? 'HUD (Off)' : 'HUD';

  // when hide HUD in VR -> show peek quick (so user sees missions)
  if (next) showPeek(1100);

  syncReserves();
}

/* ===== View modes ===== */
function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  try{ localStorage.setItem('GJ_VIEW', view); }catch(_){}

  // show mini hud only in vr/cvr
  const mini = DOC.getElementById('vrMiniHud');
  if (mini){
    const on = (view === 'vr' || view === 'cvr');
    mini.hidden = !on;
    mini.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  // entering VR => quick peek
  if (view === 'vr' || view === 'cvr') showPeek(1200);

  syncReserves();
}

function pickInitialView(){
  const v = String(qs('view','') || '').toLowerCase();
  if (v === 'vr') return 'vr';
  if (v === 'cvr') return 'cvr';

  try{
    const saved = localStorage.getItem('GJ_VIEW');
    if (saved === 'pc' || saved === 'mobile' || saved === 'vr' || saved === 'cvr') return saved;
  }catch(_){}

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
  const btnHUD= DOC.getElementById('btnToggleHud');
  const vrHud = DOC.getElementById('vrBtnHud');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); toggleHud(false); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); toggleHud(false); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnHUD && btnHUD.addEventListener('click', ()=> toggleHud());
  vrHud  && vrHud.addEventListener('click',  ()=> toggleHud());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // Enter VR: fullscreen + switch to cVR + hint + auto hide HUD a bit
  btnVR && btnVR.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    setBodyView('cvr');
    showVrHint();
    setTimeout(()=> toggleHud(true), 1100);
  });
}

/* ===== Dynamic reserves ===== */
function px(n){ return (Number(n)||0) + 'px'; }
function syncReserves(){
  try{
    const hud = DOC.querySelector('.hha-hud');
    const fever = DOC.getElementById('hhaFever');
    const ctrl = DOC.querySelector('.hha-controls');

    const hudHidden = DOC.body.classList.contains('hud-hidden');

    if (hud){
      const r = hud.getBoundingClientRect();
      const cs = getComputedStyle(hud);
      const padTop = parseFloat(cs.paddingTop)||0;
      const sat = Math.max(0, padTop - 10);
      const usable = hudHidden ? 24 : Math.max(80, Math.round(r.height - sat));
      DOC.documentElement.style.setProperty('--hudH', px(usable));
    }
    if (fever){
      const r = fever.getBoundingClientRect();
      DOC.documentElement.style.setProperty('--feverH', px(Math.max(70, Math.round(r.height))));
    }
    if (ctrl){
      const r = ctrl.getBoundingClientRect();
      DOC.documentElement.style.setProperty('--ctrlH', px(Math.max(76, Math.round(r.height))));
    }
  }catch(_){}
}

/* ===== VR mini HUD updates (Score/Time/Grade) ===== */
function hookMiniHudUpdates(){
  const elS = DOC.getElementById('vrScore');
  const elT = DOC.getElementById('vrTime');
  const elG = DOC.getElementById('vrGrade');

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    if (elS) elS.textContent = String(d.score ?? 0);
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    if (elT) elT.textContent = String(d.left ?? 0);
  });

  // some games emit hha:rank, but HUD binder might compute grade too — we listen anyway
  ROOT.addEventListener('hha:rank', (ev)=>{
    const d = ev?.detail || {};
    if (elG) elG.textContent = String(d.grade ?? '—');
  });

  // fallback: when HUD updates grade in DOM, mirror it sometimes
  setInterval(()=>{
    try{
      if (!elG) return;
      const g = DOC.getElementById('hhaGrade');
      const txt = g ? (g.textContent||'').trim() : '';
      if (txt && txt !== '—') elG.textContent = txt;
    }catch(_){}
  }, 800);
}

/* ===== Start gate ===== */
function showStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = false;
  const meta = DOC.getElementById('startMeta');
  if (meta){
    const diff = qs('diff','normal');
    const time = qs('time', qs('duration','70'));
    meta.textContent = `diff=${diff} • time=${time}s • run=${qs('run','play')}`;
  }
}
function hideStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = true;
}

function bootEngine(){
  const layerL = DOC.getElementById('gj-layer-l') || DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  const crossL = DOC.getElementById('gj-crosshair-l') || DOC.getElementById('gj-crosshair');
  const crossR = DOC.getElementById('gj-crosshair-r');

  const shootEl = DOC.getElementById('btnShoot');
  const stageEl = DOC.getElementById('gj-stage');

  const diff = qs('diff','normal');
  const run  = qs('run','play');
  const time = Number(qs('time', qs('duration','70'))) || 70;

  const endPolicy = qs('end','time');       // time | all | miss
  const challenge = qs('challenge','rush'); // rush | survive | boss

  engineBoot({
    layerEl: layerL,
    layerElR: layerR,
    crosshairEl: crossL,
    crosshairElR: crossR,
    shootEl,
    stageEl,
    diff,
    run,
    time,
    endPolicy,
    challenge,
    context: { projectTag: qs('projectTag','HeroHealth') }
  });
}

function main(){
  hookPeek();
  hookViewButtons();
  hookMiniHudUpdates();

  setBodyView(pickInitialView());
  syncFsClass();
  syncReserves();

  ROOT.addEventListener('resize', ()=> syncReserves(), { passive:true });
  ROOT.addEventListener('orientationchange', ()=> setTimeout(syncReserves, 180), { passive:true });

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  showStartOverlay();
  const btnStart = DOC.getElementById('btnStart');
  btnStart && btnStart.addEventListener('click', ()=>{
    hideStartOverlay();
    syncReserves();
    bootEngine();
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();