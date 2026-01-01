// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (START-GATED + END SUMMARY + VR COMPACT + TOAST)
// ✅ View modes: PC / Mobile / VR / cVR
// ✅ Fullscreen handling + body.is-fs
// ✅ HUD toggle + Missions Peek
// ✅ VR compact HUD: Score/Time/Grade (for VR/cVR only)
// ✅ VR toast (warnings / celebrate) — clear, not dizzy
// ✅ Starts engine ONLY after pressing "เริ่มเล่น"
// ✅ End overlay on hha:end + save history (HHA_SUMMARY_HISTORY)

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

let _peekTimer = 0;
let _toastTimer = 0;

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
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${view}`);
  try{ localStorage.setItem('GJ_VIEW', view); }catch(_){}
  // VR/cVR: show peek briefly (comfort)
  if (view === 'vr' || view === 'cvr') showPeek(1200);
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

/* ===== Peek & Toast ===== */
function showPeek(ms=1200){
  const peek = DOC.getElementById('gjPeek');
  if (!peek) return;
  peek.classList.add('show');
  clearTimeout(_peekTimer);
  _peekTimer = setTimeout(()=>{ try{ peek.classList.remove('show'); }catch(_){ } }, ms);
}

function showToast(text, ms=900){
  const box = DOC.getElementById('vrToast');
  const t   = DOC.getElementById('vrToastText');
  if (!box || !t) return;

  // don't show if overlays open
  const start = DOC.getElementById('startOverlay');
  const hint  = DOC.getElementById('vrHint');
  const end   = DOC.getElementById('endOverlay');
  if ((start && !start.hidden) || (hint && !hint.hidden) || (end && !end.hidden)) return;

  // only show in VR/cVR
  const v = DOC.body.classList.contains('view-vr') || DOC.body.classList.contains('view-cvr');
  if (!v) return;

  t.textContent = String(text || '');
  box.hidden = false;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(()=>{ try{ box.hidden = true; }catch(_){ } }, ms);
}

/* ===== HUD toggle ===== */
function toggleHud(force){
  const b = DOC.body;
  const next = (typeof force === 'boolean') ? force : !b.classList.contains('hud-hidden');
  b.classList.toggle('hud-hidden', next);

  const btn = DOC.getElementById('btnToggleHUD');
  if (btn) btn.textContent = next ? 'HUD (Off)' : 'HUD';

  if (next) showPeek(1300);
}

/* ===== Start overlay gate ===== */
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

/* ===== End summary overlay (HHA Standard) ===== */
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

  btnHub && btnHub.addEventListener('click', ()=>{
    try{
      if (ROOT.GoodJunkVR && typeof ROOT.GoodJunkVR.endGame === 'function'){
        ROOT.GoodJunkVR.endGame('back_hub');
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
    showEnd(summary);
    toggleHud(true); // keep clean
  });
}

/* ===== VR compact HUD binder ===== */
function hookVrCompact(){
  const s = DOC.getElementById('vrScore');
  const t = DOC.getElementById('vrTime');
  const g = DOC.getElementById('vrGrade');
  if (!s || !t || !g) return;

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    s.textContent = String(d.score ?? 0);
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    t.textContent = String(d.left ?? 0);
  });

  ROOT.addEventListener('hha:rank', (ev)=>{
    const d = ev?.detail || {};
    g.textContent = String(d.grade ?? '—');
  });
}

/* ===== Toast hooks ===== */
function hookToasts(){
  ROOT.addEventListener('hha:celebrate', (ev)=>{
    const d = ev?.detail || {};
    const title = d.title || '';
    if (title) showToast(title, 950);
  });

  ROOT.addEventListener('hha:judge', (ev)=>{
    const d = ev?.detail || {};
    const kind = String(d.kind || 'info');
    const txt  = String(d.text || '');
    if (!txt) return;

    if (kind === 'warn') showToast(`⚠️ ${txt}`, 880);
    else if (kind === 'bad') showToast(`💥 ${txt}`, 880);
  });

  ROOT.addEventListener('hha:toast', (ev)=>{
    const d = ev?.detail || {};
    const txt = String(d.text || '');
    const ms  = Number(d.ms || 900);
    if (txt) showToast(txt, ms);
  });
}

/* ===== View buttons ===== */
function hookViewButtons(){
  const btnPC  = DOC.getElementById('btnViewPC');
  const btnM   = DOC.getElementById('btnViewMobile');
  const btnV   = DOC.getElementById('btnViewVR');
  const btnC   = DOC.getElementById('btnViewCVR');
  const btnFS  = DOC.getElementById('btnEnterFS');
  const btnHUD = DOC.getElementById('btnToggleHUD');
  const btnPeek= DOC.getElementById('btnPeek');

  const vrHint = DOC.getElementById('vrHint');
  const vrOk   = DOC.getElementById('btnVrOk');

  function showVrHint(){ if (vrHint) vrHint.hidden = false; }
  function hideVrHint(){ if (vrHint) vrHint.hidden = true; }

  btnPC && btnPC.addEventListener('click', ()=>{ setBodyView('pc'); hideVrHint(); toggleHud(false); });
  btnM  && btnM.addEventListener('click',  ()=>{ setBodyView('mobile'); hideVrHint(); toggleHud(false); });
  btnV  && btnV.addEventListener('click',  ()=>{ setBodyView('vr'); showVrHint(); showPeek(1200); });
  btnC  && btnC.addEventListener('click',  ()=>{ setBodyView('cvr'); showVrHint(); toggleHud(true); showPeek(1400); });

  vrOk && vrOk.addEventListener('click', ()=> hideVrHint());

  btnHUD && btnHUD.addEventListener('click', ()=> toggleHud());

  btnPeek && btnPeek.addEventListener('click', ()=> showPeek(1400));

  btnFS && btnFS.addEventListener('click', async ()=>{
    await enterFs();
    syncFsClass();
  });
}

/* ===== Engine gate ===== */
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

function syncMeta(state='ready'){
  const hudMeta = DOC.getElementById('hudMeta');
  if (!hudMeta) return;
  const dual = !!DOC.getElementById('gj-layer-r');
  const v = qs('v','');
  hudMeta.textContent = `[BOOT] ${state} • dual=${dual} • view=${pickInitialView()} • v=${v}`;
}

function main(){
  hookViewButtons();
  hookEndButtons();
  hookEndEvent();
  hookVrCompact();
  hookToasts();

  setBodyView(pickInitialView());
  syncMeta('ready');
  syncFsClass();

  ROOT.addEventListener('resize', ()=>{}, { passive:true });
  ROOT.addEventListener('orientationchange', ()=>{}, { passive:true });

  DOC.addEventListener('fullscreenchange', syncFsClass);
  DOC.addEventListener('webkitfullscreenchange', syncFsClass);

  // START-GATE
  showStartOverlay();
  hideEnd();

  const btnStart = DOC.getElementById('btnStart');
  btnStart && btnStart.addEventListener('click', ()=>{
    hideStartOverlay();
    hideEnd();
    syncMeta('running');
    bootEngine();
  }, { once:true });
}

if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', main);
else main();