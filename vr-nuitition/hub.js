// === Hero Health — hub.js (3D Hub + Profile + Preview) ===
// หน้าที่:
// - เลือกโหมด (4 โหมดพร้อมใช้งาน)
// - ตั้ง diff / time
// - จัดการโปรไฟล์เด็ก (sessionStorage)
// - preview ข้อความโหมด
// - redirect ไป index.vr.html?mode=…&diff=…&time=…

'use strict';

(function () {
  const MODES = ['goodjunk', 'groups', 'hydration', 'plate'];
  let currentMode = 'goodjunk';

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }

  function playClick() {
    try {
      const el = $('#hubClickSfx');
      if (el) {
        el.currentTime = 0;
        el.play().catch(function () {});
      }
    } catch (e) {}
  }

  // ---------- Profile handling ----------
  function loadProfile() {
    try {
      const name  = sessionStorage.getItem('hhaProfileName')  || '';
      const sid   = sessionStorage.getItem('hhaProfileId')    || '';
      const grade = sessionStorage.getItem('hhaProfileGrade') || '';

      const nameInp  = $('#profileName');
      const idInp    = $('#profileId');
      const gradeInp = $('#profileGrade');

      if (nameInp)  nameInp.value  = name;
      if (idInp)    idInp.value    = sid;
      if (gradeInp) gradeInp.value = grade;

      const hint = $('#profileHint');
      if (hint) {
        if (name) {
          hint.textContent = 'โหลดโปรไฟล์ของ "' + name + '" จากรอบก่อนแล้ว';
        } else {
          hint.textContent = 'กรอกอย่างน้อยชื่อเล่น เพื่อให้ไฟล์วิจัยระบุตัวผู้เล่นได้';
        }
      }
    } catch (e) {
      // เงียบไว้
    }
  }

  function saveProfile() {
    const name  = $('#profileName')  ? $('#profileName').value.trim()  : '';
    const sid   = $('#profileId')    ? $('#profileId').value.trim()    : '';
    const grade = $('#profileGrade') ? $('#profileGrade').value.trim() : '';

    try {
      sessionStorage.setItem('hhaProfileName',  name);
      sessionStorage.setItem('hhaProfileId',    sid);
      sessionStorage.setItem('hhaProfileGrade', grade);
      // room เผื่อใช้ในอนาคต
      sessionStorage.setItem('hhaProfileRoom',  grade);

      const hint = $('#profileHint');
      if (hint) {
        hint.textContent = name
          ? 'บันทึกโปรไฟล์ของ "' + name + '" เรียบร้อยแล้ว'
          : 'บันทึกโปรไฟล์ว่างเรียบร้อยแล้ว';
      }
    } catch (e) {
      console.warn('[HERO-HUB] saveProfile error', e);
    }
  }

  function initProfile() {
    loadProfile();
    const btn = $('#btnSaveProfile');
    if (btn) {
      btn.addEventListener('click', function () {
        saveProfile();
        playClick();
      });
    }
  }

  // ---------- Mode cards + preview ----------
  function selectMode(modeId) {
    if (!MODES.includes(modeId)) return;
    currentMode = modeId;

    $all('.mode-card').forEach(function (card) {
      card.classList.remove('active');
    });
    const card = document.querySelector('.mode-card[data-mode="' + modeId + '"]');
    if (card) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }

    updatePreviewText(modeId);
    playClick();
  }

  function updatePreviewText(modeId) {
    const panel = $('#modePreviewPanel');
    const textEl = $('#modePreviewText');
    if (!panel || !textEl) return;

    let text = '';
    if (modeId === 'goodjunk') {
      text = 'Good vs Junk: คลิกของดี เช่น ผัก ผลไม้ นม ปลาดี ๆ แล้วหลบอาหารขยะ ฝึก reflex และการตัดสินใจภายในเวลาจำกัด.';
    } else if (modeId === 'groups') {
      text = 'Food Groups: ระบบจะสุ่มหมู่อาหารเป้าหมาย 1 หมู่ ให้เลือกเฉพาะอาหารในหมู่ที่กำหนด เหมาะสำหรับฝึกจำหมู่อาหาร 5 หมู่.';
    } else if (modeId === 'hydration') {
      text = 'Hydration: แยกน้ำดี (น้ำเปล่า นม ชาไม่หวาน) ออกจากเครื่องดื่มหวาน เพื่อลดการบริโภคน้ำตาลเกินจำเป็น ฝึก conceptual decision.';
    } else if (modeId === 'plate') {
      text = 'Balanced Plate: เลือกเฉพาะอาหารที่ทำให้จานสมดุล มีผัก ผลไม้ ข้าว-แป้ง และโปรตีนดีในสัดส่วนที่เหมาะสม เหมาะสำหรับสอนหลักโภชนาการ.';
    } else {
      text = 'เลือกโหมดด้านบนเพื่อดูคำอธิบายแบบย่อ และตั้งค่าการเล่นรอบนี้.';
    }

    textEl.textContent = text;

    // เปลี่ยน emoji preview ให้ไม่ซ้ำ (เล็ก ๆ น้อย ๆ)
    const iconEl = document.querySelector('.preview-icon[data-preview="' + modeId + '"]');
    if (iconEl) {
      const pool = {
        goodjunk: ['🍎','🍓','🥦','🍟','🍔','🧁'],
        groups: ['🍚','🥦','🍎','🍗','🥛'],
        hydration: ['💧','🚰','🥤','🧋'],
        plate: ['🥦','🍇','🍚','🍗','🍽️']
      }[modeId] || ['✨'];
      iconEl.textContent = pool[Math.floor(Math.random() * pool.length)];
    }
  }

  function initModeCards() {
    const cards = $all('.mode-card[data-mode]');
    if (!cards.length) return;

    cards.forEach(function (card) {
      const modeId = card.getAttribute('data-mode');
      card.addEventListener('click', function () {
        selectMode(modeId);
      });
    });

    selectMode(currentMode);
  }

  // ---------- Time + diff helpers ----------
  function clampTime(sec) {
    let n = parseInt(sec, 10);
    if (isNaN(n)) n = 60;
    if (n < 20) n = 20;
    if (n > 180) n = 180;
    return n;
  }

  // ---------- Start button ----------
  function onStartClick() {
    const nameInp = $('#profileName');
    const diffSel = $('#selDiff');
    const timeInp = $('#inpTime');

    const name = nameInp ? nameInp.value.trim() : '';
    if (!name) {
      alert('กรุณากรอกชื่อเล่น/ชื่อจริงของผู้เล่นอย่างน้อย 1 ช่อง ก่อนเริ่มเกม');
      if (nameInp) nameInp.focus();
      return;
    }

    saveProfile();

    const diff = diffSel ? (diffSel.value || 'normal') : 'normal';
    const time = clampTime(timeInp ? timeInp.value : 60);
    if (timeInp) timeInp.value = String(time);

    const params = new URLSearchParams();
    params.set('mode', currentMode);
    params.set('diff', diff);
    params.set('time', String(time));

    const url = './index.vr.html?' + params.toString();
    console.log('[HERO-HUB] redirect to', url);
    playClick();
    window.location.href = url;
  }

  function initStartButton() {
    const btn = $('#btnStart');
    if (!btn) return;
    btn.addEventListener('click', onStartClick);
  }

  // ---------- Bootstrap ----------
  function bootstrap() {
    initProfile();
    initModeCards();
    initStartButton();
    console.log('[HERO-HUB] ready, default mode =', currentMode);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
