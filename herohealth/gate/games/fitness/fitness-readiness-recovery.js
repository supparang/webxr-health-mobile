// === /herohealth/gate/games/fitness/fitness-readiness-recovery.js ===
// FULL MODULE v20260622-FITNESS-READINESS-RECOVERY-NONBLOCKING-MOBILE-V17
// Full replacement: Fitness Gate warmup/cooldown with MediaPipe Pose + preview canvas.
// The preview canvas draws camera frames directly, avoiding black <video> rendering
// in some Chrome/WebXR environments.

const PATCH = 'v20260622-FITNESS-READINESS-RECOVERY-NONBLOCKING-MOBILE-V17';

const MP = {
  module: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  model: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
};

const IDX = {
  NOSE: 0,
  LS: 11,
  RS: 12,
  LE: 13,
  RE: 14,
  LW: 15,
  RW: 16,
  LH: 23,
  RH: 24,
  LK: 25,
  RK: 26,
  LA: 27,
  RA: 28
};

const GAME_META = {
  'shadow-breaker': {
    label: 'Shadow Breaker',
    emoji: '🥊',
    warm: 'Hero Ready • Punch Power',
    cool: 'Hero Recovery • Arms & Shoulders'
  },
  'rhythm-boxer': {
    label: 'Rhythm Boxer',
    emoji: '🎵',
    warm: 'Hero Ready • Beat Control',
    cool: 'Hero Recovery • Rhythm Reset'
  },
  'jump-duck': {
    label: 'JumpDuck',
    emoji: '🦘',
    warm: 'Hero Ready • Agility',
    cool: 'Hero Recovery • Legs & Ankles'
  },
  'balance-hold': {
    label: 'Balance Hold',
    emoji: '⚖️',
    warm: 'Hero Ready • Stability',
    cool: 'Hero Recovery • Calm Balance'
  }
};

function clean(v) {
  return String(v == null ? '' : v).trim();
}

function normGame(v) {
  const x = clean(v).toLowerCase().replace(/[_\s]+/g, '-');

  if (x === 'shadowbreaker' || x === 'shadow') return 'shadow-breaker';
  if (x === 'rhythmboxer' || x === 'rhythm') return 'rhythm-boxer';
  if (x === 'jumpduck') return 'jump-duck';
  if (x === 'balancehold') return 'balance-hold';

  return GAME_META[x] ? x : 'shadow-breaker';
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, Number(n) || 0));
}

