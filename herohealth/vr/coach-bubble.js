// === /HeroHealth/ui/coach-bubble.js ===
// Bubble โค้ช (ฟัง event hha:coach / hha:score / quest:update / hha:quest / hha:end)
(function (global) {
  'use strict';
  const exports = global.GAME_MODULES = global.GAME_MODULES || {};

  let bubble = null;
  let hideTimer = null;

  let lastQuestKey = '';
  let lastScoreMilestone = 0;
  let lastComboShown = 0;
  let lastMsgAt = 0;

  function el(tag, cls) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    return x;
  }

  function ensureUI() {
    if (bubble) return bubble;
    let css = document.getElementById('coach-style');
    if (!css) {
      css = el('style');
      css.id = 'coach-style';
      css.textContent =
        '#coachBubble{position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:950;' +
        'max-width:min(84vw,720px);background:#0b1222cc;border:1px solid #3b4a66;color:#e8eefc;' +
        'padding:10px 14px;border-radius:12px;box-shadow:0 12px 30px #0008;font:700 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif;' +
        'backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .18s ease;}';
      document.head.appendChild(css);
    }
    bubble = document.getElementById('coachBubble');
    if (!bubble) {
      bubble = el('div');
      bubble.id = 'coachBubble';
      bubble.setAttribute('data-hha-ui', '');
      document.body.appendChild(bubble);
    }
    return bubble;
  }

  function show(text, ms) {
    const b = ensureUI();
    b.textContent = String(text || '');
    b.style.opacity = '1';
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (b) b.style.opacity = '0';
    }, Math.max(800, ms || 1500));
    lastMsgAt = Date.now();
  }

  function maybeShow(text, ms, gapMs) {
    const now = Date.now();
    const gap = gapMs || 1100;
    if (now - lastMsgAt < gap) return;
    show(text, ms);
  }

  // ให้เกมอื่นเรียกตรง ๆ ได้ด้วย
  exports.coachSay = function (txt, ms) {
    try { show(txt, ms || 1800); } catch (e) { }
  };

  // ===== Event Handlers =====

  // 1) รับข้อความตรงจากโหมด (goodjunk.safe / groups.safe / hydration.safe / plate.safe)
  function onCoach(e) {
    const d = e && e.detail ? e.detail : {};
    const txt = d.text || '';
    if (!txt) return;
    show(txt, 2200);
  }

  // 2) คะแนน + คอมโบ + พลาด
  function onScore(e) {
    const d = e && e.detail ? e.detail : {};
    const combo = Number(d.combo || d.comboMax || 0);
    const delta = Number(d.delta || 0);
    const total = Number(d.total || d.score || 0);
    const goodHit = d.good !== false; // ถ้า engine ส่งมา

    // พลาด/โดนลบคะแนน
    if (delta < 0 || !goodHit) {
      maybeShow('ไม่เป็นไร พลาดได้ ลองชะลอนิดนึงแล้วดูให้ชัดก่อนแตะ 😊', 1500, 1600);
      return;
    }

    // เปิดคอมโบครั้งแรก
    if (combo === 1 && lastComboShown < 1) {
      lastComboShown = 1;
      maybeShow('เปิดคอมโบแล้ว! เก็บต่อเนื่องให้ได้! 💫', 1500, 1200);
    }

    // Milestone คอมโบ
    if (combo === 5 && lastComboShown < 5) {
      lastComboShown = 5;
      maybeShow('คอมโบ x5 แล้ว เยี่ยมมาก! ลองไปให้ถึง x10 ดูนะ 🔥', 1700, 1400);
    } else if (combo === 10 && lastComboShown < 10) {
      lastComboShown = 10;
      maybeShow('คอมโบ x10 สุดยอด! รักษาจังหวะให้ดีเลย! ⚡', 1800, 1600);
    } else if (combo === 15 && lastComboShown < 15) {
      lastComboShown = 15;
      maybeShow('คอมโบยาวมาก! มือโปรแล้วแบบนี้ ✨', 1800, 1800);
    } else if (combo === 20 && lastComboShown < 20) {
      lastComboShown = 20;
      maybeShow('คอมโบ x20 โหดมาก! ลองเก็บให้สุดเวลาเลย! 💥', 2000, 2000);
    }

    // Milestone คะแนนรวม
    if (total >= 500 && lastScoreMilestone < 500) {
      lastScoreMilestone = 500;
      maybeShow('คะแนนเกิน 500 แล้ว ดีมาก! ลองลุยให้ถึง 1,000 ดูนะ 🔥', 1800, 1600);
    } else if (total >= 1000 && lastScoreMilestone < 1000) {
      lastScoreMilestone = 1000;
      maybeShow('คะแนนเกิน 1,000 แล้ว ใกล้เป้าใหญ่เข้าไปทุกที 💪', 1900, 1800);
    } else if (total >= 1500 && lastScoreMilestone < 1500) {
      lastScoreMilestone = 1500;
      maybeShow('คะแนน 1,500+ แล้ว ลองเช็คเควสต์ว่าเหลืออะไรอีกบ้าง ✨', 2000, 2000);
    } else if (total >= 2000 && lastScoreMilestone < 2000) {
      lastScoreMilestone = 2000;
      maybeShow('คะแนนพุ่งทะลุ 2,000! สุดยอดมาก รักษาฟอร์มต่อไป! 🚀', 2100, 2200);
    }
  }

  // fallback ถ้ามี engine ไหนยิง hha:miss แยก
  function onMiss() {
    maybeShow('ไม่เป็นไร! โฟกัสใหม่อีกครั้ง! 💪', 1300, 1400);
  }

  // ถ้ามีระบบ FEVER ยิง event แยก (เช่น จาก ui-fever.js)
  function onFever(e) {
    const st = e && e.detail && e.detail.state ? e.detail.state : 'change';
    if (st === 'start') {
      maybeShow('FEVER มาแล้ว! เก็บแต้มคูณให้สุด! ⚡', 1900, 1400);
    } else if (st === 'end') {
      maybeShow('โหมดพิเศษจบแล้ว ลองตั้งคอมโบใหม่แล้วลุยต่อ! 🔁', 1700, 1400);
    }
  }

  // 3) เควสต์: รองรับทั้ง quest-director (hha:quest) และ MissionDeck (quest:update)
  function handleQuestPayload(d) {
    const goal = d.goal || null;
    const mini = d.mini || null;
    const hint = d.hint || '';

    const key = [
      goal && goal.id,
      mini && mini.id,
      hint || ''
    ].join('|');

    if (key && key === lastQuestKey) return;
    lastQuestKey = key;

    let msg = '';
    if (hint) {
      msg = hint;
    } else if (goal && !goal.done) {
      msg = 'Goal: ' + (goal.label || 'ภารกิจหลักใหม่!');
    } else if (mini && !mini.done) {
      msg = 'Mini quest: ' + (mini.label || 'ภารกิจย่อยใหม่!');
    }

    if (msg) {
      maybeShow(msg, 2000, 1600);
    }
  }

  function onQuest(e) {
    const d = e && e.detail ? e.detail : {};
    // ถ้ามี field text (จากระบบเก่า) ใช้ตรง ๆ
    if (d.text) {
      maybeShow(d.text, 2000, 1600);
      return;
    }
    handleQuestPayload(d);
  }

  function onQuestUpdate(e) {
    const d = e && e.detail ? e.detail : {};
    handleQuestPayload(d);
  }

  // 4) สรุปตอนจบเกม
  function onEnd(e) {
    const d = e && e.detail ? e.detail : {};
    const mode  = d.mode || '';
    const score = Number(d.score || 0);

    const goalsCleared  = Number(d.goalsCleared || 0);
    const goalsTotal    = Number(d.goalsTotal || 0);
    const questsCleared = Number(d.questsCleared || 0);
    const questsTotal   = Number(d.questsTotal || 0);

    let msg = '';
    if ((goalsTotal || questsTotal)) {
      msg =
        'จบโหมด ' + (mode || 'เกม') +
        ' • Goal ' + goalsCleared + '/' + (goalsTotal || '-') +
        ' • Mini ' + questsCleared + '/' + (questsTotal || '-') +
        ' • คะแนน ' + score;
    } else {
      msg = 'จบเกมแล้ว! คะแนนรวม ' + score;
    }

    show(msg, 2600);

    // reset state สำหรับรอบถัดไป
    lastQuestKey = '';
    lastScoreMilestone = 0;
    lastComboShown = 0;
  }

  // ===== Hook Events =====
  window.addEventListener('hha:coach', onCoach);
  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:miss', onMiss);
  window.addEventListener('hha:fever', onFever);
  window.addEventListener('hha:quest', onQuest);
  window.addEventListener('quest:update', onQuestUpdate);
  window.addEventListener('hha:end', onEnd);

  // ข้อความเริ่มต้นเบา ๆ
  setTimeout(() => {
    maybeShow('เตรียมตัว... เล็งเป้าแล้วแตะให้แม่น! 🎯', 1900, 0);
  }, 900);

})(window);