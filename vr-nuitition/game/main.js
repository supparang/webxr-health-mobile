// === Hero Health — game/main.js (Multiverse + Boss + MiniQuest + Research CSV) ===
'use strict';

// ---------- อ่านค่าจาก URL ----------
const url = new URL(window.location.href);
const MODE = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
const DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();

let timeParam = parseInt(url.searchParams.get('time'), 10);
if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
if (timeParam < 20) timeParam = 20;
if (timeParam > 180) timeParam = 180;
const GAME_DURATION = timeParam;

// ---------- Helper ----------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

// อ่าน profile จาก Hub (ถ้ามี)
let playerProfile = {};
try {
  const raw = sessionStorage.getItem('hha_profile');
  if (raw) playerProfile = JSON.parse(raw) || {};
} catch (e) {
  playerProfile = {};
}

// ---------- โหลดโหมด ----------
window.HH_MODES = window.HH_MODES || {};
const MODE_IMPL = window.HH_MODES[MODE];

if (!MODE_IMPL) {
  alert('โหมดนี้ยังไม่พร้อมใช้งาน (MODE = ' + MODE + ')');
  throw new Error('[HHA] MODE not found: ' + MODE);
}

// ---------- Config จากโหมด ----------
const cfg = (typeof MODE_IMPL.setupForDiff === 'function')
  ? (MODE_IMPL.setupForDiff(DIFF) || {})
  : {};

const SPAWN_INTERVAL = cfg.SPAWN_INTERVAL || 700;
const ITEM_LIFETIME  = cfg.ITEM_LIFETIME  || 1500;
const MAX_ACTIVE     = cfg.MAX_ACTIVE     || 4;
const MISSION_GOOD_TARGET = cfg.MISSION_GOOD_TARGET || 20;
const SIZE_FACTOR    = cfg.SIZE_FACTOR    || 1.0;

const TYPE_WEIGHTS   = cfg.TYPE_WEIGHTS || {
  good: 50, junk: 30, star: 6, gold: 5, diamond: 4, shield: 3, fever: 4, rainbow: 0
};

const FEVER_DURATION       = cfg.FEVER_DURATION       || 6;
const DIAMOND_TIME_BONUS   = cfg.DIAMOND_TIME_BONUS   || 2;

// ---------- Boss Config ----------
const BOSS_WINDOW_SEC  = 7;    // ช่วงวินาทีท้ายเกมที่ Boss จะโผล่
const BOSS_HP          = 5;    // ต้องคลิกกี่ทีถึงล้ม
const BOSS_SCORE_PER_HIT = 10; // คะแนนต่อ hit
const BOSS_BONUS_CLEAR = 50;   // โบนัสเมื่อล้มได้ก่อนหมดเวลา

// ---------- State ----------
let running = false;
let timeLeft = GAME_DURATION;
let spawnTimer = null;
let tickTimer = null;

let score = 0;
let combo = 0;
let maxCombo = 0;
let missionGoodCount = 0;
let activeItems = 0;
let shieldCharges = 0;
let feverTicksLeft = 0;
let feverTriggeredCount = 0;

let bossSpawned = false;
let bossDefeated = false;

// สำหรับคำนวณ reaction time
let roundStartPerf = 0;

// ---------- Mini Quest State ----------
const questState = [
  {
    id: 'streak5',
    desc: 'เก็บของดี 5 ชิ้นติดกันโดยไม่โดนขยะ',
    done: false,
    progress: 0,
    target: 5
  },
  {
    id: 'comboTarget',
    desc: 'ทำคอมโบให้ถึงเป้าหมาย',
    done: false,
    progress: 0,
    target: (DIFF === 'easy' ? 8 : DIFF === 'hard' ? 15 : 10)
  },
  {
    id: 'feverTwice',
    desc: 'เข้าโหมด Fever อย่างน้อย 2 ครั้ง',
    done: false,
    progress: 0,
    target: 2
  }
];

let streakGoodNoJunk = 0;

// ---------- Research Logging ----------
const eventLog = []; // ต่อ event: click, miss, boss hit ฯลฯ

