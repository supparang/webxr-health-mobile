// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (HHA Standard)
// ✅ Auto view detect (no UI override; respects ?view=)
// ✅ Loads engine from ./plate.safe.js
// ✅ Wires HUD listeners (hha:score, hha:time, quest:update, hha:coach, hha:end)
// ✅ End overlay uses aria-hidden only
// ✅ Back HUB + Restart
// ✅ Pass-through research context params: run/diff/time/seed/studyId/... etc.
// ✅ Exposes window.HHA_CTX for logger/debug

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

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  // Respect forced view (used in experiments); do not offer menu.
  const forced = (qs('view','') || '').toLowerCase();
  if(forced) return forced;

  // If already in XR session, treat as vr (rare at load but safe)
  const xr = (navigator.xr ? true : false);
  if(xr && /Quest|Oculus|Vive|Valve|XR/i.test(navigator.userAgent || '')) return 'vr';

  return isMobile() ? 'mobile' : 'pc';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'vr') b.classList.add('view-vr');
  else if(view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}

function pctRound(n){
  n = Number(n);
  if(!Number.isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

function setEndOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
  // Optional helper class (CSS can use it)
  ov.classList.toggle('open', !!open);
}

function showCoach(msg, tag='Coach'){
  const card = DOC.getElementById('coachCard');
  const mEl  = DOC.getElementById('coachMsg');
  const tEl  = DOC.getElementById('coachMeta');
  if(!card || !mEl) return;

  mEl.textContent = String(msg || '');
  if(tEl) tEl.textContent = String(tag || 'Coach');

  card.classList.add('show');
  card.setAttribute('aria-hidden','false');

  clearTimeout(WIN.__HHA_COACH_TO__);
  WIN.__HHA_COACH_TO__ = setTimeout(()=>{
    card.classList.remove('show');
    card.setAttribute('aria-hidden','true');
  }, 2200);
}

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

  // SCORE
  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    const s = (d.score ?? d.value ?? 0);
    const c = (d.combo ?? d.comboNow ?? 0);
    if(hudScore) hudScore.textContent = String(s);
    if(hudCombo) hudCombo.textContent = String(c);
  });

  // TIME
  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    const v = Math.max(0, Math.ceil(Number(t) || 0));
    if(hudTime) hudTime.textContent = String(v);
  });

  // QUEST
  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};

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

  // COACH
  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  });
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');

  const hub = (qs('hub','') || '').trim();

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>{
      // keep same query params
      location.reload();
    }, { passive:true });
  }

  if(btnBackHub){
    btnBackHub.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else history.back();
    }, { passive:true });
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

    // accuracy: expect already percent number (0..100)
    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if(kAcc) kAcc.textContent = (acc == null) ? '—' : pctRound(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    setEndOverlayOpen(true);
  });
}

function buildEngineConfig(){
  const view = getViewAuto();

  const run  = (qs('run','play') || 'play').toLowerCase();
  const diff = (qs('diff','normal') || 'normal').toLowerCase();
  const time = clamp(qs('time','90'), 10, 999);
  const seed = Number(qs('seed', Date.now())) || Date.now();

  const cfg = {
    // core
    view,
    runMode: run,                // play | study | research
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    // passthrough endpoints / hub
    hub: (qs('hub','') || '').trim(),
    logEndpoint: (qs('log','') || '').trim(),

    // research context passthrough (optional)
    studyId: (qs('studyId','') || '').trim(),
    phase: (qs('phase','') || '').trim(),
    conditionGroup: (qs('conditionGroup','') || '').trim(),
    sessionOrder: (qs('sessionOrder','') || '').trim(),
    blockLabel: (qs('blockLabel','') || '').trim(),
    siteCode: (qs('siteCode','') || '').trim(),
    schoolCode: (qs('schoolCode','') || '').trim(),
    schoolName: (qs('schoolName','') || '').trim(),
    gradeLevel: (qs('gradeLevel','') || '').trim(),
    studentKey: (qs('studentKey','') || '').trim(),
  };

  return cfg;
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(()=>{
  const cfg = buildEngineConfig();

  // set view class
  setBodyView(cfg.view);

  // expose ctx for logger/debug
  WIN.HHA_CTX = Object.assign({}, cfg, {
    game: 'plate',
    ts: Date.now(),
    href: location.href
  });

  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // ensure overlay closed initially
  setEndOverlayOpen(false);

  // boot engine
  const mount = DOC.getElementById('plate-layer');
  try{
    engineBoot({ mount, cfg });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
  }
});