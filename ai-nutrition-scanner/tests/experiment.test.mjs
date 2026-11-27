import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVENANCE, buildMealRecord, getDishById, scaleNutrition } from '../nutrition.js';
import {
  applyClarificationAdjustments,
  parseExperimentParams,
  researchTrialsToCsv,
  selectClarificationQuestions,
  summarizeExperimentByArm,
} from '../experiment.js';

test('Arm A (Photo-Only) always returns 0 clarifying questions', () => {
  const qs1 = selectClarificationQuestions('A', {
    outcome: 'matched',
    foodId: 'pad_krapow_gai',
    confidence: 0.92,
  });
  const qs2 = selectClarificationQuestions('A', {
    outcome: 'uncertain',
    foodId: 'unknown',
    confidence: 0.4,
  });
  assert.equal(qs1.length, 0);
  assert.equal(qs2.length, 0);
});

test('Arm B (Uncertainty-Adaptive) adapts question count (0..3) to dish ambiguity and hidden factors', () => {
  // Simple low-ambiguity food with high confidence -> 0 questions
  const eggQs = selectClarificationQuestions('B', {
    outcome: 'matched',
    foodId: 'boiled_egg',
    confidence: 0.95,
  });
  assert.equal(eggQs.length, 0);

  // Thai iced tea (high confidence) -> asks sweetness level only (1 question)
  const teaQs = selectClarificationQuestions('B', {
    outcome: 'matched',
    foodId: 'thai_iced_tea',
    confidence: 0.93,
  });
  assert.equal(teaQs.length, 1);
  assert.equal(teaQs[0].id, 'q_sweetness');

  // Pad Krapow (high confidence) -> skips dish confirmation, asks hidden oil & egg style (2 questions)
  const krapowQs = selectClarificationQuestions('B', {
    outcome: 'matched',
    foodId: 'pad_krapow_gai',
    confidence: 0.92,
  });
  assert.equal(krapowQs.length, 2);
  assert.ok(krapowQs.some((q) => q.id === 'q_oil_level'));
  assert.ok(krapowQs.some((q) => q.id === 'q_egg_style'));
  assert.ok(!krapowQs.some((q) => q.id === 'q_dish_confirm'));

  // Low-confidence uncertain scan -> triggers dish confirmation and caps at 3 questions
  const uncertainQs = selectClarificationQuestions('B', {
    outcome: 'uncertain',
    foodId: 'tom_yum_kung',
    confidence: 0.52,
    portionUncertainty: 'high',
    topCandidates: ['tom_yum_kung', 'kuay_tiao_nam_sai'],
  });
  assert.ok(uncertainQs.length >= 2 && uncertainQs.length <= 3);
  assert.ok(uncertainQs.some((q) => q.id === 'q_dish_confirm'));
});

test('Arm C (Fixed Questionnaire) always returns the fixed 5 standardized questions', () => {
  const eggQs = selectClarificationQuestions('C', {
    outcome: 'matched',
    foodId: 'boiled_egg',
    confidence: 0.99,
  });
  assert.equal(eggQs.length, 5);
  assert.deepEqual(
    eggQs.map((q) => q.id),
    ['q_dish_confirm', 'q_portion', 'q_oil_level', 'q_sweetness', 'q_sauce']
  );
});

test('applyClarificationAdjustments updates Demo nutrients transparently and NEVER fabricates nutrients in AI mode', () => {
  const krapow = scaleNutrition(getDishById('pad_krapow_gai'), 1);
  const { adjustedNutrients, adjustmentLog } = applyClarificationAdjustments(
    krapow,
    { q_oil_level: 'low_oil', q_egg_style: 'boiled' },
    'demo'
  );
  assert.equal(adjustedNutrients.kcal, krapow.kcal - 54 - 63);
  assert.equal(adjustedNutrients.fatG, krapow.fatG - 6 - 7);
  assert.equal(adjustmentLog.length, 2);

  // Tom Yum broth not consumed -> lowers sodium
  const tomyum = scaleNutrition(getDishById('tom_yum_kung'), 1);
  const brothRes = applyClarificationAdjustments(tomyum, { q_broth: 'broth_none' }, 'demo');
  assert.ok(brothRes.adjustedNutrients.sodiumMg < tomyum.sodiumMg);

  // AI mode invariant
  const aiRes = applyClarificationAdjustments(krapow, { q_oil_level: 'low_oil' }, 'ai');
  assert.equal(aiRes.adjustedNutrients, null);
  assert.deepEqual(aiRes.adjustmentLog, []);
});

test('parseExperimentParams, summarizeExperimentByArm, and researchTrialsToCsv work cleanly', () => {
  const parsed = parseExperimentParams('?arm=c&pid=P07&session=S2&lock=1');
  assert.equal(parsed.arm, 'C');
  assert.equal(parsed.participantId, 'P07');
  assert.equal(parsed.sessionId, 'S2');
  assert.equal(parsed.locked, true);

  const demoRec = buildMealRecord({ mode: 'demo', foodId: 'pad_krapow_gai', mealType: 'lunch' });
  demoRec.experiment = {
    arm: 'B',
    participantId: 'P07',
    sessionId: 'S2',
    initialFoodId: 'pad_krapow_gai',
    portionUncertainty: 'medium',
    dishChanged: false,
    questionsShownCount: 2,
    questionsAnsweredCount: 2,
    questionIdsShown: ['q_oil_level', 'q_egg_style'],
    answers: { q_oil_level: 'low_oil' },
    totalDurationMs: 4200,
    clarificationDurationMs: 3900,
    tapCount: 2,
    perceivedEase: 5,
    perceivedConfidence: 4,
    initialNutrients: { ...demoRec.nutrients },
  };

  const aiRec = buildMealRecord({ mode: 'ai', foodId: 'tom_yum_kung', mealType: 'dinner' });
  aiRec.experiment = {
    arm: 'A',
    participantId: 'P07',
    sessionId: 'S2',
    initialFoodId: 'tom_yum_kung',
    portionUncertainty: 'medium',
    dishChanged: false,
    questionsShownCount: 0,
    questionsAnsweredCount: 0,
    questionIdsShown: [],
    answers: {},
    totalDurationMs: 1200,
    clarificationDurationMs: 900,
    tapCount: 0,
    perceivedEase: 5,
    perceivedConfidence: 3,
    initialNutrients: null,
  };

  const summary = summarizeExperimentByArm([demoRec, aiRec]);
  assert.equal(summary.A.trialCount, 1);
  assert.equal(summary.A.avgQuestionsShown, 0);
  assert.equal(summary.B.trialCount, 1);
  assert.equal(summary.B.avgQuestionsShown, 2);
  assert.equal(summary.C.trialCount, 0);

  const csv = researchTrialsToCsv([demoRec, aiRec]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.match(csv, /participant_id,session_id,arm/);
  assert.match(csv, /q_oil_level\|q_egg_style/);

  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  const headers = lines[0].split(',');
  const aiCols = lines[2].split(',');
  headers.forEach((h, i) => {
    if (/(kcal|sodium|sugar|fat)/.test(h)) {
      assert.equal(aiCols[i], '', `Research CSV AI nutrient column "${h}" must be blank`);
    }
  });
});
