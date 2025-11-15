// === Hero Health — game/main.js
// DOM Good vs Junk — Production v2 (Fruit Ninja style)
// - อ่าน mode/diff/time จาก URL
// - ความยากแบบ B: จำนวนเป้าพร้อมกัน / อายุเป้า / golden rate ต่างกัน
// - ภารกิจ: เก็บของดีให้ครบ N ชิ้น (golden นับ 2)
// - Progress bar + Result popup + Particle FX

'use strict';

// ---------- อ่านค่าจาก URL ----------
const url = new URL(window.location.href);
const MODE = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();

let timeParam = parseInt(url.searchParams.get('time'), 10);
if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
if (timeParam < 20) timeParam = 20;
if (timeParam > 180) timeParam = 180;

// ใช้ timeParam เป็นความยาวรอบเกม (วินาที)
const GAME_DURATION = timeParam;

// ---------- Config ตาม diff (แบบ Fruit Ninja) ----------
let SPAWN_INTERVAL = 700;
let ITEM_LIFETIME = 1400;
let MAX_ACTIVE = 4;
let GOLDEN_RATE = 0.04; // โอกาสเป็น golden จากของดี
let MISSION_GOOD_TARGET = 20; // จำนวนของดีที่ต้องเก็บให้ครบ

switch (DIFF) {
  case 'easy':
    SPAWN_INTERVAL = 900;
    ITEM_LIFETIME = 1800;
    MAX_ACTIVE = 3;
    GOLDEN_RATE = 0.02;
    MISSION_GOOD_TARGET = 12;
    break;
  case 'hard':
    SPAWN_INTERVAL = 480;
    ITEM_LIFETIME = 1000;
    MAX_ACTIVE = 6;
    GOLDEN_RATE = 0.06;
    MISSION_GOOD_TARGET = 28;
    break;
  case 'normal':
  default:
    SPAWN_INTERVAL = 650;
    ITEM_LIFETIME = 1400;
    MAX_ACTIVE = 4;
    GOLDEN_RATE = 0.04;
    MISSION_GOOD_TARGET = 20;
    break;
}

// ---------- กลุ่มอีโมจิ ----------
const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];

// ---------- State ----------
let score = 0;
let combo = 0;
let maxCombo = 0;
let timeLeft = GAME_DURATION;
let running = false;
let spawnTimer = null;
let tickTimer = null;

let missionGoodCount = 0;   // จำนวนของดีที่เก็บได้ (golden นับ 2)
let activeItems = 0;        // จำนวนเป้าบนจอปัจจุบัน

// ---------- Helpers ----------
function $(sel) { return document.querySelector(sel); }

function createHost() {
  let host = $('#hha-dom-host');
  if (host) return host;

  host = document.createElement('div');
  host.id = 'hha-dom-host';
  Object.assign(host.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9000'
  });
  document.body.appendChild(host);
  return host;
}

function createFXLayer() {
  let fx = $('#hha-fx-layer');
  if (fx) return fx;
  fx = document.createElement('div');
  fx.id = 'hha-fx-layer';
  Object.assign(fx.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9050',
    overflow: 'hidden'
  });
  document.body.appendChild(fx);
  return fx;
}

function ensureGameCSS() {
  if (document.getElementById('hha-game-css')) return;
  const st = document.createElement('style');
  st.id = 'hha-game-css';
  st.textContent = `
    @keyframes hha-float {
      0%   { transform: translate3d(0,0,0); }
      50%  { transform: translate3d(0,-10px,0); }
      100% { transform: translate3d(0,0,0); }
    }
  `;
  document.head.appendChild(st);
}

