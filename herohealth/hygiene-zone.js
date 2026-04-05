const qs = new URLSearchParams(location.search);
const $ = (sel) => document.querySelector(sel);

const STORAGE_LAST = 'HH_HYGIENE_LAST_GAME_V1';

const GAME_REGISTRY = [
  {
    id: 'bath',
    title: 'Bath',
    subtitle: 'อาบน้ำให้ครบขั้นตอนแบบสนุกและเข้าใจง่าย',
    icon: '🛁',
    color: 'c-blue',
    tags: ['bath', 'routine', 'clean body'],
    pathCandidates: [
      './bath-v2/bath.html',
      './bath-v2/index.html',
      './bath/bath.html',
      './bath.html'
    ]
  },
  {
    id: 'brush',
    title: 'Brush',
    subtitle: 'แปรงฟันให้ถูกวิธีผ่านภารกิจสั้น ๆ',
    icon: '🪥',
    color: 'c-pink',
    tags: ['brush', 'teeth', 'routine'],
    pathCandidates: [
      './brush-v2/brush.html',
      './brush/brush.html',
      './brush.html'
    ]
  },
  {
    id: 'handwash',
    title: 'Handwash',
    subtitle: 'ล้างมือให้ครบขั้นตอนก่อนกินหรือหลังสัมผัสสิ่งสกปรก',
    icon: '🫧',
    color: 'c-green',
    tags: ['handwash', 'soap', 'clean hands'],
    pathCandidates: [
      './handwash-v2/handwash.html',
      './handwash/handwash.html',
      './handwash.html'
    ]
  },
  {
    id: 'clean-objects',
    title: 'Clean Objects',
    subtitle: 'ทำความสะอาดของใช้และเก็บขยะให้เป็นระเบียบ',
    icon: '🧽',
    color: 'c-orange',
    tags: ['clean objects', 'spray', 'wipe'],
    pathCandidates: [
      './clean-objects/clean-objects.html',
      './clean-objects-v2/clean-objects.html',
      './clean-objects.html'
    ]
  },
  {
    id: 'mask-cough',
    title: 'Mask & Cough',
    subtitle: 'ใส่หน้ากาก ปิดปากเวลาไอ และทิ้งทิชชูอย่างถูกต้อง',
    icon: '😷',
    color: 'c-purple',
    tags: ['mask', 'cough', 'safe'],
    pathCandidates: [
      './mask-cough/mask-cough.html',
      './mask-cough-v2/mask-cough.html',
      './mask-cough.html'
    ]
  },
  {
    id: 'germ-detective',
    title: 'Germ Detective',
    subtitle: 'ค้นหา ตรวจ และกำจัดจุดเสี่ยงเชื้อโรคในห้อง',
    icon: '🦠',
    color: 'c-teal',
    tags: ['germ', 'detective', 'investigate'],
    pathCandidates: [
      './germ-detective/germ-detective-vr.html',
      './germ-detective/germ-detective.html'
    ]
  }
];

const pathProbeCache = new Map();

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

async function pathExists(candidate) {
  const abs = new URL(candidate, location.href).toString();
  if (pathProbeCache.has(abs)) return pathProbeCache.get(abs);

  let ok = false;

  try {
    const head = await fetch(abs, {
      method: 'HEAD',
      cache: 'no-store'
    });
    ok = head.ok;
  } catch (_) {}

  if (!ok) {
    try {
      const res = await fetch(abs, {
        method: 'GET',
        cache: 'no-store'
      });
      ok = res.ok;
    } catch (_) {
      ok = false;
    }
  }

  pathProbeCache.set(abs, ok);
  return ok;
}

async function resolveGamePath(game) {
  for (const candidate of game.pathCandidates || []) {
    const ok = await pathExists(candidate);
    if (ok) return candidate;
  }
  return '';
}

async function resolveAllGamePaths() {
  for (const game of GAME_REGISTRY) {
    game.resolvedPath = await resolveGamePath(game);
    game.enabled = !!game.resolvedPath;
  }
}

