(async function () {
  "use strict";

  const PATCH_VERSION = "2026-08-03-ACTION-POSE-V3";
  const MODULE_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs";

  function visibility(point) {
    return Number(point && (point.visibility ?? point.presence) || 0);
  }

  function distance(a, b) {
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 99;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

  function patchWidePose(result) {
    if (activeCommand() !== "stretch your arms wide") return result;

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
      return boostVisibility(wrist, confidence);
    }

    landmarks[15] = projectWrist(leftShoulder, leftElbow, leftWrist);
    landmarks[16] = projectWrist(rightShoulder, rightElbow, rightWrist);
    result.ewWidePosePatched = true;
    return result;
  }

  function patchHeadTouch(result) {
    if (activeCommand() !== "touch your head") return result;

    const landmarks = result?.landmarks?.[0];
    if (!landmarks) return result;

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

    const coreVisible = [nose, leftShoulder, rightShoulder]
      .every(point => point && visibility(point) >= 0.18);
    if (!coreVisible) return result;

    const shoulderWidth = Math.max(0.04, distance(leftShoulder, rightShoulder));
    const headAnchors = [nose, leftEye, rightEye, leftEar, rightEar]
      .filter(point => point && visibility(point) >= 0.08);
    if (!headAnchors.length) return result;

    const headCenter = headAnchors.reduce((sum, point) => ({
      x: sum.x + point.x,
      y: sum.y + point.y
    }), { x: 0, y: 0 });
    headCenter.x /= headAnchors.length;
    headCenter.y /= headAnchors.length;

    function headDistance(wrist) {
      if (!wrist) return 99;
      return Math.min(...headAnchors.map(anchor => distance(wrist, anchor)));
    }

    function candidate(side, wrist, elbow, shoulder) {
      if (!wrist || !elbow || !shoulder) return null;
      const wristToHead = headDistance(wrist);
      const wristHighEnough = wrist.y <= Math.max(leftShoulder.y, rightShoulder.y) + 0.22;
      const elbowRaised = visibility(elbow) >= 0.16 && elbow.y <= shoulder.y + 0.26;
      const elbowTowardHead = distance(elbow, headCenter) <= shoulderWidth * 1.95;
      const directTouch = wristToHead <= shoulderWidth * 1.55 && wristHighEnough;
      const occludedTouch = wristToHead <= shoulderWidth * 1.85 && wristHighEnough && elbowRaised && elbowTowardHead;
      if (!directTouch && !occludedTouch) return null;
      return { side, wrist, elbow, shoulder, score: wristToHead };
    }

    const candidates = [
      candidate("left", leftWrist, leftElbow, leftShoulder),
      candidate("right", rightWrist, rightElbow, rightShoulder)
    ].filter(Boolean).sort((a, b) => a.score - b.score);

    if (!candidates.length) return result;

    const touch = candidates[0];
    const sideDirection = touch.wrist.x < nose.x ? -1 : 1;
    touch.wrist.x = clamp(nose.x + sideDirection * shoulderWidth * 0.32, 0.02, 0.98);
    touch.wrist.y = clamp(nose.y - shoulderWidth * 0.10, 0.02, 0.98);
    boostVisibility(touch.wrist, 0.68);

    const otherWristIndex = touch.side === "left" ? 16 : 15;
    const otherElbow = touch.side === "left" ? rightElbow : leftElbow;
    const otherShoulder = touch.side === "left" ? rightShoulder : leftShoulder;
    let otherWrist = landmarks[otherWristIndex];

    if (!otherWrist) {
      const source = otherElbow || otherShoulder;
      otherWrist = {
        x: source.x,
        y: clamp(source.y + shoulderWidth * 0.65, 0.02, 0.98),
        z: source.z || 0,
        visibility: 0.38,
        presence: 0.38
      };
      landmarks[otherWristIndex] = otherWrist;
    } else {
      boostVisibility(otherWrist, 0.38);
    }

    boostVisibility(nose, 0.52);
    boostVisibility(leftShoulder, 0.48);
    boostVisibility(rightShoulder, 0.48);

    result.ewHeadTouchPatched = true;
    return result;
  }

  function patchPoseResult(result) {
    patchWidePose(result);
    patchHeadTouch(result);
    if (result) result.ewPosePatchVersion = PATCH_VERSION;
    return result;
  }

  try {
    const vision = await import(MODULE_URL);
    const PoseLandmarker = vision.PoseLandmarker;

    if (PoseLandmarker && !PoseLandmarker.__ewPoseV3) {
      const originalCreate = PoseLandmarker.createFromOptions.bind(PoseLandmarker);

      PoseLandmarker.createFromOptions = async function (...args) {
        const detector = await originalCreate(...args);
        const originalDetect = detector.detectForVideo.bind(detector);

        detector.detectForVideo = function (video, timestamp) {
          const result = originalDetect(video, timestamp);
          try {
            return patchPoseResult(result);
          } catch (error) {
            console.warn("Action pose compatibility patch skipped", error);
            return result;
          }
        };

        return detector;
      };

      PoseLandmarker.__ewPoseV3 = true;
    }

    window.EW_ACTION_POSE_PATCH = Object.freeze({
      ready: true,
      version: PATCH_VERSION,
      policies: Object.freeze([
        "elbow-assisted-wide-pose",
        "single-hand-head-region-touch",
        "occluded-wrist-support"
      ])
    });
  } catch (error) {
    console.warn("Action pose compatibility patch unavailable", error);
    window.EW_ACTION_POSE_PATCH = Object.freeze({
      ready: false,
      version: PATCH_VERSION,
      error: String(error?.message || error)
    });
  }

  const gameScript = document.createElement("script");
  gameScript.src = "./action-detective.js?v=20260803-action3";
  gameScript.defer = true;
  document.body.appendChild(gameScript);
}());
