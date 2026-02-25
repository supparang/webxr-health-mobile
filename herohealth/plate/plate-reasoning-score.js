// === /herohealth/plate/plate-reasoning-score.js ===
// HeroHealth Plate Reasoning Score Core (Analyze / Evaluate / Create) — v1.0
// ✅ Shared scoring engine for Plate reasoning tasks
// ✅ Uses scenario bank + food metadata from plate-reasoning-scenarios.js
// ✅ Supports:
//    - scoreAnalyzeSelection()   : ผู้เล่นจัดจาน + เลือกเหตุผลชิป
//    - scoreEvaluateChoice()     : ผู้เล่นเลือกจาน A/B + เหตุผล
//    - scoreCreatePlate()        : ผู้เล่นสร้างจานตาม constraints
// ✅ Returns detailed rubric breakdown + feedback + misconception tags
// ✅ Deterministic-friendly (pure scoring, no randomness)
//
// Notes:
// - คะแนนรวมมาตรฐาน = 100
//   Analyze/Create: balance 40 + constraints 40 + reasons 20
//   Evaluate     : choice 60 + reasons 30 + explanation 10 (optional)
// - This module is UI-agnostic.
//
// Usage:
//   import {
//     scoreAnalyzeSelection,
//     scoreEvaluateChoice,
//     scoreCreatePlate,
//     detectMisconceptions,
//     summarizeScoreTH
//   } from './plate-reasoning-score.js';

'use strict';

import {
  FOOD_MAP,
  REASON_CHIP_MAP,
  computePlateStats,
  getScenarioById,
  summarizeConstraintsTH
} from './plate-reasoning-scenarios.js';

// --------------------------------------------------
// utilities
// --------------------------------------------------
function clamp(v, a, b){
  v = Number(v) || 0;
  return v < a ? a : (v > b ? b : v);
}
function asArr(v){
  return Array.isArray(v) ? v : [];
}
function asSet(v){
  return new Set(asArr(v).map(String));
}
function uniq(arr){
  return [...new Set(asArr(arr).map(String))];
}
function intersectCount(a=[], b=[]){
  const B = new Set(asArr(b).map(String));
  let n = 0;
  for(const x of asArr(a)) if(B.has(String(x))) n++;
  return n;
}
function hasAny(arr=[], candidates=[]){
  const S = new Set(asArr(arr).map(String));
  return asArr(candidates).some(x => S.has(String(x)));
}
function round1(v){
  return Math.round((Number(v)||0) * 10) / 10;
}
function round0(v){
  return Math.round(Number(v)||0);
}
function pct(n, d){
  if(!d) return 0;
  return (Number(n)||0) / (Number(d)||1);
}
function txt(s){
  return String(s || '').trim();
}
function normText(s){
  return txt(s).toLowerCase();
}

// --------------------------------------------------
// Helpers: infer condition checks from scenario constraints
// --------------------------------------------------
function getScenario(input){
  if(!input) return null;
  if(typeof input === 'string') return getScenarioById(input);
  if(typeof input === 'object' && input.id) return input;
  return null;
}

function plateHasAllergyViolation(stats, scenario){
  const allergy = asArr(scenario?.constraints?.allergy).map(String);
  if(!allergy.length) return false;
  if(allergy.includes('dairy') && (stats?.dairyCount || 0) > 0) return true;

  // extendable:
  // if (allergy.includes('egg')) check egg items by tags later
  return false;
}

function plateBudgetOver(stats, scenario){
  const max = Number(scenario?.constraints?.budgetMax || 0);
  if(!max || max >= 999) return false;
  return Number(stats?.cost || 0) > max;
}

function platePrepOver(stats, scenario){
  const max = Number(scenario?.constraints?.prepTimeMaxMin || 0);
  if(!max) return false;
  return Number(stats?.prepMin || 0) > max;
}

function plateHasHighSugar(stats, scenario){
  if(!scenario?.constraints?.avoidHighSugar) return false;
  return Number(stats?.macros?.sugar || 0) >= 6; // threshold heuristic
}

function plateHasTooMuchFried(stats, scenario){
  const preferNotFried = !!scenario?.targetProfile?.preferNotFried;
  if(!preferNotFried) return false;
  return Number(stats?.friedCount || 0) >= 1;
}

