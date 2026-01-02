// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
'use strict';

import { boot as engineBoot } from './goodjunk.safe.js';

const ROOT = window;
const DOC  = document;

function qs(k, def=null){
  try { return new URL(location.href).searchParams.get(k) ?? def; }
  catch { return def; }
}
function normalizeView(v){
  v = String(v||'').toLowerCase();
  if(v==='pc') return 'pc';
  if(v==='vr') return 'vr';
  if(v==='cvr') return 'cvr';
  return 'mobile';
}
function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add('view-'+view);
}

let started = false;

function ensureVrUi(){
  if(ROOT.__HHA_VRUI_LOADED) return;
  ROOT.__HHA_VRUI_LOADED = true;
  const s = DOC.createElement('script');
  s.src = './vr/vr-ui.js';
  s.defer = true;
  DOC.head.appendChild(s);
}

function emitStartAndBoot(){
  if(started) return;
  started = true;

  const view = normalizeView(qs('view','mobile'));
  setBodyView(view);

  if (view === 'cvr' || view === 'vr') ensureVrUi();

  // ✅ Pack25 meta
  const meta = (ROOT.HHA_SESSION && ROOT.HHA_SESSION.buildMeta)
    ? ROOT.HHA_SESSION.buildMeta('GoodJunkVR', { gameVersion: 'gj-2026-01-02' })
    : { projectTag:'GoodJunkVR', runMode: qs('run','play'), diff: qs('diff','normal'), view, sessionId: 'S-'+Date.now() };

  // ✅ must include hub in meta for back button
  if (!meta.hub) meta.hub = qs('hub', null);

  // ✅ dispatch hha:start ONCE
  ROOT.dispatchEvent(new CustomEvent('hha:start', { detail: meta }));

  // ✅ start engine with meta-derived args
  engineBoot({
    view,
    diff: meta.diff,
    run: meta.runMode,
    time: meta.durationPlannedSec,
    seed: meta.seed,
    hub: meta.hub,

    // research meta
    sessionId: meta.sessionId,
    studyId: meta.studyId,
    phase: meta.phase,
    conditionGroup: meta.conditionGroup,
    pid: meta.pid,
    protocol: meta.protocol,
    challenge: meta.gameMode, // if you use it
    gameVersion: meta.gameVersion
  });
}

// ✅ Hook your START button to this:
DOC.addEventListener('click', (e)=>{
  const t = e.target;
  if(t && (t.id === 'btn-start' || t.classList.contains('btn-start'))){
    emitStartAndBoot();
  }
}, { passive:true });

// (optional) auto-start if you want run=play&autostart=1
if(qs('autostart','0') === '1'){
  window.addEventListener('load', ()=> emitStartAndBoot(), { passive:true });
}