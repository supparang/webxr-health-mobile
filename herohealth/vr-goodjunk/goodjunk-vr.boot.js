// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (UPDATED)
// ✅ sets view mode: ?view=pc|mobile|vr  (auto if missing)
// ✅ sets documentElement/body dataset.view for responsive CSS
// ✅ requests motion permission on iOS inside Start button gesture (optional)
// ✅ boots safe engine

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
  const forced = toStr(qp('view', ''), '').toLowerCase();
  if (forced === 'pc' || forced === 'mobile' || forced === 'vr') return forced;

  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches);
  const small = Math.min(innerWidth||360, innerHeight||640) < 520;
  return (coarse || small) ? 'mobile' : 'pc';
}

function setViewDataset(view){
  try{ document.documentElement.dataset.view = view; }catch(_){}
  try{ document.body.dataset.view = view; }catch(_){}
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

function showStartOverlay(metaText, onStartGesture){
  const overlay = document.getElementById('startOverlay');
  const btn = document.getElementById('btnStart');
  const meta = document.getElementById('startMeta');
  if (meta) meta.textContent = metaText || '—';
  if (!overlay || !btn) return Promise.resolve();

  overlay.style.display = 'flex';
  return new Promise((resolve) => {
    btn.onclick = async () => {
      try{ await onStartGesture?.(); }catch(_){}
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

  const view = detectView();
  setViewDataset(view);

  const ctx = buildContext();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • ${view}`);

  // prepare touch-look (drag works immediately; motion permission requested on Start)
  const tl = attachTouchLook({
    stageEl: document.getElementById('gj-stage'),
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    ringEl: document.getElementById('atk-ring'),
    laserEl: document.getElementById('atk-laser'),
    aimY: 0.62,
    maxShiftPx: (view === 'vr') ? 190 : 170,
    ease: 0.12,
    useMotion: false // ask permission on Start
  });

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • ${view}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText, async ()=>{
    // iOS motion permission needs gesture; only try if user wants VR-like mode or on mobile
    if (view === 'vr' || view === 'mobile'){
      await tl.requestMotionPermission();
    }
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