function plateGroupCoverageScore(stats, scenario){
  const want = asArr(scenario?.targetProfile?.wantGroups);
  if(!want.length){
    // generic all-5 coverage heuristic
    const distinct = Number(stats?.distinctGroupCount || 0);
    return clamp((distinct / 5) * 100, 0, 100);
  }

  const groups = stats?.groups || {};
  let hit = 0;
  for(const g of want){
    if((groups[g] || 0) > 0) hit++;
  }

  const base = pct(hit, want.length) * 100;

  // bonus for optional groups
  const opt = asArr(scenario?.targetProfile?.optionalGroups);
  let optHit = 0;
  for(const g of opt){
    if((groups[g] || 0) > 0) optHit++;
  }
  const optBonus = opt.length ? pct(optHit, opt.length) * 10 : 0; // max +10

  return clamp(base + optBonus, 0, 100);
}

function plateMacroBalanceScore(stats, scenario){
  const m = stats?.macros || {};
  const protein = Number(m.protein || 0);
  const carb    = Number(m.carb || 0);
  const fat     = Number(m.fat || 0);
  const sugar   = Number(m.sugar || 0);

  let score = 100;

  // protein target
  const minProtein = Number(scenario?.targetProfile?.minProteinScore || 0);
  if(minProtein > 0 && protein < minProtein){
    score -= clamp((minProtein - protein) * 12, 0, 40);
  }

  // carb too high (simple heuristic)
  if(carb >= 11) score -= 18;
  else if(carb >= 9) score -= 10;

  // fat too high / too many fried
  if(fat >= 10) score -= 18;
  else if(fat >= 8) score -= 10;

  if((stats?.friedCount || 0) >= 1 && scenario?.targetProfile?.preferNotFried) score -= 14;
  if(scenario?.constraints?.avoidHighSugar && sugar >= 6) score -= 18;
  else if(scenario?.constraints?.avoidHighSugar && sugar >= 4) score -= 8;

  // reward variety lightly
  const distinct = Number(stats?.distinctGroupCount || 0);
  if(distinct >= 4) score += 6;
  if(distinct >= 5) score += 4;

  return clamp(score, 0, 100);
}

function plateContextFitScore(stats, scenario){
  const c = scenario?.constraints || {};
  const ctx = String(c.context || '');
  const m = stats?.macros || {};

  let score = 100;

  if(ctx === 'preworkout'){
    // pre-workout: some carb + adequate protein + not too heavy/fried/sugary
    if((m.carb||0) < 3) score -= 18;
    if((m.protein||0) < 4) score -= 20;
    if((m.fat||0) > 9) score -= 18;
    if((stats?.friedCount||0) >= 1) score -= 12;
    if((m.sugar||0) >= 6) score -= 12;
  } else if(ctx === 'postworkout'){
    // post-workout: protein + carb matter
    if((m.protein||0) < 5) score -= 22;
    if((m.carb||0) < 4) score -= 18;
    if((stats?.friedCount||0) >= 1) score -= 10;
    if((m.sugar||0) >= 6) score -= 10;
  } else if(ctx === 'school_morning' || ctx === 'exam_day'){
    // quick, not too sugary, not too heavy
    if((m.protein||0) < 2) score -= 12;
    if((m.carb||0) < 2) score -= 10;
    if((m.sugar||0) >= 6) score -= 20;
    if((m.fat||0) >= 10) score -= 14;
  } else if(ctx === 'lunch_weight_control'){
    if((stats?.groups?.veg||0) <= 0) score -= 25;
    if((m.carb||0) >= 10) score -= 18;
    if((m.fat||0) >= 10) score -= 18;
    if((m.sugar||0) >= 6) score -= 12;
  } else if(ctx === 'home_limited'){
    // emphasize "best use of what's available" elsewhere via reasons; keep neutral
    score -= 0;
  }

  return clamp(score, 0, 100);
}

function scoreBalance(stats, scenario){
  // Weighted blend => 0..40
  const coverage = plateGroupCoverageScore(stats, scenario); // 0..100
  const macroBal = plateMacroBalanceScore(stats, scenario);  // 0..100
  const context  = plateContextFitScore(stats, scenario);    // 0..100

  const composite = (coverage * 0.40) + (macroBal * 0.35) + (context * 0.25);
  const score40 = clamp(Math.round(composite * 0.40), 0, 40);

  return {
    score: score40,
    max: 40,
    metrics: {
      coverageScore100: round1(coverage),
      macroBalanceScore100: round1(macroBal),
      contextFitScore100: round1(context),
      composite100: round1(composite)
    }
  };
}

