// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard
// ✅ Fix import/export attachTouchLook
// ✅ Stereo/Cardboard: ?vr=cardboard OR ?stereo=1
// ✅ Adds body class gj-stereo + sets CSS vars for eye offset
// ✅ Boots touch-look then safe engine

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
    btn.onclick = async () => {
      overlay.style.display = 'none';
      resolve();
    };
  });
}

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;
}

function enableStereoIfRequested(){
  const vr = toStr(qp('vr', ''), '').toLowerCase();
  const stereo = toStr(qp('stereo', ''), '').toLowerCase();
  const isStereo = (vr === 'cardboard') || (stereo === '1') || (stereo === 'true');

  document.body.classList.toggle('gj-stereo', !!isStereo);

  // eye separation feel
  const root = document.documentElement;
  root.style.setProperty('--eyeOffset', isStereo ? '10px' : '0px');

  return isStereo;
}

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);

  const ctx = buildContext();
  const isStereo = enableStereoIfRequested();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}${isStereo ? ' • VR=cardboard' : ''}`);

  // attach touch/gyro -> CSS vars (stage shift)
  const touch = attachTouchLook({
    stageEl: document.getElementById('gj-stage'),
    aimY: 0.62,
    maxShiftPx: 170,
    ease: 0.12,
    enableGyro: true
  });

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '')
    + (isStereo ? ` • VR=cardboard` : '');

  await showStartOverlay(metaText);

  // (optional) iOS gyro permission after user gesture
  try{
    if (isStereo){
      await touch.requestGyroPermission?.();
    }
  }catch(_){}

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
    layerElR: document.getElementById('gj-layer-r'),
    crosshairEl: document.getElementById('gj-crosshair'),

    shootEl: document.getElementById('btnShoot'),

    // Keep away from HUD/fever/controls
    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();