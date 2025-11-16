// === Hero Health — hub.js (Profile + Mode/Diff + ส่งต่อไปหน้า play) ===
(function () {
  'use strict';

  const $id = (id) => document.getElementById(id);

  // ----- ดึง element โปรไฟล์ (รองรับหลายชื่อ id เผื่อของเดิม) -----
  const nameInput  = $id('hha-name')  || $id('hha-profile-name');
  const gradeInput = $id('hha-grade') || $id('hha-profile-grade');
  const roomInput  = $id('hha-room')  || $id('hha-profile-room');
  const sidInput   = $id('hha-sid')   || $id('hha-profile-id');

  // ปุ่มเริ่มเกม
  const startBtn   = $id('hha-start') || $id('hha-start-btn');

  // ปุ่มเลือกโหมด / diff (ถ้าใช้ data-attribute)
  let currentMode = 'goodjunk';
  let currentDiff = 'normal';

  function qsAll(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel));
  }

  // ----- โหลดโปรไฟล์เก่าจาก sessionStorage ถ้ามี -----
  function loadProfileFromStorage() {
    try {
      const raw = sessionStorage.getItem('hha_profile');
      if (!raw) return;
      const p = JSON.parse(raw) || {};
      if (nameInput && p.name) nameInput.value = p.name;
      if (gradeInput && p.grade) gradeInput.value = p.grade;
      if (roomInput && p.room) roomInput.value = p.room;
      if (sidInput && p.sid) sidInput.value = p.sid;
      console.log('[HHA HUB] loaded profile from storage', p);
    } catch (e) {
      console.warn('[HHA HUB] loadProfile error', e);
    }
  }

  // ----- บันทึกโปรไฟล์ลง sessionStorage -----
  function saveProfileToStorage() {
    const profile = {
      name:  nameInput  ? nameInput.value.trim()  : '',
      grade: gradeInput ? gradeInput.value.trim() : '',
      room:  roomInput  ? roomInput.value.trim()  : '',
      sid:   sidInput   ? sidInput.value.trim()   : ''
    };
    try {
      sessionStorage.setItem('hha_profile', JSON.stringify(profile));
      console.log('[HHA HUB] saved profile', profile);
    } catch (e) {
      console.warn('[HHA HUB] saveProfile error', e);
    }
    return profile;
  }

  // ถ้ามีการเปลี่ยน field ให้เซฟไว้ทันที (กันเด็กหลุดหน้า)
  [nameInput, gradeInput, roomInput, sidInput].forEach(function (el) {
    if (!el) return;
    el.addEventListener('change', saveProfileToStorage);
    el.addEventListener('blur', saveProfileToStorage);
  });

  // ----- เลือกโหมดเกม -----
  qsAll('[data-mode]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const m = btn.getAttribute('data-mode') || 'goodjunk';
      currentMode = m.toLowerCase();

      // ไฮไลต์ปุ่ม
      qsAll('[data-mode]').forEach(function (b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');
    });
  });

  // ----- เลือกระดับความยาก -----
  qsAll('[data-diff]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const d = btn.getAttribute('data-diff') || 'normal';
      currentDiff = d.toLowerCase();

      qsAll('[data-diff]').forEach(function (b) {
        b.classList.remove('is-active');
      });
      btn.classList.add('is-active');
    });
  });

  // ----- ปุ่มเริ่มเล่น -----
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      const profile = saveProfileToStorage();

      // บังคับใส่ชื่อก่อน
      if (!profile.name) {
        alert('ใส่ชื่อนักเรียนก่อนเริ่มเล่นนะ 😊');
        if (nameInput) nameInput.focus();
        return;
      }

      // สามารถเปลี่ยนเวลาเกมตรงนี้ได้ ถ้าจะให้เลือกจาก UI
      const gameTime = 60;

      const params = new URLSearchParams({
        mode: currentMode,
        diff: currentDiff,
        time: String(gameTime)
      });

      // ส่งต่อไปหน้าเล่นเกม
      window.location.href = './play.html?' + params.toString();
    });
  }

  // ----- init -----
  loadProfileFromStorage();
})();
