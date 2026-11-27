import { getDishById, scaleNutrition } from './nutrition.js';
import { applyClarificationAdjustments } from './experiment.js';

export const BENCHMARK_PROVENANCE = 'ILLUSTRATIVE_BENCHMARK_GROUND_TRUTH';

export const BENCHMARK_STRATA = Object.freeze({
  hidden_factor: Object.freeze({
    id: 'hidden_factor',
    labelTh: 'ปัจจัยซ่อนเร้น',
    descriptionTh: 'ภาพชัด แต่มีน้ำมัน น้ำตาล หรือโซเดียมในน้ำซุปที่มองไม่เห็นจากภาพ',
  }),
  low_ambiguity: Object.freeze({
    id: 'low_ambiguity',
    labelTh: 'ภาพชัดไม่ซับซ้อน',
    descriptionTh: 'อาหารชิ้นเดี่ยวที่ชัดเจน ไม่มีปัจจัยซ่อนเร้น (ทดสอบการลดคำถามเกินจำเป็นของระบบ B)',
  }),
  visual_ambiguous: Object.freeze({
    id: 'visual_ambiguous',
    labelTh: 'ภาพเบลอ / แสงน้อย',
    descriptionTh: 'ภาพคลุมเครือที่โมเดลภาพเดี่ยวทายผิด (ทดสอบการยกระดับถามยืนยันเมนูของระบบ B)',
  }),
});

function computeGroundTruthNutrients(foodId, portionMultiplier, expectedAnswers) {
  const base = scaleNutrition(getDishById(foodId), portionMultiplier);
  if (!base) return null;
  const { adjustedNutrients } = applyClarificationAdjustments(base, expectedAnswers, 'demo');
  return {
    kcal: adjustedNutrients.kcal,
    proteinG: adjustedNutrients.proteinG,
    fatG: adjustedNutrients.fatG,
    sodiumMg: adjustedNutrients.sodiumMg,
    sugarG: adjustedNutrients.sugarG,
  };
}

/**
 * 6-Case Thai Food A/B/C Benchmark Suite spanning 3 difficulty strata:
 * - BM01..BM04: High hidden culinary variance (oil, egg, broth, sugar/sauce)
 * - BM05: Low-ambiguity single-unit food (Arm B asks 0 Q vs Arm C's 5 Q)
 * - BM06: Blurry low-light misclassified photo (Arm A fails dish accuracy, Arm B recovers via Top-3)
 */
