// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (HHA Standard)
// ✅ Auto view detect (no menu; does NOT override explicit ?view=)
// ✅ Default time = 90s (if missing)
// ✅ Quest bars clamp 0..100 (กันหลุดเกิน 100%)
// ✅ End overlay aria-hidden only
// ✅ Back HUB: preserve hub param + store last summary (HHA_LAST_SUMMARY)
// ✅ Pass-through research context params: run/diff/time/seed/studyId/... etc.

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints|0) > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && (WIN.innerWidth||0) < 920);
}

function getViewAuto(){
  // DO NOT override explicit ?view=
  const forced = String(qs('view','')||'').toLowerCase();
  if(forced) return forced;

  // heuristic
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

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function clampPct(n){
  n = Number(n)||0;
  return `${Math.round(clamp(n, 0, 100))}%`;
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

    // Expect shape: { goal:{name,sub,cur,target}, mini:{name,sub,cur,target,done}, allDone }
    if(d.goal){
      const g = d.goal;
      if(goalName) goalName.textContent = g.name || 'Goal';
      if(goalSub)  goalSub.textContent  = g.sub  || '';

      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      if(goalNums) goalNums.textContent = `${cur}/${tar}`;

      const p = (tar > 0) ? (cur / tar) * 100 : 0;
      if(goalBar) goalBar.style.width = clampPct(p);
    }

    if(d.mini){
      const m = d.mini;
      if(miniName) miniName.textContent = m.name || 'Mini Quest';
      if(miniSub)  miniSub.textContent  = m.sub  || '';

      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      if(miniNums) miniNums.textContent = `${cur}/${tar}`;

      const p = (tar > 0) ? (cur / tar) * 100 : 0;
      if(miniBar) miniBar.style.width = clampPct(p);
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  });
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = String(qs('hub','') || '');

  if(btnRestart){
    btnRestart.addEventListener('click', ()=> location.reload());
  }

  if(btnBackHub){
    btnBackHub.addEventListener('click', ()=>{
      if(hub){
        // if hub already has query, append with &
        location.href = hub;
      }else{
        history.back();
      }
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

    const summary = {
      ts: new Date().toISOString(),
      game: 'plate',
      reason: d.reason || '',
      scoreFinal: d.scoreFinal ?? d.score ?? 0,
      comboMax: d.comboMax ?? 0,
      misses: d.misses ?? d.miss ?? 0,
      accuracyGoodPct: d.accuracyGoodPct ?? null,
      goalsCleared: d.goalsCleared ?? 0,
      goalsTotal: d.goalsTotal ?? 0,
      miniCleared: d.miniCleared ?? 0,
      miniTotal: d.miniTotal ?? 0,
      g1: d.g1 ?? 0, g2: d.g2 ?? 0, g3: d.g3 ?? 0, g4: d.g4 ?? 0, g5: d.g5 ?? 0
    };

    if(kScore) kScore.textContent = String(summary.scoreFinal);
    if(kCombo) kCombo.textContent = String(summary.comboMax);
    if(kMiss)  kMiss.textContent  = String(summary.misses);

    if(kAcc) kAcc.textContent = (summary.accuracyGoodPct==null) ? '—' : `${Math.round(Number(summary.accuracyGoodPct)||0)}%`;
    if(kGoals) kGoals.textContent = `${summary.goalsCleared}/${summary.goalsTotal}`;
    if(kMini)  kMini.textContent  = `${summary.miniCleared}/${summary.miniTotal}`;

    // ✅ HHA Standard: store last summary
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
    }catch(_){}

    setOverlayOpen(true);
  });
}

function buildEngineConfig(){
  const view = getViewAuto();
  const run  = String(qs('run','play')||'play').toLowerCase();
  const diff = String(qs('diff','normal')||'normal').toLowerCase();

  // ✅ DEFAULT TIME = 90
  const time = clamp(qs('time','90'), 20, 999);

  const seed = Number(qs('seed', Date.now())) || Date.now();

  // research passthrough (optional)
  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    // endpoints / tags
    hub: String(qs('hub','') || ''),
    logEndpoint: String(qs('log','') || ''),

    // context passthrough (optional fields used by cloud logger)
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

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

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