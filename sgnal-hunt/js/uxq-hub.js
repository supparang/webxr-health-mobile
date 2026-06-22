// === /sgnal-hunt/js/uxq-hub.js ===
// UX Quest Mission Control • reads W1 V6 progress without changing W1 game logic

(function () {
  'use strict';

  const W1_PROGRESS_KEY = 'uxquest-w1-progress-v6';
  const W1_SESSION_KEY = 'uxquest-w1-session-v6';
  const LEGACY_PROFILE_KEY = 'csai2601_uxquest_progress_v1';
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
      tutorialBestStars: clamp(Number(progress.tutorialBestStars) || 0, 0, 3),
      replayWins: Number(progress.replayWins) || 0,
      challengeWins: Number(progress.challengeWins) || 0,
      hasActiveSession,
      activeMode: hasActiveSession ? session.mode : null,
      activeCase: hasActiveSession ? (Number(session.caseIndex) || 0) + 1 : 0,
      activeTotal: hasActiveSession ? session.caseIds.length : 0
    };
  }

  function readLegacyProfile() {
    const profile = safeRead(LEGACY_PROFILE_KEY, {});
    return {
      name: profile && profile.name ? String(profile.name) : 'CSAI Student'
    };
  }

  function setText(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function setClass(selector, className, enabled) {
    const element = $(selector);
    if (element) element.classList.toggle(className, enabled);
  }

  function updateHub() {
    const w1 = readW1();
    const profile = readLegacyProfile();
    const w1Cleared = w1.tutorialComplete || w1.bestStars >= 1;
    const pathProgress = w1Cleared ? 1 : 0;

    document.title = `UX Quest • Mission Control • ${profile.name}`;

    setText('#actProgressText', `${pathProgress} / 4 nodes`);
    setText('#heroStars', stars(w1.bestStars));
    setText('#heroScore', w1.bestScore || '0');
    setText('#w1Stars', stars(w1.bestStars));

    const w1State = $('#w1State');
    const w1Caption = $('#w1StarCaption');
    const launchText = $('#w1LaunchText');
    const nowLaunchText = $('#nowLaunchText');
    const nowStatus = $('#nowStatus');
    const nowDescription = $('#nowDescription');
    const nowReward = $('#nowReward');
    const pathHint = $('#pathHint');

    if (w1.hasActiveSession) {
      setText('#nowStatus', `RESUME • CASE ${w1.activeCase}/${w1.activeTotal}`);
      setText('#nowDescription', 'คุณมีภารกิจที่ยังทำไม่จบ กลับไปทำต่อจากจุดเดิมได้ทันที');
      setText('#nowReward', '↺ ระบบบันทึกความคืบหน้าในเครื่องนี้');
      setText('#w1State', 'IN PROGRESS');
      setText('#w1StarCaption', `กำลังทำ ${w1.activeMode || 'mission'} • Case ${w1.activeCase}/${w1.activeTotal}`);
      setText('#w1LaunchText', 'ทำภารกิจต่อ');
      setText('#nowLaunchText', 'ทำ W1 ต่อ');
      setText('#pathHint', 'กลับไปทำ W1 ให้จบเพื่อปลดล็อกเส้นทางต่อไป');
      setClass('#nowStatusDot', 'is-resume', true);
      setClass('#nowStatusDot', 'is-complete', false);
    } else if (w1Cleared) {
      setText('#nowStatus', 'W1 CLEARED');
      setText('#nowDescription', 'คุณผ่านพื้นฐาน W1 แล้ว เล่น Random Replay หรือ Transfer Challenge ต่อได้จากใน W1');
      setText('#nowReward', `★ ${w1.bestStars}/3 • จบรอบแล้ว ${w1.totalRounds} รอบ`);
      setText('#w1State', 'CLEARED');
      setText('#w1StarCaption', `ผ่านแล้ว ${stars(w1.bestStars)} • เข้าไปเก็บ Mastery ต่อได้`);
      setText('#w1LaunchText', 'เล่นซ้ำ / Challenge');
      setText('#nowLaunchText', 'ไปเลือกโหมด W1');
      setText('#pathHint', 'W1 ผ่านแล้ว • W2 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน');
      setClass('#nowStatusDot', 'is-complete', true);
      setClass('#nowStatusDot', 'is-resume', false);
    } else {
      setText('#nowStatus', 'MISSION READY');
      setText('#nowDescription', 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง');
      setText('#nowReward', '★ 1 ดาวเพื่อเปิดเส้นทางต่อ');
      setText('#w1State', 'AVAILABLE');
      setText('#w1StarCaption', 'เก็บ 1 ดาวเพื่อเปิดเส้นทางต่อ');
      setText('#w1LaunchText', 'เริ่มภารกิจ');
      setText('#nowLaunchText', 'เริ่ม W1 UX Detective');
      setText('#pathHint', 'เริ่มจาก W1 เพื่อสร้างพื้นฐานการคิดแบบ UX Designer');
      setClass('#nowStatusDot', 'is-complete', false);
      setClass('#nowStatusDot', 'is-resume', false);
    }

    setClass('#pathW1', 'path-step--cleared', w1Cleared);
    setClass('#pathW1', 'path-step--available', !w1Cleared);

    if (w1Cleared) {
      setText('#w2State', 'NEXT UP');
      setText('#w2Note', 'ผ่านเงื่อนไขแล้ว • รอ Mission Pack Week 2');
      setClass('#nodeW2', 'stage-card--available-preview', true);
    } else {
      setText('#w2State', 'LOCKED');
      setText('#w2Note', 'ต้องผ่าน W1 อย่างน้อย 1 ดาว');
      setClass('#nodeW2', 'stage-card--available-preview', false);
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
        // LocalStorage can be unavailable in private contexts.
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
