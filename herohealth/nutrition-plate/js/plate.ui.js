// === /herohealth/nutrition-plate/js/plate.ui.js ===
// UI renderer for Nutrition Plate
// PATCH v20260318-PLATE-RUN-FULL

import { esc, goHub } from '../../shared/nutrition-common.js';
import { mountSummaryShell } from '../../shared/nutrition-summary-shell.js';

const TIPS = {
  pre: 'แบบสั้นก่อนเริ่ม เพื่อดูพื้นฐานก่อนเล่น',
  build: 'เลือกอาหารมาประกอบเป็น 1 มื้อให้สมดุล',
  fix: 'ดูว่าจานตัวอย่างนี้ควรแก้ตรงไหนก่อน',
  swap: 'ลองสลับของเดิมเป็นตัวเลือกที่ดีกว่า',
  post: 'ตอบอีกครั้งหลังเล่น เพื่อดูว่าดีขึ้นไหม'
};

const PHASE_BANNER = {
  pre: { icon: '📝', title: 'แบบสั้นก่อนเล่น', sub: 'ลองดูว่าจานนี้ควรปรับตรงไหน' },
  build: { icon: '🍽️', title: 'จัดจานอาหาร', sub: 'เลือกอาหารให้ครบและสมดุล' },
  fix: { icon: '🛠️', title: 'ซ่อมจานตัวอย่าง', sub: 'ดูว่าควรแก้ตรงไหนก่อน' },
  swap: { icon: '🔄', title: 'สลับให้ดีขึ้น', sub: 'เปลี่ยนเป็นตัวเลือกที่เหมาะกว่า' },
  post: { icon: '🌟', title: 'แบบสั้นหลังเล่น', sub: 'ลองตอบอีกครั้งดูว่าเก่งขึ้นไหม' }
};

const SLOT_ORDER = ['base', 'protein', 'veg', 'fruit', 'drink'];
const SLOT_LABEL = {
  base: 'อาหารหลัก',
  protein: 'โปรตีน',
  veg: 'ผัก',
  fruit: 'ผลไม้/ของหวาน',
  drink: 'เครื่องดื่ม'
};

function renderPlateBoard(plate) {
  return SLOT_ORDER.map(slot => {
    const item = plate?.[slot];
    return `
      <div class="plate-slot child-slot">
        <div class="plate-slot-label">${esc(SLOT_LABEL[slot])}</div>
        <div class="plate-slot-value">${item ? `${esc(item.emoji)} ${esc(item.label)}` : '—'}</div>
        <div class="plate-slot-sub">${item ? 'เลือกแล้ว' : 'ยังไม่ได้เลือก'}</div>
      </div>
    `;
  }).join('');
}

