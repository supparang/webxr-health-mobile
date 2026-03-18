// === /herohealth/nutrition-groups/js/groups.ui.js ===
// UI renderer for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-B

import { esc, goHub } from '../../shared/nutrition-common.js';
import { mountSummaryShell } from '../../shared/nutrition-summary-shell.js';

const TIPS = {
  sort: 'มองก่อนว่าอาหารนี้อยู่หมู่ไหน',
  compare: 'ดูว่าอะไรดีกว่าต่อสุขภาพ',
  reason: 'เลือกเหตุผลที่เหมาะสมที่สุด',
  retry: 'รอบทบทวน ลองแก้ข้อที่เคยพลาดอีกครั้ง'
};

export function createGroupsUI(ctx, { onAnswer, onReplay }) {
  const phaseEl = document.getElementById('hudPhase');
  const progressEl = document.getElementById('hudProgress');
  const scoreEl = document.getElementById('hudScore');
  const streakEl = document.getElementById('hudStreak');
  const promptEl = document.getElementById('questionPrompt');
  const visualEl = document.getElementById('questionVisual');
  const gridEl = document.getElementById('answerGrid');
  const feedbackEl = document.getElementById('feedbackBox');
  const tipEl = document.getElementById('miniTip');
  const backBtn = document.getElementById('backBtn');

  let answerLocked = false;

  const summaryShell = mountSummaryShell(document.body, {
    onReplay,
    onBack: () => goHub(ctx)
  });

  backBtn.addEventListener('click', () => goHub(ctx));

  function setHud(viewState) {
    phaseEl.textContent = `หมวด: ${viewState.phaseLabel}`;
    progressEl.textContent = `${viewState.phaseCurrent} / ${viewState.phaseTotal}`;
    scoreEl.textContent = String(viewState.score);
    streakEl.textContent = String(viewState.streak);
    tipEl.textContent = TIPS[viewState.phaseKey] || '';
  }

  function renderVisual(question) {
    if (question.type === 'sort' || question.isRetry && question.retryFrom === 'sort') {
      visualEl.innerHTML = `
        <div class="food-card">
          <div class="food-emoji">${esc(question.food.emoji)}</div>
          <div class="food-name">${esc(question.food.label)}</div>
          <div class="food-sub">${question.isRetry ? 'รอบทบทวนโจทย์เดิม' : 'เลือกหมู่อาหารที่ถูกต้อง'}</div>
        </div>
      `;
      return;
    }

    if (question.type === 'compare' || question.isRetry && question.retryFrom === 'compare') {
      visualEl.innerHTML = `
        <div class="compare-grid">
          <div class="compare-option">
            <div class="food-emoji">${esc(question.left.emoji)}</div>
            <div class="food-name">${esc(question.left.label)}</div>
          </div>
          <div class="compare-option">
            <div class="compare-vs">VS</div>
          </div>
          <div class="compare-option">
            <div class="food-emoji">${esc(question.right.emoji)}</div>
            <div class="food-name">${esc(question.right.label)}</div>
          </div>
        </div>
      `;
      return;
    }

    if (question.type === 'reason' || question.isRetry && question.retryFrom === 'reason') {
      visualEl.innerHTML = `
        <div class="food-card">
          <div class="food-emoji">${esc(question.food?.emoji || '⭐')}</div>
          <div class="food-name">${esc(question.food?.label || '')}</div>
          <div class="food-sub">${question.isRetry ? 'ทบทวนเหตุผลอีกครั้ง' : 'เลือกเหตุผลที่เหมาะสมที่สุด'}</div>
        </div>
      `;
    }
  }

  function renderAnswers(question) {
    answerLocked = false;
    gridEl.innerHTML = '';
    question.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = 'answer-btn';
      btn.type = 'button';
      btn.innerHTML = esc(option.label);
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
    renderVisual(question);
    renderAnswers(question);
  }

  function showFeedback(evaluation) {
    feedbackEl.className = `feedback-box ${evaluation.correct ? 'feedback-good' : 'feedback-bad'}`;
    feedbackEl.textContent = `${evaluation.correct ? '✓' : '✗'} ${evaluation.feedback}`;
    scoreEl.textContent = String(Number(scoreEl.textContent || 0) + evaluation.delta);
  }

  function showSummary(summary) {
    summaryShell.show(summary);
  }

  return {
    renderQuestion,
    showFeedback,
    showSummary
  };
}