export const ABC_BENCHMARK_CASES = Object.freeze([
  {
    id: 'BM01',
    stratum: 'hidden_factor',
    titleTh: 'กะเพราไก่ (น้ำมันน้อย + ไข่ต้ม)',
    imagePath: './assets/pad-krapow-gai.jpg',
    scenarioPromptTh:
      'โจทย์จำลอง BM01: สมมติว่าจานนี้คุณสั่ง "ผัดน้ำมันน้อย" และเลือกทานเป็น "ไข่ต้ม" (1 จานปกติ)',
    demoScanOverride: Object.freeze({
      outcome: 'matched',
      foodId: 'pad_krapow_gai',
      confidence: 0.92,
      suggestedPortionMultiplier: 1,
      portionUncertainty: 'medium',
      topCandidates: ['pad_krapow_gai'],
      hiddenFactors: ['oil_level', 'egg_style'],
      reasonTh: 'Benchmark BM01: ตรวจพบข้าวผัดกะเพราไก่ (ความมั่นใจสูง แต่มีปัจจัยน้ำมันและรูปแบบไข่)',
      visibleComponentsTh: ['ไก่สับผัดกะเพรา', 'ข้าวสวย', 'ไข่'],
    }),
    groundTruth: Object.freeze({
      foodId: 'pad_krapow_gai',
      portionMultiplier: 1,
      expectedAnswers: Object.freeze({ q_oil_level: 'low_oil', q_egg_style: 'boiled' }),
      nutrients: Object.freeze(
        computeGroundTruthNutrients('pad_krapow_gai', 1, {
          q_oil_level: 'low_oil',
          q_egg_style: 'boiled',
        })
      ),
    }),
  },
  {
    id: 'BM02',
    stratum: 'hidden_factor',
    titleTh: 'ต้มยำกุ้งน้ำใส (ไม่ซดน้ำซุป)',
    imagePath: './assets/tom-yum-kung.jpg',
    scenarioPromptTh:
      'โจทย์จำลอง BM02: สมมติว่าถ้วยนี้คุณตักทานแต่เนื้อกุ้งและเห็ด "ไม่ซดน้ำซุป" เพื่อลดโซเดียม (1 ถ้วยปกติ)',
    demoScanOverride: Object.freeze({
      outcome: 'matched',
      foodId: 'tom_yum_kung',
      confidence: 0.91,
      suggestedPortionMultiplier: 1,
      portionUncertainty: 'medium',
      topCandidates: ['tom_yum_kung'],
      hiddenFactors: ['broth_consumed'],
      reasonTh: 'Benchmark BM02: ตรวจพบต้มยำกุ้งน้ำใส (ความมั่นใจสูง แต่ปริมาณการซดน้ำซุปมีผลต่อโซเดียมมาก)',
      visibleComponentsTh: ['กุ้งสด', 'เห็ดฟาง', 'ตะไคร้', 'น้ำซุปใส'],
    }),
    groundTruth: Object.freeze({
      foodId: 'tom_yum_kung',
      portionMultiplier: 1,
      expectedAnswers: Object.freeze({ q_broth: 'broth_none' }),
      nutrients: Object.freeze(
        computeGroundTruthNutrients('tom_yum_kung', 1, { q_broth: 'broth_none' })
      ),
    }),
  },
  {
    id: 'BM03',
    stratum: 'hidden_factor',
    titleTh: 'ส้มตำไทย (หวาน 25% + น้ำปลาน้อย)',
    imagePath: './assets/som-tum-thai.jpg',
    scenarioPromptTh:
      'โจทย์จำลอง BM03: สมมติว่าจานนี้คุณสั่งส้มตำไทย "หวาน 25%" และ "จิ้มน้อย / ไม่ปรุงน้ำปลาเพิ่ม" (1 จานปกติ)',
    demoScanOverride: Object.freeze({
      outcome: 'matched',
      foodId: 'som_tum_thai',
      confidence: 0.93,
      suggestedPortionMultiplier: 1,
      portionUncertainty: 'medium',
      topCandidates: ['som_tum_thai'],
      hiddenFactors: ['sweetness_level', 'sauce_amount'],
      reasonTh: 'Benchmark BM03: ตรวจพบส้มตำไทย (ภาพชัด แต่ความหวานและน้ำปลาไม่สามารถมองเห็นจากภาพได้)',
      visibleComponentsTh: ['มะละกอดิบ', 'มะเขือเทศ', 'ถั่วฝักยาว', 'ถั่วลิสงคั่ว'],
    }),
    groundTruth: Object.freeze({
      foodId: 'som_tum_thai',
      portionMultiplier: 1,
      expectedAnswers: Object.freeze({ q_sweetness: 'sweet_25', q_sauce: 'less_sauce' }),
      nutrients: Object.freeze(
        computeGroundTruthNutrients('som_tum_thai', 1, {
          q_sweetness: 'sweet_25',
          q_sauce: 'less_sauce',
        })
      ),
    }),
  },
  {
    id: 'BM04',
    stratum: 'hidden_factor',
    titleTh: 'ชาไทยเย็น (สั่งหวาน 25%)',
    imagePath: './assets/bench-thai-iced-tea.jpg',
    scenarioPromptTh:
      'โจทย์จำลอง BM04: สมมติว่าแก้วนี้คุณสั่งชาไทยเย็น "หวาน 25%" (1 แก้วปกติ 16 ออนซ์)',
    demoScanOverride: Object.freeze({
      outcome: 'matched',
      foodId: 'thai_iced_tea',
      confidence: 0.94,
      suggestedPortionMultiplier: 1,
      portionUncertainty: 'low',
      topCandidates: ['thai_iced_tea'],
      hiddenFactors: ['sweetness_level'],
      reasonTh: 'Benchmark BM04: ตรวจพบชาไทยเย็น (ภาพชัดและขนาดแก้วมาตรฐาน แต่ความหวานซ่อนอยู่ในเครื่องดื่ม)',
      visibleComponentsTh: ['ชาไทยเย็น', 'นมข้นจืด', 'น้ำแข็ง'],
    }),
    groundTruth: Object.freeze({
      foodId: 'thai_iced_tea',
      portionMultiplier: 1,
      expectedAnswers: Object.freeze({ q_sweetness: 'sweet_25' }),
      nutrients: Object.freeze(
        computeGroundTruthNutrients('thai_iced_tea', 1, { q_sweetness: 'sweet_25' })
      ),
    }),
  },
  {
    id: 'BM05',
    stratum: 'low_ambiguity',
    titleTh: 'ไข่ต้ม 1 ฟอง (ภาพชัด ไม่มีปัจจัยซ่อน)',
    imagePath: './assets/bench-boiled-egg.jpg',
    scenarioPromptTh:
      'โจทย์จำลอง BM05: ไข่ต้มสุก 1 ฟองปกติ ไม่ปรุงซอสเพิ่ม — สังเกตว่าระบบ B ควรถาม 0 ข้อ ขณะที่ระบบ C ยังคงถาม 5 ข้อ',
    demoScanOverride: Object.freeze({
      outcome: 'matched',
      foodId: 'boiled_egg',
      confidence: 0.96,
      suggestedPortionMultiplier: 1,
      portionUncertainty: 'low',
      topCandidates: ['boiled_egg'],
      hiddenFactors: [],
      reasonTh: 'Benchmark BM05: ตรวจพบไข่ต้ม 1 ฟองชัดเจน ไม่มีปัจจัยซ่อนเร้นที่มีความไม่แน่นอนสูง',
      visibleComponentsTh: ['ไข่ขาว', 'ไข่แดงสุก'],
    }),
    groundTruth: Object.freeze({
      foodId: 'boiled_egg',
      portionMultiplier: 1,
      expectedAnswers: Object.freeze({}),
      nutrients: Object.freeze(computeGroundTruthNutrients('boiled_egg', 1, {})),
    }),
  },
  {
    id: 'BM06',
    stratum: 'visual_ambiguous',
    titleTh: 'ภาพเบลอ/แสงน้อย (กะเพราไก่ 1.5 จาน)',
    imagePath: './assets/bench-ambiguous-krapow.jpg',
    scenarioPromptTh:
      'โจทย์จำลอง BM06: ภาพมืดและเบลอจนระบบภาพเดี่ยวทายผิดเป็น "ข้าวมันไก่" — ความจริงคือ "ข้าวผัดกะเพราไก่ไข่ดาว" ปริมาณพิเศษ (1.5×) น้ำมันปกติ',
    demoScanOverride: Object.freeze({
      outcome: 'uncertain',
      foodId: 'khao_man_gai',
      confidence: 0.54,
      suggestedPortionMultiplier: 1,
      portionUncertainty: 'high',
      topCandidates: ['khao_man_gai', 'pad_krapow_gai', 'khao_khai_jiao'],
      hiddenFactors: ['oil_level'],
      reasonTh:
        'Benchmark BM06: ภาพมืดและเบลอ ความมั่นใจต่ำ (54%) ระบบคาดเดาเบื้องต้นเป็นข้าวมันไก่ แต่ใกล้เคียงข้าวผัดกะเพราและข้าวไข่เจียว',
      visibleComponentsTh: ['ข้าวสวย', 'เนื้อสัตว์สับ/หั่น (ไม่ชัด)'],
    }),
    groundTruth: Object.freeze({
      foodId: 'pad_krapow_gai',
      portionMultiplier: 1.5,
      expectedAnswers: Object.freeze({ q_dish_confirm: 'pad_krapow_gai', q_portion: '1.5', q_oil_level: 'normal' }),
      nutrients: Object.freeze(computeGroundTruthNutrients('pad_krapow_gai', 1.5, {})),
    }),
  },
]);

