// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (PRODUCTION)
// ✅ attachTouchLook AFTER Start click (iOS gyro permission works)
// ✅ set body data-view = pc|mobile|cardboard
// ✅ keep params stable for logger & hub return

'use strict';

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

function qp(name, fallback = null){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return (v == null || v === '') ? fallback : v;
  }catch(_){ return fallback; }
}

function toInt(v, d){ v = Number(v); return Number.isFinite(v) ? (v|0) : d; }
function toStr(v, d){ v = String(v ?? '').trim(); return v ? v : d; }

function isMobileLike(){
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function detectView(){
  const v = toStr(qp('view', ''), '').toLowerCase();
  if (v === 'cardboard' || v === 'vr') return 'cardboard';
  if (v === 'mobile') return 'mobile';
  if (v === 'pc' || v === 'desktop') return 'pc';
  return isMobileLike() ? 'mobile' : 'pc';
}

function buildContext(){
  const keys = [
    'projectTag','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
    'schoolYear','semester','studentKey','schoolCode','schoolName','classRoom','studentNo',
    'nickName','gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
    'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
    'gameVersion'
  ];
  const ctx = {};
  for (const k of keys){
    const v = qp(k, null);
    if (v != null) ctx[k] = v;
  }
  ctx.projectTag = ctx.projectTag || 'GoodJunkVR';
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-29';
  return ctx;
}

function showStartOverlay(metaText){
  const overlay = document.getElementById('startOverlay');
  const btn = document.getElementById('btnStart');
  const meta = document.getElementById('startMeta');
  if (meta) meta.textContent = metaText || '—';
  if (!overlay || !btn) return Promise.resolve();

  overlay.style.display = 'flex';
  return new Promise((resolve) => {
    btn.onclick = () => {
      overlay.style.display = 'none';
      resolve();
    };
  });
}

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;
}

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);

  const hub = qp('hub', null);

  const view = detectView();
  document.body.dataset.view = view; // css: body[data-view="mobile"], etc.

  const ctx = buildContext();
  if (hub) ctx.hub = hub;

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • view=${view}`
    + (seed ? ` • seed=${seed}` : '');

  // ✅ start overlay first (so click is a user gesture)
  await showStartOverlay(metaText);

  // ✅ attach touch/gyro AFTER start (iOS permission possible)
  attachTouchLook({
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    aimY: 0.62,
    maxShiftPx: (view === 'cardboard') ? 210 : 170,
    ease: 0.12
  });

  // boot engine
  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    context: ctx,
    layerEl: document.getElementById('gj-layer'),
    shootEl: document.getElementById('btnShoot'),
    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();