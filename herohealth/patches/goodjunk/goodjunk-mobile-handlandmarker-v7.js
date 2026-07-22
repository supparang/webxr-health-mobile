const GJ_HAND_V8 = (() => {
  'use strict';

  const VERSION = 'goodjunk-mobile-worker-hand-v8.2.0';
  const WORKER_URL = new URL('./goodjunk-hand-worker-v8.js?v=20260722-82', import.meta.url);
  const QUICK_RETRY_DELAYS = [800, 1800, 3500];
  const COOLDOWN_RETRY_MS = 15000;

  let worker = null;
  let stream = null;
  let video = null;
  let running = false;
  let captureTimer = 0;
  let reconnectTimer = 0;
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
  let reconnecting = false;
  let retryIndex = 0;
  let manualStop = false;

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
    workerError: '',
    reconnecting: false,
    retryCount: 0,
    recoveryCount: 0
  };

  function setStatus(message, cls = 'handLite') {
    const box = document.querySelector('.missionBox');
    box?.classList.remove('cameraLite', 'handLite', 'touchRescue');
    if (cls) box?.classList.add(cls);
    const msg = document.getElementById('loadMsg');
    if (msg) msg.textContent = message;
  }

  function cleanError(stage, message) {
    const clean = String(message || 'Unknown error').replace(/\s+/g, ' ').slice(0, 140);
    lastWorkerError = `${stage || 'worker'}: ${clean}`;
    state.workerStage = stage || '';
    state.workerError = clean;
    return clean;
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

  function terminateWorker() {
    try { worker?.terminate(); } catch (_) {}
    worker = null;
    workerReady = false;
    state.workerReady = false;
    framePending = false;
    pendingSince = 0;
  }

  function nextRetryDelay() {
    if (retryIndex < QUICK_RETRY_DELAYS.length) return QUICK_RETRY_DELAYS[retryIndex++];
    retryIndex = 0;
    return COOLDOWN_RETRY_MS;
  }

  function scheduleReconnect(stage, message) {
    if (manualStop || reconnecting) return;
    const clean = cleanError(stage, message);
    const delay = nextRetryDelay();
    reconnecting = true;
    state.reconnecting = true;
    state.retryCount += 1;
    state.detected = false;
    window.__GJ_HAND_POINTS__ = [];
    resetDwell();
    terminateWorker();

    const seconds = Math.max(1, Math.round(delay / 1000));
    setStatus(`Hand Tracking สะดุด • กำลังเชื่อมใหม่ใน ${seconds} วิ • แตะเล่นต่อได้`, 'touchRescue');
    try {
      window.ev?.('hand_worker_reconnect_scheduled', {
        stage,
        message: clean,
        delayMs: delay,
        retryCount: state.retryCount
      });
    } catch (_) {}

    clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(async () => {
      reconnecting = false;
      state.reconnecting = false;
      if (manualStop || !video?.srcObject) return;
      try {
        setStatus('กำลังเชื่อม Hand Tracking ใหม่…', 'handLite');
        await createAndInitWorker();
        running = true;
        state.fallback = false;
        state.recoveryCount += 1;
        retryIndex = 0;
        lastResultAt = performance.now();
        setStatus('Hand Tracking กลับมาแล้ว • ชี้ค้างเหนืออาหาร', 'handLite');
        scheduleCapture();
        try { window.ev?.('hand_worker_recovered', { recoveryCount: state.recoveryCount }); } catch (_) {}
      } catch (error) {
        scheduleReconnect('reconnect', error?.message || error);
      }
    }, delay);
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
      state.workerError = '';
      setStatus(`Worker Hand AR พร้อม • ${state.delegate || 'CPU'} • ยื่นมือให้เห็นทั้งฝ่ามือ`, 'handLite');
      return;
    }

    if (data.type === 'error') {
      framePending = false;
      const stage = data.stage || 'worker';
      const message = data.message || 'Worker error';
      console.warn('[GoodJunk Worker Hand]', VERSION, stage, message, data.stack || '');
      scheduleReconnect(stage, message);
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
      version: data.version || VERSION,
      recoveryCount: state.recoveryCount
    };
  }

  async function captureFrame() {
    if (!running || reconnecting || !workerReady || framePending || document.hidden) return;
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
      scheduleReconnect('capture', error?.message || error);
    }
  }

  function scheduleCapture() {
    clearInterval(captureTimer);
    captureTimer = window.setInterval(() => {
      if (!running || reconnecting) return;
      if (framePending && performance.now() - pendingSince > 4500) {
        framePending = false;
        pendingSince = 0;
        scheduleReconnect('timeout', 'Worker ตรวจมือนานเกิน 4.5 วินาที');
        return;
      }
      captureFrame();
    }, 520);
  }

  async function openCamera(targetVideo) {
    if (stream?.active && targetVideo.srcObject === stream) return;
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
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Worker model load timeout • stage=${state.workerStage || 'unknown'}`);
  }

  async function createAndInitWorker() {
    terminateWorker();
    state.workerStage = 'create';
    worker = new Worker(WORKER_URL, { type: 'module', name: `goodjunk-hand-v82-${Date.now()}` });
    worker.onmessage = onWorkerMessage;
    worker.onerror = event => {
      const detail = `${event.message || 'Worker script error'} @ ${event.filename || 'unknown'}:${event.lineno || 0}`;
      console.error('[GoodJunk Worker Hand]', VERSION, detail);
      scheduleReconnect('script', detail);
    };
    worker.onmessageerror = event => {
      scheduleReconnect('message', event?.data ? String(event.data) : 'Worker message could not be decoded');
    };
    worker.postMessage({ type: 'ping' });
    worker.postMessage({ type: 'init' });
    await waitForWorker();
  }

  async function start(targetVideo) {
    stop(false);
    manualStop = false;
    if (typeof Worker !== 'function') throw new Error('Web Worker unsupported');
    if (typeof createImageBitmap !== 'function') throw new Error('createImageBitmap unsupported');

    video = targetVideo;
    state.fallback = false;
    state.detected = false;
    state.workerError = '';
    state.workerStage = 'create';
    state.retryCount = 0;
    state.recoveryCount = 0;
    retryIndex = 0;
    reconnecting = false;
    state.reconnecting = false;
    framePending = false;
    cursor = null;
    resetDwell();
    setStatus('กำลังสร้าง Worker Hand AR v8.2…', 'handLite');

    await Promise.all([openCamera(video), waitForBridge()]);
    await createAndInitWorker();
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

  async function retryNow() {
    if (manualStop || !video?.srcObject) return false;
    clearTimeout(reconnectTimer);
    reconnecting = false;
    state.reconnecting = false;
    retryIndex = 0;
    try {
      setStatus('กำลังลอง Hand Tracking อีกครั้ง…', 'handLite');
      await createAndInitWorker();
      running = true;
      state.fallback = false;
      scheduleCapture();
      return true;
    } catch (error) {
      scheduleReconnect('manual-retry', error?.message || error);
      return false;
    }
  }

  function fallback(reason) {
    state.fallback = true;
    setStatus('Hand Tracking กำลังพัก • แตะเล่นได้ และระบบจะลองใหม่อัตโนมัติ', 'touchRescue');
    scheduleReconnect('fallback', reason || 'Temporary Hand Tracking failure');
  }

  function stop(stopCamera = true) {
    manualStop = true;
    running = false;
    reconnecting = false;
    state.reconnecting = false;
    clearInterval(captureTimer);
    clearTimeout(reconnectTimer);
    captureTimer = 0;
    reconnectTimer = 0;
    framePending = false;
    workerReady = false;
    terminateWorker();
    window.__GJ_HAND_POINTS__ = [];
    cursor = null;
    resetDwell();
    if (stopCamera && stream) {
      try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
      stream = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !manualStop && video?.srcObject && !workerReady && !reconnecting) retryNow();
  });
  window.addEventListener('pagehide', () => stop(true));
  window.addEventListener('beforeunload', () => stop(true));

  return { VERSION, state, start, stop, fallback, retryNow };
})();

window.GJMobileHandV7 = GJ_HAND_V8;
console.info('[GoodJunk Mobile Worker Hand]', GJ_HAND_V8.VERSION, 'loaded');
