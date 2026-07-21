(() => {
  'use strict';

  const PATCH = 'goodjunk-mobile-battle-compact-v2.0.0';
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

  function activateTouchRescue(reason) {
    if (touchRescueActive || typeof state === 'undefined' || !state.playing) return;
    touchRescueActive = true;
    stopCameraWatch();
    missionBox?.classList.add('touchRescue');

    try {
      ev('camera_stall_touch_rescue', {
        reason,
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

    try { show('กล้องหยุดชั่วคราว — แตะอาหารเพื่อเล่นต่อ'); } catch (_) {}
    console.warn('[GoodJunk AR]', PATCH, 'touch rescue activated:', reason);
  }

  function startCameraWatch() {
    stopCameraWatch();
    lastHandResultAt = Date.now();
    cameraWatchTimer = window.setInterval(() => {
      try {
        if (!state.playing || mode !== 'camera' || touchRescueActive) return;
        if (Date.now() - lastHandResultAt > 3500) {
          activateTouchRescue('MediaPipe onResults timeout');
        }
      } catch (_) {}
    }, 750);
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

  /*
   * Hybrid input: Camera AR remains the primary input, but tapping a food
   * object is always allowed. This prevents a frozen tracker from trapping
   * the learner on the current mission.
   */
  const canvasElement = document.getElementById('canvas');
  canvasElement?.addEventListener('pointerdown', (event) => {
    try {
      if (state.playing && mode === 'camera') {
        hit(event.clientX, event.clientY);
      }
    } catch (_) {}
  }, true);

  /* Wrap the callback before boot() registers it with MediaPipe Hands. */
  try {
    const originalOnHands = onHands;
    onHands = function wrappedGoodJunkOnHands(results) {
      lastHandResultAt = Date.now();
      if (touchRescueActive) return;
      return originalOnHands(results);
    };
  } catch (error) {
    console.warn('[GoodJunk AR]', PATCH, 'could not wrap onHands', error);
  }

  try {
    const originalBoot = window.boot;
    window.boot = async function wrappedGoodJunkBoot(requestedMode) {
      touchRescueActive = false;
      missionBox?.classList.remove('touchRescue');
      stopCameraWatch();
      const result = await originalBoot(requestedMode);
      try {
        if (requestedMode === 'camera' && mode === 'camera') startCameraWatch();
      } catch (_) {}
      return result;
    };
  } catch (error) {
    console.warn('[GoodJunk AR]', PATCH, 'could not wrap boot', error);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    try {
      if (state.playing && mode === 'camera' && !touchRescueActive) {
        lastHandResultAt = Date.now();
      }
    } catch (_) {}
  });

  window.matchMedia('(max-width: 760px)').addEventListener?.('change', () => {
    if (!isMobile()) boss?.classList.remove('battleCompact');
    else if (bossVisible()) collapseBoss(200);
  });

  if (bossVisible()) collapseBoss(1200);
  document.documentElement.dataset.goodjunkLayout = PATCH;
  window.GOODJUNK_AR_COMPACT = {
    patch: PATCH,
    activateTouchRescue,
    startCameraWatch
  };
  console.info('[GoodJunk AR UI]', PATCH, isMobile() ? 'compact' : 'wide');
})();
