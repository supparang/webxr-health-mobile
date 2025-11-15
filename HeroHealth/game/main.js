// === Hero Health Academy — game/main.js (2025-11-15 HUB v1) ===
// ฮับกลางควบคุมโหมด Good vs Trash / Groups / Hydration / Plate
// - dynamic import โหมดแต่ละอันแบบกันพัง
// - โค้ช 1–8 แบบภาษาป.5
// - แสดง "Real modes loaded" มุมล่างซ้ายเมื่อโหลดโหมดสำเร็จอย่างน้อย 1 อัน

'use strict';
window.__HHA_BOOT_OK = 'main';

// ---------- Config พื้นฐาน ----------
const DEFAULT_MODE = 'goodjunk';
const DEFAULT_DIFF = 'normal';
const DEFAULT_TIME = 60; // วินาที

const MODES_META = {
  goodjunk: {
    id: 'goodjunk',
    label: 'ดี vs ขยะ',
    desc: 'เลือกกินของดี หลีกเลี่ยงของขยะ',
  },
  groups: {
    id: 'groups',
    label: 'หมู่สารอาหาร',
    desc: 'จัดหมวดหมู่สารอาหารให้ถูก',
  },
  hydration: {
    id: 'hydration',
    label: 'ดื่มน้ำสมดุล',
    desc: 'ดื่มน้ำให้พอดีกับกิจกรรม',
  },
  plate: {
    id: 'plate',
    label: 'จานสุขภาพ',
    desc: 'แบ่งผัก ข้าว โปรตีน ให้สมดุล',
  }
};

// โค้ช 1–8 ภาษาป.5 (ใช้สุ่มขึ้นตอนเริ่มเกม)
const COACH_LINES = [
  'พร้อมลุยยัง ฮีโร่สุขภาพ? 💪',
  'รอบนี้ขอดูสกิลเทพๆ หน่อยนะ 😎',
  'อย่าลืมโฟกัสให้ดี กดผิดมีหักคะแนนนะ! ⚠️',
  'ถ้าพลาดไม่เป็นไร เริ่มใหม่ได้เสมอ ✨',
  'คิดให้ทันก่อนกด สายตาไวกว่าความหิวนะ 🤓',
  'ขยับตัวบ่อยๆ สุขภาพจะได้ฟิตเวอร์ 🏃‍♀️',
  'สะสมคอมโบให้ได้เยอะๆ แล้วจะรู้ว่าตัวเองโหดแค่ไหน 🔥',
  'ภารกิจนี้มีแต่ทีมฮีโร่เท่านั้นที่ทำได้ สู้ๆ! ⭐'
];

// ---------- State กลางของเกม ----------
const state = {
  modeId: DEFAULT_MODE,
  diff: DEFAULT_DIFF,
  duration: DEFAULT_TIME,
  running: false,
  startedAt: 0,
  timerId: null,
  remaining: DEFAULT_TIME,
  currentModule: null,
  currentRunner: null,
  ctx: null,
};

// ---------- Helper DOM ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function byAction(el) {
  return el?.closest?.('[data-action]') || null;
}

function setText(sel, txt) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (el) el.textContent = txt;
}

function addClass(el, cls) {
  if (!el) return;
  el.classList.add(cls);
}

function removeClass(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------- Status HUD (มุมล่างซ้าย) ----------
let statusEl = null;
function ensureStatusHUD() {
  if (statusEl && document.body.contains(statusEl)) return statusEl;
  statusEl = document.getElementById('modeStatus');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'modeStatus';
    statusEl.style.position = 'fixed';
    statusEl.style.left = '8px';
    statusEl.style.bottom = '8px';
    statusEl.style.padding = '4px 8px';
    statusEl.style.fontSize = '11px';
    statusEl.style.fontFamily = 'system-ui, sans-serif';
    statusEl.style.color = '#e2e8f0';
    statusEl.style.background = 'rgba(15,23,42,0.85)';
    statusEl.style.borderRadius = '6px';
    statusEl.style.zIndex = '9999';
    statusEl.style.pointerEvents = 'none';
    document.body.appendChild(statusEl);
  }
  return statusEl;
}

