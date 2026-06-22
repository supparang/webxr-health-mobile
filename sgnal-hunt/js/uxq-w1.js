// === /sgnal-hunt/js/uxq-w1.js ===
// UX Quest • W1 UX Detective
// Case-by-Case UX Investigation
// Mobile-first Observe → Diagnose → Fix → Test → Explain

(function () {
  'use strict';

  const CASES = window.UXQ_W1_CASES || [];
  const STORAGE_KEY = 'uxquest-w1-case-investigation-v4';

  const $ = (selector) => document.querySelector(selector);

  const stage = $('#gameStage');
  const feedbackDialog = $('#feedbackDialog');
  const feedbackContent = $('#feedbackContent');
  const howDialog = $('#howDialog');

  let state = freshState();

  function freshState() {
    return {
      caseIndex: 0,
      step: 0,
      score: 0,
      stability: 100,

      selectedSuspect: null,
      selectedDiagnosis: null,
      selectedFix: null,
      selectedExplain: [],

      attempts: 0,
      answered: [],
      startedAt: Date.now(),
      complete: false
    };
  }

  function current() {
    return CASES[state.caseIndex];
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(input) {
    return String(input).replace(/[&<>'"]/g, (character) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      };

      return map[character];
    });
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (
        saved &&
        typeof saved.caseIndex === 'number' &&
        !saved.complete
      ) {
        state = {
          ...freshState(),
          ...saved
        };
      }
    } catch (error) {
      console.warn('Could not restore UX Quest progress.', error);
    }
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    state = freshState();
    render();
  }

  function updateHud() {
    $('#caseValue').textContent =
      `${Math.min(state.caseIndex + 1, CASES.length)}/${CASES.length}`;

    $('#scoreValue').textContent = state.score;
    $('#stabilityValue').textContent = state.stability;
  }

  function updateRail() {
    document.querySelectorAll('#phaseRail .phase').forEach((node, index) => {
      node.classList.toggle('active', index === state.step);
      node.classList.toggle('done', index < state.step);
    });
  }

  function showFeedback({
    title,
    verdict,
    message,
    principle,
    continueLabel = 'ทำขั้นตอนถัดไป →'
  }) {
    feedbackContent.innerHTML = `
      <p class="eyebrow">CASE FEEDBACK</p>

      <h2>${escapeHtml(title)}</h2>

      <div class="verdict ${verdict === 'correct' ? 'good' : 'retry'}">
        ${
          verdict === 'correct'
            ? '✓ วิเคราะห์ได้ตรงประเด็น'
            : '↻ ลองคิดจากเป้าหมายผู้ใช้อีกครั้ง'
        }
      </div>

      <p>${escapeHtml(message)}</p>

      ${
        principle
          ? `
            <div class="principle-card">
              <b>Principle</b>
              <span>${escapeHtml(principle)}</span>
            </div>
          `
          : ''
      }

      <button id="feedbackContinue" class="primary-btn full-btn" type="button">
        ${escapeHtml(continueLabel)}
      </button>
    `;

    feedbackDialog.showModal();

    $('#feedbackContinue').addEventListener(
      'click',
      () => feedbackDialog.close(),
      { once: true }
    );
  }

  function suspectOption(area) {
    const isSelected = state.selectedSuspect === area.id;

    const detail = Array.isArray(area.detail)
      ? area.detail.join(' • ')
      : area.detail;

    return `
      <button
        class="answer-option ${isSelected ? 'selected' : ''}"
        data-suspect="${escapeHtml(area.id)}"
        type="button"
      >
        <span class="radio-dot"></span>

        <span>
          <strong>${escapeHtml(area.label)}. ${escapeHtml(area.name)}</strong>
          <br />
          <small>${escapeHtml(detail)}</small>
        </span>
      </button>
    `;
  }

  function cardScreen(caseData) {
    const area = (item) => {
      const styles = {
        menu: 'area-menu',
        notice: 'area-notice',
        profile: 'area-profile',
        cta: 'area-cta',
        terms: 'area-terms',
        chat: 'area-chat',
        feedback: 'area-feedback',
        upload: 'area-upload',
        help: 'area-help',
        priority: 'area-priority',
        faq: 'area-faq',
        avatar: 'area-avatar',
        transfer: 'area-transfer',
        calendar: 'area-calendar',
        room: 'area-room'
      };

      const isSelected = state.selectedSuspect === item.id;

      const detail = Array.isArray(item.detail)
        ? `
          <div class="chip-stack">
            ${item.detail
              .map((value) => `<span>${escapeHtml(value)}</span>`)
              .join('')}
          </div>
        `
        : `<span>${escapeHtml(item.detail)}</span>`;

      return `
        <button
          class="suspect-zone ${styles[item.id] || ''} ${
            isSelected ? 'selected' : ''
          }"
          data-suspect="${escapeHtml(item.id)}"
          type="button"
        >
          <b>${escapeHtml(item.label)}</b>
          <small>${escapeHtml(item.name)}</small>
          ${detail}
        </button>
      `;
    };

    return `
      <div
        class="screen-shell"
        aria-label="หน้าจอจำลองของบริการ ${escapeHtml(caseData.service)}"
      >
        <div class="screen-top">
          <strong>Smart Campus</strong>
          <span>บริการ • ช่วยเหลือ • บัญชี</span>
        </div>

        <div class="screen-body">
          <h3>${escapeHtml(caseData.screen.heading)}</h3>

          <p>${escapeHtml(caseData.screen.subheading)}</p>

          <div class="wire-line"></div>

          <div class="screen-canvas">
            ${caseData.screen.areas.map(area).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function attachSuspectEvents() {
    document.querySelectorAll('[data-suspect]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedSuspect = button.dataset.suspect;
        save();
        renderObserve();
      });
    });
  }

  function continueObserve() {
    if (!state.selectedSuspect) {
      return;
    }

    const caseData = current();

    if (state.selectedSuspect !== caseData.suspectId) {
      state.attempts += 1;
      state.stability = clamp(state.stability - 6, 0, 100);

      save();

      showFeedback({
        title: 'จุดนี้ยังไม่ใช่ต้นเหตุหลัก',
        verdict: 'retry',
        message:
          'ลองย้อนกลับไปดู User Goal อีกครั้ง: ผู้ใช้ต้องการทำอะไรให้สำเร็จ และจุดใดขวางเป้าหมายนั้นมากที่สุด?',
        principle: 'Start from the user goal',
        continueLabel: 'เลือกคำตอบใหม่'
      });

      feedbackDialog.addEventListener(
        'close',
        () => {
          state.selectedSuspect = null;
          save();
          renderObserve();
        },
        { once: true }
      );

      return;
    }

    state.step = 1;
    save();
    render();
  }

  function renderObserve() {
    const caseData = current();

    stage.innerHTML = `
      <section class="case-layout">
        <article class="mission-card">
          <div class="case-kicker">
            <span>CASE ${state.caseIndex + 1} / ${CASES.length}</span>
            <span>${escapeHtml(caseData.service)}</span>
          </div>

          <h2>${escapeHtml(caseData.title)}</h2>

          <div class="goal-card">
            <span>USER GOAL</span>
            <b>${escapeHtml(caseData.goal)}</b>
          </div>

          <p class="evidence-detail">
            “${escapeHtml(caseData.quote.replace(/[“”]/g, ''))}”
          </p>

          <p class="muted tiny">
            <b>ผู้ใช้:</b> ${escapeHtml(caseData.persona)}
          </p>

          <h3 class="question-title">
            จากเป้าหมายและคำพูดของผู้ใช้
            จุดใดควรตรวจสอบก่อน?
          </h3>

          <div class="answer-list">
            ${caseData.screen.areas.map(suspectOption).join('')}
          </div>

          <div class="stage-actions">
            <button
              id="observeNext"
              class="primary-btn full-btn"
              type="button"
              ${state.selectedSuspect ? '' : 'disabled'}
            >
              เก็บหลักฐานและวิเคราะห์ →
            </button>
          </div>

          <p class="muted tiny">
            เลือกคำตอบจากรายการด้านบนได้ทันที
            ไม่ต้องเลื่อนหาปุ่ม A/B/C ในหน้าจอจำลอง
          </p>
        </article>

        <article class="screen-card">
          ${cardScreen(caseData)}

          <div class="screen-caption">
            หน้าจอจำลองสำหรับดูบริบทเพิ่มเติม
            หรือแตะ A/B/C บนหน้าจอนี้ได้เช่นกัน
          </div>
        </article>
      </section>
    `;

    attachSuspectEvents();

    $('#observeNext').addEventListener('click', continueObserve);
  }

  function radioOption(option, stateKey) {
    const selected = state[stateKey] === option.id;

    return `
      <button
        class="answer-option ${selected ? 'selected' : ''}"
        data-answer="${escapeHtml(option.id)}"
        type="button"
      >
        <span class="radio-dot"></span>
        <span>${escapeHtml(option.text)}</span>
      </button>
    `;
  }

  function renderDiagnose() {
    const caseData = current();

    const suspectArea = caseData.screen.areas.find(
      (item) => item.id === caseData.suspectId
    );

    const suspectDetail = Array.isArray(suspectArea.detail)
      ? suspectArea.detail.join(' • ')
      : suspectArea.detail;

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">EVIDENCE COLLECTED</p>

          <h2>${escapeHtml(suspectArea.name)}</h2>

          <p class="evidence-detail">
            ${escapeHtml(suspectDetail)}
          </p>

          <div class="instruction-card">
            <span class="step-badge">STEP 2</span>

            <div>
              <b>วิเคราะห์ UI → UX</b>

              <p>
                เลือกคำอธิบายที่เชื่อมสิ่งที่เห็นบนหน้าจอ
                กับผลที่เกิดกับเป้าหมายของผู้ใช้ได้ดีที่สุด
              </p>
            </div>
          </div>

          <h3 class="question-title">
            ${escapeHtml(caseData.diagnosis.prompt)}
          </h3>

          <div class="answer-list">
            ${caseData.diagnosis.options
              .map((option) => radioOption(option, 'selectedDiagnosis'))
              .join('')}
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="diagnoseNext"
          class="primary-btn"
          type="button"
          ${state.selectedDiagnosis ? '' : 'disabled'}
        >
          ยืนยันการวิเคราะห์ →
        </button>
      </div>
    `;

    document.querySelectorAll('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedDiagnosis = button.dataset.answer;
        save();
        renderDiagnose();
      });
    });

    $('#diagnoseNext').addEventListener('click', () => {
      const picked = caseData.diagnosis.options.find(
        (option) => option.id === state.selectedDiagnosis
      );

      if (!picked) {
        return;
      }

      if (!picked.correct) {
        state.attempts += 1;
        state.stability = clamp(state.stability - 5, 0, 100);

        save();

        showFeedback({
          title: 'ยังเชื่อมกับผู้ใช้ไม่พอ',
          verdict: 'retry',
          message:
            'คำตอบที่แข็งแรงต้องเชื่อมได้ทั้ง UI symptom และ UX impact ไม่ใช่เพียงบอกว่าสิ่งใดดูสวยหรือไม่สวย',
          principle: 'UI affects UX',
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedDiagnosis = null;
            save();
            renderDiagnose();
          },
          { once: true }
        );

        return;
      }

      state.score += 18;
      state.step = 2;

      save();
      render();
    });
  }

  function renderFix() {
    const caseData = current();

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">DESIGN DECISION</p>

          <h2>เลือกการแก้ที่ช่วยผู้ใช้ทำงานสำเร็จ</h2>

          <p class="muted">
            เลือกวิธีแก้ที่ตอบ User Goal มากที่สุด
            ไม่ใช่วิธีที่ดูสวยเพียงอย่างเดียว
          </p>

          <div class="instruction-card">
            <span class="step-badge">STEP 3</span>

            <div>
              <b>เลือก Design Fix</b>

              <p>
                ทุกทางเลือกทำได้ในเชิงเทคนิค
                แต่มีเพียงหนึ่งแนวทางที่แก้ต้นเหตุของความติดขัด
              </p>
            </div>
          </div>

          <div class="answer-list fix-list">
            ${caseData.fixes
              .map((option) => radioOption(option, 'selectedFix'))
              .join('')}
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="fixNext"
          class="primary-btn"
          type="button"
          ${state.selectedFix ? '' : 'disabled'}
        >
          ทดสอบกับผู้ใช้ →
        </button>
      </div>
    `;

    document.querySelectorAll('[data-answer]').forEach((button) => {
      button.addEventListener('click', () => {
        state.selectedFix = button.dataset.answer;
        save();
        renderFix();
      });
    });

    $('#fixNext').addEventListener('click', () => {
      const picked = caseData.fixes.find(
        (option) => option.id === state.selectedFix
      );

      if (!picked) {
        return;
      }

      if (!picked.correct) {
        state.attempts += 1;
        state.stability = clamp(state.stability - 7, 0, 100);

        save();

        showFeedback({
          title: 'การแก้นี้ยังไม่ตรงต้นเหตุ',
          verdict: 'retry',
          message:
            'ลองกลับมาถามว่า วิธีนี้ทำให้ผู้ใช้บรรลุ User Goal ได้ชัดเจนขึ้นจริงหรือไม่?',
          principle: caseData.diagnosis.principle,
          continueLabel: 'เลือกวิธีแก้ใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedFix = null;
            save();
            renderFix();
          },
          { once: true }
        );

        return;
      }

      state.score += 22;
      state.step = 3;

      save();
      render();
    });
  }

  function metric(label, before, after, symbol = '') {
    return `
      <div class="metric-card">
        <span>${escapeHtml(label)}</span>

        <div>
          <b class="before">${escapeHtml(String(before))}${symbol}</b>
          <i>→</i>
          <b class="after">${escapeHtml(String(after))}${symbol}</b>
        </div>
      </div>
    `;
  }

  function renderUserTest() {
    const caseData = current();
    const result = caseData.result;

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">USER TEST SIMULATION</p>

          <h2>ผลลัพธ์หลังปรับการออกแบบ</h2>

          <p>${escapeHtml(result.text)}</p>

          <div class="instruction-card">
            <span class="step-badge">STEP 4</span>

            <div>
              <b>ดูผลที่เกิดกับผู้ใช้</b>

              <p>
                การแก้ที่ดีไม่ใช่เพียงหน้าจอดูดีขึ้น
                แต่ต้องช่วยให้ผู้ใช้สำเร็จเร็วขึ้นและมั่นใจขึ้น
              </p>
            </div>
          </div>

          <div class="metric-grid">
            ${metric(
              'Task success',
              result.before.success,
              result.after.success,
              '%'
            )}

            ${metric(
              'Time to finish',
              result.before.time,
              result.after.time
            )}

            ${metric(
              'User confidence',
              result.before.confidence,
              result.after.confidence,
              '%'
            )}
          </div>

          <div class="test-insight">
            <b>สิ่งที่ควรจำ</b>

            <span>
              Design decision ต้องเชื่อมกับผลลัพธ์ที่ผู้ใช้สัมผัสได้
            </span>
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button id="testNext" class="primary-btn" type="button">
          อธิบายเหตุผล →
        </button>
      </div>
    `;

    $('#testNext').addEventListener('click', () => {
      state.score += 10;
      state.step = 4;

      save();
      render();
    });
  }

  function renderExplain() {
    const caseData = current();
    const selected = new Set(state.selectedExplain);

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">EXPLAIN CHECK</p>

          <h2>สรุปด้วยเหตุผลของคุณ</h2>

          <div class="instruction-card">
            <span class="step-badge">STEP 5</span>

            <div>
              <b>เลือก 2 ผลลัพธ์ที่เกิดกับผู้ใช้จริง</b>

              <p>
                ไม่ใช่คำที่ฟังดูดี
                แต่เป็นผลลัพธ์ที่ตามมาจาก Design Fix ของคุณ
              </p>
            </div>
          </div>

          <h3 class="question-title">
            ${escapeHtml(caseData.explain.prompt)}
          </h3>

          <div class="choice-grid">
            ${caseData.explain.choices
              .map(
                (choice) => `
                  <button
                    class="explain-chip ${
                      selected.has(choice) ? 'selected' : ''
                    }"
                    data-explain="${escapeHtml(choice)}"
                    type="button"
                  >
                    ${escapeHtml(choice)}
                  </button>
                `
              )
              .join('')}
          </div>

          <p class="selection-note">
            เลือกแล้ว ${state.selectedExplain.length}/2
          </p>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="explainNext"
          class="primary-btn"
          type="button"
          ${state.selectedExplain.length === 2 ? '' : 'disabled'}
        >
          ${
            state.caseIndex === CASES.length - 1
              ? 'สรุปผลภารกิจ →'
              : 'ไป Case ถัดไป →'
          }
        </button>
      </div>
    `;

    document.querySelectorAll('[data-explain]').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.explain;
        const selectedChoices = new Set(state.selectedExplain);

        if (selectedChoices.has(value)) {
          selectedChoices.delete(value);
        } else if (selectedChoices.size < 2) {
          selectedChoices.add(value);
        }

        state.selectedExplain = Array.from(selectedChoices);

        save();
        renderExplain();
      });
    });

    $('#explainNext').addEventListener('click', () => {
      if (state.selectedExplain.length !== 2) {
        return;
      }

      const correct =
        state.selectedExplain.every((choice) =>
          caseData.explain.correct.includes(choice)
        ) &&
        caseData.explain.correct.every((choice) =>
          state.selectedExplain.includes(choice)
        );

      if (!correct) {
        state.attempts += 1;
        state.stability = clamp(state.stability - 5, 0, 100);

        save();

        showFeedback({
          title: 'ลองเชื่อมกับผล User Test',
          verdict: 'retry',
          message:
            'เลือกคำที่อธิบายว่าผู้ใช้ทำเป้าหมายได้ดีขึ้นอย่างไร จากผลการทดสอบที่คุณเพิ่งเห็น',
          principle: caseData.diagnosis.principle,
          continueLabel: 'เลือกคำตอบใหม่'
        });

        feedbackDialog.addEventListener(
          'close',
          () => {
            state.selectedExplain = [];
            save();
            renderExplain();
          },
          { once: true }
        );

        return;
      }

      state.score += 20;

      state.answered.push({
        id: caseData.id,
        attempts: state.attempts
      });

      if (state.caseIndex >= CASES.length - 1) {
        state.complete = true;
        save();
        renderComplete();
        return;
      }

      state.caseIndex += 1;
      state.step = 0;
      state.selectedSuspect = null;
      state.selectedDiagnosis = null;
      state.selectedFix = null;
      state.selectedExplain = [];
      state.attempts = 0;

      save();
      render();
    });
  }

  function stars() {
    if (state.score >= 320 && state.stability >= 80) {
      return 3;
    }

    if (state.score >= 260 && state.stability >= 60) {
      return 2;
    }

    if (state.score >= 200) {
      return 1;
    }

    return 0;
  }

  function renderComplete() {
    const starCount = stars();

    const starsHtml = Array.from(
      { length: 3 },
      (_, index) => `
        <span class="final-star ${index < starCount ? 'earned' : ''}">
          ★
        </span>
      `
    ).join('');

    const title =
      starCount === 3
        ? 'UX Detective: Expert'
        : starCount === 2
          ? 'UX Detective: Mastery'
          : starCount === 1
            ? 'UX Detective: Clear'
            : 'ต้องทบทวนอีกเล็กน้อย';

    stage.innerHTML = `
      <section class="complete-card">
        <p class="eyebrow">MISSION COMPLETE</p>

        <div class="final-stars">${starsHtml}</div>

        <h2>${title}</h2>

        <p>
          คุณผ่าน 5 Case โดยฝึกเชื่อม
          User Goal → UI Symptom → UX Impact → Design Fix → User Test
        </p>

        <div class="complete-metrics">
          <div>
            <span>Final Score</span>
            <b>${state.score}</b>
          </div>

          <div>
            <span>Stability</span>
            <b>${state.stability}</b>
          </div>

          <div>
            <span>Cases Cleared</span>
            <b>${CASES.length}/${CASES.length}</b>
          </div>
        </div>

        <div class="principle-stack">
          <b>W1 Takeaway</b>

          <span>
            UI คือสิ่งที่ผู้ใช้เห็นและโต้ตอบ
            ส่วน UX คือผลของการออกแบบต่อความสามารถของผู้ใช้
            ในการทำเป้าหมายให้สำเร็จ
          </span>
        </div>

        <div class="stage-actions center-actions">
          <button id="replayBtn" class="primary-btn" type="button">
            เล่นใหม่เพื่อเก็บดาว →
          </button>

          <a class="ghost-btn" href="./index.html">
            กลับ Mission Control
          </a>
        </div>
      </section>
    `;

    $('#replayBtn').addEventListener('click', reset);
  }

  function render() {
    updateHud();
    updateRail();

    if (state.complete) {
      renderComplete();
      return;
    }

    const renderSteps = [
      renderObserve,
      renderDiagnose,
      renderFix,
      renderUserTest,
      renderExplain
    ];

    renderSteps[state.step]();
  }

  function wireStaticEvents() {
    $('#howBtn').addEventListener('click', () => {
      howDialog.showModal();
    });

    document.querySelectorAll('[data-close]').forEach((button) => {
      button.addEventListener('click', () => {
        const dialog = $(`#${button.dataset.close}`);

        if (dialog) {
          dialog.close();
        }
      });
    });

    $('#resetBtn').addEventListener('click', () => {
      const confirmed = confirm(
        'เริ่มภารกิจใหม่? ความคืบหน้าของ W1 ในเครื่องนี้จะถูกล้าง'
      );

      if (confirmed) {
        reset();
      }
    });

    [howDialog, feedbackDialog].forEach((dialog) => {
      dialog.addEventListener('click', (event) => {
        const bounds = dialog.getBoundingClientRect();

        const clickedInsideDialog =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;

        if (!clickedInsideDialog) {
          dialog.close();
        }
      });
    });
  }

  restore();
  wireStaticEvents();
  render();
})();