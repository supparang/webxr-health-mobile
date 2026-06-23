// === /sgnal-hunt/js/uxq-hub.js ===
// UX Quest Mission Control • W1/W2 hard sync bridge
// Reads W1 completion from V4/V5/V6, active session, and canonical bridge.

(function () {
  'use strict';

  const W1 = {
    progress: 'uxquest-w1-progress-v6',
    session: 'uxquest-w1-session-v6',
    bridge: 'uxquest-act1-unlock-v1'
  };

  const W2 = {
    progress: 'uxquest-w2-progress-v1',
    session: 'uxquest-w2-session-v1'
  };

  const W1_PROGRESS_KEYS = [
    'uxquest-w1-progress-v6',
    'uxquest-w1-progress-v5',
    'uxquest-w1-progress-v4',
    'uxquest-w1-progress'
  ];

  const W1_SESSION_KEYS = [
    'uxquest-w1-session-v6',
    'uxquest-w1-session-v5',
    'uxquest-w1-session-v4',
    'uxquest-w1-case-investigation-v4'
  ];

  const $ = (selector) => document.querySelector(selector);

  function parse(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Browser privacy mode/storage quota should not block the hub UI.
    }
  }

  function storageKeys() {
    try {
      const result = [];
      for (let index = 0; index < localStorage.length; index += 1) {
        const key = localStorage.key(index);
        if (key) result.push(key);
      }
      return result;
    } catch (error) {
      return [];
    }
  }

  function unique(items) {
    return [...new Set(items)];
  }

  function object(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function stars(value) {
    const count = clamp(Number(value) || 0, 0, 3);
    return `${'★'.repeat(count)}${'☆'.repeat(3 - count)}`;
  }

  function text(selector, value) {
    const element = $(selector);
    if (element) element.textContent = value;
  }

  function attr(selector, name, value) {
    const element = $(selector);
    if (element) element.setAttribute(name, value);
  }

  function classToggle(selector, className, value) {
    const element = $(selector);
    if (element) element.classList.toggle(className, Boolean(value));
  }

  function dynamicW1Keys(kind) {
    const pattern = kind === 'progress'
      ? /^uxquest-w1-progress(?:-|$)/i
      : /^uxquest-w1-(?:session|case-investigation)(?:-|$)/i;

    return storageKeys().filter((key) => pattern.test(key));
  }

  function records(keys) {
    return unique(keys)
      .map((key) => ({ key, value: parse(key, null) }))
      .filter((record) => object(record.value));
  }

  function completedFrom(progress, sessions) {
    const starClear = Math.max(
      Number(progress.bestStars) || 0,
      Number(progress.tutorialBestStars) || 0
    ) >= 1;

    const tutorialClear = Boolean(progress.tutorialComplete);

    const historyClear = Array.isArray(progress.roundHistory) &&
      progress.roundHistory.some((round) =>
        Number(round?.stars) >= 1 ||
        (round?.mode === 'tutorial' && Number(round?.score) >= 200)
      );

    const sessionClear = sessions.some((session) =>
      object(session) && session.complete === true &&
      (Number(session.score) >= 200 || Number(session.bestStars) >= 1)
    );

    return starClear || tutorialClear || historyClear || sessionClear;
  }

  function readW1() {
    const progressRecords = records([
      ...W1_PROGRESS_KEYS,
      ...dynamicW1Keys('progress')
    ]);

    const sessionRecords = records([
      ...W1_SESSION_KEYS,
      ...dynamicW1Keys('session')
    ]);

    const values = progressRecords.map((record) => record.value);
    const sessions = sessionRecords.map((record) => record.value);
    const bridge = parse(W1.bridge, {});
    const bridgeW1 = object(bridge?.w1) ? bridge.w1 : {};

    const bestStars = clamp(Math.max(
      0,
      Number(bridgeW1.stars) || 0,
      ...values.map((item) => Math.max(
        Number(item.bestStars) || 0,
        Number(item.tutorialBestStars) || 0
      ))
    ), 0, 3);

    const bestScore = Math.max(
      0,
      Number(bridgeW1.score) || 0,
      ...values.map((item) => Number(item.bestScore) || 0)
    );

    const totalRounds = Math.max(
      0,
      Number(bridgeW1.rounds) || 0,
      ...values.map((item) => Number(item.totalRounds) || 0)
    );

    const normalized = {
      version: 6,
      tutorialComplete: values.some((item) => Boolean(item.tutorialComplete)),
      tutorialBestStars: bestStars,
      bestStars,
      bestScore,
      totalRounds,
      roundHistory: values.flatMap((item) =>
        Array.isArray(item.roundHistory) ? item.roundHistory : []
      )
    };

    const cleared = Boolean(bridgeW1.cleared) || completedFrom(normalized, sessions);

    if (cleared) {
      const canonical = parse(W1.progress, {});
      const repaired = {
        ...(object(canonical) ? canonical : {}),
        ...normalized,
        tutorialComplete: true,
        tutorialBestStars: Math.max(1, bestStars),
        bestStars: Math.max(1, bestStars),
        bestScore,
        totalRounds,
        repairedBy: 'hub-unlock-sync-v2',
        repairedAt: new Date().toISOString()
      };

      write(W1.progress, repaired);
      write(W1.bridge, {
        version: 1,
        updatedAt: new Date().toISOString(),
        w1: {
          cleared: true,
          stars: Math.max(1, bestStars),
          score: bestScore,
          rounds: totalRounds,
          source: bridgeW1.source || 'hub-sync-v2'
        }
      });
    }

    const activeSession = sessions.find((item) =>
      object(item) && item.mode && Array.isArray(item.caseIds) &&
      item.caseIds.length && item.complete !== true
    ) || null;

    return {
      cleared,
      bestStars: cleared ? Math.max(1, bestStars) : bestStars,
      bestScore,
      totalRounds,
      active: Boolean(activeSession),
      activeMode: activeSession?.mode || null,
      activeCase: activeSession ? (Number(activeSession.caseIndex) || 0) + 1 : 0,
      activeTotal: activeSession?.caseIds?.length || 0
    };
  }

  function readW2() {
    const progress = parse(W2.progress, {});
    const session = parse(W2.session, null);

    const bestStars = clamp(Math.max(
      Number(progress?.bestStars) || 0,
      Number(progress?.tutorialBestStars) || 0
    ), 0, 3);

    const cleared = bestStars >= 1 || Boolean(progress?.tutorialComplete) ||
      (Array.isArray(progress?.roundHistory) && progress.roundHistory.some((round) =>
        Number(round?.stars) >= 1 ||
        (round?.mode === 'tutorial' && Number(round?.score) >= 200)
      ));

    const active = object(session) && session.mode &&
      Array.isArray(session.caseIds) && session.caseIds.length &&
      session.complete !== true;

    return {
      cleared,
      bestStars,
      bestScore: Number(progress?.bestScore) || 0,
      totalRounds: Number(progress?.totalRounds) || 0,
      active,
      activeMode: active ? session.mode : null,
      activeCase: active ? (Number(session.caseIndex) || 0) + 1 : 0,
      activeTotal: active ? session.caseIds.length : 0
    };
  }

  function setCurrent(data) {
    text('#nowWeek', data.week);
    text('#nowIcon', data.icon);
    text('#nowTitle', data.title);
    text('#nowSummary', data.summary);
    text('#nowReward', data.reward);
    text('#nowLaunchText', data.cta);
    text('#nowStatus', data.status);
    attr('#nowLaunch', 'href', data.href);
    classToggle('#nowStatusDot', 'is-resume', data.mode === 'resume');
    classToggle('#nowStatusDot', 'is-complete', data.mode === 'complete');
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
      node?.classList.add('compact-stage--ready');
    } else {
      launch.href = '#';
      launch.setAttribute('aria-disabled', 'true');
      launch.classList.add('is-disabled');
      node?.classList.remove('compact-stage--ready');
    }
  }

  function updateHub() {
    const w1 = readW1();
    const w2 = readW2();
    const actProgress = (w1.cleared ? 1 : 0) + (w2.cleared ? 1 : 0);
    const mastery = Math.max(w1.bestStars, w2.bestStars);
    const bestScore = Math.max(w1.bestScore, w2.bestScore);

    text('#actProgressText', `${actProgress}/4`);
    text('#heroStars', stars(mastery));
    text('#heroScore', bestScore || '0');
    text('#menuProgressText', `${actProgress}/4 nodes • W1 ${stars(w1.bestStars)} • W2 ${stars(w2.bestStars)}`);
    text('#menuScoreText', `Best score ${bestScore || 0}`);

    if (w2.active) {
      setCurrent({
        week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'มี Sprint ที่เล่นค้างอยู่ กลับไปทำต่อจาก phase เดิมได้ทันที',
        reward: `↺ ${w2.activeMode || 'sprint'} • case ${w2.activeCase}/${w2.activeTotal}`,
        href: './w2-design-thinking-sprint.html', cta: 'ทำ W2 ต่อ',
        status: `RESUME • CASE ${w2.activeCase}/${w2.activeTotal}`, mode: 'resume'
      });
    } else if (w1.active) {
      setCurrent({
        week: 'W1 • FOUNDATION', icon: '⌕', title: 'UX Detective',
        summary: 'มีภารกิจค้างอยู่ กลับไปทำต่อจากจุดเดิมได้ทันที',
        reward: `↺ ${w1.activeMode || 'mission'} • case ${w1.activeCase}/${w1.activeTotal}`,
        href: './w1-ux-detective.html', cta: 'ทำ W1 ต่อ',
        status: `RESUME • CASE ${w1.activeCase}/${w1.activeTotal}`, mode: 'resume'
      });
    } else if (w2.cleared) {
      setCurrent({
        week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'คุณผ่าน W2 แล้ว เล่น Sprint ซ้ำหรือเก็บ Mastery ต่อได้',
        reward: `★ ${w2.bestStars}/3 • จบแล้ว ${w2.totalRounds} รอบ`,
        href: './w2-design-thinking-sprint.html', cta: 'เล่น W2 ซ้ำ / Challenge',
        status: 'W2 CLEARED', mode: 'complete'
      });
    } else if (w1.cleared) {
      setCurrent({
        week: 'W2 • PROCESS', icon: '↺', title: 'Design Thinking Sprint',
        summary: 'พาทีมเปลี่ยน User Signal เป็น Problem Statement, Prototype และ Test Plan ที่ทดสอบได้จริง',
        reward: '★ 1 ดาวเพื่อเปิด W3',
        href: './w2-design-thinking-sprint.html', cta: 'เริ่ม W2 Design Thinking',
        status: 'MISSION READY', mode: 'ready'
      });
    } else {
      setCurrent({
        week: 'W1 • FOUNDATION', icon: '⌕', title: 'UX Detective',
        summary: 'สืบว่าอะไรทำให้ผู้ใช้ทำเป้าหมายไม่สำเร็จ แล้วเลือกวิธีแก้ที่ช่วยได้จริง',
        reward: '★ 1 ดาวเพื่อเปิดเส้นทางต่อ',
        href: './w1-ux-detective.html', cta: 'เริ่มภารกิจ',
        status: 'MISSION READY', mode: 'ready'
      });
    }

    text('#pathW1State', w1.active ? 'In progress' : w1.cleared ? 'Cleared' : 'Available');
    text('#pathW2State', w2.active ? 'In progress' : w2.cleared ? 'Cleared' : w1.cleared ? 'Available' : 'Pass W1 1★');
    text('#pathW3State', w2.cleared ? 'Pack preparing' : 'Pass W2');

    classToggle('#pathW1', 'path-step--cleared', w1.cleared);
    classToggle('#pathW1', 'path-step--available', !w1.cleared);
    classToggle('#pathW2', 'path-step--cleared', w2.cleared);
    classToggle('#pathW2', 'path-step--available', w1.cleared && !w2.cleared);

    if (w1.cleared) {
      text('#w2State', w2.active ? 'IN PROGRESS' : w2.cleared ? 'CLEARED' : 'AVAILABLE');
      text('#w2Note', w2.active
        ? `ทำต่อ case ${w2.activeCase}/${w2.activeTotal}`
        : w2.cleared
          ? `ผ่านแล้ว ${stars(w2.bestStars)} • เล่นซ้ำได้`
          : 'ผ่านเงื่อนไขแล้ว • เริ่ม W2 ได้เลย'
      );
      setW2Action(true, w2.active ? 'ทำต่อ →' : w2.cleared ? 'เล่นซ้ำ →' : 'เริ่ม W2 →');
    } else {
      text('#w2State', 'LOCKED');
      text('#w2Note', 'ผ่าน W1 อย่างน้อย 1 ดาว');
      setW2Action(false, 'ล็อกอยู่');
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
    if (!confirm('ล้างความคืบหน้า Act I ในเครื่องนี้ทั้งหมด? W1, W2, ดาว, Replay, Challenge และสถิติจะถูกลบ')) {
      return;
    }

    const keys = unique([
      W1.progress, W1.session, W1.bridge,
      W2.progress, W2.session,
      ...W1_PROGRESS_KEYS,
      ...W1_SESSION_KEYS,
      ...dynamicW1Keys('progress'),
      ...dynamicW1Keys('session')
    ]);

    keys.forEach((key) => {
      try { localStorage.removeItem(key); } catch (error) {}
    });

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
      if (menu && menu.open && !menu.contains(event.target)) {
        menu.open = false;
      }
    });

    window.addEventListener('focus', updateHub);
    window.addEventListener('pageshow', updateHub);
    window.addEventListener('storage', updateHub);
  }

  wire();
  updateHub();
})();
