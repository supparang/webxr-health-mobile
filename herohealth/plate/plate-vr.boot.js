// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION vNEXT
// ✅ Auto view detect
// ✅ Boots engine
// ✅ HUD + End summary
// ✅ Miss breakdown (junk/timeout/shot)
// ✅ NEW: Evaluate/Create panel after end
// ✅ NEW: Silent badge (no popup) stored in localStorage

'use strict';

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

function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function pct(n){ n=Number(n)||0; return `${Math.round(n)}%`; }

function setOverlayOpen(open){
  const ov = DOC.getElementById('endOverlay');
  if(!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}
function setReflectOpen(open){
  const ov = DOC.getElementById('reflectOverlay');
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

/* -------------------- Silent badge -------------------- */
function loadBadges(){
  try{
    const raw = localStorage.getItem('HHA_BADGES_V1');
    return raw ? JSON.parse(raw) : {};
  }catch{ return {}; }
}
function saveBadges(obj){
  try{ localStorage.setItem('HHA_BADGES_V1', JSON.stringify(obj||{})); }catch{}
}
function awardSilentBadge(id, meta={}){
  if(!id) return false;
  const b = loadBadges();
  if(b[id]) return false; // already
  b[id] = { at: Date.now(), ...meta };
  saveBadges(b);
  try{ WIN.dispatchEvent(new CustomEvent('hha:badge',{ detail:{ id, ...b[id] } })); }catch{}
  return true;
}

/* -------------------- Miss breakdown from judge stream -------------------- */
const MISS = { junk:0, timeout:0, shot:0 };

function resetMissBreakdown(){
  MISS.junk=0; MISS.timeout=0; MISS.shot=0;
}

function wireMissStream(){
  WIN.addEventListener('hha:judge', (e)=>{
    const d = e.detail || {};
    const kind = String(d.kind||'').toLowerCase();
    if(kind === 'junk') MISS.junk++;
    else if(kind === 'expire_good') MISS.timeout++;
    else if(kind === 'shot_miss') MISS.shot++;
  });
}

/* -------------------- HUD -------------------- */
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

/* -------------------- End controls -------------------- */
function wireEndControls(){
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = qs('hub','') || '';

  if(btnRestart) btnRestart.addEventListener('click', ()=>location.reload());
  if(btnBackHub) btnBackHub.addEventListener('click', ()=>{
    if(hub) location.href = hub;
    else history.back();
  });
}

/* -------------------- End summary + Reflect flow -------------------- */
let LAST_SUMMARY = null;

function wireEndSummary(){
  const kScore = DOC.getElementById('kScore');
  const kAcc   = DOC.getElementById('kAcc');
  const kCombo = DOC.getElementById('kCombo');
  const kGoals = DOC.getElementById('kGoals');
  const kMini  = DOC.getElementById('kMini');
  const kMiss  = DOC.getElementById('kMiss');

  const kMissJunk    = DOC.getElementById('kMissJunk');
  const kMissTimeout = DOC.getElementById('kMissTimeout');
  const kMissShot    = DOC.getElementById('kMissShot');
  const kGrade       = DOC.getElementById('kGrade');

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};
    LAST_SUMMARY = d;

    if(kScore) kScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(kCombo) kCombo.textContent = String(d.comboMax ?? d.combo ?? 0);

    const missTotal = (d.miss ?? d.misses ?? 0);
    if(kMiss) kMiss.textContent = String(missTotal);

    const acc = (d.accuracyPct ?? d.accuracyGoodPct ?? null);
    if(kAcc) kAcc.textContent = (acc==null) ? '—' : pct(acc);

    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // breakdown: prefer engine keys, fallback to stream counters
    if(kMissJunk)    kMissJunk.textContent    = String(d.missJunk ?? MISS.junk ?? 0);
    if(kMissTimeout) kMissTimeout.textContent = String(d.missExpire ?? MISS.timeout ?? 0);
    if(kMissShot)    kMissShot.textContent    = String(d.missShot ?? MISS.shot ?? 0);

    if(kGrade) kGrade.textContent = String(d.grade || '—');

    setOverlayOpen(true);

    // ✅ open reflect panel after a beat (Kid-friendly)
    setTimeout(()=>{ openReflectPanel(d); }, 350);
  });
}

/* -------------------- Evaluate/Create UI -------------------- */
function openReflectPanel(summary){
  // if HTML not present, just skip safely
  const ov = DOC.getElementById('reflectOverlay');
  if(!ov) return;

  // seed recommended “create” based on misses
  const missJ = Number(summary?.missJunk ?? 0);
  const missE = Number(summary?.missExpire ?? 0);
  const missS = Number(summary?.missShot ?? 0);
  const acc = Number(summary?.accuracyPct ?? summary?.accuracyGoodPct ?? 0);

  const hint = DOC.getElementById('reflectHint');
  if(hint){
    const bestTip =
      (missJ > 0) ? 'ลดของทอด/หวาน แล้วลองใหม่!' :
      (missE > 0) ? 'ลองเพิ่มความเร็ว/เล็งให้แม่นขึ้น!' :
      (missS > 0) ? 'เล็งกลางเป้าแล้วค่อยยิง!' :
      (acc >= 85) ? 'เยี่ยมมาก! ลองปรับให้ “สมดุลขึ้น” อีกนิด!' :
      'ลองปรับ 1 อย่าง แล้วดูผลทันที!';
    hint.textContent = bestTip;
  }

  setReflectOpen(true);
}

