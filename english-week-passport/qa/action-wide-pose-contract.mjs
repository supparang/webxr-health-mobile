import assert from 'node:assert/strict';

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function patchWide({ leftShoulder, rightShoulder, leftElbow, rightElbow, leftWrist, rightWrist }) {
  const shoulderWidth = Math.max(0.04, distance(leftShoulder, rightShoulder));
  const elbowSpan = Math.abs(leftElbow.x - rightElbow.x);
  const elbowsNearShoulderLevel =
    Math.abs(leftElbow.y - leftShoulder.y) <= 0.30 &&
    Math.abs(rightElbow.y - rightShoulder.y) <= 0.30;
  const upperArmsOpen =
    distance(leftShoulder, leftElbow) >= shoulderWidth * 0.42 &&
    distance(rightShoulder, rightElbow) >= shoulderWidth * 0.42;

  if (elbowSpan < shoulderWidth * 1.35 || !elbowsNearShoulderLevel || !upperArmsOpen) {
    return { patched: false, leftWrist, rightWrist, shoulderWidth };
  }

  const centerX = (leftShoulder.x + rightShoulder.x) / 2;
  function project(shoulder, elbow, wrist) {
    const direction = Math.sign(elbow.x - centerX) || 1;
    const existingDistance = wrist ? Math.abs(wrist.x - centerX) : 0;
    const projectedDistance = Math.max(
      existingDistance,
      shoulderWidth * 1.22,
      Math.abs(elbow.x - centerX) + shoulderWidth * 0.42
    );
    return {
      x: clamp(centerX + direction * projectedDistance, 0.015, 0.985),
      y: clamp(wrist?.y ?? elbow.y, shoulder.y - 0.17, shoulder.y + 0.17)
    };
  }

  return {
    patched: true,
    shoulderWidth,
    leftWrist: project(leftShoulder, leftElbow, leftWrist),
    rightWrist: project(rightShoulder, rightElbow, rightWrist)
  };
}

function legacyWidePass(result, leftShoulder, rightShoulder) {
  return Math.abs(result.leftWrist.x - result.rightWrist.x) > result.shoulderWidth * 2.25 &&
    Math.abs(result.leftWrist.y - leftShoulder.y) < 0.22 &&
    Math.abs(result.rightWrist.y - rightShoulder.y) < 0.22;
}

const shoulders = {
  leftShoulder: { x: 0.42, y: 0.36 },
  rightShoulder: { x: 0.58, y: 0.36 }
};

const naturalWide = patchWide({
  ...shoulders,
  leftElbow: { x: 0.28, y: 0.38 },
  rightElbow: { x: 0.72, y: 0.38 },
  leftWrist: { x: 0.22, y: 0.40 },
  rightWrist: { x: 0.78, y: 0.40 }
});
assert.equal(naturalWide.patched, true);
assert.equal(legacyWidePass(naturalWide, shoulders.leftShoulder, shoulders.rightShoulder), true);

const croppedWrists = patchWide({
  ...shoulders,
  leftElbow: { x: 0.27, y: 0.37 },
  rightElbow: { x: 0.73, y: 0.37 },
  leftWrist: null,
  rightWrist: null
});
assert.equal(croppedWrists.patched, true, 'visible shoulders and open elbows should recover cropped wrists');
assert.equal(legacyWidePass(croppedWrists, shoulders.leftShoulder, shoulders.rightShoulder), true);

const armsDown = patchWide({
  ...shoulders,
  leftElbow: { x: 0.40, y: 0.58 },
  rightElbow: { x: 0.60, y: 0.58 },
  leftWrist: { x: 0.39, y: 0.73 },
  rightWrist: { x: 0.61, y: 0.73 }
});
assert.equal(armsDown.patched, false, 'arms beside the torso must not be converted into a wide pose');

console.log('Action Detective wide-pose compatibility contract: PASS');
