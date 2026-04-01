(function () {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const HUB_URL = new URL('./hub.html', location.href).href;
  const TOAST_MS = 1800;

  const GAME_REGISTRY = {
    goodjunk: {
      key: 'goodjunk',
      title: 'GoodJunk Hero',
      shortTitle: 'GoodJunk',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '🍎',
      logo: './assets/logo-system/logos/goodjunk-logo.svg',
      href: './goodjunk-launcher.html?zone=nutrition&game=goodjunk'
    },
    goodjunkmulti: {
      key: 'goodjunkmulti',
      title: 'GoodJunk Multi',
      shortTitle: 'GJ Multi',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '👥',
      logo: './assets/logo-system/logos/goodjunk-logo.svg',
      href: './vr-goodjunk/goodjunk-multi.html?zone=nutrition&game=goodjunk'
    },

    plate: {
      key: 'plate',
      title: 'Balanced Plate',
      shortTitle: 'Plate',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '🥗',
      logo: './assets/logo-system/logos/plate-logo.svg',
      href: './plate-vr.html?zone=nutrition&game=plate'
    },
    groups: {
      key: 'groups',
      title: 'Food Groups Quest',
      shortTitle: 'Groups',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '🥦',
      logo: './assets/logo-system/logos/groups-logo.svg',
      href: './groups-vr.html?zone=nutrition&game=groups'
    },
    hydration: {
      key: 'hydration',
      title: 'Hydration Quest',
      shortTitle: 'Hydration',
      zone: 'nutrition',
      zoneLabel: 'Nutrition',
      emoji: '💧',
      logo: './assets/logo-system/logos/hydration-logo.svg',
      href: './hydration-v2.html?zone=nutrition&game=hydration'
    },

    brush: {
      key: 'brush',
      title: 'Brush Hero',
      shortTitle: 'Brush',
      zone: 'hygiene',
      zoneLabel: 'Hygiene',
      emoji: '🪥',
      logo: './assets/logo-system/logos/brush-logo.svg',
      href: './brush-vr.html?zone=hygiene&game=brush'
    },
    bath: {
      key: 'bath',
      title: 'Bath Time Hero',
      shortTitle: 'Bath',
      zone: 'hygiene',
      zoneLabel: 'Hygiene',
      emoji: '🛁',
      logo: './assets/logo-system/logos/bath-logo.svg',
      href: './bath-vr.html?zone=hygiene&game=bath'
    },
    germ: {
      key: 'germ',
      title: 'Germ Detective',
      shortTitle: 'Germ Detective',
      zone: 'hygiene',
      zoneLabel: 'Hygiene',
      emoji: '🦠',
      logo: './assets/logo-system/logos/germ-detective-logo.svg',
      href: './germ-detective.html?zone=hygiene&game=germ'
    },

    shadow: {
      key: 'shadow',
      title: 'Shadow Breaker',
      shortTitle: 'Shadow Breaker',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '⚡',
      logo: './assets/logo-system/logos/shadow-breaker-logo.svg',
      href: './shadow-breaker-vr.html?zone=fitness&game=shadow'
    },
    rhythm: {
      key: 'rhythm',
      title: 'Rhythm Boxer',
      shortTitle: 'Rhythm Boxer',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '🥊',
      logo: './assets/logo-system/logos/rhythm-boxer-logo.svg',
      href: './rhythm-boxer-vr.html?zone=fitness&game=rhythm'
    },
    jumpduck: {
      key: 'jumpduck',
      title: 'Jump Duck',
      shortTitle: 'Jump Duck',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '🏃',
      logo: './assets/logo-system/logos/jump-duck-logo.svg',
      href: './jump-duck-vr.html?zone=fitness&game=jumpduck'
    },
    balance: {
      key: 'balance',
      title: 'Balance Hold',
      shortTitle: 'Balance Hold',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '🧘',
      logo: './assets/logo-system/logos/balance-hold-logo.svg',
      href: './balance-hold-vr.html?zone=fitness&game=balance'
    },
    planner: {
      key: 'planner',
      title: 'Fitness Planner',
      shortTitle: 'Planner',
      zone: 'fitness',
      zoneLabel: 'Fitness',
      emoji: '🗓️',
      logo: './assets/logo-system/logos/fitness-planner-logo.svg',
      href: './fitness-planner.html?zone=fitness&game=planner'
    }
  };

  const ZONE_MAP = {
    hygiene: ['brush', 'bath', 'germ'],
    nutrition: ['goodjunk', 'goodjunkmulti', 'plate', 'groups', 'hydration'],
    fitness: ['shadow', 'rhythm', 'jumpduck', 'balance', 'planner']
  };

  const FEATURED = {
    hygiene: 'germ',
    nutrition: 'goodjunk',
    fitness: 'shadow'
  };

  const ZONE_LABELS = {
    hygiene: 'Hygiene',
    nutrition: 'Nutrition',
    fitness: 'Fitness'
  };

  const STORE = {
    profile: 'HH_PROFILE_V2',
    summary: 'HHA_LAST_SUMMARY',
    recentByZone: 'HH_RECENT_BY_ZONE_V2',
    stickerShelf: 'HH_STICKER_SHELF_V2',
    missionState: 'HH_MISSION_STATE_V2',
    lastGameKey: 'HH_LAST_GAME_KEY',
    lastPlayedAt: 'HH_LAST_PLAYED_AT',
    todayPlayedCount: 'HH_TODAY_PLAYED_COUNT',
    todayZoneCount: 'HH_TODAY_ZONE_COUNT'
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function getQuery() {
    return new URLSearchParams(location.search);
  }

  function withHub(url) {
    try {
      const u = new URL(url, location.href);
      if (!u.searchParams.get('hub')) {
        u.searchParams.set('hub', HUB_URL);
      }
      return u.toString();
    } catch {
      return url;
    }
  }

  function zoneClass(zone) {
    return `hh-zone-chip--${zone}`;
  }

  function toast(msg) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), TOAST_MS);
  }

  function escapeHtml(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getProfile() {
    const qs = getQuery();
    const saved = readJSON(STORE.profile, {});
    const name = qs.get('name') || qs.get('nick') || saved.name || 'Rocky';
    const pid = qs.get('pid') || saved.pid || 'anon';

    return {
      name,
      pid,
      level: saved.level ?? 5,
      coins: saved.coins ?? 380,
      hearts: saved.hearts ?? 8,
      stars: saved.stars ?? 12,
      wins: saved.wins ?? 4,
      streak: saved.streak ?? 3
    };
  }

  function saveProfile(profile) {
    writeJSON(STORE.profile, profile);
  }

  function resolveGameKey(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return '';

    const aliases = {
      platev1: 'plate',
      platevr: 'plate',
      groupsvr: 'groups',
      hydrationv2: 'hydration',
      hydrationvr: 'hydration',
      brushvr: 'brush',
      bathvr: 'bath',
      germdetective: 'germ',
      shadowbreaker: 'shadow',
      rhythmboxer: 'rhythm',
      'jump-duck': 'jumpduck',
      jumduck: 'jumpduck',
      balancehold: 'balance',
      fitnessplanner: 'planner',
      goodjunkmulti: 'goodjunkmulti'
    };

    return GAME_REGISTRY[raw] ? raw : (aliases[raw] || '');
  }

  function gameCard(gameKey) {
    const g = GAME_REGISTRY[gameKey];
    if (!g) return '';

    const href = withHub(g.href);

    return `
      <a class="hh-game-card" href="${escapeHtml(href)}" data-game="${escapeHtml(g.key)}" data-zone="${escapeHtml(g.zone)}">
        <img class="hh-game-card__logo" src="${escapeHtml(g.logo)}" alt="${escapeHtml(g.title)}"
             onerror="this.style.display='none';this.insertAdjacentHTML('afterend','<div class=&quot;hh-game-card__logo-fallback&quot;>${escapeHtml(g.emoji)}</div>');">
        <div class="hh-game-card__body">
          <h4 class="hh-game-card__title">${escapeHtml(g.title)}</h4>
          <p class="hh-game-card__meta">
            <span class="hh-zone-chip ${zoneClass(g.zone)}">${escapeHtml(g.emoji)} ${escapeHtml(g.zoneLabel)}</span>
          </p>
        </div>
      </a>
    `;
  }

  function renderZonePreview(zone, mountId) {
    const el = document.getElementById(mountId);
    if (!el) return;
    const keys = ZONE_MAP[zone] || [];
    el.innerHTML = keys.map(gameCard).join('');
  }

  function renderLibrary() {
    const el = $('#libraryBox');
    if (!el) return;

    const order = [
      'goodjunk', 'goodjunkmulti', 'plate', 'groups', 'hydration',
      'brush', 'bath', 'germ',
      'shadow', 'rhythm', 'jumpduck', 'balance', 'planner'
    ];

    el.innerHTML = order.map(gameCard).join('');
  }

  function openPicker(title, sub, mode = 'all', zone = '') {
    const modal = $('#gamePicker');
    if (!modal) return;
    $('#pickerTitle').textContent = title;
    $('#pickerSub').textContent = sub;
    renderPicker(mode, zone);
    modal.setAttribute('aria-hidden', 'false');
    modal.classList.add('is-open');
  }

  function closePicker() {
    const modal = $('#gamePicker');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.classList.remove('is-open');
  }

  function renderPicker(mode = 'all', zone = '') {
    const el = $('#pickerList');
    if (!el) return;

    let keys = Object.keys(GAME_REGISTRY);

    if (zone && ZONE_MAP[zone]) {
      keys = [...ZONE_MAP[zone]];
    }

    if (mode === 'recommended') {
      keys = zone && FEATURED[zone]
        ? [FEATURED[zone]]
        : [FEATURED.hygiene, FEATURED.nutrition, FEATURED.fitness];
    } else if (mode === 'recent') {
      const recent = resolveGameKey(localStorage.getItem(STORE.lastGameKey));
      keys = recent ? [recent] : [FEATURED.nutrition];
    }

    el.innerHTML = keys.map(gameCard).join('');
  }

  function mountTopBrand() {
    const mount = $('#hhHubBrandMount');
    if (!mount) return;

    mount.innerHTML = `
      <div class="hh-brand-hero">
        <div class="hh-brand-hero__card">
          <img src="./assets/logo-system/logos/hub-logo.svg" alt="HeroHealth" class="hh-brand-hero__logo"
               onerror="this.style.display='none';this.nextElementSibling.hidden=false;">
          <div class="hh-brand-hero__fallback" hidden>🛡️</div>
          <div class="hh-brand-hero__copy">
            <h2>HeroHealth World</h2>
            <p>เลือกภารกิจสุขภาพที่อยากเล่น แล้วออกผจญภัยได้เลย</p>
          </div>
        </div>
      </div>
    `;
  }

  function updateProfileUI() {
    const p = getProfile();
    $('#playerName').textContent = p.name;
    $('#playerMeta').textContent = `PID: ${p.pid} • พร้อมผจญภัย`;
    $('#playerLevel').textContent = p.level;
    $('#playerCoins').textContent = p.coins;
    $('#playerHearts').textContent = p.hearts;
    $('#badgeStars').textContent = p.stars;
    $('#badgeWins').textContent = p.wins;
    $('#badgeStreak').textContent = p.streak;
    saveProfile(p);
  }

  function getLastSummary() {
    const raw = readJSON(STORE.summary, null);
    if (raw && typeof raw === 'object') return raw;
    return null;
  }

  function getSummaryGameKey(summary) {
    if (!summary || typeof summary !== 'object') return '';
    return resolveGameKey(
      summary.gameKey ||
      summary.game ||
      summary.gameId ||
      summary.key ||
      summary.slug
    );
  }

  function updateSummaryBox() {
    const box = $('#summaryBox');
    if (!box) return;

    const s = getLastSummary();
    if (!s) {
      box.innerHTML = `
        <div class="summary-item">
          <strong>ยังไม่มีสรุปล่าสุด</strong>
          <small>เล่นเกมสักรอบ แล้วสรุปผลจะมาแสดงที่นี่</small>
        </div>
      `;
      return;
    }

    const gameKey = getSummaryGameKey(s);
    const game = GAME_REGISTRY[gameKey];
    const title = game ? game.title : (s.title || 'ไม่ทราบชื่อเกม');
    const score = s.score ?? s.points ?? s.totalScore ?? '-';
    const stars = s.stars ?? s.star ?? s.totalStars ?? '-';
    const rank = s.rank ?? s.grade ?? '-';

    box.innerHTML = `
      <div class="summary-item">
        <strong>${escapeHtml(title)}</strong>
        <small>คะแนน ${escapeHtml(score)} • ดาว ${escapeHtml(stars)} • Rank ${escapeHtml(rank)}</small>
      </div>
    `;
  }

  function updateRecentByZone() {
    const rec = readJSON(STORE.recentByZone, { hygiene:'', nutrition:'', fitness:'' });

    const maps = [
      ['hygiene', 'hygRecentPill', 'hygRecentText'],
      ['nutrition', 'nutriRecentPill', 'nutriRecentText'],
      ['fitness', 'fitRecentPill', 'fitRecentText']
    ];

    for (const [zone, pillId, textId] of maps) {
      const key = resolveGameKey(rec[zone]);
      const pill = document.getElementById(pillId);
      const text = document.getElementById(textId);
      if (!pill || !text) continue;

      if (key && GAME_REGISTRY[key]) {
        text.textContent = GAME_REGISTRY[key].title;
        pill.hidden = false;
      } else {
        pill.hidden = true;
      }
    }
  }

  function updateTodayStats() {
    const lastKey = resolveGameKey(localStorage.getItem(STORE.lastGameKey));
    const playedCount = Number(localStorage.getItem(STORE.todayPlayedCount) || 0);
    const zoneCount = Number(localStorage.getItem(STORE.todayZoneCount) || 0);

    $('#todayPlayedCount').textContent = String(playedCount);
    $('#todayZoneCount').textContent = String(zoneCount);
    $('#todayLastGame').textContent = lastKey && GAME_REGISTRY[lastKey]
      ? GAME_REGISTRY[lastKey].title
      : 'ยังไม่มี';

    $('#todayNextGame').textContent = GAME_REGISTRY[FEATURED.nutrition].title;
  }

  function updateFeaturedLabels() {
    $('#hygFeatured').textContent = GAME_REGISTRY[FEATURED.hygiene].title;
    $('#nutriFeatured').textContent = GAME_REGISTRY[FEATURED.nutrition].title;
    $('#fitFeatured').textContent = GAME_REGISTRY[FEATURED.fitness].title;
  }

  function renderMissions() {
    const list = $('#missionList');
    if (!list) return;

    const state = readJSON(STORE.missionState, {
      items: [
        { text: 'เล่น Hygiene 1 เกม', done: false },
        { text: 'เล่น Nutrition 1 เกม', done: false },
        { text: 'เล่น Fitness 1 เกม', done: false }
      ]
    });

    list.innerHTML = state.items.map((m, i) => `
      <div class="mission-item" data-mission-index="${i}">
        <strong>${m.done ? '✅' : '⭐'} ${escapeHtml(m.text)}</strong>
        <small>${m.done ? 'สำเร็จแล้ว' : 'ยังรอพิชิตอยู่'}</small>
      </div>
    `).join('');
  }

  function renderChains() {
    const make = (zone, id) => {
      const el = document.getElementById(id);
      if (!el) return;

      const keys = ZONE_MAP[zone] || [];
      el.innerHTML = keys.map(k => {
        const g = GAME_REGISTRY[k];
        return `<span class="pill">${escapeHtml(g.emoji)} ${escapeHtml(g.shortTitle)}</span>`;
      }).join('');
    };

    make('hygiene', 'chainHygiene');
    make('nutrition', 'chainNutrition');
    make('fitness', 'chainFitness');
  }

  function renderStickerShelf() {
    const el = $('#stickerShelf');
    if (!el) return;

    const stickers = readJSON(STORE.stickerShelf, ['🌟','🪥','🍎','🏃','🛡️','💧','🥦','⚡']);
    el.innerHTML = stickers.slice(0, 8).map(s => `<div class="sticker">${escapeHtml(s)}</div>`).join('');
  }

  function bindPickerButtons() {
    $('#btnQuickRecommended')?.addEventListener('click', () => {
      openPicker('เกมแนะนำ', 'เริ่มจากเกมเด่นของแต่ละโซนได้เลย', 'recommended');
    });

    $('#btnQuickRecent')?.addEventListener('click', () => {
      openPicker('เกมล่าสุด', 'กลับไปเล่นเกมล่าสุดได้ทันที', 'recent');
    });

    $('#btnQuickAllGames')?.addEventListener('click', () => {
      openPicker('ทุกเกมของ HeroHealth', 'เลือกเกมที่อยากเล่นได้เลย', 'all');
    });

    $('#pickerShowRecommended')?.addEventListener('click', () => renderPicker('recommended'));
    $('#pickerShowAllModes')?.addEventListener('click', () => renderPicker('all'));
    $('#pickerShowRecent')?.addEventListener('click', () => renderPicker('recent'));

    $$('[data-close-picker]').forEach(btn => {
      btn.addEventListener('click', closePicker);
    });
  }

  function bindZoneButtons() {
    const playMap = [
      ['btnPlayHygiene', FEATURED.hygiene],
      ['btnPlayNutrition', FEATURED.nutrition],
      ['btnPlayFitness', FEATURED.fitness]
    ];

    playMap.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && GAME_REGISTRY[key]) {
        el.href = withHub(GAME_REGISTRY[key].href);
      }
    });

    $('#btnZoneHygiene')?.addEventListener('click', () => {
      openPicker('Hygiene Zone', 'เลือกเกมในโซนสุขอนามัย', 'all', 'hygiene');
    });

    $('#btnZoneNutrition')?.addEventListener('click', () => {
      openPicker('Nutrition Zone', 'เลือกเกมในโซนโภชนาการ', 'all', 'nutrition');
    });

    $('#btnZoneFitness')?.addEventListener('click', () => {
      openPicker('Fitness Zone', 'เลือกเกมในโซนออกกำลังกาย', 'all', 'fitness');
    });
  }

  function bindResumeButtons() {
    $('#btnResumeNow')?.addEventListener('click', () => {
      const key = resolveGameKey(localStorage.getItem(STORE.lastGameKey)) || FEATURED.nutrition;
      location.href = withHub(GAME_REGISTRY[key].href);
    });

    $('#btnNextInZone')?.addEventListener('click', () => {
      const nextKey = FEATURED.fitness;
      location.href = withHub(GAME_REGISTRY[nextKey].href);
    });
  }

  function bindTools() {
    $('#btnSettings')?.addEventListener('click', () => toast('หน้าตั้งค่าจะเชื่อมต่อในขั้นถัดไป'));
    $('#btnRewards')?.addEventListener('click', () => toast('ระบบรางวัลพร้อมเชื่อมต่อกับ badge shelf'));

    $('#btnResetTodayMissions')?.addEventListener('click', () => {
      writeJSON(STORE.missionState, {
        items: [
          { text: 'เล่น Hygiene 1 เกม', done: false },
          { text: 'เล่น Nutrition 1 เกม', done: false },
          { text: 'เล่น Fitness 1 เกม', done: false }
        ]
      });
      renderMissions();
      toast('รีเซ็ตภารกิจวันนี้แล้ว');
    });
  }

  function buildDiagnostics() {
    const qs = Object.fromEntries(getQuery().entries());
    const warmup = {
      warmupDone: localStorage.getItem('HH_WARMUP_DONE') || '',
      cooldownReady: localStorage.getItem('HH_COOLDOWN_READY') || ''
    };
    const summary = getLastSummary();
    const recentByZone = readJSON(STORE.recentByZone, {});
    const routes = Object.fromEntries(
      Object.keys(GAME_REGISTRY).map(k => [k, withHub(GAME_REGISTRY[k].href)])
    );

    $('#diagContext').textContent = JSON.stringify(qs, null, 2);
    $('#diagWarmup').textContent = JSON.stringify(warmup, null, 2);
    $('#diagLastSummary').textContent = JSON.stringify(summary, null, 2);
    $('#diagRecentByZone').textContent = JSON.stringify(recentByZone, null, 2);
    $('#diagResolvedRoutes').textContent = JSON.stringify(routes, null, 2);

    const links = $('#diagQuickLinks');
    if (links) {
      links.innerHTML = Object.keys(FEATURED).map(zone => {
        const g = GAME_REGISTRY[FEATURED[zone]];
        return `<a class="diag-link" href="${escapeHtml(withHub(g.href))}">${escapeHtml(ZONE_LABELS[zone])}: ${escapeHtml(g.title)}</a>`;
      }).join('');
    }
  }

  function bindDiagnostics() {
    const panel = $('#diagnosticsPanel');

    $('#btnDiagnostics')?.addEventListener('click', () => {
      if (!panel) return;
      buildDiagnostics();
      panel.hidden = false;
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#btnCloseDiagnostics')?.addEventListener('click', () => {
      if (panel) panel.hidden = true;
    });

    $('#btnCopyDebugSnapshot')?.addEventListener('click', async () => {
      try {
        const snapshot = {
          query: Object.fromEntries(getQuery().entries()),
          summary: getLastSummary(),
          recentByZone: readJSON(STORE.recentByZone, {}),
          lastGameKey: localStorage.getItem(STORE.lastGameKey) || '',
          lastPlayedAt: localStorage.getItem(STORE.lastPlayedAt) || ''
        };
        await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
        toast('คัดลอก snapshot แล้ว');
      } catch {
        toast('คัดลอก snapshot ไม่สำเร็จ');
      }
    });
  }

  function primeDemoData() {
    if (!localStorage.getItem(STORE.missionState)) {
      writeJSON(STORE.missionState, {
        items: [
          { text: 'เล่น Hygiene 1 เกม', done: true },
          { text: 'เล่น Nutrition 1 เกม', done: false },
          { text: 'เล่น Fitness 1 เกม', done: false }
        ]
      });
    }

    if (!localStorage.getItem(STORE.recentByZone)) {
      writeJSON(STORE.recentByZone, {
        hygiene: 'germ',
        nutrition: 'goodjunk',
        fitness: 'shadow'
      });
    }

    if (!localStorage.getItem(STORE.stickerShelf)) {
      writeJSON(STORE.stickerShelf, ['🌟','🪥','🍎','🏃','🛡️','💧','🥦','⚡']);
    }
  }

  function init() {
    primeDemoData();
    mountTopBrand();

    updateProfileUI();
    updateFeaturedLabels();
    updateRecentByZone();
    updateTodayStats();
    updateSummaryBox();

    renderZonePreview('hygiene', 'hygPreview');
    renderZonePreview('nutrition', 'nutriPreview');
    renderZonePreview('fitness', 'fitPreview');

    renderLibrary();
    renderMissions();
    renderChains();
    renderStickerShelf();
    renderPicker('recommended');

    bindPickerButtons();
    bindZoneButtons();
    bindResumeButtons();
    bindTools();
    bindDiagnostics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  window.HH_GAME_REGISTRY = GAME_REGISTRY;
})();
