// vr-groups/coach.js
// โค้ชโภชนาการสำหรับเกม Food Groups VR
// - พูดตามระดับความยาก (easy / normal / hard)
// - แสดงภารกิจ + progress
// - ลอยอยู่ด้านล่างจอ (ไม่ทับ hint / ปุ่ม VR)

(function (ns) {
  'use strict';

  let coachWrap   = null;
  let coachText   = null;
  let coachBadge  = null;
  let hideTimer   = null;
  let currentDiff = 'normal';

  // ---------- DOM สร้าง bubble โค้ช ----------
  function ensureDom() {
    if (coachWrap) return;

    coachWrap = document.createElement('div');
    coachWrap.id = 'fg-coach';
    coachWrap.style.position = 'fixed';
    coachWrap.style.left = '50%';

    // ยกโค้ชให้สูงขึ้น ไม่ชน hint / ปุ่ม VR ด้านล่าง
    const isMobile = window.innerWidth <= 768;
    coachWrap.style.bottom = isMobile ? '150px' : '110px';

    coachWrap.style.transform = 'translateX(-50%)';
    coachWrap.style.zIndex = '12000';
    coachWrap.style.pointerEvents = 'none';
    coachWrap.style.maxWidth = '520px';
    coachWrap.style.padding = '0 12px';
    coachWrap.style.boxSizing = 'border-box';

    const inner = document.createElement('div');
    inner.style.display = 'flex';
    inner.style.alignItems = 'center';
    inner.style.gap = '10px';
    inner.style.padding = '8px 14px';
    inner.style.borderRadius = '999px';
    inner.style.background = 'rgba(15,23,42,0.90)';
    inner.style.boxShadow = '0 12px 32px rgba(15,23,42,0.85)';
    inner.style.color = '#e5e7eb';
    inner.style.fontFamily = "'IBM Plex Sans Thai', system-ui, -apple-system, sans-serif";
    inner.style.fontSize = '13px';
    inner.style.lineHeight = '1.35';
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(10px)';
    inner.style.transition = 'opacity .18s ease, transform .18s ease';
    inner.style.pointerEvents = 'auto';

    const avatar = document.createElement('div');
    avatar.textContent = '🧑‍🍳';
    avatar.style.width = '32px';
    avatar.style.height = '32px';
    avatar.style.flex = '0 0 32px';
    avatar.style.display = 'flex';
    avatar.style.alignItems = 'center';
    avatar.style.justifyContent = 'center';
    avatar.style.borderRadius = '999px';
    avatar.style.background = 'radial-gradient(circle at 30% 20%, #f97316, #b91c1c)';
    avatar.style.fontSize = '20px';

    const textBox = document.createElement('div');
    textBox.style.display = 'flex';
    textBox.style.flexDirection = 'column';
    textBox.style.gap = '2px';

    coachBadge = document.createElement('div');
    coachBadge.style.fontSize = '11px';
    coachBadge.style.opacity = '0.85';

    coachText = document.createElement('div');
    coachText.style.fontSize = '13px';

    textBox.appendChild(coachBadge);
    textBox.appendChild(coachText);
    inner.appendChild(avatar);
    inner.appendChild(textBox);
    coachWrap.appendChild(inner);
    document.body.appendChild(coachWrap);

    coachWrap._inner = inner;

    // ปรับตำแหน่งใหม่เวลาหมุนจอ / resize
    window.addEventListener('resize', () => {
      const mobile = window.innerWidth <= 768;
      coachWrap.style.bottom = mobile ? '150px' : '110px';
    });

    updateBadge();
  }

  // ---------- helper: ปรับ badge ตามระดับความยาก ----------
  function updateBadge() {
    if (!coachBadge) return;
    let label = 'โค้ชโภชนาการ';

    switch ((currentDiff || 'normal').toLowerCase()) {
      case 'easy':
        label = 'โค้ชโภชนาการ (โหมดชิล ๆ)';
        break;
      case 'hard':
        label = 'โค้ชโภชนาการ (โหมดยาก ⚡)';
        break;
      default:
        label = 'โค้ชโภชนาการ';
    }
    coachBadge.textContent = label;
  }

  // ---------- public: setDifficulty ----------
  function setDifficulty(diff) {
    currentDiff = diff || 'normal';
    if (!coachWrap) return; // ไว้ถูกอัปเดตตอน ensureDom
    updateBadge();
  }

  // ---------- helper: แสดงข้อความ ----------
  function show(text, opts = {}) {
    ensureDom();
    if (!coachWrap || !coachText || !coachWrap._inner) return;

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    coachText.textContent = text;
    updateBadge();

    // fade in
    const inner = coachWrap._inner;
    inner.style.opacity = '1';
    inner.style.transform = 'translateY(0)';

    const duration = opts.duration || 3500;
    if (duration > 0) {
      hideTimer = setTimeout(hide, duration);
    }
  }

  function hide() {
    if (!coachWrap || !coachWrap._inner) return;
    const inner = coachWrap._inner;
    inner.style.opacity = '0';
    inner.style.transform = 'translateY(10px)';
  }

  // ---------- public: เริ่มเกม ----------
  function sayStart() {
    let msg = 'พร้อมยัง? มายิงอาหารดี ๆ กัน! 💚';

    switch ((currentDiff || 'normal').toLowerCase()) {
      case 'easy':
        msg = 'เริ่มโหมดชิล ๆ กันก่อนนะ เก็บอาหารดีให้ครบทุกหมู่แบบสบาย ๆ 💚';
        break;
      case 'hard':
        msg = 'โหมดยากแล้วนะ! เล็งให้ไว ยิงให้แม่น เก็บอาหารดีให้ครบทุกหมู่เลย ⚡';
        break;
      default:
        msg = 'เริ่มกันเลย! เล็งอาหารดี ๆ ให้ตรงวงแหวนแล้วยิงให้ไว 💚';
    }

    show(msg, { duration: 4200 });
  }

  // ---------- public: ตอนเปลี่ยนภารกิจ / progress ----------
  function onQuestChange(payload) {
    ensureDom();
    if (!payload) return;

    const { current, progress, justFinished, finished, status } = payload;

    // ถ้าเพิ่งเคลียร์ภารกิจหนึ่งเสร็จ
    if (justFinished && finished) {
      const title =
        finished.title || finished.label || finished.name || 'ภารกิจอาหารดีสำเร็จแล้ว';
      const emoji = finished.emoji || finished.icon || '✨';

      let done = null;
      let total = null;

      if (typeof progress === 'object' && progress) {
        if (typeof progress.done === 'number') done = progress.done;
        if (typeof progress.total === 'number') total = progress.total;
      }

      let msg = `${emoji} เยี่ยมมาก! ${title} สำเร็จแล้ว!`;

      if (done != null && total != null) {
        msg += ` (ทำได้ ${done}/${total})`;
      }

      show(msg, { duration: 4500 });
      return;
    }

    // ถ้าไม่มีภารกิจเลย
    if (!current) {
      const total = status && typeof status.total === 'number' ? status.total : null;
      if (total === 0) {
        show('ตอนนี้ยังไม่มีภารกิจใหม่ ลองยิงอาหารดี ๆ เก็บคะแนนไปก่อนนะ 💚', {
          duration: 3600
        });
      } else {
        hide();
      }
      return;
    }

    // มีภารกิจปัจจุบัน → สร้างข้อความ
    const emoji = current.emoji || current.icon || '🥦';
    const title =
      current.title ||
      current.label ||
      current.name ||
      'ภารกิจสะสมอาหารดีแต่ละหมู่';
    const need =
      current.targetCount ||
      current.goalCount ||
      current.count ||
      current.need ||
      null;

    let done = null;
    let total = null;

    if (typeof progress === 'object' && progress) {
      if (typeof progress.done === 'number') done = progress.done;
      if (typeof progress.total === 'number') total = progress.total;
    }

    if (done == null && need != null) {
      done = Math.min(current.hitCount || 0, need);
      total = need;
    }

    let body = `${emoji} ภารกิจ: ${title}`;
    if (done != null && total != null && total > 0) {
      body += ` — ตอนนี้ได้ ${done}/${total} แล้ว สู้ต่ออีกนิดนะ! ✨`;
    } else {
      body += ' — เล็งอาหารให้ตรงหมู่ แล้วเก็บให้ได้หลาย ๆ ครั้ง! ✨';
    }

    show(body, { duration: 4200 });
  }

  // ---------- public: พูดทั่วไป (fallback เก่า) ----------
  function sayQuest(quest, progress) {
    // ใช้โครงสร้างเดียวกับ onQuestChange แบบง่าย ๆ
    onQuestChange({ current: quest, progress, justFinished: false, finished: null });
  }

  // ---------- public: จบเกม ----------
  function sayFinish(summary) {
    let msg = 'จบเกมแล้ว! มาดูกันว่ารอบนี้เก็บอาหารดีได้เยอะแค่ไหน ✨';

    if (summary && typeof summary.questsCleared === 'number') {
      if (summary.questsCleared > 0) {
        msg = `สุดยอด! คุณทำภารกิจสำเร็จไป ${summary.questsCleared} ภารกิจเลย 🎉`;
      } else {
        msg = 'รอบนี้ยังไม่จบภารกิจ ลองเล่นอีกครั้งให้ได้ครบทุกหมู่ดูนะ 💪';
      }
    }

    show(msg, { duration: 5000 });
  }

  // ---------- export ----------
  ns.foodGroupsCoach = {
    setDifficulty,
    sayStart,
    sayQuest,
    onQuestChange,
    sayFinish
  };
})(window.GAME_MODULES || (window.GAME_MODULES = {}));