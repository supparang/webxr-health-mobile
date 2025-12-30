// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (DUAL-EYE READY)

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
  const w = window.innerWidth || 360;
  const h = window.innerHeight || 640;
  const coarse = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
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
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-30.dual';
  return ctx;
}

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;
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

function showVrHintIfNeeded(){
  const hint = document.getElementById('vrHint');
  const ok = document.getElementById('btnVrOk');
  if (!hint || !ok) return Promise.resolve();

  // show only when portrait on mobile-ish
  const portrait = (window.matchMedia && window.matchMedia('(orientation: portrait)').matches);
  if (!(portrait && isMobileLike())) return Promise.resolve();

  hint.hidden = false;
  return new Promise((resolve) => {
    ok.onclick = () => {
      hint.hidden = true;
      resolve();
    };
  });
}

function setView(mode){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(`view-${mode}`);

  // aria for right eye
  const eyeR = document.getElementById('eyeR');
  if (eyeR){
    eyeR.setAttribute('aria-hidden', (mode === 'pc' || mode === 'mobile') ? 'true' : 'false');
  }
}

function wireViewButtons(){
  const btnPC = document.getElementById('btnViewPC');
  const btnM  = document.getElementById('btnViewMobile');
  const btnVR = document.getElementById('btnViewVR');
  const btnCVR= document.getElementById('btnViewCVR');
  const btnFS = document.getElementById('btnEnterFS');
  const btnEnterVR = document.getElementById('btnEnterVR');

  const applyMode = async (m) => {
    setView(m);
    // in VR/cVR, suggest landscape
    if (m === 'vr' || m === 'cvr') await showVrHintIfNeeded();
  };

  if (btnPC) btnPC.onclick = ()=> applyMode('pc');
  if (btnM)  btnM.onclick  = ()=> applyMode('mobile');
  if (btnVR) btnVR.onclick = ()=> applyMode('vr');
  if (btnCVR)btnCVR.onclick= ()=> applyMode('cvr');

  if (btnFS){
    btnFS.onclick = async ()=>{
      try{
        const el = document.documentElement;
        if (!document.fullscreenElement){
          await el.requestFullscreen?.();
        }
      }catch(_){}
    };
  }

  // "Enter VR" button: on mobile -> cVR, on PC -> VR
  if (btnEnterVR){
    btnEnterVR.onclick = async ()=>{
      const m = isMobileLike() ? 'cvr' : 'vr';
      await applyMode(m);
      // also try fullscreen for stability
      try{
        const el = document.documentElement;
        if (!document.fullscreenElement){
          await el.requestFullscreen?.();
        }
      }catch(_){}
    };
  }
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

  // initial view
  wireViewButtons();
  const initial = qp('view', null);
  if (initial === 'vr' || initial === 'cvr' || initial === 'pc' || initial === 'mobile'){
    setView(initial);
  } else {
    setView(isMobileLike() ? 'mobile' : 'pc');
  }

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}`);

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}` + (seed ? ` • seed=${seed}` : '');
  await showStartOverlay(metaText);

  // if user switched to VR/cVR before starting, show hint
  if (document.body.classList.contains('view-vr') || document.body.classList.contains('view-cvr')){
    await showVrHintIfNeeded();
  }

  // --- elements (dual-eye aware) ---
  const stageEl = document.getElementById('gj-stage');

  const layerL = document.getElementById('gj-layer-l') || document.getElementById('gj-layer') || document.getElementById('gj-layer-l');
  const layerR = document.getElementById('gj-layer-r') || null;

  const crossL = document.getElementById('gj-crosshair-l') || document.getElementById('gj-crosshair') || null;
  const crossR = document.getElementById('gj-crosshair-r') || null;

  const ringL = document.getElementById('atk-ring-l') || document.getElementById('atk-ring') || null;
  const ringR = document.getElementById('atk-ring-r') || null;
  const laserL= document.getElementById('atk-laser-l') || document.getElementById('atk-laser') || null;
  const laserR= document.getElementById('atk-laser-r') || null;

  // touch/gyro look (shift play layers)
  const look = attachTouchLook({
    stageEl,
    layerEls: [layerL, layerR],
    hazardEls: [ringL, ringR, laserL, laserR].filter(Boolean),
    maxShiftPx: 170,
    ease: 0.12
  });

  // on iOS: enable gyro after user gesture (we already had one: Start)
  try{ await look.enableGyro?.(); }catch(_){}

  // boot engine (IMPORTANT: pass BOTH layers)
  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    context: ctx,

    // ✅ dual layers/crosshairs
    layerEl: layerL,
    layerElR: layerR,
    crosshairEl: crossL,
    crosshairElR: crossR,

    ringEl: ringL,
    ringElR: ringR,
    laserEl: laserL,
    laserElR: laserR,

    shootEl: document.getElementById('btnShoot'),

    // safe margins tuned for HUD+controls
    safeMargins: { top: 128, bottom: 170, left: 18, right: 18 }
  });
})();