function scoreConstraints(stats, scenario){
  let s = 40;
  const penalties = [];
  const bonuses = [];

  if(plateBudgetOver(stats, scenario)){
    s -= 15;
    penalties.push('budget_over');
  } else if(Number(scenario?.constraints?.budgetMax || 0) < 999 && Number(scenario?.constraints?.budgetMax || 0) > 0){
    bonuses.push('budget_fit');
  }

  if(platePrepOver(stats, scenario)){
    s -= 15;
    penalties.push('time_over');
  } else if(Number(scenario?.constraints?.prepTimeMaxMin || 0) > 0){
    bonuses.push('time_fit');
  }

  if(plateHasAllergyViolation(stats, scenario)){
    s -= 22;
    penalties.push('allergy_violated');
  } else if(asArr(scenario?.constraints?.allergy).length){
    bonuses.push('allergy_safe');
  }

  if(plateHasHighSugar(stats, scenario)){
    s -= 8;
    penalties.push('sugar_high');
  }

  if(plateHasTooMuchFried(stats, scenario)){
    s -= 8;
    penalties.push('fried_high');
  }

  s = clamp(s, 0, 40);

  return {
    score: s,
    max: 40,
    penalties,
    bonuses
  };
}

function inferPositiveReasonTargets(stats, scenario){
  const out = new Set();

  // from scenario recommended list (positive ones)
  for(const id of asArr(scenario?.recommendedReasonChipIds)){
    const chip = REASON_CHIP_MAP[id];
    if(chip && chip.polarity === 'good') out.add(id);
  }

  // dynamic checks (positive)
  if(!plateBudgetOver(stats, scenario) && Number(scenario?.constraints?.budgetMax||0) < 999) out.add('budget_fit');
  if(!platePrepOver(stats, scenario) && Number(scenario?.constraints?.prepTimeMaxMin||0) > 0) out.add('time_fit');
  if(!plateHasAllergyViolation(stats, scenario) && asArr(scenario?.constraints?.allergy).length) out.add('allergy_safe');

  // balance-ish
  if((stats?.groups?.veg || 0) > 0) out.add('veg_enough');
  if((stats?.groups?.protein || 0) > 0) out.add('protein_ok');
  if((stats?.groups?.carb || 0) > 0) out.add('carb_ok');

  // context
  const ctx = String(scenario?.constraints?.context || '');
  if(ctx === 'preworkout') out.add('preworkout_fit');
  if(ctx === 'postworkout') out.add('postworkout_fit');
  if(ctx === 'school_morning' || ctx === 'exam_day') out.add('school_morning_fit');
  if(ctx === 'home_limited') out.add('home_ingredient_fit');

  // fat / sugar
  if((stats?.macros?.sugar || 0) <= 3) out.add('fat_ok');

  return [...out];
}

function inferNegativeReasonTargets(stats, scenario){
  const out = new Set();

  // dynamic negatives
  if(plateBudgetOver(stats, scenario)) out.add('budget_over');
  if(platePrepOver(stats, scenario)) out.add('time_over');
  if(plateHasAllergyViolation(stats, scenario)) out.add('allergy_violated');
  if(plateHasHighSugar(stats, scenario)) out.add('sugar_high');
  if(plateHasTooMuchFried(stats, scenario)) out.add('fried_high');

  const groups = stats?.groups || {};
  const m = stats?.macros || {};

  if((groups.veg || 0) <= 0) out.add('veg_too_low');
  if((groups.protein || 0) <= 0 || (m.protein || 0) < Number(scenario?.targetProfile?.minProteinScore || 0)) out.add('protein_too_low');
  if((m.carb || 0) >= 10) out.add('carb_too_high');
  if((m.fat || 0) >= 10 || (stats?.friedCount||0) >= 1) out.add('fried_high');

  // context-specific energy cues
  const ctx = String(scenario?.constraints?.context || '');
  if((ctx === 'lunch_weight_control' || ctx === 'school_morning' || ctx === 'exam_day') && ((m.carb||0)+(m.fat||0)+(m.sugar||0) >= 20)){
    out.add('energy_too_high');
  }
  if((ctx === 'preworkout' || ctx === 'postworkout') && ((m.protein||0)+(m.carb||0) < 6)){
    out.add('energy_too_low');
  }

  return [...out];
}

