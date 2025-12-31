// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (VR-UI STANDARD + START-GATED + END SUMMARY + VR COMPACT + LOWTIME)
// ✅ /vr/vr-ui.js provides ENTER VR/EXIT/RECENTER + emits hha:shoot
// ✅ VR compact HUD updates from events
// ✅ low-time toast + gentle tick pulse (no dizziness)
// ✅ End overlay on hha:end + flush-hardened Back HUB

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

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

function px(n){ return (Number(n)||0) + 'px'; }

/* ===== Dynamic reserves (HUD/fever/controls/compact) ===== */
function syncReserves(){
  try{
    const hud = DOC.querySelector('.hha-hud');
    const compact = DOC.getElementById('vrCompactHud');
    const fever = DOC.getElementById('hhaFever');
    const ctrl = DOC.querySelector('.hha-controls');

    const hudHidden = DOC.body.classList.contains('hud-hidden');
    const isVR = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');

    let hudH = 0;

    if (!isVR && hud){
      const r = hud.getBoundingClientRect();
      const cs = getComputedStyle(hud);
      const padTop = parseFloat(cs.paddingTop)||0;
      const sat = Math.max(0, padTop - 10);
      hudH = hudHidden ? 24 : Math.max(80, Math.round(r.height - sat));
    } else if (isVR && compact){
      const r = compact.getBoundingClientRect();
      hudH = Math.max(54, Math.round(r.height)); // reserve for compact hud
    }

    DOC.documentElement.style.setProperty('--hudH', px(hudH || 0));

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
function showPeek(ms=1400){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.add('show');
  setTimeout(()=>{ try{ peek.classList.remove('show'); }catch(_){ } }, ms);
}

/* ===== HUD toggle ===== */
function toggleHud(force){
  const b = DOC.body;
  const next = (typeof force === 'boolean') ? force : !b.classList.contains('hud-hidden');
  b.classList.toggle('hud-hidden', next);

  const btn = DOC.getElementById('btnToggleHud');
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';

  if (next) showPeek(1200);
  syncReserves();
}

/* ===== Low-time toast + gentle tick ===== */
let _ltHideT = 0;
function showLowTime(sec){
  const toast = DOC.getElementById('lowTimeToast');
  const t = DOC.getElementById('lowTimeSec');
  if (!toast || !t) return;
  t.textContent = String(sec|0);
  toast.hidden = false;

  try{ DOC.body.classList.add('gj-tick'); }catch(_){}
  setTimeout(()=>{ try{ DOC.body.classList.remove('gj-tick'); }catch(_){ } }, 160);

  clearTimeout(_ltHideT);
  _ltHideT = setTimeout(()=>{ try{ toast.hidden = true; }catch(_){ } }, 680);
}
function hideLowTime(){
  const toast = DOC.getElementById('lowTimeToast');
  if (toast) toast.hidden = true;
}

/* ===== VR compact binder ===== */
function bindCompact(){
  const sEl = DOC.getElementById('vcScore');
  const tEl = DOC.getElementById('vcTime');
  const gEl = DOC.getElementById('vcGrade');

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    if (sEl) sEl.textContent = String(d.score ?? 0);
  });
  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    if (tEl) tEl.textContent = String(d.left ?? 0);
  });
  ROOT.addEventListener('hha:rank', (ev)=>{
    const d = ev?.detail || {};
    if (gEl) gEl.textContent = String(d.grade ?? '—');
  });

  // Missions button on compact
  const btn = DOC.getElementById('btnVCPeek');
  btn && btn.addEventListener('click', ()=> showPeek(1500));
}

/* ===== View buttons ===== */
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
  btnPeek && btnPeek.addEventListener('click', ()=> showPeek(1600));
  btnHUD && btnHUD.addEventListener('click', ()=> toggleHud());

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });

  // Enter VR (helper): fullscreen + switch to cVR + hint
  // NOTE: /vr/vr-ui.js also provides ENTER VR/EXIT/RECENTER; this button is just a shortcut.
  btnVR && btnVR.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
    setBodyView('cvr');
    showVrHint();
    setTimeout(()=> toggleHud(true), 900);
  });
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

/* ===== End Summary Overlay ===== */
function readJson(key, fallback){
  try{ const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback; }catch(_){ return fallback; }
}
function saveJson(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(_){}
}
function copyText(txt){
  try{
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt);
  }catch(_){}
  try{
    const ta = DOC.createElement('textarea');
    ta.value = txt; ta.style.position='fixed'; ta.style.left='-9999px';
    DOC.body.appendChild(ta); ta.select(); DOC.execCommand('copy'); ta.remove();
  }catch(_){}
  return Promise.resolve();
}

