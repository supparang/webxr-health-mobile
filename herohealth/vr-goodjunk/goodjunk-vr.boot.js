// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (START-GATED + VR COMPACT HUD + VR TOAST + END OVERLAY)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ Enter VR => fullscreen + cVR + hint + auto HUD off
// ✅ Toggle HUD (body.hud-hidden)
// ✅ Missions button: show/hide Quest Peek instantly
// ✅ VR Compact HUD (L/R) sync: listens hha:score/hha:time/hha:rank
// ✅ VR Toast (L/R): listens hha:judge + lowtime tick event hha:vr_tick
// ✅ End overlay (Replay / Back HUB / Copy JSON) on hha:end
// ✅ Starts engine ONLY after pressing "เริ่มเล่น"

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC = document;

function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b,v)); }

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

  const coarse = (ROOT.matchMedia && ROOT.matchMedia('(pointer: coarse)').matches);
  const w = ROOT.innerWidth || 360;
  const h = ROOT.innerHeight || 640;
  const mobileLike = coarse || Math.min(w,h) < 520;
  return mobileLike ? 'mobile' : 'pc';
}

/* ===== Dynamic reserves: keep spawner away from HUD/fever/controls ===== */
function px(n){ return (Number(n)||0) + 'px'; }
function syncReserves(){
  try{
    const hud = DOC.querySelector('.hha-hud');
    const fever = DOC.getElementById('hhaFever');
    const ctrl = DOC.querySelector('.hha-controls');

    const hudHidden = DOC.body.classList.contains('hud-hidden');

    if (hud){
      const r = hud.getBoundingClientRect();
      const usable = hudHidden ? 24 : Math.max(80, Math.round(r.height));
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

  const btn = DOC.getElementById('btnToggleHud');
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';

  if (next) showPeek(1300);
  syncReserves();
}

/* ===== VR Compact HUD sync (dual-eye) ===== */
function setText(id, t){
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(t ?? '');
}
function tickCompact(){
  const L = DOC.getElementById('vrCompactHud-l');
  const R = DOC.getElementById('vrCompactHud-r');
  if (L) L.classList.add('tick');
  if (R) R.classList.add('tick');
  setTimeout(()=>{
    try{ L && L.classList.remove('tick'); }catch(_){}
    try{ R && R.classList.remove('tick'); }catch(_){}
  }, 170);
}

/* ===== VR Toast (dual-eye) ===== */
let toastTimer = 0;
function showToast(text, kind='warn', ms=720){
  const wl = DOC.getElementById('vrToast-l');
  const wr = DOC.getElementById('vrToast-r');
  const tl = DOC.getElementById('vrToastText-l');
  const tr = DOC.getElementById('vrToastText-r');
  if (!wl || !wr || !tl || !tr) return;

  wl.hidden = false; wr.hidden = false;

  tl.classList.remove('warn','bad');
  tr.classList.remove('warn','bad');
  tl.classList.add(kind === 'bad' ? 'bad' : 'warn');
  tr.classList.add(kind === 'bad' ? 'bad' : 'warn');

  tl.textContent = String(text || '—');
  tr.textContent = String(text || '—');

  try{ clearTimeout(toastTimer); }catch(_){}
  toastTimer = setTimeout(()=>{ wl.hidden = true; wr.hidden = true; }, clamp(ms, 380, 1400));
}

/* ===== End overlay binder ===== */
function bindEndOverlay(){
  const overlay = DOC.getElementById('endOverlay');
  if (!overlay) return;

  const btnReplay = DOC.getElementById('btnReplay');
  const btnHub   = DOC.getElementById('btnBackHub');
  const btnCopy  = DOC.getElementById('btnCopyJson');

  let lastSummary = null;

  function show(summary){
    lastSummary = summary || null;

    const acc = Number(summary?.accuracyGoodPct ?? 0) || 0;
    const grade = String(summary?.grade ?? '—');

    setText('endGrade', grade);
    setText('endScore', summary?.scoreFinal ?? 0);
    setText('endAcc', `${acc}%`);
    setText('endCombo', summary?.comboMax ?? 0);
    setText('endMiss', summary?.misses ?? 0);
    setText('endTimePlayed', `${summary?.durationPlayedSec ?? 0}s`);
    setText('endQuest', `${summary?.goalsCleared ?? 0}/${summary?.goalsTotal ?? 0} • ${summary?.miniCleared ?? 0}/${summary?.miniTotal ?? 0}`);

    const sub = [
      `reason=${summary?.reason ?? 'end'}`,
      `diff=${summary?.diff ?? '-'}`,
      `run=${summary?.runMode ?? '-'}`,
      `end=${summary?.endPolicy ?? '-'}`,
      `challenge=${summary?.challenge ?? '-'}`
    ].join(' • ');
    setText('endSub', sub);

    overlay.hidden = false;

    // leave VR/cVR: keep overlay readable (optional)
    showPeek(0);
    toggleHud(false);
    syncReserves();
  }

  function hide(){ overlay.hidden = true; }

  btnReplay && btnReplay.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  btnCopy && btnCopy.addEventListener('click', async ()=>{
    try{
      const txt = JSON.stringify(lastSummary || {}, null, 2);
      await navigator.clipboard.writeText(txt);
      showToast('✅ Copy JSON แล้ว', 'warn', 680);
    }catch(_){
      showToast('❌ Copy ไม่สำเร็จ', 'bad', 760);
    }
  });

  btnHub && btnHub.addEventListener('click', async ()=>{
    const hub = qs('hub', './index.html');
    try{
      // flush-hardened: ask engine to end + flush first
      if (ROOT.GoodJunkVR && typeof ROOT.GoodJunkVR.endGame === 'function'){
        await ROOT.GoodJunkVR.endGame('back_hub');
      }
    }catch(_){}
    setTimeout(()=>{ location.href = hub; }, 120);
  });

  ROOT.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || null;
    show(summary);
  });

  // hide overlay when re-enter start overlay (rare)
  ROOT.addEventListener('hha:force_end', ()=>{ try{ hide(); }catch(_){ } });
}

