// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION FINAL
// ✅ Auto view detect (no menu)
// ✅ Default time = 90s (kids-friendly baseline)
// ✅ Loads engine from ./plate.safe.js
// ✅ Wires HUD listeners:
//    - hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ (Optional) hha:timeAdd to extend time ONLY when explicitly requested
// ✅ End overlay aria-hidden only (no display:none dependencies)
// ✅ Back HUB + Restart
// ✅ Pass-through research context params

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function pct(n){
  n = Number(n) || 0;
  return `${Math.round(n)}%`;
}

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && (WIN.innerWidth || 0) < 920);
}

function getViewAuto(){
  // Allow forcing by query for experiments, but no UI chooser.
  const forced = String(qs('view','') || '').toLowerCase();
  if (forced) return forced;

  // If A-Frame/WebXR is in VR presenting state later, vr-ui will handle UI,
  // but view class here is for layout.
  return isMobile() ? 'mobile' : 'pc';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');

  if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}

function setOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function showCoach(msg, meta='Coach'){
  const card = DOC.getElementById('coachCard');
  const mEl = DOC.getElementById('coachMsg');
  const metaEl = DOC.getElementById('coachMeta');
  if(!card || !mEl) return;

  mEl.textContent = String(msg || '');
  if(metaEl) metaEl.textContent = String(meta || 'Coach');

  card.classList.add('show');
  card.setAttribute('aria-hidden','false');

  clearTimeout(WIN.__HHA_COACH_TO__);
  WIN.__HHA_COACH_TO__ = setTimeout(()=>{
    card.classList.remove('show');
    card.setAttribute('aria-hidden','true');
  }, 2200);
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

/* ---------------------------------------------------------
   HUD wiring
--------------------------------------------------------- */
function wireHUD(){
  const hudScore = DOC.getElementById('hudScore');
  const hudTime  = DOC.getElementById('hudTime');
  const hudCombo = DOC.getElementById('hudCombo');

  const goalName = DOC.getElementById('goalName');
  const goalSub  = DOC.getElementById('goalSub');
  const goalNums = DOC.getElementById('goalNums');
  const goalBar  = DOC.getElementById('goalBar');

  const miniName = DOC.getElementById('miniName');
  const miniSub  = DOC.getElementById('miniSub');
  const miniNums = DOC.getElementById('miniNums');
  const miniBar  = DOC.getElementById('miniBar');

  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if(hudScore) hudScore.textContent = String(d.score ?? d.value ?? 0);
    if(hudCombo) hudCombo.textContent = String(d.combo ?? d.comboNow ?? 0);
  });

  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    if(hudTime) hudTime.textContent = String(Math.max(0, Math.ceil(Number(t)||0)));
  });

  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    // expected shape: { goal:{name,sub,cur,target}, mini:{name,sub,cur,target,done}, allDone }
    if(d.goal){
      const g = d.goal;
      if(goalName) goalName.textContent = g.name || 'Goal';
      if(goalSub)  goalSub.textContent  = g.sub  || '';
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      if(goalNums) goalNums.textContent = `${cur}/${tar}`;
      if(goalBar)  goalBar.style.width  = `${Math.round((cur/tar)*100)}%`;
    }
    if(d.mini){
      const m = d.mini;
      if(miniName) miniName.textContent = m.name || 'Mini Quest';
      if(miniSub)  miniSub.textContent  = m.sub  || '';
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      if(miniNums) miniNums.textContent = `${cur}/${tar}`;
      if(miniBar)  miniBar.style.width  = `${Math.round((cur/tar)*100)}%`;
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)){
      showCoach(d.msg || d.text, d.tag || 'Coach');
    }
  });

  // ✅ OPTIONAL time extension: only when engine explicitly asks
  // detail: { addSec:number, reason?:string }
  WIN.addEventListener('hha:timeAdd', (e)=>{
    const d = e.detail || {};
    const add = Number(d.addSec || 0);
    if(add > 0){
      // Boot does not own timer; this is just UX feedback.
      // Engine should also add time internally when emitting this.
      showCoach(`+${Math.round(add)} วิ ⏱️`, d.reason || 'โบนัสเวลา');
    }
  });
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = String(qs('hub','') || '');

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>{
      // keep same params
      location.reload();
    });
  }

  if(btnBackHub){
    btnBackHub.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else history.back();
    });
  }
}

function wireEndSummary(){
  const kScore = DOC.getElementById('kScore');
  const kAcc   = DOC.getElementById('kAcc');
  const kCombo = DOC.getElementById('kCombo');
  const kGoals = DOC.getElementById('kGoals');
  const kMini  = DOC.getElementById('kMini');
  const kMiss  = DOC.getElementById('kMiss');

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};
    if(kScore) kScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(kCombo) kCombo.textContent = String(d.comboMax ?? d.combo ?? 0);
    if(kMiss)  kMiss.textContent  = String(d.misses ?? d.miss ?? 0);

    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if(kAcc) kAcc.textContent = (acc == null) ? '—' : pct(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    setOverlayOpen(true);
  });
}

/* ---------------------------------------------------------
   Build engine config
--------------------------------------------------------- */
function buildEngineConfig(){
  const view = getViewAuto();

  const run  = String(qs('run','play') || 'play').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();

  // ✅ default kids-friendly time = 90
  // (you can still override by ?time=70 etc.)
  const time = clamp(qs('time','90'), 10, 999);

  const seedQ = qs('seed','');
  const seed = Number(seedQ || Date.now()) || Date.now();

  return {
    view,
    runMode: run,
    diff,

    durationPlannedSec: Number(time),
    seed: Number(seed),

    // endpoints / tags
    hub: String(qs('hub','') || ''),
    logEndpoint: String(qs('log','') || ''),

    // passthrough context (cloud logger)
    studyId: String(qs('studyId','') || ''),
    phase: String(qs('phase','') || ''),
    conditionGroup: String(qs('conditionGroup','') || ''),
    sessionOrder: String(qs('sessionOrder','') || ''),
    blockLabel: String(qs('blockLabel','') || ''),
    siteCode: String(qs('siteCode','') || ''),
    schoolCode: String(qs('schoolCode','') || ''),
    schoolName: String(qs('schoolName','') || ''),
    gradeLevel: String(qs('gradeLevel','') || ''),
    studentKey: String(qs('studentKey','') || ''),
  };
}

/* ---------------------------------------------------------
   Boot
--------------------------------------------------------- */
ready(()=>{
  const cfg = buildEngineConfig();

  // set view class
  setBodyView(cfg.view);

  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // ensure end overlay closed at start
  setOverlayOpen(false);

  // boot engine
  try{
    engineBoot({
      mount: DOC.getElementById('plate-layer'),
      cfg
    });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
  }
});