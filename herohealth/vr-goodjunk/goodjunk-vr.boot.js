// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard
// ✅ Fix: touch-look-goodjunk.js must export attachTouchLook
// ✅ Start overlay user-gesture: requestFullscreen + screen.orientation.lock('landscape') when view=vr|cvr
// ✅ Rotate hint overlay if lock not supported
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
//  - view=pc|mobile|vr|cvr

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

// ---------- VR landscape helpers ----------
async function tryLockLandscape(){
  // Must be called from user-gesture
  // 1) Fullscreen (helps on some Android)
  try{
    const el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement){
      await el.requestFullscreen();
    }
  }catch(_){}

  // 2) Screen orientation lock
  try{
    const ori = window.screen && window.screen.orientation;
    if (ori && ori.lock){
      await ori.lock('landscape');
      return true;
    }
  }catch(_){}
  return false;
}

function showRotateHint(show){
  let el = document.getElementById('rotateHint');
  if (!el){
    el = document.createElement('div');
    el.id = 'rotateHint';
    el.className = 'rotate-hint';
    el.innerHTML = `<div class="rotate-card">
      <div class="rt-title">หมุนเป็นแนวนอน</div>
      <div class="rt-sub">โหมด VR แนะนำให้เล่นแนวนอนเพื่อมุมมองเต็มจอ</div>
    </div>`;
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

function isLandscape(){
  try{
    return window.matchMedia && window.matchMedia('(orientation: landscape)').matches;
  }catch(_){}
  // fallback
  return (window.innerWidth || 0) > (window.innerHeight || 0);
}

function applyViewClass(view){
  const v = String(view || '').toLowerCase();
  document.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  if (v === 'vr') document.body.classList.add('view-vr');
  else if (v === 'cvr') document.body.classList.add('view-cvr');
  else if (v === 'mobile') document.body.classList.add('view-mobile');
  else document.body.classList.add('view-pc');
  return v || 'pc';
}

function showStartOverlay(metaText, view){
  const overlay = document.getElementById('startOverlay');
  const btn = document.getElementById('btnStart');
  const meta = document.getElementById('startMeta');
  if (meta) meta.textContent = metaText || '—';
  if (!overlay || !btn) return Promise.resolve();

  overlay.style.display = 'flex';

  return new Promise((resolve) => {
    btn.onclick = async () => {
      overlay.style.display = 'none';

      // unlock audio (if any module listens)
      try{ window.dispatchEvent(new CustomEvent('hha:unlock_audio', { detail:{ source:'start' } })); }catch(_){}

      // If VR view: attempt lock landscape
      const v = String(view || '').toLowerCase();
      if (v === 'vr' || v === 'cvr'){
        const ok = await tryLockLandscape();
        if (!ok){
          // show rotate hint until landscape detected
          showRotateHint(!isLandscape());
          const onCheck = ()=>{
            if (isLandscape()){
              showRotateHint(false);
              window.removeEventListener('resize', onCheck);
              window.removeEventListener('orientationchange', onCheck);
            }
          };
          window.addEventListener('resize', onCheck, { passive:true });
          window.addEventListener('orientationchange', onCheck, { passive:true });
        } else {
          showRotateHint(false);
        }
      }

      resolve();
    };
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
  const view = applyViewClass(qp('view', 'pc'));

  const ctx = buildContext();
  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  // attach touch/gyro look -> world shift (feel like VR)
  attachTouchLook({
    crosshairEl: document.getElementById('gj-crosshair'),
    layerEl: document.getElementById('gj-layer'),
    aimY: (view === 'vr' || view === 'cvr') ? 0.52 : 0.62, // ✅ VR: aim สูงขึ้นนิด
    maxShiftPx: (view === 'vr' || view === 'cvr') ? 210 : 170,
    ease: 0.12
  });

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • view=${view}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText, view);

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

    // ✅ VR: กันเป้าต่ำเกิน + กันไปชน HUD
    safeMargins: (view === 'vr' || view === 'cvr')
      ? { top: 70, bottom: 120, left: 22, right: 22 }
      : { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();