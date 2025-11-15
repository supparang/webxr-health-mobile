// === Hero Health — game/main.js (DOM Engine + Goals/Quests + CSV + Coach) ===

'use strict';

// ---------- URL & mode params ----------
var url = new URL(window.location.href);

var MODE_KEY = (url.searchParams.get('mode') || 'goodjunk').toLowerCase();
var DIFF = (url.searchParams.get('diff') || 'normal').toLowerCase();

var timeParam = parseInt(url.searchParams.get('time'), 10);
if (isNaN(timeParam) || timeParam <= 0) timeParam = 60;
if (timeParam < 20) timeParam = 20;
if (timeParam > 180) timeParam = 180;
var GAME_DURATION = timeParam;

// optional profile: name, room, age
function getPlayerProfileFromURL() {
  var name = url.searchParams.get('name') || '';
  var room = url.searchParams.get('room') || '';
  var ageStr = url.searchParams.get('age') || '';
  var age = parseInt(ageStr, 10);
  if (isNaN(age)) age = null;
  return { name: name, room: room, age: age };
}

// resolve mode impl
var MODE_IMPL = (window.HH_MODES && window.HH_MODES[MODE_KEY]) || null;

// fallback ถ้าไม่พบโหมด
if (!MODE_IMPL) {
  console.warn('[HHA] ไม่พบโหมดเกม:', MODE_KEY, 'ใน window.HH_MODES');
  // ลอง fallback เป็น goodjunk
  if (window.HH_MODES && window.HH_MODES.goodjunk) {
    MODE_KEY = 'goodjunk';
    MODE_IMPL = window.HH_MODES.goodjunk;
  } else {
    // ถ้ายังไม่มี ให้ใช้ object dummy กันเกมพัง
    MODE_IMPL = {
      id: 'dummy',
      label: 'Dummy',
      setupForDiff: function () {
        return {
          SPAWN_INTERVAL: 700,
          ITEM_LIFETIME: 1400,
          MAX_ACTIVE: 4,
          MISSION_GOOD_TARGET: 20,
          SIZE_FACTOR: 1.0,
          TYPE_WEIGHTS: { good: 1 },
          FEVER_DURATION: 0,
          DIAMOND_TIME_BONUS: 0
        };
      },
      missionText: function () {
        return 'ไม่พบโหมดจริง ใช้โหมดทดสอบชั่วคราว';
      },
      pickEmoji: function () { return '❓'; }
    };
  }
}

var MODE_LABEL = MODE_IMPL && MODE_IMPL.label ? MODE_IMPL.label : MODE_KEY.toUpperCase();

// ---------- Config from mode ----------
var modeCfg = MODE_IMPL.setupForDiff ? MODE_IMPL.setupForDiff(DIFF) : {
  SPAWN_INTERVAL: 700,
  ITEM_LIFETIME: 1400,
  MAX_ACTIVE: 4,
  MISSION_GOOD_TARGET: 20,
  SIZE_FACTOR: 1.0,
  TYPE_WEIGHTS: { good: 1, junk: 1 },
  FEVER_DURATION: 5,
  DIAMOND_TIME_BONUS: 2
};

var SPAWN_INTERVAL      = modeCfg.SPAWN_INTERVAL;
var ITEM_LIFETIME       = modeCfg.ITEM_LIFETIME;
var MAX_ACTIVE          = modeCfg.MAX_ACTIVE;
var MISSION_GOOD_TARGET = modeCfg.MISSION_GOOD_TARGET;
var SIZE_FACTOR         = modeCfg.SIZE_FACTOR;
var TYPE_WEIGHTS        = modeCfg.TYPE_WEIGHTS || { good: 1 };
var FEVER_DURATION      = modeCfg.FEVER_DURATION || 0;
var DIAMOND_TIME_BONUS  = modeCfg.DIAMOND_TIME_BONUS || 0;

// ---------- Goals & Quests ----------
var GOALS = [];
if (typeof MODE_IMPL.goalDefs === 'function') {
  GOALS = MODE_IMPL.goalDefs(DIFF) || [];
}
if (!GOALS.length) {
  GOALS = [{
    id: 'good_main',
    label: 'เก็บของดีให้ครบตามเป้า',
    type: 'count',
    target: MISSION_GOOD_TARGET,
    weight: 1
  }];
}

