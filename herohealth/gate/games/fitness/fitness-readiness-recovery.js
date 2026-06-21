// === /herohealth/gate/games/fitness/fitness-readiness-recovery.js ===
// FULL MODULE v20260621-FITNESS-READINESS-RECOVERY-POSE-CDN-FIX-V3
// Shared Fitness Gate phase module for:
//   shadow-breaker, rhythm-boxer, jump-duck, balance-hold
// Uses the existing /herohealth/warmup-gate.html -> gate-core.js architecture.
// Do not import this module directly from a game page; register it in gate-games.js.

const PATCH = 'v20260621-FITNESS-READINESS-RECOVERY-POSE-CDN-FIX-V3';

/*
  IMPORTANT CDN FIX
  The package root is NOT an ES module entry point in browsers:
  https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@VERSION

  Import the explicit ESM bundle instead. Keep two CDNs and a stable 0.10.15
  fallback so the AR gate can still start when one CDN or one pinned release is
  unavailable on a school network.
*/
const MP_SOURCES = Object.freeze([
  {
    name: 'jsDelivr 0.10.22',
    module: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs',
    wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
  },
  {
    name: 'unpkg 0.10.22',
    module: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.22/vision_bundle.mjs',
    wasm: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.22/wasm'
  },
  {
    name: 'jsDelivr 0.10.15 fallback',
    module: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/vision_bundle.mjs',
    wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.15/wasm'
  },
  {
    name: 'unpkg 0.10.15 fallback',
    module: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.15/vision_bundle.mjs',
    wasm: 'https://unpkg.com/@mediapipe/tasks-vision@0.10.15/wasm'
  }
]);
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

const IDX = Object.freeze({
  NOSE: 0,
  L_SHOULDER: 11,
  R_SHOULDER: 12,
  L_ELBOW: 13,
  R_ELBOW: 14,
  L_WRIST: 15,
  R_WRIST: 16,
  L_HIP: 23,
  R_HIP: 24,
  L_KNEE: 25,
  R_KNEE: 26,
  L_ANKLE: 27,
  R_ANKLE: 28
});

const GAME = Object.freeze({
  'shadow-breaker': {
    label: 'Shadow Breaker',
    emoji: '🥊',
    warmupTitle: 'Hero Ready • Punch Power',
    cooldownTitle: 'Hero Recovery • Arms & Shoulders'
  },
  'rhythm-boxer': {
    label: 'Rhythm Boxer',
    emoji: '🎵',
    warmupTitle: 'Hero Ready • Beat Control',
    cooldownTitle: 'Hero Recovery • Rhythm Reset'
  },
  'jump-duck': {
    label: 'JumpDuck',
    emoji: '🦘',
    warmupTitle: 'Hero Ready • Agility',
    cooldownTitle: 'Hero Recovery • Legs & Ankles'
  },
  'balance-hold': {
    label: 'Balance Hold',
    emoji: '⚖️',
    warmupTitle: 'Hero Ready • Stability',
    cooldownTitle: 'Hero Recovery • Calm Balance'
  }
});

function normalizeGameId(value = '') {
  const key = String(value || '').trim().toLowerCase().replace(/[_\s]+/g, '-');
  if (key === 'shadowbreaker' || key === 'shadow') return 'shadow-breaker';
  if (key === 'rhythmboxer' || key === 'rhythm') return 'rhythm-boxer';
  if (key === 'jumpduck' || key === 'jump-duck-vr') return 'jump-duck';
  if (key === 'balancehold') return 'balance-hold';
  return GAME[key] ? key : 'shadow-breaker';
}

function asNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeText(value = '') {
  return String(value ?? '').replace(/[<>]/g, '').trim();
}

