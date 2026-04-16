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
  questionStartedAt: 0,
  speechTranscript: '',
  speechConfidence: 0,

  bestCombo: 0,
  answered: 0,
  startedAt: 0,

  waitingSubmit: false,
  pendingNextAction: 'next_question',

  timerLeftSec: 0,
  timerHandle: null
};

let speech = null;

function byId(id) {
  return document.getElementById(id);
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

function stopTimer() {
  if (state.timerHandle) {
    clearInterval(state.timerHandle);
    state.timerHandle = null;
  }
}

function setTimerText(sec) {
  const el = byId('questionTimer');
  if (el) el.textContent = String(Math.max(0, sec | 0));
}

function startQuestionTimer(limitSec) {
  stopTimer();
  state.timerLeftSec = Number(limitSec || 0);
  setTimerText(state.timerLeftSec);

  if (state.timerLeftSec <= 0) return;

  state.timerHandle = setInterval(() => {
    state.timerLeftSec -= 1;
    setTimerText(state.timerLeftSec);

    if (state.timerLeftSec <= 0) {
      stopTimer();
      toast('Time up!');
      handleAutoTimeout().catch(err => {
        console.error(err);
        toast(`Timer error: ${err.message}`);
      });
    }
  }, 1000);
}

function resetDraft() {
  state.speechTranscript = '';
  state.speechConfidence = 0;
  setSpeechTranscript('-');
  setSpeechStatus('Mic idle');
  document.querySelectorAll('.choice-btn').forEach(el => el.classList.remove('selected'));
}

function speakText(text) {
  if (!('speechSynthesis' in window)) {
    toast('Audio readout is not supported on this device.');
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(String(text || ''));
    utter.lang = 'en-US';
    utter.rate = 0.95;
    utter.pitch = 1.0;
    window.speechSynthesis.speak(utter);
  } catch (err) {
    console.error(err);
    toast('Cannot play audio.');
  }
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
      state.speechTranscript = transcript || '';
      state.speechConfidence = Number(confidence || 0);
      setSpeechTranscript(state.speechTranscript || '-');
      setSpeechStatus(`Captured (${Math.round(state.speechConfidence * 100)}%)`);
    },
    onError: (err) => {
      console.error(err);
      setSpeechStatus(`Mic error: ${err.message}`);
      toast(`Speech error: ${err.message}`);
    },
    onEnd: () => {
      if (!state.speechTranscript) {
        setSpeechStatus('Mic stopped');
      }
    }
  });

  try {
    await startNewSession();
  } catch (err) {
    console.error(err);
    toast(`Boot failed: ${err.message}`);
  }
}

async function startNewSession() {
  stopTimer();
  resetDraft();
  showScreen('loading');

  state.startedAt = Date.now();
  state.score = 0;
  state.combo = 0;
  state.bestCombo = 0;
  state.lives = 3;
  state.bossHp = 100;
  state.bossMaxHp = 100;
  state.answered = 0;
  state.pendingNextAction = 'next_question';
  state.currentQuestion = null;

  const params = new URLSearchParams(location.search);
  state.unitId = params.get('unitId') || 'a2_cs_unit_01';
  state.uid = params.get('pid') || params.get('uid') || 'anon_player';

  const session = await startSession({
    uid: state.uid,
    unitId: state.unitId,
    requestedDifficulty: params.get('diff') || 'normal',
    mode: params.get('run') || 'play'
  });

  state.sessionId = session.sessionId;
  state.difficulty = session.difficulty || 'normal';
  state.lives = session.lives ?? 3;
  state.bossHp = session.boss?.hp ?? 100;
  state.bossMaxHp = session.boss?.maxHp ?? 100;

  syncHud();
  await loadNextQuestion();
}

async function loadNextQuestion() {
  stopTimer();
  resetDraft();
  showScreen('loading');

  const question = await getNextQuestion({
    sessionId: state.sessionId
  });

  state.currentQuestion = question;
  state.questionStartedAt = Date.now();
  state.pendingNextAction = 'next_question';

  renderQuestion(question);
  syncHud();
  showScreen('question');
  startQuestionTimer(question?.timeLimitSec || 0);
}

