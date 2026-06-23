// === /sgnal-hunt/js/uxq-hub-v4.js ===
// UX Quest Mission Control • W1 → W2 production unlock logic
// Uses the v3 canonical bridge so cache/version changes cannot trap learners on W1.

(function () {
  'use strict';

  const W2_PROGRESS_KEY = 'uxquest-w2-progress-v1';
  const W2_SESSION_KEY = 'uxquest-w2-session-v1';
  const $ = (selector) => document.querySelector(selector);

  function safeParse(value, fallback) {
    try { return value ? JSON.parse(value) : fallback; } catch (error) { return fallback; }
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function stars(value) {
    const count = clamp(Number(value) || 0, 0, 3);
    return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
  }

  function text(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function classToggle(selector, className, enabled) {
    const node = $(selector);
    if (node) node.classList.toggle(className, Boolean(enabled));
  }

  function w1State() {
    const bridge = window.UXQProgressBridge;
    if (bridge && typeof bridge.syncW1 === 'function') {
      return bridge.syncW1();
    }

    return { cleared: false, stars: 0, score: 0, rounds: 0 };
  }

  function w2State() {
    const progress = safeParse(localStorage.getItem(W2_PROGRESS_KEY), {}) || {};
    const session = safeParse(localStorage.getItem(W2_SESSION_KEY), null);
    const bestStars = clamp(Math.max(Number(progress.bestStars) || 0, Number(progress.tutorialBestStars) || 0), 0, 3);
    const history = Array.isArray(progress.roundHistory) ? progress.roundHistory : [];
    const cleared = bestStars >= 1 || Boolean(progress.tutorialComplete) || history.some((round) => Number(round && round.stars) >= 1);
    const active = Boolean(session && session.mode && Array.isArray(session.caseIds) && session.caseIds.length && session.complete !== true);

    return {
      cleared,
      bestStars,
      bestScore: Number(progress.bestScore) || 0,
      totalRounds: Number(progress.totalRounds) || 0,
      active,
      activeCase: active ? (Number(session.caseIndex) || 0) + 1 : 0,
      activeTotal: active ? session.caseIds.length : 0,
      activeMode: active ? session.mode : ''
    };
  }

  function setCurrent({ status, week, icon, title, summary, reward, href, cta, mode }) {
    text('#nowStatus', status);
    text('#nowIcon', icon);
    text('#w1Title', title);
    text('#nowSummary', summary);
    text('#nowReward', reward);
    text('#nowLaunchText', cta);

    const link = $('#nowLaunch');
    if (link) link.href = href;

    const dot = $('#nowStatusDot');
    if (dot) {
      dot.classList.toggle('is-resume', mode === 'resume');
      dot.classList.toggle('is-complete', mode === 'complete');
    }

    const weekNode = document.querySelector('.current-card__week');
    if (weekNode) weekNode.textContent = week;
  }

  function setW2Action(enabled, label) {
    const launch = $('#w2Launch');
    if (!launch) return;

    text('#w2LaunchText', label);

    if (enabled) {
      launch.href = './w2-design-thinking-sprint.html';
      launch.removeAttribute('aria-disabled');
      launch.classList.remove('is-disabled');
      classToggle('#nodeW2', 'compact-stage--ready', true);
    } else {
      launch.href = '#';
      launch.setAttribute('aria-disabled', 'true');
      launch.classList.add('is-disabled');
      classToggle('#nodeW2', 'compact-stage--ready', false);
    }
  }

  function updateHub() {
    const w1 = w1State();
    const w2 = w2State();
    const clearedW1 = Boolean(w1.cleared);
    const actProgress = (clearedW1 ? 1 : 0) + (w2.cleared ? 1 : 0);
    const mastery = Math.max(Number(w1.stars) || 0, w2.bestStars || 0);
    const bestScore = Math.max(Number(w1.score) || 0, w2.bestScore || 0);

    text('#actProgressText', `${actProgress}/4`);
    text('#heroStars', stars(mastery));
    text('#heroScore', bestScore || '0');
    text('#menuProgressText', `${actProgress}/4 nodes • W1 ${stars(w1.stars)} • W2 ${stars(w2.bestStars)}`);
    text('#menuScoreText', `Best score ${bestScore || 0}`);

    classToggle('#pathW1', 'path-step--cleared', clearedW1);
    classToggle('#pathW1', 'path-step--available', !clearedW1);
    classToggle('#pathW2', 'path-step--available', clearedW1 && !w2.cleared);
    classToggle('#pathW2', 'path-step--cleared', w2.cleared);

    text('#pathW1State', clearedW1 ? `Cleared ${stars(w1.stars)}` : 'Available');
    text('#pathW2State', w2.cleared ? `Cleared ${stars(w2.bestStars)}` : clearedW1 ? 'Available' : 'Pass W1 1★');
    text('#pathW3State', w2.cleared ? 'Next when pack is ready' : 'Pass W2');

    if (w2.active) {
      setCurrent({
        status: `RESUME • CASE ${w2.activeCase}/${w2.activeTotal}`,
        week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'มี Sprint ที่เล่นค้างอยู่ กลับไปทำต่อจาก phase เดิมได้ทันที',
        reward: `↺ ${w2.activeMode || 'sprint'} • case ${w2.activeCase}/${w2.activeTotal}`,
        href: './w2-design-thinking-sprint.html', cta: 'ทำ W2 ต่อ', mode: 'resume'
      });
    } else if (w2.cleared) {
      setCurrent({
        status: 'W2 CLEARED', week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'คุณผ่าน W2 แล้ว เล่น Sprint ซ้ำหรือเก็บ Mastery ต่อได้',
        reward: `★ ${w2.bestStars}/3 • จบแล้ว ${w2.totalRounds} รอบ`,
        href: './w2-design-thinking-sprint.html', cta: 'เล่น W2 ซ้ำ / Challenge', mode: 'complete'
      });
    } else if (clearedW1) {
      setCurrent({
        status: 'MISSION READY', week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'พาทีมเปลี่ยน User Signal เป็น Problem Statement, Prototype และ Test Plan ที่ทดสอบได้จริง',
        reward: '★ 1 ดาวเพื่อเปิด W3',
        href: './w2-design-thinking-sprint.html', cta: 'เริ่ม W2 Design Thinking', mode: 'ready'
      });
    } else {
      setCurrent({
        status: 'MISSION READY', week: 'W1 • FOUNDATION', icon: '⌕', title: 'UX Detective',
        summary: 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง',
        reward: '★ 1 ดาวเพื่อเปิดเส้นทางต่อ',
        href: './w1-ux-detective.html', cta: 'เริ่มภารกิจ', mode: 'ready'
      });
    }

    if (clearedW1) {
      text('#w2State', w2.active ? 'IN PROGRESS' : w2.cleared ? 'CLEARED' : 'AVAILABLE');
      text('#w2Note', w2.active
        ? `ทำต่อ case ${w2.activeCase}/${w2.activeTotal}`
        : w2.cleared
          ? `ผ่านแล้ว ${stars(w2.bestStars)} • เล่นซ้ำได้`
          : 'ผ่าน W1 แล้ว • เริ่ม W2 ได้เลย');
      setW2Action(true, w2.active ? 'ทำต่อ →' : w2.cleared ? 'เล่นซ้ำ →' : 'เริ่ม W2 →');
    } else {
      text('#w2State', 'LOCKED');
      text('#w2Note', 'ผ่าน W1 อย่างน้อย 1 ดาว');
      setW2Action(false, 'ล็อกอยู่');
    }

    text('#pathHint', w2.cleared
      ? 'W2 ผ่านแล้ว • W3 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน'
      : clearedW1
        ? 'W2 พร้อมแล้ว • ผ่าน W2 อย่างน้อย 1★ เพื่อเปิด W3'
        : 'ผ่าน W1 อย่างน้อย 1★ เพื่อปลดล็อก W2');
  }

  function resetAct() {
    if (!confirm('ล้างความคืบหน้า Act I ในเครื่องนี้ทั้งหมด? W1, W2, ดาว, Replay และสถิติจะถูกลบ')) return;

    const prefixes = ['uxquest-w1-', 'uxquest-w2-', 'uxquest-act1-', 'uxquest-unlock-'];
    try {
      const keys = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && prefixes.some((prefix) => key.startsWith(prefix))) keys.push(key);
      }
      keys.forEach((key) => localStorage.removeItem(key));
    } catch (error) {}

    document.cookie = 'uxquest_w1_unlock_v3=; Max-Age=0; Path=/; SameSite=Lax';
    const menu = $('#progressMenu');
    if (menu) menu.open = false;
    updateHub();
  }

  function wire() {
    $('#resetProgressBtn')?.addEventListener('click', resetAct);
    $('#w2Launch')?.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });

    const menu = $('#progressMenu');
    document.addEventListener('click', (event) => {
      if (menu && menu.open && !menu.contains(event.target)) menu.open = false;
    });

    window.addEventListener('focus', updateHub);
    window.addEventListener('pageshow', updateHub);
    window.addEventListener('storage', updateHub);
    window.addEventListener('uxquest:w1-unlocked', updateHub);
  }

  wire();
  updateHub();
})();
