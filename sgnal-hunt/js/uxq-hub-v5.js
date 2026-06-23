// === /sgnal-hunt/js/uxq-hub-v5.js ===
// UX Quest Mission Control • V5
// Uses read-only canonical W1 state to avoid the V4 re-entrant Hub refresh loop.

(function () {
  'use strict';

  const W1_CANONICAL_KEY = 'uxquest-w1-progress-v6';
  const W2_PROGRESS_KEY = 'uxquest-w2-progress-v1';
  const W2_SESSION_KEY = 'uxquest-w2-session-v1';
  const $ = (selector) => document.querySelector(selector);

  function safeParse(raw, fallback) {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function number(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function starText(value) {
    const count = clamp(number(value), 0, 3);
    return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
  }

  function text(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function toggle(selector, className, enabled) {
    const node = $(selector);
    if (node) node.classList.toggle(className, Boolean(enabled));
  }

  function fallbackW1() {
    const record = safeParse(localStorage.getItem(W1_CANONICAL_KEY), {}) || {};
    const stars = clamp(Math.max(number(record.bestStars), number(record.tutorialBestStars)), 0, 3);
    return {
      cleared: Boolean(record.tutorialComplete || stars >= 1),
      stars,
      score: Math.max(number(record.bestScore), number(record.score)),
      rounds: Math.max(number(record.totalRounds), number(record.rounds))
    };
  }

  function getW1() {
    const gate = window.UXQUnlockGateV5;
    if (gate && typeof gate.readW1 === 'function') {
      return gate.readW1();
    }
    return fallbackW1();
  }

  function getW2() {
    const progress = safeParse(localStorage.getItem(W2_PROGRESS_KEY), {}) || {};
    const session = safeParse(localStorage.getItem(W2_SESSION_KEY), null);
    const bestStars = clamp(Math.max(number(progress.bestStars), number(progress.tutorialBestStars)), 0, 3);
    const history = Array.isArray(progress.roundHistory) ? progress.roundHistory : [];
    const cleared = Boolean(
      progress.tutorialComplete ||
      bestStars >= 1 ||
      history.some((round) => number(round && round.stars) >= 1)
    );

    const active = Boolean(
      session &&
      session.mode &&
      Array.isArray(session.caseIds) &&
      session.caseIds.length &&
      session.complete !== true
    );

    return {
      cleared,
      bestStars,
      score: number(progress.bestScore),
      rounds: Math.max(number(progress.totalRounds), history.length),
      active,
      activeCase: active ? number(session.caseIndex) + 1 : 0,
      activeTotal: active ? session.caseIds.length : 0,
      activeMode: active ? session.mode : ''
    };
  }

  function setCurrent(config) {
    text('#nowStatus', config.status);
    text('.current-card__week', config.week);
    text('#nowIcon', config.icon);
    text('#w1Title', config.title);
    text('#nowSummary', config.summary);
    text('#nowReward', config.reward);
    text('#nowLaunchText', config.cta);

    const link = $('#nowLaunch');
    if (link) link.href = config.href;

    const dot = $('#nowStatusDot');
    if (dot) {
      dot.classList.toggle('is-resume', config.mode === 'resume');
      dot.classList.toggle('is-complete', config.mode === 'complete');
    }
  }

  function setW2Action(enabled, label) {
    const launch = $('#w2Launch');
    const node = $('#nodeW2');

    text('#w2LaunchText', label);

    if (!launch) return;

    if (enabled) {
      launch.href = './w2-design-thinking-sprint.html';
      launch.removeAttribute('aria-disabled');
      launch.classList.remove('is-disabled');
      if (node) {
        node.classList.remove('compact-stage--locked');
        node.classList.add('compact-stage--ready');
      }
    } else {
      launch.href = '#';
      launch.setAttribute('aria-disabled', 'true');
      launch.classList.add('is-disabled');
      if (node) {
        node.classList.add('compact-stage--locked');
        node.classList.remove('compact-stage--ready');
      }
    }
  }

  function updateHub() {
    const w1 = getW1();
    const w2 = getW2();
    const w1Cleared = Boolean(w1.cleared);
    const w2Cleared = Boolean(w2.cleared);
    const progressCount = (w1Cleared ? 1 : 0) + (w2Cleared ? 1 : 0);
    const topStars = Math.max(number(w1.stars), number(w2.bestStars));
    const topScore = Math.max(number(w1.score), number(w2.score));

    text('#actProgressText', `${progressCount} / 4`);
    text('#heroStars', starText(topStars));
    text('#heroScore', topScore || 0);
    text('#menuProgressText', `${progressCount} / 4 nodes • W1 ${starText(w1.stars)} • W2 ${starText(w2.bestStars)}`);
    text('#menuScoreText', `Best score ${topScore || 0}`);

    toggle('#pathW1', 'path-step--cleared', w1Cleared);
    toggle('#pathW1', 'path-step--available', !w1Cleared);
    toggle('#pathW2', 'path-step--available', w1Cleared && !w2Cleared);
    toggle('#pathW2', 'path-step--cleared', w2Cleared);

    text('#pathW1State', w1Cleared ? `Cleared ${starText(w1.stars)}` : 'Available');
    text('#pathW2State', w2Cleared ? `Cleared ${starText(w2.bestStars)}` : w1Cleared ? 'Available' : 'Pass W1 1★');
    text('#pathW3State', w2Cleared ? 'Mission Pack soon' : 'Pass W2');

    if (w2.active) {
      setCurrent({
        status: `RESUME • CASE ${w2.activeCase}/${w2.activeTotal}`,
        week: 'W2 • PROCESS',
        icon: '↺',
        title: 'Design Thinking Sprint',
        summary: 'มี Sprint ที่เล่นค้างอยู่ กลับไปทำต่อจาก Phase เดิมได้ทันที',
        reward: `↺ ${w2.activeMode || 'sprint'} • case ${w2.activeCase}/${w2.activeTotal}`,
        href: './w2-design-thinking-sprint.html',
        cta: 'ทำ W2 ต่อ',
        mode: 'resume'
      });
    } else if (w2Cleared) {
      setCurrent({
        status: 'W2 CLEARED',
        week: 'W2 • PROCESS',
        icon: '↺',
        title: 'Design Thinking Sprint',
        summary: 'คุณผ่าน W2 แล้ว เล่น Sprint ซ้ำเพื่อเก็บ Mastery หรือฝึก Transfer Challenge ได้',
        reward: `${starText(w2.bestStars)} • จบแล้ว ${w2.rounds} รอบ`,
        href: './w2-design-thinking-sprint.html',
        cta: 'เล่น W2 ซ้ำ',
        mode: 'complete'
      });
    } else if (w1Cleared) {
      setCurrent({
        status: 'MISSION READY',
        week: 'W2 • PROCESS',
        icon: '↺',
        title: 'Design Thinking Sprint',
        summary: 'พาทีมเปลี่ยน User Signal เป็น Problem Statement, Prototype และ Test Plan ที่ทดสอบได้จริง',
        reward: '★ 1 ดาวเพื่อเปิด W3',
        href: './w2-design-thinking-sprint.html',
        cta: 'เริ่ม W2 Design Thinking',
        mode: 'ready'
      });
    } else {
      setCurrent({
        status: 'MISSION READY',
        week: 'W1 • FOUNDATION',
        icon: '⌕',
        title: 'UX Detective',
        summary: 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง',
        reward: '★ 1 ดาวเพื่อเปิดเส้นทางต่อ',
        href: './w1-ux-detective.html',
        cta: 'เริ่มภารกิจ',
        mode: 'ready'
      });
    }

    if (w1Cleared) {
      text('#w2State', w2.active ? 'IN PROGRESS' : w2Cleared ? 'CLEARED' : 'AVAILABLE');
      text('#w2Note', w2.active
        ? `ทำต่อ Case ${w2.activeCase}/${w2.activeTotal}`
        : w2Cleared
          ? `ผ่านแล้ว ${starText(w2.bestStars)} • เล่นซ้ำได้`
          : 'ผ่าน W1 แล้ว • เริ่ม W2 ได้เลย');
      setW2Action(true, w2.active ? 'ทำต่อ →' : w2Cleared ? 'เล่นซ้ำ →' : 'เริ่ม W2 →');
    } else {
      text('#w2State', 'LOCKED');
      text('#w2Note', 'ผ่าน W1 อย่างน้อย 1 ดาว');
      setW2Action(false, 'ล็อกอยู่');
    }

    text('#pathHint', w2Cleared
      ? 'W2 ผ่านแล้ว • W3 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน'
      : w1Cleared
        ? 'W2 พร้อมแล้ว • ผ่าน W2 อย่างน้อย 1★ เพื่อเปิด W3'
        : 'ผ่าน W1 อย่างน้อย 1★ เพื่อปลดล็อก W2');
  }

  function resetAct() {
    const confirmed = confirm('ล้างความคืบหน้า Act I ในเครื่องนี้ทั้งหมด? W1, W2, ดาว, Replay และสถิติจะถูกลบ');
    if (!confirmed) return;

    try {
      const removable = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && /^(?:uxquest-w1-|uxquest-w2-|uxquest-act1-|uxquest-unlock-)/i.test(key)) {
          removable.push(key);
        }
      }
      removable.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      // Continue with UI refresh if storage access is restricted.
    }

    const menu = $('#progressMenu');
    if (menu) menu.open = false;
    updateHub();
  }

  function wire() {
    $('#resetProgressBtn')?.addEventListener('click', resetAct);

    $('#w2Launch')?.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') {
        event.preventDefault();
      }
    });

    const menu = $('#progressMenu');
    document.addEventListener('click', (event) => {
      if (menu && menu.open && !menu.contains(event.target)) menu.open = false;
    });

    window.addEventListener('focus', updateHub);
    window.addEventListener('pageshow', updateHub);
    window.addEventListener('storage', updateHub);
  }

  wire();
  updateHub();
})();
