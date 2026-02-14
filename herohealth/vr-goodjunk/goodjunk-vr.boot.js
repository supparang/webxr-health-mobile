// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
'use strict';

import { boot } from './goodjunk.safe.js';

function qs(k, d=null){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}

const opts = {
  view: qs('view','pc'),
  run: qs('run','play'),
  diff: qs('diff','normal'),
  time: Number(qs('time','80')) || 80,
  seed: qs('seed', String(Date.now())),
  hub: qs('hub','../hub.html'),
  pid: qs('pid','')
};

boot(opts);