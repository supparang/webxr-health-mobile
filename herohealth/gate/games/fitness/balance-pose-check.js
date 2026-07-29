// === /herohealth/gate/games/fitness/balance-pose-check.js ===
// Balance Hold pre-game readiness check: camera + upper-body pose calibration only.
// This is intentionally NOT a warm-up activity.

const PATCH = 'v20260729-BALANCE-POSE-CHECK-R1';
const TARGET_SECONDS = 2.2;

const MP = {
  module: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs',
  wasm: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm',
  model: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
};

const IDX = { NOSE: 0, LS: 11, RS: 12, LH: 23, RH: 24 };

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function visibility(point) {
  const value = Number(point && (point.visibility != null ? point.visibility : point.presence));
  return Number.isFinite(value) ? value : 0;
}

function point(landmarks, index) {
  return landmarks && landmarks[index] ? landmarks[index] : null;
}

function now() {
  return performance.now();
}

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const density = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * density));
  const height = Math.max(1, Math.round(rect.height * density));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

function drawPreview(preview, video) {
  if (!preview || !video || video.readyState < 2 || !video.videoWidth) return;
  const { width, height } = fitCanvas(preview);
  const context = preview.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.drawImage(video, 0, 0, width, height);
}

function drawPose(canvas, preview, video, landmarks) {
  drawPreview(preview, video);
  const { width, height } = fitCanvas(canvas);
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, width, height);
  if (!landmarks) return;

  const links = [[11, 12], [11, 23], [12, 24], [23, 24]];
  context.lineWidth = Math.max(3, width * 0.007);
  context.lineCap = 'round';
  context.strokeStyle = 'rgba(125,211,252,.96)';
  context.fillStyle = 'rgba(255,255,255,.96)';

  links.forEach(([aIndex, bIndex]) => {
    const a = point(landmarks, aIndex);
    const b = point(landmarks, bIndex);
    if (!a || !b || visibility(a) < 0.28 || visibility(b) < 0.28) return;
    context.beginPath();
    context.moveTo(a.x * width, a.y * height);
    context.lineTo(b.x * width, b.y * height);
    context.stroke();
  });

  [0, 11, 12, 23, 24].forEach(index => {
    const item = point(landmarks, index);
    if (!item || visibility(item) < 0.28) return;
    context.beginPath();
    context.arc(item.x * width, item.y * height, Math.max(4, width * 0.011), 0, Math.PI * 2);
    context.fill();
  });
}

function targetHref(ctx) {
  try {
    const raw = clean(ctx && ctx.next) || '/webxr-health-mobile/fitness/balance-hold-ar2.html';
    const url = new URL(raw, location.href);
    if (/warmup-gate\.html/i.test(url.pathname)) {
      return new URL('/webxr-health-mobile/fitness/balance-hold-ar2.html', location.origin).toString();
    }
    url.searchParams.set('warmupDone', '1');
    url.searchParams.set('gateWarmupDone', '1');
    url.searchParams.set('poseCheckDone', '1');
    url.searchParams.set('fromGate', '1');
    url.searchParams.set('gatePatch', PATCH);
    return url.toString();
  } catch (_) {
    return '/webxr-health-mobile/fitness/balance-hold-ar2.html?warmupDone=1&gateWarmupDone=1&poseCheckDone=1&fromGate=1';
  }
}

