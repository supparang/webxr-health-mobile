import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVENANCE,
  THAI_FOOD_CATALOG,
  UNKNOWN_DISH_ID,
  buildMealRecord,
  clampPortionMultiplier,
  demoClassifyImage,
  detectTrayAllergens,
  evaluateGdaLabel,
  getDishById,
  lookupBarcodeFixture,
  recordsToCsv,
  resolveGoalProfile,
  scaleComboNutrition,
  scaleNutrition,
  searchDishes,
  summarizeDailyRecords,
  summarizeSevenDayTrend,
  updateMealRecord,
} from '../nutrition.js';

test('THAI_FOOD_CATALOG has 20 unique dishes with valid non-negative nutrition fixtures', () => {
  assert.equal(THAI_FOOD_CATALOG.length, 20);
  const ids = new Set(THAI_FOOD_CATALOG.map((d) => d.id));
  assert.equal(ids.size, 20);
  for (const dish of THAI_FOOD_CATALOG) {
    assert.ok(dish.nameTh.length > 0);
    assert.ok(dish.servingGrams > 0);
    assert.ok(dish.illustrativeNutrients.kcal >= 0);
  }
});

test('searchDishes filters by Thai/English query and category group', () => {
  const byThai = searchDishes('ไก่ย่าง');
  assert.equal(byThai.length, 1);
  assert.equal(byThai[0].id, 'gai_yang');

  const noodles = searchDishes('', 'noodle');
  assert.ok(noodles.length >= 3);
  assert.ok(noodles.every((d) => d.categoryGroup === 'noodle'));
});

test('scaleNutrition scales linearly, clamps bounds, and computes traffic light levels', () => {
  const krapow = getDishById('pad_krapow_gai');
  assert.ok(krapow);

  const half = scaleNutrition(krapow, 0.5);
  assert.equal(half.kcal, Math.round(krapow.illustrativeNutrients.kcal * 0.5));
  assert.equal(half.estimatedGrams, Math.round(krapow.servingGrams * 0.5));
  assert.equal(half.provenance, PROVENANCE.ILLUSTRATIVE_DEMO);
  assert.equal(half.macroShares.proteinPct + half.macroShares.carbsPct + half.macroShares.fatPct, 100);

  assert.equal(clampPortionMultiplier(0.01), 0.25);
  assert.equal(clampPortionMultiplier(99), 4);

  const tea = getDishById('thai_iced_tea');
  const teaScaled = scaleNutrition(tea, 1);
  assert.equal(teaScaled.levels.sugar, 'high');
  assert.equal(teaScaled.levels.sodium, 'low');
});

test('scaleComboNutrition aggregates multi-dish Thai meal tray and detects user allergens', () => {
  const goal = resolveGoalProfile({
    profileId: 'child_p1_p3',
    allergens: ['peanut', 'shellfish'],
  });
  assert.equal(goal.kcal, 1400);
  assert.equal(goal.sodiumMg, 1200);

  const tray = [
    { foodId: 'som_tum_thai', portionMultiplier: 1 },
    { foodId: 'sticky_rice', portionMultiplier: 1 },
    { foodId: 'gai_yang', portionMultiplier: 1 },
  ];

  const combo = scaleComboNutrition(tray, goal);
  assert.equal(combo.kcal, 165 + 210 + 255);
  assert.deepEqual(combo.foodGroups, [1, 2, 3, 4, 5]);
  assert.deepEqual(combo.matchedAllergens.sort(), ['peanut', 'shellfish']);
  assert.deepEqual(detectTrayAllergens(tray, goal).sort(), ['peanut', 'shellfish']);
});

