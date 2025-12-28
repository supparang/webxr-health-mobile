// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard
// ✅ Stereo/Cardboard: ?vr=cardboard OR ?stereo=1
// ✅ VR Start overlay split (2 eyes) + VR HUD + Dual Shoot buttons
// ✅ Fix import/export attachTouchLook
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
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-28.stereo-ui';
  return ctx;
}

/* ---------------- VR UI helpers ---------------- */

function ensureStereoRightLayerExists(){
  const stage = document.getElementById('gj-stage');
  if (!stage) return;

  if (!document.getElementById('gj-layer-r')){
    const r = document.createElement('div');
    r.id = 'gj-layer-r';
    r.setAttribute('aria-hidden','true');
    stage.insertBefore(r, stage.firstChild?.nextSibling || stage.firstChild);
  }
  if (!document.getElementById('gj-crosshair-r')){
    const c = document.createElement('div');
    c.id = 'gj-crosshair-r';
    c.setAttribute('aria-hidden','true');
    stage.appendChild(c);
  }
}

function mountVrHudIfStereo(isStereo){
  const existing = document.getElementById('gjVrHud');
  if (existing) existing.remove();
  if (!isStereo) return;

  const hud = document.createElement('div');
  hud.id = 'gjVrHud';
  hud.className = 'gj-vr-hud';
  hud.innerHTML = `
    <div class="eye l">
      <div class="row"><span class="k">Score</span><span class="v" data-k="score">0</span></div>
      <div class="row"><span class="k">Time</span><span class="v" data-k="time">0</span></div>
      <div class="row"><span class="k">Miss</span><span class="v" data-k="miss">0</span></div>
      <div class="row"><span class="k">Grade</span><span class="v" data-k="grade">—</span></div>
    </div>
    <div class="eye r">
      <div class="row"><span class="k">Score</span><span class="v" data-k="score">0</span></div>
      <div class="row"><span class="k">Time</span><span class="v" data-k="time">0</span></div>
      <div class="row"><span class="k">Miss</span><span class="v" data-k="miss">0</span></div>
      <div class="row"><span class="k">Grade</span><span class="v" data-k="grade">—</span></div>
    </div>
  `;
  document.body.appendChild(hud);

  const setBoth = (key, val)=>{
    hud.querySelectorAll(`[data-k="${key}"]`).forEach(el=>{ el.textContent = String(val); });
  };

  // Listen to HHA events
  window.addEventListener('hha:score', (e)=>{
    const d = e.detail || {};
    setBoth('score', d.score ?? 0);
    setBoth('miss', d.misses ?? 0);
  });
  window.addEventListener('hha:time', (e)=>{
    const d = e.detail || {};
    setBoth('time', d.left ?? 0);
  });
  window.addEventListener('hha:rank', (e)=>{
    const d = e.detail || {};
    setBoth('grade', d.grade ?? '—');
  });
}

function mountVrControlsIfStereo(isStereo){
  const old = document.getElementById('gjVrControls');
  if (old) old.remove();
  if (!isStereo) return;

  const wrap = document.createElement('div');
  wrap.id = 'gjVrControls';
  wrap.className = 'gj-vr-controls';
  wrap.innerHTML = `
    <button class="btn-shoot vr" id="btnShootL">ยิง</button>
    <button class="btn-shoot vr" id="btnShootR">ยิง</button>
  `;
  document.body.appendChild(wrap);

  const shoot = ()=>{
    try{
      if (window.GoodJunkVR && typeof window.GoodJunkVR.shoot === 'function'){
        window.GoodJunkVR.shoot();
      } else {
        // fallback: trigger original button if exists
        document.getElementById('btnShoot')?.click();
      }
    }catch(_){}
  };

  document.getElementById('btnShootL')?.addEventListener('click', (e)=>{ e.preventDefault?.(); shoot(); });
  document.getElementById('btnShootR')?.addEventListener('click', (e)=>{ e.preventDefault?.(); shoot(); });
}

function prepareStereoStartOverlay(isStereo){
  const overlay = document.getElementById('startOverlay');
  const card = overlay?.querySelector('.start-card');
  if (!overlay || !card) return;

  // Remove previous clone if any
  overlay.querySelector('.start-card.clone')?.remove();

  if (!isStereo) return;

  const clone = card.cloneNode(true);
  clone.classList.add('clone');

  // button ids must be unique (so we just remove id and bind later)
  const btn = clone.querySelector('#btnStart');
  if (btn) btn.id = 'btnStartR';

  const meta = clone.querySelector('#startMeta');
  if (meta) meta.id = 'startMetaR';

  overlay.appendChild(clone);
}

function showStartOverlay(metaText, isStereo){
  const overlay = document.getElementById('startOverlay');
  const btnL = document.getElementById('btnStart');
  const btnR = document.getElementById('btnStartR');
  const metaL = document.getElementById('startMeta');
  const metaR = document.getElementById('startMetaR');

  if (metaL) metaL.textContent = metaText || '—';
  if (metaR) metaR.textContent = metaText || '—';

  if (!overlay || !btnL) return Promise.resolve();

  overlay.style.display = 'flex';

  return new Promise((resolve)=>{
    const go = ()=>{ overlay.style.display = 'none'; resolve(); };
    btnL.onclick = go;
    if (isStereo && btnR) btnR.onclick = go;
  });
}

/* ---------------- main ---------------- */

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

  if (isStereo){
    ensureStereoRightLayerExists();   // auto-add #gj-layer-r and #gj-crosshair-r if missing
  }

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}${isStereo ? ' • VR=cardboard' : ''}`);

  // attach touch/gyro -> CSS vars
  const touch = attachTouchLook({
    stageEl: document.getElementById('gj-stage'),
    aimY: 0.62,
    maxShiftPx: 170,
    ease: 0.12,
    enableGyro: true
  });

  // Stereo UI
  prepareStereoStartOverlay(isStereo);
  mountVrHudIfStereo(isStereo);
  mountVrControlsIfStereo(isStereo);

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '')
    + (isStereo ? ` • VR=cardboard` : '');

  await showStartOverlay(metaText, isStereo);

  // iOS gyro permission after gesture (optional)
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

    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();