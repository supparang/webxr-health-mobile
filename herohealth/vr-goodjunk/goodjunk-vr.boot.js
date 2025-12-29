// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard + VR button
// Params:
//  - diff=easy|normal|hard
//  - time=80
//  - run=play|research
//  - end=time|all
//  - challenge=rush|boss|survival
//  - hub=../hub.html
//  - seed=...
//  - sessionId=...
//  - log=<GAS_WEBAPP_URL>

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

function setupVRButton(){
  const btn = document.getElementById('btnEnterVR');
  const scene = document.getElementById('gj-xr'); // a-scene
  if (!btn) return;

  // if no scene, disable
  if (!scene || typeof scene.enterVR !== 'function'){
    btn.disabled = true;
    btn.textContent = 'VR ไม่พร้อม';
    return;
  }

  // enter/exit events
  scene.addEventListener('enter-vr', () => {
    document.body.classList.add('is-vr');
  });
  scene.addEventListener('exit-vr', () => {
    document.body.classList.remove('is-vr');
  });

  btn.addEventListener('click', async () => {
    try{
      // Some browsers require user gesture; this is a gesture.
      scene.enterVR();
    }catch(_){}
  });
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

  setupVRButton();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}`);

  // base feel
  const baseAimY = 0.62;

  // touch/gyro -> world shift (moves ONLY layer)
  const touch = attachTouchLook({
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    aimY: baseAimY,
    maxShiftPx: 170,
    ease: 0.12
  });

  // If user enters VR, reduce shift + lift aim feel
  const scene = document.getElementById('gj-xr');
  if (scene){
    scene.addEventListener('enter-vr', () => {
      // VR: less translation (avoid nausea)
      try{
        touch.setShift(0, 0);
      }catch(_){}
    });
  }

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  // Decide runtime aim + margins (VR vs normal)
  const isVRNow = document.body.classList.contains('is-vr');

  // In VR, crosshair is lifted by CSS; we also bias spawn to that aimY
  const aimY = isVRNow ? 0.54 : 0.58; // game-feel aim (spawn bias), not crosshair css

  const safeMargins = isVRNow
    ? { top: 112, bottom: 140, left: 24, right: 24 }
    : { top: 128, bottom: 170, left: 26, right: 26 };

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
    safeMargins,
    aimY
  });
})();