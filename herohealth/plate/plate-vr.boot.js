// === /herohealth/plate/plate.boot.js ===
// PlateVR Boot — PRODUCTION (HHA Standard)
// ✅ Auto view detect (no UI override)
// ✅ Wires HUD listeners:
//    hha:score, hha:time, quest:update, hha:coach, hha:end
// ✅ End overlay + back hub + restart
// ✅ Pass-through research params
// ✅ Works with: plate-vr.html (C1) + plate-vr.css (B1) + plate.safe.js

import { boot as engineBoot } from './plate.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, def = null) => {
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
};

function isMobile() {
  const ua = navigator.userAgent || '';
  const touch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
  return /Android|iPhone|iPad|iPod/i.test(ua) || (touch && innerWidth < 920);
}

function getViewAuto() {
  // Allow caller/system to force view by query (experiments), but not via menu.
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
function pctInt(n) {
  n = Number(n) || 0;
  return `${Math.round(n)}%`;
}

function setOverlayOpen(open) {
  const ov = DOC.getElementById('endOverlay');
  if (!ov) return;
  ov.setAttribute('aria-hidden', open ? 'false' : 'true');
}

function setText(id, val) {
  const el = DOC.getElementById(id);
  if (el) el.textContent = String(val ?? '');
}

function setWidth(id, pct) {
  const el = DOC.getElementById(id);
  if (!el) return;
  const p = clamp(pct, 0, 100);
  el.style.width = `${p}%`;
}

function showCoach(msg, tag = 'Coach') {
  const msgEl = DOC.getElementById('coachMsg');
  const tagEl = DOC.getElementById('coachTag');
  if (msgEl) msgEl.textContent = String(msg || '');
  if (tagEl) tagEl.textContent = String(tag || 'Coach');
}

function wireHUD() {
  // score/combo/miss/time/acc
  WIN.addEventListener('hha:score', (e) => {
    const d = e?.detail || {};
    setText('hudScore', d.score ?? d.value ?? 0);
    setText('hudCombo', d.combo ?? d.comboNow ?? 0);
    // (miss ไม่อยู่ใน event นี้ ปล่อยให้ engine ยิงเพิ่มได้ หรืออัปเดตตอน end)
  }, { passive: true });

  WIN.addEventListener('hha:time', (e) => {
    const d = e?.detail || {};
    const t = (d.leftSec ?? d.timeLeftSec ?? d.value ?? 0);
    setText('hudTime', Math.max(0, Math.ceil(Number(t) || 0)));
  }, { passive: true });

  // quest update
  WIN.addEventListener('quest:update', (e) => {
    const d = e?.detail || {};
    if (d.goal) {
      const g = d.goal;
      setText('goalName', g.name || 'Goal');
      setText('goalSub', g.sub || '');
      const cur = clamp(g.cur ?? 0, 0, 9999);
      const tar = clamp(g.target ?? 1, 1, 9999);
      setText('goalNums', `${cur}/${tar}`);
      setWidth('goalBar', Math.round((cur / tar) * 100));
    }
    if (d.mini) {
      const m = d.mini;
      setText('miniName', m.name || 'Mini');
      setText('miniSub', m.sub || '');
      const cur = clamp(m.cur ?? 0, 0, 9999);
      const tar = clamp(m.target ?? 1, 1, 9999);
      setText('miniNums', `${cur}/${tar}`);
      setWidth('miniBar', Math.round((cur / tar) * 100));
    }
  }, { passive: true });

  // coach
  WIN.addEventListener('hha:coach', (e) => {
    const d = e?.detail || {};
    if (!d) return;
    if (d.msg || d.text) showCoach(d.msg || d.text, d.tag || 'Coach');
  }, { passive: true });

  // (optional) engine อาจยิง event เพิ่มเองภายหลัง:
  // hha:plate => {g1..g5}
  WIN.addEventListener('hha:plate', (e) => {
    const d = e?.detail || {};
    if (d.g1 != null) setText('uiG1', d.g1);
    if (d.g2 != null) setText('uiG2', d.g2);
    if (d.g3 != null) setText('uiG3', d.g3);
    if (d.g4 != null) setText('uiG4', d.g4);
    if (d.g5 != null) setText('uiG5', d.g5);
  }, { passive: true });

  // (optional) accuracy update event
  WIN.addEventListener('hha:acc', (e) => {
    const d = e?.detail || {};
    const acc = (d.accuracyPct ?? d.accPct ?? null);
    if (acc != null) setText('hudAcc', pctInt(acc));
  }, { passive: true });

  // (optional) miss update event
  WIN.addEventListener('hha:miss', (e) => {
    const d = e?.detail || {};
    const m = (d.miss ?? d.misses ?? d.value ?? null);
    if (m != null) setText('hudMiss', m);
  }, { passive: true });

  // (optional) fever update event
  WIN.addEventListener('hha:fever', (e) => {
    const d = e?.detail || {};
    const p = (d.pct ?? d.value ?? null);
    if (p != null) setWidth('uiFeverFill', p);
  }, { passive: true });
}

function wireEndControls() {
  const btnRestart = DOC.getElementById('btnRestart');
  const btnBackHub = DOC.getElementById('btnBackHub');
  const hub = (qs('hub', '') || '').trim();

  btnRestart?.addEventListener('click', () => location.reload(), { passive: true });

  btnBackHub?.addEventListener('click', () => {
    if (hub) location.href = hub;
    else history.back();
  }, { passive: true });
}

function wireEndSummary() {
  WIN.addEventListener('hha:end', (e) => {
    const d = e?.detail || {};

    setText('kScore', d.scoreFinal ?? d.score ?? 0);
    setText('kCombo', d.comboMax ?? d.combo ?? 0);
    setText('kMiss', d.misses ?? d.miss ?? 0);

    const acc = (d.accuracyGoodPct ?? d.accuracyPct ?? null);
    setText('kAcc', (acc == null) ? '—' : `${Math.round(Number(acc) || 0)}%`);

    setText('kGoals', `${d.goalsCleared ?? 0}/${d.goalsTotal ?? 0}`);
    setText('kMini', `${d.miniCleared ?? 0}/${d.miniTotal ?? 0}`);

    // update top HUD too (ensure final)
    setText('hudMiss', d.misses ?? d.miss ?? 0);
    if (d.g1 != null) setText('uiG1', d.g1);
    if (d.g2 != null) setText('uiG2', d.g2);
    if (d.g3 != null) setText('uiG3', d.g3);
    if (d.g4 != null) setText('uiG4', d.g4);
    if (d.g5 != null) setText('uiG5', d.g5);

    setOverlayOpen(true);
  }, { passive: true });
}

function buildEngineConfig() {
  const view = getViewAuto();
  const run = (qs('run', 'play') || 'play').toLowerCase();
  const diff = (qs('diff', 'normal') || 'normal').toLowerCase();

  // time in seconds (default 90 for Plate — เหมาะกับเด็ก ป.5 แบบ “มีเวลาเรียนรู้ + ยังตื่นเต้น”)
  const time = clamp(qs('time', '90'), 10, 999);
  const seed = Number(qs('seed', Date.now())) || Date.now();

  return {
    view,
    runMode: run,
    diff,
    durationPlannedSec: Number(time),
    seed: Number(seed),

    // passthrough
    hub: qs('hub', '') || '',
    logEndpoint: qs('log', '') || '',

    // optional research context
    studyId: qs('studyId', qs('study', '')) || '',
    phase: qs('phase', '') || '',
    conditionGroup: qs('conditionGroup', qs('cond', '')) || '',
    sessionOrder: qs('sessionOrder', qs('order', '')) || '',
    blockLabel: qs('blockLabel', qs('block', '')) || '',
    siteCode: qs('siteCode', qs('site', '')) || '',
    sy: qs('sy', '') || '',
    sem: qs('sem', '') || '',
    sid: qs('sid', '') || ''
  };
}

function ready(fn) {
  if (DOC.readyState === 'complete' || DOC.readyState === 'interactive') fn();
  else DOC.addEventListener('DOMContentLoaded', fn, { once: true });
}

ready(() => {
  const mount = DOC.getElementById('plate-layer');
  if (!mount) {
    console.error('[PlateVR] missing #plate-layer');
    return;
  }

  const cfg = buildEngineConfig();

  // set view class
  setBodyView(cfg.view);

  // close overlay at start
  setOverlayOpen(false);

  // wire UI
  wireHUD();
  wireEndControls();
  wireEndSummary();

  // boot engine
  try {
    engineBoot({ mount, cfg });
  } catch (err) {
    console.error('[PlateVR] boot error', err);
    showCoach('เกิดข้อผิดพลาดตอนเริ่มเกม', 'System');
  }
});