function escapeHtml(value = '') {
  return safeText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function point(landmarks, index) {
  return landmarks?.[index] || null;
}

function visibility(landmark) {
  const raw = Number(landmark?.visibility ?? landmark?.presence ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: ((a.z || 0) + (b.z || 0)) / 2,
    visibility: Math.min(visibility(a), visibility(b))
  };
}

function distance(a, b) {
  if (!a || !b) return 0;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function angle(a, b, c) {
  if (!a || !b || !c) return 0;
  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const denominator = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (!denominator) return 0;
  const cosine = clamp((abx * cbx + aby * cby) / denominator, -1, 1);
  return Math.acos(cosine) * (180 / Math.PI);
}

function avg(values = []) {
  const valid = values.filter(value => Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function resolveDuration(ctx) {
  const raw = ctx?.params?.get?.('cdur') || ctx?.params?.get?.('gateDuration') || ctx?.time || 60;
  return clamp(Math.round(asNumber(raw, 60)), 30, 120);
}

function confidenceOf(landmarks) {
  const required = [
    IDX.NOSE,
    IDX.L_SHOULDER, IDX.R_SHOULDER,
    IDX.L_HIP, IDX.R_HIP,
    IDX.L_KNEE, IDX.R_KNEE,
    IDX.L_ANKLE, IDX.R_ANKLE
  ].map(index => point(landmarks, index));

  return avg(required.map(visibility));
}

function hasFullBody(landmarks) {
  const nose = point(landmarks, IDX.NOSE);
  const leftAnkle = point(landmarks, IDX.L_ANKLE);
  const rightAnkle = point(landmarks, IDX.R_ANKLE);
  if (!nose || !leftAnkle || !rightAnkle) return false;
  return visibility(nose) > 0.45 && visibility(leftAnkle) > 0.38 && visibility(rightAnkle) > 0.38 &&
    nose.y > 0.01 && Math.max(leftAnkle.y, rightAnkle.y) < 1.035;
}

function bodyCentered(landmarks) {
  const shoulders = midpoint(point(landmarks, IDX.L_SHOULDER), point(landmarks, IDX.R_SHOULDER));
  const hips = midpoint(point(landmarks, IDX.L_HIP), point(landmarks, IDX.R_HIP));
  const center = midpoint(shoulders, hips);
  if (!center) return false;
  return Math.abs(center.x - 0.5) <= 0.25;
}

function poseMetrics(landmarks) {
  const leftShoulder = point(landmarks, IDX.L_SHOULDER);
  const rightShoulder = point(landmarks, IDX.R_SHOULDER);
  const leftHip = point(landmarks, IDX.L_HIP);
  const rightHip = point(landmarks, IDX.R_HIP);
  const leftAnkle = point(landmarks, IDX.L_ANKLE);
  const rightAnkle = point(landmarks, IDX.R_ANKLE);
  const leftKnee = point(landmarks, IDX.L_KNEE);
  const rightKnee = point(landmarks, IDX.R_KNEE);
  const leftElbow = point(landmarks, IDX.L_ELBOW);
  const rightElbow = point(landmarks, IDX.R_ELBOW);
  const leftWrist = point(landmarks, IDX.L_WRIST);
  const rightWrist = point(landmarks, IDX.R_WRIST);
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const hipMid = midpoint(leftHip, rightHip);
  const ankleMid = midpoint(leftAnkle, rightAnkle);
  const shoulderWidth = distance(leftShoulder, rightShoulder) || 0.001;
  const bodyHeight = Math.max(0.001, avg([Math.abs((leftAnkle?.y || 0) - (leftShoulder?.y || 0)), Math.abs((rightAnkle?.y || 0) - (rightShoulder?.y || 0))]));

  return {
    leftShoulder, rightShoulder, leftHip, rightHip, leftAnkle, rightAnkle,
    leftKnee, rightKnee, leftElbow, rightElbow, leftWrist, rightWrist,
    shoulderMid, hipMid, ankleMid, shoulderWidth, bodyHeight,
    leftElbowAngle: angle(leftShoulder, leftElbow, leftWrist),
    rightElbowAngle: angle(rightShoulder, rightElbow, rightWrist),
    leftKneeAngle: angle(leftHip, leftKnee, leftAnkle),
    rightKneeAngle: angle(rightHip, rightKnee, rightAnkle),
    quality: confidenceOf(landmarks),
    fullBody: hasFullBody(landmarks),
    centered: bodyCentered(landmarks)
  };
}

function scaleForDuration(seconds) {
  return clamp(seconds / 60, 0.76, 1.42);
}

function makeWarmupTasks(game, seconds) {
  const scale = scaleForDuration(seconds);
  const reps = Math.max(4, Math.round(7 * scale));
  const holds = Math.round(3 * scale);

  const common = [
    {
      id: 'safety-scan',
      type: 'safety',
      title: 'Safety Scan',
      cue: 'ยืนให้เห็นศีรษะ ไหล่ สะโพก เข่า และข้อเท้าครบ อยู่กลางกรอบกล้อง',
      target: clamp(2.1 * scale, 1.8, 3.4),
      measure: 'sec'
    },
    {
      id: 'march',
      type: 'march',
      title: 'Activate Body',
      cue: 'ย่ำเท้าเบา ๆ สลับซ้าย–ขวา โดยให้ลำตัวตั้งตรง',
      target: reps,
      measure: 'reps'
    }
  ];

  if (game === 'shadow-breaker') {
    return [...common, {
      id: 'punch', type: 'punch', title: 'Punch Ready',
      cue: 'ยกการ์ดระดับอก แล้วชกช้า ๆ สลับแขน โดยไม่เหยียดศอกกระแทก',
      target: reps, measure: 'reps'
    }];
  }

  if (game === 'rhythm-boxer') {
    return [...common, {
      id: 'beat-punch', type: 'punch', title: 'Beat Ready',
      cue: 'ย่ำเท้าตามจังหวะ แล้วออกหมัดสลับซ้าย–ขวาอย่างคุมแรง',
      target: reps + 2, measure: 'reps', beat: true
    }];
  }

  if (game === 'jump-duck') {
    return [...common, {
      id: 'side-step', type: 'side-step', title: 'Side-Step Ready',
      cue: 'ก้าวซ้าย–ขวาเบา ๆ โดยไม่ไขว้เท้า',
      target: reps, measure: 'reps'
    }, {
      id: 'shallow-duck', type: 'duck', title: 'Duck Ready',
      cue: 'ย่อเข่าเล็กน้อยและยืดตัวกลับ ไม่ก้มคออย่างเดียว',
      target: Math.max(3, Math.round(4 * scale)), measure: 'reps'
    }];
  }

  return [...common, {
    id: 'weight-shift', type: 'weight-shift', title: 'Balance Ready',
    cue: 'ถ่ายน้ำหนักซ้าย–ขวาช้า ๆ โดยมองตรงและไม่เอียงไหล่มากเกินไป',
    target: reps, measure: 'reps'
  }, {
    id: 'posture-hold', type: 'recovery-hold', title: 'Posture Check',
    cue: 'ยืนสองเท้า ลำตัวตั้งตรงและนิ่งอย่างผ่อนคลาย',
    target: Math.max(2, holds), measure: 'sec'
  }];
}

function makeCooldownTasks(game, seconds) {
  const scale = scaleForDuration(seconds);
  const slowHold = clamp(4.0 * scale, 3, 6.5);
  const stretchHold = clamp(3.5 * scale, 2.5, 5.5);

  const common = [{
    id: 'slow-down', type: 'recovery-hold', title: 'Slow Down',
    cue: 'เดินอยู่กับที่ช้า ๆ แล้วหยุดยืนอย่างนิ่งก่อนเริ่มยืดเหยียด',
    target: slowHold, measure: 'sec'
  }];

  if (game === 'shadow-breaker') {
    return [...common, {
      id: 'cross-stretch', type: 'cross-stretch', title: 'Shoulder Stretch',
      cue: 'พาดแขนข้ามลำตัว ยืดหัวไหล่ ค้างทั้งสองข้างอย่างนุ่มนวล',
      target: stretchHold, measure: 'sec', sides: 2
    }, {
      id: 'breath', type: 'breath', title: 'Calm Breath',
      cue: 'หายใจเข้าตามวงแสง 3 จังหวะ และหายใจออก 4 จังหวะ',
      target: clamp(7 * scale, 5, 10), measure: 'sec'
    }];
  }

  if (game === 'rhythm-boxer') {
    return [...common, {
      id: 'side-reach', type: 'side-reach', title: 'Side Reach',
      cue: 'ยกแขนเหนือไหล่แล้วเอียงลำตัวเล็กน้อย ค้างสลับทั้งสองข้าง',
      target: stretchHold, measure: 'sec', sides: 2
    }, {
      id: 'breath', type: 'breath', title: 'Slow Beat Breath',
      cue: 'เดินช้า ๆ ตามวงแสง แล้วค่อยหายใจให้จังหวะช้าลง',
      target: clamp(7 * scale, 5, 10), measure: 'sec'
    }];
  }

  if (game === 'jump-duck') {
    return [...common, {
      id: 'wide-stance', type: 'wide-stance', title: 'Leg & Ankle Recovery',
      cue: 'ก้าวเท้าให้มั่นคง กดส้นเท้าเบา ๆ และค้างอย่างไม่ฝืน',
      target: stretchHold + 1, measure: 'sec'
    }, {
      id: 'side-reach', type: 'side-reach', title: 'Side Stretch',
      cue: 'ยืดลำตัวเอียงซ้าย–ขวาอย่างช้า ๆ ค้างสลับทั้งสองด้าน',
      target: stretchHold, measure: 'sec', sides: 2
    }];
  }

  return [...common, {
    id: 'recovery-hold', type: 'recovery-hold', title: 'Recovery Hold',
    cue: 'ยืนสองเท้า ผ่อนหัวไหล่ ลำตัวนิ่งและหายใจสบาย ๆ',
    target: stretchHold + 1, measure: 'sec'
  }, {
    id: 'side-reach', type: 'side-reach', title: 'Side Stretch',
    cue: 'ยกแขนแล้วเอียงลำตัวเล็กน้อย ค้างสลับทั้งสองด้าน',
    target: stretchHold, measure: 'sec', sides: 2
  }, {
    id: 'breath', type: 'breath', title: 'Calm Breath',
    cue: 'หายใจเข้า 3 จังหวะ และออก 4 จังหวะตามวงแสง',
    target: clamp(7 * scale, 5, 10), measure: 'sec'
  }];
}

function makeTasks(game, phase, seconds) {
  return phase === 'cooldown'
    ? makeCooldownTasks(game, seconds)
    : makeWarmupTasks(game, seconds);
}

function makeMarkup(meta, phase, duration) {
  const phaseLabel = phase === 'cooldown' ? 'COOL-DOWN' : 'WARM-UP';
  const title = phase === 'cooldown' ? meta.cooldownTitle : meta.warmupTitle;

  return `
    <section class="frr-shell" data-frr-root>
      <header class="frr-hero">
        <div class="frr-icon" aria-hidden="true">${escapeHtml(meta.emoji)}</div>
        <div>
          <div class="frr-kicker">FITNESS GATE • ${phaseLabel}</div>
          <h2 class="frr-title">${escapeHtml(title)}</h2>
          <p class="frr-sub">Pose Detection จะตรวจการเคลื่อนไหวอย่างปลอดภัย ไม่ใช่การแข่งขันความเร็ว</p>
        </div>
      </header>

      <div class="frr-grid">
        <section class="frr-camera-card">
          <div class="frr-camera-wrap" data-camera-wrap>
            <video class="frr-video" data-video autoplay muted playsinline></video>
            <canvas class="frr-canvas" data-canvas></canvas>
            <div class="frr-camera-empty" data-camera-empty>
              <div class="frr-camera-empty-icon">📷</div>
              <strong>พร้อมตรวจท่าทาง</strong>
              <span>กด “เปิดกล้องและเริ่ม” แล้วถอยให้เห็นร่างกายครบ</span>
            </div>
            <div class="frr-status-pill" data-camera-status>กล้องยังไม่เริ่ม</div>
          </div>
          <div class="frr-camera-hint">ยืนห่างกล้องประมาณ 1.5–2.5 เมตร ให้เห็นตั้งแต่ศีรษะถึงข้อเท้า</div>
        </section>

        <aside class="frr-task-card">
          <div class="frr-task-topline">
            <span class="frr-badge">${escapeHtml(meta.label)}</span>
            <span class="frr-badge frr-badge-muted">เป้าหมาย ${duration} วิ</span>
          </div>
          <div class="frr-progress-track" aria-label="ความคืบหน้าภารกิจ"><span data-overall-progress></span></div>
          <div class="frr-overall" data-overall-label>ภารกิจ 0 / 0</div>

          <div class="frr-task-live" data-task-live>
            <div class="frr-task-count" data-task-count>01</div>
            <div>
              <h3 data-task-title>เตรียมเริ่ม</h3>
              <p data-task-cue>เปิดกล้องเพื่อเริ่มตรวจการเคลื่อนไหว</p>
            </div>
          </div>

          <div class="frr-step-progress">
            <div class="frr-step-progress-row">
              <span data-step-label>รอเริ่ม</span>
              <strong data-step-value>0%</strong>
            </div>
            <div class="frr-step-progress-track"><span data-step-progress></span></div>
          </div>

          <div class="frr-quality-row">
            <span>คุณภาพการตรวจ</span>
            <strong data-quality>รอ Pose</strong>
          </div>
          <div class="frr-quality-detail" data-quality-detail>ตรวจเห็นร่างกายครบและอยู่กลางกรอบก่อน</div>

          <div class="frr-breath-orb" data-breath-orb aria-hidden="true"><span></span></div>
          <div class="frr-safety-note">หยุดทันทีเมื่อเวียนศีรษะ เจ็บหน้าอก ปวดข้อ หรือเหนื่อยผิดปกติ และแจ้งครู/ผู้ดูแล</div>
        </aside>
      </div>

      <footer class="frr-controls">
        <button type="button" class="frr-btn frr-btn-primary" data-start>📷 เปิดกล้องและเริ่ม</button>
        <button type="button" class="frr-btn frr-btn-soft" data-guide hidden>ทำตามคำแนะนำโดยไม่ใช้กล้อง</button>
        <button type="button" class="frr-btn frr-btn-soft" data-retry hidden>ลองตรวจใหม่</button>
        <button type="button" class="frr-btn frr-btn-ghost" data-exit>กลับ Fitness Hub</button>
      </footer>
      <p class="frr-engine-note" data-engine-note>Engine: Ready to initialize</p>
    </section>
  `;
}

function setText(root, selector, value) {
  const node = root.querySelector(selector);
  if (node) node.textContent = String(value ?? '');
}

function setWidth(root, selector, ratio) {
  const node = root.querySelector(selector);
  if (node) node.style.width = `${clamp(ratio, 0, 1) * 100}%`;
}

function getStorageJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function unwrapSnapshot(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const payload = candidate.payload && typeof candidate.payload === 'object' ? candidate.payload : {};
  return { ...payload, ...candidate };
}

function pickFirstNumber(source, keys = []) {
  for (const key of keys) {
    const value = Number(source?.[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function pickFirstText(source, keys = []) {
  for (const key of keys) {
    const value = safeText(source?.[key]);
    if (value) return value;
  }
  return '';
}

function collectMainGameSnapshot(ctx) {
  const game = normalizeGameId(ctx?.game);
  const pid = String(ctx?.pid || 'anon');
  const candidates = [];
  const direct = ctx?.params;

  if (direct?.get) {
    candidates.push({
      score: direct.get('score') || direct.get('scoreFinal'),
      acc: direct.get('acc') || direct.get('accuracy') || direct.get('accPct'),
      combo: direct.get('combo') || direct.get('maxCombo') || direct.get('bestCombo'),
      stars: direct.get('stars'),
      rank: direct.get('rank') || direct.get('grade'),
      result: direct.get('result') || direct.get('outcomeStatus')
    });
  }

  const keys = [
    `HHA_LAST_SUMMARY:${game}:${pid}`,
    `HHA_LAST_SUMMARY:${String(ctx?.game || '')}:${pid}`,
    `HH_FITNESS_LAST_RESULT:${game}:${pid}`,
    `FITNESS_LAST_RESULT:${game}:${pid}`,
    `HHA_FITNESS_LAST_RESULT:${game}:${pid}`,
    'HHA_LAST_SUMMARY'
  ];

  keys.forEach(key => {
    const item = unwrapSnapshot(getStorageJson(key));
    if (item) candidates.push(item);
  });

  try {
    const max = Math.min(localStorage.length, 180);
    for (let index = 0; index < max; index += 1) {
      const key = localStorage.key(index) || '';
      const low = key.toLowerCase();
      if (!low.includes('fitness') && !low.includes('summary') && !low.includes('result')) continue;
      if (!low.includes(game.replace(/-/g, '')) && !low.includes(game)) continue;
      const item = unwrapSnapshot(getStorageJson(key));
      if (item) candidates.push(item);
    }
  } catch {}

  const newest = candidates
    .filter(Boolean)
    .sort((a, b) => pickFirstNumber(b, ['ts', 'timestamp', 'savedAtMs', 'endedAtMs']) - pickFirstNumber(a, ['ts', 'timestamp', 'savedAtMs', 'endedAtMs']))
    .at(0) || {};

  return {
    score: pickFirstNumber(newest, ['scoreFinal', 'score', 'finalScore', 'totalScore']),
    acc: pickFirstNumber(newest, ['accPct', 'accuracy', 'accuracyPct', 'acc']),
    combo: pickFirstNumber(newest, ['maxCombo', 'comboMax', 'bestCombo', 'combo']),
    stars: pickFirstNumber(newest, ['stars', 'starCount']),
    rank: pickFirstText(newest, ['rank', 'grade', 'level']),
    grade: pickFirstText(newest, ['grade', 'rank']),
    result: pickFirstText(newest, ['result', 'outcomeStatus', 'status']) || 'completed'
  };
}

function plannerFlowKeyFromCtx(ctx) {
  const pid = String(ctx?.pid || ctx?.params?.get?.('pid') || 'anon').trim() || 'anon';
  const planId = String(ctx?.params?.get?.('planId') || '').trim();
  const planSlot = String(ctx?.params?.get?.('planSlot') || ctx?.params?.get?.('planDay') || '').trim();
  if (!planId || !planSlot) return '';
  return `HH_FITNESS_PLANNER_FLOW_V1::${pid}::${planId}::${planSlot}`;
}

function writePlannerFlowFromCtx(ctx, phase) {
  const key = plannerFlowKeyFromCtx(ctx);
  if (!key) return;
  try { localStorage.setItem(key, String(phase || '')); } catch {}
}

function buildPlannerReturnHref(ctx, gateResult) {
  const raw = String(ctx?.params?.get?.('plannerReturnUrl') || '').trim();
  if (!raw) return '';

  try {
    const url = new URL(raw, location.href);
    if (url.origin !== location.origin) return '';
    if (!/\/herohealth\/fitness-planner\.html$/i.test(url.pathname)) return '';

    const main = collectMainGameSnapshot(ctx);
    const output = {
      ...main,
      gateStars: gateResult.gateStars,
      gateQuality: gateResult.gateQuality,
      gateDurationSec: gateResult.durationSec,
      gatePoseQuality: gateResult.poseQuality,
      warmupDone: gateResult.phase === 'warmup' ? '1' : url.searchParams.get('warmupDone') || '1',
      cooldownDone: gateResult.phase === 'cooldown' ? '1' : url.searchParams.get('cooldownDone') || '0',
      completedGame: normalizeGameId(ctx?.game),
      game: normalizeGameId(ctx?.game),
      gameId: normalizeGameId(ctx?.game),
      result: main.result || 'completed'
    };

    Object.entries(output).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value) !== '') {
        url.searchParams.set(key, String(value));
      }
    });

    return url.href;
  } catch {
    return '';
  }
}

function drawPose(canvas, video, landmarks) {
  if (!canvas || !video) return;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width * Math.min(window.devicePixelRatio || 1, 2)));
  const height = Math.max(1, Math.round(rect.height * Math.min(window.devicePixelRatio || 1, 2)));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!Array.isArray(landmarks) || !landmarks.length) return;

  const pointAt = index => landmarks[index];
  const links = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]
  ];

  context.lineWidth = Math.max(2, width * 0.006);
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(125, 211, 252, 0.96)';
  context.fillStyle = 'rgba(255, 255, 255, 0.95)';

  links.forEach(([from, to]) => {
    const a = pointAt(from);
    const b = pointAt(to);
    if (!a || !b || visibility(a) < 0.32 || visibility(b) < 0.32) return;
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  });

  [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].forEach(index => {
    const current = pointAt(index);
    if (!current || visibility(current) < 0.32) return;
    context.beginPath();
    context.arc(current.x * width, current.y * height, Math.max(3, width * 0.009), 0, Math.PI * 2);
    context.fill();
  });
}