function wireReflectActions(){
  const ov = DOC.getElementById('reflectOverlay');
  if(!ov) return;

  // Evaluate radios
  const evalRadios = Array.from(DOC.querySelectorAll('input[name="plateEval"]'));

  // Create buttons
  const btnAddVeg = DOC.getElementById('btnAddVeg');
  const btnLessRice = DOC.getElementById('btnLessRice');
  const btnSwapFruit = DOC.getElementById('btnSwapFruit');

  const result = DOC.getElementById('reflectResult');
  const badgeLine = DOC.getElementById('reflectBadge');

  function setResult(text){
    if(result) result.textContent = text || '';
  }
  function setBadge(text){
    if(badgeLine) badgeLine.textContent = text || '';
  }

  function readEval(){
    const picked = evalRadios.find(r=>r.checked);
    return picked ? picked.value : '';
  }

  function applyCreate(kind){
    // Show instant effect (simple, kid-friendly)
    const evalChoice = readEval();
    const base = `คุณเลือกเหตุผล: ${evalChoice || 'ยังไม่เลือก'}`;

    if(kind === 'addVeg'){
      setResult(`${base}\n✅ ปรับแล้ว: เพิ่มผัก → จานสมดุลขึ้น`);
      const got = awardSilentBadge('PLATE_VEG_FIX', { game:'plate', why:evalChoice });
      setBadge(got ? '🏅 ได้รับเหรียญลับ: Veg Fix!' : '🏅 เหรียญลับนี้ได้แล้ว');
    }
    if(kind === 'lessRice'){
      setResult(`${base}\n✅ ปรับแล้ว: ลดข้าว/แป้ง → ลดมากไป/พอดีขึ้น`);
      const got = awardSilentBadge('PLATE_RICE_TUNE', { game:'plate', why:evalChoice });
      setBadge(got ? '🏅 ได้รับเหรียญลับ: Rice Tuner!' : '🏅 เหรียญลับนี้ได้แล้ว');
    }
    if(kind === 'swapFruit'){
      setResult(`${base}\n✅ ปรับแล้ว: เปลี่ยนขนมเป็นผลไม้ → เลือกสุขภาพขึ้น`);
      const got = awardSilentBadge('PLATE_FRUIT_SWAP', { game:'plate', why:evalChoice });
      setBadge(got ? '🏅 ได้รับเหรียญลับ: Fruit Swap!' : '🏅 เหรียญลับนี้ได้แล้ว');
    }

    // Optional: tag summary/log
    try{
      WIN.dispatchEvent(new CustomEvent('plate:reflect', {
        detail: { evalChoice, create: kind, summary: LAST_SUMMARY || null }
      }));
    }catch{}
  }

  if(btnAddVeg) btnAddVeg.addEventListener('click', ()=>applyCreate('addVeg'));
  if(btnLessRice) btnLessRice.addEventListener('click', ()=>applyCreate('lessRice'));
  if(btnSwapFruit) btnSwapFruit.addEventListener('click', ()=>applyCreate('swapFruit'));

  // close
  const btnClose = DOC.getElementById('btnReflectClose');
  if(btnClose){
    btnClose.addEventListener('click', ()=>{
      setReflectOpen(false);
    });
  }
}

/* -------------------- config -------------------- */
function buildEngineConfig(){
  const view = getViewAuto();
  const run  = (qs('run','play')||'play').toLowerCase();
  const diff = (qs('diff','normal')||'normal').toLowerCase();

  // if time not provided => engine will pick defaults by mode/diff
  const timeRaw = qs('time', '');
  const time = timeRaw==='' ? null : clamp(timeRaw, 10, 999);

  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: (time==null ? undefined : Number(time)),
    seed: Number(seed),

    // play tuning
    allowEarlyEnd: qs('earlyEnd','0'), // default 0

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

ready(()=>{
  resetMissBreakdown();

  const cfg = buildEngineConfig();
  setBodyView(cfg.view);

  wireHUD();
  wireMissStream();
  wireEndControls();
  wireEndSummary();
  wireReflectActions();

  setOverlayOpen(false);
  setReflectOpen(false);

  const mount = DOC.getElementById('plate-layer');
  if(!mount){
    console.error('[PlateVR] mount #plate-layer missing');
    showCoach('หา playfield ไม่เจอ (#plate-layer)', 'System');
    return;
  }

  try{
    Promise.resolve().then(()=>{
      engineBoot({ mount, cfg });
    });
  }catch(err){
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม (ดู Console)', 'System');
  }
});