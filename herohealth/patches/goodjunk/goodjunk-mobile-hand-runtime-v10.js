import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const VERSION = 'goodjunk-mobile-mainthread-hand-v10.0.0';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker = null;
let stream = null;
let video = null;
let canvas = null;
let context = null;
let running = false;
let timer = 0;
let busy = false;
let cursor = null;
let lastSelectAt = 0;
let intervalMs = 700;
let noHandCount = 0;
let initPromise = null;

const state = {
  version: VERSION,
  detected: false,
  delegate: '',
  inferenceMs: 0,
  workerReady: false,
  workerStage: 'runtime-ready',
  workerError: '',
  reconnecting: false,
  retryCount: 0,
  recoveryCount: 0,
  mainThreadCompatibility: true
};

function setStatus(text, type = 'handLite') {
  const box = document.querySelector('.missionBox');
  box?.classList.remove('cameraLite', 'handLite', 'touchRescue');
  box?.classList.add(type);
  if (box) box.dataset.handStatus = text;
  const msg = document.getElementById('loadMsg');
  if (msg) msg.textContent = text;
}

function smooth(next) {
  if (!cursor) cursor = { ...next };
  const alpha = 0.72;
  cursor.x += (next.x - cursor.x) * alpha;
  cursor.y += (next.y - cursor.y) * alpha;
  return cursor;
}

async function loadModel() {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    state.workerStage = 'wasm';
    setStatus('Mobile Hand AR • กำลังโหลดระบบตรวจมือ…');
    const resolver = await FilesetResolver.forVisionTasks(WASM_URL);

    state.workerStage = 'model';
    setStatus('Mobile Hand AR • กำลังโหลดโมเดล…');
    const options = delegate => ({
      baseOptions: { modelAssetPath: MODEL_URL, delegate },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.18,
      minHandPresenceConfidence: 0.18,
      minTrackingConfidence: 0.18
    });

    try {
      landmarker = await HandLandmarker.createFromOptions(resolver, options('GPU'));
      state.delegate = 'GPU';
    } catch (gpuError) {
      console.warn('[GoodJunk Mobile Hand]', VERSION, 'GPU unavailable', gpuError);
      landmarker = await HandLandmarker.createFromOptions(resolver, options('CPU'));
      state.delegate = 'CPU';
    }

    state.workerReady = true;
    state.workerStage = 'ready';
    return landmarker;
  })().catch(error => {
    state.workerError = String(error?.message || error);
    state.workerStage = 'init-error';
    initPromise = null;
    throw error;
  });

  return initPromise;
}

async function openCamera(target) {
  if (stream?.active && target.srcObject === stream) return;
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 18, max: 20 }
    }
  });
  window.__GJ_CAMERA_STREAM__ = stream;
  target.srcObject = stream;
  target.muted = true;
  target.setAttribute('playsinline', '');
  await target.play();
}

function prepareCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 144;
  context = canvas.getContext('2d', { alpha: false, desynchronized: true });
}

function schedule() {
  clearTimeout(timer);
  if (!running) return;
  timer = window.setTimeout(() => {
    const run = () => infer().finally(schedule);
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 250 });
    else run();
  }, intervalMs);
}

