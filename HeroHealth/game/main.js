'use strict';
window.__HHA_BOOT_OK = 'main';

// === Config ===
var DEFAULT_MODE = 'goodjunk';
var DEFAULT_DIFF = 'normal';
var DEFAULT_TIME = 60;

var MODES_META = {
  goodjunk: {
    id: 'goodjunk',
    label: 'ดี vs ขยะ',
    desc: 'เลือกกินของดี หลีกเลี่ยงของขยะ'
  },
  groups: {
    id: 'groups',
    label: 'หมู่สารอาหาร',
    desc: 'จัดหมวดหมู่สารอาหารให้ถูก'
  },
  hydration: {
    id: 'hydration',
    label: 'ดื่มน้ำสมดุล',
    desc: 'ดื่มน้ำให้พอดีกับกิจกรรม'
  },
  plate: {
    id: 'plate',
    label: 'จานสุขภาพ',
    desc: 'แบ่งผัก ข้าว โปรตีน ให้สมดุล'
  }
};

var COACH_LINES = [
  'พร้อมลุยยัง ฮีโร่สุขภาพ? 💪',
  'รอบนี้ขอดูสกิลเทพๆ หน่อยนะ 😎',
  'อย่าลืมโฟกัสให้ดี กดผิดมีหักคะแนนนะ! ⚠️',
  'ถ้าพลาดไม่เป็นไร เริ่มใหม่ได้เสมอ ✨',
  'คิดให้ทันก่อนกด สายตาไวกว่าความหิวนะ 🤓',
  'ขยับตัวบ่อยๆ สุขภาพจะได้ฟิตเวอร์ 🏃‍♀️',
  'สะสมคอมโบให้ได้เยอะๆ แล้วจะรู้ว่าตัวเองโหดแค่ไหน 🔥',
  'ภารกิจนี้มีแต่ทีมฮีโร่เท่านั้นที่ทำได้ สู้ๆ! ⭐'
];

// === Global state ===
var state = {
  modeId: DEFAULT_MODE,
  diff: DEFAULT_DIFF,
  duration: DEFAULT_TIME,
  running: false,
  startedAt: 0,
  timerId: null,
  remaining: DEFAULT_TIME,
  currentModule: null,
  currentRunner: null,
  ctx: null
};

// === Helpers ===
function $(sel) {
  return document.querySelector(sel);
}
function $all(sel) {
  return document.querySelectorAll(sel);
}
function byAction(el) {
  if (!el) return null;
  if (el.closest) return el.closest('[data-action]');
  while (el && el !== document) {
    if (el.getAttribute && el.getAttribute('data-action')) return el;
    el = el.parentNode;
  }
  return null;
}
function setText(sel, txt) {
  var el = typeof sel === 'string' ? $(sel) : sel;
  if (el) el.textContent = txt;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// === Status HUD ===
var statusEl = null;
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
  var el = ensureStatusHUD();
  el.textContent = msg;
}

var realModesMarked = false;
function markRealModesLoaded() {
  if (realModesMarked) return;
  realModesMarked = true;
  showStatus('Real modes loaded');
}

// === Coach ===
function showCoachLine(forceLine) {
  var el = $('#coachText');
  if (!el) return;
  var line = forceLine || pickRandom(COACH_LINES);
  el.textContent = line;
}

// === Timer ===
function updateTimerLabel() {
  var lbl = $('#timerLabel');
  if (lbl) lbl.textContent = state.remaining + ' s';
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
  state.timerId = setInterval(function() {
    state.remaining -= 1;
    if (state.remaining < 0) state.remaining = 0;
    updateTimerLabel();
    if (state.remaining <= 0) {
      stopTimer();
      endGame('timeup');
    }
  }, 1000);
}

// === Dynamic import ===
function loadModeModule(modeId) {
  var meta = MODES_META[modeId];
  if (!meta) {
    console.warn('Unknown mode:', modeId);
    showStatus('Unknown mode: ' + modeId);
    return Promise.resolve(null);
  }
  return import('./modes/' + modeId + '.js')
    .then(function(mod) {
      console.log('[HHA] Mode module loaded:', modeId, mod);
      markRealModesLoaded();
      return mod;
    })
    .catch(function(err) {
      console.error('[HHA] Failed to load mode:', modeId, err);
      showStatus('Failed to load mode: ' + modeId);
      return null;
    });
}

// === Build context ===
function buildModeContext(modeId) {
  var host =
    document.getElementById('spawnHost') ||
    document.getElementById('gameLayer') ||
    document.querySelector('.game-layer') ||
    document.body;
  var ctx = {
    modeId: modeId,
    host: host,
    difficulty: state.diff,
    duration: state.duration,
    end: function(reason, extra) {
      endGame(reason || 'mode-end', extra);
    },
    setCoach: function(msg) {
      showCoachLine(msg);
    },
    setStatus: function(msg) {
      showStatus(msg);
    },
    setTimerOverride: function(sec) {
      if (typeof sec === 'number' && sec > 0) {
        state.duration = sec;
        state.remaining = sec;
        startTimer();
      }
    },
    emitGlobal: function(name, detail) {
      try {
        window.dispatchEvent(new CustomEvent(name, { detail: detail }));
      } catch (e) {
        console.warn('emitGlobal error', e);
      }
    }
  };
  return ctx;
}

