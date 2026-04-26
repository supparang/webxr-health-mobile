// === /english/js/lesson-speaking-fix.js ===
// PATCH v20260424h-LESSON-SPEAKING-FIX-DATA-GUARD-VIEWMODE
// ✅ Speaking UI only when lesson-data says current S is speaking
// ✅ No scene-text skill guessing
// ✅ Supports PC / Mobile / Cardboard VR
// ✅ Uses LESSON_DATA_GUARD first, then router/item fallback
// ✅ Emits lesson:speaking-result + lesson:mission-pass
// ✅ Calls LESSON_ROUTER.reportResult() for AI difficulty

(function () {
  'use strict';

  const PATCH = 'v20260424h-LESSON-SPEAKING-FIX-DATA-GUARD-VIEWMODE';

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  const FALLBACK_SPEAKING_TARGETS = {
    S1: {
      title: 'Introduction',
      target: 'My name is Anna and I am a student.',
      tip: 'พูดแนะนำตัวเองให้ชัดเจน'
    },
    S7: {
      title: 'Explaining a System',
      target: 'This system helps users find information faster.',
      tip: 'พูดอธิบายระบบแบบง่าย'
    },
    S13: {
      title: 'Job Interview',
      target: 'I am interested in this job because I like technology.',
      tip: 'พูดตอบสัมภาษณ์งาน'
    },
    S14: {
      title: 'Project Pitch',
      target: 'Our project solves a real problem for students.',
      tip: 'พูดนำเสนอโครงงาน'
    }
  };

  let state = {
    sid: 'S1',
    title: 'Speaking',
    target: '',
    tip: 'กด Start Speaking แล้วพูดตามประโยค',
    prompt: 'Say the sentence clearly.',
    difficulty: 'normal',
    cefr: 'A2+',
    passScore: 72,
    heard: '',
    interim: '',
    score: 0,
    passed: false,
    listening: false,
    recognition: null,
    attempts: 0,
    active: false,
    skill: 'unknown',
    item: null
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function safeText(v) {
    return String(v == null ? '' : v).trim();
  }

  function getParams() {
    return new URLSearchParams(location.search || '');
  }

  function normalizeSid(v) {
    const raw = safeText(v || '').toUpperCase();

    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }

    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function detectSid() {
    const q = getParams();

    try {
      if (window.LESSON_CURRENT_STATE && window.LESSON_CURRENT_STATE.sid) {
        return normalizeSid(window.LESSON_CURRENT_STATE.sid);
      }
    } catch (err) {}

    try {
      if (window.LESSON_DATA_GUARD && window.LESSON_DATA_GUARD.currentSid) {
        return normalizeSid(window.LESSON_DATA_GUARD.currentSid());
      }
    } catch (err) {}

    return normalizeSid(
      q.get('s') ||
      q.get('sid') ||
      q.get('session') ||
      q.get('unit') ||
      q.get('lesson') ||
      q.get('lessonId') ||
      '1'
    );
  }

  function normalizeDifficulty(v) {
    const raw = safeText(v || '').toLowerCase();

    if (['easy', 'e', 'a2'].includes(raw)) return 'easy';
    if (['normal', 'medium', 'n', 'a2+'].includes(raw)) return 'normal';
    if (['hard', 'h', 'b1'].includes(raw)) return 'hard';
    if (['expert', 'challenge', 'x', 'b1+'].includes(raw)) return 'expert';

    return 'normal';
  }

  function normalizeSkill(v) {
    const raw = safeText(v || '').toLowerCase();

    if (['speaking', 'speak', 'voice', 'pronunciation', 'พูด'].includes(raw)) return 'speaking';
    if (['listening', 'listen', 'audio', 'hearing', 'ฟัง'].includes(raw)) return 'listening';
    if (['reading', 'read', 'อ่าน'].includes(raw)) return 'reading';
    if (['writing', 'write', 'typing', 'type', 'เขียน'].includes(raw)) return 'writing';
    if (['boss', 'challenge', 'bossstage', 'boss-stage'].includes(raw)) return 'boss';
    if (['finalboss', 'final-boss', 'final_boss', 'capstone'].includes(raw)) return 'finalBoss';

    return '';
  }

  function getViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    try {
      const ds = document.documentElement.dataset.lessonViewMode;
      if (ds) return ds;
    } catch (err) {}

    const q = getParams();
    const view = safeText(q.get('view') || q.get('display') || q.get('device') || '').toLowerCase();

    if (['vr', 'cvr', 'cardboard', 'cardboard-vr', 'viewer', 'headset'].includes(view)) return 'cardboard';
    if (['mobile', 'phone', 'touch'].includes(view)) return 'mobile';
    return 'pc';
  }

  function isCardboardMode() {
    return getViewMode() === 'cardboard';
  }

  function getDifficultyMeta(diff) {
    try {
      const levels =
        window.LESSON_DIFFICULTY_LEVELS ||
        window.LESSON_ROUTER?.levels ||
        null;

      if (levels && levels[diff]) return levels[diff];
    } catch (err) {}

    const fallback = {
      easy: { cefr: 'A2', passScore: 65 },
      normal: { cefr: 'A2+', passScore: 72 },
      hard: { cefr: 'B1', passScore: 78 },
      expert: { cefr: 'B1+', passScore: 84 }
    };

    return fallback[diff] || fallback.normal;
  }

  function detectCurrentSkill() {
    // 1) ใช้ lesson-data guard เป็นหลักเท่านั้น
    try {
      if (window.LESSON_DATA_GUARD && window.LESSON_DATA_GUARD.getDataSkill) {
        const s = normalizeSkill(window.LESSON_DATA_GUARD.getDataSkill());
        if (s) return s;
      }
    } catch (err) {}

    // 2) ใช้ dataset ที่ guard/router ตั้งไว้
    try {
      const ds = normalizeSkill(document.documentElement.dataset.lessonSkill);
      if (ds) return ds;
    } catch (err) {}

    // 3) ใช้ current item เฉพาะเมื่อ item ระบุ skill ชัดเจน
    try {
      const item = window.LESSON_CURRENT_ITEM;
      const s = normalizeSkill(item?.skill || item?.type || item?.activityType || item?.missionType);
      if (s) return s;
    } catch (err) {}

    // 4) ใช้ router fallback
    try {
      if (window.LESSON_ROUTER && window.LESSON_ROUTER.getCurrentSkill) {
        const s = normalizeSkill(window.LESSON_ROUTER.getCurrentSkill());
        if (s) return s;
      }
    } catch (err) {}

    // สำคัญ: ห้าม scan ข้อความใน scene เพื่อเดาเป็น speaking
    return 'unknown';
  }

  function isSpeakingSession() {
    return detectCurrentSkill() === 'speaking';
  }

  function findSessionFromData(sid) {
    sid = normalizeSid(sid);

    try {
      if (window.LESSON_DATA_GUARD && window.LESSON_DATA_GUARD.findSessionFromData) {
        return window.LESSON_DATA_GUARD.findSessionFromData(sid);
      }
    } catch (err) {}

    const DATA =
      window.LESSON_DATA ||
      window.LESSON_SESSIONS ||
      window.lessonData ||
      window.sessions ||
      null;

    if (!DATA) return null;

    const n = parseInt(sid.replace('S', ''), 10) || 1;

    if (Array.isArray(DATA)) {
      return (
        DATA.find((x) => normalizeSid(x?.sid || x?.id || x?.session || x?.unit || x?.lessonNo) === sid) ||
        DATA[n - 1] ||
        null
      );
    }

    if (typeof DATA === 'object') {
      const direct =
        DATA[sid] ||
        DATA[sid.toLowerCase()] ||
        DATA[String(n)] ||
        DATA.sessions?.[sid] ||
        DATA.sessions?.[sid.toLowerCase()] ||
        DATA.sessions?.[String(n)] ||
        DATA.lessons?.[sid] ||
        DATA.lessons?.[sid.toLowerCase()] ||
        DATA.lessons?.[String(n)];

      if (direct) return direct;

      const arr =
        DATA.sessions ||
        DATA.lessons ||
        DATA.items ||
        DATA.data ||
        null;

      if (Array.isArray(arr)) {
        return (
          arr.find((x) => normalizeSid(x?.sid || x?.id || x?.session || x?.unit || x?.lessonNo) === sid) ||
          arr[n - 1] ||
          null
        );
      }
    }

    return null;
  }

  function collectCandidates(session) {
    const out = [];

    if (!session || typeof session !== 'object') return out;

    const directKeys = [
      'speaking',
      'speak',
      'task',
      'mission',
      'question',
      'prompt',
      'challenge',
      'currentItem'
    ];

    directKeys.forEach((key) => {
      const v = session[key];
      if (!v) return;

      if (Array.isArray(v)) out.push(...v);
      else if (typeof v === 'object') out.push(v);
      else if (typeof v === 'string') out.push({ prompt: v });
    });

    const arrayKeys = [
      'items',
      'questions',
      'missions',
      'tasks',
      'challenges',
      'activities',
      'stages',
      'variants'
    ];

    arrayKeys.forEach((key) => {
      if (Array.isArray(session[key])) out.push(...session[key]);
    });

    const bankContainers = [
      session.banks,
      session.levels,
      session.difficulties,
      session.questionBanks,
      session.itemsByDifficulty
    ].filter(Boolean);

    bankContainers.forEach((banks) => {
      if (!banks || typeof banks !== 'object') return;

      ['easy', 'normal', 'hard', 'expert'].forEach((diff) => {
        if (Array.isArray(banks[diff])) out.push(...banks[diff]);
      });
    });

    return out.filter(Boolean);
  }

  function extractSayTarget(text) {
    const s = safeText(text);
    if (!s) return '';

    const patterns = [
      /Say\s*:\s*["“]([^"”]+)["”]/i,
      /Speak\s*:\s*["“]([^"”]+)["”]/i,
      /Repeat\s*:\s*["“]([^"”]+)["”]/i,
      /พูด\s*:\s*["“]([^"”]+)["”]/i
    ];

    for (const p of patterns) {
      const m = s.match(p);
      if (m && m[1]) return m[1].trim();
    }

    const quote = s.match(/["“]([^"”]{6,240})["”]/);
    if (quote && quote[1]) return quote[1].trim();

    return '';
  }

  function getItemTextValue(item) {
    if (!item) return '';

    return safeText(
      item.target ||
      item.sentence ||
      item.text ||
      item.say ||
      item.repeat ||
      item.answer ||
      item.modelAnswer ||
      item.expectedAnswer ||
      item.prompt ||
      item.question ||
      item.challenge ||
      ''
    );
  }

  function pickSpeakingItemFromData(sid, difficulty) {
    const session = findSessionFromData(sid);
    const candidates = collectCandidates(session);

    if (!candidates.length) return null;

    const diff = normalizeDifficulty(difficulty);

    const speakingCandidates = candidates.filter((item) => {
      const skill = normalizeSkill(
        item?.skill ||
        item?.type ||
        item?.activityType ||
        item?.missionType ||
        session?.skill ||
        session?.primarySkill ||
        session?.mainSkill
      );

      return skill === 'speaking' || (!skill && getItemTextValue(item));
    });

    const sameDiff = speakingCandidates.filter((item) => {
      const d = normalizeDifficulty(item?.difficulty || item?.diff || item?.level || '');
      return d === diff;
    });

    return sameDiff[0] || speakingCandidates[0] || null;
  }

  function getCurrentSpeakingItem() {
    const sid = detectSid();
    const q = getParams();

    const currentState = window.LESSON_CURRENT_STATE || {};
    const urlDiff = q.get('diff') || q.get('difficulty') || q.get('level') || '';

    const difficulty = normalizeDifficulty(
      urlDiff ||
      currentState.difficulty ||
      window.LESSON_CURRENT_ITEM?.difficulty ||
      'normal'
    );

    // 1) ใช้ item จาก data ก่อน
    const fromData = pickSpeakingItemFromData(sid, difficulty);
    if (fromData) {
      return normalizeSpeakingItem(fromData, sid, difficulty, 'lesson-data');
    }

    // 2) ใช้ current item จาก router เฉพาะถ้า skill เป็น speaking
    try {
      const item = window.LESSON_CURRENT_ITEM;
      const itemSkill = normalizeSkill(item?.skill || item?.type || item?.activityType || item?.missionType);

      if (item && itemSkill === 'speaking') {
        return normalizeSpeakingItem(item, sid, difficulty, 'router-current-item');
      }
    } catch (err) {}

    // 3) fallback เฉพาะ S ที่เป็น speaking จริง ๆ
    const fb = FALLBACK_SPEAKING_TARGETS[sid];
    if (fb) {
      return normalizeSpeakingItem(
        {
          sid,
          title: fb.title,
          target: fb.target,
          prompt: 'Say the sentence clearly.',
          tip: fb.tip,
          difficulty
        },
        sid,
        difficulty,
        'speaking-fallback'
      );
    }

    return null;
  }

  function normalizeSpeakingItem(item, sid, difficulty, source) {
    const diff = normalizeDifficulty(
      item?.difficulty ||
      item?.diff ||
      item?.level ||
      difficulty ||
      'normal'
    );

    const meta = getDifficultyMeta(diff);

    let target = safeText(
      item?.target ||
      item?.sentence ||
      item?.text ||
      item?.say ||
      item?.repeat ||
      item?.expectedAnswer ||
      ''
    );

    const prompt = safeText(
      item?.prompt ||
      item?.question ||
      item?.challenge ||
      item?.instruction ||
      'Say the sentence clearly.'
    );

    if (!target) target = extractSayTarget(prompt);

    if (!target) target = safeText(item?.modelAnswer || item?.answer || '');

    return {
      id: safeText(item?.id || `${sid}-SP-${diff}`),
      sid,
      title: safeText(item?.title || item?.routeTitle || item?.lessonTitle || 'Speaking'),
      prompt,
      target,
      tip: safeText(item?.tip || item?.hint || item?.description || 'พูดช้า ๆ ชัด ๆ แล้วรอระบบตรวจคำตอบ'),
      difficulty: diff,
      cefr: safeText(item?.cefr || meta.cefr || 'A2+'),
      passScore: Number(item?.passScore || meta.passScore || 72),
      points: Number(item?.points || 10),
      source,
      raw: item
    };
  }

  function refreshTask() {
    state.sid = detectSid();
    state.skill = detectCurrentSkill();
    state.active = state.skill === 'speaking';

    if (!state.active) {
      removeSpeakingPanelIfNotNeeded();
      return null;
    }

    const item = getCurrentSpeakingItem();

    if (!item || !item.target) {
      removeSpeakingPanelIfNotNeeded();
      console.warn('[LessonSpeakingFix] speaking session but no target found', {
        sid: state.sid,
        skill: state.skill
      });
      return null;
    }

    state.item = item;
    state.title = item.title;
    state.target = item.target;
    state.tip = item.tip;
    state.prompt = item.prompt;
    state.difficulty = item.difficulty;
    state.cefr = item.cefr;
    state.passScore = item.passScore;

    ensureActiveUI();
    updateUI();
    updateVrBoard();

    return item;
  }

  function normalizeSpeech(s) {
    return safeText(s)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function wordsOf(s) {
    const n = normalizeSpeech(s);
    return n ? n.split(' ').filter(Boolean) : [];
  }

  function lcsRatio(aWords, bWords) {
    const a = aWords;
    const b = bWords;

    const dp = Array.from({ length: a.length + 1 }, () =>
      Array(b.length + 1).fill(0)
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1] + 1
            : Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }

    return a.length ? dp[a.length][b.length] / a.length : 0;
  }

  function levenshtein(a, b) {
    a = normalizeSpeech(a);
    b = normalizeSpeech(b);

    const m = a.length;
    const n = b.length;
    const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;

        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }

    return dp[m][n];
  }

  function scoreSpeech(target, heard) {
    const targetWords = wordsOf(target);
    const heardWords = wordsOf(heard);

    if (!targetWords.length || !heardWords.length) {
      return {
        score: 0,
        coverage: 0,
        sequence: 0,
        charScore: 0,
        missing: targetWords
      };
    }

    const heardSet = new Set(heardWords);
    const matched = targetWords.filter((w) => heardSet.has(w)).length;
    const coverage = matched / targetWords.length;
    const sequence = lcsRatio(targetWords, heardWords);

    const maxLen = Math.max(
      normalizeSpeech(target).length,
      normalizeSpeech(heard).length,
      1
    );

    const charScore = Math.max(0, 1 - levenshtein(target, heard) / maxLen);

    const score = Math.round(
      Math.max(0, Math.min(1, coverage * 0.45 + sequence * 0.35 + charScore * 0.2)) * 100
    );

    const missing = targetWords.filter((w) => !heardSet.has(w));

    return { score, coverage, sequence, charScore, missing };
  }

  function analyzeHeard() {
    const result = scoreSpeech(state.target, state.heard);

    state.score = result.score;
    state.passed = result.score >= Number(state.passScore || 72);

    saveResult(result);
    reportToRouter(result);
    emitResult(result);
    updateUI();
    updateVrBoard();

    return result;
  }

  function saveResult(result) {
    try {
      const payload = {
        version: PATCH,
        at: new Date().toISOString(),
        sid: state.sid,
        title: state.title,
        skill: 'speaking',
        itemId: state.item?.id || '',
        difficulty: state.difficulty,
        cefr: state.cefr,
        passScore: state.passScore,
        target: state.target,
        heard: state.heard,
        score: state.score,
        passed: state.passed,
        attempts: state.attempts,
        missing: result.missing || []
      };

      localStorage.setItem('ENGLISH_LESSON_LAST_SPEAKING', JSON.stringify(payload));

      const key = 'ENGLISH_LESSON_SPEAKING_HISTORY';
      const old = JSON.parse(localStorage.getItem(key) || '[]');
      old.unshift(payload);
      localStorage.setItem(key, JSON.stringify(old.slice(0, 50)));
    } catch (err) {
      console.warn('[LessonSpeakingFix] save skipped', err);
    }
  }

  function reportToRouter(result) {
    try {
      if (!window.LESSON_ROUTER || !window.LESSON_ROUTER.reportResult) return;

      window.LESSON_ROUTER.reportResult({
        sid: state.sid,
        skill: 'speaking',
        itemId: state.item?.id || '',
        difficulty: state.difficulty,
        cefr: state.cefr,
        score: state.score,
        passScore: state.passScore,
        passed: state.passed,
        accuracy: state.score,
        missing: result.missing || []
      });
    } catch (err) {
      console.warn('[LessonSpeakingFix] router report skipped', err);
    }
  }

  function emitResult(result) {
    const detail = {
      version: PATCH,
      sid: state.sid,
      skill: 'speaking',
      title: state.title,
      itemId: state.item?.id || '',
      difficulty: state.difficulty,
      cefr: state.cefr,
      target: state.target,
      heard: state.heard,
      score: state.score,
      passScore: state.passScore,
      passed: state.passed,
      attempts: state.attempts,
      missing: result.missing || []
    };

    window.dispatchEvent(new CustomEvent('lesson:speaking-result', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:speaking-result', { detail }));

    if (state.passed) {
      window.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
      document.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
    }
  }

  function speakExample() {
    if (!state.active) return;

    try {
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(state.target);
      utter.lang = 'en-US';
      utter.rate = 0.82;
      utter.pitch = 1.02;
      utter.volume = 1;

      window.speechSynthesis.speak(utter);
      setStatus('กำลังเล่นเสียงตัวอย่าง ฟังแล้วพูดตามได้เลย', 'info');
    } catch (err) {
      setStatus('เครื่องนี้เล่นเสียงตัวอย่างไม่ได้ แต่ยังอ่านแล้วพูดตามได้', 'warn');
    }
  }

  function startSpeaking() {
    const item = refreshTask();
    if (!item) return;

    if (!SpeechRecognition) {
      setStatus('Browser นี้ยังไม่รองรับ Speech Recognition ให้พิมพ์คำตอบแทนในช่อง Heard', 'warn');

      const input = $('#lessonSpeakingManualInput');
      if (input) {
        input.style.display = 'block';
        input.focus();
      }

      return;
    }

    stopSpeaking(false);

    state.heard = '';
    state.interim = '';
    state.listening = true;
    state.passed = false;
    state.score = 0;
    state.attempts += 1;

    const rec = new SpeechRecognition();
    state.recognition = rec;

    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = function () {
      state.listening = true;
      setStatus('กำลังฟังอยู่... พูดประโยคบนจอเป็นภาษาอังกฤษ', 'listen');
      updateUI();
      updateVrBoard();
    };

    rec.onresult = function (event) {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0]?.transcript || '';

        if (event.results[i].isFinal) {
          finalText += text + ' ';
        } else {
          interimText += text + ' ';
        }
      }

      if (finalText.trim()) state.heard += finalText.trim() + ' ';
      state.interim = interimText.trim();

      updateUI();
      updateVrBoard();
    };

    rec.onerror = function (event) {
      state.listening = false;

      let msg = 'ยังฟังเสียงไม่ได้ ลองกด Start Speaking อีกครั้ง';

      if (event.error === 'not-allowed') {
        msg = 'ต้องอนุญาตการใช้ไมค์ก่อน จึงจะพูดตอบได้';
      } else if (event.error === 'no-speech') {
        msg = 'ยังไม่ได้ยินเสียง ลองพูดใกล้ไมค์และชัดขึ้น';
      } else if (event.error === 'audio-capture') {
        msg = 'ไม่พบไมค์หรือไมค์ใช้งานไม่ได้';
      }

      setStatus(msg, 'warn');
      updateUI();
      updateVrBoard();
    };

    rec.onend = function () {
      state.listening = false;

      const heardNow = safeText(`${state.heard} ${state.interim}`);
      state.heard = heardNow;
      state.interim = '';

      if (heardNow) {
        analyzeHeard();
      } else {
        setStatus('ยังไม่ได้ยินคำพูด ลองกด Start Speaking แล้วพูดใหม่', 'warn');
        updateUI();
        updateVrBoard();
      }
    };

    try {
      rec.start();
    } catch (err) {
      state.listening = false;
      setStatus('เริ่มฟังเสียงไม่ได้ ลองกดใหม่อีกครั้ง', 'warn');
      updateUI();
      updateVrBoard();
    }
  }

  function stopSpeaking(update = true) {
    try {
      if (state.recognition) {
        state.recognition.onend = null;
        state.recognition.stop();
      }
    } catch (err) {}

    state.recognition = null;
    state.listening = false;

    if (update) {
      setStatus('หยุดฟังแล้ว', 'info');
      updateUI();
      updateVrBoard();
    }
  }

  function resetAttempt() {
    stopSpeaking(false);

    state.heard = '';
    state.interim = '';
    state.score = 0;
    state.passed = false;

    setStatus('พร้อมแล้ว กด Start Speaking แล้วพูดตามประโยค', 'info');
    updateUI();
    updateVrBoard();
  }

  function manualCheck() {
    if (!state.active) return;

    const input = $('#lessonSpeakingManualInput');
    if (!input) return;

    state.heard = input.value.trim();
    state.interim = '';
    state.attempts += 1;

    analyzeHeard();
  }

  function setStatus(msg, type = 'info') {
    const el = $('#lessonSpeakingStatus');
    if (!el) return;

    el.textContent = msg;
    el.dataset.type = type;
  }

  function ensureCSS() {
    if ($('#lesson-speaking-fix-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-speaking-fix-css';
    style.textContent = `
      #lessonSpeakingPanel{
        position:fixed;
        left:12px;
        right:12px;
        bottom:max(12px, env(safe-area-inset-bottom));
        z-index:2147483647;
        max-width:980px;
        margin:0 auto;
        color:#0f172a;
        background:rgba(255,255,255,.96);
        border:2px solid rgba(56,189,248,.85);
        border-radius:22px;
        box-shadow:0 18px 60px rgba(0,0,0,.35);
        font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:auto;
        overflow:hidden;
      }

      #lessonSpeakingPanel *{
        box-sizing:border-box;
      }

      .lesson-speaking-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 12px;
        background:linear-gradient(90deg,#0ea5e9,#2563eb);
        color:#fff;
      }

      .lesson-speaking-title{
        font-weight:900;
        font-size:15px;
        line-height:1.25;
      }

      .lesson-speaking-mini{
        opacity:.92;
        font-size:12px;
        font-weight:700;
      }

      .lesson-speaking-toggle{
        border:0;
        border-radius:999px;
        padding:7px 10px;
        color:#0f172a;
        background:#fff;
        font-weight:900;
        cursor:pointer;
      }

      .lesson-speaking-body{
        padding:12px;
        display:grid;
        gap:10px;
      }

      #lessonSpeakingPanel.is-collapsed .lesson-speaking-body{
        display:none;
      }

      .lesson-speaking-target{
        padding:10px 12px;
        border-radius:16px;
        background:#eff6ff;
        border:1px solid #bfdbfe;
      }

      .lesson-speaking-target small{
        display:block;
        color:#2563eb;
        font-weight:900;
        margin-bottom:4px;
      }

      .lesson-speaking-sentence{
        font-size:18px;
        line-height:1.35;
        font-weight:900;
        color:#0f172a;
      }

      .lesson-speaking-tip{
        color:#475569;
        font-size:13px;
        margin-top:4px;
        font-weight:700;
      }

      .lesson-speaking-buttons{
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }

      .lesson-speaking-buttons button{
        border:0;
        border-radius:999px;
        padding:11px 13px;
        font-weight:900;
        cursor:pointer;
        box-shadow:0 8px 18px rgba(15,23,42,.12);
      }

      #lessonListenBtn{
        background:#dbeafe;
        color:#1d4ed8;
      }

      #lessonStartSpeakBtn{
        background:#22c55e;
        color:#052e16;
      }

      #lessonStopSpeakBtn{
        background:#fee2e2;
        color:#991b1b;
      }

      #lessonTryAgainBtn{
        background:#fef3c7;
        color:#92400e;
      }

      #lessonCheckManualBtn{
        background:#ede9fe;
        color:#5b21b6;
      }

      .lesson-speaking-heard{
        display:grid;
        gap:6px;
        grid-template-columns:1fr;
      }

      .lesson-speaking-heard label{
        font-size:12px;
        color:#475569;
        font-weight:900;
      }

      #lessonSpeakingHeardBox,
      #lessonSpeakingManualInput{
        width:100%;
        min-height:42px;
        padding:10px 12px;
        border-radius:14px;
        border:1px solid #cbd5e1;
        background:#f8fafc;
        color:#0f172a;
        font-size:15px;
        font-weight:800;
      }

      #lessonSpeakingManualInput{
        display:block;
      }

      .lesson-speaking-result{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:9px 10px;
        border-radius:16px;
        background:#f8fafc;
        border:1px solid #e2e8f0;
      }

      #lessonSpeakingScore{
        font-size:22px;
        font-weight:1000;
        color:#0f172a;
        white-space:nowrap;
      }

      #lessonSpeakingStatus{
        font-size:13px;
        font-weight:900;
        color:#475569;
      }

      #lessonSpeakingStatus[data-type="listen"]{
        color:#0284c7;
      }

      #lessonSpeakingStatus[data-type="warn"]{
        color:#b45309;
      }

      #lessonSpeakingStatus[data-type="pass"]{
        color:#15803d;
      }

      #lessonSpeakingStatus[data-type="fail"]{
        color:#b91c1c;
      }

      #lessonSpeakingPanel.is-pass{
        border-color:#22c55e;
      }

      #lessonSpeakingPanel.is-fail{
        border-color:#ef4444;
      }

      html.lesson-mode-pc #lessonSpeakingPanel{
        left:auto;
        right:20px;
        bottom:20px;
        width:min(560px, calc(100vw - 40px));
        max-width:560px;
      }

      html.lesson-mode-mobile #lessonSpeakingPanel{
        left:8px;
        right:8px;
        bottom:max(8px, env(safe-area-inset-bottom));
        width:auto;
        max-width:none;
        border-radius:18px;
      }

      html.lesson-mode-cardboard #lessonSpeakingPanel{
        display:none !important;
      }

      @media (max-width:640px){
        #lessonSpeakingPanel{
          left:8px;
          right:8px;
          bottom:max(8px, env(safe-area-inset-bottom));
          border-radius:18px;
        }

        .lesson-speaking-body{
          padding:10px;
          gap:8px;
        }

        .lesson-speaking-sentence{
          font-size:15px;
        }

        .lesson-speaking-buttons button{
          flex:1 1 calc(50% - 8px);
          padding:10px 8px;
          font-size:13px;
        }

        #lessonSpeakingScore{
          font-size:18px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePanel() {
    ensureCSS();

    let panel = $('#lessonSpeakingPanel');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'lessonSpeakingPanel';

    panel.innerHTML = `
      <div class="lesson-speaking-head">
        <div>
          <div class="lesson-speaking-title" id="lessonSpeakingTitle">🎤 Speaking Mission</div>
          <div class="lesson-speaking-mini">กด Start Speaking แล้วพูดตามประโยคภาษาอังกฤษ</div>
        </div>
        <button class="lesson-speaking-toggle" id="lessonSpeakingToggle" type="button">ย่อ</button>
      </div>

      <div class="lesson-speaking-body">
        <div class="lesson-speaking-target">
          <small id="lessonSpeakingLabel">Speaking</small>
          <div class="lesson-speaking-sentence" id="lessonSpeakingTarget">
            -
          </div>
          <div class="lesson-speaking-tip" id="lessonSpeakingTip">
            พูดช้า ๆ ชัด ๆ
          </div>
        </div>

        <div class="lesson-speaking-buttons">
          <button id="lessonListenBtn" type="button">🔊 Listen</button>
          <button id="lessonStartSpeakBtn" type="button">🎤 Start Speaking</button>
          <button id="lessonStopSpeakBtn" type="button">■ Stop</button>
          <button id="lessonTryAgainBtn" type="button">↻ Try Again</button>
        </div>

        <div class="lesson-speaking-heard">
          <label>Heard / ระบบได้ยินว่า</label>
          <div id="lessonSpeakingHeardBox">-</div>
          <input id="lessonSpeakingManualInput" type="text" placeholder="พิมพ์ประโยคที่พูด / ใช้ทดสอบกรณีไมค์ไม่ทำงาน" />
          <button id="lessonCheckManualBtn" type="button">✅ Check Manual Answer</button>
        </div>

        <div class="lesson-speaking-result">
          <div id="lessonSpeakingStatus" data-type="info">พร้อมแล้ว กด Start Speaking แล้วพูดตามประโยค</div>
          <div id="lessonSpeakingScore">0%</div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    $('#lessonListenBtn')?.addEventListener('click', speakExample);
    $('#lessonStartSpeakBtn')?.addEventListener('click', startSpeaking);
    $('#lessonStopSpeakBtn')?.addEventListener('click', () => stopSpeaking(true));
    $('#lessonTryAgainBtn')?.addEventListener('click', resetAttempt);
    $('#lessonCheckManualBtn')?.addEventListener('click', manualCheck);

    $('#lessonSpeakingToggle')?.addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
      const toggle = $('#lessonSpeakingToggle');
      if (toggle) {
        toggle.textContent = panel.classList.contains('is-collapsed') ? 'เปิด' : 'ย่อ';
      }
    });

    return panel;
  }

  function updateUI() {
    const panel = $('#lessonSpeakingPanel');
    if (!panel) return;

    $('#lessonSpeakingTitle').textContent = `🎤 Speaking Mission`;
    $('#lessonSpeakingLabel').textContent =
      `${state.sid} • ${state.title} • ${state.difficulty.toUpperCase()} • ${state.cefr}`;

    $('#lessonSpeakingTarget').textContent = `"${state.target}"`;
    $('#lessonSpeakingTip').textContent = state.tip || 'พูดช้า ๆ ชัด ๆ แล้วรอระบบตรวจคำตอบ';

    const heard = safeText(`${state.heard} ${state.interim}`);
    $('#lessonSpeakingHeardBox').textContent = heard || '-';
    $('#lessonSpeakingScore').textContent = `${state.score || 0}%`;

    panel.classList.remove('is-pass', 'is-fail');

    if (state.listening) {
      setStatus('กำลังฟังอยู่... พูดตามประโยคบนจอ', 'listen');
    } else if (state.score > 0) {
      if (state.passed) {
        panel.classList.add('is-pass');
        setStatus('✅ ผ่านด่านพูดแล้ว! ออกเสียงได้ดี', 'pass');
      } else {
        panel.classList.add('is-fail');
        setStatus(`ยังไม่ผ่าน ต้องได้อย่างน้อย ${state.passScore}% ลองพูดใหม่อีกครั้ง`, 'fail');
      }
    }
  }

  function ensureCameraCursor(scene) {
    let cam = $('[camera]', scene);

    if (!cam) {
      let rig = $('#lessonSpeakingRig', scene);

      if (!rig) {
        rig = document.createElement('a-entity');
        rig.id = 'lessonSpeakingRig';
        rig.setAttribute('position', '0 1.6 0');
        scene.appendChild(rig);
      }

      cam = document.createElement('a-entity');
      cam.id = 'lessonSpeakingCamera';
      cam.setAttribute('camera', 'active: true');
      cam.setAttribute('look-controls', 'pointerLockEnabled: false; magicWindowTrackingEnabled: true');
      cam.setAttribute('wasd-controls', 'enabled: false');
      rig.appendChild(cam);
    }

    if (!$('#lessonSpeakingCursor', cam)) {
      const cursor = document.createElement('a-entity');
      cursor.id = 'lessonSpeakingCursor';
      cursor.setAttribute('cursor', 'fuse: false; rayOrigin: mouse');
      cursor.setAttribute('raycaster', 'objects: .lesson-clickable');
      cursor.setAttribute('position', '0 0 -1');
      cursor.setAttribute('geometry', 'primitive: ring; radiusInner: 0.008; radiusOuter: 0.014');
      cursor.setAttribute('material', 'color: white; shader: flat; opacity: 0.85');
      cam.appendChild(cursor);
    }
  }

  function addVrLights(scene) {
    if (!$('#lessonSpeakingAmbient', scene)) {
      const amb = document.createElement('a-entity');
      amb.id = 'lessonSpeakingAmbient';
      amb.setAttribute('light', 'type:ambient; color:#ffffff; intensity:0.95');
      scene.appendChild(amb);
    }

    if (!$('#lessonSpeakingFrontLight', scene)) {
      const light = document.createElement('a-entity');
      light.id = 'lessonSpeakingFrontLight';
      light.setAttribute('position', '0 2.3 1.1');
      light.setAttribute('light', 'type:point; color:#ffffff; intensity:1.6; distance:7');
      scene.appendChild(light);
    }
  }

  function ensureVrBoard() {
    const scene = $('a-scene');
    if (!scene) return null;

    ensureCameraCursor(scene);
    addVrLights(scene);

    let board = $('#lessonSpeakingVrBoard', scene);
    if (board) return board;

    board = document.createElement('a-entity');
    board.id = 'lessonSpeakingVrBoard';
    board.setAttribute('position', '0 1.55 -2.35');

    const bg = document.createElement('a-plane');
    bg.id = 'lessonSpeakingVrBg';
    bg.setAttribute('width', '3.85');
    bg.setAttribute('height', '1.7');
    bg.setAttribute('material', 'color:#ffffff; opacity:0.96; transparent:true; shader:flat; side:double');
    bg.setAttribute('position', '0 0 0');
    board.appendChild(bg);

    const head = document.createElement('a-plane');
    head.setAttribute('width', '3.85');
    head.setAttribute('height', '0.35');
    head.setAttribute('position', '0 0.675 0.01');
    head.setAttribute('material', 'color:#2563eb; shader:flat');
    board.appendChild(head);

    const title = document.createElement('a-text');
    title.id = 'lessonSpeakingVrTitle';
    title.setAttribute('position', '-1.78 0.675 0.03');
    title.setAttribute('align', 'left');
    title.setAttribute('anchor', 'left');
    title.setAttribute('baseline', 'center');
    title.setAttribute('color', '#ffffff');
    title.setAttribute('width', '3.45');
    title.setAttribute('wrap-count', '38');
    title.setAttribute('value', 'Speaking Mission');
    board.appendChild(title);

    const target = document.createElement('a-text');
    target.id = 'lessonSpeakingVrTarget';
    target.setAttribute('position', '-1.78 0.33 0.03');
    target.setAttribute('align', 'left');
    target.setAttribute('anchor', 'left');
    target.setAttribute('baseline', 'top');
    target.setAttribute('color', '#0f172a');
    target.setAttribute('width', '3.45');
    target.setAttribute('wrap-count', '36');
    target.setAttribute('value', '');
    board.appendChild(target);

    const heard = document.createElement('a-text');
    heard.id = 'lessonSpeakingVrHeard';
    heard.setAttribute('position', '-1.78 -0.28 0.03');
    heard.setAttribute('align', 'left');
    heard.setAttribute('anchor', 'left');
    heard.setAttribute('baseline', 'top');
    heard.setAttribute('color', '#334155');
    heard.setAttribute('width', '3.45');
    heard.setAttribute('wrap-count', '38');
    heard.setAttribute('value', 'กดปุ่ม START หรือแตะหน้าจอเพื่อพูด');
    board.appendChild(heard);

    const btn = document.createElement('a-plane');
    btn.id = 'lessonSpeakingVrStartBtn';
    btn.classList.add('lesson-clickable');
    btn.setAttribute('width', '1.45');
    btn.setAttribute('height', '0.28');
    btn.setAttribute('position', '-0.75 -0.67 0.04');
    btn.setAttribute('material', 'color:#22c55e; shader:flat');
    btn.addEventListener('click', startSpeaking);
    board.appendChild(btn);

    const btnText = document.createElement('a-text');
    btnText.setAttribute('position', '-1.30 -0.67 0.07');
    btnText.setAttribute('align', 'left');
    btnText.setAttribute('anchor', 'left');
    btnText.setAttribute('baseline', 'center');
    btnText.setAttribute('color', '#052e16');
    btnText.setAttribute('width', '1.2');
    btnText.setAttribute('value', '🎤 START');
    board.appendChild(btnText);

    const listenBtn = document.createElement('a-plane');
    listenBtn.id = 'lessonSpeakingVrListenBtn';
    listenBtn.classList.add('lesson-clickable');
    listenBtn.setAttribute('width', '1.25');
    listenBtn.setAttribute('height', '0.28');
    listenBtn.setAttribute('position', '0.88 -0.67 0.04');
    listenBtn.setAttribute('material', 'color:#dbeafe; shader:flat');
    listenBtn.addEventListener('click', speakExample);
    board.appendChild(listenBtn);

    const listenText = document.createElement('a-text');
    listenText.setAttribute('position', '0.40 -0.67 0.07');
    listenText.setAttribute('align', 'left');
    listenText.setAttribute('anchor', 'left');
    listenText.setAttribute('baseline', 'center');
    listenText.setAttribute('color', '#1d4ed8');
    listenText.setAttribute('width', '1.1');
    listenText.setAttribute('value', '🔊 LISTEN');
    board.appendChild(listenText);

    scene.appendChild(board);

    return board;
  }

  function updateVrBoard() {
    const board = ensureVrBoard();
    if (!board) return;

    const title = $('#lessonSpeakingVrTitle', board);
    const target = $('#lessonSpeakingVrTarget', board);
    const heard = $('#lessonSpeakingVrHeard', board);
    const btn = $('#lessonSpeakingVrStartBtn', board);

    if (title) {
      title.setAttribute(
        'value',
        `${state.sid} • Speaking • ${state.difficulty.toUpperCase()} • ${state.cefr}`
      );
    }

    if (target) {
      target.setAttribute('value', `Say clearly:\n"${state.target}"`);
    }

    let heardText = 'กด START แล้วพูดตามประโยค';

    if (state.listening) {
      heardText = 'Listening... พูดตอนนี้ได้เลย';
    } else if (safeText(`${state.heard} ${state.interim}`)) {
      heardText = `Heard: ${safeText(`${state.heard} ${state.interim}`)}\nScore: ${state.score}% ${
        state.passed ? '✅ PASS' : `ต้องได้ ${state.passScore}%`
      }`;
    }

    if (heard) heard.setAttribute('value', heardText);

    if (btn) {
      btn.setAttribute(
        'material',
        state.listening
          ? 'color:#f59e0b; shader:flat'
          : state.passed
            ? 'color:#22c55e; shader:flat'
            : 'color:#22c55e; shader:flat'
      );
    }
  }

  function ensureActiveUI() {
    if (!state.active) {
      removeSpeakingPanelIfNotNeeded();
      return;
    }

    if (!isCardboardMode()) {
      ensurePanel();
    } else {
      const panel = $('#lessonSpeakingPanel');
      if (panel) panel.remove();
    }

    ensureVrBoard();
  }

  function removeSpeakingPanelIfNotNeeded() {
    stopSpeaking(false);

    const panel = $('#lessonSpeakingPanel');
    if (panel) panel.remove();

    const scene = $('a-scene');
    if (scene) {
      const board = $('#lessonSpeakingVrBoard', scene);
      if (board) board.remove();
    }

    state.active = false;
    state.skill = detectCurrentSkill();
  }

  function activateOrSkip(reason) {
    const skill = detectCurrentSkill();

    state.skill = skill;
    state.active = skill === 'speaking';

    if (!state.active) {
      removeSpeakingPanelIfNotNeeded();
      console.log('[LessonSpeakingFix] skipped because current skill =', skill, 'reason=', reason);
      return false;
    }

    refreshTask();
    console.log('[LessonSpeakingFix] active', PATCH, {
      sid: state.sid,
      skill: state.skill,
      title: state.title,
      target: state.target,
      difficulty: state.difficulty,
      cefr: state.cefr,
      reason
    });

    return true;
  }

  function bindEvents() {
    const refreshEvents = [
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:view-mode-ready'
    ];

    refreshEvents.forEach((name) => {
      window.addEventListener(name, () => activateOrSkip(name));
      document.addEventListener(name, () => activateOrSkip(`document:${name}`));
    });
  }

  function boot() {
    bindEvents();

    window.LESSON_SPEAKING_FIX = {
      version: PATCH,
      refresh: refreshTask,
      activate: activateOrSkip,
      remove: removeSpeakingPanelIfNotNeeded,
      start: startSpeaking,
      stop: stopSpeaking,
      listen: speakExample,
      getState: () => ({ ...state }),
      detectCurrentSkill
    };

    activateOrSkip('boot');

    // รอ module data guard / router โหลดครบ แล้วเช็กซ้ำ
    setTimeout(() => activateOrSkip('t400'), 400);
    setTimeout(() => activateOrSkip('t1000'), 1000);
    setTimeout(() => activateOrSkip('t2000'), 2000);
    setTimeout(() => activateOrSkip('t3500'), 3500);

    console.log('[LessonSpeakingFix]', PATCH);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