function createHUD() {
  let hud = $('#hha-hud');
  if (hud) return hud;

  hud = document.createElement('div');
  hud.id = 'hha-hud';
  hud.innerHTML = `
    <!-- กล่องคะแนน + mission -->
    <div style="
      position:fixed;top:16px;left:50%;transform:translateX(-50%);
      background:rgba(15,23,42,0.95);border-radius:16px;
      padding:10px 18px;display:flex;flex-direction:column;gap:6px;
      box-shadow:0 18px 40px rgba(0,0,0,0.65);
      border:1px solid rgba(51,65,85,0.9);z-index:9100;
      font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;font-size:14px;
      min-width:220px;
    ">
      <div style="display:flex;gap:18px;justify-content:space-between;">
        <div>
          <div>คะแนน</div>
          <div id="hha-score" style="text-align:right;font-weight:700;font-size:18px;">0</div>
        </div>
        <div>
          <div>คอมโบ</div>
          <div id="hha-combo" style="text-align:right;font-weight:700;font-size:18px;">0</div>
        </div>
      </div>
      <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">
        <div id="hha-mission-text">
          ภารกิจ: เก็บของดีให้ครบ ${MISSION_GOOD_TARGET} ชิ้น
          <span style="opacity:0.8">(ชิ้นทองนับ x2)</span>
        </div>
        <div style="width:100%;height:6px;border-radius:999px;background:rgba(15,23,42,0.9);overflow:hidden;border:1px solid rgba(148,163,184,0.7);">
          <div id="hha-mission-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#16a34a);"></div>
        </div>
      </div>
    </div>

    <!-- TIME + diff -->
    <div style="
      position:fixed;top:16px;right:16px;
      background:rgba(15,23,42,0.95);
      border-radius:999px;padding:6px 14px;
      border:1px solid rgba(148,163,184,0.9);
      font-size:13px;z-index:9100;
      font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
    ">
      ${MODE.toUpperCase()} • ${DIFF.toUpperCase()} • <span id="hha-time"></span>s
    </div>

    <!-- Result Panel -->
    <div id="hha-result" style="
      position:fixed;inset:0;display:none;
      align-items:center;justify-content:center;
      z-index:9200;
    ">
      <div style="
        background:rgba(15,23,42,0.97);border-radius:18px;
        padding:20px 26px;min-width:260px;
        border:1px solid rgba(34,197,94,0.8);
        text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.75);
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
      ">
        <h2 id="hha-result-title" style="margin-top:0;margin-bottom:8px;font-size:18px;">จบรอบแล้ว 🎉</h2>
        <div style="margin-bottom:4px;">คะแนนรวม: <b id="hha-final-score">0</b></div>
        <div style="margin-bottom:4px;">คอมโบสูงสุด: <b id="hha-final-combo">0</b></div>
        <div style="margin-bottom:14px;">ของดีที่เก็บได้: <b id="hha-final-good">0</b> / ${MISSION_GOOD_TARGET}</div>
        <button id="hha-restart" style="
          border-radius:999px;border:0;cursor:pointer;
          padding:8px 18px;background:linear-gradient(135deg,#38bdf8,#2563eb);
          color:#fff;font-weight:600;font-size:14px;
        ">เล่นอีกครั้ง</button>
      </div>
    </div>
  `;
  document.body.appendChild(hud);
  return hud;
}

function updateHUD() {
  const sEl = $('#hha-score');
  const cEl = $('#hha-combo');
  const tEl = $('#hha-time');
  const mBar = $('#hha-mission-bar');
  if (sEl) sEl.textContent = String(score);
  if (cEl) cEl.textContent = String(combo);
  if (tEl) tEl.textContent = String(timeLeft);

  if (mBar) {
    const ratio = Math.max(0, Math.min(1, missionGoodCount / MISSION_GOOD_TARGET));
    mBar.style.width = (ratio * 100).toFixed(1) + '%';
  }
}

// ---------- Particle FX ----------
function burstAt(x, y, type) {
  const fxLayer = createFXLayer();
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: x + 'px',
    top: y + 'px',
    width: '0',
    height: '0',
    pointerEvents: 'none',
    zIndex: '9060'
  });

  const shardCount = 10;
  const baseColorGood = 'rgba(34,197,94,';
  const baseColorBad  = 'rgba(239,68,68,';
  const baseColor = type === 'good' ? baseColorGood : baseColorBad;

  for (let i = 0; i < shardCount; i++) {
    const shard = document.createElement('div');
    const size = 6 + Math.random() * 6;
    Object.assign(shard.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: size + 'px',
      height: size + 'px',
      borderRadius: '999px',
      background: baseColor + (0.6 + Math.random() * 0.3) + ')',
      transform: 'translate3d(0,0,0) scale(0.6)',
      opacity: '1',
      transition: 'transform 260ms ease-out, opacity 260ms ease-out'
    });
    container.appendChild(shard);

    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 40;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    requestAnimationFrame(() => {
      shard.style.transform = `translate3d(${dx}px,${dy}px,0) scale(1.1)`;
      shard.style.opacity = '0';
    });
  }

  fxLayer.appendChild(container);
  setTimeout(() => {
    if (container.parentNode) container.parentNode.removeChild(container);
  }, 320);
}

