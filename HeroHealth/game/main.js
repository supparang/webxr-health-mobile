// === Hero Health — game/main.js
// DOM Good vs Junk — Power-up Edition (Star / Gold / Diamond / Shield / Fever)

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

// weights: โอกาสสุ่มแต่ละประเภท
let TYPE_WEIGHTS = {
  good: 45,
  junk: 30,
  star: 7,
  gold: 6,
  diamond: 5,
  shield: 3,
  fever: 4
};

let FEVER_DURATION = 5;       // Fever นานกี่วินาที
let DIAMOND_TIME_BONUS = 2;   // diamond เพิ่มเวลานิดหน่อย

switch (DIFF) {
  case 'easy':
    SPAWN_INTERVAL = 950;      // ช้าลง → เด็กทัน
    ITEM_LIFETIME = 2000;      // ลอยนานขึ้น
    MAX_ACTIVE = 3;            // ไม่ให้ล้นจอ
    MISSION_GOOD_TARGET = 15;  // ภารกิจผ่านง่ายขึ้นหน่อย
    SIZE_FACTOR = 1.25;        // เป้าใหญ่สุด
    TYPE_WEIGHTS = {
      good:   60,   // ของดีเยอะ
      junk:   15,   // ขยะน้อย
      star:    8,
      gold:    7,
      diamond: 4,
      shield:  4,   // เกราะออกบ่อย
      fever:   2
    };
    FEVER_DURATION = 4;
    DIAMOND_TIME_BONUS = 3;    // easy ได้เวลาเพิ่มเยอะหน่อย
    break;

  case 'hard':
    SPAWN_INTERVAL = 430;      // เร็วขึ้น
    ITEM_LIFETIME = 900;       // หายไว
    MAX_ACTIVE = 7;            // เป้าพร้อมกันเยอะ
    MISSION_GOOD_TARGET = 30;  // ต้องเก็บของดีเยอะ
    SIZE_FACTOR = 0.85;        // เป้าเล็ก
    TYPE_WEIGHTS = {
      good:   30,
      junk:   45,  // ขยะเยอะ
      star:    5,
      gold:    5,
      diamond: 5,
      shield:  2,
      fever:   8   // fever บ่อย → ล่า combo
    };
    FEVER_DURATION = 7;
    DIAMOND_TIME_BONUS = 1;
    break;

  case 'normal':
  default:
    SPAWN_INTERVAL = 650;
    ITEM_LIFETIME = 1400;
    MAX_ACTIVE = 4;
    MISSION_GOOD_TARGET = 20;
    SIZE_FACTOR = 1.0;         // ขนาดกลาง
    TYPE_WEIGHTS = {
      good:   45,
      junk:   30,
      star:    7,
      gold:    6,
      diamond: 5,
      shield:  3,
      fever:   4
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
function $(sel) {
  return document.querySelector(sel);
}

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

// ---------- CSS global + responsive HUD ----------
function ensureGameCSS() {
  if (document.getElementById('hha-game-css')) return;
  const st = document.createElement('style');
  st.id = 'hha-game-css';
  st.textContent = `
    /* ลอยเป้าเบา ๆ */
    @keyframes hha-float {
      0%   { transform: translate3d(0,0,0); }
      50%  { transform: translate3d(0,-12px,0); }
      100% { transform: translate3d(0,0,0); }
    }

    /* ปรับ HUD สำหรับจอเล็ก */
    @media (max-width: 720px) {
      #hha-hud-inner {
        padding: 8px 12px;
        font-size: 12px;
        min-width: 220px;
      }
      #hha-hud-inner #hha-score,
      #hha-hud-inner #hha-combo {
        font-size: 16px;
      }
      #hha-timebox {
        font-size: 11px;
        padding: 4px 10px;
      }
    }

    /* จอเล็กมาก ๆ (มือถือเล็ก) */
    @media (max-width: 480px) {
      #hha-hud-inner {
        padding: 6px 10px;
        font-size: 11px;
        min-width: 200px;
      }
      #hha-hud-inner #hha-score,
      #hha-hud-inner #hha-combo {
        font-size: 14px;
      }
      #hha-buffs {
        font-size: 10px;
      }
      #hha-timebox {
        font-size: 10px;
        padding: 3px 8px;
      }
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
    <div id="hha-hud-inner"
      style="
        position:fixed;top:16px;left:50%;
        transform:translateX(-50%);
        background:rgba(15,23,42,0.95);
        border-radius:16px;padding:10px 18px;
        display:flex;flex-direction:column;gap:6px;
        box-shadow:0 18px 40px rgba(0,0,0,0.65);
        border:1px solid rgba(51,65,85,0.9);
        z-index:9100;
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        font-size:14px;min-width:260px;
      "
    >
      <div style="display:flex;gap:18px;justify-content:space-between;">
        <div>
          <div>คะแนน</div>
          <div id="hha-score"
            style="text-align:right;font-weight:700;font-size:18px;">
            0
          </div>
        </div>
        <div>
          <div>คอมโบ</div>
          <div id="hha-combo"
            style="text-align:right;font-weight:700;font-size:18px;">
            0
          </div>
        </div>
      </div>

      <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">
        <div id="hha-mission-text">
          ภารกิจ: เก็บของดีให้ครบ ${MISSION_GOOD_TARGET} ชิ้น
          <span style="opacity:0.8">(พาวเวอร์อัปบางชนิดนับหลายชิ้น)</span>
        </div>

        <div style="
          width:100%;height:6px;border-radius:999px;
          background:rgba(15,23,42,0.9);
          overflow:hidden;
          border:1px solid rgba(148,163,184,0.7);">
          <div id="hha-mission-bar"
            style="width:0%;height:100%;border-radius:999px;
                   background:linear-gradient(90deg,#22c55e,#16a34a);">
          </div>
        </div>

        <div id="hha-buffs" style="margin-top:2px;">
          ⭐ คอมโบสูงสุด: <span id="hha-buff-star">0</span> |
          🛡 เกราะ: <span id="hha-buff-shield">0</span> |
          🔥 Fever: <span id="hha-buff-fever">0</span>s
        </div>
      </div>
    </div>

    <div id="hha-timebox"
      style="
        position:fixed;top:16px;right:16px;
        background:rgba(15,23,42,0.95);
        border-radius:999px;padding:6px 14px;
        border:1px solid rgba(148,163,184,0.9);
        font-size:13px;z-index:9100;
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
      ">
      ${MODE.toUpperCase()} • ${DIFF.toUpperCase()} • <span id="hha-time"></span>s
    </div>

    <div id="hha-result"
      style="position:fixed;inset:0;display:none;
             align-items:center;justify-content:center;z-index:9200;">
      <div style="
        background:rgba(15,23,42,0.97);
        border-radius:18px;padding:20px 26px;
        min-width:260px;border:1px solid rgba(34,197,94,0.8);
        text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.75);
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
      ">
        <h2 id="hha-result-title"
          style="margin-top:0;margin-bottom:8px;font-size:18px;">
          จบรอบแล้ว 🎉
        </h2>

        <div style="margin-bottom:4px;">
          คะแนนรวม: <b id="hha-final-score">0</b>
        </div>
