(() => {
  'use strict';

  const PATCH = 'goodjunk-mobile-battle-compact-v1.0.0';
  const boss = document.getElementById('bossPanel');
  const hp = document.getElementById('bossHpText');
  const phase = document.getElementById('bossPhase');
  const mission = document.getElementById('mission');
  let collapseTimer = 0;

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

  window.matchMedia('(max-width: 760px)').addEventListener?.('change', () => {
    if (!isMobile()) boss?.classList.remove('battleCompact');
    else if (bossVisible()) collapseBoss(200);
  });

  if (bossVisible()) collapseBoss(1200);
  document.documentElement.dataset.goodjunkLayout = PATCH;
  console.info('[GoodJunk AR UI]', PATCH, isMobile() ? 'compact' : 'wide');
})();