// === Start / End game ===
function startGame() {
  if (state.running) return;
  var modeId = state.modeId || DEFAULT_MODE;
  showStatus('Loading mode: ' + modeId + ' ...');

  loadModeModule(modeId).then(function(mod) {
    if (!mod) return;

    stopTimer();
    state.running = true;
    state.startedAt = Date.now();
    state.currentModule = mod;
    state.currentRunner = null;

    showCoachLine();

    var ctx = buildModeContext(modeId);
    state.ctx = ctx;

    var runner = null;
    try {
      if (typeof mod.start === 'function') {
        runner = mod.start(ctx);
      } else if (typeof mod.run === 'function') {
        runner = mod.run(ctx);
      } else if (typeof mod.default === 'function') {
        runner = mod.default(ctx);
      } else if (typeof mod.create === 'function') {
        runner = mod.create(ctx);
      } else {
        console.warn('[HHA] Mode has no entry function');
        showStatus('Mode entry missing: ' + modeId);
      }
    } catch (err) {
      console.error('[HHA] Error while starting mode:', modeId, err);
      showStatus('Error starting mode: ' + modeId);
      state.running = false;
      return;
    }

    state.currentRunner = runner || null;
    state.remaining = state.duration;
    startTimer();
    var meta = MODES_META[modeId];
    var label = meta ? meta.label : modeId;
    showStatus('Playing: ' + label);
  });
}

function endGame(reason, extraResult) {
  if (!state.running) return;
  console.log('[HHA] endGame:', reason, extraResult);
  state.running = false;
  stopTimer();

  var r = state.currentRunner;
  try {
    if (r && typeof r.stop === 'function') {
      r.stop(reason, extraResult);
    } else if (r && typeof r.end === 'function') {
      r.end(reason, extraResult);
    }
  } catch (e) {
    console.warn('[HHA] runner stop error:', e);
  }

  var panel = $('#resultPanel');
  if (panel) {
    panel.classList.remove('hidden');
    var reasonEl = panel.querySelector('[data-field="reason"]');
    if (reasonEl) {
      var txt = '';
      if (reason === 'timeup') txt = 'หมดเวลาแล้ว!';
      else if (reason === 'quit') txt = 'ออกจากเกมก่อนจบภารกิจ';
      else txt = 'จบภารกิจแล้ว!';
      reasonEl.textContent = txt;
    }
  }
  showStatus('Session ended (' + reason + ')');
}

// === UI binding ===
function onClick(e) {
  var actEl = byAction(e.target);
  if (!actEl) return;
  var action = actEl.getAttribute('data-action');
  if (!action) return;
  if (action === 'start' || action === 'start-game') {
    e.preventDefault();
    startGame();
  } else if (action === 'quit' || action === 'stop') {
    e.preventDefault();
    endGame('quit');
  }
}

function bindModeButtons() {
  var buttons = $all('.mode-button, [data-mode]');
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var m = btn.getAttribute('data-mode');
      if (!m || !MODES_META[m]) return;
      state.modeId = m;

      buttons.forEach(function(b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');

      var meta = MODES_META[m];
      setText('#modeLabel', meta.label || m);
      setText('#modeDesc', meta.desc || '');
      showStatus('Selected mode: ' + (meta.label || m));
    });
  });

  if (!state.modeId || !MODES_META[state.modeId]) {
    state.modeId = DEFAULT_MODE;
  }
}

function bindDiffButtons() {
  var buttons = $all('.diff-button, [data-diff]');
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var d = btn.getAttribute('data-diff') || DEFAULT_DIFF;
      state.diff = d;
      buttons.forEach(function(b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      setText('#diffLabel', d);
      showStatus('Difficulty: ' + d);
    });
  });
}

function bindTimeButtons() {
  var buttons = $all('.time-button, [data-time]');
  buttons.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var v = parseInt(btn.getAttribute('data-time'), 10);
      if (!isNaN(v) && v > 0) {
        state.duration = v;
        state.remaining = v;
        updateTimerLabel();
        buttons.forEach(function(b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        showStatus('Time: ' + v + ' s');
      }
    });
  });
}

// === Bootstrap ===
function bootstrap() {
  document.addEventListener('click', onClick);
  bindModeButtons();
  bindDiffButtons();
  bindTimeButtons();

  var initMeta = MODES_META[state.modeId] || MODES_META[DEFAULT_MODE];
  if (initMeta) {
    setText('#modeLabel', initMeta.label);
    setText('#modeDesc', initMeta.desc);
  }
  setText('#diffLabel', state.diff);
  state.remaining = state.duration;
  updateTimerLabel();

  showCoachLine('เลือกโหมดแล้วกดปุ่มเริ่มได้เลย! 😄');
  showStatus('Hub ready (waiting for start)');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