function scoreReasonsForPlate({ selectedReasonChipIds=[], stats, scenario, explanationText='' } = {}){
  const selected = uniq(selectedReasonChipIds);
  const selectedSet = new Set(selected);

  const posTargets = inferPositiveReasonTargets(stats, scenario);
  const negTargets = inferNegativeReasonTargets(stats, scenario);

  let score = 20;
  const matchedGood = [];
  const matchedBad  = [];
  const wrongClaims = [];
  const noiseClaims = [];

  for(const id of selected){
    const chip = REASON_CHIP_MAP[id];
    if(!chip){
      noiseClaims.push(id);
      score -= 1;
      continue;
    }
    if(chip.polarity === 'good'){
      if(posTargets.includes(id)){
        matchedGood.push(id);
        score += 2;
      }else{
        wrongClaims.push(id);
        score -= 3;
      }
    }else{
      if(negTargets.includes(id)){
        matchedBad.push(id);
        score += 2;
      }else{
        wrongClaims.push(id);
        score -= 2;
      }
    }
  }

  // Encourage at least 1-2 relevant reasons
  if(matchedGood.length + matchedBad.length === 0){
    score -= 6;
  }else if(matchedGood.length + matchedBad.length >= 2){
    score += 2;
  }

  // Penalize selecting too many random chips (spray-and-pray)
  if(selected.length > 5){
    score -= Math.min(6, (selected.length - 5));
  }

  // Tiny bonus if explanation text exists and is nontrivial
  if(txt(explanationText).length >= 8) score += 1;
  if(txt(explanationText).length >= 20) score += 1;

  score = clamp(score, 0, 20);

  return {
    score,
    max: 20,
    selected,
    matchedGood,
    matchedBad,
    wrongClaims,
    noiseClaims,
    targets: { positive: posTargets, negative: negTargets }
  };
}

// --------------------------------------------------
// Misconception detection
// --------------------------------------------------
export function detectMisconceptions({ stats, scenario, selectedReasonChipIds=[] } = {}){
  const tags = [];
  const m = stats?.macros || {};
  const groups = stats?.groups || {};
  const selected = uniq(selectedReasonChipIds);

  if((groups.veg || 0) <= 0) tags.push('veg_missing');
  if((groups.protein || 0) <= 0) tags.push('protein_missing');
  if((m.carb || 0) >= 10) tags.push('carb_overload');
  if((m.sugar || 0) >= 6) tags.push('sugar_high');
  if((stats?.friedCount || 0) >= 1) tags.push('fried_item_used');
  if(plateHasAllergyViolation(stats, scenario)) tags.push('allergy_violation');
  if(plateBudgetOver(stats, scenario)) tags.push('budget_over');
  if(platePrepOver(stats, scenario)) tags.push('time_over');

  // reasoning misconceptions
  if(selected.includes('allergy_safe') && plateHasAllergyViolation(stats, scenario)){
    tags.push('reason_contradiction_allergy');
  }
  if(selected.includes('budget_fit') && plateBudgetOver(stats, scenario)){
    tags.push('reason_contradiction_budget');
  }
  if(selected.includes('time_fit') && platePrepOver(stats, scenario)){
    tags.push('reason_contradiction_time');
  }
  if(selected.includes('fat_ok') && ((m.fat||0)>=10 || (stats?.friedCount||0)>=1)){
    tags.push('reason_contradiction_fat');
  }
  if(selected.includes('veg_enough') && (groups.veg||0) <= 0){
    tags.push('reason_contradiction_veg');
  }

  return uniq(tags);
}

