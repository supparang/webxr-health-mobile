/* =========================================================
 * /english/js/lesson-level-url-lock.js
 * PATCH v20260508-LEVEL-URL-LOCK
 *
 * ✅ บังคับ level/diff ตาม URL
 * ✅ กัน AI adaptive random เปลี่ยน normal -> challenge เอง
 * ✅ sync display/UI globals
 * ✅ ใช้ร่วมกับ lesson-level-balance + hard-apply
 * ========================================================= */

(function () {
  'use strict';

  const PATCH_ID = 'lesson-level-url-lock-v20260508';

  function qs(k, d = '') {
    try {
      return new URL(location.href).searchParams.get(k) || d;
    } catch (e) {
      return d;
    }
  }

  function normLevel(v) {
    v = String(v || '').toLowerCase().trim();

    if (v === 'easy') return 'easy';
    if (v === 'normal') return 'normal';
    if (v === 'hard') return 'hard';
    if (v === 'challenge') return 'challenge';

    return 'normal';
  }

  function getLockedLevel() {
    return normLevel(qs('level') || qs('diff') || 'normal');
  }

  function lockGlobals() {
    const level = getLockedLevel();

    window.LESSON_LEVEL = level;
    window.LESSON_DIFF = level;
    window.currentLevel = level;
    window.currentDiff = level;
    window.aiLevel = level;
    window.aiDifficulty = level;
    window.selectedDifficulty = level;

    if (window.LESSON_STATE && typeof window.LESSON_STATE === 'object') {
      window.LESSON_STATE.level = level;
      window.LESSON_STATE.diff = level;
      window.LESSON_STATE.aiLevel = level;
      window.LESSON_STATE.aiDifficulty = level;
    }

    if (window.TechPathState && typeof window.TechPathState === 'object') {
      window.TechPathState.level = level;
      window.TechPathState.diff = level;
      window.TechPathState.aiLevel = level;
    }

    return level;
  }

  function patchTextDisplay() {
    const level = getLockedLevel();

    Array.from(document.querySelectorAll('*')).forEach(function (el) {
      if (!el || !el.childNodes || el.childNodes.length !== 1) return;

      const text = String(el.textContent || '').trim();

      if (/^(easy|normal|hard|challenge)$/i.test(text)) {
        // เปลี่ยนเฉพาะ badge/label สั้น ๆ ไม่ไปแตะเนื้อหาโจทย์
        const near = el.closest('section, article, div, li');
        const nearText = near ? String(near.textContent || '') : '';

        if (/AI Level|AI Difficulty|Difficulty|LEVEL|AI:/i.test(nearText)) {
          el.textContent = level;
        }
      }

      if (/AI:\s*(easy|normal|hard|challenge)/i.test(text)) {
        el.textContent = text.replace(/AI:\s*(easy|normal|hard|challenge)/i, 'AI: ' + level);
      }
    });
  }

  function patchRandomDifficultyFunctions() {
    const blockedNames = [
      'pickAIDifficulty',
      'getAIDifficulty',
      'chooseAIDifficulty',
      'randomAIDifficulty',
      'selectAdaptiveDifficulty',
      'getAdaptiveDifficulty'
    ];

    blockedNames.forEach(function (name) {
      if (typeof window[name] === 'function' && !window[name].__levelUrlLocked) {
        const locked = function () {
          return getLockedLevel();
        };

        locked.__levelUrlLocked = true;
        window[name] = locked;
      }
    });
  }

  function patchLevelBalanceCurrent() {
    if (!window.LessonLevelBalance || window.LessonLevelBalance.__urlLocked) return;

    const oldGetCurrent = window.LessonLevelBalance.getCurrent;

    if (typeof oldGetCurrent === 'function') {
      window.LessonLevelBalance.getCurrent = function () {
        const item = oldGetCurrent.apply(this, arguments);

        if (item && typeof item === 'object') {
          item.level = getLockedLevel();
          item.diff = getLockedLevel();
        }

        return item;
      };
    }

    window.LessonLevelBalance.__urlLocked = true;
  }

  function expose() {
    window.LessonLevelUrlLock = {
      version: PATCH_ID,
      getLevel: getLockedLevel,
      apply: function () {
        const level = lockGlobals();
        patchRandomDifficultyFunctions();
        patchLevelBalanceCurrent();
        patchTextDisplay();
        return level;
      },
      debug: function () {
        return {
          patch: PATCH_ID,
          urlLevel: qs('level'),
          urlDiff: qs('diff'),
          lockedLevel: getLockedLevel(),
          globals: {
            LESSON_LEVEL: window.LESSON_LEVEL,
            LESSON_DIFF: window.LESSON_DIFF,
            currentLevel: window.currentLevel,
            currentDiff: window.currentDiff,
            aiLevel: window.aiLevel,
            aiDifficulty: window.aiDifficulty
          }
        };
      }
    };
  }

  function init() {
    expose();
    window.LessonLevelUrlLock.apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  let tries = 0;
  const timer = setInterval(function () {
    tries += 1;
    window.LessonLevelUrlLock.apply();

    if (tries >= 30) clearInterval(timer);
  }, 400);
})();
