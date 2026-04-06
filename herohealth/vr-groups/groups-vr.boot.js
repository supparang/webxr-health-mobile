(() => {
  'use strict';

  const q = new URLSearchParams(location.search);

  const ROUTES = {
    hub: './hub.html',
    launcher: './groups-vr.html',
    legacy: './groups-v1.html',

    soloRun: './vr-groups/groups.html',
    raceLobby: './vr-groups/groups-race-lobby.html',

    battleRun: './vr-groups/groups-battle-run.html',
    duetRun: './vr-groups/groups-duet-run.html',
    coopRun: './vr-groups/groups-coop-run.html'
  };

  const MODE_STATUS = {
    solo: 'ready',
    race: 'ready',
    battle: 'soon',
    duet: 'soon',
    coop: 'soon'
  };

  const LAST_MODE_KEY = 'HHA_GROUPS_LAST_MODE';
  const LAST_URL_KEY = 'HHA_GROUPS_LAST_URL';

  const hubUrl = q.get('hub') || ROUTES.hub;

  const els = {
    btnContinue: document.getElementById('btnContinue'),
    btnBackHub: document.getElementById('btnBackHub'),
    toast: document.getElementById('toast')
  };

  const BASE_PARAMS = buildBaseParams();

  bindEvents();

  function bindEvents() {
    document.querySelectorAll('[data-mode="solo"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view || 'mobile';
        goSolo(view);
      });
    });

    document.querySelectorAll('[data-mode="race"]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const joinOnly = btn.dataset.action === 'join';
        goRace(joinOnly);
      });
    });

    document.querySelectorAll('[data-soon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = String(btn.dataset.soon || '').trim();
        showSoonToast(mode);
      });
    });

    if (els.btnBackHub) {
      els.btnBackHub.addEventListener('click', () => {
        location.href = hubUrl;
      });
    }

    if (els.btnContinue) {
      els.btnContinue.addEventListener('click', continueLastMode);
    }
  }

  function buildBaseParams() {
    const p = new URLSearchParams();

    for (const [k, v] of q.entries()) {
      p.set(k, v);
    }

    if (!p.get('pid')) p.set('pid', 'anon');
    if (!p.get('name')) p.set('name', 'Player');
    if (!p.get('diff')) p.set('diff', 'normal');
    if (!p.get('time')) p.set('time', '60');
    if (!p.get('view')) p.set('view', 'mobile');
    if (!p.get('run')) p.set('run', 'play');
    if (!p.get('hub')) p.set('hub', hubUrl);

    p.set('game', 'groups');
    p.set('gameId', 'groups');
    p.set('zone', 'nutrition');
    p.set('cat', 'nutrition');
    p.set('theme', 'groups');

    return p;
  }

  function goSolo(view = 'mobile') {
    if (MODE_STATUS.solo !== 'ready') {
      showToast('โหมด Solo ยังไม่พร้อมใช้งาน');
      return;
    }

    const url = buildSoloUrl(view);
    saveLastMode('solo', url);
    location.href = url;
  }

  function goRace(joinOnly = false) {
    if (MODE_STATUS.race !== 'ready') {
      showToast('โหมด Race ยังไม่พร้อมใช้งาน');
      return;
    }

    const url = buildRaceLobbyUrl(joinOnly);
    saveLastMode('race', url);
    location.href = url;
  }

  function continueLastMode() {
    try {
      const lastUrl = localStorage.getItem(LAST_URL_KEY);
      const lastMode = localStorage.getItem(LAST_MODE_KEY);

      if (lastUrl && lastMode) {
        location.href = lastUrl;
        return;
      }
    } catch (_) {}

    showToast('ยังไม่มีโหมดล่าสุด เริ่มจาก Solo หรือ Race ได้เลย');
  }

  function buildSoloUrl(view = 'mobile') {
    const p = new URLSearchParams(BASE_PARAMS.toString());
    p.set('mode', 'solo');
    p.set('view', view);
    p.set('seed', String(Date.now()));
    return `${ROUTES.soloRun}?${p.toString()}`;
  }

  function buildRaceLobbyUrl(joinOnly = false) {
    const p = new URLSearchParams(BASE_PARAMS.toString());
    p.set('mode', 'race');
    p.set('race', '1');
    p.set('seed', String(Date.now()));
    if (joinOnly) p.set('join', '1');
    return `${ROUTES.raceLobby}?${p.toString()}`;
  }

  function buildBattleUrl() {
    const p = new URLSearchParams(BASE_PARAMS.toString());
    p.set('mode', 'battle');
    p.set('seed', String(Date.now()));
    return `${ROUTES.battleRun}?${p.toString()}`;
  }

  function buildDuetUrl() {
    const p = new URLSearchParams(BASE_PARAMS.toString());
    p.set('mode', 'duet');
    p.set('seed', String(Date.now()));
    return `${ROUTES.duetRun}?${p.toString()}`;
  }

  function buildCoopUrl() {
    const p = new URLSearchParams(BASE_PARAMS.toString());
    p.set('mode', 'coop');
    p.set('seed', String(Date.now()));
    return `${ROUTES.coopRun}?${p.toString()}`;
  }

  function saveLastMode(mode, url) {
    try {
      localStorage.setItem(LAST_MODE_KEY, mode);
      localStorage.setItem(LAST_URL_KEY, url);
    } catch (_) {}
  }

  function showSoonToast(mode) {
    const map = {
      battle: 'โหมด Battle กำลังเตรียมเปิดเร็ว ๆ นี้',
      duet: 'โหมด Duet กำลังเตรียมเปิดเร็ว ๆ นี้',
      coop: 'โหมด Coop กำลังเตรียมเปิดเร็ว ๆ นี้'
    };

    showToast(map[mode] || 'โหมดนี้กำลังเตรียมเปิดเร็ว ๆ นี้');
  }

  function showToast(text) {
    if (!els.toast) return;

    els.toast.textContent = text;
    els.toast.classList.add('show');

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      els.toast.classList.remove('show');
    }, 1800);
  }

  WIRE_DEBUG_API();

  function WIRE_DEBUG_API() {
    window.__GROUPS_VR_ROUTES__ = {
      ROUTES,
      MODE_STATUS,
      buildSoloUrl,
      buildRaceLobbyUrl,
      buildBattleUrl,
      buildDuetUrl,
      buildCoopUrl
    };
  }
})();