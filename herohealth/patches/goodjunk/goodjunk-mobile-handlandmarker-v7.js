const GJ_HAND_V7 = (() => {
  'use strict';

  const VERSION = 'goodjunk-mobile-hand-v7.3.0';
  const TASKS_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
  const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

  let landmarker = null;
  let running = false;
  let stream = null;
  let timer = 0;
  let inferenceCanvas = null;
  let inferenceCtx = null;
  let lastPickAt = 0;
  let failures = 0;
  let slowFrames = 0;
  let smoothedPoint = null;
  let dwellAnchor = null;
  let dwellStartedAt = 0;
  let dwellFired = false;

  const state = {
    ready: false,
    detected: false,
    confidence: 0,
    inputMode: 'mobile-handlandmarker',
    fallbackAvailable: true,
    error: '',
    lastSelection: '',
    dwellProgress: 0,
    delegate: 'GPU',
    lastInferenceMs: 0
  };

  function mobile() {
    return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') || innerWidth <= 760;
  }

  function setStatus(text, type = 'info') {
    document.documentElement.dataset.goodjunkInput = state.inputMode;
    const missionBox = document.querySelector('.missionBox');
    missionBox?.classList.remove('cameraLite', 'handLite', 'touchRescue');
    if (type === 'hand') missionBox?.classList.add('handLite');
    if (type === 'fallback') missionBox?.classList.add('touchRescue');
    const msg = document.getElementById('loadMsg');
    if (msg) msg.textContent = text;
  }

  function point(landmarks, index) {
    const lm = landmarks[index];
    return { x: (1 - lm.x) * innerWidth, y: lm.y * innerHeight };
  }

  function smooth(next) {
    if (!smoothedPoint) smoothedPoint = { ...next };
    const alpha = 0.58;
    smoothedPoint.x += (next.x - smoothedPoint.x) * alpha;
    smoothedPoint.y += (next.y - smoothedPoint.y) * alpha;
    return smoothedPoint;
  }

  function resetDwell() {
    dwellAnchor = null;
    dwellStartedAt = 0;
    dwellFired = false;
    state.dwellProgress = 0;
  }

  function selectAt(p, source) {
    if (performance.now() - lastPickAt < 520) return false;
    const bridge = window.__GJ_SELECT_AT__;
    if (typeof bridge !== 'function') return false;
    const selected = bridge(p.x, p.y, source) !== false;
    if (selected) {
      lastPickAt = performance.now();
      state.lastSelection = source;
      try { navigator.vibrate?.(35); } catch (_) {}
      try { window.__GJ_SHOW__?.('🎯 เลือกแล้ว'); } catch (_) {}
    }
    return selected;
  }

  function updateDwell(p, now) {
    if (!dwellAnchor || Math.hypot(p.x - dwellAnchor.x, p.y - dwellAnchor.y) > 64) {
      dwellAnchor = { ...p };
      dwellStartedAt = now;
      dwellFired = false;
      state.dwellProgress = 0;
      return;
    }
    const elapsed = now - dwellStartedAt;
    state.dwellProgress = Math.min(1, elapsed / 450);
    if (!dwellFired && elapsed >= 450) dwellFired = selectAt(p, 'dwell');
  }

  function processResult(result) {
    const hand = result?.landmarks?.[0];
    if (!hand) {
      state.detected = false;
      state.confidence = 0;
      window.__GJ_HAND_POINTS__ = [];
      smoothedPoint = null;
      resetDwell();
      return;
    }

    state.detected = true;
    state.confidence = Number(result?.handedness?.[0]?.[0]?.score || 0);
    const indexTip = smooth(point(hand, 8));
    window.__GJ_HAND_POINTS__ = [{ x: indexTip.x, y: indexTip.y }];
    updateDwell(indexTip, performance.now());

    window.__GJ_HANDLANDMARKER_STATUS__ = {
      detected: true,
      confidence: state.confidence,
      dwellProgress: Number(state.dwellProgress.toFixed(2)),
      lastSelection: state.lastSelection,
      inferenceMs: state.lastInferenceMs,
      delegate: state.delegate
    };
  }

  async function createLandmarker(resolver, delegate) {
    return await (await import(TASKS_URL)).HandLandmarker.createFromOptions(resolver, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.30,
      minHandPresenceConfidence: 0.30,
      minTrackingConfidence: 0.30
    });
  }

  async function loadModel() {
    if (landmarker) return landmarker;
    setStatus('กำลังโหลด Mobile Hand AR แบบเบา…');
    const vision = await import(TASKS_URL);
    const resolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    try {
      landmarker = await vision.HandLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.30,
        minHandPresenceConfidence: 0.30,
        minTrackingConfidence: 0.30
      });
      state.delegate = 'GPU';
    } catch (gpuError) {
      console.warn('[GoodJunk HandLandmarker]', VERSION, 'GPU unavailable, using CPU', gpuError);
      landmarker = await vision.HandLandmarker.createFromOptions(resolver, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'CPU' },
        runningMode: 'VIDEO', numHands: 1,
        minHandDetectionConfidence: 0.30,
        minHandPresenceConfidence: 0.30,
        minTrackingConfidence: 0.30
      });
      state.delegate = 'CPU';
    }
    state.ready = true;
    return landmarker;
  }

  function prepareInferenceCanvas() {
    inferenceCanvas = document.createElement('canvas');
    inferenceCanvas.width = 256;
    inferenceCanvas.height = 144;
    inferenceCtx = inferenceCanvas.getContext('2d', { alpha: false, desynchronized: true });
  }

  async function infer() {
    if (!running || !landmarker || document.hidden) return;
    const video = document.getElementById('video');
    if (!video || video.readyState < 2) return;

    try {
      inferenceCtx.drawImage(video, 0, 0, 256, 144);
      const started = performance.now();
      const result = landmarker.detectForVideo(inferenceCanvas, started);
      state.lastInferenceMs = Math.round(performance.now() - started);
      failures = 0;
      slowFrames = state.lastInferenceMs > 850 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      processResult(result);
      if (slowFrames >= 2) fallback('เครื่องประมวลผล Hand AR ช้าเกินไป');
    } catch (error) {
      failures += 1;
      console.warn('[GoodJunk HandLandmarker]', VERSION, 'detect failed', failures, error);
      if (failures >= 3) fallback('HandLandmarker ตรวจจับไม่ต่อเนื่อง');
    }
  }

  function schedule() {
    clearTimeout(timer);
    const tick = async () => {
      if (!running) return;
      await infer();
      timer = window.setTimeout(tick, 320);
    };
    timer = window.setTimeout(tick, 120);
  }

  async function openCamera(video) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 }, frameRate: { ideal: 18, max: 20 } }
    });
    window.__GJ_CAMERA_STREAM__ = stream;
    video.srcObject = stream;
    video.muted = true;
    video.setAttribute('playsinline', '');
    await video.play();
  }

  async function waitForBridge(timeoutMs = 3500) {
    const started = performance.now();
    while (performance.now() - started < timeoutMs) {
      if (typeof window.__GJ_SELECT_AT__ === 'function') return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Gameplay selection bridge not ready');
  }

  async function start(video) {
    if (!mobile()) throw new Error('Mobile HandLandmarker is mobile-only');
    stop(false);
    state.error = '';
    state.inputMode = 'mobile-handlandmarker';
    state.lastSelection = '';
    slowFrames = 0;
    resetDwell();
    prepareInferenceCanvas();
    setStatus('กำลังเปิดกล้องและ Hand AR แบบเบา…');
    await Promise.all([loadModel(), openCamera(video), waitForBridge()]);
    running = true;
    window.__GJ_CAMERA_LITE__ = false;
    window.__GJ_HANDLANDMARKER_V7__ = true;
    window.__GJ_HAND_POINTS__ = [];
    setStatus('ชี้ค้างเหนืออาหารประมาณครึ่งวินาที • แตะสำรองได้', 'hand');
    schedule();
    return true;
  }

  function fallback(reason) {
    if (!running && state.inputMode === 'mobile-camera-touch') return;
    state.error = reason || 'HandLandmarker unavailable';
    state.inputMode = 'mobile-camera-touch';
    running = false;
    clearTimeout(timer);
    timer = 0;
    window.__GJ_HAND_POINTS__ = [];
    window.__GJ_CAMERA_LITE__ = true;
    resetDwell();
    setStatus('Hand Tracking ช้า • แตะอาหารเพื่อเล่นต่อ', 'fallback');
    try { window.__GJ_SHOW__?.('Hand Tracking ช้า — แตะอาหารเพื่อเล่นต่อ'); } catch (_) {}
  }

  function stop(stopCamera = true) {
    running = false;
    clearTimeout(timer);
    timer = 0;
    window.__GJ_HAND_POINTS__ = [];
    smoothedPoint = null;
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

window.GJMobileHandV7 = GJ_HAND_V7;
console.info('[GoodJunk Mobile HandLandmarker]', GJ_HAND_V7.VERSION, 'loaded');
