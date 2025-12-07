// === /herohealth/vr/quest-hud-vr.js ===
// HUD กลาง: คะแนน + COMBO + MISS + Goal 2 อัน + Mini quest 3 อัน
// ใช้ร่วม GoodJunk / Hydration / Groups
//
// ฟัง event:
//   - hha:score  → score / combo / miss / timeSec
//   - hha:time   → นับเวลาถอยหลัง (sec)
//   - quest:update → goal + mini + hint

'use strict';

const ROOT = window;

// สร้าง HUD ด้านขวาบน
function createHud() {
  if (document.getElementById('hha-quest-hud')) return;

  const hud = document.createElement('div');
  hud.id = 'hha-quest-hud';
  hud.className = 'hha-quest-hud';

  hud.innerHTML = `
    <div class="hha-hud-top">
      <div class="hha-hud-scoreblock">
        <div class="hha-hud-score-row">
          <span class="hha-hud-label">คะแนน</span>
          <span class="hha-hud-score" id="hud-score-val">0</span>
        </div>
        <div class="hha-hud-subrow">
          <span id="hud-combo-val">COMBO x0</span>
          <span id="hud-miss-val">MISS 0</span>
        </div>
      </div>
      <div class="hha-hud-time" id="hud-time-val">60s</div>
    </div>

    <div class="hha-hud-quest-wrap">
      <div class="hha-hud-quest-col">
        <div class="hha-hud-quest-title">Goal</div>
        <ul id="hud-goal-list" class="hha-hud-quest-list"></ul>
      </div>
      <div class="hha-hud-quest-col">
        <div class="hha-hud-quest-title">Mini quest</div>
        <ul id="hud-mini-list" class="hha-hud-quest-list"></ul>
      </div>
    </div>

    <div class="hha-hud-hint" id="hud-hint"></div>
  `;

  document.body.appendChild(hud);
}

// แปลง quest 1 อันเป็น <li> สวย ๆ
function fmtQuestItem(q, index) {
  if (!q) return '';
  const done   = !!q.done;
  const prog   = Number(q.prog || 0);
  const target = Number(q.target || 0);

  let progressText = '';
  if (target > 0) {
    progressText = `${Math.min(prog, target)} / ${target}`;
  } else {
    progressText = done ? '✓ สำเร็จแล้ว' : 'กำลังทำ...';
  }

  const statusClass = done ? 'done' : '';
  const idxLabel    = (index != null ? (index + 1) + '.' : '');

  return `
    <li class="hha-quest-item ${statusClass}">
      <div class="hha-quest-main">
        <span class="hha-quest-index">${idxLabel}</span>
        <span class="hha-quest-label">${q.label || ''}</span>
      </div>
      <div class="hha-quest-progress">${progressText}</div>
    </li>
  `;
}

function setupListeners() {
  let scoreEl, comboEl, missEl, timeEl, goalListEl, miniListEl, hintEl;

  function ensureRefs() {
    if (!scoreEl) {
      scoreEl    = document.getElementById('hud-score-val');
      comboEl    = document.getElementById('hud-combo-val');
      missEl     = document.getElementById('hud-miss-val');
      timeEl     = document.getElementById('hud-time-val');
      goalListEl = document.getElementById('hud-goal-list');
      miniListEl = document.getElementById('hud-mini-list');
      hintEl     = document.getElementById('hud-hint');
    }
  }

  // -------- HUD คะแนน / COMBO / MISS / เวลา จาก hha:score --------
  ROOT.addEventListener('hha:score', (ev) => {
    ensureRefs();
    const d = ev.detail || {};
    if (!d) return;

    if (scoreEl && typeof d.score === 'number') {
      scoreEl.textContent = d.score.toString();
    }
    if (comboEl && typeof d.combo === 'number') {
      comboEl.textContent = 'COMBO x' + d.combo;
    }
    if (missEl && (typeof d.misses === 'number' || typeof d.miss === 'number')) {
      const m = (typeof d.misses === 'number') ? d.misses : d.miss;
      missEl.textContent = 'MISS ' + m;
    }
    if (timeEl && typeof d.timeSec === 'number') {
      const t = Math.max(0, Math.round(d.timeSec));
      timeEl.textContent = t + 's';
    }
  });

  // -------- เวลา countdown จาก hha:time (sec) --------
  ROOT.addEventListener('hha:time', (ev) => {
    ensureRefs();
    const sec = ev.detail && typeof ev.detail.sec === 'number'
      ? ev.detail.sec
      : (ev.detail?.sec | 0);
    if (timeEl && sec >= 0) {
      timeEl.textContent = sec + 's';
    }
  });

  // -------- Goal + Mini จาก quest:update --------
  ROOT.addEventListener('quest:update', (ev) => {
    ensureRefs();
    const d = ev.detail || {};

    const goalsAll = d.goalsAll || (d.goal ? [d.goal] : []);
    const minisAll = d.minisAll || (d.mini ? [d.mini] : []);

    // Goal: แสดงทีละ 2 อัน
    if (goalListEl) {
      if (!goalsAll.length) {
        goalListEl.innerHTML =
          `<li class="hha-quest-empty">ยังไม่มี Goal ในรอบนี้</li>`;
      } else {
        goalListEl.innerHTML = goalsAll
          .slice(0, 2)
          .map((g, idx) => fmtQuestItem(g, idx))
          .join('');
      }
    }

    // Mini quest: แสดงทีละ 3 อัน
    if (miniListEl) {
      if (!minisAll.length) {
        miniListEl.innerHTML =
          `<li class="hha-quest-empty">ยังไม่มี Mini quest</li>`;
      } else {
        miniListEl.innerHTML = minisAll
          .slice(0, 3)
          .map((m, idx) => fmtQuestItem(m, idx))
          .join('');
      }
    }

    if (hintEl && typeof d.hint === 'string') {
      hintEl.textContent = d.hint;
    }
  });
}

// auto-init
(function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      createHud();
      setupListeners();
    });
  } else {
    createHud();
    setupListeners();
  }
})();