function esc(v) {
  return clean(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function p(l, i) {
  return l && l[i] ? l[i] : null;
}

function vis(x) {
  const n = Number(x && (x.visibility != null ? x.visibility : x.presence));
  return Number.isFinite(n) ? n : 0;
}

function dist(a, b) {
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
}

function mid(a, b) {
  return a && b
    ? {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      }
    : null;
}

function avg(xs) {
  const a = xs.filter(Number.isFinite);
  return a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
}

function angle(a, b, c) {
  if (!a || !b || !c) return 0;

  const abx = a.x - b.x;
  const aby = a.y - b.y;
  const cbx = c.x - b.x;
  const cby = c.y - b.y;
  const d = Math.hypot(abx, aby) * Math.hypot(cbx, cby);

  return d
    ? Math.acos(clamp((abx * cbx + aby * cby) / d, -1, 1)) * 180 / Math.PI
    : 0;
}

function now() {
  return performance.now();
}

function taskList(game, phase, duration) {
  const scale = clamp(duration / 60, 0.75, 1.4);
  const reps = Math.max(5, Math.round(7 * scale));
  const hold = clamp(3.5 * scale, 2.5, 6);

  const safety = {
    id: 'safety',
    type: 'safety',
    title: 'Safety Scan',
    cue: 'ยืนให้เห็นศีรษะ ไหล่ และสะโพกอยู่กลางกรอบ',
    target: 2.2,
    unit: 'วิ'
  };

  if (phase === 'cooldown') {
    if (game === 'rhythm-boxer') {
      return [
        safety,
        {
          id: 'reach',
          type: 'reach',
          title: 'Side Reach',
          cue: 'ยกแขนเหนือไหล่แล้วเอียงตัวเบา ๆ สลับซ้าย–ขวา',
          target: 2,
          unit: 'ด้าน',
          hold
        },
        {
          id: 'breath',
          type: 'breath',
          title: 'Slow Beat Breath',
          cue: 'หายใจเข้า 3 จังหวะ ออก 4 จังหวะ',
          target: clamp(7 * scale, 5, 10),
          unit: 'วิ'
        }
      ];
    }

    if (game === 'jump-duck') {
      return [
        safety,
        {
          id: 'stance',
          type: 'stance',
          title: 'Leg Recovery',
          cue: 'ยืนมั่นคง ผ่อนหัวไหล่และเข่า',
          target: hold + 1,
          unit: 'วิ'
        },
        {
          id: 'reach',
          type: 'reach',
          title: 'Side Stretch',
          cue: 'ยืดลำตัวซ้าย–ขวาช้า ๆ',
          target: 2,
          unit: 'ด้าน',
          hold
        }
      ];
    }

    return [
      safety,
      {
        id: 'cross',
        type: 'cross',
        title: 'Shoulder Stretch',
        cue: 'พาดแขนข้ามลำตัว ค้างสลับสองข้าง',
        target: 2,
        unit: 'ด้าน',
        hold
      },
      {
        id: 'breath',
        type: 'breath',
        title: 'Calm Breath',
        cue: 'หายใจช้า ๆ ตามวงแสง',
        target: clamp(7 * scale, 5, 10),
        unit: 'วิ'
      }
    ];
  }

  if (game === 'rhythm-boxer') {
    return [
      safety,
      {
        id: 'arms',
        type: 'arms',
        title: 'Activate Arms',
        cue: 'เปิดแขนหรือยกมือสลับซ้าย–ขวา',
        target: reps,
        unit: 'ครั้ง'
      },
      {
        id: 'punch',
        type: 'punch',
        title: 'Beat Ready',
        cue: 'ขยับมือซ้าย–ขวาสลับจังหวะอย่างนุ่มนวล ไม่ต้องเหยียดศอกสุด',
        target: reps + 2,
        unit: 'ครั้ง'
      }
    ];
  }

  if (game === 'shadow-breaker') {
    return [
      safety,
      {
        id: 'arms',
        type: 'arms',
        title: 'Activate Arms',
        cue: 'เปิดแขนสลับซ้าย–ขวา',
        target: reps,
        unit: 'ครั้ง'
      },
      {
        id: 'punch',
        type: 'punch',
        title: 'Punch Ready',
        cue: 'ยกการ์ดแล้วชกช้า ๆ สลับแขน',
        target: reps,
        unit: 'ครั้ง'
      }
    ];
  }

  if (game === 'jump-duck') {
    return [
      safety,
      {
        id: 'march',
        type: 'march',
        title: 'Activate Legs',
        cue: 'ยกเข่าหรือย่ำเท้าสลับเบา ๆ',
        target: reps,
        unit: 'ครั้ง'
      },
      {
        id: 'duck',
        type: 'duck',
        title: 'Duck Ready',
        cue: 'ย่อเข่าเล็กน้อยแล้วกลับขึ้นตรง',
        target: Math.max(3, Math.round(4 * scale)),
        unit: 'ครั้ง'
      }
    ];
  }

  return [
    safety,
    {
      id: 'shift',
      type: 'shift',
      title: 'Balance Ready',
      cue: 'ถ่ายน้ำหนักซ้าย–ขวาช้า ๆ',
      target: reps,
      unit: 'ครั้ง'
    },
    {
      id: 'stance',
      type: 'stance',
      title: 'Posture Check',
      cue: 'ยืนสองเท้า ลำตัวตั้งตรงและนิ่ง',
      target: hold,
      unit: 'วิ'
    }
  ];
}

function markup(meta, phase, duration) {
  const title = phase === 'cooldown' ? meta.cool : meta.warm;

  return `
  <section class="frr-shell" data-root>
    <header class="frr-hero">
      <div class="frr-icon">${esc(meta.emoji)}</div>
      <div>
        <div class="frr-kicker">
          FITNESS GATE • ${phase === 'cooldown' ? 'COOL-DOWN' : 'WARM-UP'}
        </div>
        <h2 class="frr-title">${esc(title)}</h2>
        <p class="frr-sub">
          Pose Detection ตรวจการเคลื่อนไหวอย่างปลอดภัย ไม่ใช่การแข่งขันความเร็ว
        </p>
      </div>
    </header>

    <div class="frr-grid">
      <section class="frr-camera-card">
        <div class="frr-camera-wrap">
          <canvas class="frr-preview" data-preview aria-hidden="true"></canvas>
          <video class="frr-video" data-video autoplay muted playsinline></video>
          <canvas class="frr-canvas" data-canvas></canvas>

          <div class="frr-frame-guide" data-guide>
            <div class="frr-frame-silhouette"></div>
            <div class="frr-frame-floor"></div>
          </div>

          <div class="frr-frame-mode">กรอบช่วงบน</div>

          <div class="frr-frame-checks">
            <span data-check="head">○ ศีรษะ</span>
            <span data-check="shoulders">○ ไหล่</span>
            <span data-check="hips">○ สะโพก</span>
          </div>

          <div class="frr-camera-empty" data-empty>
            <div class="frr-camera-empty-icon">📷</div>
            <strong>พร้อมตรวจท่าทาง</strong>
            <span>กดเปิดกล้องแล้วจัดตัวให้อยู่ในกรอบ</span>
          </div>

          <div class="frr-camera-task" data-camera-task>
            Warm-up 1/3 • เตรียมเริ่ม
          </div>

          <button
            type="button"
            class="frr-camera-confirm"
            data-camera-confirm
            hidden
          >
            ✓ ทำท่าแล้ว ไปต่อ
          </button>

          <div class="frr-status-pill" data-status>กล้องยังไม่เริ่ม</div>
        </div>

        <div class="frr-camera-hint" data-hint>
          ไม่ต้องเห็นขาเต็มตัว • ให้เห็นศีรษะ ไหล่ สะโพก และมือ
        </div>
      </section>

      <aside class="frr-task-card">
        <div class="frr-task-topline">
          <span class="frr-badge">${esc(meta.label)}</span>
          <span class="frr-badge frr-badge-muted">
            เป้าหมาย ${duration} วิ
          </span>
        </div>

        <div class="frr-progress-track">
          <span data-allbar></span>
        </div>

        <div class="frr-overall" data-alllabel>ภารกิจ 1 / 3</div>

        <div class="frr-task-live">
          <div class="frr-task-count" data-no>01</div>
          <div>
            <h3 data-title>เตรียมเริ่ม</h3>
            <p data-cue>เปิดกล้องเพื่อเริ่ม</p>
          </div>
        </div>

        <div class="frr-step-progress">
          <div class="frr-step-progress-row">
            <span data-step>รอเริ่ม</span>
            <strong data-value>0%</strong>
          </div>

          <div class="frr-step-progress-track">
            <span data-bar></span>
          </div>
        </div>

        <div class="frr-quality-row">
          <span>คุณภาพการตรวจ</span>
          <strong data-quality>รอ Pose</strong>
        </div>

        <div class="frr-quality-detail" data-detail>
          เริ่มด้วยการเปิดกล้อง
        </div>

        <div class="frr-breath-orb" data-orb><span></span></div>

        <div class="frr-safety-note">
          หยุดทันทีเมื่อเวียนศีรษะ เจ็บหน้าอก ปวดข้อ หรือเหนื่อยผิดปกติ
          และแจ้งครู/ผู้ดูแล
        </div>

        <footer class="frr-controls frr-controls-in-card">
          <button class="frr-btn frr-btn-primary" data-start>
            📷 เปิดกล้องและเริ่ม
          </button>

          <button class="frr-btn frr-btn-soft" data-skip hidden>
            ✓ ผ่านภารกิจนี้
          </button>

          <button class="frr-btn frr-btn-soft" data-guided hidden>
            ทำตามคำแนะนำโดยไม่ใช้กล้อง
          </button>

          <button class="frr-btn frr-btn-soft" data-retry hidden>
            ลองตรวจใหม่
          </button>

          <button class="frr-btn frr-btn-ghost" data-exit>
            กลับ Fitness Hub
          </button>
        </footer>
      </aside>
    </div>

    <p class="frr-engine-note" data-engine>
      Engine: camera + Pose ready
    </p>
  </section>`;
}

function fit(canvas) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);

  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  return { w: width, h: height };
}

