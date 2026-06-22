// === /sgnal-hunt/js/uxq-hub.js ===
// UX Quest Mission Control v2 • compact mobile-first hub
// Reads W1 V6 progress without changing W1 gameplay.

(function () {
  'use strict';

  const W1_PROGRESS_KEY = 'uxquest-w1-progress-v6';
  const W1_SESSION_KEY = 'uxquest-w1-session-v6';
  const LEGACY_W1_KEYS = [
    'uxquest-w1-progress-v5',
    'uxquest-w1-session-v5',
    'uxquest-w1-case-investigation-v4'
  ];

  const $ = (selector) => document.querySelector(selector);

  function safeRead(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function stars(count) {
    const safe = clamp(Number(count) || 0, 0, 3);
    return `${'★'.repeat(safe)}${'☆'.repeat(3 - safe)}`;
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setClass(selector, className, enabled) {
    const element = $(selector);
    if (element) element.classList.toggle(className, enabled);
  }

  function readW1() {
    const progress = safeRead(W1_PROGRESS_KEY, {});
    const session = safeRead(W1_SESSION_KEY, null);

    const hasActiveSession = Boolean(
      session &&
      session.mode &&
      Array.isArray(session.caseIds) &&
      session.caseIds.length &&
      !session.complete
    );

    return {
      bestStars: clamp(Number(progress.bestStars) || 0, 0, 3),
      bestScore: Number(progress.bestScore) || 0,
      totalRounds: Number(progress.totalRounds) || 0,
      tutorialComplete: Boolean(progress.tutorialComplete),
      hasActiveSession,
      activeMode: hasActiveSession ? session.mode : null,
      activeCase: hasActiveSession ? (Number(session.caseIndex) || 0) + 1 : 0,
      activeTotal: hasActiveSession ? session.caseIds.length : 0
    };
  }

  function updateHub() {
    const w1 = readW1();
    const w1Cleared = w1.tutorialComplete || w1.bestStars >= 1;
    const actProgress = w1Cleared ? 1 : 0;

    setText('#actProgressText', `${actProgress}/4`);
    setText('#heroStars', stars(w1.bestStars));
    setText('#heroScore', w1.bestScore || '0');

    if (w1.hasActiveSession) {
      setText('#nowStatus', `RESUME • CASE ${w1.activeCase}/${w1.activeTotal}`);
      setText('#nowSummary', 'มีภารกิจค้างอยู่ กลับไปทำต่อจากจุดเดิมได้ทันที');
      setText('#nowReward', `↺ ${w1.activeMode || 'mission'} • ระบบบันทึกไว้ในเครื่องนี้`);
      setText('#nowLaunchText', 'ทำภารกิจต่อ');
      setText('#pathHint', 'กลับไปทำ W1 ให้จบก่อน แล้วค่อยปลดล็อก Mission ถัดไป');
      setText('#pathW1State', 'In progress');
      setClass('#nowStatusDot', 'is-resume', true);
      setClass('#nowStatusDot', 'is-complete', false);
    } else if (w1Cleared) {
      setText('#nowStatus', 'W1 CLEARED');
      setText('#nowSummary', 'ผ่านพื้นฐาน W1 แล้ว เล่น Random Replay หรือ Transfer Challenge เพื่อเก็บ Mastery ต่อได้');
      setText('#nowReward', `★ ${w1.bestStars}/3 • จบแล้ว ${w1.totalRounds} รอบ`);
      setText('#nowLaunchText', 'เล่นซ้ำ / Challenge');
      setText('#pathHint', 'W1 ผ่านแล้ว • W2 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน');
      setText('#pathW1State', 'Cleared');
      setClass('#nowStatusDot', 'is-complete', true);
      setClass('#nowStatusDot', 'is-resume', false);
    } else {
      setText('#nowStatus', 'MISSION READY');
      setText('#nowSummary', 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง');
      setText('#nowReward', '★ 1 ดาวเพื่อเปิดเส้นทางต่อ');
      setText('#nowLaunchText', 'เริ่มภารกิจ');
      setText('#pathHint', 'เริ่ม W1 เพื่อปลดล็อก Mission ถัดไป');
      setText('#pathW1State', 'Available');
      setClass('#nowStatusDot', 'is-complete', false);
      setClass('#nowStatusDot', 'is-resume', false);
    }

    setClass('#pathW1', 'path-step--cleared', w1Cleared);
    setClass('#pathW1', 'path-step--available', !w1Cleared);

    if (w1Cleared) {
      setText('#w2State', 'NEXT UP');
      setText('#w2Note', 'ผ่านเงื่อนไขแล้ว • รอ Mission Pack W2');
      setText('#pathW2State', 'Pack preparing');
      setClass('#nodeW2', 'compact-stage--ready', true);
    } else {
      setText('#w2State', 'LOCKED');
      setText('#w2Note', 'ผ่าน W1 อย่างน้อย 1 ดาว');
      setText('#pathW2State', 'Pass W1');
      setClass('#nodeW2', 'compact-stage--ready', false);
    }
  }

  function resetW1() {
    const confirmed = confirm(
      'ล้างความคืบหน้า W1 ในเครื่องนี้ทั้งหมด? Tutorial, Replay, Challenge, ดาว และสถิติจะถูกลบ'
    );

    if (!confirmed) return;

    [W1_PROGRESS_KEY, W1_SESSION_KEY, ...LEGACY_W1_KEYS].forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        // Ignore private-mode/localStorage errors.
      }
    });

    updateHub();
  }

  function wireEvents() {
    const resetButton = $('#resetProgressBtn');
    if (resetButton) resetButton.addEventListener('click', resetW1);

    window.addEventListener('focus', updateHub);

    window.addEventListener('storage', (event) => {
      if ([W1_PROGRESS_KEY, W1_SESSION_KEY].includes(event.key)) {
        updateHub();
      }
    });
  }

  wireEvents();
  updateHub();
})();
