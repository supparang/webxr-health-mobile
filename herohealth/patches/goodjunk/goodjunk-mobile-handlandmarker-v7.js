const GJ_HAND_V8 = (() => {
  'use strict';

  const VERSION = 'goodjunk-mobile-worker-hand-v8.1.0';
  const WORKER_URL = new URL('./goodjunk-hand-worker-v8.js?v=20260721-81', import.meta.url);

  let worker = null;
  let stream = null;
  let video = null;
  let running = false;
  let captureTimer = 0;
  let framePending = false;
  let frameId = 0;
  let pendingSince = 0;
  let lastResultAt = 0;
  let lastDetectionAt = 0;
  let cursor = null;
  let dwellAnchor = null;
  let dwellStartedAt = 0;
  let dwellFired = false;
  let lastSelectionAt = 0;
  let workerReady = false;
  let lastWorkerError = '';

  const state = {
    version: VERSION,
    detected: false,
    delegate: '',
    inferenceMs: 0,
    dwellProgress: 0,
    lastSelection: '',
    fallback: false,
    workerReady: false,
    workerStage: '',
    workerError: ''
  };

  function setStatus(message, cls = 'handLite') {
    const box = document.querySelector('.missionBox');
    box?.classList.remove('cameraLite', 'handLite', 'touchRescue');
    if (cls) box?.classList.add(cls);
    const msg = document.getElementById('loadMsg');
    if (msg) msg.textContent = message;
  }

  function visibleError(stage, message) {
    const clean = String(message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 140);
    lastWorkerError = `${stage || 'worker'}: ${clean}`;
    state.workerStage = stage || '';
    state.workerError = clean;
    setStatus(`Hand AR Error [${stage || 'worker'}] • ${clean} • แตะเล่นได้`, 'touchRescue');
  }

  function smooth(next) {
    if (!cursor) cursor = { ...next };
    const alpha = 0.68;
    cursor.x += (next.x - cursor.x) * alpha;
    cursor.y += (next.y - cursor.y) * alpha;
    return cursor;
  }

  function resetDwell() {
    dwellAnchor = null;
    dwellStartedAt = 0;
    dwellFired = false;
    state.dwellProgress = 0;
  }

  function selectAt(point, source) {
    if (performance.now() - lastSelectionAt < 520) return false;
    const select = window.__GJ_SELECT_AT__;
    if (typeof select !== 'function') return false;
    const ok = select(point.x, point.y, source) !== false;
    if (ok) {
      lastSelectionAt = performance.now();
      state.lastSelection = source;
      try { navigator.vibrate?.(35); } catch (_) {}
      try { window.__GJ_SHOW__?.('🎯 เลือกแล้ว'); } catch (_) {}
    }
    return ok;
  }

  function updateDwell(point) {
    const now = performance.now();
    if (!dwellAnchor || Math.hypot(point.x - dwellAnchor.x, point.y - dwellAnchor.y) > 86) {
      dwellAnchor = { ...point };
      dwellStartedAt = now;
      dwellFired = false;
      state.dwellProgress = 0;
      return;
    }
    const elapsed = now - dwellStartedAt;
    state.dwellProgress = Math.min(1, elapsed / 420);
    if (!dwellFired && elapsed >= 420) dwellFired = selectAt(point, 'worker-dwell');
  }

  function onWorkerMessage(event) {
    const data = event.data || {};

    if (data.type === 'pong') {
      state.workerStage = 'pong';
      return;
    }

    if (data.type === 'status') {
      state.workerStage = data.stage || '';
      setStatus(data.message || 'กำลังเตรียม Worker Hand AR…', 'handLite');
      return;
    }

    if (data.type === 'ready') {
      workerReady = true;
      state.workerReady = true;
      state.delegate = data.delegate || '';
      state.workerStage = 'ready';
      setStatus(`Worker Hand AR พร้อม • ${state.delegate || 'CPU'} • ยื่นมือให้เห็นทั้งฝ่ามือ`, 'handLite');
      return;
    }

    if (data.type === 'error') {
      framePending = false;
      const stage = data.stage || 'worker';
      const message = data.message || 'Worker error';
      console.warn('[GoodJunk Worker Hand]', VERSION, stage, message, data.stack || '');
      visibleError(stage, message);
      if (!workerReady || performance.now() - lastResultAt > 5000) fallback(lastWorkerError, true);
      return;
    }

    if (data.type !== 'result') return;
    framePending = false;
    pendingSince = 0;
    lastResultAt = performance.now();
    state.inferenceMs = Number(data.inferenceMs || 0);

    if (!data.detected || !data.cursor) {
      state.detected = false;
      window.__GJ_HAND_POINTS__ = [];
      resetDwell();
      if (performance.now() - lastDetectionAt > 1600) setStatus('ถอยมือให้เห็นทั้งฝ่ามือ • แตะสำรองได้', 'handLite');
      return;
    }

    state.detected = true;
    lastDetectionAt = performance.now();
    const point = smooth({
      x: Math.max(0, Math.min(innerWidth, data.cursor.x * innerWidth)),
      y: Math.max(0, Math.min(innerHeight, data.cursor.y * innerHeight))
    });
    window.__GJ_HAND_POINTS__ = [{ x: point.x, y: point.y }];
    updateDwell(point);
    setStatus('ชี้ค้างเหนืออาหารประมาณ 0.4 วินาที', 'handLite');
    window.__GJ_HANDLANDMARKER_STATUS__ = {
      detected: true,
      confidence: Number(data.confidence || 0),
      inferenceMs: state.inferenceMs,
      delegate: state.delegate,
      dwellProgress: Number(state.dwellProgress.toFixed(2)),
      worker: true,
      version: data.version || VERSION
    };
  }

  async function captureFrame() {
    if (!running || !workerReady || framePending || document.hidden) return;
    if (!video || video.readyState < 2 || !video.videoWidth) return;
    framePending = true;
    pendingSince = performance.now();
    const id = ++frameId;
    try {
      const bitmap = await createImageBitmap(video, 0, 0, video.videoWidth, video.videoHeight, {
        resizeWidth: 320,
        resizeHeight: 180,
        resizeQuality: 'low'
      });
      worker.postMessage({ type: 'frame', id, bitmap, timestamp: performance.now() }, [bitmap]);
    } catch (error) {
      framePending = false;
      visibleError('capture', error?.message || error);
      fallback(lastWorkerError, true);
    }
  }

  function scheduleCapture() {
    clearInterval(captureTimer);
    captureTimer = window.setInterval(() => {
      if (!running) return;
      if (framePending && performance.now() - pendingSince > 3000) {
        framePending = false;
        pendingSince = 0;
        visibleError('timeout', 'Worker ตรวจมือนานเกิน 3 วินาที');
        fallback(lastWorkerError, true);
        return;
      }
      captureFrame();
    }, 460);
  }

  async function openCamera(targetVideo) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 18, max: 20 } }
    });
    window.__GJ_CAMERA_STREAM__ = stream;
    targetVideo.srcObject = stream;
    targetVideo.muted = true;
    targetVideo.setAttribute('playsinline', '');
    await targetVideo.play();
  }

  async function waitForBridge(timeoutMs = 3500) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (typeof window.__GJ_SELECT_AT__ === 'function') return true;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Gameplay bridge unavailable');
  }

  async function waitForWorker(timeoutMs = 20000) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (workerReady) return true;
      if (state.fallback) throw new Error(lastWorkerError || 'Worker initialization failed');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Worker model load timeout • stage=${state.workerStage || 'unknown'}`);
  }

  async function start(targetVideo) {
    stop(false);
    if (typeof Worker !== 'function') throw new Error('Web Worker unsupported');
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap unsupported');

    video = targetVideo;
    state.fallback = false;
    state.detected = false;
    state.workerError = '';
    state.workerStage = 'create';
    workerReady = false;
    framePending = false;
    cursor = null;
    resetDwell();
    setStatus('กำลังสร้าง Worker Hand AR v8.1…', 'handLite');

    worker = new Worker(WORKER_URL, { type: 'module', name: 'goodjunk-hand-v81' });
    worker.onmessage = onWorkerMessage;
    worker.onerror = event => {
      const detail = `${event.message || 'Worker script error'} @ ${event.filename || 'unknown'}:${event.lineno || 0}`;
      console.error('[GoodJunk Worker Hand]', VERSION, detail);
      visibleError('script', detail);
      fallback(lastWorkerError, true);
    };
    worker.onmessageerror = event => {
      visibleError('message', event?.data ? String(event.data) : 'Worker message could not be decoded');
      fallback(lastWorkerError, true);
    };
    worker.postMessage({ type: 'ping' });
    worker.postMessage({ type: 'init' });

    await Promise.all([openCamera(video), waitForBridge(), waitForWorker()]);
    running = true;
    lastResultAt = performance.now();
    lastDetectionAt = 0;
    window.__GJ_CAMERA_LITE__ = false;
    window.__GJ_HANDLANDMARKER_V7__ = true;
    window.__GJ_HAND_POINTS__ = [];
    setStatus('ยื่นมือให้เห็นทั้งฝ่ามือ • ชี้ค้างเพื่อเลือก', 'handLite');
    scheduleCapture();
    return true;
  }

  function fallback(reason, preserveError = false) {
    if (state.fallback) return;
    state.fallback = true;
    running = false;
    clearInterval(captureTimer);
    captureTimer = 0;
    framePending = false;
    window.__GJ_HAND_POINTS__ = [];
    window.__GJ_CAMERA_LITE__ = true;
    resetDwell();
    try { worker?.terminate(); } catch (_) {}
    worker = null;
    if (!preserveError) setStatus('Hand Tracking ไม่พร้อม • แตะอาหารเพื่อเล่นต่อ', 'touchRescue');
    try { window.__GJ_SHOW__?.(reason || 'แตะอาหารเพื่อเล่นต่อ'); } catch (_) {}
  }

  function stop(stopCamera = true) {
    running = false;
    clearInterval(captureTimer);
    captureTimer = 0;
    framePending = false;
    workerReady = false;
    try { worker?.terminate(); } catch (_) {}
    worker = null;
    window.__GJ_HAND_POINTS__ = [];
    cursor = null;
    resetDwell();
    if (stopCamera && stream) {
      try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
      stream = null;
    }
  }

  window.addEventListener('pagehide', () => stop(true));
  window.addEventListener('beforeunload', () => stop(true));

  return { VERSION, state, start, stop, fallback };
})();

window.GJMobileHandV7 = GJ_HAND_V8;
console.info('[GoodJunk Mobile Worker Hand]', GJ_HAND_V8.VERSION, 'loaded');
