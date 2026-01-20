// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (HHA Standard)
// ------------------------------------------------------------
// ✅ Auto view detect (no UI override; respects ?view=... if provided)
// ✅ Boots engine from ./plate.safe.js
// ✅ Wires HUD listeners (hha:score, hha:time, quest:update, hha:coach, hha:end)
// ✅ Supports BOTH HTML layouts you posted:
//    Layout A (minimal): hudScore/hudTime/hudCombo + goalName/goalNums... + endOverlay
//    Layout B (full):    uiScore/uiCombo/uiTime/uiMiss + uiGoalTitle/uiGoalCount/... + resultBackdrop
// ✅ Debug: show WHY targets not spawning (mount missing/zero size)
// ✅ Back HUB + Restart
// ✅ Pass-through research context params: run/diff/time/seed/studyId/... etc.
// ------------------------------------------------------------

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
  // Respect forced view if present (for experiments), but no UI menu.
  const forced = (qs('view','')||'').toLowerCase();
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

function q(id){ return DOC.getElementById(id); }

function showDbg(msg){
  const el = q('startDbg') || q('hudHint') || q('uiHint');
  if(el) el.textContent = String(msg||'');
}

function showCoach(msg, meta='Coach'){
  // Layout A: coachCard/coachMsg/coachMeta
  const cardA = q('coachCard');
  const msgA  = q('coachMsg');
  const metaA = q('coachMeta');

  // Layout B: coachPanel/coachMsg + coachImg exists (but still id=coachMsg)
  const msgB  = q('coachMsg');

  if(msgA){
    msgA.textContent = String(msg || '');
    if(metaA) metaA.textContent = meta;
    if(cardA){
      cardA.classList.add('show');
      cardA.setAttribute('aria-hidden','false');
      clearTimeout(WIN.__HHA_COACH_TO__);
      WIN.__HHA_COACH_TO__ = setTimeout(()=>{
        cardA.classList.remove('show');
        cardA.setAttribute('aria-hidden','true');
      }, 2200);
    }
    return;
  }
  if(msgB){
    msgB.textContent = String(msg || '');
    return;
  }
  // fallback
  console.log('[PlateVR coach]', msg);
}

function openEndOverlay(open){
  // Layout A: endOverlay aria-hidden
  const ovA = q('endOverlay');
  if(ovA){
    ovA.setAttribute('aria-hidden', open ? 'false' : 'true');
  }

  // Layout B: resultBackdrop display grid/none
  const ovB = q('resultBackdrop');
  if(ovB){
    ovB.style.display = open ? 'grid' : 'none';
  }
}

function detectMount(){
  // Both layouts use id="plate-layer"
  const mount = q('plate-layer');
  return mount;
}

function ensureMountReady(mount){
  if(!mount) return { ok:false, reason:'mount-missing' };

  // Wait for layout to settle
  const r = mount.getBoundingClientRect();
  if(r.width < 40 || r.height < 40){
    return { ok:false, reason:`mount-zero-size (${Math.round(r.width)}x${Math.round(r.height)})` };
  }
  return { ok:true };
}

