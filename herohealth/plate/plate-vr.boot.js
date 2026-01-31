// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (anti-freeze)
// ✅ No menu: auto-start
// ✅ Auto view detect (UI does not override); supports ?view= for experiments
// ✅ Sets CSS safe vars: --plate-top-safe/--plate-bottom-safe/--plate-left-safe/--plate-right-safe
// ✅ Wires HUD listeners + coach + end overlay
// ✅ Robust start: retries if mount/layout not ready
// ✅ Global error trap: shows coach instead of silent freeze
// ✅ Pass-through research context params

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

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  const forced = (qs('view','')||'').toLowerCase();
  if(forced) return forced; // allow experiment forcing
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
  n = Number(n)||0;
  return `${Math.round(n)}%`;
}

function setOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function showCoach(msg, meta='System'){
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

// --- Global error trap (prevents silent freeze) ---
function attachGlobalErrorTrap(){
  if(WIN.__PLATE_ERR_TRAP__) return;
  WIN.__PLATE_ERR_TRAP__ = true;

  WIN.addEventListener('error', (ev)=>{
    try{
      const msg = (ev && (ev.message || (ev.error && ev.error.message))) || 'เกิดข้อผิดพลาด';
      console.error('[PlateVR] window.error', ev.error || ev);
      showCoach(`Error: ${msg}`, 'System');
    }catch{}
  });

  WIN.addEventListener('unhandledrejection', (ev)=>{
    try{
      console.error('[PlateVR] unhandledrejection', ev.reason);
      const msg = (ev && ev.reason && (ev.reason.message || String(ev.reason))) || 'Promise error';
      showCoach(`Error: ${msg}`, 'System');
    }catch{}
  });
}

// --- Safe-zone measure: set CSS vars so mode-factory spawn rect avoids HUD/VR UI ---
function setSafeVars({top=0,bottom=0,left=0,right=0}){
  const root = DOC.documentElement;
  root.style.setProperty('--plate-top-safe', `${Math.max(0, Math.round(top))}px`);
  root.style.setProperty('--plate-bottom-safe', `${Math.max(0, Math.round(bottom))}px`);
  root.style.setProperty('--plate-left-safe', `${Math.max(0, Math.round(left))}px`);
  root.style.setProperty('--plate-right-safe', `${Math.max(0, Math.round(right))}px`);
}

function measureHudSafe(){
  // We compute how much the HUD overlaps the playfield edges.
  // Then we convert overlap into padding to keep targets away from those zones.
  const layer = DOC.getElementById('plate-layer');
  const hud = DOC.getElementById('hud');
  if(!layer) return;

  const rLayer = layer.getBoundingClientRect();
  let top = 0, bottom = 0, left = 0, right = 0;

  const addRectSafe = (r)=>{
    if(!r) return;
    // overlap with layer bounds
    const ovTop = Math.max(0, (r.bottom - rLayer.top));          // HUD intrudes from top
    const ovBottom = Math.max(0, (rLayer.bottom - r.top));       // HUD intrudes from bottom
    const ovLeft = Math.max(0, (r.right - rLayer.left));         // from left
    const ovRight = Math.max(0, (rLayer.right - r.left));        // from right

    // but only count if actually overlapping that side band
    if(r.top <= rLayer.top + 2) top = Math.max(top, ovTop);
    if(r.bottom >= rLayer.bottom - 2) bottom = Math.max(bottom, ovBottom);
    if(r.left <= rLayer.left + 2) left = Math.max(left, ovLeft);
    if(r.right >= rLayer.right - 2) right = Math.max(right, ovRight);
  };

  // HUD
  if(hud){
    const rHud = hud.getBoundingClientRect();
    addRectSafe(rHud);
  }

  // Optional: vr-ui.js injected controls container (best-effort)
  // NOTE: if your vr-ui uses different ids/classes, this still won't break anything.
  const vrBtns = DOC.querySelector('#hha-vrui, .hha-vrui, #vrui, .vrui');
  if(vrBtns){
    addRectSafe(vrBtns.getBoundingClientRect());
  }

  // add small margin for comfort + finger space
  const margin = isMobile() ? 10 : 8;
  setSafeVars({
    top: top + margin,
    bottom: bottom + margin,
    left: left + margin,
    right: right + margin
  });
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

    // After quest UI changes, recalc safe-zone (prevents target overlapping)
    requestAnimationFrame(measureHudSafe);
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
    requestAnimationFrame(measureHudSafe);
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

    // endpoints / tags
    hub: qs('hub','') || '',
    logEndpoint: qs('log','') || '',

    // research passthrough (optional fields used by logger)
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

// --- start engine with mount/layout readiness checks ---
function bootEngineWithRetry({ mount, cfg }){
  const maxTry = 20;      // ~2 seconds worst case
  let tries = 0;

  const attempt = ()=>{
    tries++;

    if(!mount){
      if(tries >= maxTry) throw new Error('PlateVR: mount missing');
      return requestAnimationFrame(attempt);
    }

    // ensure safe vars exist even before measurement
    setSafeVars({ top: 0, bottom: 0, left: 0, right: 0 });

    // mount must have reasonable rect
    const r = mount.getBoundingClientRect();
    if(r.width < 120 || r.height < 120){
      if(tries >= maxTry){
        console.warn('[PlateVR] mount rect too small', r);
        return engineBoot({ mount, cfg }); // try anyway as last resort
      }
      return requestAnimationFrame(attempt);
    }

    // measure HUD safe after layout settles
    requestAnimationFrame(()=>{
      measureHudSafe();
      // and boot engine
      engineBoot({ mount, cfg });
      // measure again after engine adds stuff
      requestAnimationFrame(measureHudSafe);
    });
  };

  attempt();
}

ready(()=>{
  attachGlobalErrorTrap();

  const cfg = buildEngineConfig();
  setBodyView(cfg.view);

  // Wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();
  setOverlayOpen(false);

  // Keep safe-zone updated on resize/orientation
  let __rzTO = 0;
  const onResize = ()=>{
    clearTimeout(__rzTO);
    __rzTO = setTimeout(()=>measureHudSafe(), 120);
  };
  WIN.addEventListener('resize', onResize);
  WIN.addEventListener('orientationchange', onResize);

  // Boot
  try{
    const mount = DOC.getElementById('plate-layer');
    bootEngineWithRetry({ mount, cfg });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู Console)', 'System');
  }
});