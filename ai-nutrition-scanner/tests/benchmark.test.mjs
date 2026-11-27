import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMealRecord } from '../nutrition.js';
import { detectImageSignature } from '../vision.mjs';
import {
  applyClarificationAdjustments,
  researchTrialsToCsv,
  selectClarificationQuestions,
} from '../experiment.js';
import {
  ABC_BENCHMARK_CASES,
  evaluateTrialAgainstBenchmark,
  getBenchmarkById,
  getCounterbalancedArmOrder,
  summarizeBenchmarkByArm,
} from '../benchmark.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

test('All 6 A/B/C benchmark cases exist with valid JPEG assets (FF D8 FF magic bytes)', async () => {
  assert.equal(ABC_BENCHMARK_CASES.length, 6);
  const strata = new Set(ABC_BENCHMARK_CASES.map((c) => c.stratum));
  assert.deepEqual(
    Array.from(strata).sort(),
    ['hidden_factor', 'low_ambiguity', 'visual_ambiguous']
  );

  for (const bm of ABC_BENCHMARK_CASES) {
    const filePath = path.resolve(rootDir, bm.imagePath);
    const buf = await fs.readFile(filePath);
    assert.equal(detectImageSignature(buf), 'image/jpeg', `${bm.id} asset must be valid JPEG`);
    assert.ok(bm.groundTruth.nutrients.kcal > 0);
  }
});

test('Benchmark cases cleanly differentiate Arm A (0 Q), Arm B (adaptive 0..3 Q), and Arm C (fixed 5 Q)', () => {
  const bm05 = getBenchmarkById('BM05'); // Boiled egg (low ambiguity)
  assert.equal(selectClarificationQuestions('A', bm05.demoScanOverride).length, 0);
  assert.equal(selectClarificationQuestions('B', bm05.demoScanOverride).length, 0);
  assert.equal(selectClarificationQuestions('C', bm05.demoScanOverride).length, 5);

  const bm04 = getBenchmarkById('BM04'); // Thai iced tea (sweetness hidden)
  assert.equal(selectClarificationQuestions('B', bm04.demoScanOverride).length, 1);
  assert.equal(selectClarificationQuestions('B', bm04.demoScanOverride)[0].id, 'q_sweetness');

  const bm06 = getBenchmarkById('BM06'); // Blurry low-light misclassified photo
  const bQs = selectClarificationQuestions('B', bm06.demoScanOverride);
  assert.equal(bQs.length, 3);
  assert.ok(bQs.some((q) => q.id === 'q_dish_confirm'));
  assert.ok(bQs.some((q) => q.id === 'q_portion'));
});

test('Benchmark MAE & Top-1 Accuracy evaluator proves Arm B reduces error vs Arm A while keeping AI mode safe', () => {
  const bm06 = getBenchmarkById('BM06');

  // Arm A sticks with misprediction (khao_man_gai, 1x)
  const armARec = buildMealRecord({
    mode: 'demo',
    foodId: bm06.demoScanOverride.foodId,
    portionMultiplier: 1,
  });
  armARec.experiment = { arm: 'A', benchmarkId: 'BM06', questionsShownCount: 0 };
  armARec.experiment.benchmarkEval = evaluateTrialAgainstBenchmark(armARec);
  assert.equal(armARec.experiment.benchmarkEval.dishExactMatch, false);
  assert.ok(armARec.experiment.benchmarkEval.absErrKcal > 200);

  // Arm B recovers dish + portion (pad_krapow_gai, 1.5x)
  const armBRec = buildMealRecord({
    mode: 'demo',
    foodId: 'pad_krapow_gai',
    portionMultiplier: 1.5,
  });
  armBRec.experiment = { arm: 'B', benchmarkId: 'BM06', questionsShownCount: 3 };
  armBRec.experiment.benchmarkEval = evaluateTrialAgainstBenchmark(armBRec);
  assert.equal(armBRec.experiment.benchmarkEval.dishExactMatch, true);
  assert.equal(armBRec.experiment.benchmarkEval.absErrKcal, 0);

  // BM02 Tom Yum no broth: Arm B recovers exact sodium (0 mg error)
  const bm02 = getBenchmarkById('BM02');
  const armBRec2 = buildMealRecord({ mode: 'demo', foodId: 'tom_yum_kung', portionMultiplier: 1 });
  armBRec2.nutrients = applyClarificationAdjustments(
    armBRec2.nutrients,
    { q_broth: 'broth_none' },
    'demo'
  ).adjustedNutrients;
  armBRec2.experiment = { arm: 'B', benchmarkId: 'BM02', questionsShownCount: 2 };
  armBRec2.experiment.benchmarkEval = evaluateTrialAgainstBenchmark(armBRec2);
  assert.equal(armBRec2.experiment.benchmarkEval.absErrSodiumMg, 0);

  // AI mode record on BM01: evaluates dishExactMatch ONLY, leaves nutrient errors null & blank in CSV
  const aiRec = buildMealRecord({ mode: 'ai', foodId: 'pad_krapow_gai', portionMultiplier: 1 });
  aiRec.experiment = { arm: 'B', benchmarkId: 'BM01', questionsShownCount: 2 };
  aiRec.experiment.benchmarkEval = evaluateTrialAgainstBenchmark(aiRec);
  assert.equal(aiRec.experiment.benchmarkEval.dishExactMatch, true);
  assert.equal(aiRec.experiment.benchmarkEval.absErrKcal, null);

  const summary = summarizeBenchmarkByArm([armARec, armBRec, armBRec2, aiRec]);
  assert.equal(summary.A.dishAccuracyPct, 0);
  assert.equal(summary.B.dishAccuracyPct, 100);
  assert.equal(summary.B.maeKcal, 0);

  const csv = researchTrialsToCsv([armBRec, aiRec]);
  assert.match(csv, /benchmark_id,benchmark_stratum/);
  assert.match(csv, /BM06,visual_ambiguous/);
  assert.deepEqual(getCounterbalancedArmOrder(1), ['B', 'C', 'A']);
});
