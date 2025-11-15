// === Hero Health — Hub (3D cards + profile + ready-check) ===
'use strict';

const MODES = {
  goodjunk: {
    id: 'goodjunk',
    label: 'Good vs Junk',
    desc: 'คลิกของดี หลบของขยะ เก็บคอมโบให้ได้สูงสุด',
    ready: true
  },
  groups: {
    id: 'groups',
    label: 'Food Groups',
    desc: 'เลือกอาหารให้ตรงหมู่เป้าหมายในรอบนั้น ๆ',
    ready: true
  },
  hydration: {
    id: 'hydration',
    label: 'Hydration',
    desc: 'เลือกเครื่องดื่มที่ดีต่อสุขภาพ เลี่ยงน้ำหวานจัด',
    ready: true          // ⬅️ เดิมน่าจะ false ตรงนี้
  },
  plate: {
    id: 'plate',
    label: 'Balanced Plate',
    desc: 'เลือกอาหารให้เหมาะกับจานสมดุล ผัก/ข้าว/โปรตีนดี',
    ready: true          // ⬅️ เดิมน่าจะ false ตรงนี้
  }
};

let currentMode = 'goodjunk';
let currentDiff = 'normal';
let currentTime = 60;

function $ (sel) { return document.querySelector(sel); }
function $$ (sel) { return document.querySelectorAll(sel); }

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  let el = $('#hh-hub-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hh-hub-toast';
    Object.assign(el.style, {
      position: 'fixed',
      bottom: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 16px',
      borderRadius: '999px',
      background: 'rgba(15,23,42,0.96)',
      color: '#e5e7eb',
      fontSize: '12px',
      border: '1px solid rgba(56,189,248,0.9)',
      boxShadow: '0 12px 30px rgba(0,0,0,0.6)',
      zIndex: '9999',
      opacity: '0',
      transition: 'opacity 150ms ease'
    });
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.style.opacity = '0';
  }, 2000);
}

// ---------- Mode cards ----------
function selectMode(id) {
  if (!MODES[id]) return;
  currentMode = id;

  $$('#modeRow .card, #modeRow .mode-card').forEach(card => {
    card.classList.remove('active');
  });

  const card = document.querySelector(
    '#modeRow [data-mode="' + id + '"]'
  );
  if (card) card.classList.add('active');

  const meta = MODES[id];
  const subtitle = $('#hub-mode-subtitle');
  if (subtitle && meta) {
    subtitle.textContent = meta.desc || '';
  }
}

function initModeCards() {
  const cards = $$('#modeRow [data-mode]');
  if (!cards.length) return;

  cards.forEach(card => {
    const id = card.getAttribute('data-mode');
    card.addEventListener('click', () => {
      const meta = MODES[id];
      if (!meta) return;

      if (!meta.ready) {
        showToast('โหมดนี้ยังไม่พร้อมใช้งาน');
        return;
      }
      selectMode(id);

      // เอฟเฟกต์เด้งนิด ๆ
      card.style.transform = 'translateY(-4px) scale(1.02)';
      card.style.transition = 'transform 120ms ease';
      setTimeout(() => {
        card.style.transform = '';
      }, 130);
    });
  });

  // default
  selectMode(currentMode);
}

// ---------- Difficulty & Time ----------
function clampTime(sec) {
  let n = parseInt(sec, 10);
  if (isNaN(n)) n = 60;
  if (n < 20) n = 20;
  if (n > 180) n = 180;
  return n;
}

function initControls() {
  const diffSel = $('#selDiff');
  const timeInp = $('#inpTime');

  if (diffSel) {
    diffSel.addEventListener('change', () => {
      currentDiff = diffSel.value || 'normal';
    });
    currentDiff = diffSel.value || 'normal';
  }

  if (timeInp) {
    timeInp.addEventListener('change', () => {
      const t = clampTime(timeInp.value);
      timeInp.value = String(t);
      currentTime = t;
    });
    const t = clampTime(timeInp.value || 60);
    timeInp.value = String(t);
    currentTime = t;
  }
}

// ---------- Profile (optional, ไม่บังคับ) ----------
function readProfile() {
  const nameEl = $('#studentName');
  const gradeEl = $('#studentGrade');
  const idEl = $('#studentId');
  return {
    name: nameEl ? (nameEl.value || '').trim() : '',
    grade: gradeEl ? (gradeEl.value || '').trim() : '',
    sid: idEl ? (idEl.value || '').trim() : ''
  };
}

// ---------- Start button ----------
function initStartButton() {
  const btn = $('#btnStart');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const meta = MODES[currentMode];
    if (!meta || !meta.ready) {
      showToast('โหมดนี้ยังไม่พร้อมใช้งาน');
      return;
    }

    const diffSel = $('#selDiff');
    const timeInp = $('#inpTime');
    const diff = diffSel ? (diffSel.value || currentDiff) : currentDiff;
    const t = clampTime(timeInp ? timeInp.value : currentTime);

    if (timeInp) timeInp.value = String(t);
    currentDiff = diff;
    currentTime = t;

    // เก็บ profile ไว้ใน sessionStorage ให้ main.js ใช้บันทึก CSV
    const profile = readProfile();
    try {
      sessionStorage.setItem(
        'hha_profile',
        JSON.stringify(profile)
      );
    } catch (e) {
      console.warn('[HHA HUB] cannot store profile', e);
    }

    const params = new URLSearchParams();
    params.set('mode', currentMode);
    params.set('diff', diff);
    params.set('time', String(t));

    const url = './index.vr.html?' + params.toString();
    console.log('[HHA HUB] go play:', url);
    window.location.href = url;
  });
}

// ---------- Bootstrap ----------
function bootstrap() {
  initModeCards();
  initControls();
  initStartButton();
  console.log('[HHA HUB] ready. modes =', Object.keys(MODES));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
