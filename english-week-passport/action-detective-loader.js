(async function () {
  "use strict";

  const PATCH_VERSION = "2026-08-03-ACTION-WIDE-POSE-V2";
  const MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

  function visibility(point) {
    return Number(point && (point.visibility ?? point.presence) || 0);
  }

  function distance(a, b) {
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isWideTaskActive() {
    const command = document.querySelector("#bodyCommand strong")?.textContent || "";
    return command.trim().toLowerCase() === "stretch your arms wide";
  }

  function patchWidePose(result) {
    if (!isWideTaskActive()) return result;

    const landmarks = result?.landmarks?.[0];
    if (!landmarks) return result;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftElbow = landmarks[13];
    const rightElbow = landmarks[14];
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];

    const coreVisible = [leftShoulder, rightShoulder, leftElbow, rightElbow]
      .every(point => point && visibility(point) >= 0.22);
    if (!coreVisible) return result;

    const shoulderWidth = Math.max(0.04, distance(leftShoulder, rightShoulder));
    const elbowSpan = Math.abs(leftElbow.x - rightElbow.x);
    const elbowsNearShoulderLevel =
      Math.abs(leftElbow.y - leftShoulder.y) <= 0.30 &&
      Math.abs(rightElbow.y - rightShoulder.y) <= 0.30;
    const upperArmsOpen =
      distance(leftShoulder, leftElbow) >= shoulderWidth * 0.42 &&
      distance(rightShoulder, rightElbow) >= shoulderWidth * 0.42;

    if (elbowSpan < shoulderWidth * 1.35 || !elbowsNearShoulderLevel || !upperArmsOpen) {
      return result;
    }

    const centerX = (leftShoulder.x + rightShoulder.x) / 2;

    function projectWrist(shoulder, elbow, wrist) {
      const direction = Math.sign(elbow.x - centerX) || 1;
      const existingDistance = wrist ? Math.abs(wrist.x - centerX) : 0;
      const projectedDistance = Math.max(
        existingDistance,
        shoulderWidth * 1.22,
        Math.abs(elbow.x - centerX) + shoulderWidth * 0.42
      );
      const projectedX = clamp(centerX + direction * projectedDistance, 0.015, 0.985);
      const naturalY = wrist && visibility(wrist) >= 0.18
        ? wrist.y
        : elbow.y + (elbow.y - shoulder.y) * 0.20;
      const projectedY = clamp(naturalY, shoulder.y - 0.17, shoulder.y + 0.17);
      const confidence = Math.max(0.62, visibility(wrist), visibility(elbow));

      if (!wrist) {
        return { x: projectedX, y: projectedY, z: elbow.z || 0, visibility: confidence, presence: confidence };
      }

      wrist.x = projectedX;
      wrist.y = projectedY;
      wrist.visibility = confidence;
      wrist.presence = Math.max(Number(wrist.presence || 0), confidence);
      return wrist;
    }

    landmarks[15] = projectWrist(leftShoulder, leftElbow, leftWrist);
    landmarks[16] = projectWrist(rightShoulder, rightElbow, rightWrist);
    result.ewWidePosePatched = true;
    result.ewWidePosePatchVersion = PATCH_VERSION;
    return result;
  }

  try {
    const vision = await import(MODULE_URL);
    const PoseLandmarker = vision.PoseLandmarker;

    if (PoseLandmarker && !PoseLandmarker.__ewWidePoseV2) {
      const originalCreate = PoseLandmarker.createFromOptions.bind(PoseLandmarker);

      PoseLandmarker.createFromOptions = async function (...args) {
        const detector = await originalCreate(...args);
        const originalDetect = detector.detectForVideo.bind(detector);

        detector.detectForVideo = function (video, timestamp) {
          const result = originalDetect(video, timestamp);
          try {
            return patchWidePose(result);
          } catch (error) {
            console.warn("Wide pose compatibility patch skipped", error);
            return result;
          }
        };

        return detector;
      };

      PoseLandmarker.__ewWidePoseV2 = true;
    }

    window.EW_ACTION_POSE_PATCH = Object.freeze({
      ready: true,
      version: PATCH_VERSION,
      policy: "elbow-assisted-wide-pose"
    });
  } catch (error) {
    console.warn("Wide pose compatibility patch unavailable", error);
    window.EW_ACTION_POSE_PATCH = Object.freeze({
      ready: false,
      version: PATCH_VERSION,
      error: String(error?.message || error)
    });
  }

  const gameScript = document.createElement("script");
  gameScript.src = "./action-detective.js?v=20260803-action2";
  gameScript.defer = true;
  document.body.appendChild(gameScript);
}());
