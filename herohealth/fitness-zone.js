const STORAGE_KEYS = {
  fitness: 'HH_FITNESS_LAST_GAME_V1'
};

const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
const NEXT_ZONE_KEY = 'HHA_NEXT_ZONE';
const RECOMMENDED_ZONE_KEY = 'HHA_RECOMMENDED_ZONE';

const GAMES = [
  {
    id: 'shadow-breaker',
    title: 'Shadow Breaker',
    emoji: '🥊',
    badge: 'Reaction',
    desc: 'ตีเป้าให้ทัน เก็บ accuracy และคอมโบ พร้อมสู้ช่วง boss',
    tags: ['reaction', 'timing', 'boss'],
    launcherPath: './shadow-breaker-vr.html',
    quickDiff: 'easy',
    quickTime: '60',
    colorClass: 'c-purple'
  },
  {
    id: 'rhythm-boxer',
    title: 'Rhythm Boxer',
    emoji: '🥁',
    badge: 'Rhythm',
    desc: 'ต่อยตาม beat ให้แม่น เก็บ streak และอ่าน pattern ให้ทัน',
    tags: ['rhythm', 'combo', 'music'],
    launcherPath: './rhythm-boxer-vr.html',
    quickDiff: 'easy',
    quickTime: '60',
    colorClass: 'c-pink'
  },
  {
    id: 'jump-duck',
    title: 'Jump & Duck',
    emoji: '🏃',
    badge: 'Launcher',
    desc: 'ฝึกกระโดด ย่อ และอ่าน cue ให้แม่น ก่อนเข้าเกมผ่าน launcher',
    tags: ['jump', 'duck', 'launcher'],
    launcherPath: './jump-duck-vr.html',
    quickDiff: 'easy',
    quickTime: '60',
    colorClass: 'c-orange'
  },
  {
    id: 'balance-hold',
    title: 'Balance Hold',
    emoji: '🧍',
    badge: 'Balance',
    desc: 'ฝึกทรงตัว คุมแกนลำตัว และผ่านแรงกดดันให้ได้นานที่สุด',
    tags: ['balance', 'stability', 'focus'],
    launcherPath: './balance-hold-vr.html',
    quickDiff: 'easy',
    quickTime: '60',
    colorClass: 'c-teal'
  },
  {
    id: 'fitness-planner',
    title: 'Fitness Planner',
    emoji: '📋',
    badge: 'Planner',
    desc: 'วางแผนกิจกรรมประจำวัน เลือก checklist แล้วค่อยลุยทีละข้อ',
    tags: ['plan', 'goal', 'habit'],
    launcherPath: './fitness-planner.html',
    quickDiff: 'normal',
    quickTime: '90',
    colorClass: 'c-green'
  }
];

const GAME_MAP = Object.fromEntries(GAMES.map((g) => [g.id, g]));

function $(id) {
  return document.getElementById(id);
}

function qs(k, d = '') {
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

function readFitnessSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.fitness);
    return raw ? safeParse(raw, null) : null;
  } catch (_) {
    return null;
  }
}

function setZonePointers() {
  try { localStorage.setItem(LAST_ZONE_KEY, 'fitness'); } catch (_) {}
  try { localStorage.setItem(NEXT_ZONE_KEY, 'hygiene'); } catch (_) {}
  try { localStorage.setItem(RECOMMENDED_ZONE_KEY, 'fitness'); } catch (_) {}
}

function gameTitle(gameId) {
  return GAME_MAP[gameId]?.title || gameId || '-';
}

function currentMode() {
  return $('modeSelect')?.value || qs('mode', 'play');
}

function currentTime() {
  return $('timeSelect')?.value || qs('time', '90');
}

function currentRun() {
  const mode = currentMode();
  return mode === 'research' ? 'research' : (qs('run', 'play') || 'play');
}

function currentDiff() {
  const mode = currentMode();
  if (mode === 'learn') return 'easy';
  return qs('diff', 'normal') || 'normal';
}

function currentView() {
  return qs('view', 'mobile') || 'mobile';
}

function currentHubUrl() {
  return qs('hub', './hub-v2.html');
}

function buildFitnessZoneUrl() {
  const u = new URL('./fitness-zone.html', location.href);

  [
    'pid', 'name', 'nick', 'studyId', 'view', 'debug', 'api', 'log',
    'studentKey', 'schoolCode', 'classRoom', 'studentNo', 'nickName'
  ].forEach((k) => {
    const v = qs(k, '');
    if (v) u.searchParams.set(k, v);
  });

  u.searchParams.set('zone', 'fitness');
  u.searchParams.set('mode', currentMode());
  u.searchParams.set('time', currentTime());
  u.searchParams.set('run', currentRun());
  u.searchParams.set('hub', currentHubUrl());
  return u.toString();
}