test('Barcode lookup and Thai GDA label evaluation track provenance accurately', () => {
  const milk = lookupBarcodeFixture('8850123456012');
  assert.ok(milk);
  assert.match(milk.productNameTh, /นมโคแท้จืด/);

  const userGda = evaluateGdaLabel({
    productNameTh: 'นมถั่วเหลืองหวานน้อย',
    kcal: 120,
    sugarG: 6,
    fatG: 3.5,
    sodiumMg: 85,
    proteinG: 8,
    servingsEaten: 1.5,
    fromFixture: false,
  });
  assert.equal(userGda.kcal, 180);
  assert.equal(userGda.sugarG, 9);
  assert.equal(userGda.provenance, PROVENANCE.USER_GDA_LABEL);

  const gdaRec = buildMealRecord({
    mode: 'gda',
    gdaData: {
      productNameTh: 'นมถั่วเหลืองหวานน้อย',
      kcal: 120,
      sugarG: 6,
      fatG: 3.5,
      sodiumMg: 85,
      proteinG: 8,
      servingsEaten: 1,
      fromFixture: false,
    },
    mealType: 'snack',
  });
  assert.equal(gdaRec.mode, 'gda');
  assert.equal(gdaRec.provenance, PROVENANCE.USER_GDA_LABEL);
  assert.equal(gdaRec.nutrients.kcal, 120);
});

test('demoClassifyImage matches preset, filename keywords, and stays honest on generic uploads', () => {
  const preset = demoClassifyImage({ presetId: 'som_tum_thai' });
  assert.equal(preset.outcome, 'matched');
  assert.equal(preset.foodId, 'som_tum_thai');

  const byFile = demoClassifyImage({ filename: 'my_tomyum_lunch.jpg' });
  assert.equal(byFile.outcome, 'matched');
  assert.equal(byFile.foodId, 'tom_yum_kung');

  const generic = demoClassifyImage({ filename: 'IMG_20261126_123456.jpg' });
  assert.equal(generic.outcome, 'uncertain');
  assert.equal(generic.foodId, UNKNOWN_DISH_ID);
});

test('AI mode meal record NEVER attaches or exports mock nutrients, including multi-dish and edited records', () => {
  const aiRecord = buildMealRecord({
    mode: 'ai',
    items: [
      { foodId: 'pad_krapow_gai', portionMultiplier: 1.5 },
      { foodId: 'boiled_egg', portionMultiplier: 1 },
    ],
    mealType: 'lunch',
    note: '=SUM(A1:A2)',
    scanOutcome: 'matched',
    confidence: 0.91,
    timestamp: '2026-11-26T05:30:00.000Z',
  });

  assert.equal(aiRecord.mode, 'ai');
  assert.equal(aiRecord.provenance, PROVENANCE.AI_CLASSIFICATION_ONLY);
  assert.equal(aiRecord.nutrients, null);
  assert.equal(aiRecord.foodNameTh, 'ข้าวผัดกะเพราไก่ไข่ดาว + ไข่ต้ม');

  const editedAi = updateMealRecord(aiRecord, { portionMultiplier: 2, note: 'แก้ไขแล้ว' });
  assert.equal(editedAi.nutrients, null);
  assert.equal(editedAi.provenance, PROVENANCE.AI_CLASSIFICATION_ONLY);

  const demoRecord = buildMealRecord({
    mode: 'demo',
    foodId: 'som_tum_thai',
    portionMultiplier: 1,
    mealType: 'dinner',
    note: 'หวานน้อย',
    scanOutcome: 'matched',
    confidence: 0.92,
    timestamp: '2026-11-26T11:00:00.000Z',
  });

  const editedDemo = updateMealRecord(demoRecord, { portionMultiplier: 2, mealType: 'lunch' });
  assert.equal(editedDemo.nutrients.kcal, 330);
  assert.equal(editedDemo.mealType, 'lunch');

  const summary = summarizeDailyRecords([aiRecord, editedDemo], editedDemo.dateKey);
  assert.equal(summary.totalCount, 2);
  assert.equal(summary.demoEstimatedCount, 1);
  assert.equal(summary.aiClassificationOnlyCount, 1);
  assert.equal(summary.kcal, 330);

  const trend = summarizeSevenDayTrend([aiRecord, editedDemo], new Date('2026-11-26T12:00:00.000Z'));
  assert.equal(trend.length, 7);
  assert.equal(trend[6].kcal, 330);
  assert.equal(trend[6].totalCount, 2);

  const csv = recordsToCsv([aiRecord, editedDemo]);
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM for Thai Excel compatibility');

  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines.length, 3);
  const aiCols = lines[1].split(',');
  for (let i = 11; i <= 17; i += 1) {
    assert.equal(aiCols[i], '', `AI CSV nutrient column ${i} must be blank`);
  }
  assert.equal(aiCols[18], "'=SUM(A1:A2)");
});
