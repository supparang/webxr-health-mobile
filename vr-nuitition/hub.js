// === Hero Health — Hub (VR Nutrition) ===
// จัดการเลือกโหมด + โปรไฟล์ + ส่งไป play.html

(function () {
  'use strict';

  var STORAGE_KEY = 'HEROHEALTH_PROFILE';

  function $(s) { return document.querySelector(s); }
  function $all(s) { return document.querySelectorAll(s); }

  var modeRow        = $('#modeRow');
  var btnStart       = $('#btnStart');
  var btnSaveProfile = $('#btnSaveProfile');
  var selDiff        = $('#selDiff');
  var inpTime        = $('#inpTime');

  var inpName  = $('#profileName');
  var inpGrade = $('#profileGrade');
  var inpId    = $('#profileId');

  var currentModeCard = null;
  var currentMode     = null;

  // ---------- Profile load/save ----------

  function loadProfile() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data.name  != null)  inpName.value  = data.name;
        if (data.grade != null)  inpGrade.value = data.grade;
        if (data.id    != null)  inpId.value    = data.id;
      }
    } catch (e) {
      // ถ้า sessionStorage ใช้ไม่ได้ ก็ข้ามเฉย ๆ
      console.warn('Cannot load profile:', e);
    }
  }

  function getProfileFromInputs() {
    return {
      name:  inpName.value.trim(),
      grade: inpGrade.value.trim(),
      id:    inpId.value.trim()
    };
  }

  function saveProfile(showToast) {
    var profile = getProfileFromInputs();
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
      if (showToast) {
        // feedback เบา ๆ ให้ครู/เด็กเห็นว่าบันทึกแล้ว
        btnSaveProfile.textContent = '✅ บันทึกแล้ว';
        setTimeout(function () {
          btnSaveProfile.textContent = '💾 บันทึกโปรไฟล์';
        }, 1500);
      }
    } catch (e) {
      console.warn('Cannot save profile:', e);
      if (showToast) {
        alert('ไม่สามารถบันทึกโปรไฟล์ได้ (sessionStorage ถูกปิดใช้งาน)');
      }
    }
  }

  // ---------- Mode select ----------

  function setActiveModeCard(card) {
    if (currentModeCard === card) return;

    // ล้าง active เดิม
    var cards = $all('.mode-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].classList.remove('active');
    }

    // ตั้ง active ใหม่
    if (card) {
      card.classList.add('active');
      currentModeCard = card;
      currentMode = card.getAttribute('data-mode') || null;
    } else {
      currentModeCard = null;
      currentMode = null;
    }

    updateStartButtonLabel();
  }

  function updateStartButtonLabel() {
    var smallSpan = btnStart.querySelector('.small');
    if (!smallSpan) return;

    var diffOption = selDiff.options[selDiff.selectedIndex];
    var diffLabel = diffOption ? diffOption.textContent : '';
    var timeVal = inpTime.value || '60';

    if (!currentMode) {
      smallSpan.textContent = '(เลือกโหมด + โปรไฟล์ก่อน)';
      return;
    }

    // แปลงชื่อ mode สั้น ๆ ไว้แสดง (ไม่บังคับตรงกับ data-mode)
    var modeTitle = 'โหมด ' + currentMode;
    if (currentModeCard) {
      var t = currentModeCard.querySelector('.mode-title');
      if (t) modeTitle = t.textContent;
    }

    smallSpan.textContent =
      '(' + modeTitle + ' • ' + diffLabel + ' • ' + timeVal + 's)';
  }

  // ---------- Start game ----------

  function startGame() {
    if (!currentMode) {
      alert('กรุณาเลือกโหมดเกมก่อนนะครับ/ค่ะ');
      return;
    }

    var diff = selDiff.value || 'normal';
    var time = parseInt(inpTime.value, 10);

    if (isNaN(time)) time = 60;
    if (time < 20) time = 20;
    if (time > 180) time = 180;
    inpTime.value = time; // sync กลับเข้า input

    // บันทึกโปรไฟล์ก่อนเริ่ม
    saveProfile(false);

    // สร้าง URL ไปยังหน้า play
    var params = [
      'mode=' + encodeURIComponent(currentMode),
      'diff=' + encodeURIComponent(diff),
      'time=' + encodeURIComponent(time)
    ].join('&');

    var url = './play.html?' + params;
    console.log('Go to:', url);
    location.href = url;
  }

  // ---------- Events ----------

  function bindEvents() {
    // เลือกโหมดแบบ event delegation
    if (modeRow) {
      modeRow.addEventListener('click', function (ev) {
        var target = ev.target;
        // หา .mode-card ใกล้ ๆ
        while (target && target !== modeRow) {
          if (target.classList && target.classList.contains('mode-card')) {
            setActiveModeCard(target);
            break;
          }
          target = target.parentNode;
        }
      });
    }

    if (btnSaveProfile) {
      btnSaveProfile.addEventListener('click', function () {
        saveProfile(true);
      });
    }

    if (btnStart) {
      btnStart.addEventListener('click', function () {
        startGame();
      });
    }

    // เวลาเปลี่ยน diff หรือ time ให้ปรับ label ปุ่ม start
    if (selDiff) {
      selDiff.addEventListener('change', updateStartButtonLabel);
    }
    if (inpTime) {
      inpTime.addEventListener('input', updateStartButtonLabel);
      inpTime.addEventListener('blur', function () {
        // แก้ค่าผิด ๆ ให้เข้าช่วง 20–180
        var t = parseInt(inpTime.value, 10);
        if (isNaN(t)) t = 60;
        if (t < 20) t = 20;
        if (t > 180) t = 180;
        inpTime.value = t;
        updateStartButtonLabel();
      });
    }
  }

  // ---------- Init on load ----------

  function init() {
    loadProfile();

    // auto เลือกการ์ดแรกเป็นดีฟอลต์ (Good vs Junk)
    var firstCard = $('.mode-card');
    if (firstCard) {
      setActiveModeCard(firstCard);
    }

    updateStartButtonLabel();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();