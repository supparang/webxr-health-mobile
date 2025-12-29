// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (PRODUCTION)
// ✅ Start overlay: 2D / VR(Cardboard Stereo)
// ✅ attaches touch+gyro look
// ✅ passes stereo flag into safe engine
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

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;
}

async function enterFullscreenBestEffort(){
  try{
    if (!document.fullscreenElement && document.documentElement.requestFullscreen){
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(()=>{});
    }
  }catch(_){}
  try{
    if (screen && screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape').catch(()=>{});
    }
  }catch(_){}
}

function showStartOverlay(metaText){
  const overlay = document.getElementById('startOverlay');
  const meta = document.getElementById('startMeta');
  const btn2D = document.getElementById('btnStart2D');
  const btnVR = document.getElementById('btnStartVR');

  if (meta) meta.textContent = metaText || '—';
  if (!overlay || !btn2D || !btnVR) return Promise.resolve({ stereo:false });

  overlay.style.display = 'flex';

  return new Promise((resolve)=>{
    btn2D.onclick = () => {
      overlay.style.display = 'none';
      resolve({ stereo:false });
    };
    btnVR.onclick = async () => {
      document.body.classList.add('gj-vr', 'gj-stereo-on');
      await enterFullscreenBestEffort();
      overlay.style.display = 'none';
      resolve({ stereo:true });
    };
  });
}

(function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);
  const hub = qp('hub', null);

  const ctx = buildContext();
  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}`);

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '');

  // touch/gyro look (attach once)
  const look = attachTouchLook({
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    stereo: false,
    // aim point default (2D)
    aimY: 0.62,
    maxShiftPx: 170,
    ease: 0.12
  });

  // start overlay decision (2D / VR stereo)
  showStartOverlay(metaText).then(({ stereo })=>{
    // upgrade look for stereo if needed
    if (stereo){
      // re-attach with stereo targets
      look?.destroy?.();
      attachTouchLook({
        stereo: true,
        eyeWrapL: document.getElementById('gj-eyeL'),
        eyeWrapR: document.getElementById('gj-eyeR'),
        aimY: 0.52,           // ✅ VR ยกขึ้น (แก้ “เป้าต่ำไป”)
        maxShiftPx: 150,
        parallaxPx: 12,
        ease: 0.10
      });
    }

    goodjunkBoot({
      diff,
      time,
      run,
      endPolicy,
      challenge,
      seed,
      sessionId,
      hub,
      context: ctx,

      stereo: !!stereo,

      layerEl: document.getElementById('gj-layer'),
      layerL: document.getElementById('gj-layerL'),
      layerR: document.getElementById('gj-layerR'),

      shootEl: document.getElementById('btnShoot'),
      safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
    });
  });
})();