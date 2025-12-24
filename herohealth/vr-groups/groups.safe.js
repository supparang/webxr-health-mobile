// === /herohealth/vr-groups/groups.safe.js ===
// Food Groups VR — BOOT (IIFE) PRODUCTION
// Exposes: window.GroupsBoot.start(mode, {diff,time,seed}) / stop()
// ✅ binds layer + camera
// ✅ reads URL params (?diff=?time=?run=?seed=)
// ✅ guards double-start via window.__FG_STARTED__
// ✅ autostart when run=play|research (optional)

(function(){
  'use strict';

  const ROOT = window;

  function $(sel){ return document.querySelector(sel); }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function engine(){
    return (ROOT.GroupsVR && ROOT.GroupsVR.GameEngine) ? ROOT.GroupsVR.GameEngine : null;
  }

  function parseQS(){
    const sp = new URLSearchParams(location.search);
    const diff = String(sp.get('diff')||'normal').toLowerCase();
    const run  = String(sp.get('run')||sp.get('mode')||'play').toLowerCase();
    const time = parseInt(sp.get('time')||'70',10);
    const seed = String(sp.get('seed')||'').trim();
    return {
      diff: (['easy','normal','hard'].includes(diff) ? diff : 'normal'),
      runMode: (run === 'research' ? 'research' : 'play'),
      time: clamp(time, 20, 600) | 0,
      seed
    };
  }

  function bindCommon(eng){
    const layer = $('#fg-layer');
    const cam   = $('#cam');
    if (!layer) throw new Error('Missing #fg-layer');
    eng.setLayerEl && eng.setLayerEl(layer);
    eng.setCameraEl && eng.setCameraEl(cam || null);
    return { layer, cam };
  }

  function start(runMode, opts){
    const eng = engine();
    if (!eng) {
      console.warn('[GroupsBoot] GameEngine not ready');
      return;
    }

    // guard
    if (ROOT.__FG_STARTED__) return;
    ROOT.__FG_STARTED__ = true;

    const cfg = Object.assign(parseQS(), (opts||{}));
    const diff = String(cfg.diff||'normal').toLowerCase();
    const time = clamp(cfg.time||70, 20, 600) | 0;
    const seed = String(cfg.seed||'').trim();
    const mode = (String(runMode||cfg.runMode||'play').toLowerCase()==='research') ? 'research' : 'play';

    try{
      bindCommon(eng);
      eng.setTimeLeft && eng.setTimeLeft(time);
      eng.setGaze && eng.setGaze(true);

      eng.start && eng.start(diff, {
        layerEl: $('#fg-layer'),
        runMode: mode,
        seed: seed || undefined
      });

      console.log('[GroupsBoot] start', { diff, time, mode, seed });

    }catch(err){
      console.error('[GroupsBoot] start failed', err);
      ROOT.__FG_STARTED__ = false;
    }
  }

  function stop(reason){
    const eng = engine();
    try{ eng && eng.stop && eng.stop(reason||'stop'); }catch{}
    ROOT.__FG_STARTED__ = false;
  }

  ROOT.GroupsBoot = { start, stop };

  // optional autostart: run=play|research
  try{
    const qs = parseQS();
    if (qs.runMode === 'play' || qs.runMode === 'research'){
      // defer a bit to ensure defer scripts loaded
      setTimeout(()=> start(qs.runMode, qs), 220);
    }
  }catch{}
})();