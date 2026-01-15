// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION+ (HHA Standard)
// ✅ Auto view detect (no UI override menu)
// ✅ Supports query ?view=pc|mobile|vr|cvr (for research/links only)
// ✅ Boots engine from ./plate.safe.js
// ✅ Wires HUD listeners:
//    hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ Works with BOTH UI layouts:
//    - Layout A: #hudScore/#hudTime/#hudCombo + #endOverlay
//    - Layout B: uiScore/uiTime/uiCombo + startOverlay/resultBackdrop
// ✅ Back HUB + Restart + Play Again
// ✅ Pass-through research context params: run/diff/time/seed/studyId/phase/conditionGroup...

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && WIN.innerWidth < 920);
}

function getViewAuto(){
  const forced = (qs('view','')||'').toLowerCase();
  if (forced) return forced; // allowed by query only (no menu)
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

function pct(n){
  n = Number(n) || 0;
  return `${Math.round(n)}%`;
}

/* ---------------------------
   Overlay helpers (support both layouts)
--------------------------- */
function setOverlayOpen(open){
  // Layout A: #endOverlay (aria-hidden)
  const ov = DOC.getElementById('endOverlay');
  if(ov){
    ov.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  // Layout B: #resultBackdrop (display grid/block)
  const rb = DOC.getElementById('resultBackdrop');
  if(rb){
    rb.style.display = open ? 'grid' : 'none';
  }
}

function setStartOverlayOpen(open){
  const so = DOC.getElementById('startOverlay');
  if(so){
    so.style.display = open ? 'grid' : 'none';
  }
}

/* ---------------------------
   Coach bubble (layout A) + fallback to layout B (coachPanel)
--------------------------- */
function showCoach(msg, meta='Coach'){
  msg = String(msg || '').trim();
  if(!msg) return;

  // Layout A: #coachCard
  const card = DOC.getElementById('coachCard');
  const mEl = DOC.getElementById('coachMsg');
  const metaEl = DOC.getElementById('coachMeta');

  if(card && mEl){
    mEl.textContent = msg;
    if(metaEl) metaEl.textContent = meta;
    card.classList.add('show');
    card.setAttribute('aria-hidden','false');

    clearTimeout(WIN.__HHA_COACH_TO__);
    WIN.__HHA_COACH_TO__ = setTimeout(()=>{
      card.classList.remove('show');
      card.setAttribute('aria-hidden','true');
    }, 2200);
    return;
  }

  // Layout B: #coachMsg exists already (same id in your big HUD version)
  const bMsg = DOC.getElementById('coachMsg');
  if(bMsg){
    bMsg.textContent = msg;
  }
}

/* ---------------------------
   HUD wiring (A + B)
--------------------------- */
function wireHUD(){
  // Layout A ids
  const hudScoreA = DOC.getElementById('hudScore');
  const hudTimeA  = DOC.getElementById('hudTime');
  const hudComboA = DOC.getElementById('hudCombo');

  const goalNameA = DOC.getElementById('goalName');
  const goalSubA  = DOC.getElementById('goalSub');
  const goalNumsA = DOC.getElementById('goalNums');
  const goalBarA  = DOC.getElementById('goalBar');

  const miniNameA = DOC.getElementById('miniName');
  const miniSubA  = DOC.getElementById('miniSub');
  const miniNumsA = DOC.getElementById('miniNums');
  const miniBarA  = DOC.getElementById('miniBar');

  // Layout B ids
  const uiScoreB = DOC.getElementById('uiScore');
  const uiTimeB  = DOC.getElementById('uiTime');
  const uiComboB = DOC.getElementById('uiCombo');
  const uiComboMaxB = DOC.getElementById('uiComboMax');
  const uiMissB  = DOC.getElementById('uiMiss');

  const uiGoalTitleB = DOC.getElementById('uiGoalTitle');
  const uiGoalCountB = DOC.getElementById('uiGoalCount');
  const uiGoalFillB  = DOC.getElementById('uiGoalFill');

  const uiMiniTitleB = DOC.getElementById('uiMiniTitle');
  const uiMiniCountB = DOC.getElementById('uiMiniCount');
  const uiMiniFillB  = DOC.getElementById('uiMiniFill');
  const uiMiniTimeB  = DOC.getElementById('uiMiniTime'); // optional

  // Score updates
  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    const score = d.score ?? d.scoreNow ?? d.value ?? 0;
    const combo = d.combo ?? d.comboNow ?? 0;
    const comboMax = d.comboMax ?? d.comboMaxValue ?? d.comboMax ?? 0;
    const miss = d.miss ?? d.misses ?? null;

    if(hudScoreA) hudScoreA.textContent = String(score);
    if(hudComboA) hudComboA.textContent = String(combo);

    if(uiScoreB) uiScoreB.textContent = String(score);
    if(uiComboB) uiComboB.textContent = String(combo);
    if(uiComboMaxB) uiComboMaxB.textContent = String(comboMax);
    if(uiMissB && miss != null) uiMissB.textContent = String(miss);
  }, { passive:true });

  // Time updates
  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    const tShow = Math.max(0, Math.ceil(Number(t)||0));
    if(hudTimeA) hudTimeA.textContent = String(tShow);
    if(uiTimeB) uiTimeB.textContent = String(tShow);
  }, { passive:true });

  // Quest updates
  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    if(d.goal){
      const g = d.goal;
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      const w = `${Math.round((cur/tar)*100)}%`;

      // Layout A
      if(goalNameA) goalNameA.textContent = g.name || 'Goal';
      if(goalSubA)  goalSubA.textContent  = g.sub  || '';
      if(goalNumsA) goalNumsA.textContent = `${cur}/${tar}`;
      if(goalBarA)  goalBarA.style.width  = w;

      // Layout B
      if(uiGoalTitleB) uiGoalTitleB.textContent = g.name || '—';
      if(uiGoalCountB) uiGoalCountB.textContent = `${cur}/${tar}`;
      if(uiGoalFillB)  uiGoalFillB.style.width  = w;
    }

    if(d.mini){
      const m = d.mini;
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      const w = `${Math.round((cur/tar)*100)}%`;

      // Layout A
      if(miniNameA) miniNameA.textContent = m.name || 'Mini Quest';
      if(miniSubA)  miniSubA.textContent  = m.sub  || '';
      if(miniNumsA) miniNumsA.textContent = `${cur}/${tar}`;
      if(miniBarA)  miniBarA.style.width  = w;

      // Layout B
      if(uiMiniTitleB) uiMiniTitleB.textContent = m.name || '—';
      if(uiMiniCountB) uiMiniCountB.textContent = `${cur}/${tar}`;
      if(uiMiniFillB)  uiMiniFillB.style.width  = w;

      // optional: if engine sends miniTimeLeftSec
      if(uiMiniTimeB && (m.timeLeftSec != null || m.leftSec != null)){
        const tt = Math.max(0, Math.ceil(Number(m.timeLeftSec ?? m.leftSec)||0));
        uiMiniTimeB.textContent = String(tt);
      }
    }
  }, { passive:true });

  // Coach
  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  }, { passive:true });
}

