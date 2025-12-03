// === /herohealth/vr-groups/coach.js ===
// โค้ชพูดตามสถานการณ์ + ความยาก • รองรับ Goal + Mini Quest
// Production Ready

(function (ns) {
  'use strict';

  const Coach = {};
  let lastSpeakTime = 0;
  const COOLDOWN = 1800; // ms กันพูดรัวเกินไป

  let hudEl = null;
  let textEl = null;

  //--------------------------------------------------------------------
  // init — รับ element จาก groups-vr.html
  //--------------------------------------------------------------------
  Coach.init = function () {
    hudEl = document.getElementById('coach-bubble');
    textEl = document.getElementById('coach-text');
    if (!hudEl || !textEl) {
      console.warn('[GroupsVR Coach] HUD element missing!');
    }
  };

  //--------------------------------------------------------------------
  // speak — แสดงข้อความ
  //--------------------------------------------------------------------
  function speak(msg) {
    const now = performance.now();
    if (now - lastSpeakTime < COOLDOWN) return;  // กันสแปมโค้ชพูด
    lastSpeakTime = now;

    if (!hudEl || !textEl) return;

    textEl.textContent = msg;
    hudEl.classList.add('show');

    // ซ่อนอัตโนมัติ
    setTimeout(() => {
      hudEl.classList.remove('show');
    }, 2400);
  }

  //--------------------------------------------------------------------
  // ชุดคำพูดตามระดับ
  //--------------------------------------------------------------------
  const VOICE = {
    easy: {
      start: [
        'เริ่มกันเบา ๆ นะ ยิงให้ตรงกลุ่มอาหารจ้า!',
        'สบาย ๆ เลย ยิ่งเร็วได้คะแนนเยอะนะ!',
      ],
      hit: [
        'ดีมาก! ตรงกลุ่มพอดีเลย!',
        'สุดยอด! ยิงถูกต้อง!',
      ],
      miss: [
        'โอ๊ะ! กลุ่มไม่ตรง ลองใหม่นะ!',
        'ไม่เป็นไร ๆ ตั้งใจอีกนิด!',
      ],
      quest: [
        'โฟกัสกลุ่มนี้ก่อนนะ!',
        'ภารกิจมาแล้ว ยิงให้ตรงกลุ่มนี้!',
      ],
      warn: [
        'ค่อย ๆ ดูสัญลักษณ์ แล้วเลือกให้ถูกนะ!',
      ]
    },

    normal: {
      start: [
        'เริ่มภารกิจกันเลย จัดกลุ่มอาหารให้ถูกนะ!',
        'ระวังกลุ่มที่คล้ายกันนะ ดูดี ๆ ก่อนยิง!'
      ],
      hit: [
        'ดีมาก! จัดได้ถูกต้อง!',
        'โอเคเลย! ไปต่อ!'
      ],
      miss: [
        'พลาดนิดเดียว ดูกลุ่มให้ชัดก่อนยิงนะ!',
        'อย่ารีบเกินไป ตั้งใจอีกนิด!'
      ],
      quest: [
        'เป้าหมายภารกิจมาแล้ว เล็งให้แม่น!',
        'เลือกให้ตรงกลุ่มภารกิจนะ!'
      ],
      warn: [
        'กลุ่มนี้สับสนได้ง่ายนะ ดูดี ๆ!',
      ]
    },

    hard: {
      start: [
        'ระดับยาก! ต้องโฟกัสสุด ๆ นะ!',
        'เข้าสู่โหมดท้าทาย เล็งให้เป๊ะ!',
      ],
      hit: [
        'ดีมาก! ความแม่นยำสูง!',
        'สุดยอด ยิงได้ตรงจุด!'
      ],
      miss: [
        'พลาดแบบนี้ไม่ได้แล้วนะ!',
        'ระวัง! กลุ่มคล้ายกันมาก!'
      ],
      quest: [
        'ภารกิจสำคัญ! ยิงผิดไม่ได้!',
        'เล็งให้ชัวร์ก่อนยิงภารกิจ!',
      ],
      warn: [
        'อย่าพลาดเด็ดขาด ดูสัญลักษณ์ให้ละเอียด!',
      ]
    }
  };

  //--------------------------------------------------------------------
  // Random helper
  //--------------------------------------------------------------------
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  //--------------------------------------------------------------------
  // API: พูดตามสถานการณ์
  //--------------------------------------------------------------------
  Coach.speakStart = diff => speak(pick(VOICE[diff].start));
  Coach.speakHit   = diff => speak(pick(VOICE[diff].hit));
  Coach.speakMiss  = diff => speak(pick(VOICE[diff].miss));
  Coach.speakQuest = diff => speak(pick(VOICE[diff].quest));
  Coach.speakWarn  = diff => speak(pick(VOICE[diff].warn));

  //--------------------------------------------------------------------
  // API: พูดตาม goal / mini quest
  //--------------------------------------------------------------------
  Coach.speakGoal = function (diff, goalObj) {
    if (!goalObj) return;
    speak(`ภารกิจ: ${goalObj.title || 'ทำให้ถูกต้องนะ!'}!`);
  };

  Coach.speakMini = function (diff, miniObj) {
    if (!miniObj) return;
    speak(`มินิคเวสต์: ${miniObj.title || 'ทำให้ถูกต้องนะ!'}!`);
  };

  //--------------------------------------------------------------------
  // export
  //--------------------------------------------------------------------
  ns.foodGroupsCoach = Coach;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));