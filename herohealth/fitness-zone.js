(() => {
  'use strict';

  const Bridge = window.HHFitnessBridge || null;

  const STORAGE_KEYS = {
    fitness: 'HH_FITNESS_LAST_GAME_V1',
    lastSummary: 'HHA_LAST_SUMMARY',
    lastZone: 'HHA_LAST_ZONE',
    nextZone: 'HHA_NEXT_ZONE',
    recommendedZone: 'HHA_RECOMMENDED_ZONE'
  };

  const GAME_ALIASES = {
    'shadowbreaker': 'shadow-breaker',
    'shadow-breaker': 'shadow-breaker',

    'rhythmboxer': 'rhythm-boxer',
    'rhythm-boxer': 'rhythm-boxer',

    'jumpduck': 'jump-duck',
    'jump-duck': 'jump-duck',

    'balancehold': 'balance-hold',
    'balance-hold': 'balance-hold',

    'fitnessplanner': 'fitness-planner',
    'fitness-planner': 'fitness-planner'
  };

  const NEXT_GAME_MAP = {
    'shadow-breaker': 'rhythm-boxer',
    'rhythm-boxer': 'jump-duck',
    'jump-duck': 'balance-hold',
    'balance-hold': 'fitness-planner',
    'fitness-planner': 'shadow-breaker'
  };

  const GAMES = [
    {
      id: 'shadow-breaker',
      label: 'Shadow Breaker',
      icon: '🥊',
      colorClass: 'c-purple',
      path: './shadow-breaker-vr.html',
      desc: 'ชกเป้า หลบ pattern และสู้บอสแบบแอ็กชัน',
      tags: ['boxing', 'reaction', 'boss', 'shadow']
    },
    {
      id: 'rhythm-boxer',
      label: 'Rhythm Boxer',
      icon: '🥁',
      colorClass: 'c-pink',
      path: './rhythm-boxer-vr.html',
      desc: 'ต่อยตามจังหวะเพลง เก็บ combo และอ่าน pattern ให้แม่น',
      tags: ['rhythm', 'music', 'combo', 'boxing']
    },
    {
      id: 'jump-duck',
      label: 'Jump & Duck',
      icon: '🦘',
      colorClass: 'c-blue',
      path: './jump-duck-vr.html',
      desc: 'อ่าน cue แล้วกระโดดหรือย่อให้ตรงจังหวะ',
      tags: ['jumpduck', 'jump-duck', 'jump', 'duck', 'timing']
    },
    {
      id: 'balance-hold',
      label: 'Balance Hold',
      icon: '🧍',
      colorClass: 'c-teal',
      path: './balance-hold-vr.html',
      desc: 'ฝึกทรงตัว คุมแกนลำตัว และรักษาความนิ่ง',
      tags: ['balance', 'stability', 'focus', 'hold']
    },
    {
      id: 'fitness-planner',
      label: 'Fitness Planner',
      icon: '📋',
      colorClass: 'c-green',
      path: './fitness-planner.html',
      desc: 'วางแผนกิจกรรมรายวัน ทำ checklist และเก็บความต่อเนื่อง',
      tags: ['planner', 'plan', 'checklist', 'habit']
    }
  ];

  const GAME_INDEX = Object.fromEntries(GAMES.map((g) => [g.id, g]));

  const el = {
    hubBtn: document.getElementById('hubBtn'),
    continueBtn: document.getElementById('continueBtn'),
    coachLine: document.getElementById('coachLine'),
    playerPill: document.getElementById('playerPill'),
    modePill: document.getElementById('modePill'),
    modeSelect: document.getElementById('modeSelect'),
    timeSelect: document.getElementById('timeSelect'),
    searchInput: document.getElementById('searchInput'),
    recentArea: document.getElementById('recentArea'),
    gamesGrid: document.getElementById('gamesGrid')
  };

  function canonicalGameId(input) {
    if (Bridge && typeof Bridge.canonicalGameId === 'function') {
      return Bridge.canonicalGameId(input);
    }
    const raw = String(input || '').trim().toLowerCase();
    return GAME_ALIASES[raw] || raw || 'jump-duck';
  }

  function safeParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch (_) { return fallback; }
  }

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? safeParse(raw, fallback) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function setTextStorage(key, value) {
    try { localStorage.setItem(key, String(value)); } catch (_) {}
  }

  function qsValue(key, fallback = '') {
    try {
      const v = new URL(window.location.href).searchParams.get(key);
      return v == null || v === '' ? fallback : v;
    } catch (_) {
      return fallback;
    }
  }

  function cleanText(value, fallback = '') {
    const s = String(value || '').trim();
    return s || fallback;
  }

  function numberOr(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function gameLabel(gameId) {
    return GAME_INDEX[canonicalGameId(gameId)]?.label || 'Fitness Game';
  }

  function currentPlayerName() {
    return cleanText(qsValue('name', qsValue('nickName', 'anon')), 'anon');
  }

  function currentPid() {
    return cleanText(qsValue('pid', 'anon'), 'anon');
  }

  function buildHubUrl() {
    if (Bridge && typeof Bridge.buildHubUrl === 'function') {
      return Bridge.buildHubUrl();
    }
    const raw = qsValue('hub', '');
    if (raw) {
      try { return new URL(raw, window.location.href).toString(); } catch (_) {}
    }
    return new URL('./hub-v2.html', window.location.href).toString();
  }

  function buildFitnessBackUrl(extra = {}) {
    if (Bridge && typeof Bridge.buildFitnessZoneUrl === 'function') {
      return Bridge.buildFitnessZoneUrl(extra);
    }

    const u = new URL('./fitness-zone.html', window.location.href);
    const pass = [
      'pid','name','nick','studyId','run','view','diff','time','seed',
      'debug','api','log','studentKey','schoolCode','classRoom','studentNo','nickName'
    ];

    pass.forEach((k) => {
      const v = qsValue(k, '');
      if (v) u.searchParams.set(k, v);
    });

    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('hub', buildHubUrl());

    Object.keys(extra || {}).forEach((k) => {
      const v = extra[k];
      if (v == null || v === '') return;
      u.searchParams.set(k, String(v));
    });

    return u.toString();
  }

  function setZonePointers() {
    setTextStorage(STORAGE_KEYS.lastZone, 'fitness');
    setTextStorage(STORAGE_KEYS.nextZone, 'hygiene');
    setTextStorage(STORAGE_KEYS.recommendedZone, 'hygiene');
  }

  function uiModeToRunMode(value) {
    const raw = cleanText(value, 'play').toLowerCase();

    if (raw === 'research') {
      return { uiMode: 'research', run: 'research', mode: 'research' };
    }

    if (raw === 'learn') {
      return { uiMode: 'learn', run: 'play', mode: 'training' };
    }

    return { uiMode: 'play', run: 'play', mode: 'play' };
  }

  function getCurrentSelection() {
    const mode = uiModeToRunMode(el.modeSelect?.value || qsValue('mode', 'play'));
    return {
      uiMode: mode.uiMode,
      run: mode.run,
      mode: mode.mode,
      time: cleanText(el.timeSelect?.value, qsValue('time', '90')),
      view: cleanText(qsValue('view', 'mobile'), 'mobile'),
      diff: cleanText(qsValue('diff', 'normal'), 'normal'),
      seed: cleanText(qsValue('seed', Date.now().toString()), Date.now().toString()),
      gate: cleanText(qsValue('gate', '1'), '1'),
      cooldown: cleanText(qsValue('cooldown', '1'), '1')
    };
  }

  function getLastSnapshot() {
    if (Bridge && typeof Bridge.getLastFitnessSnapshot === 'function') {
      const snap = Bridge.getLastFitnessSnapshot();
      if (snap) {
        snap.gameId = canonicalGameId(snap.gameId || snap.game);
        return snap;
      }
    }

    const snap = readJson(STORAGE_KEYS.fitness, null);
    if (!snap) return null;
    if (cleanText(snap.zone, '') && cleanText(snap.zone, '') !== 'fitness') return null;
    snap.gameId = canonicalGameId(snap.gameId || snap.game);
    snap.game = snap.gameId;
    return snap;
  }

  function getLastSummary() {
    const summary = readJson(STORAGE_KEYS.lastSummary, null);
    if (!summary) return null;
    if (cleanText(summary.zone, '') && cleanText(summary.zone, '') !== 'fitness') return null;
    summary.gameId = canonicalGameId(summary.gameId || summary.game);
    summary.game = summary.gameId;
    return summary;
  }

  function featuredGameId(snapshot) {
    if (snapshot?.gameId && NEXT_GAME_MAP[canonicalGameId(snapshot.gameId)]) {
      return NEXT_GAME_MAP[canonicalGameId(snapshot.gameId)];
    }
    return 'jump-duck';
  }

  function gameMatchesSearch(game, keyword) {
    if (!keyword) return true;
    const q = keyword.toLowerCase().trim();

    const hay = [
      game.id,
      game.label,
      game.desc,
      ...(game.tags || [])
    ].join(' ').toLowerCase();

    return hay.includes(q);
  }

  function buildGameUrl(gameId, opts = {}) {
    const game = GAME_INDEX[canonicalGameId(gameId)];
    if (!game) return buildFitnessBackUrl();

    const useSnapshot = !!opts.useSnapshot;
    const snap = useSnapshot ? (opts.snapshot || getLastSnapshot()) : null;
    const sel = getCurrentSelection();
    const hubUrl = buildHubUrl();

    const u = new URL(game.path, window.location.href);

    const pass = [
      'pid','name','nick','studyId','debug','api','log',
      'studentKey','schoolCode','classRoom','studentNo','nickName'
    ];

    pass.forEach((k) => {
      const v = qsValue(k, '');
      if (v) u.searchParams.set(k, v);
    });

    const pid = cleanText(
      useSnapshot ? snap?.pid : qsValue('pid', 'anon'),
      'anon'
    );
    const name = cleanText(
      useSnapshot ? snap?.name : qsValue('name', qsValue('nickName', 'Player')),
      'Player'
    );
    const studyId = cleanText(
      useSnapshot ? snap?.studyId : qsValue('studyId', ''),
      ''
    );

    const run = cleanText(
      opts.run,
      useSnapshot ? (snap?.run || snap?.mode) : sel.run
    ) || sel.run;

    const mode = cleanText(
      opts.mode,
      useSnapshot ? (snap?.mode || snap?.run) : sel.mode
    ) || sel.mode;

    const time = cleanText(
      opts.time,
      useSnapshot ? (snap?.time || snap?.timeSec) : sel.time
    ) || sel.time;

    const diff = cleanText(
      opts.diff,
      useSnapshot ? snap?.diff : sel.diff
    ) || sel.diff;

    const view = cleanText(
      opts.view,
      useSnapshot ? snap?.view : sel.view
    ) || sel.view;

    const seed = cleanText(
      opts.seed,
      useSnapshot ? (snap?.seed || qsValue('seed', Date.now().toString())) : sel.seed
    ) || sel.seed;

    const gate = cleanText(opts.gate, sel.gate);
    const cooldown = cleanText(opts.cooldown, sel.cooldown);

    u.searchParams.set('zone', 'fitness');
    u.searchParams.set('cat', 'fitness');
    u.searchParams.set('game', game.id);
    u.searchParams.set('gameId', game.id);
    u.searchParams.set('theme', game.id.replace(/-/g, ''));
    u.searchParams.set('pid', pid);
    u.searchParams.set('name', name);
    if (studyId) u.searchParams.set('studyId', studyId);
    u.searchParams.set('run', run);
    u.searchParams.set('mode', mode);
    u.searchParams.set('time', String(time));
    u.searchParams.set('diff', diff);
    u.searchParams.set('view', view);
    u.searchParams.set('seed', seed);
    u.searchParams.set('gate', gate);
    u.searchParams.set('cooldown', cooldown);
    u.searchParams.set('hub', hubUrl);
    u.searchParams.set('focus', game.id);
    u.searchParams.set('featured', game.id);

    return u.toString();
  }

  function gameSummaryLine(gameId, snapshot, summary) {
    const id = canonicalGameId(gameId);

    if (summary && canonicalGameId(summary.gameId || summary.game) === id) {
      if (id === 'jump-duck') {
        return `Rhythm ${numberOr(summary.rhythmAccuracy || summary.accPct, 0)}% • Landing ${numberOr(summary.landingControl, 0)}% • Posts ${numberOr(summary.postsCleared, 0)}`;
      }
      if (id === 'balance-hold') {
        return `Stability ${numberOr(summary.stabilityMin || summary.stability, 0)}% • Miss ${numberOr(summary.missTotal || summary.miss, 0)} • Rank ${cleanText(summary.rank, '-')}`;
      }
      if (id === 'fitness-planner') {
        return `Done ${numberOr(summary.tasksDone, 0)}/${numberOr(summary.tasksTotal, 0)} • ${numberOr(summary.completionPct, 0)}% complete`;
      }
      if (id === 'rhythm-boxer') {
        return `Acc ${numberOr(summary.accPct, 0)}% • Combo ${numberOr(summary.comboMax || summary.maxCombo, 0)} • Score ${numberOr(summary.scoreFinal || summary.score, 0)}`;
      }
      if (id === 'shadow-breaker') {
        return `Acc ${numberOr(summary.accPct, 0)}% • Score ${numberOr(summary.scoreFinal || summary.score, 0)} • Rank ${cleanText(summary.rank, '-')}`;
      }
    }

    if (snapshot && canonicalGameId(snapshot.gameId || snapshot.game) === id) {
      return `${cleanText(snapshot.mode || snapshot.run, 'play')} • ${cleanText(snapshot.time, '90')} sec • ${cleanText(snapshot.diff, 'normal')}`;
    }

    if (id === 'jump-duck') return 'อ่าน cue แล้ว jump / duck ให้ตรงจังหวะ';
    if (id === 'balance-hold') return 'คุมแกนลำตัวและทรงตัวให้นิ่ง';
    if (id === 'fitness-planner') return 'วางแผนกิจกรรมออกกำลังรายวัน';
    if (id === 'rhythm-boxer') return 'ต่อยตามจังหวะและเก็บ combo';
    return 'ชกเป้า หลบ pattern และสู้บอส';
  }

  function renderCoachLine(snapshot, featuredId) {
    const featured = GAME_INDEX[featuredId];
    if (!el.coachLine || !featured) return;

    if (snapshot?.gameId) {
      el.coachLine.textContent =
        `ล่าสุดเล่น ${gameLabel(snapshot.gameId)} • แนะนำต่อ ${featured.label}`;
      return;
    }

    el.coachLine.textContent =
      `แนะนำเริ่มที่ ${featured.label} ก่อน แล้วค่อยเล่นเกมถัดไปในโซน`;
  }

  function renderHeaderBits(snapshot) {
    if (el.playerPill) {
      el.playerPill.textContent = `👤 Player: ${currentPid()}`;
    }

    if (el.modePill) {
      el.modePill.textContent = `🎮 Mode: ${uiModeToRunMode(el.modeSelect?.value || 'play').uiMode}`;
    }

    const hubUrl = buildHubUrl();
    if (el.hubBtn) el.hubBtn.href = hubUrl;

    if (el.continueBtn) {
      const fallbackFeatured = featuredGameId(snapshot);
      const href = snapshot?.gameId
        ? buildGameUrl(snapshot.gameId, { useSnapshot: true, snapshot })
        : buildGameUrl(fallbackFeatured);

      el.continueBtn.onclick = () => {
        window.location.href = href;
      };
    }
  }

  function renderRecentArea(snapshot, summary) {
    if (!el.recentArea) return;

    if (!snapshot?.gameId) {
      el.recentArea.innerHTML = `
        <div class="empty-recent">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>
      `;
      return;
    }

    const game = GAME_INDEX[canonicalGameId(snapshot.gameId)];
    if (!game) {
      el.recentArea.innerHTML = `
        <div class="empty-recent">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>
      `;
      return;
    }

    const directUrl = buildGameUrl(game.id, { useSnapshot: true, snapshot });
    const launcherUrl = buildGameUrl(game.id);
    const summaryLine = gameSummaryLine(game.id, snapshot, summary);
    const when = snapshot.ts
      ? new Date(snapshot.ts).toLocaleString('th-TH', {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'ล่าสุด';

    el.recentArea.innerHTML = `
      <article class="recent-card">
        <div class="recent-icon ${game.colorClass}">${game.icon}</div>
        <div>
          <div class="recent-title">${game.label}</div>
          <div class="recent-sub">${summaryLine}</div>
          <div class="recent-sub">เล่นเมื่อ ${when} • ${cleanText(snapshot.mode || snapshot.run, 'play')} • ${cleanText(snapshot.time, '90')} sec</div>
        </div>
        <div class="recent-actions">
          <a class="play-btn ${game.colorClass}" href="${directUrl}">▶ เล่นต่อ</a>
          <a class="ghost-btn" href="${launcherUrl}">⚙️ เปิดหน้าเกม</a>
        </div>
      </article>
    `;
  }

  function renderGamesGrid(snapshot, summary) {
    if (!el.gamesGrid) return;

    const keyword = cleanText(el.searchInput?.value, '').toLowerCase();
    const featuredId = featuredGameId(snapshot);

    const visibleGames = GAMES.filter((game) => gameMatchesSearch(game, keyword));

    if (!visibleGames.length) {
      el.gamesGrid.innerHTML = `
        <div class="empty-recent">ไม่พบเกมที่ค้นหา ลองพิมพ์คำอื่น เช่น jump, rhythm, balance, planner</div>
      `;
      return;
    }

    el.gamesGrid.innerHTML = visibleGames.map((game) => {
      const isRecent = snapshot?.gameId && canonicalGameId(snapshot.gameId) === game.id;
      const isFeatured = featuredId === game.id;
      const summaryLine = gameSummaryLine(game.id, snapshot, summary);
      const currentUrl = buildGameUrl(game.id);
      const resumeUrl = isRecent
        ? buildGameUrl(game.id, { useSnapshot: true, snapshot })
        : currentUrl;

      const badge = isRecent
        ? 'ล่าสุด'
        : (isFeatured ? 'แนะนำ' : 'เกมในโซน');

      return `
        <article class="game-card">
          <div class="game-top">
            <div style="display:flex;gap:12px;min-width:0;">
              <div class="game-icon ${game.colorClass}">${game.icon}</div>
              <div style="min-width:0;">
                <div class="game-title">${game.label}</div>
                <div class="game-sub">${game.desc}</div>
              </div>
            </div>
            <div class="game-badge">${badge}</div>
          </div>

          <div class="game-tags">
            ${game.tags.slice(0, 4).map((tag) => `<span class="game-tag">${tag}</span>`).join('')}
          </div>

          <div class="game-sub">${summaryLine}</div>

          <div class="game-actions">
            <a class="play-btn ${game.colorClass}" href="${currentUrl}">▶ เล่นเลย</a>
            <a class="ghost-btn" href="${resumeUrl}">${isRecent ? '🕹️ เล่นต่อ' : '⚙️ ใช้ค่านี้'}</a>
          </div>
        </article>
      `;
    }).join('');
  }

  function updateRecommendedUI(snapshot, featuredId) {
    renderCoachLine(snapshot, featuredId);
    renderHeaderBits(snapshot);
  }

  function refreshPage() {
    Bridge?.normalizeAliasesInStorage?.();
    setZonePointers();

    const snapshot = getLastSnapshot();
    const summary = getLastSummary();
    const featuredId = featuredGameId(snapshot);

    updateRecommendedUI(snapshot, featuredId);
    renderRecentArea(snapshot, summary);
    renderGamesGrid(snapshot, summary);
  }

  function bindEvents() {
    el.modeSelect?.addEventListener('change', refreshPage);
    el.timeSelect?.addEventListener('change', refreshPage);
    el.searchInput?.addEventListener('input', refreshPage);

    window.addEventListener('focus', refreshPage);
    window.addEventListener('storage', refreshPage);
  }

  function init() {
    Bridge?.normalizeAliasesInStorage?.();
    setZonePointers();
    bindEvents();
    refreshPage();
  }

  init();
})();