// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (PATCHED)
// ✅ Auto view detect (no UI override)
// ✅ Loads engine from ./plate.safe.js
// ✅ Wires HUD listeners (hha:score, hha:time, quest:update, hha:coach, hha:end, hha:judge)
// ✅ End overlay via aria-hidden only
// ✅ Back HUB + Restart
// ✅ Pass-through research context params
// ✅ Avoid duplicate ENTER VR button (use vr-ui.js overlay only)

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

function pctStr(n){
  n = Number(n);
  if(!isFinite(n)) return '—';
  return `${Math.round(n)}%`;
}

function setEndOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
  // ถ้า CSS ใช้ display ด้วย ให้กันพลาด:
  if(open) ov.style.pointerEvents = 'auto';
  else ov.style.pointerEvents = 'none';
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

function safeSetBar(el, cur, tar){
  if(!el) return;
  const c = clamp(cur, 0, 9999);
  const t = clamp(tar, 1, 9999);
  el.style.width = `${Math.round((c/t)*100)}%`;
}

/* ------------------------------------------------
 * HUD wiring (IDs must match plate-vr.html)
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

  // score
  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    if(hudScore) hudScore.textContent = String(d.score ?? 0);
    if(hudCombo) hudCombo.textContent = String(d.combo ?? 0);
  }, { passive:true });

  // time
  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    if(hudTime) hudTime.textContent = String(Math.max(0, Math.ceil(Number(t)||0)));
  }, { passive:true });

  // quest update
  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};

    if(d.goal){
      const g = d.goal;
      if(goalName) goalName.textContent = g.name || 'Goal';
      if(goalSub)  goalSub.textContent  = g.sub  || '';
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      if(goalNums) goalNums.textContent = `${cur}/${tar}`;
      safeSetBar(goalBar, cur, tar);
    }

    if(d.mini){
      const m = d.mini;
      if(miniName) miniName.textContent = m.name || 'Mini Quest';
      if(miniSub)  miniSub.textContent  = m.sub  || '';
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      if(miniNums) miniNums.textContent = `${cur}/${tar}`;
      safeSetBar(miniBar, cur, tar);
    }
  }, { passive:true });

  // coach
  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  }, { passive:true });
}

/* ------------------------------------------------
 * End overlay wiring
 * ------------------------------------------------ */
function wireEndSummary(){
  const kScore = DOC.getElementById('kScore');
  const kAcc   = DOC.getElementById('kAcc');
  const kCombo = DOC.getElementById('kCombo');
  const kGoals = DOC.getElementById('kGoals');
  const kMini  = DOC.getElementById('kMini');
  const kMiss  = DOC.getElementById('kMiss');

  const endOverlay = DOC.getElementById('endOverlay');

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};
    if(kScore) kScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(kCombo) kCombo.textContent = String(d.comboMax ?? d.combo ?? 0);
    if(kMiss)  kMiss.textContent  = String(d.misses ?? d.miss ?? 0);

    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if(kAcc) kAcc.textContent = (acc==null) ? '—' : pctStr(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // open overlay
    setEndOpen(true);
    if(endOverlay) endOverlay.setAttribute('aria-hidden','false');
  }, { passive:true });
}

function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = (qs('hub','') || '').trim();

  if(btnRestart){
    btnRestart.addEventListener('click', ()=>{
      location.reload();
    }, { passive:true });
  }

  if(btnBackHub){
    btnBackHub.addEventListener('click', ()=>{
      if(hub) location.href = hub;
      else history.back();
    }, { passive:true });
  }
}

/* ------------------------------------------------
 * Remove duplicate ENTER VR button if exists in HTML (we use vr-ui.js)
 * ------------------------------------------------ */
function removeLocalEnterVrBtn(){
  // ถ้าหน้า HTML มีปุ่ม enterVR ของตัวเอง ให้ซ่อนไว้
  const btn = DOC.getElementById('btnEnterVR');
  if(btn){
    btn.style.display = 'none';
    btn.setAttribute('aria-hidden','true');
  }
}

/* ------------------------------------------------
 * Build engine config (HHA standard)
 * ------------------------------------------------ */
function buildEngineConfig(){
  const view = getViewAuto();
  const run  = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();

  // 90s default (ตามที่คุยกัน)
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

    // passthrough context (optional)
    studyId: qs('studyId', qs('study','')) || '',
    phase: qs('phase','') || '',
    conditionGroup: qs('conditionGroup', qs('cond','')) || '',
    sessionOrder: qs('sessionOrder', qs('order','')) || '',
    blockLabel: qs('blockLabel', qs('block','')) || '',
    siteCode: qs('siteCode', qs('site','')) || '',
    schoolYear: qs('sy','') || '',
    semester: qs('sem','') || '',
    sessionId: qs('sid','') || '',
    gameMode: qs('mode','') || '',
    style: qs('style','') || ''
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

  // ui
  wireHUD();
  wireEndControls();
  wireEndSummary();
  removeLocalEnterVrBtn();

  // close end overlay initially
  setEndOpen(false);

  // mount
  const mount = DOC.getElementById('plate-layer');
  if(!mount){
    console.error('[PlateVR] missing #plate-layer');
    showCoach('ไม่พบพื้นที่เล่น (#plate-layer)', 'System');
    return;
  }

  // boot engine
  try{
    engineBoot({ mount, cfg });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
  }
});