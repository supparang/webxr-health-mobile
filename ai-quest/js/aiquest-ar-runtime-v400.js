/*
  CSAI2102 AI Quest — AR Runtime v4.0.0
  Purpose:
  - Load only the AR engine needed by the current route (S1 or S2)
  - Prevent duplicate script injection
  - Apply a classroom-safe camera profile (640–800px, max 30fps)
  - Track streams / requestAnimationFrame calls created during AR
  - Release camera and AR work cleanly when the learner exits, hides, or leaves the page
*/
(() => {
  'use strict';

  if (window.AIQuestARRuntime && window.AIQuestARRuntime.version === '4.0.0') return;

  const VERSION = '4.0.0';
  const loaded = new Map();
  const state = {
    active: false,
    paused: false,
    mode: '',
    bootPromise: null,
    streams: new Set(),
    rafIds: new Set(),
    cleanups: new Set(),
    originalGetUserMedia: null,
    originalRAF: null,
    originalCAF: null,
    lastInferenceAt: 0,
    frameIndex: 0
  };

  const isSmallDevice = () => window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());

  function getRoute() {
    const q = new URLSearchParams(location.search);
    const rawSession = String(q.get('session') || q.get('mission') || '').trim().toLowerCase();
    const rawAR = String(q.get('ar') || q.get('mode') || '').trim().toLowerCase();
    const wantsAR = ['1', 'true', 'hand', 'scanner', 'object', 'camera', 'practice', 'ar'].includes(rawAR);

    if (!wantsAR) return null;
    if (rawSession === 's1' || rawSession === 'm1') return 's1';
    if (rawSession === 's2' || rawSession === 'm2') return 's2';
    return null;
  }

  function getCameraConstraints(existingVideo) {
    const small = isSmallDevice();
    const target = small
      ? { width: 640, height: 480, fps: 24 }
      : { width: 800, height: 600, fps: 30 };

    const video = existingVideo && typeof existingVideo === 'object'
      ? { ...existingVideo }
      : {};

    // Respect explicit exact constraints, but avoid silently requesting HD/60fps by default.
    if (!video.width || typeof video.width !== 'object' || !('exact' in video.width)) {
      video.width = { ideal: target.width, max: 960 };
    }
    if (!video.height || typeof video.height !== 'object' || !('exact' in video.height)) {
      video.height = { ideal: target.height, max: 720 };
    }
    if (!video.frameRate || typeof video.frameRate !== 'object' || !('exact' in video.frameRate)) {
      video.frameRate = { ideal: target.fps, max: 30 };
    }
    if (!video.facingMode) video.facingMode = 'user';

    return video;
  }

  function tuneConstraints(constraints) {
    const original = constraints || {};
    if (!original.video) return original;
    return {
      ...original,
      audio: false,
      video: getCameraConstraints(original.video)
    };
  }

  function loadScript(src) {
    const absolute = new URL(src, document.baseURI).href;
    if (loaded.has(absolute)) return loaded.get(absolute);

    const existing = Array.from(document.scripts).find((node) => node.src === absolute);
    if (existing && existing.dataset.aiquestArLoaded === '1') {
      const done = Promise.resolve();
      loaded.set(absolute, done);
      return done;
    }

    const promise = new Promise((resolve, reject) => {
      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
        if (error) reject(error);
        else {
          script.dataset.aiquestArLoaded = '1';
          resolve();
        }
      };
      const onLoad = () => finish();
      const onError = () => finish(new Error(`Unable to load AR module: ${src}`));

      script.addEventListener('load', onLoad, { once: true });
      script.addEventListener('error', onError, { once: true });
      if (!existing) {
        script.src = src;
        script.async = false;
        script.dataset.aiquestArRuntime = VERSION;
        document.body.appendChild(script);
      }
    });

    loaded.set(absolute, promise);
    return promise;
  }

  function dispatch(name, detail = {}) {
    window.dispatchEvent(new CustomEvent(name, { detail: { ...detail, mode: state.mode, version: VERSION } }));
  }

  function installResourceGuards() {
    if (!state.originalGetUserMedia && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      state.originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await state.originalGetUserMedia(tuneConstraints(constraints));
        if (state.active) state.streams.add(stream);
        return stream;
      };
    }

    if (!state.originalRAF && window.requestAnimationFrame) {
      state.originalRAF = window.requestAnimationFrame.bind(window);
      state.originalCAF = window.cancelAnimationFrame.bind(window);

      window.requestAnimationFrame = (callback) => {
        let id = 0;
        id = state.originalRAF((timestamp) => {
          state.rafIds.delete(id);
          callback(timestamp);
        });
        if (state.active) state.rafIds.add(id);
        return id;
      };

      window.cancelAnimationFrame = (id) => {
        state.rafIds.delete(id);
        return state.originalCAF(id);
      };
    }
  }

  function restoreResourceGuards() {
    if (state.originalGetUserMedia && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia = state.originalGetUserMedia;
      state.originalGetUserMedia = null;
    }
    if (state.originalRAF) {
      window.requestAnimationFrame = state.originalRAF;
      window.cancelAnimationFrame = state.originalCAF;
      state.originalRAF = null;
      state.originalCAF = null;
    }
  }

  function stopTrackedVideo() {
    document.querySelectorAll('video[data-aiquest-ar], video.aiquest-ar-video, #aiquestArVideo, #arVideo').forEach((video) => {
      try { video.pause(); } catch (_) {}
      try { video.srcObject = null; } catch (_) {}
    });
  }

  function stopStreams() {
    state.streams.forEach((stream) => {
      try { stream.getTracks().forEach((track) => track.stop()); } catch (_) {}
    });
    state.streams.clear();
  }

  function cancelFrames() {
    if (!state.originalCAF) return;
    state.rafIds.forEach((id) => {
      try { state.originalCAF(id); } catch (_) {}
    });
    state.rafIds.clear();
  }

  function runCleanups(reason) {
    Array.from(state.cleanups).reverse().forEach((cleanup) => {
      try { cleanup(reason); } catch (error) { console.warn('[AIQuest AR] cleanup failed', error); }
    });
    state.cleanups.clear();
  }

  function leave(reason = 'leave') {
    if (!state.active && !state.bootPromise) return;

    dispatch('aiquest:ar-stop', { reason });
    state.active = false;
    state.paused = false;
    runCleanups(reason);
    cancelFrames();
    stopTrackedVideo();
    stopStreams();
    restoreResourceGuards();
    state.mode = '';
    state.bootPromise = null;
  }

  function pause(reason = 'hidden') {
    if (!state.active || state.paused) return;
    state.paused = true;
    document.querySelectorAll('video[data-aiquest-ar], video.aiquest-ar-video, #aiquestArVideo, #arVideo').forEach((video) => {
      try { video.pause(); } catch (_) {}
    });
    dispatch('aiquest:ar-pause', { reason });
  }

  function resume(reason = 'visible') {
    if (!state.active || !state.paused) return;
    state.paused = false;
    document.querySelectorAll('video[data-aiquest-ar], video.aiquest-ar-video, #aiquestArVideo, #arVideo').forEach((video) => {
      if (video.srcObject) video.play().catch(() => {});
    });
    dispatch('aiquest:ar-resume', { reason });
  }

  function registerCleanup(fn) {
    if (typeof fn !== 'function') return () => {};
    state.cleanups.add(fn);
    return () => state.cleanups.delete(fn);
  }

  function registerVideo(video) {
    if (!video) return () => {};
    video.dataset.aiquestAr = '1';
    const stream = video.srcObject;
    if (stream && typeof stream.getTracks === 'function') state.streams.add(stream);
    return () => {
      try { delete video.dataset.aiquestAr; } catch (_) {}
    };
  }

  function shouldProcessFrame(maxInferenceFps) {
    if (!state.active || state.paused) return false;
    const fps = Math.max(12, Math.min(Number(maxInferenceFps) || (isSmallDevice() ? 18 : 24), 30));
    const minGap = 1000 / fps;
    const at = now();
    state.frameIndex += 1;
    if (at - state.lastInferenceAt < minGap) return false;
    state.lastInferenceAt = at;
    return true;
  }

  async function boot(forcedMode) {
    const mode = forcedMode || getRoute();
    if (!mode) return false;
    if (state.active && state.mode === mode && state.bootPromise) return state.bootPromise;
    if (state.active && state.mode !== mode) leave('switch-session');

    state.active = true;
    state.paused = false;
    state.mode = mode;
    state.lastInferenceAt = 0;
    state.frameIndex = 0;
    installResourceGuards();

    const modules = mode === 's1'
      ? [
          './js/aiquest-s1-ar-practice-v364.js?v=20260628-s1ar400',
          './js/aiquest-s1-ar-hand-hotfix-v364.js?v=20260628-s1hand400',
          './js/aiquest-s1-ar-result-bridge-v369.js?v=20260628-s1result400'
        ]
      : [
          './js/aiquest-s2-ar-route-fix-v386.js?v=20260628-s2route400',
          './js/aiquest-s2-ar-practice-v387.js?v=20260628-s2practice400',
          './js/aiquest-s2-ar-result-bridge-v381.js?v=20260628-s2result400'
        ];

    state.bootPromise = (async () => {
      try {
        for (const moduleSrc of modules) await loadScript(moduleSrc);
        await loadScript('./js/aiquest-ar-final-route-v395.js?v=20260628-arfinal400');
        dispatch('aiquest:ar-ready', { profile: getCameraConstraints(true) });
        return true;
      } catch (error) {
        console.error('[AIQuest AR] boot failed', error);
        leave('boot-failed');
        throw error;
      }
    })();

    return state.bootPromise;
  }

  window.AIQuestARRuntime = Object.freeze({
    version: VERSION,
    boot,
    leave,
    pause,
    resume,
    registerCleanup,
    registerVideo,
    shouldProcessFrame,
    getCameraConstraints,
    isActive: () => state.active,
    isPaused: () => state.paused,
    getMode: () => state.mode
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('visibilitychange');
    else resume('visibilitychange');
  });
  window.addEventListener('pagehide', () => leave('pagehide'));
  window.addEventListener('beforeunload', () => leave('beforeunload'));

  // Direct AR links are supported; ordinary mission pages load no AR engine at all.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot().catch(() => {}); }, { once: true });
  } else {
    boot().catch(() => {});
  }
})();
