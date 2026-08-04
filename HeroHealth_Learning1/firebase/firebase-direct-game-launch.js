(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (String(params.get('authority') || '').toLowerCase() !== 'firebase') return;

  const STATE_KEY = 'herohealth_learning_platform_rc2';

  function readState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function missionProfile(config, state) {
    const id = state.activeMissionProfile || config.activeMissionProfile || 'CLASS_60';
    return config.missionProfiles?.[id] || config.missionProfiles?.CLASS_60 || null;
  }

  function rotationZones(config, state) {
    const group = state.group || state.profile?.group || 'A';
    return Array.isArray(config.rotation?.[group]) ? config.rotation[group] : ['hygiene', 'nutrition', 'fitness'];
  }

  function nextGame(config, state) {
    const profile = missionProfile(config, state);
    if (!profile) return null;
    const completedZones = state.completed || {};
    const completedGames = state.gameCompleted || {};

    for (const zoneId of rotationZones(config, state)) {
      if (completedZones[zoneId] === true) continue;
      const ids = Array.isArray(profile.games?.[zoneId]) ? profile.games[zoneId] : [];
      const zone = (config.zones || []).find((z) => z.id === zoneId);
      for (const gameId of ids) {
        if (completedGames?.[zoneId]?.[gameId] === true) continue;
        const game = zone?.games?.find((g) => g.id === gameId);
        if (game?.url) return { zoneId, gameId, game };
      }
    }
    return null;
  }

  function buildTarget() {
    const config = window.HH_CONFIG || {};
    const state = readState();
    const item = nextGame(config, state);
    if (!item || !state.profile?.studentId) return null;

    const target = new URL(item.game.url, location.href);
    const uid = String(state.firebaseAuthority?.uid || window.HH_FIREBASE_AUTHORITY?.uid || '');
    const returnUrl = location.href;
    const fields = {
      authority: 'firebase',
      studentId: state.profile.studentId,
      sid: state.profile.studentId,
      pid: state.profile.studentId,
      section: state.profile.section || '',
      group: state.group || state.profile.group || '',
      zone: item.zoneId,
      gameId: item.gameId,
      missionProfile: state.activeMissionProfile || config.activeMissionProfile || 'CLASS_60',
      firebaseUid: uid,
      classroom: '1',
      singleAttempt: '1',
      return: returnUrl,
      returnUrl,
      firebaseDirect: '1',
      launchVersion: '20260804-FIREBASE-DIRECT-CAPTURE-V1',
      _: String(Date.now())
    };
    Object.entries(fields).forEach(([key, value]) => target.searchParams.set(key, value));
    return target;
  }

  function isNextGameButton(target) {
    const button = target?.closest?.('button');
    if (!button) return null;
    const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    const onclick = String(button.getAttribute('onclick') || '');
    return (text.includes('เริ่มเกมถัดไป') || onclick.includes('openNextGame')) ? button : null;
  }

  document.addEventListener('click', (event) => {
    const button = isNextGameButton(event.target);
    if (!button || button.disabled) return;

    const target = buildTarget();
    if (!target) {
      console.error('[HeroHealth Firebase] Cannot resolve next game target');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    button.disabled = true;
    button.textContent = 'กำลังเปิดเกม…';
    console.info('[HeroHealth Firebase] direct launch', target.href);
    window.location.replace(target.href);
  }, true);
})();
