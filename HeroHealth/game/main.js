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
        <div style="margin-bottom:4px;">
          คอมโบสูงสุด: <b id="hha-final-combo">0</b>
        </div>
        <div style="margin-bottom:14px;">
          ของดีที่เก็บได้:
          <b id="hha-final-good">0</b> / ${MISSION_GOOD_TARGET}
        </div>

        <button id="hha-restart"
          style="border-radius:999px;border:0;cursor:pointer;
                 padding:8px 18px;
                 background:linear-gradient(135deg,#38bdf8,#2563eb);
                 color:#fff;font-weight:600;font-size:14px;">
          เล่นอีกครั้ง
        </button>
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
      base = 'rgba(34,197,94,'; break;
    case 'star':
    case 'gold':
    case 'diamond':
      base = 'rgba(250,204,21,'; break;
    case 'shield':
      base = 'rgba(59,130,246,'; break;
    case 'fever':
      base = 'rgba(248,113,113,'; break;
    case 'bad':
    default:
      base = 'rgba(239,68,68,'; break;
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

    requestAnimationFrame(function() {
      shard.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.1)';
      shard.style.opacity = '0';
    });
  }

  fxLayer.appendChild(container);
  setTimeout(function() {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }, 320);
}

// ---------- เลือกประเภทเป้าตาม weight ----------
function pickType() {
  const entries = Object.entries(TYPE_WEIGHTS);
  let total = 0;
  for (let i = 0; i < entries.length; i++) {
    total += entries[i][1];
  }
  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < entries.length; i++) {
    const type = entries[i][0];
    const w = entries[i][1];
    acc += w;
    if (r <= acc) return type;
  }
  return 'good';
}

