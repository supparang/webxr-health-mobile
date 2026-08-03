(async function () {
  "use strict";

  const PATCH_VERSION = "2026-08-03-ACTION-POSE-V4-MASTERY";
  const MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

  const COMMANDS = Object.freeze({
    "raise both hands": Object.freeze({
      level: "A2",
      spoken: "Raise both hands above shoulder level and hold still.",
      hint: "ยกมือทั้งสองให้สูงกว่าระดับไหล่",
      holdMs: 500
    }),
    "stretch your arms wide": Object.freeze({
      level: "B1",
      spoken: "Extend both arms sideways until they are level with your shoulders, and keep your elbows straight.",
      hint: "กางแขนระดับไหล่และเหยียดศอกทั้งสองข้าง",
      holdMs: 650
    }),
    "touch your head": Object.freeze({
      level: "B1+",
      spoken: "Use either hand to touch the side of your head while keeping your elbow raised.",
      hint: "ใช้มือข้างเดียวแตะด้านข้างศีรษะและยกศอก",
      holdMs: 550
    })
  });

  const gate = {
    command: "",
    neutralSince: 0,
    holdStart: 0,
    armed: false,
    lastRawOkAt: 0,
    ready: false
  };

  function visibility(point) {
    return Number(point && (point.visibility ?? point.presence) || 0);
  }

  function distance(a, b) {
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 99;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
    return Math.acos(cosine) * 180 / Math.PI;
  }

  function boostVisibility(point, value) {
    if (!point) return point;
    point.visibility = Math.max(Number(point.visibility || 0), value);
    point.presence = Math.max(Number(point.presence || 0), value);
    return point;
  }

  function activeCommand() {
    return (document.querySelector("#bodyCommand strong")?.textContent || "")
      .trim()
      .toLowerCase();
  }

  function resetGate(command) {
    gate.command = command;
    gate.neutralSince = 0;
    gate.holdStart = 0;
    gate.armed = false;
    gate.lastRawOkAt = 0;
    gate.ready = false;
  }

  function evaluateRawPose(landmarks, command) {
    if (!landmarks) return { ok: false, confidence: 0, reason: "ไม่พบร่างกาย" };

    const nose = landmarks[0];
    const leftEye = landmarks[2];
    const rightEye = landmarks[5];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const shoulderWidth = Math.max(0.04, distance(leftShoulder, rightShoulder));
    const core = [nose, leftShoulder, rightShoulder];
    const coreVisible = core.every(point => point && visibility(point) >= 0.26);
    if (!coreVisible) return { ok: false, confidence: 0, reason: "ให้เห็นศีรษะและไหล่ทั้งสองข้าง" };

    if (command === "raise both hands") {
      const points = [leftElbow, rightElbow, leftWrist, rightWrist];
      if (!points.every(point => point && visibility(point) >= 0.30)) {
        return { ok: false, confidence: 0, reason: "ให้เห็นศอกและมือทั้งสองข้าง" };
      }
      const wristsHigh =
        leftWrist.y < leftShoulder.y - 0.08 &&
        rightWrist.y < rightShoulder.y - 0.08;
      const elbowsRaised =
        leftElbow.y < leftShoulder.y + 0.08 &&
        rightElbow.y < rightShoulder.y + 0.08;
      const balanced = Math.abs(leftWrist.y - rightWrist.y) <= 0.20;
      return {
        ok: wristsHigh && elbowsRaised && balanced,
        confidence: Math.min(...points.map(visibility)),
        reason: !wristsHigh ? "ยกมือทั้งสองให้สูงขึ้น" : !elbowsRaised ? "ยกศอกขึ้นอีกนิด" : "รักษาระดับมือทั้งสองให้ใกล้กัน"
      };
    }

    if (command === "stretch your arms wide") {
      const points = [leftElbow, rightElbow, leftWrist, rightWrist];
      if (!points.every(point => point && visibility(point) >= 0.28)) {
        return { ok: false, confidence: 0, reason: "ให้เห็นแขนและมือทั้งสองข้างเต็มกรอบ" };
      }
      const elbowSpan = Math.abs(leftElbow.x - rightElbow.x);
      const wristSpan = Math.abs(leftWrist.x - rightWrist.x);
      const leftAngle = angle(leftShoulder, leftElbow, leftWrist);
      const rightAngle = angle(rightShoulder, rightElbow, rightWrist);
      const elbowsLevel =
        Math.abs(leftElbow.y - leftShoulder.y) <= 0.18 &&
        Math.abs(rightElbow.y - rightShoulder.y) <= 0.18;
      const wristsLevel =
        Math.abs(leftWrist.y - leftShoulder.y) <= 0.18 &&
        Math.abs(rightWrist.y - rightShoulder.y) <= 0.18;
      const wideEnough = elbowSpan >= shoulderWidth * 1.45 && wristSpan >= shoulderWidth * 2.00;
      const straightEnough = leftAngle >= 140 && rightAngle >= 140;
      return {
        ok: wideEnough && elbowsLevel && wristsLevel && straightEnough,
        confidence: Math.min(...points.map(visibility)),
        reason: !wideEnough ? "กางแขนออกให้กว้างขึ้น" : !straightEnough ? "เหยียดศอกทั้งสองข้าง" : "ยกแขนให้อยู่ระดับไหล่"
      };
    }

    if (command === "touch your head") {
      const headAnchors = [nose, leftEye, rightEye, leftEar, rightEar]
        .filter(point => point && visibility(point) >= 0.10);
      if (!headAnchors.length) return { ok: false, confidence: 0, reason: "หันหน้าเข้ากล้อง" };

      function handCandidate(wrist, elbow, shoulder) {
        if (!wrist || !elbow || !shoulder || visibility(wrist) < 0.28 || visibility(elbow) < 0.24) return null;
        const wristToHead = Math.min(...headAnchors.map(anchor => distance(wrist, anchor)));
        const elbowAngle = angle(shoulder, elbow, wrist);
        const wristHigh = wrist.y <= shoulder.y + 0.10;
        const elbowRaised = elbow.y <= shoulder.y + 0.25;
        const bentArm = elbowAngle >= 35 && elbowAngle <= 150;
        const nearHead = wristToHead <= shoulderWidth * 1.20;
        return {
          ok: nearHead && wristHigh && elbowRaised && bentArm,
          wrist,
          elbow,
          shoulder,
          wristToHead,
          confidence: Math.min(visibility(wrist), visibility(elbow))
        };
      }

      const candidates = [
        handCandidate(leftWrist, leftElbow, leftShoulder),
        handCandidate(rightWrist, rightElbow, rightShoulder)
      ].filter(Boolean).sort((a, b) => a.wristToHead - b.wristToHead);
      const best = candidates[0];
      return {
        ok: Boolean(best?.ok),
        confidence: best?.confidence || 0,
        touch: best || null,
        reason: !best ? "ยกมือข้างหนึ่งขึ้นให้เห็นชัด" : best.wristToHead > shoulderWidth * 1.20 ? "แตะมือให้ใกล้ศีรษะขึ้น" : "ยกศอกและค้างมือไว้ที่ศีรษะ"
      };
    }

    return { ok: false, confidence: 0, reason: "รอคำสั่ง" };
  }

  function invalidateForLegacy(landmarks) {
    const rightWrist = landmarks?.[16];
    if (rightWrist) {
      rightWrist.visibility = Math.min(Number(rightWrist.visibility || 0), 0.27);
      rightWrist.presence = Math.min(Number(rightWrist.presence || 0), 0.27);
    }
  }

  function adaptForLegacy(landmarks, command, raw) {
    const nose = landmarks[0];
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const shoulderWidth = Math.max(0.04, distance(leftShoulder, rightShoulder));

    if (command === "stretch your arms wide") {
      const centerX = (leftShoulder.x + rightShoulder.x) / 2;
      const leftWrist = landmarks[15];
      const rightWrist = landmarks[16];
      leftWrist.x = clamp(centerX - shoulderWidth * 1.16, 0.015, 0.985);
      rightWrist.x = clamp(centerX + shoulderWidth * 1.16, 0.015, 0.985);
      leftWrist.y = clamp(leftWrist.y, leftShoulder.y - 0.17, leftShoulder.y + 0.17);
      rightWrist.y = clamp(rightWrist.y, rightShoulder.y - 0.17, rightShoulder.y + 0.17);
      boostVisibility(leftWrist, 0.50);
      boostVisibility(rightWrist, 0.50);
    }

    if (command === "touch your head" && raw.touch) {
      const touchWrist = raw.touch.wrist;
      touchWrist.x = clamp(nose.x + (touchWrist.x < nose.x ? -1 : 1) * shoulderWidth * 0.25, 0.02, 0.98);
      touchWrist.y = clamp(nose.y - shoulderWidth * 0.08, 0.02, 0.98);
      boostVisibility(touchWrist, 0.55);
      boostVisibility(landmarks[15], 0.31);
      boostVisibility(landmarks[16], 0.31);
    }
  }

  function statusLater(message, good) {
    queueMicrotask(() => {
      const status = document.getElementById("bodyStatus");
      if (!status) return;
      status.className = `adl-status${good ? " good" : ""}`;
      status.textContent = message;
    });
  }

  function decorateCommand(command) {
    const spec = COMMANDS[command];
    if (!spec) return;
    queueMicrotask(() => {
      const small = document.querySelector("#bodyCommand small");
      if (small) small.textContent = `${spec.level} • ${spec.spoken}`;
    });
  }

  function gatePoseResult(result) {
    const command = activeCommand();
    const spec = COMMANDS[command];
    const landmarks = result?.landmarks?.[0];
    if (!spec || !landmarks) return result;

    if (gate.command !== command) resetGate(command);
    decorateCommand(command);

    const now = performance.now();
    const raw = evaluateRawPose(landmarks, command);

    if (!gate.armed) {
      if (!raw.ok) {
        if (!gate.neutralSince) gate.neutralSince = now;
        if (now - gate.neutralSince >= 350) gate.armed = true;
        statusLater(gate.armed ? `${spec.level} • ${spec.hint}` : "กลับสู่ท่าเตรียมและรอสัญญาณ", false);
      } else {
        gate.neutralSince = 0;
        statusLater("ลดแขนกลับสู่ท่าเตรียมก่อนเริ่มคำสั่ง", false);
      }
      invalidateForLegacy(landmarks);
      return result;
    }

    if (raw.ok) {
      gate.lastRawOkAt = now;
      if (!gate.holdStart) gate.holdStart = now;
      const heldMs = now - gate.holdStart;
      const pct = Math.min(100, Math.round(heldMs / spec.holdMs * 100));
      statusLater(`${spec.level} • ตรวจพบท่าถูกต้อง ${pct}% — ค้างต่อ`, true);
      if (heldMs >= spec.holdMs) gate.ready = true;
    } else {
      if (now - gate.lastRawOkAt > 120) gate.holdStart = 0;
      statusLater(`${spec.level} • ${raw.reason || spec.hint}`, false);
    }

    if (!gate.ready) {
      invalidateForLegacy(landmarks);
      return result;
    }

    adaptForLegacy(landmarks, command, raw);
    result.ewPoseGateReady = true;
    result.ewPosePatchVersion = PATCH_VERSION;
    statusLater(`${spec.level} • ผ่านเกณฑ์ท่าแล้ว — ค้างยืนยัน`, true);
    return result;
  }

  function installLeveledSpeech() {
    try {
      if (!("speechSynthesis" in window) || window.speechSynthesis.__ewA2B1Speech) return;
      const originalSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
      window.speechSynthesis.speak = function (utterance) {
        const key = String(utterance?.text || "").trim().toLowerCase();
        const spec = COMMANDS[key];
        if (spec && utterance) {
          utterance.text = spec.spoken;
          utterance.rate = key === "touch your head" ? 0.76 : 0.80;
        }
        return originalSpeak(utterance);
      };
      window.speechSynthesis.__ewA2B1Speech = true;
    } catch (error) {
      console.warn("Leveled speech patch unavailable", error);
    }
  }

  function enforceDetectionOnly() {
    ["bodyTouch", "bodyFallbackBtn", "arTouch", "arFallbackBtn", "handTouch", "handFallbackBtn"]
      .forEach(id => {
        const element = document.getElementById(id);
        if (element) element.hidden = true;
      });

    const fallback = document.querySelector(".adl-fallback");
    if (fallback && !document.getElementById("retryDetectionSetup")) {
      const root = document.getElementById("adlRoot");
      if (!root) return;
      root.innerHTML = `<div class="adl-shell"><section class="adl-card adl-center"><div class="adl-hero">📷</div><h1>ตั้งค่า Detection ใหม่</h1><p class="adl-lead">เกมผจญภัยนี้ใช้วิธีควบคุมหลักเพียงแบบเดียว จึงไม่เปลี่ยนกลับเป็นการแตะตอบ</p><div class="adl-notice">ตรวจแสง ระยะกล้อง และสิทธิ์ใช้งานกล้อง แล้วเริ่มการตรวจจับใหม่</div><div class="adl-actions"><button id="retryDetectionSetup" class="adl-btn primary">ตรวจอุปกรณ์และเริ่มใหม่</button></div></section></div>`;
      document.getElementById("retryDetectionSetup").onclick = () => location.reload();
    }
  }

  const style = document.createElement("style");
  style.textContent = `
    #bodyTouch,#bodyFallbackBtn,#arTouch,#arFallbackBtn,#handTouch,#handFallbackBtn{display:none!important}
    .adl-target,.adl-hand-option{pointer-events:none!important}
  `;
  document.head.appendChild(style);
  new MutationObserver(enforceDetectionOnly).observe(document.documentElement, { childList: true, subtree: true });
  enforceDetectionOnly();
  installLeveledSpeech();

  try {
    const vision = await import(MODULE_URL);
    const PoseLandmarker = vision.PoseLandmarker;

    if (PoseLandmarker && !PoseLandmarker.__ewPoseV4) {
      const originalCreate = PoseLandmarker.createFromOptions.bind(PoseLandmarker);

      PoseLandmarker.createFromOptions = async function (...args) {
        const detector = await originalCreate(...args);
        const originalDetect = detector.detectForVideo.bind(detector);

        detector.detectForVideo = function (video, timestamp) {
          const result = originalDetect(video, timestamp);
          try {
            return gatePoseResult(result);
          } catch (error) {
            console.warn("Action pose mastery gate skipped", error);
            return result;
          }
        };

        return detector;
      };

      PoseLandmarker.__ewPoseV4 = true;
    }

    window.EW_ACTION_POSE_PATCH = Object.freeze({
      ready: true,
      version: PATCH_VERSION,
      languageRange: "A2-B1+",
      interactionPolicy: "detection-only",
      policies: Object.freeze([
        "neutral-reset-before-command",
        "continuous-hold-evidence",
        "symmetric-two-arm-validation",
        "elbow-angle-validation",
        "single-hand-head-contact-with-raised-elbow"
      ])
    });
  } catch (error) {
    console.warn("Action pose mastery gate unavailable", error);
    window.EW_ACTION_POSE_PATCH = Object.freeze({
      ready: false,
      version: PATCH_VERSION,
      error: String(error?.message || error)
    });
  }

  const gameScript = document.createElement("script");
  gameScript.src = "./action-detective.js?v=20260803-action4";
  gameScript.defer = true;
  document.body.appendChild(gameScript);
}());
