/*
  CSAI2102 AI Quest — AR Runtime v4.0.5
  Purpose:
  - Route S1 AR and S2 Agent Builder AR through one lazy loader
  - Prevent duplicate scripts/camera work
  - Keep a classroom-safe camera profile and capped inference
  - Release stream, video, animation and detector work cleanly
*/
(() => {
  'use strict';

  const VERSION = '4.0.5';
  if (window.AIQuestARRuntime && window.AIQuestARRuntime.version === VERSION) return;

  const loaded = new Map();
  const state = {
    active:false, paused:false, mode:'', bootPromise:null,
    streams:new Set(), rafIds:new Set(), cleanups:new Set(),
    originalGetUserMedia:null, originalRAF:null, originalCAF:null,
    lastInferenceAt:0, frameIndex:0
  };

  const isSmallDevice = () => window.matchMedia && window.matchMedia('(max-width: 860px)').matches;
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());

  function getRoute(){
    const q = new URLSearchParams(location.search);
    const session = String(q.get('session') || q.get('mission') || '').trim().toLowerCase();
    const ar = String(q.get('ar') || q.get('mode') || '').trim().toLowerCase();

    if ((session === 's1' || session === 'm1') && ['1','true','hand','scanner','object','camera','practice','ar'].includes(ar)) return 's1';
    if ((session === 's2' || session === 'm2') && ar === 'agent') return 's2';
    return null;
  }

  function getCameraConstraints(existingVideo){
    const target = isSmallDevice()
      ? { width:640, height:480, fps:24 }
      : { width:800, height:600, fps:30 };
    const video = existingVideo && typeof existingVideo === 'object' ? { ...existingVideo } : {};
    if (!video.width || typeof video.width !== 'object' || !('exact' in video.width)) video.width = { ideal:target.width, max:960 };
    if (!video.height || typeof video.height !== 'object' || !('exact' in video.height)) video.height = { ideal:target.height, max:720 };
    if (!video.frameRate || typeof video.frameRate !== 'object' || !('exact' in video.frameRate)) video.frameRate = { ideal:target.fps, max:30 };
    if (!video.facingMode) video.facingMode = 'user';
    return video;
  }

  function tuneConstraints(constraints){
    const original = constraints || {};
    if (!original.video) return original;
    return { ...original, audio:false, video:getCameraConstraints(original.video) };
  }

  function loadScript(src){
    const absolute = new URL(src, document.baseURI).href;
    if (loaded.has(absolute)) return loaded.get(absolute);
    const existing = [...document.scripts].find(node => node.src === absolute);
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
      script.addEventListener('load', onLoad, { once:true });
      script.addEventListener('error', onError, { once:true });
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

  function dispatch(name, detail = {}){
    window.dispatchEvent(new CustomEvent(name, { detail:{ ...detail, mode:state.mode, version:VERSION } }));
  }

  function installResourceGuards(){
    if (!state.originalGetUserMedia && navigator.mediaDevices?.getUserMedia) {
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

  function restoreResourceGuards(){
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

  function stopTrackedVideo(){
    document.querySelectorAll('video[data-aiquest-ar], video.aiquest-ar-video, #aiquestArVideo, #arVideo, #s2v387').forEach(video => {
      try { video.pause(); } catch (_) {}
      try { video.srcObject = null; } catch (_) {}
    });
  }

  function stopStreams(){
    state.streams.forEach(stream => {
      try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
    });
    state.streams.clear();
  }

  function cancelFrames(){
    if (!state.originalCAF) return;
    state.rafIds.forEach(id => { try { state.originalCAF(id); } catch (_) {} });
    state.rafIds.clear();
  }

  function runCleanups(reason){
    [...state.cleanups].reverse().forEach(cleanup => {
      try { cleanup(reason); } catch (error) { console.warn('[AIQuest AR] cleanup failed', error); }
    });
    state.cleanups.clear();
  }

  function leave(reason = 'leave'){
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

  function pause(reason = 'hidden'){
    if (!state.active || state.paused) return;
    state.paused = true;
    document.querySelectorAll('video[data-aiquest-ar], video.aiquest-ar-video, #aiquestArVideo, #arVideo, #s2v387').forEach(video => {
      try { video.pause(); } catch (_) {}
    });
    dispatch('aiquest:ar-pause', { reason });
  }

  function resume(reason = 'visible'){
    if (!state.active || !state.paused) return;
    state.paused = false;
    document.querySelectorAll('video[data-aiquest-ar], video.aiquest-ar-video, #aiquestArVideo, #arVideo, #s2v387').forEach(video => {
      if (video.srcObject) video.play().catch(() => {});
    });
    dispatch('aiquest:ar-resume', { reason });
  }

  function registerCleanup(fn){
    if (typeof fn !== 'function') return () => {};
    state.cleanups.add(fn);
    return () => state.cleanups.delete(fn);
  }

  function registerVideo(video){
    if (!video) return () => {};
    video.dataset.aiquestAr = '1';
    const stream = video.srcObject;
    if (stream && typeof stream.getTracks === 'function') state.streams.add(stream);
    return () => { try { delete video.dataset.aiquestAr; } catch (_) {} };
  }

  function shouldProcessFrame(maxInferenceFps){
    if (!state.active || state.paused) return false;
    const fps = Math.max(12, Math.min(Number(maxInferenceFps) || (isSmallDevice() ? 18 : 24), 30));
    const minGap = 1000 / fps;
    const at = now();
    state.frameIndex += 1;
    if (at - state.lastInferenceAt < minGap) return false;
    state.lastInferenceAt = at;
    return true;
  }

  async function boot(forcedMode){
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
          './js/aiquest-s1-ar-practice-v364.js?v=20260629-s1ar405',
          './js/aiquest-s1-ar-hand-hotfix-v364.js?v=20260629-s1hand405'
        ]
      : [
          './js/aiquest-s2-ar-practice-v405.js?v=20260629-s2practice405'
        ];

    state.bootPromise = (async () => {
      try {
        for (const moduleSrc of modules) await loadScript(moduleSrc);
        await loadScript('./js/aiquest-ar-final-route-v401.js?v=20260629-arfinal401');
        dispatch('aiquest:ar-ready', { profile:getCameraConstraints(true) });
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
    version:VERSION, boot, leave, pause, resume, registerCleanup,
    registerVideo, shouldProcessFrame, getCameraConstraints,
    isActive:() => state.active, isPaused:() => state.paused, getMode:() => state.mode
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause('visibilitychange');
    else resume('visibilitychange');
  });
  window.addEventListener('pagehide', () => leave('pagehide'));
  window.addEventListener('beforeunload', () => leave('beforeunload'));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { boot().catch(() => {}); }, { once:true });
  } else {
    boot().catch(() => {});
  }
})();
