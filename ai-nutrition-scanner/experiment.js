import {
  PROVENANCE,
  THAI_FOOD_CATALOG,
  UNKNOWN_DISH_ID,
  getDishById,
} from './nutrition.js';

export const EXPERIMENT_ARMS = Object.freeze({
  A: Object.freeze({
    id: 'A',
    shortLabelTh: 'ระบบ A: ภาพอย่างเดียว',
    titleTh: 'ระบบ A — ใช้ภาพถ่ายอย่างเดียว (Photo-Only)',
    descriptionTh: 'แสดงผลจากภาพถ่ายโดยตรง ไม่ถามคำถามยืนยันเพิ่มเติม (0 ข้อ)',
  }),
  B: Object.freeze({
    id: 'B',
    shortLabelTh: 'ระบบ B: ถามตามความไม่แน่นอน',
    titleTh: 'ระบบ B — คำถามยืนยันปรับตามความไม่แน่นอน (Uncertainty-Adaptive)',
    descriptionTh: 'คัดเลือกเฉพาะคำถามที่ภาพไม่ชัดหรือมีปัจจัยซ่อนเร้นที่กระทบโภชนาการสูง (0–3 ข้อ)',
  }),
  C: Object.freeze({
    id: 'C',
    shortLabelTh: 'ระบบ C: คำถามคงที่ 5 ข้อ',
    titleTh: 'ระบบ C — ชุดคำถามยืนยันคงที่ (Fixed Questionnaire)',
    descriptionTh: 'ถามชุดคำถามมาตรฐานคงที่ 5 ข้อทุกมื้อ ไม่ขึ้นกับความชัดของภาพ',
  }),
});

export const HIDDEN_FACTOR_KEYS = Object.freeze([
  'oil_level',
  'sweetness_level',
  'broth_consumed',
  'egg_style',
  'skin_fat',
  'sauce_amount',
]);

/**
 * Culinary uncertainty profile per Thai dish (for Demo mode & fallback when Vision API
 * does not explicitly enumerate hidden factors).
 * Each factor has { key, uncertainty: 0..1, impact: 0..1 }.
 */
const DISH_UNCERTAINTY_PROFILES = Object.freeze({
  pad_krapow_gai: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'oil_level', uncertainty: 0.85, impact: 0.85 },
      { key: 'egg_style', uncertainty: 0.7, impact: 0.8 },
      { key: 'sauce_amount', uncertainty: 0.55, impact: 0.6 },
    ],
  },
  som_tum_thai: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'sweetness_level', uncertainty: 0.85, impact: 0.8 },
      { key: 'sauce_amount', uncertainty: 0.8, impact: 0.85 },
    ],
  },
  tom_yum_kung: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'broth_consumed', uncertainty: 0.9, impact: 0.95 },
      { key: 'oil_level', uncertainty: 0.55, impact: 0.65 },
    ],
  },
  khao_man_gai: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'skin_fat', uncertainty: 0.85, impact: 0.85 },
      { key: 'sauce_amount', uncertainty: 0.75, impact: 0.75 },
    ],
  },
  pad_thai_kung: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'oil_level', uncertainty: 0.8, impact: 0.8 },
      { key: 'sweetness_level', uncertainty: 0.8, impact: 0.8 },
    ],
  },
  kaeng_khiao_wan_gai: {
    portionUncertainty: 'high',
    factors: [
      { key: 'broth_consumed', uncertainty: 0.88, impact: 0.9 },
      { key: 'skin_fat', uncertainty: 0.65, impact: 0.7 },
    ],
  },
  khao_khai_jiao: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'oil_level', uncertainty: 0.92, impact: 0.9 },
      { key: 'sauce_amount', uncertainty: 0.5, impact: 0.55 },
    ],
  },
  kuay_tiao_nam_sai: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'broth_consumed', uncertainty: 0.92, impact: 0.95 },
      { key: 'sauce_amount', uncertainty: 0.78, impact: 0.8 },
    ],
  },
  pad_see_ew_moo: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'oil_level', uncertainty: 0.85, impact: 0.85 },
      { key: 'sauce_amount', uncertainty: 0.72, impact: 0.75 },
    ],
  },
  pla_nueng_manao: {
    portionUncertainty: 'medium',
    factors: [{ key: 'sauce_amount', uncertainty: 0.78, impact: 0.8 }],
  },
  jok_moo_sai_khai: {
    portionUncertainty: 'medium',
    factors: [{ key: 'sauce_amount', uncertainty: 0.75, impact: 0.75 }],
  },
  larb_moo: {
    portionUncertainty: 'medium',
    factors: [{ key: 'sauce_amount', uncertainty: 0.76, impact: 0.78 }],
  },
  gai_yang: {
    portionUncertainty: 'medium',
    factors: [
      { key: 'skin_fat', uncertainty: 0.85, impact: 0.85 },
      { key: 'sauce_amount', uncertainty: 0.65, impact: 0.65 },
    ],
  },
  mango_sticky_rice: {
    portionUncertainty: 'medium',
    factors: [{ key: 'sweetness_level', uncertainty: 0.82, impact: 0.85 }],
  },
  thai_iced_tea: {
    portionUncertainty: 'low',
    factors: [{ key: 'sweetness_level', uncertainty: 0.96, impact: 0.98 }],
  },
  // Low-ambiguity single-unit foods -> Arm B asks 0 questions when confidence is high!
  boiled_egg: { portionUncertainty: 'low', factors: [] },
  banana_fresh: { portionUncertainty: 'low', factors: [] },
  drinking_water: { portionUncertainty: 'low', factors: [] },
  sticky_rice: { portionUncertainty: 'medium', factors: [] },
  steamed_jasmine_rice: { portionUncertainty: 'medium', factors: [] },
});

