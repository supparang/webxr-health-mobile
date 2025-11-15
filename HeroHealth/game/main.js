// === Hero Health — game/main.js (Research + Fun + Deployment Pack) ===
// DOM Good vs Junk — Power-up + Rank + Research Logging + Boss + Rainbow + Pause

'use strict';

// ---------- Version & Research Config ----------
const GAME_VERSION = 'HHA-GoodJunk-ResearchPack-v1.2.0';

// ถ้าอยากส่งข้อมูลเข้า Google Sheet ให้ใส่ URL ของ Apps Script / Webhook ตรงนี้
// ถ้ายังไม่ตั้งค่า หรือปล่อยว่างไว้ ระบบจะไม่ส่ง (ไม่ error)
const SHEET_WEBHOOK_URL = ''; // เช่น 'https://script.google.com/macros/s/XXXX/exec'

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
  fever: 4,
  rainbow: 1
};

let FEVER_DURATION = 5;       // Fever นานกี่วินาที
let DIAMOND_TIME_BONUS = 2;   // diamond เพิ่มเวลานิดหน่อย
let FEVER_MULT_BASE = 2.2;    // ตัวคูณ fever พื้นฐาน

switch (DIFF) {
  case 'easy':
    SPAWN_INTERVAL = 900;
    ITEM_LIFETIME = 2100;
    MAX_ACTIVE = 3;
    MISSION_GOOD_TARGET = 15;
    SIZE_FACTOR = 1.30;
    TYPE_WEIGHTS = {
      good:    65,
      junk:    10,
      star:     7,
      gold:     7,
      diamond:  3,
      shield:   5,
      fever:    2,
      rainbow:  1
    };
    FEVER_DURATION = 5;
    DIAMOND_TIME_BONUS = 3;
    FEVER_MULT_BASE = 2.0;
    break;

  case 'hard':
    SPAWN_INTERVAL = 380;
    ITEM_LIFETIME = 800;
    MAX_ACTIVE = 7;
    MISSION_GOOD_TARGET = 30;
    SIZE_FACTOR = 0.80;
    TYPE_WEIGHTS = {
      good:    28,
      junk:    46,
      star:     7,
      gold:     5,
      diamond:  7,
      shield:   2,
      fever:   10,
      rainbow:  2
    };
    FEVER_DURATION = 6;
    DIAMOND_TIME_BONUS = 1;
    FEVER_MULT_BASE = 2.6;
    break;

  case 'normal':
  default:
    SPAWN_INTERVAL = 620;
    ITEM_LIFETIME = 1500;
    MAX_ACTIVE = 5;
    MISSION_GOOD_TARGET = 20;
    SIZE_FACTOR = 1.0;
    TYPE_WEIGHTS = {
      good:    50,
      junk:    24,
      star:     8,
      gold:     7,
      diamond:  5,
      shield:   3,
      fever:    6,
      rainbow:  2
    };
    FEVER_DURATION = 5;
    DIAMOND_TIME_BONUS = 2;
    FEVER_MULT_BASE = 2.3;
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
const RAINBOW = ['🌈'];

// ---------- State ----------
let score = 0;
let combo = 0;
let maxCombo = 0;
let timeLeft = GAME_DURATION;
let running = false;
let paused = false;
let spawnTimer = null;
let tickTimer = null;

let missionGoodCount = 0;   // จำนวนของดีที่เก็บได้
let activeItems = 0;        // เป้าบนจอปัจจุบัน

let shieldCharges = 0;      // เกราะสะสม
let feverTicksLeft = 0;     // จำนวนวินาที fever ที่เหลือ
let activeFeverMult = 1;    // ตัวคูณ fever ปัจจุบัน

let lastScore = 0;
let lastCombo = 0;

let bossSpawned = false;    // สปอว์นบอสแล้วหรือยัง
let bossDefeated = false;   // ฆ่าบอสทันไหม

// ---------- Research State ----------
let runId = '';
let runStartedAt = 0;
let eventLog = [];

let totalGoodSpawns = 0;
let totalJunkSpawns = 0;
let totalGoodClicks = 0;
let totalJunkClicks = 0;
let junkHitCount = 0;       // โดน junk แบบไม่มี shield
let shieldUseCount = 0;     // ใช้ shield กัน junk ได้จริง ๆ
let feverPickupCount = 0;   // เก็บ fever icon กี่ครั้ง
let feverSecondsAccum = 0;  // เวลาที่อยู่ในสถานะ fever สะสมทุก tick

// ---------- Helpers ----------
function $(sel) {
  return document.querySelector(sel);
}

function nowMs() {
  if (window.performance && performance.now) {
    return performance.now();
  }
  return Date.now();
}

// Event logger (ต่อรอบ)
function logEvent(kind, detail) {
  eventLog.push(Object.assign({
    t: Math.round(nowMs()),
    runId: runId,
    gameVersion: GAME_VERSION,
    mode: MODE,
    diff: DIFF,
    kind: kind
  }, detail || {}));
}

// localStorage summary: หลายรอบในไฟล์เดียว
const RUNS_KEY = 'hha_goodjunk_runs_v1';

function loadRunHistory() {
  try {
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    return [];
  }
}

function saveRunHistory(arr) {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(arr));
  } catch (e) {
    // เงียบพอ ไม่ต้องแจ้งเด็ก
  }
}

function appendRunSummary(summary) {
  const arr = loadRunHistory();
  arr.push(summary);
  saveRunHistory(arr);
}

