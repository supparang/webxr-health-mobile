(function () {
  'use strict';

  const PASS_KEYS = [
    'pid','nick','name',
    'run','view','diff','time','seed',
    'studyId','phase','conditionGroup','sessionOrder','blockLabel',
    'siteCode','schoolYear','semester',
    'log','api','debug',
    'grade','zone','room'
  ];

  const DEFAULT_PLAYER = {
    name: 'Rocky',
    level: 5,
    coins: 380,
    hearts: 8,
    stars: 12,
    wins: 4,
    streak: 3
  };

  const STORAGE_KEYS = {
    profile: 'HHA_PLAYER_PROFILE',
    lastSummary: 'HHA_LAST_SUMMARY',
    summaryHistory: 'HHA_SUMMARY_HISTORY',
    lastByZone: 'HHA_LAST_BY_ZONE'
  };

  const STORAGE_MISSIONS = {
    chain: 'HHA_MISSION_CHAIN_PROGRESS',
    stickers: 'HHA_STICKER_SHELF'
  };

  const MODE_LABELS = {
    solo: 'Solo',
    pro: 'PRO',
    duet: 'Duet',
    race: 'Race',
    battle: 'Battle',
    coop: 'Co-op',
    teacher: 'Teacher'
  };

  const GAME_CATALOG = {
    hygiene: {
      label: 'Hygiene Zone',
      defaultGameId: 'germdetective',
      games: [
        {
          id: 'germdetective',
          label: 'Germ Detective',
          sub: 'จับเชื้อโรคให้หมด',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./germ-detective.html' }]
        },
        {
          id: 'handwash',
          label: 'Handwash VR',
          sub: 'ล้างมือให้ครบขั้นตอน',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./hygiene-vr.html' }]
        },
        {
          id: 'brush',
          label: 'Brush VR',
          sub: 'แปรงฟันให้สะอาดสดใส',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./brush-vr.html' }]
        },
        {
          id: 'maskcough',
          label: 'Mask & Cough',
          sub: 'ฝึกปิดปากและป้องกันเชื้อโรค',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./maskcough-v2.html' }]
        },
        {
          id: 'bath',
          label: 'Bath VR',
          sub: 'อาบน้ำให้สะอาดและสนุก',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./bath-vr.html' }]
        },
        {
          id: 'cleanobject',
          label: 'Clean Objects',
          sub: 'เลือกของสะอาดให้ถูกต้อง',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./clean-objects.html' }]
        }
      ]
    },

    nutrition: {
      label: 'Nutrition Zone',
      defaultGameId: 'goodjunk',
      games: [
        {
          id: 'goodjunk',
          label: 'GoodJunk VR',
          sub: 'เลือกอาหารดี หลบอาหารขยะ',
          defaultMode: 'solo',
          modes: [
            { id:'solo',   url:'./goodjunk-launcher.html' },
            { id:'pro',    url:'./goodjunk-launcher.html' },
            { id:'duet',   url:'./goodjunk-launcher.html' },
            { id:'race',   url:'./vr-goodjunk/goodjunk-race-run.html' },
            { id:'battle', url:'./vr-goodjunk/goodjunk-battle-run.html' },
            { id:'coop',   url:'./vr-goodjunk/goodjunk-coop-run.html' },
            { id:'teacher',url:'./goodjunk-launcher.html' }
          ]
        },
        {
          id: 'hydration',
          label: 'Hydration VR',
          sub: 'ดื่มน้ำให้พอดีและดูแลร่างกาย',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./hydration-vr.html' }]
        },
        {
          id: 'groups',
          label: 'Groups',
          sub: 'แยกอาหารตามหมู่',
          defaultMode: 'solo',
          modes: [
            { id:'solo',   url:'./groups-vr.html' },
            { id:'duet',   url:'./groups-vr.html' },
            { id:'race',   url:'./groups-vr.html' },
            { id:'battle', url:'./groups-vr.html' },
            { id:'coop',   url:'./groups-vr.html' },
            { id:'teacher',url:'./groups-vr.html' }
          ]
        },
        {
          id: 'plate',
          label: 'Plate',
          sub: 'จัดจานอาหารให้ครบ 5 หมู่',
          defaultMode: 'solo',
          modes: [
            { id:'solo',   url:'./plate-vr.html' },
            { id:'duet',   url:'./plate-vr.html' },
            { id:'race',   url:'./plate-vr.html' },
            { id:'battle', url:'./plate-vr.html' },
            { id:'coop',   url:'./plate-vr.html' },
            { id:'teacher',url:'./plate-vr.html' }
          ]
        }
      ]
    },

    fitness: {
      label: 'Fitness Zone',
      defaultGameId: 'jumpduck',
      games: [
        {
          id: 'jumpduck',
          label: 'JumpDuck',
          sub: 'กระโดดและก้มหลบให้ทัน',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./jump-duck-vr.html' }]
        },
        {
          id: 'shadowbreaker',
          label: 'Shadow Breaker',
          sub: 'ต่อยเป้าให้แม่นและเร็ว',
          defaultMode: 'solo',
          modes: [
            { id:'solo',   url:'./shadow-breaker-vr.html' },
            { id:'battle', url:'./shadow-breaker-vr.html' },
            { id:'teacher',url:'./shadow-breaker-vr.html' }
          ]
        },
        {
          id: 'balancehold',
          label: 'Balance Hold',
          sub: 'ทรงตัวให้นานที่สุด',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./balance-hold-vr.html' }]
        },
        {
          id: 'rhythmboxer',
          label: 'Rhythm Boxer',
          sub: 'ชกตามจังหวะเพลง',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./rhythm-boxer-vr.html' }]
        },
        {
          id: 'fitnessplanner',
          label: 'Fitness Planner',
          sub: 'วางแผนออกกำลังกายแบบสนุก ๆ',
          defaultMode: 'solo',
          modes: [{ id:'solo', url:'./fitness-planner.html' }]
        }
      ]
    }
  };

  const ZONE_DEFAULTS = {
    hygiene: { level: 5, stars: 4, pct: 80 },
    nutrition: { level: 4, stars: 3, pct: 60 },
    fitness: { level: 3, stars: 2, pct: 40 }
  };

  const MISSION_CHAIN = {
    hygiene: ['handwash', 'brush', 'bath'],
    nutrition: ['goodjunk', 'hydration', 'plate'],
    fitness: ['jumpduck', 'shadowbreaker', 'balancehold']
  };

  const STICKER_REWARDS = {
    hygiene: { emoji: '🫧', name: 'Bubble Hero' },
    nutrition: { emoji: '🥦', name: 'Yummy Hero' },
    fitness: { emoji: '⚡', name: 'Action Hero' },
    crown: { emoji: '👑', name: 'Super Hero Crown' }
  };

  const FINAL_ROUTE_TABLE = {
    hygiene: {
      germdetective: { solo: { url:'./germ-detective.html', type:'run' } },
      handwash:      { solo: { url:'./hygiene-vr.html', type:'run' } },
      brush:         { solo: { url:'./brush-vr.html', type:'run' } },
      maskcough:     { solo: { url:'./maskcough-v2.html', type:'run' } },
      bath:          { solo: { url:'./bath-vr.html', type:'run' } },
      cleanobject:   { solo: { url:'./clean-objects.html', type:'run' } }
    },

    nutrition: {
      goodjunk: {
        solo:   { url:'./goodjunk-launcher.html', type:'launcher' },
        pro:    { url:'./goodjunk-launcher.html', type:'launcher' },
        duet:   { url:'./goodjunk-launcher.html', type:'launcher' },
        race:   { url:'./vr-goodjunk/goodjunk-race-run.html', type:'run' },
        battle: { url:'./vr-goodjunk/goodjunk-battle-run.html', type:'run' },
        coop:   { url:'./vr-goodjunk/goodjunk-coop-run.html', type:'run' },
        teacher:{ url:'./goodjunk-launcher.html', type:'teacher' }
      },
      hydration: {
        solo: { url:'./hydration-vr.html', type:'run' }
      },
      groups: {
        solo:   { url:'./groups-vr.html', type:'launcher' },
        duet:   { url:'./groups-vr.html', type:'launcher' },
        race:   { url:'./groups-vr.html', type:'launcher' },
        battle: { url:'./groups-vr.html', type:'launcher' },
        coop:   { url:'./groups-vr.html', type:'launcher' },
        teacher:{ url:'./groups-vr.html', type:'teacher' }
      },
      plate: {
        solo:   { url:'./plate-vr.html', type:'launcher' },
        duet:   { url:'./plate-vr.html', type:'launcher' },
        race:   { url:'./plate-vr.html', type:'launcher' },
        battle: { url:'./plate-vr.html', type:'launcher' },
        coop:   { url:'./plate-vr.html', type:'launcher' },
        teacher:{ url:'./plate-vr.html', type:'teacher' }
      }
    },

    fitness: {
      jumpduck: {
        solo: { url:'./jump-duck-vr.html', type:'run' }
      },
      shadowbreaker: {
        solo:   { url:'./shadow-breaker-vr.html', type:'launcher' },
        battle: { url:'./shadow-breaker-vr.html', type:'launcher' },
        teacher:{ url:'./shadow-breaker-vr.html', type:'teacher' }
      },
      balancehold: {
        solo: { url:'./balance-hold-vr.html', type:'run' }
      },
      rhythmboxer: {
        solo: { url:'./rhythm-boxer-vr.html', type:'run' }
      },
      fitnessplanner: {
        solo: { url:'./fitness-planner.html', type:'run' }
      }
    }
  };

  const GENERIC_GAME_FALLBACK = {
    goodjunk:      { url:'./goodjunk-launcher.html', type:'launcher' },
    hydration:     { url:'./hydration-vr.html', type:'run' },
    groups:        { url:'./groups-vr.html', type:'launcher' },
    plate:         { url:'./plate-vr.html', type:'launcher' },

    germdetective: { url:'./germ-detective.html', type:'run' },
    handwash:      { url:'./hygiene-vr.html', type:'run' },
    brush:         { url:'./brush-vr.html', type:'run' },
    maskcough:     { url:'./maskcough-v2.html', type:'run' },
    bath:          { url:'./bath-vr.html', type:'run' },
    cleanobject:   { url:'./clean-objects.html', type:'run' },

    jumpduck:      { url:'./jump-duck-vr.html', type:'run' },
    shadowbreaker: { url:'./shadow-breaker-vr.html', type:'launcher' },
    balancehold:   { url:'./balance-hold-vr.html', type:'run' },
    rhythmboxer:   { url:'./rhythm-boxer-vr.html', type:'run' },
    fitnessplanner:{ url:'./fitness-planner.html', type:'run' }
  };

  let pickerState = {
    zone: '',
    kind: 'all',
    gameId: '',
    step: 'games'
  };

  const qs = new URLSearchParams(location.search);
  const $ = (sel) => document.querySelector(sel);

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function safeParse(json, fallback) {
    try {
      const v = JSON.parse(json);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function fmtInt(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  }

  function escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function pretty(obj) {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(obj);
    }
  }

  function starText(n) {
    const v = clamp(fmtInt(n, 0), 0, 3);
    return '⭐'.repeat(v) + '☆'.repeat(3 - v);
  }

  function normalizeGameId(v) {
    return String(v || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function normalizeModeId(v) {
    return String(v || 'solo')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  function todayKey() {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0')
    ].join('-');
  }

  function pathLooksLike(source, candidates) {
    const s = String(source || '').toLowerCase();
    return candidates.some((c) => s.includes(String(c || '').toLowerCase()));
  }

  function zoneFromGameId(gameId) {
    const id = normalizeGameId(gameId);
    if (/wash|brush|germ|hygiene|bath|mask|cough|clean/.test(id)) return 'hygiene';
    if (/plate|group|food|goodjunk|nutrition|hydration/.test(id)) return 'nutrition';
    if (/shadow|rhythm|balance|jump|duck|fitness|planner/.test(id)) return 'fitness';
    return '';
  }

  function zoneLabel(zone) {
    return GAME_CATALOG[zone]?.label || 'HeroHealth';
  }

  function getZoneGames(zone) {
    return GAME_CATALOG[zone]?.games || [];
  }

  function getGame(zone, gameId) {
    const gid = normalizeGameId(gameId);
    return getZoneGames(zone).find((g) => normalizeGameId(g.id) === gid) || null;
  }

  function getDefaultGame(zone) {
    const cat = GAME_CATALOG[zone];
    if (!cat) return null;
    return getGame(zone, cat.defaultGameId) || cat.games[0] || null;
  }

  function getDefaultMode(game) {
    if (!game) return null;
    const target = normalizeModeId(game.defaultMode || 'solo');
    return game.modes.find((m) => normalizeModeId(m.id) === target) || game.modes[0] || null;
  }

  function gameLabelById(zone, gameId) {
    const game = getGame(zone, gameId);
    return game ? game.label : gameId;
  }

  function gameEmojiById(gameId) {
    const map = {
      handwash:'🧼',
      brush:'🪥',
      bath:'🛁',
      goodjunk:'🍔',
      hydration:'💧',
      plate:'🍽️',
      jumpduck:'⬆️',
      shadowbreaker:'🥊',
      balancehold:'⚖️',
      germdetective:'🦠',
      groups:'🥚'
    };
    return map[normalizeGameId(gameId)] || '🎮';
  }

  function getHubCanonical() {
    const url = new URL(location.href);
    url.searchParams.delete('hub');
    return url.toString();
  }

  function carryQuery(url, extra = {}) {
    const u = new URL(url, location.href);

    PASS_KEYS.forEach((k) => {
      if (qs.has(k) && !u.searchParams.has(k)) {
        u.searchParams.set(k, qs.get(k));
      }
    });

    u.searchParams.set('hub', getHubCanonical());

    Object.entries(extra).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      u.searchParams.set(k, String(v));
    });

    return u.toString();
  }

  function gateDoneKey(kind, zone, gameId, pid) {
    return `HHA_${String(kind).toUpperCase()}_DONE:${zone}:${gameId}:${pid}:${todayKey()}`;
  }

  function isWarmupDone(zone, gameId, pid) {
    try {
      return localStorage.getItem(gateDoneKey('warmup', zone, gameId, pid)) === '1';
    } catch {
      return false;
    }
  }

  function isCooldownDone(zone, gameId, pid) {
    try {
      const day = todayKey();
      return (
        localStorage.getItem(`HHA_COOLDOWN_DONE:${zone}:${gameId}:${pid}:${day}`) === '1' ||
        localStorage.getItem(`HHA_COOLDOWN_DONE:${zone}:${pid}:${day}`) === '1' ||
        localStorage.getItem(gateDoneKey('cooldown', zone, gameId, pid)) === '1'
      );
    } catch {
      return false;
    }
  }

  function lookupFinalRouteMeta(zone, gameId, modeId) {
    const z = String(zone || '').trim().toLowerCase();
    const g = normalizeGameId(gameId);
    const m = normalizeModeId(modeId || 'solo');

    const zoneMap = FINAL_ROUTE_TABLE[z];
    if (zoneMap && zoneMap[g]) {
      if (zoneMap[g][m]) return zoneMap[g][m];
      if (zoneMap[g].solo) return zoneMap[g].solo;
    }

    return GENERIC_GAME_FALLBACK[g] || null;
  }

  function lookupFinalRoute(zone, gameId, modeId) {
    const meta = lookupFinalRouteMeta(zone, gameId, modeId);
    return meta?.url || '';
  }

  function getRouteType(zone, game, mode) {
    const modeId = normalizeModeId(mode?.id || game?.defaultMode || 'solo');
    return lookupFinalRouteMeta(zone, game?.id, modeId)?.type || 'run';
  }

  function makeRoomId(game, modeId) {
    const fromQs = String(qs.get('room') || '').trim();
    if (fromQs) return fromQs;
    return `${String(game.id || 'ROOM').toUpperCase()}-ROOM1`;
  }

  function baseSharedParams(zone, game, modeId) {
    const extra = { zone, game: game.id };
    if (modeId && modeId !== 'solo') extra.mode = modeId;
    return extra;
  }

  function buildLauncherParams(zone, game, modeId) {
    const extra = baseSharedParams(zone, game, modeId);

    if (modeId === 'pro') {
      extra.mode = 'solo';
      extra.pro = '1';
      extra.diff = qs.get('diff') || 'hard';
      extra.auto = '0';
    }

    if (['race','battle','coop','duet'].includes(modeId)) {
      extra.mode = modeId;
      extra.room = makeRoomId(game, modeId);
      extra.auto = '1';
    }

    return extra;
  }

  function buildRunParams(zone, game, modeId) {
    const extra = baseSharedParams(zone, game, modeId);

    if (modeId === 'pro') {
      extra.mode = 'solo';
      extra.pro = '1';
      extra.diff = qs.get('diff') || 'hard';
      extra.auto = '0';
    }

    if (['race','battle','coop','duet'].includes(modeId)) {
      extra.mode = modeId;
      extra.room = makeRoomId(game, modeId);
      extra.auto = '1';
    }

    if (!qs.get('seed')) {
      extra.seed = Date.now();
    }

    return extra;
  }

  function buildTeacherParams(zone, game, modeId) {
    const extra = baseSharedParams(zone, game, modeId);
    extra.teacher = '1';
    extra.mode = modeId || 'teacher';
    return extra;
  }

  function shouldUseWarmup(routeType, modeId) {
    const m = normalizeModeId(modeId || 'solo');
    if (routeType === 'teacher') return false;
    if (routeType === 'launcher') return false;
    if (m === 'teacher') return false;
    return true;
  }

  function resolveModeUrl(zone, game, mode) {
    if (!game || !mode) return '#';

    const modeId = normalizeModeId(mode.id) || 'solo';
    const routeMeta = lookupFinalRouteMeta(zone, game.id, modeId);
    if (!routeMeta?.url) return '#';

    let extra = {};

    if (routeMeta.type === 'teacher') {
      extra = buildTeacherParams(zone, game, modeId);
    } else if (routeMeta.type === 'launcher') {
      extra = buildLauncherParams(zone, game, modeId);
    } else {
      extra = buildRunParams(zone, game, modeId);
    }

    return carryQuery(routeMeta.url, extra);
  }

  function buildWarmupGateUrl(zone, game, mode) {
    const baseRunUrl = resolveModeUrl(zone, game, mode);
    const pid = String(qs.get('pid') || 'anon').trim() || 'anon';

    return carryQuery('./warmup-gate.html', {
      phase: 'warmup',
      gatePhase: 'warmup',
      mode: 'warmup',
      cat: zone,
      zone,
      game: game.id,
      pid,
      next: baseRunUrl
    });
  }

  function resolvePlayableUrl(zone, game, mode) {
    if (!game || !mode) return '#';

    const modeId = normalizeModeId(mode.id) || 'solo';
    const routeMeta = lookupFinalRouteMeta(zone, game.id, modeId);
    if (!routeMeta?.url) return '#';

    const directUrl = resolveModeUrl(zone, game, mode);
    const pid = String(qs.get('pid') || 'anon').trim() || 'anon';

    if (!shouldUseWarmup(routeMeta.type, modeId)) {
      return directUrl;
    }

    if (!isWarmupDone(zone, game.id, pid)) {
      return buildWarmupGateUrl(zone, game, mode);
    }

    return directUrl;
  }

  function getAllPlayableModes(zone, game) {
    if (!game) return [];
    return (game.modes || [])
      .map((mode) => {
        const url = resolvePlayableUrl(zone, game, mode);
        return { ...mode, resolvedUrl: url };
      })
      .filter((m) => m.resolvedUrl && m.resolvedUrl !== '#');
  }

  function hasMultipleModes(zone, game) {
    const modes = getAllPlayableModes(zone, game);
    return modes.length > 1;
  }

  function readProfile() {
    const stored = safeParse(localStorage.getItem(STORAGE_KEYS.profile), {});
    const name = (
      qs.get('nick') ||
      qs.get('name') ||
      stored.name ||
      DEFAULT_PLAYER.name
    ).trim();

    return {
      name,
      level: Number(stored.level ?? DEFAULT_PLAYER.level) || DEFAULT_PLAYER.level,
      coins: Number(stored.coins ?? DEFAULT_PLAYER.coins) || DEFAULT_PLAYER.coins,
      hearts: Number(stored.hearts ?? DEFAULT_PLAYER.hearts) || DEFAULT_PLAYER.hearts,
      stars: Number(stored.stars ?? DEFAULT_PLAYER.stars) || DEFAULT_PLAYER.stars,
      wins: Number(stored.wins ?? DEFAULT_PLAYER.wins) || DEFAULT_PLAYER.wins,
      streak: Number(stored.streak ?? DEFAULT_PLAYER.streak) || DEFAULT_PLAYER.streak
    };
  }

  function writeProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
    } catch {}
  }

  function readLastSummary() {
    return safeParse(localStorage.getItem(STORAGE_KEYS.lastSummary), null);
  }

  function readSummaryHistory() {
    const raw = safeParse(localStorage.getItem(STORAGE_KEYS.summaryHistory), []);
    return Array.isArray(raw) ? raw : [];
  }

  function readLastByZone() {
    return safeParse(localStorage.getItem(STORAGE_KEYS.lastByZone), {});
  }

  function writeLastByZone(map) {
    try {
      localStorage.setItem(STORAGE_KEYS.lastByZone, JSON.stringify(map));
    } catch {}
  }

  function readMissionChainProgress() {
    return safeParse(localStorage.getItem(STORAGE_MISSIONS.chain), {});
  }

  function writeMissionChainProgress(data) {
    try {
      localStorage.setItem(STORAGE_MISSIONS.chain, JSON.stringify(data));
    } catch {}
  }

  function readStickerShelf() {
    return safeParse(localStorage.getItem(STORAGE_MISSIONS.stickers), {});
  }

  function writeStickerShelf(data) {
    try {
      localStorage.setItem(STORAGE_MISSIONS.stickers, JSON.stringify(data));
    } catch {}
  }

  function zoneStatsFromHistory(history) {
    const base = JSON.parse(JSON.stringify(ZONE_DEFAULTS));

    history.slice(-30).forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      if (!zone || !base[zone]) return;

      const score = fmtInt(item.score, 0);
      const stars = clamp(fmtInt(item.stars, 0), 0, 5);

      base[zone].pct = clamp(base[zone].pct + (stars >= 2 ? 6 : 2), 10, 100);
      base[zone].stars = clamp(Math.max(base[zone].stars, stars), 0, 5);
      if (score >= 200) base[zone].level = clamp(base[zone].level + 1, 1, 20);
    });

    return base;
  }

  function findGameByUrl(url) {
    const s = String(url || '').toLowerCase();
    if (!s) return null;

    for (const [zone, cat] of Object.entries(GAME_CATALOG)) {
      for (const game of cat.games) {
        const routeCandidates = [];

        (game.modes || []).forEach((mode) => {
          const r = lookupFinalRoute(zone, game.id, mode.id);
          if (r) routeCandidates.push(r);
        });

        routeCandidates.push(
          GENERIC_GAME_FALLBACK[game.id]?.url || '',
          game.id,
          game.label
        );

        if (pathLooksLike(s, routeCandidates.filter(Boolean))) {
          return { zone, game };
        }
      }
    }

    return null;
  }

  function buildLastByZone(history, lastSummary) {
    const map = { ...readLastByZone() };
    const items = [...history];
    if (lastSummary) items.push(lastSummary);

    items.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || item.url || '');
      if (!zone) return;

      let game = null;

      const byId = normalizeGameId(item.gameId || item.game || '');
      if (byId) game = getGame(zone, byId);

      if (!game && item.url) {
        const found = findGameByUrl(item.url);
        if (found) game = found.game;
      }

      if (!game && item.replayUrl) {
        const found = findGameByUrl(item.replayUrl);
        if (found) game = found.game;
      }

      if (!game && item.title) {
        game = getZoneGames(zone).find((g) => {
          const label = String(g.label || '').toLowerCase();
          const t = String(item.title || '').toLowerCase();
          return label.includes(t) || t.includes(label);
        }) || null;
      }

      if (!game) return;

      const modeId = normalizeModeId(item.mode || qs.get('mode') || '') || game.defaultMode;
      const mode = game.modes.find((m) => normalizeModeId(m.id) === modeId) || getDefaultMode(game);

      map[zone] = {
        zone,
        gameId: game.id,
        modeId: mode?.id || game.defaultMode,
        label: game.label,
        url: resolvePlayableUrl(zone, game, mode),
        score: fmtInt(item.score, 0),
        stars: clamp(fmtInt(item.stars, 0), 0, 3),
        time: item.timestampIso || item.time || item.date || '',
        timestampIso: item.timestampIso || item.time || item.date || ''
      };
    });

    writeLastByZone(map);
    return map;
  }

  function mergeSummaryIntoProfile(profile, lastSummary) {
    if (!lastSummary) return profile;

    const next = { ...profile };
    const bonusCoins = Math.max(0, fmtInt(lastSummary.coins ?? lastSummary.rewardCoins, 0));
    const stars = clamp(fmtInt(lastSummary.stars, 0), 0, 3);

    next.coins = Math.max(next.coins, DEFAULT_PLAYER.coins);
    next.stars = Math.max(next.stars, DEFAULT_PLAYER.stars, stars);
    next.level = Math.max(next.level, DEFAULT_PLAYER.level);

    if (bonusCoins > 0 && !lastSummary._hubApplied) {
      next.coins += bonusCoins;
      const patchedSummary = { ...lastSummary, _hubApplied: true };
      try {
        localStorage.setItem(STORAGE_KEYS.lastSummary, JSON.stringify(patchedSummary));
      } catch {}
    }

    writeProfile(next);
    return next;
  }

  function markMissionProgressFromHistory(history) {
    const key = todayKey();
    const progress = readMissionChainProgress();
    const todayProgress = progress[key] || {
      hygiene: [],
      nutrition: [],
      fitness: []
    };

    (history || []).forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || item.url || '');
      const gameId = normalizeGameId(item.gameId || item.game || item.title || item.url || '');
      const stamp = String(item.timestampIso || item.time || item.date || '');

      if (!zone || !gameId || !stamp.startsWith(key)) return;
      if (!MISSION_CHAIN[zone]) return;
      if (!MISSION_CHAIN[zone].includes(gameId)) return;

      if (!todayProgress[zone].includes(gameId)) {
        todayProgress[zone].push(gameId);
      }
    });

    progress[key] = todayProgress;
    writeMissionChainProgress(progress);
    return todayProgress;
  }

  function updateStickerRewards(todayProgress) {
    const shelf = readStickerShelf();
    const key = todayKey();

    const zoneDone = {
      hygiene: MISSION_CHAIN.hygiene.every((id) => (todayProgress.hygiene || []).includes(id)),
      nutrition: MISSION_CHAIN.nutrition.every((id) => (todayProgress.nutrition || []).includes(id)),
      fitness: MISSION_CHAIN.fitness.every((id) => (todayProgress.fitness || []).includes(id))
    };

    shelf[key] = shelf[key] || {
      hygiene: false,
      nutrition: false,
      fitness: false,
      crown: false
    };

    if (zoneDone.hygiene) shelf[key].hygiene = true;
    if (zoneDone.nutrition) shelf[key].nutrition = true;
    if (zoneDone.fitness) shelf[key].fitness = true;
    if (zoneDone.hygiene && zoneDone.nutrition && zoneDone.fitness) shelf[key].crown = true;

    writeStickerShelf(shelf);
    return shelf[key];
  }

  function renderPlayer(profile) {
    $('#playerName') && ($('#playerName').textContent = profile.name || DEFAULT_PLAYER.name);
    $('#playerMeta') && ($('#playerMeta').textContent = 'ฮีโร่ประจำวัน • พร้อมผจญภัย');
    $('#playerLevel') && ($('#playerLevel').textContent = String(profile.level));
    $('#playerCoins') && ($('#playerCoins').textContent = String(profile.coins));
    $('#playerHearts') && ($('#playerHearts').textContent = String(profile.hearts));
    $('#badgeStars') && ($('#badgeStars').textContent = String(profile.stars));
    $('#badgeWins') && ($('#badgeWins').textContent = String(profile.wins));
    $('#badgeStreak') && ($('#badgeStreak').textContent = String(profile.streak));
  }

  function renderZoneStats(stats) {
    $('#hygLevel') && ($('#hygLevel').textContent = String(stats.hygiene.level));
    $('#hygStars') && ($('#hygStars').textContent = `${stats.hygiene.stars}/5`);
    $('#hygProgressText') && ($('#hygProgressText').textContent = `${stats.hygiene.pct}%`);
    $('#hygFill') && ($('#hygFill').style.width = `${stats.hygiene.pct}%`);

    $('#nutriLevel') && ($('#nutriLevel').textContent = String(stats.nutrition.level));
    $('#nutriStars') && ($('#nutriStars').textContent = `${stats.nutrition.stars}/5`);
    $('#nutriProgressText') && ($('#nutriProgressText').textContent = `${stats.nutrition.pct}%`);
    $('#nutriFill') && ($('#nutriFill').style.width = `${stats.nutrition.pct}%`);

    $('#fitLevel') && ($('#fitLevel').textContent = String(stats.fitness.level));
    $('#fitStars') && ($('#fitStars').textContent = `${stats.fitness.stars}/5`);
    $('#fitProgressText') && ($('#fitProgressText').textContent = `${stats.fitness.pct}%`);
    $('#fitFill') && ($('#fitFill').style.width = `${stats.fitness.pct}%`);
  }

  function renderMissions(history) {
    const missionList = $('#missionList');
    if (!missionList) return;

    const todayDone = { hygiene: false, nutrition: false, fitness: false };
    const dayKey = todayKey();

    history.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      const stamp = String(item.timestampIso || item.time || item.date || '');
      if (zone && stamp.startsWith(dayKey)) todayDone[zone] = true;
    });

    const missions = [
      { icon: '🫧', name: 'เล่น Hygiene 1 เกม', sub: 'ล้างมือ แปรงฟัน หรือกันเชื้อโรค', done: todayDone.hygiene },
      { icon: '🥗', name: 'เล่น Nutrition 1 เกม', sub: 'เรียนรู้การกินอาหารที่ดี', done: todayDone.nutrition },
      { icon: '🏃', name: 'เล่น Fitness 1 เกม', sub: 'ขยับร่างกายให้แข็งแรง', done: todayDone.fitness }
    ];

    missionList.innerHTML = missions.map((m) => `
      <div class="mission ${m.done ? 'done' : ''}">
        <div class="mission-icon" aria-hidden="true">${m.icon}</div>
        <div class="mission-text">
          <p class="mission-name">${escapeHtml(m.name)}</p>
          <p class="mission-sub">${escapeHtml(m.sub)}</p>
        </div>
        <div class="mission-check" aria-label="${m.done ? 'สำเร็จ' : 'ยังไม่สำเร็จ'}">
          ${m.done ? '✓' : '•'}
        </div>
      </div>
    `).join('');
  }

  function renderMissionChain(todayProgress) {
    const zones = ['hygiene','nutrition','fitness'];

    zones.forEach((zone) => {
      const hostId =
        zone === 'hygiene' ? '#chainHygiene' :
        zone === 'nutrition' ? '#chainNutrition' :
        '#chainFitness';

      const rewardId =
        zone === 'hygiene' ? '#rewardHygiene' :
        zone === 'nutrition' ? '#rewardNutrition' :
        '#rewardFitness';

      const host = $(hostId);
      const rewardEl = $(rewardId);
      if (!host || !rewardEl) return;

      const doneList = todayProgress[zone] || [];
      const steps = MISSION_CHAIN[zone];

      let activeFound = false;

      host.innerHTML = steps.map((gameId) => {
        const done = doneList.includes(gameId);
        let stateClass = '';
        let stateText = 'ยังไม่เล่น';

        if (done) {
          stateClass = 'done';
          stateText = 'สำเร็จแล้ว';
        } else if (!activeFound) {
          stateClass = 'active';
          stateText = 'ด่านถัดไป';
          activeFound = true;
        }

        return `
          <div class="chain-step ${stateClass}">
            <div class="chain-step-icon">${gameEmojiById(gameId)}</div>
            <div class="chain-step-name">${escapeHtml(gameLabelById(zone, gameId))}</div>
            <div class="chain-step-state">${escapeHtml(stateText)}</div>
          </div>
        `;
      }).join('');

      const complete = steps.every((id) => doneList.includes(id));
      rewardEl.textContent = complete
        ? `${STICKER_REWARDS[zone].emoji} ${STICKER_REWARDS[zone].name}`
        : 'ยังไม่ได้รับ';
    });
  }

  function renderStickerShelf(todayStickerState) {
    const host = $('#stickerShelf');
    if (!host) return;

    const items = [
      { key:'hygiene', ...STICKER_REWARDS.hygiene },
      { key:'nutrition', ...STICKER_REWARDS.nutrition },
      { key:'fitness', ...STICKER_REWARDS.fitness },
      { key:'crown', ...STICKER_REWARDS.crown }
    ];

    host.innerHTML = items.map((item) => {
      const unlocked = !!todayStickerState[item.key];
      return `
        <div class="sticker-card ${unlocked ? '' : 'locked'}">
          <div>
            <div class="sticker-emoji">${unlocked ? item.emoji : '🔒'}</div>
            <div class="sticker-name">${escapeHtml(item.name)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderHeroQuickline(lastByZone) {
    const el = $('#heroQuickline');
    if (!el) return;

    const activeZone = qs.get('zone');
    if (activeZone && lastByZone[activeZone]) {
      el.textContent = `กลับมาจาก ${lastByZone[activeZone].label} แล้ว ไปต่อเกมอื่นได้เลย!`;
      return;
    }

    const completed = Object.values(lastByZone).filter(Boolean).length;
    el.textContent = completed >= 3
      ? 'เก่งมาก! เคยเล่นครบทั้ง 3 โซนแล้ว'
      : 'วันนี้ลองเล่นให้ครบ 3 โซนกันนะ';
  }

  function renderZoneMeta(lastByZone) {
    const maps = [
      ['hygiene', '#hygFeatured', '#btnZoneHygiene', '#hygRecentPill', '#hygRecentText'],
      ['nutrition', '#nutriFeatured', '#btnZoneNutrition', '#nutriRecentPill', '#nutriRecentText'],
      ['fitness', '#fitFeatured', '#btnZoneFitness', '#fitRecentPill', '#fitRecentText']
    ];

    maps.forEach(([zone, featuredSel, btnSel, recentPillSel, recentTextSel]) => {
      const featuredEl = $(featuredSel);
      const btnEl = $(btnSel);
      const recentPillEl = $(recentPillSel);
      const recentTextEl = $(recentTextSel);
      const def = getDefaultGame(zone);
      const recent = lastByZone[zone];

      if (featuredEl && def) featuredEl.textContent = def.label;
      if (btnEl) btnEl.textContent = `ดูเกมในโซน (${getZoneGames(zone).length})`;

      if (recentPillEl && recentTextEl) {
        if (recent) {
          recentPillEl.hidden = false;
          recentTextEl.textContent = recent.label;
        } else {
          recentPillEl.hidden = true;
        }
      }
    });

    const activeZone = qs.get('zone');
    document.querySelectorAll('[data-zone-card]').forEach((el) => el.classList.remove('is-active'));
    if (activeZone) {
      const card = document.querySelector(`#zoneCard-${activeZone}`);
      if (card) card.classList.add('is-active');
    }
  }

  function renderZonePreviews() {
    const maps = [
      ['hygiene', '#hygPreview'],
      ['nutrition', '#nutriPreview'],
      ['fitness', '#fitPreview']
    ];

    maps.forEach(([zone, hostSel]) => {
      const host = $(hostSel);
      const games = getZoneGames(zone);
      if (!host || !games.length) return;

      host.innerHTML = games.slice(0, 4).map((game) => {
        const mode = getDefaultMode(game);
        const url = resolvePlayableUrl(zone, game, mode);
        const multi = hasMultipleModes(zone, game);

        if (multi) {
          return `
            <button class="zone-preview-item" type="button" data-preview-zone="${escapeHtml(zone)}" data-preview-game="${escapeHtml(game.id)}">
              <div class="pill">${escapeHtml(game.label)}</div>
              <div class="zone-preview-label">${escapeHtml(game.sub)}</div>
            </button>
          `;
        }

        return `
          <a class="zone-preview-item" href="${escapeHtml(url)}">
            <div class="pill">${escapeHtml(game.label)}</div>
            <div class="zone-preview-label">${escapeHtml(game.sub)}</div>
          </a>
        `;
      }).join('');

      host.querySelectorAll('[data-preview-game]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const zoneValue = btn.getAttribute('data-preview-zone') || zone;
          const gameId = btn.getAttribute('data-preview-game') || '';
          const game = getGame(zoneValue, gameId);
          if (!game) return;

          const modes = getAllPlayableModes(zoneValue, game);
          if (modes.length <= 1) {
            const onlyMode = modes[0] || getDefaultMode(game);
            const onlyUrl = onlyMode?.resolvedUrl || resolvePlayableUrl(zoneValue, game, onlyMode);
            if (onlyUrl) location.href = onlyUrl;
            return;
          }

          pickerState.zone = zoneValue;
          pickerState.gameId = gameId;
          pickerState.step = 'modes';
          renderPickerModes();
        });
      });
    });
  }

  function GAMES_DEFAULT_URL(zone) {
    const game = getDefaultGame(zone);
    if (!game) return './hub-v2.html';
    return resolvePlayableUrl(zone, game, getDefaultMode(game));
  }

  function renderLastSummary(lastSummary) {
    const box = $('#summaryBox');
    if (!box) return;

    if (!lastSummary) {
      box.innerHTML = `
        <div class="empty">
          ยังไม่มีผลการเล่นล่าสุด<br />
          ลองกด <b>เล่นเลย</b> ที่โซนที่ชอบ แล้วกลับมาดูสรุปตรงนี้ได้เลย
        </div>
      `;
      return;
    }

    const zone = lastSummary.zone || zoneFromGameId(lastSummary.game || lastSummary.gameId || lastSummary.title || '');
    const title = lastSummary.title || lastSummary.game || lastSummary.gameId || 'เกมล่าสุด';
    const score = fmtInt(lastSummary.score, 0);
    const coins = fmtInt(lastSummary.coins ?? lastSummary.rewardCoins, 0);
    const stars = clamp(fmtInt(lastSummary.stars, 0), 0, 3);
    const note = lastSummary.note || lastSummary.feedback || lastSummary.message || 'เก่งมาก! เล่นต่อได้เลย';

    let replayUrl = lastSummary.replayUrl || lastSummary.url || GAMES_DEFAULT_URL(zone);

    const game = lastSummary.gameId ? getGame(zone, lastSummary.gameId) : null;
    if (game) {
      const modeId = normalizeModeId(lastSummary.mode || '') || game.defaultMode;
      const mode = game.modes.find((m) => normalizeModeId(m.id) === modeId) || getDefaultMode(game);
      replayUrl = resolvePlayableUrl(zone, game, mode);
    }

    box.innerHTML = `
      <div class="last-summary">
        <div class="last-head">
          <div>
            <p class="last-title">${escapeHtml(title)}</p>
            <p class="last-meta">${escapeHtml(zoneLabel(zone))}</p>
          </div>
          <div class="last-badge">✨ ล่าสุด</div>
        </div>

        <div class="score-strip">
          <div class="score-pill">
            <span class="n">${score}</span>
            <span class="t">Score</span>
          </div>
          <div class="score-pill">
            <span class="n">${starText(stars)}</span>
            <span class="t">Stars</span>
          </div>
          <div class="score-pill">
            <span class="n">${coins}</span>
            <span class="t">Coins</span>
          </div>
        </div>

        <p class="last-meta">${escapeHtml(note)}</p>

        <a class="btn primary" href="${escapeHtml(replayUrl)}">
          ▶️ เล่นต่อ
        </a>
      </div>
    `;
  }

  function renderLibraryBox(lastByZone) {
    const box = $('#libraryBox');
    if (!box) return;

    const cards = Object.entries(GAME_CATALOG).map(([zone, set]) => {
      const names = set.games.map((item) => item.label).join(' • ');
      const recent = lastByZone[zone];
      const def = getDefaultGame(zone);
      const defHasMulti = def ? hasMultipleModes(zone, def) : false;

      return `
        <div class="library-card">
          <div class="library-top">
            <div class="library-name">${escapeHtml(set.label)}</div>
            <div class="library-count">${set.games.length} เกม</div>
          </div>

          <div class="library-games">${escapeHtml(names)}</div>

          <div class="library-actions">
            ${
              defHasMulti
                ? `<button class="btn secondary small" type="button" data-open-zone="${escapeHtml(zone)}" data-open-kind="recommended">🎮 เลือกโหมด</button>`
                : `<a class="btn secondary small" href="${escapeHtml(resolvePlayableUrl(zone, def, getDefaultMode(def)))}">🎮 เล่นแนะนำ</a>`
            }
            <button class="btn secondary small" type="button" data-open-zone="${escapeHtml(zone)}" data-open-kind="all">🗺️ ทุกเกม</button>
            ${
              recent
                ? `<a class="btn secondary small" href="${escapeHtml(recent.url)}">🕹️ เล่นล่าสุด</a>`
                : `<div class="library-empty">ยังไม่มีเกมล่าสุด</div>`
            }
          </div>
        </div>
      `;
    }).join('');

    box.innerHTML = cards;

    box.querySelectorAll('[data-open-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        openPicker(btn.getAttribute('data-open-zone') || '', btn.getAttribute('data-open-kind') || 'all');
      });
    });
  }

  function renderQuickStats(history, lastSummary) {
    const dayKey = todayKey();
    const todayItems = [...(history || [])];

    if (lastSummary) {
      const stamp = String(lastSummary.timestampIso || lastSummary.time || lastSummary.date || '');
      const alreadyIncluded = todayItems.some((item) => {
        const a = String(item.timestampIso || item.time || item.date || '');
        const ag = String(item.gameId || item.game || '');
        const bg = String(lastSummary.gameId || lastSummary.game || '');
        return a === stamp && ag === bg;
      });

      if (stamp.startsWith(dayKey) && !alreadyIncluded) {
        todayItems.push(lastSummary);
      }
    }

    const filteredToday = todayItems.filter((item) => {
      const stamp = String(item.timestampIso || item.time || item.date || '');
      return stamp.startsWith(dayKey);
    });

    const zoneSet = new Set();
    filteredToday.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      if (zone) zoneSet.add(zone);
    });

    $('#todayPlayedCount') && ($('#todayPlayedCount').textContent = String(filteredToday.length));
    $('#todayZoneCount') && ($('#todayZoneCount').textContent = String(zoneSet.size));
    $('#todayLastGame') && ($('#todayLastGame').textContent =
      lastSummary ? String(lastSummary.title || lastSummary.game || lastSummary.gameId || 'ล่าสุด') : 'ยังไม่มี');

    const nextText = pickNextSuggestedGameText(lastSummary);
    $('#todayNextGame') && ($('#todayNextGame').textContent = nextText);
  }

  function pickNextSuggestedGameText(lastSummary) {
    if (!lastSummary) {
      const def = getDefaultGame('nutrition');
      return def ? def.label : 'ระบบกำลังเลือกให้';
    }

    const zone = lastSummary.zone || zoneFromGameId(lastSummary.game || lastSummary.gameId || '');
    if (!zone) return 'ระบบกำลังเลือกให้';

    const chain = MISSION_CHAIN[zone] || [];
    const current = normalizeGameId(lastSummary.gameId || lastSummary.game || '');
    const idx = chain.findIndex((g) => normalizeGameId(g) === current);

    if (idx >= 0 && idx < chain.length - 1) {
      return gameLabelById(zone, chain[idx + 1]);
    }

    const def = getDefaultGame(zone);
    return def ? def.label : 'ระบบกำลังเลือกให้';
  }

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function getMostRecentZoneEntry(lastByZone) {
    const items = Object.values(lastByZone || {}).filter(Boolean);
    if (!items.length) return null;

    items.sort((a, b) => {
      const ta = Date.parse(a.time || '') || 0;
      const tb = Date.parse(b.time || '') || 0;
      return tb - ta;
    });

    return items[0] || null;
  }

  function openPicker(zone, kind = 'all') {
    pickerState.zone = zone || 'nutrition';
    pickerState.kind = kind || 'all';
    pickerState.gameId = '';
    pickerState.step = 'games';
    renderPickerGames();
  }

  function closePicker() {
    const picker = $('#gamePicker');
    if (!picker) return;
    picker.classList.remove('show');
    picker.setAttribute('aria-hidden', 'true');
  }

  function renderPickerGames() {
    const picker = $('#gamePicker');
    const title = $('#pickerTitle');
    const sub = $('#pickerSub');
    const list = $('#pickerList');
    if (!picker || !title || !sub || !list) return;

    title.textContent = zoneLabel(pickerState.zone);
    sub.textContent =
      pickerState.kind === 'recommended'
        ? `เลือกเกมแนะนำใน ${zoneLabel(pickerState.zone)}`
        : pickerState.kind === 'recent'
          ? `เลือกเกมล่าสุดใน ${zoneLabel(pickerState.zone)}`
          : `เลือกเกมใน ${zoneLabel(pickerState.zone)} ได้เลย`;

    let games = getZoneGames(pickerState.zone);

    if (pickerState.kind === 'recommended') {
      const recommended = getDefaultGame(pickerState.zone);
      games = recommended ? [recommended] : games;
    }

    if (pickerState.kind === 'recent') {
      const recent = readLastByZone()[pickerState.zone];
      if (recent) {
        const game = getGame(pickerState.zone, recent.gameId);
        games = game ? [game] : [];
      } else {
        games = [];
      }
    }

    if (!games.length) {
      list.innerHTML = `
        <div class="empty">
          ยังไม่มีเกมในหมวดนี้ตอนนี้<br />
          ลองเลือกหมวดอื่น หรือเริ่มจากเกมแนะนำก่อนนะ
        </div>
      `;
    } else {
      list.innerHTML = games.map((game) => `
        <button class="picker-item" type="button" data-game-id="${escapeHtml(game.id)}" data-zone="${escapeHtml(pickerState.zone)}">
          <span class="picker-item-top">
            <span class="name">${escapeHtml(game.label)}</span>
            <span class="picker-badge zone">${escapeHtml(zoneLabel(pickerState.zone))}</span>
          </span>
          <span class="sub">${escapeHtml(game.sub)}</span>
        </button>
      `).join('');
    }

    list.querySelectorAll('.picker-item[data-game-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const zone = btn.getAttribute('data-zone') || pickerState.zone;
        const gameId = btn.getAttribute('data-game-id') || '';
        const game = getGame(zone, gameId);
        if (!game) return;

        const modes = getAllPlayableModes(zone, game);
        if (modes.length <= 1) {
          const onlyMode = modes[0] || getDefaultMode(game);
          const onlyUrl = onlyMode?.resolvedUrl || resolvePlayableUrl(zone, game, onlyMode);
          closePicker();
          if (onlyUrl) location.href = onlyUrl;
          return;
        }

        pickerState.zone = zone;
        pickerState.gameId = gameId;
        pickerState.step = 'modes';
        renderPickerModes();
      });
    });

    picker.classList.add('show');
    picker.setAttribute('aria-hidden', 'false');
  }

  function renderPickerModes() {
    const picker = $('#gamePicker');
    const title = $('#pickerTitle');
    const sub = $('#pickerSub');
    const list = $('#pickerList');
    if (!picker || !title || !sub || !list) return;

    const game = getGame(pickerState.zone, pickerState.gameId);
    if (!game) {
      renderPickerGames();
      return;
    }

    const modes = getAllPlayableModes(pickerState.zone, game);

    title.textContent = game.label;
    sub.textContent = `${game.sub} • เลือกโหมดที่อยากเล่นได้เลย`;

    if (!modes.length) {
      list.innerHTML = `<div class="empty">เกมนี้ยังไม่มีโหมดที่พร้อมใช้งานตอนนี้</div>`;
      return;
    }

    list.innerHTML = modes.map((mode) => {
      const routeType = getRouteType(pickerState.zone, game, mode);
      const routeLabel =
        routeType === 'teacher' ? 'Teacher' :
        routeType === 'launcher' ? 'Launcher' :
        'Run';

      return `
        <button class="picker-item mode-${escapeHtml(mode.id)}" type="button" data-mode-id="${escapeHtml(mode.id)}">
          <span class="picker-item-top">
            <span class="name">${escapeHtml(MODE_LABELS[mode.id] || mode.id)}</span>
            ${normalizeModeId(mode.id) === normalizeModeId(game.defaultMode)
              ? '<span class="picker-badge recommended">แนะนำ</span>'
              : '<span class="picker-badge mode">โหมด</span>'}
          </span>
          <span class="sub">${escapeHtml(game.label)} • ${escapeHtml(zoneLabel(pickerState.zone))} • ${escapeHtml(routeLabel)}</span>
        </button>
      `;
    }).join('');

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'picker-item';
    backBtn.innerHTML = `
      <span class="picker-item-top">
        <span class="name">⬅ กลับไปเลือกเกม</span>
      </span>
      <span class="sub">ย้อนกลับไปยังรายการเกม</span>
    `;
    backBtn.addEventListener('click', () => {
      pickerState.step = 'games';
      renderPickerGames();
    });
    list.appendChild(backBtn);

    list.querySelectorAll('[data-mode-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeId = btn.getAttribute('data-mode-id') || '';
        const mode = modes.find((m) => m.id === modeId);
        if (!mode) return;
        closePicker();
        location.href = mode.resolvedUrl;
      });
    });

    picker.classList.add('show');
    picker.setAttribute('aria-hidden', 'false');
  }

  function collectWarmupSnapshot() {
    const pid = String(qs.get('pid') || 'anon').trim() || 'anon';
    const zones = Object.keys(GAME_CATALOG);
    const out = {};

    zones.forEach((zone) => {
      out[zone] = {};
      getZoneGames(zone).forEach((game) => {
        out[zone][game.id] = {
          warmupDone: isWarmupDone(zone, game.id, pid),
          cooldownDone: isCooldownDone(zone, game.id, pid)
        };
      });
    });

    return out;
  }

  function collectResolvedRoutes() {
    const out = {};

    Object.entries(GAME_CATALOG).forEach(([zone, cat]) => {
      out[zone] = {};
      cat.games.forEach((game) => {
        out[zone][game.id] = {};
        (game.modes || []).forEach((mode) => {
          out[zone][game.id][mode.id] = {
            routeType: getRouteType(zone, game, mode),
            direct: resolveModeUrl(zone, game, mode),
            playable: resolvePlayableUrl(zone, game, mode)
          };
        });
      });
    });

    return out;
  }

  function collectContextSnapshot(profile, lastSummary, lastByZone) {
    return {
      query: Object.fromEntries(qs.entries()),
      profile,
      lastSummary,
      lastByZone,
      todayKey: todayKey()
    };
  }

  function renderDiagnostics(profile, lastSummary, lastByZone) {
    const contextEl = $('#diagContext');
    const warmupEl = $('#diagWarmup');
    const lastSummaryEl = $('#diagLastSummary');
    const recentByZoneEl = $('#diagRecentByZone');
    const routesEl = $('#diagResolvedRoutes');
    const linksEl = $('#diagQuickLinks');

    contextEl && (contextEl.textContent = pretty(collectContextSnapshot(profile, lastSummary, lastByZone)));
    warmupEl && (warmupEl.textContent = pretty(collectWarmupSnapshot()));
    lastSummaryEl && (lastSummaryEl.textContent = pretty(lastSummary || {}));
    recentByZoneEl && (recentByZoneEl.textContent = pretty(lastByZone || {}));
    routesEl && (routesEl.textContent = pretty(collectResolvedRoutes()));

    if (linksEl) {
      const rows = [];
      Object.entries(GAME_CATALOG).forEach(([zone, cat]) => {
        cat.games.forEach((game) => {
          (game.modes || []).forEach((mode) => {
            const url = resolvePlayableUrl(zone, game, mode);
            if (url && url !== '#') {
              rows.push(`
                <a class="diag-link" href="${escapeHtml(url)}">
                  ${escapeHtml(game.label)}<br>${escapeHtml(MODE_LABELS[mode.id] || mode.id)}
                </a>
              `);
            }
          });
        });
      });
      linksEl.innerHTML = rows.join('');
    }
  }

  function bindTopButtons(profile, lastByZone) {
    $('#btnSettings')?.addEventListener('click', () => {
      toast('หน้าตั้งค่าจะเพิ่มต่อได้ภายหลัง');
    });

    $('#btnRewards')?.addEventListener('click', () => {
      toast(`ตอนนี้มี ${profile.coins} เหรียญ และ ${profile.stars} ดาว`);
    });

    $('#btnQuickRecommended')?.addEventListener('click', () => {
      const zone = qs.get('zone') || 'nutrition';
      openPicker(zone, 'recommended');
    });

    $('#btnQuickRecent')?.addEventListener('click', () => {
      const recent = getMostRecentZoneEntry(lastByZone);
      if (recent?.url) {
        location.href = recent.url;
        return;
      }
      toast('ยังไม่มีเกมล่าสุด');
    });

    $('#btnQuickAllGames')?.addEventListener('click', () => {
      const zone = qs.get('zone') || 'nutrition';
      openPicker(zone, 'all');
    });
  }

  function bindZoneLinks() {
    const playHyg = $('#btnPlayHygiene');
    const playNut = $('#btnPlayNutrition');
    const playFit = $('#btnPlayFitness');

    const zoneHyg = $('#btnZoneHygiene');
    const zoneNut = $('#btnZoneNutrition');
    const zoneFit = $('#btnZoneFitness');

    const hygDef = getDefaultGame('hygiene');
    const nutDef = getDefaultGame('nutrition');
    const fitDef = getDefaultGame('fitness');

    if (playHyg && hygDef) {
      if (hasMultipleModes('hygiene', hygDef)) {
        playHyg.href = '#';
        playHyg.addEventListener('click', (e) => {
          e.preventDefault();
          openPicker('hygiene', 'recommended');
        });
      } else {
        playHyg.href = resolvePlayableUrl('hygiene', hygDef, getDefaultMode(hygDef));
      }
    }

    if (playNut && nutDef) {
      if (hasMultipleModes('nutrition', nutDef)) {
        playNut.href = '#';
        playNut.addEventListener('click', (e) => {
          e.preventDefault();
          openPicker('nutrition', 'recommended');
        });
      } else {
        playNut.href = resolvePlayableUrl('nutrition', nutDef, getDefaultMode(nutDef));
      }
    }

    if (playFit && fitDef) {
      if (hasMultipleModes('fitness', fitDef)) {
        playFit.href = '#';
        playFit.addEventListener('click', (e) => {
          e.preventDefault();
          openPicker('fitness', 'recommended');
        });
      } else {
        playFit.href = resolvePlayableUrl('fitness', fitDef, getDefaultMode(fitDef));
      }
    }

    zoneHyg?.addEventListener('click', () => openPicker('hygiene', 'all'));
    zoneNut?.addEventListener('click', () => openPicker('nutrition', 'all'));
    zoneFit?.addEventListener('click', () => openPicker('fitness', 'all'));
  }

  function bindResumeButtons(lastSummary) {
    $('#btnResumeNow')?.addEventListener('click', () => {
      if (!lastSummary) {
        const def = getDefaultGame('nutrition');
        if (def) location.href = resolvePlayableUrl('nutrition', def, getDefaultMode(def));
        return;
      }

      const zone = lastSummary.zone || zoneFromGameId(lastSummary.game || lastSummary.gameId || '');
      const game = lastSummary.gameId ? getGame(zone, lastSummary.gameId) : null;
      if (!game) {
        const def = getDefaultGame(zone || 'nutrition');
        if (def) location.href = resolvePlayableUrl(zone || 'nutrition', def, getDefaultMode(def));
        return;
      }

      const modeId = normalizeModeId(lastSummary.mode || '') || game.defaultMode;
      const mode = game.modes.find((m) => normalizeModeId(m.id) === modeId) || getDefaultMode(game);
      location.href = resolvePlayableUrl(zone, game, mode);
    });

    $('#btnNextInZone')?.addEventListener('click', () => {
      if (!lastSummary) {
        const def = getDefaultGame('nutrition');
        if (def) location.href = resolvePlayableUrl('nutrition', def, getDefaultMode(def));
        return;
      }

      const zone = lastSummary.zone || zoneFromGameId(lastSummary.game || lastSummary.gameId || '');
      const chain = MISSION_CHAIN[zone] || [];
      const current = normalizeGameId(lastSummary.gameId || lastSummary.game || '');
      const idx = chain.findIndex((g) => normalizeGameId(g) === current);
      let targetGame = null;

      if (idx >= 0 && idx < chain.length - 1) {
        targetGame = getGame(zone, chain[idx + 1]);
      }
      if (!targetGame) targetGame = getDefaultGame(zone || 'nutrition');
      if (!targetGame) return;

      location.href = resolvePlayableUrl(zone || 'nutrition', targetGame, getDefaultMode(targetGame));
    });
  }

  function bindPicker() {
    document.querySelectorAll('[data-close-picker]').forEach((el) => {
      el.addEventListener('click', closePicker);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePicker();
    });

    $('#pickerShowRecommended')?.addEventListener('click', () => {
      if (!pickerState.zone) pickerState.zone = 'nutrition';
      pickerState.kind = 'recommended';
      pickerState.step = 'games';
      renderPickerGames();
    });

    $('#pickerShowAllModes')?.addEventListener('click', () => {
      if (!pickerState.zone) pickerState.zone = 'nutrition';
      pickerState.kind = 'all';
      pickerState.step = 'games';
      renderPickerGames();
    });

    $('#pickerShowRecent')?.addEventListener('click', () => {
      if (!pickerState.zone) pickerState.zone = 'nutrition';
      pickerState.kind = 'recent';
      pickerState.step = 'games';
      renderPickerGames();
    });
  }

  function bindMissionReset() {
    const btn = $('#btnResetTodayMissions');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const key = todayKey();

      const progress = readMissionChainProgress();
      const shelf = readStickerShelf();

      delete progress[key];
      delete shelf[key];

      writeMissionChainProgress(progress);
      writeStickerShelf(shelf);

      toast('รีเซ็ตภารกิจและสติกเกอร์ของวันนี้แล้ว');
      location.reload();
    });
  }

  function bindDiagnostics(profile, lastSummary, lastByZone) {
    const panel = $('#diagnosticsPanel');
    const btnOpen = $('#btnDiagnostics');
    const btnClose = $('#btnCloseDiagnostics');
    const btnCopy = $('#btnCopyDebugSnapshot');

    if (btnOpen) {
      const debugEnabled = qs.get('debug') === '1' || qs.get('diag') === '1';
      if (!debugEnabled) {
        btnOpen.hidden = true;
      } else {
        btnOpen.addEventListener('click', () => {
          if (!panel) return;
          panel.hidden = false;
          renderDiagnostics(profile, lastSummary, lastByZone);
          toast('เปิด Diagnostics แล้ว');
        });
      }
    }

    btnClose?.addEventListener('click', () => {
      if (!panel) return;
      panel.hidden = true;
    });

    btnCopy?.addEventListener('click', async () => {
      const snapshot = {
        context: collectContextSnapshot(profile, lastSummary, lastByZone),
        warmup: collectWarmupSnapshot(),
        routes: collectResolvedRoutes()
      };

      try {
        await navigator.clipboard.writeText(pretty(snapshot));
        toast('คัดลอก debug snapshot แล้ว');
      } catch {
        toast('คัดลอกไม่สำเร็จ');
      }
    });
  }

  function boot() {
    let profile = readProfile();
    const lastSummary = readLastSummary();
    const history = readSummaryHistory();
    const lastByZone = buildLastByZone(history, lastSummary);

    profile = mergeSummaryIntoProfile(profile, lastSummary);

    const todayProgress = markMissionProgressFromHistory(history);
    const todayStickerState = updateStickerRewards(todayProgress);

    renderPlayer(profile);
    renderZoneStats(zoneStatsFromHistory(history));
    renderMissions(history);
    renderHeroQuickline(lastByZone);
    renderZoneMeta(lastByZone);
    renderZonePreviews();
    renderLastSummary(lastSummary);
    renderLibraryBox(lastByZone);
    renderQuickStats(history, lastSummary);
    renderMissionChain(todayProgress);
    renderStickerShelf(todayStickerState);

    bindZoneLinks();
    bindTopButtons(profile, lastByZone);
    bindResumeButtons(lastSummary);
    bindPicker();
    bindMissionReset();
    bindDiagnostics(profile, lastSummary, lastByZone);
  }

  boot();
})();