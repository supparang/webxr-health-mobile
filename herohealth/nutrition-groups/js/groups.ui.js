// === /herohealth/nutrition-groups/js/groups.ui.js ===
// UI renderer for Nutrition Groups
// PATCH v20260323-GROUPS-CHILDFRIENDLY-A

import { esc, goHub } from '../../shared/nutrition-common.js';
import { mountSummaryShell } from '../../shared/nutrition-summary-shell.js';

const TIPS = {
  pre: 'แบบสั้นก่อนเริ่ม เพื่อดูพื้นฐานก่อนเล่น',
  sort: 'ดูรูปอาหาร แล้วเลือกหมู่ที่ถูก',
  compare: 'ดูว่าอะไรดีกว่าสำหรับร่างกาย',
  reason: 'เลือกเหตุผลที่ใช่ที่สุด',
  retry: 'ลองแก้ข้อที่เคยพลาดอีกครั้ง',
  post: 'ตอบอีกครั้งหลังเล่น เพื่อดูว่าเก่งขึ้นไหม'
};

const PHASE_BANNER = {
  pre: { icon: '📝', title: 'แบบสั้นก่อนเล่น', sub: 'ลองตอบก่อนเริ่มเกม' },
  sort: { icon: '🧺', title: 'แยกหมวดอาหาร', sub: 'อาหารนี้อยู่หมู่ไหน' },
  compare: { icon: '⚖️', title: 'เลือกสิ่งที่ดีกว่า', sub: 'สองอย่างนี้อะไรดีกว่า' },
  reason: { icon: '💡', title: 'บอกเหตุผลง่าย ๆ', sub: 'เลือกเหตุผลที่ใช่ที่สุด' },
  retry: { icon: '🔁', title: 'รอบทบทวน', sub: 'กลับมาแก้ข้อที่เคยพลาด' },
  post: { icon: '🌟', title: 'แบบสั้นหลังเล่น', sub: 'มาดูว่าหนูเก่งขึ้นไหม' }
};

function isReasonQuestion(question) {
  return question.type === 'reason' || (question.isRetry && question.retryFrom === 'reason');
}

export function createGroupsUI(ctx, { onAnswer, onReplay, onSummaryBack, summaryBackLabel = 'ไปคูลดาวน์' }) {
  const phaseEl = document.getElementById('hudPhase');
  const progressEl = document.getElementById('hudProgress');
  const scoreEl = document.getElementById('hudScore');
  const streakEl = document.getElementById('hudStreak');
  const promptEl = document.getElementById('questionPrompt');
  const visualEl = document.getElementById('questionVisual');
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
    const meta = PHASE_BANNER[phaseKey] || PHASE_BANNER.sort;
    phaseBanner.root.setAttribute('data-phase', phaseKey);
    phaseBanner.icon.textContent = meta.icon;
    phaseBanner.title.textContent = meta.title;
    phaseBanner.sub.textContent = meta.sub;
  }

  function setHud(viewState) {
    phaseEl.textContent = `หมวด: ${viewState.phaseLabel}`;
    progressEl.textContent = `${viewState.phaseCurrent} / ${viewState.phaseTotal}`;
    scoreEl.textContent = String(viewState.score);
    streakEl.textContent = String(viewState.streak);
    tipEl.textContent = TIPS[viewState.phaseKey] || '';
    setPhaseBanner(viewState.phaseKey);
  }

  function renderVisual(question) {
    if (question.type === 'sort' || (question.isRetry && question.retryFrom === 'sort')) {
      visualEl.innerHTML = `
        <div class="food-card child-card">
          <div class="food-emoji">${esc(question.food.emoji)}</div>
          <div class="food-name">${esc(question.food.label)}</div>
          <div class="food-sub">${question.isRetry ? 'ลองตอบใหม่นะ' : 'แตะหมวดอาหารที่ถูกต้อง'}</div>
        </div>
      `;
      return;
    }

    if (question.type === 'compare' || (question.isRetry && question.retryFrom === 'compare')) {
      visualEl.innerHTML = `
        <div class="compare-grid">
          <div class="compare-option child-card">
            <div class="food-emoji">${esc(question.left.emoji)}</div>
            <div class="food-name">${esc(question.left.label)}</div>
          </div>
          <div class="compare-option compare-mid">
            <div class="compare-vs">VS</div>
          </div>
          <div class="compare-option child-card">
            <div class="food-emoji">${esc(question.right.emoji)}</div>
            <div class="food-name">${esc(question.right.label)}</div>
          </div>
        </div>
      `;
      return;
    }

    if (isReasonQuestion(question)) {
      visualEl.innerHTML = `
        <div class="food-card child-card">
          <div class="food-emoji">${esc(question.food?.emoji || '⭐')}</div>
          <div class="food-name">${esc(question.food?.label || '')}</div>
          <div class="food-sub">${question.isRetry ? 'ลองเลือกเหตุผลอีกครั้ง' : 'เลือกเหตุผลที่ใช่ที่สุด'}</div>
        </div>
      `;
    }
  }

  function buildAnswerInner(option, question) {
    const hasEmoji = !!option.emoji;
    const short = option.short || '';

    if (question.type === 'sort' || (question.isRetry && question.retryFrom === 'sort')) {
      return `
        <div class="answer-main">${hasEmoji ? `${esc(option.emoji)} ` : ''}${esc(short || option.label)}</div>
        <small>${esc(option.label)}</small>
      `;
    }

    if (isReasonQuestion(question)) {
      return `
        <div class="answer-main">${esc(option.label)}</div>
        <small>${esc(option.helper || '')}</small>
      `;
    }

    return `
      <div class="answer-main">${hasEmoji ? `${esc(option.emoji)} ` : ''}${esc(option.label)}</div>
    `;
  }

  function renderAnswers(question) {
    answerLocked = false;
    gridEl.className = isReasonQuestion(question) ? 'answer-grid reason-grid' : 'answer-grid';
    gridEl.innerHTML = '';

    question.options.forEach(option => {
      const btn = document.createElement('button');
      btn.className = isReasonQuestion(question)
        ? 'answer-btn child-answer-btn reason-answer-btn'
        : 'answer-btn child-answer-btn';

      btn.type = 'button';
      btn.innerHTML = buildAnswerInner(option, question);

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
    scoreEl.textContent = String(Number(scoreEl.textContent || 0) + Number(evaluation.delta || 0));
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