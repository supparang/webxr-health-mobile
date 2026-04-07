const STORAGE_KEYS = {
  fitness: 'HH_FITNESS_LAST_GAME_V1'
};

const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';

const GAME_LIBRARY = [
  {
    id: 'shadow-breaker',
    title: 'Shadow Breaker',
    emoji: '🥊',
    colorClass: 'c-purple',
    badge: 'Reaction',
    desc: 'ตีเงาให้ทัน หลบ จับจังหวะ และเก็บคอมโบต่อเนื่อง',
    tags: ['reaction', 'timing', 'boss'],
    basePath: './shadow-breaker-vr.html',
    defaultDiff: 'normal',
    defaultTime: '90',
    featured: true
  },
  {
    id: 'rhythm-boxer',
    title: 'Rhythm Boxer',
    emoji: '🥁',
    colorClass: 'c-pink',
    badge: 'Rhythm',
    desc: 'ต่อยตามจังหวะเพลง เก็บ streak และฝึก timing แบบสนุก',
    tags: ['rhythm', 'combo', 'music'],
    basePath: './rhythm-boxer-vr.html',
    defaultDiff: 'normal',
    defaultTime: '90'
  },
  {
    id: 'jump-duck',
    title: 'Jump & Duck',
    emoji: '🏃',
    colorClass: 'c-orange',
    badge: 'Launcher',
    desc: 'ฝึกกระโดด ย่อ และอ่าน cue ให้แม่น เริ่มผ่าน launcher ก่อนเข้าเกม',
    tags: ['jump', 'duck', 'launcher'],
    basePath: './jump-duck-vr.html',
    defaultDiff: 'normal',
    defaultTime: '90'
  },
  {
    id: 'balance-hold',
    title: 'Balance Hold',
    emoji: '🧍',
    colorClass: 'c-teal',
    badge: 'Balance',
    desc: 'คุมสมดุลร่างกายให้นิ่ง รับแรงกดดันและผ่านด่านให้ได้',
    tags: ['balance', 'stability', 'focus'],
    basePath: './balance-hold-vr.html',
    defaultDiff: 'normal',
    defaultTime: '90'
  },
  {
    id: 'fitness-planner',
    title: 'Fitness Planner',
    emoji: '📋',
    colorClass: 'c-green',
    badge: 'Planner',
    desc: 'วางแผนกิจกรรมการออกกำลังกาย เลือกภารกิจและเป้าหมายประจำวัน',
    tags: ['plan', 'goal', 'habit'],
    basePath: './fitness-planner.html',
    defaultDiff: 'normal',
    defaultTime: '90'
  }
];

const LABELS = {
  'shadow-breaker': 'Shadow Breaker',
  'rhythm-boxer': 'Rhythm Boxer',
  'jump-duck': 'Jump & Duck',
  'balance-hold': 'Balance Hold',
  'fitness-planner': 'Fitness Planner'
};

function $(id) {
  return document.getElementById(id);
}

function q(k, d = '') {
  try {
    const v = new URL(location.href).searchParams.get(k);
    return v == null || v === '' ? d : v;
  } catch (_) {
    return d;
  }
}

function safeParse(raw, fallback = null) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return fallback;
  }
}

function readSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.fitness);
    return raw ? safeParse(raw, null) : null;
  } catch (_) {
    return null;
  }
}

function writeZonePointers() {
  try { localStorage.setItem(LAST_ZONE_KEY, 'fitness'); } catch (_) {}
  try { localStorage.setItem(NEXT_ZONE_KEY, 'hygiene'); } catch (_) {}
  try { localStorage.setItem(RECOMMENDED_ZONE_KEY, 'fitness'); } catch (_) {}
}

function gameLabel(gameId) {
  return LABELS[gameId] || gameId || '-';
}

function currentModeValue() {
  return $('modeSelect')?.value || q('mode', 'play');
}

function currentTimeValue() {
  return $('timeSelect')?.value || q('time', '90');
}

function currentRunValue() {
  const mode = currentModeValue();
  if (mode === 'research') return 'research';
  return q('run', 'play') || 'play';
}

function currentDiffValue() {
  const mode = currentModeValue();
  if (mode === 'learn') return 'easy';
  return q('diff', 'normal') || 'normal';
}

function currentViewValue() {
  return q('view', 'mobile') || 'mobile';
}

function buildHubUrl() {
  const base = new URL('./fitness-zone.html', location.href);

  const passthroughKeys = [
    'pid', 'name', 'nick', 'studyId',
    'view', 'debug', 'api', 'log',
    'studentKey', 'schoolCode', 'classRoom', 'studentNo', 'nickName'
  ];

  passthroughKeys.forEach((k) => {
    const v = q(k, '');
    if (v) base.searchParams.set(k, v);
  });

  base.searchParams.set('zone', 'fitness');
  base.searchParams.set('mode', currentModeValue());
  base.searchParams.set('time', currentTimeValue());
  base.searchParams.set('run', currentRunValue());
  return base.toString();
}

