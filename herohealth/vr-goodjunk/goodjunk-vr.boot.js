// === /herohealth/vr-goodjunk/goodjunk.boot.js ===
// GoodJunkVR BOOT — v20260210
// - sets view class (mobile / cvr)
// - passes layer refs into safe engine

'use strict';

import { boot as bootSafe } from './goodjunk.safe.js';

const DOC = document;
const qs = (k, d = null) => { try { return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };

function applyViewClass(view) {
  DOC.body.classList.remove('view-mobile', 'view-cvr');
  DOC.body.classList.add(view === 'cvr' ? 'view-cvr' : 'view-mobile');
}

function ensureRightLayerIfCVR(view) {
  const rWrap = DOC.getElementById('gj-right-wrap');
  if (!rWrap) return;
  rWrap.style.display = (view === 'cvr') ? 'block' : 'none';
}

function main() {
  const view = String(qs('view', 'mobile')).toLowerCase(); // mobile | cvr
  applyViewClass(view);
  ensureRightLayerIfCVR(view);

  const layerL = DOC.getElementById('gj-layer');
  const layerR = DOC.getElementById('gj-layer-r');

  bootSafe({
    view,
    run: String(qs('run', 'play')).toLowerCase(),
    diff: String(qs('diff', 'normal')).toLowerCase(),
    time: Number(qs('time', '80')) || 80,
    seed: qs('seed', Date.now()),
    hub: qs('hub', '../hub.html') || '../hub.html',
    pid: qs('pid', '') || '',
    layerL,
    layerR
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main, { once: true });
} else {
  main();
}
