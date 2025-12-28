// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard (Stereo + TouchLook)

'use strict';

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC = ROOT.document;

function qs(name, def=null){
  try{ return (new URL(ROOT.location.href)).searchParams.get(name) ?? def; }catch(_){ return def; }
}
function toInt(v, d){ v=Number(v); return Number.isFinite(v) ? (v|0) : d; }
function toStr(v, d){ v=String(v ?? '').trim(); return v ? v : d; }
function clamp(v,a,b){ v=Number(v)||0; return Math.max(a, Math.min(b, v)); }

function isStereoWanted(){
  const vr = String(qs('vr','')||'').toLowerCase();
  const stereo = String(qs('stereo','')||'').toLowerCase();
  return (vr === 'cardboard' || stereo === '1' || stereo === 'true');
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
    const v = qs(k, null);
    if (v != null && v !== '') ctx[k] = v;
  }
  ctx.projectTag = ctx.projectTag || 'GoodJunkVR';
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-28';
  return ctx;
}

function setupLoggerFromQuery(){
  const log = qs('log','');
  if (!log) return;
  try{
    if (ROOT.HHA_CLOUD_LOGGER && typeof ROOT.HHA_CLOUD_LOGGER.setEndpoint === 'function'){
      ROOT.HHA_CLOUD_LOGGER.setEndpoint(log);
    } else if (ROOT.HHACloudLogger && typeof ROOT.HHACloudLogger.setEndpoint === 'function'){
      ROOT.HHACloudLogger.setEndpoint(log);
    }
  }catch(_){}
}

function showStartOverlay(metaText){
  const overlay = DOC.getElementById('startOverlay');
  const btn = DOC.getElementById('btnStart');
  const meta = DOC.getElementById('startMeta');
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
  const el = DOC.getElementById('hudMeta');
  if (el) el.textContent = text;
}

(async function main(){
  if (!DOC) return;

  // Stereo mode toggle (Cardboard)
  if (isStereoWanted()){
    DOC.body.classList.add('gj-stereo');
    const eyeR = DOC.getElementById('gj-eyeR');
    if (eyeR) eyeR.setAttribute('aria-hidden','false');
  } else {
    DOC.body.classList.remove('gj-stereo');
  }

  setupLoggerFromQuery();

  const diff = toStr(qs('diff', 'normal'), 'normal').toLowerCase();
  const time = clamp(toInt(qs('time', '80'), 80), 30, 600);
  const run = toStr(qs('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qs('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qs('challenge', 'rush'), 'rush').toLowerCase();
  const seed = qs('seed', null);
  const sessionId = qs('sessionId', null) || qs('sid', null);

  const ctx = buildContext();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}`);

  // TouchLook (VR-feel)
  attachTouchLook({
    stageEl: DOC.getElementById('gj-stage'),
    layerEl: DOC.getElementById('gj-layer'),
    crosshairEl: DOC.getElementById('gj-crosshair'),
    ringEl: DOC.getElementById('atk-ring'),
    laserEl: DOC.getElementById('atk-laser'),

    layerElR: DOC.getElementById('gj-layerR'),
    crosshairElR: DOC.getElementById('gj-crosshairR'),
    ringElR: DOC.getElementById('atk-ringR'),
    laserElR: DOC.getElementById('atk-laserR'),

    maxShiftPx: 170,
    ease: 0.12
  });

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    context: ctx,

    // stereo refs
    layerEl: DOC.getElementById('gj-layer'),
    layerElR: DOC.getElementById('gj-layerR'),
    crosshairEl: DOC.getElementById('gj-crosshair'),
    crosshairElR: DOC.getElementById('gj-crosshairR'),
    ringEl: DOC.getElementById('atk-ring'),
    ringElR: DOC.getElementById('atk-ringR'),
    laserEl: DOC.getElementById('atk-laser'),
    laserElR: DOC.getElementById('atk-laserR'),

    shootEl: DOC.getElementById('btnShoot'),

    safeMargins: { top: 138, bottom: 182, left: 26, right: 26 }
  });
})();