function drawPreview(preview, video) {
  if (!preview || !video || video.readyState < 2 || !video.videoWidth) return;

  const { w, h } = fit(preview);
  const context = preview.getContext('2d');

  if (!context) return;

  context.clearRect(0, 0, w, h);
  context.drawImage(video, 0, 0, w, h);
}

function drawPose(canvas, preview, video, landmarks) {
  drawPreview(preview, video);

  const { w, h } = fit(canvas);
  const context = canvas.getContext('2d');

  if (!context) return;

  context.clearRect(0, 0, w, h);

  if (!landmarks) return;

  const links = [
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
    [11, 23],
    [12, 24],
    [23, 24],
    [23, 25],
    [25, 27],
    [24, 26],
    [26, 28]
  ];

  context.lineWidth = Math.max(2, w * 0.006);
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(125,211,252,.96)';
  context.fillStyle = 'rgba(255,255,255,.95)';

  links.forEach(([from, to]) => {
    const a = p(landmarks, from);
    const b = p(landmarks, to);

    if (!a || !b || vis(a) < 0.32 || vis(b) < 0.32) return;

    context.beginPath();
    context.moveTo(a.x * w, a.y * h);
    context.lineTo(b.x * w, b.y * h);
    context.stroke();
  });

  [
    0, 11, 12, 13, 14, 15, 16,
    23, 24, 25, 26, 27, 28
  ].forEach(index => {
    const point = p(landmarks, index);

    if (!point || vis(point) < 0.32) return;

    context.beginPath();
    context.arc(
      point.x * w,
      point.y * h,
      Math.max(3, w * 0.009),
      0,
      Math.PI * 2
    );
    context.fill();
  });
}