export function getBenchmarkById(benchmarkId) {
  if (!benchmarkId) return null;
  return ABC_BENCHMARK_CASES.find((c) => c.id === benchmarkId) || null;
}

export function getCounterbalancedArmOrder(participantIndex = 0) {
  const orders = [
    ['A', 'B', 'C'],
    ['B', 'C', 'A'],
    ['C', 'A', 'B'],
  ];
  const idx = Math.abs(Math.floor(Number(participantIndex) || 0)) % orders.length;
  return orders[idx];
}

export function evaluateTrialAgainstBenchmark(record) {
  const bmId = record?.experiment?.benchmarkId;
  const bm = getBenchmarkById(bmId);
  if (!bm) return null;

  const gt = bm.groundTruth;
  const dishExactMatch = record.foodId === gt.foodId;

  // Enforce AI mode safety: AI mode NEVER computes/exports nutrient errors from mock fixtures
  if (record.mode === 'ai' || !record.nutrients || !gt.nutrients) {
    return {
      benchmarkId: bm.id,
      stratum: bm.stratum,
      gtFoodId: gt.foodId,
      dishExactMatch,
      gtKcal: null,
      gtSodiumMg: null,
      gtSugarG: null,
      absErrKcal: null,
      absErrSodiumMg: null,
      absErrSugarG: null,
    };
  }

  return {
    benchmarkId: bm.id,
    stratum: bm.stratum,
    gtFoodId: gt.foodId,
    dishExactMatch,
    gtKcal: gt.nutrients.kcal,
    gtSodiumMg: gt.nutrients.sodiumMg,
    gtSugarG: gt.nutrients.sugarG,
    absErrKcal: Math.abs(Math.round((record.nutrients.kcal || 0) - gt.nutrients.kcal)),
    absErrSodiumMg: Math.abs(Math.round((record.nutrients.sodiumMg || 0) - gt.nutrients.sodiumMg)),
    absErrSugarG:
      Math.round(Math.abs((record.nutrients.sugarG || 0) - gt.nutrients.sugarG) * 10) / 10,
  };
}

export function summarizeBenchmarkByArm(records = []) {
  const result = {};
  for (const arm of ['A', 'B', 'C']) {
    const evals = records
      .filter((r) => r?.experiment?.arm === arm && r?.experiment?.benchmarkId)
      .map((r) => ({ rec: r, ev: evaluateTrialAgainstBenchmark(r) }))
      .filter((x) => Boolean(x.ev));

    const n = evals.length;
    const avg = (getter) => {
      const vals = evals.map(getter).filter((v) => Number.isFinite(v));
      if (vals.length === 0) return null;
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    };

    result[arm] = {
      arm,
      benchmarkCount: n,
      dishAccuracyPct:
        n > 0
          ? Math.round((evals.filter((x) => x.ev.dishExactMatch).length / n) * 100)
          : null,
      maeKcal: avg((x) => x.ev.absErrKcal),
      maeSodiumMg: avg((x) => x.ev.absErrSodiumMg),
      maeSugarG: avg((x) => x.ev.absErrSugarG),
      avgQuestionsShown: avg((x) => x.rec.experiment.questionsShownCount),
    };
  }
  return result;
}
