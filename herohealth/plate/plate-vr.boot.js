// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (anti-hang)
// ✅ Auto view detect (no UI override)
// ✅ Boots engine from ./plate.safe.js
// ✅ Wires HUD events: hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ End overlay: aria-hidden only (no display toggles needed)
// ✅ Restart + Back HUB
// ✅ Pass-through research context params: run/diff/time/seed/studyId/phase/conditionGroup/... etc.
// ✅ Robust: mount check + global error trap + dependency hints

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def=null)=>{
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  // No menu override. Allow ?view= only if caller passes explicitly.
  const forced = String(qs('view','') || '').toLowerCase();
  if(forced) return forced;
  return isMobile() ? 'mobile' : 'pc';
}

function setBodyView(view){
  const b = DOC.body;
  if(!b) return;
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
  if(metaEl) metaEl.textContent = meta;

  card.classList.add('show');
  card.setAttribute('aria-hidden','false');

  clearTimeout(WIN.__HHA_COACH_TO__);
  WIN.__HHA_COACH_TO__ = setTimeout(()=>{
    card.classList.remove('show');
    card.setAttribute('aria-hidden','true');
  }, 2400);
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
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = String(qs('hub','') || '');

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
    if(kAcc) kAcc.textContent = (acc==null) ? '—' : pct(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    setOverlayOpen(true);
  });
}

function buildEngineConfig(){
  const view = getViewAuto();
  const run  = String(qs('run','play') || 'play').toLowerCase();
  const diff = String(qs('diff','normal') || 'normal').toLowerCase();
  const time = clamp(qs('time','90'), 10, 999);
  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    // endpoints / navigation
    hub: String(qs('hub','') || ''),
    logEndpoint: String(qs('log','') || ''),

    // research ctx passthrough (optional)
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

// ---- Global error trap (helps when "กดเริ่มแล้วค้าง")
WIN.addEventListener('error', (e)=>{
  try{
    console.error('[PlateVR] window error', e?.error || e?.message || e);
    showCoach('มีข้อผิดพลาดในสคริปต์ (ดู Console)', 'System');
  }catch{}
});

WIN.addEventListener('unhandledrejection', (e)=>{
  try{
    console.error('[PlateVR] unhandledrejection', e?.reason || e);
    showCoach('Promise error (ดู Console)', 'System');
  }catch{}
});

ready(()=>{
  const cfg = buildEngineConfig();

  // apply view class immediately
  setBodyView(cfg.view);

  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // ensure overlay closed at start
  setOverlayOpen(false);

  // mount check
  const mount = DOC.getElementById('plate-layer');
  if(!mount){
    showCoach('หา #plate-layer ไม่เจอ (โครง HTML ไม่ตรง)', 'System');
    console.error('[PlateVR] mount missing: #plate-layer');
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