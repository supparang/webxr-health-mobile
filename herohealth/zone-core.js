// === /herohealth/zone-core.js ===
// PATCH v20260408-zone-core-child-friendly
// Shared child-friendly zone page core for Hygiene / Nutrition / Fitness

export function createZonePage(config = {}) {
  const qs = new URLSearchParams(location.search);
  let navBusy = false;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function first() {
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (String(v || '').trim()) return String(v).trim();
    }
    return '';
  }

  function cleanPid(v) {
    return String(v || 'anon').trim().replace(/[^\w-]/g, '').slice(0, 40) || 'anon';
  }

  function cleanName(v) {
    return String(v || '').trim().replace(/[<>]/g, '').slice(0, 40) || 'Hero';
  }

  function cleanEnum(v, allow, fallback) {
    v = String(v || '').trim().toLowerCase();
    return allow.includes(v) ? v : fallback;
  }

  function numIn(v, fallback, min, max) {
    v = Number(v);
    if (!Number.isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
  }

  function readJson(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  const ctx = {
    pid: cleanPid(first(qs.get('pid'), localStorage.getItem('HH_PID'), 'anon')),
    name: cleanName(first(qs.get('name'), qs.get('nickName'), localStorage.getItem('HH_NAME'), 'Hero')),
    studyId: first(qs.get('studyId'), ''),
    diff: cleanEnum(first(qs.get('diff'), 'normal'), ['easy', 'normal', 'hard'], 'normal'),
    time: String(numIn(first(qs.get('time'), 90), 90, 60, 300)),
    seed: first(qs.get('seed'), String(Date.now())),
    run: cleanEnum(first(qs.get('run'), 'play'), ['play', 'learn', 'research', 'demo'], 'play'),
    view: cleanEnum(first(qs.get('view'), 'mobile'), ['mobile', 'pc', 'cvr'], 'mobile'),
    hub: first(qs.get('hub'), new URL('./hub-v2.html', location.href).toString())
  };

  localStorage.setItem('HH_PID', ctx.pid);
  localStorage.setItem('HH_NAME', ctx.name);

  const zoneKey = String(config.zoneKey || '').toLowerCase();
  const zoneLabel = config.zoneLabel || zoneKey;
  const games = Array.isArray(config.games) ? config.games : [];
  const storagePrefix = String(config.storagePrefix || `HHA_${zoneKey.toUpperCase()}`);

  const RECENT_KEY = `${storagePrefix}_RECENT`;
  const PLAYED_KEY = `${storagePrefix}_PLAYED`;
  const DAILY_KEY = `${storagePrefix}_DAILY`;

  function thaiModeLabel(mode) {
    const map = {
      play: 'เล่นสนุก',
      learn: 'ฝึกเรียนรู้',
      research: 'โหมดครู',
      demo: 'สาธิต'
    };
    return map[String(mode || '').toLowerCase()] || 'เล่นสนุก';
  }

  function isDebugMode() {
    return qs.get('debug') === '1';
  }

  function getGame(key) {
    return games.find(g => String(g.key).toLowerCase() === String(key).toLowerCase()) || null;
  }

  function inferGameKeyFromText(text) {
    const t = String(text || '').toLowerCase();
    for (const game of games) {
      const aliases = [game.key, ...(game.aliases || [])].map(x => String(x).toLowerCase());
      if (aliases.some(a => a && t.includes(a))) return game.key;
    }
    return '';
  }

  function inferGameKeyFromSummary(summary) {
    if (!summary || typeof summary !== 'object') return '';
    return inferGameKeyFromText(JSON.stringify(summary).toLowerCase());
  }

  function todayStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function readRecent() {
    return readJson(RECENT_KEY, null);
  }

  function writeRecent(data) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(data || null));
    } catch (_) {}
  }

  function readPlayed() {
    const list = readJson(PLAYED_KEY, []);
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }

  function writePlayed(list) {
    try {
      localStorage.setItem(PLAYED_KEY, JSON.stringify(Array.from(new Set(list || []))));
    } catch (_) {}
  }

  function readDaily() {
    return readJson(DAILY_KEY, {});
  }

  function bumpToday(key) {
    const all = readDaily();
    const t = todayStamp();
    const row = all[t] || { count: 0, lastKey: '' };
    row.count += 1;
    row.lastKey = key || row.lastKey || '';
    all[t] = row;
    try {
      localStorage.setItem(DAILY_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function readTodayCount() {
    const all = readDaily();
    return Number(all[todayStamp()]?.count || 0);
  }

  function rememberGame(key) {
    const game = getGame(key);
    if (!game) return;

    writeRecent({
      key: game.key,
      title: game.title,
      sub: game.sub,
      at: Date.now()
    });

    const played = readPlayed();
    if (!played.includes(game.key)) {
      played.push(game.key);
      writePlayed(played);
    }

    bumpToday(game.key);
  }

  function passCommon(url) {
    [
      'pid','name','nickName','studyId','diff','time','seed','hub','view','run',
      'gameId','game','zone','cat','theme','debug','api','log',
      'studentKey','schoolCode','classRoom','studentNo','conditionGroup',
      'sessionNo','weekNo','teacher','grade'
    ].forEach((k) => {
      const v = qs.get(k);
      if (v != null && v !== '') url.searchParams.set(k, v);
    });

    if (!url.searchParams.get('pid')) url.searchParams.set('pid', ctx.pid);
    if (!url.searchParams.get('name')) url.searchParams.set('name', ctx.name);
    if (!url.searchParams.get('studyId') && ctx.studyId) url.searchParams.set('studyId', ctx.studyId);
    if (!url.searchParams.get('diff')) url.searchParams.set('diff', ctx.diff);
    if (!url.searchParams.get('time')) url.searchParams.set('time', ctx.time);
    if (!url.searchParams.get('run')) url.searchParams.set('run', ctx.run);
    if (!url.searchParams.get('view')) url.searchParams.set('view', ctx.view);
    if (!url.searchParams.get('hub')) url.searchParams.set('hub', ctx.hub);
    if (!url.searchParams.get('seed')) url.searchParams.set('seed', ctx.seed);

    url.searchParams.set('zone', zoneKey);
    url.searchParams.set('cat', zoneKey);
    return url;
  }

  function buildHubUrl() {
    return ctx.hub;
  }

  function getGameUrl(key) {
    const game = getGame(key);
    if (!game) return '';
    const u = new URL(game.path, location.href);
    passCommon(u);
    u.searchParams.set('game', game.game || game.key);
    u.searchParams.set('gameId', game.gameId || game.key);
    u.searchParams.set('theme', game.theme || game.key);
    if (game.extraParams && typeof game.extraParams === 'object') {
      Object.entries(game.extraParams).forEach(([k, v]) => {
        if (v != null && v !== '') u.searchParams.set(k, String(v));
      });
    }
    return u.toString();
  }

  function safeNavigate(url) {
    if (navBusy) return;
    navBusy = true;
    location.href = url;
  }

  function pickFeaturedGameKey() {
    const played = readPlayed();
    const firstUnplayed = games.find(g => !played.includes(g.key));
    return firstUnplayed?.key || games[0]?.key || '';
  }

  function findLastRoute() {
    const recent = readRecent();
    if (recent?.key) {
      const url = getGameUrl(recent.key);
      if (url) return url;
    }

    const summary = readJson('HHA_LAST_SUMMARY', null) || readJson('HHA_LAST_SUMMARY_GLOBAL', null);
    const key = inferGameKeyFromSummary(summary);
    if (key) return getGameUrl(key);

    return '';
  }

  function renderHeader() {
    const hubBtn = $('#hubBtn');
    const continueBtn = $('#continueBtn');
    const playerPill = $('#playerPill');
    const modePill = $('#modePill');
    const coachLine = $('#coachLine');
    const modeSelect = $('#modeSelect');
    const timeSelect = $('#timeSelect');

    if (hubBtn) hubBtn.href = buildHubUrl();
    if (playerPill) playerPill.textContent = `👤 ฮีโร่: ${ctx.name}`;
    if (modePill) modePill.textContent = `🎮 ตอนนี้: ${thaiModeLabel(ctx.run)}`;

    if (modeSelect) {
      Array.from(modeSelect.options).forEach((opt) => {
        if (opt.value === 'play') opt.textContent = 'เล่นสนุก';
        if (opt.value === 'learn') opt.textContent = 'ฝึกเรียนรู้';
        if (opt.value === 'research') opt.textContent = 'โหมดครู';
      });

      if (!isDebugMode()) {
        const researchOpt = modeSelect.querySelector('option[value="research"]');
        if (researchOpt) researchOpt.remove();
        if (ctx.run === 'research') ctx.run = 'play';
      }

      modeSelect.value = ['play', 'learn'].includes(ctx.run) ? ctx.run : 'play';
    }

    if (timeSelect) {
      const allowed = ['60', '90', '120'];
      Array.from(timeSelect.options).forEach((opt) => {
        if (!allowed.includes(opt.value)) opt.remove();
      });
      timeSelect.value = allowed.includes(ctx.time) ? ctx.time : '90';
    }

    if (coachLine) {
      const featured = getGame(pickFeaturedGameKey()) || games[0];
      if (featured) coachLine.textContent = `แนะนำตอนนี้: ${featured.title} — ${featured.sub}`;
    }

    if (continueBtn && !continueBtn.__boundZoneCore) {
      continueBtn.__boundZoneCore = true;
      continueBtn.addEventListener('click', () => {
        const url = findLastRoute() || getGameUrl(games[0]?.key);
        const key = inferGameKeyFromText(url);
        if (key) rememberGame(key);
        safeNavigate(url);
      });
    }

    if (continueBtn) {
      continueBtn.textContent = findLastRoute() ? 'เล่นต่อ' : 'เริ่มเกมแนะนำ';
    }
  }

  function renderFeatured() {
    const title = $('#featuredTitle');
    const sub = $('#featuredSub');
    const tags = $('#featuredTags');
    const btn = $('#featuredPlayBtn');
    if (!title || !sub || !tags || !btn) return;

    const key = pickFeaturedGameKey();
    const game = getGame(key) || games[0];
    if (!game) return;

    title.textContent = game.title;
    sub.textContent = game.sub;
    tags.innerHTML = (game.tags || []).map(tag => `<span class="featured-tag">${tag}</span>`).join('');
    btn.href = getGameUrl(game.key);
    btn.textContent = games[0] && game.key === games[0].key ? '▶️ เริ่มเกมแนะนำ' : `▶️ เล่น ${game.title}`;

    if (!btn.__boundZoneCore) {
      btn.__boundZoneCore = true;
      btn.addEventListener('click', () => {
        rememberGame(game.key);
        navBusy = true;
      });
    }
  }

  function renderRecent() {
    const recentArea = $('#recentArea');
    if (!recentArea) return;

    const recent = readRecent();
    const summary = readJson('HHA_LAST_SUMMARY', null) || readJson('HHA_LAST_SUMMARY_GLOBAL', null);
    const key = recent?.key || inferGameKeyFromSummary(summary) || '';

    if (!key) {
      const starter = games[0];
      recentArea.innerHTML = `
        <div class="recent-card recent-card--soft">
          <div class="recent-card-head">
            <div>
              <div class="recent-card-title">ยังไม่มีเกมล่าสุด</div>
              <div class="recent-card-sub">เริ่มจาก ${starter?.title || zoneLabel} ได้เลย เล่นง่ายและเข้าใจง่าย</div>
            </div>
            <div class="recent-badge">เริ่มต้น</div>
          </div>
          <div class="recent-card-actions">
            <a class="top-btn primary recent-play-btn" href="${getGameUrl(starter?.key)}" data-starter-key="${starter?.key || ''}">▶️ เริ่มเกมแนะนำ</a>
          </div>
        </div>
      `;
      const starterBtn = recentArea.querySelector('[data-starter-key]');
      if (starterBtn && !starterBtn.__boundZoneCore) {
        starterBtn.__boundZoneCore = true;
        starterBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          if (starter?.key) rememberGame(starter.key);
          safeNavigate(getGameUrl(starter?.key));
        });
      }
      return;
    }

    const game = getGame(key);
    if (!game) return;

    const url = getGameUrl(key);
    recentArea.innerHTML = `
      <div class="recent-card">
        <div class="recent-card-head">
          <div>
            <div class="recent-card-title">${game.title}</div>
            <div class="recent-card-sub">${game.sub}</div>
          </div>
          <div class="recent-badge">ล่าสุด</div>
        </div>
        <div class="game-chip-row">
          ${(game.tags || []).map(tag => `<span class="game-chip">${tag}</span>`).join('')}
        </div>
        <div class="recent-card-actions">
          <a class="top-btn primary recent-play-btn" href="${url}" data-recent-key="${game.key}">▶️ เล่นต่อ</a>
        </div>
      </div>
    `;

    const recentBtn = recentArea.querySelector('[data-recent-key]');
    if (recentBtn && !recentBtn.__boundZoneCore) {
      recentBtn.__boundZoneCore = true;
      recentBtn.addEventListener('click', (ev) => {
        if (navBusy) {
          ev.preventDefault();
          return;
        }
        rememberGame(game.key);
        navBusy = true;
      });
    }
  }

  function gameCardHtml(game) {
    return `
      <article class="nutri-game-card ${game.accent || game.key}" data-game="${game.key}" data-id="${game.key}">
        <div class="nutri-game-top">
          <div class="nutri-game-icon" aria-hidden="true">${game.emoji || '🎮'}</div>
          <div class="nutri-game-copy">
            <div class="nutri-game-kicker">${game.kicker || 'เล่นได้เลย'}</div>
            <h3 class="nutri-game-title">${game.title}</h3>
            <p class="nutri-game-sub">${game.sub}</p>
          </div>
        </div>

        <p class="nutri-game-desc">${game.desc || game.sub}</p>

        <div class="nutri-game-tags">
          ${(game.tags || []).map(tag => `<span class="nutri-tag">${tag}</span>`).join('')}
        </div>

        <div class="nutri-game-actions">
          <a class="nutri-play-btn" href="${getGameUrl(game.key)}" data-game="${game.key}" aria-label="เล่น ${game.title}">เล่นเลย</a>
        </div>
      </article>
    `;
  }

  function renderGrid() {
    const gamesGrid = $('#gamesGrid');
    if (!gamesGrid) return;
    gamesGrid.innerHTML = games.map(gameCardHtml).join('');
  }

  function patchGridLinks() {
    const gamesGrid = $('#gamesGrid');
    if (!gamesGrid) return;

    $$('a', gamesGrid).forEach((a) => {
      if (a.__boundZoneCore) return;
      const key = inferGameKeyFromText(
        [a.textContent, a.getAttribute('data-game'), a.getAttribute('aria-label'), a.closest('[data-game]')?.getAttribute('data-game')].join(' ')
      );
      if (!key) return;
      a.href = getGameUrl(key);
      a.__boundZoneCore = true;
      a.addEventListener('click', (ev) => {
        if (navBusy) {
          ev.preventDefault();
          return;
        }
        rememberGame(key);
        navBusy = true;
      });
    });
  }

  function bindFilters() {
    const row = $('#filterRow');
    if (!row || row.__boundZoneCore) return;
    row.__boundZoneCore = true;

    row.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.filter-chip');
      if (!btn) return;
      $$('.filter-chip', row).forEach(chip => chip.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.dataset.filter || 'all');
    });
  }

  function applyFilter(filterKey) {
    const gamesGrid = $('#gamesGrid');
    if (!gamesGrid) return;

    Array.from(gamesGrid.children).forEach((card) => {
      const key = card.getAttribute('data-game');
      const game = getGame(key);
      const filters = Array.isArray(game?.filters) ? game.filters : ['all'];
      card.style.display = (filterKey === 'all' || filters.includes(filterKey)) ? '' : 'none';
    });
  }

  function renderProgress() {
    const played = readPlayed();
    const todayCount = readTodayCount();

    const playedEl = $('#zonePlayedCount');
    const starsEl = $('#zoneStarsCount');
    const todayEl = $('#zoneTodayCount');

    if (playedEl) playedEl.textContent = `${played.length}/${games.length}`;
    if (starsEl) starsEl.textContent = `${Math.min(played.length + 1, 5)}/5`;
    if (todayEl) todayEl.textContent = String(todayCount);
  }

  function bindControls() {
    const modeSelect = $('#modeSelect');
    const timeSelect = $('#timeSelect');

    if (modeSelect && !modeSelect.__boundZoneCore) {
      modeSelect.__boundZoneCore = true;
      modeSelect.addEventListener('change', () => {
        ctx.run = modeSelect.value || 'play';
        renderHeader();
        renderFeatured();
      });
    }

    if (timeSelect && !timeSelect.__boundZoneCore) {
      timeSelect.__boundZoneCore = true;
      timeSelect.addEventListener('change', () => {
        ctx.time = timeSelect.value || '90';
        renderFeatured();
        patchGridLinks();
      });
    }
  }

  function patchStaticText() {
    const heroTitle = $('.hero-title');
    const coachLine = $('#coachLine');
    const zoneCountPill = $('.stats-row .pill');

    if (heroTitle && config.heroTitle) heroTitle.textContent = config.heroTitle;
    if (coachLine && config.defaultCoachLine) coachLine.textContent = config.defaultCoachLine;
    if (zoneCountPill) zoneCountPill.textContent = `${config.zoneEmoji || '🎮'} มี ${games.length} เกมในโซน ${zoneLabel}`;
  }

  function refreshAll() {
    patchStaticText();
    renderHeader();
    renderFeatured();
    renderRecent();
    renderGrid();
    patchGridLinks();
    bindFilters();
    bindControls();
    renderProgress();
    applyFilter('all');
  }

  document.addEventListener('DOMContentLoaded', refreshAll);
  window.addEventListener('focus', () => {
    navBusy = false;
    refreshAll();
  });

  return {
    ctx,
    refresh: refreshAll,
    rememberGame,
    getGameUrl
  };
}