/* === /herohealth/vr-groups/groups.safe.js ===
GroupsBoot — PRODUCTION
- window.GroupsBoot.start(runMode, {diff,time,seed})
- window.GroupsBoot.stop(reason)
- URL autostart only when ?autostart=1 AND ?run=play|research
*/

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
    const run  = String(sp.get('run') || sp.get('mode') || '').toLowerCase();
    const time = parseInt(sp.get('time') || '90', 10);
    const seed = String(sp.get('seed') || '').trim();
    const autostart = String(sp.get('autostart') || '0');

    return {
      diff: (['easy','normal','hard'].includes(diff) ? diff : 'normal'),
      run:  (run === 'research' ? 'research' : (run === 'play' ? 'play' : '')),
      time: (Number.isFinite(time) ? Math.max(20, Math.min(600, time|0)) : 90),
      seed,
      autostart
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
    const time = Number.isFinite(opts.time) ? (opts.time|0) : parseInt(opts.time || '90', 10) || 90;
    const seed = String(opts.seed || '').trim();

    bindRefs(eng);
    if (eng.setTimeLeft) eng.setTimeLeft(time);

    started = true;
    ROOT.__FG_STARTED__ = true;

    try {
      eng.start(diff, { runMode, seed });
    } catch (e) {
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

  // autostart (ONLY if autostart=1)
  (function autostart() {
    const p = parseParams();
    if (p.autostart !== '1') return;
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