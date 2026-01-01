// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (START-GATED + VR COMPACT HUD + VR TOAST)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ Enter VR => fullscreen + cVR + hint + auto HUD off
// ✅ Toggle HUD (body.hud-hidden)
// ✅ Missions button: show/hide Quest Peek instantly
// ✅ VR Compact HUD sync: listens hha:score/hha:time/hha:rank
// ✅ VR Toast: listens hha:judge + lowtime tick event hha:vr_tick (from safe.js)
// ✅ Starts engine ONLY after pressing "เริ่มเล่น"

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
  try{ localStorage.setItem('GJ_VIEW', view); }catch(_){}
  syncReserves();
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

/* ===== Dynamic reserves: keep playfield away from HUD/fever/controls ===== */
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

/* ===== Quest Peek ===== */
function showPeek(ms=1200){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.add('show');
  if (ms > 0) setTimeout(()=>peek.classList.remove('show'), ms);
}
function togglePeek(){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  const on = !peek.classList.contains('show');
  peek.classList.toggle('show', on);
  if (on) setTimeout(()=>peek.classList.remove('show'), 1600);
}

/* ===== HUD toggle ===== */
function toggleHud(force){
  const b = DOC.body;
  const next = (typeof force === 'boolean') ? force : !b.classList.contains('hud-hidden');
  b.classList.toggle('hud-hidden', next);

  const btn = DOC.getElementById('btnToggleHUD');
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';

  if (next) showPeek(1300);
  syncReserves();
}

/* ===== VR Compact HUD sync ===== */
function setText(id, t){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(t ?? '');
}
function tickCompact(){
  const el = DOC.getElementById('vrCompactHud');
  if (!el) return;
  el.classList.add('tick');
  setTimeout(()=>el.classList.remove('tick'), 160);
}

/* ===== VR Toast ===== */
let toastTimer = 0;
function showToast(text, kind='warn', ms=700){
  const wrap = DOC.getElementById('vrToast');
  const card = DOC.getElementById('vrToastText');
  if (!wrap || !card) return;

  wrap.hidden = false;
  card.classList.remove('warn','bad');
  card.classList.add(kind === 'bad' ? 'bad' : 'warn');
  card.textContent = String(text || '—');

  try{ clearTimeout(toastTimer); }catch(_){}
  toastTimer = setTimeout(()=>{ wrap.hidden = true; }, clampMs(ms));
}
function clampMs(ms){ ms = Number(ms)||0; return Math.max(350, Math.min(1400, ms)); }

/* ===== View buttons + FS + VR ===== */
function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');
  const btnHUD= DOC.getElementById('btnToggleHUD');
  const btnPeek = DOC.getElementById('btnPeek');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); toggleHud(false); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); toggleHud(false); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); showPeek(1200); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); showPeek(1200); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnHUD && btnHUD.addEventListener('click', ()=> toggleHud());
  btnPeek && btnPeek.addEventListener('click', ()=> togglePeek());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // Enter VR: fullscreen + cVR + hint + auto-hide HUD
  btnVR && btnVR.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    setBodyView('cvr');
    showVrHint();
    showPeek(1300);
    setTimeout(()=> toggleHud(true), 1100);
  });
}

/* ===== Start overlay ===== */
function showStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = false;
  const meta = DOC.getElementById('startMeta');
  if (meta){
    const diff = qs('diff','normal');
    const time = qs('time', qs('duration','70'));
    meta.textContent = `diff=${diff} • time=${time}s • run=${qs('run','play')} • end=${qs('end','time')} • challenge=${qs('challenge','rush')}`;
  }
}
function hideStartOverlay(){
  const ol = DOC.getElementById('startOverlay');
  if (ol) ol.hidden = true;
}

/* ===== Boot engine ===== */
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

  const endPolicy = qs('end','time');            // time | all | miss
  const challenge = qs('challenge','rush');      // rush | survive | boss

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

/* ===== Listen game events -> VR UI ===== */
function hookGameEvents(){
  // score -> vrScore
  ROOT.addEventListener('hha:score', (ev)=>{
    const s = ev?.detail || {};
    setText('vrScore', s.score ?? 0);
  });

  // time -> vrTime + lowtime tick
  ROOT.addEventListener('hha:time', (ev)=>{
    const t = ev?.detail || {};
    const left = Number(t.left ?? 0) || 0;
    setText('vrTime', left);

    // micro tick every ~1 sec only when lowtime
    if (left <= 10){
      tickCompact();
    }
  });

  // rank -> vrGrade
  ROOT.addEventListener('hha:rank', (ev)=>{
    const r = ev?.detail || {};
    setText('vrGrade', r.grade ?? '—');
  });

  // judge -> toast (only warn/bad)
  ROOT.addEventListener('hha:judge', (ev)=>{
    const j = ev?.detail || {};
    const kind = String(j.kind || 'info');
    const text = String(j.text || '');

    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (!isVR) return;

    if (kind === 'warn') showToast(text, 'warn', 720);
    if (kind === 'bad')  showToast(text, 'bad', 780);
  });

  // lowtime tick event from safe.js
  ROOT.addEventListener('hha:vr_tick', (ev)=>{
    const d = ev?.detail || {};
    const sec = Number(d.sec||0);
    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (!isVR) return;
    tickCompact();
    if (sec <= 3) showToast(`⚠️ เหลือ ${sec} วิ!`, sec <= 1 ? 'bad' : 'warn', 760);
  });
}

function main(){
  hookViewButtons();
  hookGameEvents();

  setBodyView(pickInitialView());
  syncFsClass();
  syncReserves();

  ROOT.addEventListener('resize', ()=> syncReserves(), { passive:true });
  ROOT.addEventListener('orientationchange', ()=> setTimeout(syncReserves, 180), { passive:true });

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // START-GATE
  showStartOverlay();
  const btnStart = DOC.getElementById('btnStart');
  btnStart && btnStart.addEventListener('click', ()=>{
    hideStartOverlay();
    syncReserves();
    bootEngine();
    // show peek briefly at start (esp VR)
    showPeek(1100);
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();