const QUESTION_TEMPLATES = Object.freeze({
  q_dish_confirm: {
    id: 'q_dish_confirm',
    factorKey: 'dish_identity',
    promptTh: 'เมนูในภาพตรงกับรายการใดมากที่สุด?',
    whyTh: 'ความมั่นใจในการจำแนกเมนูยังไม่สูงพอ',
    kind: 'dish',
  },
  q_portion: {
    id: 'q_portion',
    factorKey: 'portion',
    promptTh: 'ปริมาณที่รับประทานจริงเทียบกับจานมาตรฐาน',
    whyTh: 'ขนาดภาชนะ/ความลึกของจานอาจคาดเคลื่อนจากภาพ 2 มิติ',
    kind: 'portion',
    options: [
      { value: '0.5', labelTh: 'ครึ่งจาน (0.5×)' },
      { value: '1', labelTh: 'ปกติ (1×)' },
      { value: '1.5', labelTh: 'พิเศษ (1.5×)' },
      { value: '2', labelTh: '2 เท่า (2×)' },
    ],
  },
  q_oil_level: {
    id: 'q_oil_level',
    factorKey: 'oil_level',
    promptTh: 'ระดับน้ำมันที่ใช้ปรุงอาหารจานนี้',
    whyTh: 'ปริมาณน้ำมันผัด/ทอดมองเห็นยากจากภาพ แต่กระทบพลังงานและไขมันสูง',
    kind: 'choice',
    options: [
      { value: 'normal', labelTh: 'ปกติตามร้าน' },
      { value: 'low_oil', labelTh: 'ผัดน้ำมันน้อย' },
      { value: 'no_oil', labelTh: 'ไม่ใช้น้ำมัน / ต้มนึ่ง' },
      { value: 'extra_oil', labelTh: 'มันมาก / ทอดน้ำมันท่วม' },
    ],
  },
  q_sweetness: {
    id: 'q_sweetness',
    factorKey: 'sweetness_level',
    promptTh: 'ระดับความหวาน / น้ำตาลที่สั่ง',
    whyTh: 'น้ำตาลที่ละลายในเครื่องดื่มและน้ำยำไม่สามารถมองเห็นจากภาพถ่ายได้',
    kind: 'choice',
    options: [
      { value: 'normal', labelTh: 'หวานปกติ (100%)' },
      { value: 'sweet_50', labelTh: 'หวานน้อย (50%)' },
      { value: 'sweet_25', labelTh: 'หวาน 25%' },
      { value: 'sweet_0', labelTh: 'ไม่ใส่น้ำตาล (0%)' },
    ],
  },
  q_broth: {
    id: 'q_broth',
    factorKey: 'broth_consumed',
    promptTh: 'คุณซดน้ำซุปหรือราดน้ำแกงมากน้อยแค่ไหน?',
    whyTh: 'โซเดียมและไขมันกะทิส่วนใหญ่อยู่ในน้ำซุป/น้ำแกง',
    kind: 'choice',
    options: [
      { value: 'all', labelTh: 'ซดหมด / ราดชุ่ม' },
      { value: 'broth_half', labelTh: 'ซดประมาณครึ่งหนึ่ง' },
      { value: 'broth_none', labelTh: 'ทานแต่เนื้อ ไม่ซดน้ำ' },
    ],
  },
  q_egg_style: {
    id: 'q_egg_style',
    factorKey: 'egg_style',
    promptTh: 'รูปแบบไข่ในจานนี้',
    whyTh: 'ไข่ดาวทอดน้ำมันกับไข่ต้มให้พลังงานและไขมันต่างกันมาก',
    kind: 'choice',
    options: [
      { value: 'fried', labelTh: 'ไข่ดาวทอดปกติ' },
      { value: 'boiled', labelTh: 'ไข่ต้ม / ไข่ลวก' },
      { value: 'no_egg', labelTh: 'ไม่มีไข่' },
    ],
  },
  q_skin_fat: {
    id: 'q_skin_fat',
    factorKey: 'skin_fat',
    promptTh: 'ลักษณะเนื้อสัตว์และหนังที่ทาน',
    whyTh: 'การลอกหนังไก่หรือเลือกเนื้อไม่ติดมันลดไขมันอิ่มตัวได้ชัดเจน',
    kind: 'choice',
    options: [
      { value: 'normal', labelTh: 'ทานปกติรวมหนัง/มัน' },
      { value: 'lean_no_skin', labelTh: 'ลอกหนัง / เนื้อไม่ติดมัน' },
    ],
  },
  q_sauce: {
    id: 'q_sauce',
    factorKey: 'sauce_amount',
    promptTh: 'การใช้น้ำจิ้ม พริกน้ำปลา หรือเครื่องปรุงเพิ่ม',
    whyTh: 'เครื่องปรุงรสเพิ่มโซเดียมได้สูงโดยไม่เปลี่ยนลักษณะภาพมากนัก',
    kind: 'choice',
    options: [
      { value: 'normal', labelTh: 'ปรุง/จิ้มปกติ' },
      { value: 'less_sauce', labelTh: 'จิ้มน้อย / ไม่ปรุงเพิ่ม' },
      { value: 'extra_sauce', labelTh: 'เติมพริกน้ำปลา/ซอสเพิ่ม' },
    ],
  },
});

