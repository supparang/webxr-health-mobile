// === /sgnal-hunt/js/uxq-hub-v8.js ===
// UX Quest Mission Control • V8
// Reads one canonical W1 state only. W1 never loops Tutorial after a pass.

(function () {
  'use strict';

  const W1_DETAIL_KEY = 'uxquest-w1-progress-v8';
  const W1_SESSION_KEY = 'uxquest-w1-session-v8';
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

  function setClass(selector, className, enabled) {
    const node = $(selector);
    if (node) node.classList.toggle(className, Boolean(enabled));
  }

  function readW1() {
    const canonical = window.UXQProgressV8 && typeof window.UXQProgressV8.readW1 === 'function'
      ? window.UXQProgressV8.readW1()
      : { cleared: false, stars: 0, score: 0, rounds: 0, tutorialComplete: false };

    const detail = safeParse(localStorage.getItem(W1_DETAIL_KEY), {}) || {};
    const session = safeParse(localStorage.getItem(W1_SESSION_KEY), null);
    const active = Boolean(
      session && session.mode && Array.isArray(session.caseIds) && session.caseIds.length && session.complete !== true
    );

    return {
      cleared: Boolean(canonical.cleared),
      stars: clamp(Math.max(number(canonical.stars), number(detail.bestStars), number(detail.tutorialBestStars)), 0, 3),
      score: Math.max(number(canonical.score), number(detail.bestScore)),
      rounds: Math.max(number(canonical.rounds), number(detail.totalRounds)),
      tutorialComplete: Boolean(canonical.tutorialComplete || detail.tutorialComplete || canonical.cleared),
      active,
      activeMode: active ? session.mode : '',
      activeCase: active ? number(session.caseIndex) + 1 : 0,
      activeTotal: active ? session.caseIds.length : 0
    };
  }

  function readW2() {
    const progress = safeParse(localStorage.getItem(W2_PROGRESS_KEY), {}) || {};
    const session = safeParse(localStorage.getItem(W2_SESSION_KEY), null);
    const history = Array.isArray(progress.roundHistory) ? progress.roundHistory : [];
    const bestStars = clamp(Math.max(number(progress.bestStars), number(progress.tutorialBestStars)), 0, 3);
    const cleared = Boolean(progress.tutorialComplete || bestStars >= 1 || history.some((item) => number(item && item.stars) >= 1));
    const active = Boolean(session && session.mode && Array.isArray(session.caseIds) && session.caseIds.length && session.complete !== true);

    return {
      cleared,
      stars: bestStars,
      score: number(progress.bestScore),
      rounds: Math.max(number(progress.totalRounds), history.length),
      active,
      activeMode: active ? session.mode : '',
      activeCase: active ? number(session.caseIndex) + 1 : 0,
      activeTotal: active ? session.caseIds.length : 0
    };
  }

  function setCurrent({ status, week, icon, title, summary, reward, href, cta, state }) {
    text('#nowStatus', status);
    text('.current-card__week', week);
    text('#nowIcon', icon);
    text('#w1Title', title);
    text('#nowSummary', summary);
    text('#nowReward', reward);
    text('#nowLaunchText', cta);

    const launch = $('#nowLaunch');
    if (launch) launch.href = href;

    const dot = $('#nowStatusDot');
    if (dot) {
      dot.classList.toggle('is-resume', state === 'resume');
      dot.classList.toggle('is-complete', state === 'complete');
    }
  }

  function setW2Action(enabled, label) {
    const launch = $('#w2Launch');
    const node = $('#nodeW2');
    text('#w2LaunchText', label);

    if (!launch) return;

    if (enabled) {
      launch.href = './w2-design-thinking-sprint.html?v=progress-v8';
      launch.removeAttribute('aria-disabled');
      launch.classList.remove('is-disabled');
      node?.classList.remove('compact-stage--locked');
      node?.classList.add('compact-stage--ready');
    } else {
      launch.href = '#';
      launch.setAttribute('aria-disabled', 'true');
      launch.classList.add('is-disabled');
      node?.classList.add('compact-stage--locked');
      node?.classList.remove('compact-stage--ready');
    }
  }

  function updateHub() {
    const w1 = readW1();
    const w2 = readW2();
    const progressCount = (w1.cleared ? 1 : 0) + (w2.cleared ? 1 : 0);
    const bestStars = Math.max(w1.stars, w2.stars);
    const bestScore = Math.max(w1.score, w2.score);

    text('#actProgressText', `${progressCount}/4`);
    text('#heroStars', starText(bestStars));
    text('#heroScore', bestScore || 0);
    text('#menuProgressText', `${progressCount}/4 nodes • W1 ${starText(w1.stars)} • W2 ${starText(w2.stars)}`);
    text('#menuScoreText', `Best score ${bestScore || 0}`);

    setClass('#pathW1', 'path-step--cleared', w1.cleared);
    setClass('#pathW1', 'path-step--available', !w1.cleared);
    setClass('#pathW2', 'path-step--available', w1.cleared && !w2.cleared);
    setClass('#pathW2', 'path-step--cleared', w2.cleared);

    text('#pathW1State', w1.cleared ? `Cleared ${starText(w1.stars)}` : 'Available');
    text('#pathW2State', w2.cleared ? `Cleared ${starText(w2.stars)}` : w1.cleared ? 'Available' : 'Pass W1 1★');
    text('#pathW3State', w2.cleared ? 'Mission Pack soon' : 'Pass W2');

    if (w2.active) {
      setCurrent({
        status: `RESUME • CASE ${w2.activeCase}/${w2.activeTotal}`,
        week: 'W2 • PROCESS',
        icon: '↺',
        title: 'Design Thinking Sprint',
        summary: 'มี Sprint ที่เล่นค้างอยู่ กลับไปทำต่อจาก Phase เดิมได้ทันที',
        reward: `${w2.activeMode} • case ${w2.activeCase}/${w2.activeTotal}`,
        href: './w2-design-thinking-sprint.html?v=progress-v8&resume=1',
        cta: 'ทำ W2 ต่อ',
        state: 'resume'
      });
    } else if (w2.cleared) {
      setCurrent({
        status: 'W2 CLEARED',
        week: 'W2 • PROCESS',
        icon: '↺',
        title: 'Design Thinking Sprint',
        summary: 'คุณผ่าน W2 แล้ว เล่น Sprint ซ้ำเพื่อเก็บ Mastery หรือฝึก Transfer Challenge ได้',
        reward: `${starText(w2.stars)} • จบแล้ว ${w2.rounds} รอบ`,
        href: './w2-design-thinking-sprint.html?v=progress-v8',
        cta: 'เล่น W2 ซ้ำ',
        state: 'complete'
      });
    } else if (w1.cleared) {
      setCurrent({
        status: 'MISSION READY',
        week: 'W2 • PROCESS',
        icon: '↺',
        title: 'Design Thinking Sprint',
        summary: 'พาทีมเปลี่ยน User Signal เป็น Problem Statement, Prototype และ Test Plan ที่ทดสอบได้จริง',
        reward: '★ 1 ดาวเพื่อเปิด W3',
        href: './w2-design-thinking-sprint.html?v=progress-v8',
        cta: 'เริ่ม W2 Design Thinking',
        state: 'ready'
      });
    } else if (w1.active) {
      setCurrent({
        status: `RESUME • CASE ${w1.activeCase}/${w1.activeTotal}`,
        week: 'W1 • FOUNDATION',
        icon: '⌕',
        title: 'UX Detective',
        summary: 'มี Case ที่เล่นค้างอยู่ กลับไปทำต่อจากขั้นตอนเดิมได้ทันที',
        reward: `${w1.activeMode} • case ${w1.activeCase}/${w1.activeTotal}`,
        href: './w1-ux-detective.html?resume=1',
        cta: 'ทำ W1 ต่อ',
        state: 'resume'
      });
    } else {
      setCurrent({
        status: 'MISSION READY',
        week: 'W1 • FOUNDATION',
        icon: '⌕',
        title: 'UX Detective',
        summary: 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง',
        reward: '★ 1 ดาวเพื่อเปิด W2',
        href: './w1-ux-detective.html?mode=tutorial',
        cta: 'เริ่ม W1 Tutorial',
        state: 'ready'
      });
    }

    if (w1.cleared) {
      text('#w2State', w2.active ? 'IN PROGRESS' : w2.cleared ? 'CLEARED' : 'AVAILABLE');
      text('#w2Note', w2.active
        ? `ทำต่อ Case ${w2.activeCase}/${w2.activeTotal}`
        : w2.cleared
          ? `ผ่านแล้ว ${starText(w2.stars)} • เล่นซ้ำได้`
          : 'ผ่าน W1 แล้ว • เริ่ม W2 ได้เลย');
      setW2Action(true, w2.active ? 'ทำต่อ →' : w2.cleared ? 'เล่นซ้ำ →' : 'เริ่ม W2 →');
    } else {
      text('#w2State', 'LOCKED');
      text('#w2Note', 'ผ่าน W1 อย่างน้อย 1 ดาว');
      setW2Action(false, 'ล็อกอยู่');
    }

    text('#pathHint', w2.cleared
      ? 'W2 ผ่านแล้ว • W3 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน'
      : w1.cleared
        ? 'W2 พร้อมแล้ว • ไม่ต้องเล่น W1 ซ้ำ'
        : 'ผ่าน W1 อย่างน้อย 1★ เพื่อปลดล็อก W2');
  }

  function resetAct() {
    if (!confirm('ล้างความคืบหน้า Act I ในเครื่องนี้ทั้งหมด? W1, W2, ดาว, Replay, Challenge และสถิติจะถูกลบ')) {
      return;
    }

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
      console.warn('[UXQ V8] Could not reset local progress.', error);
    }

    updateHub();
  }

  function wire() {
    $('#resetProgressBtn')?.addEventListener('click', resetAct);
    $('#w2Launch')?.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });
    window.addEventListener('focus', updateHub);
    window.addEventListener('storage', updateHub);
  }

  wire();
  updateHub();
})();
