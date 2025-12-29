// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard + VR buttons

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

async function tryFullscreen(el){
  try{
    const target = el || document.documentElement;
    if (target.requestFullscreen) await target.requestFullscreen();
  }catch(_){}
}
async function tryLandscape(){
  try{
    if (screen.orientation && screen.orientation.lock){
      await screen.orientation.lock('landscape');
    }
  }catch(_){}
}

function setUrlParam(key, val){
  try{
    const u = new URL(location.href);
    if (val == null) u.searchParams.delete(key);
    else u.searchParams.set(key, String(val));
    history.replaceState({}, '', u.toString());
  }catch(_){}
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

  // view modes: pc | mobile | vr | cardboard
  const view = toStr(qp('view', ''), '').toLowerCase() || (matchMedia('(pointer:coarse)').matches ? 'mobile' : 'pc');
  document.body.dataset.view = view;

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  // Touch/Gyro look (apply to both mono layer and stereo layers)
  const touch = attachTouchLook({
    layerEls: [
      document.getElementById('gj-layer'),
      document.getElementById('gj-layerL'),
      document.getElementById('gj-layerR'),
    ].filter(Boolean),
    crosshairEl: document.getElementById('gj-crosshair'),
    maxShiftPx: 170,
    ease: 0.12
  });

  // VR Buttons
  const btnVr = document.getElementById('btnVr');
  const btnCb = document.getElementById('btnCardboard');

  async function enterVR(){
    document.body.dataset.view = 'vr';
    setUrlParam('view', 'vr');
    setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=vr`);
    await tryFullscreen(document.getElementById('gj-stage'));
    await tryLandscape();
    // enable gyro after user gesture
    await touch.enableGyro();
  }

  async function enterCardboard(){
    document.body.dataset.view = 'cardboard';
    setUrlParam('view', 'cardboard');
    setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=cardboard`);
    await tryFullscreen(document.getElementById('gj-stage'));
    await tryLandscape();
    await touch.enableGyro();
  }

  if (btnVr) btnVr.onclick = () => { enterVR(); };
  if (btnCb) btnCb.onclick = () => { enterCardboard(); };

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  // boot engine (mono + stereo-ready)
  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    context: ctx,

    // mono layer
    layerEl: document.getElementById('gj-layer'),

    // stereo layers for cardboard
    layerEls: [
      document.getElementById('gj-layerL'),
      document.getElementById('gj-layerR')
    ],

    shootEl: document.getElementById('btnShoot'),
    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();