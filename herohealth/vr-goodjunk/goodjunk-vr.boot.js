// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard + Cardboard Stereo
// ✅ attachTouchLook AFTER Start click (iOS gyro permission)
// ✅ pass stereo layers/crosshairs to safe.js
// ✅ set body data-view = pc|mobile|cardboard

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
  const w = innerWidth || 360;
  const h = innerHeight || 640;
  const coarse = (matchMedia && matchMedia('(pointer: coarse)').matches);
  return coarse || (Math.min(w,h) < 520);
}

function detectView(){
  const v = toStr(qp('view', ''), '').toLowerCase();
  if (v === 'cardboard' || v === 'vr') return 'cardboard';
  if (v === 'mobile') return 'mobile';
  if (v === 'pc' || v === 'desktop') return 'pc';
  return isMobileLike() ? 'mobile' : 'pc';
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

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);

  const view = detectView();
  document.body.dataset.view = view;

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge} • view=${view}`);

  const metaText = `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge} • view=${view}`
    + (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  // pick elements by view
  const legacyLayer = document.getElementById('gj-layer');
  const legacyCross = document.getElementById('gj-crosshair');

  const layerL = document.getElementById('gj-layerL');
  const layerR = document.getElementById('gj-layerR');
  const crossL = document.getElementById('gj-crosshairL');
  const crossR = document.getElementById('gj-crosshairR');

  // Touch-look: shift layers (works for both single & stereo)
  attachTouchLook({
    stageEl: document.getElementById('gj-stage'),
    layerEls: (view === 'cardboard' && layerL && layerR) ? [layerL, layerR] : [legacyLayer].filter(Boolean),
    aimY: (view === 'cardboard') ? 0.58 : 0.62,
    maxShiftPx: (view === 'cardboard') ? 220 : 170,
    ease: 0.12
  });

  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,

    // ✅ pass both; safe.js will auto-use stereo if present
    layerEl: legacyLayer,
    crosshairEl: legacyCross,

    layerElL: layerL,
    layerElR: layerR,
    crosshairElL: crossL,
    crosshairElR: crossR,

    shootEl: document.getElementById('btnShoot'),
    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();