// ---------- Spawn logic ----------
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnOne(host) {
  if (!running) return;
  if (activeItems >= MAX_ACTIVE) return;

  const type = pickType();
  let emo = '❓';

  if (type === 'good') emo = randomFrom(GOOD);
  else if (type === 'junk') emo = randomFrom(JUNK);
  else if (type === 'star') emo = randomFrom(STAR);
  else if (type === 'gold') emo = randomFrom(GOLD);
  else if (type === 'diamond') emo = randomFrom(DIAMOND);
  else if (type === 'shield') emo = randomFrom(SHIELD);
  else if (type === 'fever') emo = randomFrom(FEVER);

  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = emo;
  item.setAttribute('data-type', type);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // --- ปรับ safe area: ไม่ให้ชน HUD/timebox + ไม่ติดขอบจอเกินไป ---
  const marginX = Math.max(40, vw * 0.06);      // เว้นซ้าย/ขวา
  const marginTop = Math.max(140, vh * 0.20);   // เว้นด้านบน (ต่ำกว่า HUD+timebox)
  const marginBottom = Math.max(80, vh * 0.12); // เว้นด้านล่าง

  const safeWidth = Math.max(60, vw - marginX * 2);
  const safeHeight = Math.max(60, vh - marginTop - marginBottom);

  const x = marginX + Math.random() * safeWidth;
  const y = marginTop + Math.random() * safeHeight;

  const shortest = Math.min(vw, vh);
  const baseSize = shortest < 700 ? 72 : 80;
  const size = Math.round(baseSize * SIZE_FACTOR);

  const baseStyle = {
    position: 'absolute',
    width: size + 'px',
    height: size + 'px',
    borderRadius: '999px',
    border: '0',
    fontSize: String(size * 0.52) + 'px',
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

  if (type === 'gold' || type === 'diamond' || type === 'star') {
    item.style.background = 'radial-gradient(circle at 30% 20%, #facc15, #f97316)';
    item.style.boxShadow = '0 0 25px rgba(250,204,21,0.9)';
  } else if (type === 'shield') {
    item.style.background = 'radial-gradient(circle at 30% 20%, #60a5fa, #1d4ed8)';
    item.style.boxShadow = '0 0 22px rgba(59,130,246,0.8)';
  } else if (type === 'fever') {
    item.style.background = 'radial-gradient(circle at 30% 20%, #fb923c, #b91c1c)';
    item.style.boxShadow = '0 0 26px rgba(248,113,113,0.9)';
  } else if (type === 'good') {
    item.style.background = 'rgba(15,23,42,0.96)';
  } else if (type === 'junk') {
    item.style.background = 'rgba(30,27,75,0.96)';
  }

  item.style.left = String(x - size / 2) + 'px';
  item.style.top = String(y - size / 2) + 'px';

  activeItems++;

  function removeItem() {
    if (item.parentNode) {
      item.parentNode.removeChild(item);
      activeItems = Math.max(0, activeItems - 1);
    }
  }

  item.addEventListener('click', function(ev) {
    if (!running) return;

    if (navigator.vibrate) {
      if (type === 'junk') navigator.vibrate(60);
      else if (type === 'shield' || type === 'fever') navigator.vibrate(40);
      else navigator.vibrate(25);
    }
    burstAt(ev.clientX, ev.clientY, type === 'junk' ? 'bad' : type);

    const mult = currentMultiplier();

    if (type === 'good') {
      score += 10 * mult;
      combo += 1;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
    } else if (type === 'star') {
      score += 15 * mult;
      combo += 2;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.28)';
    } else if (type === 'gold') {
      score += 20 * mult;
      combo += 2;
      missionGoodCount += 2;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.3)';
    } else if (type === 'diamond') {
      score += 30 * mult;
      combo += 3;
      missionGoodCount += 2;
      timeLeft += DIAMOND_TIME_BONUS;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.32)';
    } else if (type === 'shield') {
      shieldCharges += 1;
      item.style.transform = 'scale(1.2)';
    } else if (type === 'fever') {
      feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION);
      item.style.transform = 'scale(1.25)';
    } else if (type === 'junk') {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        item.style.transform = 'scale(0.9)';
      } else {
        score = Math.max(0, score - 5);
        combo = 0;
        item.style.transform = 'scale(0.7)';
        const oldBg = document.body.style.backgroundColor || '#0b1220';
        document.body.style.backgroundColor = '#450a0a';
        setTimeout(function() {
          document.body.style.backgroundColor = oldBg || '#0b1220';
        }, 80);
      }
    }

    item.style.opacity = '0';
    updateHUD();
    setTimeout(removeItem, 100);
  });

  host.appendChild(item);

  setTimeout(function() {
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
  shieldCharges = 0;
  feverTicksLeft = 0;
  updateHUD();

  const host = createHost();
  createHUD();
  createFXLayer();
  ensureGameCSS();

  if (spawnTimer) clearInterval(spawnTimer);
  if (tickTimer) clearInterval(tickTimer);

  spawnTimer = setInterval(function() {
    spawnOne(host);
  }, SPAWN_INTERVAL);

  tickTimer = setInterval(function() {
    timeLeft -= 1;
    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHUD();
      endGame();
      return;
    }

    if (feverTicksLeft > 0) {
      feverTicksLeft -= 1;
      if (feverTicksLeft < 0) feverTicksLeft = 0;
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
    restartBtn.addEventListener('click', function() {
      const panel = $('#hha-result');
      if (panel) panel.style.display = 'none';
      startGame();
    });
  }

  startGame();
  console.log('[HHA DOM] Good vs Junk — Power-up Edition', {
    MODE: MODE,
    DIFF: DIFF,
    GAME_DURATION: GAME_DURATION,
    SPAWN_INTERVAL: SPAWN_INTERVAL,
    ITEM_LIFETIME: ITEM_LIFETIME,
    MAX_ACTIVE: MAX_ACTIVE,
    TYPE_WEIGHTS: TYPE_WEIGHTS,
    SIZE_FACTOR: SIZE_FACTOR,
    MISSION_GOOD_TARGET: MISSION_GOOD_TARGET
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
