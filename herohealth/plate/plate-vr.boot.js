// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (HARDENED)
// ✅ Auto view detect (no menu; allow ?view= for experiments)
// ✅ Boots engine from ./plate.safe.js
// ✅ Wires HUD: hha:score, hha:time, quest:update
// ✅ Coach: hha:coach
// ✅ Judge: hha:judge => Miss breakdown (junk / expire_good)
// ✅ End overlay: hha:end (supports NEW schema + legacy keys)
// ✅ Back HUB + Restart
// ✅ Pass-through research ctx params (run/diff/time/seed/studyId/...)
// ✅ HARDEN: visible fatal overlay + mount size wait + catch boot errors

'use strict';

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function clamp(v, a, b){
  v = Number(v)||0;
  return v < a ? a : (v > b ? b : v);
}

function pct(n){
  n = Number(n);
  if(!isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  // Allow forcing for experiments: ?view=pc/mobile/vr/cvr
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

function setOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function ensureFatalBox(){
  let box = DOC.getElementById('plateFatal');
  if(box) return box;
  box = DOC.createElement('div');
  box.id = 'plateFatal';
  box.style.position = 'fixed';
  box.style.inset = '12px';
  box.style.zIndex = '9999';
  box.style.padding = '12px';
  box.style.borderRadius = '14px';
  box.style.background = 'rgba(2,6,23,.92)';
  box.style.border = '1px solid rgba(239,68,68,.35)';
  box.style.color = '#e5e7eb';
  box.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  box.style.whiteSpace = 'pre-wrap';
  box.style.display = 'none';
  DOC.body.appendChild(box);
  return box;
}

function fatal(msg, err){
  console.error('[PlateVR] FATAL', msg, err || '');
  const box = ensureFatalBox();
  box.textContent =
    'PLATEVR ERROR\n' +
    '-------------------------\n' +
    String(msg || 'Unknown error') +
    (err ? '\n\n' + (err.stack || err.message || String(err)) : '') +
    '\n\nTip: เปิด DevTools Console เพื่อดูรายละเอียด';
  box.style.display = 'block';
}

WIN.addEventListener('error', (e)=>{
  fatal((e && e.message) ? e.message : 'JS Error', e?.error || e);
});
WIN.addEventListener('unhandledrejection', (e)=>{
  fatal('Promise Rejection', e?.reason || e);
});

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
  }, 2400);
}

/* ----------------------------
   Miss breakdown (from judge)
---------------------------- */
const MISS = {
  junk: 0,
  expire: 0,
  // keep last summary too (for debug)
  last: null
};

function resetMiss(){
  MISS.junk = 0;
  MISS.expire = 0;
  MISS.last = null;
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

  // ✅ Miss breakdown source of truth
  WIN.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind || '').toLowerCase();
    if(kind === 'junk'){
      MISS.junk++;
    }else if(kind === 'expire_good'){
      MISS.expire++;
    }
  });
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = qs('hub','') || '';

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>{
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

  // ✅ optional breakdown fields (only if you add them in HTML)
  const kMissJunk   = DOC.getElementById('kMissJunk');
  const kMissExpire = DOC.getElementById('kMissExpire');
  const kGrade      = DOC.getElementById('kGrade'); // optional

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};
    MISS.last = d;

    // New schema preferred:
    // scoreFinal, comboMax, miss, accuracyPct, grade, timePlannedSec
    // Legacy fallback:
    // scoreFinal/score, comboMax/combo, misses/miss, accuracyGoodPct, durationPlannedSec

    const score = (d.scoreFinal ?? d.score ?? 0);
    const combo = (d.comboMax ?? d.combo ?? 0);
    const miss  = (d.miss ?? d.misses ?? 0);

    const acc = (d.accuracyPct ?? d.accuracyGoodPct ?? null);
    const grade = (d.grade ?? '');

    if(kScore) kScore.textContent = String(score);
    if(kCombo) kCombo.textContent = String(combo);
    if(kMiss)  kMiss.textContent  = String(miss);
    if(kAcc)   kAcc.textContent   = (acc==null) ? '—' : pct(acc);

    if(kGrade && grade) kGrade.textContent = String(grade);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // ✅ breakdown from judge stream (more “felt” accurate)
    if(kMissJunk)   kMissJunk.textContent   = String(MISS.junk);
    if(kMissExpire) kMissExpire.textContent = String(MISS.expire);

    setOverlayOpen(true);
  });
}

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

    // passthrough
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

/* ----------------------------
   Harden: wait mount has size
---------------------------- */
function waitForMountReady(mount, timeoutMs=1200){
  const t0 = performance.now();
  return new Promise((resolve, reject)=>{
    const tick = ()=>{
      const r = mount.getBoundingClientRect();
      if(r.width >= 60 && r.height >= 60) return resolve(r);
      if(performance.now() - t0 > timeoutMs) return reject(new Error('mount has no size'));
      requestAnimationFrame(tick);
    };
    tick();
  });
}

ready(async ()=>{
  // 1) init view
  const cfg = buildEngineConfig();
  setBodyView(cfg.view);

  // 2) wire UI first (so errors are visible)
  resetMiss();
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // 3) ensure overlay closed at start
  setOverlayOpen(false);

  // 4) mount check
  const mount = DOC.getElementById('plate-layer');
  if(!mount){
    fatal('หา playfield ไม่เจอ (#plate-layer)');
    showCoach('หา playfield ไม่เจอ (#plate-layer)', 'System');
    return;
  }

  // 5) ensure mount has size (prevents “เริ่มแล้วนิ่ง” จาก layout ยังไม่ settle)
  try{
    await waitForMountReady(mount, 1400);
  }catch(err){
    console.warn('[PlateVR] mount size not ready; continuing anyway', err);
  }

  // 6) boot engine with guard
  try{
    // microtask yield helps some mobile browsers settle CSS vars before computeSpawnRect()
    await Promise.resolve();
    engineBoot({ mount, cfg });
  }catch(err){
    fatal('เกิดข้อผิดพลาดตอนเริ่มเกม', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู Console)', 'System');
  }
});