// === Hero Health — hub.js (Profile + Mode/Diff → play.html) ===
(function () {
  'use strict';

  const $id = (id) => document.getElementById(id);
  const $$  = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

  // ----- โปรไฟล์จาก hub.html -----
  const nameInput  = $id('profileName');
  const gradeInput = $id('profileGrade');
  const idInput    = $id('profileId');

  const saveBtn  = $id('btnSaveProfile');
  const startBtn = $id('btnStart');

  let currentMode = 'goodjunk';
  let currentDiff = 'normal';

  // ----- โหลดโปรไฟล์จาก sessionStorage ถ้ามี -----
  function loadProfileFromStorage() {
    try {
      const raw = sessionStorage.getItem('hha_profile');
      if (!raw) return;
      const p = JSON.parse(raw) || {};
      if (nameInput  && p.name)  nameInput.value  = p.name;
      if (gradeInput && p.grade) gradeInput.value = p.grade;
      // room ไม่มีช่องให้กรอกใน hub.html ตอนนี้ ปล่อยว่างไปก่อน
      if (idInput    && p.sid)   idInput.value    = p.sid;
      console.log('[HHA HUB] loaded profile', p);
    } catch (e) {
      console.warn('[HHA HUB] loadProfile error', e);
    }
  }

  // ----- เซฟโปรไฟล์ลง sessionStorage -----
  function saveProfileToStorage() {
    const profile = {
      name:  nameInput  ? nameInput.value.trim()  : '',
      grade: gradeInput ? gradeInput.value.trim() : '',
      room:  '', // ยังไม่มี field แยกห้องใน hub.html
      sid:   idInput    ? idInput.value.trim()    : ''
    };
    try {
      sessionStorage.setItem('hha_profile', JSON.stringify(profile));
      console.log('[HHA HUB] saved profile', profile);
    } catch (e) {
      console.warn('[HHA HUB] saveProfile error', e);
    }
    return profile;
  }

  // ให้เซฟอัตโนมัติเมื่อผู้ใช้แก้ไข
  [nameInput, gradeInput, idInput].forEach((el) => {
    if (!el) return;
    el.addEventListener('change', saveProfileToStorage);
    el.addEventListener('blur', saveProfileToStorage);
  });

  if (saveBtn) {
    saveBtn.addEventListener('click', function () {
      const p = saveProfileToStorage();
      if (!p.name) {
        alert('ใส่ชื่อนักเรียนก่อนนะ 😊');
        if (nameInput) nameInput.focus();
      } else {
        alert('บันทึกโปรไฟล์เรียบร้อยแล้ว ✅');
      }
    });
  }

  // ----- เลือกโหมดเกม (การ์ด data-mode) -----
  function setActiveModeCard(mode) {
    $$('.mode-card').forEach((card) => {
      if (card.getAttribute('data-mode') === mode) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
  }

  // default = goodjunk
  setActiveModeCard(currentMode);

  $$('.mode-card[data-mode]').forEach((card) => {
    card.addEventListener('click', function () {
      const m = card.getAttribute('data-mode') || 'goodjunk';
      currentMode = m.toLowerCase();
      setActiveModeCard(currentMode);
    });
  });

  // ----- diff + time -----
  const diffSelect = $id('selDiff');
  const timeInput  = $id('inpTime');

  if (diffSelect) {
    diffSelect.addEventListener('change', function () {
      currentDiff = (diffSelect.value || 'normal').toLowerCase();
    });
    currentDiff = (diffSelect.value || 'normal').toLowerCase();
  }

  // ----- ปุ่มเริ่มเล่น -----
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      const profile = saveProfileToStorage();

      if (!profile.name) {
        alert('กรอก “ชื่อนักเรียน” ก่อนเริ่มเล่นนะครับ 😊');
        if (nameInput) nameInput.focus();
        return;
      }

      let t = 60;
      if (timeInput) {
        const n = parseInt(timeInput.value, 10);
        if (!isNaN(n)) t = n;
      }
      if (t < 20) t = 20;
      if (t > 180) t = 180;

      const params = new URLSearchParams({
        mode: currentMode,
        diff: currentDiff,
        time: String(t)
      });

      window.location.href = './play.html?' + params.toString();
    });
  }

  // ----- init ตอนโหลดหน้า -----
  loadProfileFromStorage();
})();