const FACTOR_TO_QUESTION_ID = Object.freeze({
  oil_level: 'q_oil_level',
  sweetness_level: 'q_sweetness',
  broth_consumed: 'q_broth',
  egg_style: 'q_egg_style',
  skin_fat: 'q_skin_fat',
  sauce_amount: 'q_sauce',
});

export const ADAPTIVE_SCORE_THRESHOLD = 0.48;
export const ADAPTIVE_MAX_QUESTIONS = 3;

export function normalizeArm(arm) {
  const upper = String(arm || 'B').trim().toUpperCase();
  return EXPERIMENT_ARMS[upper] ? upper : 'B';
}

export function parseExperimentParams(searchString = '') {
  const params = new URLSearchParams(searchString || '');
  const armParam = params.get('arm');
  return {
    arm: armParam ? normalizeArm(armParam) : null,
    participantId: String(params.get('pid') || '').trim().slice(0, 40),
    sessionId: String(params.get('session') || '').trim().slice(0, 40),
    locked: params.get('lock') === '1' || params.get('lock') === 'true',
  };
}

export function getDishUncertaintyMeta(foodId, scanResult = null) {
  const profile = DISH_UNCERTAINTY_PROFILES[foodId] || {
    portionUncertainty: 'medium',
    factors: [
      { key: 'oil_level', uncertainty: 0.65, impact: 0.7 },
      { key: 'sauce_amount', uncertainty: 0.65, impact: 0.7 },
    ],
  };

  const portionUncertainty =
    scanResult?.portionUncertainty || profile.portionUncertainty || 'medium';

  // If AI Vision explicitly reported hiddenFactors, boost those factors
  let factors = profile.factors;
  if (Array.isArray(scanResult?.hiddenFactors) && scanResult.hiddenFactors.length > 0) {
    const map = new Map(profile.factors.map((f) => [f.key, { ...f }]));
    for (const key of scanResult.hiddenFactors) {
      if (!FACTOR_TO_QUESTION_ID[key]) continue;
      if (map.has(key)) {
        const cur = map.get(key);
        cur.uncertainty = Math.max(cur.uncertainty, 0.85);
      } else {
        map.set(key, { key, uncertainty: 0.82, impact: 0.8 });
      }
    }
    factors = Array.from(map.values());
  }

  return { portionUncertainty, factors };
}

