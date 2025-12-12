// === /herohealth/plate/plate.main.js ===
'use strict';

import PlateMode from './plate.mode.js';

const url = new URL(window.location.href);
let diff = (url.searchParams.get('diff') || 'normal').toLowerCase();

let duration = parseInt(url.searchParams.get('time'), 10);
if (isNaN(duration) || duration <= 0) {
  duration = 60;
}
if (duration < 20) duration = 20;
if (duration > 180) duration = 180;

// ---- ตรวจว่าเป็นโหมดวิจัยหรือไม่ ----
// สมมติใช้ ?variant=research หรือ ?research=1
const variant = (url.searchParams.get('variant') || '').toLowerCase();
const isResearchMode =
  variant === 'research' ||
  url.searchParams.get('research') === '1';

// ---- โหลดโปรไฟล์นักเรียนจาก sessionStorage ----
// key สมมติใช้ 'HeroHealthProfile' (เหมือน GoodJunkVR)
let playerProfile = {};
try {
  const raw = window.sessionStorage.getItem('HeroHealthProfile');
  if (raw) {
    playerProfile = JSON.parse(raw);
  }
} catch (err) {
  console.warn('[Plate] cannot parse HeroHealthProfile', err);
}

function hasProfile(p) {
  if (!p || typeof p !== 'object') return false;
  // ปรับ field ตามที่ hub บันทึก เช่น studentId / sid / code ฯลฯ
  return !!(p.studentId || p.sid || p.code || p.name);
}

// แชร์ให้ logger / เกมอื่นใช้ได้
window.HHA_PLAYER = playerProfile;

// ถ้าเป็นโหมดวิจัยแต่ไม่มีโปรไฟล์ → block การเล่น
let researchBlocked = false;
if (isResearchMode && !hasProfile(playerProfile)) {
  researchBlocked = true;
  console.warn('[Plate] Research mode but no player profile');

  // ถ้ามี element สำหรับแจ้งเตือนในหน้า HTML ใช้ร่วมได้
  const warnEl = document.querySelector('#research-warning');
  if (warnEl) {
    warnEl.hidden = false;
  } else {
    alert(
      'โหมดวิจัย: ยังไม่มีโปรไฟล์นักเรียน\n' +
      'กรุณาเลือกโปรไฟล์จากหน้า Hub ก่อนเข้ามาเล่น'
    );
  }
}

let timerId = null;
let secLeft = duration;
let ctrl = null;

function emitTime(sec) {
  try {
    window.dispatchEvent(new CustomEvent('hha:time', { detail: { sec } }));
  } catch {}
}