// --------------------------------------------------
// Analyze / Create scoring
// --------------------------------------------------
function scorePlateSelectionCore({ scenario, itemIds=[], selectedReasonChipIds=[], explanationText='' } = {}){
  const scn = getScenario(scenario);
  if(!scn){
    return {
      ok: false,
      error: 'SCENARIO_NOT_FOUND',
      score: 0
    };
  }

  const cleanedItemIds = uniq(itemIds).filter(id => !!FOOD_MAP[id]);
  const stats = computePlateStats(cleanedItemIds);

  const balance = scoreBalance(stats, scn);        // /40
  const constraints = scoreConstraints(stats, scn);// /40
  const reasons = scoreReasonsForPlate({
    selectedReasonChipIds,
    stats,
    scenario: scn,
    explanationText
  }); // /20

  const total = clamp(balance.score + constraints.score + reasons.score, 0, 100);
  const misconceptions = detectMisconceptions({
    stats,
    scenario: scn,
    selectedReasonChipIds
  });

  const passLevel = total >= 75 ? 'good' : (total >= 55 ? 'fair' : 'needs_improve');

  return {
    ok: true,
    score: total,
    max: 100,
    passLevel,
    breakdown: {
      balanceScore: balance.score,
      balanceMax: balance.max,
      constraintScore: constraints.score,
      constraintMax: constraints.max,
      reasonScore: reasons.score,
      reasonMax: reasons.max
    },
    rubric: {
      balance,
      constraints,
      reasons
    },
    stats,
    scenario: {
      id: scn.id,
      titleTH: scn.titleTH,
      constraintsSummaryTH: summarizeConstraintsTH(scn)
    },
    misconceptions,
    feedbackTH: buildPlateFeedbackTH({
      score: total,
      stats,
      scenario: scn,
      balance,
      constraints,
      reasons,
      misconceptions
    })
  };
}

export function scoreAnalyzeSelection(payload={}){
  const res = scorePlateSelectionCore(payload);
  if(!res.ok) return res;
  return {
    ...res,
    taskType: 'analyze'
  };
}

export function scoreCreatePlate(payload={}){
  const res = scorePlateSelectionCore(payload);
  if(!res.ok) return res;
  return {
    ...res,
    taskType: 'create'
  };
}

// --------------------------------------------------
// Evaluate (A/B critique) scoring
// --------------------------------------------------
function scoreEvaluateReasons({
  selectedReasonChipIds=[],
  correctPlateStats,
  wrongPlateStats,
  scenario,
  explanationText=''
} = {}){
  const selected = uniq(selectedReasonChipIds);
  let score = 20; // base for reasons only (will normalize to 30)
  const matched = [];
  const wrongClaims = [];

  const goodTargets = new Set(inferPositiveReasonTargets(correctPlateStats, scenario));
  const badTargets  = new Set(inferNegativeReasonTargets(wrongPlateStats, scenario));

  for(const id of selected){
    const chip = REASON_CHIP_MAP[id];
    if(!chip){
      score -= 1;
      continue;
    }
    if(chip.polarity === 'good'){
      if(goodTargets.has(id)){ matched.push(id); score += 2; }
      else { wrongClaims.push(id); score -= 2; }
    }else{
      if(badTargets.has(id)){ matched.push(id); score += 2; }
      else { wrongClaims.push(id); score -= 2; }
    }
  }

  if(matched.length === 0) score -= 6;
  if(selected.length > 5) score -= Math.min(5, selected.length - 5);

  // explanation text bonus on the "reasons" part
  if(txt(explanationText).length >= 12) score += 1;
  if(txt(explanationText).length >= 24) score += 1;

  score = clamp(score, 0, 20);

  // normalize 20 -> 30
  const score30 = clamp(Math.round(score * 1.5), 0, 30);

  return {
    score: score30,
    max: 30,
    raw20: score,
    matched,
    wrongClaims,
    targets: {
      positiveOnBetterPlate: [...goodTargets],
      negativeOnWorsePlate: [...badTargets]
    }
  };
}

function scoreEvaluateExplanationText(explanationText=''){
  const s = txt(explanationText);
  if(!s) return { score: 0, max: 10, flags:['missing_text'] };

  let score = 4;
  const flags = [];

  if(s.length >= 12) score += 2; else flags.push('too_short');
  if(s.length >= 24) score += 2;
  if(s.length >= 40) score += 1;

  // crude keyword cues (Thai)
  const t = normText(s);
  const cues = ['ผัก','โปรตีน','แป้ง','คาร์บ','น้ำตาล','หวาน','ทอด','งบ','เวลา','แพ้','สมดุล','เหมาะ'];
  const hitCue = cues.some(k => t.includes(k));
  if(hitCue) score += 1; else flags.push('low_specificity');

  return { score: clamp(score, 0, 10), max: 10, flags };
}

/**
 * scoreEvaluateChoice
 * payload:
 * {
 *   scenario,                // scenario object or id
 *   pair,                    // result from buildEvaluatePair()
 *   selectedChoice,          // 'A' | 'B'
 *   selectedReasonChipIds,   // [chip ids]
 *   explanationText          // optional
 * }
 */