function buildDishQuestion(scanResult) {
  const base = QUESTION_TEMPLATES.q_dish_confirm;
  const candidateIds = [];

  if (Array.isArray(scanResult?.topCandidates)) {
    for (const id of scanResult.topCandidates) {
      if (getDishById(id) && !candidateIds.includes(id)) candidateIds.push(id);
    }
  }
  if (scanResult?.foodId && getDishById(scanResult.foodId) && !candidateIds.includes(scanResult.foodId)) {
    candidateIds.unshift(scanResult.foodId);
  }
  // Fill up to 3 common Thai dishes for quick selection if uncertain
  for (const fallbackId of ['pad_krapow_gai', 'som_tum_thai', 'tom_yum_kung']) {
    if (candidateIds.length >= 3) break;
    if (!candidateIds.includes(fallbackId)) candidateIds.push(fallbackId);
  }

  const options = candidateIds.slice(0, 3).map((id) => ({
    value: id,
    labelTh: getDishById(id)?.nameTh || id,
  }));
  options.push({ value: UNKNOWN_DISH_ID, labelTh: 'เมนูอื่น (เลือกด้านล่าง)' });

  return {
    ...base,
    options,
  };
}

/**
 * Core 3-Arm Question Selection Policy:
 * - Arm A (Photo-Only): returns [] (0 questions)
 * - Arm B (Uncertainty-Adaptive): ranks candidates by uncertainty * impact, returns 0..3 questions above threshold
 * - Arm C (Fixed Questionnaire): always returns the fixed 5-question canonical set
 */