function buildGameUrl(game, patch = {}) {
  const url = new URL(game.basePath, location.href);

  const pid = q('pid', 'anon');
  const name = q('name', q('nickName', 'Player'));
  const studyId = q('studyId', '');
  const view = patch.view || currentViewValue();
  const mode = patch.mode || currentModeValue();
  const run = patch.run || (mode === 'research' ? 'research' : currentRunValue());
  const diff = patch.diff || currentDiffValue() || game.defaultDiff || 'normal';
  const time = patch.time || currentTimeValue() || game.defaultTime || '90';
  const seed = patch.seed || q('seed', String(Date.now()));
  const hub = patch.hub || buildHubUrl();

  url.searchParams.set('zone', 'fitness');
  url.searchParams.set('cat', 'fitness');
  url.searchParams.set('game', game.id);
  url.searchParams.set('gameId', game.id);
  url.searchParams.set('pid', pid);
  url.searchParams.set('name', name);
  url.searchParams.set('mode', mode);
  url.searchParams.set('run', run);
  url.searchParams.set('view', view);
  url.searchParams.set('diff', diff);
  url.searchParams.set('time', time);
  url.searchParams.set('seed', seed);
  url.searchParams.set('hub', hub);

  if (studyId) url.searchParams.set('studyId', studyId);

  [
    'debug', 'api', 'log',
    'studentKey', 'schoolCode', 'classRoom', 'studentNo', 'nickName'
  ].forEach((k) => {
    const v = q(k, '');
    if (v) url.searchParams.set(k, v);
  });

  return url.toString();
}

function buildContinueUrl(snapshot) {
  if (!snapshot?.gameId) {
    const fallbackGame = GAME_LIBRARY.find((g) => g.id === 'jump-duck') || GAME_LIBRARY[0];
    return buildGameUrl(fallbackGame);
  }

  const game = GAME_LIBRARY.find((g) => g.id === snapshot.gameId);
  if (!game) {
    const fallbackGame = GAME_LIBRARY.find((g) => g.id === 'jump-duck') || GAME_LIBRARY[0];
    return buildGameUrl(fallbackGame);
  }

  return buildGameUrl(game, {
    mode: snapshot.mode || currentModeValue(),
    run: snapshot.run || currentRunValue(),
    diff: snapshot.diff || currentDiffValue(),
    time: String(snapshot.time || currentTimeValue()),
    view: snapshot.view || currentViewValue(),
    seed: snapshot.seed || q('seed', String(Date.now()))
  });
}

function coachLineFromSnapshot(snapshot) {
  if (!snapshot?.gameId) return 'เลือกเกมออกกำลังกายที่อยากเล่น แล้วเริ่มได้เลย';

  const title = gameLabel(snapshot.gameId);
  const score = Number(snapshot.score || 0);
  const streak = Number(snapshot.bestStreak || snapshot.combo || 0);

  return `ล่าสุดเล่น ${title} • score ${score} • best streak ${streak}`;
}

function recommendedGame(snapshot) {
  if (!snapshot?.gameId) {
    return GAME_LIBRARY.find((g) => g.id === 'jump-duck') || GAME_LIBRARY[0];
  }

  if (snapshot.gameId === 'shadow-breaker') {
    return GAME_LIBRARY.find((g) => g.id === 'rhythm-boxer');
  }
  if (snapshot.gameId === 'rhythm-boxer') {
    return GAME_LIBRARY.find((g) => g.id === 'jump-duck');
  }
  if (snapshot.gameId === 'jump-duck') {
    return GAME_LIBRARY.find((g) => g.id === 'balance-hold');
  }
  if (snapshot.gameId === 'balance-hold') {
    return GAME_LIBRARY.find((g) => g.id === 'fitness-planner');
  }
  return GAME_LIBRARY.find((g) => g.id === 'jump-duck') || GAME_LIBRARY[0];
}

function renderHeader(snapshot) {
  $('playerPill').textContent = `👤 Player: ${q('pid', 'anon')}`;
  $('modePill').textContent = `🎮 Mode: ${currentModeValue()}`;

  const coach = $('coachLine');
  if (coach) coach.textContent = coachLineFromSnapshot(snapshot);

  const hubBtn = $('hubBtn');
  if (hubBtn) hubBtn.href = q('hub', './hub-v2.html');

  const continueBtn = $('continueBtn');
  if (continueBtn) {
    continueBtn.onclick = () => {
      writeZonePointers();
      location.href = buildContinueUrl(snapshot);
    };
  }
}

