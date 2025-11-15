// === Hero Health — game/main.js
// DOM Good vs Junk — Power-up Edition (Star / Gold / Diamond / Shield / Fever)
// - อ่าน mode/diff/time จาก URL
// - ง่าย / ปกติ / ยาก แยก config: spawn interval, อายุเป้า, จำนวนพร้อมกัน, สัดส่วนประเภทเป้า, ขนาดเป้า
// - Power-up:
//   ⭐ Star    : เพิ่มคะแนน + คอมโบเยอะ
//   🥇 Gold   : คะแนนสูง + mission x2
//   💎 Diamond: คะแนนสูงมาก + mission x2 + เพิ่มเวลา
//   🛡 Shield : เกราะกันพลาด 1 ครั้ง
//   🔥 Fever  : ช่วงคะแนน x2 ชั่วคราว
// - ภารกิจ: เก็บของดีให้ครบ N ชิ้น (power-up นับหลายชิ้นตามประเภท)
// - Progress bar + HUD บัฟ + Particle FX + Result popup

'use strict';

// ---------- อ่านค่าจาก URL ----------
const url = new URL(window.location.href);
const MODE = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();

let timeParam = parseInt(url.searchParams.get('time'), 10);
if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
if (timeParam < 20) timeParam = 20;
if (timeParam > 180) timeParam = 180;

// ความยาวรอบเกม (วินาที)
const GAME_DURATION = timeParam;

// ---------- Config ตาม diff ----------
let SPAWN_INTERVAL = 700;
let ITEM_LIFETIME = 1400;
let MAX_ACTIVE = 4;
let MISSION_GOOD_TARGET = 20;
let SIZE_FACTOR = 1.0; // ขนาดเป้า: easy > normal > hard

// weights: โอกาสสุ่มแต่ละประเภท (รวมกันเท่าไหร่ก็ได้ เดี๋ยว normalize)
let TYPE_WEIGHTS = {
  good: 45,
  junk: 30,
  star: 7,
  gold: 6,
  diamond: 5,
  shield: 3,
  fever: 4,
};

let FEVER_DURATION = 5;       // Fever นานกี่วินาที
let DIAMOND_TIME_BONUS = 2;   // diamond เพิ่มเวลานิดหน่อย

switch (DIFF) {
  case 'easy':
    SPAWN_INTERVAL = 900;
    ITEM_LIFETIME = 1900;
    MAX_ACTIVE = 3;
    MISSION_GOOD_TARGET = 12;
    SIZE_FACTOR = 1.25;   // ใหญ่สุด คลิกง่าย

    TYPE_WEIGHTS = {
      good: 55,
      junk: 20,
      star: 8,
      gold: 7,
      diamond: 4,
      shield: 4,
      fever: 2,
    };
    FEVER_DURATION = 4;
    DIAMOND_TIME_BONUS = 3;
    break;

  case 'hard':
    SPAWN_INTERVAL = 480;
    ITEM_LIFETIME = 1000;
    MAX_ACTIVE = 6;
    MISSION_GOOD_TARGET = 28;
    SIZE_FACTOR = 0.85;   // เล็กลง เล็งยากขึ้น

    TYPE_WEIGHTS = {
      good: 35,
      junk: 40,
      star: 5,
      gold: 6,
      diamond: 6,
      shield: 2,
      fever: 6,
    };
    FEVER_DURATION = 6;
    DIAMOND_TIME_BONUS = 2;
    break;

  case 'normal':
  default:
    SPAWN_INTERVAL = 650;
    ITEM_LIFETIME = 1400;
    MAX_ACTIVE = 4;
    MISSION_GOOD_TARGET = 20;
    SIZE_FACTOR = 1.0;    // ขนาดกลาง

    TYPE_WEIGHTS = {
      good: 45,
      junk: 30,
      star: 7,
      gold: 6,
      diamond: 5,
      shield: 3,
      fever: 4,
    };
    FEVER_DURATION = 5;
    DIAMOND_TIME_BONUS = 2;
    break;
}

// ---------- ชุดอีโมจิ ----------
const GOOD = ['🍎','🍓','🍇','🥦','🥕','🍅','🥬','🍊','🍌','🫐','🍐','🍍','🍋','🍉','🥝','🍚','🥛','🍞','🐟','🥗'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🥓','🍫','🌭'];
const STAR = ['⭐','🌟'];
const GOLD = ['🥇','🏅','🪙'];
const DIAMOND = ['💎'];
const SHIELD = ['🛡️'];
const FEVER = ['🔥'];

// ---------- State ----------
let score = 0;
let combo = 0;
let maxCombo = 0;
let timeLeft = GAME_DURATION;
let running = false;
let spawnTimer = null;
let tickTimer = null;

let missionGoodCount = 0;   // จำนวนของดีที่เก็บได้ (รวม power-up)
let activeItems = 0;        // เป้าบนจอปัจจุบัน

let shieldCharges = 0;      // เกราะสะสม
let feverTicksLeft = 0;     // จำนวนวินาที fever ที่เหลือ

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
      50%  { transform: translate3d(0,-12px,0); }
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
      min-width:260px;
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
          <span style="opacity:0.8">(พาวเวอร์อัปบางชนิดนับหลายชิ้น)</span>
        </div>
        <div style="width:100%;height:6px;border-radius:999px;background:rgba(15,23,42,0.9);overflow:hidden;border:1px solid rgba(148,163,184,0.7);">
          <div id="hha-mission-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#16a34a);"></div>
        </div>
        <div id="hha-buffs" style="margin-top:2px;">
          ⭐ คอมโบสูงสุด: <span id="hha-buff-star">0</span> |
          🛡 เกราะ: <span id="hha-buff-shield">0</span> |
          🔥 Fever: <span id="hha-buff-fever">0</span>s
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

function currentMultiplier() {
  return feverTicksLeft > 0 ? 2 : 1;
}

function updateHUD() {
  const sEl = $('#hha-score');
  const cEl = $('#hha-combo');
  const tEl = $('#hha-time');
  const mBar = $('#hha-mission-bar');
  const starEl = $('#hha-buff-star');
  const shieldEl = $('#hha-buff-shield');
  const feverEl = $('#hha-buff-fever');

  if (sEl) sEl.textContent = String(score);
  if (cEl) cEl.textContent = String(combo);
  if (tEl) tEl.textContent = String(timeLeft);

  if (mBar) {
    const ratio = Math.max(0, Math.min(1, missionGoodCount / MISSION_GOOD_TARGET));
    mBar.style.width = (ratio * 100).toFixed(1) + '%';
  }

  if (starEl) starEl.textContent = String(maxCombo);
  if (shieldEl) shieldEl.textContent = String(shieldCharges);
  if (feverEl) feverEl.textContent = String(Math.max(0, feverTicksLeft));
}

// ---------- Particle FX ----------
function burstAt(x, y, kind) {
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
  let base;
  switch (kind) {
    case 'good':
      base = 'rgba(34,197,94,'; break;         // เขียว
    case 'star':
    case 'gold':
    case 'diamond':
      base = 'rgba(250,204,21,'; break;       // เหลืองทอง
    case 'shield':
      base = 'rgba(59,130,246,'; break;       // น้ำเงิน
    case 'fever':
      base = 'rgba(248,113,113,'; break;      // ส้มแดง
    case 'bad':
    default:
      base = 'rgba(239,68,68,';               // แดง
  }

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
      background: base + (0.6 + Math.random() * 0.3) + ')',
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

// ---------- เลือกประเภทเป้าตาม weight ----------
function pickType() {
  const entr
