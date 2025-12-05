// === hydration.coach.js — Auto-move + fade + mission bounce ===
'use strict';

const CoachVR = (() => {

  let coachEl = null;
  let bubbleEl = null;

  let targetX = 0;
  let currentX = 0;
  let fade = 1;

  function init() {
    coachEl = document.querySelector('#hha-coach-wrap');
    bubbleEl = document.querySelector('#hha-coach-text');

    if (!coachEl) return;

    currentX = window.innerWidth / 2;
    targetX = currentX;

    animate();
  }

  // เรียกเมื่อมี mission new
  function bounce(message) {
    if (!bubbleEl) return;
    bubbleEl.innerHTML = message;
    bubbleEl.style.transform = "translateY(0) scale(1.15)";
    bubbleEl.style.opacity = "1";

    setTimeout(() => {
      bubbleEl.style.transform = "translateY(0) scale(1)";
    }, 300);
  }

  // โค้ชเลื่อนซ้าย–ขวา เพื่อหลบเป้า
  function avoidTarget(tx) {
    const screenW = window.innerWidth;
    if (tx > screenW * 0.5) targetX = screenW * 0.30;
    else targetX = screenW * 0.70;
  }

  // เป้าเข้าใกล้ → โค้ช fade out
  function nearTarget(isNear) {
    fade = isNear ? 0.35 : 1;
  }

  function animate() {
    if (!coachEl) return;

    currentX += (targetX - currentX) * 0.08;

    coachEl.style.left = `${currentX - coachEl.offsetWidth / 2}px`;
    coachEl.style.opacity = fade;

    requestAnimationFrame(animate);
  }

  return { init, avoidTarget, nearTarget, bounce };
})();

export default CoachVR;
