// === /herohealth/vr/practice-15s.js ===
// HHA Practice 15s — PRODUCTION (Pack 14)
// ✅ Auto practice run (default 15s) for VR/cVR before real run
// ✅ Uses URL params so it works with any SAFE engine (no deep coupling)
// ✅ Loop-safe via ?pdone=1
//
// How it works:
// - If run=play and view in (vr|cvr) and NOT pdone -> redirect to run=practice&time=15&pdone=1&realTime=..&realDiff=..&realRun=play
// - If run=practice -> after hha:end -> redirect to run=realRun&time=realTime&diff=realDiff (keeps other passthrough params)
//
// Expose: window.HHAPractice = { preflight, onEndRedirect, setOverlay }

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  if(WIN.__HHA_PRACTICE15_LOADED__) return;
  WIN.__HHA_PRACTICE15_LOADED__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const has = (k)=>{ try{ return new URL(location.href).searchParams.has(k); }catch(_){ return false; } };

  const clamp = (v,min,max)=>{
    const n = Number(v);
    if(!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  };

  function viewNorm(v){
    v = String(v||'').toLowerCase();
    if(v === 'cardboard') return 'vr';
    if(v === 'view-cvr') return 'cvr';
    return v || 'auto';
  }

  function buildUrl(patchFn){
    const src = new URL(location.href);
    const dst = new URL(location.href);
    dst.search = src.search; // keep everything
    patchFn(dst.searchParams);
    return dst.toString();
  }

  function keepPassthrough(dstParams){
    // no-op because we copy full search already
    // but keep this for clarity
    return dstParams;
  }

  function preflight(cfg={}){
    const practiceSec = clamp(cfg.practiceSec ?? qs('practiceSec','15'), 8, 30);

    const view = viewNorm(qs('view','auto'));
    const run  = String(qs('run','play')).toLowerCase();
    const diff = String(qs('diff','normal')).toLowerCase();
    const time = clamp(qs('time','80'), 20, 300);

    const pdone = qs('pdone', '0') === '1';
    const force = qs('practice', null); // if user sets ?practice=1 -> force practice even on mobile

    const allowedViews = Array.isArray(cfg.views) ? cfg.views : ['vr','cvr'];
    const shouldByView = allowedViews.includes(view);

    // If user explicitly says practice=0 -> disable
    if(force === '0') return { action:'none' };

    // If run=practice -> do not redirect (we are already practicing)
    if(run === 'practice') return { action:'none' };

    // Force practice by param OR by VR/cVR view
    const shouldPractice = (force === '1') || shouldByView;

    // Loop safe
    if(!shouldPractice || pdone) return { action:'none' };

    const url = buildUrl((sp)=>{
      keepPassthrough(sp);

      // store real settings
      sp.set('realRun', run);
      sp.set('realDiff', diff);
      sp.set('realTime', String(time));

      // practice run
      sp.set('run', 'practice');
      sp.set('diff', cfg.practiceDiff ?? 'easy');
      sp.set('time', String(practiceSec));
      sp.set('pdone', '1');
    });

    return { action:'redirect', url, practiceSec };
  }

  function onEndRedirect(){
    // Only redirect when current run=practice
    const run = String(qs('run','play')).toLowerCase();
    if(run !== 'practice') return null;

    const realRun  = String(qs('realRun','play')).toLowerCase();
    const realDiff = String(qs('realDiff','normal')).toLowerCase();
    const realTime = clamp(qs('realTime','80'), 20, 300);

    const url = buildUrl((sp)=>{
      keepPassthrough(sp);

      sp.set('run', realRun);
      sp.set('diff', realDiff);
      sp.set('time', String(realTime));

      // keep pdone=1 so it won't loop
      sp.set('pdone', '1');

      // optional cleanup fields (safe)
      // sp.delete('realRun'); sp.delete('realDiff'); sp.delete('realTime');
    });

    return url;
  }

  function setOverlay(text){
    const ov = DOC.getElementById('practiceOverlay');
    if(!ov) return;

    const label = DOC.getElementById('practiceLabel');
    if(label) label.textContent = text || 'Practice 15s';

    ov.setAttribute('aria-hidden','false');
  }

  function hideOverlay(){
    const ov = DOC.getElementById('practiceOverlay');
    if(!ov) return;
    ov.setAttribute('aria-hidden','true');
  }

  WIN.HHAPractice = Object.freeze({ preflight, onEndRedirect, setOverlay, hideOverlay });
})();