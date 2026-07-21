const GJ_HAND_V7 = (() => {
  'use strict';

  const VERSION = 'goodjunk-mobile-hand-select-v7.2.0';
  const TASKS_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';
  const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
  const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

  let landmarker = null;
  let running = false;
  let stream = null;
  let timer = 0;
  let lastVideoTime = -1;
  let lastInferenceAt = 0;
  let pinchDown = false;
  let lastPickAt = 0;
  let failures = 0;
  let lastResultAt = 0;
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
    dwellProgress: 0
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
    try {
      const msg = document.getElementById('loadMsg');
      if (msg) msg.textContent = text;
    } catch (_) {}
  }

  function point(landmarks, index) {
    const lm = landmarks[index];
    return {
      x: (1 - lm.x) * innerWidth,
      y: lm.y * innerHeight,
      z: lm.z || 0
    };
  }

  function normDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
  }

  function screenDistance(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function smoothPoint(next) {
    if (!smoothedPoint) {
      smoothedPoint = { x: next.x, y: next.y };
      return smoothedPoint;
    }
    const alpha = 0.48;
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
    if (performance.now() - lastPickAt < 480) return false;
    const bridge = window.__GJ_SELECT_AT__;
    if (typeof bridge !== 'function') {
      console.warn('[GoodJunk HandLandmarker]', VERSION, 'selection bridge unavailable');
      return false;
    }

    let selected = false;
    try {
      selected = bridge(p.x, p.y, source) !== false;
    } catch (error) {
      console.warn('[GoodJunk HandLandmarker]', VERSION, 'selection failed', error);
      return false;
    }

    if (selected) {
      lastPickAt = performance.now();
      state.lastSelection = source;
      try { navigator.vibrate?.(35); } catch (_) {}
      try { window.__GJ_SHOW__?.(source === 'pinch' ? '🤏 เลือกแล้ว' : '🎯 เลือกแล้ว'); } catch (_) {}
    }
    return selected;
  }

  function updateDwell(indexPoint, now, pinching) {
    if (pinching) {
      resetDwell();
      return;
    }

    if (!dwellAnchor || screenDistance(indexPoint, dwellAnchor) > 44) {
      dwellAnchor = { x: indexPoint.x, y: indexPoint.y };
      dwellStartedAt = now;
      dwellFired = false;
      state.dwellProgress = 0;
      return;
    }

    const elapsed = now - dwellStartedAt;
    state.dwellProgress = Math.min(1, elapsed / 720);
    if (!dwellFired && elapsed >= 720) {
      dwellFired = selectAt(indexPoint, 'dwell');
    }
  }

  function processResult(result) {
    const hand = result?.landmarks?.[0];
    if (!hand) {
      state.detected = false;
      state.confidence = 0;
      state.dwellProgress = 0;
      window.__GJ_HAND_POINTS__ = [];
      pinchDown = false;
      smoothedPoint = null;
      resetDwell();
      return;
    }

    state.detected = true;
    state.confidence = Number(result?.handedness?.[0]?.[0]?.score || 0);
    lastResultAt = performance.now();

    const rawIndexTip = point(hand, 8);
    const indexTip = smoothPoint(rawIndexTip);
    const wrist = hand[0];
    const middleMcp = hand[9];
    const palmScale = Math.max(0.04, normDistance(wrist, middleMcp));
    const pinchRatio = normDistance(hand[4], hand[8]) / palmScale;

    /* Hysteresis makes pinch easier to start but prevents repeated flicker. */
    const pinching = pinchDown ? pinchRatio < 0.92 : pinchRatio < 0.72;

    window.__GJ_HAND_POINTS__ = [{ x: indexTip.x, y: indexTip.y }];
    window.__GJ_HANDLANDMARKER_STATUS__ = {
      detected: true,
      confidence: state.confidence,
      pinchRatio: Number(pinchRatio.toFixed(3)),
      pinching,
      dwellProgress: Number(state.dwellProgress.toFixed(2)),
      lastSelection: state.lastSelection,
      lastResultAt
    };

    const now = performance.now();
    if (pinching && !pinchDown) {
      selectAt(indexTip, 'pinch');
      resetDwell();
    } else {
      updateDwell(indexTip, now, pinching);
    }
    pinchDown = pinching;
  }

  async function infer() {
    if (!running || !landmarker) return;
    const video = document.getElementById('video');
    if (!video || video.readyState < 2 || document.hidden) return;

    const now = performance.now();
    if (now - lastInferenceAt < 145 || video.currentTime === lastVideoTime) return;
    lastInferenceAt = now;
    lastVideoTime = video.currentTime;

    try {
      const result = landmarker.detectForVideo(video, now);
      failures = 0;
      processResult(result);
    } catch (error) {
      failures += 1;
      console.warn('[GoodJunk HandLandmarker]', VERSION, 'detect failed', failures, error);
      if (failures >= 4) fallback('HandLandmarker ตรวจจับไม่ต่อเนื่อง');
    }
  }

  function schedule() {
    clearInterval(timer);
    timer = window.setInterval(infer, 70);
  }

  async function loadModel() {
    if (landmarker) return landmarker;
    setStatus('กำลังโหลด Mobile HandLandmarker…');
    const vision = await import(TASKS_URL);
    const resolver = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    landmarker = await vision.HandLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.34,
      minHandPresenceConfidence: 0.34,
      minTrackingConfidence: 0.34
    });
    state.ready = true;
    return landmarker;
  }

  async function openCamera(video) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 480 },
        height: { ideal: 360 },
        frameRate: { ideal: 20, max: 24 }
      }
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
      if (typeof window.__GJ_SELECT_AT__ === 'function') return true;
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
    resetDwell();
    setStatus('กำลังเปิดกล้องและ HandLandmarker…');

    await Promise.all([loadModel(), openCamera(video), waitForBridge()]);
    running = true;
    window.__GJ_CAMERA_LITE__ = false;
    window.__GJ_HANDLANDMARKER_V7__ = true;
    window.__GJ_HAND_POINTS__ = [];
    setStatus('Hand AR พร้อม • Pinch หรือค้างเหนืออาหาร 0.7 วินาที', 'hand');
    schedule();
    return true;
  }

  function fallback(reason) {
    if (!running && state.inputMode === 'mobile-camera-touch') return;
    state.error = reason || 'HandLandmarker unavailable';
    state.inputMode = 'mobile-camera-touch';
    running = false;
    clearInterval(timer);
    timer = 0;
    window.__GJ_HAND_POINTS__ = [];
    window.__GJ_CAMERA_LITE__ = true;
    resetDwell();
    setStatus('Hand Tracking หยุด • แตะอาหารเพื่อเล่นต่อ', 'fallback');
    try {
      window.ev?.('handlandmarker_touch_fallback', { reason: state.error });
      window.__GJ_SHOW__?.('Hand Tracking หยุด — แตะอาหารเพื่อเล่นต่อ');
    } catch (_) {}
  }

  function stop(stopCamera = true) {
    running = false;
    clearInterval(timer);
    timer = 0;
    window.__GJ_HAND_POINTS__ = [];
    pinchDown = false;
    smoothedPoint = null;
    resetDwell();
    if (stopCamera && stream) {
      try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
      stream = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running && performance.now() - lastResultAt > 6000) {
      failures = 0;
      resetDwell();
    }
  });
  window.addEventListener('pagehide', () => stop(true));
  window.addEventListener('beforeunload', () => stop(true));

  return { VERSION, state, start, stop, fallback };
})();

window.GJMobileHandV7 = GJ_HAND_V7;
console.info('[GoodJunk Mobile HandLandmarker]', GJ_HAND_V7.VERSION, 'loaded');
