// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// Boot — VR-safe layout + dynamic safeMargins + mini HUD

'use strict';

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

const DOC = document;

function qp(name, fallback = null){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return (v == null || v === '') ? fallback : v;
  }catch(_){ return fallback; }
}
function toInt(v, d){ v = Number(v); return Number.isFinite(v) ? (v|0) : d; }
function toStr(v, d){ v = String(v ?? '').trim(); return v ? v : d; }

function isLandscape(){
  return (innerWidth || 0) > (innerHeight || 0);
}

function computeSafeMargins({ view }){
  // Portrait (mobile): กัน HUD+Fever+ปุ่มยิง
  // Landscape/VR: ลด margin ลงให้เป้ากลับมากลางจอ
  const land = isLandscape();
  const isVr = (view === 'cardboard') || land;

  if (isVr){
    return { top: 56, bottom: 56, left: 22, right: 22 };
  }
  return { top: 128, bottom: 170, left: 26, right: 26 };
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
  const overlay = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');
  const btnVr = DOC.getElementById('btnStartVr');
  const meta = DOC.getElementById('startMeta');

  if (meta) meta.textContent = metaText || '—';
  if (!overlay || !btn) return Promise.resolve('mobile');

  overlay.style.display = 'flex';
  return new Promise((resolve) => {
    btn.onclick = () => { overlay.style.display = 'none'; resolve('mobile'); };
    if (btnVr){
      btnVr.onclick = () => { overlay.style.display = 'none'; resolve('cardboard'); };
    }
  });
}

function setHudMeta(text){
  const el = DOC.getElementById('hudMeta');
  if (el) el.textContent = text;
}

function setBodyView(view){
  DOC.body.classList.toggle('view-cardboard', view === 'cardboard');
}

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();
  const viewIn = toStr(qp('view', 'mobile'), 'mobile').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);
  const ctx = buildContext();

  // view: mobile|cardboard
  let view = (viewIn === 'cardboard') ? 'cardboard' : 'mobile';
  setBodyView(view);

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  // touch/gyro shift + aim point
  const aimY = (view === 'cardboard' || isLandscape()) ? 0.50 : 0.62;

  attachTouchLook({
    crosshairEl: DOC.getElementById('gj-crosshair'),
    layerEl: DOC.getElementById('gj-layer'),
    aimY,
    maxShiftPx: (view === 'cardboard' || isLandscape()) ? 130 : 170,
    ease: 0.12
  });

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • view=${view}`
    + (seed ? ` • seed=${seed}` : '');

  // overlay choose (mobile/cardboard)
  const chosen = await showStartOverlay(metaText);
  if (chosen === 'cardboard') view = 'cardboard';
  setBodyView(view);

  const safeMargins = computeSafeMargins({ view });

  // boot engine
  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    view,
    context: ctx,
    layerEl: DOC.getElementById('gj-layer'),
    // (ถ้ายังไม่ใช้ stereo layers จริง ก็ปล่อยไว้ได้)
    shootEl: DOC.getElementById('btnShoot'),
    safeMargins
  });

  // HUD buttons
  const btnHub = DOC.getElementById('btnHub');
  if (btnHub){
    btnHub.onclick = async () => {
      try{
        if (window.GoodJunkVR && typeof window.GoodJunkVR.endGame === 'function'){
          await window.GoodJunkVR.endGame('hub');
        }
      }catch(_){}
      const hub = qp('hub', '');
      if (hub) location.href = hub;
    };
  }

  const btnVr = DOC.getElementById('btnVr');
  if (btnVr){
    btnVr.onclick = () => {
      const u = new URL(location.href);
      const cur = (u.searchParams.get('view') || 'mobile').toLowerCase();
      u.searchParams.set('view', cur === 'cardboard' ? 'mobile' : 'cardboard');
      location.href = u.toString();
    };
  }
})();