// === fitness/shadow-breaker/main-shadow.js (2025-11-25 — clamp target inside playfield) ===
'use strict';

// ---------- Utils ----------
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

// อ่านค่าจาก query string หรือ data-attribute
function getGameConfig() {
  const url = new URL(location.href);
  const diff = url.searchParams.get('diff')
    || document.body.dataset.diff
    || 'normal';

  const time = parseInt(
    url.searchParams.get('time')
    || document.body.dataset.time
    || '60',
    10
  );

  return { diff, time };
}

// ---------- Config ความยาก / บอส ----------
const DIFF_TABLE = {
  easy: {
    playerHP: 120,
    bossHP: 160,
    spawnInterval: 1200,
    minInterval: 650,
    sizeBase: 140,
    sizeJitter: 24,
  },
  normal: {
    playerHP: 100,
    bossHP: 200,
    spawnInterval: 1000,
    minInterval: 520,
    sizeBase: 120,
    sizeJitter: 20,
  },
  hard: {
    playerHP: 80,
    bossHP: 260,
    spawnInterval: 850,
    minInterval: 420,
    sizeBase: 105,
    sizeJitter: 18,
  },
};

const BOSSES = [
  {
    id: 'bubble',
    name: 'Bubble Glove',
    desc: 'โฟมตีเป้าฟองใหญ่ ๆ แล้วตีให้ทัน',
    theme: 'sb-theme-bubble',
    emoji: '🫧',
  },
  {
    id: 'meteor',
    name: 'Meteor Punch',
    desc: 'เป้าหินอุกกาบาตตกเร็ว ต้องไวเป็นพิเศษ',
    theme: 'sb-theme-meteor',
    emoji: '☄️',
  },
  {
    id: 'thunder',
    name: 'Thunder Fist',
    desc: 'เป้าสายฟ้า แวบมาแวบไป ช้าไม่ได้',
    theme: 'sb-theme-thunder',
    emoji: '⚡',
  },
  {
    id: 'shadow',
    name: 'Shadow King',
    desc: 'บอสเงา หลบเก่ง โผล่มั่วทั้งจอ',
    theme: 'sb-theme-shadow',
    emoji: '🕶️',
  },
];

// ---------- State หลัก ----------
const state = {
  started: false,
  timeLeft: 60,
  timerId: null,
  spawnId: null,

  diffKey: 'normal',
  cfg: DIFF_TABLE.normal,

  playerHP: 100,
  bossHP: 200,

  score: 0,
  combo: 0,
  maxCombo: 0,

  phase: 1,
  bossIndex: 0,

  arena: null,
};

// ---------- DOM refs ----------
const dom = {
  wrap:     $('#sb-wrap'),
  time:     $('#sb-time'),
  score:    $('#sb-score'),
  combo:    $('#sb-combo'),
  phase:    $('#sb-phase'),
  playerBar: $('#sb-player-hp-fill'),
  bossBar:   $('#sb-boss-hp-fill'),
  bossName:  $('#sb-boss-name'),
  bossDesc:  $('#sb-boss-desc'),
  bossPortrait: $('#sb-boss-portrait'),
  arena:    $('#sb-playfield') || $('.sb-playfield') || $('[data-role="playfield"]'),
  flash:    $('#sb-flash'),
};

// ---------- Init ----------
function initGame() {
  const cfg0 = getGameConfig();
  state.diffKey = (cfg0.diff in DIFF_TABLE) ? cfg0.diff : 'normal';
  state.cfg = DIFF_TABLE[state.diffKey];
  state.timeLeft = cfg0.time;

  state.playerHP = state.cfg.playerHP;
  state.bossHP = state.cfg.bossHP;
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.phase = 1;
  state.bossIndex = 0;

  state.arena = dom.arena;

  if (!state.arena) {
    console.warn('Shadow Breaker: playfield not found');
  }

  updateHUDTime();
  updateHUDScore();
  updateHUDCombo();
  updateHPBars();
  updatePhase();
  applyBossTheme();

  bindEvents();
}

// ---------- HUD ----------
function updateHUDTime() {
  if (dom.time) dom.time.textContent = state.timeLeft.toFixed(1);
}

