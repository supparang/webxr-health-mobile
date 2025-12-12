// === /herohealth/vr-groups/GameEngine.js ===
// Food Groups VR — Game Engine (emoji + Fever + DOM FX)

(function (ns) {
  'use strict';

  const A = window.AFRAME;
  if (!A) {
    console.error('[GroupsVR] AFRAME not found');
    return;
  }

  const FEVER_MAX = 100;

  function clamp(v, min, max) {
    v = Number(v) || 0;
    if (v < min) return min;
    if (v > max) return max;
    return v;
  }

  // แปลง world position → screen 2D
  function worldToScreen(sceneEl, worldPos) {
    if (!sceneEl || !sceneEl.camera || !worldPos) return null;
    const cam = sceneEl.camera;
    const width  = window.innerWidth  || 1;
    const height = window.innerHeight || 1;

    const v = new A.THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
    v.project(cam);

    return {
      x: (v.x * 0.5 + 0.5) * width,
      y: (-v.y * 0.5 + 0.5) * height
    };
  }

  function pickDifficulty(diffKey) {
    diffKey = String(diffKey || 'normal').toLowerCase();
    if (ns.foodGroupsDifficulty && ns.foodGroupsDifficulty.get) {
      return ns.foodGroupsDifficulty.get(diffKey);
    }
    // fallback
    return {
      spawnInterval: 1200,
      fallSpeed: 0.011,
      scale: 1.0,
      maxActive: 4,
      goodRatio: 0.7
    };
  }