function logEvent(ev) {
  // โครงสร้าง log
  // ev: {
  //   kind: 'hit' / 'miss' / 'boss',
  //   mode, diff,
  //   type, emoji,
  //   spawnPerf, clickPerf, rtMs,
  //   correct,
  //   scoreAfter, comboAfter, timeLeft,
  //   fever, shieldBefore,
  //   questSnapshot: { ... },
  //   meta: { ... }
  // }
  eventLog.push(ev);
}

// ---------- Weighted pick ----------
function pickType() {
  const entries = Object.entries(TYPE_WEIGHTS);
  let total = 0;
  for (let i = 0; i < entries.length; i++) total += entries[i][1];
  if (total <= 0) return 'good';

  const r = Math.random() * total;
  let acc = 0;
  for (let i = 0; i < entries.length; i++) {
    acc += entries[i][1];
    if (r <= acc) return entries[i][0];
  }
  return 'good';
}

// ---------- DOM Host + FX + CSS ----------
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
      0% { transform: translate3d(0,0,0); }
      50%{ transform: translate3d(0,-12px,0); }
      100%{ transform: translate3d(0,0,0); }
    }
    @keyframes hha-hud-shake {
      0% { transform: translate(-50%,0); }
      25%{ transform: translate(-50%,-2px); }
      50%{ transform: translate(-50%,2px); }
      75%{ transform: translate(-50%,-1px); }
      100%{ transform: translate(-50%,0); }
    }
    body.hha-fever::before {
      content:'';
      position:fixed;inset:0;
      pointer-events:none;
      background:
        radial-gradient(circle at top, rgba(248,113,113,0.2), transparent 55%),
        radial-gradient(circle at bottom, rgba(248,150,30,0.22), transparent 55%);
      z-index:8990;
    }
    body.hha-fever #hha-hud-inner {
      box-shadow:0 0 35px rgba(248,113,113,0.8);
      animation: hha-hud-shake 0.4s ease-in-out;
    }
    @media (max-width: 720px) {
      #hha-hud-inner { padding:8px 12px; font-size:12px; min-width:220px; }
      #hha-hud-inner #hha-score,
      #hha-hud-inner #hha-combo { font-size:16px; }
      #hha-timebox { font-size:11px; padding:4px 10px; }
    }
    @media (max-width: 480px) {
      #hha-hud-inner { padding:6px 10px; font-size:11px; min-width:200px; }
      #hha-hud-inner #hha-score,
      #hha-hud-inner #hha-combo { font-size:14px; }
      #hha-buffs { font-size:10px; }
      #hha-timebox { font-size:10px; padding:3px 8px; }
    }
  `;
  document.head.appendChild(st);
}

// ---------- HUD ----------
function createHUD() {
  let hud = $('#hha-hud');
  if (hud) return hud;

  const missionTextFromMode = (typeof MODE_IMPL.missionText === 'function')
    ? MODE_IMPL.missionText(MISSION_GOOD_TARGET)
    : ('ภารกิจ: เก็บให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น');

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
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;">
        <div>
          <div>คะแนน</div>
          <div id="hha-score"
            style="text-align:left;font-weight:700;font-size:18px;">
            0
          </div>
          <div id="hha-fever-banner"
            style="margin-top:2px;font-size:11px;color:#f97316;display:none;">
            FEVER!! 🔥
          </div>
        </div>
        <div style="text-align:right;">
          <div>คอมโบ</div>
          <div id="hha-combo"
            style="font-weight:700;font-size:18px;">
            0
          </div>
          <div id="hha-rank-label"
            style="font-size:11px;color:#a5b4fc;margin-top:2px;">
          </div>
        </div>
      </div>

      <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">
        <div id="hha-mission-text">
          ${missionTextFromMode}
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

        <div id="hha-quests" style="margin-top:4px;border-top:1px dashed rgba(148,163,184,0.5);padding-top:4px;">
          <div style="font-size:11px;color:#93c5fd;margin-bottom:2px;">
            🎯 Mini Quest
          </div>
          <ul id="hha-quest-list" style="list-style:none;padding:0;margin:0;font-size:11px;line-height:1.4;">
          </ul>
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
        <div style="margin-bottom:4px;">
          ของดีที่เก็บได้:
          <b id="hha-final-good">0</b> / ${MISSION_GOOD_TARGET}
        </div>
        <div style="margin-bottom:4px;">
          ความแม่นยำ (Accuracy): <b id="hha-final-acc">0%</b>
        </div>
        <div style="margin-bottom:10px;font-size:12px;color:#cbd5f5;">
          เวลาเฉลี่ยต่อการตอบสนอง: <b id="hha-final-rt">–</b> ms
        </div>

        <div style="font-size:11px;color:#a5b4fc;margin-bottom:12px;">
          Mini Quest: <span id="hha-final-quests">0</span> / ${questState.length} สำเร็จ
          <br/>
          Boss: <span id="hha-final-boss">-</span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-bottom:10px;">
          <button id="hha-restart"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 18px;
                   background:linear-gradient(135deg,#38bdf8,#2563eb);
                   color:#fff;font-weight:600;font-size:14px;">
            เล่นอีกครั้ง
          </button>
          <button id="hha-back-hub"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 18px;
                   background:rgba(15,23,42,0.9);
                   color:#e5e7eb;font-weight:500;font-size:13px;
                   border:1px solid rgba(148,163,184,0.8);">
            กลับไปหน้าโหมด
          </button>
        </div>

        <button id="hha-export-csv"
          style="border-radius:999px;border:0;cursor:pointer;
                 padding:6px 14px;
                 background:rgba(22,163,74,0.95);
                 color:#fff;font-weight:500;font-size:12px;">
          📥 ดาวน์โหลดข้อมูล (CSV)
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(hud);

  // สร้างรายการ quest
  const qList = $('#hha-quest-list');
  if (qList) {
    qList.innerHTML = '';
    questState.forEach(q => {
      const li = document.createElement('li');
      li.id = 'hha-quest-' + q.id;
      li.textContent = '⬜ ' + q.desc;
      qList.appendChild(li);
    });
  }

  return hud;
}

// ---------- FEVER + HUD Update ----------
function currentMultiplier() {
  return feverTicksLeft > 0 ? 2 : 1;
}

function updateRankLabel() {
  const rankEl = $('#hha-rank-label');
  if (!rankEl) return;

  let rank = 'C';
  if (score >= 300 && missionGoodCount >= MISSION_GOOD_TARGET) rank = 'B';
  if (score >= 600 && missionGoodCount >= MISSION_GOOD_TARGET && maxCombo >= 15) rank = 'A';
  if (score >= 900 && maxCombo >= 25) rank = 'S';

  rankEl.textContent = 'RANK: ' + rank;
}

function updateQuestHUD() {
  questState.forEach(q => {
    const li = $('#hha-quest-' + q.id);
    if (!li) return;
    if (q.done) {
      li.textContent = '✅ ' + q.desc;
      li.style.color = '#4ade80';
    } else {
      li.textContent = '⬜ ' + q.desc;
      li.style.color = '#e5e7eb';
    }
  });
}

function updateHUD() {
  const sEl = $('#hha-score');
  const cEl = $('#hha-combo');
  const tEl = $('#hha-time');
  const mBar = $('#hha-mission-bar');
  const starEl = $('#hha-buff-star');
  const shieldEl = $('#hha-buff-shield');
  const feverEl = $('#hha-buff-fever');
  const feverBanner = $('#hha-fever-banner');

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

  if (feverBanner) {
    if (feverTicksLeft > 0) {
      feverBanner.style.display = 'block';
    } else {
      feverBanner.style.display = 'none';
    }
  }

  if (feverTicksLeft > 0) {
    document.body.classList.add('hha-fever');
  } else {
    document.body.classList.remove('hha-fever');
  }

  updateRankLabel();
  updateQuestHUD();
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
    case 'good': base = 'rgba(34,197,94,'; break;
    case 'star':
    case 'gold':
    case 'diamond':
    case 'rainbow': base = 'rgba(250,204,21,'; break;
    case 'shield': base = 'rgba(59,130,246,'; break;
    case 'fever': base = 'rgba(248,113,113,'; break;
    case 'boss': base = 'rgba(252,165,165,'; break;
    case 'bad':
    default:
      base = 'rgba(239,68,68,'; break;
  }

  for (let i = 0; i < shardCount; i++) {
    const shard = document.createElement('div');
    const size = 6 + Math.random() * 6;
    Object.assign(shard.style, {
      position: 'absolute',
      left: '0', top: '0',
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
    if (container.parentNode) container.parentNode.removeChild(container);
  }, 320);
}

// ---------- Mini Quest Update ----------
function updateQuestsOnGoodHit() {
  if (!questState[0].done) {
    streakGoodNoJunk += 1;
    questState[0].progress = streakGoodNoJunk;
    if (streakGoodNoJunk >= questState[0].target) {
      questState[0].done = true;
      score += 20; // โบนัสเล็กน้อย
    }
  }
  if (!questState[1].done) {
    questState[1].progress = Math.max(questState[1].progress, combo);
    if (combo >= questState[1].target) {
      questState[1].done = true;
      score += 30;
    }
  }
}

function updateQuestsOnJunkHit() {
  streakGoodNoJunk = 0;
}

function notifyFeverTriggered() {
  feverTriggeredCount += 1;
  if (!questState[2].done) {
    questState[2].progress = feverTriggeredCount;
    if (feverTriggeredCount >= questState[2].target) {
      questState[2].done = true;
      score += 40;
    }
  }
}

// ---------- Spawn logic ----------
function spawnOne(host) {
  if (!running) return;
  if (activeItems >= MAX_ACTIVE) return;

  const type = pickType();
  const emoji = (typeof MODE_IMPL.pickEmoji === 'function')
    ? MODE_IMPL.pickEmoji(type)
    : '❓';

  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = emoji;
  item.setAttribute('data-type', type);

  const shortest = Math.min(window.innerWidth, window.innerHeight);
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

  if (type === 'gold' || type === 'diamond' || type === 'star' || type === 'rainbow') {
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

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = 0.1 * vw + Math.random() * 0.8 * vw;
  const y = 0.18 * vh + Math.random() * 0.7 * vh;
  item.style.left = (x - size / 2) + 'px';
  item.style.top = (y - size / 2) + 'px';

  // เวลา spawn
  const spawnPerf = performance.now();
  item.dataset.spawnPerf = String(spawnPerf);

  activeItems++;

  function removeItem() {
    if (item.parentNode) {
      item.parentNode.removeChild(item);
      activeItems = Math.max(0, activeItems - 1);
    }
  }

  item.addEventListener('click', function(ev) {
    if (!running) return;

    const shieldBefore = shieldCharges;
    const clickPerf = performance.now();
    const spawnPerfNum = parseFloat(item.dataset.spawnPerf || (roundStartPerf || clickPerf));
    const rtMs = Math.max(0, Math.round(clickPerf - spawnPerfNum));

    if (navigator.vibrate) {
      if (type === 'junk') navigator.vibrate(60);
      else if (type === 'shield' || type === 'fever') navigator.vibrate(40);
      else navigator.vibrate(25);
    }
    burstAt(ev.clientX, ev.clientY, (type === 'junk' ? 'bad' : type));

    const mult = currentMultiplier();
    let correct = false;

    if (type === 'good') {
      score += 10 * mult;
      combo += 1;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
      correct = true;
      updateQuestsOnGoodHit();
    } else if (type === 'star') {
      score += 15 * mult;
      combo += 2;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.28)';
      correct = true;
      updateQuestsOnGoodHit();
    } else if (type === 'gold') {
      score += 20 * mult;
      combo += 2;
      missionGoodCount += 2;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.3)';
      correct = true;
      updateQuestsOnGoodHit();
    } else if (type === 'diamond') {
      score += 30 * mult;
      combo += 3;
      missionGoodCount += 2;
      timeLeft += DIAMOND_TIME_BONUS;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.32)';
      correct = true;
      updateQuestsOnGoodHit();
    } else if (type === 'rainbow') {
      score += 40 * mult;
      combo += 3;
      missionGoodCount += 3;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.35)';
      correct = true;
      updateQuestsOnGoodHit();
    } else if (type === 'shield') {
      shieldCharges += 1;
      item.style.transform = 'scale(1.2)';
      correct = true;
    } else if (type === 'fever') {
      const wasZero = (feverTicksLeft <= 0);
      feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION);
      item.style.transform = 'scale(1.25)';
      correct = true;
      if (wasZero) {
        notifyFeverTriggered();
        if (window.HH_COACH && typeof window.HH_COACH.onFeverStart === 'function') {
          window.HH_COACH.onFeverStart(MODE, DIFF);
        }
      }
    } else if (type === 'junk') {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        item.style.transform = 'scale(0.9)';
        // ถือว่าป้องกันได้ ไม่หักความถูกต้อง
        correct = true;
      } else {
        score = Math.max(0, score - 5);
        combo = 0;
        streakGoodNoJunk = 0;
        item.style.transform = 'scale(0.7)';
        const oldBg = document.body.style.backgroundColor || '';
        document.body.style.backgroundColor = '#450a0a';
        setTimeout(function() {
          document.body.style.backgroundColor = oldBg || '';
        }, 80);
        correct = false;
        updateQuestsOnJunkHit();
      }
    }

    // log event
    logEvent({
      kind: 'hit',
      mode: MODE,
      diff: DIFF,
      type: type,
      emoji: emoji,
      spawnPerf: spawnPerfNum,
      clickPerf: clickPerf,
      rtMs: rtMs,
      correct: correct,
      scoreAfter: score,
      comboAfter: combo,
      timeLeft: timeLeft,
      fever: (feverTicksLeft > 0),
      shieldBefore: shieldBefore,
      quests: {
        streak5: questState[0],
        comboTarget: questState[1],
        feverTwice: questState[2]
      },
      profile: playerProfile || {}
    });

    item.style.opacity = '0';
    updateHUD();
    setTimeout(removeItem, 100);
  });

  host.appendChild(item);

  setTimeout(function() {
    if (!item.parentNode) return;
    // timeout → miss
    item.style.opacity = '0';
    item.style.transform = 'scale(0.7)';
    const spawnPerfNum = parseFloat(item.dataset.spawnPerf || (roundStartPerf || performance.now()));
    logEvent({
      kind: 'miss',
      mode: MODE,
      diff: DIFF,
      type: item.getAttribute('data-type') || 'unknown',
      emoji: item.textContent || '',
      spawnPerf: spawnPerfNum,
      clickPerf: null,
      rtMs: null,
      correct: false,
      scoreAfter: score,
      comboAfter: combo,
      timeLeft: timeLeft,
      fever: (feverTicksLeft > 0),
      shieldBefore: shieldCharges,
      quests: {
        streak5: questState[0],
        comboTarget: questState[1],
        feverTwice: questState[2]
      },
      profile: playerProfile || {}
    });
    setTimeout(removeItem, 120);
  }, ITEM_LIFETIME);
}

// ---------- Boss ----------
function spawnBoss(host) {
  if (!running || bossSpawned) return;
  bossSpawned = true;

  const type = 'boss';
  const emoji = (typeof MODE_IMPL.pickEmoji === 'function')
    ? (MODE_IMPL.pickEmoji('boss') || '👾')
    : '👾';

  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = emoji;
  item.setAttribute('data-type', type);

  const shortest = Math.min(window.innerWidth, window.innerHeight);
  const baseSize = shortest < 700 ? 110 : 130;
  const size = Math.round(baseSize);

  Object.assign(item.style, {
    position: 'absolute',
    width: size + 'px',
    height: size + 'px',
    borderRadius: '999px',
    border: '0',
    fontSize: String(size * 0.52) + 'px',
    boxShadow: '0 0 40px rgba(248,113,113,0.95)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.12s ease, opacity 0.12s ease',
    pointerEvents: 'auto',
    background: 'radial-gradient(circle at 30% 20%, #fecaca, #b91c1c)',
    animation: 'hha-float 1.1s ease-in-out infinite'
  });

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = vw / 2;
  const y = vh * 0.5;
  item.style.left = (x - size / 2) + 'px';
  item.style.top = (y - size / 2) + 'px';

  item.dataset.hp = String(BOSS_HP);
  const spawnPerf = performance.now();
  item.dataset.spawnPerf = String(spawnPerf);

  activeItems++;

  function removeItem() {
    if (item.parentNode) {
      item.parentNode.removeChild(item);
      activeItems = Math.max(0, activeItems - 1);
    }
  }

  item.addEventListener('click', function(ev) {
    if (!running) return;
    const shieldBefore = shieldCharges;
    const clickPerf = performance.now();
    const spawnPerfNum = parseFloat(item.dataset.spawnPerf || (roundStartPerf || clickPerf));
    const rtMs = Math.max(0, Math.round(clickPerf - spawnPerfNum));

    if (navigator.vibrate) navigator.vibrate(80);

    const hp = parseInt(item.dataset.hp || '1', 10);
    const newHp = hp - 1;
    item.dataset.hp = String(newHp);

    score += BOSS_SCORE_PER_HIT;
    combo += 1;
    if (combo > maxCombo) maxCombo = combo;

    burstAt(ev.clientX, ev.clientY, 'boss');

    logEvent({
      kind: 'boss-hit',
      mode: MODE,
      diff: DIFF,
      type: 'boss',
      emoji: emoji,
      spawnPerf: spawnPerfNum,
      clickPerf: clickPerf,
      rtMs: rtMs,
      correct: true,
      scoreAfter: score,
      comboAfter: combo,
      timeLeft: timeLeft,
      fever: (feverTicksLeft > 0),
      shieldBefore: shieldBefore,
      quests: {
        streak5: questState[0],
        comboTarget: questState[1],
        feverTwice: questState[2]
      },
      profile: playerProfile || {}
    });

    if (newHp <= 0) {
      bossDefeated = true;
      score += BOSS_BONUS_CLEAR;
      item.style.opacity = '0';
      item.style.transform = 'scale(0.4)';
      setTimeout(removeItem, 120);
    } else {
      item.style.transform = 'scale(0.9)';
    }

    updateHUD();
  });

  host.appendChild(item);
}

// ---------- Export CSV ----------
function exportCSV() {
  if (!eventLog.length) {
    alert('ยังไม่มีข้อมูลสำหรับส่งออก');
    return;
  }

  // สรุปจาก eventLog
  const hits = eventLog.filter(e => e.kind === 'hit' || e.kind === 'boss-hit');
  const validForAcc = hits.filter(e => e.type === 'good' || e.type === 'junk' || e.type === 'boss');
  const correctHits = validForAcc.filter(e => e.correct);
  const accuracy = validForAcc.length
    ? (correctHits.length / validForAcc.length) * 100
    : 0;

  const rtSamples = hits
    .map(e => e.rtMs)
    .filter(v => typeof v === 'number' && v > 0);
  let rtAvg = 0;
  if (rtSamples.length) {
    const sum = rtSamples.reduce((a,b) => a + b, 0);
    rtAvg = sum / rtSamples.length;
  }

  const header = [
    'profile_name',
    'profile_grade',
    'profile_id',
    'mode',
    'diff',
    'kind',
    'type',
    'emoji',
    'correct',
    'rt_ms',
    'score_after',
    'combo_after',
    'time_left',
    'fever',
    'shield_before',
    'quest_streak5_done',
    'quest_combo_done',
    'quest_fever_done'
  ];

  const lines = [header.join(',')];

  eventLog.forEach(e => {
    const row = [
      JSON.stringify((playerProfile.name || '')).replace(/"/g,'""'),
      JSON.stringify((playerProfile.grade || '')).replace(/"/g,'""'),
      JSON.stringify((playerProfile.sid || '')).replace(/"/g,'""'),
      e.mode,
      e.diff,
      e.kind,
      e.type,
      JSON.stringify(e.emoji || '').replace(/"/g,'""'),
      e.correct ? '1' : '0',
      (e.rtMs != null ? e.rtMs : ''),
      e.scoreAfter,
      e.comboAfter,
      e.timeLeft,
      e.fever ? '1' : '0',
      e.shieldBefore,
      e.quests && e.quests.streak5 && e.quests.streak5.done ? '1' : '0',
      e.quests && e.quests.comboTarget && e.quests.comboTarget.done ? '1' : '0',
      e.quests && e.quests.feverTwice && e.quests.feverTwice.done ? '1' : '0'
    ];
    lines.push(row.join(','));
  });

  const csvContent = '\uFEFF' + lines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const urlBlob = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const safeMode = MODE || 'mode';
  const safeDiff = DIFF || 'diff';
  const ts = new Date().toISOString().replace(/[:.]/g,'-');
  a.href = urlBlob;
  a.download = 'HeroHealth_' + safeMode + '_' + safeDiff + '_' + ts + '.csv';
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(urlBlob);
  }, 300);
}

// ---------- End Game ----------
function computeAndShowResult() {
  const hits = eventLog.filter(e => e.kind === 'hit' || e.kind === 'boss-hit');
  const validForAcc = hits.filter(e => e.type === 'good' || e.type === 'junk' || e.type === 'boss');
  const correctHits = validForAcc.filter(e => e.correct);
  const accuracy = validForAcc.length
    ? (correctHits.length / validForAcc.length) * 100
    : 0;

  const rtSamples = hits
    .map(e => e.rtMs)
    .filter(v => typeof v === 'number' && v > 0);
  let rtAvg = 0;
  if (rtSamples.length) {
    const sum = rtSamples.reduce((a,b) => a + b, 0);
    rtAvg = sum / rtSamples.length;
  }

  const result = $('#hha-result');
  const fs = $('#hha-final-score');
  const fc = $('#hha-final-combo');
  const fg = $('#hha-final-good');
  const fa = $('#hha-final-acc');
  const frt = $('#hha-final-rt');
  const fq = $('#hha-final-quests');
  const fboss = $('#hha-final-boss');
  const title = $('#hha-result-title');

  const missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;
  const questDoneCount = questState.filter(q => q.done).length;

  if (fs) fs.textContent = String(score);
  if (fc) fc.textContent = String(maxCombo);
  if (fg) fg.textContent = String(missionGoodCount);
  if (fa) fa.textContent = accuracy.toFixed(1) + '%';
  if (frt) frt.textContent = rtSamples.length ? rtAvg.toFixed(1) : '–';
  if (fq) fq.textContent = String(questDoneCount);
  if (fboss) fboss.textContent = bossSpawned
    ? (bossDefeated ? 'ล้ม Boss ได้สำเร็จ 🎯' : 'Boss หนีไปได้…')
    : 'ยังไม่พบ Boss';

  if (title) {
    if (missionSuccess) {
      title.textContent = 'ภารกิจสำเร็จ! 🎉';
    } else {
      title.textContent = 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
    }
  }

  if (result) result.style.display = 'flex';

  if (window.HH_COACH && typeof window.HH_COACH.onRoundEnd === 'function') {
    window.HH_COACH.onRoundEnd({
      mode: MODE,
      diff: DIFF,
      score: score,
      maxCombo: maxCombo,
      missionGoodCount: missionGoodCount,
      missionTarget: MISSION_GOOD_TARGET,
      accuracy: accuracy,
      avgRT: rtAvg,
      quests: questState,
      boss: { spawned: bossSpawned, defeated: bossDefeated }
    });
  }
}

function endGame() {
  if (!running) return;
  running = false;
  if (spawnTimer) clearInterval(spawnTimer);
  if (tickTimer) clearInterval(tickTimer);
  spawnTimer = null;
  tickTimer = null;

  computeAndShowResult();
}

// ---------- Game loop ----------
function startGame() {
  if (running) return;
  running = true;

  score = 0;
  combo = 0;
  maxCombo = 0;
  missionGoodCount = 0;
  activeItems = 0;
  shieldCharges = 0;
  feverTicksLeft = 0;
  feverTriggeredCount = 0;
  streakGoodNoJunk = 0;
  bossSpawned = false;
  bossDefeated = false;

  questState.forEach(q => {
    q.done = false;
    q.progress = 0;
  });

  eventLog.length = 0;
  timeLeft = GAME_DURATION;
  roundStartPerf = performance.now();

  updateHUD();

  const host = createHost();
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

    // spawn boss ในช่วงท้าย
    if (timeLeft <= BOSS_WINDOW_SEC && !bossSpawned) {
      spawnBoss(host);
    }

    updateHUD();
  }, 1000);
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

  const backBtn = $('#hha-back-hub');
  if (backBtn) {
    backBtn.addEventListener('click', function() {
      window.location.href = './hub.html';
    });
  }

  const csvBtn = $('#hha-export-csv');
  if (csvBtn) {
    csvBtn.addEventListener('click', exportCSV);
  }

  startGame();

  console.log('[HHA DOM] Multiverse Engine ready', {
    MODE,
    DIFF,
    GAME_DURATION,
    SPAWN_INTERVAL,
    ITEM_LIFETIME,
    MAX_ACTIVE,
    TYPE_WEIGHTS,
    SIZE_FACTOR,
    MISSION_GOOD_TARGET
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
