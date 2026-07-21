import { FilesetResolver, HandLandmarker } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

let landmarker = null;
let ready = false;

async function init() {
  const resolver = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = delegate => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
    minHandDetectionConfidence: 0.24,
    minHandPresenceConfidence: 0.24,
    minTrackingConfidence: 0.24
  });

  try {
    landmarker = await HandLandmarker.createFromOptions(resolver, options('GPU'));
    postMessage({ type: 'ready', delegate: 'GPU' });
  } catch (gpuError) {
    landmarker = await HandLandmarker.createFromOptions(resolver, options('CPU'));
    postMessage({ type: 'ready', delegate: 'CPU' });
  }
  ready = true;
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
  if (data.type === 'init') {
    try {
      await init();
    } catch (error) {
      postMessage({ type: 'error', message: String(error?.message || error) });
    }
    return;
  }

  if (data.type !== 'frame') return;
  const bitmap = data.bitmap;
  if (!ready || !landmarker || !bitmap) {
    try { bitmap?.close?.(); } catch (_) {}
    postMessage({ type: 'result', id: data.id, detected: false, skipped: true });
    return;
  }

  const started = performance.now();
  try {
    const result = landmarker.detectForVideo(bitmap, data.timestamp || started);
    const hand = result?.landmarks?.[0];
    if (!hand) {
      postMessage({
        type: 'result',
        id: data.id,
        detected: false,
        inferenceMs: Math.round(performance.now() - started)
      });
    } else {
      const cursor = cursorFromHand(hand);
      postMessage({
        type: 'result',
        id: data.id,
        detected: true,
        cursor,
        confidence: Number(result?.handedness?.[0]?.[0]?.score || 0),
        inferenceMs: Math.round(performance.now() - started)
      });
    }
  } catch (error) {
    postMessage({ type: 'error', id: data.id, message: String(error?.message || error) });
  } finally {
    try { bitmap.close(); } catch (_) {}
  }
};
