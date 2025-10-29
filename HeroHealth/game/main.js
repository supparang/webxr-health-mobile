// === Hero Health Academy — game/main.js (final integrated version 2025-10-29) ===
// ใช้กับระบบ Hero Health Academy ทุกรูปแบบ (HeroHealth / VR Nutrition / Groups)
// ปรับปรุง: กัน Result เด้งหน้าแรก, รวม API start/end เดิม, รองรับ replay, สรุปคะแนนปลอดภัย

window.__HHA_BOOT_OK = 'main';

// ---------- Utility ----------
const $$ = (s) => Array.from(document.querySelectorAll(s));
function safeHide(el) {
  if (!el) return;
  el.style.display = 'none';
  el.hidden = true;
  el.removeAttribute?.('open');
  el.classList?.remove?.('show', 'open', 'visible', 'active');
}
function safeShowFlex(el) {
  if (!el) return;
  el.hidden = false;
  el.style.display = 'flex';
  el.classList?.add?.('show', 'visible');
}

// ---------- Result Guard ----------
const RESULT_SELECTORS = [
  '#result',
  '#resultModal',
  '[data-modal="result"]',
  '.modal.result',
  '.resultModal'
];

function hideAllResults() {
  RESULT_SELECTORS.forEach((sel) => $$(sel).forEach(safeHide));
}

function fillResult(box, summary) {
  const S = {
    score: summary?.score ?? 0,
    stars: summary?.stars ?? 0,
    grade: summary?.grade ?? '—',
    bestCombo: summary?.bestCombo ?? summary?.combo ?? 0,
    mode: summary?.mode ?? (window.__HHA_MODE || '—'),
    time: summary?.timePlayed ?? 0,
  };
  const set = (k, v) => {
    const el = box.querySelector(`[data-field="${k}"]`);
    if (el) el.textContent = v;
  };
  set('score', S.score);
  set('stars', S.stars);
  set('grade', S.grade);
  set('combo', S.bestCombo);
  set('mode', S.mode);
  set('time', S.time);
}

function showResult(summary = {}) {
  hideAllResults();
  const box = document.getElementById('result');
  if (!box) return;
  fillResult(box, summary);

  // bind ปุ่ม replay/home ครั้งเดียว
  if (!box.__bound) {
    box.addEventListener('click', (e) => {
      const act = e.target?.getAttribute?.('data-result');
      if (act === 'replay') {
        hideAllResults();
        window.__HHA_SET_RUNNING(true);
        if (typeof window.start === 'function') window.start({ demoPassed: true });
        else if (window.HHA?.startGame) window.HHA.startGame({ demoPassed: true });
      }
      if (act === 'home') {
        hideAllResults();
        window.__HHA_SET_RUNNING(false);
      }
    });
    box.__bound = true;
  }

  safeShowFlex(box);
}

// ---------- Init Guard ----------
document.addEventListener('DOMContentLoaded', hideAllResults);

// ---------- API Integration ----------
const _prevStart = window.start;
const _prevEnd = window.end;

window.HHA = Object.assign(window.HHA || {}, {
  hideAllResults,
  showResult,
});

// start(): ซ่อน modal ก่อนเริ่มเสมอ
window.start = function start(opts) {
  hideAllResults();
  window.__HHA_SET_RUNNING(true);
  if (typeof _prevStart === 'function') return _prevStart(opts);
};

// end(): true = replay, object = summary
window.end = function end(summaryOrRestart) {
  if (summaryOrRestart === true) {
    hideAllResults();
    window.__HHA_SET_RUNNING(true);
    return;
  }
  if (typeof _prevEnd === 'function') {
    try {
      _prevEnd(summaryOrRestart);
    } catch {}
  }
  window.__HHA_SET_RUNNING(false);
  const sum = summaryOrRestart && typeof summaryOrRestart === 'object' ? summaryOrRestart : {};
  showResult(sum);
};

// ---------- Observer ป้องกัน Result โผล่เอง ----------
const mo = new MutationObserver(() => {
  if (!window.__HHA_GAME_RUNNING) {
    RESULT_SELECTORS.forEach((sel) =>
      $$(sel).forEach((el) => {
        if (getComputedStyle(el).display !== 'none') safeHide(el);
      })
    );
  }
});
mo.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['style', 'class', 'open'],
});

// ---------- Running flag ----------
window.__HHA_SET_RUNNING = (v) => {
  window.__HHA_GAME_RUNNING = !!v;
};

// ---------- ซ่อนซ้ำเมื่อ visibility กลับมา ----------
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') hideAllResults();
});
