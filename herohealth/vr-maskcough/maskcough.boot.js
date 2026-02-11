// === /herohealth/vr-maskcough/maskcough.boot.js ===
// MaskCoughVR BOOT — PRODUCTION (HHA Standard)
// ✅ Passthrough ctx (hub/run/diff/time/seed/studyId/phase/conditionGroup/log/mode/...)
// ✅ Deterministic seed fallback (stable) + expose to engine
// ✅ Mount VR UI config (crosshair + hha:shoot)
// ✅ Flush-hardened (visibilitychange/pagehide/backbutton safe)

(function(){
  'use strict';
  const WIN = window, DOC = document;

  function getQS(){
    try { return new URL(location.href).searchParams; }
    catch { return new URLSearchParams(); }
  }
  const QS = getQS();
  const q = (k, def='') => (QS.get(k) ?? def);
  const qNum = (k, def=0) => {
    const v = Number(q(k,''));
    return Number.isFinite(v) ? v : def;
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function getView(){
    const v = (q('view','pc')||'pc').toLowerCase();
    if(v==='vr' || v==='cvr' || v==='mobile' || v==='pc') return v;
    return 'pc';
  }
  function getDiff(){
    const d = (q('diff','normal')||'normal').toLowerCase();
    return (d==='easy'||d==='hard'||d==='normal') ? d : 'normal';
  }
  function getMode(){
    const m = (q('mode','play')||'play').toLowerCase();
    return (m==='research'||m==='practice'||m==='play') ? m : 'play';
  }

  function stableSeedFallback(){
    // Stable-ish: prefer explicit pid/studyId, otherwise use day bucket.
    const pid = q('pid','') || q('studentKey','') || q('device','');
    const studyId = q('studyId','');
    const phase = q('phase','');
    const cg = q('conditionGroup','');
    const day = new Date().toISOString().slice(0,10); // YYYY-MM-DD
    const base = [studyId, phase, cg, pid, day].filter(Boolean).join('|') || ('day|' + day);
    // hash32
    let h = 2166136261 >>> 0;
    for(let i=0;i<base.length;i++){
      h ^= base.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return String(h >>> 0);
  }

  const view = getView();
  const diff = getDiff();
  const mode = getMode();
  const timeSec = clamp(qNum('time', 75), 30, 180);

  const seed = (q('seed','')||'').trim() || stableSeedFallback();

  // hub fallback (if not provided)
  const hub = (q('hub','')||'').trim() || new URL('../hub.html', location.href).toString();

  // Expose context (HHA passthrough)
  const ctx = {
    projectTag: 'HHA_MASKCOUGH',
    hub,
    run: q('run',''),
    view,
    diff,
    mode,
    timeSec,
    seed,

    // research meta (passthrough)
    studyId: q('studyId',''),
    phase: q('phase',''),
    conditionGroup: q('conditionGroup',''),
    sessionOrder: q('sessionOrder',''),
    blockLabel: q('blockLabel',''),
    siteCode: q('siteCode',''),
    schoolCode: q('schoolCode',''),
    schoolName: q('schoolName',''),
    gradeLevel: q('gradeLevel',''),
    pid: q('pid','') || q('studentKey',''),

    // logging
    log: q('log',''),   // endpoint
    reason: q('reason',''),
  };

  WIN.HHA_CTX = ctx;

  // Mark view on DOM for CSS and engine
  const wrap = DOC.getElementById('mc-wrap');
  if(wrap){
    wrap.dataset.view = view;
    wrap.dataset.diff = diff;
  }

  // VR UI config (used by ../vr/vr-ui.js)
  WIN.HHA_VRUI_CONFIG = Object.assign({ lockPx: 28, cooldownMs: 90 }, WIN.HHA_VRUI_CONFIG || {});

  // Flush-hardened hooks — engine must implement HHA_MASKCOUGH.flush()
  function safeFlush(reason){
    try{
      if(WIN.HHA_MASKCOUGH && typeof WIN.HHA_MASKCOUGH.flush === 'function'){
        WIN.HHA_MASKCOUGH.flush(reason || 'flush');
      }
    }catch(_){}
  }

  WIN.addEventListener('pagehide', ()=>safeFlush('pagehide'), {capture:true});
  DOC.addEventListener('visibilitychange', ()=>{
    if(DOC.visibilityState === 'hidden') safeFlush('hidden');
  }, {capture:true});
  WIN.addEventListener('beforeunload', ()=>safeFlush('beforeunload'), {capture:true});

  // Back button on mobile (best effort)
  WIN.addEventListener('popstate', ()=>safeFlush('popstate'), {capture:true});

  // If engine already loaded, start now; otherwise it will auto-start on load in safe.js
  WIN.__HHA_MASKCOUGH_BOOTED__ = true;
})();