function wireHUD(){
  // ---- Layout A (minimal) ----
  const hudScore = q('hudScore');
  const hudTime  = q('hudTime');
  const hudCombo = q('hudCombo');

  const goalName = q('goalName');
  const goalSub  = q('goalSub');
  const goalNums = q('goalNums');
  const goalBar  = q('goalBar');

  const miniName = q('miniName');
  const miniSub  = q('miniSub');
  const miniNums = q('miniNums');
  const miniBar  = q('miniBar');

  const kScore = q('kScore');
  const kAcc   = q('kAcc');
  const kCombo = q('kCombo');
  const kGoals = q('kGoals');
  const kMini  = q('kMini');
  const kMiss  = q('kMiss');

  // ---- Layout B (full HUD) ----
  const uiScore = q('uiScore');
  const uiCombo = q('uiCombo');
  const uiComboMax = q('uiComboMax');
  const uiMiss  = q('uiMiss');
  const uiTime  = q('uiTime');
  const uiAcc   = q('uiAcc');

  const uiGoalTitle = q('uiGoalTitle');
  const uiGoalCount = q('uiGoalCount');
  const uiGoalFill  = q('uiGoalFill');

  const uiMiniTitle = q('uiMiniTitle');
  const uiMiniTime  = q('uiMiniTime');
  const uiMiniCount = q('uiMiniCount');
  const uiMiniFill  = q('uiMiniFill');

  // group counters (optional)
  const uiG1 = q('uiG1'), uiG2 = q('uiG2'), uiG3 = q('uiG3'), uiG4 = q('uiG4'), uiG5 = q('uiG5');

  // result B
  const rScore = q('rScore');
  const rMaxCombo = q('rMaxCombo');
  const rMiss = q('rMiss');
  const rGoals = q('rGoals');
  const rMinis = q('rMinis');
  const rPerfect = q('rPerfect');

  const rG1 = q('rG1'), rG2 = q('rG2'), rG3 = q('rG3'), rG4 = q('rG4'), rG5 = q('rG5'), rGTotal = q('rGTotal');

  // ---- listeners ----
  WIN.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    const score = d.score ?? d.scoreFinal ?? 0;
    const combo = d.combo ?? 0;
    const comboMax = d.comboMax ?? 0;
    const miss = d.miss ?? d.misses ?? 0;

    if(hudScore) hudScore.textContent = String(score);
    if(hudCombo) hudCombo.textContent = String(combo);

    if(uiScore) uiScore.textContent = String(score);
    if(uiCombo) uiCombo.textContent = String(combo);
    if(uiComboMax) uiComboMax.textContent = String(comboMax);
    if(uiMiss) uiMiss.textContent = String(miss);
  }, { passive:true });

  WIN.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    const v = String(Math.max(0, Math.ceil(Number(t)||0)));
    if(hudTime) hudTime.textContent = v;
    if(uiTime) uiTime.textContent = v;
  }, { passive:true });

  WIN.addEventListener('quest:update', (e)=>{
    const d = e.detail || {};
    if(d.goal){
      const g = d.goal;
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      const p = Math.round((cur/tar)*100);

      if(goalName) goalName.textContent = g.name || 'Goal';
      if(goalSub)  goalSub.textContent  = g.sub  || '';
      if(goalNums) goalNums.textContent = `${cur}/${tar}`;
      if(goalBar)  goalBar.style.width  = `${p}%`;

      if(uiGoalTitle) uiGoalTitle.textContent = g.name || '—';
      if(uiGoalCount) uiGoalCount.textContent = `${cur}/${tar}`;
      if(uiGoalFill)  uiGoalFill.style.width = `${p}%`;
    }
    if(d.mini){
      const m = d.mini;
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      const p = Math.round((cur/tar)*100);

      if(miniName) miniName.textContent = m.name || 'Mini Quest';
      if(miniSub)  miniSub.textContent  = m.sub  || '';
      if(miniNums) miniNums.textContent = `${cur}/${tar}`;
      if(miniBar)  miniBar.style.width  = `${p}%`;

      if(uiMiniTitle) uiMiniTitle.textContent = m.name || '—';
      if(uiMiniCount) uiMiniCount.textContent = `${cur}/${tar}`;
      if(uiMiniFill)  uiMiniFill.style.width = `${p}%`;
    }
  }, { passive:true });

  WIN.addEventListener('hha:coach', (e)=>{
    const d = e.detail || {};
    if(d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  }, { passive:true });

  WIN.addEventListener('hha:end', (e)=>{
    const d = e.detail || {};

    // Layout A end panel
    if(kScore) kScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if(kCombo) kCombo.textContent = String(d.comboMax ?? d.combo ?? 0);
    if(kMiss)  kMiss.textContent  = String(d.misses ?? d.miss ?? 0);
    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if(kAcc)   kAcc.textContent   = (acc==null) ? '—' : pct(acc);
    if(kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(kMini)  kMini.textContent  = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    // Layout B result
    if(rScore) rScore.textContent = String(d.scoreFinal ?? 0);
    if(rMaxCombo) rMaxCombo.textContent = String(d.comboMax ?? 0);
    if(rMiss) rMiss.textContent = String(d.misses ?? 0);
    if(rGoals) rGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if(rMinis) rMinis.textContent = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;
    if(rPerfect) rPerfect.textContent = `${Math.round(d.accuracyGoodPct ?? 0)}%`;

    if(uiAcc) uiAcc.textContent = `${Math.round(d.accuracyGoodPct ?? 0)}%`;

    const g1 = d.g1 ?? 0, g2 = d.g2 ?? 0, g3 = d.g3 ?? 0, g4 = d.g4 ?? 0, g5 = d.g5 ?? 0;
    if(uiG1) uiG1.textContent = String(g1);
    if(uiG2) uiG2.textContent = String(g2);
    if(uiG3) uiG3.textContent = String(g3);
    if(uiG4) uiG4.textContent = String(g4);
    if(uiG5) uiG5.textContent = String(g5);

    if(rG1) rG1.textContent = String(g1);
    if(rG2) rG2.textContent = String(g2);
    if(rG3) rG3.textContent = String(g3);
    if(rG4) rG4.textContent = String(g4);
    if(rG5) rG5.textContent = String(g5);
    if(rGTotal) rGTotal.textContent = String(g1+g2+g3+g4+g5);

    openEndOverlay(true);
  }, { passive:true });
}

function wireControls(){
  // Layout A
  const btnRestartA = q('btnRestart');
  const btnBackHubA = q('btnBackHub');

  // Layout B
  const btnPlayAgainB = q('btnPlayAgain');
  const btnBackHubB   = q('btnBackHub');

  const hub = qs('hub','') || '';

  const doRestart = ()=> location.reload();
  const doBackHub = ()=>{
    if(hub) location.href = hub;
    else history.back();
  };

  if(btnRestartA) btnRestartA.addEventListener('click', doRestart);
  if(btnPlayAgainB) btnPlayAgainB.addEventListener('click', doRestart);

  if(btnBackHubA)