function formatTime(sec) {
  const s = Math.max(0, sec | 0);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function updateTimeHud(sec) {
  const el = document.querySelector('[data-hud="time"]');
  if (el) el.textContent = formatTime(sec);
}

function stopGameTimer() {
  if (timerId != null) {
    clearInterval(timerId);
    timerId = null;
  }
}

async function startGame() {
  // ✅ กันไว้: โหมดวิจัยแต่ไม่มีโปรไฟล์ → ไม่ให้เริ่ม
  if (researchBlocked) {
    alert('ยังไม่มีข้อมูลคนเล่น (โปรไฟล์นักเรียน) เลยเข้าโหมดวิจัยไม่ได้');
    return;
  }

  stopGameTimer();
  secLeft = duration;
  updateTimeHud(secLeft);
  emitTime(secLeft);

  if (ctrl && typeof ctrl.stop === 'function') {
    ctrl.stop();
  }

  ctrl = await PlateMode.boot({
    difficulty: diff,
    duration
    // ถ้าต้องการส่ง profile เข้าไปด้วย เผื่อ plate.safe.js จะยิงไป logger
    // profile: playerProfile
  });

  timerId = window.setInterval(() => {
    secLeft--;
    if (secLeft < 0) secLeft = 0;
    updateTimeHud(secLeft);
    emitTime(secLeft);
    if (secLeft <= 0) {
      stopGameTimer();
    }
  }, 1000);
}

// HUD listener จาก plate.mode.js
window.addEventListener('hha:hud', (e) => {
  const d = e.detail || {};
  const scoreEl  = document.querySelector('[data-hud="score"]');
  const comboEl  = document.querySelector('[data-hud="combo"]');
  const missEl   = document.querySelector('[data-hud="miss"]');
  const groupsEl = document.querySelector('[data-hud="groups"]');
  const gradeEl  = document.querySelector('[data-hud="grade"]');
  const questEl  = document.querySelector('[data-hud="quest-progress"]');

  if (scoreEl) scoreEl.textContent = d.score ?? 0;
  if (comboEl) comboEl.textContent = d.combo ?? 0;
  if (missEl)  missEl.textContent  = d.misses ?? 0;

  if (groupsEl && Array.isArray(d.totalCounts || d.gCounts)) {
    const arr = d.totalCounts || d.gCounts;
    groupsEl.textContent = arr
      .map((v, i) => `หมู่ ${i + 1}: ${v}`)
      .join(' | ');
  }

  if (gradeEl && d.grade) {
    gradeEl.textContent = d.grade;
  }

  if (questEl && typeof d.goalsCleared === 'number' && typeof d.goalsTotal === 'number') {
    questEl.textContent =
      `Goal ${d.goalsCleared}/${d.goalsTotal} | Mini ${d.questsCleared || 0}/${d.questsTotal || 0}`;
  }
});

// Quest HUD
window.addEventListener('quest:update', (e) => {
  const d = e.detail || {};
  const goalEl = document.querySelector('[data-hud="goal"]');
  const miniEl = document.querySelector('[data-hud="mini"]');
  const hintEl = document.querySelector('[data-hud="hint"]');

  if (goalEl) goalEl.textContent = d.goal?.text || d.goal?.label || '—';
  if (miniEl) miniEl.textContent = d.mini?.text || d.mini?.label || '—';
  if (hintEl && d.hint) hintEl.textContent = d.hint;
});

// Summary panel
window.addEventListener('hha:end', (e) => {
  const d = e.detail || {};
  const panel = document.querySelector('#plate-result');
  if (!panel) return;

  panel.hidden = false;

  const scoreEl   = panel.querySelector('[data-result="score"]');
  const missEl    = panel.querySelector('[data-result="misses"]');
  const comboEl   = panel.querySelector('[data-result="comboMax"]');
  const goalsEl   = panel.querySelector('[data-result="goals"]');
  const questsEl  = panel.querySelector('[data-result="quests"]');
  const gradeEl   = panel.querySelector('[data-result="grade"]');
  const platesEl  = panel.querySelector('[data-result="plates"]');

  if (scoreEl)  scoreEl.textContent  = d.score ?? 0;
  if (missEl)   missEl.textContent   = d.misses ?? 0;
  if (comboEl)  comboEl.textContent  = d.comboMax ?? 0;
  if (goalsEl)  goalsEl.textContent  = `${d.goalsCleared || 0} / ${d.goalsTotal || 0}`;
  if (questsEl) questsEl.textContent = `${d.questsCleared || 0} / ${d.questsTotal || 0}`;
  if (gradeEl && d.grade) gradeEl.textContent = d.grade;
  if (platesEl && typeof d.platesDone === 'number') platesEl.textContent = d.platesDone;
});

document.addEventListener('DOMContentLoaded', () => {
  const startBtn = document.querySelector('[data-action="start"]');
  const retryBtn = document.querySelector('[data-action="retry"]');
  const backBtn  = document.querySelector('[data-action="back-hub"]');

  // ถ้าโหมดวิจัยแต่ไม่มีโปรไฟล์: disable ปุ่มเริ่ม
  if (startBtn && researchBlocked) {
    startBtn.disabled = true;
    startBtn.textContent = 'ไปเลือกโปรไฟล์ที่ Hub ก่อน';
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      if (researchBlocked) {
        alert('โหมดวิจัยต้องมีโปรไฟล์นักเรียนก่อน กรุณากลับไปที่ Hub');
        return;
      }
      startBtn.disabled = true;
      startGame().catch(console.error);
    });
  }

  if (retryBtn) {
    retryBtn.addEventListener('click', () => {
      const panel = document.querySelector('#plate-result');
      if (panel) panel.hidden = true;
      startGame().catch(console.error);
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = './hub.html?from=plate';
    });
  }
});