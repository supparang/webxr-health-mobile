// =========================================================
// === /herohealth/plate/plate.boot.js ===
// Balanced Plate VR Boot — PRODUCTION (A26)
// ✅ Auto view detect (no UI override)
// ✅ Boots engine from ./plate.safe.js
// ✅ Wires HUD listeners (hha:score, hha:time, quest:update, hha:coach, hha:end)
// ✅ Result overlay: aria-hidden toggle
// ✅ Back HUB + Play again
// ✅ Pass-through research ctx: run/diff/time/seed/studyId/phase/conditionGroup/... etc.
// =========================================================

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && (innerWidth < 920));
}

function getViewAuto(){
  const forced = (qs('view','')||'').toLowerCase();
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

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function pct(n){
  n = Number(n)||0;
  return `${Math.round(n)}%`;
}

/* ---------- Result overlay helpers ---------- */
function setResultOpen(open){
  const ov = DOC.getElementById('resultBackdrop');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

/* ---------- Coach helper ---------- */
function setCoach(msg){
  const el = DOC.getElementById('coachMsg');
  if(el) el.textContent = String(msg || '');
}

/* ---------- HUD wiring ---------- */
function wireHUD(){
  const hudScore = DOC.getElementById('hudScore');
  const hudTime  = DOC.getElementById('hudTime');
  const hudCombo = DOC.getElementById('hudCombo');
  const hudMiss  = DOC.getElementById('hudMiss');

  const hudPlateHave = DOC.getElementById('hudPlateHave');
  const hudAcc = DOC.getElementById('hudAcc');

  const hudG1 = DOC.getElementById('hudG1');
  const hudG2 = DOC.getElementById('hudG2');
  const hudG3 = DOC.getElementById('hudG3');
  const hudG4 = DOC.getElementById('hudG4');
  const hudG5 = DOC.getElementById('hudG5');

  const goalName = DOC.getElementById('goalName');
  const goalNums = DOC.getElementById('goalNums');
  const goalBar  = DOC.getElementById('goalBar');

  const miniName = DOC.getElementById('miniName');
  const miniNums = DOC.getElementById('miniNums');
  const miniBar  = DOC.getElementById('miniBar');

  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if(hudScore) hudScore.textContent = String(d.score ?? d.value ?? 0);
    if(hudCombo) hudCombo.textContent = String(d.combo ?? d.comboNow ?? 0);
    if('miss' in d || 'misses' in d){
      if(hudMiss) hudMiss.textContent = String(d.miss ?? d.misses ?? 0);
    }
  });

  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    if(hudTime) hudTime.textContent = String(Math.max(0, Math.ceil(Number(t)||0)));
  });

  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};

    // expected: { goal:{name,cur,target}, mini:{name,cur,target,done}, allDone }
    if(d.goal){
      const g = d.goal || {};
      if(goalName) goalName.textContent = g.name || 'Goal';
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      if(goalNums) goalNums.textContent = `${cur}/${tar}`;
      if(goalBar)  goalBar.style.width  = `${Math.round((cur/tar)*100)}%`;
    }

    if(d.mini){
      const m = d.mini || {};
      if(miniName) miniName.textContent = m.name || 'Mini';
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      if(miniNums) miniNums.textContent = `${cur}/${tar}`;
      if(miniBar)  miniBar.style.width  = `${Math.round((cur/tar)*100)}%`;
    }

    // optional extra UI if engine sends:
    // { plateHave, accPct, g:[...] }
    if('plateHave' in d && hudPlateHave) hudPlateHave.textContent = String(d.plateHave ?? 0);
    if('accPct' in d && hudAcc) hudAcc.textContent = pct(d.accPct ?? 0);
    if(Array.isArray(d.g)){
      if(hudG1) hudG1.textContent = String(d.g[0] ?? 0);
      if(hudG2) hudG2.textContent = String(d.g[1] ?? 0);
      if(hudG3) hudG3.textContent = String(d.g[2] ?? 0);
      if(hudG4) hudG4.textContent = String(d.g[3] ?? 0);
      if(hudG5) hudG5.textContent = String(d.g[4] ?? 0);
    }
  });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) setCoach(d.msg || d.text);
  });
}

/* ---------- End summary wiring ---------- */
function wireEndSummary(){
  const rMode = DOC.getElementById('rMode');
  const rScore = DOC.getElementById('rScore');
  const rMaxCombo = DOC.getElementById('rMaxCombo');
  const rMiss = DOC.getElementById('rMiss');
  const rGoals = DOC.getElementById('rGoals');
  const rMinis = DOC.getElementById('rMinis');

  const rG1 = DOC.getElementById('rG1');
  const rG2 = DOC.getElementById('rG2');
  const rG3 = DOC.getElementById('rG3');
  const rG4 = DOC.getElementById('rG4');
  const rG5 = DOC.getElementById('rG5');

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};

    if(rMode) rMode.textContent = String(d.runMode ?? qs('run','play') ?? 'play');
    if(rScore) rScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(rMaxCombo) rMaxCombo.textContent = String(d.comboMax ?? d.combo ?? 0);
    if(rMiss) rMiss.textContent = String(d.misses ?? d.miss ?? 0);

    if(rGoals) rGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(rMinis) rMinis.textContent = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // groups (either g1..g5 or array g)
    if(Array.isArray(d.g)){
      if(rG1) rG1.textContent = String(d.g[0] ?? 0);
      if(rG2) rG2.textContent = String(d.g[1] ?? 0);
      if(rG3) rG3.textContent = String(d.g[2] ?? 0);
      if(rG4) rG4.textContent = String(d.g[3] ?? 0);
      if(rG5) rG5.textContent = String(d.g[4] ?? 0);
    }else{
      if(rG1) rG1.textContent = String(d.g1 ?? 0);
      if(rG2) rG2.textContent = String(d.g2 ?? 0);
      if(rG3) rG3.textContent = String(d.g3 ?? 0);
      if(rG4) rG4.textContent = String(d.g4 ?? 0);
      if(rG5) rG5.textContent = String(d.g5 ?? 0);
    }

    setResultOpen(true);
  });
}

/* ---------- End buttons ---------- */
function wireEndControls(){
  const btnPlayAgain = DOC.getElementById('btnPlayAgain');
  const btnBackHub   = DOC.getElementById('btnBackHub');

  const hub = (qs('hub','') || '').trim();

  btnPlayAgain?.addEventListener('click', ()=>{
    // keep same params
    location.reload();
  }, { passive:true });

  btnBackHub?.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else history.back();
  }, { passive:true });
}

/* ---------- Build engine cfg ---------- */
function buildEngineConfig(){
  const view = getViewAuto();
  const run  = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();

  // default to 90s if not provided
  const timeParam = qs('time', null);
  const time = clamp(timeParam == null ? 90 : Number(timeParam), 10, 999);

  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    hub: qs('hub','') || '',
    logEndpoint: qs('log','') || '',

    // passthrough context (optional)
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

ready(()=>{
  const cfg = buildEngineConfig();

  // set view class for vr-ui crosshair visibility rules
  setBodyView(cfg.view);

  // close result at start
  setResultOpen(false);

  // wire UI
  wireHUD();
  wireEndSummary();
  wireEndControls();

  // boot engine
  try{
    engineBoot({
      mount: DOC.getElementById('plate-layer'),
      cfg
    });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    setCoach('เกิดข้อผิดพลาดตอนเริ่มเกม');
  }
});