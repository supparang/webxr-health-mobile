(() => {
  'use strict';

  const PATCH = 'goodjunk-mobile-handlandmarker-v7.0.0';
  const UA = navigator.userAgent || '';
  const mobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(UA) || innerWidth <= 760;
  const boss = document.getElementById('bossPanel');
  const hp = document.getElementById('bossHpText');
  const phase = document.getElementById('bossPhase');
  const mission = document.getElementById('mission');
  const missionBox = document.querySelector('.missionBox');
  let collapseTimer = 0;
  let cameraWatchTimer = 0;
  let lastHandResultAt = 0;
  let touchRescueActive = false;

  function isMobile() {
    return window.matchMedia('(max-width: 760px)').matches;
  }

  function bossVisible() {
    return boss && !boss.classList.contains('hidden');
  }

  function collapseBoss(delay = 1700) {
    window.clearTimeout(collapseTimer);
    if (!boss || !isMobile() || !bossVisible()) return;
    collapseTimer = window.setTimeout(() => {
      if (bossVisible() && isMobile()) boss.classList.add('battleCompact');
    }, delay);
  }

  function revealBoss(delay = 850) {
    if (!boss || !isMobile() || !bossVisible()) return;
    boss.classList.remove('battleCompact');
    collapseBoss(delay);
  }

  function stopCameraWatch() {
    window.clearInterval(cameraWatchTimer);
    cameraWatchTimer = 0;
  }

  function stopNativeCameraStream() {
    try {
      window.GJMobileHandV7?.stop?.(true);
      const stream = window.__GJ_CAMERA_STREAM__;
      if (!stream) return;
      stream.getTracks().forEach((track) => track.stop());
      window.__GJ_CAMERA_STREAM__ = null;
    } catch (_) {}
  }

  function activateTouchRescue(reason) {
    if (mobileDevice) {
      window.GJMobileHandV7?.fallback?.(reason || 'Mobile HandLandmarker timeout');
      return;
    }
    if (touchRescueActive || typeof state === 'undefined' || !state.playing) return;
    touchRescueActive = true;
    stopCameraWatch();
    missionBox?.classList.add('touchRescue');

    try {
      ev('camera_stall_touch_rescue', {
        reason,
        inputBeforeRescue: 'desktop-hand-ar',
        secondsWithoutHandFrame: lastHandResultAt
          ? Number(((Date.now() - lastHandResultAt) / 1000).toFixed(1))
          : null
      });
    } catch (_) {}

    try {
      mode = 'touch';
      camera?.stop?.();
    } catch (_) {
      try { mode = 'touch'; } catch (_) {}
    }

    try { show('Hand Tracking หยุด — แตะอาหารเพื่อเล่นต่อ'); } catch (_) {}
  }

  function startCameraWatch() {
    stopCameraWatch();
    if (mobileDevice || window.__GJ_CAMERA_LITE__) return;
    lastHandResultAt = Date.now();
    cameraWatchTimer = window.setInterval(() => {
      try {
        if (!state.playing || mode !== 'camera' || touchRescueActive || window.__GJ_CAMERA_LITE__) return;
        if (Date.now() - lastHandResultAt > 3500) {
          activateTouchRescue('MediaPipe onResults timeout');
        }
      } catch (_) {}
    }, 750);
  }

  function cameraButtons() {
    return Array.from(document.querySelectorAll('button')).filter((button) => {
      const onclick = button.getAttribute('onclick') || '';
      return onclick.includes("boot('camera')") || onclick.includes('boot("camera")');
    });
  }

  function labelAvailableInput() {
    cameraButtons().forEach((button) => {
      if (mobileDevice) {
        button.textContent = '🖐️ Mobile Hand AR • Pinch เล่น';
        button.setAttribute('aria-label', 'เปิด Mobile Hand AR ใช้ Pinch เพื่อเลือก และแตะสำรองได้');
      } else {
        button.textContent = '🖐️ Hand AR';
      }
    });
    document.documentElement.dataset.goodjunkBrowser = mobileDevice ? 'mobile-handlandmarker-v7' : 'desktop-hand-ar';
  }

  if (boss) {
    new MutationObserver(() => {
      if (bossVisible()) revealBoss(1900);
      else boss.classList.remove('battleCompact');
    }).observe(boss, { attributes: true, attributeFilter: ['class'] });
  }

  if (hp) {
    new MutationObserver(() => revealBoss(720)).observe(hp, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (phase) {
    new MutationObserver(() => revealBoss(1200)).observe(phase, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }

  if (mission) {
    const syncMissionTitle = () => { mission.title = mission.textContent.trim(); };
    new MutationObserver(syncMissionTitle).observe(mission, {
      childList: true,
      characterData: true,
      subtree: true
    });
    syncMissionTitle();
  }

  try {
    const originalOnHands = onHands;
    onHands = function wrappedGoodJunkOnHands(results) {
      lastHandResultAt = Date.now();
      if (touchRescueActive || window.__GJ_CAMERA_LITE__) return;
      return originalOnHands(results);
    };
  } catch (_) {}

  try {
    const originalBoot = window.boot;
    window.boot = async function wrappedGoodJunkBoot(requestedMode) {
      touchRescueActive = false;
      missionBox?.classList.remove('touchRescue', 'cameraLite', 'handLite');
      stopCameraWatch();
      const result = await originalBoot(requestedMode);
      try {
        if (requestedMode === 'camera' && mode === 'camera') {
          if (mobileDevice && window.__GJ_HANDLANDMARKER_V7__) {
            document.documentElement.dataset.goodjunkInput = 'mobile-handlandmarker+touch';
            missionBox?.classList.add('handLite');
            try { show('Mobile Hand AR — Pinch เพื่อเลือก • แตะสำรองได้'); } catch (_) {}
            try { ev('mobile_handlandmarker_started', { inputMode: 'pinch+touch', version: 'v7' }); } catch (_) {}
          } else if (mobileDevice) {
            document.documentElement.dataset.goodjunkInput = 'mobile-camera-touch-fallback';
            missionBox?.classList.add('touchRescue');
          } else {
            document.documentElement.dataset.goodjunkInput = 'desktop-hand-ar';
            startCameraWatch();
          }
        } else {
          document.documentElement.dataset.goodjunkInput = 'touch';
        }
      } catch (_) {}
      return result;
    };
  } catch (_) {}

  window.addEventListener('pagehide', stopNativeCameraStream);
  window.addEventListener('beforeunload', stopNativeCameraStream);

  window.matchMedia('(max-width: 760px)').addEventListener?.('change', () => {
    if (!isMobile()) boss?.classList.remove('battleCompact');
    else if (bossVisible()) collapseBoss(200);
  });

  labelAvailableInput();
  if (bossVisible()) collapseBoss(1200);
  document.documentElement.dataset.goodjunkLayout = PATCH;
  window.GOODJUNK_AR_COMPACT = {
    patch: PATCH,
    activateTouchRescue,
    startCameraWatch,
    stopNativeCameraStream,
    inputProfile: mobileDevice ? 'mobile-handlandmarker+touch' : 'desktop-hand-ar'
  };
  console.info('[GoodJunk AR UI]', PATCH, window.GOODJUNK_AR_COMPACT.inputProfile);
})();
