// === /english/lesson-speaking-fix.js ===
// PATCH v20260424b-LESSON-SPEAKING-FIX
// Add speaking UI + microphone recognition + VR instruction board for S1-S15

(function () {
  'use strict';

  const PATCH = 'v20260424b-LESSON-SPEAKING-FIX';

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition || null;

  const FALLBACK_TARGETS = {
    S1: {
      title: 'Introduction',
      target: 'My name is Anna and I am a student.',
      tip: 'พูดแนะนำตัวเองให้ชัดเจน'
    },
    S2: {
      title: 'Academic Background',
      target: 'I study computer science and artificial intelligence.',
      tip: 'พูดชื่อสาขาและพื้นฐานการเรียน'
    },
    S3: {
      title: 'Tech Jobs',
      target: 'A software developer writes and tests programs.',
      tip: 'พูดอธิบายงานสายเทคโนโลยี'
    },
    S4: {
      title: 'Daily Workplace Communication',
      target: 'I have a question about the project.',
      tip: 'พูดประโยคสื่อสารในที่ทำงาน'
    },
    S5: {
      title: 'Emails and Chat',
      target: 'Please check my email and reply when you can.',
      tip: 'พูดประโยคสุภาพสำหรับอีเมล'
    },
    S6: {
      title: 'Meetings',
      target: 'I agree with this idea because it is useful.',
      tip: 'พูดแสดงความคิดเห็นในการประชุม'
    },
    S7: {
      title: 'Explaining a System',
      target: 'This system helps users find information faster.',
      tip: 'พูดอธิบายระบบแบบง่าย'
    },
    S8: {
      title: 'Problems and Bugs',
      target: 'The app has a bug and the button does not work.',
      tip: 'พูดรายงานปัญหาโปรแกรม'
    },
    S9: {
      title: 'Team Stand-up',
      target: 'Today I will fix the login page.',
      tip: 'พูดรายงานงานวันนี้'
    },
    S10: {
      title: 'Client Communication',
      target: 'We will update the design and send it tomorrow.',
      tip: 'พูดสื่อสารกับลูกค้า'
    },
    S11: {
      title: 'Data and AI',
      target: 'Artificial intelligence can learn from data.',
      tip: 'พูดประโยคพื้นฐานด้าน AI'
    },
    S12: {
      title: 'CV and Portfolio',
      target: 'My portfolio shows my web application projects.',
      tip: 'พูดแนะนำผลงานของตนเอง'
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
    },
    S15: {
      title: 'Capstone Career Mission',
      target: 'I can explain my skills and present my final project.',
      tip: 'พูดสรุปทักษะและโครงงาน'
    }
  };

  let state = {
    sid: 'S1',
    title: 'Introduction',
    target: FALLBACK_TARGETS.S1.target,
    tip: FALLBACK_TARGETS.S1.tip,
    heard: '',
    interim: '',
    score: 0,
    passed: false,
    listening: false,
    recognition: null,
    attempts: 0
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

  function readAFrameText() {
    const out = [];

    $all('a-text').forEach((el) => {
      const v = el.getAttribute('value');
      if (v) out.push(String(v));
      const t = el.getAttribute('text');
      if (t && typeof t === 'object' && t.value) out.push(String(t.value));
    });

    $all('[text]').forEach((el) => {
      const t = el.getAttribute('text');
      if (t && typeof t === 'object' && t.value) out.push(String(t.value));
    });

    return out.join('\n');
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

    const quote = s.match(/["“]([^"”]{8,160})["”]/);
    if (quote && quote[1]) return quote[1].trim();

    return '';
  }

  function pickFromLessonData(sid) {
    try {
      const src =
        window.LESSON_DATA ||
        window.LESSON_SESSIONS ||
        window.lessonData ||
        window.sessions ||
        null;

      if (!src) return null;

      const n = parseInt(sid.replace('S', ''), 10);
      const candidates = [
        src[sid],
        src[sid.toLowerCase()],
        src[n],
        Array.isArray(src) ? src[n - 1] : null
      ].filter(Boolean);

      const item = candidates[0];
      if (!item) return null;

      const title =
        item.title ||
        item.name ||
        item.lessonTitle ||
        item.topic ||
        FALLBACK_TARGETS[sid]?.title ||
        sid;

      const possible =
        item.speakingPrompt ||
        item.speakPrompt ||
        item.speaking ||
        item.say ||
        item.repeat ||
        item.prompt ||
        item.question ||
        item.challenge ||
        '';

      let target = '';

      if (typeof possible === 'string') {
        target = extractSayTarget(possible) || possible;
      } else if (Array.isArray(possible)) {
        const first = possible.find(Boolean);
        target =
          typeof first === 'string'
            ? extractSayTarget(first) || first
            : first?.target || first?.text || first?.sentence || '';
      } else if (possible && typeof possible === 'object') {
        target =
          possible.target ||
          possible.text ||
          possible.sentence ||
          possible.prompt ||
          '';
      }

      target = safeText(target);

      if (!target || target.length < 6) return null;

      return {
        title: safeText(title),
        target,
        tip: safeText(item.tip || item.hint || item.objective || '')
      };
    } catch (err) {
      console.warn('[LessonSpeakingFix] lesson data read skipped', err);
      return null;
    }
  }

  function refreshTask() {
    const sid = detectSid();
    const visibleText = readAFrameText();
    const fromScene = extractSayTarget(visibleText);
    const fromData = pickFromLessonData(sid);
    const fb = FALLBACK_TARGETS[sid] || FALLBACK_TARGETS.S1;

    state.sid = sid;
    state.title = fromData?.title || fb.title;
    state.target = fromScene || fromData?.target || fb.target;
    state.tip = fromData?.tip || fb.tip;

    updateUI();
    updateVrBoard();
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
      Math.max(0, Math.min(1, coverage * 0.45 + sequence * 0.35 + charScore * 0.2)) *
        100
    );

    const missing = targetWords.filter((w) => !heardSet.has(w));

    return { score, coverage, sequence, charScore, missing };
  }

  function passThreshold() {
    const q = getParams();
    const diff = safeText(q.get('diff') || q.get('difficulty') || 'normal').toLowerCase();

    if (diff === 'easy' || diff === 'learn') return 65;
    if (diff === 'hard' || diff === 'challenge') return 80;
    return 72;
  }

  function analyzeHeard() {
    const result = scoreSpeech(state.target, state.heard);
    state.score = result.score;
    state.passed = result.score >= passThreshold();

    saveResult(result);
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

  function emitResult(result) {
    const detail = {
      version: PATCH,
      sid: state.sid,
      title: state.title,
      target: state.target,
      heard: state.heard,
      score: state.score,
      passed: state.passed,
      attempts: state.attempts,
      threshold: passThreshold(),
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
    refreshTask();

    if (!SpeechRecognition) {
      setStatus('Browser นี้ยังไม่รองรับ Speech Recognition ให้พิมพ์คำตอบแทนในช่อง Heard', 'warn');
      const input = $('#lessonSpeakingManualInput');
      if (input) input.focus();
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
    const input = $('#lessonSpeakingManualInput');
    if (input) {
      state.heard = input.value.trim();
      state.interim = '';
      state.attempts += 1;
      analyzeHeard();
    }
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
        display:none;
      }

      #lessonSpeakingPanel.no-speech-api #lessonSpeakingManualInput{
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
    if ($('#lessonSpeakingPanel')) return;

    ensureCSS();

    const panel = document.createElement('section');
    panel.id = 'lessonSpeakingPanel';
    if (!SpeechRecognition) panel.classList.add('no-speech-api');

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
          <small id="lessonSpeakingLabel">S1 • Speaking</small>
          <div class="lesson-speaking-sentence" id="lessonSpeakingTarget">
            My name is Anna and I am a student.
          </div>
          <div class="lesson-speaking-tip" id="lessonSpeakingTip">
            พูดช้า ๆ ชัด ๆ
          </div>
        </div>

        <div class="lesson-speaking-buttons">
          <button id="lessonListenBtn" type="button">🔊 Listen</button>
          <button id="lessonStartSpeakBtn" type="button">🎤 Start Speaking</button>
          <button id="lessonStopSpeakBtn" type="button">⏹ Stop</button>
          <button id="lessonTryAgainBtn" type="button">↻ Try Again</button>
        </div>

        <div class="lesson-speaking-heard">
          <label>Heard / ระบบได้ยินว่า</label>
          <div id="lessonSpeakingHeardBox">-</div>
          <input id="lessonSpeakingManualInput" type="text" placeholder="พิมพ์ประโยคที่พูดในกรณี browser ไม่รองรับไมค์" />
          <button id="lessonCheckManualBtn" type="button">✅ Check Manual Answer</button>
        </div>

        <div class="lesson-speaking-result">
          <div id="lessonSpeakingStatus" data-type="info">พร้อมแล้ว กด Start Speaking แล้วพูดตามประโยค</div>
          <div id="lessonSpeakingScore">0%</div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    $('#lessonListenBtn').addEventListener('click', speakExample);
    $('#lessonStartSpeakBtn').addEventListener('click', startSpeaking);
    $('#lessonStopSpeakBtn').addEventListener('click', () => stopSpeaking(true));
    $('#lessonTryAgainBtn').addEventListener('click', resetAttempt);
    $('#lessonCheckManualBtn').addEventListener('click', manualCheck);

    $('#lessonSpeakingToggle').addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
      $('#lessonSpeakingToggle').textContent = panel.classList.contains('is-collapsed')
        ? 'เปิด'
        : 'ย่อ';
    });
  }

  function updateUI() {
    const panel = $('#lessonSpeakingPanel');
    if (!panel) return;

    $('#lessonSpeakingTitle').textContent = `🎤 Speaking Mission`;
    $('#lessonSpeakingLabel').textContent = `${state.sid} • ${state.title}`;
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
        setStatus('ยังไม่ผ่าน ลองพูดใหม่ให้ใกล้ประโยคตัวอย่างมากขึ้น', 'fail');
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

  function ensureVrBoard() {
    const scene = $('a-scene');
    if (!scene) return;

    ensureCameraCursor(scene);

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
    heard.setAttribute('value', 'กดปุ่มสีเขียวด้านล่างเพื่อพูด');
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
    addVrLights(scene);

    return board;
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

  function updateVrBoard() {
    const board = ensureVrBoard();
    if (!board) return;

    const title = $('#lessonSpeakingVrTitle', board);
    const target = $('#lessonSpeakingVrTarget', board);
    const heard = $('#lessonSpeakingVrHeard', board);
    const btn = $('#lessonSpeakingVrStartBtn', board);

    if (title) title.setAttribute('value', `${state.sid} • ${state.title}`);

    if (target) {
      target.setAttribute(
        'value',
        `Say clearly:\n"${state.target}"`
      );
    }

    let heardText = 'กดปุ่ม START หรือปุ่มไมค์ด้านล่างจอ แล้วพูดตามประโยค';

    if (state.listening) {
      heardText = 'Listening... พูดตอนนี้ได้เลย';
    } else if (safeText(`${state.heard} ${state.interim}`)) {
      heardText = `Heard: ${safeText(`${state.heard} ${state.interim}`)}\nScore: ${state.score}% ${
        state.passed ? '✅ PASS' : 'ลองใหม่อีกครั้ง'
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

  function makeExistingMissionTextClear() {
    const scene = $('a-scene');
    if (!scene) return;

    $all('a-text', scene).forEach((el) => {
      const v = safeText(el.getAttribute('value'));
      if (/mission|say|speak|introduction/i.test(v)) {
        el.setAttribute('color', '#ffffff');
        el.setAttribute('width', '4');
        el.setAttribute('wrap-count', '34');
        el.setAttribute('position', el.getAttribute('position') || '0 2 -2');
      }
    });
  }

  function boot() {
    ensurePanel();
    refreshTask();
    makeExistingMissionTextClear();
    ensureVrBoard();
    updateVrBoard();

    setTimeout(refreshTask, 600);
    setTimeout(refreshTask, 1500);
    setTimeout(refreshTask, 3000);

    window.LESSON_SPEAKING_FIX = {
      version: PATCH,
      refresh: refreshTask,
      start: startSpeaking,
      stop: stopSpeaking,
      listen: speakExample,
      getState: () => ({ ...state })
    };

    console.log('[LessonSpeakingFix]', PATCH, state);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
