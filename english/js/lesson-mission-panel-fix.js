// === /english/js/lesson-mission-panel-fix.js ===
// PATCH v20260426b-LESSON-MISSION-PANEL-ALL-SKILLS
// Fix: only S1 speaking is playable, but S2-S15 do not show playable UI.
// ✅ Renders Listening / Reading / Writing / Boss / FinalBoss
// ✅ Pure speaking sessions still use lesson-speaking-fix + lazy open
// ✅ Uses missionDB / LESSON_DATA generated from lesson-data.js
// ✅ Emits lesson:* result events for AI Difficulty + Next Session
// ✅ Supports PC / Mobile; Cardboard uses compact overlay for now

(function () {
  'use strict';

  const VERSION = 'v20260426b-LESSON-MISSION-PANEL-ALL-SKILLS';
  const INDEX_KEY = 'ENGLISH_QUEST_ITEM_INDEX_V1';

  const DIFF_META = {
    easy: { cefr: 'A2', passScore: 65 },
    normal: { cefr: 'A2+', passScore: 72 },
    hard: { cefr: 'B1', passScore: 78 },
    challenge: { cefr: 'B1+', passScore: 84 },
    expert: { cefr: 'B1+', passScore: 84 }
  };

  let state = {
    sid: 'S1',
    sessionId: 1,
    session: null,
    item: null,
    difficulty: 'normal',
    skill: 'unknown',
    open: true,
    renderedKey: ''
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }

  function safe(v) {
    return String(v == null ? '' : v).trim();
  }

  function q() {
    return new URLSearchParams(location.search || '');
  }

  function normalizeSid(v) {
    const raw = safe(v).toUpperCase();
    if (/^S\d+$/.test(raw)) {
      const n = Math.max(1, Math.min(15, parseInt(raw.replace('S', ''), 10) || 1));
      return `S${n}`;
    }
    const n = Math.max(1, Math.min(15, parseInt(raw, 10) || 1));
    return `S${n}`;
  }

  function sidNumber(sid) {
    return Math.max(1, Math.min(15, parseInt(String(sid).replace('S', ''), 10) || 1));
  }

  function currentSid() {
    try {
      if (window.LESSON_CURRENT_STATE?.sid) return normalizeSid(window.LESSON_CURRENT_STATE.sid);
    } catch (err) {}

    try {
      if (window.LESSON_DATA_GUARD?.currentSid) {
        return normalizeSid(window.LESSON_DATA_GUARD.currentSid());
      }
    } catch (err) {}

    const p = q();
    return normalizeSid(
      p.get('s') ||
      p.get('sid') ||
      p.get('session') ||
      p.get('unit') ||
      p.get('lesson') ||
      '1'
    );
  }

  function normalizeDifficulty(v) {
    const raw = safe(v).toLowerCase();

    if (['easy', 'e', 'a2'].includes(raw)) return 'easy';
    if (['normal', 'medium', 'n', 'a2+'].includes(raw)) return 'normal';
    if (['hard', 'h', 'b1'].includes(raw)) return 'hard';
    if (['challenge', 'expert', 'x', 'b1+'].includes(raw)) return 'challenge';

    return 'normal';
  }

  function currentDifficulty() {
    try {
      if (window.LESSON_AI_DIFFICULTY?.getRecommendedDifficulty) {
        return normalizeDifficulty(window.LESSON_AI_DIFFICULTY.getRecommendedDifficulty(currentSid()));
      }
    } catch (err) {}

    try {
      if (window.LESSON_CURRENT_STATE?.difficulty) {
        return normalizeDifficulty(window.LESSON_CURRENT_STATE.difficulty);
      }
    } catch (err) {}

    const p = q();
    return normalizeDifficulty(p.get('diff') || p.get('difficulty') || p.get('level') || 'normal');
  }

  function currentViewMode() {
    try {
      if (window.LESSON_VIEW_MODE) return String(window.LESSON_VIEW_MODE);
    } catch (err) {}

    const ds = document.documentElement.dataset.lessonViewMode;
    if (ds) return ds;

    const view = safe(q().get('view')).toLowerCase();
    if (['vr', 'cvr', 'cardboard', 'cardboard-vr'].includes(view)) return 'cardboard';
    if (['mobile', 'phone'].includes(view)) return 'mobile';

    return 'pc';
  }

  function getDataList() {
    return (
      window.missionDB ||
      window.LESSON_DATA ||
      window.LESSON_SESSIONS ||
      window.lessonData?.sessions ||
      []
    );
  }

  function getSession(sid = currentSid()) {
    sid = normalizeSid(sid);
    const id = sidNumber(sid);
    const list = getDataList();

    if (Array.isArray(list)) {
      return (
        list.find(s => Number(s.id) === id || normalizeSid(s.sid || s._sid || s.sessionId || s.id) === sid) ||
        list[id - 1] ||
        null
      );
    }

    if (list && typeof list === 'object') {
      return list[sid] || list[String(id)] || list.sessions?.[sid] || list.sessions?.[String(id)] || null;
    }

    return null;
  }

  function normalizeSkill(v) {
    const raw = safe(v).toLowerCase();

    if (['speaking', 'speak', 'voice'].includes(raw)) return 'speaking';
    if (['listening', 'listen', 'audio'].includes(raw)) return 'listening';
    if (['reading', 'read'].includes(raw)) return 'reading';
    if (['writing', 'write', 'typing'].includes(raw)) return 'writing';
    if (['boss', 'challenge'].includes(raw)) return 'boss';
    if (['finalboss', 'final-boss', 'final_boss'].includes(raw)) return 'finalBoss';

    return raw || 'unknown';
  }

  function getIndexProfile() {
    try {
      return JSON.parse(localStorage.getItem(INDEX_KEY) || '{}') || {};
    } catch (err) {
      return {};
    }
  }

  function saveIndexProfile(profile) {
    try {
      localStorage.setItem(INDEX_KEY, JSON.stringify(profile));
    } catch (err) {}
  }

  function getItemIndex(sid, diff) {
    const profile = getIndexProfile();
    const key = `${sid}:${diff}`;
    return Number(profile[key] || 0) % 10;
  }

  function advanceItemIndex(sid, diff) {
    const profile = getIndexProfile();
    const key = `${sid}:${diff}`;
    profile[key] = (Number(profile[key] || 0) + 1) % 10;
    saveIndexProfile(profile);
  }

  function getCurrentItemFromWindow(sid, diff) {
    try {
      const item = window.LESSON_CURRENT_ITEM;
      if (!item) return null;

      const itemSid = normalizeSid(item._sid || item.sid || item.sessionId || item._sessionId || state.sid);
      const itemDiff = normalizeDifficulty(item.difficulty || item.diff || item._selectedDifficulty || diff);

      if (itemSid === sid && itemDiff === diff) return item;
    } catch (err) {}

    return null;
  }

  function selectItem(session, sid, diff) {
    if (!session) return null;

    const winItem = getCurrentItemFromWindow(sid, diff);
    if (winItem) return winItem;

    const bank = session.bank || session.banks || {};
    const items = bank[diff] || bank[diff === 'challenge' ? 'expert' : diff] || bank.normal || bank.easy || [];

    if (Array.isArray(items) && items.length) {
      const idx = getItemIndex(sid, diff) % items.length;
      return items[idx];
    }

    try {
      if (window.pickAdaptiveMissionItem) {
        return window.pickAdaptiveMissionItem(sidNumber(sid), diff, {}, `${sid}-${diff}-${getItemIndex(sid, diff)}`);
      }
    } catch (err) {}

    return null;
  }

  function itemSkill(item, session) {
    return normalizeSkill(
      item?.skill ||
      item?.type ||
      item?._sessionType ||
      session?.type ||
      session?.skill ||
      'unknown'
    );
  }

  function isPureSpeakingSession(session, item) {
    const sessionSkill = normalizeSkill(session?.type || session?.skill);
    const skill = itemSkill(item, session);

    // S ที่เป็น speaking จริง ๆ ให้ใช้ speaking panel/lazy-open เดิม
    return sessionSkill === 'speaking' && skill === 'speaking';
  }

  function ensureCSS() {
    if ($('#lesson-mission-panel-css')) return;

    const style = document.createElement('style');
    style.id = 'lesson-mission-panel-css';
    style.textContent = `
      #lessonMissionPanel {
        position: fixed;
        right: 18px;
        bottom: max(18px, env(safe-area-inset-bottom));
        z-index: 2147483645;
        width: min(560px, calc(100vw - 36px));
        max-height: min(78vh, 720px);
        overflow: auto;
        border-radius: 26px;
        border: 2px solid rgba(56,189,248,.82);
        background: rgba(248,251,255,.97);
        color: #0f172a;
        box-shadow: 0 24px 80px rgba(0,0,0,.36);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      #lessonMissionPanel * {
        box-sizing: border-box;
      }

      .lesson-mission-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        color: #fff;
        background: linear-gradient(90deg,#0ea5e9,#2563eb);
      }

      .lesson-mission-title {
        font-weight: 1000;
        line-height: 1.25;
      }

      .lesson-mission-title small {
        display: block;
        margin-top: 2px;
        color: #dff7ff;
        font-size: 12px;
        font-weight: 800;
      }

      #lessonMissionToggle {
        border: 0;
        border-radius: 999px;
        padding: 8px 11px;
        background: #fff;
        color: #0f172a;
        font-weight: 1000;
        cursor: pointer;
      }

      #lessonMissionPanel.is-collapsed .lesson-mission-body {
        display: none;
      }

      .lesson-mission-body {
        display: grid;
        gap: 12px;
        padding: 14px;
      }

      .lesson-mission-card {
        border: 1px solid #bfdbfe;
        border-radius: 18px;
        padding: 12px;
        background: #eff6ff;
      }

      .lesson-mission-badge {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 8px;
        padding: 6px 10px;
        border-radius: 999px;
        background: #dbeafe;
        color: #1d4ed8;
        font-size: 12px;
        font-weight: 1000;
      }

      .lesson-mission-question {
        font-size: 18px;
        font-weight: 1000;
        line-height: 1.35;
      }

      .lesson-mission-passage,
      .lesson-mission-audio,
      .lesson-mission-prompt {
        margin-top: 8px;
        padding: 10px 12px;
        border-radius: 14px;
        background: #fff;
        color: #1e293b;
        border: 1px solid #cbd5e1;
        font-size: 15px;
        line-height: 1.45;
        font-weight: 750;
      }

      .lesson-mission-choices {
        display: grid;
        gap: 8px;
      }

      .lesson-choice-btn {
        width: 100%;
        border: 0;
        border-radius: 18px;
        padding: 13px 14px;
        text-align: left;
        background: #22c7e8;
        color: #06202a;
        font-size: 16px;
        font-weight: 1000;
        cursor: pointer;
        box-shadow: 0 10px 22px rgba(15,23,42,.14);
      }

      .lesson-choice-btn:hover {
        transform: translateY(-1px);
        background: #67e8f9;
      }

      .lesson-choice-btn.correct {
        background: #86efac;
        color: #052e16;
      }

      .lesson-choice-btn.wrong {
        background: #fecaca;
        color: #7f1d1d;
      }

      .lesson-mission-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .lesson-action-btn {
        border: 0;
        border-radius: 999px;
        padding: 11px 14px;
        cursor: pointer;
        font-weight: 1000;
        background: #dbeafe;
        color: #1d4ed8;
      }

      .lesson-action-btn.primary {
        background: #22c55e;
        color: #052e16;
      }

      .lesson-action-btn.warn {
        background: #fef3c7;
        color: #92400e;
      }

      #lessonWritingInput {
        width: 100%;
        min-height: 110px;
        resize: vertical;
        border: 1px solid #cbd5e1;
        border-radius: 16px;
        padding: 12px;
        font: inherit;
        font-weight: 750;
        color: #0f172a;
        background: #fff;
      }

      .lesson-mission-result {
        padding: 12px;
        border-radius: 18px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        color: #334155;
        font-weight: 900;
      }

      .lesson-mission-result.pass {
        background: #dcfce7;
        color: #166534;
        border-color: #86efac;
      }

      .lesson-mission-result.fail {
        background: #fee2e2;
        color: #991b1b;
        border-color: #fecaca;
      }

      html.lesson-mode-mobile #lessonMissionPanel {
        left: 8px;
        right: 8px;
        bottom: max(8px, env(safe-area-inset-bottom));
        width: auto;
        max-height: 72vh;
        border-radius: 20px;
      }

      html.lesson-mode-cardboard #lessonMissionPanel {
        left: 8px;
        right: 8px;
        bottom: 8px;
        width: auto;
        max-height: 42vh;
        border-radius: 18px;
        opacity: .94;
      }

      @media (max-width: 680px) {
        #lessonMissionPanel {
          left: 8px;
          right: 8px;
          bottom: max(8px, env(safe-area-inset-bottom));
          width: auto;
        }

        .lesson-mission-question {
          font-size: 15px;
        }

        .lesson-choice-btn {
          font-size: 14px;
          padding: 11px 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function ensurePanel() {
    ensureCSS();

    let panel = $('#lessonMissionPanel');
    if (panel) return panel;

    panel = document.createElement('section');
    panel.id = 'lessonMissionPanel';
    panel.innerHTML = `
      <div class="lesson-mission-head">
        <div class="lesson-mission-title" id="lessonMissionTitle">
          Mission
          <small id="lessonMissionSub">Ready</small>
        </div>
        <button id="lessonMissionToggle" type="button">ย่อ</button>
      </div>
      <div class="lesson-mission-body" id="lessonMissionBody"></div>
    `;

    document.body.appendChild(panel);

    $('#lessonMissionToggle')?.addEventListener('click', () => {
      panel.classList.toggle('is-collapsed');
      $('#lessonMissionToggle').textContent = panel.classList.contains('is-collapsed') ? 'เปิด' : 'ย่อ';
    });

    return panel;
  }

  function hidePanel() {
    const panel = $('#lessonMissionPanel');
    if (panel) panel.remove();
  }

  function stripChoicePrefix(text) {
    return safe(text).replace(/^[A-C]\.\s*/i, '');
  }

  function choiceLetterFromText(choiceText) {
    const m = safe(choiceText).match(/^([A-C])\./i);
    return m ? m[1].toUpperCase() : '';
  }

  function setResult(message, type) {
    const box = $('#lessonMissionResult');
    if (!box) return;
    box.textContent = message;
    box.className = `lesson-mission-result ${type || ''}`;
  }

  function emitResult({ skill, score, passed, answer, item }) {
    const detail = {
      version: VERSION,
      sid: state.sid,
      sessionId: state.sessionId,
      skill,
      type: skill,
      itemId: item?.id || '',
      difficulty: state.difficulty,
      cefr: item?.cefr || DIFF_META[state.difficulty]?.cefr || '',
      score,
      passed,
      answer,
      passScore: item?.passScore || DIFF_META[state.difficulty]?.passScore || 72
    };

    window.dispatchEvent(new CustomEvent(`lesson:${skill}-result`, { detail }));
    document.dispatchEvent(new CustomEvent(`lesson:${skill}-result`, { detail }));

    window.dispatchEvent(new CustomEvent('lesson:item-result', { detail }));
    document.dispatchEvent(new CustomEvent('lesson:item-result', { detail }));

    if (passed) {
      advanceItemIndex(state.sid, state.difficulty);

      window.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
      document.dispatchEvent(new CustomEvent('lesson:mission-pass', { detail }));
    }
  }

  function speak(text) {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.86;
      u.pitch = 1.02;
      window.speechSynthesis.speak(u);
    } catch (err) {
      setResult('เครื่องนี้เล่นเสียงไม่ได้ แต่ยังอ่านข้อความแล้วตอบได้', 'fail');
    }
  }

  function renderChoiceMission(item, skill) {
    const body = $('#lessonMissionBody');
    const title = skill === 'listening' ? '🎧 Listening Mission' : '📖 Reading Mission';
    const question = item.question || 'Choose the best answer.';
    const choices = Array.isArray(item.choices) && item.choices.length
      ? item.choices
      : toChoicesFromItem(item);

    const audioOrPassage = skill === 'listening'
      ? `<div class="lesson-mission-audio"><b>Audio/Text:</b> ${escapeHtml(item.audioText || item.prompt || question)}</div>`
      : `<div class="lesson-mission-passage"><b>Passage:</b> ${escapeHtml(item.passage || item.prompt || question)}</div>`;

    body.innerHTML = `
      <div class="lesson-mission-card">
        <div class="lesson-mission-badge">${title} • ${state.difficulty.toUpperCase()} • ${item.cefr || ''}</div>
        <div class="lesson-mission-question">${escapeHtml(question)}</div>
        ${audioOrPassage}
      </div>

      <div class="lesson-mission-actions">
        ${
          skill === 'listening'
            ? '<button class="lesson-action-btn primary" id="lessonListenMissionBtn" type="button">🔊 Listen</button>'
            : ''
        }
        <button class="lesson-action-btn warn" id="lessonNewItemBtn" type="button">↻ เปลี่ยนข้อ</button>
      </div>

      <div class="lesson-mission-choices" id="lessonMissionChoices"></div>
      <div class="lesson-mission-result" id="lessonMissionResult">เลือกคำตอบเพื่อผ่านด่าน</div>
    `;

    const choiceBox = $('#lessonMissionChoices');

    choices.forEach((choiceText, index) => {
      const btn = document.createElement('button');
      btn.className = 'lesson-choice-btn';
      btn.type = 'button';
      btn.textContent = choiceText;

      btn.addEventListener('click', () => {
        const selectedLetter = choiceLetterFromText(choiceText) || String.fromCharCode(65 + index);
        const correctLetter = safe(item.answer || 'A').toUpperCase();
        const passed = selectedLetter === correctLetter;

        choiceBox.querySelectorAll('.lesson-choice-btn').forEach(b => {
          b.disabled = true;
          const letter = choiceLetterFromText(b.textContent);
          if (letter === correctLetter) b.classList.add('correct');
        });

        if (!passed) btn.classList.add('wrong');

        const score = passed ? 100 : 0;
        setResult(passed ? '✅ ถูกต้อง ผ่านด่านแล้ว' : '❌ ยังไม่ถูก ลองทบทวนอีกครั้ง', passed ? 'pass' : 'fail');

        emitResult({
          skill,
          score,
          passed,
          answer: selectedLetter,
          item
        });
      });

      choiceBox.appendChild(btn);
    });

    $('#lessonListenMissionBtn')?.addEventListener('click', () => {
      speak(item.audioText || item.question || item.prompt || '');
    });

    $('#lessonNewItemBtn')?.addEventListener('click', () => {
      advanceItemIndex(state.sid, state.difficulty);
      render(true);
    });
  }

  function toChoicesFromItem(item) {
    const correct = item.correct || item.answerText || item.answer || 'Correct answer';
    const distractors = Array.isArray(item.distractors) && item.distractors.length
      ? item.distractors
      : ['Not correct', 'Try another answer'];

    return [
      `A. ${stripChoicePrefix(correct)}`,
      `B. ${stripChoicePrefix(distractors[0])}`,
      `C. ${stripChoicePrefix(distractors[1])}`
    ];
  }

  function normalizeForMatch(text) {
    return safe(text)
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function wordCount(text) {
    const n = normalizeForMatch(text);
    return n ? n.split(/\s+/).length : 0;
  }

  function renderWritingMission(item) {
    const body = $('#lessonMissionBody');

    body.innerHTML = `
      <div class="lesson-mission-card">
        <div class="lesson-mission-badge">✍️ Writing Mission • ${state.difficulty.toUpperCase()} • ${item.cefr || ''}</div>
        <div class="lesson-mission-question">${escapeHtml(item.desc || 'Write your answer.')}</div>
        <div class="lesson-mission-prompt">${escapeHtml(item.prompt || '')}</div>
        ${
          item.starter
            ? `<div class="lesson-mission-passage"><b>Starter:</b> ${escapeHtml(String(item.starter).replace(/^Starter:\s*/i, ''))}</div>`
            : ''
        }
      </div>

      <textarea id="lessonWritingInput" class="lesson-allow-copy" placeholder="พิมพ์คำตอบที่นี่..."></textarea>

      <div class="lesson-mission-actions">
        <button class="lesson-action-btn primary" id="lessonCheckWritingBtn" type="button">✅ Check Writing</button>
        <button class="lesson-action-btn warn" id="lessonNewItemBtn" type="button">↻ เปลี่ยนข้อ</button>
      </div>

      <div class="lesson-mission-result" id="lessonMissionResult">
        ต้องมีอย่างน้อย ${item.minWords || 5} คำ และตรง keyword อย่างน้อย ${item.minMatch || 1} คำ
      </div>
    `;

    $('#lessonCheckWritingBtn')?.addEventListener('click', () => {
      const input = $('#lessonWritingInput');
      const answer = input ? input.value : '';
      const norm = normalizeForMatch(answer);

      const keywords = Array.isArray(item.keywords) ? item.keywords : [];
      const matched = keywords.filter(k => norm.includes(normalizeForMatch(k))).length;
      const wc = wordCount(answer);

      const minMatch = Number(item.minMatch || 1);
      const minWords = Number(item.minWords || 5);

      const keywordScore = keywords.length ? Math.min(100, Math.round((matched / Math.max(minMatch, 1)) * 75)) : 50;
      const wordScore = Math.min(25, Math.round((wc / Math.max(minWords, 1)) * 25));
      const score = Math.max(0, Math.min(100, keywordScore + wordScore));

      const passed = matched >= minMatch && wc >= minWords;

      setResult(
        passed
          ? `✅ ผ่านด่านเขียนแล้ว • Score ${score}%`
          : `ยังไม่ผ่าน • ได้ keyword ${matched}/${minMatch}, จำนวนคำ ${wc}/${minWords} • Score ${score}%`,
        passed ? 'pass' : 'fail'
      );

      emitResult({
        skill: 'writing',
        score,
        passed,
        answer,
        item
      });
    });

    $('#lessonNewItemBtn')?.addEventListener('click', () => {
      advanceItemIndex(state.sid, state.difficulty);
      render(true);
    });
  }

  function renderMiniSpeakingMission(item) {
    const body = $('#lessonMissionBody');
    const target = item.target || item.exactPhrase || item.prompt || '';

    body.innerHTML = `
      <div class="lesson-mission-card">
        <div class="lesson-mission-badge">🎤 Speaking Challenge • ${state.difficulty.toUpperCase()} • ${item.cefr || ''}</div>
        <div class="lesson-mission-question">Say clearly:</div>
        <div class="lesson-mission-prompt">"${escapeHtml(target)}"</div>
      </div>

      <div class="lesson-mission-actions">
        <button class="lesson-action-btn primary" id="lessonMiniSpeakListenBtn" type="button">🔊 Listen</button>
        <button class="lesson-action-btn warn" id="lessonNewItemBtn" type="button">↻ เปลี่ยนข้อ</button>
      </div>

      <textarea id="lessonWritingInput" class="lesson-allow-copy" placeholder="ทดสอบโดยพิมพ์ประโยคที่พูด / ใช้กรณีไมค์ไม่ทำงาน"></textarea>

      <div class="lesson-mission-actions">
        <button class="lesson-action-btn primary" id="lessonMiniSpeakCheckBtn" type="button">✅ Check Speaking Text</button>
      </div>

      <div class="lesson-mission-result" id="lessonMissionResult">ฟังตัวอย่าง แล้วพูด/พิมพ์ให้ตรงประโยค</div>
    `;

    $('#lessonMiniSpeakListenBtn')?.addEventListener('click', () => speak(target));

    $('#lessonMiniSpeakCheckBtn')?.addEventListener('click', () => {
      const answer = $('#lessonWritingInput')?.value || '';
      const a = normalizeForMatch(answer);
      const t = normalizeForMatch(target);

      const targetWords = t.split(/\s+/).filter(Boolean);
      const answerWords = new Set(a.split(/\s+/).filter(Boolean));
      const matched = targetWords.filter(w => answerWords.has(w)).length;
      const score = targetWords.length ? Math.round((matched / targetWords.length) * 100) : 0;
      const passed = score >= Number(item.passScore || DIFF_META[state.difficulty]?.passScore || 72);

      setResult(
        passed ? `✅ ผ่าน speaking challenge • Score ${score}%` : `ยังไม่ผ่าน • Score ${score}%`,
        passed ? 'pass' : 'fail'
      );

      emitResult({
        skill: 'speaking',
        score,
        passed,
        answer,
        item
      });
    });

    $('#lessonNewItemBtn')?.addEventListener('click', () => {
      advanceItemIndex(state.sid, state.difficulty);
      render(true);
    });
  }

  function escapeHtml(text) {
    return safe(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function render(force = false) {
    const sid = currentSid();
    const diff = currentDifficulty();
    const session = getSession(sid);

    if (!session) {
      hidePanel();
      console.warn('[LessonMissionPanel] no session data yet', { sid, diff });
      return false;
    }

    const item = selectItem(session, sid, diff);
    if (!item) {
      hidePanel();
      console.warn('[LessonMissionPanel] no item found', { sid, diff, session });
      return false;
    }

    const skill = itemSkill(item, session);
    const key = `${sid}:${diff}:${skill}:${item.id || ''}`;

    state.sid = sid;
    state.sessionId = sidNumber(sid);
    state.session = session;
    state.item = item;
    state.difficulty = diff;
    state.skill = skill;

    document.documentElement.dataset.lessonPlayableSkill = skill;

    // S speaking ปกติ ใช้ปุ่ม "เปิดด่านพูด" เดิม ไม่ต้องซ้ำ panel นี้
    if (isPureSpeakingSession(session, item)) {
      hidePanel();
      return true;
    }

    if (!force && key === state.renderedKey && $('#lessonMissionPanel')) return true;
    state.renderedKey = key;

    const panel = ensurePanel();
    const title = $('#lessonMissionTitle');
    const sub = $('#lessonMissionSub');

    const cefr = item.cefr || DIFF_META[diff]?.cefr || '';
    const bossLabel = item.boss || session.boss ? ` • Boss ${item.bossNo || session.bossNo || ''}` : '';

    if (title) {
      title.firstChild.nodeValue = `${session.sid || sid} ${bossLabel} • ${skill.toUpperCase()}`;
    }

    if (sub) {
      sub.textContent = `${session.title || ''} • ${diff.toUpperCase()} • ${cefr}`;
    }

    if (skill === 'listening') {
      renderChoiceMission(item, 'listening');
    } else if (skill === 'reading') {
      renderChoiceMission(item, 'reading');
    } else if (skill === 'writing') {
      renderWritingMission(item);
    } else if (skill === 'speaking') {
      renderMiniSpeakingMission(item);
    } else {
      renderChoiceMission(item, 'reading');
    }

    panel.style.display = '';
    return true;
  }

  function bindEvents() {
    [
      'lesson:data-skill-ready',
      'lesson:router-ready',
      'lesson:item-ready',
      'lesson:view-mode-ready',
      'lesson:ai-difficulty-updated'
    ].forEach(name => {
      window.addEventListener(name, () => render(true));
      document.addEventListener(name, () => render(true));
    });
  }

  function boot() {
    ensureCSS();
    bindEvents();

    window.LESSON_MISSION_PANEL_FIX = {
      version: VERSION,
      render,
      hide: hidePanel,
      getState: () => ({ ...state })
    };

    render(true);

    setTimeout(() => render(true), 500);
    setTimeout(() => render(true), 1200);
    setTimeout(() => render(true), 2500);
    setTimeout(() => render(true), 4000);

    console.log('[LessonMissionPanel]', VERSION);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
