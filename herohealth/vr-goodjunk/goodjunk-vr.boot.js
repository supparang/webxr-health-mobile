// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION
// ✅ Auto view detect (no UI override menu)
// ✅ Loads engine from ./goodjunk.safe.js
// ✅ Wires HUD listeners: hha:score, hha:time, quest:update, hha:coach, hha:judge, hha:end
// ✅ End overlay uses aria-hidden only
// ✅ Back HUB + Restart
// ✅ Pass-through research context params: run/diff/time/seed/studyId/... etc.

import { boot as engineBoot } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isMobile() {
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || navigator.maxTouchPoints > 0;
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto() {
  // Do not offer UI override.
  // Allow forced by query (?view=pc|mobile|vr|cvr) if caller sets it.
  const forced = (qs('view', '') || '').toLowerCase();
  if (forced) return forced;
  return isMobile() ? 'mobile' : 'pc';
}

function setBodyView(view) {
  const b = DOC.body;
  b.classList.remove('view-pc', 'view-mobile', 'view-vr', 'view-cvr');
  if (view === 'cvr') b.classList.add('view-cvr');
  else if (view === 'vr') b.classList.add('view-vr');
  else if (view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');
}

function clamp(v, a, b) {
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}

function pct(n) {
  n = Number(n) || 0;
  return `${Math.round(n)}%`;
}

function setOverlayOpen(open) {
  const ov = DOC.getElementById('endOverlay');
  if (!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function showCoach(msg, meta = 'Coach') {
  const card = DOC.getElementById('coachCard');
  const mEl = DOC.getElementById('coachMsg');
  const metaEl = DOC.getElementById('coachMeta');
  if (!card || !mEl) return;

  mEl.textContent = String(msg || '');
  if (metaEl) metaEl.textContent = meta;
  card.classList.add('show');
  card.setAttribute('aria-hidden', 'false');

  clearTimeout(WIN.__HHA_COACH_TO__);
  WIN.__HHA_COACH_TO__ = setTimeout(() => {
    card.classList.remove('show');
    card.setAttribute('aria-hidden', 'true');
  }, 2200);
}

function wireHUD() {
  const hudScore = DOC.getElementById('hudScore');
  const hudTime = DOC.getElementById('hudTime');
  const hudCombo = DOC.getElementById('hudCombo');
  const hudMiss = DOC.getElementById('hudMiss');

  const hudFeverText = DOC.getElementById('hudFeverText');
  const uiFeverFill = DOC.getElementById('uiFeverFill');

  const hudStar = DOC.getElementById('hudStar');
  const hudShield = DOC.getElementById('hudShield');

  const goalName = DOC.getElementById('goalName');
  const goalSub = DOC.getElementById('goalSub');
  const goalNums = DOC.getElementById('goalNums');
  const goalBar = DOC.getElementById('goalBar');

  const miniName = DOC.getElementById('miniName');
  const miniSub = DOC.getElementById('miniSub');
  const miniNums = DOC.getElementById('miniNums');
  const miniBar = DOC.getElementById('miniBar');

  // score/combo
  WIN.addEventListener('hha:score', (e) => {
    const d = e.detail || {};
    if (hudScore) hudScore.textContent = String(d.score ?? d.value ?? d.scoreNow ?? 0);
    if (hudCombo) hudCombo.textContent = String(d.combo ?? d.comboNow ?? 0);

    // optional: miss/fever/power piggyback
    const miss = (d.miss ?? d.misses ?? null);
    if (miss != null && hudMiss) hudMiss.textContent = String(miss);

    const fever = (d.feverPct ?? d.fever ?? null);
    if (fever != null) {
      const fp = clamp(fever, 0, 100);
      if (hudFeverText) hudFeverText.textContent = pct(fp);
      if (uiFeverFill) uiFeverFill.style.width = `${Math.round(fp)}%`;
    }

    if (hudStar && d.star != null) hudStar.textContent = String(d.star);
    if (hudShield && d.shield != null) hudShield.textContent = String(d.shield);
  });

  // time
  WIN.addEventListener('hha:time', (e) => {
    const d = e.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    if (hudTime) hudTime.textContent = String(Math.max(0, Math.ceil(Number(t) || 0)));
  });

  // judge (goodjunk engines often report miss/fever/hit counts here)
  WIN.addEventListener('hha:judge', (e) => {
    const d = e.detail || {};
    const miss = (d.miss ?? d.misses ?? d.missNow ?? null);
    if (miss != null && hudMiss) hudMiss.textContent = String(miss);

    const fever = (d.feverPct ?? d.fever ?? d.feverNow ?? null);
    if (fever != null) {
      const fp = clamp(fever, 0, 100);
      if (hudFeverText) hudFeverText.textContent = pct(fp);
      if (uiFeverFill) uiFeverFill.style.width = `${Math.round(fp)}%`;
    }

    if (hudStar && d.star != null) hudStar.textContent = String(d.star);
    if (hudShield && d.shield != null) hudShield.textContent = String(d.shield);
  });

  // quest
  WIN.addEventListener('quest:update', (e) => {
    const d = e.detail || {};
    // Expected: { goal:{name,sub,cur,target}, mini:{name,sub,cur,target,done}, allDone }
    if (d.goal) {
      const g = d.goal;
      if (goalName) goalName.textContent = g.name || 'Goal';
      if (goalSub) goalSub.textContent = g.sub || '';
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      if (goalNums) goalNums.textContent = `${cur}/${tar}`;
      if (goalBar) goalBar.style.width = `${Math.round((cur / tar) * 100)}%`;
    }
    if (d.mini) {
      const m = d.mini;
      if (miniName) miniName.textContent = m.name || 'Mini Quest';
      if (miniSub) miniSub.textContent = m.sub || '';
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      if (miniNums) miniNums.textContent = `${cur}/${tar}`;
      if (miniBar) miniBar.style.width = `${Math.round((cur / tar) * 100)}%`;
    }
  });

  // coach
  WIN.addEventListener('hha:coach', (e) => {
    const d = e.detail || {};
    if (d && (d.msg || d.text)) showCoach(d.msg || d.text, d.tag || 'Coach');
  });
}

function wireEndControls() {
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = qs('hub', '') || '';

  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      location.reload(); // keep same query params
    });
  }
  if (btnBackHub) {
    btnBackHub.addEventListener('click', () => {
      if (hub) location.href = hub;
      else history.back();
    });
  }
}

function wireEndSummary() {
  const kScore = DOC.getElementById('kScore');
  const kAcc = DOC.getElementById('kAcc');
  const kCombo = DOC.getElementById('kCombo');
  const kGood = DOC.getElementById('kGood');
  const kJunk = DOC.getElementById('kJunk');
  const kMiss = DOC.getElementById('kMiss');
  const kGoals = DOC.getElementById('kGoals');
  const kMini = DOC.getElementById('kMini');

  WIN.addEventListener('hha:end', (e) => {
    const d = e.detail || {};

    if (kScore) kScore.textContent = String(d.scoreFinal ?? d.score ?? 0);
    if (kCombo) kCombo.textContent = String(d.comboMax ?? d.combo ?? 0);
    if (kMiss) kMiss.textContent = String(d.misses ?? d.miss ?? 0);

    // Good/Junk counts if provided
    if (kGood) kGood.textContent = String(d.hitGood ?? d.goodHit ?? d.good ?? 0);
    if (kJunk) kJunk.textContent = String(d.hitJunk ?? d.junkHit ?? d.junk ?? 0);

    // accuracy: prefer accuracyGoodPct
    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    if (kAcc) kAcc.textContent = (acc == null) ? '—' : pct(acc);

    if (kGoals) kGoals.textContent = `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`;
    if (kMini) kMini.textContent = `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`;

    setOverlayOpen(true);
  });
}

function buildEngineConfig() {
  const view = getViewAuto();
  const run = (qs('run', 'play') || 'play').toLowerCase();
  const diff = (qs('diff', 'normal') || 'normal').toLowerCase();
  const time = clamp(qs('time', '70'), 10, 999);
  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    hub: qs('hub', '') || '',
    logEndpoint: qs('log', '') || '',

    studyId: qs('studyId', '') || '',
    phase: qs('phase', '') || '',
    conditionGroup: qs('conditionGroup', '') || '',
    sessionOrder: qs('sessionOrder', '') || '',
    blockLabel: qs('blockLabel', '') || '',
    siteCode: qs('siteCode', '') || '',
    schoolCode: qs('schoolCode', '') || '',
    schoolName: qs('schoolName', '') || '',
    gradeLevel: qs('gradeLevel', '') || '',
    studentKey: qs('studentKey', '') || '',
  };
}

function ready(fn) {
  if (DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once: true });
}

ready(() => {
  const cfg = buildEngineConfig();

  // set view class
  setBodyView(cfg.view);

  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // ensure end overlay closed at start
  setOverlayOpen(false);

  // boot engine
  try {
    engineBoot({
      mount: DOC.getElementById('gj-layer'),
      cfg
    });
  } catch (err) {
    console.error('[GoodJunkVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
  }
});