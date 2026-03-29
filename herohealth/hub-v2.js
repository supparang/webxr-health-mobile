(function () {
  'use strict';

  const PASS_KEYS = [
    'pid','nick','name',
    'run','view','diff','time','seed',
    'studyId','phase','conditionGroup','sessionOrder','blockLabel',
    'siteCode','schoolYear','semester',
    'log','api','debug',
    'grade','zone',
    'room','pro','ai','sbUrl','sbAnon',
    'planSeq','planDay','planSlot','planMode','planSlots','planIndex',
    'autoNext','cdnext',
    'mode'
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

  const MODE_LABELS = {
    solo: '🎮 Solo',
    pro: '🔥 PRO',
    duet: '🧑‍🤝‍🧑 Duet',
    race: '🏁 Race',
    battle: '⚔️ Battle',
    coop: '🤝 Co-op',
    teacher: '🧑‍🏫 Teacher'
  };

  const GAME_ALIASES = {
    germdetective: ['germdetective','germ-detective','germ detective','germ'],
    handwash: ['handwash','hand-wash','washhands','hygiene','hygiene-vr'],
    brush: ['brush','brush-vr','toothbrush'],
    maskcough: ['maskcough','mask-cough','maskandcough','mask & cough'],
    bath: ['bath','bath-vr'],
    cleanobject: ['cleanobject','clean-object','cleanobjects','clean-objects'],

    goodjunk: ['goodjunk','good-junk','gj'],
    hydration: ['hydration','hydration-vr','water'],
    groups: ['groups','group','foodgroups','food-groups'],
    plate: ['plate','plate-vr','plate-v1','balancedplate','balanced-plate'],

    shadowbreaker: ['shadowbreaker','shadow-breaker','shadow breaker','sb'],
    rhythmboxer: ['rhythmboxer','rhythm-boxer','rhythm boxer','rb'],
    balancehold: ['balancehold','balance-hold','balance hold'],
    jumpduck: ['jumpduck','jump-duck','jump duck','jd'],
    fitnessplanner: ['fitnessplanner','fitness-planner','fitness planner','planner']
  };

  const MODE_ALIASES = {
    solo: ['solo','single','normal'],
    pro: ['pro','hardpro'],
    duet: ['duet','pair','2p'],
    race: ['race','racing'],
    battle: ['battle','versus','vs','pvp'],
    coop: ['coop','co-op','team'],
    teacher: ['teacher','dashboard','board']
  };

  const qs = new URLSearchParams(location.search);
  const $ = (sel) => document.querySelector(sel);

  let pickerState = {
    zone: '',
    kind: 'all',
    gameId: '',
    step: 'games'
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
          modes: [
            { id:'solo', url:'./germ-detective.html' }
          ]
        },
        {
          id: 'handwash',
          label: 'Handwash VR',
          sub: 'ล้างมือให้ครบขั้นตอน',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./hygiene-vr.html' }
          ]
        },
        {
          id: 'brush',
          label: 'Brush VR',
          sub: 'แปรงฟันให้สะอาดสดใส',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./brush-vr.html' }
          ]
        },
        {
          id: 'maskcough',
          label: 'Mask & Cough',
          sub: 'ฝึกปิดปากและป้องกันเชื้อโรค',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./maskcough-v2.html' }
          ]
        },
        {
          id: 'bath',
          label: 'Bath VR',
          sub: 'อาบน้ำให้สะอาดและสนุก',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./bath-vr.html' }
          ]
        },
        {
          id: 'cleanobject',
          label: 'Clean Objects',
          sub: 'เลือกของสะอาดให้ถูกต้อง',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./clean-objects.html' }
          ]
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
            { id:'race',   url:'./goodjunk-launcher.html' },
            { id:'battle', url:'./goodjunk-launcher.html' },
            { id:'coop',   url:'./goodjunk-launcher.html' }
          ]
        },
        {
          id: 'hydration',
          label: 'Hydration VR',
          sub: 'ดื่มน้ำให้พอดีและดูแลร่างกาย',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./hydration-vr.html' }
          ]
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
            { id:'coop',   url:'./groups-vr.html' }
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
            { id:'coop',   url:'./plate-vr.html' }
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
          modes: [
            { id:'solo', url:'./jump-duck-vr.html' }
          ]
        },
        {
          id: 'shadowbreaker',
          label: 'Shadow Breaker',
          sub: 'ต่อยเป้าให้แม่นและเร็ว',
          defaultMode: 'solo',
          modes: [
            { id:'solo',   url:'./shadow-breaker-vr.html' },
            { id:'battle', url:'./shadow-breaker-vr.html' }
          ]
        },
        {
          id: 'balancehold',
          label: 'Balance Hold',
          sub: 'ทรงตัวให้นานที่สุด',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./balance-hold-vr.html' }
          ]
        },
        {
          id: 'rhythmboxer',
          label: 'Rhythm Boxer',
          sub: 'ชกตามจังหวะเพลง',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./rhythm-boxer-vr.html' }
          ]
        },
        {
          id: 'fitnessplanner',
          label: 'Fitness Planner',
          sub: 'วางแผนออกกำลังกายแบบสนุก ๆ',
          defaultMode: 'solo',
          modes: [
            { id:'solo', url:'./fitness-planner.html' }
          ]
        }
      ]
    }
  };

  const ZONE_DEFAULTS = {
    hygiene: { level: 5, stars: 4, pct: 80 },
    nutrition: { level: 4, stars: 3, pct: 60 },
    fitness: { level: 3, stars: 2, pct: 40 }
  };

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

  function starText(n) {
    const v = clamp(fmtInt(n, 0), 0, 3);
    return '⭐'.repeat(v) + '☆'.repeat(3 - v);
  }

  function normalizeText(v) {
    return String(v || '')
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9\-./]/g, '');
  }

  function normalizeGameId(v) {
    const s = normalizeText(v);
    if (!s) return '';
    for (const [canonical, aliases] of Object.entries(GAME_ALIASES)) {
      if (aliases.includes(s)) return canonical;
    }
    return s.replace(/[^a-z0-9]/g, '');
  }

  function normalizeModeId(v) {
    const s = normalizeText(v);
    if (!s) return '';
    for (const [canonical, aliases] of Object.entries(MODE_ALIASES)) {
      if (aliases.includes(s)) return canonical;
    }
    return s.replace(/[^a-z0-9]/g, '');
  }

  function pathLooksLike(url, parts) {
    const s = normalizeText(url);
    return parts.some((p) => s.includes(normalizeText(p)));
  }

  function zoneFromGameId(gameIdOrUrl) {
    const id = normalizeGameId(gameIdOrUrl);

    if (['germdetective','handwash','brush','maskcough','bath','cleanobject'].includes(id)) return 'hygiene';
    if (['goodjunk','hydration','groups','plate'].includes(id)) return 'nutrition';
    if (['shadowbreaker','rhythmboxer','balancehold','jumpduck','fitnessplanner'].includes(id)) return 'fitness';

    const raw = String(gameIdOrUrl || '').toLowerCase();
    if (/wash|brush|germ|bath|mask|cough|clean|hygiene/.test(raw)) return 'hygiene';
    if (/plate|group|food|goodjunk|hydration|nutrition/.test(raw)) return 'nutrition';
    if (/shadow|rhythm|balance|jump|duck|fitness|planner/.test(raw)) return 'fitness';
    return '';
  }

  function zoneLabel(zone) {
    return GAME_CATALOG[zone]?.label || 'HeroHealth';
  }

  function getZoneGames(zone) {
    return GAME_CATALOG[zone]?.games || [];
  }

  function getGame(zone, gameId) {
    const id = normalizeGameId(gameId);
    return getZoneGames(zone).find((g) => g.id === id) || null;
  }

  function getDefaultGame(zone) {
    const cat = GAME_CATALOG[zone];
    if (!cat) return null;
    return getGame(zone, cat.defaultGameId) || cat.games[0] || null;
  }

  function getDefaultMode(game) {
    if (!game) return null;
    return game.modes.find((m) => m.id === game.defaultMode) || game.modes[0] || null;
  }

  function findGameByName(zone, name) {
    const target = String(name || '').trim().toLowerCase();
    if (!target) return null;

    return getZoneGames(zone).find((g) => {
      const label = String(g.label || '').toLowerCase();
      const sub = String(g.sub || '').toLowerCase();
      const id = String(g.id || '').toLowerCase();
      return label.includes(target) || target.includes(label) || sub.includes(target) || id === normalizeGameId(target);
    }) || null;
  }

  function findGameByUrl(url) {
    const s = String(url || '').toLowerCase();
    if (!s) return null;

    for (const [zone, cat] of Object.entries(GAME_CATALOG)) {
      for (const game of cat.games) {
        for (const mode of game.modes) {
          if (pathLooksLike(s, [mode.url, game.id, game.label])) {
            return { zone, game };
          }
        }
      }
    }
    return null;
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
      if (v !== undefined && v !== null && v !== '') {
        u.searchParams.set(k, String(v));
      }
    });

    return u.toString();
  }

  function resolveModeUrl(zone, game, mode) {
    if (!game || !mode) return '#';

    const modeId = normalizeModeId(mode.id) || 'solo';
    const extra = { zone, game: game.id, mode: modeId };

    if (modeId === 'pro') {
      extra.mode = 'solo';
      extra.pro = '1';
      extra.diff = qs.get('diff') || 'hard';
      extra.auto = '0';
    }

    if (['race','battle','coop','duet'].includes(modeId)) {
      extra.room = String(qs.get('room') || `${String(game.id).toUpperCase()}-ROOM1`).trim();
      extra.auto = '1';
    }

    return carryQuery(mode.url, extra);
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

  function zoneStatsFromHistory(history) {
    const base = JSON.parse(JSON.stringify(ZONE_DEFAULTS));

    history.slice(-30).forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || item.url || '');
      if (!zone || !base[zone]) return;

      const score = fmtInt(item.score, 0);
      const stars = clamp(fmtInt(item.stars, 0), 0, 3);

      base[zone].pct = clamp(base[zone].pct + (stars >= 2 ? 6 : 2), 10, 100);
      base[zone].stars = clamp(Math.max(base[zone].stars, stars), 0, 5);
      if (score >= 200) base[zone].level = clamp(base[zone].level + 1, 1, 20);
    });

    return base;
  }

  function buildLastByZone(history, lastSummary) {
    const map = { ...readLastByZone() };
    const items = [...history];
    if (lastSummary) items.push(lastSummary);

    items.forEach((item) => {
      const inferredFromUrl = findGameByUrl(item.replayUrl || item.url || '');
      const zone =
        item.zone ||
        inferredFromUrl?.zone ||
        zoneFromGameId(item.game || item.gameId || item.title || item.url || '');

      if (!zone) return;

      const rawGameId = item.game || item.gameId || item.title || '';
      const game =
        (inferredFromUrl && inferredFromUrl.zone === zone ? inferredFromUrl.game : null) ||
        getGame(zone, rawGameId) ||
        findGameByName(zone, rawGameId) ||
        getDefaultGame(zone);

      if (!game) return;

      const modeId = normalizeModeId(item.mode || qs.get('mode') || '') || game.defaultMode;
      const mode = game.modes.find((m) => m.id === modeId) || getDefaultMode(game);

      map[zone] = {
        zone,
        gameId: game.id,
        label: game.label,
        url: resolveModeUrl(zone, game, mode),
        score: fmtInt(item.score, 0),
        stars: clamp(fmtInt(item.stars, 0), 0, 3),
        time: item.timestampIso || item.time || item.date || ''
      };
    });

    writeLastByZone(map);
    return map;
  }

  function renderPlayer(profile) {
    if ($('#playerName')) $('#playerName').textContent = profile.name || DEFAULT_PLAYER.name;
    if ($('#playerMeta')) $('#playerMeta').textContent = 'ฮีโร่ประจำวัน • พร้อมผจญภัย';
    if ($('#playerLevel')) $('#playerLevel').textContent = String(profile.level);
    if ($('#playerCoins')) $('#playerCoins').textContent = String(profile.coins);
    if ($('#playerHearts')) $('#playerHearts').textContent = String(profile.hearts);
    if ($('#badgeStars')) $('#badgeStars').textContent = String(profile.stars);
    if ($('#badgeWins')) $('#badgeWins').textContent = String(profile.wins);
    if ($('#badgeStreak')) $('#badgeStreak').textContent = String(profile.streak);
  }

  function renderZoneStats(stats) {
    if ($('#hygLevel')) $('#hygLevel').textContent = String(stats.hygiene.level);
    if ($('#hygStars')) $('#hygStars').textContent = `${stats.hygiene.stars}/5`;
    if ($('#hygProgressText')) $('#hygProgressText').textContent = `${stats.hygiene.pct}%`;
    if ($('#hygFill')) $('#hygFill').style.width = `${stats.hygiene.pct}%`;

    if ($('#nutriLevel')) $('#nutriLevel').textContent = String(stats.nutrition.level);
    if ($('#nutriStars')) $('#nutriStars').textContent = `${stats.nutrition.stars}/5`;
    if ($('#nutriProgressText')) $('#nutriProgressText').textContent = `${stats.nutrition.pct}%`;
    if ($('#nutriFill')) $('#nutriFill').style.width = `${stats.nutrition.pct}%`;

    if ($('#fitLevel')) $('#fitLevel').textContent = String(stats.fitness.level);
    if ($('#fitStars')) $('#fitStars').textContent = `${stats.fitness.stars}/5`;
    if ($('#fitProgressText')) $('#fitProgressText').textContent = `${stats.fitness.pct}%`;
    if ($('#fitFill')) $('#fitFill').style.width = `${stats.fitness.pct}%`;
  }

  function renderMissions(history) {
    const missionList = $('#missionList');
    if (!missionList) return;

    const todayDone = { hygiene: false, nutrition: false, fitness: false };
    const today = new Date();
    const dayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    history.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || item.url || '');
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
        <div class="mission-check" aria-label="${m.done ? 'สำเร็จ' : 'ยังไม่สำเร็จ'}">${m.done ? '✓' : '•'}</div>
      </div>
    `).join('');
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
    el.textContent = completed >= 3 ? 'เก่งมาก! เคยเล่นครบทั้ง 3 โซนแล้ว' : 'วันนี้ลองเล่นให้ครบ 3 โซนกันนะ';
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
      if (btnEl) btnEl.textContent = 'ดูเกมในโซน';

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
        const url = resolveModeUrl(zone, game, mode);
        return `
          <a class="zone-preview-item" href="${escapeHtml(url)}">
            <div class="pill">${escapeHtml(game.label)}</div>
            <div class="zone-preview-label">${escapeHtml(game.sub)}</div>
          </a>
        `;
      }).join('');
    });
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

    const inferredFromUrl = findGameByUrl(lastSummary.replayUrl || lastSummary.url || '');
    const zone =
      lastSummary.zone ||
      inferredFromUrl?.zone ||
      zoneFromGameId(lastSummary.game || lastSummary.gameId || lastSummary.title || lastSummary.url || '');

    const title = lastSummary.title || lastSummary.game || lastSummary.gameId || inferredFromUrl?.game?.label || 'เกมล่าสุด';
    const score = fmtInt(lastSummary.score, 0);
    const coins = fmtInt(lastSummary.coins ?? lastSummary.rewardCoins, 0);
    const stars = clamp(fmtInt(lastSummary.stars, 0), 0, 3);
    const note = lastSummary.note || lastSummary.feedback || lastSummary.message || 'เก่งมาก! เล่นต่อได้เลย';

    let replayUrl = lastSummary.replayUrl || lastSummary.url || '';
    if (!replayUrl && zone) {
      const game =
        (inferredFromUrl && inferredFromUrl.zone === zone ? inferredFromUrl.game : null) ||
        getGame(zone, lastSummary.game || lastSummary.gameId || '') ||
        findGameByName(zone, title) ||
        getDefaultGame(zone);
      if (game) {
        const modeId = normalizeModeId(lastSummary.mode || '') || game.defaultMode;
        const mode = game.modes.find((m) => m.id === modeId) || getDefaultMode(game);
        replayUrl = resolveModeUrl(zone, game, mode);
      }
    }
    if (!replayUrl) replayUrl = './hub-v2.html';

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

        <a class="btn primary" href="${escapeHtml(replayUrl)}">▶️ เล่นต่อ</a>
      </div>
    `;
  }

  function renderLibraryBox(lastByZone) {
    const box = $('#libraryBox');
    if (!box) return;

    const cards = Object.entries(GAME_CATALOG).map(([zone, set]) => {
      const names = set.games.map((item) => item.label).join(' • ');
      const recent = lastByZone[zone];

      return `
        <div class="library-card">
          <div class="library-top">
            <div class="library-name">${escapeHtml(set.label)}</div>
            <div class="library-count">${set.games.length} เกม</div>
          </div>

          <div class="library-games">${escapeHtml(names)}</div>

          <div class="library-actions">
            <button class="btn secondary small" type="button" data-open-zone="${escapeHtml(zone)}" data-open-kind="recommended">🎮 เล่นแนะนำ</button>
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

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function newestRecent(lastByZone) {
    const items = Object.values(lastByZone || {}).filter(Boolean);
    if (!items.length) return null;
    items.sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')));
    return items[0] || null;
  }

  function bestRecommendedZone(lastByZone) {
    if (!lastByZone.nutrition) return 'nutrition';
    if (!lastByZone.hygiene) return 'hygiene';
    if (!lastByZone.fitness) return 'fitness';
    return 'nutrition';
  }

  function bindTopButtons(profile, lastByZone) {
    $('#btnSettings')?.addEventListener('click', () => {
      toast('หน้าตั้งค่าจะเพิ่มต่อได้ภายหลัง');
    });

    $('#btnRewards')?.addEventListener('click', () => {
      toast(`ตอนนี้มี ${profile.coins} เหรียญ และ ${profile.stars} ดาว`);
    });

    $('#btnQuickRecommended')?.addEventListener('click', () => {
      const zone = bestRecommendedZone(lastByZone);
      openPicker(zone, 'recommended');
    });

    $('#btnQuickRecent')?.addEventListener('click', () => {
      const recent = newestRecent(lastByZone);
      if (recent?.url) location.href = recent.url;
      else toast('ยังไม่มีเกมล่าสุด ลองเริ่มเล่นสักเกมก่อนนะ');
    });

    $('#btnQuickAllGames')?.addEventListener('click', () => {
      openPicker('nutrition', 'all_zones');
    });
  }

  function closePicker() {
    const picker = $('#gamePicker');
    if (!picker) return;
    picker.classList.remove('show');
    picker.setAttribute('aria-hidden', 'true');
  }

  function openPicker(zone, kind = 'all') {
    pickerState.zone = zone;
    pickerState.kind = kind;
    pickerState.gameId = '';
    pickerState.step = 'games';
    renderPickerGames();
  }

  function renderPickerGames() {
    const picker = $('#gamePicker');
    const title = $('#pickerTitle');
    const sub = $('#pickerSub');
    const list = $('#pickerList');
    if (!picker || !title || !sub || !list) return;

    const allZones = pickerState.kind === 'all_zones';

    title.textContent = allZones ? 'คลังเกมทั้งหมด' : zoneLabel(pickerState.zone);
    sub.textContent = allZones
      ? 'เลือกโซนหรือเกมที่อยากเล่นได้เลย'
      : pickerState.kind === 'recommended'
        ? `เลือกเกมแนะนำใน ${zoneLabel(pickerState.zone)}`
        : pickerState.kind === 'recent'
          ? `เลือกเกมล่าสุดใน ${zoneLabel(pickerState.zone)}`
          : `เลือกเกมใน ${zoneLabel(pickerState.zone)} ได้เลย`;

    let games = [];
    if (allZones) {
      Object.entries(GAME_CATALOG).forEach(([zone, cat]) => {
        cat.games.forEach((g) => games.push({ ...g, __zone: zone }));
      });
    } else {
      games = getZoneGames(pickerState.zone).map((g) => ({ ...g, __zone: pickerState.zone }));

      if (pickerState.kind === 'recommended') {
        const recommended = getDefaultGame(pickerState.zone);
        games = recommended ? [{ ...recommended, __zone: pickerState.zone }] : games;
      }

      if (pickerState.kind === 'recent') {
        const recent = readLastByZone()[pickerState.zone];
        if (recent) {
          const game = getGame(pickerState.zone, recent.gameId);
          games = game ? [{ ...game, __zone: pickerState.zone }] : games;
        }
      }
    }

    list.innerHTML = games.map((game) => `
      <button class="picker-item" type="button" data-game-id="${escapeHtml(game.id)}" data-zone="${escapeHtml(game.__zone)}">
        <span class="picker-item-top">
          <span class="name">${escapeHtml(game.label)}</span>
          <span class="picker-badge zone">${escapeHtml(zoneLabel(game.__zone))}</span>
        </span>
        <span class="sub">${escapeHtml(game.sub)}</span>
      </button>
    `).join('');

    list.querySelectorAll('.picker-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        pickerState.zone = btn.getAttribute('data-zone') || pickerState.zone;
        pickerState.gameId = btn.getAttribute('data-game-id') || '';
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

    title.textContent = game.label;
    sub.textContent = `${game.sub} • เลือกโหมดที่อยากเล่นได้เลย`;

    list.innerHTML = game.modes.map((mode) => `
      <button class="picker-item mode-${escapeHtml(mode.id)}" type="button" data-mode-id="${escapeHtml(mode.id)}">
        <span class="picker-item-top">
          <span class="name">${escapeHtml(MODE_LABELS[mode.id] || mode.id)}</span>
          ${mode.id === game.defaultMode ? '<span class="picker-badge recommended">แนะนำ</span>' : '<span class="picker-badge mode">โหมด</span>'}
        </span>
        <span class="sub">${escapeHtml(game.label)} • ${escapeHtml(zoneLabel(pickerState.zone))}</span>
      </button>
    `).join('');

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'picker-item';
    backBtn.innerHTML = `
      <span class="picker-item-top">
        <span class="name">⬅ กลับไปเลือกเกม</span>
      </span>
      <span class="sub">ย้อนกลับไปยังรายการเกม</span>
    `;
    backBtn.addEventListener('click', renderPickerGames);
    list.appendChild(backBtn);

    list.querySelectorAll('[data-mode-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeId = btn.getAttribute('data-mode-id') || '';
        const mode = game.modes.find((m) => m.id === modeId);
        if (!mode) return;
        closePicker();
        location.href = resolveModeUrl(pickerState.zone, game, mode);
      });
    });

    picker.classList.add('show');
    picker.setAttribute('aria-hidden', 'false');
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
      renderPickerGames();
    });

    $('#pickerShowAllModes')?.addEventListener('click', () => {
      if (pickerState.step === 'modes') return;
      pickerState.kind = 'all';
      renderPickerGames();
    });

    $('#pickerShowRecent')?.addEventListener('click', () => {
      if (!pickerState.zone) pickerState.zone = 'nutrition';
      pickerState.kind = 'recent';
      renderPickerGames();
    });
  }

  function bindZoneLinks() {
    const hygGame = getDefaultGame('hygiene');
    const nutGame = getDefaultGame('nutrition');
    const fitGame = getDefaultGame('fitness');

    if ($('#btnPlayHygiene') && hygGame) {
      $('#btnPlayHygiene').href = resolveModeUrl('hygiene', hygGame, getDefaultMode(hygGame));
    }

    if ($('#btnPlayNutrition') && nutGame) {
      $('#btnPlayNutrition').href = resolveModeUrl('nutrition', nutGame, getDefaultMode(nutGame));
    }

    if ($('#btnPlayFitness') && fitGame) {
      $('#btnPlayFitness').href = resolveModeUrl('fitness', fitGame, getDefaultMode(fitGame));
    }

    document.querySelectorAll('[data-open-zone]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const zone = btn.getAttribute('data-open-zone') || '';
        const kind = btn.getAttribute('data-open-kind') || 'all';
        openPicker(zone, kind);
      });
    });

    $('#btnZoneHygiene')?.addEventListener('click', () => openPicker('hygiene', 'all'));
    $('#btnZoneNutrition')?.addEventListener('click', () => openPicker('nutrition', 'all'));
    $('#btnZoneFitness')?.addEventListener('click', () => openPicker('fitness', 'all'));
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

  function boot() {
    let profile = readProfile();
    const lastSummary = readLastSummary();
    const history = readSummaryHistory();
    const lastByZone = buildLastByZone(history, lastSummary);

    profile = mergeSummaryIntoProfile(profile, lastSummary);

    renderPlayer(profile);
    renderZoneStats(zoneStatsFromHistory(history));
    renderMissions(history);
    renderHeroQuickline(lastByZone);
    renderZoneMeta(lastByZone);
    renderZonePreviews();
    renderLastSummary(lastSummary);
    renderLibraryBox(lastByZone);
    bindZoneLinks();
    bindTopButtons(profile, lastByZone);
    bindPicker();
  }

  boot();
})();