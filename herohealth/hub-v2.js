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
    summaryHistory: 'HHA_SUMMARY_HISTORY'
  };

  const GAMES = {
    hygiene: {
      label: 'Hygiene Zone',
      defaultUrl: './germ-detective.html',
      mascot: 'ฟองฟู่บับเบิล',
      options: [
        { id: 'germ-detective', label: 'Germ Detective', sub: 'จับเชื้อโรคให้หมด', url: './germ-detective.html', icon: '🦠' },
        { id: 'handwash-vr', label: 'Handwash VR', sub: 'ล้างมือให้ครบขั้นตอน', url: './handwash-vr.html', icon: '🧼' },
        { id: 'brush-vr', label: 'Brush VR', sub: 'แปรงฟันให้สะอาดสดใส', url: 'https://supparang.github.io/webxr-health-mobile/herohealth/brush-vr.html', icon: '🪥' },
        { id: 'maskcough-vr', label: 'Mask & Cough', sub: 'ฝึกปิดปากและป้องกันเชื้อโรค', url: './maskcough-vr.html', icon: '😷' },
        { id: 'bath-vr', label: 'Bath VR', sub: 'อาบน้ำให้สะอาดและสนุก', url: './bath-vr.html', icon: '🛁' },
        { id: 'clean-objects', label: 'Clean Objects', sub: 'เลือกของสะอาดให้ถูกต้อง', url: './clean-objects.html', icon: '✨' }
      ]
    },
    nutrition: {
      label: 'Nutrition Zone',
      defaultUrl: './plate-v1.html',
      mascot: 'เชฟผักผลไม้',
      options: [
        { id: 'plate-v1', label: 'Plate', sub: 'จัดจานอาหารให้ครบ 5 หมู่', url: './plate-v1.html', icon: '🍽️' },
        { id: 'group-v1', label: 'Groups', sub: 'แยกอาหารตามหมู่', url: './group-v1.html', icon: '🥕' },
        { id: 'goodjunk-vr', label: 'GoodJunk VR', sub: 'เลือกอาหารดี หลบอาหารขยะ', url: './goodjunk-vr.html', icon: '🍔' },
        { id: 'hydration-vr', label: 'Hydration VR', sub: 'ดื่มน้ำให้พอดีและดูแลร่างกาย', url: './hydration-vr.html', icon: '💧' }
      ]
    },
    fitness: {
      label: 'Fitness Zone',
      defaultUrl: './shadow-breaker-vr.html',
      mascot: 'โค้ชสายฟ้า',
      options: [
        { id: 'shadow-breaker-vr', label: 'Shadow Breaker', sub: 'ต่อยเป้าให้แม่นและเร็ว', url: './shadow-breaker-vr.html', icon: '🥊' },
        { id: 'rhythm-boxer-vr', label: 'Rhythm Boxer', sub: 'ชกตามจังหวะเพลง', url: './rhythm-boxer-vr.html', icon: '🎵' },
        { id: 'balance-hold-vr', label: 'Balance Hold', sub: 'ทรงตัวให้นานที่สุด', url: './balance-hold-vr.html', icon: '🧘' },
        { id: 'jump-duck-vr', label: 'JumpDuck', sub: 'กระโดดและก้มหลบให้ทัน', url: './jump-duck-vr.html', icon: '🦘' },
        { id: 'fitness-planner', label: 'Fitness Planner', sub: 'วางแผนออกกำลังกายแบบสนุก ๆ', url: './fitness-planner.html', icon: '📋' }
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
  function safeParse(json, fallback){ try{ const v = JSON.parse(json); return v ?? fallback; }catch{ return fallback; } }
  function fmtInt(v, fallback = 0){ const n = Number(v); return Number.isFinite(n) ? Math.round(n) : fallback; }
  function slugify(text){ return String(text || '').toLowerCase().replace(/https?:\/\//g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
  function starText(n){ const v = clamp(fmtInt(n, 0), 0, 3); return '⭐'.repeat(v) + '☆'.repeat(3 - v); }

  function optionClass(option){ return `theme-${option.id}`; }

  function zoneFromGameId(gameId){
    const id = String(gameId || '').toLowerCase();
    if (/wash|brush|germ|hygiene|bath|mask|cough|clean/.test(id)) return 'hygiene';
    if (/plate|group|food|goodjunk|nutrition|hydration/.test(id)) return 'nutrition';
    if (/shadow|rhythm|balance|jump|duck|fitness/.test(id)) return 'fitness';
    return '';
  }

  function zoneLabel(zone){ return GAMES[zone]?.label || 'HeroHealth'; }
  function getDefaultOption(zone){ const set = GAMES[zone]; return set ? (set.options.find((item) => item.url === set.defaultUrl) || set.options[0] || null) : null; }
  function findOptionByUrl(zone, url){ const set = GAMES[zone]; return set ? (set.options.find((item) => item.url === url) || null) : null; }
  function findOptionByName(zone, name){
    const target = slugify(name);
    const set = GAMES[zone];
    if (!set) return null;
    return set.options.find((item) => slugify(item.label) === target || slugify(item.url).includes(target)) || null;
  }

  function getHubCanonical(){
    const url = new URL(location.href);
    url.searchParams.delete('hub');
    return url.toString();
  }

  function carryQuery(url, extra = {}){
    const u = new URL(url, location.href);
    PASS_KEYS.forEach((k) => { if (qs.has(k) && !u.searchParams.has(k)) u.searchParams.set(k, qs.get(k)); });
    u.searchParams.set('hub', getHubCanonical());
    Object.entries(extra).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v)); });
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

  function writeProfile(profile){ try{ localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile)); }catch{} }
  function readLastSummary(){ return safeParse(localStorage.getItem(STORAGE_KEYS.lastSummary), null); }
  function readSummaryHistory(){ const raw = safeParse(localStorage.getItem(STORAGE_KEYS.summaryHistory), []); return Array.isArray(raw) ? raw : []; }

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

  function getRecentByZone(history, lastSummary){
    const map = { hygiene: null, nutrition: null, fitness: null };
    history.forEach((item, idx) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      if (!zone) return;
      map[zone] = { ...item, _idx: idx };
    });
    if (lastSummary) {
      const zone = lastSummary.zone || zoneFromGameId(lastSummary.game || lastSummary.gameId || lastSummary.title || '');
      if (zone) map[zone] = { ...lastSummary, _idx: 999999 };
    }
    return map;
  }

  function getRecentOption(zone, entry){
    if (!entry) return null;
    return (
      findOptionByUrl(zone, entry.replayUrl || entry.url || '') ||
      findOptionByName(zone, entry.title || entry.game || entry.gameId || '')
    );
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
    const todayDone = { hygiene:false, nutrition:false, fitness:false };
    const today = new Date();
    const dayKey = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-');

    history.forEach((item) => {
      const zone = item.zone || zoneFromGameId(item.game || item.gameId || item.title || '');
      const stamp = String(item.timestampIso || item.time || item.date || '');
      if (zone && stamp.startsWith(dayKey)) todayDone[zone] = true;
    });

    const missions = [
      { icon:'🫧', name:'เล่น Hygiene 1 เกม', sub:'ล้างมือ แปรงฟัน หรือกันเชื้อโรค', done:todayDone.hygiene },
      { icon:'🥗', name:'เล่น Nutrition 1 เกม', sub:'เรียนรู้การกินอาหารที่ดี', done:todayDone.nutrition },
      { icon:'🏃', name:'เล่น Fitness 1 เกม', sub:'ขยับร่างกายให้แข็งแรง', done:todayDone.fitness }
    ];

    missionList.innerHTML = missions.map((m) => `
      <div class="mission ${m.done ? 'done' : ''}">
        <div class="mission-icon" aria-hidden="true">${m.icon}</div>
        <div class="mission-text">
          <p class="mission-name">${escapeHtml(m.name)}</p>
          <p class="mission-sub">${escapeHtml(m.sub)}</p>
        </div>
        <div class="mission-check" aria-label="${m.done ? 'สำเร็จ' : 'ยังไม่สำเร็จ'}">${m.done ? '✓' : '•'}</div>
      </div>
    `).join('');
  }

  function renderLastSummary(lastSummary){
    const box = $('#summaryBox');
    if (!lastSummary) {
      box.innerHTML = `<div class="empty">ยังไม่มีผลการเล่นล่าสุด<br />ลองกด <b>เล่นเลย</b> ที่โซนที่ชอบ แล้วกลับมาดูสรุปตรงนี้ได้เลย</div>`;
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
          <div class="score-pill"><span class="n">${score}</span><span class="t">Score</span></div>
          <div class="score-pill"><span class="n">${starText(stars)}</span><span class="t">Stars</span></div>
          <div class="score-pill"><span class="n">${coins}</span><span class="t">Coins</span></div>
        </div>
        <p class="last-meta">${escapeHtml(note)}</p>
        <a id="btnContinueLast" class="btn primary" href="${escapeHtml(carryQuery(replayUrl, { zone }))}">▶️ เล่นต่อ</a>
      </div>
    `;
  }

  function renderZoneMeta(recentMap){
    const config = [
      { zone:'hygiene', featured:'#hygFeatured', recentPill:'#hygRecentPill', recentText:'#hygRecentText', zoneCard:'#zoneCard-hygiene', button:'#btnZoneHygiene' },
      { zone:'nutrition', featured:'#nutriFeatured', recentPill:'#nutriRecentPill', recentText:'#nutriRecentText', zoneCard:'#zoneCard-nutrition', button:'#btnZoneNutrition' },
      { zone:'fitness', featured:'#fitFeatured', recentPill:'#fitRecentPill', recentText:'#fitRecentText', zoneCard:'#zoneCard-fitness', button:'#btnZoneFitness' }
    ];

    config.forEach((item) => {
      const featured = $(item.featured);
      const recentPill = $(item.recentPill);
      const recentText = $(item.recentText);
      const button = $(item.button);
      const set = GAMES[item.zone];
      const def = getDefaultOption(item.zone);
      const recent = getRecentOption(item.zone, recentMap[item.zone]);

      if (featured && def) featured.textContent = def.label;
      if (button && set) button.textContent = `ดูเกมในโซน (${set.options.length})`;
      if (recentPill && recentText) {
        if (recent) {
          recentPill.hidden = false;
          recentText.textContent = recent.label;
        } else {
          recentPill.hidden = true;
        }
      }
    });

    const activeZone = qs.get('zone');
    if (activeZone && GAMES[activeZone]) {
      document.querySelectorAll('[data-zone-card]').forEach((el) => el.classList.remove('is-active'));
      const card = $(`#zoneCard-${activeZone}`);
      if (card) card.classList.add('is-active');
    }
  }

  function renderHeroQuickline(recentMap){
    const el = $('#heroQuickline');
    if (!el) return;
    const zone = qs.get('zone');
    const option = zone && recentMap[zone] ? getRecentOption(zone, recentMap[zone]) : null;
    if (zone && option) {
      el.textContent = `กลับมาจาก ${option.label} แล้ว ไปต่อเกมอื่นได้เลย!`;
      return;
    }
    const completed = Object.values(recentMap).filter(Boolean).length;
    el.textContent = completed >= 3 ? 'เก่งมาก! เคยเล่นครบทั้ง 3 โซนแล้ว' : 'วันนี้ลองเล่นให้ครบ 3 โซนกันนะ';
  }

  function thumbHtml(option){
    return `<span class="game-thumb ${optionClass(option)}" aria-hidden="true"><span>${escapeHtml(option.icon || '🎮')}</span></span>`;
  }

  function renderLibraryBox(recentMap){
    const box = $('#libraryBox');
    if (!box) return;

    box.innerHTML = Object.entries(GAMES).map(([zone, set]) => {
      const def = getDefaultOption(zone);
      const recentEntry = recentMap[zone];
      const recent = getRecentOption(zone, recentEntry);

      const gamesHtml = set.options.map((option) => `
        <div class="library-game">
          ${thumbHtml(option)}
          <div class="library-game-info">
            <div class="library-game-name">${escapeHtml(option.label)}</div>
            <div class="library-game-sub">${escapeHtml(option.sub)}</div>
          </div>
        </div>
      `).join('');

      return `
        <div class="library-card">
          <div class="library-top">
            <div class="library-name">${escapeHtml(set.label)}</div>
            <div class="library-count">${set.options.length} เกม</div>
          </div>
          <div class="library-games">${gamesHtml}</div>
          <div class="library-actions">
            <a class="btn secondary small" href="${escapeHtml(carryQuery(def.url, { zone }))}">🎮 เล่นแนะนำ</a>
            ${recent ? `<a class="btn secondary small" href="${escapeHtml(carryQuery(recent.url, { zone }))}">🕹️ เล่นล่าสุด</a>` : `<div class="library-empty">ยังไม่มีเกมล่าสุด</div>`}
          </div>
        </div>
      `;
    }).join('');
  }

  function toast(msg){
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  function bindTopButtons(profile){
    $('#btnSettings').addEventListener('click', () => toast('หน้าตั้งค่าจะเพิ่มต่อได้ภายหลัง'));
    $('#btnRewards').addEventListener('click', () => toast(`ตอนนี้มี ${profile.coins} เหรียญ และ ${profile.stars} ดาว`));
  }

  function openPicker(zone, recentMap){
    const picker = $('#gamePicker');
    const title = $('#pickerTitle');
    const sub = $('#pickerSub');
    const list = $('#pickerList');
    const data = GAMES[zone];
    if (!picker || !data) return;

    const recent = getRecentOption(zone, recentMap[zone]);
    title.textContent = data.label;
    sub.textContent = `เลือกเกมใน ${data.label} ได้เลย`;
    list.innerHTML = data.options.map((item) => {
      const isFeatured = item.url === data.defaultUrl;
      const isRecent = recent && recent.url === item.url;
      return `
        <button class="picker-item ${optionClass(item)}" type="button" data-url="${escapeHtml(item.url)}" data-zone="${escapeHtml(zone)}">
          <span class="picker-item-shell">
            ${thumbHtml(item)}
            <span class="picker-main">
              <span class="picker-item-top">
                <span class="name">${escapeHtml(item.label)}</span>
              </span>
              <span class="sub">${escapeHtml(item.sub)}</span>
              <span class="picker-badges">
                ${isFeatured ? '<span class="picker-badge">แนะนำ</span>' : ''}
                ${isRecent ? '<span class="picker-badge recent">ล่าสุด</span>' : ''}
              </span>
            </span>
          </span>
        </button>
      `;
    }).join('');

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
    document.querySelectorAll('[data-close-picker]').forEach((el) => el.addEventListener('click', closePicker));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePicker(); });
  }

  function bindZoneLinks(recentMap){
    $('#btnPlayHygiene').href = carryQuery(GAMES.hygiene.defaultUrl, { zone: 'hygiene' });
    $('#btnPlayNutrition').href = carryQuery(GAMES.nutrition.defaultUrl, { zone: 'nutrition' });
    $('#btnPlayFitness').href = carryQuery(GAMES.fitness.defaultUrl, { zone: 'fitness' });
    $('#btnZoneHygiene').addEventListener('click', () => openPicker('hygiene', recentMap));
    $('#btnZoneNutrition').addEventListener('click', () => openPicker('nutrition', recentMap));
    $('#btnZoneFitness').addEventListener('click', () => openPicker('fitness', recentMap));
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
      try{ localStorage.setItem(STORAGE_KEYS.lastSummary, JSON.stringify(patchedSummary)); }catch{}
    }
    writeProfile(next);
    return next;
  }

  function boot(){
    let profile = readProfile();
    const lastSummary = readLastSummary();
    const history = readSummaryHistory();
    const recentMap = getRecentByZone(history, lastSummary);

    profile = mergeSummaryIntoProfile(profile, lastSummary);

    renderPlayer(profile);
    renderZoneStats(zoneStatsFromHistory(history));
    renderMissions(history);
    renderLastSummary(lastSummary);
    renderZoneMeta(recentMap);
    renderHeroQuickline(recentMap);
    renderLibraryBox(recentMap);
    bindZoneLinks(recentMap);
    bindTopButtons(profile);
    bindPicker();
  }

  boot();
})();