function buildLauncherUrl(game, patch = {}) {
  const g = typeof game === 'string' ? GAME_MAP[game] : game;
  if (!g) return './fitness-zone.html';

  const u = new URL(g.launcherPath, location.href);

  const pid = qs('pid', 'anon');
  const name = qs('name', qs('nickName', 'Player'));
  const studyId = qs('studyId', '');
  const diff = patch.diff || currentDiff();
  const time = patch.time || currentTime();
  const view = patch.view || currentView();
  const run = patch.run || currentRun();
  const gate = patch.gate ?? '1';
  const cooldown = patch.cooldown ?? '1';
  const seed = patch.seed || qs('seed', String(Date.now()));
  const hub = patch.hub || buildFitnessZoneUrl();

  u.searchParams.set('pid', pid);
  u.searchParams.set('name', name);
  u.searchParams.set('zone', 'fitness');
  u.searchParams.set('game', g.id);
  u.searchParams.set('gameId', g.id);
  u.searchParams.set('diff', diff);
  u.searchParams.set('time', String(time));
  u.searchParams.set('view', view);
  u.searchParams.set('run', run);
  u.searchParams.set('mode', patch.mode || currentMode());
  u.searchParams.set('gate', String(gate));
  u.searchParams.set('cooldown', String(cooldown));
  u.searchParams.set('seed', seed);
  u.searchParams.set('hub', hub);

  if (studyId) u.searchParams.set('studyId', studyId);

  [
    'debug', 'api', 'log',
    'studentKey', 'schoolCode', 'classRoom', 'studentNo', 'nickName'
  ].forEach((k) => {
    const v = qs(k, '');
    if (v) u.searchParams.set(k, v);
  });

  return u.toString();
}

function featuredGame(snapshot) {
  if (!snapshot?.gameId) return GAME_MAP['jump-duck'];

  const map = {
    'shadow-breaker': 'rhythm-boxer',
    'rhythm-boxer': 'jump-duck',
    'jump-duck': 'balance-hold',
    'balance-hold': 'fitness-planner',
    'fitness-planner': 'shadow-breaker'
  };

  return GAME_MAP[map[snapshot.gameId] || 'jump-duck'];
}

function continueGame(snapshot) {
  if (!snapshot?.gameId || !GAME_MAP[snapshot.gameId]) {
    return GAME_MAP['jump-duck'];
  }
  return GAME_MAP[snapshot.gameId];
}

function renderHeader(snapshot) {
  $('playerPill').textContent = `👤 Player: ${qs('pid', 'anon')}`;
  $('modePill').textContent = `🎮 Mode: ${currentMode()}`;

  const coach = $('coachLine');
  if (!snapshot?.gameId) {
    coach.textContent = 'เลือกเกมออกกำลังกายที่อยากเล่น แล้วเริ่มได้เลย';
  } else {
    const score = Number(snapshot.score || snapshot.scoreFinal || 0);
    const title = gameTitle(snapshot.gameId);
    coach.textContent = `ล่าสุดเล่น ${title} • score ${score}`;
  }

  const hubBtn = $('hubBtn');
  if (hubBtn) hubBtn.href = currentHubUrl();

  const continueBtn = $('continueBtn');
  if (continueBtn) {
    continueBtn.onclick = () => {
      setZonePointers();
      const g = continueGame(snapshot);
      location.href = buildLauncherUrl(g, {
        diff: snapshot?.diff || currentDiff(),
        time: snapshot?.time || currentTime(),
        run: snapshot?.run || currentRun(),
        view: snapshot?.view || currentView(),
        mode: snapshot?.mode || currentMode(),
        seed: snapshot?.seed || qs('seed', String(Date.now())),
        gate: '1',
        cooldown: '1'
      });
    };
  }
}

function renderRecent(snapshot) {
  const box = $('recentArea');
  if (!box) return;

  if (!snapshot?.gameId || !GAME_MAP[snapshot.gameId]) {
    box.innerHTML = `<div class="empty-recent">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>`;
    return;
  }

  const game = GAME_MAP[snapshot.gameId];
  const href = buildLauncherUrl(game, {
    diff: snapshot.diff || currentDiff(),
    time: snapshot.time || currentTime(),
    run: snapshot.run || currentRun(),
    view: snapshot.view || currentView(),
    mode: snapshot.mode || currentMode(),
    seed: snapshot.seed || qs('seed', String(Date.now())),
    gate: '1',
    cooldown: '1'
  });

  const quickHref = buildLauncherUrl(game, {
    diff: game.quickDiff,
    time: game.quickTime,
    run: 'play',
    view: 'mobile',
    mode: 'play',
    gate: '0',
    cooldown: '1'
  });

  box.innerHTML = `
    <article class="recent-card">
      <div class="recent-icon ${game.colorClass}">${game.emoji}</div>

      <div>
        <div class="recent-title">${game.title}</div>
        <div class="recent-sub">
          ล่าสุดเล่นแบบ ${snapshot.mode || snapshot.run || 'play'}
          • ${snapshot.time || '90'} วินาที
          • diff ${snapshot.diff || 'normal'}
        </div>
      </div>

      <div class="recent-actions">
        <a class="play-btn ${game.colorClass}" href="${href}" data-zone-link="${game.id}">▶ เล่นต่อ</a>
        <a class="ghost-btn" href="${quickHref}" data-zone-link="${game.id}">⚡ quick</a>
      </div>
    </article>
  `;
}