function updateHUDScore() {
  if (dom.score) dom.score.textContent = state.score.toString();
}

function updateHUDCombo() {
  if (dom.combo) dom.combo.textContent = state.combo.toString();
}

function updateHPBars() {
  const playerPct = clamp(state.playerHP / state.cfg.playerHP, 0, 1);
  const bossPct   = clamp(state.bossHP   / state.cfg.bossHP,   0, 1);

  if (dom.playerBar) dom.playerBar.style.setProperty('--hp', playerPct);
  if (dom.bossBar)   dom.bossBar.style.setProperty('--hp', bossPct);

  // เขย่ารูปบอสตอนใกล้ตาย
  if (dom.bossPortrait) {
    if (bossPct <= 0.25) dom.bossPortrait.classList.add('sb-boss--panic');
    else dom.bossPortrait.classList.remove('sb-boss--panic');
  }
}

function updatePhase() {
  // phase 1–3 แบ่งตาม % HP ของบอส
  const pct = state.bossHP / state.cfg.bossHP;
  let p = 1;
  if (pct <= 0.66 && pct > 0.33) p = 2;
  else if (pct <= 0.33) p = 3;
  state.phase = p;

  if (dom.phase) dom.phase.textContent = p.toString();
}

function applyBossTheme() {
  const boss = BOSSES[state.bossIndex % BOSSES.length];

  if (dom.wrap) {
    dom.wrap.classList.remove(
      'sb-theme-bubble',
      'sb-theme-meteor',
      'sb-theme-thunder',
      'sb-theme-shadow'
    );
    if (boss.theme) dom.wrap.classList.add(boss.theme);
  }

  if (dom.bossName) dom.bossName.textContent = boss.name;
  if (dom.bossDesc) dom.bossDesc.textContent = boss.desc;
  if (dom.bossPortrait) dom.bossPortrait.textContent = boss.emoji || '👊';
}

// ---------- Spawn เป้า (จุดสำคัญ: clamp ให้อยู่ในกรอบ) ----------
function getArenaRect() {
  if (!state.arena) return null;

  // ใช้ clientWidth/Height เพราะเราใช้ position: relative + absolute ข้างใน
  return {
    width:  state.arena.clientWidth,
    height: state.arena.clientHeight,
  };
}

function spawnTarget(kind = 'bubble') {
  const rect = getArenaRect();
  if (!rect || !state.arena) return;

  const cfg = state.cfg;

  // ขนาดเป้าตามระดับความยาก + random นิดหน่อย
  const base = cfg.sizeBase;
  const jitter = cfg.sizeJitter;
  const size = base + (Math.random() * 2 - 1) * jitter; // base ± jitter
  const radius = size / 2;
  const margin = radius + 8; // กัน glow / stroke หลุดขอบ

  const maxX = rect.width  - margin;
  const maxY = rect.height - margin;

  const x = clamp(
    margin + Math.random() * (rect.width - margin * 2),
    margin,
    maxX
  );
  const y = clamp(
    margin + Math.random() * (rect.height - margin * 2),
    margin,
    maxY
  );

  const el = document.createElement('button');
  el.className = 'sb-target sb-target--' + kind;
  el.type = 'button';
  el.style.width = size + 'px';
  el.style.height = size + 'px';
  el.style.left = x + 'px';
  el.style.top  = y + 'px';

  el.addEventListener('click', () => {
    hitTarget(el);
  });

  state.arena.appendChild(el);
}

function clearTargets() {
  if (!state.arena) return;
  state.arena.querySelectorAll('.sb-target').forEach(el => el.remove());
}

// ---------- Logic ตีเป้า ----------
function hitTarget(el) {
  // ลบเป้า
  el.remove();

  state.score += 50;
  state.combo += 1;
  if (state.combo > state.maxCombo) state.maxCombo = state.combo;

  // ลด HP บอส
  const dmg = state.diffKey === 'easy' ? 5
            : state.diffKey === 'hard' ? 9
            : 7;
  state.bossHP = Math.max(0, state.bossHP - dmg);

  // เอฟเฟกต์ pop คะแนนเล็ก ๆ บนเป้า
  spawnHitPopup(el);

  updateHUDScore();
  updateHUDCombo();
  updateHPBars();
  updatePhase();

  if (state.bossHP <= 0) {
    nextBossOrWin();
  }
}

