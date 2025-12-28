// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (layout-aware)
// ✅ FIX: attachTouchLook export + hostEl (gj-stage) for drag
// ✅ Auto layout: pc | mobile | vr (optional ?view=vr)
// ✅ safeMargins tuned by layout/orientation

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
function isLandscape(){
  return (innerWidth || 0) > (innerHeight || 0);
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
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-28';
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

function detectView(){
  const v = toStr(qp('view', ''), '').toLowerCase(); // pc|mobile|vr
  if (v === 'pc' || v === 'mobile' || v === 'vr') return v;
  // auto
  return isMobileLike() ? 'mobile' : 'pc';
}

function computeSafeMargins(view){
  // defaults
  let m = { top: 128, bottom: 170, left: 26, right: 26 };

  if (view === 'mobile'){
    m = { top: 118, bottom: 162, left: 20, right: 20 };
    if (isLandscape()) m = { top: 88, bottom: 120, left: 16, right: 16 };
  }

  if (view === 'vr'){
    // cardboard-feel: maximize play area
    m = { top: 78, bottom: 96, left: 14, right: 14 };
    if (isLandscape()) m = { top: 68, bottom: 86, left: 12, right: 12 };
  }

  if (view === 'pc'){
    if (isLandscape() && (innerHeight||0) < 520) m = { top: 96, bottom: 130, left: 22, right: 22 };
  }

  return m;
}

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);

  const view = detectView();
  document.body.dataset.view = view;
  const safeMargins = computeSafeMargins(view);

  const ctx = buildContext();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • ${view}`);

  // attach touch/gyro -> world shift
  attachTouchLook({
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    hostEl: document.getElementById('gj-stage'), // ✅ สำคัญ (layer pointer-events:none)
    aimY: 0.62,
    maxShiftPx: (view === 'vr') ? 140 : 170,
    ease: 0.12,
    dragOnly: true,
    gyro: (view === 'vr' || view === 'mobile')
  });

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • ${view}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

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
    safeMargins
  });
})();