export function selectClarificationQuestions(arm, scanResult = {}) {
  const normalizedArm = normalizeArm(arm);

  if (normalizedArm === 'A') {
    return [];
  }

  if (normalizedArm === 'C') {
    return [
      buildDishQuestion(scanResult),
      { ...QUESTION_TEMPLATES.q_portion },
      { ...QUESTION_TEMPLATES.q_oil_level },
      { ...QUESTION_TEMPLATES.q_sweetness },
      { ...QUESTION_TEMPLATES.q_sauce },
    ];
  }

  // Arm B: Uncertainty-Adaptive selection
  const candidates = [];
  const confidence = Number.isFinite(Number(scanResult.confidence))
    ? Number(scanResult.confidence)
    : 0.5;
  const outcome = scanResult.outcome || 'uncertain';
  const foodId = scanResult.foodId || UNKNOWN_DISH_ID;

  if (outcome === 'not_food') {
    // Only ask dish confirmation if user still wants to override a non-food image
    return [
      {
        ...buildDishQuestion(scanResult),
        priorityScore: 0.95,
        whyTh: 'ระบบไม่แน่ใจว่าภาพนี้เป็นอาหาร กรุณายืนยันหรือเลือกเมนู',
      },
    ];
  }

  // 1. Dish identity uncertainty
  if (outcome !== 'matched' || foodId === UNKNOWN_DISH_ID || confidence < 0.78) {
    const dishUncertainty = Math.min(1, Math.max(0.55, 1 - confidence + 0.3));
    candidates.push({
      ...buildDishQuestion(scanResult),
      priorityScore: Math.round(dishUncertainty * 1.0 * 100) / 100,
    });
  }

  const meta = getDishUncertaintyMeta(foodId, scanResult);

  // 2. Portion uncertainty
  if (meta.portionUncertainty === 'high') {
    candidates.push({
      ...QUESTION_TEMPLATES.q_portion,
      priorityScore: 0.76,
    });
  } else if (meta.portionUncertainty === 'medium' && confidence < 0.88) {
    candidates.push({
      ...QUESTION_TEMPLATES.q_portion,
      priorityScore: 0.54,
    });
  }

  // 3. Visually hidden Thai culinary factors
  for (const f of meta.factors) {
    const qId = FACTOR_TO_QUESTION_ID[f.key];
    if (!qId || !QUESTION_TEMPLATES[qId]) continue;
    const score = Math.round(f.uncertainty * f.impact * 100) / 100;
    if (score >= ADAPTIVE_SCORE_THRESHOLD) {
      candidates.push({
        ...QUESTION_TEMPLATES[qId],
        priorityScore: score,
      });
    }
  }

  candidates.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));
  return candidates.slice(0, ADAPTIVE_MAX_QUESTIONS);
}

/**
 * Deterministic, auditable adjustment rules translating user clarification answers
 * into nutrient deltas (Demo mode only; returns null for AI mode!).
 */
