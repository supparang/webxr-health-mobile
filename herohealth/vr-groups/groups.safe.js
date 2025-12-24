// === /herohealth/vr-groups/groups.safe.js ===
// Boot wrapper for Groups VR (PRODUCTION)
// IIFE -> window.GroupsBoot.start(mode, {diff,time,seed}) / stop()
// ✅ Guards double-start
// ✅ URL autostart: ?diff=easy&time=70&run=play&seed=xxx
// ✅ Passes layer/camera refs into GameEngine
// ✅ Emits stable flags: window.__FG_STARTED__
// ✅ Safe stop via hha:stop event

(function () {
  'use strict';
  const ROOT = window;

  const Boot = (ROOT.GroupsBoot = ROOT.GroupsBoot || {});
  let started = false;

  const $ = (id) => document.getElementById(id);

  function safeEngine() {
    return (ROOT.GroupsVR && ROOT.GroupsVR.GameEngine) ? ROOT.GroupsVR.GameEngine : null;
  }

  function parseParams() {
    let sp;
    try { sp = new URLSearchParams(location.search); } catch { sp = new URLSearchParams(''); }
    const diff = String(sp.get('diff') || 'normal').toLowerCase();
    const run = String(sp.get('run') || sp.get('mode') || '').toLowerCase();
    const time = parseInt(sp.get('time') || '70', 10);
    const seed = String(sp.get('seed') || '').trim();

    return {
      diff: (['easy','normal','hard'].includes(diff) ? diff : 'normal'),
      run: (run === 'research' ? 'research' : (run === 'play' ? 'play' : '')),
      time: (Number.isFinite(time) ? Math.max(20, Math.min(600, time|0)) : 70),
      seed
    };
  }

  function bindRefs(eng) {
    const layer = $('fg-layer');
    const cam = document.querySelector('#cam');
    if (layer && eng.setLayerEl) eng.setLayerEl(layer);
    if (cam && eng.setCameraEl) eng.setCameraEl(cam);
  }

  Boot.start = function (mode, opts = {}) {
    if (started) return;
    const eng = safeEngine();
    if (!eng) {
      console.warn('[GroupsBoot] GameEngine not ready');
      return;
    }

    const runMode = String(mode || opts.runMode || 'play').toLowerCase() === 'research' ? 'research' : 'play';
    const diff = String(opts.diff || 'normal').toLowerCase();
    const time = Number.isFinite(opts.time) ? (opts.time|0) : parseInt(opts.time || '70', 10) || 70;
    const seed = String(opts.seed || '').trim();

    bindRefs(eng);
    if (eng.setTimeLeft) eng.setTimeLeft(time);
    if (eng.setGaze) eng.setGaze(true);

    started = true;
    ROOT.__FG_STARTED__ = true;

    try { eng.start(diff, { runMode, seed }); } catch (e) {
      console.error('[GroupsBoot] start failed', e);
      started = false;
      ROOT.__FG_STARTED__ = false;
    }
  };

  Boot.stop = function (reason) {
    const eng = safeEngine();
    try { eng && eng.stop && eng.stop(reason || 'boot_stop'); } catch {}
    started = false;
    ROOT.__FG_STARTED__ = false;
  };

  // allow global stop event
  function onStop() { Boot.stop('hha_stop'); }
  ROOT.addEventListener('hha:stop', onStop);

  // autostart from URL (after defer scripts settle)
  (function autostart() {
    const p = parseParams();
    if (!p.run) return;

    let tries = 0;
    const it = setInterval(() => {
      tries++;
      const eng = safeEngine();
      if (eng) {
        clearInterval(it);
        Boot.start(p.run, { diff: p.diff, time: p.time, seed: p.seed });
      }
      if (tries > 50) clearInterval(it);
    }, 120);
  })();
})();