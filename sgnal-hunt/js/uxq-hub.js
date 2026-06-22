// === /sgnal-hunt/js/uxq-hub.js ===
// UX Quest Mission Control • Act I hub with W1 + W2 live progression

(function () {
  'use strict';

  // W1 has evolved through several builds. Read and safely migrate any valid
  // completed W1 record so W2 is not locked by a storage-key version mismatch.
  const W1 = { progress: 'uxquest-w1-progress-v6', session: 'uxquest-w1-session-v6' };
  const W1_COMPAT = {
    progressKeys: [
      'uxquest-w1-progress-v6',
      'uxquest-w1-progress-v5',
      'uxquest-w1-progress-v4'
    ],
    sessionKeys: [
      'uxquest-w1-session-v6',
      'uxquest-w1-session-v5',
      'uxquest-w1-case-investigation-v4'
    ]
  };
  const W2 = { progress: 'uxquest-w2-progress-v1', session: 'uxquest-w2-session-v1' };
  const LEGACY = ['uxquest-w1-progress-v5', 'uxquest-w1-session-v5', 'uxquest-w1-progress-v4', 'uxquest-w1-case-investigation-v4'];
  const $ = (selector) => document.querySelector(selector);

  function parse(key, fallback) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (error) { return fallback; } }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function stars(count) { const n = clamp(Number(count) || 0, 0, 3); return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`; }
  function text(selector, value) { const el = $(selector); if (el) el.textContent = value; }
  function attr(selector, name, value) { const el = $(selector); if (el) el.setAttribute(name, value); }
  function classToggle(selector, className, on) { const el = $(selector); if (el) el.classList.toggle(className, on); }

  function validObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function collectRecords(keys) {
    return keys
      .map((key) => ({ key, value: parse(key, null) }))
      .filter((record) => validObject(record.value));
  }

  function completedFrom(progress, sessions) {
    const hasStar = Math.max(
      Number(progress.bestStars) || 0,
      Number(progress.tutorialBestStars) || 0
    ) >= 1;

    const hasTutorial = Boolean(progress.tutorialComplete);

    const finishedLegacyRound = Array.isArray(progress.roundHistory) &&
      progress.roundHistory.some((round) =>
        Number(round?.stars) >= 1 ||
        (round?.mode === 'tutorial' && Number(round?.score) >= 200)
      );

    const finishedLegacySession = sessions.some((session) =>
      session && session.complete === true &&
      (Number(session.score) >= 200 || Number(session.bestStars) >= 1)
    );

    return hasStar || hasTutorial || finishedLegacyRound || finishedLegacySession;
  }

  function normalizeCompatProgress(records, sessions) {
    const values = records.map((record) => record.value);
    const bestStars = clamp(Math.max(0, ...values.map((item) => Math.max(
      Number(item.bestStars) || 0,
      Number(item.tutorialBestStars) || 0
    ))), 0, 3);
    const bestScore = Math.max(0, ...values.map((item) => Number(item.bestScore) || 0));
    const totalRounds = Math.max(0, ...values.map((item) => Number(item.totalRounds) || 0));
    const tutorialComplete = values.some((item) => Boolean(item.tutorialComplete)) ||
      completedFrom({ bestStars, tutorialBestStars: bestStars, roundHistory: values.flatMap((item) => Array.isArray(item.roundHistory) ? item.roundHistory : []) }, sessions);

    return {
      version: 6,
      tutorialComplete,
      tutorialBestStars: bestStars,
      bestStars,
      bestScore,
      totalRounds
    };
  }

  function migrateW1IfNeeded(progress, records) {
    const canonical = records.find((record) => record.key === W1.progress)?.value;
    const needsMigration = progress.tutorialComplete && (
      !canonical ||
      Number(canonical.bestStars) < progress.bestStars ||
      !canonical.tutorialComplete
    );

    if (!needsMigration) return;

    try {
      localStorage.setItem(W1.progress, JSON.stringify({
        ...(canonical || {}),
        ...progress,
        migratedAt: new Date().toISOString()
      }));
    } catch (error) {
      // Private mode/storage quota should not block access to W2.
    }
  }

  function readMission(keys, compat) {
    const progressRecords = compat
      ? collectRecords(compat.progressKeys)
      : [{ key: keys.progress, value: parse(keys.progress, {}) }];

    const sessionRecords = compat
      ? collectRecords(compat.sessionKeys)
      : [{ key: keys.session, value: parse(keys.session, null) }];

    const progress = compat
      ? normalizeCompatProgress(progressRecords, sessionRecords.map((record) => record.value))
      : (progressRecords[0]?.value || {});

    if (compat) migrateW1IfNeeded(progress, progressRecords);

    const session = sessionRecords
      .map((record) => record.value)
      .find((item) => item && item.mode && Array.isArray(item.caseIds) && item.caseIds.length && !item.complete) || null;

    const active = Boolean(session);

    return {
      bestStars: clamp(Math.max(Number(progress.bestStars) || 0, Number(progress.tutorialBestStars) || 0), 0, 3),
      bestScore: Number(progress.bestScore) || 0,
      totalRounds: Number(progress.totalRounds) || 0,
      tutorialComplete: Boolean(progress.tutorialComplete),
      cleared: completedFrom(progress, sessionRecords.map((record) => record.value)),
      active,
      activeMode: active ? session.mode : null,
      activeCase: active ? (Number(session.caseIndex) || 0) + 1 : 0,
      activeTotal: active ? session.caseIds.length : 0
    };
  }

  function setCurrent({ week, icon, title, summary, reward, href, cta, status, mode }) {
    text('#nowWeek', week); text('#nowIcon', icon); text('#nowTitle', title); text('#nowSummary', summary); text('#nowReward', reward); text('#nowLaunchText', cta); text('#nowStatus', status);
    attr('#nowLaunch', 'href', href);
    classToggle('#nowStatusDot', 'is-resume', mode === 'resume');
    classToggle('#nowStatusDot', 'is-complete', mode === 'complete');
  }

  function setW2Action({ enabled, label }) {
    const node = $('#nodeW2'); const launch = $('#w2Launch');
    text('#w2LaunchText', label);
    if (!launch) return;
    if (enabled) {
      launch.href = './w2-design-thinking-sprint.html';
      launch.removeAttribute('aria-disabled');
      launch.classList.remove('is-disabled');
      node?.classList.add('compact-stage--ready');
    } else {
      launch.href = '#'; launch.setAttribute('aria-disabled', 'true'); launch.classList.add('is-disabled');
      node?.classList.remove('compact-stage--ready');
    }
  }

  function updateHub() {
    const w1 = readMission(W1, W1_COMPAT);
    const w2 = readMission(W2);
    const actProgress = (w1.cleared ? 1 : 0) + (w2.cleared ? 1 : 0);
    const masterStars = Math.max(w1.bestStars, w2.bestStars);
    const bestScore = Math.max(w1.bestScore, w2.bestScore);

    text('#actProgressText', `${actProgress}/4`);
    text('#heroStars', stars(masterStars));
    text('#heroScore', bestScore || '0');
    text('#menuProgressText', `${actProgress}/4 nodes • W1 ${stars(w1.bestStars)} • W2 ${stars(w2.bestStars)}`);
    text('#menuScoreText', `Best score ${bestScore || 0}`);

    if (w2.active) {
      setCurrent({ week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint', summary: 'มี Sprint ที่เล่นค้างอยู่ กลับไปทำต่อจาก phase เดิมได้ทันที', reward: `↺ ${w2.activeMode || 'sprint'} • case ${w2.activeCase}/${w2.activeTotal}`, href: './w2-design-thinking-sprint.html', cta: 'ทำ W2 ต่อ', status: `RESUME • CASE ${w2.activeCase}/${w2.activeTotal}`, mode: 'resume' });
    } else if (w1.active) {
      setCurrent({ week: 'W1 • FOUNDATION', icon: '⌕', title: 'UX Detective', summary: 'มีภารกิจค้างอยู่ กลับไปทำต่อจากจุดเดิมได้ทันที', reward: `↺ ${w1.activeMode || 'mission'} • case ${w1.activeCase}/${w1.activeTotal}`, href: './w1-ux-detective.html', cta: 'ทำ W1 ต่อ', status: `RESUME • CASE ${w1.activeCase}/${w1.activeTotal}`, mode: 'resume' });
    } else if (w2.cleared) {
      setCurrent({ week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint', summary: 'คุณผ่าน W2 แล้ว เล่น Sprint ซ้ำหรือเก็บ Mastery ต่อได้', reward: `★ ${w2.bestStars}/3 • จบแล้ว ${w2.totalRounds} รอบ`, href: './w2-design-thinking-sprint.html', cta: 'เล่น W2 ซ้ำ / Challenge', status: 'W2 CLEARED', mode: 'complete' });
    } else if (w1.cleared) {
      setCurrent({ week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint', summary: 'พาทีมเปลี่ยน User Signal เป็น Problem Statement, Prototype และ Test Plan ที่ทดสอบได้จริง', reward: '★ 1 ดาวเพื่อเปิด W3', href: './w2-design-thinking-sprint.html', cta: 'เริ่ม W2 Design Thinking', status: 'MISSION READY', mode: 'ready' });
    } else {
      setCurrent({ week: 'W1 • FOUNDATION', icon: '⌕', title: 'UX Detective', summary: 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง', reward: '★ 1 ดาวเพื่อเปิดเส้นทางต่อ', href: './w1-ux-detective.html', cta: 'เริ่มภารกิจ', status: 'MISSION READY', mode: 'ready' });
    }

    text('#pathW1State', w1.active ? 'In progress' : w1.cleared ? 'Cleared' : 'Available');
    text('#pathW2State', w2.active ? 'In progress' : w2.cleared ? 'Cleared' : w1.cleared ? 'Available' : 'Pass W1 1★');
    text('#pathW3State', w2.cleared ? 'Pack preparing' : 'Pass W2');
    classToggle('#pathW1', 'path-step--cleared', w1.cleared); classToggle('#pathW1', 'path-step--available', !w1.cleared);
    classToggle('#pathW2', 'path-step--cleared', w2.cleared); classToggle('#pathW2', 'path-step--available', w1.cleared && !w2.cleared);

    if (w1.cleared) {
      text('#w2State', w2.active ? 'IN PROGRESS' : w2.cleared ? 'CLEARED' : 'AVAILABLE');
      text('#w2Note', w2.active ? `ทำต่อ case ${w2.activeCase}/${w2.activeTotal}` : w2.cleared ? `ผ่านแล้ว ${stars(w2.bestStars)} • เล่นซ้ำได้` : 'ผ่านเงื่อนไขแล้ว • เริ่ม W2 ได้เลย');
      setW2Action({ enabled: true, label: w2.active ? 'ทำต่อ →' : w2.cleared ? 'เล่นซ้ำ →' : 'เริ่ม W2 →' });
    } else {
      text('#w2State', 'LOCKED'); text('#w2Note', 'ผ่าน W1 อย่างน้อย 1 ดาว'); setW2Action({ enabled: false, label: 'ล็อกอยู่' });
    }

    if (w2.cleared) {
      text('#pathHint', 'W2 ผ่านแล้ว • W3 จะเปิดเมื่อ Mission Pack พร้อมใช้งาน');
    } else if (w1.cleared) {
      text('#pathHint', 'W2 พร้อมแล้ว • ผ่าน W2 อย่างน้อย 1★ เพื่อเปิด W3');
    } else {
      text('#pathHint', 'ผ่าน W1 อย่างน้อย 1★ เพื่อปลดล็อก W2');
    }
  }

  function resetAct() {
    if (!confirm('ล้างความคืบหน้า Act I ในเครื่องนี้ทั้งหมด? W1, W2, ดาว, Replay, Challenge และสถิติจะถูกลบ')) return;
    [...new Set([W1.progress, W1.session, W2.progress, W2.session, ...W1_COMPAT.progressKeys, ...W1_COMPAT.sessionKeys, ...LEGACY])].forEach((key) => { try { localStorage.removeItem(key); } catch (error) {} });
    const menu = $('#progressMenu'); if (menu) menu.open = false;
    updateHub();
  }

  function wire() {
    $('#resetProgressBtn')?.addEventListener('click', resetAct);
    $('#w2Launch')?.addEventListener('click', (event) => { if (event.currentTarget.getAttribute('aria-disabled') === 'true') event.preventDefault(); });
    const menu = $('#progressMenu'); document.addEventListener('click', (event) => { if (menu && menu.open && !menu.contains(event.target)) menu.open = false; });
    window.addEventListener('focus', updateHub);
    window.addEventListener('storage', (event) => { if ([...W1_COMPAT.progressKeys, ...W1_COMPAT.sessionKeys, W2.progress, W2.session].includes(event.key)) updateHub(); });
  }

  wire(); updateHub();
})();
