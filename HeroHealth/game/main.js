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

// Fever multiplier แบบมันส์ ๆ
let FEVER_MULT = 2;           // คูณคะแนนเวลา Fever
let FEVER_MAX_STACK = 12;     // สะสมเวลา Fever ได้สูงสุดกี่วินาที

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
      diamond: 3,
      shield:  5,   // เกราะออกบ่อย ช่วยกันพลาด
      fever:   2    // Fever มีบ้าง แต่ไม่ถี่
    };

    FEVER_DURATION = 4;
    DIAMOND_TIME_BONUS = 3;    // easy ได้เวลาเพิ่มเยอะหน่อย
    FEVER_MULT = 2;            // คูณ 2 พอ ชิล ๆ
    break;

  case 'hard':
    SPAWN_INTERVAL = 430;      // เร็วขึ้น
    ITEM_LIFETIME = 900;       // หายไว
    MAX_ACTIVE = 7;            // เป้าพร้อมกันเยอะ
    MISSION_GOOD_TARGET = 30;  // ต้องเก็บของดีเยอะ
    SIZE_FACTOR = 0.85;        // เป้าเล็ก

    TYPE_WEIGHTS = {
      good:   32,
      junk:   40,  // ขยะเยอะมาก
      star:    7,
      gold:    6,
      diamond:  7, // diamond ออกบ่อยขึ้น
      shield:   2,
      fever:   10  // Fever ถี่มาก → โหมด B สุด ๆ
    };

    FEVER_DURATION = 7;        // Fever นานขึ้น
    DIAMOND_TIME_BONUS = 1;    // เพิ่มเวลาเบา ๆ
    FEVER_MULT = 2.5;          // คะแนนคูณ 2.5 เวลาติด Fever
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
      star:    8,
      gold:    7,
      diamond: 5,
      shield:  3,
      fever:   6   // มี Fever พอให้ลุ้น
    };

    FEVER_DURATION = 5;
    DIAMOND_TIME_BONUS = 2;
    FEVER_MULT = 2.2;          // แรงขึ้นนิดหน่อย
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

function createToastLayer() {
  let toast = $('#hha-toast');
  if (toast) return toast;
  toast = document.createElement('div');
  toast.id = 'hha-toast';
  Object.assign(toast.style, {
    position: 'fixed',
    left: '50%',
    top: '72px',
    transform: 'translateX(-50%)',
    padding: '6px 14px',
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.95)',
    color: '#e5e7eb',
    border: '1px solid rgba(248,250,252,0.4)',
    fontSize: '13px',
    fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
    zIndex: '9150',
    opacity: '0',
    pointerEvents: 'none',
    transition: 'opacity 160ms ease-out, transform 160ms ease-out'
  });
  document.body.appendChild(toast);
  return toast;
}