export function loadStyle() {
  if (document.getElementById('balance-pose-check-r1')) return;
  const style = document.createElement('style');
  style.id = 'balance-pose-check-r1';
  style.textContent = `
    .bhpc-shell{max-width:760px!important;margin:0 auto!important;padding-bottom:calc(18px + env(safe-area-inset-bottom,0px))!important}
    .bhpc-shell .frr-grid{grid-template-columns:1fr!important;gap:14px!important}
    .bhpc-shell .frr-camera-wrap{min-height:min(58dvh,560px)!important}
    .bhpc-shell .frr-task-card{display:block!important}
    .bhpc-shell .frr-breath-orb,.bhpc-shell .frr-safety-note{display:none!important}
    .bhpc-shell .frr-camera-task{bottom:54px!important}
    .bhpc-pose-ready{color:#bbf7d0!important;border-color:rgba(74,222,128,.55)!important;background:rgba(20,83,45,.78)!important}
    @media (max-width:520px){
      .bhpc-shell{padding:12px 10px calc(16px + env(safe-area-inset-bottom,0px))!important}
      .bhpc-shell .frr-hero{padding:14px!important;gap:12px!important}
      .bhpc-shell .frr-title{font-size:clamp(25px,8vw,34px)!important;line-height:1.06!important}
      .bhpc-shell .frr-sub{font-size:14px!important;line-height:1.45!important}
      .bhpc-shell .frr-camera-wrap{min-height:52dvh!important}
      .bhpc-shell .frr-task-card{padding:14px!important}
      .bhpc-shell .frr-controls{gap:8px!important}
      .bhpc-shell .frr-btn{min-height:48px!important}
    }
  `;
  document.head.appendChild(style);
}

function markup() {
  return `
    <section class="frr-shell bhpc-shell" data-root>
      <header class="frr-hero">
        <div class="frr-icon">⚖️</div>
        <div>
          <div class="frr-kicker">FITNESS GATE • POSE CHECK</div>
          <h2 class="frr-title">Balance Hold • ตรวจความพร้อม</h2>
          <p class="frr-sub">เปิดกล้องและยืนให้อยู่ในกรอบประมาณ 3 วินาที ระบบจะเริ่มเกมให้อัตโนมัติ</p>
        </div>
      </header>

      <div class="frr-grid">
        <section class="frr-camera-card">
          <div class="frr-camera-wrap">
            <canvas class="frr-preview" data-preview aria-hidden="true"></canvas>
            <video class="frr-video" data-video autoplay muted playsinline></video>
            <canvas class="frr-canvas" data-canvas></canvas>
            <div class="frr-frame-guide"><div class="frr-frame-silhouette"></div><div class="frr-frame-floor"></div></div>
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
            <div class="frr-camera-task" data-camera-task>Pose Check 1/1 • รอเปิดกล้อง</div>
            <div class="frr-status-pill" data-status>กล้องยังไม่เริ่ม</div>
          </div>
          <div class="frr-camera-hint">ไม่ต้องทำท่าออกกำลังกาย • เพียงให้เห็นศีรษะ ไหล่ และสะโพก</div>
        </section>

        <aside class="frr-task-card">
          <div class="frr-task-topline">
            <span class="frr-badge">Balance Hold</span>
            <span class="frr-badge frr-badge-muted">ประมาณ 3 วิ</span>
          </div>
          <div class="frr-progress-track"><span data-allbar></span></div>
          <div class="frr-overall" data-alllabel>ตรวจความพร้อม 1 / 1</div>
          <div class="frr-task-live">
            <div class="frr-task-count">01</div>
            <div><h3>จัดตำแหน่งร่างกาย</h3><p>ยืนตรงและมองกล้อง ไม่ต้องยกขาหรือถ่ายน้ำหนัก</p></div>
          </div>
          <div class="frr-step-progress">
            <div class="frr-step-progress-row"><span data-step>รอเปิดกล้อง</span><strong data-value>0%</strong></div>
            <div class="frr-step-progress-track"><span data-bar></span></div>
          </div>
          <div class="frr-quality-row"><span>คุณภาพการตรวจ</span><strong data-quality>รอ Pose</strong></div>
          <div class="frr-quality-detail" data-detail>ระบบจะเข้าเกมทันทีเมื่อตรวจพบช่วงบนครบ</div>
          <footer class="frr-controls frr-controls-in-card">
            <button class="frr-btn frr-btn-primary" data-start>📷 เปิดกล้องและตรวจท่าทาง</button>
            <button class="frr-btn frr-btn-soft" data-continue hidden>เล่นต่อโดยไม่ใช้กล้อง</button>
            <button class="frr-btn frr-btn-soft" data-retry hidden>ลองเปิดกล้องใหม่</button>
            <button class="frr-btn frr-btn-ghost" data-exit>กลับ Fitness Hub</button>
          </footer>
        </aside>
      </div>
      <p class="frr-engine-note" data-engine>Engine: camera + Pose readiness</p>
    </section>
  `;
}