var QUESTS = [];
if (typeof MODE_IMPL.questDefs === 'function') {
  QUESTS = MODE_IMPL.questDefs(DIFF) || [];
}

// quest state
var questState = {}; // id -> { done: bool }
for (var i = 0; i < QUESTS.length; i++) {
  questState[QUESTS[i].id] = { done: false };
}

// session info (สำหรับ CSV)
var SESSION_INFO = {};
if (typeof MODE_IMPL.sessionInfo === 'function') {
  SESSION_INFO = MODE_IMPL.sessionInfo() || {};
}

// ---------- Game state ----------
var score = 0;
var combo = 0;
var maxCombo = 0;
var timeLeft = GAME_DURATION;
var running = false;
var spawnTimer = null;
var tickTimer = null;

var missionGoodCount = 0;
var activeItems = 0;
var shieldCharges = 0;
var feverTicksLeft = 0;
var lastFeverActive = false;

var goodClicks = 0;
var junkClicks = 0;
var totalClicks = 0;
var goodStreak = 0;

// สำหรับ fast quest
var lastClickAt = 0;

// logs สำหรับ CSV
var SESSION_LOGS = [];

// flag HUD
var hudCreated = false;

// ---------- DOM helpers ----------
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }

// host (พื้นที่ปล่อยเป้า)
function createHost() {
  var host = document.getElementById('hha-dom-host');
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

// FX layer
function createFXLayer() {
  var fx = document.getElementById('hha-fx-layer');
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
  var st = document.createElement('style');
  st.id = 'hha-game-css';
  st.textContent = `
    /* ลอยเป้าเบา ๆ */
    @keyframes hha-float {
      0%   { transform: translate3d(0,0,0); }
      50%  { transform: translate3d(0,-12px,0); }
      100% { transform: translate3d(0,0,0); }
    }

    /* HUD สั่นเบา ๆ ตอน Fever */
    @keyframes hha-hud-shake {
      0%   { transform: translateX(-50%) translateY(0); }
      50%  { transform: translateX(-50%) translateY(1px); }
      100% { transform: translateX(-50%) translateY(-1px); }
    }

    /* glow รอบขอบจอ ตอน Fever */
    body.hha-fever-active::before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 8999;
      border-radius: 24px;
      box-shadow:
        0 0 40px rgba(248,113,113,0.55),
        0 0 80px rgba(249,115,22,0.55);
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

// ---------- Quest UI ----------
function renderQuestChips() {
  var row = document.getElementById('hha-quest-row');
  if (!row) return;
  row.innerHTML = '';
  if (!QUESTS.length) return;

  for (var i = 0; i < QUESTS.length; i++) {
    var q = QUESTS[i];
    var st = questState[q.id];
    var chip = document.createElement('div');
    chip.id = 'hha-quest-' + q.id;
    chip.setAttribute('data-qid', q.id);
    chip.textContent = (q.icon ? (q.icon + ' ') : '') + (q.text || q.label || q.id);
    chip.style.borderRadius = '999px';
    chip.style.padding = '4px 8px';
    chip.style.fontSize = '11px';
    chip.style.border = '1px solid rgba(148,163,184,0.8)';
    chip.style.background = st && st.done
      ? 'linear-gradient(135deg,#22c55e,#16a34a)'
      : 'rgba(15,23,42,0.9)';
    chip.style.color = st && st.done ? '#f9fafb' : '#e5e7eb';
    chip.style.boxShadow = st && st.done ? '0 0 12px rgba(34,197,94,0.6)' : 'none';
    row.appendChild(chip);
  }
}

function markQuestDone(qid) {
  var st = questState[qid];
  if (!st || st.done) return;
  st.done = true;

  var chip = document.getElementById('hha-quest-' + qid);
  if (chip) {
    chip.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
    chip.style.color = '#f9fafb';
    chip.style.boxShadow = '0 0 12px rgba(34,197,94,0.6)';

    chip.style.transform = 'scale(1.05)';
    chip.style.transition = 'transform 0.15s ease';
    setTimeout(function () {
      chip.style.transform = 'scale(1)';
    }, 160);
  }

  if (window.HH_COACH && typeof window.HH_COACH.onQuestComplete === 'function') {
    var qDef = null;
    for (var i = 0; i < QUESTS.length; i++) {
      if (QUESTS[i].id === qid) { qDef = QUESTS[i]; break; }
    }
    window.HH_COACH.onQuestComplete({ id: qid, label: qDef && (qDef.text || qDef.label || qid) });
  }
}

// ---------- HUD ----------
function createHUD() {
  // ลบ HUD เก่า ถ้ามี
  var oldHud = document.getElementById('hha-hud');
  if (oldHud && oldHud.parentNode) {
    oldHud.parentNode.removeChild(oldHud);
  }

  hudCreated = true;

  var hud = document.createElement('div');
  hud.id = 'hha-hud';

  var profile = getPlayerProfileFromURL();
  var profileLine = '';
  if (profile.name || profile.room) {
    profileLine = '👤 ' + (profile.name || 'ไม่ระบุชื่อ');
    if (profile.room) profileLine += ' • ' + profile.room;
    if (profile.age) profileLine += ' • ' + profile.age + ' ปี';
  }

  var missionText = (typeof MODE_IMPL.missionText === 'function')
    ? MODE_IMPL.missionText(MISSION_GOOD_TARGET)
    : ('ภารกิจ: เก็บให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น');

  var modeLabel = MODE_LABEL;
  var diffLabel = DIFF.toUpperCase();

  hud.innerHTML = [
    '<div id="hha-hud-inner"',
    '  style="',
    '    position:fixed;top:16px;left:50%;transform:translateX(-50%);',
    '    background:linear-gradient(135deg, rgba(15,23,42,0.96), rgba(15,23,42,0.98));',
    '    border-radius:18px;padding:10px 18px;',
    '    display:flex;flex-direction:column;gap:6px;',
    '    box-shadow:0 18px 40px rgba(0,0,0,0.65);',
    '    border:1px solid rgba(56,189,248,0.4);',
    '    z-index:9100;font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;',
    '    font-size:14px;min-width:260px;max-width:480px;',
    '  ">',
    '  <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">',
    '    <div>',
    '      <div>คะแนน</div>',
    '      <div id="hha-score" style="text-align:left;font-weight:700;font-size:20px;">0</div>',
    '    </div>',
    '    <div>',
    '      <div>คอมโบ</div>',
    '      <div id="hha-combo" style="text-align:right;font-weight:700;font-size:20px;">0</div>',
    '    </div>',
    '  </div>',

    '  <div style="font-size:12px;color:#cbd5f5;display:flex;flex-direction:column;gap:4px;">',
    '    <div id="hha-mission-text">' + missionText + '</div>',
    '    <div style="width:100%;height:6px;border-radius:999px;background:rgba(15,23,42,0.9);overflow:hidden;border:1px solid rgba(148,163,184,0.7);">',
    '      <div id="hha-mission-bar" style="width:0%;height:100%;border-radius:999px;background:linear-gradient(90deg,#22c55e,#16a34a);"></div>',
    '    </div>',
    '    <div id="hha-buffs" style="margin-top:2px;">',
    '      ⭐ คอมโบสูงสุด: <span id="hha-buff-star">0</span>',
    '      &nbsp;|&nbsp; 🛡 เกราะ: <span id="hha-buff-shield">0</span>',
    '      &nbsp;|&nbsp; 🔥 Fever: <span id="hha-buff-fever">0</span>s',
    '    </div>',
    '    <div id="hha-fever-banner"',
    '      style="margin-top:2px;font-size:13px;font-weight:700;color:#fed7aa;',
    '             letter-spacing:0.04em;text-shadow:0 0 10px rgba(248,250,252,0.4);',
    '             opacity:0;transform:translateY(-4px);',
    '             transition:opacity 0.18s ease, transform 0.18s ease;">',
    '      FEVER!! 🔥 x2 คะแนน',
    '    </div>',
    '  </div>',

    '  <div id="hha-quest-row" style="margin-top:4px;font-size:11px;color:#e5e7ff;display:flex;flex-wrap:wrap;gap:4px;"></div>',

    (profileLine
      ? '<div style="margin-top:4px;font-size:11px;color:#9ca3af;">' + profileLine + '</div>'
      : ''),

    '</div>',

    '<div id="hha-timebox"',
    '  style="position:fixed;top:16px;right:16px;',
    '         background:rgba(15,23,42,0.96);border-radius:999px;',
    '         padding:6px 14px;border:1px solid rgba(148,163,184,0.9);',
    '         font-size:13px;z-index:9100;font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;">',
    '  <span id="hha-timebox-label">' + modeLabel + ' • ' + diffLabel + '</span>',
    '  &nbsp;•&nbsp;<span id="hha-time">0</span>s',
    '</div>',

    '<div id="hha-result" style="position:fixed;inset:0;display:none;align-items:center;justify-content:center;z-index:9200;">',
    '  <div style="background:rgba(15,23,42,0.97);border-radius:18px;padding:20px 26px;min-width:260px;',
    '              border:1px solid rgba(34,197,94,0.8);text-align:center;box-shadow:0 18px 40px rgba(0,0,0,0.75);',
    '              font-family:system-ui,Segoe UI,Inter,Roboto,sans-serif;">',
    '    <h2 id="hha-result-title" style="margin-top:0;margin-bottom:8px;font-size:18px;">จบรอบแล้ว 🎉</h2>',
    '    <div style="margin-bottom:4px;">คะแนนรวม: <b id="hha-final-score">0</b></div>',
    '    <div style="margin-bottom:4px;">คอมโบสูงสุด: <b id="hha-final-combo">0</b></div>',
    '    <div style="margin-bottom:4px;">ของดีที่เก็บได้: <b id="hha-final-good">0</b> / ' + MISSION_GOOD_TARGET + '</div>',
    '    <div style="margin-bottom:8px;">Rank: ',
    '      <span id="hha-rank-badge" style="display:inline-flex;align-items:center;justify-content:center;',
    '          min-width:38px;height:24px;border-radius:999px;',
    '          background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;font-weight:700;">–</span>',
    '    </div>',
    '    <div id="hha-result-goals" style="margin-bottom:8px;font-size:12px;color:#cbd5f5;text-align:left;"></div>',
    '    <div id="hha-result-quests" style="margin-bottom:10px;font-size:12px;color:#e5e7ff;text-align:left;"></div>',
    '    <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">',
    '      <button id="hha-restart"',
    '        style="border-radius:999px;border:0;cursor:pointer;padding:8px 18px;',
    '               background:linear-gradient(135deg,#38bdf8,#2563eb);color:#fff;font-weight:600;font-size:14px;">',
    '        เล่นอีกครั้ง',
    '      </button>',
    '      <button id="hha-download-csv"',
    '        style="border-radius:999px;border:0;cursor:pointer;padding:7px 16px;font-size:12px;',
    '               background:rgba(15,23,42,0.96);color:#e5e7eb;border:1px solid rgba(148,163,184,0.8);">',
    '        📄 ดาวน์โหลดข้อมูล (CSV)',
    '      </button>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('');

  document.body.appendChild(hud);

  renderQuestChips();

  // attach CSV button
  var dl = document.getElementById('hha-download-csv');
  if (dl) {
    dl.addEventListener('click', function () {
      downloadCSV();
    });
  }

  // restart button
  var restartBtn = document.getElementById('hha-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', function () {
      var panel = document.getElementById('hha-result');
      if (panel) panel.style.display = 'none';
      startGame();
    });
  }
}

// ---------- Rank ----------
function calcRank(score, missionSuccess) {
  if (!missionSuccess) {
    if (score >= 300) return 'B';
    return 'C';
  }
  if (score >= 800) return 'S';
  if (score >= 500) return 'A';
  if (score >= 300) return 'B';
  return 'C';
}

// ---------- HUD Update ----------
function currentMultiplier() {
  return feverTicksLeft > 0 ? 2 : 1;
}

function updateHUD() {
  var sEl = document.getElementById('hha-score');
  var cEl = document.getElementById('hha-combo');
  var tEl = document.getElementById('hha-time');
  var mBar = document.getElementById('hha-mission-bar');
  var starEl = document.getElementById('hha-buff-star');
  var shieldEl = document.getElementById('hha-buff-shield');
  var feverEl = document.getElementById('hha-buff-fever');

  if (sEl) sEl.textContent = String(score);
  if (cEl) cEl.textContent = String(combo);
  if (tEl) tEl.textContent = String(timeLeft);

  if (mBar) {
    var ratio = Math.max(0, Math.min(1, missionGoodCount / MISSION_GOOD_TARGET));
    mBar.style.width = (ratio * 100).toFixed(1) + '%';
  }

  if (starEl) starEl.textContent = String(maxCombo);
  if (shieldEl) shieldEl.textContent = String(shieldCharges);
  if (feverEl) feverEl.textContent = String(Math.max(0, feverTicksLeft));

  // --- เอฟเฟกต์ตอน Fever ---
  var body = document.body;
  var hudInner = document.getElementById('hha-hud-inner');
  var banner = document.getElementById('hha-fever-banner');

  var feverActive = feverTicksLeft > 0;

  if (feverActive) {
    if (body) body.classList.add('hha-fever-active');
    if (hudInner) hudInner.style.animation = 'hha-hud-shake 0.12s infinite alternate';
    if (banner) {
      banner.style.opacity = '1';
      banner.style.transform = 'translateY(0)';
    }
  } else {
    if (body) body.classList.remove('hha-fever-active');
    if (hudInner) hudInner.style.animation = '';
    if (banner) {
      banner.style.opacity = '0';
      banner.style.transform = 'translateY(-4px)';
    }
  }

  // แจ้งโค้ชเมื่อ Fever on/off เปลี่ยนสถานะ
  if (feverActive !== lastFeverActive) {
    if (window.HH_COACH) {
      if (feverActive && typeof window.HH_COACH.onFeverStart === 'function') {
        window.HH_COACH.onFeverStart({ mode: MODE_KEY, diff: DIFF });
      } else if (!feverActive && typeof window.HH_COACH.onFeverEnd === 'function') {
        window.HH_COACH.onFeverEnd({ mode: MODE_KEY, diff: DIFF });
      }
    }
    lastFeverActive = feverActive;
  }
}

// ---------- Particle FX ----------
function burstAt(x, y, kind) {
  var fxLayer = createFXLayer();
  var container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    left: x + 'px',
    top: y + 'px',
    width: '0',
    height: '0',
    pointerEvents: 'none',
    zIndex: '9060'
  });

  var shardCount = 10;
  var base;
  switch (kind) {
    case 'good':
      base = 'rgba(34,197,94,'; break;
    case 'star':
    case 'gold':
    case 'diamond':
    case 'rainbow':
      base = 'rgba(250,204,21,'; break;
    case 'shield':
      base = 'rgba(59,130,246,'; break;
    case 'fever':
      base = 'rgba(248,113,113,'; break;
    case 'bad':
    default:
      base = 'rgba(239,68,68,'; break;
  }

  for (var i = 0; i < shardCount; i++) {
    var shard = document.createElement('div');
    var size = 6 + Math.random() * 6;
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

    var angle = Math.random() * Math.PI * 2;
    var distance = 30 + Math.random() * 40;
    var dx = Math.cos(angle) * distance;
    var dy = Math.sin(angle) * distance;

    requestAnimationFrame((function (sh, dx, dy) {
      return function () {
        sh.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.1)';
        sh.style.opacity = '0';
      };
    })(shard, dx, dy));
  }

  fxLayer.appendChild(container);
  setTimeout(function () {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }, 320);
}

// ---------- Type picker ----------
function pickType() {
  var entries = Object.keys(TYPE_WEIGHTS);
  if (!entries.length) return 'good';
  var total = 0;
  for (var i = 0; i < entries.length; i++) {
    total += TYPE_WEIGHTS[entries[i]] || 0;
  }
  if (total <= 0) return 'good';
  var r = Math.random() * total;
  var acc = 0;
  for (var j = 0; j < entries.length; j++) {
    var key = entries[j];
    var w = TYPE_WEIGHTS[key] || 0;
    acc += w;
    if (r <= acc) return key;
  }
  return 'good';
}

// ---------- Quest Progress ----------
function updateQuestsOnHit(type, isGood, isJunk, meta) {
  if (!QUESTS.length) return;
  var now = performance.now();

  // streak ของ good
  if (isGood) {
    goodStreak++;
  } else if (isJunk) {
    goodStreak = 0;
  }

  // reaction time
  var reactionSec = null;
  if (meta && meta.bornAt) {
    reactionSec = (now - meta.bornAt) / 1000;
  }

  for (var i = 0; i < QUESTS.length; i++) {
    var q = QUESTS[i];
    var st = questState[q.id];
    if (!q || !st || st.done) continue;

    if (q.kind === 'streak') {
      var threshold = q.threshold || 10;
      if (goodStreak >= threshold) {
        markQuestDone(q.id);
      }
    } else if (q.kind === 'fast') {
      var fastLimit = q.threshold || 0.8;
      if (reactionSec != null && reactionSec <= fastLimit) {
        markQuestDone(q.id);
      }
    } else if (q.kind === 'fever') {
      if (feverTicksLeft > 0) {
        markQuestDone(q.id);
      }
    }
  }
}

// ---------- Spawn logic ----------
function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function spawnOne(host) {
  if (!running) return;
  if (activeItems >= MAX_ACTIVE) return;

  var type = pickType();
  var emo = '❓';
  if (typeof MODE_IMPL.pickEmoji === 'function') {
    emo = MODE_IMPL.pickEmoji(type);
  }

  var item = document.createElement('button');
  item.type = 'button';
  item.textContent = emo;
  item.setAttribute('data-type', type);
  item.setAttribute('data-born', String(performance.now()));

  var shortest = Math.min(window.innerWidth, window.innerHeight);
  var baseSize = shortest < 700 ? 72 : 80;
  var size = Math.round(baseSize * SIZE_FACTOR);

  var baseStyle = {
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

  var vw = window.innerWidth;
  var vh = window.innerHeight;
  var x = 0.1 * vw + Math.random() * 0.8 * vw;
  var y = 0.18 * vh + Math.random() * 0.7 * vh;
  item.style.left = String(x - size / 2) + 'px';
  item.style.top = String(y - size / 2) + 'px';

  activeItems++;

  function removeItem() {
    if (item.parentNode) {
      item.parentNode.removeChild(item);
      activeItems = Math.max(0, activeItems - 1);
    }
  }

  item.addEventListener('click', function (ev) {
    if (!running) return;

    var type = item.getAttribute('data-type') || 'good';
    var bornStr = item.getAttribute('data-born');
    var bornAt = bornStr ? parseFloat(bornStr) : null;

    if (navigator.vibrate) {
      if (type === 'junk') navigator.vibrate(60);
      else if (type === 'shield' || type === 'fever') navigator.vibrate(40);
      else navigator.vibrate(25);
    }
    burstAt(ev.clientX, ev.clientY, type === 'junk' ? 'bad' : type);

    var mult = currentMultiplier();
    var isGood = false;
    var isJunk = false;
    var isPower = false;

    if (type === 'good') {
      score += 10 * mult;
      combo += 1;
      missionGoodCount += 1;
      goodClicks++;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
      isGood = true;
    } else if (type === 'star') {
      score += 15 * mult;
      combo += 2;
      missionGoodCount += 1;
      goodClicks++;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.28)';
      isPower = true;
    } else if (type === 'gold') {
      score += 20 * mult;
      combo += 2;
      missionGoodCount += 2;
      goodClicks++;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.3)';
      isPower = true;
    } else if (type === 'diamond') {
      score += 30 * mult;
      combo += 3;
      missionGoodCount += 2;
      goodClicks++;
      timeLeft += DIAMOND_TIME_BONUS;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.32)';
      isPower = true;
    } else if (type === 'shield') {
      shieldCharges += 1;
      item.style.transform = 'scale(1.2)';
      isPower = true;
    } else if (type === 'fever') {
      feverTicksLeft = Math.max(feverTicksLeft, FEVER_DURATION);
      item.style.transform = 'scale(1.25)';
      isPower = true;
    } else if (type === 'rainbow') {
      score += 25 * mult;
      combo += 2;
      missionGoodCount += 2;
      goodClicks++;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.3)';
      isPower = true;
    } else if (type === 'junk') {
      isJunk = true;
      junkClicks++;
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        item.style.transform = 'scale(0.9)';
      } else {
        score = Math.max(0, score - 5);
        combo = 0;
        goodStreak = 0;
        item.style.transform = 'scale(0.7)';
        var oldBg = document.body.style.backgroundColor || '#0b1220';
        document.body.style.backgroundColor = '#450a0a';
        setTimeout(function () {
          document.body.style.backgroundColor = oldBg || '#0b1220';
        }, 80);
      }
    }

    totalClicks++;
    lastClickAt = performance.now();

    // update quests
    updateQuestsOnHit(type, isGood, isJunk, { bornAt: bornAt });

    // coach on hit
    if (window.HH_COACH && typeof window.HH_COACH.onHit === 'function') {
      window.HH_COACH.onHit({
        type: type,
        isGood: isGood,
        isJunk: isJunk,
        isPower: isPower,
        combo: combo,
        score: score,
        feverActive: (feverTicksLeft > 0),
        diff: DIFF,
        mode: MODE_KEY
      });
    }

    item.style.opacity = '0';
    updateHUD();
    setTimeout(removeItem, 100);
  });

  host.appendChild(item);

  setTimeout(function () {
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
  lastFeverActive = false;
  goodClicks = 0;
  junkClicks = 0;
  totalClicks = 0;
  goodStreak = 0;

  // reset quests
  for (var qid in questState) {
    if (Object.prototype.hasOwnProperty.call(questState, qid)) {
      questState[qid].done = false;
    }
  }
  renderQuestChips();

  updateHUD();

  var host = createHost();
  createFXLayer();
  ensureGameCSS();

  // แจ้งโค้ชว่ารอบใหม่เริ่มแล้ว
  if (window.HH_COACH && typeof window.HH_COACH.onGameStart === 'function') {
    var profile = getPlayerProfileFromURL();
    window.HH_COACH.onGameStart({
      mode: MODE_KEY,
      modeLabel: MODE_LABEL,
      diff: DIFF,
      diffLabel: DIFF.toUpperCase(),
      playerName: profile && profile.name ? profile.name : null
    });
  }

  if (spawnTimer) clearInterval(spawnTimer);
  if (tickTimer) clearInterval(tickTimer);

  spawnTimer = setInterval(function () {
    spawnOne(host);
  }, SPAWN_INTERVAL);

  tickTimer = setInterval(function () {
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

  var missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;
  var rank = calcRank(score, missionSuccess);

  var result = document.getElementById('hha-result');
  var fs = document.getElementById('hha-final-score');
  var fc = document.getElementById('hha-final-combo');
  var fg = document.getElementById('hha-final-good');
  var title = document.getElementById('hha-result-title');
  var rankBadge = document.getElementById('hha-rank-badge');

  if (fs) fs.textContent = String(score);
  if (fc) fc.textContent = String(maxCombo);
  if (fg) fg.textContent = String(missionGoodCount);
  if (title) {
    title.textContent = missionSuccess
      ? 'ภารกิจสำเร็จ! 🎉'
      : 'ยังไม่ผ่านภารกิจ ลองอีกทีนะ 💪';
  }
  if (rankBadge) rankBadge.textContent = rank;

  // goals summary
  var goalsBox = document.getElementById('hha-result-goals');
  if (goalsBox) {
    var html = '';
    html += '<div><b>เป้าหมายหลัก</b></div>';
    html += '<ul style="padding-left:18px;margin:4px 0 0 0;font-size:12px;">';
    html += '<li>เก็บของดีได้ ' + missionGoodCount + ' / ' + MISSION_GOOD_TARGET + ' ชิ้น</li>';
    html += '<li>คอมโบสูงสุด ' + maxCombo + '</li>';
    html += '</ul>';
    goalsBox.innerHTML = html;
  }

  // quests summary
  var questsBox = document.getElementById('hha-result-quests');
  if (questsBox) {
    if (!QUESTS.length) {
      questsBox.textContent = '';
    } else {
      var list = '<div><b>Mini Quest</b></div><ul style="padding-left:18px;margin:4px 0 0 0;font-size:12px;">';
      for (var i = 0; i < QUESTS.length; i++) {
        var q = QUESTS[i];
        var st = questState[q.id];
        var done = st && st.done;
        list += '<li>' + (done ? '✅ ' : '⬜ ') +
          (q.icon ? (q.icon + ' ') : '') +
          (q.text || q.label || q.id) + '</li>';
      }
      list += '</ul>';
      questsBox.innerHTML = list;
    }
  }

  // log session for CSV
  var profile = getPlayerProfileFromURL();
  SESSION_LOGS.push({
    ts: new Date().toISOString(),
    mode: MODE_KEY,
    modeLabel: MODE_LABEL,
    diff: DIFF,
    duration: GAME_DURATION,
    score: score,
    maxCombo: maxCombo,
    goodCount: missionGoodCount,
    missionTarget: MISSION_GOOD_TARGET,
    missionSuccess: missionSuccess,
    rank: rank,
    goodClicks: goodClicks,
    junkClicks: junkClicks,
    totalClicks: totalClicks,
    playerName: profile.name || '',
    playerRoom: profile.room || '',
    playerAge: profile.age != null ? profile.age : '',
    topic: SESSION_INFO.topic || '',
    groupId: SESSION_INFO.groupId || '',
    groupLabel: SESSION_INFO.groupLabel || '',
    groupIcon: SESSION_INFO.groupIcon || ''
  });

  // coach summary
  if (window.HH_COACH && typeof window.HH_COACH.onMissionEnd === 'function') {
    window.HH_COACH.onMissionEnd({
      success: missionSuccess,
      score: score,
      goodCount: missionGoodCount,
      combo: maxCombo,
      modeLabel: MODE_LABEL,
      diffLabel: DIFF.toUpperCase()
    });
  }

  if (result) result.style.display = 'flex';
}

// ---------- CSV Download ----------
function downloadCSV() {
  if (!SESSION_LOGS.length) {
    alert('ยังไม่มีข้อมูลรอบการเล่นสำหรับดาวน์โหลด');
    return;
  }

  var headers = [
    'timestamp',
    'mode',
    'modeLabel',
    'diff',
    'durationSec',
    'score',
    'maxCombo',
    'goodCount',
    'missionTarget',
    'missionSuccess',
    'rank',
    'goodClicks',
    'junkClicks',
    'totalClicks',
    'playerName',
    'playerRoom',
    'playerAge',
    'topic',
    'groupId',
    'groupLabel',
    'groupIcon'
  ];

  var lines = [];
  lines.push(headers.join(','));

  for (var i = 0; i < SESSION_LOGS.length; i++) {
    var r = SESSION_LOGS[i];
    var row = [
      r.ts,
      r.mode,
      r.modeLabel,
      r.diff,
      r.duration,
      r.score,
      r.maxCombo,
      r.goodCount,
      r.missionTarget,
      r.missionSuccess ? 1 : 0,
      r.rank,
      r.goodClicks,
      r.junkClicks,
      r.totalClicks,
      r.playerName,
      r.playerRoom,
      r.playerAge,
      r.topic,
      r.groupId,
      r.groupLabel,
      r.groupIcon
    ];
    lines.push(row.map(function (v) {
      if (v == null) return '';
      var s = String(v);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(','));
  }

  var csv = lines.join('\r\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var urlObj = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = urlObj;
  a.download = 'herohealth_sessions.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(function () {
    URL.revokeObjectURL(urlObj);
  }, 1000);
}

// ---------- Bootstrap ----------
function bootstrap() {
  ensureGameCSS();
  createHUD();
  createHost();
  createFXLayer();
  updateHUD();

  // init coach
  if (window.HH_COACH && typeof window.HH_COACH.init === 'function') {
    var profile = getPlayerProfileFromURL();
    window.HH_COACH.init({
      mode: MODE_KEY,
      modeLabel: MODE_LABEL,
      diff: DIFF,
      diffLabel: DIFF.toUpperCase(),
      playerName: profile && profile.name ? profile.name : null
    });
  }

  startGame();

  console.log('[HHA DOM] Engine ready', {
    mode: MODE_KEY,
    diff: DIFF,
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