let toastTimer = null;
function showToast(msg, kind) {
  const toast = createToastLayer();
  toast.textContent = msg;
  toast.style.borderColor = kind === 'bad'
    ? 'rgba(248,113,113,0.9)'
    : 'rgba(52,211,153,0.9)';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  toast.style.opacity = '0';
  // trigger
  requestAnimationFrame(function() {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(4px)';
  });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-4px)';
  }, 900);
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

    /* fade-in/out outro */
    @keyframes hha-outro-fade {
      from { opacity: 0; }
      to   { opacity: 1; }
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

  // สีแถบภารกิจตามระดับ
  let missionBarColor = 'linear-gradient(90deg,#22c55e,#16a34a)';
  if (DIFF === 'easy') {
    missionBarColor = 'linear-gradient(90deg,#38bdf8,#2563eb)';
  } else if (DIFF === 'hard') {
    missionBarColor = 'linear-gradient(90deg,#f97316,#dc2626)';
  }

  hud.innerHTML = `
    <div id="hha-hud-inner"
      style="
        position:fixed;top:16px;left:50%;
        transform:translateX(-50%);
        background:radial-gradient(circle at 0 0,rgba(56,189,248,0.35),transparent 55%),rgba(15,23,42,0.96);
        border-radius:16px;padding:10px 18px;
        display:flex;flex-direction:column;gap:6px;
        box-shadow:0 18px 40px rgba(0,0,0,0.75);
        border:1px solid rgba(51,65,85,0.95);
        z-index:9100;
        font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;
        font-size:14px;min-width:260px;
      "
    >
      <div style="display:flex;gap:18px;justify-content:space-between;">
        <div>
          <div>คะแนนรวม</div>
          <div id="hha-score"
            style="text-align:right;font-weight:700;font-size:18px;">
            0
          </div>
        </div>
        <div>
          <div>ตีติดชุด</div>
          <div id="hha-combo"
            style="text-align:right;font-weight:700;font-size:18px;">
            0
          </div>
        </div>
      </div>

      <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">
        <div id="hha-mission-text">
          ภารกิจวันนี้: เก็บของดีให้ครบ ${MISSION_GOOD_TARGET} ชิ้น
          <span style="opacity:0.8">(พาวเวอร์อัปบางชิ้นนับหลายชิ้น)</span>
        </div>

        <div style="
          width:100%;height:6px;border-radius:999px;
          background:rgba(15,23,42,0.9);
          overflow:hidden;
          border:1px solid rgba(148,163,184,0.7);">
          <div id="hha-mission-bar"
            style="width:0%;height:100%;border-radius:999px;
                   background:${missionBarColor};">
          </div>
        </div>

        <div id="hha-buffs" style="margin-top:2px;">
          ⭐ ตีติดชุดสูงสุด: <span id="hha-buff-star">0</span> |
          🛡 กันพลาด: <span id="hha-buff-shield">0</span> |
          🔥 พลังไฟ: <span id="hha-buff-fever">0</span>s
        </div>
      </div>
    </div>

    <div id="hha-timebox"
      style="
        position:fixed;top:16px;right:16px;
        background:rgba(15,23,42,0.96);
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
        text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.85);
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
          ตีติดชุดสูงสุด: <b id="hha-final-combo">0</b>
        </div>
        <div style="margin-bottom:4px;">
          ของดีที่เก็บได้:
          <b id="hha-final-good">0</b> / ${MISSION_GOOD_TARGET}
        </div>
        <div style="margin-bottom:6px;">
          อันดับของคุณ: <b id="hha-final-rank">-</b>
        </div>
        <div id="hha-final-praise"
          style="margin-bottom:14px;color:#e5e7eb;font-size:13px;">
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
  return feverTicksLeft > 0 ? FEVER_MULT : 1;
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

// ---------- Particle FX (Confetti) ----------
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

  const shardCount = 12;
  let palette;
  switch (kind) {
    case 'good':
      palette = ['#4ade80','#22c55e','#bbf7d0']; break;
    case 'star':
    case 'gold':
      palette = ['#facc15','#fbbf24','#fde68a']; break;
    case 'diamond':
      palette = ['#67e8f9','#38bdf8','#e0f2fe']; break;
    case 'shield':
      palette = ['#60a5fa','#2563eb','#bfdbfe']; break;
    case 'fever':
      palette = ['#fb923c','#f97316','#fecaca']; break;
    case 'bad':
    default:
      palette = ['#f97373','#ef4444','#fecaca']; break;
  }

  for (let i = 0; i < shardCount; i++) {
    const shard = document.createElement('div');
    const w = 4 + Math.random() * 7;
    const h = 6 + Math.random() * 10;
    const color = palette[Math.floor(Math.random() * palette.length)];
    const rotateDeg = (Math.random() * 120) - 60;

    Object.assign(shard.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: w + 'px',
      height: h + 'px',
      borderRadius: '2px',
      background: color,
      transform: 'translate3d(0,0,0) scale(0.7) rotate(0deg)',
      opacity: '1',
      transition: 'transform 260ms ease-out, opacity 260ms ease-out'
    });
    container.appendChild(shard);

    const angle = Math.random() * Math.PI * 2;
    const distance = 30 + Math.random() * 45;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    requestAnimationFrame(function() {
      shard.style.transform =
        'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.05) rotate(' + rotateDeg + 'deg)';
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
      score += Math.round(10 * mult);
      combo += 1;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
    } else if (type === 'star') {
      score += Math.round(15 * mult);
      combo += 2;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.28)';
    } else if (type === 'gold') {
      score += Math.round(20 * mult);
      combo += 2;
      missionGoodCount += 2;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.3)';
    } else if (type === 'diamond') {
      score += Math.round(30 * mult);
      combo += 3;
      missionGoodCount += 2;
      timeLeft += DIAMOND_TIME_BONUS;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.32)';
    } else if (type === 'shield') {
      shieldCharges += 1;
      item.style.transform = 'scale(1.2)';
    } else if (type === 'fever') {
      // กิน Fever แล้วต่อเวลาได้ (stack) แต่ไม่เกิน FEVER_MAX_STACK
      feverTicksLeft = Math.min(feverTicksLeft + FEVER_DURATION, FEVER_MAX_STACK);
      item.style.transform = 'scale(1.25)';
    } else if (type === 'junk') {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        item.style.transform = 'scale(0.9)';
        showToast('กันพลาดทันเวลาพอดี! 🛡️', 'good');
      } else {
        score = Math.max(0, score - 5);
        combo = 0;
        item.style.transform = 'scale(0.7)';
        const oldBg = document.body.style.backgroundColor || '#0b1220';
        document.body.style.backgroundColor = '#450a0a';
        setTimeout(function() {
          document.body.style.backgroundColor = oldBg || '#0b1220';
        }, 80);
        const badMsgs = [
          'โอ๊ะ! พลาดไปโดนของขยะ 😵',
          'ของแบบนี้ไม่ดีต่อร่างกายนะ!',
          'ระวังของขยะให้ดีนะ ✋'
        ];
        showToast(badMsgs[Math.floor(Math.random() * badMsgs.length)], 'bad');
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

// ---------- ระบบให้ Rank + คำชม ----------
function calcRankAndPraise() {
  const success = missionGoodCount >= MISSION_GOOD_TARGET;
  const s = score;
  const c = maxCombo;
  const g = missionGoodCount;
  let rank = 'C';
  let praise = 'ฝึกอีกนิดเดียว เดี๋ยวก็โปร! 💪';

  if (success && c >= 25 && s >= 400) {
    rank = 'S';
    praise = 'ระดับเทพผักผลไม้! เลือกเก่งมาก ๆ เลย 🍎🌟';
  } else if (success && c >= 15) {
    rank = 'A';
    praise = 'สุดยอดนักเลือกอาหารเพื่อสุขภาพ! ✨';
  } else if (success) {
    rank = 'A';
    praise = 'ภารกิจผ่านแบบเท่สุด ๆ เยี่ยมไปเลย! 😎';
  } else if (g >= MISSION_GOOD_TARGET * 0.6) {
    rank = 'B';
    praise = 'อีกนิดเดียวก็ผ่านภารกิจแล้ว สู้ต่ออีกรอบนะ! 🚀';
  } else if (g >= MISSION_GOOD_TARGET * 0.3) {
    rank = 'C';
    praise = 'เริ่มต้นได้ดี! ลองสังเกตของขยะให้มากขึ้นนะ 👀';
  }

  return { rank, praise };
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
  createToastLayer();
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

  // Outro layer
  let outro = $('#hha-outro');
  if (!outro) {
    outro = document.createElement('div');
    outro.id = 'hha-outro';
    Object.assign(outro.style, {
      position: 'fixed',
      inset: '0',
      background: 'radial-gradient(circle at 50% 0,rgba(56,189,248,0.16),transparent 55%),rgba(15,23,42,0.94)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9180',
      opacity: '0',
      animation: 'hha-outro-fade 260ms ease-out forwards'
    });
    const inner = document.createElement('div');
    inner.id = 'hha-outro-inner';
    Object.assign(inner.style, {
      textAlign: 'center',
      color: '#e5e7eb',
      fontFamily: 'system-ui,Segoe UI,Inter,Roboto,sans-serif',
      padding: '16px 20px',
      borderRadius: '16px',
      border: '1px solid rgba(148,163,184,0.8)',
      background: 'rgba(15,23,42,0.98)',
      boxShadow: '0 18px 40px rgba(0,0,0,0.9)',
      maxWidth: '280px',
      fontSize: '14px'
    });
    inner.innerHTML = `
      <div style="font-size:18px;margin-bottom:6px;">🎉 รอบนี้เก่งมาก! 🎉</div>
      <div>กำลังคำนวณคะแนนของคุณ…</div>
    `;
    outro.appendChild(inner);
    document.body.appendChild(outro);
  } else {
    outro.style.display = 'flex';
    outro.style.opacity = '1';
  }

  const result = $('#hha-result');
  const fs = $('#hha-final-score');
  const fc = $('#hha-final-combo');
  const fg = $('#hha-final-good');
  const title = $('#hha-result-title');
  const rankEl = $('#hha-final-rank');
  const praiseEl = $('#hha-final-praise');

  const missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;
  const rp = calcRankAndPraise();

  if (fs) fs.textContent = String(score);
  if (fc) fc.textContent = String(maxCombo);
  if (fg) fg.textContent = String(missionGoodCount);
  if (rankEl) rankEl.textContent = rp.rank;
  if (praiseEl) praiseEl.textContent = rp.praise;

  if (title) {
    title.textContent = missionSuccess
      ? 'ภารกิจสำเร็จ! 🎉'
      : 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
  }

  // หน่วงนิดเดียวให้รู้สึกมี outro ก่อนโชว์ผล
  setTimeout(function() {
    if (outro) {
      outro.style.opacity = '0';
      setTimeout(function() {
        if (outro && outro.parentNode) {
          outro.style.display = 'none';
        }
      }, 200);
    }
    if (result) result.style.display = 'flex';
  }, 650);
}

// ---------- Bootstrap ----------
function bootstrap() {
  createHUD();
  createHost();
  createFXLayer();
  createToastLayer();
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
  console.log('[HHA DOM] Good vs Junk — Power-up Edition (Production Polish)', {
    MODE: MODE,
    DIFF: DIFF,
    GAME_DURATION: GAME_DURATION,
    SPAWN_INTERVAL: SPAWN_INTERVAL,
    ITEM_LIFETIME: ITEM_LIFETIME,
    MAX_ACTIVE: MAX_ACTIVE,
    TYPE_WEIGHTS: TYPE_WEIGHTS,
    SIZE_FACTOR: SIZE_FACTOR,
    MISSION_GOOD_TARGET: MISSION_GOOD_TARGET,
    FEVER_MULT: FEVER_MULT,
    FEVER_DURATION: FEVER_DURATION
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
