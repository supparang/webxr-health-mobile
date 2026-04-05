const qs = new URLSearchParams(location.search);
const $ = (sel) => document.querySelector(sel);

const STORAGE_LAST = 'HH_FITNESS_LAST_GAME_V1';

const GAME_REGISTRY = [
  {
    id: 'shadow-breaker',
    title: 'Shadow Breaker',
    subtitle: 'ขยับร่างกายตามเป้าหมายและเอาชนะเงาพลังงาน',
    icon: '🥊',
    color: 'c-purple',
    tags: ['shadow', 'breaker', 'fitness'],
    launcherPath: './shadow-breaker-vr.html'
  },
  {
    id: 'rhythm-boxer',
    title: 'Rhythm Boxer',
    subtitle: 'ต่อยมวยตามจังหวะเพลง สนุกและได้ออกแรง',
    icon: '🥁',
    color: 'c-orange',
    tags: ['rhythm', 'boxer', 'music'],
    launcherPath: './rhythm-boxer-vr.html'
  },
  {
    id: 'jump-duck',
    title: 'Jump & Duck',
    subtitle: 'กระโดดและก้มหลบสิ่งกีดขวางให้ทัน',
    icon: '🐤',
    color: 'c-green',
    tags: ['jump', 'duck', 'movement'],
    launcherPath: './jump-duck-vr.html'
  },
  {
    id: 'balance-hold',
    title: 'Balance Hold',
    subtitle: 'ฝึกการทรงตัวและการควบคุมร่างกาย',
    icon: '🧘',
    color: 'c-blue',
    tags: ['balance', 'hold', 'control'],
    launcherPath: './balance-hold-vr.html'
  },
  {
    id: 'fitness-planner',
    title: 'Fitness Planner',
    subtitle: 'วางแผนกิจกรรมการออกกำลังกายอย่างสนุกและเข้าใจง่าย',
    icon: '📋',
    color: 'c-teal',
    tags: ['planner', 'fitness', 'plan'],
    launcherPath: './fitness-planner.html'
  }
];

function getHubUrl() {
  return qs.get('hub') || new URL('./hub.html', location.href).toString();
}

function getPlayerName() {
  return qs.get('name') || qs.get('nick') || qs.get('pid') || 'anon';
}

function getDefaultMode() {
  return qs.get('mode') || 'play';
}

function getDefaultTime() {
  return qs.get('time') || '90';
}

function gameById(id) {
  return GAME_REGISTRY.find(g => g.id === id) || null;
}

function setCoachLine(text) {
  const el = $('#coachLine');
  if (el) el.textContent = text;
}

function buildGameUrl(game, extra = {}) {
  const out = new URL(game.launcherPath, location.href);
  const next = new URLSearchParams(location.search);

  const modeSelect = $('#modeSelect');
  const timeSelect = $('#timeSelect');

  next.set('zone', 'fitness');
  next.set('cat', 'fitness');
  next.set('gameId', game.id);
  next.set('game', game.id);
  next.set('hub', getHubUrl());

  if (modeSelect?.value) next.set('mode', modeSelect.value);
  if (timeSelect?.value) next.set('time', timeSelect.value);

  Object.entries(extra).forEach(([k, v]) => {
    if (v == null) return;
    next.set(k, String(v));
  });

  out.search = next.toString();
  return out.toString();
}

function saveLastGame(gameId) {
  const payload = {
    gameId,
    ts: Date.now(),
    mode: $('#modeSelect')?.value || getDefaultMode(),
    time: $('#timeSelect')?.value || getDefaultTime()
  };
  try {
    localStorage.setItem(STORAGE_LAST, JSON.stringify(payload));
  } catch (_) {}
}