function taskState(runtime, task) {
  if (!runtime.taskState[task.id]) {
    runtime.taskState[task.id] = {
      startedAt: performance.now(),
      progress: 0,
      reps: 0,
      hold: 0,
      lastSide: '',
      sidesDone: new Set(),
      baseline: null,
      cooldownUntil: 0,
      lastMoveAt: performance.now(),
      phase: 'ready'
    };
  }
  return runtime.taskState[task.id];
}

function countAlternating(state, side, now, minGap = 260) {
  if (!side || now < state.cooldownUntil) return false;
  if (state.lastSide === side) return false;
  state.lastSide = side;
  state.reps += 1;
  state.cooldownUntil = now + minGap;
  return true;
}

function stableMovement(metrics, runtime) {
  const center = midpoint(metrics.shoulderMid, metrics.hipMid);
  if (!center) return 1;
  const previous = runtime.previousCenter;
  runtime.previousCenter = { x: center.x, y: center.y, at: performance.now() };
  if (!previous) return 0;
  return distance(center, previous);
}

function updateTaskFromPose(task, metrics, runtime, dt, now) {
  const state = taskState(runtime, task);
  const qualityOk = metrics.quality >= 0.54 && metrics.fullBody;
  const shoulderMid = metrics.shoulderMid;
  const hipMid = metrics.hipMid;
  const ankleMid = metrics.ankleMid;
  const threshold = Math.max(0.045, metrics.shoulderWidth * 0.42);
  let valid = false;
  let detail = '';

  if (task.type === 'safety') {
    valid = qualityOk && metrics.centered;
    state.hold = valid ? state.hold + dt : 0;
    state.progress = state.hold;
    detail = valid ? 'เห็นร่างกายครบและอยู่กลางกรอบ' : 'ถอยให้เห็นศีรษะถึงข้อเท้า และยืนกลางกรอบ';
  }

  if (task.type === 'march') {
    const left = metrics.leftAnkle;
    const right = metrics.rightAnkle;
    const footDiff = left && right ? left.y - right.y : 0;
    const side = Math.abs(footDiff) > 0.052 ? (footDiff > 0 ? 'left' : 'right') : '';
    valid = qualityOk && !!side;
    if (valid) countAlternating(state, side, now, 300);
    state.progress = state.reps;
    detail = `${state.reps}/${task.target} สลับเท้า`;
  }

  if (task.type === 'punch') {
    const leftReady = metrics.leftElbowAngle > 142 &&
      distance(metrics.leftShoulder, metrics.leftWrist) > metrics.shoulderWidth * 1.28 &&
      Math.abs((metrics.leftWrist?.y || 0) - (metrics.leftShoulder?.y || 0)) < 0.28;
    const rightReady = metrics.rightElbowAngle > 142 &&
      distance(metrics.rightShoulder, metrics.rightWrist) > metrics.shoulderWidth * 1.28 &&
      Math.abs((metrics.rightWrist?.y || 0) - (metrics.rightShoulder?.y || 0)) < 0.28;
    const side = leftReady ? 'left' : (rightReady ? 'right' : '');
    valid = qualityOk && !!side;
    if (valid) countAlternating(state, side, now, task.beat ? 380 : 300);
    state.progress = state.reps;
    detail = `${state.reps}/${task.target} หมัดสลับ`;
  }

  if (task.type === 'side-step' || task.type === 'weight-shift') {
    const center = hipMid?.x;
    if (state.baseline == null && Number.isFinite(center)) state.baseline = center;
    if (Number.isFinite(center) && state.baseline != null) {
      state.baseline = state.baseline * 0.992 + center * 0.008;
      const delta = center - state.baseline;
      const side = Math.abs(delta) > threshold ? (delta > 0 ? 'right' : 'left') : '';
      valid = qualityOk && !!side;
      if (valid) countAlternating(state, side, now, 330);
    }
    state.progress = state.reps;
    detail = `${state.reps}/${task.target} สลับด้าน`;
  }

  if (task.type === 'duck') {
    const nose = point(runtime.landmarks, IDX.NOSE);
    const hip = hipMid;
    if (!state.baseline && nose && hip) state.baseline = { noseY: nose.y, hipY: hip.y };
    if (state.baseline && nose && hip) {
      state.baseline.noseY = state.baseline.noseY * 0.996 + nose.y * 0.004;
      state.baseline.hipY = state.baseline.hipY * 0.996 + hip.y * 0.004;
      const lower = (nose.y - state.baseline.noseY) > 0.035 && (hip.y - state.baseline.hipY) > 0.025;
      const kneesBent = Math.min(metrics.leftKneeAngle, metrics.rightKneeAngle) < 165;
      valid = qualityOk && lower && kneesBent;
      if (valid && state.phase !== 'ducked') {
        state.phase = 'ducked';
        state.reps += 1;
      }
      if (!lower) state.phase = 'ready';
    }
    state.progress = state.reps;
    detail = `${state.reps}/${task.target} ย่อเข่า`;
  }

  if (task.type === 'cross-stretch') {
    const midX = shoulderMid?.x || 0.5;
    const leftCross = metrics.leftWrist && metrics.leftElbowAngle > 132 && metrics.leftWrist.x > midX + metrics.shoulderWidth * 0.12;
    const rightCross = metrics.rightWrist && metrics.rightElbowAngle > 132 && metrics.rightWrist.x < midX - metrics.shoulderWidth * 0.12;
    const side = leftCross ? 'left' : (rightCross ? 'right' : '');
    valid = qualityOk && !!side;
    if (valid) {
      if (state.lastSide !== side) {
        state.lastSide = side;
        state.hold = 0;
      }
      state.hold += dt;
      if (state.hold >= task.target && !state.sidesDone.has(side)) {
        state.sidesDone.add(side);
        state.hold = 0;
        state.lastSide = '';
      }
    } else {
      state.hold = 0;
    }
    state.progress = state.sidesDone.size;
    detail = `ค้าง ${state.sidesDone.size}/${task.sides || 2} ด้าน`;
  }

  if (task.type === 'side-reach') {
    const leftUp = metrics.leftWrist && metrics.leftWrist.y < (metrics.leftShoulder?.y || 1) - 0.08;
    const rightUp = metrics.rightWrist && metrics.rightWrist.y < (metrics.rightShoulder?.y || 1) - 0.08;
    const tilt = Math.abs((shoulderMid?.x || 0.5) - (hipMid?.x || 0.5)) > metrics.shoulderWidth * 0.14;
    const side = leftUp ? 'left' : (rightUp ? 'right' : '');
    valid = qualityOk && !!side && tilt;
    if (valid) {
      if (state.lastSide !== side) {
        state.lastSide = side;
        state.hold = 0;
      }
      state.hold += dt;
      if (state.hold >= task.target && !state.sidesDone.has(side)) {
        state.sidesDone.add(side);
        state.hold = 0;
        state.lastSide = '';
      }
    } else {
      state.hold = 0;
    }
    state.progress = state.sidesDone.size;
    detail = `ค้าง ${state.sidesDone.size}/${task.sides || 2} ด้าน`;
  }

  if (task.type === 'wide-stance') {
    const stance = distance(metrics.leftAnkle, metrics.rightAnkle) > metrics.shoulderWidth * 1.24;
    const movement = stableMovement(metrics, runtime);
    valid = qualityOk && stance && movement < 0.019;
    state.hold = valid ? state.hold + dt : Math.max(0, state.hold - dt * 1.8);
    state.progress = state.hold;
    detail = valid ? 'ก้าวเท้ามั่นคงและค้างอย่างนุ่มนวล' : 'ก้าวเท้าให้มั่นคง แล้วลดการแกว่งลำตัว';
  }

  if (task.type === 'recovery-hold') {
    const shouldersLevel = Math.abs((metrics.leftShoulder?.y || 0) - (metrics.rightShoulder?.y || 0)) < 0.09;
    const movement = stableMovement(metrics, runtime);
    const stable = movement < 0.016;
    valid = qualityOk && shouldersLevel && stable;
    state.hold = valid ? state.hold + dt : Math.max(0, state.hold - dt * 1.6);
    state.progress = state.hold;
    detail = valid ? 'ลำตัวนิ่งและผ่อนคลาย' : 'วางเท้าสองข้างให้มั่นคง แล้วลดการแกว่ง';
  }

  if (task.type === 'breath') {
    valid = metrics.quality >= 0.42;
    state.hold = valid ? state.hold + dt : state.hold;
    state.progress = state.hold;
    detail = 'ระบบนำจังหวะเท่านั้น ไม่วัดการหายใจจากกล้อง';
  }

  const rawTarget = task.type === 'cross-stretch' || task.type === 'side-reach'
    ? (task.sides || 2)
    : task.target;
  const complete = state.progress >= rawTarget;

  return {
    valid,
    complete,
    progress: state.progress,
    target: rawTarget,
    detail,
    ratio: clamp(state.progress / Math.max(0.001, rawTarget), 0, 1)
  };
}