export function applyClarificationAdjustments(baseNutrients, answers = {}, mode = 'demo') {
  if (mode === 'ai' || !baseNutrients) {
    return { adjustedNutrients: null, adjustmentLog: [] };
  }

  let kcal = baseNutrients.kcal || 0;
  let proteinG = baseNutrients.proteinG || 0;
  let carbsG = baseNutrients.carbsG || 0;
  let fatG = baseNutrients.fatG || 0;
  let sodiumMg = baseNutrients.sodiumMg || 0;
  let sugarG = baseNutrients.sugarG || 0;
  const fiberG = baseNutrients.fiberG || 0;
  const adjustmentLog = [];

  if (answers.q_oil_level === 'low_oil') {
    fatG = Math.max(0, fatG - 6);
    kcal = Math.max(0, kcal - 54);
    adjustmentLog.push('น้ำมันน้อย (-6 ก. ไขมัน, -54 kcal)');
  } else if (answers.q_oil_level === 'no_oil') {
    const deltaFat = Math.min(fatG, 10);
    fatG = Math.max(0, fatG - deltaFat);
    kcal = Math.max(0, kcal - Math.round(deltaFat * 9));
    adjustmentLog.push(`ไม่ใช้น้ำมัน (-${Math.round(deltaFat)} ก. ไขมัน)`);
  } else if (answers.q_oil_level === 'extra_oil') {
    fatG += 6;
    kcal += 54;
    adjustmentLog.push('มันมาก (+6 ก. ไขมัน, +54 kcal)');
  }

  if (answers.q_sweetness && answers.q_sweetness !== 'normal' && sugarG > 0) {
    const factor =
      answers.q_sweetness === 'sweet_50'
        ? 0.5
        : answers.q_sweetness === 'sweet_25'
          ? 0.25
          : 0.1;
    const removedSugar = Math.round(sugarG * (1 - factor) * 10) / 10;
    sugarG = Math.max(0, Math.round((sugarG - removedSugar) * 10) / 10);
    carbsG = Math.max(0, Math.round((carbsG - removedSugar) * 10) / 10);
    kcal = Math.max(0, Math.round(kcal - removedSugar * 4));
    adjustmentLog.push(`ปรับความหวาน (-${removedSugar} ก. น้ำตาล)`);
  }

  if (answers.q_broth === 'broth_half') {
    const nextSodium = Math.round(sodiumMg * 0.72);
    adjustmentLog.push(`ซดน้ำครึ่งถ้วย (-${sodiumMg - nextSodium} มก. โซเดียม)`);
    sodiumMg = nextSodium;
  } else if (answers.q_broth === 'broth_none') {
    const nextSodium = Math.round(sodiumMg * 0.52);
    adjustmentLog.push(`ไม่ซดน้ำซุป (-${sodiumMg - nextSodium} มก. โซเดียม)`);
    sodiumMg = nextSodium;
  }

  if (answers.q_egg_style === 'boiled') {
    const dFat = Math.min(fatG, 7);
    fatG = Math.max(0, fatG - dFat);
    kcal = Math.max(0, kcal - Math.round(dFat * 9));
    adjustmentLog.push('ไข่ต้มแทนไข่ดาว (-7 ก. ไขมัน, -63 kcal)');
  } else if (answers.q_egg_style === 'no_egg') {
    proteinG = Math.max(0, proteinG - 6.5);
    fatG = Math.max(0, fatG - 12);
    kcal = Math.max(0, kcal - 135);
    adjustmentLog.push('ไม่ใส่ไข่ (-135 kcal)');
  }

  if (answers.q_skin_fat === 'lean_no_skin') {
    const dFat = Math.min(fatG, 8);
    fatG = Math.max(0, fatG - dFat);
    kcal = Math.max(0, kcal - Math.round(dFat * 9));
    adjustmentLog.push('ลอกหนัง/ไม่ติดมัน (-8 ก. ไขมัน, -72 kcal)');
  }

  if (answers.q_sauce === 'less_sauce') {
    const nextSodium = Math.round(sodiumMg * 0.78);
    adjustmentLog.push(`จิ้มน้อย/ไม่ปรุงเพิ่ม (-${sodiumMg - nextSodium} มก. โซเดียม)`);
    sodiumMg = nextSodium;
  } else if (answers.q_sauce === 'extra_sauce') {
    const nextSodium = Math.round(sodiumMg * 1.22);
    adjustmentLog.push(`เติมเครื่องปรุงเพิ่ม (+${nextSodium - sodiumMg} มก. โซเดียม)`);
    sodiumMg = nextSodium;
  }

  proteinG = Math.round(proteinG * 10) / 10;
  carbsG = Math.round(carbsG * 10) / 10;
  fatG = Math.round(fatG * 10) / 10;
  sugarG = Math.round(sugarG * 10) / 10;
  kcal = Math.round(kcal);

  const macroCal = proteinG * 4 + carbsG * 4 + fatG * 9;
  const proteinPct = macroCal > 0 ? Math.round(((proteinG * 4) / macroCal) * 100) : 0;
  const carbsPct = macroCal > 0 ? Math.round(((carbsG * 4) / macroCal) * 100) : 0;

  return {
    adjustedNutrients: {
      ...baseNutrients,
      kcal,
      proteinG,
      carbsG,
      fatG,
      sodiumMg,
      sugarG,
      fiberG,
      macroShares:
        macroCal > 0
          ? { proteinPct, carbsPct, fatPct: Math.max(0, 100 - proteinPct - carbsPct) }
          : { proteinPct: 0, carbsPct: 0, fatPct: 0 },
    },
    adjustmentLog,
  };
}

export function summarizeExperimentByArm(records = []) {
  const arms = ['A', 'B', 'C'];
  const summary = {};

  for (const arm of arms) {
    const armRecs = records.filter((r) => r?.experiment?.arm === arm);
    const count = armRecs.length;
    const avg = (getter) => {
      const vals = armRecs.map(getter).filter((v) => Number.isFinite(v));
      if (vals.length === 0) return null;
      return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
    };

    summary[arm] = {
      arm,
      trialCount: count,
      avgQuestionsShown: avg((r) => r.experiment.questionsShownCount),
      avgQuestionsAnswered: avg((r) => r.experiment.questionsAnsweredCount),
      avgDurationSec: avg((r) =>
        Number.isFinite(r.experiment.totalDurationMs) ? r.experiment.totalDurationMs / 1000 : NaN
      ),
      avgEase: avg((r) => r.experiment.perceivedEase),
      avgConfidence: avg((r) => r.experiment.perceivedConfidence),
      dishChangedRatePct:
        count > 0
          ? Math.round((armRecs.filter((r) => r.experiment.dishChanged).length / count) * 100)
          : null,
    };
  }

  return summary;
}

