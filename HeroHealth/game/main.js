// === Hero Health — game/main.js (DOM Good vs Junk — Production v1) ===
// ใช้คู่กับ index.vr.html ที่ถูกเปิดจาก hub.html:
//   index.vr.html?mode=goodjunk&diff=normal&time=60
//
// คุณสมบัติ:
// - อ่าน mode / diff / time จาก URL จริง
// - ปรับความถี่ spawn ตาม diff
// - Mini mission: เก็บของดีให้ครบ N ชิ้น (ต่างกันตาม diff)
// - Progress bar ใต้คะแนน
// - หน้าสรุปผล: ภารกิจสำเร็จ / ยังไม่สำเร็จ + ปุ่มเล่นอีกครั้ง

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

// config ตาม diff
let SPAWN_INTERVAL = 700;
let MISSION_GOOD_TARGET = 20; // จำนวนของดีที่ต้องเก็บให้ครบ

switch (DIFF) {
  case 'easy':
    SPAWN_INTERVAL = 900;      // ง่าย → ออกช้าลง
    MISSION_GOOD_TARGET = 12;
    break;
  case 'hard':
    SPAWN_INTERVAL = 500;      // ยาก → ออกถี่ขึ้น
    MISSION_GOOD_TARGET = 28;
    break;
  case 'normal':
  default:
    SPAWN_INTERVAL = 700;
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

let missionGoodCount = 0; // จำนวนของดีที่เก็บได้

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
        <div id="hha-mission-text">ภารกิจ: เก็บของดีให้ครบ ${MISSION_GOOD_TARGET} ชิ้น</div>
        <div style="width:100%;height:6px;border-radius:999px;background:rgba(15,23,42,0.9);overflow:hidden;border:1px solid rgba(148,163,184,0.7);">
          <div id="hha-mission-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#16a34a);"></div>
        </div>
      </div>
    </div>

    <!-- TIME -->
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

// ---------- Spawn logic ----------
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnOne(host) {
  if (!running) return;

  const isGood = Math.random() < 0.6; // 60% ของดี
  const emo = isGood ? randomFrom(GOOD) : randomFrom(JUNK);

  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = emo;
  item.setAttribute('data-good', isGood ? '1' : '0');

  // ปรับขนาดตามหน้าจอ (มือถือ = ใหญ่ขึ้น)
  const baseSize = Math.min(window.innerWidth, window.innerHeight);
  const size = baseSize < 700 ? 72 : 80;

  Object.assign(item.style, {
    position: 'absolute',
    width: size + 'px',
    height: size + 'px',
    borderRadius: '999px',
    border: '0',
    fontSize: (size * 0.52) + 'px',
    boxShadow: '0 8px 22px rgba(15,23,42,0.85)',
    cursor: 'pointer',
    background: 'rgba(15,23,42,0.96)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.12s ease, opacity 0.12s ease',
    pointerEvents: 'auto'
  });

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = 0.1 * vw + Math.random() * 0.8 * vw;
  const y = 0.18 * vh + Math.random() * 0.7 * vh; // เว้น HUD ด้านบนมากขึ้น
  item.style.left = (x - size / 2) + 'px';
  item.style.top = (y - size / 2) + 'px';

  function removeItem() {
    if (item.parentNode) item.parentNode.removeChild(item);
  }

  item.addEventListener('click', () => {
    if (!running) return;
    const good = item.getAttribute('data-good') === '1';
    if (good) {
      score += 10;
      combo += 1;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
    } else {
      score = Math.max(0, score - 5);
      combo = 0;
      item.style.transform = 'scale(0.7)';
      // flash แดงเบา ๆ
      const oldBg = document.body.style.backgroundColor || '#0b1220';
      document.body.style.backgroundColor = '#450a0a';
      setTimeout(() => { document.body.style.backgroundColor = oldBg || '#0b1220'; }, 80);
    }
    item.style.opacity = '0';
    updateHUD();
    setTimeout(removeItem, 100);
  });

  host.appendChild(item);

  setTimeout(() => {
    if (item.parentNode) {
      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      setTimeout(removeItem, 120);
    }
  }, 1400);
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
  updateHUD();

  const host = createHost();
  createHUD();

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
  console.log('[HHA DOM] Good vs Junk production v1', {
    MODE, DIFF, GAME_DURATION, SPAWN_INTERVAL, MISSION_GOOD_TARGET
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
