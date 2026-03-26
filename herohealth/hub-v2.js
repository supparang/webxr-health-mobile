(function () {
  'use strict';

  const PASS_KEYS = [
    'pid','nick','name',
    'run','view','diff','time','seed',
    'studyId','phase','conditionGroup','sessionOrder','blockLabel',
    'siteCode','schoolYear','semester',
    'log','api','debug',
    'grade','zone'
  ];

  const DEFAULT_PLAYER = {
    name: 'Rocky',
    level: 5,
    coins: 380,
    hearts: 8,
    stars: 12,
    wins: 4,
    streak: 3
  };

  const STORAGE_KEYS = {
    profile: 'HHA_PLAYER_PROFILE',
    lastSummary: 'HHA_LAST_SUMMARY',
    summaryHistory: 'HHA_SUMMARY_HISTORY',
    lastByZone: 'HHA_LAST_BY_ZONE'
  };

  const GAMES = {
    hygiene: {
      label: 'Hygiene Zone',
      defaultUrl: './germ-detective.html',
      options: [
        { label: 'Germ Detective', sub: 'จับเชื้อโรคให้หมด', url: './germ-detective.html' },
        { label: 'Handwash VR', sub: 'ล้างมือให้ครบขั้นตอน', url: './handwash-vr.html' },
        { label: 'Brush VR', sub: 'แปรงฟันให้สะอาดสดใส', url: 'https://supparang.github.io/webxr-health-mobile/herohealth/brush-vr.html' },
        { label: 'Mask & Cough', sub: 'ฝึกปิดปากและป้องกันเชื้อโรค', url: './maskcough-vr.html' },
        { label: 'Bath VR', sub: 'อาบน้ำให้สะอาดและสนุก', url: './bath-vr.html' },
        { label: 'Clean Objects', sub: 'เลือกของสะอาดให้ถูกต้อง', url: './clean-objects.html' }
      ]
    },
    nutrition: {
      label: 'Nutrition Zone',
      defaultUrl: './plate-v1.html',
      options: [
        { label: 'Plate', sub: 'จัดจานอาหารให้ครบ 5 หมู่', url: './plate-v1.html' },
        { label: 'Groups', sub: 'แยกอาหารตามหมู่', url: './group-v1.html' },
        { label: 'GoodJunk VR', sub: 'เลือกอาหารดี หลบอาหารขยะ', url: './goodjunk-vr.html' },
        { label: 'Hydration VR', sub: 'ดื่มน้ำให้พอดีและดูแลร่างกาย', url: './hydration-vr.html' }
      ]
    },
    fitness: {
      label: 'Fitness Zone',
      defaultUrl: './shadow-breaker-vr.html',
      options: [
        { label: 'Shadow Breaker', sub: 'ต่อยเป้าให้แม่นและเร็ว', url: './shadow-breaker-vr.html' },
        { label: 'Rhythm Boxer', sub: 'ชกตามจังหวะเพลง', url: './rhythm-boxer-vr.html' },
        { label: 'Balance Hold', sub: 'ทรงตัวให้นานที่สุด', url: './balance-hold-vr.html' },
        { label: 'JumpDuck', sub: 'กระโดดและก้มหลบให้ทัน', url: './jump-duck-vr.html' },
        { label: 'Fitness Planner', sub: 'วางแผนออกกำลังกายแบบสนุก ๆ', url: './fitness-planner.html' }
      ]
    }
  };

  const ZONE_DEFAULTS = {
    hygiene: { level: 5, stars: 4, pct: 80 },
    nutrition: { level: 4, stars: 3, pct: 60 },
    fitness: { level: 3, stars: 2, pct: 40 }
  };

  const qs = new URLSearchParams(location.search);
  const $ = (sel) => document.querySelector(sel);

  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function safeParse(json, fallback){
    try {
      const v = JSON.parse(json);
      return v ?? fallback;
    } catch {
      return fallback;
    }
  }

  function fmtInt(v, fallback = 0){
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : fallback;
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function starText(n){
    const v = clamp(fmtInt(n, 0), 0, 3);
    return '⭐'.repeat(v) + '☆'.repeat(3 - v);
  }

  function zoneFromGameId(gameId){
    const id = String(gameId || '').toLowerCase();
    if (/wash|brush|germ|hygiene|bath|mask|cough|clean/.test(id)) return 'hygiene';
    if (/plate|group|food|goodjunk|nutrition|hydration/.test(id)) return 'nutrition';
    if (/shadow|rhythm|balance|jump|duck|fitness|planner/.test(id)) return 'fitness';
    return '';
  }

  function zoneLabel(zone){ return GAMES[zone]?.label || 'HeroHealth'; }

  function getDefaultOption(zone){
    const set = GAMES[zone];
    if (!set) return null;
    return set.options.find((item) => item.url === set.defaultUrl) || set.options[0] || null;
  }

  function listGameNames(zone){
    const set = GAMES[zone];
    return set ? set.options.map((item) => item.label) : [];
  }

  function getHubCanonical(){
    const url = new URL(location.href);
    url.searchParams.delete('hub');
    return url.toString();
  }

  function carryQuery(url, extra = {}){
    const u = new URL(url, location.href);
    PASS_KEYS.forEach((k) => {
      if (qs.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, qs.get(k));
    });
    u.searchParams.set('hub', getHubCanonical());
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    });
    return u.toString();
  }

  function readProfile(){
    const stored = safeParse(localStorage.getItem(STORAGE_KEYS.profile), {});
    const name = (qs.get('nick') || qs.get('name') || stored.name || DEFAULT_PLAYER.name).trim();
    return {
      name,
      level: Number(stored.level ?? DEFAULT_PLAYER.level) || DEFAULT_PLAYER.level,
      coins: Number(stored.coins ?? DEFAULT_PLAYER.coins) || DEFAULT_PLAYER.coins,
      hearts: Number(stored.hearts ?? DEFAULT_PLAYER.hearts) || DEFAULT_PLAYER.hearts,
      stars: Number(stored.stars ?? DEFAULT_PLAYER.stars) || DEFAULT_PLAYER.stars,
      wins: Number(stored.wins ?? DEFAULT_PLAYER.wins) || DEFAULT_PLAYER.wins,
      streak: Number(stored.streak ?? DEFAULT_PLAYER.streak) || DEFAULT_PLAYER.streak
    };
  }

  function writeProfile(profile){
    try { localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile)); } catch {}
  }

  function readLastSummary(){ return safeParse(localStorage.getItem(STORAGE_KEYS.lastSummary), null); }

  function readSummaryHistory(){
    const raw = safeParse(localStorage.getItem(STORAGE_KEYS.summaryHistory), []);
    return Array.isArray(raw) ? raw : [];
  }

  function readLastByZone(){ return safeParse(localStorage.getItem(STORAGE_KEYS.lastByZone), {}); }

  function writeLastByZone(map){
    try { localStorage.setItem(STORAGE_KEYS.lastByZone, JSON.stringify(map)); } catch {}
  }

  function zoneStatsFromHistory(history){
    const base = JSON.parse(JSON.stringify(ZONE_DEFAULTS));
    history.slice(-30).forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      if (!zone || !base[zone]) return;
      const score = fmtInt(item.score, 0);
      const stars = clamp(fmtInt(item.stars, 0), 0, 3);
      base[zone].pct = clamp(base[zone].pct + (stars >= 2 ? 6 : 2), 10, 100);
      base[zone].stars = clamp(Math.max(base[zone].stars, stars), 0, 5);
      if (score >= 200) base[zone].level = clamp(base[zone].level + 1, 1, 20);
    });
    return base;
  }

  function findOptionByMeta(zone, meta){
    const set = GAMES[zone];
    if (!set) return null;
    const ref = String(meta || '').toLowerCase();
    if (!ref) return null;
    return set.options.find((item) => {
      const a = item.label.toLowerCase();
      const b = item.url.toLowerCase();
      return ref.includes(a) || a.includes(ref) || ref.includes(b) || b.includes(ref);
    }) || null;
  }

  function buildLastByZone(history, lastSummary){
    const merged = { ...readLastByZone() };
    const items = [...history];
    if (lastSummary) items.push(lastSummary);

    items.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || item.url || '');
      if (!zone) return;
      const matched =
        findOptionByMeta(zone, item.url) ||
        findOptionByMeta(zone, item.replayUrl) ||
        findOptionByMeta(zone, item.title) ||
        findOptionByMeta(zone, item.game) ||
        findOptionByMeta(zone, item.gameId);
      if (!matched) return;
      merged[zone] = {
        zone,
        label: matched.label,
        url: matched.url,
        score: fmtInt(item.score, 0),
        stars: clamp(fmtInt(item.stars, 0), 0, 3),
        time: item.timestampIso || item.time || item.date || ''
      };
    });

    writeLastByZone(merged);
    return merged;
  }

  function renderPlayer(profile){
    $('#playerName').textContent = profile.name || DEFAULT_PLAYER.name;
    $('#playerMeta').textContent = 'ฮีโร่ประจำวัน • พร้อมผจญภัย';
    $('#playerLevel').textContent = String(profile.level);
    $('#playerCoins').textContent = String(profile.coins);
    $('#playerHearts').textContent = String(profile.hearts);
    $('#badgeStars').textContent = String(profile.stars);
    $('#badgeWins').textContent = String(profile.wins);
    $('#badgeStreak').textContent = String(profile.streak);
  }

  function renderZoneStats(stats){
    $('#hygLevel').textContent = String(stats.hygiene.level);
    $('#hygStars').textContent = `${stats.hygiene.stars}/5`;
    $('#hygProgressText').textContent = `${stats.hygiene.pct}%`;
    $('#hygFill').style.width = `${stats.hygiene.pct}%`;

    $('#nutriLevel').textContent = String(stats.nutrition.level);
    $('#nutriStars').textContent = `${stats.nutrition.stars}/5`;
    $('#nutriProgressText').textContent = `${stats.nutrition.pct}%`;
    $('#nutriFill').style.width = `${stats.nutrition.pct}%`;

    $('#fitLevel').textContent = String(stats.fitness.level);
    $('#fitStars').textContent = `${stats.fitness.stars}/5`;
    $('#fitProgressText').textContent = `${stats.fitness.pct}%`;
    $('#fitFill').style.width = `${stats.fitness.pct}%`;
  }

  function renderMissions(history){
    const missionList = $('#missionList');
    const todayDone = { hygiene: false, nutrition: false, fitness: false };

    const today = new Date();
    const dayKey = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    history.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      const stamp = String(item.timestampIso || item.time || item.date || '');
      if (zone && stamp.startsWith(dayKey)) todayDone[zone] = true;
    });

    const missions = [
      {
        icon: '🫧',
        name: 'เล่น Hygiene 1 เกม',
        sub: 'ล้างมือ แปรงฟัน หรือกันเชื้อโรค',
        done: todayDone.hygiene
      },
      {
        icon: '🥗',
        name: 'เล่น Nutrition 1 เกม',
        sub: 'เรียนรู้การกินอาหารที่ดี',
        done: todayDone.nutrition
      },
      {
        icon: '🏃',
        name: 'เล่น Fitness 1 เกม',
        sub: 'ขยับร่างกายให้แข็งแรง',
        done: todayDone.fitness
      }
    ];

    missionList.innerHTML = missions.map((m) => `
      <div class="mission ${m.done ? 'done' : ''}">
        <div class="mission-icon" aria-hidden="true">${m.icon}</div>
        <div class="mission-text">
          <p class="mission-name">${escapeHtml(m.name)}</p>
          <p class="mission-sub">${escapeHtml(m.sub)}</p>
        </div>
        <div class="mission-check" aria-label="${m.done ? 'สำเร็จ' : 'ยังไม่สำเร็จ'}">
          ${m.done ? '✓' : '•'}
        </div>
      </div>
    `).join('');
  }

  function renderLibraryBox(){
    const box = $('#libraryBox');
    if (!box) return;

    const cards = Object.entries(GAMES).map(([zone, set]) => {
      const names = listGameNames(zone);
      return `
        <div class="library-card">
          <div class="library-top">
            <div class="library-name">${escapeHtml(set.label)}</div>
            <div class="library-count">${names.length} เกม</div>
          </div>
          <div class="library-games">${escapeHtml(names.join(' • '))}</div>
        </div>
      `;
    }).join('');

    box.innerHTML = cards;
  }

  function initZoneMeta(){
    const maps = [
      ['hygiene', '#hygFeatured', '#btnZoneHygiene'],
      ['nutrition', '#nutriFeatured', '#btnZoneNutrition'],
      ['fitness', '#fitFeatured', '#btnZoneFitness']
    ];

    maps.forEach(([zone, featuredSel, btnSel]) => {
      const featuredEl = $(featuredSel);
      const btnEl = $(btnSel);
      const set = GAMES[zone];
      const def = getDefaultOption(zone);

      if (featuredEl && def) featuredEl.textContent = def.label;
      if (btnEl && set) btnEl.textContent = `ดูเกมทั้งหมด (${set.options.length})`;
    });
  }

  function renderLastSummary(lastSummary){
    const box = $('#summaryBox');

    if (!lastSummary) {
      box.innerHTML = `
        <div class="empty">
          ยังไม่มีผลการเล่นล่าสุด<br />
          ลองกด <b>เล่นเลย</b> ที่โซนที่ชอบ แล้วกลับมาดูสรุปตรงนี้ได้เลย
        </div>
      `;
      return;
    }

    const zone = lastSummary.zone || zoneFromGameId(lastSummary.game || lastSummary.gameId || lastSummary.title || '');
    const title = lastSummary.title || lastSummary.game || lastSummary.gameId || 'เกมล่าสุด';
    const score = fmtInt(lastSummary.score, 0);
    const coins = fmtInt(lastSummary.coins ?? lastSummary.rewardCoins, 0);
    const stars = clamp(fmtInt(lastSummary.stars, 0), 0, 3);
    const note = lastSummary.note || lastSummary.feedback || lastSummary.message || 'เก่งมาก! เล่นต่อได้เลย';
    const replayUrl = lastSummary.replayUrl || lastSummary.url || GAMES[zone]?.defaultUrl || './hub-v2.html';

    box.innerHTML = `
      <div class="last-summary">
        <div class="last-head">
          <div>
            <p class="last-title">${escapeHtml(title)}</p>
            <p class="last-meta">${escapeHtml(zoneLabel(zone))}</p>
          </div>
          <div class="last-badge">✨ ล่าสุด</div>
        </div>

        <div class="score-strip">
          <div class="score-pill">
            <span class="n">${score}</span>
            <span class="t">Score</span>
          </div>
          <div class="score-pill">
            <span class="n">${starText(stars)}</span>
            <span class="t">Stars</span>
          </div>
          <div class="score-pill">
            <span class="n">${coins}</span>
            <span class="t">Coins</span>
          </div>
        </div>

        <p class="last-meta">${escapeHtml(note)}</p>

        <a id="btnContinueLast" class="btn primary" href="${escapeHtml(carryQuery(replayUrl, { zone }))}">
          ▶️ เล่นต่อ
        </a>
      </div>
    `;
  }

  function toast(msg){
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function bindTopButtons(profile){
    $('#btnSettings').addEventListener('click', () => {
      toast('หน้าตั้งค่าจะเพิ่มต่อได้ภายหลัง');
    });

    $('#btnRewards').addEventListener('click', () => {
      toast(`ตอนนี้มี ${profile.coins} เหรียญ และ ${profile.stars} ดาว`);
    });
  }

  function openPicker(zone){
    const picker = $('#gamePicker');
    const title = $('#pickerTitle');
    const sub = $('#pickerSub');
    const list = $('#pickerList');
    const data = GAMES[zone];

    if (!picker || !data) return;

    title.textContent = data.label;
    sub.textContent = `เลือกเกมใน ${data.label} ได้เลย`;
    list.innerHTML = data.options.map((item) => {
      const isFeatured = item.url === data.defaultUrl;
      return `
      <button class="picker-item" type="button" data-url="${escapeHtml(item.url)}" data-zone="${escapeHtml(zone)}">
        <span class="picker-item-top">
          <span class="name">${escapeHtml(item.label)}</span>
          ${isFeatured ? '<span class="picker-badge">แนะนำ</span>' : ''}
        </span>
        <span class="sub">${escapeHtml(item.sub)}</span>
      </button>
    `;}).join('');

    list.querySelectorAll('.picker-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        const zoneValue = btn.getAttribute('data-zone');
        closePicker();
        location.href = carryQuery(url, { zone: zoneValue });
      });
    });

    picker.classList.add('show');
    picker.setAttribute('aria-hidden', 'false');
  }

  function closePicker(){
    const picker = $('#gamePicker');
    if (!picker) return;
    picker.classList.remove('show');
    picker.setAttribute('aria-hidden', 'true');
  }

  function bindPicker(){
    document.querySelectorAll('[data-close-picker]').forEach((el) => {
      el.addEventListener('click', closePicker);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePicker();
    });
  }

  function bindZoneLinks(){
    $('#btnPlayHygiene').href = carryQuery(GAMES.hygiene.defaultUrl, { zone: 'hygiene' });
    $('#btnPlayNutrition').href = carryQuery(GAMES.nutrition.defaultUrl, { zone: 'nutrition' });
    $('#btnPlayFitness').href = carryQuery(GAMES.fitness.defaultUrl, { zone: 'fitness' });

    $('#btnZoneHygiene').addEventListener('click', () => openPicker('hygiene'));
    $('#btnZoneNutrition').addEventListener('click', () => openPicker('nutrition'));
    $('#btnZoneFitness').addEventListener('click', () => openPicker('fitness'));
  }

  function mergeSummaryIntoProfile(profile, lastSummary){
    if (!lastSummary) return profile;

    const next = { ...profile };
    const bonusCoins = Math.max(0, fmtInt(lastSummary.coins ?? lastSummary.rewardCoins, 0));
    const stars = clamp(fmtInt(lastSummary.stars, 0), 0, 3);

    next.coins = Math.max(next.coins, DEFAULT_PLAYER.coins);
    next.stars = Math.max(next.stars, DEFAULT_PLAYER.stars, stars);
    next.level = Math.max(next.level, DEFAULT_PLAYER.level);

    if (bonusCoins > 0 && !lastSummary._hubApplied) {
      next.coins += bonusCoins;
      const patchedSummary = { ...lastSummary, _hubApplied: true };
      try{
        localStorage.setItem(STORAGE_KEYS.lastSummary, JSON.stringify(patchedSummary));
      }catch{}
    }

    writeProfile(next);
    return next;
  }

  function boot(){
    let profile = readProfile();
    const lastSummary = readLastSummary();
    const history = readSummaryHistory();

    profile = mergeSummaryIntoProfile(profile, lastSummary);

    renderPlayer(profile);
    renderZoneStats(zoneStatsFromHistory(history));
    renderMissions(history);
    renderLastSummary(lastSummary);
    renderLibraryBox();
    initZoneMeta();
    bindZoneLinks();
    bindTopButtons(profile);
    bindPicker();
  }

  boot();
})();