function showStatus(msg) {
  const el = ensureStatusHUD();
  el.textContent = msg;
}

// เรียกเมื่อโหมดจริงโหลดสำเร็จอย่างน้อย 1 โหมด
let realModesMarked = false;
function markRealModesLoaded() {
  if (realModesMarked) return;
  realModesMarked = true;
  showStatus('Real modes loaded');
}

// ---------- Coach Bubble ----------
function showCoachLine(forceLine) {
  const el = $('#coachText');
  if (!el) return; // ถ้าไม่มี element นี้ ก็ไม่ต้องทำอะไร
  const line = forceLine || pickRandom(COACH_LINES);
  el.textContent = line;
}

// ---------- Timer ----------
function updateTimerLabel() {
  const lbl = $('#timerLabel');
  if (lbl) {
    lbl.textContent = state.remaining + ' s';
  }
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  state.remaining = state.duration;
  updateTimerLabel();

  state.timerId = setInterval(() => {
    state.remaining -= 1;
    if (state.remaining < 0) {
      state.remaining = 0;
    }
    updateTimerLabel();
    if (state.remaining <= 0) {
      // หมดเวลา → จบเกม
      stopTimer();
      endGame('timeup');
    }
  }, 1000);
}

// ---------- Dynamic Import โหมด ----------
async function loadModeModule(modeId) {
  const meta = MODES_META[modeId];
  if (!meta) {
    console.warn('Unknown mode:', modeId);
    showStatus('Unknown mode: ' + modeId);
    return null;
  }

  try {
    const mod = await import(`./modes/${modeId}.js`);
    console.log('[HHA] Mode module loaded:', modeId, mod);
    markRealModesLoaded();
    return mod;
  } catch (err) {
    console.error('[HHA] Failed to load mode:', modeId, err);
    showStatus('Failed to load mode: ' + modeId);
    return null;
  }
}

// ---------- Context ที่ส่งไปให้โหมด ----------
function buildModeContext(modeId) {
  // host หลักสำหรับ spawn emoji / objects
  const host =
    document.getElementById('spawnHost') ||
    document.getElementById('gameLayer') ||
    document.querySelector('.game-layer') ||
    document.body;

  const ctx = {
    modeId,
    host,
    // config พื้นฐาน
    difficulty: state.diff,
    duration: state.duration,
    // callback ให้โหมดเรียกจบเกมได้
    end: (reason, extraResult) => {
      endGame(reason || 'mode-end', extraResult);
    },
    // helper สำหรับโหมด (แล้วแต่โหมดจะใช้หรือไม่ใช้)
    setCoach: (msg) => showCoachLine(msg),
    setStatus: (msg) => showStatus(msg),
    setTimerOverride: (sec) => {
      if (typeof sec === 'number' && sec > 0) {
        state.duration = sec;
        state.remaining = sec;
        startTimer();
      }
    },
    // event bus กลาง
    emitGlobal: (name, detail) => {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail }));
      } catch (e) {
        console.warn('emitGlobal error', e);
      }
    }
  };

  return ctx;
}

// ---------- การเริ่ม / จบเกม ----------
async function startGame() {
  if (state.running) return;

  const modeId = state.modeId || DEFAULT_MODE;
  showStatus('Loading mode: ' + modeId + ' ...');

  const mod = await loadModeModule(modeId);
  if (!mod) {
    // โหลดไม่สำเร็จ
    return;
  }

  // clear state เก่า
  stopTimer();
  state.running = true;
  state.startedAt = Date.now();
  state.currentModule = mod;
  state.currentRunner = null;

  // แสดงโค้ช 1 บรรทัด
  showCoachLine();

  // เตรียม ctx
  c