function guidedTaskComplete(runtime, task) {
  const state = taskState(runtime, task);
  const count = task.type === 'cross-stretch' || task.type === 'side-reach' ? (task.sides || 2) : task.target;
  state.progress = count;
  state.hold = count;
  state.reps = count;
  return { complete: true, progress: count, target: count, ratio: 1, detail: 'ทำตามคำแนะนำแล้ว' };
}

function cleanupStream(stream) {
  try {
    stream?.getTracks?.().forEach(track => track.stop());
  } catch {}
}

export function loadStyle() {
  const id = 'fitness-readiness-recovery-inline-helpers';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = '.frr-shell button{font:inherit}.frr-shell *{box-sizing:border-box}';
  document.head.appendChild(style);
}

export async function mount(stage, ctx, api) {
  const game = normalizeGameId(ctx?.game || ctx?.gameRaw);
  const phase = String(ctx?.phase || 'warmup').toLowerCase() === 'cooldown' ? 'cooldown' : 'warmup';
  const meta = GAME[game];
  const duration = resolveDuration(ctx);
  const tasks = makeTasks(game, phase, duration);

  stage.innerHTML = makeMarkup(meta, phase, duration);
  const root = stage.querySelector('[data-frr-root]');
  const video = root.querySelector('[data-video]');
  const canvas = root.querySelector('[data-canvas]');
  const cameraEmpty = root.querySelector('[data-camera-empty]');
  const startButton = root.querySelector('[data-start]');
  const guideButton = root.querySelector('[data-guide]');
  const retryButton = root.querySelector('[data-retry]');
  const exitButton = root.querySelector('[data-exit]');
  const engineNote = root.querySelector('[data-engine-note]');
  const cameraStatus = root.querySelector('[data-camera-status]');
  const breathOrb = root.querySelector('[data-breath-orb]');

  let destroyed = false;
  let stream = null;
  let landmarker = null;
  let rafId = 0;
  let mediaModule = null;
  let mediaVision = null;
  let mediaSource = null;
  let running = false;
  let guided = false;
  let completed = false;

  const runtime = {
    startedAt: performance.now(),
    lastInferenceAt: 0,
    lastFrameAt: performance.now(),
    lastPoseAt: 0,
    landmarks: null,
    previousCenter: null,
    taskIndex: 0,
    taskState: {},
    poseQualitySamples: [],
    visibleFrames: 0,
    validFrames: 0,
    guidedSteps: 0,
    taskStartedAt: performance.now()
  };

  function currentTask() {
    return tasks[runtime.taskIndex] || null;
  }

  function updateHeroStats() {
    const task = currentTask();
    const index = Math.min(runtime.taskIndex + 1, tasks.length);
    const total = tasks.length;
    setText(root, '[data-overall-label]', `ภารกิจ ${index} / ${total}`);
    setWidth(root, '[data-overall-progress]', total ? runtime.taskIndex / total : 0);

    if (!task) return;
    setText(root, '[data-task-title]', task.title);
    setText(root, '[data-task-cue]', task.cue);
    setText(root, '[data-task-count]', String(index).padStart(2, '0'));
    if (breathOrb) breathOrb.classList.toggle('is-breath', task.type === 'breath');
  }

  function updateStep(result) {
    const task = currentTask();
    if (!task || !result) return;
    const unit = task.measure === 'reps' ? 'ครั้ง' : 'วิ';
    const current = Math.min(result.progress, result.target);
    const value = task.measure === 'reps'
      ? `${Math.round(current)} / ${Math.round(result.target)} ${unit}`
      : `${current.toFixed(1)} / ${Number(result.target).toFixed(1)} ${unit}`;
    setText(root, '[data-step-label]', result.detail || task.title);
    setText(root, '[data-step-value]', value);
    setWidth(root, '[data-step-progress]', result.ratio || 0);
  }

  function updateQuality(metrics = null, hint = '') {
    const quality = metrics?.quality || 0;
    const label = guided
      ? 'Guided mode'
      : quality >= 0.74 ? 'ดีมาก' : quality >= 0.57 ? 'ใช้ได้' : 'ต้องปรับตำแหน่ง';
    setText(root, '[data-quality]', label);

    const detail = guided
      ? 'กล้องไม่พร้อม จึงใช้โหมดทำตามคำแนะนำ ผลนี้จะถูกบันทึกเป็น guided'
      : hint || (quality >= 0.57 && metrics?.fullBody && metrics?.centered
        ? 'เห็นร่างกายครบแล้ว ทำท่าช้า ๆ ให้กล้องติดตามได้'
        : 'ถอยให้เห็นตั้งแต่ศีรษะถึงข้อเท้า และยืนกลางกรอบกล้อง');
    setText(root, '[data-quality-detail]', detail);
  }

  function setCameraStatus(message) {
    setText(root, '[data-camera-status]', message);
  }

  function advanceTask() {
    runtime.taskIndex += 1;
    runtime.taskStartedAt = performance.now();
    runtime.previousCenter = null;
    if (runtime.taskIndex >= tasks.length) {
      finishPhase();
      return;
    }
    updateHeroStats();
    updateStep({ progress: 0, target: currentTask().target, ratio: 0, detail: 'เริ่มทำท่าตามคำแนะนำ' });
  }

  function phaseResult() {
    const seconds = Math.max(1, Math.round((performance.now() - runtime.startedAt) / 1000));
    const quality = avg(runtime.poseQualitySamples);
    const poseRatio = runtime.visibleFrames ? runtime.validFrames / runtime.visibleFrames : 0;
    const gateStars = guided ? 1 : quality >= 0.76 && poseRatio >= 0.76 ? 3 : quality >= 0.57 ? 2 : 1;
    const gateQuality = guided
      ? 'guided-fallback'
      : gateStars === 3 ? 'pose-verified' : gateStars === 2 ? 'pose-assisted' : 'pose-limited';

    return {
      phase,
      game,
      durationSec: seconds,
      poseQuality: Math.round(quality * 100),
      poseRatio: Math.round(poseRatio * 100),
      gateStars,
      gateQuality,
      guided
    };
  }

  function finishPhase() {
    if (completed || destroyed) return;
    completed = true;
    stopDetection();

    const result = phaseResult();
    writePlannerFlowFromCtx(ctx, phase === 'cooldown' ? 'done' : 'main');
    const title = phase === 'cooldown' ? 'Hero Recovery Mission สำเร็จ' : 'Hero Ready Mission สำเร็จ';
    const subtitle = phase === 'cooldown'
      ? 'ค่อย ๆ ลดความหนักของการเคลื่อนไหวเรียบร้อยแล้ว'
      : 'ร่างกายพร้อมเข้าสู่เกมหลักแล้ว';
    const lines = [
      `ตรวจ ${tasks.length} ภารกิจครบ`,
      `คุณภาพการติดตาม: ${result.gateQuality} (${result.poseQuality}%)`,
      `Gate Stars: ${'★'.repeat(result.gateStars)}${'☆'.repeat(3 - result.gateStars)}`
    ];

    const payload = {
      title,
      subtitle,
      lines,
      gateStars: result.gateStars,
      gateQuality: result.gateQuality,
      gateDurationSec: result.durationSec,
      gatePoseQuality: result.poseQuality,
      warmupDone: phase === 'warmup' ? 1 : 0,
      cooldownDone: phase === 'cooldown' ? 1 : 0
    };

    if (phase === 'cooldown') {
      const plannerHref = buildPlannerReturnHref(ctx, result);
      if (plannerHref) payload.summaryHref = plannerHref;
    }

    api.complete(payload);
  }

  function stopDetection() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    cleanupStream(stream);
    stream = null;
    try { landmarker?.close?.(); } catch {}
    landmarker = null;
  }

  function showGuidedMode(reason = '') {
    guided = true;
    running = false;
    cleanupStream(stream);
    stream = null;
    try { landmarker?.close?.(); } catch {}
    landmarker = null;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;

    cameraEmpty.hidden = false;
    cameraEmpty.innerHTML = `
      <div class="frr-camera-empty-icon">🧭</div>
      <strong>โหมดทำตามคำแนะนำ</strong>
      <span>${escapeHtml(reason || 'ไม่สามารถใช้กล้องได้ในขณะนี้')}</span>
    `;
    startButton.hidden = true;
    retryButton.hidden = false;
    guideButton.hidden = true;
    setCameraStatus('Guided mode');
    engineNote.textContent = 'Pose engine unavailable • guided fallback enabled';
    updateQuality(null, 'ทำตามท่าอย่างช้า ๆ แล้วกดปุ่มยืนยันแต่ละภารกิจ');
    updateHeroStats();
    updateStep({ progress: 0, target: currentTask()?.target || 1, ratio: 0, detail: 'กด “ยืนยันว่าทำท่านี้แล้ว” เมื่อเสร็จ' });

    let guideNext = root.querySelector('[data-guide-next]');
    if (!guideNext) {
      guideNext = document.createElement('button');
      guideNext.type = 'button';
      guideNext.className = 'frr-btn frr-btn-primary';
      guideNext.dataset.guideNext = '1';
      guideNext.textContent = '✓ ยืนยันว่าทำท่านี้แล้ว';
      root.querySelector('.frr-controls')?.prepend(guideNext);
      guideNext.addEventListener('click', () => {
        const task = currentTask();
        if (!task || completed) return;
        runtime.guidedSteps += 1;
        const result = guidedTaskComplete(runtime, task);
        updateStep(result);
        window.setTimeout(advanceTask, 220);
      });
    }
  }

  async function importVisionBundle() {
    let lastError = null;

    for (const source of MP_SOURCES) {
      try {
        engineNote.textContent = `Loading MediaPipe Pose Landmarker… (${source.name})`;
        const module = await import(/* @vite-ignore */ source.module);

        if (!module?.FilesetResolver || !module?.PoseLandmarker) {
          throw new Error(`Invalid MediaPipe vision bundle from ${source.name}`);
        }

        const vision = await module.FilesetResolver.forVisionTasks(source.wasm);
        return { module, vision, source };
      } catch (error) {
        lastError = error;
        console.warn('[FRR] MediaPipe CDN source failed', source.name, error);
      }
    }

    const details = safeText(lastError?.message || lastError || 'unknown CDN error');
    throw new Error(`โหลด MediaPipe Pose ไม่สำเร็จ (${details})`);
  }

  async function initializePose() {
    // A retry closes only the landmarker. Keep the loaded ESM/WASM runtime and
    // create a fresh PoseLandmarker instance when the user presses Retry.
    if (!mediaModule || !mediaVision || !mediaSource) {
      const loaded = await importVisionBundle();
      mediaModule = loaded.module;
      mediaVision = loaded.vision;
      mediaSource = loaded.source;
    }

    if (landmarker) return mediaModule;

    async function create(delegate) {
      return mediaModule.PoseLandmarker.createFromOptions(mediaVision, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.56,
        minPosePresenceConfidence: 0.56,
        minTrackingConfidence: 0.56
      });
    }

    try {
      landmarker = await create('GPU');
    } catch (gpuError) {
      console.warn('[FRR] GPU delegate unavailable; retrying with CPU', gpuError);
      landmarker = await create('CPU');
    }

    return mediaModule;
  }

  function detectLoop() {
    if (!running || destroyed || !video || !landmarker) return;
    rafId = requestAnimationFrame(detectLoop);

    if (video.readyState < 2) return;
    const now = performance.now();
    if (now - runtime.lastInferenceAt < 95) return;
    const dt = Math.min(0.25, Math.max(0.016, (now - runtime.lastFrameAt) / 1000));
    runtime.lastInferenceAt = now;
    runtime.lastFrameAt = now;

    let result = null;
    try {
      result = landmarker.detectForVideo(video, now);
    } catch (error) {
      console.warn('[FRR] detectForVideo failed', error);
      return;
    }

    const landmarks = result?.landmarks?.[0] || null;
    runtime.landmarks = landmarks;
    drawPose(canvas, video, landmarks);

    if (!landmarks) {
      updateQuality(null, 'ยังไม่พบร่างกาย ลองเพิ่มแสงหรือถอยห่างจากกล้อง');
      setCameraStatus('กำลังค้นหาร่างกาย');
      return;
    }

    const metrics = poseMetrics(landmarks);
    runtime.visibleFrames += 1;
    runtime.poseQualitySamples.push(metrics.quality);
    if (runtime.poseQualitySamples.length > 180) runtime.poseQualitySamples.shift();
    if (metrics.quality >= 0.54 && metrics.fullBody) runtime.validFrames += 1;
    runtime.lastPoseAt = now;

    const task = currentTask();
    if (!task) return;
    const status = updateTaskFromPose(task, metrics, runtime, dt, now);
    updateQuality(metrics);
    updateStep(status);
    setCameraStatus(status.valid ? 'กำลังตรวจท่าทาง' : 'ปรับท่าเล็กน้อย');
    engineNote.textContent = `MediaPipe Pose active • ${mediaSource?.name || 'CDN'} • ${PATCH}`;

    if (status.complete) {
      setCameraStatus('ผ่านภารกิจแล้ว');
      window.setTimeout(() => {
        if (!completed && currentTask() === task) advanceTask();
      }, 360);
    }
  }

  async function startCamera() {
    if (running || destroyed) return;
    startButton.disabled = true;
    startButton.textContent = 'กำลังเปิดกล้อง…';
    retryButton.hidden = true;
    guideButton.hidden = true;
    setCameraStatus('กำลังขออนุญาตกล้อง');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับกล้องสำหรับ MediaPipe');
      }

      await initializePose();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 960 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 30 }
        }
      });

      video.srcObject = stream;
      await video.play();
      cameraEmpty.hidden = true;
      running = true;
      runtime.startedAt = performance.now();
      runtime.lastFrameAt = performance.now();
      setCameraStatus('กล้องพร้อม • ยืนในกรอบ');
      engineNote.textContent = `MediaPipe Pose active • ${mediaSource?.name || 'CDN'} • ${PATCH}`;
      startButton.hidden = true;
      updateHeroStats();
      detectLoop();
    } catch (error) {
      console.error('[FRR] start camera failed', error);
      startButton.hidden = true;
      guideButton.hidden = false;
      retryButton.hidden = false;
      setCameraStatus('เปิดกล้องไม่สำเร็จ');
      engineNote.textContent = `Camera unavailable: ${safeText(error?.message || error)}`;
      updateQuality(null, 'อนุญาตกล้องผ่าน HTTPS หรือใช้โหมดทำตามคำแนะนำ');
    } finally {
      startButton.disabled = false;
      if (!startButton.hidden) startButton.textContent = '📷 เปิดกล้องและเริ่ม';
    }
  }

  function resetForRetry() {
    stopDetection();
    guided = false;
    completed = false;
    runtime.taskIndex = 0;
    runtime.taskState = {};
    runtime.poseQualitySamples = [];
    runtime.visibleFrames = 0;
    runtime.validFrames = 0;
    runtime.previousCenter = null;
    runtime.startedAt = performance.now();
    cameraEmpty.hidden = false;
    cameraEmpty.innerHTML = `
      <div class="frr-camera-empty-icon">📷</div>
      <strong>พร้อมตรวจท่าทาง</strong>
      <span>กด “เปิดกล้องและเริ่ม” แล้วถอยให้เห็นร่างกายครบ</span>
    `;
    root.querySelector('[data-guide-next]')?.remove();
    startButton.hidden = false;
    guideButton.hidden = true;
    retryButton.hidden = true;
    setCameraStatus('กล้องยังไม่เริ่ม');
    engineNote.textContent = 'Engine: Ready to initialize';
    updateHeroStats();
  }

  startButton.addEventListener('click', startCamera);
  guideButton.addEventListener('click', () => showGuidedMode('ผู้เรียนเลือกใช้โหมดทำตามคำแนะนำ'));
  retryButton.addEventListener('click', resetForRetry);
  exitButton.addEventListener('click', () => {
    stopDetection();
    api.goHub();
  });

  updateHeroStats();
  updateQuality(null);
  setText(root, '[data-task-count]', '01');

  return () => {
    destroyed = true;
    stopDetection();
    try { stage.innerHTML = ''; } catch {}
  };
}

export default mount;