function showEnd(summary){
  const ol = DOC.getElementById('endOverlay');
  if (!ol) return;
  ol.hidden = false;

  const reason = DOC.getElementById('endReason');
  const grade  = DOC.getElementById('endGrade');
  const score  = DOC.getElementById('endScore');
  const acc    = DOC.getElementById('endAcc');
  const cm     = DOC.getElementById('endComboMax');
  const miss   = DOC.getElementById('endMiss');
  const goals  = DOC.getElementById('endGoals');
  const minis  = DOC.getElementById('endMinis');
  const meta2  = DOC.getElementById('endMeta2');

  const s = summary || {};
  if (reason) reason.textContent = `เหตุผล: ${s.reason || 'end'} • time=${s.durationPlayedSec ?? '—'}s • diff=${s.diff || qs('diff','')}`;
  if (grade)  grade.textContent  = s.grade || '—';
  if (score)  score.textContent  = String(s.scoreFinal ?? 0);
  if (acc)    acc.textContent    = `${s.accuracyGoodPct ?? 0}%`;
  if (cm)     cm.textContent     = String(s.comboMax ?? 0);
  if (miss)   miss.textContent   = String(s.misses ?? 0);
  if (goals)  goals.textContent  = `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`;
  if (minis)  minis.textContent  = `${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`;

  if (meta2){
    meta2.textContent = `seed=${s.seed || ''} • run=${s.runMode || qs('run','play')} • end=${qs('end','time')} • challenge=${qs('challenge','rush')}`;
  }

  // save history
  try{
    const hist = readJson(LS_HIST, []);
    hist.unshift({ ...s, timestampIso: new Date().toISOString() });
    hist.splice(50);
    saveJson(LS_HIST, hist);
    saveJson(LS_LAST, s);
  }catch(_){}
}

function hideEnd(){
  const ol = DOC.getElementById('endOverlay');
  if (ol) ol.hidden = true;
}

function hookEndButtons(){
  const btnAgain = DOC.getElementById('btnPlayAgain');
  const btnHub   = DOC.getElementById('btnBackHub');
  const btnCopy  = DOC.getElementById('btnCopySummary');

  const hub = qs('hub', './hub.html');

  btnAgain && btnAgain.addEventListener('click', ()=>{
    const u = new URL(location.href);
    u.searchParams.set('ts', String(Date.now()));
    location.href = u.toString();
  });

  btnHub && btnHub.addEventListener('click', async ()=>{
    // flush-hardened before leaving
    try{
      if (ROOT.GoodJunkVR && typeof ROOT.GoodJunkVR.flushHard === 'function'){
        await ROOT.GoodJunkVR.flushHard('back_hub');
      }
    }catch(_){}
    location.href = hub;
  });

  btnCopy && btnCopy.addEventListener('click', async ()=>{
    const s = readJson(LS_LAST, null);
    await copyText(JSON.stringify(s || {}, null, 2));
    btnCopy.textContent = 'Copied ✅';
    setTimeout(()=> btnCopy.textContent = 'Copy JSON', 900);
  });
}

function hookEndEvent(){
  ROOT.addEventListener('hha:end', (ev)=>{
    const summary = ev?.detail || readJson(LS_LAST, null);
    hideLowTime();
    showEnd(summary);
    toggleHud(true);
    syncReserves();
  });
}

/* lowtime from safe.js */
function hookLowTimeEvent(){
  ROOT.addEventListener('hha:lowtime', (ev)=>{
    const d = ev?.detail || {};
    const sec = Number(d.leftSec ?? d.left ?? 0) || 0;
    if (sec <= 0) { hideLowTime(); return; }
    showLowTime(sec);
  });
}

function syncMeta(state='ready'){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  hudMeta.textContent = `[BOOT] ${state} • dual=${dual} • view=${pickInitialView()}`;
}

function main(){
  bindCompact();
  hookViewButtons();
  hookEndButtons();
  hookEndEvent();
  hookLowTimeEvent();

  setBodyView(pickInitialView());
  syncMeta('ready');
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
    hideEnd();
    hideLowTime();
    syncMeta('running');
    syncReserves();
    bootEngine();
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();