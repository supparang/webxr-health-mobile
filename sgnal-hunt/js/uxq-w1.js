(function(){
  'use strict';

  const CASES = window.UXQ_W1_CASES || [];
  const STORAGE_KEY = 'uxquest-w1-case-investigation-v3';
  const $ = (sel) => document.querySelector(sel);
  const stage = $('#gameStage');
  const feedbackDialog = $('#feedbackDialog');
  const feedbackContent = $('#feedbackContent');
  const howDialog = $('#howDialog');

  let state = freshState();

  function freshState(){
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

  function current(){ return CASES[state.caseIndex]; }
  function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

  function save(){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function restore(){
    try{
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if(saved && typeof saved.caseIndex === 'number' && !saved.complete){
        state = { ...freshState(), ...saved };
      }
    }catch(err){
      /* ignore corrupted local state */
    }
  }

  function reset(){
    localStorage.removeItem(STORAGE_KEY);
    state = freshState();
    render();
  }

  function updateHud(){
    $('#caseValue').textContent =
      `${Math.min(state.caseIndex + 1, CASES.length)}/${CASES.length}`;
    $('#scoreValue').textContent = state.score;
    $('#stabilityValue').textContent = state.stability;
  }

  function updateRail(){
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
  }){
    feedbackContent.innerHTML = `
      <p class="eyebrow">CASE FEEDBACK</p>
      <h2>${escapeHtml(title)}</h2>

      <div class="verdict ${verdict === 'correct' ? 'good' : 'retry'}">
        ${
          verdict === 'correct'
            ? '✓ วิเคราะห์ได้ตรงประเด็น'
            : '↻ ลองมองจากเป้าหมายผู้ใช้อีกครั้ง'
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
        ${continueLabel}
      </button>
    `;

    feedbackDialog.showModal();

    $('#feedbackContinue').addEventListener(
      'click',
      () => feedbackDialog.close(),
      { once: true }
    );
  }

  function escapeHtml(input){
    return String(input).replace(/[&<>'"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[ch]));
  }

  function cardScreen(c){
    const area = (a) => {
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

      const isSelected = state.selectedSuspect === a.id;

      const detail = Array.isArray(a.detail)
        ? `
          <div class="chip-stack">
            ${a.detail.map(x => `<span>${escapeHtml(x)}</span>`).join('')}
          </div>
        `
        : `<span>${escapeHtml(a.detail)}</span>`;

      return `
        <button
          class="suspect-zone ${styles[a.id] || ''} ${isSelected ? 'selected' : ''}"
          data-suspect="${a.id}"
          type="button"
        >
          <b>${a.label}</b>
          <small>${escapeHtml(a.name)}</small>
          ${detail}
        </button>
      `;
    };

    return `
      <div class="screen-shell" aria-label="หน้าจอจำลองของบริการ ${escapeHtml(c.service)}">
        <div class="screen-top">
          <strong>Smart Campus</strong>
          <span>บริการ • ช่วยเหลือ • บัญชี</span>
        </div>

        <div class="screen-body">
          <h3>${escapeHtml(c.screen.heading)}</h3>
          <p>${escapeHtml(c.screen.subheading)}</p>

          <div class="wire-line"></div>

          <div class="screen-canvas">
            ${c.screen.areas.map(area).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderObserve(){
    const c = current();

    stage.innerHTML = `
      <section class="case-layout">
        <article class="mission-card">
          <div class="case-kicker">
            <span>CASE ${state.caseIndex + 1} / ${CASES.length}</span>
            <span>${escapeHtml(c.service)}</span>
          </div>

          <h2>${escapeHtml(c.title)}</h2>

          <div class="goal-card">
            <span>USER GOAL</span>
            <b>${escapeHtml(c.goal)}</b>
          </div>

          <blockquote>${escapeHtml(c.quote)}</blockquote>

          <div class="persona-card">
            <b>${escapeHtml(c.persona)}</b>
            <span>กำลังพยายามทำงานให้สำเร็จผ่านระบบนี้</span>
          </div>

          <div class="instruction-card">
            <span class="step-badge">STEP 1</span>
            <div>
              <b>เลือกจุดที่คุณจะสืบก่อน</b>
              <p>
                แตะ A, B หรือ C บนหน้าจอ
                แล้วตอบว่าอะไรน่าจะขวางเป้าหมายของผู้ใช้มากที่สุด
              </p>
            </div>
          </div>

          <div class="choice-legend">
            <span>A–C คือพื้นที่ที่ตรวจสอบได้</span>
            <span>ไม่มีการกดแบบเดาสุ่ม</span>
          </div>
        </article>

        <article class="screen-card">
          ${cardScreen(c)}
          <div class="screen-caption">
            แตะพื้นที่ A, B หรือ C เพื่อเก็บหลักฐาน
          </div>
        </article>
      </section>

      <div class="stage-actions left-actions">
        <button
          id="observeNext"
          class="primary-btn"
          type="button"
          ${state.selectedSuspect ? '' : 'disabled'}
        >
          เก็บหลักฐานและวิเคราะห์ →
        </button>
      </div>
    `;

    document.querySelectorAll('[data-suspect]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedSuspect = btn.dataset.suspect;
        save();
        renderObserve();
      });
    });

    $('#observeNext').addEventListener('click', () => {
      if(!state.selectedSuspect) return;

      const c = current();

      if(state.selectedSuspect !== c.suspectId){
        state.attempts += 1;
        state.stability = clamp(state.stability - 6, 0, 100);
        save();

        showFeedback({
          title: 'หลักฐานยังไม่ชี้ต้นเหตุ',
          verdict: 'retry',
          message:
            'ลองย้อนกลับไปดู User Goal: ผู้ใช้ต้องการทำอะไรให้สำเร็จ และพื้นที่ใดทำให้เขาทำสิ่งนั้นยากที่สุด?',
          principle: 'Start from the user goal',
          continueLabel: 'เลือกจุดใหม่'
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
      }else{
        state.step = 1;
        save();
        render();
      }
    });
  }

  function radioOption(option, key){
    const selected = state[key] === option.id;

    return `
      <button
        class="answer-option ${selected ? 'selected' : ''}"
        data-answer="${option.id}"
        type="button"
      >
        <span class="radio-dot"></span>
        <span>${escapeHtml(option.text)}</span>
      </button>
    `;
  }

  function renderDiagnose(){
    const c = current();

    const suspectArea = c.screen.areas.find(x => x.id === c.suspectId);
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
                เลือกคำอธิบายที่เชื่อม “สิ่งที่เห็นบนหน้าจอ”
                กับ “ผลที่เกิดกับเป้าหมายของผู้ใช้” ได้ดีที่สุด
              </p>
            </div>
          </div>

          <h3 class="question-title">
            ${escapeHtml(c.diagnosis.prompt)}
          </h3>

          <div class="answer-list">
            ${c.diagnosis.options
              .map(o => radioOption(o, 'selectedDiagnosis'))
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

    document.querySelectorAll('[data-answer]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedDiagnosis = btn.dataset.answer;
        save();
        renderDiagnose();
      });
    });

    $('#diagnoseNext').addEventListener('click', () => {
      const picked = c.diagnosis.options.find(
        o => o.id === state.selectedDiagnosis
      );

      if(!picked) return;

      if(!picked.correct){
        state.attempts += 1;
        state.stability = clamp(state.stability - 5, 0, 100);
        save();

        showFeedback({
          title: 'ยังไม่เชื่อมกับผู้ใช้พอ',
          verdict: 'retry',
          message:
            'คำตอบที่แข็งแรงต้องบอกได้ทั้ง UI symptom และ UX impact ไม่ใช่บอกแค่สิ่งที่ดูสวยหรือไม่สวย',
          principle: 'UI affects UX'
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
      }else{
        state.score += 18;
        state.step = 2;
        save();
        render();
      }
    });
  }

  function renderFix(){
    const c = current();

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">DESIGN DECISION</p>

          <h2>เลือกการแก้ที่ช่วยผู้ใช้ทำงานสำเร็จ</h2>

          <p class="muted">
            เลือกวิธีแก้ที่ตอบ User Goal มากที่สุด
            ไม่ใช่วิธีที่ “ดูสวย” เพียงอย่างเดียว
          </p>

          <div class="instruction-card">
            <span class="step-badge">STEP 3</span>
            <div>
              <b>เลือก Design Fix</b>
              <p>
                ทุกทางเลือกทำได้ในเชิงเทคนิค
                แต่มีเพียงหนึ่งทางที่แก้ต้นเหตุของความติดขัด
              </p>
            </div>
          </div>

          <div class="answer-list fix-list">
            ${c.fixes.map(o => radioOption(o, 'selectedFix')).join('')}
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

    document.querySelectorAll('[data-answer]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedFix = btn.dataset.answer;
        save();
        renderFix();
      });
    });

    $('#fixNext').addEventListener('click', () => {
      const picked = c.fixes.find(o => o.id === state.selectedFix);

      if(!picked) return;

      if(!picked.correct){
        state.attempts += 1;
        state.stability = clamp(state.stability - 7, 0, 100);
        save();

        showFeedback({
          title: 'แก้ที่ปลายเหตุ',
          verdict: 'retry',
          message:
            'ลองกลับมาถามว่า วิธีนี้ทำให้ผู้ใช้บรรลุ User Goal ได้ชัดขึ้นหรือไม่?',
          principle: c.diagnosis.principle
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
      }else{
        state.score += 22;
        state.step = 3;
        save();
        render();
      }
    });
  }

  function metric(label, before, after, symbol = ''){
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

  function renderUserTest(){
    const c = current();
    const r = c.result;

    stage.innerHTML = `
      <section class="single-layout">
        <article class="mission-card wide">
          <p class="eyebrow">USER TEST SIMULATION</p>
          <h2>ผลลัพธ์หลังปรับการออกแบบ</h2>

          <p>${escapeHtml(r.text)}</p>

          <div class="instruction-card">
            <span class="step-badge">STEP 4</span>
            <div>
              <b>ดูผลที่เกิดกับผู้ใช้</b>
              <p>
                การแก้ที่ดีไม่ใช่แค่หน้าจอดูดีขึ้น
                แต่ต้องช่วยให้ผู้ใช้สำเร็จเร็วขึ้นและมั่นใจขึ้น
              </p>
            </div>
          </div>

          <div class="metric-grid">
            ${metric(
              'Task success',
              r.before.success,
              r.after.success,
              '%'
            )}

            ${metric(
              'Time to finish',
              r.before.time,
              r.after.time
            )}

            ${metric(
              'User confidence',
              r.before.confidence,
              r.after.confidence,
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

  function renderExplain(){
    const c = current();
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
            ${escapeHtml(c.explain.prompt)}
          </h3>

          <div class="choice-grid">
            ${c.explain.choices.map(choice => `
              <button
                class="explain-chip ${selected.has(choice) ? 'selected' : ''}"
                data-explain="${escapeHtml(choice)}"
                type="button"
              >
                ${escapeHtml(choice)}
              </button>
            `).join('')}
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

    document.querySelectorAll('[data-explain]').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = btn.dataset.explain;
        const set = new Set(state.selectedExplain);

        if(set.has(value)){
          set.delete(value);
        }else if(set.size < 2){
          set.add(value);
        }

        state.selectedExplain = Array.from(set);
        save();
        renderExplain();
      });
    });

    $('#explainNext').addEventListener('click', () => {
      if(state.selectedExplain.length !== 2) return;

      const correct =
        state.selectedExplain.every(x => c.explain.correct.includes(x)) &&
        c.explain.correct.every(x => state.selectedExplain.includes(x));

      if(!correct){
        state.attempts += 1;
        state.stability = clamp(state.stability - 5, 0, 100);
        save();

        showFeedback({
          title: 'ลองเชื่อมกับผล User Test',
          verdict: 'retry',
          message:
            'เลือกคำที่อธิบายว่าผู้ใช้ทำเป้าหมายได้ดีขึ้นอย่างไร จากผลลัพธ์ที่คุณเพิ่งเห็น',
          principle: c.diagnosis.principle
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
      }else{
        state.score += 20;
        state.answered.push({
          id: c.id,
          attempts: state.attempts
        });

        if(state.caseIndex >= CASES.length - 1){
          state.complete = true;
          save();
          renderComplete();
        }else{
          state.caseIndex += 1;
          state.step = 0;
          state.selectedSuspect = null;
          state.selectedDiagnosis = null;
          state.selectedFix = null;
          state.selectedExplain = [];
          state.attempts = 0;

          save();
          render();
        }
      }
    });
  }

  function stars(){
    const score = state.score;
    const stability = state.stability;

    if(score >= 320 && stability >= 80) return 3;
    if(score >= 260 && stability >= 60) return 2;
    return score >= 200 ? 1 : 0;
  }

  function renderComplete(){
    const starCount = stars();

    const starsHtml = Array.from(
      { length: 3 },
      (_, i) => `
        <span class="final-star ${i < starCount ? 'earned' : ''}">
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
          User Goal → UI symptom → UX impact → Design Fix → User Test
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
            <span>Cases cleared</span>
            <b>${CASES.length}/${CASES.length}</b>
          </div>
        </div>

        <div class="principle-stack">
          <b>W1 takeaway</b>
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

  function render(){
    updateHud();
    updateRail();

    if(state.complete){
      renderComplete();
      return;
    }

    const renders = [
      renderObserve,
      renderDiagnose,
      renderFix,
      renderUserTest,
      renderExplain
    ];

    renders[state.step]();
  }

  function wireStatic(){
    $('#howBtn').addEventListener('click', () => {
      howDialog.showModal();
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        $('#' + btn.dataset.close).close();
      });
    });

    $('#resetBtn').addEventListener('click', () => {
      if(confirm('เริ่มภารกิจใหม่? ความคืบหน้าของ W1 ในเครื่องนี้จะถูกล้าง')){
        reset();
      }
    });

    [howDialog, feedbackDialog].forEach(dialog => {
      dialog.addEventListener('click', event => {
        const box = dialog.getBoundingClientRect();

        const inside =
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom;

        if(!inside){
          dialog.close();
        }
      });
    });
  }

  restore();
  wireStatic();
  render();
})();