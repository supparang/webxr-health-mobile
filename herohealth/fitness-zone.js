const HUB_URL_DEFAULT = './hub-v2.html';
const LAST_ZONE_KEY = 'HHA_LAST_ZONE';
const LAST_PICK_KEY = 'HHA_FITNESS_LAST_PICK';
const LAST_SUMMARY_KEY = 'HHA_LAST_SUMMARY';
const LAST_SUMMARY_FP_KEY = 'HHA_LAST_SUMMARY_FITNESS_PLANNER';
const LAST_SUMMARY_FPW_KEY = 'HHA_LAST_SUMMARY_FITNESS_PLANNER_WEEKLY';

const $ = (sel, root = document) => root.querySelector(sel);

function safeJsonParse(raw, fallback = null) {
  try { return raw ? JSON.parse(raw) : fallback; }
  catch (_) { return fallback; }
}

function readJson(key, fallback = null) {
  try { return safeJsonParse(localStorage.getItem(key), fallback); }
  catch (_) { return fallback; }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function qsGet(k, d = '') {
  try {
    return new URL(location.href).searchParams.get(k) || d;
  } catch (_) {
    return d;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function injectZoneStyles() {
  if (document.getElementById('fitnessZonePatchStyles')) return;

  const style = document.createElement('style');
  style.id = 'fitnessZonePatchStyles';
  style.textContent = `
    .games-grid{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:16px;
    }

    .fz-game-card{
      border-radius:24px;
      border:3px solid #d7edf7;
      background:linear-gradient(180deg,#fffef8,#ffffff);
      box-shadow:0 18px 36px rgba(86,155,194,.12);
      padding:16px;
      display:grid;
      gap:12px;
    }

    .fz-game-head{
      display:grid;
      grid-template-columns:auto 1fr;
      gap:14px;
      align-items:center;
    }

    .fz-game-icon{
      width:64px;
      height:64px;
      border-radius:20px;
      display:grid;
      place-items:center;
      font-size:32px;
      background:linear-gradient(135deg,#7fcfff,#ffd45c);
      border:2px solid #d7edf7;
      box-shadow:inset 0 2px 0 rgba(255,255,255,.72);
    }

    .fz-game-kicker{
      font-size:12px;
      font-weight:1000;
      letter-spacing:.08em;
      color:#5ea8d0;
    }

    .fz-game-title{
      margin:2px 0 0;
      font-size:24px;
      line-height:1.06;
      font-weight:1000;
      color:#4d4a42;
    }

    .fz-game-desc{
      margin:6px 0 0;
      font-size:13px;
      line-height:1.55;
      color:#7b7a72;
      font-weight:1000;
    }

    .fz-tags{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .fz-tag{
      min-height:30px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      background:#fff;
      border:2px solid #d7edf7;
      color:#5d6e7a;
      font-size:12px;
      font-weight:1000;
    }

    .fz-actions{
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:10px;
    }

    .fz-actions.fz-actions-4{
      grid-template-columns:repeat(4,minmax(0,1fr));
    }

    .fz-btn{
      appearance:none;
      border:none;
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      min-height:44px;
      padding:10px 12px;
      border-radius:16px;
      font-size:13px;
      font-weight:1000;
      cursor:pointer;
    }

    .fz-btn.play{
      background:linear-gradient(180deg,#7ed957,#58c33f);
      color:#173b0b;
    }

    .fz-btn.blue{
      background:linear-gradient(180deg,#7fcfff,#58b7f5);
      color:#11374a;
    }

    .fz-btn.soft{
      background:#fff;
      color:#6c6a61;
      border:2px solid #d7edf7;
    }

    .fz-note{
      font-size:12px;
      line-height:1.55;
      color:#7b7a72;
      font-weight:1000;
    }

    .recent-card{
      border-radius:22px;
      border:3px solid #d7edf7;
      background:linear-gradient(180deg,#fffef8,#ffffff);
      box-shadow:0 14px 30px rgba(86,155,194,.12);
      padding:14px;
      display:grid;
      gap:12px;
    }

    .recent-card-head{
      display:grid;
      grid-template-columns:auto 1fr;
      gap:12px;
      align-items:center;
    }

    .recent-card-icon{
      width:56px;
      height:56px;
      border-radius:18px;
      display:grid;
      place-items:center;
      font-size:28px;
      background:linear-gradient(135deg,#7fcfff,#ffd45c);
      border:2px solid #d7edf7;
    }

    .recent-card-title{
      font-size:22px;
      line-height:1.08;
      font-weight:1000;
      color:#4d4a42;
      margin:0;
    }

    .recent-card-sub{
      margin:4px 0 0;
      font-size:13px;
      line-height:1.5;
      color:#7b7a72;
      font-weight:1000;
    }

    .recent-card-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .recent-chip-row{
      display:flex;
      gap:8px;
      flex-wrap:wrap;
    }

    .recent-chip{
      min-height:30px;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      padding:6px 10px;
      border-radius:999px;
      background:#fff;
      border:2px solid #d7edf7;
      color:#5d6e7a;
      font-size:12px;
      font-weight:1000;
    }

    .empty-recent{
      border-radius:18px;
      border:2px dashed #d7edf7;
      background:#fff;
      padding:16px;
      color:#7b7a72;
      font-size:13px;
      font-weight:1000;
    }

    @media (max-width: 900px){
      .games-grid{
        grid-template-columns:1fr;
      }
      .fz-actions.fz-actions-4{
        grid-template-columns:repeat(2,minmax(0,1fr));
      }
    }

    @media (max-width: 640px){
      .fz-actions,
      .fz-actions.fz-actions-4{
        grid-template-columns:1fr;
      }
      .fz-game-title{
        font-size:22px;
      }
    }
  `;
  document.head.appendChild(style);
}

const state = {
  pid: qsGet('pid', 'anon'),
  name: qsGet('name', qsGet('nickName', 'Hero')),
  run: qsGet('run', 'play'),
  diff: qsGet('diff', 'normal'),
  view: qsGet('view', 'mobile'),
  time: qsGet('time', '90'),
  studyId: qsGet('studyId', ''),
  api: qsGet('api', ''),
  log: qsGet('log', ''),
  debug: qsGet('debug', ''),
  hub: qsGet('hub', HUB_URL_DEFAULT),
  search: '',
  games: []
};

function setLastZone(zone) {
  try { localStorage.setItem(LAST_ZONE_KEY, zone); } catch (_) {}
}

function buildCommonParams() {
  const params = new URLSearchParams();
  params.set('pid', state.pid);
  params.set('name', state.name);
  params.set('run', state.run);
  params.set('diff', state.diff);
  params.set('view', state.view);
  params.set('time', state.time);
  params.set('hub', location.href);
  params.set('seed', String(Date.now()));
  params.set('zone', 'fitness');
  params.set('cat', 'fitness');

  if (state.studyId) params.set('studyId', state.studyId);
  if (state.api) params.set('api', state.api);
  if (state.log) params.set('log', state.log);
  if (state.debug) params.set('debug', state.debug);

  return params;
}

function buildActionGameUrl(def) {
  const url = new URL(def.path, location.href);
  const params = buildCommonParams();

  params.set('game', def.id);
  params.set('gameId', def.id);
  params.set('theme', def.id);

  url.search = params.toString();
  return url.toString();
}

function buildPlannerUrl(mode) {
  let base = './fitness-planner.html';
  if (mode === 'quick' || mode === 'class') base = './fitness-planner/index.html';
  if (mode === 'weekly') base = './fitness-planner/weekly.html';

  const url = new URL(base, location.href);
  const params = buildCommonParams();

  params.set('game', 'fitnessplanner');
  params.set('gameId', 'fitnessplanner');
  params.set('theme', 'fitnessplanner');

  if (mode === 'quick' || mode === 'class' || mode === 'weekly') {
    params.set('mode', mode);
  }

  url.search = params.toString();
  return url.toString();
}

function rememberLastPick(pick) {
  writeJson(LAST_PICK_KEY, {
    ...pick,
    ts_iso: nowIso(),
    pid: state.pid,
    run: state.run,
    diff: state.diff,
    view: state.view,
    time: state.time,
    zone: 'fitness'
  });
  setLastZone('fitness');
}

function getPlannerRecentSummary() {
  const weekly = readJson(LAST_SUMMARY_FPW_KEY, null);
  if (weekly && weekly.zone === 'fitness') return weekly;

  const planner = readJson(LAST_SUMMARY_FP_KEY, null);
  if (planner && planner.zone === 'fitness') return planner;

  const generic = readJson(LAST_SUMMARY_KEY, null);
  if (generic && generic.zone === 'fitness' && /fitnessplanner/.test(String(generic.game || ''))) return generic;

  return null;
}

function normalizeRecent() {
  const plannerSummary = getPlannerRecentSummary();
  if (plannerSummary) {
    const weekly = plannerSummary.game === 'fitnessplanner_weekly' || plannerSummary.mode === 'weekly';
    const mode = weekly ? 'weekly' : (plannerSummary.mode === 'quick' ? 'quick' : 'class');
    return {
      source: 'summary',
      id: weekly ? 'fitnessplanner_weekly' : 'fitnessplanner',
      title: weekly ? 'Fitness Planner • Weekly' : `Fitness Planner • ${mode === 'quick' ? 'Quick' : 'Class'}`,
      subtitle: `คะแนนล่าสุด ${plannerSummary.scores?.overall ?? '-'} • ${plannerSummary.badge || 'Planner'}`,
      emoji: '🗓️',
      url: buildPlannerUrl(mode),
      chips: [
        `Mode: ${mode}`,
        `Score: ${plannerSummary.scores?.overall ?? '-'}`,
        `Badge: ${plannerSummary.badge || '-'}`
      ]
    };
  }

  const pick = readJson(LAST_PICK_KEY, null);
  if (pick && pick.zone === 'fitness') {
    return {
      source: 'pick',
      id: pick.id,
      title: pick.title,
      subtitle: pick.subtitle || 'เปิดเล่นต่อจากเกมล่าสุด',
      emoji: pick.emoji || '🏃',
      url: pick.url,
      chips: [
        `Run: ${pick.run || state.run}`,
        `Time: ${pick.time || state.time}`,
        `Diff: ${pick.diff || state.diff}`
      ]
    };
  }

  return null;
}

function setCoachLine(text) {
  const el = $('#coachLine');
  if (el) el.textContent = text;
}

function buildGameDefs() {
  return [
    {
      id: 'shadowbreaker',
      title: 'Shadow Breaker',
      emoji: '⚡',
      kicker: 'FITNESS ACTION',
      desc: 'ตีเป้า หลบจังหวะ และออกแรงแบบสนุกเร้าใจ',
      tags: ['action', 'coordination', 'focus'],
      path: './shadow-breaker-vr.html',
      featured: false
    },
    {
      id: 'rhythmboxer',
      title: 'Rhythm Boxer',
      emoji: '🥊',
      kicker: 'FITNESS ACTION',
      desc: 'ต่อยตามจังหวะ ฝึกความแม่น ความเร็ว และจังหวะร่างกาย',
      tags: ['rhythm', 'boxing', 'cardio'],
      path: './rhythm-boxer-vr.html',
      featured: false
    },
    {
      id: 'jumpduck',
      title: 'Jump Duck',
      emoji: '🦘',
      kicker: 'FITNESS ACTION',
      desc: 'กระโดด หลบ และเคลื่อนไหวให้ไวแบบสนุกมาก',
      tags: ['jump', 'duck', 'agility'],
      path: './jump-duck-vr.html',
      featured: true
    },
    {
      id: 'balancehold',
      title: 'Balance Hold',
      emoji: '🧍',
      kicker: 'FITNESS ACTION',
      desc: 'ฝึกทรงตัว คุมท่าทาง และนิ่งอย่างมีสมาธิ',
      tags: ['balance', 'control', 'stability'],
      path: './balance-hold-vr.html',
      featured: false
    },
    {
      id: 'fitnessplanner',
      title: 'Fitness Planner',
      emoji: '🗓️',
      kicker: 'FITNESS PLANNER',
      desc: 'วางแผนการออกกำลังกายให้สนุก สมดุล และปลอดภัย',
      tags: ['planner', 'weekly', 'safety', 'balance'],
      planner: true,
      featured: false
    }
  ];
}

function passesSearch(def) {
  if (!state.search) return true;
  const q = state.search.trim().toLowerCase();
  const hay = [
    def.id,
    def.title,
    def.desc,
    def.kicker,
    ...(def.tags || [])
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

function renderRecentArea() {
  const area = $('#recentArea');
  const continueBtn = $('#continueBtn');
  const recent = normalizeRecent();

  if (!area) return;

  if (!recent) {
    area.innerHTML = `<div class="empty-recent">ยังไม่มีเกมล่าสุด กดเลือกเกมด้านล่างได้เลย</div>`;
    if (continueBtn) {
      continueBtn.disabled = false;
      continueBtn.textContent = 'เล่นล่าสุด';
      continueBtn.onclick = () => {
        const featured = state.games.find(g => g.featured) || state.games[0];
        if (!featured) return;
        const url = featured.planner ? buildPlannerUrl('class') : buildActionGameUrl(featured);
        rememberLastPick({
          id: featured.id,
          title: featured.title,
          subtitle: featured.desc,
          emoji: featured.emoji,
          url
        });
        location.href = url;
      };
    }
    setCoachLine('เลือกเกมออกกำลังกายที่อยากเล่น แล้วเริ่มได้เลย');
    return;
  }

  area.innerHTML = `
    <div class="recent-card">
      <div class="recent-card-head">
        <div class="recent-card-icon">${recent.emoji}</div>
        <div>
          <h3 class="recent-card-title">${recent.title}</h3>
          <p class="recent-card-sub">${recent.subtitle}</p>
        </div>
      </div>

      <div class="recent-chip-row">
        ${(recent.chips || []).map(c => `<span class="recent-chip">${c}</span>`).join('')}
      </div>

      <div class="recent-card-actions">
        <a class="fz-btn play" id="recentPlayBtn" href="${recent.url}">▶️ เล่นต่อ</a>
      </div>
    </div>
  `;

  const recentPlayBtn = $('#recentPlayBtn');
  if (recentPlayBtn) {
    recentPlayBtn.addEventListener('click', () => setLastZone('fitness'));
  }

  if (continueBtn) {
    continueBtn.disabled = false;
    continueBtn.textContent = 'เล่นล่าสุด';
    continueBtn.onclick = () => {
      setLastZone('fitness');
      location.href = recent.url;
    };
  }

  setCoachLine(`ล่าสุดหนูเล่น ${recent.title} อยู่ ลองเล่นต่อได้เลย`);
}

function renderGamesGrid() {
  const grid = $('#gamesGrid');
  if (!grid) return;

  const list = state.games.filter(passesSearch);

  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-recent">ไม่เจอเกมที่ตรงกับคำค้นหา ลองพิมพ์คำว่า jump, rhythm, balance หรือ planner</div>
    `;
    setCoachLine('ไม่เจอเกมตามคำค้นหา ลองพิมพ์คำที่สั้นลงอีกนิด');
    return;
  }

  grid.innerHTML = list.map(def => {
    if (def.planner) {
      const quickUrl = buildPlannerUrl('quick');
      const classUrl = buildPlannerUrl('class');
      const weeklyUrl = buildPlannerUrl('weekly');
      const launcherUrl = buildPlannerUrl('launcher');

      return `
        <article class="fz-game-card" data-game-id="${def.id}">
          <div class="fz-game-head">
            <div class="fz-game-icon">${def.emoji}</div>
            <div>
              <div class="fz-game-kicker">${def.kicker}</div>
              <div class="fz-game-title">${def.title}</div>
              <p class="fz-game-desc">${def.desc}</p>
            </div>
          </div>

          <div class="fz-tags">
            ${def.tags.map(tag => `<span class="fz-tag">${tag}</span>`).join('')}
          </div>

          <div class="fz-actions fz-actions-4">
            <a class="fz-btn blue" data-pick-id="${def.id}" data-pick-title="${def.title} • Quick" data-pick-emoji="${def.emoji}" href="${quickUrl}">⚡ Quick</a>
            <a class="fz-btn play" data-pick-id="${def.id}" data-pick-title="${def.title} • Class" data-pick-emoji="${def.emoji}" href="${classUrl}">🏫 Class</a>
            <a class="fz-btn soft" data-pick-id="${def.id}" data-pick-title="${def.title} • Weekly" data-pick-emoji="${def.emoji}" href="${weeklyUrl}">📅 Weekly</a>
            <a class="fz-btn soft" data-pick-id="${def.id}" data-pick-title="${def.title} • Launcher" data-pick-emoji="${def.emoji}" href="${launcherUrl}">🧭 Launcher</a>
          </div>

          <div class="fz-note">
            เกมนี้เหมาะใช้ก่อนหรือหลังเล่นเกมแอ็กชัน เพื่อฝึกคิดลำดับกิจกรรมให้ปลอดภัยและสมดุล
          </div>
        </article>
      `;
    }

    const url = buildActionGameUrl(def);
    return `
      <article class="fz-game-card" data-game-id="${def.id}">
        <div class="fz-game-head">
          <div class="fz-game-icon">${def.emoji}</div>
          <div>
            <div class="fz-game-kicker">${def.kicker}</div>
            <div class="fz-game-title">${def.title}</div>
            <p class="fz-game-desc">${def.desc}</p>
          </div>
        </div>

        <div class="fz-tags">
          ${def.tags.map(tag => `<span class="fz-tag">${tag}</span>`).join('')}
        </div>

        <div class="fz-actions">
          <a class="fz-btn play" data-pick-id="${def.id}" data-pick-title="${def.title}" data-pick-emoji="${def.emoji}" href="${url}">🎮 เล่นเลย</a>
          <button class="fz-btn soft" type="button" data-feature-info="${def.id}">ℹ️ ดูแนวเกม</button>
        </div>

        <div class="fz-note">
          ${def.featured ? 'เกมแนะนำของโซนนี้ เหมาะเริ่มเล่นก่อน' : 'เลือกเล่นได้ทันทีตามเวลาที่ตั้งไว้ด้านบน'}
        </div>
      </article>
    `;
  }).join('');

  grid.querySelectorAll('[data-pick-id]').forEach(el => {
    el.addEventListener('click', () => {
      const title = el.getAttribute('data-pick-title') || 'Fitness Game';
      const emoji = el.getAttribute('data-pick-emoji') || '🏃';
      rememberLastPick({
        id: el.getAttribute('data-pick-id') || 'fitness',
        title,
        subtitle: 'เปิดเล่นจาก Fitness Zone',
        emoji,
        url: el.href
      });
    });
  });

  grid.querySelectorAll('[data-feature-info]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-feature-info');
      const def = state.games.find(g => g.id === id);
      if (!def) return;
      setCoachLine(`${def.title}: ${def.desc}`);
    });
  });

  if (!state.search) {
    const featured = state.games.find(g => g.featured);
    if (featured) {
      setCoachLine(`เกมแนะนำตอนนี้คือ ${featured.title} — ${featured.desc}`);
    }
  }
}

function bindControls() {
  const modeSelect = $('#modeSelect');
  const timeSelect = $('#timeSelect');
  const searchInput = $('#searchInput');
  const hubBtn = $('#hubBtn');

  if (hubBtn) {
    hubBtn.href = state.hub || HUB_URL_DEFAULT;
  }

  if (modeSelect) {
    modeSelect.value = state.run;
    modeSelect.addEventListener('change', () => {
      state.run = modeSelect.value;
      const modePill = $('#modePill');
      if (modePill) modePill.textContent = '🎮 Mode: ' + state.run;
      renderGamesGrid();
      renderRecentArea();
    });
  }

  if (timeSelect) {
    timeSelect.value = state.time;
    timeSelect.addEventListener('change', () => {
      state.time = timeSelect.value;
      renderGamesGrid();
      renderRecentArea();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.search = searchInput.value.trim().toLowerCase();
      renderGamesGrid();
    });
  }
}

function boot() {
  injectZoneStyles();
  state.games = buildGameDefs();
  bindControls();
  renderRecentArea();
  renderGamesGrid();
}

boot();