// === /herohealth/nutrition-zone.js ===
// PATCH v20260408-nutrition-zone-child-friendly
// child-friendly renderer for Nutrition Zone (Grade 5)

const $ = (sel, root = document) => root.querySelector(sel);

const qs = new URLSearchParams(location.search);

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

const ctx = {
  pid: cleanPid(first(qs.get('pid'), localStorage.getItem('HH_PID'), 'anon')),
  name: cleanName(first(qs.get('name'), qs.get('nickName'), localStorage.getItem('HH_NAME'), 'Hero')),
  run: cleanEnum(first(qs.get('run'), 'play'), ['play', 'learn', 'research', 'demo'], 'play'),
  diff: cleanEnum(first(qs.get('diff'), 'normal'), ['easy', 'normal', 'hard'], 'normal'),
  time: String(numIn(first(qs.get('time'), 90), 90, 60, 300)),
  view: cleanEnum(first(qs.get('view'), 'mobile'), ['mobile', 'pc', 'cvr'], 'mobile')
};

const NUTRITION_GAMES = [
  {
    key: 'plate',
    title: 'Plate',
    emoji: '🍽️',
    kicker: 'เริ่มง่าย',
    sub: 'ฝึกเลือกอาหารครบ 5 หมู่แบบเข้าใจง่าย',
    desc: 'เหมาะสำหรับเริ่มต้นในโซน Nutrition เลือกอาหารให้สมดุลและเข้าใจง่าย',
    tags: ['เริ่มง่าย', 'ครบ 5 หมู่', 'เหมาะเริ่มต้น'],
    featured: true,
    filters: ['all', 'easy'],
    accent: 'plate'
  },
  {
    key: 'goodjunk',
    title: 'GoodJunk',
    emoji: '🥦',
    kicker: 'สนุกท้าทาย',
    sub: 'แยกอาหารดีและอาหารที่ควรลดให้ทัน',
    desc: 'ฝึกตัดสินใจไว แยกของดีและของที่ควรกินให้น้อยลงแบบเกมแอ็กชัน',
    tags: ['ท้าทาย', 'เร็ว', 'ตัดสินใจไว'],
    featured: false,
    filters: ['all', 'fun', 'quick'],
    accent: 'goodjunk'
  },
  {
    key: 'groups',
    title: 'Groups',
    emoji: '🧺',
    kicker: 'ฝึกจำ',
    sub: 'จัดหมวดอาหารให้ถูกต้อง',
    desc: 'ช่วยให้จำว่าของกินแต่ละอย่างอยู่ในหมวดไหน และฝึกแยกประเภทได้ดีขึ้น',
    tags: ['ฝึกจำ', 'จัดหมวด', 'เรียนรู้'],
    featured: false,
    filters: ['all', 'easy'],
    accent: 'groups'
  },
  {
    key: 'hydration',
    title: 'Hydration',
    emoji: '💧',
    kicker: 'เล่นสั้น',
    sub: 'เรียนรู้เรื่องการดื่มน้ำและดูแลร่างกาย',
    desc: 'ฝึกนิสัยสุขภาพเรื่องน้ำดื่ม เข้าใจง่าย เล่นรอบสั้นได้',
    tags: ['เล่นสั้น', 'สุขภาพ', 'น้ำดื่ม'],
    featured: false,
    filters: ['all', 'quick'],
    accent: 'hydration'
  }
];

function gameCardHtml(game) {
  return `
    <article class="nutri-game-card ${game.accent}" data-game="${game.key}" data-id="${game.key}">
      <div class="nutri-game-top">
        <div class="nutri-game-icon" aria-hidden="true">${game.emoji}</div>
        <div class="nutri-game-copy">
          <div class="nutri-game-kicker">${game.kicker}</div>
          <h3 class="nutri-game-title">${game.title}</h3>
          <p class="nutri-game-sub">${game.sub}</p>
        </div>
      </div>

      <p class="nutri-game-desc">${game.desc}</p>

      <div class="nutri-game-tags">
        ${game.tags.map(tag => `<span class="nutri-tag">${tag}</span>`).join('')}
      </div>

      <div class="nutri-game-actions">
        <a class="nutri-play-btn" href="#" data-game="${game.key}" aria-label="เล่น ${game.title}">เล่นเลย</a>
      </div>
    </article>
  `;
}

function renderGamesGrid() {
  const gamesGrid = $('#gamesGrid');
  if (!gamesGrid) return;

  gamesGrid.innerHTML = NUTRITION_GAMES.map(gameCardHtml).join('');
}

function renderHeroBits() {
  const playerPill = $('#playerPill');
  const modePill = $('#modePill');
  const coachLine = $('#coachLine');

  if (playerPill) {
    playerPill.textContent = `👤 ฮีโร่: ${ctx.name}`;
  }

  if (modePill) {
    const modeLabel =
      ctx.run === 'learn' ? 'ฝึกเรียนรู้' :
      ctx.run === 'research' ? 'โหมดครู' :
      ctx.run === 'demo' ? 'สาธิต' :
      'เล่นสนุก';

    modePill.textContent = `🎮 ตอนนี้: ${modeLabel}`;
  }

  if (coachLine) {
    coachLine.textContent = 'ลองเริ่มจาก Plate ก่อน แล้วค่อยไปเกมที่ท้าทายขึ้นนะ';
  }
}

function renderStarterRecentPlaceholder() {
  const recentArea = $('#recentArea');
  if (!recentArea) return;

  if (recentArea.children.length > 0 && !recentArea.querySelector('.empty-recent')) return;

  recentArea.innerHTML = `
    <div class="recent-card recent-card--soft">
      <div class="recent-card-head">
        <div>
          <div class="recent-card-title">ยังไม่มีเกมล่าสุด</div>
          <div class="recent-card-sub">หนูสามารถเริ่มจาก Plate ได้เลย เล่นง่ายและเข้าใจง่าย</div>
        </div>
        <div class="recent-badge">เริ่มต้น</div>
      </div>

      <div class="recent-card-actions">
        <a class="top-btn primary recent-play-btn" href="#" data-game="plate" aria-label="เริ่ม Plate">▶️ เริ่มจาก Plate</a>
      </div>
    </div>
  `;
}

function bootNutritionZoneRenderer() {
  renderHeroBits();
  renderGamesGrid();
  renderStarterRecentPlaceholder();
}

document.addEventListener('DOMContentLoaded', bootNutritionZoneRenderer);