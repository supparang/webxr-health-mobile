import { HYDRATION_V2_CONFIG } from './hydration-v2.config.js';
import { HYDRATION_V2_SCENARIOS } from './hydration-v2.scenarios.js';
import { createHydrationV2Logger } from './hydration-v2.logger.js';
import { createHydrationV2Game } from './hydration-v2.core.js';
import { goHydrationV2Cooldown, goHydrationV2Hub } from './hydration-v2.summary.js';

function parseCtx() {
  const qs = new URLSearchParams(location.search);

  function defaultHub() {
    return qs.get('hub') || new URL('../hub.html', location.href).href;
  }

  function normalizePid(rawPid) {
    const v = String(rawPid || '').trim().replace(/[.#$[\]/]/g, '-');
    if (v) return v;
    try {
      const KEY = 'HHA_DEVICE_PID';
      let pid = localStorage.getItem(KEY);
      if (!pid) {
        pid = `p-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem(KEY, pid);
      }
      return pid;
    } catch {
      return `p-${Math.random().toString(36).slice(2, 10)}`;
    }
  }

  function normalizeForm(raw) {
    const f = String(raw || '').trim().toUpperCase();
    if (f === 'A' || f === 'B' || f === 'C') return f;
    return 'B';
  }

  function normalizePhase(raw, form) {
    const p = String(raw || '').trim().toLowerCase();
    if (p === 'pre' || p === 'pretest') return 'pre';
    if (p === 'delayed' || p === 'followup' || p === 'retention') return 'delayed';
    if (p === 'post' || p === 'posttest') return 'post';

    if (form === 'A') return 'pre';
    if (form === 'C') return 'delayed';
    return 'post';
  }

  const researchForm = normalizeForm(
    qs.get('researchForm') || qs.get('form')
  );

  const researchPhase = normalizePhase(
    qs.get('researchPhase') || qs.get('testPhase'),
    researchForm
  );

  return {
    pid: normalizePid(qs.get('pid')),
    sessionId:
      qs.get('sessionId') ||
      `hydr2-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    hub: defaultHub(),
    studyId: qs.get('studyId') || '',
    runMode: qs.get('runMode') || 'play',
    phase: qs.get('phase') || '',
    conditionGroup: qs.get('conditionGroup') || '',
    studentKey: qs.get('studentKey') || '',
    schoolCode: qs.get('schoolCode') || '',
    classRoom: qs.get('classRoom') || '',
    studentNo: qs.get('studentNo') || '',
    nickName: qs.get('nickName') || '',
    researchForm,
    researchPhase
  };
}

function createUI() {
  const els = {
    roundText: document.getElementById('roundText'),
    scoreText: document.getElementById('scoreText'),
    progressFill: document.getElementById('progressFill'),
    coachText: document.getElementById('coachText'),
    phaseBadge: document.getElementById('phaseBadge'),
    scenarioTitle: document.getElementById('scenarioTitle'),
    scenarioText: document.getElementById('scenarioText'),
    scenarioHint: document.getElementById('scenarioHint'),
    promptBox: document.getElementById('promptBox'),
    choiceArea: document.getElementById('choiceArea'),
    feedbackBox: document.getElementById('feedbackBox'),
    summaryOverlay: document.getElementById('summaryOverlay'),
    summaryStars: document.getElementById('summaryStars'),
    summaryLead: document.getElementById('summaryLead'),
    summaryStats: document.getElementById('summaryStats'),
    summaryTip: document.getElementById('summaryTip'),
    helpOverlay: document.getElementById('helpOverlay')
  };

  function setProgress(roundNo, totalRounds) {
    els.roundText.textContent = `${roundNo} / ${totalRounds}`;
    const pct = totalRounds > 0
      ? Math.max(0, Math.min(100, (roundNo / totalRounds) * 100))
      : 0;
    els.progressFill.style.width = `${pct}%`;
  }

  function setScore(score) {
    els.scoreText.textContent = String(score);
  }

  function renderStep(data, onPick) {
    setProgress(data.roundNo, data.totalRounds);
    setScore(data.score);
    els.coachText.textContent = data.coachText;
    els.phaseBadge.textContent = data.phaseLabel;
    els.scenarioTitle.textContent = data.title;
    els.scenarioText.textContent = data.text;
    els.scenarioHint.textContent = data.hint || '';
    els.promptBox.textContent = data.prompt;
    els.feedbackBox.innerHTML =
      data.stepType === 'answer'
        ? 'อ่านสถานการณ์ให้ดีก่อน แล้วเลือกคำตอบที่เหมาะที่สุด'
        : data.stepType === 'reason'
          ? 'ต่อไปเลือกเหตุผลที่ตรงกับคำตอบที่เหมาะที่สุด'
          : 'ไม่มีถูกหรือผิด แค่เลือกตามความรู้สึกของเรา';

    els.choiceArea.innerHTML = '';
    data.choices.forEach((choice) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'choice-btn';
      btn.dataset.choiceId = choice.id;
      btn.innerHTML = `
        <div class="choice-top">
          <span class="choice-emoji">${choice.emoji || '💧'}</span>
          <span>${choice.label}</span>
        </div>
        ${choice.sub ? `<div class="choice-sub">${choice.sub}</div>` : ''}
      `;
      btn.addEventListener('click', () => onPick(choice.id));
      els.choiceArea.appendChild(btn);
    });
  }

  function markCurrentChoices(choices, pickedId) {
    const correct = choices.find(c => c.isCorrect);
    els.choiceArea.querySelectorAll('.choice-btn').forEach((btn) => {
      btn.disabled = true;
      const id = btn.dataset.choiceId;
      const item = choices.find(c => c.id === id);
      if (correct && item?.isCorrect) btn.classList.add('correct');
      if (id === pickedId && !item?.isCorrect) btn.classList.add('wrong');
      if (!correct && id === pickedId) btn.classList.add('correct');
    });
  }

  function setFeedback(html) {
    els.feedbackBox.innerHTML = html;
  }

  function showSummary(summary, actions) {
    els.summaryStars.textContent = '⭐️'.repeat(Math.max(1, summary.stars));
    els.summaryLead.textContent = summary.lead;
    els.summaryStats.innerHTML = `
      <div class="summary-stat">
        <span class="summary-stat-label">คะแนนรวม</span>
        <div class="summary-stat-value">${summary.score}</div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-label">ตอบถูก</span>
        <div class="summary-stat-value">${summary.answerCorrect} / ${summary.totalRounds}</div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-label">เหตุผลตรง</span>
        <div class="summary-stat-value">${summary.reasonCorrect} / ${summary.totalRounds}</div>
      </div>
      <div class="summary-stat">
        <span class="summary-stat-label">มั่นใจมาก</span>
        <div class="summary-stat-value">${summary.highConfidenceCount}</div>
      </div>
    `;
    els.summaryTip.textContent = summary.tip;
    els.summaryOverlay.classList.remove('hidden');
    els.summaryOverlay.setAttribute('aria-hidden', 'false');

    document.getElementById('playAgainBtn').onclick = actions.onPlayAgain;
    document.getElementById('cooldownBtn').onclick = actions.onCooldown;
    document.getElementById('summaryHubBtn').onclick = actions.onHub;
  }

  function hideSummary() {
    els.summaryOverlay.classList.add('hidden');
    els.summaryOverlay.setAttribute('aria-hidden', 'true');
  }

  function openHelp() {
    els.helpOverlay.classList.remove('hidden');
    els.helpOverlay.setAttribute('aria-hidden', 'false');
  }

  function closeHelp() {
    els.helpOverlay.classList.add('hidden');
    els.helpOverlay.setAttribute('aria-hidden', 'true');
  }

  return {
    renderStep,
    markCurrentChoices,
    setFeedback,
    showSummary,
    hideSummary,
    openHelp,
    closeHelp
  };
}

const ctx = parseCtx();
const ui = createUI();
const logger = createHydrationV2Logger(ctx);

const game = createHydrationV2Game({
  scenarios: HYDRATION_V2_SCENARIOS,
  ui,
  logger,
  ctx,
  onFinished(summary, actions) {
    ui.showSummary(summary, {
      onPlayAgain: () => {
        ui.hideSummary();
        actions.restart();
      },
      onCooldown: () => goHydrationV2Cooldown(ctx),
      onHub: () => goHydrationV2Hub(ctx)
    });
  }
});

document.getElementById('hubBtn')?.addEventListener('click', () => goHydrationV2Hub(ctx));
document.getElementById('helpBtn')?.addEventListener('click', () => ui.openHelp());
document.getElementById('closeHelpBtn')?.addEventListener('click', () => ui.closeHelp());

game.start();