function renderRecent(snapshot) {
  const box = $('recentArea');
  if (!box) return;

  if (!snapshot?.gameId) {
    box.innerHTML = `<div class="empty-recent">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>`;
    return;
  }

  const title = gameLabel(snapshot.gameId);
  const game = GAME_LIBRARY.find((g) => g.id === snapshot.gameId);
  const href = buildContinueUrl(snapshot);

  box.innerHTML = `
    <article class="recent-card">
      <div class="recent-icon ${game?.colorClass || 'c-blue'}">${game?.emoji || '🏃'}</div>

      <div>
        <div class="recent-title">${title}</div>
        <div class="recent-sub">
          ล่าสุดเล่นแบบ ${snapshot.mode || snapshot.run || 'play'}
          • ${snapshot.time || '90'} วินาที
          • diff ${snapshot.diff || 'normal'}
        </div>
      </div>

      <div class="recent-actions">
        <a class="play-btn ${game?.colorClass || 'c-blue'}" href="${href}">▶ เล่นต่อ</a>
        <a class="ghost-btn" href="${buildGameUrl(game || recommendedGame(snapshot), { time: '60', diff: 'easy' })}">⚡ เล่นสั้น</a>
      </div>
    </article>
  `;
}

function matchesSearch(game, keyword) {
  if (!keyword) return true;
  const k = keyword.toLowerCase().trim();

  return [
    game.id,
    game.title,
    game.desc,
    ...(game.tags || [])
  ].join(' ').toLowerCase().includes(k);
}

function renderGames(snapshot) {
  const grid = $('gamesGrid');
  if (!grid) return;

  const keyword = ($('searchInput')?.value || '').trim();
  const recommended = recommendedGame(snapshot);

  const html = GAME_LIBRARY
    .filter((game) => matchesSearch(game, keyword))
    .map((game) => {
      const isRecent = snapshot?.gameId === game.id;
      const isRecommended = recommended?.id === game.id;
      const startHref = buildGameUrl(game);
      const quickHref = buildGameUrl(game, {
        diff: game.id === 'fitness-planner' ? 'normal' : 'easy',
        time: '60'
      });

      return `
        <article class="game-card">
          <div class="game-top">
            <div class="game-icon ${game.colorClass}">${game.emoji}</div>
            <div class="game-badge">${isRecent ? 'ล่าสุด' : (isRecommended ? 'แนะนำ' : game.badge)}</div>
          </div>

          <div class="game-title">${game.title}</div>
          <div class="game-sub">${game.desc}</div>

          <div class="game-tags">
            ${(game.tags || []).map((tag) => `<span class="game-tag">${tag}</span>`).join('')}
            ${game.id === 'jump-duck' ? '<span class="game-tag">warmup+cooldown</span>' : ''}
          </div>

          <div class="game-actions">
            <a class="play-btn ${game.colorClass}" href="${startHref}" data-game-link="${game.id}">▶ เริ่มเล่น</a>
            <a class="ghost-btn" href="${quickHref}" data-game-quick="${game.id}">⚡ quick</a>
          </div>
        </article>
      `;
    })
    .join('');

  grid.innerHTML = html || `<div class="empty-recent">ไม่พบเกมที่ตรงกับคำค้นหา ลองพิมพ์คำอื่นดู</div>`;

  grid.querySelectorAll('[data-game-link]').forEach((el) => {
    el.addEventListener('click', () => {
      writeZonePointers();
    });
  });

  grid.querySelectorAll('[data-game-quick]').forEach((el) => {
    el.addEventListener('click', () => {
      writeZonePointers();
    });
  });
}

function bindControls(snapshot) {
  $('modeSelect')?.addEventListener('change', () => {
    $('modePill').textContent = `🎮 Mode: ${currentModeValue()}`;
    renderRecent(snapshot);
    renderGames(snapshot);
  });

  $('timeSelect')?.addEventListener('change', () => {
    renderRecent(snapshot);
    renderGames(snapshot);
  });

  $('searchInput')?.addEventListener('input', () => {
    renderGames(snapshot);
  });
}

function syncTopLinks() {
  const hubBtn = $('hubBtn');
  if (hubBtn) hubBtn.href = q('hub', './hub-v2.html');
}

function bootFitnessZone() {
  writeZonePointers();
  syncTopLinks();

  const snapshot = readSnapshot();

  renderHeader(snapshot);
  renderRecent(snapshot);
  renderGames(snapshot);
  bindControls(snapshot);
}

bootFitnessZone();