function buildGameUrl(game, extra = {}) {
  const resolved = game.resolvedPath || game.pathCandidates?.[0];
  const out = new URL(resolved, location.href);
  const next = new URLSearchParams(location.search);

  const modeSelect = $('#modeSelect');
  const timeSelect = $('#timeSelect');

  next.set('zone', 'hygiene');
  next.set('cat', 'hygiene');
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
    if (!game?.enabled) {
      setCoachLine('ยังหา path ของเกมล่าสุดไม่เจอ ลองเลือกเกมที่เปิดได้ด้านล่างก่อน');
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
    <article class="recent-card ${game.enabled ? '' : 'is-disabled'}">
      <div class="recent-icon ${game.color}">${game.icon}</div>

      <div>
        <div class="recent-title">${game.title}</div>
        <div class="recent-sub">
          ล่าสุดเล่นเมื่อ ${whenText}<br/>
          mode: ${last.mode || getDefaultMode()} • time: ${last.time || getDefaultTime()} sec
          ${game.enabled ? '' : '<br/>ยังหา path จริงของเกมนี้ไม่เจอ'}
        </div>
      </div>

      <div class="recent-actions">
        <button class="play-btn ${game.color}" type="button" data-recent-play="${game.id}" ${game.enabled ? '' : 'disabled'}>เล่นต่อ</button>
        <button class="ghost-btn" type="button" data-recent-open="${game.id}">ดูการ์ดเกม</button>
      </div>
    </article>
  `;

  area.querySelector(`[data-recent-play="${game.id}"]`)?.addEventListener('click', () => {
    if (!game.enabled) return;
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
    <article class="game-card ${game.enabled ? '' : 'is-disabled'}" data-game-card="${game.id}">
      <div class="game-top">
        <div class="game-icon ${game.color}">${game.icon}</div>
        <div class="game-badge">${game.enabled ? 'Ready' : 'Path not found'}</div>
      </div>

      <div class="game-title">${game.title}</div>
      <div class="game-sub">${game.subtitle}</div>

      <div class="game-tags">
        ${game.tags.map(tag => `<span class="game-tag">${tag}</span>`).join('')}
      </div>

      <div class="game-actions">
        <button class="play-btn ${game.color}" type="button" data-play="${game.id}" ${game.enabled ? '' : 'disabled'}>เข้าเล่น</button>
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

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-recent" style="grid-column:1/-1;">
        ไม่พบเกมที่ตรงคำค้น ลองพิมพ์ bath, brush, handwash, mask, clean หรือ germ
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(makeGameCard).join('');

  list.forEach(game => {
    grid.querySelector(`[data-play="${game.id}"]`)?.addEventListener('click', () => {
      if (!game.enabled) {
        setCoachLine(`ยังหาไฟล์จริงของ ${game.title} ไม่เจอ`);
        return;
      }
      saveLastGame(game.id);
      location.href = buildGameUrl(game);
    });

    grid.querySelector(`[data-preview="${game.id}"]`)?.addEventListener('click', () => {
      setCoachLine(
        game.enabled
          ? `เลือก ${game.title} แล้ว กด "เข้าเล่น" ได้เลย`
          : `${game.title} ยังต้องใส่ path จริงเพิ่ม`
      );
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

async function init() {
  fillHeaderBits();
  bindTopBar();
  bindControls();

  setCoachLine('กำลังตรวจหา path ของเกมจริงในโปรเจกต์...');
  await resolveAllGamePaths();

  renderRecent();
  renderGames();

  const readyCount = GAME_REGISTRY.filter(g => g.enabled).length;
  if (readyCount > 0) {
    setCoachLine(`เจอเกมที่เปิดได้ ${readyCount} เกมแล้ว เลือกเล่นได้เลย`);
  } else {
    setCoachLine('ยังไม่เจอ path เกมจริงจาก candidate ที่ตั้งไว้ ต้องเติม path ให้ตรง repo อีกนิด');
  }
}

init();