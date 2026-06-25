// === /sgnal-hunt/js/uxq-w2-v9.js ===
// UX Quest • W2 Design Thinking Sprint
// V13 gate: W1 Crisis Casefile 2★ Readiness + 30-core Replay + Transfer Challenge

(function () {
  'use strict';

  const CASE_BANK = Array.isArray(window.UXQ_W2_CASE_BANK) ? window.UXQ_W2_CASE_BANK : [];
  const FIRST_RUN = Array.isArray(window.UXQ_W2_FIRST_RUN) ? window.UXQ_W2_FIRST_RUN : [];

  const W1_CASEFILE_READINESS_KEY = 'csai2601-uxquest-casefile-readiness-v1';
  const W2_PROGRESS_KEY = 'uxquest-w2-progress-v9';
  const W2_SESSION_KEY = 'uxquest-w2-session-v9';
  const ROUND_SIZE = 5;

  const MODE = {
    tutorial: { label: 'Tutorial Sprint', badge: 'FOUNDATION', description: '5 Sprint แบบมีคำอธิบายเพื่อฝึกกระบวนการครั้งแรก' },
    replay: { label: 'Random Sprint', badge: 'PRACTICE', description: 'สุ่ม 5 Sprint จากคลัง 30 Core Case โดยไม่ซ้ำก่อนครบ 6 รอบ' },
    challenge: { label: 'Transfer Sprint', badge: 'MASTERY', description: 'บริบทใหม่ พร้อม Hint น้อยลง และต้องใช้ผลทดสอบเพื่อตัดสินใจ' }
  };

  const $ = (selector) => document.querySelector(selector);
  const stage = $('#gameStage');
  const feedbackDialog = $('#feedbackDialog');
  const feedbackContent = $('#feedbackContent');
  const howDialog = $('#howDialog');

  const BY_ID = new Map(CASE_BANK.map((item) => [item.id, item]));

  let progress = freshProgress();
  let state = freshState();

  function freshProgress() {
    return {
      version: 1,
      tutorialComplete: false,
      tutorialBestStars: 0,
      bestStars: 0,
      bestScore: 0,
      totalRounds: 0,
      replayWins: 0,
      challengeWins: 0,
      roundHistory: [],
      caseStats: {},
      lastUpdated: null
    };
  }

  function freshState() {
    return {
      version: 1,
      mode: null,
      caseIds: [],
      variants: {},
      caseIndex: 0,
      step: 0,
      score: 0,
      sprint: 100,
      selected: null,
      testStage: 'plan',
      selectedExplain: [],
      attempts: 0,
      answers: [],
      complete: false,
      roundRecorded: false,
      startedAt: Date.now()
    };
  }

  function safeParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (error) { return fallback; }
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[char]));
  }
  function shuffle(items) {
    const list = [...items];
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  function unique(items) { return [...new Set(items)]; }
  function current() { return BY_ID.get(state.caseIds[state.caseIndex]) || null; }
  function modeMeta() { return MODE[state.mode] || MODE.tutorial; }
  function acceptW1CompletionLink() {
    // W1 Casefile writes its readiness record before navigating here.
  }

  function readCasefileReadiness() {
    const record = safeParse(localStorage.getItem(W1_CASEFILE_READINESS_KEY), {}) || {};
    const w1 = record.w1 && typeof record.w1 === 'object' ? record.w1 : record;
    return {
      ready: Boolean(w1.ready || Number(w1.bestStars) >= 2),
      stars: clamp(Number(w1.bestStars) || 0, 0, 3),
      score: Number(w1.bestScore) || 0
    };
  }

  function isW1Unlocked() {
    return readCasefileReadiness().ready;
  }

  function saveProgress() {
    progress.lastUpdated = new Date().toISOString();
    try { localStorage.setItem(W2_PROGRESS_KEY, JSON.stringify(progress)); } catch (error) { console.warn(error); }
  }
  function saveSession() {
    try { localStorage.setItem(W2_SESSION_KEY, JSON.stringify(state)); } catch (error) { console.warn(error); }
  }
  function clearSession() { try { localStorage.removeItem(W2_SESSION_KEY); } catch (error) { console.warn(error); } }

  function load() {
    const savedProgress = safeParse(localStorage.getItem(W2_PROGRESS_KEY), null);
    if (savedProgress && typeof savedProgress === 'object') {
      progress = { ...freshProgress(), ...savedProgress, roundHistory: Array.isArray(savedProgress.roundHistory) ? savedProgress.roundHistory : [], caseStats: savedProgress.caseStats || {} };
    }
    const savedSession = safeParse(localStorage.getItem(W2_SESSION_KEY), null);
    if (savedSession && savedSession.mode && Array.isArray(savedSession.caseIds)) {
      const ids = savedSession.caseIds.filter((id) => BY_ID.has(id));
      if (ids.length) {
        state = { ...freshState(), ...savedSession, caseIds: ids, variants: savedSession.variants || buildVariants(ids), selectedExplain: Array.isArray(savedSession.selectedExplain) ? savedSession.selectedExplain : [], answers: Array.isArray(savedSession.answers) ? savedSession.answers : [] };
      }
    }
  }

  function buildVariants(ids) {
    const output = {};
    ids.forEach((id) => {
      const c = BY_ID.get(id);
      if (!c) return;
      output[id] = {
        empathize: shuffle(c.empathize.options.map((o) => o.id)),
        define: shuffle(c.define.options.map((o) => o.id)),
        ideate: shuffle(c.ideate.options.map((o) => o.id)),
        prototype: shuffle(c.prototype.options.map((o) => o.id)),
        test: shuffle(c.test.options.map((o) => o.id)),
        iterate: shuffle(c.test.iterateOptions.map((o) => o.id)),
        explain: shuffle(c.explain.options)
      };
    });
    return output;
  }

  function variant(c) {
    if (!state.variants[c.id]) {
      state.variants = { ...state.variants, ...buildVariants([c.id]) };
      saveSession();
    }
    return state.variants[c.id];
  }

  function ordered(items, ids) {
    const map = new Map(items.map((item) => [item.id, item]));
    const result = ids.map((id) => map.get(id)).filter(Boolean);
    return result.length === items.length ? result : items;
  }

  function recentCoreIds() {
    const history = progress.roundHistory.filter((round) => round.mode !== 'tutorial');
    return unique(history.flatMap((round) => round.caseIds || []));
  }

  function recentTwoIds() {
    return unique(progress.roundHistory.filter((round) => round.mode !== 'tutorial').slice(-2).flatMap((round) => round.caseIds || []));
  }

  function buildReplayRound(challenge) {
    const used = new Set(recentCoreIds());
    const lastTwo = new Set(recentTwoIds());
    let candidates = CASE_BANK.filter((c) => !used.has(c.id));
    if (candidates.length < ROUND_SIZE) candidates = CASE_BANK.filter((c) => !lastTwo.has(c.id));
    if (candidates.length < ROUND_SIZE) candidates = CASE_BANK;

    let selected;
    if (challenge && Object.keys(progress.caseStats).length) {
      const weakFirst = [...candidates].sort((a, b) => caseAverage(a.id) - caseAverage(b.id));
      selected = weakFirst.slice(0, 2);
      const rest = shuffle(candidates.filter((c) => !selected.some((s) => s.id === c.id)));
      selected = [...selected, ...rest.slice(0, ROUND_SIZE - selected.length)];
    } else {
      selected = shuffle(candidates).slice(0, ROUND_SIZE);
    }
    return shuffle(selected.map((c) => c.id));
  }

  function caseAverage(id) {
    const record = progress.caseStats[id];
    return record && record.plays ? record.quality / record.plays : 0;
  }

  function challengeUnlocked() { return progress.tutorialBestStars >= 2 || progress.replayWins >= 1; }

  function startRound(mode) {
    if (!isW1Unlocked()) return;
    if (mode !== 'tutorial' && !progress.tutorialComplete) return;
    if (mode === 'challenge' && !challengeUnlocked()) return;
    const ids = mode === 'tutorial' ? FIRST_RUN.map((c) => c.id) : buildReplayRound(mode === 'challenge');
    state = { ...freshState(), mode, caseIds: ids, variants: buildVariants(ids) };
    saveSession();
    render();
    scrollTop();
  }

  function updateHud() {
    const active = Boolean(state.mode && state.caseIds.length && !state.complete);
    $('#caseValue').textContent = active ? `${modeMeta().badge} ${state.caseIndex + 1}/${state.caseIds.length}` : 'เลือกโหมด';
    $('#scoreValue').textContent = active ? state.score : progress.bestScore || 0;
    $('#sprintValue').textContent = active ? state.sprint : 100;
    $('#exitBtn').textContent = active ? 'ออกจากรอบ' : 'กลับ Hub';
  }

  function updateRail() {
    document.querySelectorAll('#phaseRail .phase').forEach((item, index) => {
      item.classList.toggle('active', Boolean(state.mode) && index === state.step && !state.complete);
      item.classList.toggle('done', Boolean(state.mode) && index < state.step);
    });
  }

  function showFeedback({ title, correct, message, principle, label }) {
    feedbackContent.innerHTML = `
      <p class="eyebrow">SPRINT FEEDBACK</p>
      <h2>${escapeHtml(title)}</h2>
      <div class="verdict ${correct ? 'good' : 'retry'}">${correct ? '✓ Evidence-based decision' : '↻ กลับไปดูหลักฐานผู้ใช้อีกครั้ง'}</div>
      <p>${escapeHtml(message)}</p>
      ${principle && state.mode !== 'challenge' ? `<div class="principle-card"><b>Principle</b><span>${escapeHtml(principle)}</span></div>` : ''}
      <button id="feedbackContinue" class="primary-btn full-btn" type="button">${escapeHtml(label || 'ทำต่อ →')}</button>
    `;
    feedbackDialog.showModal();
    $('#feedbackContinue').addEventListener('click', () => feedbackDialog.close(), { once: true });
  }

  function penalty(amount) {
    state.attempts += 1;
    state.sprint = clamp(state.sprint - (state.mode === 'challenge' ? amount + 2 : amount), 0, 100);
    saveSession();
  }

  function modeSelect() {
    const unlocked = isW1Unlocked();
    stage.innerHTML = `
      <section class="sprint-mode-shell">
        <p class="eyebrow">W2 • DESIGN THINKING SPRINT</p>
        <h2>นำทีมจาก “เสียงผู้ใช้” ไปสู่ “การเรียนรู้”</h2>
        <p>แต่ละ Sprint ไม่ได้ถามว่าอะไรดูสวยที่สุด แต่ถามว่าทีมมีหลักฐานพอหรือยังที่จะ Define, Ideate, Prototype และ Test ได้อย่างมีเหตุผล</p>
        <div class="sprint-overview-grid">
          <div><span>Core Case Bank</span><b>${CASE_BANK.length}</b></div>
          <div><span>Best Stars</span><b>${stars(progress.bestStars)}</b></div>
          <div><span>Rounds Finished</span><b>${progress.totalRounds}</b></div>
        </div>
        ${unlocked ? `
          <div class="sprint-mode-actions">
            <button class="sprint-mode-action" id="tutorialBtn" type="button"><span class="sprint-mode-action__icon">1</span><span><strong>${progress.tutorialComplete ? 'Review Tutorial Sprint' : 'First Run Tutorial'}</strong><small>5 Sprint แบบมีคำอธิบาย กระบวนการครบ Empathize → Test</small></span><b class="sprint-mode-action__arrow">→</b></button>
            <button class="sprint-mode-action" id="replayBtn" type="button" ${progress.tutorialComplete ? '' : 'disabled'}><span class="sprint-mode-action__icon">↻</span><span><strong>Random Sprint</strong><small>${progress.tutorialComplete ? 'สุ่ม 5 Case จาก 30 Core Case • ไม่ซ้ำก่อนครบ 6 รอบ' : 'ผ่าน Tutorial ก่อนจึงจะเปิด Replay'}</small></span><b class="sprint-mode-action__arrow">→</b></button>
            <button class="sprint-mode-action" id="challengeBtn" type="button" ${challengeUnlocked() ? '' : 'disabled'}><span class="sprint-mode-action__icon">⚡</span><span><strong>Transfer Sprint</strong><small>${challengeUnlocked() ? 'เลือกบริบทใหม่และลด Principle Hint เพื่อวัดการใช้กระบวนการจริง' : 'ปลดล็อกเมื่อ Tutorial ได้ 2★ หรือผ่าน Replay 1 รอบ'}</small></span><b class="sprint-mode-action__arrow">→</b></button>
          </div>` : `
          <div class="sprint-takeaway"><b>W2 Locked</b><span>ผ่าน W1 Crisis Casefile ระดับ 2★ Readiness ก่อนเริ่ม Design Thinking Sprint</span></div>
          <div class="sprint-actions"><a class="primary-btn" href="./w1-ux-crisis-casefile.html?v=w2-gate-v13">กลับไปฝึก W1 Casefile →</a></div>`}
      </section>`;
    if (!unlocked) return;
    $('#tutorialBtn').addEventListener('click', () => startRound('tutorial'));
    $('#replayBtn').addEventListener('click', () => { if (progress.tutorialComplete) startRound('replay'); });
    $('#challengeBtn').addEventListener('click', () => { if (challengeUnlocked()) startRound('challenge'); });
  }

  function evidenceDeck(c) {
    return `<div class="signal-deck">
      <article class="signal-card"><span class="signal-card__label">USER GOAL</span><strong>${escapeHtml(c.goal)}</strong><p>${escapeHtml(c.persona)}</p></article>
      <article class="signal-card"><span class="signal-card__label">USER QUOTE</span><strong>“${escapeHtml(c.quote)}”</strong><p>คำพูดตรงจากผู้ใช้</p></article>
      <article class="signal-card"><span class="signal-card__label">OBSERVED BEHAVIOR</span><strong>${escapeHtml(c.behavior)}</strong><p>${escapeHtml(c.constraint)}</p></article>
    </div>`;
  }

  function answerOption(item) {
    return `<button class="sprint-answer ${state.selected === item.id ? 'selected' : ''}" data-answer="${escapeHtml(item.id)}" type="button"><span class="sprint-radio"></span><span>${escapeHtml(item.text)}</span></button>`;
  }

  function questionFrame(c, phase, prompt, options, note) {
    stage.innerHTML = `
      <section class="sprint-workspace">
        <div class="sprint-kicker"><span>${escapeHtml(modeMeta().badge)}</span><span>SPRINT ${state.caseIndex + 1}/${state.caseIds.length}</span><span>${escapeHtml(c.service)}</span></div>
        <h2 class="sprint-title">${escapeHtml(c.title)}</h2>
        <p class="sprint-intro">${escapeHtml(c.goal)}</p>
        ${state.step === 0 ? evidenceDeck(c) : ''}
        <div class="sprint-board">
          <div class="sprint-decision-panel">
            <p class="eyebrow">${escapeHtml(phase)}</p>
            <h3 class="sprint-prompt">${escapeHtml(prompt)}</h3>
            ${note ? `<p class="sprint-question-note">${escapeHtml(note)}</p>` : ''}
            <div class="sprint-answer-list">${options.map(answerOption).join('')}</div>
          </div>
          <aside class="sprint-side-panel">
            <h3>Team Focus</h3>
            <p>อย่ากระโดดไปสร้าง solution ก่อนเห็นหลักฐานและความต้องการของผู้ใช้</p>
            <ul><li>เริ่มจาก task จริง</li><li>ทดสอบสมมติฐานสำคัญ</li><li>ใช้ผลทดสอบตัดสินใจรอบถัดไป</li></ul>
          </aside>
        </div>
        <div class="sprint-actions"><button id="nextBtn" class="primary-btn" type="button" ${state.selected ? '' : 'disabled'}>ยืนยันการตัดสินใจ →</button></div>
      </section>`;
    document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => { state.selected = button.dataset.answer; saveSession(); render(); }));
  }

  function renderEmpathize() {
    const c = current(); const v = variant(c);
    const options = ordered(c.empathize.options, v.empathize);
    questionFrame(c, 'PHASE 1 • EMPATHIZE', c.empathize.prompt, options, 'เลือก Insight ที่อิงจาก User Goal, Quote และ Behavior ไม่ใช่สิ่งที่ทีมอยากทำ');
    $('#nextBtn').addEventListener('click', () => resolve(c, c.empathize.options, 'empathize', 14, 5, 1, c.empathize.principle || 'Start with evidence', 'คำตอบที่ดีต้องสะท้อนสิ่งที่ผู้ใช้กำลังพยายามทำและจุดที่ติดขัด'));
  }

  function renderDefine() {
    const c = current(); const v = variant(c);
    questionFrame(c, 'PHASE 2 • DEFINE', c.define.prompt, ordered(c.define.options, v.define), 'Problem Statement ที่ดีบอกว่า “ใคร ต้องการอะไร และเพราะอะไร” ก่อนเลือก solution');
    $('#nextBtn').addEventListener('click', () => resolve(c, c.define.options, 'define', 18, 6, 2, c.define.principle, 'ยังเป็น Solution-first อยู่ ลองกลับมาเขียนความต้องการของผู้ใช้ให้ชัดก่อน'));
  }

  function renderIdeate() {
    const c = current(); const v = variant(c);
    questionFrame(c, 'PHASE 3 • IDEATE', c.ideate.prompt, ordered(c.ideate.options, v.ideate), 'ไอเดียแรกไม่จำเป็นต้องใหญ่ที่สุด แต่ควรทดสอบสมมติฐานสำคัญที่สุด');
    $('#nextBtn').addEventListener('click', () => resolve(c, c.ideate.options, 'ideate', 18, 6, 3, c.ideate.principle, 'ไอเดียนี้ดูเพิ่มของให้ระบบ แต่ยังไม่ได้พิสูจน์ว่าจะช่วย User Need หลักหรือไม่'));
  }

  function renderPrototype() {
    const c = current(); const v = variant(c);
    stage.innerHTML = `
      <section class="sprint-workspace">
        <div class="sprint-kicker"><span>${escapeHtml(modeMeta().badge)}</span><span>SPRINT ${state.caseIndex + 1}/${state.caseIds.length}</span><span>${escapeHtml(c.service)}</span></div>
        <h2 class="sprint-title">Prototype เพื่อเรียนรู้ ไม่ใช่สร้างทั้งระบบ</h2>
        <div class="sprint-board">
          <div class="sprint-decision-panel">
            <p class="eyebrow">PHASE 4 • PROTOTYPE</p><h3 class="sprint-prompt">${escapeHtml(c.prototype.prompt)}</h3>
            <p class="sprint-question-note">ต้นแบบควรพอให้ผู้ใช้ทำ task สำคัญได้ และพอให้ทีมสังเกตจุดที่ต้องเรียนรู้</p>
            <div class="sprint-answer-list">${ordered(c.prototype.options, v.prototype).map(answerOption).join('')}</div>
          </div>
          <aside class="sprint-side-panel"><h3>Prototype Scope</h3><p>ทำให้ผู้ใช้ “ลองทำงาน” ได้ก่อน ไม่ต้องสร้างทุกหน้า ทุกข้อมูล หรือทุก animation</p><div class="prototype-preview"><b>Low-fi task flow</b><div class="prototype-preview__bars"><span></span><span></span><span></span></div></div></aside>
        </div>
        <div class="sprint-actions"><button id="nextBtn" class="primary-btn" type="button" ${state.selected ? '' : 'disabled'}>เตรียม Test →</button></div>
      </section>`;
    document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => { state.selected = button.dataset.answer; saveSession(); renderPrototype(); }));
    $('#nextBtn').addEventListener('click', () => resolve(c, c.prototype.options, 'prototype', 18, 6, 4, c.prototype.principle, 'Prototype นี้ใหญ่เกินไปหรือไม่มี task ให้ผู้ใช้ทำ จึงเรียนรู้จากพฤติกรรมจริงได้ยาก'));
  }

  function renderTest() {
    const c = current(); const v = variant(c);
    if (state.testStage === 'plan') {
      questionFrame(c, 'PHASE 5 • TEST', c.test.prompt, ordered(c.test.options, v.test), 'ให้ผู้ใช้ทำ task จริง แล้วสังเกตความเข้าใจ ความลังเล และสิ่งที่เขาทำ ไม่ใช่ถามแค่ว่าชอบหรือไม่');
      $('#nextBtn').addEventListener('click', () => {
        const selected = c.test.options.find((o) => o.id === state.selected);
        if (!selected || !selected.correct) {
          penalty(5);
          showFeedback({ title: 'แผนทดสอบยังไม่เห็นพฤติกรรมจริง', correct: false, message: 'คำถามความชอบหรือการให้ทีมลองเอง ไม่แทนการดูผู้ใช้ทำ task จริงได้', principle: c.test.principle, label: 'เลือกแผนทดสอบใหม่' });
          feedbackDialog.addEventListener('close', () => { state.selected = null; saveSession(); renderTest(); }, { once: true });
          return;
        }
        state.score += 14; state.testStage = 'iterate'; state.selected = null; saveSession(); render(); scrollTop();
      });
      return;
    }

    if (state.testStage === 'iterate') {
      stage.innerHTML = `
        <section class="sprint-workspace">
          <div class="sprint-kicker"><span>${escapeHtml(modeMeta().badge)}</span><span>SPRINT ${state.caseIndex + 1}/${state.caseIds.length}</span><span>TEST RESULT</span></div>
          <h2 class="sprint-title">ผลทดสอบบอกให้ทีมเรียนรู้อะไร?</h2>
          <div class="test-result-card"><b>Observed Result</b><p>${escapeHtml(c.test.result)}</p></div>
          <p class="eyebrow">ITERATE</p><h3 class="sprint-prompt">${escapeHtml(c.test.iteratePrompt)}</h3>
          <div class="sprint-answer-list">${ordered(c.test.iterateOptions, v.iterate).map(answerOption).join('')}</div>
          <div class="sprint-actions"><button id="nextBtn" class="primary-btn" type="button" ${state.selected ? '' : 'disabled'}>เลือกการปรับรอบถัดไป →</button></div>
        </section>`;
      document.querySelectorAll('[data-answer]').forEach((button) => button.addEventListener('click', () => { state.selected = button.dataset.answer; saveSession(); renderTest(); }));
      $('#nextBtn').addEventListener('click', () => {
        const selected = c.test.iterateOptions.find((o) => o.id === state.selected);
        if (!selected || !selected.correct) {
          penalty(5);
          showFeedback({ title: 'ยังไม่ได้แก้จากสิ่งที่ผู้ใช้ทำ', correct: false, message: 'การ Iterate ที่ดีต้องตอบผลทดสอบที่สังเกตได้ ไม่ใช่เพิ่มของหรือคงแบบเดิมโดยไม่ดูต้นเหตุ', principle: 'Use test results to decide the next loop', label: 'ตัดสินใจใหม่' });
          feedbackDialog.addEventListener('close', () => { state.selected = null; saveSession(); renderTest(); }, { once: true });
          return;
        }
        state.score += 10; state.testStage = 'explain'; state.selected = null; saveSession(); render(); scrollTop();
      });
      return;
    }

    const choices = v.explain || c.explain.options;
    const selectedSet = new Set(state.selectedExplain);
    stage.innerHTML = `
      <section class="sprint-workspace"><div class="sprint-kicker"><span>${escapeHtml(modeMeta().badge)}</span><span>FINAL REFLECTION</span></div>
      <h2 class="sprint-title">อธิบายเหตุผลของกระบวนการ</h2><p class="sprint-intro">เลือก 2 ข้อที่อธิบายว่าทำไมทีมจึงต้องวนกลับมาเรียนรู้จากผู้ใช้อยู่เสมอ</p>
      <h3 class="sprint-prompt">${escapeHtml(c.explain.prompt)}</h3>
      <div class="sprint-answer-list">${choices.map((choice) => `<button class="sprint-answer ${selectedSet.has(choice) ? 'selected' : ''}" data-explain="${escapeHtml(choice)}" type="button"><span class="sprint-radio"></span><span>${escapeHtml(choice)}</span></button>`).join('')}</div>
      <div class="sprint-actions"><button id="nextBtn" class="primary-btn" type="button" ${state.selectedExplain.length === 2 ? '' : 'disabled'}>${state.caseIndex === state.caseIds.length - 1 ? 'สรุป Sprint →' : 'ไป Sprint ถัดไป →'}</button></div></section>`;
    document.querySelectorAll('[data-explain]').forEach((button) => button.addEventListener('click', () => {
      const set = new Set(state.selectedExplain); const value = button.dataset.explain;
      if (set.has(value)) set.delete(value); else if (set.size < 2) set.add(value);
      state.selectedExplain = [...set]; saveSession(); renderTest();
    }));
    $('#nextBtn').addEventListener('click', () => resolveExplain(c));
  }

  function resolve(c, list, key, points, loss, nextStep, principle, incorrectMessage) {
    const selected = list.find((o) => o.id === state.selected);
    if (!selected || !selected.correct) {
      penalty(loss);
      showFeedback({ title: 'การตัดสินใจยังไม่ตรงจุด', correct: false, message: incorrectMessage, principle, label: 'เลือกอีกครั้ง' });
      feedbackDialog.addEventListener('close', () => { state.selected = null; saveSession(); render(); }, { once: true });
      return;
    }
    state.score += points; state.step = nextStep; state.selected = null; saveSession(); render(); scrollTop();
  }

  function resolveExplain(c) {
    const selected = state.selectedExplain;
    const correct = selected.length === 2 && selected.every((item) => c.explain.correct.includes(item)) && c.explain.correct.every((item) => selected.includes(item));
    if (!correct) {
      penalty(4);
      showFeedback({ title: 'ลองมองการเรียนรู้เป็นวงรอบ', correct: false, message: 'เลือกเหตุผลที่เชื่อมผลทดสอบกับการกลับไปปรับสมมติฐานหรือแบบในรอบถัดไป', principle: 'Design Thinking is iterative', label: 'เลือกอีกครั้ง' });
      feedbackDialog.addEventListener('close', () => { state.selectedExplain = []; saveSession(); renderTest(); }, { once: true });
      return;
    }
    state.score += 8;
    state.answers.push({ caseId: c.id, attempts: state.attempts, quality: clamp(100 - state.attempts * 15, 35, 100) });
    if (state.caseIndex === state.caseIds.length - 1) { completeRound(); return; }
    state.caseIndex += 1; state.step = 0; state.selected = null; state.selectedExplain = []; state.testStage = 'plan'; state.attempts = 0; saveSession(); render(); scrollTop();
  }

  function stars(count) { const n = clamp(Number(count) || 0, 0, 3); return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`; }
  function starCount() {
    const criteria = state.mode === 'challenge' ? [450, 385, 305, 72, 58, 44] : [450, 380, 300, 80, 60, 42];
    if (state.score >= criteria[0] && state.sprint >= criteria[3]) return 3;
    if (state.score >= criteria[1] && state.sprint >= criteria[4]) return 2;
    if (state.score >= criteria[2] && state.sprint >= criteria[5]) return 1;
    return 0;
  }

  function completeRound() {
    state.complete = true;
    if (!state.roundRecorded) {
      const star = starCount();
      progress.totalRounds += 1; progress.bestScore = Math.max(progress.bestScore, state.score); progress.bestStars = Math.max(progress.bestStars, star);
      if (state.mode === 'tutorial') { progress.tutorialComplete = progress.tutorialComplete || star >= 1; progress.tutorialBestStars = Math.max(progress.tutorialBestStars, star); }
      if (state.mode === 'replay' && star >= 1) progress.replayWins += 1;
      if (state.mode === 'challenge' && star >= 1) progress.challengeWins += 1;
      state.answers.forEach((a) => {
        const record = progress.caseStats[a.caseId] || { plays: 0, quality: 0, attempts: 0 };
        record.plays += 1; record.quality += a.quality; record.attempts += a.attempts; progress.caseStats[a.caseId] = record;
      });
      progress.roundHistory = [...progress.roundHistory, { mode: state.mode, caseIds: [...state.caseIds], score: state.score, sprint: state.sprint, stars: star, completedAt: new Date().toISOString() }].slice(-18);
      state.roundRecorded = true; saveProgress(); saveSession();
      window.dispatchEvent(new CustomEvent('uxquest:w2-complete', { detail: { stars: star, score: state.score, sprint: state.sprint } }));
    }
    render(); scrollTop();
  }

  function completeScreen() {
    const star = starCount();
    stage.innerHTML = `
      <section class="sprint-complete-card">
        <p class="eyebrow">MISSION COMPLETE • ${escapeHtml(modeMeta().badge)}</p>
        <div class="sprint-stars">${[0,1,2].map((n) => `<span class="${n < star ? '' : 'empty'}">★</span>`).join('')}</div>
        <h2>${escapeHtml(modeMeta().label)}: ${star === 3 ? 'Expert' : star === 2 ? 'Mastery' : star === 1 ? 'Clear' : 'Review Needed'}</h2>
        <p>คุณผ่าน ${state.caseIds.length} Sprint โดยใช้หลักฐานผู้ใช้เพื่อ Define ปัญหา สร้าง Prototype ที่พอดี และใช้ผล Test ตัดสินใจรอบถัดไป</p>
        <div class="sprint-complete-grid"><div><span>Final Score</span><b>${state.score}</b></div><div><span>Sprint Energy</span><b>${state.sprint}</b></div><div><span>Best Stars</span><b>${stars(progress.bestStars)}</b></div></div>
        <div class="sprint-takeaway"><b>W2 Takeaway</b><span>Design Thinking ไม่ได้มีค่าเพราะชื่อขั้นตอน แต่มีค่าเมื่อทีมยอมให้หลักฐานผู้ใช้และผลทดสอบเปลี่ยนการตัดสินใจของตน</span></div>
        <div class="sprint-mode-actions"><button id="nextReplay" class="sprint-mode-action" type="button"><span class="sprint-mode-action__icon">↻</span><span><strong>เล่น Random Sprint</strong><small>สุ่ม 5 Case ใหม่จาก Core Bank</small></span><b class="sprint-mode-action__arrow">→</b></button><button id="nextChallenge" class="sprint-mode-action" type="button" ${challengeUnlocked() ? '' : 'disabled'}><span class="sprint-mode-action__icon">⚡</span><span><strong>Transfer Sprint</strong><small>${challengeUnlocked() ? 'ฝึกใช้กระบวนการในบริบทใหม่' : 'ปลดล็อกเมื่อทำ Tutorial 2★ หรือผ่าน Replay 1 รอบ'}</small></span><b class="sprint-mode-action__arrow">→</b></button></div>
        <div class="sprint-actions"><button id="modeBtn" class="secondary-btn" type="button">เลือกโหมด</button><a class="secondary-btn" href="./index.html">กลับ Mission Control</a></div>
      </section>`;
    $('#nextReplay').addEventListener('click', () => startRound('replay'));
    $('#nextChallenge').addEventListener('click', () => { if (challengeUnlocked()) startRound('challenge'); });
    $('#modeBtn').addEventListener('click', () => { state = freshState(); clearSession(); render(); });
  }

  function lockedScreen() {
    stage.innerHTML = `<section class="sprint-mode-shell"><p class="eyebrow">ACCESS LOCKED</p><h2>ผ่าน W1 Casefile 2★ ก่อนเข้าสู่ W2</h2><p>Design Thinking Sprint เปิดเมื่อคุณผ่าน W1 Crisis Casefile ระดับ 2★ Readiness เพื่อยืนยันว่าคุณเชื่อม Evidence → Hypothesis → Fix → Test Decision ได้ก่อน</p><div class="sprint-actions"><a class="primary-btn" href="./w1-ux-crisis-casefile.html?v=w2-gate-v13">ไปฝึก W1 Casefile →</a></div></section>`;
  }

  function render() {
    updateHud(); updateRail();
    if (!isW1Unlocked()) { lockedScreen(); return; }
    if (!state.mode) { modeSelect(); return; }
    if (state.complete) { completeScreen(); return; }
    const views = [renderEmpathize, renderDefine, renderIdeate, renderPrototype, renderTest];
    (views[state.step] || renderEmpathize)();
  }

  function scrollTop() { requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' })); }

  function leaveRound() {
    if (state.mode && !state.complete && !confirm('ออกจาก Sprint ปัจจุบัน? ความคืบหน้ารอบนี้จะไม่ถูกนับ')) return;
    state = freshState(); clearSession(); render(); scrollTop();
  }

  function wire() {
    $('#howBtn').addEventListener('click', () => howDialog.showModal());
    document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => { const dialog = $(`#${button.dataset.close}`); if (dialog) dialog.close(); }));
    $('#exitBtn').addEventListener('click', () => { if (state.mode) leaveRound(); else window.location.href = './index.html'; });
    [howDialog, feedbackDialog].forEach((dialog) => dialog.addEventListener('click', (event) => { const box = dialog.getBoundingClientRect(); const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom; if (!inside) dialog.close(); }));
  }

  acceptW1CompletionLink();
  load(); wire(); render();
})();
