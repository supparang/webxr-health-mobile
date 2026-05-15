// === /herohealth/vr-groups/groups-mobile-replay-v99.js ===
// HeroHealth Groups Mobile — v9.9 Replay Motivation
// Adds: Daily Challenge, Best Score, Best Combo, badge collection, next-goal suggestion.
// Safe add-on: reads summaries/localStorage and appends UI only.
// PATCH v20260514-GROUPS-MOBILE-V99-REPLAY-MOTIVATION

(function () {
  'use strict';

  const VERSION = 'v9.9-mobile-replay-motivation-20260514';

  if (window.__HHA_GROUPS_MOBILE_V99_REPLAY__) {
    console.warn('[Groups Mobile v9.9] already installed');
    return;
  }

  window.__HHA_GROUPS_MOBILE_V99_REPLAY__ = true;

  const WIN = window;
  const DOC = document;

  const KEYS = {
    best: 'HHA_GROUPS_MOBILE_BEST_V99',
    badges: 'HHA_GROUPS_MOBILE_BADGES_V99',
    history: 'HHA_GROUPS_MOBILE_HISTORY_V99',
    dailyPrefix: 'HHA_GROUPS_MOBILE_DAILY_V99_'
  };

  const state = {
    daily: null,
    best: null,
    badges: [],
    history: [],
    lastSummary: null
  };

  function $(id) {
    return DOC.getElementById(id);
  }

  function qs(name, fallback = '') {
    try {
      return new URL(location.href).searchParams.get(name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function safeJsonGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      return fallback;
    }
  }

  function safeJsonSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {}
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!Number.isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function hashText(str) {
    let h = 2166136261;
    str = String(str || '');

    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }

    return h >>> 0;
  }

  function dailyChallenge() {
    const pid = qs('pid', 'anon');
    const diff = qs('diff', 'normal');
    const key = todayKey();
    const seed = hashText(`${key}|${pid}|groups|${diff}`);

    const pool = [
      {
        id: 'score',
        icon: '🏆',
        title: 'Score Sprint',
        desc: 'ทำคะแนนให้ถึงเป้าหมาย',
        target: diff === 'easy' ? 260 : diff === 'hard' ? 420 : diff === 'challenge' ? 520 : 350,
        unit: 'คะแนน'
      },
      {
        id: 'combo',
        icon: '🔥',
        title: 'Combo Builder',
        desc: 'ทำคอมโบสูงสุดให้ถึงเป้าหมาย',
        target: diff === 'easy' ? 6 : diff === 'hard' ? 10 : diff === 'challenge' ? 12 : 8,
        unit: 'คอมโบ'
      },
      {
        id: 'accuracy',
        icon: '🎯',
        title: 'Accuracy Hero',
        desc: 'ทำความแม่นยำให้ถึงเป้าหมาย',
        target: diff === 'easy' ? 70 : diff === 'hard' ? 85 : diff === 'challenge' ? 90 : 80,
        unit: '%'
      },
      {
        id: 'decoy',
        icon: '🚫',
        title: 'Decoy Dodger',
        desc: 'หลบตัวหลอกให้ได้',
        target: diff === 'easy' ? 1 : diff === 'hard' ? 3 : diff === 'challenge' ? 4 : 2,
        unit: 'ครั้ง'
      },
      {
        id: 'mission',
        icon: '⭐',
        title: 'Mission Master',
        desc: 'ทำ Mission Clear ให้ได้',
        target: diff === 'easy' ? 1 : diff === 'hard' ? 3 : diff === 'challenge' ? 4 : 2,
        unit: 'ภารกิจ'
      }
    ];

    return Object.assign({}, pool[seed % pool.length], {
      date: key,
      key: `${KEYS.dailyPrefix}${key}_${pid}`,
      completed: false,
      bestProgress: 0
    });
  }

  function loadState() {
    state.best = safeJsonGet(KEYS.best, null);
    state.badges = safeJsonGet(KEYS.badges, []);
    state.history = safeJsonGet(KEYS.history, []);

    const d = dailyChallenge();
    const saved = safeJsonGet(d.key, null);

    state.daily = saved && saved.id === d.id
      ? Object.assign({}, d, saved)
      : d;
  }

  function injectStyle() {
    if ($('groups-mobile-v99-style')) return;

    const style = DOC.createElement('style');
    style.id = 'groups-mobile-v99-style';
    style.textContent = `
      .v99-panel{
        margin:14px auto 0;
        max-width:620px;
        border-radius:28px;
        padding:14px;
        background:linear-gradient(180deg,#ffffff,#f2fbff);
        border:2px solid #d7edf7;
        box-shadow:0 14px 34px rgba(35,81,107,.10);
        text-align:left;
      }

      .v99-title{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        font-size:18px;
        line-height:1.12;
        font-weight:1000;
        color:#244e68;
      }

      .v99-pill{
        flex:0 0 auto;
        border-radius:999px;
        padding:5px 8px;
        background:#fff5ca;
        color:#806000;
        font-size:11px;
        font-weight:1000;
      }

      .v99-text{
        margin-top:7px;
        color:#7193a8;
        font-size:13px;
        line-height:1.32;
        font-weight:850;
      }

      .v99-mini-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:10px;
      }

      .v99-mini{
        border-radius:18px;
        padding:10px 7px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        text-align:center;
      }

      .v99-mini b{
        display:block;
        font-size:20px;
        line-height:1;
        font-weight:1000;
        color:#244e68;
      }

      .v99-mini span{
        display:block;
        margin-top:4px;
        color:#7193a8;
        font-size:11px;
        line-height:1.15;
        font-weight:850;
      }

      .v99-progress{
        height:10px;
        margin-top:10px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(97,187,255,.16);
      }

      .v99-progress i{
        display:block;
        height:100%;
        width:0%;
        border-radius:inherit;
        background:linear-gradient(90deg,#7ed957,#ffd966,#ff9d3f);
        transition:width .18s ease;
      }

      .v99-summary{
        margin-top:12px;
        border-radius:24px;
        padding:13px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .v99-summary h3{
        margin:0;
        font-size:17px;
        line-height:1.12;
        font-weight:1000;
        color:#244e68;
      }

      .v99-summary p{
        margin:7px 0 0;
        color:#7193a8;
        font-size:13px;
        line-height:1.35;
        font-weight:850;
      }

      .v99-badge-list{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        margin-top:10px;
        justify-content:center;
      }

      .v99-badge{
        border-radius:999px;
        padding:7px 10px;
        background:linear-gradient(135deg,#fff8d5,#ffffff);
        border:2px solid #ffe480;
        color:#6b4c00;
        font-size:12px;
        font-weight:1000;
      }

      .v99-badge.locked{
        background:#f3f6f8;
        border-color:#d8e5ec;
        color:#8aa1af;
        filter:grayscale(.55);
      }

      @media (max-width:520px){
        .v99-mini-grid{
          grid-template-columns:1fr;
        }

        .v99-title{
          align-items:flex-start;
          flex-direction:column;
        }
      }
    `;

    DOC.head.appendChild(style);
  }

  function getDailyProgress(summary) {
    if (!summary || !state.daily) return 0;

    switch (state.daily.id) {
      case 'score':
        return Number(summary.score || 0);
      case 'combo':
        return Number(summary.bestCombo || 0);
      case 'accuracy':
        return Number(summary.accuracy || 0);
      case 'decoy':
        return Number(summary.decoyDodged || 0);
      case 'mission':
        return Number(summary.missionClear || 0);
      default:
        return 0;
    }
  }

  function isDailyComplete(summary) {
    return getDailyProgress(summary) >= Number(state.daily.target || 1);
  }

  function ensureIntroPanel() {
    const introCard = DOC.querySelector('.intro-card');
    if (!introCard || $('v99IntroPanel')) return;

    const best = state.best || {};
    const daily = state.daily || dailyChallenge();
    const dailyPct = clamp((Number(daily.bestProgress || 0) / Math.max(1, Number(daily.target))) * 100, 0, 100);

    const panel = DOC.createElement('div');
    panel.id = 'v99IntroPanel';
    panel.className = 'v99-panel';
    panel.innerHTML = `
      <div class="v99-title">
        <span>${daily.icon} Daily Challenge: ${daily.title}</span>
        <span class="v99-pill">${daily.completed ? 'สำเร็จแล้ว' : 'วันนี้'}</span>
      </div>
      <div class="v99-text">
        ${daily.desc}: เป้าหมาย ${daily.target}${daily.unit}
      </div>
      <div class="v99-progress"><i style="width:${dailyPct}%"></i></div>

      <div class="v99-mini-grid">
        <div class="v99-mini">
          <b>${best.score || 0}</b>
          <span>Best Score</span>
        </div>
        <div class="v99-mini">
          <b>${best.bestCombo || 0}</b>
          <span>Best Combo</span>
        </div>
        <div class="v99-mini">
          <b>${state.badges.length}</b>
          <span>Badges</span>
        </div>
      </div>
    `;

    const actions = introCard.querySelector('.actions');
    introCard.insertBefore(panel, actions);
  }

  function updateIntroPanel() {
    const panel = $('v99IntroPanel');
    if (!panel) return;

    const best = state.best || {};
    const daily = state.daily || dailyChallenge();
    const dailyPct = clamp((Number(daily.bestProgress || 0) / Math.max(1, Number(daily.target))) * 100, 0, 100);

    panel.innerHTML = `
      <div class="v99-title">
        <span>${daily.icon} Daily Challenge: ${daily.title}</span>
        <span class="v99-pill">${daily.completed ? 'สำเร็จแล้ว' : 'วันนี้'}</span>
      </div>
      <div class="v99-text">
        ${daily.desc}: เป้าหมาย ${daily.target}${daily.unit}
      </div>
      <div class="v99-progress"><i style="width:${dailyPct}%"></i></div>

      <div class="v99-mini-grid">
        <div class="v99-mini">
          <b>${best.score || 0}</b>
          <span>Best Score</span>
        </div>
        <div class="v99-mini">
          <b>${best.bestCombo || 0}</b>
          <span>Best Combo</span>
        </div>
        <div class="v99-mini">
          <b>${state.badges.length}</b>
          <span>Badges</span>
        </div>
      </div>
    `;
  }

  function getSummaryFromStorageOrEvent(detail) {
    if (detail && typeof detail === 'object') return detail;

    try {
      const raw = localStorage.getItem('HHA_GROUPS_MOBILE_SUMMARY');
      if (raw) return JSON.parse(raw);
    } catch (e) {}

    return null;
  }

  function mergeBadges(summary) {
    const set = new Set(state.badges || []);

    if (Array.isArray(summary.badges)) {
      summary.badges.forEach(b => {
        if (b) set.add(String(b));
      });
    }

    if (summary.rank) set.add(String(summary.rank));

    state.badges = Array.from(set).slice(0, 80);
    safeJsonSet(KEYS.badges, state.badges);
  }

  function updateBest(summary) {
    const old = state.best || {};

    const next = Object.assign({}, old);

    next.score = Math.max(Number(old.score || 0), Number(summary.score || 0));
    next.bestCombo = Math.max(Number(old.bestCombo || 0), Number(summary.bestCombo || 0));
    next.accuracy = Math.max(Number(old.accuracy || 0), Number(summary.accuracy || 0));
    next.correct = Math.max(Number(old.correct || 0), Number(summary.correct || 0));
    next.decoyDodged = Math.max(Number(old.decoyDodged || 0), Number(summary.decoyDodged || 0));
    next.missionClear = Math.max(Number(old.missionClear || 0), Number(summary.missionClear || 0));
    next.feverCount = Math.max(Number(old.feverCount || 0), Number(summary.feverCount || 0));
    next.rank = summary.rank || old.rank || 'Food Rookie';
    next.updatedAt = new Date().toISOString();

    state.best = next;
    safeJsonSet(KEYS.best, next);
  }

  function updateHistory(summary) {
    const row = {
      ts: summary.ts || new Date().toISOString(),
      score: Number(summary.score || 0),
      accuracy: Number(summary.accuracy || 0),
      bestCombo: Number(summary.bestCombo || 0),
      correct: Number(summary.correct || 0),
      miss: Number(summary.miss || 0),
      rank: summary.rank || 'Food Rookie'
    };

    state.history = [row].concat(state.history || []).slice(0, 10);
    safeJsonSet(KEYS.history, state.history);
  }

  function updateDaily(summary) {
    const progress = getDailyProgress(summary);
    state.daily.bestProgress = Math.max(Number(state.daily.bestProgress || 0), progress);

    if (isDailyComplete(summary)) {
      state.daily.completed = true;
    }

    safeJsonSet(state.daily.key, state.daily);
  }

  function nextGoal(summary) {
    const score = Number(summary.score || 0);
    const combo = Number(summary.bestCombo || 0);
    const accuracy = Number(summary.accuracy || 0);
    const decoy = Number(summary.decoyDodged || 0);
    const mission = Number(summary.missionClear || 0);

    if (accuracy < 70) {
      return 'รอบหน้าโฟกัสความแม่นยำให้ถึง 70% ก่อน';
    }

    if (combo < 8) {
      return 'รอบหน้าลองทำคอมโบ 8 ให้ได้';
    }

    if (decoy < 2) {
      return 'รอบหน้าลองหลบตัวหลอกให้ได้อย่างน้อย 2 ครั้ง';
    }

    if (mission < 2) {
      return 'รอบหน้าลองทำ Mission Clear ให้ได้ 2 ภารกิจ';
    }

    if (score < 500) {
      return 'รอบหน้าลองทำคะแนนให้ทะลุ 500';
    }

    return 'รอบหน้าลองเล่นระดับ Hard หรือ Challenge เพื่อปลดล็อกสถิติใหม่';
  }

  function renderSummary(summary) {
    const card = DOC.querySelector('.summary-card');
    if (!card || !summary) return;

    let box = $('v99Summary');
    if (!box) {
      box = DOC.createElement('div');
      box.id = 'v99Summary';
      box.className = 'v99-summary';

      const actions = card.querySelector('.actions');
      card.insertBefore(box, actions);
    }

    const best = state.best || {};
    const daily = state.daily || {};
    const dailyProgress = getDailyProgress(summary);
    const dailyDone = Boolean(daily.completed);

    const unlocked = (summary.badges || []).slice(0, 5);
    const collection = state.badges.slice(0, 8);

    const badgeHtml = collection.length
      ? collection.map(b => `<span class="v99-badge">${escapeHtml(b)}</span>`).join('')
      : `<span class="v99-badge locked">ยังไม่มี Badge</span>`;

    const newBadgeText = unlocked.length
      ? `Badge รอบนี้: ${unlocked.join(' • ')}`
      : 'รอบนี้ยังไม่มี Badge ใหม่';

    box.innerHTML = `
      <h3>🚀 เป้าหมายรอบต่อไป</h3>
      <p>${escapeHtml(nextGoal(summary))}</p>

      <div class="v99-mini-grid">
        <div class="v99-mini">
          <b>${best.score || 0}</b>
          <span>Best Score</span>
        </div>
        <div class="v99-mini">
          <b>${best.bestCombo || 0}</b>
          <span>Best Combo</span>
        </div>
        <div class="v99-mini">
          <b>${state.badges.length}</b>
          <span>Badge Collection</span>
        </div>
      </div>

      <p>
        ${daily.icon || '⭐'} Daily Challenge:
        ${dailyDone ? 'สำเร็จแล้ว!' : `ทำได้ ${dailyProgress}/${daily.target || 1}${daily.unit || ''}`}
        <br>${escapeHtml(newBadgeText)}
      </p>

      <div class="v99-badge-list">
        ${badgeHtml}
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function handleEnd(detail) {
    setTimeout(() => {
      const summary = getSummaryFromStorageOrEvent(detail);
      if (!summary) return;

      state.lastSummary = summary;

      updateBest(summary);
      mergeBadges(summary);
      updateHistory(summary);
      updateDaily(summary);
      renderSummary(summary);
      updateIntroPanel();

      try {
        const enriched = Object.assign({}, summary, {
          replayMotivation: {
            version: VERSION,
            best: state.best,
            daily: state.daily,
            badgeCount: state.badges.length,
            nextGoal: nextGoal(summary)
          }
        });

        localStorage.setItem('HHA_GROUPS_MOBILE_SUMMARY', JSON.stringify(enriched));
      } catch (e) {}
    }, 250);
  }

  function installEvents() {
    WIN.addEventListener('groups:end', ev => {
      handleEnd(ev.detail || null);
    });

    WIN.addEventListener('hha:summary-enriched', ev => {
      handleEnd(ev.detail || null);
    });

    DOC.addEventListener('visibilitychange', () => {
      if (!DOC.hidden) {
        loadState();
        updateIntroPanel();
      }
    });
  }

  function expose() {
    WIN.HHA_GROUPS_MOBILE_V99_REPLAY = {
      version: VERSION,
      getState: function () {
        return {
          version: VERSION,
          daily: state.daily,
          best: state.best,
          badges: state.badges.slice(),
          history: state.history.slice()
        };
      },
      reset: function () {
        try {
          localStorage.removeItem(KEYS.best);
          localStorage.removeItem(KEYS.badges);
          localStorage.removeItem(KEYS.history);
          localStorage.removeItem(state.daily.key);
        } catch (e) {}

        loadState();
        updateIntroPanel();
      }
    };
  }

  function init() {
    injectStyle();
    loadState();
    ensureIntroPanel();
    installEvents();
    expose();

    console.info('[Groups Mobile v9.9] replay motivation installed', VERSION);
  }

  if (DOC.readyState === 'loading') {
    DOC.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