export function loadStyle() {
  if (document.getElementById('frr-v13-inline')) return;

  const style = document.createElement('style');
  style.id = 'frr-v13-inline';

  style.textContent = `
    .frr-preview{
      position:absolute;
      inset:0;
      z-index:1;
      width:100%;
      height:100%;
      pointer-events:none;
      transform:scaleX(-1);
      background:#020617;
    }

    .frr-video{
      z-index:0 !important;
      opacity:0 !important;
      pointer-events:none !important;
    }

    .frr-canvas{
      z-index:3 !important;
      background:transparent !important;
    }

    .frr-frame-guide{
      z-index:4 !important;
    }

    .frr-frame-checks,
    .frr-frame-mode,
    .frr-status-pill,
    .frr-camera-empty{
      z-index:6 !important;
    }

    .frr-camera-task{
      position:absolute;
      z-index:8;
      left:12px;
      bottom:54px;
      max-width:calc(100% - 24px);
      padding:7px 10px;
      border:1px solid rgba(125,211,252,.30);
      border-radius:12px;
      background:rgba(2,6,23,.78);
      color:#e0f2fe;
      font-size:12px;
      font-weight:900;
      line-height:1.25;
      backdrop-filter:blur(8px);
    }

    .frr-camera-confirm{
      position:absolute;
      z-index:10;
      right:12px;
      bottom:12px;
      min-height:42px;
      padding:8px 12px;
      border:1px solid rgba(134,239,172,.66);
      border-radius:13px;
      background:linear-gradient(135deg,#bbf7d0,#4ade80);
      color:#052e16;
      font:inherit;
      font-size:13px;
      font-weight:1000;
      box-shadow:0 10px 22px rgba(34,197,94,.23);
    }

    @media (max-width:520px){
      .frr-camera-task{
        left:8px;
        bottom:58px;
        font-size:11px;
      }

      .frr-camera-confirm{
        right:8px;
        bottom:10px;
        min-height:40px;
        padding:7px 10px;
        font-size:12px;
      }
    }
  `;

  document.head.appendChild(style);
}