function buildAnswerPayload() {
  const question = state.currentQuestion;
  if (!question) throw new Error('No active question.');

  const timeUsedMs = Math.max(0, Date.now() - state.questionStartedAt);

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
  if (state.waitingSubmit) return;
  if (!state.currentQuestion) return;

  const q = state.currentQuestion;

  if (q.type === 'speaking' && !state.speechTranscript) {
    toast('Please speak first.');
    return;
  }

  if (q.type !== 'speaking' && !getSelectedChoiceValue()) {
    toast('Please choose an answer.');
    return;
  }

  stopTimer();
  state.waitingSubmit = true;

  try {
    const result = await submitAnswer(buildAnswerPayload());

    state.score += Number(result.scoreDelta || 0);
    state.combo = Number(result.combo || 0);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.difficulty = result.difficulty || state.difficulty;
    state.bossHp = result.boss?.hp ?? state.bossHp;
    state.lives = result.player?.lives ?? state.lives;
    state.answered += 1;
    state.pendingNextAction = result.nextAction || 'next_question';

    syncHud();

    showFeedback({
      title: result.correct ? 'Correct!' : 'Try Again!',
      text: result.displayFeedback || ''
    });
  } catch (err) {
    console.error(err);
    toast(`Submit failed: ${err.message}`);
    startQuestionTimer(state.timerLeftSec);
  } finally {
    state.waitingSubmit = false;
  }
}

async function handleAutoTimeout() {
  if (state.waitingSubmit) return;
  if (!state.currentQuestion) return;

  state.waitingSubmit = true;

  try {
    const q = state.currentQuestion;
    const payload = q.type === 'speaking'
      ? {
          sessionId: state.sessionId,
          questionId: q.questionId,
          answerType: 'speech',
          answer: {
            transcript: '',
            confidence: 0
          },
          timeUsedMs: Math.max(0, Date.now() - state.questionStartedAt)
        }
      : {
          sessionId: state.sessionId,
          questionId: q.questionId,
          answerType: 'choice',
          answer: {
            value: ''
          },
          timeUsedMs: Math.max(0, Date.now() - state.questionStartedAt)
        };

    const result = await submitAnswer(payload);

    state.score += Number(result.scoreDelta || 0);
    state.combo = Number(result.combo || 0);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.difficulty = result.difficulty || state.difficulty;
    state.bossHp = result.boss?.hp ?? state.bossHp;
    state.lives = result.player?.lives ?? state.lives;
    state.answered += 1;
    state.pendingNextAction = result.nextAction || 'next_question';

    syncHud();

    showFeedback({
      title: 'Time Up!',
      text: result.displayFeedback || 'Moving on to the next challenge.'
    });
  } finally {
    state.waitingSubmit = false;
  }
}

async function handleSkip() {
  if (!state.currentQuestion || state.waitingSubmit) return;

  stopTimer();
  state.waitingSubmit = true;

  try {
    const q = state.currentQuestion;
    const payload = q.type === 'speaking'
      ? {
          sessionId: state.sessionId,
          questionId: q.questionId,
          answerType: 'speech',
          answer: {
            transcript: '',
            confidence: 0
          },
          timeUsedMs: Math.max(0, Date.now() - state.questionStartedAt)
        }
      : {
          sessionId: state.sessionId,
          questionId: q.questionId,
          answerType: 'choice',
          answer: {
            value: ''
          },
          timeUsedMs: Math.max(0, Date.now() - state.questionStartedAt)
        };

    const result = await submitAnswer(payload);

    state.score += Number(result.scoreDelta || 0);
    state.combo = Number(result.combo || 0);
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.difficulty = result.difficulty || state.difficulty;
    state.bossHp = result.boss?.hp ?? state.bossHp;
    state.lives = result.player?.lives ?? state.lives;
    state.answered += 1;
    state.pendingNextAction = result.nextAction || 'next_question';

    syncHud();

    showFeedback({
      title: 'Skipped',
      text: 'Moving to the next challenge.'
    });
  } catch (err) {
    console.error(err);
    toast(`Skip failed: ${err.message}`);
  } finally {
    state.waitingSubmit = false;
  }
}

async function handleContinue() {
  try {
    if (state.pendingNextAction === 'finish' || state.lives <= 0 || state.bossHp <= 0) {
      await finishAndShowSummary();
      return;
    }
    await loadNextQuestion();
  } catch (err) {
    console.error(err);
    toast(`Continue failed: ${err.message}`);
  }
}

function handlePlayAudio() {
  if (!state.currentQuestion) return;
  const text = [
    state.currentQuestion.promptText || '',
    state.currentQuestion.questionText || ''
  ].filter(Boolean).join('. ');
  speakText(text);
}

function handleSpeakNow() {
  if (!state.currentQuestion) return;

  if (state.currentQuestion.type !== 'speaking') {
    toast('This question is not speaking mode.');
    return;
  }

  if (!isSpeechSupported()) {
    toast('Speech recognition is not supported on this device.');
    return;
  }

  state.speechTranscript = '';
  state.speechConfidence = 0;
  speech.start();
}

async function finishAndShowSummary() {
  stopTimer();

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
    console.error(err);
    toast(`Restart failed: ${err.message}`);
  });
}

function handleBackMenu() {
  const params = new URLSearchParams(location.search);
  const hub = params.get('hub') || './index.html';
  location.href = hub;
}

boot();
