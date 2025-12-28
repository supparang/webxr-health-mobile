// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (PRODUCTION)

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

function detectView(){
  const v = (qp('view','')||'').toLowerCase();
  if (v) return v;

  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const isCardboard = (qp('vr','') === '1') || (qp('cardboard','') === '1');
  if (isCardboard) return 'cardboard';
  return isMobile ? 'mobile' : 'pc';
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

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);
  const hub = toStr(qp('hub', '../hub.html'), '../hub.html');

  const view = detectView();
  const ctx = buildContext();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • ${view}`);

  // ✅ attach touch/drag -> world shift (does not block clicking targets)
  attachTouchLook({
    layerEl: document.getElementById('gj-layer'),
    ringEl: document.getElementById('atk-ring'),
    laserEl: document.getElementById('atk-laser'),
    aimY: 0.62,
    maxShiftPx: (view === 'mobile') ? 190 : 170,
    ease: 0.12,
    gyro: false, // ปิดเพื่อกันโลกไหลเอง (อยากเปิดค่อยใส่ gyro=true)
    drag: true
  });

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • ${view}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  // boot engine
  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    hub,
    view,
    context: ctx,
    layerEl: document.getElementById('gj-layer'),
    shootEl: document.getElementById('btnShoot'),
    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();