export function createPlateUI(ctx, { onAnswer, onReplay, onSummaryBack, summaryBackLabel = 'ไปคูลดาวน์' }) {
  const phaseEl = document.getElementById('hudPhase');
  const progressEl = document.getElementById('hudProgress');
  const scoreEl = document.getElementById('hudScore');
  const streakEl = document.getElementById('hudStreak');
  const promptEl = document.getElementById('questionPrompt');
  const plateBoardEl = document.getElementById('plateBoard');
  const scenarioBoxEl = document.getElementById('scenarioBox');
  const gridEl = document.getElementById('answerGrid');
  const feedbackEl = document.getElementById('feedbackBox');
  const tipEl = document.getElementById('miniTip');
  const coachEl = document.getElementById('coachBox');
  const backBtn = document.getElementById('backBtn');

  const phaseBanner = {
    root: document.getElementById('phaseBanner'),
    icon: document.getElementById('phaseBannerIcon'),
    title: document.getElementById('phaseBannerTitle'),
    sub: document.getElementById('phaseBannerSub')
  };

  let answerLocked = false;

  const summaryShell = mountSummaryShell(document.body, {
    onReplay,
    onBack: () => (onSummaryBack ? onSummaryBack() : goHub(ctx)),
    backLabel: summaryBackLabel
  });

  backBtn.addEventListener('click', () => goHub(ctx));

  function setPhaseBanner(phaseKey) {
    const meta = PHASE_BANNER[phaseKey] || PHASE_BANNER.build;
    phaseBanner.root.setAttribute('data-phase', phaseKey);
    phaseBanner.icon.textContent = meta.icon;
    phaseBanner.title.textContent = meta.title;
    phaseBanner.sub.textContent = meta.sub;
  }

  function setHud(viewState) {
    phaseEl.textContent = `Phase: ${viewState.phaseLabel}`;
    progressEl.textContent = `${viewState.phaseCurrent} / ${viewState.phaseTotal}`;
    scoreEl.textContent = String(viewState.score);
    streakEl.textContent = String(viewState.streak);
    tipEl.textContent = TIPS[viewState.phaseKey] || '';
    plateBoardEl.innerHTML = renderPlateBoard(viewState.plate);
    setPhaseBanner(viewState.phaseKey);
  }

  function renderScenario(question) {
    if (question.type === 'fix' || question.type === 'quiz-missing') {
      scenarioBoxEl.innerHTML = `
        <div class="scenario-card child-card">
          <div class="scenario-title">${esc(question.scenarioTitle)}</div>
          <div class="scenario-grid">
            ${question.scenarioFoods.map(item => `
              <div class="scenario-item">
                <div class="scenario-emoji">${esc(item.emoji)}</div>
                <div>${esc(item.label)}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      return;
    }

    if (question.type === 'swap' || question.type === 'quiz-better') {
      scenarioBoxEl.innerHTML = `
        <div class="scenario-card child-card">
          <div class="scenario-title">สิ่งที่กำลังพิจารณา</div>
          <div class="scenario-grid">
            <div class="scenario-item">
              <div class="scenario-emoji">${esc(question.currentFood.emoji)}</div>
              <div>${esc(question.currentFood.label)}</div>
            </div>
          </div>
        </div>
      `;
      return;
    }

    scenarioBoxEl.innerHTML = '';
  }

  function renderAnswers(question) {
    answerLocked = false;
    gridEl.innerHTML = '';

    question.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn child-answer-btn';
      btn.type = 'button';
      btn.innerHTML = `
        <div class="answer-main">${esc(option.emoji)} ${esc(option.label)}</div>
        <small>${esc(option.slot || '')}</small>
      `;

      btn.addEventListener('click', async () => {
        if (answerLocked) return;
        answerLocked = true;

        Array.from(gridEl.querySelectorAll('.answer-btn')).forEach(node => {
          node.disabled = true;
          node.style.opacity = '0.72';
        });

        await onAnswer(option.id);
      });

      gridEl.appendChild(btn);
    });
  }

  function renderQuestion(viewState, question) {
    feedbackEl.className = 'feedback-box';
    feedbackEl.textContent = '';
    setHud(viewState);
    promptEl.textContent = question.prompt;
    renderScenario(question);
    renderAnswers(question);
  }

  function showFeedback(evaluation) {
    const toneClass =
      evaluation.tone === 'good'
        ? 'feedback-good'
        : evaluation.tone === 'bad'
        ? 'feedback-bad'
        : 'feedback-note';

    feedbackEl.className = `feedback-box ${toneClass}`;
    feedbackEl.textContent = `${evaluation.correct ? '✓ ' : ''}${evaluation.feedback}`;
    scoreEl.textContent = String(Number(scoreEl.textContent || 0) + evaluation.delta);
  }

  function showCoach(message) {
    if (!coachEl || !message) return;
    coachEl.textContent = `🤖 ${message}`;
    coachEl.classList.add('show');
  }

  function showSummary(summary) {
    summaryShell.show(summary);
  }

  return {
    renderQuestion,
    showFeedback,
    showCoach,
    showSummary
  };
}