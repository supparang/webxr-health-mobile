// === /herohealth/vr-groups/groups.safe.js ===
// Food Groups VR — BOOT + META ENRICH + PANIC UI (PRODUCTION)
// ✅ Autostart via URL: ?run=play|research&diff=easy|normal|hard&time=90&seed=...
// ✅ Guard: window.__FG_STARTED__ prevents double start
// ✅ Engine bind: layerEl (#fg-layer) + camEl (#cam)
// ✅ Meta enrich for logger: district/school/class/student/stage/seed (capture phase)
// ✅ Panic/Clutch edge pulse: listens hha:panic + time<=10 fallback
// Exposes: window.GroupsBoot.start(mode, {diff,time,seed}) / stop(reason)

(function () {
  'use strict';

  const ROOT = window;
  const BOOT = (ROOT.GroupsBoot = ROOT.GroupsBoot || {});
  const log = (...a) => console.log('[GroupsBoot]', ...a);
  const warn = (...a) => console.warn('[GroupsBoot]', ...a);

  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { v = Number(v) || 0; return v < a ? a : (v > b ? b : v); }

  // ---------- META (School / Research) ----------
  function parseMetaFromSeed(seedStr) {
    const seed = String(seedStr || '').trim();
    // expected: DIST-SCHOOL-g5-CLASS-###-STAGE-YYYY-MM-DD (from your HTML generator)
    // Example: JJ-unknown-g5-5/1-001-pre-2025-12-24
    const parts = seed.split('-');
    const m = { seed };

    // best-effort parse
    if (parts.length >= 1) m.district = parts[0] || '';
    if (parts.length >= 2) m.school = parts[1] || '';
    // class is often at index 3
    if (parts.length >= 4) m.class = parts[3] || '';
    // student at index 4
    if (parts.length >= 5) m.studentId = parts[4] || '';
    // stage at index 5
    if (parts.length >= 6) m.stage = parts[5] || '';

    return m;
  }

  function parseMetaFromURL() {
    const sp = new URLSearchParams(location.search);
    const diff = String(sp.get('diff') || 'normal').toLowerCase();
    const run = String(sp.get('run') || sp.get('mode') || 'play').toLowerCase();
    const time = clamp(parseInt(sp.get('time') || '90', 10) || 90, 20, 600);
    const seed = String(sp.get('seed') || '').trim();

    // if seed missing, still provide minimal meta
    const meta = seed ? parseMetaFromSeed(seed) : { seed: '' };

    // direct overrides if you ever add explicit params later
    if (sp.get('district')) meta.district = String(sp.get('district') || '');
    if (sp.get('school')) meta.school = String(sp.get('school') || '');
    if (sp.get('class')) meta.class = String(sp.get('class') || '');
    if (sp.get('student')) meta.studentId = String(sp.get('student') || '');
    if (sp.get('stage')) meta.stage = String(sp.get('stage') || '');

    meta.diff = diff;
    meta.runMode = (run === 'research') ? 'research' : 'play';
    meta.durationSec = time;

    return meta;
  }

  let META = parseMetaFromURL();

  // capture-phase enrichment so logger (already registered) receives enriched detail
  function enrichDetail(ev) {
    try {
      if (!ev || !ev.detail || typeof ev.detail !== 'object') return;
      // do not overwrite explicit values coming from engine, only fill missing
      const d = ev.detail;

      if (d.seed == null || d.seed === '') d.seed = META.seed || '';
      if (d.district == null || d.district === '') d.district = META.district || '';
      if (d.school == null || d.school === '') d.school = META.school || '';
      if (d.class == null || d.class === '') d.class = META.class || '';
      if (d.studentId == null || d.studentId === '') d.studentId = META.studentId || '';
      if (d.stage == null || d.stage === '') d.stage = META.stage || '';

      if (d.diff == null || d.diff === '') d.diff = META.diff || '';
      if (d.runMode == null || d.runMode === '') d.runMode = META.runMode || '';
      if (d.durationSec == null || !Number(d.durationSec)) d.durationSec = META.durationSec || 0;

      // also keep a compact school key
      if (d.schoolKey == null || d.schoolKey === '') {
        const dk = String(d.district || META.district || '').trim();
        const sk = String(d.school || META.school || '').trim();
        d.schoolKey = (dk && sk) ? (dk + '-' + sk) : (dk || sk || '');
      }
    } catch {}
  }

  window.addEventListener('hha:log_session', enrichDetail, true);
  window.addEventListener('hha:log_event', enrichDetail, true);
  window.addEventListener('hha:end', enrichDetail, true); // enrich end detail too (if logger forwards)

  // ---------- PANIC / CLUTCH EDGE PULSE ----------
  let edgeEl = null;
  let edgeBeatTimer = null;
  let edgeOn = false;

  function ensureEdgeEl() {
    edgeEl = edgeEl || document.getElementById('edgePulse');
    return edgeEl;
  }
  function edgeSet(on) {
    const el = ensureEdgeEl();
    if (!el) return;
    edgeOn = !!on;
    el.classList.toggle('on', edgeOn);
  }
  function edgeBeat() {
    const el = ensureEdgeEl();
    if (!el) return;
    el.classList.remove('beat');
    // reflow
    void el.offsetWidth;
    el.classList.add('beat');
  }
  function startEdgeBeatLoop() {
    stopEdgeBeatLoop();
    edgeBeatTimer = setInterval(() => {
      if (!edgeOn) return;
      edgeBeat();
      // soft tick haptic when panic (optional)
      try { if (navigator.vibrate) navigator.vibrate(10); } catch {}
    }, 650);
  }
  function stopEdgeBeatLoop() {
    if (edgeBeatTimer) { try { clearInterval(edgeBeatTimer); } catch {} }
    edgeBeatTimer = null;
  }

  window.addEventListener('hha:panic', (e) => {
    const d = (e && e.detail) || {};
    const on = !!d.on;
    edgeSet(on);
    if (on) { edgeBeat(); startEdgeBeatLoop(); }
    else { stopEdgeBeatLoop(); }
  });

  // fallback: if some build forgets hha:panic, still trigger from time left
  window.addEventListener('hha:time', (e) => {
    const d = (e && e.detail) || {};
    const left = (typeof d.left === 'number') ? d.left : -1;
    if (left >= 0 && left <= 10) {
      if (!edgeOn) { edgeSet(true); edgeBeat(); startEdgeBeatLoop(); }
    } else {
      if (edgeOn) { edgeSet(false); stopEdgeBeatLoop(); }
    }
  });

  // ---------- ENGINE CONTROL ----------
  function engine() {
    return (ROOT.GroupsVR && ROOT.GroupsVR.GameEngine) ? ROOT.GroupsVR.GameEngine : null;
  }

  function bindEngineIfReady() {
    const eng = engine();
    if (!eng) return false;

    const layer = document.getElementById('fg-layer');
    const cam = document.getElementById('cam');

    if (!layer) warn('missing #fg-layer');
    if (!cam) warn('missing #cam');

    try {
      if (layer && eng.setLayerEl) eng.setLayerEl(layer);
      if (cam && eng.setCameraEl) eng.setCameraEl(cam);
    } catch (err) {
      warn('bindEngine error', err);
    }
    return true;
  }

  function start(mode, opts) {
    if (ROOT.__FG_STARTED__) {
      log('already started (guard)');
      return;
    }

    const sp = new URLSearchParams(location.search);

    const diff = String((opts && opts.diff) || sp.get('diff') || 'normal').toLowerCase();
    const runModeRaw = String(mode || (opts && opts.runMode) || sp.get('run') || sp.get('mode') || 'play').toLowerCase();
    const runMode = (runModeRaw === 'research') ? 'research' : 'play';

    const time = clamp(parseInt((opts && opts.time) || sp.get('time') || '90', 10) || 90, 20, 600);

    const seedStr =
      String((opts && opts.seed) || sp.get('seed') || '').trim();

    // refresh META used for logger enrichment
    META = parseMetaFromURL();
    if (seedStr) {
      META.seed = seedStr;
      Object.assign(META, parseMetaFromSeed(seedStr));
    }
    META.diff = diff;
    META.runMode = runMode;
    META.durationSec = time;

    const eng = engine();
    if (!eng) {
      warn('GameEngine not ready yet');
      return;
    }

    bindEngineIfReady();

    // show fever UI exists
    try {
      // engine already ensures FeverUI internally; no-op here
    } catch {}

    // set time + gaze defaults
    try {
      eng.setTimeLeft && eng.setTimeLeft(time);
      eng.setGaze && eng.setGaze(true);
    } catch {}

    ROOT.__FG_STARTED__ = true;

    // Start engine (opts injected)
    try {
      const layer = document.getElementById('fg-layer');
      eng.start(diff, {
        layerEl: layer || undefined,
        runMode,
        seed: seedStr || undefined
      });
      log('started', { diff, runMode, time, seed: seedStr });
    } catch (err) {
      ROOT.__FG_STARTED__ = false;
      warn('start failed', err);
    }
  }

  function stop(reason) {
    const eng = engine();
    try {
      eng && eng.stop && eng.stop(reason || 'stop');
    } catch (err) {
      warn('stop failed', err);
    }
    ROOT.__FG_STARTED__ = false;

    // cleanup panic UI
    edgeSet(false);
    stopEdgeBeatLoop();
  }

  BOOT.start = start;
  BOOT.stop = stop;

  // ---------- AUTOSTART ----------
  function maybeAutostart() {
    const sp = new URLSearchParams(location.search);
    const run = String(sp.get('run') || sp.get('mode') || '').toLowerCase();
    if (!run) return;

    const mode = (run === 'research') ? 'research' : 'play';

    // Delay a bit to ensure defer scripts registered + A-Frame camera exists
    const tryStart = () => {
      if (ROOT.__FG_STARTED__) return;

      const ok = bindEngineIfReady();
      const eng = engine();

      if (ok && eng && typeof eng.start === 'function') {
        start(mode, {});
      } else {
        // retry a few times if engine still not ready
        let tries = 0;
        const id = setInterval(() => {
          tries++;
          const ok2 = bindEngineIfReady();
          const eng2 = engine();
          if (ok2 && eng2 && typeof eng2.start === 'function') {
            clearInterval(id);
            start(mode, {});
          } else if (tries >= 20) {
            clearInterval(id);
            warn('autostart gave up (engine not ready)');
          }
        }, 120);
      }
    };

    setTimeout(tryStart, 260);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeAutostart);
  } else {
    maybeAutostart();
  }

})();