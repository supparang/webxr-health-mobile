// /english/js/lesson-runtime.js
'use strict';

import {
  startSession,
  getNextQuestion,
  submitAnswer,
  finishSession
} from './lesson-api.js';

import {
  showScreen,
  setHud,
  renderQuestion,
  setSpeechStatus,
  setSpeechTranscript,
  getSelectedChoiceValue,
  showFeedback,
  showSummary,
  toast,
  bindButtons,
  bindChoiceSelection
} from './lesson-ui.js';

import {
  isSpeechSupported,
  createSpeechCapture
} from './lesson-speech.js';

const state = {
  unitId: 'a2_cs_unit_01',
  uid: 'anon_player',
  sessionId: null,
  difficulty: 'normal',
  score: 0,
  combo: 0,
  lives: 3,
  bossHp: 100,
  bossMaxHp: 100,
  currentQuestion: null,
  speechTranscript: '',
  speechConfidence: 0,
  bestCombo: 0,
  answered: 0,
  startedAt: 0,
  questionStartedAt: 0,
  waitingFeedback: false
};

let speech;

function resetAnswerDraft() {
  state.speechTranscript = '';
  state.speechConfidence = 0;
  setSpeechTranscript('-');
  setSpeechStatus('Mic idle');
  document.querySelectorAll('.choice-btn').forEach(el => el.classList.remove('selected'));
}

function syncHud() {
  setHud({
    unitId: state.unitId,
    difficulty: state.difficulty,
    score: state.score,
    combo: state.combo,
    lives: state.lives,
    bossHp: state.bossHp,
    bossMaxHp: state.bossMaxHp
  });
}

async function boot() {
  showScreen('loading');
  bindChoiceSelection();
  bindButtons({
    onSubmit: handleSubmit,
    onSkip: handleSkip,
    onContinue: handleContinue,
    onPlayAgain: handlePlayAgain,
    onBackMenu: handleBackMenu,
    onPlayAudio: handlePlayAudio,
    onSpeakNow: handleSpeakNow
  });

  speech = createSpeechCapture({
    onStart: () => {
      setSpeechStatus('Listening...');
      setSpeechTranscript('...');
    },
    onResult: ({ transcript, confidence }) => {
      state.speechTranscript = transcript;
      state.speechConfidence = confidence;
      setSpeechTranscript(transcript || '-');
      setSpeechStatus(`Captured (${Math.round(confidence * 100)}%)`);
    },
    onError: (err) => {
      setSpeechStatus(`Mic error: ${err.message}`);
      toast(`Speech error: ${err.message}`);
    },
    onEnd: () => {
      if (!state.speechTranscript) setSpeechStatus('Mic stopped');
    }
  });

  try {
    await startNewSession();
  } catch (err) {
    toast(`Boot failed: ${err.message}`);
    console.error(err);
  }
}

async function startNewSession() {
  showScreen('loading');
  state.startedAt = Date.now();

  const session = await startSession({
    uid: state.uid,
    unitId: state.unitId,
    mode: 'play',
    entry: 'lesson',
    requestedDifficulty: 'normal',
    clientSeed: Date.now()
  });

  state.sessionId = session.sessionId;
  state.difficulty = session.difficulty || 'normal';
  state.lives = session.lives ?? 3;
  state.bossHp = session.boss?.hp ?? 100;
  state.bossMaxHp = session.boss?.maxHp ?? 100;
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.answered = 0;

  syncHud();
  await loadNextQuestion();
}

async function loadNextQuestion() {
  showScreen('loading');
  resetAnswerDraft();

  const question = await getNextQuestion({
    sessionId: state.sessionId
  });

  state.currentQuestion = question;
  state.questionStartedAt = Date.now();

  renderQuestion(question);
  syncHud();
  showScreen('question');
}

function buildAnswerPayload() {
  const question = state.currentQuestion;
  const timeUsedMs = Math.max(0, Date.now() - state.questionStartedAt);

  if (!question) {
    throw new Error('No active question.');
  }

  if (question.type === 'speaking') {
    return {
      sessionId: state.sessionId,
      questionId: question.questionId,
      answerType: 'speech',
      answer: {
        transcript: state.speechTranscript,
        confidence: state.speechConfidence
      },
      timeUsedMs
    };
  }

  return {
    sessionId: state.sessionId,
    questionId: question.questionId,
    answerType: 'choice',
    answer: {
      value: getSelectedChoiceValue()
    },
    timeUsedMs
  };
}

async function handleSubmit() {
  if (state.waitingFeedback) return;

  try {
    const question = state.currentQuestion;
    if (!question) return;

    if (question.type === 'speaking' && !state.speechTranscript) {
      toast('Please speak first.');
      return;
    }

    if (question.type !== 'speaking' && !getSelectedChoiceValue()) {
      toast('Please choose an answer.');
      return;
    }

    state.waitingFeedback = true;

    const result = await submitAnswer(buildAnswerPayload());

    state.score += result.scoreDelta ?? 0;
    state.combo = result.combo ?? 0;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.difficulty = result.difficulty || state.difficulty;
    state.bossHp = result.boss?.hp ?? state.bossHp;
    state.lives = result.player?.lives ?? state.lives;
    state.answered += 1;

    syncHud();

    showFeedback({
      title: result.correct ? 'Correct!' : 'Try Again!',
      text: result.displayFeedback || ''
    });
  } catch (err) {
    toast(`Submit failed: ${err.message}`);
    console.error(err);
  } finally {
    state.waitingFeedback = false;
  }
}

async function handleSkip() {
  toast('Skipped.');
  showFeedback({
    title: 'Skipped',
    text: 'Moving to the next challenge.'
  });
}

async function handleContinue() {
  try {
    if (state.lives <= 0 || state.bossHp <= 0) {
      await finishAndShowSummary();
      return;
    }
    await loadNextQuestion();
  } catch (err) {
    toast(`Continue failed: ${err.message}`);
    console.error(err);
  }
}

function handlePlayAudio() {
  toast('Hook audio playback here.');
}

function handleSpeakNow() {
  if (!isSpeechSupported()) {
    toast('Speech recognition is not supported on this device.');
    return;
  }
  state.speechTranscript = '';
  state.speechConfidence = 0;
  speech.start();
}

async function finishAndShowSummary() {
  const summary = await finishSession({
    sessionId: state.sessionId,
    clientStats: {
      answered: state.answered,
      elapsedMs: Date.now() - state.startedAt
    }
  });

  showSummary({
    finalScore: summary.finalScore ?? state.score,
    accuracy: summary.accuracy ?? 0,
    bestCombo: summary.summary?.bestCombo ?? state.bestCombo,
    bossCleared: summary.bossCleared ?? (state.bossHp <= 0)
  });
}

function handlePlayAgain() {
  startNewSession().catch(err => {
    toast(`Restart failed: ${err.message}`);
    console.error(err);
  });
}

function handleBackMenu() {
  const params = new URLSearchParams(location.search);
  const hub = params.get('hub') || './index.html';
  location.href = hub;
}

boot();