// CSV helpers
function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// CSV: summary จาก localStorage (หลายรอบ)
function buildRunsCSV() {
  const runs = loadRunHistory();
  const header = [
    'timestamp',
    'runId',
    'gameVersion',
    'mode',
    'diff',
    'timeLimit',
    'score',
    'maxCombo',
    'goodCount',
    'missionTarget',
    'rank',
    'totalGoodSpawns',
    'totalJunkSpawns',
    'totalGoodClicks',
    'totalJunkClicks',
    'accuracyGood',
    'accuracyAll',
    'junkHitCount',
    'shieldUseCount',
    'feverPickupCount',
    'feverSeconds'
  ];
  const rows = [header.join(',')];

  for (let i = 0; i < runs.length; i++) {
    const r = runs[i] || {};
    rows.push([
      csvCell(r.timestamp),
      csvCell(r.runId),
      csvCell(r.gameVersion),
      csvCell(r.mode),
      csvCell(r.diff),
      csvCell(r.timeLimit),
      csvCell(r.score),
      csvCell(r.maxCombo),
      csvCell(r.goodCount),
      csvCell(r.missionTarget),
      csvCell(r.rank),
      csvCell(r.totalGoodSpawns),
      csvCell(r.totalJunkSpawns),
      csvCell(r.totalGoodClicks),
      csvCell(r.totalJunkClicks),
      csvCell(r.accuracyGood),
      csvCell(r.accuracyAll),
      csvCell(r.junkHitCount),
      csvCell(r.shieldUseCount),
      csvCell(r.feverPickupCount),
      csvCell(r.feverSecondsAccum)
    ].join(','));
  }

  return rows.join('\r\n');
}

// CSV: event-level log เฉพาะรอบล่าสุด
function buildEventsCSV() {
  const header = [
    'runId',
    'gameVersion',
    'mode',
    'diff',
    'kind',
    't_ms',
    'itemType',
    'x',
    'y',
    'spawnTimeMs',
    'reactionTimeMs',
    'score',
    'combo',
    'goodCount',
    'junkHit',
    'shield',
    'feverLeft',
    'feverMult'
  ];
  const rows = [header.join(',')];

  for (let i = 0; i < eventLog.length; i++) {
    const ev = eventLog[i] || {};
    rows.push([
      csvCell(ev.runId),
      csvCell(ev.gameVersion),
      csvCell(ev.mode),
      csvCell(ev.diff),
      csvCell(ev.kind),
      csvCell(ev.t),
      csvCell(ev.itemType),
      csvCell(ev.x),
      csvCell(ev.y),
      csvCell(ev.spawnTimeMs),
      csvCell(ev.reactionTimeMs),
      csvCell(ev.score),
      csvCell(ev.combo),
      csvCell(ev.goodCount),
      csvCell(ev.junkHit),
      csvCell(ev.shield),
      csvCell(ev.feverLeft),
      csvCell(ev.feverMult)
    ].join(','));
  }

  return rows.join('\r\n');
}

function downloadBlobCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const u = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = u;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(function() {
    document.body.removeChild(a);
    URL.revokeObjectURL(u);
  }, 0);
}

function downloadRunsCSV() {
  try {
    const csv = buildRunsCSV();
    if (!csv) {
      alert('ยังไม่มีข้อมูลสำหรับดาวน์โหลด');
      return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlobCSV(csv, 'herohealth-summary-' + MODE + '-' + DIFF + '-' + ts + '.csv');
  } catch (e) {
    console.error('[HHA] CSV summary export error', e);
    alert('ไม่สามารถดาวน์โหลดไฟล์สรุปได้');
  }
}

function downloadEventsCSV() {
  try {
    if (!eventLog.length) {
      alert('ยังไม่มีข้อมูลเหตุการณ์ของรอบนี้');
      return;
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    downloadBlobCSV(buildEventsCSV(), 'herohealth-events-' + MODE + '-' + DIFF + '-' + ts + '.csv');
  } catch (e) {
    console.error('[HHA] CSV events export error', e);
    alert('ไม่สามารถดาวน์โหลดไฟล์เหตุการณ์ได้');
  }
}

function resetResearchData() {
  if (!window.confirm('ล้างข้อมูลวิจัยทั้งหมดบนเครื่องนี้ใช่หรือไม่?')) return;
  saveRunHistory([]);
  const statsEl = $('#hha-research-stats');
  if (statsEl) {
    statsEl.textContent = 'สถิติโดยรวมบนเครื่องนี้: ยังไม่มีข้อมูล (เริ่มเก็บใหม่อีกครั้ง)';
  }
}

// Dashboard สถิติโดยรวม
function computeDayStats(runs) {
  if (!runs.length) return { totalDays: 0, streak: 0 };

  const daySet = new Set();
  runs.forEach(function(r) {
    if (!r || !r.timestamp) return;
    const d = String(r.timestamp).slice(0, 10); // YYYY-MM-DD
    daySet.add(d);
  });

  const days = Array.from(daySet).sort(); // จากเก่า → ใหม่
  if (!days.length) return { totalDays: 0, streak: 0 };

  let streak = 1;
  let cursor = new Date(days[days.length - 1]);
  while (true) {
    cursor.setDate(cursor.getDate() - 1);
    const d = cursor.toISOString().slice(0, 10);
    if (daySet.has(d)) streak++;
    else break;
  }

  return { totalDays: days.length, streak: streak };
}

function updateResearchStats() {
  const statsEl = $('#hha-research-stats');
  if (!statsEl) return;
  const runs = loadRunHistory();
  if (!runs.length) {
    statsEl.textContent = 'สถิติโดยรวมบนเครื่องนี้: ยังไม่มีข้อมูล (เล่นอย่างน้อย 1 รอบก่อน)';
    return;
  }
  let sumScore = 0;
  let sumGood = 0;
  let bestRank = 'C';
  const rankOrder = { C: 1, B: 2, A: 3, S: 4, SS: 5, SSS: 6 };
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i] || {};
    sumScore += r.score || 0;
    sumGood += r.goodCount || 0;
    const rk = r.rank || 'C';
    if ((rankOrder[rk] || 1) > (rankOrder[bestRank] || 1)) {
      bestRank = rk;
    }
  }
  const avgScore = Math.round(sumScore / runs.length);
  const avgGood = (sumGood / runs.length).toFixed(1);
  const dayStats = computeDayStats(runs);

  statsEl.textContent =
    'สถิติโดยรวมบนเครื่องนี้: ' +
    'เล่นทั้งหมด ' + runs.length + ' รอบ | ' +
    'เล่นมาแล้ว ' + dayStats.totalDays + ' วัน | ' +
    'ต่อเนื่อง ' + dayStats.streak + ' วันล่าสุด | ' +
    'คะแนนเฉลี่ย ' + avgScore +
    ' | ของดีเฉลี่ย ' + avgGood +
    ' | Rank สูงสุด ' + bestRank;
}

