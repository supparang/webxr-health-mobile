// /functions/english-engine.js
'use strict';

export const QUESTION_BANK = {
  a2_cs_unit_01: [
    {
      id: 'Q001',
      type: 'speaking',
      promptText: 'Say the sentence clearly',
      questionText: 'I need to test the app before deployment.',
      expected: {
        text: 'i need to test the app before deployment',
        keywords: ['test', 'app', 'deployment']
      },
      timeLimitSec: 12,
      bossImpact: 12,
      difficulty: 'normal'
    },
    {
      id: 'Q002',
      type: 'choice',
      promptText: 'Choose the best meaning',
      questionText: 'What does "bug" mean in software development?',
      choices: [
        { value: 'a', label: 'A software error' },
        { value: 'b', label: 'A computer brand' },
        { value: 'c', label: 'A network cable' },
        { value: 'd', label: 'A mobile app icon' }
      ],
      expected: {
        value: 'a'
      },
      timeLimitSec: 10,
      bossImpact: 10,
      difficulty: 'easy'
    },
    {
      id: 'Q003',
      type: 'choice',
      promptText: 'Choose the best word',
      questionText: 'We collect data to train a ______.',
      choices: [
        { value: 'a', label: 'feature' },
        { value: 'b', label: 'model' },
        { value: 'c', label: 'keyboard' },
        { value: 'd', label: 'speaker' }
      ],
      expected: {
        value: 'b'
      },
      timeLimitSec: 10,
      bossImpact: 10,
      difficulty: 'normal'
    }
  ]
};

export function normalizeText(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chooseQuestions(unitId, difficulty = 'normal') {
  const all = QUESTION_BANK[unitId] || [];
  const sameDiff = all.filter(q => q.difficulty === difficulty);
  return sameDiff.length ? sameDiff : all;
}

export function scoreSpeaking(question, transcript = '') {
  const clean = normalizeText(transcript);
  const expected = normalizeText(question.expected?.text || '');
  const keywords = Array.isArray(question.expected?.keywords) ? question.expected.keywords : [];

  const exact = clean === expected;
  const keywordHits = keywords.filter(k => clean.includes(normalizeText(k))).length;
  const keywordRatio = keywords.length ? keywordHits / keywords.length : 0;

  const correct = exact || keywordRatio >= 0.67;
  const base = exact ? 120 : correct ? 90 : 0;

  return {
    correct,
    scoreDelta: base,
    feedback: correct
      ? exact
        ? 'Excellent! Clear and complete sentence.'
        : 'Good! You said the key words correctly.'
      : 'Almost there. Try to say the full sentence more clearly.'
  };
}

export function scoreChoice(question, value) {
  const correct = String(value || '') === String(question.expected?.value || '');
  return {
    correct,
    scoreDelta: correct ? 100 : 0,
    feedback: correct ? 'Correct answer!' : 'That choice is not correct yet.'
  };
}

export function evaluateAnswer(question, payload) {
  if (!question) {
    return {
      correct: false,
      scoreDelta: 0,
      feedback: 'Question not found.'
    };
  }

  if (question.type === 'speaking') {
    return scoreSpeaking(question, payload?.answer?.transcript || '');
  }

  return scoreChoice(question, payload?.answer?.value);
}

export function adjustDifficulty(currentDifficulty, recentResults = []) {
  const recent = recentResults.slice(-3);
  const allCorrect = recent.length >= 3 && recent.every(Boolean);
  const allWrong = recent.length >= 2 && recent.every(v => !v);

  if (allCorrect) {
    if (currentDifficulty === 'easy') return 'normal';
    if (currentDifficulty === 'normal') return 'hard';
  }

  if (allWrong) {
    if (currentDifficulty === 'hard') return 'normal';
    if (currentDifficulty === 'normal') return 'easy';
  }

  return currentDifficulty;
}

export function calcBossDamage(question, result, combo = 0) {
  if (!result.correct) return 0;
  const base = Number(question?.bossImpact || 8);
  const comboBonus = Math.min(20, combo * 2);
  return base + comboBonus;
}
