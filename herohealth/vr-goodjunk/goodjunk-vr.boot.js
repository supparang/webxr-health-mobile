// === /herohealth/vr-goodjunk/goodjunk.boot.js ===
'use strict';

import { boot } from './goodjunk.safe.js';

function getQS() {
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}

const q = getQS();

const opts = {
  view: (q.get('view') || 'mobile').toLowerCase(),
  run:  (q.get('run')  || 'play').toLowerCase(),
  diff: (q.get('diff') || 'normal').toLowerCase(),
  time: Number(q.get('time') || 80) || 80,
  seed: q.get('seed') || String(Date.now()),
  hub:  q.get('hub')  || '../hub.html',
  pid:  q.get('pid')  || ''
};

// bind layers (optional but nice)
opts.layerL = document.getElementById('gj-layer');
opts.layerR = document.getElementById('gj-layer-r');

boot(opts);