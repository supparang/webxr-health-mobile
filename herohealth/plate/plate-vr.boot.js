// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (PATCH SAFE-ZONE + 90s default)
// ✅ Auto view detect (no UI override)
// ✅ Wires HUD listeners (hha:score, hha:time, quest:update, hha:coach, hha:end)
// ✅ End overlay: aria-hidden only
// ✅ Back HUB + Restart
// ✅ Pass-through research context params
// ✅ PATCH: compute spawn safe-zone from HUD + VR-UI overlays
//    -> sets CSS vars: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// ✅ Default time: 90s (kid-friendly; 70s tends to be tight esp. Mobile/VR)

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
  // Do not offer UI override.
  // Allow caller/system to force view by query (experiments), but not via menu.
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
  }, 2200);
}

/* ------------------------------------------------
 * PATCH: Safe-zone for spawn (HUD + VRUI buttons)
 * mode-factory reads: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
 * ------------------------------------------------ */
function cssPx(name){
  const cs = getComputedStyle(DOC.documentElement);
  return parseFloat(cs.getPropertyValue(name)) || 0;
}

function rectOf(el){
  if(!el) return null;
  const st = getComputedStyle(el);
  if(st.display === 'none' || st.visibility === 'hidden') return null;
  const r = el.getBoundingClientRect();
  if(!r || r.width < 2 || r.height < 2) return null;
  return r;
}

function setSafeVars({ top=0, bottom=0, left=0, right=0 }){
  const root = DOC.documentElement;
  root.style.setProperty('--plate-top-safe', `${Math.max(0, Math.round(top))}px`);
  root.style.setProperty('--plate-bottom-safe', `${Math.max(0, Math.round(bottom))}px`);
  root.style.setProperty('--plate-left-safe', `${Math.max(0, Math.round(left))}px`);
  root.style.setProperty('--plate-right-safe', `${Math.max(0, Math.round(right))}px`);
}

function computeAndApplySafeZone(){
  // Base: iOS safe area insets (already in CSS vars)
  const baseTop = cssPx('--sat');
  const baseBottom = cssPx('--sab');
  const baseLeft = cssPx('--sal');
  const baseRight = cssPx('--sar');

  const vw = Math.max(1, WIN.innerWidth || DOC.documentElement.clientWidth || 1);
  const vh = Math.max(1, WIN.innerHeight || DOC.documentElement.clientHeight || 1);

  // Candidates: HUD + VR UI injected nodes
  const candidates = [
    DOC.getElementById('hud'),
    DOC.getElementById('coachCard'),

    // common ids/classes (vr-ui.js)
    DOC.getElementById('hha-vrui'),
    DOC.getElementById('hhaVrUi'),
    DOC.getElementById('hha-vr-ui'),
    DOC.querySelector('.hha-vrui'),
    DOC.querySelector('.hha-vr-ui'),
    DOC.querySelector('[data-hha-vrui]')
  ].filter(Boolean);

  const rects = [];
  for(const el of candidates){
    const r = rectOf(el);
    if(r) rects.push(r);
  }

  // Start with base insets + small margin
  let topSafe = baseTop + 8;
  let bottomSafe = baseBottom + 8;
  let leftSafe = baseLeft + 6;
  let rightSafe = baseRight + 6;

  // Expand safe-zones if overlays touch edges
  const EDGE = 6;
  const M = 12;

  for(const r of rects){
    // top edge
    if(r.top <= baseTop + EDGE){
      topSafe = Math.max(topSafe, r.bottom + M);
    }
    // bottom edge
    if(r.bottom >= vh - (baseBottom + EDGE)){
      bottomSafe = Math.max(bottomSafe, (vh - r.top) + M);
    }
    // left edge
    if(r.left <= baseLeft + EDGE){
      leftSafe = Math.max(leftSafe, r.right + M);
    }
    // right edge
    if(r.right >= vw - (baseRight + EDGE)){
      rightSafe = Math.max(rightSafe, (vw - r.left) + M);
    }
  }

  // Cap to avoid killing playfield
  topSafe = clamp(topSafe, 0, vh * 0.55);
  bottomSafe = clamp(bottomSafe, 0, vh * 0.35);
  leftSafe = clamp(leftSafe, 0, vw * 0.35);
  rightSafe = clamp(rightSafe, 0, vw * 0.35);

  setSafeVars({ top: topSafe, bottom: bottomSafe, left: leftSafe, right: rightSafe });
}

function scheduleSafeZoneRecalc(){
  // run now + after vr-ui inject + after layout settles
  computeAndApplySafeZone();
  clearTimeout(WIN.__PLATE_SAFE_TO1__);
  clearTimeout(WIN.__PLATE_SAFE_TO2__);
  WIN.__PLATE_SAFE_TO1__ = setTimeout(computeAndApplySafeZone, 80);
  WIN.__PLATE_SAFE_TO2__ = setTimeout(computeAndApplySafeZone, 480);
}

/* ------------------------------------------------
 * HUD listeners
 * ------------------------------------------------ */
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
  const run  = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();

  // ✅ default 90s (user-friendly)
  const time = clamp(qs('time','90'), 10, 999);

  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view, runMode: run, diff,
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

  // PATCH: safe-zone
  scheduleSafeZoneRecalc();
  WIN.addEventListener('resize', scheduleSafeZoneRecalc);
  WIN.addEventListener('orientationchange', scheduleSafeZoneRecalc);

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