function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function researchTrialsToCsv(records = []) {
  const headers = [
    'trial_id',
    'timestamp',
    'participant_id',
    'session_id',
    'arm',
    'benchmark_id',
    'benchmark_stratum',
    'mode',
    'provenance',
    'scan_outcome',
    'initial_food_id',
    'initial_confidence',
    'portion_uncertainty',
    'final_food_id',
    'final_food_name_th',
    'dish_changed',
    'gt_food_id',
    'dish_exact_match',
    'final_portion_multiplier',
    'questions_shown_count',
    'questions_answered_count',
    'question_ids_shown',
    'clarification_answers_json',
    'total_duration_ms',
    'clarification_duration_ms',
    'tap_count',
    'perceived_ease_1_5',
    'perceived_confidence_1_5',
    'initial_kcal_illustrative',
    'final_kcal_illustrative',
    'gt_kcal_illustrative',
    'abs_err_kcal',
    'initial_sodium_mg_illustrative',
    'final_sodium_mg_illustrative',
    'abs_err_sodium_mg',
    'initial_sugar_g_illustrative',
    'final_sugar_g_illustrative',
    'abs_err_sugar_g',
    'initial_fat_g_illustrative',
    'final_fat_g_illustrative',
    'note',
  ];

  const rows = [headers.join(',')];

  for (const rec of records) {
    const exp = rec.experiment || {};
    const bmEval = exp.benchmarkEval || null;
    // Enforce scientific safety invariant: AI mode NEVER exports numeric nutrient fixtures or nutrient errors
    const allowNutrients = rec.mode !== 'ai' && rec.nutrients;
    const initN = allowNutrients ? exp.initialNutrients || rec.nutrients : null;
    const finalN = allowNutrients ? rec.nutrients : null;

    const cells = [
      rec.id,
      rec.timestamp,
      exp.participantId || '',
      exp.sessionId || '',
      exp.arm || '',
      exp.benchmarkId || '',
      bmEval?.stratum || '',
      rec.mode,
      rec.provenance,
      rec.scanOutcome || '',
      exp.initialFoodId || rec.foodId,
      rec.confidence ?? '',
      exp.portionUncertainty || '',
      rec.foodId,
      rec.foodNameTh,
      exp.dishChanged !== undefined ? String(Boolean(exp.dishChanged)) : '',
      bmEval?.gtFoodId || '',
      bmEval ? String(Boolean(bmEval.dishExactMatch)) : '',
      rec.portionMultiplier,
      exp.questionsShownCount ?? 0,
      exp.questionsAnsweredCount ?? 0,
      Array.isArray(exp.questionIdsShown) ? exp.questionIdsShown.join('|') : '',
      exp.answers ? JSON.stringify(exp.answers) : '{}',
      exp.totalDurationMs ?? '',
      exp.clarificationDurationMs ?? '',
      exp.tapCount ?? '',
      exp.perceivedEase ?? '',
      exp.perceivedConfidence ?? '',
      initN ? initN.kcal : '',
      finalN ? finalN.kcal : '',
      allowNutrients && bmEval?.gtKcal != null ? bmEval.gtKcal : '',
      allowNutrients && bmEval?.absErrKcal != null ? bmEval.absErrKcal : '',
      initN ? initN.sodiumMg : '',
      finalN ? finalN.sodiumMg : '',
      allowNutrients && bmEval?.absErrSodiumMg != null ? bmEval.absErrSodiumMg : '',
      initN ? initN.sugarG : '',
      finalN ? finalN.sugarG : '',
      allowNutrients && bmEval?.absErrSugarG != null ? bmEval.absErrSugarG : '',
      initN ? initN.fatG : '',
      finalN ? finalN.fatG : '',
      rec.note || '',
    ];
    rows.push(cells.map(escapeCsvCell).join(','));
  }

  return `\uFEFF${rows.join('\r\n')}`;
}