/* ===== View buttons + FS + VR ===== */
function hookViewButtons(){
  const btnPC = DOC.getElementById('btnViewPC');
  const btnM  = DOC.getElementById('btnViewMobile');
  const btnV  = DOC.getElementById('btnViewVR');
  const btnC  = DOC.getElementById('btnViewCVR');
  const btnFS = DOC.getElementById('btnEnterFS');
  const btnVR = DOC.getElementById('btnEnterVR');
  const btnHUD= DOC.getElementById('btnToggleHud');
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
    setTimeout(()=> toggleHud(true), 1050);
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
  ROOT.addEventListener('hha:score', (ev)=>{
    const s = ev?.detail || {};
    setText('vrScore-l', s.score ?? 0);
    setText('vrScore-r', s.score ?? 0);
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const t = ev?.detail || {};
    const left = Number(t.left ?? 0) || 0;
    setText('vrTime-l', left);
    setText('vrTime-r', left);

    if (left <= 10){
      const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
      if (isVR) tickCompact();
    }
  });

  ROOT.addEventListener('hha:rank', (ev)=>{
    const r = ev?.detail || {};
    setText('vrGrade-l', r.grade ?? '—');
    setText('vrGrade-r', r.grade ?? '—');
  });

  ROOT.addEventListener('hha:judge', (ev)=>{
    const j = ev?.detail || {};
    const kind = String(j.kind || 'info');
    const text = String(j.text || '');

    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (!isVR) return;

    if (kind === 'warn') showToast(text, 'warn', 740);
    if (kind === 'bad')  showToast(text, 'bad', 780);
  });

  ROOT.addEventListener('hha:vr_tick', (ev)=>{
    const d = ev?.detail || {};
    const sec = Number(d.sec||0);
    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
    if (!isVR) return;

    tickCompact();
    if (sec <= 3) showToast(`⚠️ เหลือ ${sec} วิ!`, sec <= 1 ? 'bad' : 'warn', 780);
  });
}

function main(){
  hookViewButtons();
  hookGameEvents();
  bindEndOverlay();

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
    showPeek(1100);
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();