function missTick() {
  // ใช้ตอนปล่อยให้เป้าค้าง / เวลาเดิน ฯลฯ (ถ้าต้องการ)
  state.combo = 0;
  updateHUDCombo();

  const dmg = state.diffKey === 'easy' ? 3
            : state.diffKey === 'hard' ? 7
            : 5;
  state.playerHP = Math.max(0, state.playerHP - dmg);
  flashDamage();
  updateHPBars();

  if (state.playerHP <= 0) {
    endGame(false);
  }
}

// popup คะแนน
function spawnHitPopup(el) {
  const host = state.arena || document.body;
  const rectHost = host.getBoundingClientRect();
  const rect = el.getBoundingClientRect();

  const span = document.createElement('div');
  span.className = 'sb-pop';
  span.textContent = '+50';

  const cx = rect.left + rect.width / 2 - rectHost.left;
  const cy = rect.top  + rect.height / 2 - rectHost.top;

  span.style.left = cx + 'px';
  span.style.top  = cy + 'px';

  host.appendChild(span);
  setTimeout(() => span.remove(), 600);
}

function flashDamage() {
  if (!dom.flash) return;
  dom.flash.classList.add('sb-flash--active');
  setTimeout(() => dom.flash && dom.flash.classList.remove('sb-flash--active'), 120);
}

// ---------- วนเกม ----------
function startGame() {
  if (state.started) return;
  state.started = true;

  // เคลียร์เป้าเก่า
  clearTargets();

  // timer
  const step = 0.1;
  state.timerId = setInterval(() => {
    state.timeLeft -= step;
    if (state.timeLeft < 0) state.timeLeft = 0;
    updateHUDTime();

    if (state.timeLeft <= 0) {
      endGame(state.bossHP <= 0);
    }
  }, step * 1000);

  scheduleSpawn();
}

function stopLoop() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.spawnId) {
    clearTimeout(state.spawnId);
    state.spawnId = null;
  }
}

function scheduleSpawn() {
  if (!state.started) return;

  const cfg = state.cfg;
  const hpPct = state.bossHP / cfg.bossHP;

  // ยิ่ง HP น้อย interval ยิ่งสั้น (spawn เร็วขึ้น)
  const tMin = cfg.minInterval;
  const tMax = cfg.spawnInterval;
  const t = tMin + (tMax - tMin) * hpPct; // ระหว่าง min–max ตาม %HP

  state.spawnId = setTimeout(() => {
    if (!state.started) return;
    spawnTarget('bubble');
    scheduleSpawn();
  }, t);
}

function nextBossOrWin() {
  clearTargets();
  stopLoop();

  state.bossIndex += 1;
  if (state.bossIndex >= BOSSES.length) {
    endGame(true);
    return;
  }

  // reset boss ใหม่ (player HP คงเดิม)
  state.bossHP = state.cfg.bossHP;
  updateHPBars();
  updatePhase();
  applyBossTheme();

  // เริ่ม spawn ใหม่ แต่ใช้เวลา/HP ที่เหลือเดิม
  scheduleSpawn();
}

// ---------- จบเกม ----------
function endGame(win) {
  state.started = false;
  stopLoop();
  clearTargets();

  // TODO: แสดงหน้าสรุปผล / ส่งข้อมูลไป logger ถ้ามี
  console.log('Game end. win =', win, 'score =', state.score, 'maxCombo =', state.maxCombo);
}

// ---------- Events ----------
function bindEvents() {
  const btnStart = $('#sb-btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', () => {
      startGame();
    });
  }

  // ปุ่ม debug: ให้แตะพื้นที่ว่างเป็น miss ได้ (ถ้าต้องการ)
  if (state.arena) {
    state.arena.addEventListener('click', (ev) => {
      if (ev.target === state.arena) {
        missTick();
      }
    });
  }
}

// ---------- Boot ----------
window.addEventListener('load', () => {
  try {
    initGame();
    console.log('Shadow Breaker init OK');
  } catch (err) {
    console.error('Shadow Breaker init error', err);
  }
});