function renderFeatured(snapshot) {
  const box = $('featuredArea');
  if (!box) return;

  const game = featuredGame(snapshot);
  if (!game) {
    box.innerHTML = `<div class="empty-recent">ระบบกำลังเลือกเกมแนะนำให้</div>`;
    return;
  }

  const href = buildLauncherUrl(game, {
    diff: currentDiff(),
    time: currentTime(),
    run: currentRun(),
    view: currentView(),
    mode: currentMode(),
    gate: '1',
    cooldown: '1'
  });

  const quickHref = buildLauncherUrl(game, {
    diff: game.quickDiff,
    time: game.quickTime,
    run: 'play',
    view: 'mobile',
    mode: 'play',
    gate: '0',
    cooldown: '1'
  });

  box.innerHTML = `
    <article class="recent-card">
      <div class="recent-icon ${game.colorClass}">${game.emoji}</div>

      <div>
        <div class="recent-title">${game.title}</div>
        <div class="recent-sub">
          เกมแนะนำตอนนี้ • ${game.desc}
        </div>
      </div>

      <div class="recent-actions">
        <a class="play-btn ${game.colorClass}" href="${href}" data-zone-link="${game.id}">🎮 เริ่มเล่น</a>
        <a class="ghost-btn" href="${quickHref}" data-zone-link="${game.id}">⚡ quick</a>
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

function renderGamesGrid(snapshot) {
  const grid = $('gamesGrid');
  if (!grid) return;

  const keyword = ($('searchInput')?.value || '').trim();
  const featured = featuredGame(snapshot);

  const html = GAMES
    .filter((game) => matchesSearch(game, keyword))
    .map((game) => {
      const isRecent = snapshot?.gameId === game.id;
      const isFeatured = featured?.id === game.id;

      const startHref = buildLauncherUrl(game, {
        diff: currentDiff(),
        time: currentTime(),
        run: currentRun(),
        view: currentView(),
        mode: currentMode(),
        gate: '1',
        cooldown: '1'
      });

      const quickHref = buildLauncherUrl(game, {
        diff: game.quickDiff,
        time: game.quickTime,
        run: 'play',
        view: 'mobile',
        mode: 'play',
        gate: '0',
        cooldown: '1'
      });

      return `
        <article class="game-card">
          <div class="game-top">
            <div class="game-icon ${game.colorClass}">${game.emoji}</div>
            <div class="game-badge">${isRecent ? 'ล่าสุด' : (isFeatured ? 'แนะนำ' : game.badge)}</div>
          </div>

          <div class="game-title">${game.title}</div>
          <div class="game-sub">${game.desc}</div>

          <div class="game-tags">
            ${(game.tags || []).map((tag) => `<span class="game-tag">${tag}</span>`).join('')}
            <span class="game-tag">warmup</span>
            <span class="game-tag">cooldown</span>
          </div>

          <div class="game-actions">
            <a class="play-btn ${game.colorClass}" href="${startHref}" data-zone-link="${game.id}">▶ เริ่มเล่น</a>
            <a class="ghost-btn" href="${quickHref}" data-zone-link="${game.id}">⚡ quick</a>
          </div>
        </article>
      `;
    })
    .join('');

  grid.innerHTML = html || `<div class="empty-recent">ไม่พบเกมที่ตรงกับคำค้นหา ลองพิมพ์คำอื่นดู</div>`;

  grid.querySelectorAll('[data-zone-link]').forEach((el) => {
    el.addEventListener('click', () => {
      setZonePointers();
    });
  });
}

function bindControls(snapshot) {
  $('modeSelect')?.addEventListener('change', () => {
    $('modePill').textContent = `🎮 Mode: ${currentMode()}`;
    renderRecent(snapshot);
    renderFeatured(snapshot);
    renderGamesGrid(snapshot);
  });

  $('timeSelect')?.addEventListener('change', () => {
    renderRecent(snapshot);
    renderFeatured(snapshot);
    renderGamesGrid(snapshot);
  });

  $('searchInput')?.addEventListener('input', () => {
    renderGamesGrid(snapshot);
  });
}

function boot() {
  setZonePointers();

  const snapshot = readFitnessSnapshot();

  renderHeader(snapshot);
  renderRecent(snapshot);
  renderFeatured(snapshot);
  renderGamesGrid(snapshot);
  bindControls(snapshot);
}

boot();