/* ---------------------------
   End summary + controls (A + B)
--------------------------- */
function wireEndSummary(){
  // Layout A
  const kScoreA = DOC.getElementById('kScore');
  const kAccA   = DOC.getElementById('kAcc');
  const kComboA = DOC.getElementById('kCombo');
  const kGoalsA = DOC.getElementById('kGoals');
  const kMiniA  = DOC.getElementById('kMini');
  const kMissA  = DOC.getElementById('kMiss');

  // Layout B
  const rModeB  = DOC.getElementById('rMode');
  const rGradeB = DOC.getElementById('rGrade');
  const rScoreB = DOC.getElementById('rScore');
  const rMaxComboB = DOC.getElementById('rMaxCombo');
  const rMissB  = DOC.getElementById('rMiss');
  const rPerfectB = DOC.getElementById('rPerfect');
  const rGoalsB = DOC.getElementById('rGoals');
  const rMinisB = DOC.getElementById('rMinis');

  const rG1 = DOC.getElementById('rG1');
  const rG2 = DOC.getElementById('rG2');
  const rG3 = DOC.getElementById('rG3');
  const rG4 = DOC.getElementById('rG4');
  const rG5 = DOC.getElementById('rG5');
  const rGTotal = DOC.getElementById('rGTotal');

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};

    // Layout A fill
    if(kScoreA) kScoreA.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(kComboA) kComboA.textContent = String(d.comboMax ?? d.combo ?? 0);
    if(kMissA)  kMissA.textContent  = String(d.misses ?? d.miss ?? 0);

    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if(kAccA) kAccA.textContent = (acc==null) ? '—' : pct(acc);

    if(kGoalsA) kGoalsA.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMiniA)  kMiniA.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // Layout B fill (best-effort)
    if(rModeB)  rModeB.textContent  = String(d.runMode ?? qs('run','play') ?? '—');
    if(rGradeB) rGradeB.textContent = String(d.grade ?? '—');
    if(rScoreB) rScoreB.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(rMaxComboB) rMaxComboB.textContent = String(d.comboMax ?? 0);
    if(rMissB)  rMissB.textContent  = String(d.misses ?? 0);
    if(rPerfectB){
      const p = (d.perfectPct ?? d.fastHitRatePct ?? null);
      rPerfectB.textContent = (p==null) ? '—' : `${Math.round(Number(p)||0)}%`;
    }
    if(rGoalsB) rGoalsB.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(rMinisB) rMinisB.textContent = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // group counts (support both naming styles)
    const g1 = d.g1 ?? d.group1 ?? 0;
    const g2 = d.g2 ?? d.group2 ?? 0;
    const g3 = d.g3 ?? d.group3 ?? 0;
    const g4 = d.g4 ?? d.group4 ?? 0;
    const g5 = d.g5 ?? d.group5 ?? 0;

    if(rG1) rG1.textContent = String(g1);
    if(rG2) rG2.textContent = String(g2);
    if(rG3) rG3.textContent = String(g3);
    if(rG4) rG4.textContent = String(g4);
    if(rG5) rG5.textContent = String(g5);
    if(rGTotal) rGTotal.textContent = String((Number(g1)+Number(g2)+Number(g3)+Number(g4)+Number(g5))||0);

    // open overlay
    setOverlayOpen(true);
  }, { passive:true });
}

