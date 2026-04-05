(function () {
  'use strict';

  const STORAGE_KEYS = {
    hygiene: 'HH_HYGIENE_LAST_GAME_V1',
    nutrition: 'HH_NUTRITION_LAST_GAME_V1',
    fitness: 'HH_FITNESS_LAST_GAME_V1'
  };

  const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
  const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
  const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';

  const ZONE_LABELS = {
    hygiene: 'Hygiene Zone',
    nutrition: 'Nutrition Zone',
    fitness: 'Fitness Zone'
  };

  const ZONE_EMOJIS = {
    hygiene: '🫧',
    nutrition: '🥗',
    fitness: '🏃'
  };

  const ZONE_CHIP_CLASSES = {
    hygiene: 'hh-zone-chip hh-zone-chip--hygiene',
    nutrition: 'hh-zone-chip hh-zone-chip--nutrition',
    fitness: 'hh-zone-chip hh-zone-chip--fitness'
  };

  const DEFAULT_FEATURED = {
    hygiene: 'germ-detective',
    nutrition: 'goodjunk',
    fitness: 'jump-duck'
  };

  const NEXT_GAME_MAP = {
    hygiene: {
      bath: 'brush',
      brush: 'handwash',
      handwash: 'clean-objects',
      'clean-objects': 'mask-cough',
      'mask-cough': 'germ-detective',
      'germ-detective': 'bath'
    },
    nutrition: {
      goodjunk: 'groups',
      groups: 'plate',
      plate: 'hydration',
      hydration: 'goodjunk'
    },
    fitness: {
      'shadow-breaker': 'rhythm-boxer',
      'rhythm-boxer': 'jump-duck',
      'jump-duck': 'balance-hold',
      'balance-hold': 'fitness-planner',
      'fitness-planner': 'shadow-breaker'
    }
  };

  const GAME_LABELS = {
    hygiene: {
      bath: 'Bath',
      brush: 'Brush',
      handwash: 'Handwash',
      'clean-objects': 'Clean Objects',
      'mask-cough': 'Mask & Cough',
      'germ-detective': 'Germ Detective'
    },
    nutrition: {
      goodjunk: 'GoodJunk',
      groups: 'Food Groups',
      plate: 'Balanced Plate',
      hydration: 'Hydration'
    },
    fitness: {
      'shadow-breaker': 'Shadow Breaker',
      'rhythm-boxer': 'Rhythm Boxer',
      'jump-duck': 'Jump & Duck',
      'balance-hold': 'Balance Hold',
      'fitness-planner': 'Fitness Planner'
    }
  };

  const RECENT_IDS = {
    hygiene: {
      featured: 'hygFeatured',
      recentPill: 'hygRecentPill',
      recentText: 'hygRecentText'
    },
    nutrition: {
      featured: 'nutriFeatured',
      recentPill: 'nutriRecentPill',
      recentText: 'nutriRecentText'
    },
    fitness: {
      featured: 'fitFeatured',
      recentPill: 'fitRecentPill',
      recentText: 'fitRecentText'
    }
  };

  function $(id) {
    return document.getElementById(id);
  }

  function safeParse(raw, fallback = null) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setHidden(id, hidden) {
    const el = $(id);
    if (el) el.hidden = !!hidden;
  }

  function readZoneSnapshot(zone) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS[zone]);
      return raw ? safeParse(raw, null) : null;
    } catch (_) {
      return null;
    }
  }

  function gameLabel(zone, gameId) {
    return GAME_LABELS[zone]?.[gameId] || gameId || '-';
  }

  function nextGameForZone(zone, lastGameId) {
    return NEXT_GAME_MAP[zone]?.[lastGameId] || DEFAULT_FEATURED[zone];
  }

  function nextZoneAfter(zone) {
    if (zone === 'hygiene') return 'nutrition';
    if (zone === 'nutrition') return 'fitness';
    return 'hygiene';
  }

  function formatDateTimeThai(ts) {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (_) {
      return '-';
    }
  }

  function isToday(ts) {
    if (!ts) return false;
    const d = new Date(ts);
    const n = new Date();
    return (
      d.getFullYear() === n.getFullYear() &&
      d.getMonth() === n.getMonth() &&
      d.getDate() === n.getDate()
    );
  }

  function getAllSnapshots() {
    return Object.keys(STORAGE_KEYS)
      .map((zone) => {
        const snap = readZoneSnapshot(zone);
        if (!snap?.gameId || !snap?.ts) return null;
        return {
          zone,
          gameId: snap.gameId,
          ts: Number(snap.ts) || 0,
          mode: snap.mode || 'play',
          time: snap.time || '90'
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.ts - a.ts);
  }

  function syncZonePointersFromSnapshots() {
    const latest = getAllSnapshots()[0];
    if (!latest) return;

    const nextZone = nextZoneAfter(latest.zone);

    try { localStorage.setItem(LAST_ZONE_KEY, latest.zone); } catch (_) {}
    try { localStorage.setItem(NEXT_ZONE_KEY, nextZone); } catch (_) {}
    try { localStorage.setItem(RECOMMENDED_ZONE_KEY, nextZone); } catch (_) {}
  }

  function buildZoneUrl(zone) {
    const map = {
      hygiene: './hygiene-zone.html',
      nutrition: './nutrition-zone.html',
      fitness: './fitness-zone.html'
    };

    const base = map[zone] || './hub-v2.html';
    const q = new URLSearchParams(location.search);
    const out = new URL(base, location.href);

    [
      'pid',
      'name',
      'nick',
      'studyId',
      'mode',
      'time',
      'run',
      'view',
      'diff',
      'seed',
      'debug',
      'api',
      'log'
    ].forEach((k) => {
      const v = q.get(k);
      if (v != null && v !== '') out.searchParams.set(k, v);
    });

    out.searchParams.set('zone', zone);
    out.searchParams.set('hub', location.href);

    return out.toString();
  }

  function renderZoneRecentAndFeatured() {
    Object.keys(RECENT_IDS).forEach((zone) => {
      const ids = RECENT_IDS[zone];
      const snap = readZoneSnapshot(zone);

      const featuredGameId = nextGameForZone(zone, snap?.gameId || '');
      setText(ids.featured, gameLabel(zone, featuredGameId));

      if (snap?.gameId) {
        setHidden(ids.recentPill, false);
        setText(ids.recentText, gameLabel(zone, snap.gameId));
      } else {
        setHidden(ids.recentPill, true);
      }
    });
  }

  function renderTodayStrip() {
    const all = getAllSnapshots();
    const today = all.filter((x) => isToday(x.ts));
    const latest = all[0] || null;

    setText('todayPlayedCount', String(today.length));
    setText('todayZoneCount', String(new Set(today.map((x) => x.zone)).size));

    if (latest) {
      setText('todayLastGame', gameLabel(latest.zone, latest.gameId));

      const nextZone = nextZoneAfter(latest.zone);
      setText('todayNextGame', ZONE_LABELS[nextZone]);

      const heroQuick = $('heroQuickline');
      if (heroQuick) {
        heroQuick.textContent =
          `ล่าสุดเล่น ${gameLabel(latest.zone, latest.gameId)} • แนะนำต่อ ${ZONE_LABELS[nextZone]}`;
      }
    } else {
      setText('todayLastGame', 'ยังไม่มี');
      setText('todayNextGame', 'ระบบกำลังเลือกให้');
    }
  }

  function renderSummaryBox() {
    const box = $('summaryBox');
    if (!box) return;

    const all = getAllSnapshots().slice(0, 3);

    if (!all.length) {
      box.innerHTML = `
        <div class="summary-item">
          <strong>ยังไม่มีการเล่นล่าสุด</strong>
          <small>เข้าเล่นจากแต่ละโซนแล้วข้อมูลล่าสุดจะมาแสดงที่นี่</small>
        </div>
      `;
      return;
    }

    box.innerHTML = all.map((snap) => `
      <div class="summary-item">
        <strong>${ZONE_EMOJIS[snap.zone]} ${ZONE_LABELS[snap.zone]} • ${gameLabel(snap.zone, snap.gameId)}</strong>
        <small>เล่นเมื่อ ${formatDateTimeThai(snap.ts)} • mode ${snap.mode} • ${snap.time} sec</small>
      </div>
    `).join('');
  }

  function renderLibraryBox() {
    const box = $('libraryBox');
    if (!box) return;

    const html = ['hygiene', 'nutrition', 'fitness'].map((zone) => {
      const snap = readZoneSnapshot(zone);
      const featuredGameId = nextGameForZone(zone, snap?.gameId || '');
      const recentLabel = snap?.gameId ? gameLabel(zone, snap.gameId) : 'ยังไม่มีล่าสุด';
      const featuredLabel = gameLabel(zone, featuredGameId);

      return `
        <a class="hh-game-card" href="${buildZoneUrl(zone)}">
          <div class="hh-game-card__logo-fallback" aria-hidden="true">${ZONE_EMOJIS[zone]}</div>
          <div class="hh-game-card__body">
            <p class="hh-game-card__title">${ZONE_LABELS[zone]}</p>
            <p class="hh-game-card__meta">
              <span class="${ZONE_CHIP_CLASSES[zone]}">แนะนำ: ${featuredLabel}</span>
            </p>
            <p class="hh-game-card__meta">
              <span class="${ZONE_CHIP_CLASSES[zone]}">ล่าสุด: ${recentLabel}</span>
            </p>
          </div>
        </a>
      `;
    }).join('');

    box.innerHTML = html;
  }

  function bootLauncherStorageBridge() {
    syncZonePointersFromSnapshots();
    renderZoneRecentAndFeatured();
    renderTodayStrip();
    renderSummaryBox();
    renderLibraryBox();
  }

  document.addEventListener('DOMContentLoaded', bootLauncherStorageBridge);
  window.addEventListener('load', bootLauncherStorageBridge);
  window.addEventListener('focus', bootLauncherStorageBridge);
  window.addEventListener('storage', bootLauncherStorageBridge);
})();
(function () {
  'use strict';

  const STORAGE_KEYS = {
    hygiene: 'HH_HYGIENE_LAST_GAME_V1',
    nutrition: 'HH_NUTRITION_LAST_GAME_V1',
    fitness: 'HH_FITNESS_LAST_GAME_V1'
  };

  const GAME_PATHS = {
    hygiene: {
      bath: './bath-vr.html',
      brush: './brush-vr.html',
      handwash: './handwash-v2.html',
      'clean-objects': './clean-objects-kids.html',
      'mask-cough': './maskcough-v2.html',
      'germ-detective': './germ-detective.html'
    },
    nutrition: {
      goodjunk: './goodjunk-launcher.html',
      groups: './groups-vr.html',
      plate: './plate-vr.html',
      hydration: './hydration-v2.html'
    },
    fitness: {
      'shadow-breaker': './shadow-breaker-vr.html',
      'rhythm-boxer': './rhythm-boxer-vr.html',
      'jump-duck': './jump-duck-vr.html',
      'balance-hold': './balance-hold-vr.html',
      'fitness-planner': './fitness-planner.html'
    }
  };

  const NEXT_GAME_MAP = {
    hygiene: {
      bath: 'brush',
      brush: 'handwash',
      handwash: 'clean-objects',
      'clean-objects': 'mask-cough',
      'mask-cough': 'germ-detective',
      'germ-detective': 'bath'
    },
    nutrition: {
      goodjunk: 'groups',
      groups: 'plate',
      plate: 'hydration',
      hydration: 'goodjunk'
    },
    fitness: {
      'shadow-breaker': 'rhythm-boxer',
      'rhythm-boxer': 'jump-duck',
      'jump-duck': 'balance-hold',
      'balance-hold': 'fitness-planner',
      'fitness-planner': 'shadow-breaker'
    }
  };

  const ZONE_FALLBACKS = {
    hygiene: './hygiene-zone.html',
    nutrition: './nutrition-zone.html',
    fitness: './fitness-zone.html'
  };

  function safeParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readSnapshot(zone) {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS[zone]);
      if (!raw) return null;
      const data = safeParse(raw, null);
      if (!data?.gameId || !data?.ts) return null;
      return {
        zone,
        gameId: data.gameId,
        ts: Number(data.ts) || 0,
        mode: data.mode || '',
        time: data.time || ''
      };
    } catch (_) {
      return null;
    }
  }

  function getAllSnapshots() {
    return Object.keys(STORAGE_KEYS)
      .map(readSnapshot)
      .filter(Boolean)
      .sort((a, b) => b.ts - a.ts);
  }

  function getLatestSnapshot() {
    return getAllSnapshots()[0] || null;
  }

  function buildBaseSearchParams() {
    const q = new URLSearchParams(location.search);
    const out = new URLSearchParams();

    [
      'pid',
      'name',
      'nick',
      'studyId',
      'run',
      'view',
      'diff',
      'seed',
      'debug',
      'api',
      'log'
    ].forEach((k) => {
      const v = q.get(k);
      if (v != null && v !== '') out.set(k, v);
    });

    return out;
  }

  function buildZoneUrl(zone) {
    const out = new URL(ZONE_FALLBACKS[zone] || './hub-v2.html', location.href);
    const params = buildBaseSearchParams();

    params.set('zone', zone);
    params.set('mode', new URLSearchParams(location.search).get('mode') || 'play');
    params.set('time', new URLSearchParams(location.search).get('time') || '90');
    params.set('hub', location.href);

    out.search = params.toString();
    return out.toString();
  }

  function buildGameUrl(zone, gameId, mode, time) {
    const path = GAME_PATHS[zone]?.[gameId];
    if (!path) return buildZoneUrl(zone);

    const out = new URL(path, location.href);
    const params = buildBaseSearchParams();

    params.set('zone', zone);
    params.set('cat', zone);
    params.set('gameId', gameId);
    params.set('game', gameId);
    params.set('mode', mode || new URLSearchParams(location.search).get('mode') || 'play');
    params.set('time', time || new URLSearchParams(location.search).get('time') || '90');
    params.set('hub', location.href);

    out.search = params.toString();
    return out.toString();
  }

  function buildLatestGameUrl() {
    const latest = getLatestSnapshot();
    if (!latest) return buildZoneUrl('nutrition');
    return buildGameUrl(latest.zone, latest.gameId, latest.mode, latest.time);
  }

  function buildNextGameUrl() {
    const latest = getLatestSnapshot();
    if (!latest) return buildZoneUrl('nutrition');

    const nextGameId = NEXT_GAME_MAP[latest.zone]?.[latest.gameId];
    if (!nextGameId) return buildZoneUrl(latest.zone);

    return buildGameUrl(latest.zone, nextGameId, latest.mode, latest.time);
  }

  function replaceButtonHandler(id, handler) {
    const oldEl = document.getElementById(id);
    if (!oldEl || !oldEl.parentNode) return null;

    const newEl = oldEl.cloneNode(true);
    oldEl.parentNode.replaceChild(newEl, oldEl);
    newEl.addEventListener('click', handler);
    return newEl;
  }

  function patchRecentButtons() {
    replaceButtonHandler('btnResumeNow', function () {
      location.href = buildLatestGameUrl();
    });

    replaceButtonHandler('btnQuickRecent', function () {
      location.href = buildLatestGameUrl();
    });

    replaceButtonHandler('btnNextInZone', function () {
      location.href = buildNextGameUrl();
    });
  }

  function patchTodayHints() {
    const latest = getLatestSnapshot();
    if (!latest) return;

    const todayLastGame = document.getElementById('todayLastGame');
    const todayNextGame = document.getElementById('todayNextGame');
    const heroQuickline = document.getElementById('heroQuickline');

    const nextGameId = NEXT_GAME_MAP[latest.zone]?.[latest.gameId] || '';
    const nextLabel = nextGameId || 'ยังไม่มี';

    if (todayLastGame) todayLastGame.textContent = latest.gameId;
    if (todayNextGame) todayNextGame.textContent = nextLabel;
    if (heroQuickline) {
      heroQuickline.textContent = `ล่าสุดเล่น ${latest.gameId} • แนะนำต่อ ${nextLabel}`;
    }
  }

  function bootResumeRealGamePatch() {
    patchRecentButtons();
    patchTodayHints();
  }

  document.addEventListener('DOMContentLoaded', bootResumeRealGamePatch);
  window.addEventListener('load', bootResumeRealGamePatch);
  window.addEventListener('focus', bootResumeRealGamePatch);
  window.addEventListener('storage', bootResumeRealGamePatch);
})();