// ส่ง Summary ไป Google Sheet (ถ้าตั้ง URL)
function sendSummaryToSheet(summary) {
  if (!SHEET_WEBHOOK_URL) return; // ยังไม่ตั้งค่า → ไม่ทำอะไร
  try {
    fetch(SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summary)
    }).catch(function () {});
  } catch (e) {
    // เงียบไว้ ไม่กวนเด็ก
  }
}

// ---------- DOM host ----------
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

// Fever overlay
function createFeverOverlay() {
  let ov = $('#hha-fever-overlay');
  if (ov) return ov;
  ov = document.createElement('div');
  ov.id = 'hha-fever-overlay';
  Object.assign(ov.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '9040',
    background:
      'radial-gradient(circle at 50% 15%, rgba(248,113,113,0.35), transparent 60%),' +
      'radial-gradient(circle at 10% 80%, rgba(251,191,36,0.30), transparent 60%)',
    opacity: '0',
    transition: 'opacity 200ms ease-out'
  });
  document.body.appendChild(ov);
  return ov;
}

function setFeverOverlay(on) {
  const ov = createFeverOverlay();
  ov.style.opacity = on ? '1' : '0';
}

// Toast เล็ก ๆ สำหรับ feedback
let toastTimer = null;
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

function showToast(msg, kind) {
  const toast = createToastLayer();
  toast.textContent = msg;
  toast.style.borderColor = kind === 'bad'
    ? 'rgba(248,113,113,0.9)'
    : 'rgba(52,211,153,0.9)';
  toast.style.transform = 'translateX(-50%) translateY(0)';
  toast.style.opacity = '0';

  requestAnimationFrame(function () {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(4px)';
  });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(-4px)';
  }, 900);
}

// ---------- Global Error Guard ----------
window.addEventListener('error', function (e) {
  try {
    console.error('[HHA] runtime error', e.error || e.message || e);
    showToast('มีบางอย่างผิดพลาดเล็กน้อย แต่ยังเล่นต่อได้ 😊', 'bad');
  } catch (_) {}
});

window.addEventListener('unhandledrejection', function (e) {
  try {
    console.error('[HHA] unhandled promise', e.reason);
  } catch (_) {}
});

// ---------- CSS global + responsive HUD ----------
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
    @keyframes hha-pop {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.18); }
      100% { transform: scale(1); }
    }
    #hha-score.hha-pop,
    #hha-combo.hha-pop {
      animation: hha-pop 180ms ease-out;
    }
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

function getModeMissionText() {
  if (MODE === 'groups') {
    return 'ภารกิจวันนี้: เลือกของที่อยู่ “กลุ่มอาหารดี” ให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น';
  }
  if (MODE === 'hydration') {
    return 'ภารกิจวันนี้: เลือกเครื่องดื่มที่ดีต่อร่างกายให้ครบ ' + MISSION_GOOD_TARGET + ' แก้ว';
  }
  if (MODE === 'plate') {
    return 'ภารกิจวันนี้: เลือกอาหารที่เหมาะกับจานสุขภาพให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น';
  }
  return 'ภารกิจวันนี้: เก็บของดีให้ครบ ' + MISSION_GOOD_TARGET + ' ชิ้น';
}

