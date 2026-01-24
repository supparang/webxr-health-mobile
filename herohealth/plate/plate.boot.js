// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (PATCH)
// ✅ Auto view detect (no UI override)
// ✅ Switch body view to VR automatically on enter-vr / exit-vr (A-Frame)
// ✅ Loads engine from ./plate.safe.js
// ✅ Wires HUD listeners (hha:score, hha:time, quest:update, hha:coach, hha:end)
// ✅ End overlay: aria-hidden only
// ✅ Back HUB + Restart
// ✅ HHA Standard: save last summary + history
// ✅ Pass-through research context params: run/diff/time/seed/studyId/... etc.

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const LS_LAST = 'HHA_LAST_SUMMARY';
const LS_HIST = 'HHA_SUMMARY_HISTORY';

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  // ✅ no menu override
  // allow explicit ?view= for experiments: pc|mobile|vr|cvr
  const forced = String(qs('view','')||'').toLowerCase();
  if(forced) return forced;
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

function setOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function pct(n){
  n = Number(n)||0;
  return `${Math.round(n)}%`;
}

/* -------------------------------
 * Coach bubble (boot-level)
 * ----------------------------- */
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

/* -------------------------------
 * HHA Standard: save summary
 * ----------------------------- */
function saveSummary(summary){
  try{
    localStorage.setItem(LS_LAST, JSON.stringify(summary));

    const prev = JSON.parse(localStorage.getItem(LS_HIST) || '[]');
    const next = Array.isArray(prev) ? prev : [];
    next.unshift(summary);
    // keep last 30
    localStorage.setItem(LS_HIST, JSON.stringify(next.slice(0,30)));
  }catch{}
}

/* -------------------------------
 * HUD wiring
 * ----------------------------- */
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
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  });
}

/* -------------------------------
 * End overlay + controls
 * ----------------------------- */
function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = qs('hub','') || '';

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>{
      location.reload(); // keep same params
    });
  }
  if(btnBackHub){
    btnBackHub.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else history.back();
    });
  }
}

function wireEndSummary(cfg){
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

    // accuracy: prefer accuracyGoodPct
    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if(kAcc) kAcc.textContent = (acc==null) ? '—' : pct(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // ✅ HHA Standard save last summary
    const summary = {
      game: 'plate',
      ts: Date.now(),
      cfg: {
        view: cfg.view,
        runMode: cfg.runMode,
        diff: cfg.diff,
        time: cfg.durationPlannedSec,
        seed: cfg.seed,
        hub: cfg.hub || ''
      },
      metrics: {
        score: d.scoreFinal ?? 0,
        accGoodPct: d.accuracyGoodPct ?? null,
        comboMax: d.comboMax ?? 0,
        miss: d.misses ?? 0,
        goals: `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`,
        mini: `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`,
        g1: d.g1 ?? 0, g2: d.g2 ?? 0, g3: d.g3 ?? 0, g4: d.g4 ?? 0, g5: d.g5 ?? 0
      },
      context: {
        studyId: cfg.studyId || '',
        phase: cfg.phase || '',
        conditionGroup: cfg.conditionGroup || '',
        sessionOrder: cfg.sessionOrder || '',
        blockLabel: cfg.blockLabel || '',
        siteCode: cfg.siteCode || '',
        schoolCode: cfg.schoolCode || '',
        schoolName: cfg.schoolName || '',
        gradeLevel: cfg.gradeLevel || '',
        studentKey: cfg.studentKey || ''
      }
    };
    saveSummary(summary);

    setOverlayOpen(true);
  });
}

/* -------------------------------
 * A-Frame enter-vr / exit-vr => switch view class
 * ----------------------------- */
function wireAFrameViewSwitch(baseView){
  // baseView: pc|mobile|cvr|vr
  const scene = DOC.querySelector('a-scene');
  if(!scene) return;

  // If forced cvr, keep it (strict center shoot)
  const forced = String(qs('view','')||'').toLowerCase();
  const forcedIsCvr = forced === 'cvr';

  scene.addEventListener('enter-vr', ()=>{
    if(forcedIsCvr) setBodyView('cvr');
    else setBodyView('vr');
  });

  scene.addEventListener('exit-vr', ()=>{
    // return to baseline (pc/mobile) unless forced
    if(forced) setBodyView(forced);
    else setBodyView(baseView);
  });
}

/* -------------------------------
 * Engine config (passthrough)
 * ----------------------------- */
function buildEngineConfig(){
  const view = getViewAuto();
  const run  = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();
  const time = clamp(qs('time','90'), 10, 999);
  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    hub: qs('hub','') || '',
    logEndpoint: qs('log','') || '',

    studyId: qs('studyId','') || '',
    phase: qs('phase','') || '',
    conditionGroup: qs('conditionGroup','') || '',
    sessionOrder: qs('sessionOrder','') || '',
    blockLabel: qs('blockLabel','') || '',
    siteCode: qs('siteCode','') || '',
    schoolCode: qs('schoolCode','') || '',
    schoolName: qs('schoolName','') || '',
    gradeLevel: qs('gradeLevel','') || '',
    studentKey: qs('studentKey','') || '',
  };
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

/* -------------------------------
 * Boot
 * ----------------------------- */
ready(()=>{
  const cfg = buildEngineConfig();

  // set view class
  setBodyView(cfg.view);

  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary(cfg);

  // ensure end overlay closed at start
  setOverlayOpen(false);

  // VR enter/exit switches view-vr automatically
  wireAFrameViewSwitch(cfg.view);

  // mount check (this is the #1 cause of "targets not showing")
  const mount = DOC.getElementById('plate-layer');
  if(!mount){
    console.error('[PlateVR] mount #plate-layer missing');
    showCoach('หาเลเยอร์เล่นเกมไม่เจอ (#plate-layer)', 'System');
    return;
  }

  // boot engine
  try{
    engineBoot({ mount, cfg });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู Console)', 'System');
  }
});