function wireControls(){
  const hub = qs('hub','') || '';

  // Layout A
  const btnRestartA = DOC.getElementById('btnRestart');
  const btnBackHubA = DOC.getElementById('btnBackHub');

  // Layout B
  const btnPlayAgainB = DOC.getElementById('btnPlayAgain');
  const btnBackHubB   = DOC.getElementById('btnBackHub');

  // Layout B start overlay bridge
  const btnStartMain = DOC.getElementById('btnStartMain');
  const btnStartHidden = DOC.getElementById('btnStart'); // sometimes exists in layout B
  const btnPause = DOC.getElementById('btnPause');
  const pausedOverlay = DOC.getElementById('hudPaused');

  if(btnStartMain && btnStartHidden){
    btnStartMain.addEventListener('click', ()=> btnStartHidden.click(), { passive:true });
  }

  // restart -> reload preserve query
  const doRestart = ()=> location.reload();

  // back hub
  const doBackHub = ()=>{
    if(hub) location.href = hub;
    else history.back();
  };

  btnRestartA?.addEventListener('click', doRestart);
  btnBackHubA?.addEventListener('click', doBackHub);

  btnPlayAgainB?.addEventListener('click', doRestart);
  // note: in layout B, btnBackHub id duplicates with A; safe to bind anyway
  btnBackHubB?.addEventListener('click', doBackHub);

  // Pause overlay (layout B only)
  if(btnPause && pausedOverlay){
    btnPause.addEventListener('click', ()=>{
      const isOpen = (pausedOverlay.style.display === 'grid');
      pausedOverlay.style.display = isOpen ? 'none' : 'grid';
      // (engine pause toggle should be inside engine; here we just show UI)
    });
  }
}

/* ---------------------------
   Engine config
--------------------------- */
function buildEngineConfig(){
  const view = getViewAuto();

  // run mode
  const runRaw = (qs('run','play') || 'play').toLowerCase();
  const runMode = (runRaw === 'study' || runRaw === 'research') ? runRaw : 'play';

  // difficulty
  const diff = (qs('diff','normal') || 'normal').toLowerCase();

  // time: IMPORTANT—single source of truth
  const time = clamp(qs('time','90'), 10, 999);

  // seed: deterministic for study/research; for play can still accept seed for replay
  const seed = Number(qs('seed', Date.now())) || Date.now();

  // allow logger endpoint via query (?log=...) or global
  const logEndpoint = qs('log','') || '';

  return {
    view,
    runMode,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    hub: qs('hub','') || '',
    logEndpoint,

    // passthrough (optional)
    projectTag: qs('projectTag','') || 'herohealth',
    studyId: qs('studyId','') || qs('study','') || '',
    phase: qs('phase','') || '',
    conditionGroup: qs('conditionGroup','') || qs('cond','') || '',
    sessionOrder: qs('sessionOrder','') || qs('order','') || '',
    blockLabel: qs('blockLabel','') || qs('block','') || '',
    siteCode: qs('siteCode','') || qs('site','') || '',
    schoolYear: qs('schoolYear','') || qs('sy','') || '',
    semester: qs('semester','') || qs('sem','') || '',
    sessionId: qs('sessionId','') || qs('sid','') || '',

    schoolCode: qs('schoolCode','') || '',
    schoolName: qs('schoolName','') || '',
    gradeLevel: qs('gradeLevel','') || '',
    studentKey: qs('studentKey','') || ''
  };
}

function ready(fn){
  if(DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once:true });
}

ready(()=>{
  const cfg = buildEngineConfig();

  // set view class first (affects vr-ui crosshair visibility)
  setBodyView(cfg.view);

  // ensure overlays default state
  setOverlayOpen(false);
  setStartOverlayOpen(false); // if layout B wants it open, HTML can set inline

  // wire UI
  wireHUD();
  wireEndSummary();
  wireControls();

  // start engine
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