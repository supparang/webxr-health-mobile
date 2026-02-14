// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
'use strict';

import { boot } from './hygiene.safe.js';

function qs(k, d=null){
  try { return new URL(location.href).searchParams.get(k) ?? d; }
  catch { return d; }
}
function num(v, d){ v = Number(v); return Number.isFinite(v) ? v : d; }

const opts = {
  view: (qs('view','mobile') || 'mobile').toLowerCase(),
  run:  (qs('run','play') || 'play').toLowerCase(),
  diff: (qs('diff','normal') || 'normal').toLowerCase(),
  time: Math.max(20, Math.min(300, num(qs('time','80'), 80))),
  seed: String(qs('seed', String(Date.now()))),
  hub:  qs('hub','../hub.html'),
  pid:  String(qs('pid','')||'').trim(),
  // enable AI only when ?ai=1 (play mode)
  ai:   String(qs('ai','0')||'0') === '1',
  // optional log url (later: Apps Script endpoint)
  log:  String(qs('log','')||'').trim(),
  studyId: String(qs('studyId','')||'').trim(),
  phase: String(qs('phase','')||'').trim(),
  conditionGroup: String(qs('conditionGroup','')||'').trim()
};

boot(opts);