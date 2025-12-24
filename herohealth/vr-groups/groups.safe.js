// === /herohealth/vr-groups/groups.safe.js ===
// Food Groups VR — BOOT (PRODUCTION)
// ✅ Bind layerEl (#fg-layer) + cameraEl (#cam) ให้ GameEngine
// ✅ Read params: diff, time, run(play/research), seed
// ✅ Auto-start when run=play|research (but "no double start" guard)
// ✅ Expose window.GroupsBoot.start/stop so HTML or dev can call
// ✅ Friendly fallbacks + console warnings

'use strict';

(function () {
  const ROOT = window;

  // ---------- helpers ----------
  const clamp = (v, a, b) => {
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  };
  const qs = (k) => {
    try { return new URLSearchParams(location.search).get(k); } catch { return null; }
  };
  const normDiff = (d) => {
    d = String(d || 'normal').toLowerCase().trim();
    if (d === 'easy' || d === 'hard') return d;
    return 'normal';
  };
  const normRun = (r) => {
    r = String(r || '').toLowerCase().trim();
    return (r === 'research') ? 'research' : (r === 'play' ? 'play' : '');
  };

  // ---------- DOM locate ----------
  function getLayerEl() {
    return document.getElementById('fg-layer') || document.querySelector('#fg-layer');
  }
  function getCamEl() {
    return document.getElementById('cam') || document.querySelector('#cam');
  }

  // ---------- engine locate ----------
  function getEngine() {
    return (ROOT.GroupsVR && ROOT.GroupsVR.GameEngine) ? ROOT.GroupsVR.GameEngine : null;
  }

  // ---------- state ----------
  let started = false;
  let startedMode = '';
  let lastParams = null;

  function readParams() {
    const diff = normDiff(qs('diff') || 'normal');
    const time = clamp(qs('time') || 70, 10, 999);
    const run = normRun(qs('run') || '');
    const seed = String(qs('seed') || '').trim();
    return { diff, time, run, seed };
  }

  function bindEngine(engine, layerEl, camEl) {
    try {
      if (engine.setLayerEl) engine.setLayerEl(layerEl);
      if (engine.setCameraEl) engine.setCameraEl(camEl);
      return true;
    } catch (e) {
      console.warn('[GroupsBoot] bindEngine failed', e);
      return false;
    }
  }

  function setTime(engine, sec) {
    try {
      if (engine.setTimeLeft) engine.setTimeLeft(sec);
    } catch {}
  }

  function start(runMode, overrideParams) {
    const engine = getEngine();
    if (!engine) {
      console.warn('[GroupsBoot] GameEngine not ready yet (window.GroupsVR.GameEngine missing)');
      return false;
    }

    const layerEl = getLayerEl();
    const camEl = getCamEl();

    if (!layerEl) {
      console.error('[GroupsBoot] #fg-layer missing in HTML');
      return false;
    }
    if (!camEl) {
      console.warn('[GroupsBoot] #cam missing (A-Frame camera). Engine can still run but parallax may be limited.');
    }

    // prevent double start (HTML glue sometimes starts directly)
    if (ROOT.__FG_STARTED__ || started) {
      return true;
    }

    const p = Object.assign(readParams(), overrideParams || {});
    p.diff = normDiff(p.diff);
    p.time = clamp(p.time, 10, 999);

    const mode = (runMode === 'research') ? 'research' : 'play';

    // bind + time
    bindEngine(engine, layerEl, camEl);
    setTime(engine, p.time);

    // start
    try {
      engine.start(p.diff, {
        runMode: mode,
        seed: p.seed || undefined
      });
    } catch (e) {
      console.error('[GroupsBoot] engine.start failed', e);
      return false;
    }

    started = true;
    startedMode = mode;
    lastParams = p;
    ROOT.__FG_STARTED__ = true;

    return true;
  }

  function stop(reason) {
    const engine = getEngine();
    try {
      engine && engine.stop && engine.stop(reason || 'stop');
    } catch {}
    started = false;
    startedMode = '';
    ROOT.__FG_STARTED__ = false;
  }

  // ---------- expose ----------
  ROOT.GroupsBoot = ROOT.GroupsBoot || {};
  ROOT.GroupsBoot.start = start;
  ROOT.GroupsBoot.stop = stop;
  ROOT.GroupsBoot.getParams = () => Object.assign({}, readParams());
  ROOT.GroupsBoot.getLast = () => (lastParams ? Object.assign({}, lastParams) : null);

  // ---------- auto-start (if run param present) ----------
  // NOTE: HTML ของเรามีตัวเริ่มเองแล้ว แต่เผื่อเปิดหน้าแบบไม่มี glue หรือ debug
  const p0 = readParams();
  if (p0.run === 'play' || p0.run === 'research') {
    // wait for defer scripts (quests + engine) to attach
    const targetMode = p0.run;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const ok = start(targetMode, p0);
      if (ok || tries >= 30) {
        clearInterval(t);
        if (!ok) console.warn('[GroupsBoot] auto-start timeout: engine not ready');
      }
    }, 80);
  }

})();