export async function mount(stage, ctx, api) {
  const game = normGame(ctx && ctx.game);

  const phase =
    String((ctx && ctx.phase) || 'warmup').toLowerCase() === 'cooldown'
      ? 'cooldown'
      : 'warmup';

  const meta = GAME_META[game];
  const duration = clamp(Number(ctx && ctx.time) || 60, 30, 120);
  const tasks = taskList(game, phase, duration);

  stage.innerHTML = markup(meta, phase, duration);

  const root = stage.querySelector('[data-root]');
  const video = root.querySelector('[data-video]');
  const preview = root.querySelector('[data-preview]');
  const canvas = root.querySelector('[data-canvas]');
  const q = selector => root.querySelector(selector);

  const refs = {
    empty: q('[data-empty]'),
    status: q('[data-status]'),
    start: q('[data-start]'),
    guided: q('[data-guided]'),
    retry: q('[data-retry]'),
    skip: q('[data-skip]'),
    cameraConfirm: q('[data-camera-confirm]'),
    cameraTask: q('[data-camera-task]'),
    exit: q('[data-exit]'),
    engine: q('[data-engine]')
  };

  let running = false;
  let destroyed = false;
  let guided = false;
  let done = false;
  let stream = null;
  let landmarker = null;
  let vision = null;
  let module = null;
  let raf = 0;
  let last = 0;
  let index = 0;
  let lastSide = '';
  let cooldown = 0;
  let hold = 0;
  let reps = 0;
  let sides = new Set();
  let baseline = null;
  let poseQuality = [];
  let valid = 0;
  let frames = 0;

  let previousWrist = { L: null, R: null };
  let wristAnchor = { L: null, R: null };
  let advanceQueued = false;
  let taskStartedAt = 0;
  let assistedTasks = 0;

  function task() {
    return tasks[index];
  }

  function set(selector, value) {
    const node = q(selector);
    if (node) node.textContent = value;
  }

  function bar(selector, ratio) {
    const node = q(selector);
    if (node) node.style.width = `${clamp(ratio, 0, 1) * 100}%`;
  }

  function update(landmarks) {
    const current = task();
    if (!current) return;

    set('[data-alllabel]', `ภารกิจ ${index + 1} / ${tasks.length}`);
    bar('[data-allbar]', index / tasks.length);
    set('[data-no]', String(index + 1).padStart(2, '0'));
    set('[data-title]', current.title);
    set('[data-cue]', current.cue);

    if (refs.cameraTask) {
      refs.cameraTask.textContent = `Warm-up ${index + 1}/${tasks.length} • ${current.title}`;
    }

    const head = vis(p(landmarks, IDX.NOSE)) > 0.4;

    const shoulders =
      vis(p(landmarks, IDX.LS)) > 0.4 &&
      vis(p(landmarks, IDX.RS)) > 0.4;

    const hips =
      vis(p(landmarks, IDX.LH)) > 0.38 &&
      vis(p(landmarks, IDX.RH)) > 0.38;

    [
      ['head', head],
      ['shoulders', shoulders],
      ['hips', hips]
    ].forEach(([key, isReady]) => {
      const node = q(`[data-check="${key}"]`);

      if (!node) return;

      const label =
        key === 'head'
          ? 'ศีรษะ'
          : key === 'shoulders'
            ? 'ไหล่'
            : 'สะโพก';

      node.textContent = `${isReady ? '✓' : '○'} ${label}`;
      node.classList.toggle('is-ready', isReady);
    });

    const ready = head && shoulders && hips;

    const quality = landmarks
      ? avg([
          vis(p(landmarks, IDX.NOSE)),
          vis(p(landmarks, IDX.LS)),
          vis(p(landmarks, IDX.RS)),
          vis(p(landmarks, IDX.LH)),
          vis(p(landmarks, IDX.RH))
        ])
      : 0;

    set(
      '[data-quality]',
      guided
        ? 'Guided mode'
        : ready && quality > 0.6
          ? 'ดีมาก'
          : ready
            ? 'ใช้ได้'
            : 'จัดตำแหน่ง'
    );

    set(
      '[data-detail]',
      guided
        ? 'โหมดทำตามคำแนะนำ'
        : ready
          ? 'พร้อมแล้ว • ทำท่าช้า ๆ ให้กล้องติดตามได้'
          : 'ให้เห็นศีรษะ ไหล่ และสะโพกอยู่กลางกรอบ'
    );

    const orb = q('[data-orb]');
    if (orb) {
      orb.classList.toggle('is-breath', current.type === 'breath');
    }

    if (running && !guided && !advanceQueued) {
      if (refs.skip) {
        refs.skip.hidden = (now() - taskStartedAt) < 6500;
      }

      if (refs.cameraConfirm) {
        const selfConfirmTask = current.type !== 'safety';

        refs.cameraConfirm.hidden = !selfConfirmTask;

        refs.cameraConfirm.textContent =
          current.type === 'breath'
            ? '✓ หายใจครบแล้ว ไปต่อ'
            : '✓ ทำท่าแล้ว ไปต่อ';
      }
    }
  }

  function step(progress, target, detail) {
    const current = task();
    const ratio = clamp(progress / Math.max(0.001, target), 0, 1);

    set('[data-step]', detail);

    const shown = `${
      current.unit === 'วิ'
        ? progress.toFixed(1)
        : Math.round(progress)
    } / ${target} ${current.unit}`;

    set('[data-value]', shown);
    bar('[data-bar]', ratio);

    if (refs.cameraTask) {
      refs.cameraTask.textContent =
        `Warm-up ${index + 1}/${tasks.length} • ${current.title} • ${shown}`;
    }
  }

  function next() {
    index++;
    lastSide = '';
    hold = 0;
    reps = 0;
    sides = new Set();
    baseline = null;
    previousWrist = { L: null, R: null };
    wristAnchor = { L: null, R: null };
    advanceQueued = false;
    taskStartedAt = now();

    if (refs.skip) refs.skip.hidden = true;
    if (refs.cameraConfirm) refs.cameraConfirm.hidden = true;

    if (index >= tasks.length) {
      finish();
      return;
    }

    update(null);
    step(0, task().target, 'เริ่มทำท่าตามคำแนะนำ');
  }

  function completeTask(result) {
    if (!result) return;

    step(result.progress, result.target, result.detail);

    if (result.progress >= result.target && !advanceQueued) {
      advanceQueued = true;

      if (refs.skip) refs.skip.hidden = true;
      if (refs.cameraConfirm) refs.cameraConfirm.hidden = true;

      window.setTimeout(() => {
        if (!destroyed && !done) next();
      }, 360);
    }
  }

  function score(landmarks, dt, time) {
    const current = task();
    if (!current) return;

    const ls = p(landmarks, IDX.LS);
    const rs = p(landmarks, IDX.RS);
    const lh = p(landmarks, IDX.LH);
    const rh = p(landmarks, IDX.RH);
    const lw = p(landmarks, IDX.LW);
    const rw = p(landmarks, IDX.RW);
    const la = p(landmarks, IDX.LA);
    const ra = p(landmarks, IDX.RA);

    const ready = !!(
      p(landmarks, IDX.NOSE) &&
      ls &&
      rs &&
      lh &&
      rh &&
      vis(p(landmarks, IDX.NOSE)) > 0.4 &&
      vis(ls) > 0.4 &&
      vis(rs) > 0.4 &&
      vis(lh) > 0.35 &&
      vis(rh) > 0.35
    );

    const shoulderMid = mid(ls, rs);
    const hipMid = mid(lh, rh);
    const shoulderWidth = dist(ls, rs) || 0.001;

    let progress = 0;
    let detail = '';

    if (current.type === 'safety') {
      const stable = ready;

      hold = stable ? hold + dt : 0;
      progress = hold;

      detail = stable
        ? 'ตรวจพบร่างกายแล้ว • พร้อมเริ่ม'
        : 'จัดศีรษะ ไหล่ และสะโพกให้อยู่ในกรอบ';
    } else if (
      current.type === 'stance' ||
      current.type === 'breath'
    ) {
      const stable = ready;

      hold = stable ? hold + dt : 0;
      progress = hold;

      detail = stable
        ? 'ลำตัวนิ่งและอยู่ในกรอบ'
        : 'จัดตัวให้อยู่กลางกรอบ';
    } else if (
      current.type === 'arms' ||
      current.type === 'punch'
    ) {
      const upperReady = !!(
        p(landmarks, IDX.NOSE) &&
        ls &&
        rs &&
        vis(p(landmarks, IDX.NOSE)) > 0.34 &&
        vis(ls) > 0.34 &&
        vis(rs) > 0.34
      );

      const moveFromAnchor = (side, wrist) => {
        if (!wrist || vis(wrist) < 0.30) return 0;

        const anchor = wristAnchor[side];

        if (!anchor) {
          wristAnchor[side] = {
            x: wrist.x,
            y: wrist.y,
            at: time
          };

          return 0;
        }

        const age = time - anchor.at;

        const moved = Math.hypot(
          wrist.x - anchor.x,
          wrist.y - anchor.y
        );

        if (age > 950 && moved < 0.010) {
          wristAnchor[side] = {
            x: wrist.x,
            y: wrist.y,
            at: time
          };

          return 0;
        }

        return moved;
      };

      const leftMove = moveFromAnchor('L', lw);
      const rightMove = moveFromAnchor('R', rw);

      const threshold = current.type === 'punch'
        ? 0.018
        : 0.015;

      const left = !!(lw && leftMove >= threshold);
      const right = !!(rw && rightMove >= threshold);

      let side = '';

      if (left && right) {
        side = leftMove >= rightMove ? 'L' : 'R';
      } else if (left) {
        side = 'L';
      } else if (right) {
        side = 'R';
      }

      if (upperReady && side && time > cooldown) {
        const alternate = side !== lastSide;

        const repeatAfterBeat =
          side === lastSide &&
          time > cooldown + 380;

        if (alternate || repeatAfterBeat) {
          reps++;
          lastSide = side;
          cooldown = time + (current.type === 'punch' ? 300 : 250);

          const wrist = side === 'L' ? lw : rw;

          if (wrist) {
            wristAnchor[side] = {
              x: wrist.x,
              y: wrist.y,
              at: time
            };
          }
        }
      }

      progress = reps;

      detail = reps
        ? `${reps}/${current.target} จังหวะมือ`
        : 'ยกหรือเลื่อนมือซ้าย/ขวาช้า ๆ หนึ่งครั้ง';
    } else if (
      current.type === 'march' ||
      current.type === 'duck' ||
      current.type === 'shift'
    ) {
      const center = hipMid ? hipMid.x : 0.5;

      if (baseline == null) baseline = center;

      baseline = baseline * 0.99 + center * 0.01;

      let side = '';

      if (current.type === 'march' && la && ra) {
        side =
          Math.abs(la.y - ra.y) > 0.035
            ? la.y > ra.y
              ? 'L'
              : 'R'
            : '';
      } else if (
        current.type === 'duck' &&
        shoulderMid &&
        hipMid
      ) {
        side = shoulderMid.y - hipMid.y > 0.17 ? 'D' : '';
      } else {
        side =
          Math.abs(center - baseline) > shoulderWidth * 0.3
            ? center > baseline
              ? 'R'
              : 'L'
            : '';
      }

      if (
        ready &&
        side &&
        (side !== lastSide || current.type === 'duck') &&
        time > cooldown
      ) {
        reps++;
        lastSide = side;
        cooldown = time + 320;
      }

      progress = reps;

      detail = `${reps}/${current.target} ${
        current.type === 'duck' ? 'ย่อเข่า' : 'สลับ'
      }`;
    } else if (
      current.type === 'reach' ||
      current.type === 'cross'
    ) {
      const left = lw && ls && lw.y < ls.y - 0.06;
      const right = rw && rs && rw.y < rs.y - 0.06;
      const side = left ? 'L' : right ? 'R' : '';

      if (ready && side) {
        if (side !== lastSide) {
          lastSide = side;
          hold = 0;
        }

        hold += dt;

        if (
          hold >= current.hold &&
          !sides.has(side)
        ) {
          sides.add(side);
          hold = 0;
          lastSide = '';
        }
      } else {
        hold = 0;
      }

      progress = sides.size;
      detail = `ค้าง ${progress}/2 ด้าน`;
    }

    completeTask({
      progress,
      target: current.target,
      detail
    });
  }

  function stop() {
    running = false;

    if (raf) cancelAnimationFrame(raf);
    raf = 0;

    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (_) {}

    stream = null;

    try {
      if (landmarker) landmarker.close();
    } catch (_) {}

    landmarker = null;
  }

  function finish() {
    if (done) return;

    done = true;
    stop();

    const quality = avg(poseQuality);

    const stars = guided
      ? 1
      : quality > 0.75 && valid / Math.max(1, frames) > 0.7
        ? 3
        : quality > 0.55
          ? 2
          : 1;

    api.complete({
      title:
        phase === 'cooldown'
          ? 'Hero Recovery Mission สำเร็จ'
          : 'Hero Ready Mission สำเร็จ',

      subtitle:
        phase === 'cooldown'
          ? 'ค่อย ๆ ลดความหนักเรียบร้อยแล้ว'
          : 'ร่างกายพร้อมเข้าสู่เกมหลักแล้ว',

      gateStars: stars,

      gateQuality: guided
        ? 'guided-fallback'
        : assistedTasks > 0
          ? 'pose-assisted'
          : stars === 3
            ? 'pose-verified'
            : 'pose-assisted',

      gatePoseQuality: Math.round(quality * 100),

      gateDurationSec:
        Math.round((now() - last) / 1000) || duration,

      gateAssistedTasks: assistedTasks,

      warmupDone: phase === 'warmup' ? 1 : 0,
      cooldownDone: phase === 'cooldown' ? 1 : 0
    });
  }

  function guidedMode(reason) {
    stop();

    guided = true;
    refs.empty.hidden = false;

    refs.empty.innerHTML = `
      <div class="frr-camera-empty-icon">🧭</div>
      <strong>โหมดทำตามคำแนะนำ</strong>
      <span>${esc(reason || 'กล้องไม่พร้อม')}</span>
    `;

    refs.start.hidden = true;
    refs.guided.hidden = true;
    refs.retry.hidden = false;
    refs.status.textContent = 'Guided mode';
    refs.engine.textContent = 'Pose unavailable • guided fallback';

    update(null);

    let button = q('[data-confirm]');

    if (!button) {
      button = document.createElement('button');
      button.className = 'frr-btn frr-btn-primary';
      button.dataset.confirm = '1';
      button.textContent = '✓ ยืนยันว่าทำท่านี้แล้ว';

      q('.frr-controls').prepend(button);

      button.onclick = () => {
        completeTask({
          progress: task().target,
          target: task().target,
          detail: 'ทำตามคำแนะนำแล้ว'
        });
      };
    }
  }

  async function start() {
    refs.start.disabled = true;
    refs.start.textContent = 'กำลังเปิดกล้อง…';
    refs.status.textContent = 'กำลังขออนุญาตกล้อง';

    try {
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

      video.style.opacity = '0';
      video.style.pointerEvents = 'none';

      preview.style.display = 'block';
      preview.style.visibility = 'visible';
      preview.style.opacity = '1';

      await new Promise(resolve => {
        if (video.readyState >= 2 && video.videoWidth) {
          resolve();
          return;
        }

        video.addEventListener('loadeddata', resolve, { once: true });
        setTimeout(resolve, 1200);
      });

      refs.empty.hidden = true;
      refs.status.textContent = 'กล้องพร้อม • กำลังโหลด Pose';
      refs.engine.textContent = 'Camera ready • Loading MediaPipe Pose…';

      module = await import(MP.module);
      vision = await module.FilesetResolver.forVisionTasks(MP.wasm);

      try {
        landmarker = await module.PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: MP.model,
              delegate: 'GPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.56,
            minPosePresenceConfidence: 0.56,
            minTrackingConfidence: 0.56
          }
        );
      } catch (_) {
        landmarker = await module.PoseLandmarker.createFromOptions(
          vision,
          {
            baseOptions: {
              modelAssetPath: MP.model,
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.56,
            minPosePresenceConfidence: 0.56,
            minTrackingConfidence: 0.56
          }
        );
      }

      running = true;
      last = now();
      taskStartedAt = now();
      advanceQueued = false;

      if (refs.skip) refs.skip.hidden = true;
      if (refs.cameraConfirm) refs.cameraConfirm.hidden = true;

      let lastInfer = 0;
      let lastFrame = now();

      refs.start.hidden = true;
      refs.status.textContent = 'กล้องพร้อม • ยืนในกรอบ';
      refs.engine.textContent = `MediaPipe Pose active • ${PATCH}`;

      update(null);

      const loop = () => {
        if (!running || destroyed) return;

        raf = requestAnimationFrame(loop);

        const time = now();

        if (video.readyState < 2 || time - lastInfer < 90) return;

        const dt = Math.min(
          0.25,
          Math.max(0.016, (time - lastFrame) / 1000)
        );

        lastInfer = time;
        lastFrame = time;

        let result;

        try {
          result = landmarker.detectForVideo(video, time);
        } catch (_) {
          return;
        }

        const landmarks =
          result &&
          result.landmarks &&
          result.landmarks[0]
            ? result.landmarks[0]
            : null;

        drawPose(canvas, preview, video, landmarks);
        update(landmarks);

        if (!landmarks) {
          refs.status.textContent = 'กำลังค้นหาร่างกาย';
          return;
        }

        frames++;

        const quality = avg([
          vis(p(landmarks, IDX.NOSE)),
          vis(p(landmarks, IDX.LS)),
          vis(p(landmarks, IDX.RS)),
          vis(p(landmarks, IDX.LH)),
          vis(p(landmarks, IDX.RH))
        ]);

        poseQuality.push(quality);

        if (poseQuality.length > 180) {
          poseQuality.shift();
        }

        if (quality > 0.5) {
          valid++;
        }

        refs.status.textContent = 'กำลังตรวจท่าทาง';

        score(landmarks, dt, time);
      };

      loop();
    } catch (error) {
      console.warn('[FRR] start failed', error);

      refs.start.hidden = true;
      refs.guided.hidden = false;
      refs.retry.hidden = false;
      refs.status.textContent = 'เปิดกล้องไม่สำเร็จ';
      refs.engine.textContent =
        `Camera unavailable: ${clean(error && error.message || error)}`;

      update(null);
    } finally {
      refs.start.disabled = false;

      if (!refs.start.hidden) {
        refs.start.textContent = '📷 เปิดกล้องและเริ่ม';
      }
    }
  }

  function retry() {
    stop();

    guided = false;
    done = false;
    index = 0;
    lastSide = '';
    hold = 0;
    reps = 0;
    sides = new Set();
    baseline = null;
    previousWrist = { L: null, R: null };
    wristAnchor = { L: null, R: null };
    advanceQueued = false;
    taskStartedAt = 0;
    assistedTasks = 0;
    poseQuality = [];
    valid = 0;
    frames = 0;

    const confirmButton = q('[data-confirm]');
    if (confirmButton) confirmButton.remove();

    refs.empty.hidden = false;

    refs.empty.innerHTML = `
      <div class="frr-camera-empty-icon">📷</div>
      <strong>พร้อมตรวจท่าทาง</strong>
      <span>กดเปิดกล้องแล้วจัดตัวให้อยู่ในกรอบ</span>
    `;

    refs.start.hidden = false;
    refs.guided.hidden = true;
    refs.retry.hidden = true;

    if (refs.skip) refs.skip.hidden = true;
    if (refs.cameraConfirm) refs.cameraConfirm.hidden = true;

    refs.status.textContent = 'กล้องยังไม่เริ่ม';
    refs.engine.textContent = 'Engine: camera + Pose ready';

    update(null);
  }

  refs.start.onclick = start;

  refs.guided.onclick = () => {
    guidedMode('ผู้เรียนเลือกใช้โหมดทำตามคำแนะนำ');
  };

  refs.retry.onclick = retry;

  const completeWithConfirm = () => {
    if (done || !task()) return;

    assistedTasks++;

    completeTask({
      progress: task().target,
      target: task().target,
      detail: 'ยืนยันว่าทำท่าแล้ว'
    });
  };

  if (refs.skip) {
    refs.skip.onclick = completeWithConfirm;
  }

  if (refs.cameraConfirm) {
    refs.cameraConfirm.onclick = completeWithConfirm;
  }

  refs.exit.onclick = () => {
    stop();
    api.goHub();
  };

  update(null);

  return () => {
    destroyed = true;
    stop();

    try {
      stage.innerHTML = '';
    } catch (_) {}
  };
}

export default mount;