function createHUD() {
  let hud = $('#hha-hud');
  if (hud) return hud;

  hud = document.createElement('div');
  hud.id = 'hha-hud';

  let missionBarColor = 'linear-gradient(90deg,#22c55e,#16a34a)';
  if (DIFF === 'easy') {
    missionBarColor = 'linear-gradient(90deg,#38bdf8,#2563eb)';
  } else if (DIFF === 'hard') {
    missionBarColor = 'linear-gradient(90deg,#f97316,#dc2626)';
  }

  const missionText = getModeMissionText();

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
          ${missionText}
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
          ⭐ คอมโบสูงสุด: <span id="hha-buff-star">0</span> |
          🛡 กันพลาด: <span id="hha-buff-shield">0</span> |
          🔥 พลังไฟ: <span id="hha-buff-fever">0</span>s
        </div>

        <div id="hha-level-row"
             style="
               font-size:11px;
               color:#e5e7eb;
               opacity:0.9;
               display:flex;
               flex-wrap:wrap;
               gap:6px;
               align-items:center;
             ">
          <span>เวอร์ชันวิจัย: <span>${GAME_VERSION}</span></span>
          <button id="hha-pause-btn"
            style="
              border-radius:999px;
              border:0;
              padding:2px 10px;
              font-size:11px;
              cursor:pointer;
              background:rgba(30,64,175,0.9);
              color:#e5e7eb;
            ">
            หยุดพัก ⏸️
          </button>
          <button id="hha-resume-btn"
            style="
              border-radius:999px;
              border:0;
              padding:2px 10px;
              font-size:11px;
              cursor:pointer;
              background:rgba(22,163,74,0.95);
              color:#f9fafb;
              display:none;
            ">
            เล่นต่อ ▶️
          </button>
          <a id="hha-back-hub"
            href="./hub.html"
            style="
              margin-left:auto;
              text-decoration:none;
              padding:2px 10px;
              border-radius:999px;
              border:1px solid rgba(148,163,184,0.9);
              color:#bfdbfe;
              font-size:11px;
            ">
            กลับ Hub
          </a>
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
      <div id="hha-result-card"
        style="
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
        <div style="margin-bottom:4px;">
          อันดับของคุณ: <b id="hha-final-rank">-</b>
        </div>
        <div id="hha-final-praise"
          style="margin-bottom:10px;color:#e5e7eb;font-size:13px;">
        </div>

        <div style="display:flex;gap:8px;justify-content:center;margin-bottom:8px;flex-wrap:wrap;">
          <button id="hha-restart"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 18px;
                   background:linear-gradient(135deg,#38bdf8,#2563eb);
                   color:#fff;font-weight:600;font-size:14px;">
            เล่นอีกครั้ง
          </button>
          <button id="hha-download-runs"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 14px;
                   background:linear-gradient(135deg,#22c55e,#16a34a);
                   color:#fff;font-weight:600;font-size:13px;">
            ดาวน์โหลดสรุป (CSV)
          </button>
          <button id="hha-download-events"
            style="border-radius:999px;border:0;cursor:pointer;
                   padding:8px 14px;
                   background:rgba(15,23,42,0.95);
                   border:1px solid rgba(148,163,184,0.9);
                   color:#e5e7eb;font-weight:500;font-size:12px;">
            CSV เหตุการณ์รอบนี้
          </button>
        </div>

        <div id="hha-research-stats"
          style="font-size:11px;color:#9ca3af;margin-bottom:4px;">
        </div>

        <div style="font-size:11px;color:#9ca3af;">
          *ข้อมูลถูกเก็บไว้บนเครื่องนี้เท่านั้น ปุ่ม CSV สำหรับครู/วิจัย
          <br/>
          <button id="hha-reset-data"
            style="margin-top:4px;border-radius:999px;border:0;
                   padding:4px 10px;font-size:11px;cursor:pointer;
                   background:rgba(30,64,175,0.9);color:#e5e7eb;">
            ล้างข้อมูลวิจัยบนเครื่องนี้
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(hud);
  return hud;
}

function currentMultiplier() {
  return feverTicksLeft > 0 ? activeFeverMult : 1;
}

function bumpAnim(el) {
  if (!el) return;
  el.classList.remove('hha-pop');
  void el.offsetWidth;
  el.classList.add('hha-pop');
}

function updateHUD() {
  const sEl = $('#hha-score');
  const cEl = $('#hha-combo');
  const tEl = $('#hha-time');
  const mBar = $('#hha-mission-bar');
  const starEl = $('#hha-buff-star');
  const shieldEl = $('#hha-buff-shield');
  const feverEl = $('#hha-buff-fever');

  if (sEl) {
    sEl.textContent = String(score);
    if (score > lastScore) bumpAnim(sEl);
  }
  if (cEl) {
    cEl.textContent = String(combo);
    if (combo > lastCombo) bumpAnim(cEl);
  }
  lastScore = score;
  lastCombo = combo;

  if (tEl) tEl.textContent = String(timeLeft);

  if (mBar) {
    const ratio = Math.max(0, Math.min(1, missionGoodCount / MISSION_GOOD_TARGET));
    mBar.style.width = (ratio * 100).toFixed(1) + '%';
  }

  if (starEl) starEl.textContent = String(maxCombo);
  if (shieldEl) shieldEl.textContent = String(shieldCharges);
  if (feverEl) feverEl.textContent = String(Math.max(0, feverTicksLeft));
}

function updatePauseButtons() {
  const p = $('#hha-pause-btn');
  const r = $('#hha-resume-btn');
  if (!p || !r) return;

  if (!running) {
    p.style.display = 'none';
    r.style.display = 'none';
  } else if (paused) {
    p.style.display = 'none';
    r.style.display = 'inline-block';
  } else {
    p.style.display = 'inline-block';
    r.style.display = 'none';
  }
}

function pauseGame(reason) {
  if (!running || paused) return;
  paused = true;
  setFeverOverlay(false);

  showToast(
    reason === 'blur'
      ? 'หยุดพักอัตโนมัติ (สลับหน้าจอ) ⏸️'
      : 'หยุดพักเกมชั่วคราว ⏸️',
    'good'
  );

  logEvent('game_pause', {
    reason: reason || 'manual',
    timeLeft: timeLeft,
    score: score,
    combo: combo
  });

  updatePauseButtons();
}

function resumeGame() {
  if (!running || !paused) return;
  paused = false;

  showToast('เล่นต่อ! ▶️', 'good');

  logEvent('game_resume', {
    timeLeft: timeLeft,
    score: score,
    combo: combo
  });

  updatePauseButtons();
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

    requestAnimationFrame(function () {
      shard.style.transform =
        'translate3d(' + dx + 'px,' + dy + 'px,0) scale(1.05) rotate(' + rotateDeg + 'deg)';
      shard.style.opacity = '0';
    });
  }

  fxLayer.appendChild(container);
  setTimeout(function () {
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
  if (!running || paused) return;
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
  else if (type === 'rainbow') emo = randomFrom(RAINBOW);

  const item = document.createElement('button');
  item.type = 'button';
  item.textContent = emo;
  item.setAttribute('data-type', type);

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const marginX = Math.max(40, vw * 0.06);
  const marginTop = Math.max(140, vh * 0.20);
  const marginBottom = Math.max(80, vh * 0.12);

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
  } else if (type === 'rainbow') {
    item.style.background =
      'radial-gradient(circle at 0 0,#f97316,#ec4899,#6366f1)';
    item.style.boxShadow = '0 0 30px rgba(244,63,94,0.95)';
  } else if (type === 'good') {
    item.style.background = 'rgba(15,23,42,0.96)';
  } else if (type === 'junk') {
    item.style.background = 'rgba(30,27,75,0.96)';
  }

  item.style.left = String(x - size / 2) + 'px';
  item.style.top = String(y - size / 2) + 'px';

  const spawnTimeMs = nowMs();
  item.dataset.spawnAt = String(spawnTimeMs);
  item.dataset.itemType = type;

  activeItems++;

  // นับจำนวน spawn สำหรับ accuracy
  if (type === 'good' || type === 'star' || type === 'gold' || type === 'diamond') {
    totalGoodSpawns++;
  } else if (type === 'junk') {
    totalJunkSpawns++;
  }

  logEvent('spawn', {
    itemType: type,
    x: Math.round(x),
    y: Math.round(y),
    spawnTimeMs: Math.round(spawnTimeMs)
  });

  function removeItem() {
    if (item.parentNode) {
      item.parentNode.removeChild(item);
      activeItems = Math.max(0, activeItems - 1);
    }
  }

  item.addEventListener('click', function (ev) {
    if (!running || paused) return;

    const now = nowMs();
    const spawnAt = parseFloat(item.dataset.spawnAt || String(now));
    const rt = Math.max(0, now - spawnAt);

    if (navigator.vibrate) {
      const vibType = item.getAttribute('data-type') || 'unknown';
      if (vibType === 'junk') navigator.vibrate(60);
      else if (vibType === 'shield' || vibType === 'fever' || vibType === 'rainbow') navigator.vibrate(40);
      else navigator.vibrate(25);
    }

    const type = item.getAttribute('data-type') || 'unknown';
    burstAt(ev.clientX, ev.clientY, type === 'junk' ? 'bad' : type);

    const mult = currentMultiplier();
    let junkHit = 0;

    if (type === 'good') {
      score += Math.round(10 * mult);
      combo += 1;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.25)';
      totalGoodClicks++;
      logEvent('click_good', {
        itemType: 'good',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'star') {
      score += Math.round(15 * mult);
      combo += 2;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.28)';
      totalGoodClicks++;
      logEvent('click_star', {
        itemType: 'star',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'gold') {
      score += Math.round(20 * mult);
      combo += 2;
      missionGoodCount += 2;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.3)';
      totalGoodClicks++;
      logEvent('click_gold', {
        itemType: 'gold',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'diamond') {
      score += Math.round(25 * mult);
      combo += 3;
      missionGoodCount += 2;
      timeLeft += DIAMOND_TIME_BONUS;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.32)';
      totalGoodClicks++;
      logEvent('click_diamond', {
        itemType: 'diamond',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'shield') {
      shieldCharges += 1;
      item.style.transform = 'scale(1.2)';
      showToast('ได้กันพลาดเพิ่มอีก 1 แต้ม! 🛡️', 'good');
      logEvent('click_shield', {
        itemType: 'shield',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'fever') {
      // เติมเวลาไฟ + อัปเกรดตัวคูณตามคอมโบ
      feverTicksLeft = Math.min(feverTicksLeft + FEVER_DURATION, 20);

      if (maxCombo >= 55) {
        activeFeverMult = FEVER_MULT_BASE + 0.9;
      } else if (maxCombo >= 35) {
        activeFeverMult = FEVER_MULT_BASE + 0.5;
      } else {
        activeFeverMult = FEVER_MULT_BASE;
      }

      item.style.transform = 'scale(1.25)';
      feverPickupCount++;
      setFeverOverlay(true);

      showToast(
        'โหมดไฟลุก! คะแนนคูณ ' + activeFeverMult.toFixed(1) + ' 🔥',
        'good'
      );

      logEvent('click_fever', {
        itemType: 'fever',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'rainbow') {
      score += Math.round(12 * mult);
      combo += 1;
      missionGoodCount += 1;
      if (combo > maxCombo) maxCombo = combo;
      item.style.transform = 'scale(1.32)';

      const hostEl = createHost();
      const junkNodes = hostEl.querySelectorAll('button[data-type="junk"]');
      let cleared = 0;
      junkNodes.forEach(function (j) {
        const rect = j.getBoundingClientRect();
        burstAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 'bad');
        if (j.parentNode) {
          j.parentNode.removeChild(j);
          activeItems = Math.max(0, activeItems - 1);
        }
        cleared++;
      });

      if (cleared > 0) {
        showToast('สายรุ้งกวาดขยะหายวับ ' + cleared + ' ชิ้น! 🌈', 'good');
      } else {
        showToast('สายรุ้งเสริมพลังคะแนน! 🌈', 'good');
      }

      logEvent('click_rainbow', {
        itemType: 'rainbow',
        x: ev.clientX,
        y: ev.clientY,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: Math.round(rt),
        score: score,
        combo: combo,
        goodCount: missionGoodCount,
        shield: shieldCharges,
        feverLeft: feverTicksLeft,
        feverMult: activeFeverMult
      });
    } else if (type === 'junk') {
      totalJunkClicks++;
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        shieldUseCount++;
        item.style.transform = 'scale(0.9)';
        showToast('กันพลาดทันเวลาพอดี! 🛡️', 'good');
        logEvent('click_junk_blocked', {
          itemType: 'junk',
          x: ev.clientX,
          y: ev.clientY,
          spawnTimeMs: Math.round(spawnAt),
          reactionTimeMs: Math.round(rt),
          score: score,
          combo: combo,
          goodCount: missionGoodCount,
          junkHit: 0,
          shield: shieldCharges,
          feverLeft: feverTicksLeft,
          feverMult: activeFeverMult
        });
      } else {
        score = Math.max(0, score - 5);
        combo = 0;
        feverTicksLeft = 0;
        activeFeverMult = 1;
        setFeverOverlay(false);
        item.style.transform = 'scale(0.7)';
        const oldBg = document.body.style.backgroundColor || '#0b1220';
        document.body.style.backgroundColor = '#450a0a';
        setTimeout(function () {
          document.body.style.backgroundColor = oldBg || '#0b1220';
        }, 80);
        const badMsgs = [
          'โอ๊ะ! พลาดไปโดนของขยะ 😵',
          'ของแบบนี้ไม่ดีต่อร่างกายนะ!',
          'ระวังของขยะให้ดีนะ 👀'
        ];
        showToast(badMsgs[Math.floor(Math.random() * badMsgs.length)], 'bad');
        junkHit = 1;
        junkHitCount++;
        logEvent('click_junk', {
          itemType: 'junk',
          x: ev.clientX,
          y: ev.clientY,
          spawnTimeMs: Math.round(spawnAt),
          reactionTimeMs: Math.round(rt),
          score: score,
          combo: combo,
          goodCount: missionGoodCount,
          junkHit: 1,
          shield: shieldCharges,
          feverLeft: feverTicksLeft,
          feverMult: activeFeverMult
        });
      }
    }

    item.style.opacity = '0';
    updateHUD();
    setTimeout(removeItem, 100);
  });

  host.appendChild(item);

  setTimeout(function () {
    if (item.parentNode) {
      const type = item.getAttribute('data-type') || 'unknown';
      const spawnAt = parseFloat(item.dataset.spawnAt || String(nowMs()));
      const life = Math.round(nowMs() - spawnAt);
      item.style.opacity = '0';
      item.style.transform = 'scale(0.7)';
      setTimeout(removeItem, 120);
      logEvent('timeout', {
        itemType: type,
        spawnTimeMs: Math.round(spawnAt),
        reactionTimeMs: life
      });
    }
  }, ITEM_LIFETIME);
}

// ---------- Mini Boss ----------
function spawnBoss(host) {
  const boss = document.createElement('button');
  boss.type = 'button';
  boss.textContent = '👾';
  boss.setAttribute('data-type', 'boss');

  const size = Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.18);
  Object.assign(boss.style, {
    position: 'absolute',
    width: size + 'px',
    height: size + 'px',
    left: (window.innerWidth / 2 - size / 2) + 'px',
    top: (window.innerHeight * 0.55 - size / 2) + 'px',
    borderRadius: '999px',
    border: '0',
    fontSize: String(size * 0.5) + 'px',
    boxShadow: '0 0 40px rgba(248,113,113,0.95)',
    background: 'radial-gradient(circle at 30% 20%, #f97316, #b91c1c)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.12s ease, opacity 0.12s ease',
    pointerEvents: 'auto'
  });

  const spawnAt = nowMs();
  boss.dataset.spawnAt = String(spawnAt);
  host.appendChild(boss);
  activeItems++;
  bossSpawned = true;
  bossDefeated = false;

  showToast('บอสขยะโผล่มาแล้ว! ตีให้ทันก่อนหมดเวลา 👊', 'good');
  logEvent('boss_spawn', { spawnTimeMs: Math.round(spawnAt) });

  boss.addEventListener('click', function (ev) {
    if (!running || paused) return;
    const rt = Math.round(nowMs() - spawnAt);
    bossDefeated = true;

    const mult = currentMultiplier();
    score += Math.round(80 * mult);
    combo += 5;
    missionGoodCount += 3;
    if (combo > maxCombo) maxCombo = combo;

    burstAt(ev.clientX, ev.clientY, 'fever');
    showToast('ล้มบอสขยะได้แล้ว! 🎯', 'good');

    logEvent('boss_hit', {
      x: ev.clientX,
      y: ev.clientY,
      reactionTimeMs: rt,
      score: score,
      combo: combo,
      goodCount: missionGoodCount
    });

    boss.style.opacity = '0';
    setTimeout(function () {
      if (boss.parentNode) {
        boss.parentNode.removeChild(boss);
        activeItems = Math.max(0, activeItems - 1);
      }
    }, 120);
  });

  // ถ้าปล่อยให้รอด
  setTimeout(function () {
    if (bossDefeated || !boss.parentNode) return;
    boss.style.opacity = '0';
    setTimeout(function () {
      if (boss.parentNode) {
        boss.parentNode.removeChild(boss);
        activeItems = Math.max(0, activeItems - 1);
      }
    }, 120);
    logEvent('boss_timeout', { });
  }, 8000);
}

// ---------- ระบบ Rank + คำชม ----------
function calcRankAndPraise() {
  const success = missionGoodCount >= MISSION_GOOD_TARGET;
  const s = score;
  const g = missionGoodCount;
  const c = maxCombo;

  let baseScore;
  if (DIFF === 'easy') baseScore = 15 * MISSION_GOOD_TARGET;
  else if (DIFF === 'hard') baseScore = 22 * MISSION_GOOD_TARGET;
  else baseScore = 18 * MISSION_GOOD_TARGET;

  const ratio = s / baseScore;

  let rank = 'C';
  let praise = 'ฝึกอีกนิดเดียว เดี๋ยวก็โปร! 💪';

  if (success && ratio >= 2.1 && c >= 55 && junkHitCount === 0) {
    rank = 'SSS';
    praise = 'ตำนานสายสุขภาพ! เลือกเป๊ะ ไม่มีหลุดเลย 🍎👑';
  } else if (success && ratio >= 1.7 && c >= 45) {
    rank = 'SS';
    praise = 'ระดับเทพมาก! ควบคุมจังหวะได้สุดจริง 🔥';
  } else if (success && ratio >= 1.4 && c >= 30) {
    rank = 'S';
    praise = 'ระดับเทพผักผลไม้! เลือกเก่งมาก ๆ เลย 🍎🌟';
  } else if (success && ratio >= 1.0 && c >= 18) {
    rank = 'A';
    praise = 'สุดยอดนักเลือกอาหารเพื่อสุขภาพ! ✨';
  } else if (success && ratio >= 0.8) {
    rank = 'A';
    praise = 'ภารกิจผ่านแบบเท่สุด ๆ เยี่ยมไปเลย! 😎';
  } else if (g >= MISSION_GOOD_TARGET * 0.7) {
    rank = 'B';
    praise = 'อีกนิดเดียวก็ผ่านภารกิจแล้ว สู้ต่ออีกรอบนะ! 🚀';
  } else if (g >= MISSION_GOOD_TARGET * 0.4) {
    rank = 'C';
    praise = 'เริ่มต้นได้ดี! ลองสังเกตของขยะให้มากขึ้นนะ 👀';
  }

  return { rank, praise };
}

// ---------- Game loop ----------
function startGame() {
  if (running) return;
  running = true;
  paused = false;

  score = 0;
  combo = 0;
  maxCombo = 0;
  missionGoodCount = 0;
  timeLeft = GAME_DURATION;
  activeItems = 0;
  shieldCharges = 0;
  feverTicksLeft = 0;
  activeFeverMult = 1;
  lastScore = 0;
  lastCombo = 0;
  bossSpawned = false;
  bossDefeated = false;
  setFeverOverlay(false);

  // reset research state for this run
  runId = 'run-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
  runStartedAt = nowMs();
  eventLog = [];
  totalGoodSpawns = 0;
  totalJunkSpawns = 0;
  totalGoodClicks = 0;
  totalJunkClicks = 0;
  junkHitCount = 0;
  shieldUseCount = 0;
  feverPickupCount = 0;
  feverSecondsAccum = 0;

  updateHUD();
  updatePauseButtons();

  const host = createHost();
  createHUD();
  createFXLayer();
  createFeverOverlay();
  createToastLayer();
  ensureGameCSS();

  host.innerHTML = '';

  logEvent('game_start', {
    timeLimit: GAME_DURATION,
    spawnInterval: SPAWN_INTERVAL,
    itemLifetime: ITEM_LIFETIME,
    maxActive: MAX_ACTIVE,
    missionGoodTarget: MISSION_GOOD_TARGET
  });

  if (spawnTimer) clearInterval(spawnTimer);
  if (tickTimer) clearInterval(tickTimer);

  spawnTimer = setInterval(function () {
    if (!running || paused) return;
    spawnOne(host);
  }, SPAWN_INTERVAL);

  tickTimer = setInterval(function () {
    if (!running || paused) return;

    timeLeft -= 1;

    // เรียกบอสช่วงท้ายเกม (เฉพาะ normal/hard เกมยาว)
    if (!bossSpawned && DIFF !== 'easy' && GAME_DURATION >= 40 && timeLeft === 10) {
      const hostNow = createHost();
      spawnBoss(hostNow);
    }

    if (feverTicksLeft > 0) {
      feverTicksLeft -= 1;
      feverSecondsAccum += 1;
      if (feverTicksLeft <= 0) {
        feverTicksLeft = 0;
        activeFeverMult = 1;
        setFeverOverlay(false);
      }
    }

    if (timeLeft <= 0) {
      timeLeft = 0;
      updateHUD();
      logEvent('timer_end', {
        score: score,
        combo: combo,
        goodCount: missionGoodCount
      });
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
  spawnTimer = null;
  tickTimer = null;
  setFeverOverlay(false);
  paused = false;
  updatePauseButtons();

  const result = $('#hha-result');
  const fs = $('#hha-final-score');
  const fc = $('#hha-final-combo');
  const fg = $('#hha-final-good');
  const title = $('#hha-result-title');
  const rankEl = $('#hha-final-rank');
  const praiseEl = $('#hha-final-praise');
  const card = $('#hha-result-card');

  const rp = calcRankAndPraise();
  const missionSuccess = missionGoodCount >= MISSION_GOOD_TARGET;

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

  if (card) {
    let border = 'rgba(34,197,94,0.8)';
    let glow = '0 0 26px rgba(34,197,94,0.7)';
    if (rp.rank === 'SSS' || rp.rank === 'SS' || rp.rank === 'S') {
      border = 'rgba(250,204,21,0.95)';
      glow = '0 0 30px rgba(250,204,21,0.9)';
    } else if (rp.rank === 'A') {
      border = 'rgba(96,165,250,0.95)';
      glow = '0 0 26px rgba(96,165,250,0.8)';
    } else if (rp.rank === 'B') {
      border = 'rgba(52,211,153,0.9)';
      glow = '0 0 24px rgba(52,211,153,0.8)';
    } else if (rp.rank === 'C') {
      border = 'rgba(148,163,184,0.9)';
      glow = '0 0 20px rgba(148,163,184,0.7)';
    }
    card.style.borderColor = border;
    card.style.boxShadow = glow;
  }

  const accuracyGood = totalGoodSpawns
    ? totalGoodClicks / totalGoodSpawns
    : 0;
  const shotsAll = totalGoodClicks + totalJunkClicks;
  const accuracyAll = shotsAll ? totalGoodClicks / shotsAll : 0;

  const summary = {
    timestamp: new Date().toISOString(),
    runId: runId,
    gameVersion: GAME_VERSION,
    mode: MODE,
    diff: DIFF,
    timeLimit: GAME_DURATION,
    score: score,
    maxCombo: maxCombo,
    goodCount: missionGoodCount,
    missionTarget: MISSION_GOOD_TARGET,
    rank: rp.rank,
    totalGoodSpawns: totalGoodSpawns,
    totalJunkSpawns: totalJunkSpawns,
    totalGoodClicks: totalGoodClicks,
    totalJunkClicks: totalJunkClicks,
    accuracyGood: accuracyGood,
    accuracyAll: accuracyAll,
    junkHitCount: junkHitCount,
    shieldUseCount: shieldUseCount,
    feverPickupCount: feverPickupCount,
    feverSecondsAccum: feverSecondsAccum
  };

  appendRunSummary(summary);
  sendSummaryToSheet(summary);

  logEvent('game_end', {
    score: score,
    maxCombo: maxCombo,
    goodCount: missionGoodCount,
    rank: rp.rank,
    accuracyGood: accuracyGood,
    accuracyAll: accuracyAll,
    junkHitCount: junkHitCount,
    shieldUseCount: shieldUseCount,
    feverPickupCount: feverPickupCount,
    feverSeconds: feverSecondsAccum
  });

  updateHUD();
  updateResearchStats();

  if (result) result.style.display = 'flex';
}

// ---------- Bootstrap ----------
function bootstrap() {
  createHUD();
  createHost();
  createFXLayer();
  createFeverOverlay();
  createToastLayer();
  ensureGameCSS();
  updateHUD();
  updateResearchStats();
  updatePauseButtons();

  const restartBtn = $('#hha-restart');
  if (restartBtn) {
    restartBtn.addEventListener('click', function () {
      const panel = $('#hha-result');
      if (panel) panel.style.display = 'none';
      startGame();
    });
  }

  const dlRunsBtn = $('#hha-download-runs');
  if (dlRunsBtn) {
    dlRunsBtn.addEventListener('click', function () {
      downloadRunsCSV();
    });
  }

  const dlEventsBtn = $('#hha-download-events');
  if (dlEventsBtn) {
    dlEventsBtn.addEventListener('click', function () {
      downloadEventsCSV();
    });
  }

  const resetBtn = $('#hha-reset-data');
  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      resetResearchData();
    });
  }

  const pauseBtn = $('#hha-pause-btn');
  const resumeBtn = $('#hha-resume-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      pauseGame('manual');
    });
  }
  if (resumeBtn) {
    resumeBtn.addEventListener('click', function () {
      resumeGame();
    });
  }

  // Auto-pause เมื่อสลับหน้าจอ / แท็บ
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      pauseGame('blur');
    }
  });
  window.addEventListener('blur', function () {
    pauseGame('blur');
  });
  window.addEventListener('focus', function () {
    if (running && paused) {
      showToast('กลับเข้าหน้าเกมแล้ว กด "เล่นต่อ" ได้เลย ▶️', 'good');
      updatePauseButtons();
    }
  });

  updatePauseButtons();
  startGame();

  console.log('[HHA DOM] Good vs Junk — Research+Fun+Deployment Pack', {
    version: GAME_VERSION,
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