export async function mount(stage, ctx, api) {
  loadStyle();
  stage.innerHTML = markup();

  const root = stage.querySelector('[data-root]');
  const query = selector => root.querySelector(selector);
  const video = query('[data-video]');
  const preview = query('[data-preview]');
  const canvas = query('[data-canvas]');
  const empty = query('[data-empty]');
  const status = query('[data-status]');
  const cameraTask = query('[data-camera-task]');
  const startButton = query('[data-start]');
  const continueButton = query('[data-continue]');
  const retryButton = query('[data-retry]');
  const exitButton = query('[data-exit]');
  const engine = query('[data-engine]');
  const nextUrl = targetHref(ctx);

  let destroyed = false;
  let running = false;
  let done = false;
  let stream = null;
  let landmarker = null;
  let raf = 0;
  let stableSeconds = 0;
  let startedAt = 0;
  let totalFrames = 0;
  let validFrames = 0;
  let qualitySum = 0;
  let fallbackTimer = 0;

  function setText(selector, value) {
    const node = query(selector);
    if (node) node.textContent = value;
  }

  function setProgress(ratio) {
    const value = clamp(ratio, 0, 1);
    const bar = query('[data-bar]');
    const allBar = query('[data-allbar]');
    if (bar) bar.style.width = `${value * 100}%`;
    if (allBar) allBar.style.width = `${value * 100}%`;
    setText('[data-value]', `${Math.round(value * 100)}%`);
  }

  function setCheck(name, ready, label) {
    const node = query(`[data-check="${name}"]`);
    if (!node) return;
    node.textContent = `${ready ? '✓' : '○'} ${label}`;
    node.classList.toggle('is-ready', ready);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (fallbackTimer) clearTimeout(fallbackTimer);
    fallbackTimer = 0;
    try { if (stream) stream.getTracks().forEach(track => track.stop()); } catch (_) {}
    stream = null;
    try { if (landmarker) landmarker.close(); } catch (_) {}
    landmarker = null;
  }

  function finish(source, assisted) {
    if (done) return;
    done = true;
    stop();

    const averageQuality = totalFrames ? qualitySum / totalFrames : 0;
    status.textContent = assisted ? 'พร้อมเข้าสู่เกม' : 'ตรวจพบท่าทางแล้ว';
    cameraTask.textContent = '✓ Pose Check สำเร็จ • กำลังเข้า Balance Hold';
    cameraTask.classList.add('bhpc-pose-ready');
    setProgress(1);
    setText('[data-step]', assisted ? 'ข้ามการตรวจกล้อง' : 'ตรวจความพร้อมสำเร็จ');
    setText('[data-quality]', assisted ? 'Manual continue' : 'พร้อม');
    setText('[data-detail]', 'กำลังเปิดเกม Balance Hold');

    const payload = {
      title: 'ตรวจความพร้อมสำเร็จ',
      subtitle: assisted ? 'เข้าสู่เกมโดยไม่ใช้การตรวจกล้อง' : 'กล้องตรวจพบศีรษะ ไหล่ และสะโพกแล้ว',
      gateStars: assisted ? 1 : averageQuality > 0.72 ? 3 : 2,
      gateQuality: assisted ? 'manual-fallback' : 'pose-verified',
      gatePoseQuality: Math.round(averageQuality * 100),
      gateDurationSec: Math.max(1, Math.round((now() - startedAt) / 1000)),
      gateAssistedTasks: assisted ? 1 : 0,
      warmupDone: 1,
      poseCheckDone: 1,
      gateFinalizer: source,
      gatePatch: PATCH
    };

    try {
      if (api && typeof api.complete === 'function') api.complete(payload);
    } catch (error) {
      console.warn('[BalancePoseCheck] core completion failed', error);
    }

    window.setTimeout(() => {
      if (destroyed) return;
      try {
        if (/warmup-gate\.html/i.test(location.pathname)) location.replace(nextUrl);
      } catch (_) {}
    }, 320);
  }

  function revealFallback(message) {
    continueButton.hidden = false;
    retryButton.hidden = false;
    setText('[data-detail]', message || 'กล้องยังตรวจไม่สำเร็จ สามารถเล่นต่อได้');
  }

  async function start() {
    startButton.disabled = true;
    startButton.textContent = 'กำลังเปิดกล้อง…';
    continueButton.hidden = true;
    retryButton.hidden = true;
    status.textContent = 'กำลังขออนุญาตกล้อง';
    engine.textContent = `Loading MediaPipe Pose • ${PATCH}`;
    stableSeconds = 0;
    setProgress(0);

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
      await new Promise(resolve => {
        if (video.readyState >= 2 && video.videoWidth) return resolve();
        video.addEventListener('loadeddata', resolve, { once: true });
        setTimeout(resolve, 1200);
      });

      empty.hidden = true;
      status.textContent = 'กล้องพร้อม • กำลังโหลด Pose';
      const module = await import(MP.module);
      const vision = await module.FilesetResolver.forVisionTasks(MP.wasm);

      try {
        landmarker = await module.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MP.model, delegate: 'GPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.50,
          minPosePresenceConfidence: 0.50,
          minTrackingConfidence: 0.50
        });
      } catch (_) {
        landmarker = await module.PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MP.model, delegate: 'CPU' },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.50,
          minPosePresenceConfidence: 0.50,
          minTrackingConfidence: 0.50
        });
      }

      running = true;
      startedAt = now();
      totalFrames = 0;
      validFrames = 0;
      qualitySum = 0;
      startButton.hidden = true;
      status.textContent = 'ยืนให้อยู่ในกรอบ';
      engine.textContent = `MediaPipe Pose active • ${PATCH}`;

      fallbackTimer = window.setTimeout(() => {
        if (!done && running) revealFallback('ตรวจนานเกิน 8 วินาที สามารถเล่นต่อได้โดยไม่ต้องรอ');
      }, 8000);

      let lastInfer = 0;
      let lastFrame = now();

      const loop = () => {
        if (!running || destroyed) return;
        raf = requestAnimationFrame(loop);
        const time = now();
        if (video.readyState < 2 || time - lastInfer < 90) return;

        const delta = Math.min(0.24, Math.max(0.016, (time - lastFrame) / 1000));
        lastInfer = time;
        lastFrame = time;

        let result;
        try {
          result = landmarker.detectForVideo(video, time);
        } catch (_) {
          return;
        }

        const landmarks = result && result.landmarks && result.landmarks[0] || null;
        drawPose(canvas, preview, video, landmarks);

        if (!landmarks) {
          stableSeconds = Math.max(0, stableSeconds - delta * 0.6);
          setProgress(stableSeconds / TARGET_SECONDS);
          status.textContent = 'กำลังค้นหาร่างกาย';
          cameraTask.textContent = 'Pose Check 1/1 • จัดตัวให้อยู่ในกรอบ';
          return;
        }

        const head = visibility(point(landmarks, IDX.NOSE)) > 0.34;
        const shoulders = visibility(point(landmarks, IDX.LS)) > 0.34 && visibility(point(landmarks, IDX.RS)) > 0.34;
        const hips = visibility(point(landmarks, IDX.LH)) > 0.30 && visibility(point(landmarks, IDX.RH)) > 0.30;
        const ready = head && shoulders && hips;
        const quality = (
          visibility(point(landmarks, IDX.NOSE)) +
          visibility(point(landmarks, IDX.LS)) +
          visibility(point(landmarks, IDX.RS)) +
          visibility(point(landmarks, IDX.LH)) +
          visibility(point(landmarks, IDX.RH))
        ) / 5;

        totalFrames += 1;
        qualitySum += quality;
        if (ready) validFrames += 1;

        setCheck('head', head, 'ศีรษะ');
        setCheck('shoulders', shoulders, 'ไหล่');
        setCheck('hips', hips, 'สะโพก');

        if (ready) {
          stableSeconds += delta;
          status.textContent = 'ตรวจพบช่วงบนแล้ว';
          setText('[data-step]', 'ยืนนิ่งอีกเล็กน้อย');
          setText('[data-quality]', quality > 0.66 ? 'ดีมาก' : 'ใช้ได้');
          setText('[data-detail]', 'ไม่ต้องทำท่าออกกำลังกาย ระบบกำลังตรวจตำแหน่ง');
        } else {
          stableSeconds = Math.max(0, stableSeconds - delta * 0.45);
          status.textContent = 'ปรับตำแหน่งเล็กน้อย';
          setText('[data-step]', 'ให้เห็นจุดที่ยังไม่ครบ');
          setText('[data-quality]', 'จัดตำแหน่ง');
          setText('[data-detail]', 'ให้เห็นศีรษะ ไหล่ และสะโพกอยู่กลางกรอบ');
        }

        const ratio = stableSeconds / TARGET_SECONDS;
        setProgress(ratio);
        cameraTask.textContent = `Pose Check 1/1 • ${Math.min(100, Math.round(ratio * 100))}%`;

        if (stableSeconds >= TARGET_SECONDS && validFrames >= 8) {
          finish('pose-ready', false);
        }
      };

      loop();
    } catch (error) {
      console.warn('[BalancePoseCheck] start failed', error);
      stop();
      status.textContent = 'เปิดกล้องไม่สำเร็จ';
      engine.textContent = `Camera unavailable • ${clean(error && error.message)}`;
      empty.hidden = false;
      empty.innerHTML = '<div class="frr-camera-empty-icon">🧭</div><strong>กล้องไม่พร้อม</strong><span>กดเล่นต่อได้โดยไม่เสียสิทธิ์</span>';
      startButton.hidden = true;
      revealFallback('กล้องไม่พร้อม แต่ยังสามารถเข้าเกม Balance Hold ได้');
    } finally {
      startButton.disabled = false;
      if (!startButton.hidden) startButton.textContent = '📷 เปิดกล้องและตรวจท่าทาง';
    }
  }

  function retry() {
    stop();
    done = false;
    stableSeconds = 0;
    empty.hidden = false;
    empty.innerHTML = '<div class="frr-camera-empty-icon">📷</div><strong>พร้อมตรวจท่าทาง</strong><span>กดเปิดกล้องแล้วจัดตัวให้อยู่ในกรอบ</span>';
    startButton.hidden = false;
    continueButton.hidden = true;
    retryButton.hidden = true;
    status.textContent = 'กล้องยังไม่เริ่ม';
    cameraTask.textContent = 'Pose Check 1/1 • รอเปิดกล้อง';
    engine.textContent = 'Engine: camera + Pose readiness';
    setProgress(0);
    setText('[data-step]', 'รอเปิดกล้อง');
    setText('[data-quality]', 'รอ Pose');
    setText('[data-detail]', 'ระบบจะเข้าเกมทันทีเมื่อตรวจพบช่วงบนครบ');
    ['head', 'shoulders', 'hips'].forEach((name, index) => {
      setCheck(name, false, index === 0 ? 'ศีรษะ' : index === 1 ? 'ไหล่' : 'สะโพก');
    });
  }

  startButton.onclick = start;
  continueButton.onclick = () => finish('manual-continue', true);
  retryButton.onclick = retry;
  exitButton.onclick = () => {
    stop();
    try {
      if (api && typeof api.goHub === 'function') api.goHub();
      else location.href = '/webxr-health-mobile/herohealth/fitness-zone.html';
    } catch (_) {
      location.href = '/webxr-health-mobile/herohealth/fitness-zone.html';
    }
  };

  return () => {
    destroyed = true;
    stop();
    try { stage.innerHTML = ''; } catch (_) {}
  };
}

export default mount;
