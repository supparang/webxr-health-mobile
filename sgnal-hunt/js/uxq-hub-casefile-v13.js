// === /sgnal-hunt/js/uxq-hub-casefile-v13.js ===
// UX Quest Mission Control • W1 Casefile Main Path + 2★ Readiness Gate
// W2 reads the Casefile readiness bridge only. Legacy quiz progress is ignored.

(function () {
  'use strict';

  const CASEFILE_GATE_KEY = 'csai2601-uxquest-casefile-readiness-v1';
  const CASEFILE_SAVE_KEY = 'csai2601-uxq-casefile-v11-bank24';
  const W2_PROGRESS_KEY = 'uxquest-w2-progress-v9';
  const W2_SESSION_KEY = 'uxquest-w2-session-v9';
  const $ = (selector) => document.querySelector(selector);

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; }
    catch (error) { return fallback; }
  }
  function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function stars(value) { const count = clamp(number(value), 0, 3); return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`; }
  function text(selector, value) { const node = $(selector); if (node) node.textContent = value; }
  function toggle(selector, className, enabled) { const node = $(selector); if (node) node.classList.toggle(className, Boolean(enabled)); }

  function readW1() {
    const record = safeParse(localStorage.getItem(CASEFILE_GATE_KEY), {}) || {};
    const gate = record.w1 && typeof record.w1 === 'object' ? record.w1 : record;
    const rotation = safeParse(localStorage.getItem(CASEFILE_SAVE_KEY), {}) || {};
    const bestStars = clamp(number(gate.bestStars), 0, 3);
    const ready = Boolean(gate.ready || bestStars >= 2);
    return {
      ready,
      mastery: Boolean(gate.mastery || bestStars >= 3),
      bestStars,
      bestScore: Math.max(number(gate.bestScore), number(rotation.best)),
      rounds: Math.max(number(gate.rounds), number(rotation.wins)),
      lastResult: gate.lastResult || null
    };
  }

  function readW2() {
    const progress = safeParse(localStorage.getItem(W2_PROGRESS_KEY), {}) || {};
    const session = safeParse(localStorage.getItem(W2_SESSION_KEY), null);
    const history = Array.isArray(progress.roundHistory) ? progress.roundHistory : [];
    const bestStars = clamp(Math.max(number(progress.bestStars), number(progress.tutorialBestStars)), 0, 3);
    const cleared = Boolean(progress.tutorialComplete || bestStars >= 1 || history.some((item) => number(item?.stars) >= 1));
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

  function setCurrent(config) {
    text('#nowStatus', config.status);
    text('.current-card__week', config.week);
    text('#nowIcon', config.icon);
    text('#w1Title', config.title);
    text('#nowSummary', config.summary);
    text('#nowReward', config.reward);
    text('#nowLaunchText', config.cta);
    const launch = $('#nowLaunch');
    if (launch) launch.href = config.href;
    const dot = $('#nowStatusDot');
    if (dot) {
      dot.classList.toggle('is-resume', config.state === 'resume');
      dot.classList.toggle('is-complete', config.state === 'complete');
    }
  }

  function setW2Action(enabled, label) {
    const launch = $('#w2Launch');
    text('#w2LaunchText', label);
    if (!launch) return;
    if (enabled) {
      launch.href = './w2-design-thinking-sprint.html?v=casefile-v13-ready';
      launch.removeAttribute('aria-disabled');
      launch.classList.remove('is-disabled');
      toggle('#nodeW2', 'compact-stage--locked', false);
      toggle('#nodeW2', 'compact-stage--ready', true);
    } else {
      launch.href = '#';
      launch.setAttribute('aria-disabled', 'true');
      launch.classList.add('is-disabled');
      toggle('#nodeW2', 'compact-stage--locked', true);
      toggle('#nodeW2', 'compact-stage--ready', false);
    }
  }

  function updateHub() {
    const w1 = readW1();
    const w2 = readW2();
    const progressCount = (w1.ready ? 1 : 0) + (w2.cleared ? 1 : 0);
    const bestStars = Math.max(w1.bestStars, w2.stars);
    const bestScore = Math.max(w1.bestScore, w2.score);

    text('#actProgressText', `${progressCount}/4`);
    text('#heroStars', stars(bestStars));
    text('#heroScore', bestScore || 0);
    text('#menuProgressText', `${progressCount}/4 nodes • W1 ${stars(w1.bestStars)} • W2 ${stars(w2.stars)}`);
    text('#menuScoreText', `Casefile best ${w1.bestScore || 0}`);

    toggle('#pathW1', 'path-step--cleared', w1.ready);
    toggle('#pathW1', 'path-step--available', !w1.ready);
    toggle('#pathW2', 'path-step--available', w1.ready && !w2.cleared);
    toggle('#pathW2', 'path-step--cleared', w2.cleared);
    text('#pathW1State', w1.mastery ? 'Mastery 3★' : w1.ready ? 'Readiness 2★' : w1.bestStars ? `Practice ${stars(w1.bestStars)}` : 'Available');
    text('#pathW2State', w2.cleared ? `Cleared ${stars(w2.stars)}` : w1.ready ? 'Available' : 'Pass W1 2★ Readiness');
    text('#pathW3State', w2.cleared ? 'Mission Pack soon' : 'Pass W2');

    if (w2.active) {
      setCurrent({
        status: `RESUME • CASE ${w2.activeCase}/${w2.activeTotal}`,
        week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'มี Sprint ที่เล่นค้างอยู่ กลับไปทำต่อจาก Phase เดิมได้ทันที',
        reward: `${w2.activeMode} • case ${w2.activeCase}/${w2.activeTotal}`,
        href: './w2-design-thinking-sprint.html?v=casefile-v13-ready&resume=1',
        cta: 'ทำ W2 ต่อ', state: 'resume'
      });
    } else if (w2.cleared) {
      setCurrent({
        status: 'W2 CLEARED', week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'คุณผ่าน W2 แล้ว เล่น Sprint ซ้ำเพื่อเก็บ Mastery หรือฝึก Transfer Challenge ได้',
        reward: `${stars(w2.stars)} • จบแล้ว ${w2.rounds} รอบ`,
        href: './w2-design-thinking-sprint.html?v=casefile-v13-ready',
        cta: 'เล่น W2 ซ้ำ', state: 'complete'
      });
    } else if (w1.ready) {
      setCurrent({
        status: 'MISSION READY', week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'W1 Casefile ผ่าน 2★ Readiness แล้ว: นำหลักฐานผู้ใช้ไป Define, Ideate, Prototype และ Test ต่อใน W2',
        reward: '★ 1 ดาวเพื่อเปิด W3',
        href: './w2-design-thinking-sprint.html?v=casefile-v13-ready',
        cta: 'เริ่ม W2 Design Thinking', state: 'ready'
      });
    } else {
      setCurrent({
        status: w1.bestStars ? 'PRACTICE CONTINUES' : 'MISSION READY',
        week: 'W1 • CASEFILE', icon: '⌕', title: 'UX Detective: Casefile Hunt',
        summary: w1.bestStars
          ? 'ได้ Practice Clear แล้ว แต่ต้องเชื่อม Evidence → Hypothesis → Fix → Test ให้ถึง 2★ Readiness เพื่อเปิด W2'
          : 'ปิดคดี UX ด้วยหลักฐาน สมมติฐาน การแก้ และผล User Test ที่เปลี่ยนตามการเลือกจริง',
        reward: w1.bestStars ? `${stars(w1.bestStars)} • ต้องถึง 2★ Readiness` : '★ 2 Readiness เพื่อเปิด W2',
        href: './w1-ux-crisis-casefile.html?v=main-path-v13',
        cta: w1.bestStars ? 'ฝึก Casefile ต่อ' : 'เริ่ม W1 Casefile', state: 'ready'
      });
    }

    if (w1.ready) {
      text('#w2State', w2.active ? 'IN PROGRESS' : w2.cleared ? 'CLEARED' : 'AVAILABLE');
      text('#w2Note', w2.active
        ? `ทำต่อ Case ${w2.activeCase}/${w2.activeTotal}`
        : w2.cleared ? `ผ่านแล้ว ${stars(w2.stars)} • เล่นซ้ำได้`
        : 'ผ่าน W1 Casefile 2★ แล้ว • เริ่ม W2 ได้เลย');
      setW2Action(true, w2.active ? 'ทำต่อ →' : w2.cleared ? 'เล่นซ้ำ →' : 'เริ่ม W2 →');
    } else {
      text('#w2State', 'LOCKED');
      text('#w2Note', 'ผ่าน W1 Casefile ที่ 2★ Readiness');
      setW2Action(false, 'ล็อกอยู่');
    }

    text('#pathHint', w2.cleared
      ? 'W2 ผ่านแล้ว • W3 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน'
      : w1.ready
        ? 'W1 Casefile ผ่าน 2★ แล้ว • เข้า W2 ได้ทันที'
        : 'ผ่าน W1 Casefile ที่ 2★ Readiness เพื่อปลดล็อก W2');
  }

  function resetAct() {
    if (!confirm('ล้างความคืบหน้า Act I ในเครื่องนี้ทั้งหมด? ผล W1 Casefile, W2 และสถิติในเครื่องนี้จะถูกลบ')) return;
    try {
      const removable = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key && /^(?:csai2601-uxquest-casefile-readiness-v1|csai2601-uxq-casefile-|uxquest-w2-progress-v9|uxquest-w2-session-v9)$/i.test(key)) removable.push(key);
      }
      removable.forEach((key) => localStorage.removeItem(key));
    } catch (error) { console.warn('[UXQ Casefile Hub] reset failed', error); }
    updateHub();
  }

  function wire() {
    $('#resetProgressBtn')?.addEventListener('click', resetAct);
    $('#w2Launch')?.addEventListener('click', (event) => {
      if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault();
    });
    window.addEventListener('focus', updateHub);
    window.addEventListener('storage', updateHub);
    window.addEventListener('uxquest:casefile-readiness', updateHub);
  }

  wire();
  updateHub();
})();
