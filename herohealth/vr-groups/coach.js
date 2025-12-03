// vr-groups/coach.js
// โค้ชอาหาร 5 หมู่ — มี bubble ล่างจอ + คำพูดต่างกันตามระดับความยาก
(function (ns) {
  'use strict';

  // ---------- สร้าง DOM โค้ช ----------
  let coachWrap, coachText, coachBadge;

  function ensureDom() {
    if (coachWrap) return;

    coachWrap = document.createElement('div');
    coachWrap.id = 'fg-coach';
    coachWrap.style.position = 'fixed';
    coachWrap.style.left = '50%';
    coachWrap.style.bottom = '68px';
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

    // avatar โค้ช
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
    coachBadge.textContent = 'โค้ชโภชนาการ';
    coachBadge.style.fontSize = '11px';
    coachBadge.style.opacity = '0.85';

    coachText = document.createElement('div');
    coachText.textContent = 'พร้อมยัง? มายิงอาหารดี ๆ กัน! 💚';
    coachText.style.fontSize = '13px';

    textBox.appendChild(coachBadge);
    textBox.appendChild(coachText);

    inner.appendChild(avatar);
    inner.appendChild(textBox);
    coachWrap.appendChild(inner);
    document.body.appendChild(coachWrap);

    coachWrap._inner = inner;
  }

  // ---------- state ----------
  let currentDiff   = 'normal';
  let lastSpeakAt   = 0;
  const MIN_INTERVAL_MS = 1200;   // เว้นระยะไม่ให้พูดถี่เกินไป
  let hideTimer     = null;

  function diffLabel(diff) {
    if (diff === 'easy')   return 'โหมดง่าย';
    if (diff === 'hard')   return 'โหมดท้าทาย';
    return 'โหมดปกติ';
  }

  function speak(text, opts = {}) {
    ensureDom();
    const now = Date.now();
    const force = !!opts.force;

    if (!force && now - lastSpeakAt < MIN_INTERVAL_MS) return;
    lastSpeakAt = now;

    coachText.textContent = text || '';

    if (opts.badge) {
      coachBadge.textContent = opts.badge;
    } else {
      coachBadge.textContent = 'โค้ชโภชนาการ';
    }

    const inner = coachWrap._inner;
    inner.style.opacity = '1';
    inner.style.transform = 'translateY(0)';

    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    const timeout = opts.sticky ? 4500 : 2600;
    hideTimer = setTimeout(() => {
      inner.style.opacity = '0';
      inner.style.transform = 'translateY(10px)';
    }, timeout);
  }

  // ---------- ตารางคำพูดตามความยาก ----------
  const MSG = {
    start: {
      easy: [
        'โหมดง่ายเริ่มแล้ว ลองเล็งให้ตรงเป้า ช้า ๆ แต่แม่น ๆ นะ 💚',
        'เริ่มซ้อมก่อนสบาย ๆ เลือกอาหารดีให้ได้เยอะที่สุดเลย! 🥦'
      ],
      normal: [
        'โหมดปกติ มาเช็คว่าจำหมู่ 1–5 ได้แค่ไหนกัน! 💪',
        'พร้อมมั้ย? เล็งดี ๆ แล้วลุยเก็บคอมโบไปเลย 🎯'
      ],
      hard: [
        'โหมดท้าทาย! ยิงให้เร็วและแม่น ระวังอย่าพลาดบ่อยนะ 🔥',
        'ระดับยากแล้วนะ ลองโฟกัสหมู่ที่โค้ชสั่งให้เป๊ะ ๆ เลย 💥'
      ]
    },
    hitGood: {
      easy: [
        'ดีมาก! เก็บอาหารดีได้อีกหนึ่งแล้ว 💚',
        'เยี่ยมเลย ยิงโดนเป้าพอดี! 🎯'
      ],
      normal: [
        'สวยครับ! คอมโบเริ่มมาแล้วนะ 💪',
        'เป๊ะมาก! รักษาจังหวะไว้แบบนี้แหละ 🥦'
      ],
      hard: [
        'แจ่มเลย! แบบนี้แหละโหมดท้าทาย 🔥',
        'เป้าตรงเป๊ะ เก็บคะแนนต่อเนื่องไปเลย! 💥'
      ]
    },
    hitQuest: {
      easy: [
        'ภารกิจโดนอีกหนึ่ง! ใกล้ครบแล้วนะ 😊',
        'สุดยอด! ยิงตามที่โค้ชสั่งได้ตรงเป้าเลย 💚'
      ],
      normal: [
        'ภารกิจคืบหน้าอีกก้าวนึงแล้วดีมาก! 📊',
        'ยิงโดนตาม mission เป๊ะ ๆ เลย เก็บต่อไป! 🎯'
      ],
      hard: [
        'ภารกิจระดับยากยังทำได้ สมกับเป็นสายโหด! 🔥',
        'โดนเป้าภารกิจอีกอัน เก็บให้ครบให้ได้เลย! 💥'
      ]
    },
    miss: {
      easy: [
        'พลาดนิดเดียว ไม่เป็นไร ลองเล็งใหม่นะ 😊',
        'เกือบแล้ว! ขยับเล็งอีกนิดเดียวเอง 💚'
      ],
      normal: [
        'พลาดไปหน่อย ลองจับจังหวะใหม่อีกที 💡',
        'ไม่เป็นไร โฟกัสใหม่แล้วยิงต่อเลย 💪'
      ],
      hard: [
        'โหมดท้าทาย พลาดนิดเดียวก็มีผลนะ โฟกัสใหม่! 🔥',
        'พลาดไป แต่ยังกลับมาได้ เก็บคอมโบกลับมาเลย 💥'
      ]
    },
    questNew: {
      easy: 'ภารกิจใหม่! เล็งหมู่ %s ให้ครบตามที่โค้ชบอกนะ 💚',
      normal: 'Mission ใหม่: เน้นหมู่ %s ให้ครบตามจำนวนที่กำหนด 📌',
      hard: 'ภารกิจโหมดโหด: ยิงหมู่ %s ให้ครบตามเป้าหมายให้ได้! 🔥'
    },
    questProgress: {
      easy: 'หมู่ %s ทำได้ %d จาก %d แล้ว เก่งมาก! 💚',
      normal: 'หมู่ %s คืบหน้า %d / %d เป้าแล้ว สู้ต่อ! 💪',
      hard: 'หมู่ %s ตอนนี้ %d / %d แล้ว อย่าปล่อยให้หลุดมือ! 🔥'
    },
    questDone: {
      easy: 'เย้! ภารกิจหมู่ %s สำเร็จเรียบร้อยแล้ว 🎉',
      normal: 'Mission หมู่ %s จบสวยงาม ไปภารกิจถัดไปกัน! 🚀',
      hard: 'ภารกิจหมู่ %s ผ่านแบบสายโหด! พร้อมลุยด่านต่อไป 💥'
    },
    finish: {
      veryGood: {
        easy: [
          'ทำได้ดีมากเลย คะแนนสวย ภารกิจผ่านไปหลายอันสุด ๆ 💚',
          'สุดยอด! เลือกอาหารดีได้เยอะมาก ภาพรวมคือดีงามเลย 🎉'
        ],
        normal: [
          'ทำได้ดี คะแนนและภารกิจถือว่าใช้ได้เลย 👍',
          'จบเกมสวย! เอาไปใช้เทียบก่อน–หลังการสอนได้เลย 💪'
        ],
        hard: [
          'โหมดท้าทายแล้วยังทำได้ดีมาก สมกับเป็นโปร! 🔥',
          'คะแนนสวย ภารกิจผ่านหลายอันในโหมดยาก ดีมาก! 💥'
        ]
      },
      ok: {
        easy: [
          'พื้นฐานดีแล้ว ลองเล่นอีกสักรอบ คะแนนน่าจะดีกว่านี้ 💚',
          'โอเคเลย รอบหน้าโฟกัสให้ตรงเป้าขึ้นอีกหน่อยนะ 😊'
        ],
        normal: [
          'ถือว่าใช้ได้ มีพื้นที่ให้พัฒนาอีก ลองรอบใหม่ได้เลย 💡',
          'คะแนนกลาง ๆ รอบหน้าลองเล็งเร็วขึ้นอีกนิดนะ 💪'
        ],
        hard: [
          'โหมดยากไม่ธรรมดา ลองอีกสักรอบ รับรองคะแนนดีขึ้น 🔥',
          'รอดมาได้ในโหมดท้าทาย ถือว่าเก่งแล้ว ลองปรับจังหวะรอบต่อไป 💥'
        ]
      },
      needPractice: {
        easy: [
          'ไม่เป็นไร รอบนี้ถือเป็นการซ้อม ลองเล่นใหม่อีกครั้งนะ 💚',
          'ยังจับจังหวะได้ไม่มาก ลองโหมดง่ายอีกรอบก่อนก็ได้ 😊'
        ],
        normal: [
          'ดูเหมือนจะพลาดเยอะไปหน่อย ลองโฟกัสที่หมู่ที่โค้ชสั่งก่อน 💡',
          'คะแนนยังไม่สูง ลองค่อย ๆ เล็งทีละเป้า รอบหน้าต้องดีกว่านี้แน่ 💪'
        ],
        hard: [
          'โหมดท้าทายจริง ๆ รอบนี้หนัก ลองสลับไปโหมดปกติซ้อมก่อนก็ได้นะ 🔥',
          'ภารกิจยังไม่ผ่านเยอะ ลองคุมจังหวะให้แม่นกว่านี้ในรอบหน้า 💥'
        ]
      }
    }
  };

  function randFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ---------- public API ----------
  const Coach = {
    setDifficulty(diff) {
      currentDiff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';
    },

    sayStart() {
      const lines = MSG.start[currentDiff] || MSG.start.normal;
      speak(randFrom(lines), { badge: diffLabel(currentDiff), force: true });
    },

    onQuestChange(payload) {
      if (!payload) return;
      const { current, progress, justFinished, status } = payload || {};
      const total   = status && typeof status.total === 'number' ? status.total : null;
      const currentIndex = status && typeof status.currentIndex === 'number'
        ? status.currentIndex
        : null;

      // ภารกิจที่เพิ่งจบ
      if (justFinished && current) {
        const groupLabel = current.label || ('หมู่ ' + (current.groupId || '?'));
        const tpl = MSG.questDone[currentDiff] || MSG.questDone.normal;
        const line = tpl.replace('%s', groupLabel);
        speak(line, { badge: 'ภารกิจสำเร็จ 🎉' });
        return;
      }

      // mission ใหม่
      if (current && progress === 0 && currentIndex === 0) {
        const groupLabel = current.label || ('หมู่ ' + (current.groupId || '?'));
        const tpl = MSG.questNew[currentDiff] || MSG.questNew.normal;
        const line = tpl.replace('%s', groupLabel);
        speak(line, { badge: 'ภารกิจใหม่ 📌', sticky: true });
        return;
      }

      // อัปเดต progress ทั่วไป
      if (current && typeof progress === 'number' && status && typeof status.target === 'number') {
        const groupLabel = current.label || ('หมู่ ' + (current.groupId || '?'));
        const tpl = MSG.questProgress[currentDiff] || MSG.questProgress.normal;
        const line = tpl.replace('%s', groupLabel).replace('%d', progress).replace('%d', status.target);
        speak(line, { badge: 'ความคืบหน้าภารกิจ 📊' });
      }
    },

    onHit(info) {
      if (!info) return;
      const { isQuestTarget } = info;

      // ถ้าโดนเป้าภารกิจ
      if (isQuestTarget) {
        const lines = MSG.hitQuest[currentDiff] || MSG.hitQuest.normal;
        speak(randFrom(lines), { badge: 'โดนเป้าภารกิจ 🎯' });
        return;
      }

      // ยิงโดนทั่วไป
      const lines = MSG.hitGood[currentDiff] || MSG.hitGood.normal;
      speak(randFrom(lines), { badge: 'ยิงโดนเป้า ✅' });
    },

    onMiss(info) {
      const lines = MSG.miss[currentDiff] || MSG.miss.normal;
      speak(randFrom(lines), { badge: 'พลาดนิดหน่อย 😅' });
    },

    sayFinish(summary) {
      summary = summary || {};
      const score         = summary.score || 0;
      const diff          = summary.diff || currentDiff;
      const questsCleared = summary.questsCleared || 0;
      const questsTotal   = summary.questsTotal || 0;

      currentDiff = (diff === 'easy' || diff === 'hard') ? diff : 'normal';

      let levelKey = 'ok';

      // ใช้สัดส่วนภารกิจเป็นเกณฑ์คร่าว ๆ
      let questRatio = 0;
      if (questsTotal > 0) {
        questRatio = questsCleared / questsTotal;
      }

      if (questRatio >= 0.7 || score >= 800) {
        levelKey = 'veryGood';
      } else if (questRatio <= 0.3 && score < 400) {
        levelKey = 'needPractice';
      }

      const bundle = MSG.finish[levelKey] || MSG.finish.ok;
      const lines  = bundle[currentDiff] || bundle.normal;
      const text   = randFrom(lines);

      speak(text, { badge: 'สรุปหลังเล่น 🧾', sticky: true, force: true });
    }
  };

  ns.foodGroupsCoach = Coach;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));