async function infer() {
  if (!running || busy || document.hidden || !video || video.readyState < 2 || !landmarker) return;
  busy = true;
  const started = performance.now();
  try {
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const result = landmarker.detectForVideo(canvas, started);
    state.inferenceMs = Math.round(performance.now() - started);
    intervalMs = state.inferenceMs > 700 ? 1400 : state.inferenceMs > 350 ? 950 : 650;
    const hand = result?.landmarks?.[0];

    if (!hand) {
      state.detected = false;
      noHandCount += 1;
      window.__GJ_HAND_POINTS__ = [];
      if (noHandCount >= 2) setStatus('Mobile Hand AR • ถอยมือให้เห็นฝ่ามือและนิ้วครบ');
      return;
    }

    noHandCount = 0;
    state.detected = true;
    const index = hand[8];
    const point = smooth({
      x: Math.max(0, Math.min(innerWidth, (1 - index.x) * innerWidth)),
      y: Math.max(0, Math.min(innerHeight, index.y * innerHeight))
    });
    window.__GJ_HAND_POINTS__ = [{ x: point.x, y: point.y }];
    setStatus(`ตรวจพบนิ้วแล้ว • ${state.delegate} ${state.inferenceMs}ms • ชี้ใกล้อาหาร`);

    if (performance.now() - lastSelectAt >= 700 && typeof window.__GJ_SELECT_AT__ === 'function') {
      const selected = window.__GJ_SELECT_AT__(point.x, point.y, 'mobile-mainthread') !== false;
      if (selected) {
        lastSelectAt = performance.now();
        try { navigator.vibrate?.(35); } catch (_) {}
        try { window.__GJ_SHOW__?.('🎯 เลือกแล้ว'); } catch (_) {}
      }
    }

    window.__GJ_HANDLANDMARKER_STATUS__ = {
      detected: true,
      inferenceMs: state.inferenceMs,
      delegate: state.delegate,
      mainThreadCompatibility: true,
      version: VERSION
    };
  } catch (error) {
    state.workerError = String(error?.message || error);
    state.workerStage = 'detect';
    setStatus('Mobile Hand AR สะดุด • ระบบจะลองใหม่ • แตะสำรองได้', 'touchRescue');
    intervalMs = 1600;
    console.warn('[GoodJunk Mobile Hand]', VERSION, error);
  } finally {
    busy = false;
  }
}

async function waitForBridge(timeoutMs = 5000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (typeof window.__GJ_SELECT_AT__ === 'function') return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Gameplay selection bridge unavailable');
}

async function start(targetVideo) {
  stop(false);
  video = targetVideo;
  cursor = null;
  noHandCount = 0;
  intervalMs = 700;
  state.workerError = '';
  setStatus('กำลังเปิด Mobile Hand AR v10…');
  prepareCanvas();
  await Promise.all([loadModel(), openCamera(video), waitForBridge()]);
  running = true;
  window.__GJ_CAMERA_LITE__ = false;
  window.__GJ_HANDLANDMARKER_V7__ = true;
  window.__GJ_HAND_POINTS__ = [];
  setStatus(`Mobile Hand AR พร้อม • ${state.delegate} • ยื่นมือให้เห็นทั้งฝ่ามือ`);
  schedule();
  return true;
}

async function retryNow() {
  if (!video?.srcObject) return false;
  try {
    await loadModel();
    running = true;
    state.workerError = '';
    setStatus('Mobile Hand AR • กำลังลองตรวจมือใหม่…');
    schedule();
    return true;
  } catch (error) {
    state.workerError = String(error?.message || error);
    setStatus('Mobile Hand AR โหลดไม่สำเร็จ • แตะอาหารได้', 'touchRescue');
    return false;
  }
}

function fallback(reason) {
  state.workerError = String(reason || 'temporary failure');
  setStatus('Mobile Hand AR สะดุด • ระบบจะลองใหม่ • แตะสำรองได้', 'touchRescue');
  running = true;
  intervalMs = 1600;
  schedule();
}

function stop(stopCamera = true) {
  running = false;
  clearTimeout(timer);
  timer = 0;
  busy = false;
  window.__GJ_HAND_POINTS__ = [];
  if (stopCamera && stream) {
    try { stream.getTracks().forEach(track => track.stop()); } catch (_) {}
    stream = null;
  }
}

window.GJMobileHandV7 = { VERSION, state, start, stop, fallback, retryNow, preload: loadModel };
window.__GJ_MOBILE_RUNTIME_READY__ = true;
console.info('[GoodJunk Mobile Main-thread Hand]', VERSION, 'registered');

/* Warm the WASM/model cache after page load without blocking first paint. */
window.setTimeout(() => {
  loadModel().catch(error => {
    console.warn('[GoodJunk Mobile Hand]', VERSION, 'preload failed', error);
  });
}, 250);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && video?.srcObject) retryNow();
});
window.addEventListener('pagehide', () => stop(true));
window.addEventListener('beforeunload', () => stop(true));
