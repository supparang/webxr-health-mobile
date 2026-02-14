// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
'use strict';

import { boot } from './goodjunk.safe.js';

function qs(k, d=null){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}

function normalizeView(v){
  v = String(v || '').toLowerCase();
  if(v === 'cvr' || v === 'cardboard' || v === 'vr') return 'cvr';
  if(v === 'mobile' || v === 'm') return 'mobile';
  return 'pc';
}

function applyViewClass(view){
  const b = document.body;
  b.classList.remove('view-pc','view-mobile','view-cvr');

  if(view === 'cvr') b.classList.add('view-cvr');
  else if(view === 'mobile') b.classList.add('view-mobile');
  else b.classList.add('view-pc');

  // layerR only meaningful in cVR
  const layerR = document.getElementById('gj-layer-r');
  if(layerR){
    layerR.setAttribute('aria-hidden', view === 'cvr' ? 'false' : 'true');
  }
}

const view = normalizeView(qs('view','pc'));
applyViewClass(view);

const opts = {
  view, // pc / mobile / cvr
  run: qs('run','play'),
  diff: qs('diff','normal'),
  time: Number(qs('time','80')) || 80,
  seed: qs('seed', String(Date.now())),
  hub: qs('hub','../hub.html'),
  pid: qs('pid','')
};

boot(opts);