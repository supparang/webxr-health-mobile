const qs = new URLSearchParams(location.search);

const GAME_META = {
  plate: {
    key: 'plate',
    title: 'Plate',
    sub: 'ฝึกเลือกอาหารครบ 5 หมู่แบบเข้าใจง่าย',
    tags: ['เริ่มง่าย', 'ครบ 5 หมู่', 'เลือกโหมดได้'],
    path: './plate-vr.html' // เปลี่ยนตรงนี้ถ้า launcher จริงใช้ชื่ออื่น
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
    path: './groups-v1.html'
  },
  hydration: {
    key: 'hydration',
    title: 'Hydration',
    sub: 'เรียนรู้เรื่องการดื่มน้ำและดูแลร่างกาย',
    tags: ['เล่นสั้น', 'สุขภาพ', 'น้ำดื่ม'],
    path: './hydration-v2.html'
  }
};

const STORAGE = {
  recent: 'HHA_NUTRITION_RECENT',
  played: 'HHA_NUTRITION_PLAYED',
  daily: 'HHA_NUTRITION_DAILY'
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function first(...vals){
  for (const v of vals){
    if (String(v || '').trim()) return String(v).trim();
  }
  return '';
}

function cleanEnum(v, allow, fallback){
  v = String(v || '').trim().toLowerCase();
  return allow.includes(v) ? v : fallback;
}

function numIn(v, fallback, min, max){
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readJson(key, fallback = null){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  }catch(_){
    return fallback;
  }
}

function writeJson(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(_){}
}

const ctx = {
  pid: first(qs.get('pid'), localStorage.getItem('HH_PID'), 'anon'),
  name: first(qs.get('name'), qs.get('nickName'), localStorage.getItem('HH_NAME'), 'Hero'),
  run: cleanEnum(first(qs.get('run'), 'play'), ['play', 'learn'], 'play'),
  diff: cleanEnum(first(qs.get('diff'), 'normal'), ['easy', 'normal', 'hard'], 'normal'),
  time: String(numIn(first(qs.get('time'), 90), 90, 60, 120)),
  view: cleanEnum(first(qs.get('view'), 'mobile'), ['mobile', 'pc', 'cvr'], 'mobile'),
  hub: first(qs.get('hub'), './hub-v2.html'),
  studyId: first(qs.get('studyId'), ''),
  seed: first(qs.get('seed'), String(Date.now()))
};

localStorage.setItem('HH_PID', ctx.pid);
localStorage.setItem('HH_NAME', ctx.name);

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function passCommon(url){
  const passthrough = [
    'pid','name','nickName','studyId','diff','time','seed','hub','view','run',
    'debug','api','log','studentKey','schoolCode','classRoom','studentNo',
    'conditionGroup','sessionNo','weekNo','teacher','grade'
  ];

  passthrough.forEach((k) => {
    const v = qs.get(k);
    if (v != null && v !== '') url.searchParams.set(k, v);
  });

  if (!url.searchParams.get('pid')) url.searchParams.set('pid', ctx.pid);
  if (!url.searchParams.get('name')) url.searchParams.set('name', ctx.name);
  if (!url.searchParams.get('run')) url.searchParams.set('run', ctx.run);
  if (!url.searchParams.get('diff')) url.searchParams.set('diff', ctx.diff);
  if (!url.searchParams.get('time')) url.searchParams.set('time', ctx.time);
  if (!url.searchParams.get('view')) url.searchParams.set('view', ctx.view);
  if (!url.searchParams.get('hub')) url.searchParams.set('hub', ctx.hub);
  if (!url.searchParams.get('seed')) url.searchParams.set('seed', ctx.seed);
  if (!url.searchParams.get('studyId') && ctx.studyId) url.searchParams.set('studyId', ctx.studyId);

  url.searchParams.set('zone', 'nutrition');
  url.searchParams.set('cat', 'nutrition');
  return url;
}

function buildGameUrl(key){
  const game = GAME_META[key];
  if (!game) return '#';
  const u = new URL(game.path, location.href);
  passCommon(u);

  u.searchParams.set('game', key);
  u.searchParams.set('gameId', key);
  u.searchParams.set('theme', key);

  if (key === 'goodjunk') {
    u.searchParams.set('recommendedMode', 'solo-boss');
  }

  return u.toString();
}

function rememberGame(key){
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
}

function findRecentKey(){
  const recent = readJson(STORAGE.recent, null);
  if (recent?.key && GAME_META[recent.key]) return recent.key;

  const summary = readJson('HHA_LAST_SUMMARY', null) || readJson('HHA_LAST_SUMMARY_GLOBAL', null);
  const txt = JSON.stringify(summary || {}).toLowerCase();

  if (txt.includes('goodjunk')) return 'goodjunk';
  if (txt.includes('plate')) return 'plate';
  if (txt.includes('group')) return 'groups';
  if (txt.includes('hydration') || txt.includes('water')) return 'hydration';

  return '';
}

function pickFeaturedKey(){
  const played = readJson(STORAGE.played, []);
  const order = ['plate', 'goodjunk', 'groups', 'hydration'];
  return order.find(k => !played.includes(k)) || 'plate';
}

function renderHeader(){
  $('#hubBtn').href = ctx.hub;
  $('#playerPill').textContent = `👤 ฮีโร่: ${ctx.name}`;
  $('#modePill').textContent = `🎮 ตอนนี้: ${ctx.run === 'learn' ? 'ฝึกเรียนรู้' : 'เล่นสนุก'}`;

  const modeSelect = $('#modeSelect');
  modeSelect.value = ctx.run;
  if (!modeSelect.__bound) {
    modeSelect.__bound = true;
    modeSelect.addEventListener('change', () => {
      ctx.run = cleanEnum(modeSelect.value, ['play', 'learn'], 'play');
      $('#modePill').textContent = `🎮 ตอนนี้: ${ctx.run === 'learn' ? 'ฝึกเรียนรู้' : 'เล่นสนุก'}`;
      patchAllLinks();
    });
  }

  const timeSelect = $('#timeSelect');
  timeSelect.value = ['60','90','120'].includes(ctx.time) ? ctx.time : '90';
  if (!timeSelect.__bound) {
    timeSelect.__bound = true;
    timeSelect.addEventListener('change', () => {
      ctx.time = String(numIn(timeSelect.value, 90, 60, 120));
      patchAllLinks();
    });
  }
}

function renderFeatured(){
  const key = pickFeaturedKey();
  const game = GAME_META[key];
  if (!game) return;

  $('#featuredTitle').textContent = game.title;
  $('#featuredSub').textContent = game.sub;
  $('#featuredTags').innerHTML = game.tags.map(tag => `<span class="tag">${tag}</span>`).join('');

  const btn = $('#featuredPlayBtn');
  btn.href = buildGameUrl(key);
  btn.textContent = key === 'plate' ? '▶️ เริ่มเกมแนะนำ' : `▶️ เล่น ${game.title}`;

  if (!btn.__bound) {
    btn.__bound = true;
    btn.addEventListener('click', () => rememberGame(key));
  }
}

function renderRecent(){
  const recentKey = findRecentKey();
  const recentArea = $('#recentArea');
  const recentName = $('#recentName');

  if (!recentKey || !GAME_META[recentKey]) {
    recentArea.innerHTML = '<div class="empty">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>';
    recentName.textContent = '-';
    return;
  }

  const game = GAME_META[recentKey];
  recentName.textContent = game.title;

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
        ${game.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
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

function patchAllLinks(){
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

function bindFilters(){
  const row = $('#filterRow');
  if (!row || row.__bound) return;
  row.__bound = true;

  row.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.filter-chip');
    if (!btn) return;

    $$('.filter-chip', row).forEach(chip => chip.classList.remove('active'));
    btn.classList.add('active');

    const filter = btn.dataset.filter || 'all';

    $$('#gamesGrid .game-card').forEach((card) => {
      const filters = String(card.dataset.filters || 'all').split(',');
      card.classList.toggle('hidden', !(filter === 'all' || filters.includes(filter)));
    });
  });
}

function renderProgress(){
  const played = readJson(STORAGE.played, []);
  const all = readJson(STORAGE.daily, {});
  const day = todayKey();
  const count = Number(all[day]?.count || 0);

  $('#playedCount').textContent = `${Array.isArray(played) ? played.length : 0}/4`;
  $('#todayCount').textContent = String(count);
}

function bindContinue(){
  const btn = $('#continueBtn');
  if (!btn || btn.__bound) return;
  btn.__bound = true;

  btn.addEventListener('click', () => {
    const recentKey = findRecentKey() || pickFeaturedKey();
    rememberGame(recentKey);
    location.href = buildGameUrl(recentKey);
  });
}

function boot(){
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