import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';

const VERSION = 'goodjunk-hand-worker-v8.1.0';
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarker = null;
let ready = false;
let initializing = false;

function postError(stage, error, extra = {}) {
  postMessage({
    type: 'error',
    stage,
    message: String(error?.message || error),
    stack: String(error?.stack || ''),
    version: VERSION,
    ...extra
  });
}

async function init() {
  if (ready || initializing) return;
  initializing = true;
  const started = performance.now();
  try {
    postMessage({ type: 'status', stage: 'wasm', message: 'กำลังโหลด MediaPipe WASM…', version: VERSION });
    const resolver = await FilesetResolver.forVisionTasks(WASM_URL);

    postMessage({ type: 'status', stage: 'model', message: 'กำลังโหลดโมเดลตรวจมือ…', version: VERSION });
    landmarker = await HandLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.30,
      minHandPresenceConfidence: 0.30,
      minTrackingConfidence: 0.30
    });

    ready = true;
    postMessage({
      type: 'ready',
      delegate: 'CPU',
      version: VERSION,
      initMs: Math.round(performance.now() - started)
    });
  } catch (error) {
    postError('init', error, { initMs: Math.round(performance.now() - started) });
  } finally {
    initializing = false;
  }
}

function cursorFromHand(hand) {
  const index = hand[8];
  const indexVisible = index && index.x >= -0.08 && index.x <= 1.08 && index.y >= -0.08 && index.y <= 1.08;
  if (indexVisible) return { x: 1 - index.x, y: index.y, source: 'index' };

  const ids = [0, 5, 9, 13, 17];
  const palm = ids.reduce((acc, id) => {
    acc.x += hand[id].x;
    acc.y += hand[id].y;
    return acc;
  }, { x: 0, y: 0 });
  return { x: 1 - palm.x / ids.length, y: palm.y / ids.length, source: 'palm' };
}

self.onmessage = async event => {
  const data = event.data || {};

  if (data.type === 'ping') {
    postMessage({ type: 'pong', version: VERSION, ready, workerScope: typeof WorkerGlobalScope !== 'undefined' });
    return;
  }

  if (data.type === 'init') {
    await init();
    return;
  }

  if (data.type !== 'frame') return;
  const bitmap = data.bitmap;
  if (!ready || !landmarker || !bitmap) {
    try { bitmap?.close?.(); } catch (_) {}
    postMessage({ type: 'result', id: data.id, detected: false, skipped: true, version: VERSION });
    return;
  }

  const started = performance.now();
  try {
    const result = landmarker.detectForVideo(bitmap, Number(data.timestamp || started));
    const hand = result?.landmarks?.[0];
    if (!hand) {
      postMessage({
        type: 'result',
        id: data.id,
        detected: false,
        inferenceMs: Math.round(performance.now() - started),
        version: VERSION
      });
    } else {
      const cursor = cursorFromHand(hand);
      postMessage({
        type: 'result',
        id: data.id,
        detected: true,
        cursor,
        confidence: Number(result?.handedness?.[0]?.[0]?.score || 0),
        inferenceMs: Math.round(performance.now() - started),
        version: VERSION
      });
    }
  } catch (error) {
    postError('detect', error, { id: data.id, inferenceMs: Math.round(performance.now() - started) });
  } finally {
    try { bitmap.close(); } catch (_) {}
  }
};

self.addEventListener('unhandledrejection', event => {
  postError('unhandledrejection', event.reason || 'Unknown worker rejection');
});

self.addEventListener('error', event => {
  postError('worker-error', event.error || event.message || 'Unknown worker error');
});
