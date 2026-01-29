// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (LATEST)
// ✅ Auto view detect (no UI override menu)
// ✅ Default time=90 (ปรับได้ด้วย ?time=)
// ✅ FIX: safe-zone vars for mode-factory (เป้าไม่ทับ HUD)
// ✅ Wires HUD listeners: hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ End overlay: aria-hidden only + restart/back hub
// ✅ Keeps engine controller (so plate.safe.js can stop spawner on end if it wants)
// ✅ Pass-through research context params: run/diff/time/seed/studyId/... etc.

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
  n = Number(n)||0;
  return `${Math.round(n)}%`;
}

function isMobile(){
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto(){
  // ไม่ทำเมนูให้เลือกเอง แต่ "อนุญาต" ให้ force ด้วย query สำหรับงานทดลอง
  const forced = (qs('view','')||'').toLowerCase();
  if(forced) return forced; // pc/mobile/vr/cvr
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
 * SAFE ZONE: ให้ mode-factory หลีก HUD / ขอบบน-ล่าง
 * mode-factory.js จะอ่าน CSS vars:
 * --plate-top-safe --plate-bottom-safe --plate-left-safe --plate-right-safe
 * ------------------------------------------------ */
function measureSafeZone(){
  const root = DOC.documentElement;
  const hud = DOC.getElementById('hud');
  const layer = DOC.getElementById('plate-layer');

  // base safe = safe-area inset
  const cs = getComputedStyle(root);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
  const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;

  // padding กันเป้าชนขอบ
  const PAD = 10;

  let topSafe = sat + PAD;
  let bottomSafe = sab + PAD;
  let leftSafe = sal + PAD;
  let rightSafe = sar + PAD;

  // กัน HUD (ถ้ามี)
  if(hud && layer){
    const rHud = hud.getBoundingClientRect();
    const rLay = layer.getBoundingClientRect();

    // HUD ปกติอยู่ด้านบน => กันความสูง HUD เป็น topSafe เพิ่ม
    // (ถ้าอนาคตย้าย HUD ลงล่าง ก็ยังทำงานได้ด้วยการเทียบตำแหน่ง)
    const hudTopInLayer = rHud.top - rLay.top;
    const hudBottomInLayer = rLay.bottom - rHud.bottom;

    // ถ้า HUD อยู่ด้านบนจริง
    if(hudTopInLayer <= 24){
      topSafe = Math.max(topSafe, (rHud.height + sat + PAD));
    }else{
      // ถ้า HUD ไม่ได้อยู่ชิดบน ให้กันแบบ conservative
      topSafe = Math.max(topSafe, sat + PAD);
    }

    // เผื่อบาง layout มี HUD/ปุ่มด้านล่าง (อนาคต)
    if(hudBottomInLayer <= 24){
      bottomSafe = Math.max(bottomSafe, (rHud.height + sab + PAD));
    }
  }

  root.style.setProperty('--plate-top-safe', `${Math.round(topSafe)}px`);
  root.style.setProperty('--plate-bottom-safe', `${Math.round(bottomSafe)}px`);
  root.style.setProperty('--plate-left-safe', `${Math.round(leftSafe)}px`);
  root.style.setProperty('--plate-right-safe', `${Math.round(rightSafe)}px`);
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

    // update safe-zone หลัง HUD เปลี่ยนขนาด (บางภาษา/บางจอ)
    measureSafeZone();
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

  // ✅ default 90
  const time = clamp(qs('time','90'), 10, 999);

  const seedRaw = qs('seed', String(Date.now()));
  const seed = Number(seedRaw) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    hub: qs('hub','') || '',
    logEndpoint: qs('log','') || '',

    // passthrough research context (optional)
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

  // view class
  setBodyView(cfg.view);

  // UI wiring
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // overlay closed at start
  setOverlayOpen(false);

  // SAFE ZONE (initial + responsive)
  measureSafeZone();
  WIN.addEventListener('resize', ()=>measureSafeZone(), { passive:true });

  // boot engine
  try{
    const mount = DOC.getElementById('plate-layer');
    if(!mount) throw new Error('PlateVR: #plate-layer missing');

    // เก็บ controller ไว้เผื่อ stop ตอนจบ/ออกหน้า (plate.safe.js จะใช้ได้)
    const controller = engineBoot({ mount, cfg }) || null;
    WIN.__HHA_PLATE_CONTROLLER__ = controller;

  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
  }
});