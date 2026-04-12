import { buildZoneGameUrl, buildHubRoot } from './zone-return.js';

const qs = new URLSearchParams(location.search);

const GAME_META = {
  plate: {
    key: 'plate',
    title: 'Plate',
    sub: 'ฝึกเลือกอาหารครบ 5 หมู่แบบเข้าใจง่าย',
    tags: ['เริ่มง่าย', 'ครบ 5 หมู่', 'เลือกโหมดได้'],
    path: './plate-launcher.html'
  },
  goodjunk: {
    key: 'goodjunk',
    title: 'GoodJunk',
    sub: 'แยกอาหารดีและอาหารที่ควรลดให้ทัน',
    tags: ['ท้าทาย', 'เร็ว', 'หลายโหมด'],
    path: './goodjunk-launcher.html'
  },
  groups: {
    key: 'groups',
    title: 'Groups',
    sub: 'จัดหมวดอาหารให้ถูกต้อง',
    tags: ['ฝึกจำ', 'จัดหมวด', 'เรียนรู้'],
    path: './group-v1.html'
  },
  hydration: {
    key: 'hydration',
    title: 'Hydration',
    sub: 'เรียนรู้เรื่องการดื่มน้ำให้พอดี และดูแลร่างกายให้สดชื่นแข็งแรง',
    tags: ['เล่นสั้น', 'สุขภาพ', 'น้ำดื่ม'],
    path: './hydration-vr.html'
  }
};

