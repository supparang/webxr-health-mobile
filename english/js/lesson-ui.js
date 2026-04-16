// /english/js/lesson-ui.js
'use strict';

function byId(id) {
  return document.getElementById(id);
}

const screens = {
  loading: byId('screenLoading'),
  question: byId('screenQuestion'),
  feedback: byId('screenFeedback'),
  summary: byId('screenSummary')
};

export function showScreen(name) {
  Object.values(screens).forEach(el => el.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
}

export function setHud({ unitId, difficulty, score, combo, lives, bossHp, bossMaxHp }) {
  byId('hudUnit').textContent = unitId || '-';
  byId('hudDiff').textContent = difficulty || '-';
  byId('hudScore').textContent = String(score ?? 0);
  byId('hudCombo').textContent = String(combo ?? 0);
  byId('hudLives').textContent = String(lives ?? 0);

  const fill = byId('bossBarFill');
  const hpText = byId('bossHpText');
  const safeMax = Math.max(1, bossMaxHp || 100);
  const safeHp = Math.max(0, bossHp ?? safeMax);
  const percent = Math.max(0, Math.min(100, (safeHp / safeMax) * 100));

  fill.style.width = `${percent}%`;
  hpText.textContent = `${safeHp} / ${safeMax}`;
}

export function renderQuestion(question) {
  byId('questionTypeBadge').textContent = String(question?.type || 'QUESTION').toUpperCase();
  byId('promptText').textContent = question?.promptText || 'Prompt';
  byId('questionText').textContent = question?.questionText || '';
  byId('questionTimer').textContent = String(question?.timeLimitSec ?? 0);

  const choiceList = byId('choiceList');
  choiceList.innerHTML = '';

  const choices = Array.isArray(question?.choices) ? question.choices : [];
  if (choices.length) {
    choices.forEach((choice, index) => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.type = 'button';
      btn.dataset.value = choice.value ?? choice.id ?? String(index);
      btn.textContent = choice.label ?? choice.text ?? String(choice);
      choiceList.appendChild(btn);
    });
  }

  byId('speechStatus').textContent = 'Mic idle';
  byId('speechTranscript').textContent = '-';
}

export function setSpeechStatus(text) {
  byId('speechStatus').textContent = text;
}

export function setSpeechTranscript(text) {
  byId('speechTranscript').textContent = text || '-';
}

export function getSelectedChoiceValue() {
  const selected = document.querySelector('.choice-btn.selected');
  return selected ? selected.dataset.value : null;
}

export function bindChoiceSelection() {
  const choiceList = byId('choiceList');
  choiceList.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.choice-btn');
    if (!btn) return;

    document.querySelectorAll('.choice-btn').forEach(el => el.classList.remove('selected'));
    btn.classList.add('selected');
  });
}

export function showFeedback({ title, text }) {
  byId('feedbackTitle').textContent = title || 'Result';
  byId('feedbackText').textContent = text || '';
  showScreen('feedback');
}

export function showSummary(summary) {
  byId('sumScore').textContent = String(summary?.finalScore ?? 0);
  byId('sumAccuracy').textContent = `${Math.round((summary?.accuracy ?? 0) * 100)}%`;
  byId('sumBestCombo').textContent = String(summary?.bestCombo ?? 0);
  byId('sumBoss').textContent = summary?.bossCleared ? 'Cleared' : 'Not Cleared';
  showScreen('summary');
}

export function toast(message) {
  const el = byId('toast');
  el.textContent = message || '';
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

export function bindButtons(handlers) {
  byId('btnSubmit').addEventListener('click', handlers.onSubmit);
  byId('btnSkip').addEventListener('click', handlers.onSkip);
  byId('btnContinue').addEventListener('click', handlers.onContinue);
  byId('btnPlayAgain').addEventListener('click', handlers.onPlayAgain);
  byId('btnBackMenu').addEventListener('click', handlers.onBackMenu);
  byId('btnPlayAudio').addEventListener('click', handlers.onPlayAudio);
  byId('btnSpeakNow').addEventListener('click', handlers.onSpeakNow);
}
