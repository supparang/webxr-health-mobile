/* === /herohealth/vr-groups/groups.safe.js ===
GroupsBoot — PRODUCTION (PATCH++ : Quest + Style)
- Uses window.GroupsVR.GameEngine
- Passes style + time + seed + runMode to engine.start(diff, cfg)
- Resets QuestDirector when starting
- Sets body class groups-style-hard/feel/mix
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

  function setBodyStyleClass(style){
    const b = document.body;
    if (!b) return;
    b.classList.remove('groups-style-hard','groups-style-feel','groups-style-mix');
    const st = (['hard','feel','mix'].includes(style) ? style : 'mix');
    b.classList.add('groups-style-'+st);
  }

  function parseParams() {
    let sp;
    try { sp = new URLSearchParams(location.search); } catch { sp = new URLSearchParams(''); }

    const diff = String(sp.get('diff') || 'normal').toLowerCase();
    const run  = String(sp.get('run') || sp.get('mode') || '').toLowerCase();
    const time = parseInt(sp.get('time') || '90', 10);
    const seed = String(sp.get('seed') || '').trim();
    const style= String(sp.get('style') || 'mix').toLowerCase();
    const autostart = String(sp.get('autostart') || '0');

    return {
      diff: (['easy','normal','hard'].includes(diff) ? diff : 'normal'),
      run:  (run === 'research' ? 'research' : (run === 'play' ? 'play' : '')),
      time: (Number.isFinite(time) ? Math.max(20, Math.min(600, time|0)) : 90),
      seed,
      style: (['hard','feel','mix'].includes(style) ? style : 'mix'),
      autostart
    };
  }

  function bindRefs(eng) {
    const layer = $('fg-layer');
    const cam = document.querySelector('#cam');
    if (layer && eng.setLayerEl) eng.setLayerEl(layer);
    if (cam && eng.setCameraEl) eng.setCameraEl(cam);
  }

  function resetQuest(runMode, diff, style){
    try{
      const Q = ROOT.GroupsVR && ROOT.GroupsVR.QuestDirector;
      if (Q && typeof Q.reset === 'function'){
        Q.reset({ runMode, diff, style });
      }
    }catch{}
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
    const time = Number.isFinite(opts.time) ? (opts.time|0) : (parseInt(opts.time || '90', 10) || 90);
    const seed = String(opts.seed || '').trim();
    const style= String(opts.style || (new URLSearchParams(location.search).get('style')||'mix')).toLowerCase();

    setBodyStyleClass(style);
    resetQuest(runMode, diff, style);

    bindRefs(eng);
    if (eng.setTimeLeft) eng.setTimeLeft(time);

    started = true;
    ROOT.__FG_STARTED__ = true;

    try {
      eng.start(diff, { runMode, seed, time, style });
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

  ROOT.addEventListener('hha:stop', ()=>Boot.stop('hha_stop'));

  // autostart (ONLY if autostart=1)
  (function autostart() {
    const p = parseParams();
    if (p.autostart !== '1') return;
    if (!p.run) return;

    // set style class early
    setBodyStyleClass(p.style);

    let tries = 0;
    const it = setInterval(() => {
      tries++;
      const eng = safeEngine();
      if (eng) {
        clearInterval(it);
        Boot.start(p.run, { diff: p.diff, time: p.time, seed: p.seed, style: p.style });
      }
      if (tries > 120) clearInterval(it);
    }, 80);
  })();
})();
