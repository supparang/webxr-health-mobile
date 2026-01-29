// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (START-GATED + SAFE MEASURE)
// ✅ Auto view detect (no UI override)
// ✅ Optional start gate via #btnStart (if exists)
// ✅ measureSafe() sets --plate-*-safe based on HUD/Intro panels
// ✅ Loads engine from ./plate.safe.js
// ✅ Wires HUD listeners + end overlay + back hub/restart
// ✅ Pass-through research ctx params

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

function setIntroOpen(open){
  const intro = DOC.getElementById('introOverlay');
  if(!intro) return;
  intro.style.display = open ? '' : 'none';
  intro.setAttribute('aria-hidden', open ? 'false' : 'true');
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

/* ---------------------------
 * SAFE-ZONE MEASURE (สำคัญมาก)
 * --------------------------- */
function setVar(name, px){
  try{ DOC.documentElement.style.setProperty(name, `${Math.max(0, Math.round(px||0))}px`); }catch{}
}

function measureSafe(){
  // 기준: ให้พื้นที่ spawn ไม่โดน HUD/Intro ทับ
  const hud = DOC.getElementById('hudTop');        // ถ้ามี
  const quest = DOC.getElementById('questPanel');  // ถ้ามี
  const intro = DOC.getElementById('introOverlay');// ถ้ามี

  // default
  let topSafe = 0, bottomSafe = 0, leftSafe = 0, rightSafe = 0;

  // top safe from HUD/Quest (เอาค่าล่างสุดของ panel ที่ทับบน)
  const tops = [];
  if(hud && hud.offsetParent !== null){
    const r = hud.getBoundingClientRect();
    tops.push(r.bottom + 10);
  }
  if(quest && quest.offsetParent !== null){
    const r = quest.getBoundingClientRect();
    tops.push(r.bottom + 10);
  }
  // ถ้า intro ยังเปิดอยู่ อย่าให้ใช้ค่านี้ (มันจะบังทั้งจอจน spawnRect = 0)
  if(intro && intro.offsetParent !== null){
    // intro เปิดอยู่ -> กันไม่ให้ spawn (ปล่อย topSafe สูงไว้ชั่วคราว)
    const r = intro.getBoundingClientRect();
    tops.push(r.bottom + 12);
  }

  if(tops.length) topSafe = Math.max(...tops);

  // bottom safe for VR UI buttons (enter/exit/recenter)
  const vrui = DOC.getElementById('hha-vrui'); // ถ้า vr-ui.js สร้าง layer นี้
  if(vrui && vrui.offsetParent !== null){
    const r = vrui.getBoundingClientRect();
    // พื้นที่ด้านล่างที่ปุ่มทับ (เอาความสูง)
    bottomSafe = Math.max(0, (innerHeight - r.top) + 8);
  }else{
    bottomSafe = 0;
  }

  // side safe (เผื่อ notch/side UI)
  leftSafe = 0; rightSafe = 0;

  setVar('--plate-top-safe', topSafe);
  setVar('--plate-bottom-safe', bottomSafe);
  setVar('--plate-left-safe', leftSafe);
  setVar('--plate-right-safe', rightSafe);

  // ดีบักได้ถ้าต้องการ:
  // console.log('[Plate] safe', { topSafe, bottomSafe, leftSafe, rightSafe });
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
  const hub = qs('hub','') || '';

  if(btnRestart){
    btnRestart.addEventListener('click', ()=> location.reload());
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
  const time = clamp(qs('time','90'), 10, 999);  // ✅ default 90
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

let __BOOTED__ = false;

function startGame(){
  if(__BOOTED__) return;
  __BOOTED__ = true;

  // hide intro if exists, then re-measure safe and boot
  setIntroOpen(false);
  measureSafe();

  // ensure end overlay closed at start
  setOverlayOpen(false);

  const cfg = buildEngineConfig();
  setBodyView(cfg.view);

  try{
    engineBoot({
      mount: DOC.getElementById('plate-layer'),
      cfg
    });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
    __BOOTED__ = false;
  }
}

ready(()=>{
  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // initial safe measurement (intro may exist)
  measureSafe();
  WIN.addEventListener('resize', ()=>measureSafe(), { passive:true });

  // If page has a start button => gate start by click
  const btnStart = DOC.getElementById('btnStart');
  if(btnStart){
    btnStart.addEventListener('click', ()=>{
      btnStart.disabled = true;
      startGame();
    }, { passive:true });
    // intro open by default
    setIntroOpen(true);
    showCoach('กดเริ่มเกมได้เลย ✅', 'Coach');
  }else{
    // no start UI => autostart
    startGame();
  }
});
