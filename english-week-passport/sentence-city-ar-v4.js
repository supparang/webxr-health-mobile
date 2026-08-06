(function () {
  "use strict";

  const VERSION = "2026-08-06-SENTENCE-CITY-AR-HAND-V4";
  const SPECIAL_INDEXES = Object.freeze([2, 5, 8]);
  const MP = Object.freeze({
    module: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs",
    wasm: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    model: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
  });

  const game = window.SENTENCE_CITY;
  const screen = document.getElementById("screen");
  if (!game || !screen) {
    console.error("Sentence City AR V4: base V3 engine is missing");
    return;
  }

  const state = game.state;
  const metrics = {
    version: VERSION,
    plannedMissionIndexes: SPECIAL_INDEXES.map(index => index + 1),
    missionsSeen: [],
    missionsAttempted: [],
    missionsCompleted: [],
    fallbackMissions: [],
    cameraStartCount: 0,
    handDetectedCount: 0,
    firstHandLatencyMs: [],
    pinchCount: 0,
    targetActionCount: 0,
    targetMissCount: 0,
    detectorErrors: [],
    totalArMs: 0
  };

  const runtime = {
    key: "",
    taskId: "",
    special: false,
    stream: null,
    detector: null,
    video: null,
    pointer: null,
    raf: 0,
    lastVideoTime: -1,
    lastPinch: false,
    lastActionAt: 0,
    firstHandAt: 0,
    startedAt: 0,
    missingSince: 0,
    activeTarget: null,
    starting: false,
    running: false,
    fallback: false,
    observerTimer: 0
  };

  state.arMetrics = metrics;
  window.SENTENCE_CITY_AR_METRICS = metrics;

  function uniquePush(list, value) {
    if (value && !list.includes(value)) list.push(value);
  }

  function pushEvent(eventName, payload) {
    if (!Array.isArray(state.events)) return;
    state.events.push({
      phase: state.phase,
      itemId: currentTask()?.id || runtime.taskId,
      eventName,
      arVersion: VERSION,
      arAtMs: Date.now(),
      ...(payload || {})
    });
  }

  function currentTask() {
    return state.tasks?.[state.index] || null;
  }

  function missionKey() {
    const task = currentTask();
    return task ? `${state.phase}:${state.index}:${task.id}` : "";
  }

  function isSpecialMission() {
    return state.phase === "main" && SPECIAL_INDEXES.includes(Number(state.index));
  }

  function ensurePointer() {
    if (runtime.pointer?.isConnected) return runtime.pointer;
    const pointer = document.createElement("div");
    pointer.id = "sentenceArPointer";
    pointer.hidden = true;
    document.body.appendChild(pointer);
    runtime.pointer = pointer;
    return pointer;
  }

  function clearFocus() {
    document.querySelectorAll(".ew-ar-focus").forEach(element => element.classList.remove("ew-ar-focus"));
    runtime.activeTarget = null;
  }

  function eligibleAt(x, y) {
    const element = document.elementFromPoint(x, y);
    const target = element?.closest?.(".word-chip:not(.used),.sentence-slot,#checkBtn,#hintBtn,#speakTask");
    if (!target || target.disabled) return null;
    return target;
  }

  function distance(a, b) {
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 99;
  }

  function statusText(message, detail) {
    const guide = document.getElementById("sentenceArGuide");
    if (!guide) return;
    guide.innerHTML = `${message}${detail ? `<small>${detail}</small>` : ""}`;
  }

  function markTarget(target) {
    clearFocus();
    if (target) {
      target.classList.add("ew-ar-focus");
      runtime.activeTarget = target;
    }
  }

  function processHand(result) {
    const pointer = ensurePointer();
    const landmarks = result?.landmarks?.[0];
    if (!landmarks) {
      pointer.hidden = true;
      clearFocus();
      runtime.lastPinch = false;
      if (!runtime.missingSince) runtime.missingSince = performance.now();
      if (performance.now() - runtime.missingSince > 2600) {
        statusText("ยังไม่พบมือ", "ยกมือหนึ่งข้างให้เห็นนิ้วโป้งและนิ้วชี้ในภาพกล้อง");
      }
      return;
    }

    if (!runtime.firstHandAt) {
      runtime.firstHandAt = performance.now();
      metrics.handDetectedCount += 1;
      metrics.firstHandLatencyMs.push(Math.round(runtime.firstHandAt - runtime.startedAt));
      pushEvent("ar_hand_detected", { detectionLatencyMs: Math.round(runtime.firstHandAt - runtime.startedAt) });
    }

    runtime.missingSince = 0;
    const indexTip = landmarks[8];
    const thumbTip = landmarks[4];
    const x = (1 - indexTip.x) * window.innerWidth;
    const y = indexTip.y * window.innerHeight;
    pointer.hidden = false;
    pointer.style.transform = `translate3d(${x}px,${y}px,0)`;

    const target = eligibleAt(x, y);
    markTarget(target);

    const gap = distance(indexTip, thumbTip);
    const pinch = runtime.lastPinch ? gap < 0.076 : gap < 0.052;
    pointer.classList.toggle("pinching", pinch);

    if (target) {
      const label = String(target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 34);
      statusText(`เล็งที่ “${label}”`, "จีบนิ้วโป้งกับนิ้วชี้หนึ่งครั้งเพื่อเลือกหรือวาง");
    } else {
      statusText("ขยับนิ้วชี้ไปยังบล็อกคำหรือช่องก่อสร้าง", "เมื่อกรอบสีเหลืองปรากฏ ให้จีบนิ้วหนึ่งครั้ง");
    }

    if (pinch && !runtime.lastPinch && performance.now() - runtime.lastActionAt > 430) {
      metrics.pinchCount += 1;
      runtime.lastActionAt = performance.now();
      if (target) {
        metrics.targetActionCount += 1;
        target.click();
        target.classList.remove("ar-flash");
        void target.offsetWidth;
        target.classList.add("ar-flash");
        navigator.vibrate?.(25);
        pushEvent("ar_pinch_action", {
          targetType: target.matches(".word-chip") ? "word" : target.matches(".sentence-slot") ? "slot" : "control",
          targetLabel: String(target.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80)
        });
      } else {
        metrics.targetMissCount += 1;
        pushEvent("ar_pinch_miss", {});
      }
    }
    runtime.lastPinch = pinch;
  }

  async function createDetector() {
    const vision = await import(MP.module);
    const fileset = await vision.FilesetResolver.forVisionTasks(MP.wasm);
    const options = delegate => ({
      baseOptions: { modelAssetPath: MP.model, delegate },
      runningMode: "VIDEO",
      numHands: 1,
      minHandDetectionConfidence: 0.45,
      minHandPresenceConfidence: 0.42,
      minTrackingConfidence: 0.42
    });
    try {
      return await vision.HandLandmarker.createFromOptions(fileset, options("GPU"));
    } catch (gpuError) {
      console.warn("Sentence City AR V4 GPU detector unavailable; using CPU", gpuError);
      return vision.HandLandmarker.createFromOptions(fileset, options("CPU"));
    }
  }

  async function loop() {
    if (!runtime.running || !runtime.detector || !runtime.video) return;
    try {
      if (runtime.video.readyState >= 2 && runtime.video.currentTime !== runtime.lastVideoTime) {
        runtime.lastVideoTime = runtime.video.currentTime;
        const result = runtime.detector.detectForVideo(runtime.video, performance.now());
        processHand(result);
      }
    } catch (error) {
      const message = String(error?.message || error);
      metrics.detectorErrors.push(message);
      statusText("Hand Detect สะดุดชั่วคราว", "สามารถกดใช้ระบบสัมผัสแทนได้ทันที");
    }
    runtime.raf = requestAnimationFrame(loop);
  }

  async function startAr() {
    if (runtime.running || runtime.starting || !runtime.special) return;
    runtime.starting = true;
    const panel = document.getElementById("sentenceArPanel");
    const startButton = document.getElementById("sentenceArStart");
    if (startButton) startButton.disabled = true;
    statusText("กำลังเปิดกล้องและเตรียม Hand Tracking…", "อนุญาตการใช้กล้องเมื่อระบบถาม");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("CAMERA_API_NOT_SUPPORTED");
      runtime.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 960 },
          height: { ideal: 720 }
        }
      });
      runtime.detector = await createDetector();
      runtime.video = document.getElementById("sentenceArVideo");
      runtime.video.srcObject = runtime.stream;
      await runtime.video.play();
      runtime.lastVideoTime = -1;
      runtime.lastPinch = false;
      runtime.firstHandAt = 0;
      runtime.startedAt = performance.now();
      runtime.missingSince = performance.now();
      runtime.running = true;
      runtime.fallback = false;
      metrics.cameraStartCount += 1;
      uniquePush(metrics.missionsAttempted, runtime.taskId);
      pushEvent("ar_mode_started", { missionIndex: Number(state.index) + 1 });
      panel?.classList.add("running");
      panel?.classList.remove("fallback");
      statusText("AR Hand Mode พร้อมแล้ว", "ชี้คำ → จีบเพื่อเลือก → ชี้ช่อง → จีบเพื่อวาง");
      loop();
    } catch (error) {
      const message = String(error?.message || error);
      metrics.detectorErrors.push(message);
      pushEvent("ar_start_failed", { error: message });
      fallbackToTouch("เปิดกล้องหรือ Hand Detect ไม่สำเร็จ");
    } finally {
      runtime.starting = false;
      if (startButton) startButton.disabled = false;
    }
  }

  function stopAr(reason) {
    if (runtime.startedAt && runtime.running) metrics.totalArMs += Math.round(performance.now() - runtime.startedAt);
    runtime.running = false;
    cancelAnimationFrame(runtime.raf);
    runtime.raf = 0;
    runtime.stream?.getTracks?.().forEach(track => track.stop());
    runtime.stream = null;
    try { runtime.detector?.close?.(); } catch (_) {}
    runtime.detector = null;
    if (runtime.video) runtime.video.srcObject = null;
    runtime.video = null;
    runtime.lastVideoTime = -1;
    runtime.lastPinch = false;
    runtime.firstHandAt = 0;
    runtime.startedAt = 0;
    ensurePointer().hidden = true;
    clearFocus();
    if (reason) pushEvent("ar_mode_stopped", { reason });
  }

  function fallbackToTouch(reason) {
    const taskId = runtime.taskId || currentTask()?.id;
    if (taskId) uniquePush(metrics.fallbackMissions, taskId);
    stopAr("touch_fallback");
    runtime.fallback = true;
    const panel = document.getElementById("sentenceArPanel");
    panel?.classList.remove("running");
    panel?.classList.add("fallback");
    statusText("ใช้ระบบสัมผัสแทนได้แล้ว", `${reason || ""} ลากคำหรือแตะคำแล้วแตะช่องตามปกติ`);
    pushEvent("ar_touch_fallback", { reason: reason || "player_choice" });
  }

  function finishPreviousMission(nextKey) {
    if (!runtime.key || runtime.key === nextKey) return;
    if (runtime.special && metrics.missionsAttempted.includes(runtime.taskId)) {
      uniquePush(metrics.missionsCompleted, runtime.taskId);
    }
    stopAr("mission_changed");
  }

  function attachPanel() {
    const mission = document.querySelector(".mission");
    const task = currentTask();
    if (!mission || !task) return;
    if (mission.querySelector("#sentenceArPanel")) return;

    runtime.taskId = task.id;
    runtime.special = true;
    runtime.fallback = false;
    uniquePush(metrics.missionsSeen, task.id);
    mission.classList.add("ar-special-mission");
    const mode = document.getElementById("modeChip");
    if (mode) {
      mode.className = "mode-chip ar-crane";
      mode.textContent = "AR CRANE";
    }

    const panel = document.createElement("section");
    panel.id = "sentenceArPanel";
    panel.className = "sentence-ar-panel";
    panel.innerHTML = `
      <video id="sentenceArVideo" autoplay muted playsinline aria-label="ภาพกล้องสำหรับตรวจจับมือ"></video>
      <div class="sentence-ar-hud">
        <div class="sentence-ar-title-row">
          <span class="sentence-ar-badge">✋ AR WORD CRANE</span>
          <span class="sentence-ar-count">SPECIAL ${SPECIAL_INDEXES.indexOf(Number(state.index)) + 1}/3</span>
        </div>
        <div id="sentenceArGuide" class="sentence-ar-guide">
          ภารกิจพิเศษ: ใช้มือควบคุมเครนคำศัพท์
          <small>กด Start AR แล้วชี้และจีบนิ้วเพื่อเลือกคำกับช่อง</small>
        </div>
        <div class="sentence-ar-controls">
          <button id="sentenceArStart" class="sentence-ar-btn start" type="button">Start AR Hand Mode</button>
          <button id="sentenceArTouch" class="sentence-ar-btn touch" type="button">Use Touch Instead</button>
        </div>
      </div>`;

    const prompt = mission.querySelector(".prompt");
    prompt?.insertAdjacentElement("afterend", panel);
    document.getElementById("sentenceArStart")?.addEventListener("click", startAr);
    document.getElementById("sentenceArTouch")?.addEventListener("click", () => fallbackToTouch("ผู้เล่นเลือกโหมดสัมผัส"));
    pushEvent("ar_mission_presented", { missionIndex: Number(state.index) + 1 });
  }

  function patchIntro() {
    const intro = document.querySelector(".intro");
    if (!intro || intro.dataset.arV4) return;
    intro.dataset.arV4 = "1";
    const heading = intro.querySelector("h2");
    if (heading) heading.textContent = "Skyline Builder • AR Hand Detect V4";
    const featureRow = intro.querySelector(".feature-row");
    if (featureRow) {
      featureRow.insertAdjacentHTML("beforeend", '<div class="feature"><b>✋</b>3 AR Hand Missions</div>');
    }
    const missionNote = intro.querySelector(".mission-note");
    if (missionNote) missionNote.insertAdjacentHTML("beforeend", " • Touch fallback พร้อมเสมอ");
  }

  function patchSummary() {
    const summary = document.querySelector(".summary");
    if (!summary || summary.dataset.arV4) return;
    summary.dataset.arV4 = "1";
    const card = summary.querySelector(".learning-card");
    if (card) {
      const line = document.createElement("div");
      line.className = "sentence-ar-summary";
      line.innerHTML = `<strong>AR Hand Analytics</strong><br>เปิด AR ${metrics.missionsAttempted.length}/3 ภารกิจ • ตรวจพบมือ ${metrics.handDetectedCount} ครั้ง • Pinch ${metrics.pinchCount} ครั้ง • Touch fallback ${metrics.fallbackMissions.length} ภารกิจ`;
      card.insertAdjacentElement("afterend", line);
    }
  }

  function sync() {
    patchIntro();
    patchSummary();
    const nextKey = missionKey();
    finishPreviousMission(nextKey);
    if (nextKey !== runtime.key) {
      runtime.key = nextKey;
      runtime.taskId = currentTask()?.id || "";
      runtime.special = isSpecialMission();
      runtime.fallback = false;
    }
    if (!runtime.special) return;
    attachPanel();
  }

  const observer = new MutationObserver(() => {
    clearTimeout(runtime.observerTimer);
    runtime.observerTimer = setTimeout(sync, 30);
  });
  observer.observe(screen, { childList: true, subtree: true });

  window.addEventListener("pagehide", () => stopAr("pagehide"), { once: true });
  window.addEventListener("beforeunload", () => stopAr("beforeunload"), { once: true });

  window.SENTENCE_CITY_AR = Object.freeze({
    version: VERSION,
    specialMissionIndexes: SPECIAL_INDEXES.map(index => index + 1),
    metrics,
    start: startAr,
    fallbackToTouch,
    stop: stopAr
  });

  sync();
}());