function loadLastGame() {
  try {
    const raw = localStorage.getItem(STORAGE_LAST);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function bindTopBar() {
  const hubBtn = $('#hubBtn');
  if (hubBtn) hubBtn.href = getHubUrl();

  const continueBtn = $('#continueBtn');
  continueBtn?.addEventListener('click', () => {
    const last = loadLastGame();
    if (!last?.gameId) {
      setCoachLine('ยังไม่มีเกมล่าสุด เลือกเกมจากด้านล่างได้เลย');
      return;
    }

    const game = gameById(last.gameId);
    if (!game) {
      setCoachLine('ยังหาเกมล่าสุดไม่เจอ');
      return;
    }

    if ($('#modeSelect')) $('#modeSelect').value = last.mode || getDefaultMode();
    if ($('#timeSelect')) $('#timeSelect').value = last.time || getDefaultTime();

    saveLastGame(game.id);
    location.href = buildGameUrl(game);
  });
}

function renderRecent() {
  const area = $('#recentArea');
  if (!area) return;

  const last = loadLastGame();
  const game = last?.gameId ? gameById(last.gameId) : null;

  if (!game) {
    area.innerHTML = `<div class="empty-recent">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>`;
    return;
  }

  const whenText = last?.ts
    ? new Date(last.ts).toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '-';

  area.innerHTML = `
    <article class="recent-card">
      <div class="recent-icon ${game.color}">${game.icon}</div>

      <div>
        <div class="recent-title">${game.title}</div>
        <div class="recent-sub">
          ล่าสุดเล่นเมื่อ ${whenText}<br/>
          mode: ${last.mode || getDefaultMode()} • time: ${last.time || getDefaultTime()} sec
        </div>
      </div>

      <div class="recent-actions">
        <button class="play-btn ${game.color}" type="button" data-recent-play="${game.id}">เล่นต่อ</button>
        <button class="ghost-btn" type="button" data-recent-open="${game.id}">ดูการ์ดเกม</button>
      </div>
    </article>
  `;

  area.querySelector(`[data-recent-play="${game.id}"]`)?.addEventListener('click', () => {
    if ($('#modeSelect')) $('#modeSelect').value = last.mode || getDefaultMode();
    if ($('#timeSelect')) $('#timeSelect').value = last.time || getDefaultTime();
    saveLastGame(game.id);
    location.href = buildGameUrl(game);
  });

  area.querySelector(`[data-recent-open="${game.id}"]`)?.addEventListener('click', () => {
    const card = document.querySelector(`[data-game-card="${game.id}"]`);
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setCoachLine(`เกมล่าสุดของหนูคือ ${game.title}`);
  });
}

function makeGameCard(game) {
  return `
    <article class="game-card" data-game-card="${game.id}">
      <div class="game-top">
        <div class="game-icon ${game.color}">${game.icon}</div>
        <div class="game-badge">Fitness Zone</div>
      </div>

      <div class="game-title">${game.title}</div>
      <div class="game-sub">${game.subtitle}</div>

      <div class="game-tags">
        ${game.tags.map(tag => `<span class="game-tag">${tag}</span>`).join('')}
      </div>

      <div class="game-actions">
        <button class="play-btn ${game.color}" type="button" data-play="${game.id}">เข้าเล่น</button>
        <button class="ghost-btn" type="button" data-preview="${game.id}">เลือกเกมนี้</button>
      </div>
    </article>
  `;
}

function renderGames(filter = '') {
  const grid = $('#gamesGrid');
  if (!grid) return;

  const q = String(filter || '').trim().toLowerCase();
  const list = !q
    ? GAME_REGISTRY
    : GAME_REGISTRY.filter(game => {
        const hay = [game.id, game.title, game.subtitle, ...(game.tags || [])].join(' ').toLowerCase();
        return hay.includes(q);
      });

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-recent" style="grid-column:1/-1;">
        ไม่พบเกมที่ตรงคำค้น ลองพิมพ์ shadow, rhythm, jump, balance หรือ planner
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(makeGameCard).join('');

  list.forEach(game => {
    grid.querySelector(`[data-play="${game.id}"]`)?.addEventListener('click', () => {
      saveLastGame(game.id);
      location.href = buildGameUrl(game);
    });

    grid.querySelector(`[data-preview="${game.id}"]`)?.addEventListener('click', () => {
      setCoachLine(`เลือก ${game.title} แล้ว กด "เข้าเล่น" ได้เลย`);
    });
  });
}

function bindControls() {
  const modeSelect = $('#modeSelect');
  const timeSelect = $('#timeSelect');
  const searchInput = $('#searchInput');

  if (modeSelect) modeSelect.value = getDefaultMode();
  if (timeSelect) timeSelect.value = getDefaultTime();

  modeSelect?.addEventListener('change', () => {
    $('#modePill').textContent = `🎮 Mode: ${modeSelect.value}`;
    setCoachLine(`ตอนนี้ตั้งโหมดเป็น ${modeSelect.value} แล้ว`);
  });

  timeSelect?.addEventListener('change', () => {
    setCoachLine(`เวลาที่เลือกคือ ${timeSelect.value} วินาที`);
  });

  searchInput?.addEventListener('input', () => {
    renderGames(searchInput.value);
  });
}

function fillHeaderBits() {
  const playerPill = $('#playerPill');
  const modePill = $('#modePill');

  if (playerPill) playerPill.textContent = `👤 Player: ${getPlayerName()}`;
  if (modePill) modePill.textContent = `🎮 Mode: ${getDefaultMode()}`;
}

function init() {
  fillHeaderBits();
  bindTopBar();
  bindControls();
  renderRecent();
  renderGames();
  setCoachLine(`ตอนนี้เกมใน Fitness Zone พร้อมเข้าเล่น ${GAME_REGISTRY.length} เกม`);
}

init();