export function scoreEvaluateChoice(payload={}){
  const scn = getScenario(payload.scenario || payload?.pair?.scenarioId);
  if(!scn){
    return { ok:false, error:'SCENARIO_NOT_FOUND', score:0 };
  }

  const pair = payload.pair || null;
  if(!pair || !pair.A || !pair.B || !pair.correctChoice){
    return { ok:false, error:'PAIR_INVALID', score:0 };
  }

  const selectedChoice = String(payload.selectedChoice || '').toUpperCase();
  const selectedReasonChipIds = uniq(payload.selectedReasonChipIds || []);
  const explanationText = txt(payload.explanationText || '');

  const isChoiceValid = (selectedChoice === 'A' || selectedChoice === 'B');
  const choiceCorrect = isChoiceValid && selectedChoice === String(pair.correctChoice).toUpperCase();

  // choice score /60
  const choiceScore = choiceCorrect ? 60 : (isChoiceValid ? 12 : 0);

  const better = String(pair.correctChoice).toUpperCase() === 'A' ? pair.A : pair.B;
  const worse  = String(pair.correctChoice).toUpperCase() === 'A' ? pair.B : pair.A;

  const betterStats = better.stats || computePlateStats(better.itemIds || []);
  const worseStats  = worse.stats || computePlateStats(worse.itemIds || []);

  const reasons = scoreEvaluateReasons({
    selectedReasonChipIds,
    correctPlateStats: betterStats,
    wrongPlateStats: worseStats,
    scenario: scn,
    explanationText
  }); // /30

  const expl = scoreEvaluateExplanationText(explanationText); // /10

  const total = clamp(choiceScore + reasons.score + expl.score, 0, 100);

  // misconception typing specific to evaluate
  let misconceptionType = '';
  if(!isChoiceValid){
    misconceptionType = 'no_choice';
  }else if(!choiceCorrect){
    // infer possible reason
    const badStats = worseStats;
    const m = badStats.macros || {};
    const g = badStats.groups || {};
    if((g.veg||0) <= 0) misconceptionType = 'chose_low_veg_plate';
    else if((m.sugar||0) >= 6) misconceptionType = 'chose_high_sugar_plate';
    else if((badStats.friedCount||0) >= 1) misconceptionType = 'chose_fried_heavy_plate';
    else if(plateHasAllergyViolation(badStats, scn)) misconceptionType = 'ignored_allergy_constraint';
    else if(plateBudgetOver(badStats, scn)) misconceptionType = 'ignored_budget_constraint';
    else misconceptionType = 'wrong_plate_choice';
  } else if(reasons.score < 12){
    misconceptionType = 'correct_choice_weak_reasoning';
  } else {
    misconceptionType = 'none';
  }

  return {
    ok: true,
    taskType: 'evaluate',
    score: total,
    max: 100,
    choiceCorrect: !!choiceCorrect,
    selectedChoice: isChoiceValid ? selectedChoice : '',
    correctChoice: String(pair.correctChoice).toUpperCase(),
    misconceptionType,
    breakdown: {
      choiceScore,
      choiceMax: 60,
      reasonScore: reasons.score,
      reasonMax: reasons.max,
      explanationScore: expl.score,
      explanationMax: expl.max
    },
    rubric: {
      reasons,
      explanation: expl
    },
    scenario: {
      id: scn.id,
      titleTH: scn.titleTH,
      constraintsSummaryTH: summarizeConstraintsTH(scn)
    },
    pairSummary: {
      A: { itemIds: asArr(pair.A.itemIds), stats: pair.A.stats || computePlateStats(pair.A.itemIds || []) },
      B: { itemIds: asArr(pair.B.itemIds), stats: pair.B.stats || computePlateStats(pair.B.itemIds || []) }
    },
    feedbackTH: buildEvaluateFeedbackTH({
      total,
      choiceCorrect,
      pair,
      selectedChoice,
      reasons,
      explanation: expl,
      misconceptionType
    })
  };
}

