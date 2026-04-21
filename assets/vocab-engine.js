import { VOCAB_BANKS } from './vocab-data.js';
import { installVocabGuards } from './vocab-guard.js';

(() => {
  installVocabGuards({ engineName: 'vocab-engine.js' });

  if (typeof window.__VOCAB_STARTED__ === 'undefined') {
    window.__VOCAB_STARTED__ = false;
  }

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const els = {
    menu: document.getElementById('menu'),
    endWrap: document.getElementById('endWrap'),
    leaderboardWrap: document.getElementById('leaderboardWrap'),
    teacherWrap: document.getElementById('teacherWrap'),
    teacherLinkWrap: document.getElementById('teacherLinkWrap'),
    teacherPassInput: document.getElementById('teacherPassInput'),
    teacherLinkOutput: document.getElementById('teacherLinkOutput'),
    questionBox: document.getElementById('questionBox'),
    feedbackBox: document.getElementById('feedbackBox'),
    choicePad: document.getElementById('choicePad'),
    hudPrompt: document.getElementById('hudPrompt'),
    hudScore: document.getElementById('hudScore'),
    hudRound: document.getElementById('hudRound'),
    hudCombo: document.getElementById('hudCombo'),
    hudMode: document.getElementById('hudMode'),
    hudHp: document.getElementById('hudHp'),
    hudState: document.getElementById('hudState'),
    timeFill: document.getElementById('timeFill'),
    displayNameInput: document.getElementById('displayNameInput'),
    studentIdInput: document.getElementById('studentIdInput'),
    sectionInput: document.getElementById('sectionInput'),
    sessionCodeInput: document.getElementById('sessionCodeInput'),
    menuTop3Board: document.getElementById('menuTop3Board'),
    leaderboardList: document.getElementById('leaderboardList'),
    teacherTable: document.getElementById('teacherTable'),
    weakList: document.getElementById('weakList'),
    endSummaryText: document.getElementById('endSummaryText')
  };

  const TEACHER_KEY = 'VOCAB_V9_TEACHER_LAST';
  const PROFILE_KEY = 'VOCAB_V9_PROFILE';
  const SESSION_KEY = 'VOCAB_V9_SESSIONS';
  const TEACHER_PASS_KEY = 'VOCAB_V9_TEACHER_PASS_HASH';
  const GLOBAL_LB_CACHE_KEY = 'VOCAB_V9_GLOBAL_LB_CACHE';

  const VOCAB_SHEET_URL = 'https://script.google.com/macros/s/AKfycbzVz1FXvojv8t2DyGE4W7ViCeF9XX42-YDmi3-Xtek6XnrgLRHrKGGE5Mtx4UgQ3vmS/exec';
  const VOCAB_SHEET_SOURCE = 'vocab.html';
  const VOCAB_SHEET_SCHEMA = 'vocab-v4-per-mode';

  const V9 = {
    bank: 'A',
    mode: 'code_battle',
    score: 0,
    combo: 0,
    hp: 5,
    bossHp: 320,
    bossMaxHp: 320,
    bossPhase: 1,
    bossAttackAt: 0,
    runDifficulty: 'easy',
    currentItem: null,
    usedVariantIds: new Set(),
    usedTermIds: [],
    reviewQueue: [],
    mastery: {},
    wordSkill: {},
    recentWords: [],
    recentQuestionTypes: [],
    bugEscaped: 0,
    bugFixed: 0,
    maxBugEscaped: 5,
    modelScore: 0,
    modelTarget: 100,
    modelStability: 100,
    speedRunTimeLeft: 60,
    multiplier: 1,
    stageIndex: 0,
    maxStages: 18,
    countdown: 3,
    _qStartTime: 0
  };

  let width = 0;
  let height = 0;
  let dpr = 1;
  let mouseX = 0;
  let mouseY = 0;
  let hoveredId = null;
  let targets = [];
  let phase = 'idle';
  let phaseUntil = 0;
  let roundStart = 0;
  let roundDuration = 6000;
  let timeLeft = 1;
  let profile = { displayName: 'Player', studentId: '' };
  let lastSummary = null;
  let leaderboardOpenedFromEnd = false;
  let currentSessionId = null;
  let sessionStartedAt = null;
  let globalLeaderboardRows = loadLeaderboardCache();

  function bangkokIsoNow() {
    try {
      const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).formatToParts(new Date());
      const map = {};
      for (const p of parts) {
        if (p.type !== 'literal') map[p.type] = p.value;
      }
      return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+07:00`;
    } catch (_) {
      return new Date().toISOString();
    }
  }

  function fireAndForget(promise, label = 'async') {
    Promise.resolve(promise).catch(err => {
      console.warn(label + ' failed:', err);
    });
  }

  function setText(el, value) {
    if (el) el.textContent = value;
  }

  function now() {
    return performance.now();
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function weightedPick(items, weightGetter) {
    const expanded = [];
    items.forEach(item => {
      const w = Math.max(0, Number(weightGetter(item) || 0));
      for (let i = 0; i < w; i += 1) expanded.push(item);
    });
    if (!expanded.length) {
      return items[Math.floor(Math.random() * items.length)] || null;
    }
    return expanded[Math.floor(Math.random() * expanded.length)] || null;
  }

  function center() {
    return { x: width * 0.5, y: height * 0.60 };
  }

  function isMobileChoiceMode() {
    return width < 860;
  }

  function clearChoicePad() {
    if (!els.choicePad) return;
    els.choicePad.innerHTML = '';
    els.choicePad.classList.add('hidden');
  }

  function renderChoicePad(item) {
    if (!els.choicePad) return;

    if (!isMobileChoiceMode() || !item || !Array.isArray(item.choices) || !item.choices.length) {
      clearChoicePad();
      return;
    }

    els.choicePad.innerHTML = '';

    item.choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choiceBtn';
      btn.textContent = String(choice).toUpperCase();
      btn.addEventListener('click', () => {
        handleAnswerV9(String(choice).toLowerCase());
      });
      els.choicePad.appendChild(btn);
    });

    els.choicePad.classList.remove('hidden');
  }

  function postSheetAction(action, payload, timeoutMs = 2500) {
    const envelope = {
      source: VOCAB_SHEET_SOURCE,
      schema: VOCAB_SHEET_SCHEMA,
      action,
      timestamp: bangkokIsoNow(),
      payload
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    return fetch(VOCAB_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(envelope),
      keepalive: true,
      signal: controller.signal
    })
      .then(async res => {
        clearTimeout(timer);
        let data = null;
        try {
          data = await res.json();
        } catch (_) {}
        return { ok: res.ok, status: res.status, data };
      })
      .catch(err => {
        clearTimeout(timer);
        throw err;
      });
  }

  function compactMastery() {
    return Object.fromEntries(
      Object.entries(V9.mastery || {}).map(([k, v]) => [k, {
        level: v.level || 'easy',
        highestLevel: v.highestLevel || 'easy',
        seen: Number(v.seen || 0),
        correct: Number(v.correct || 0),
        wrong: Number(v.wrong || 0)
      }])
    );
  }

  function weakestTermsForSheet(limit = 5) {
    return Object.entries(V9.mastery || {})
      .map(([termId, m]) => ({
        termId,
        seen: Number(m.seen || 0),
        correct: Number(m.correct || 0),
        wrong: Number(m.wrong || 0),
        level: m.level || 'easy',
        highestLevel: m.highestLevel || 'easy',
        accuracy: m.seen ? Number((((m.correct || 0) * 100) / m.seen).toFixed(2)) : 0
      }))
      .filter(x => x.seen > 0)
      .sort((a, b) => (b.wrong - a.wrong) || (a.accuracy - b.accuracy))
      .slice(0, limit);
  }

  function buildAiRecommendation(accuracy) {
    const weak = weakestTermsForSheet(5);
    const wrongSum = weak.reduce((s, x) => s + Number(x.wrong || 0), 0);

    if (accuracy < 60 || wrongSum >= 6) {
      return {
        recommendedMode: 'debug_mission',
        recommendedDifficulty: 'easy',
        aiReason: 'ยังมีคำอ่อนหลายคำ ควรทบทวนแบบช้าชัดและซ่อม usage ก่อน'
      };
    }
    if (accuracy < 80) {
      return {
        recommendedMode: 'ai_training',
        recommendedDifficulty: 'normal',
        aiReason: 'เริ่มดีขึ้นแล้ว ควรฝึกบริบทการใช้งานจริงเพิ่ม'
      };
    }
    return {
      recommendedMode: 'code_battle',
      recommendedDifficulty: 'hard',
      aiReason: 'ทำได้ดีแล้ว เพิ่มความท้าทายได้'
    };
  }

  function readTrimmed(el) {
    return (el?.value || '').trim();
  }

  function getContextMeta() {
    const q = new URLSearchParams(location.search);
    const sectionDom = readTrimmed(els.sectionInput);
    const sessionCodeDom = readTrimmed(els.sessionCodeInput);

    return {
      timestamp: bangkokIsoNow(),
      session_id: currentSessionId || '',
      display_name: profile.displayName || 'Player',
      student_id: profile.studentId || '',
      section: sectionDom || q.get('section') || localStorage.getItem('VOCAB_SECTION') || '',
      session_code: sessionCodeDom || q.get('session_code') || q.get('sessionCode') || localStorage.getItem('VOCAB_SESSION_CODE') || '',
      bank: V9.bank || '',
      mode: V9.mode || ''
    };
  }

  function getAccuracyAndMistakes() {
    const rows = Object.values(V9.mastery || {});
    const totalSeen = rows.reduce((s, m) => s + Number(m.seen || 0), 0);
    const totalCorrect = rows.reduce((s, m) => s + Number(m.correct || 0), 0);
    const totalWrong = rows.reduce((s, m) => s + Number(m.wrong || 0), 0);
    return {
      total_seen: totalSeen,
      total_correct: totalCorrect,
      mistakes: totalWrong,
      accuracy: totalSeen ? Number(((totalCorrect / totalSeen) * 100).toFixed(2)) : 0
    };
  }

  function getWeakestTerm() {
    const first = Object.entries(V9.mastery || {})
      .sort((a, b) => (b[1].wrong - a[1].wrong) || (a[1].correct - b[1].correct))[0];
    return first ? first[0] : '';
  }
