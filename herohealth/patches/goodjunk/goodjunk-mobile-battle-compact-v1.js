(() => {
  'use strict';

  const PATCH = 'goodjunk-dual-mobile-input-v5.0.0';
  const UA = navigator.userAgent || '';
  const mobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(UA) || innerWidth <= 760;
  const samsungInternet = /SamsungBrowser/i.test(UA);
  const androidChrome = /Android/i.test(UA) && /Chrome\//i.test(UA) && !samsungInternet && !/EdgA|OPR\//i.test(UA);
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
      const stream = window.__GJ_CAMERA_STREAM__;
      if (!stream) return;
      stream.getTracks().forEach((track) => track.stop());
      window.__GJ_CAMERA_STREAM__ = null;
    } catch (_) {}
  }

  function activateTouchRescue(reason) {
    if (window.__GJ_CAMERA_LITE__) return;
    if (touchRescueActive || typeof state === 'undefined' || !state.playing) return;
    touchRescueActive = true;
    stopCameraWatch();
    missionBox?.classList.remove('handLite');
    missionBox?.classList.add('touchRescue');

    try {
      ev('camera_stall_touch_rescue', {
        reason,
        inputBeforeRescue: window.__GJ_HAND_LITE__ ? 'hand-ar-lite' : 'hand-ar',
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
    console.warn('[GoodJunk AR]', PATCH, 'touch rescue activated:', reason);
  }

  function startCameraWatch() {
    stopCameraWatch();
    if (window.__GJ_CAMERA_LITE__) return;
    lastHandResultAt = Date.now();
    cameraWatchTimer = window.setInterval(() => {
      try {
        if (!state.playing || mode !== 'camera' || touchRescueActive || window.__GJ_CAMERA_LITE__) return;
        const timeout = window.__GJ_HAND_LITE__ ? 4800 : 3500;
        if (Date.now() - lastHandResultAt > timeout) {
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
      if (samsungInternet || (mobileDevice && !androidChrome)) {
        button.textContent = '📷 Camera Lite • แตะเล่น';
        button.setAttribute('aria-label', 'เปิดกล้องแบบ Camera Lite และแตะอาหารเพื่อเล่น');
      } else if (androidChrome) {
        button.textContent = '🖐️ Hand AR Lite • แตะสำรองได้';
        button.setAttribute('aria-label', 'เปิด Hand AR Lite บน Chrome และสามารถแตะอาหารสำรองได้');
      } else {
        button.textContent = '🖐️ Hand AR';
      }
    });

    document.documentElement.dataset.goodjunkBrowser = samsungInternet
      ? 'samsung-internet'
      : androidChrome
        ? 'android-chrome'
        : mobileDevice
          ? 'mobile-lite'
          : 'desktop';
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
    const syncMissionTitle = () => {
      mission.title = mission.textContent.trim();
    };
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
  } catch (error) {
    console.warn('[GoodJunk AR]', PATCH, 'could not wrap onHands', error);
  }

  try {
    const originalBoot = window.boot;
    window.boot = async function wrappedGoodJunkBoot(requestedMode) {
      touchRescueActive = false;
      missionBox?.classList.remove('touchRescue', 'cameraLite', 'handLite');
      stopCameraWatch();
      const result = await originalBoot(requestedMode);
      try {
        if (requestedMode === 'camera' && mode === 'camera') {
          if (window.__GJ_CAMERA_LITE__) {
            document.documentElement.dataset.goodjunkInput = 'camera-lite-touch';
            missionBox?.classList.add('cameraLite');
            try { show('Camera Lite — แตะอาหารเพื่อเลือก'); } catch (_) {}
            try { ev('camera_lite_started', { inputMode: 'touch', cameraBackground: true, browser: samsungInternet ? 'samsung-internet' : 'other-mobile' }); } catch (_) {}
          } else if (window.__GJ_HAND_LITE__) {
            document.documentElement.dataset.goodjunkInput = 'hand-ar-lite';
            missionBox?.classList.add('handLite');
            try { show('Hand AR Lite — ใช้นิ้วชี้ หรือแตะสำรอง'); } catch (_) {}
            try { ev('hand_ar_lite_started', { inputMode: 'hand+touch', browser: 'android-chrome' }); } catch (_) {}
            startCameraWatch();
          } else {
            document.documentElement.dataset.goodjunkInput = 'hand-ar';
            startCameraWatch();
          }
        } else {
          document.documentElement.dataset.goodjunkInput = 'touch';
        }
      } catch (_) {}
      return result;
    };
  } catch (error) {
    console.warn('[GoodJunk AR]', PATCH, 'could not wrap boot', error);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    try {
      if (state.playing && mode === 'camera' && !touchRescueActive && !window.__GJ_CAMERA_LITE__) {
        lastHandResultAt = Date.now();
      }
    } catch (_) {}
  });

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
    inputProfile: samsungInternet
      ? 'camera-lite-touch'
      : androidChrome
        ? 'hand-ar-lite'
        : mobileDevice
          ? 'camera-lite-touch'
          : 'hand-ar'
  };
  console.info('[GoodJunk AR UI]', PATCH, window.GOODJUNK_AR_COMPACT.inputProfile);
})();
