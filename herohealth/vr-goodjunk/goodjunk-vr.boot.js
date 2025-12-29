// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard + view switch (pc/mobile/vr)
// ✅ unlock audio on start (mobile friendly)

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

function setParamAndReload(key, val){
  try{
    const u = new URL(location.href);
    if (val == null) u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
    location.href = u.toString();
  }catch(_){}
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
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-29c';
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
      // ✅ unlock audio while still in user gesture chain
      try{ window.dispatchEvent(new CustomEvent('hha:unlock_audio', { detail:{ source:'start' } })); }catch(_){}
      resolve();
    };
  });
}

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;

  const ml = document.getElementById('vrMetaL');
  const mr = document.getElementById('vrMetaR');
  if (ml) ml.textContent = text;
  if (mr) mr.textContent = text;
}

function applyView(view){
  view = String(view||'pc').toLowerCase();
  document.body.classList.remove('view-pc','view-mobile','view-vr');
  document.body.classList.add(view === 'vr' ? 'view-vr' : (view === 'mobile' ? 'view-mobile' : 'view-pc'));
}

function bindViewButtons(){
  const bPC = document.getElementById('btnViewPC');
  const bM  = document.getElementById('btnViewMobile');
  const bV  = document.getElementById('btnViewVR');
  if (bPC) bPC.onclick = ()=> setParamAndReload('view','pc');
  if (bM)  bM.onclick  = ()=> setParamAndReload('view','mobile');
  if (bV)  bV.onclick  = ()=> setParamAndReload('view','vr');
}

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const view = toStr(qp('view', null), '').toLowerCase()
    || ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 'mobile' : 'pc');

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);
  const ctx = buildContext();

  applyView(view);
  bindViewButtons();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  attachTouchLook({
    stageEl: document.getElementById('gj-stage'),
    aimY: (view === 'vr') ? 0.50 : 0.52,
    maxShiftPx: (view === 'vr') ? 120 : 170,
    ease: 0.12
  });

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • view=${view}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    view,
    seed,
    sessionId,
    context: ctx,

    layerEl: document.getElementById('gj-layer'),
    crosshairEl: document.getElementById('gj-crosshair'),

    layerElL: document.getElementById('gj-layer-l'),
    layerElR: document.getElementById('gj-layer-r'),
    crosshairElL: document.getElementById('gj-crosshair-l'),
    crosshairElR: document.getElementById('gj-crosshair-r'),

    shootEl: document.getElementById('btnShoot'),

    safeMargins: { top: 120, bottom: 170, left: 22, right: 22 }
  });
})();