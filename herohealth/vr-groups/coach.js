// === /herohealth/vr-groups/coach.js ===
// โค้ชสำหรับ Food Groups VR (ใช้ emoji เป็นการ์ตูนโค้ชเล็ก ๆ ใน bubble)
// ผูกกับ GameEngine ผ่าน ns.foodGroupsCoach
//  - setDifficulty(diff)
//  - sayStart(info)
//  - onQuestChange({ current, progress, justFinished, finished, status })
//  - onHit({ groupId, emoji, isGood, isQuestTarget, scoreDelta, rtMs, judgment })
//  - onMiss({ groupId, emoji, isGood, rtMs })
//  - sayFinish(summary)

(function (ns) {
  'use strict';

  const EMOJI = {
    neutral:      '🥦',
    goodHit:      '🍎',
    questTarget:  '🎯',
    badHit:       '🍩',
    miss:         '😅',
    startEasy:    '🙂',
    startNormal:  '💪',
    startHard:    '🔥',
    finishGood:   '🎉',
    finishSoSo:   '👍',
    finishBad:    '🧠'
  };

  let currentDiff = 'normal';
  let lastMsgTime = 0;
  const MIN_INTERVAL_MS = 1200;

  function now() { return Date.now(); }

  function canSpeak() {
    const t = now();
    if (t - lastMsgTime < MIN_INTERVAL_MS) return false;
    lastMsgTime = t;
    return true;
  }

  function setCoachBubble(text) {
    const bubble = document.getElementById('coach-bubble');
    const label  = bubble ? bubble.querySelector('.coach-label') : null;
    const span   = document.getElementById('coach-text');
    if (!bubble || !span) return;

    // ให้ label ยังคงเป็นคำว่า "โค้ช" ส่วน emoji ไปอยู่ในข้อความ
    span.textContent = text;
    bubble.classList.add('show');

    if (setCoachBubble._timer) clearTimeout(setCoachBubble._timer);
    setCoachBubble._timer = setTimeout(function () {
      bubble.classList.remove('show');
    }, 4200);
  }

  function diffEmoji(diff) {
    switch ((diff || '').toLowerCase()) {
      case 'easy':   return EMOJI.startEasy;
      case 'hard':   return EMOJI.startHard;
      case 'normal':
      default:       return EMOJI.startNormal;
    }
  }

  const Coach = {
    setDifficulty(diff) {
      currentDiff = (diff || 'normal').toLowerCase();
      if (!canSpeak()) return;
      const e = diffEmoji(currentDiff);
      if (currentDiff === 'easy') {
        setCoachBubble(`${e} โค้ชจัดให้แบบสบาย ๆ เริ่มจากภารกิจง่ายก่อนนะ`);
      } else if (currentDiff === 'hard') {
        setCoachBubble(`${e} โหมดท้าทาย! เลือกกลุ่มอาหารดีให้เป๊ะ ๆ เลย 💥`);
      } else {
        setCoachBubble(`${e} โหมดปกติ เน้นบาลานซ์ 5 หมู่ให้ดีนะ`);
      }
    },

    sayStart(info) {
      // info อาจมี { questsCleared, questsTotal } ถ้าอยากใช้ ก็อ่านจากตรงนี้ได้
      if (!canSpeak()) return;
      const e = diffEmoji(currentDiff);
      setCoachBubble(`${e} เริ่มภารกิจจัดหมู่แล้ว เล็งให้ตรงกลุ่มอาหารที่ดีนะ!`);
    },

    // ถ้าถูกเรียกตรง ๆ จากที่อื่น
    sayQuest(quest, progress) {
      if (!quest) return;
      if (!canSpeak()) return;
      const e = EMOJI.questTarget;
      const prog = progress | 0;
      const tgt  = quest.target | 0;
      setCoachBubble(`${e} ภารกิจ: ${quest.label}  (${prog}/${tgt})`);
    },

    onQuestChange(payload) {
      if (!payload) return;
      const quest  = payload.current || null;
      const prog   = payload.progress | 0;
      const justFinished = !!payload.justFinished;
      const finishedQuest = payload.finished || null;

      if (justFinished && finishedQuest) {
        if (!canSpeak()) return;
        const e = EMOJI.finishGood;
        setCoachBubble(`${e} เยี่ยมเลย! เคลียร์ภารกิจ: ${finishedQuest.label}`);
        return;
      }

      if (!quest) return;
      if (!canSpeak()) return;

      const tgt = quest.target | 0;
      const e   = EMOJI.questTarget;
      setCoachBubble(`${e} เป้าหมายตอนนี้: ${quest.label}  (${prog}/${tgt})`);
    },

    onHit(info) {
      if (!info) return;
      const { isGood, isQuestTarget, emoji, judgment } = info;

      // บางจังหวะไม่ต้องพูดทุกครั้ง เพื่อลดสแปม
      if (!canSpeak()) return;

      if (isGood) {
        if (isQuestTarget) {
          setCoachBubble(`${EMOJI.goodHit} เก่งมาก! เลือกกลุ่มที่โค้ชสั่งถูกเป๊ะเลย ${emoji || ''}`);
        } else {
          if (judgment === 'perfect') {
            setCoachBubble(`${EMOJI.goodHit} ยิงเป๊ะมาก perfect เลย! ${emoji || ''}`);
          } else {
            setCoachBubble(`${EMOJI.goodHit} ดีมาก เลือกกลุ่มอาหารดีได้ถูกต้องแล้ว ${emoji || ''}`);
          }
        }
      } else {
        setCoachBubble(`${EMOJI.badHit} อันนี้เป็นของที่ควรลดนะ ลองเน้นกลุ่มอาหารดี ๆ แทน 🥗`);
      }
    },

    onMiss(info) {
      if (!info) return;
      if (!canSpeak()) return;
      setCoachBubble(`${EMOJI.miss} พลาดนิดนึง ไม่เป็นไร ลองเล็งใหม่ให้ตรงกลุ่มอาหารที่ดีนะ`);
    },

    sayFinish(summary) {
      summary = summary || {};
      const score   = summary.score || 0;
      const qc      = summary.questsCleared || 0;
      const totalQ  = summary.questsTotal != null ? summary.questsTotal : null;

      let e = EMOJI.finishSoSo;
      if (qc >= 2) e = EMOJI.finishGood;
      if (qc === 0 && score === 0) e = EMOJI.finishBad;

      let msg = `${e} จบเกมแล้ว! ได้คะแนนรวม ${score} คะแนน`;
      if (totalQ != null) {
        msg += ` และทำภารกิจสำเร็จ ${qc}/${totalQ} ภารกิจ`;
      }
      msg += ' รอบหน้าลองบาลานซ์กลุ่มอาหารให้ดียิ่งขึ้นนะ 🥗';

      setCoachBubble(msg);
    }
  };

  ns.foodGroupsCoach = Coach;

})(window.GAME_MODULES || (window.GAME_MODULES = {}));