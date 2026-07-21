const GJ_HAND_V7 = (() => {
  'use strict';

  const VERSION = 'goodjunk-mobile-handlandmarker-v7.0.0';
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

  const state = {
    ready: false,
    detected: false,
    confidence: 0,
    inputMode: 'mobile-handlandmarker',
    fallbackAvailable: true,
    error: ''
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

  function processResult(result) {
    const hand = result?.landmarks?.[0];
    if (!hand) {
      state.detected = false;
      state.confidence = 0;
      window.__GJ_HAND_POINTS__ = [];
      pinchDown = false;
      return;
    }

    state.detected = true;
    state.confidence = Number(result?.handedness?.[0]?.[0]?.score || 0);
    lastResultAt = performance.now();

    const indexTip = point(hand, 8);
    const thumbTip = point(hand, 4);
    const wrist = hand[0];
    const middleMcp = hand[9];
    const palmScale = Math.max(0.04, normDistance(wrist, middleMcp));
    const pinchRatio = normDistance(hand[4], hand[8]) / palmScale;
    const pinching = pinchRatio < 0.52;

    window.__GJ_HAND_POINTS__ = [{ x: indexTip.x, y: indexTip.y }];
    window.__GJ_HANDLANDMARKER_STATUS__ = {
      detected: true,
      confidence: state.confidence,
      pinchRatio: Number(pinchRatio.toFixed(3)),
      pinching,
      lastResultAt
    };

    const now = performance.now();
    if (pinching && !pinchDown && now - lastPickAt > 520) {
      lastPickAt = now;
      try {
        if (typeof window.hit === 'function' && window.state?.playing) {
          window.hit(indexTip.x, indexTip.y);
        }
      } catch (error) {
        console.warn('[GoodJunk HandLandmarker]', VERSION, 'hit failed', error);
      }
    }
    pinchDown = pinching;
  }

  async function infer() {
    if (!running || !landmarker) return;
    const video = document.getElementById('video');
    if (!video || video.readyState < 2 || document.hidden) return;

    const now = performance.now();
    if (now - lastInferenceAt < 150 || video.currentTime === lastVideoTime) return;
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
      minHandDetectionConfidence: 0.38,
      minHandPresenceConfidence: 0.38,
      minTrackingConfidence: 0.38
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

  async function start(video) {
    if (!mobile()) throw new Error('Mobile HandLandmarker is mobile-only');
    stop(false);
    state.error = '';
    state.inputMode = 'mobile-handlandmarker';
    setStatus('กำลังเปิดกล้องและ HandLandmarker…');

    await Promise.all([loadModel(), openCamera(video)]);
    running = true;
    window.__GJ_CAMERA_LITE__ = false;
    window.__GJ_HANDLANDMARKER_V7__ = true;
    window.__GJ_HAND_POINTS__ = [];
    setStatus('Hand AR พร้อม • Pinch เพื่อเลือก • แตะสำรองได้', 'hand');
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
    setStatus('Hand Tracking หยุด • แตะอาหารเพื่อเล่นต่อ', 'fallback');
    try {
      window.ev?.('handlandmarker_touch_fallback', { reason: state.error });
      window.show?.('Hand Tracking หยุด — แตะอาหารเพื่อเล่นต่อ');
    } catch (_) {}
  }

  function stop(stopCamera = true) {
    running = false;
    clearInterval(timer);
    timer = 0;
    window.__GJ_HAND_POINTS__ = [];
    pinchDown = false;
    if (stopCamera && stream) {
      try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
      stream = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && running && performance.now() - lastResultAt > 6000) {
      failures = 0;
    }
  });
  window.addEventListener('pagehide', () => stop(true));
  window.addEventListener('beforeunload', () => stop(true));

  return { VERSION, state, start, stop, fallback };
})();

window.GJMobileHandV7 = GJ_HAND_V7;
console.info('[GoodJunk Mobile HandLandmarker]', GJ_HAND_V7.VERSION, 'loaded');