// --------------------------------------------------
// Feedback generators (Thai)
// --------------------------------------------------
function topPlateIssues(stats, scenario){
  const issues = [];
  const groups = stats?.groups || {};
  const m = stats?.macros || {};

  if((groups.veg || 0) <= 0) issues.push('ผักน้อย/ไม่มีผัก');
  if((groups.protein || 0) <= 0 || (m.protein || 0) < Number(scenario?.targetProfile?.minProteinScore || 0)) issues.push('โปรตีนยังไม่พอ');
  if((m.carb || 0) >= 10) issues.push('คาร์โบไฮเดรตค่อนข้างมาก');
  if((m.sugar || 0) >= 6) issues.push('น้ำตาลสูง');
  if((stats?.friedCount || 0) >= 1) issues.push('มีของทอด/ไขมันสูง');
  if(plateBudgetOver(stats, scenario)) issues.push('เกินงบประมาณ');
  if(platePrepOver(stats, scenario)) issues.push('ใช้เวลาเตรียมนานเกินเงื่อนไข');
  if(plateHasAllergyViolation(stats, scenario)) issues.push('มีอาหารที่ขัดกับข้อจำกัดการแพ้');

  return issues.slice(0, 3);
}

function topPlateStrengths(stats, scenario){
  const out = [];
  const groups = stats?.groups || {};
  const m = stats?.macros || {};

  if((stats?.distinctGroupCount || 0) >= 4) out.push('มีความหลากหลายของหมู่อาหารดี');
  if((groups.veg || 0) > 0) out.push('มีผักในจาน');
  if((groups.protein || 0) > 0) out.push('มีแหล่งโปรตีน');
  if(!plateBudgetOver(stats, scenario) && Number(scenario?.constraints?.budgetMax||0) < 999) out.push('อยู่ในงบประมาณ');
  if(!platePrepOver(stats, scenario)) out.push('อยู่ในเวลาที่กำหนด');
  if(!plateHasAllergyViolation(stats, scenario) && asArr(scenario?.constraints?.allergy).length) out.push('หลีกเลี่ยงอาหารที่แพ้ได้ถูกต้อง');
  if((m.sugar || 0) <= 3 && scenario?.constraints?.avoidHighSugar) out.push('น้ำตาลไม่สูงเกินไป');

  return uniq(out).slice(0, 3);
}

function buildPlateFeedbackTH({ score, stats, scenario, balance, constraints, reasons, misconceptions } = {}){
  const lines = [];
  const strengths = topPlateStrengths(stats, scenario);
  const issues = topPlateIssues(stats, scenario);

  if(score >= 85){
    lines.push('ยอดเยี่ยม! จานนี้ตรงโจทย์และมีเหตุผลสอดคล้องดีมาก');
  }else if(score >= 70){
    lines.push('ดีมาก จานนี้ค่อนข้างเหมาะสมกับสถานการณ์');
  }else if(score >= 55){
    lines.push('พอใช้ได้ แต่ยังมีจุดที่ควรปรับเพื่อให้ตรงเงื่อนไขมากขึ้น');
  }else{
    lines.push('ยังไม่ผ่านโจทย์มากนัก ลองปรับองค์ประกอบจานและเหตุผลอีกครั้ง');
  }

  if(strengths.length){
    lines.push(`จุดดี: ${strengths.join(' / ')}`);
  }
  if(issues.length){
    lines.push(`ควรปรับ: ${issues.join(' / ')}`);
  }

  // rubric hint
  if((balance?.score || 0) < 24) lines.push('ลองเพิ่มความสมดุลของหมู่อาหาร (โดยเฉพาะผัก/โปรตีน)');
  if((constraints?.score || 0) < 24) lines.push('ตรวจเงื่อนไขโจทย์อีกครั้ง เช่น งบ เวลา หรือข้อจำกัดการแพ้');
  if((reasons?.score || 0) < 10) lines.push('เลือกเหตุผลให้สอดคล้องกับจานมากขึ้น (อย่าเลือกชิปหลายอันแบบสุ่ม)');

  if(asArr(misconceptions).includes('reason_contradiction_allergy')){
    lines.push('มีความขัดแย้งในเหตุผล: เลือกว่า “ปลอดภัยต่อการแพ้” แต่จานยังมีอาหารที่แพ้');
  }

  return lines.join(' • ');
}

