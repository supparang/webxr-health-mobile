// === /herohealth/js/hha-session-flow.js ===
// HHA Session Flow Orchestrator (Warmup / Cooldown by zone+game)
// v20260222a
'use strict';

(function (WIN) {
  const DAY_KEY = 'HHA_DAY_FLOW_V1';

  function todayKey() {
    // ใช้ local date (ของเครื่องผู้ใช้)
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(DAY_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      if (!obj || typeof obj !== 'object') return { day: todayKey(), zones: {} };

      // reset ถ้าข้ามวัน
      if (obj.day !== todayKey()) {
        return { day: todayKey(), zones: {} };
      }
      if (!obj.zones || typeof obj.zones !== 'object') obj.zones = {};
      return obj;
    } catch (_) {
      return { day: todayKey(), zones: {} };
    }
  }

  function writeStore(obj) {
    try { localStorage.setItem(DAY_KEY, JSON.stringify(obj)); } catch (_) {}
  }

  function ensureZone(zone) {
    const s = readStore();
    if (!s.zones[zone]) {
      s.zones[zone] = {
        enteredToday: false,
        warmupDone: false,
        cooldownDone: false,
        games: {} // gameId -> { played:true, lastPlayedAt }
      };
      writeStore(s);
    }
    return s;
  }

  function getZoneState(zone) {
    const s = ensureZone(zone);
    return s.zones[zone];
  }

  function setZoneEntered(zone) {
    const s = ensureZone(zone);
    s.zones[zone].enteredToday = true;
    writeStore(s);
  }

  function markWarmupDone(zone) {
    const s = ensureZone(zone);
    s.zones[zone].warmupDone = true;
    s.zones[zone].enteredToday = true;
    writeStore(s);
  }

  function markCooldownDone(zone) {
    const s = ensureZone(zone);
    s.zones[zone].cooldownDone = true;
    writeStore(s);
  }

  function markGamePlayed(zone, gameId) {
    const s = ensureZone(zone);
    s.zones[zone].enteredToday = true;
    s.zones[zone].games = s.zones[zone].games || {};
    s.zones[zone].games[gameId] = {
      played: true,
      lastPlayedAt: new Date().toISOString()
    };
    writeStore(s);
  }

  function hasPlayedGameToday(zone, gameId) {
    const z = getZoneState(zone);
    return !!(z.games && z.games[gameId] && z.games[gameId].played);
  }

  // ✅ กติกา: warmup เข้าเมื่อ "zone ยังไม่เข้าในวันนี้"
  function shouldWarmupBeforeZoneGame(zone) {
    const z = getZoneState(zone);
    return !z.enteredToday || !z.warmupDone;
  }

  // cooldown หลังเล่นเกมหลัก (ถ้ายังไม่ทำวันนี้)
  function shouldCooldownAfterZoneGame(zone) {
    const z = getZoneState(zone);
    return !z.cooldownDone;
  }

  // Theme mapping ตาม zone + game
  function resolveTheme({ zone, gameId, phase }) {
    const z = String(zone || '').toLowerCase();
    const g = String(gameId || '').toLowerCase();
    const p = String(phase || '').toLowerCase();

    // fallback defaults by zone
    let theme = 'default';
    if (z === 'nutrition') theme = 'fresh-market';
    else if (z === 'hygiene') theme = 'clean-lab';
    else if (z === 'fitness') theme = 'active-arena';

    // game-specific overrides
    if (z === 'nutrition' && g === 'goodjunk') {
      if (p === 'warmup') theme = 'nutrition-warmup-fridge-scan';
      else if (p === 'cooldown') theme = 'nutrition-cooldown-kitchen-reset';
      else theme = 'goodjunk-neon-market';
    }

    return theme;
  }

  // สร้าง URL ไป warmup/cooldown/game โดย pass context ไปครบ
  function buildUrl(basePath, params = {}) {
    const u = new URL(basePath, location.origin);
    Object.entries(params).forEach(([k, v]) => {
      if (v == null || v === '') return;
      u.searchParams.set(k, String(v));
    });
    return u.toString();
  }

  WIN.HHAFlow = {
    todayKey,
    readStore,
    getZoneState,
    setZoneEntered,
    markWarmupDone,
    markCooldownDone,
    markGamePlayed,
    hasPlayedGameToday,
    shouldWarmupBeforeZoneGame,
    shouldCooldownAfterZoneGame,
    resolveTheme,
    buildUrl
  };
})(window);