const STORAGE = {
  recent: 'HHA_LAST_GAME_BY_ZONE_NUTRITION',
  played: 'HHA_ZONE_PLAYED_NUTRITION',
  daily: 'HHA_ZONE_DAILY_NUTRITION'
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function first(...vals) {
  for (const v of vals) {
    if (String(v || '').trim()) return String(v).trim();
  }
  return '';
}

function cleanEnum(v, allow, fallback) {
  v = String(v || '').trim().toLowerCase();
  return allow.includes(v) ? v : fallback;
}

function numIn(v, fallback, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ctx = {
  pid: first(qs.get('pid'), localStorage.getItem('HH_PID'), 'anon'),
  name: first(qs.get('name'), qs.get('nickName'), localStorage.getItem('HH_NAME'), 'Hero'),
  run: cleanEnum(first(qs.get('run'), 'play'), ['play', 'learn'], 'play'),
  diff: cleanEnum(first(qs.get('diff'), 'normal'), ['easy', 'normal', 'hard'], 'normal'),
  time: String(numIn(first(qs.get('time'), 90), 90, 60, 120)),
  view: cleanEnum(first(qs.get('view'), 'mobile'), ['mobile', 'pc', 'cvr'], 'mobile'),
  hubRoot: buildHubRoot(qs, location.href),
  studyId: first(qs.get('studyId'), ''),
  seed: first(qs.get('seed'), String(Date.now()))
};

try { localStorage.setItem('HH_PID', ctx.pid); } catch (_) {}
try { localStorage.setItem('HH_NAME', ctx.name); } catch (_) {}

function buildSearchParamsForLinks() {
  const sp = new URLSearchParams(qs.toString());
  sp.set('pid', ctx.pid);
  sp.set('name', ctx.name);
  sp.set('run', ctx.run);
  sp.set('diff', ctx.diff);
  sp.set('time', ctx.time);
  sp.set('view', ctx.view);
  sp.set('hubRoot', ctx.hubRoot);
  if (ctx.studyId) sp.set('studyId', ctx.studyId);
  if (!sp.get('seed')) sp.set('seed', ctx.seed);
  return sp;
}

function buildGameUrl(key) {
  const game = GAME_META[key];
  if (!game) return '#';

  const overrides = {};
  if (key === 'goodjunk') {
    overrides.recommendedMode = 'solo-boss';
  }

  return buildZoneGameUrl({
    basePath: game.path,
    searchParams: buildSearchParamsForLinks(),
    zone: 'nutrition',
    gameKey: key,
    currentHref: location.href,
    overrides
  });
}

function rememberGame(key) {
  const game = GAME_META[key];
  if (!game) return;

  writeJson(STORAGE.recent, {
    key,
    title: game.title,
    at: Date.now()
  });

  const played = readJson(STORAGE.played, []);
  if (Array.isArray(played) && !played.includes(key)) {
    played.push(key);
    writeJson(STORAGE.played, played);
  }

  const all = readJson(STORAGE.daily, {});
  const day = todayKey();
  const row = all[day] || { count: 0, lastKey: '' };
  row.count += 1;
  row.lastKey = key;
  all[day] = row;
  writeJson(STORAGE.daily, all);

  try {
    localStorage.setItem('HHA_LAST_ZONE', 'nutrition');
  } catch (_) {}
}

function findRecentKey() {
  const recent = readJson(STORAGE.recent, null);
  if (recent?.key && GAME_META[recent.key]) return recent.key;

  const summary =
    readJson('HHA_LAST_SUMMARY', null) ||
    readJson('HHA_LAST_SUMMARY_GLOBAL', null);

  const txt = JSON.stringify(summary || {}).toLowerCase();

  if (txt.includes('goodjunk')) return 'goodjunk';
  if (txt.includes('plate')) return 'plate';
  if (txt.includes('group')) return 'groups';
  if (txt.includes('hydration') || txt.includes('water')) return 'hydration';

  return '';
}

function getActiveFilter() {
  return $('#filterRow .filter-chip.active')?.dataset.filter || 'all';
}

function pickFeaturedKey(activeFilter = 'all') {
  const played = readJson(STORAGE.played, []);
  const order = ['plate', 'goodjunk', 'groups', 'hydration'];

  const allowed = order.filter((k) => {
    const card = $(`#gamesGrid .game-card[data-game="${k}"]`);
    if (!card) return true;
    const filters = String(card.dataset.filters || 'all').split(',');
    return activeFilter === 'all' || filters.includes(activeFilter);
  });

  return allowed.find((k) => !played.includes(k)) || allowed[0] || 'plate';
}

function renderHeader() {
  const hubBtn = $('#hubBtn');
  const playerPill = $('#playerPill');
  const modePill = $('#modePill');
  const modeSelect = $('#modeSelect');
  const timeSelect = $('#timeSelect');

  if (hubBtn) hubBtn.href = ctx.hubRoot;
  if (playerPill) playerPill.textContent = `👤 ฮีโร่: ${ctx.name}`;
  if (modePill) modePill.textContent = `🎮 ตอนนี้: ${ctx.run === 'learn' ? 'ฝึกเรียนรู้' : 'เล่นสนุก'}`;

  if (modeSelect) {
    modeSelect.value = ctx.run;
    if (!modeSelect.__bound) {
      modeSelect.__bound = true;
      modeSelect.addEventListener('change', () => {
        ctx.run = cleanEnum(modeSelect.value, ['play', 'learn'], 'play');
        if (modePill) {
          modePill.textContent = `🎮 ตอนนี้: ${ctx.run === 'learn' ? 'ฝึกเรียนรู้' : 'เล่นสนุก'}`;
        }
        patchAllLinks();
      });
    }
  }

  if (timeSelect) {
    timeSelect.value = ['60', '90', '120'].includes(ctx.time) ? ctx.time : '90';
    if (!timeSelect.__bound) {
      timeSelect.__bound = true;
      timeSelect.addEventListener('change', () => {
        ctx.time = String(numIn(timeSelect.value, 90, 60, 120));
        patchAllLinks();
      });
    }
  }
}

function renderFeatured() {
  const key = pickFeaturedKey(getActiveFilter());
  const game = GAME_META[key];
  if (!game) return;

  const title = $('#featuredTitle');
  const sub = $('#featuredSub');
  const tags = $('#featuredTags');
  const btn = $('#featuredPlayBtn');

  if (title) title.textContent = game.title;
  if (sub) sub.textContent = game.sub;

  if (tags) {
    tags.innerHTML = game.tags.map((tag) => `<span class="tag">${tag}</span>`).join('');
  }

  if (btn) {
    btn.href = buildGameUrl(key);
    btn.textContent = key === 'plate' ? '▶️ เริ่มเกมแนะนำ' : `▶️ เล่น ${game.title}`;

    if (!btn.__bound) {
      btn.__bound = true;
      btn.addEventListener('click', () => rememberGame(key));
    }
  }
}

function renderRecent() {
  const recentKey = findRecentKey();
  const recentArea = $('#recentArea');
  const recentName = $('#recentName');

  if (!recentArea) return;

  if (!recentKey || !GAME_META[recentKey]) {
    recentArea.innerHTML = '<div class="empty">ยังไม่มีเกมล่าสุด เริ่มจากเกมแนะนำได้เลย</div>';
    if (recentName) recentName.textContent = '-';
    return;
  }

  const game = GAME_META[recentKey];
  if (recentName) recentName.textContent = game.title;

  recentArea.innerHTML = `
    <div class="recent-card">
      <div class="recent-head">
        <div>
          <div class="recent-title">${game.title}</div>
          <div class="recent-sub">${game.sub}</div>
        </div>
        <div class="badge">ล่าสุด</div>
      </div>

      <div class="tag-row">
        ${game.tags.map((tag) => `<span class="tag">${tag}</span>`).join('')}
      </div>

      <div class="game-actions">
        <a id="recentPlayBtn" class="btn primary" href="${buildGameUrl(recentKey)}">▶️ เล่นต่อ</a>
      </div>
    </div>
  `;

  const btn = $('#recentPlayBtn');
  if (btn && !btn.__bound) {
    btn.__bound = true;
    btn.addEventListener('click', () => rememberGame(recentKey));
  }
}

function patchAllLinks() {
  const map = {
    plate: '#btnPlate',
    goodjunk: '#btnGoodJunk',
    groups: '#btnGroups',
    hydration: '#btnHydration'
  };

  Object.entries(map).forEach(([key, sel]) => {
    const el = $(sel);
    if (!el) return;

    el.href = buildGameUrl(key);

    if (!el.__bound) {
      el.__bound = true;
      el.addEventListener('click', () => rememberGame(key));
    }
  });

  renderFeatured();
  renderRecent();
}

function bindFilters() {
  const row = $('#filterRow');
  if (!row || row.__bound) return;
  row.__bound = true;

  row.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.filter-chip');
    if (!btn) return;

    $$('.filter-chip', row).forEach((chip) => chip.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter || 'all';

    $$('#gamesGrid .game-card').forEach((card) => {
      const filters = String(card.dataset.filters || 'all').split(',');
      card.classList.toggle('hidden', !(filter === 'all' || filters.includes(filter)));
    });

    renderFeatured();
  });
}

function renderProgress() {
  const played = readJson(STORAGE.played, []);
  const all = readJson(STORAGE.daily, {});
  const day = todayKey();
  const count = Number(all[day]?.count || 0);
  const recentKey = findRecentKey();

  const playedCount = $('#playedCount');
  const todayCount = $('#todayCount');
  const recentName = $('#recentName');

  if (playedCount) playedCount.textContent = `${Array.isArray(played) ? played.length : 0}/4`;
  if (todayCount) todayCount.textContent = String(count);
  if (recentName && !recentKey) recentName.textContent = '-';
}

function bindContinue() {
  const btn = $('#continueBtn');
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener('click', () => {
    const recentKey = findRecentKey() || pickFeaturedKey(getActiveFilter());
    rememberGame(recentKey);
    location.href = buildGameUrl(recentKey);
  });
}

function boot() {
  renderHeader();
  bindFilters();
  bindContinue();
  patchAllLinks();
  renderProgress();
}

document.addEventListener('DOMContentLoaded', boot);
window.addEventListener('focus', () => {
  patchAllLinks();
  renderProgress();
});