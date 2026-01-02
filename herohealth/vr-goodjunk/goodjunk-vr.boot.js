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
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr','view-cvr-strict');
  b.classList.add('view-'+view);

  // optional: strict crosshair mode
  const strict = (qs('cvrStrict','1') === '1');
  if(view === 'cvr' && strict) b.classList.add('view-cvr-strict');
}

let started = false;
let vruiLoading = false;
let vruiReady = false;

function ensureVrUi(cb){
  // already ready
  if(vruiReady || ROOT.__HHA_VRUI_READY) {
    vruiReady = true;
    cb && cb();
    return;
  }
  // already loading: queue callback
  if(vruiLoading){
    ROOT.__HHA_VRUI_CBS = ROOT.__HHA_VRUI_CBS || [];
    if(cb) ROOT.__HHA_VRUI_CBS.push(cb);
    return;
  }

  vruiLoading = true;
  ROOT.__HHA_VRUI_CBS = ROOT.__HHA_VRUI_CBS || [];
  if(cb) ROOT.__HHA_VRUI_CBS.push(cb);

  // load once
  if(ROOT.__HHA_VRUI_LOADED){
    // still wait for ready flag
    const t0 = performance.now();
    const spin = ()=>{
      if(ROOT.__HHA_VRUI_READY){
        vruiReady = true;
        vruiLoading = false;
        const cbs = ROOT.__HHA_VRUI_CBS.splice(0);
        cbs.forEach(fn=>{ try{ fn(); }catch(_){ } });
        return;
      }
      if(performance.now() - t0 > 1200){
        // fail-soft: continue without vrui
        vruiReady = false;
        vruiLoading = false;
        const cbs = ROOT.__HHA_VRUI_CBS.splice(0);
        cbs.forEach(fn=>{ try{ fn(); }catch(_){ } });
        return;
      }
      requestAnimationFrame(spin);
    };
    spin();
    return;
  }

  ROOT.__HHA_VRUI_LOADED = true;

  const s = DOC.createElement('script');
  s.src = '../vr/vr-ui.js';
  s.defer = true;

  s.onload = ()=>{
    const t0 = performance.now();
    const spin = ()=>{
      if(ROOT.__HHA_VRUI_READY){
        vruiReady = true;
        vruiLoading = false;
        const cbs = ROOT.__HHA_VRUI_CBS.splice(0);
        cbs.forEach(fn=>{ try{ fn(); }catch(_){ } });
        return;
      }
      if(performance.now() - t0 > 1200){
        vruiReady = false;
        vruiLoading = false;
        const cbs = ROOT.__HHA_VRUI_CBS.splice(0);
        cbs.forEach(fn=>{ try{ fn(); }catch(_){ } });
        return;
      }
      requestAnimationFrame(spin);
    };
    spin();
  };

  s.onerror = ()=>{
    vruiReady = false;
    vruiLoading = false;
    const cbs = ROOT.__HHA_VRUI_CBS.splice(0);
    cbs.forEach(fn=>{ try{ fn(); }catch(_){ } });
  };

  DOC.head.appendChild(s);
}

// pending start if UI fired before module ready
function consumePendingStart(){
  const d = ROOT.__HHA_PENDING_UI_START__;
  if(d && !started){
    ROOT.__HHA_PENDING_UI_START__ = null;
    startEngine(d);
  }
}

// ✅ START engine only from UI event (NOT hha:start)
function startEngine(detail={}){
  if(started) return;
  started = true;

  const view = normalizeView(detail.view || qs('view','mobile'));
  setBodyView(view);

  // Preload VRUI first in VR/cVR for stable controls
  const needVrUi = (view === 'vr' || view === 'cvr');
  const go = ()=>{
    engineBoot({
      view,
      diff: (qs('diff','normal')||'normal'),
      run:  (qs('run','play')||'play'),
      time: Number(qs('time','80')||80),
      seed: qs('seed', null),
      hub:  qs('hub', null),

      studyId: qs('study', qs('studyId', null)),
      phase: qs('phase', null),
      conditionGroup: qs('cond', qs('conditionGroup', null)),
    });
  };

  if(needVrUi) ensureVrUi(go);
  else go();
}

// ✅ UI start event: gj:ui-start
ROOT.addEventListener('gj:ui-start', (ev)=>{
  const view = ev?.detail?.view || qs('view','mobile');
  startEngine({ view });
}, { passive:true });

// ✅ if UI start fired before boot loaded, recover
if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  queueMicrotask(consumePendingStart);
}else{
  DOC.addEventListener('DOMContentLoaded', consumePendingStart, { once:true });
}

// Optional: when user taps "Enter VR" button (before start), preload VRUI
ROOT.addEventListener('hha:enter-cvr', ()=>{
  ensureVrUi();
}, { passive:true });