// ---------- Spawn logic ----------
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnOne(host) {
  if (!running) return;
  if (activeItems >= MAX_ACTIVE) return; // จำกัดจำนวนเป้าพร้อมกัน

  const isGood = Math.random() < 0.6; // 60% ของดีโดยรวม
  const isGolden = isGood && Math.random() < GOLDEN_RATE;

  const emo = isGood ? randomFrom(GOOD) : randomFrom(JUNK);

  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = emo;
  item.setAttribute('data-good', isGood ? '1' : '0');
  item.setAttribute('data-golden', isGolden ? '1' : '0');

  const baseSize = Math.min(window.innerWidth, window.innerHeight);
  const size = baseSize < 700 ? 72 : 80;

  const baseStyle = {
    position: 'absolute',
    width: size + 'px',
    height: size + 'px',
    borderRadius: '999px',
    border: '0',
    fontSize: (size * 0.52) + 'px',
    boxShadow: '0 8px 22px rgba(15,23,42,0.85)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.12s ease, opacity 0.12s ease',
    pointerEvents: 'auto',
    animation: 'hha-float 1.3s ease-in-out infinite'
  };

  Object.assign(item.style, baseStyle);

  if (isGolden) {
    // ของดีทอง → เรืองแสง
    item.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #f97316)';
    item.style.boxShadow = '0 0 25px rgba(250,204,21,0.9)';
  } else {
    item.style.background = 'rgba(15,23,42,0.96)';
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = 0.1 * vw + Math.random() * 0.8 * vw;
  const y = 0.18 * vh + Math.random() * 0.7 * vh;
  item.style.left = (x - size / 2) + 'px';
  item.style.top = (y - size / 2) + 'px';

  activeItems++;

  function removeItem() {
    if (item.parentNode) {
      item.parentNode.removeChild(item);
      activeItems = Math.max(0, activeItems - 1);
    }
  }

  item.addEventListener('click', (ev) => {
    if (!running) return;
    const good = item.getAttribute('data-good') === '1';
    const golden = item.getAttribute('data-golden') === '1';

    burstAt(ev.clientX, ev.clientY, good ? 'good' : 'bad');

    if (navigator.vibrate) {
      navigator.vibrate(good ? (golden ? 40 : 20) : 50);
    }

    if (good) {
      const base = golden ? 25 : 10;
      const missionGain = golden ? 2 : 1;
      score += base;
      combo += 1;
      missionGoodCount += missionGain;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
    } else {
      score = Math.max(0, score - 5);
      combo = 0;
      item.style.transform = 'scale(0.7)';
      const oldBg = document.body.style.backgroundColor || '#0b1220';
      document.body.style.backgroundColor = '#450a0a';
      setTimeout(() => { document.body.style.backgroundColor = oldBg || '#0b1220'; }, 80);
    }

    item.style.opacity = '0';
    updateHUD();
    setTimeout(removeItem, 100);
  });

  host.appendChild(item);

  // ลบเมื่อหมดเวลา life
  setTimeout(() => {
    if (item.parentNode) {
      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      setTimeout(removeItem, 120);
    }
  }, ITEM_LIFETIME);
}

// ---------- Game loop ----------
function startGame() {
  if (running) return;
  running = true;
  score = 0;
  combo = 0;
  maxCombo = 0;
  missionGoodCount = 0;
  timeLeft = GAME_DURATION;
  activeItems = 0;
  updateHUD();

  const host = createHost();
  createHUD();
  createFXLayer();
  ensureGameCSS();

  if (spawnTimer) clearInterval(spawnTimer);
  if (tickTimer) clearInterval(tickTimer);

  spawnTimer = setInterval(() => {
    spawnOne(host);
  }, SPAWN_INTERVAL);

  tickTimer = setInterval(() => {
    timeLeft -= 1;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHUD();
      endGame();
      return;
    }
    updateHUD();
  }, 1000);
}

function endGame() {
  if (!running) return;
  running = false;
  if (spawnTimer) clearInterval(spawnTimer);
  if (tickTimer) clearInterval(tickTimer);

  const result = $('#hha-result');
  const fs = $('#hha-final-score');
  const fc = $('#hha-final-combo');
  const fg = $('#hha-final-good');
  const title = $('#hha-result-title');

  const missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;

  if (fs) fs.textContent = String(score);
  if (fc) fc.textContent = String(maxCombo);
  if (fg) fg.textContent = String(missionGoodCount);
  if (title) {
    title.textContent = missionSuccess
      ? 'ภารกิจสำเร็จ! 🎉'
      : 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
  }

  if (result) result.style.display = 'flex';
}

// ---------- Bootstrap ----------
function bootstrap() {
  createHUD();
  createHost();
  createFXLayer();
  ensureGameCSS();
  updateHUD();

  const restartBtn = $('#hha-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', () => {
      const panel = $('#hha-result');
      if (panel) panel.style.display = 'none';
      startGame();
    });
  }

  // เริ่มเกมอัตโนมัติรอบแรก
  startGame();
  console.log('[HHA DOM] Good vs Junk production v2 (Fruit style)', {
    MODE, DIFF, GAME_DURATION, SPAWN_INTERVAL, ITEM_LIFETIME, MAX_ACTIVE, GOLDEN_RATE, MISSION_GOOD_TARGET
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
