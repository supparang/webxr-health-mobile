// vr-groups/coach.js
// โค้ชโภชนาการ — พูดแตกต่างกันตามระดับความยาก + react ตอนยิงโดน/พลาด
(function (ns) {
  'use strict';

  let bubbleEl = null;
  let nameEl   = null;
  let textEl   = null;
  let faceEl   = null;

  let currentDiff = 'normal';
  let lastHitTs   = 0;
  let lastMissTs  = 0;

  function ensureDom() {
    if (bubbleEl) return;
    bubbleEl = document.getElementById('fgCoachBubble');
    nameEl   = document.getElementById('fgCoachName');
    textEl   = document.getElementById('fgCoachText');
    faceEl   = document.getElementById('fgCoachFace');

    if (bubbleEl) {
      bubbleEl.style.display       = 'flex';
      bubbleEl.style.pointerEvents = 'none'; // กันไม่ให้บังการคลิก
    }
  }

  function showBubble(msg, opts) {
    ensureDom();
    if (!bubbleEl || !textEl) return;

    opts = opts || {};

    if (nameEl && opts.name) {
      nameEl.textContent = opts.name;
    } else if (nameEl && !nameEl.textContent) {
      nameEl.textContent = 'โค้ชผักบุ้ง';
    }

    if (faceEl && opts.face) {
      faceEl.textContent = opts.face;
    } else if (faceEl && !faceEl.textContent) {
      faceEl.textContent = '🥦';
    }

    textEl.textContent = msg;
    bubbleEl.style.opacity = '1';
    bubbleEl.classList.remove('fg-coach-pop');
    // force reflow
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('fg-coach-pop');

    const ttl = typeof opts.ttl === 'number' ? opts.ttl : 2600;
    if (ttl > 0) {
      setTimeout(() => {
        if (!bubbleEl) return;
        bubbleEl.style.opacity = '0.0';
      }, ttl);
    }
  }

  function diffLabel(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy':   return 'ง่าย';
      case 'hard':   return 'ยาก';
      case 'normal':
      default:       return 'ปกติ';
    }
  }

  const Coach = {
    setDifficulty(diff) {
      currentDiff = diff || 'normal';
      showBubble(`วันนี้เราเล่นระดับ “${diffLabel(currentDiff)}” นะ ลองจัดจานให้สมดุลให้ได้เยอะที่สุด 🎯`, {
        face: '🧑‍🍳',
        ttl: 3500
      });
    },

    sayStart() {
      if (currentDiff === 'easy') {
        showBubble('เริ่มเลย! โค้ชจะคอยช่วยบอกหมู่อาหารให้นะ เล็งช้า ๆ ก็ได้ 🤝', {
          face: '😊',
          ttl: 3200
        });
      } else if (currentDiff === 'hard') {
        showBubble('โหมดท้าทาย! ยิงให้ไว เลือกให้ถูกหมู่ ใครไวกว่าได้คะแนนเยอะ 🏅', {
          face: '😎',
          ttl: 3200
        });
      } else {
        showBubble('มาเล่นจัดหมู่อาหารให้ครบ 5 หมู่กันนะ เล็งดี ๆ แล้วกดยิงเลย ✨', {
          face: '🥦',
          ttl: 3200
        });
      }
    },

    sayFinish(summary) {
      summary = summary || {};
      const score   = summary.score   || 0;
      const cleared = summary.questsCleared || 0;
      const total   = summary.questsTotal != null ? summary.questsTotal : null;

      let msg;
      if (total != null && cleared >= total && total > 0) {
        msg = `สุดยอดเลย! เคลียร์ภารกิจครบ ${cleared}/${total} ภารกิจ ได้ ${score} คะแนน 🎉`;
      } else if (score > 120) {
        msg = `เยี่ยมมาก! คะแนน ${score} แล้ว ลองรอบหน้าท้าทายระดับที่ยากขึ้นดูไหม 😄`;
      } else {
        msg = `จบเกมแล้ว ได้ ${score} คะแนน รอบหน้าลองโฟกัสผัก-ผลไม้ให้มากขึ้นนะ 🌱`;
      }

      showBubble(msg, {
        face: '👏',
        ttl: 4000
      });
    },

    // ใช้กรณี fallback ถ้าไม่ได้ใช้ onQuestChange
    sayQuest(quest, progress) {
      if (!quest) return;
      const pct = Math.round((progress || 0) * 100);
      let label = quest.title || quest.label || 'ภารกิจหมู่อาหาร';
      showBubble(`${label} คืบหน้า ${pct}% แล้ว สู้ต่ออีกหน่อย! 💪`, {
        face: '🥕'
      });
    },

    onQuestChange(info) {
      if (!info) return;
      const { current, justFinished, finished, status } = info;

      if (justFinished && finished) {
        const label = finished.title || finished.label || 'ภารกิจ';
        showBubble(`เยี่ยม! ทำ “${label}” สำเร็จแล้ว 🎉`, {
          face: '🎯',
          ttl: 3200
        });
        return;
      }

      if (current && (!status || status.index % 2 === 0)) {
        const label = current.title || current.label || 'ภารกิจถัดไป';
        showBubble(`ต่อไปลองโฟกัส “${label}” ให้มากขึ้นนะ 🥗`, {
          face: '🥗',
          ttl: 2600
        });
      }
    },

    onHit(hit) {
      const now = Date.now();
      // กันโค้ชพูดถี่เกินไป
      if (now - lastHitTs < 600) return;
      lastHitTs = now;

      if (!hit) return;
      const { isGood, isQuestTarget, judgment, emoji } = hit;

      let msg = null;
      let face = '🥦';

      if (isGood) {
        if (judgment === 'perfect') {
          msg = `ยิงไวมาก! ${emoji} แบบนี้แหละจานสุขภาพสุดปัง ✨`;
          face = '🤩';
        } else if (judgment === 'good') {
          msg = `ยอดเยี่ยม เลือกอาหารดีได้อีกหนึ่งอย่างแล้วนะ ${emoji} 👍`;
          face = '😄';
        } else if (judgment === 'late') {
          msg = `เกือบไม่ทันแล้ว แต่ก็ยิงโดน ${emoji} ทันเวลาเลย 😌`;
          face = '🙂';
        } else {
          msg = `ยิงโดนแล้ว! ค่อย ๆ มองให้รอบก่อนกดยิงก็ได้ ${emoji}`;
          face = '😊';
        }

        if (isQuestTarget) {
          msg += ' (เป้าหมายภารกิจด้วย เยี่ยมมาก!)';
        }
      } else {
        // ยิงโดนอาหารควรลด
        msg = `อุ๊ย นั่นเป็นอาหารควรลดนะ ${emoji} รอบหน้าลองเล็งผัก-ผลไม้แทน 🥗`;
        face = '😅';
      }

      showBubble(msg, {
        face,
        ttl: 2200
      });
    },

    onMiss(miss) {
      const now = Date.now();
      if (now - lastMissTs < 900) return;
      lastMissTs = now;

      const isGood = miss && miss.isGood;

      if (currentDiff === 'easy') {
        showBubble('ไม่เป็นไร ลองหายใจลึก ๆ แล้วเล็งใหม่อีกทีนะ 😊', {
          face: '🙂',
          ttl: 2000
        });
      } else {
        if (isGood) {
          showBubble('ปล่อยของดีหลุดไปหนึ่ง 😢 รอบหน้าโฟกัสที่หมู่อาหารให้มากขึ้นนะ', {
            face: '😥',
            ttl: 2400
          });
        } else {
          showBubble('พลาดไปนิดเดียวเอง ลองมองให้ชัดก่อนกดยิงอีกครั้งนะ 💪', {
            face: '😌',
            ttl: 2200
          });
        }
      }
    }
  };

  ns.foodGroupsCoach = Coach;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