function buildEvaluateFeedbackTH({ total, choiceCorrect, pair, selectedChoice, reasons, explanation, misconceptionType } = {}){
  const lines = [];

  if(choiceCorrect){
    lines.push('เลือกจานได้ถูกต้อง ✅');
  }else{
    lines.push('การเลือกจานยังไม่ถูกต้อง ❌');
  }

  if(total >= 85){
    lines.push('การวิเคราะห์และให้เหตุผลทำได้ดีมาก');
  }else if(total >= 70){
    lines.push('ให้เหตุผลได้ดี แต่ยังเพิ่มความเฉพาะเจาะจงได้อีก');
  }else if(total >= 55){
    lines.push('เริ่มจับประเด็นได้ แต่เหตุผลยังไม่ชัดหรือไม่ครบ');
  }else{
    lines.push('ควรฝึกดูความต่างของ “ความสมดุล + ข้อจำกัดโจทย์” ให้มากขึ้น');
  }

  if((reasons?.score || 0) < 15){
    lines.push('ลองใช้เหตุผลที่อธิบายทั้ง “จุดดีของจานที่เลือก” และ “จุดอ่อนของอีกจาน”');
  }
  if((explanation?.score || 0) < 5){
    lines.push('เพิ่มคำอธิบายสั้น ๆ เช่น ผัก/โปรตีน/น้ำตาล/งบ/เวลา จะช่วยให้คะแนนดีขึ้น');
  }

  // misconception tip
  if(misconceptionType && misconceptionType !== 'none'){
    const m = {
      no_choice: 'ยังไม่ได้เลือก A หรือ B',
      chose_low_veg_plate: 'อาจมองข้ามเรื่องปริมาณผัก',
      chose_high_sugar_plate: 'อาจมองข้ามน้ำตาลสูง',
      chose_fried_heavy_plate: 'อาจมองข้ามของทอด/ไขมันสูง',
      ignored_allergy_constraint: 'อาจมองข้ามข้อจำกัดการแพ้อาหาร',
      ignored_budget_constraint: 'อาจมองข้ามงบประมาณ',
      wrong_plate_choice: 'ลองเทียบความสมดุลและข้อจำกัดให้ครบทุกด้าน',
      correct_choice_weak_reasoning: 'เลือกถูกแล้ว แต่เหตุผลยังไม่ชัดพอ'
    };
    lines.push(`ข้อสังเกต: ${m[misconceptionType] || misconceptionType}`);
  }

  return lines.join(' • ');
}

// --------------------------------------------------
// Compact summary helpers (for UI chips / logs)
// --------------------------------------------------
export function summarizeScoreTH(result){
  if(!result || !result.ok){
    return {
      titleTH: 'ให้คะแนนไม่สำเร็จ',
      gradeLike: '—',
      colorKey: 'muted',
      shortTH: 'ไม่พบข้อมูลโจทย์หรือข้อมูลไม่ครบ'
    };
  }

  const score = Number(result.score || 0);
  let gradeLike = 'D';
  let colorKey = 'danger';
  let levelTH = 'ควรปรับปรุง';

  if(score >= 90){ gradeLike='S'; colorKey='success'; levelTH='ยอดเยี่ยม'; }
  else if(score >= 80){ gradeLike='A'; colorKey='success'; levelTH='ดีมาก'; }
  else if(score >= 70){ gradeLike='B'; colorKey='info'; levelTH='ดี'; }
  else if(score >= 55){ gradeLike='C'; colorKey='warning'; levelTH='พอใช้'; }

  let shortTH = `${levelTH} (${score}/100)`;

  if(result.taskType === 'evaluate'){
    shortTH += result.choiceCorrect ? ' • เลือกจานถูก' : ' • เลือกจานผิด';
  }else{
    const b = result.breakdown || {};
    shortTH += ` • สมดุล ${b.balanceScore ?? 0}/${b.balanceMax ?? 40}`;
    shortTH += ` • เงื่อนไข ${b.constraintScore ?? 0}/${b.constraintMax ?? 40}`;
    shortTH += ` • เหตุผล ${b.reasonScore ?? 0}/${b.reasonMax ?? 20}`;
  }

  return {
    titleTH: `ผลการประเมิน: ${levelTH}`,
    gradeLike,
    colorKey,
    shortTH
  };
}

// --------------------------------------------------
// Debug helper (optional)
// --------------------------------------------------
export function explainPlateQuick({ scenario, itemIds=[] } = {}){
  const scn = getScenario(scenario);
  if(!scn) return { ok:false, error:'SCENARIO_NOT_FOUND' };

  const stats = computePlateStats(itemIds);
  const balance = scoreBalance(stats, scn);
  const constraints = scoreConstraints(stats, scn);

  return {
    ok: true,
    scenarioId: scn.id,
    stats,
    preview: {
      balanceScore40: balance.score,
      constraintScore40: constraints.score,
      likelyIssues: topPlateIssues(stats, scn),
      likelyStrengths: topPlateStrengths(stats, scn)
    }
  };
}