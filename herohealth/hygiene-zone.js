const qs = new URLSearchParams(location.search);
const $ = (sel) => document.querySelector(sel);

const STORAGE_LAST = 'HH_HYGIENE_LAST_GAME_V1';

const GAME_REGISTRY = [
  {
    id: 'bath-v3',
    title: 'Bath',
    subtitle: 'อาบน้ำให้ครบขั้นตอนแบบสนุกและเข้าใจง่าย',
    icon: '🛁',
    color: 'c-blue',
    path: './bath-v3/bath.html',
    tags: ['bath', 'routine', 'clean body']
  },
  {
    id: 'brush-v3',
    title: 'Brush',
    subtitle: 'แปรงฟันให้ถูกวิธีผ่านภารกิจสั้น ๆ',
    icon: '🪥',
    color: 'c-pink',
    path: './brush-v3/brush.html',
    tags: ['brush', 'teeth', 'routine']
  },
  {
    id: 'handwash-v3',
    title: 'Handwash',
    subtitle: 'ล้างมือให้ครบขั้นตอนก่อนกินหรือหลังสัมผัสสิ่งสกปรก',
    icon: '🫧',
    color: 'c-green',
    path: './handwash-v3/handwash.html',
    tags: ['handwash', 'soap', 'clean hands']
  },
  {
    id: 'clean-objects-v3',
    title: 'Clean Objects',
    subtitle: 'ทำความสะอาดของใช้และเก็บขยะให้เป็นระเบียบ',
    icon: '🧽',
    color: 'c-orange',
    path: './clean-objects-v3/clean-objects.html',
    tags: ['clean objects', 'spray', 'wipe']
  },
  {
    id: 'mask-cough-v3',
    title: 'Mask & Cough',
    subtitle: 'ใส่หน้ากาก ปิดปากเวลาไอ และทิ้งทิชชูอย่างถูกต้อง',
    icon: '😷',
    color: 'c-purple',
    path: './mask-cough-v3/mask-cough.html',
    tags: ['mask', 'cough', 'safe']
  },
  {
    id: 'germ-detective-v3',
    title: 'Germ Detective',
    subtitle: 'ค้นหา ตรวจ และกำจัดจุดเสี่ยงเชื้อโรคในห้อง',
    icon: '🦠',
    color: 'c-teal',
    path: './germ-detective-v3/germ-detective.html',
    tags: ['germ', 'detective', 'investigate']
  }
];

function getHubUrl() {
  return qs.get('hub') || './hub.html';
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

function buildGameUrl(game, extra = {}) {
  const out = new URL(game.path, location.href);
  const next = new URLSearchParams(location.search);

  const modeSelect = $('#modeSelect');
  const timeSelect = $('#timeSelect');

  next.set('zone', 'hygiene');
  next.set('gameId', game.id);
  next.set('game', game.id);
  next.set('cat', 'hygiene');
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
  } catch {}
}

function loadLastGame() {
  try {
    const raw = localStorage.getItem(STORAGE_LAST);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function gameById(id) {
  return GAME_REGISTRY.find(g => g.id === id) || null;
}

function setCoachLine(text) {
  const el = $('#coachLine');
  if (el) el.textContent = text;
}

function bindTopBar() {
  const hubBtn = $('#hubBtn');
  if (hubBtn) hubBtn.href = getHubUrl();

  const continueBtn = $('#continueBtn');
  continueBtn?.addEventListener('click', () => {
    const last = loadLastGame();
    if (!last?.gameId) return;

    const game = gameById(last.gameId);
    if (!game) return;

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
    card?.classList.add('pulse-once');
    setCoachLine(`เกมล่าสุดของหนูคือ ${game.title} พร้อมกลับไปเล่นต่อได้เลย`);
    setTimeout(() => card?.classList.remove('pulse-once'), 1200);
  });
}

function makeGameCard(game) {
  return `
    <article class="game-card" data-game-card="${game.id}">
      <div class="game-top">
        <div class="game-icon ${game.color}">${game.icon}</div>
        <div class="game-badge">Hygiene Zone</div>
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
        const hay = [
          game.id,
          game.title,
          game.subtitle,
          ...(game.tags || [])
        ].join(' ').toLowerCase();
        return hay.includes(q);
      });

  grid.innerHTML = list.map(makeGameCard).join('');

  list.forEach(game => {
    grid.querySelector(`[data-play="${game.id}"]`)?.addEventListener('click', () => {
      saveLastGame(game.id);
      location.href = buildGameUrl(game);
    });

    grid.querySelector(`[data-preview="${game.id}"]`)?.addEventListener('click', () => {
      setCoachLine(`เลือก ${game.title} แล้ว กด "เข้าเล่น" ได้เลย`);
      const card = grid.querySelector(`[data-game-card="${game.id}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-recent" style="grid-column:1/-1;">
        ไม่พบเกมที่ตรงคำค้น ลองพิมพ์คำว่า brush, bath, handwash, mask หรือ germ
      </div>
    `;
  }
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
}

init();
