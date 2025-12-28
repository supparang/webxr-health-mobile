// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
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
  const v = toStr(qp('view','auto'),'auto').toLowerCase();
  if (v !== 'auto') return v;
  const isMobile = matchMedia('(pointer:coarse)').matches || innerWidth < 900;
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

/** clone eyeL -> eyeR for cardboard */
function enableCardboard(){
  const wrap = document.getElementById('gj-vrwrap');
  const eyeL = document.getElementById('eyeL');
  const eyeR = document.getElementById('eyeR');
  if (!wrap || !eyeL || !eyeR) return;

  // clone whole left eye content into right eye (remove duplicate ids)
  const clone = eyeL.cloneNode(true);
  clone.id = 'eyeRContent';
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  eyeR.innerHTML = '';
  eyeR.appendChild(clone);
}

(async function main(){
  const view = detectView();
  document.documentElement.dataset.view = view;

  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);
  const ctx = buildContext();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  if (view === 'cardboard'){
    enableCardboard();
  }

  // attach touch/gyro -> world shift
  attachTouchLook({
    view,
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    stageEl: document.getElementById('gj-stage'),
    aimY: 0.62,
    maxShiftPx: (view === 'mobile') ? 170 : 140,
    ease: 0.12
  });

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '')
    + ` • view=${view}`;

  await showStartOverlay(metaText);

  // safe margins ตามหน้าจอ (มือถือกันทับ quest/controls มากขึ้น)
  const safeMargins =
    (view === 'mobile')
      ? { top: 156, bottom: 230, left: 18, right: 18 }
      : (view === 'cardboard')
        ? { top: 140, bottom: 210, left: 18, right: 18 }
        : { top: 132, bottom: 190, left: 24, right: 24 };

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
    view
  });
})();