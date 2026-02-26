// === /herohealth/plate/plate-reasoning-score.js ===
// Plate Reasoning Score Core — PRODUCTION+ — v1.0
// Shared scoring for: Analyze (Scenario), Evaluate (A/B Critique), Create (Constraint)
//
// Exports:
//   scorePlateEvaluateAB(payload)
//   scorePlateCreate(payload)
//   scorePlateAnalyzeScenario(payload)
//
// Common output:
//   {
//     ok:true,
//     mode:'evaluate'|'create'|'analyze',
//     totalScore: 0..100,
//     total01: 0..1,
//     pass: boolean,
//     breakdown: { balance01, constraints01, reasoning01, ... },
//     feedbackText: string,
//     summaryText: string,
//     labels: { ... }   // ML-ready targets/features
//   }

'use strict';

// ---------------- Thai 5 food groups mapping (fixed) ----------------
// 1 โปรตีน (เนื้อ นม ไข่ ถั่วเมล็ดแห้ง)
// 2 คาร์โบไฮเดรต (ข้าว แป้ง เผือก มัน น้ำตาล)
// 3 ผัก
// 4 ผลไม้
// 5 ไขมัน
export const FOOD_GROUPS_TH = {
  1: { id:1, th:'โปรตีน', short:'โปรตีน' },
  2: { id:2, th:'คาร์โบไฮเดรต', short:'คาร์บ' },
  3: { id:3, th:'ผัก', short:'ผัก' },
  4: { id:4, th:'ผลไม้', short:'ผลไม้' },
  5: { id:5, th:'ไขมัน', short:'ไขมัน' },
};

const clamp = (v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };
const uniq = (arr)=>[...new Set(Array.isArray(arr)?arr:[])];

function budgetRank(b){
  if(b === 'low') return 1;
  if(b === 'mid') return 2;
  if(b === 'high') return 3;
  return 2;
}

function normText(s){
  return String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
}

function countGroups(selectedFoods){
  const gCount = {1:0,2:0,3:0,4:0,5:0,0:0};
  for(const f of (selectedFoods||[])){
    const g = Number(f?.g)||0;
    if(gCount[g] == null) gCount[g] = 0;
    gCount[g]++;
  }
  const distinct = [1,2,3,4,5].filter(g=>gCount[g]>0).length;
  return { gCount, distinct };
}

// ---------------- Balance model ----------------
// Outputs score01, distinct, imbalance01, processedPenalty
function evaluateBalance(selectedFoods){
  const { gCount, distinct } = countGroups(selectedFoods);
  const a = [1,2,3,4,5].map(g=>gCount[g]||0);
  const sum = a.reduce((s,v)=>s+v,0);

  const processedCount = (gCount[0]||0);
  const mean = sum>0 ? sum/5 : 0;

  // mean absolute deviation normalized
  let mad = 0;
  for(const v of a) mad += Math.abs(v-mean);
  mad = (sum>0) ? (mad/5) : 0;

  // normalize imbalance 0..1
  const imbalance01 = clamp(mean>0 ? (mad/(mean*2)) : 1, 0, 1);

  // base: distinct coverage
  let score01 = distinct / 5;

  // penalty if over-dominant single group
  const maxOne = Math.max(...a, 0);
  if(maxOne >= 3) score01 -= 0.12;
  if(maxOne >= 4) score01 -= 0.12;

  // penalty for processed/out-of-scope
  const processedPenalty = clamp(processedCount * 0.12, 0, 0.36);
  score01 -= processedPenalty;

  // penalty for imbalance
  score01 -= clamp(imbalance01 * 0.22, 0, 0.22);

  score01 = clamp(score01, 0, 1);

  return { score01, distinct, gCount, imbalance01, processedCount, processedPenalty };
}

// ---------------- Constraint model ----------------
function evaluateConstraints(selectedFoods, scenario){
  const c = scenario?.constraints || {};
  let score01 = 1;
  let pass = true;
  const issues = [];
  const positives = [];

  const { distinct, gCount } = countGroups(selectedFoods);

  if(c.requireGroupsMin != null){
    if(distinct < Number(c.requireGroupsMin||0)){
      pass = false;
      score01 -= 0.25;
      issues.push(`ยังไม่ถึง ${c.requireGroupsMin} หมู่`);
    }else{
      positives.push(`มีอย่างน้อย ${distinct} หมู่`);
    }
  }

  if(c.noDairy){
    const dairyHit = (selectedFoods||[]).some(f=>!!f?.dairy);
    if(dairyHit){
      pass = false;
      score01 -= 0.35;
      issues.push('มีอาหารที่มีนม/ผลิตภัณฑ์นม');
    }else{
      positives.push('หลีกเลี่ยงนมได้ถูกต้อง');
    }
  }

  if(c.highProtein){
    const hasP = (selectedFoods||[]).some(f=>(Number(f?.g)===1) || !!f?.highProtein);
    if(!hasP){
      pass = false;
      score01 -= 0.25;
      issues.push('โจทย์นี้ต้องการโปรตีนสูง');
    }else{
      positives.push('มีแหล่งโปรตีน');
    }
  }

  if(c.preWorkout){
    const bad = (selectedFoods||[]).filter(f => (f?.preWorkout === false) || !!f?.processed || (Number(f?.g)===0));
    if(bad.length >= 2){
      pass = false;
      score01 -= 0.25;
      issues.push('มีของที่ไม่เหมาะก่อนออกกำลังมากไป');
    }else{
      positives.push('ค่อนข้างเหมาะก่อนออกกำลังกาย');
    }
  }

  if(c.avoidProcessed){
    const p = (selectedFoods||[]).filter(f=>!!f?.processed || (Number(f?.g)===0)).length;
    if(p >= 2){
      pass = false;
      score01 -= 0.25;
      issues.push('มีอาหารแปรรูป/หวาน/ทอดมากเกินไป');
    }else if(p === 1){
      score01 -= 0.08;
      issues.push('มีอาหารแปรรูป 1 รายการ');
    }else{
      positives.push('หลีกเลี่ยงอาหารแปรรูปได้ดี');
    }
  }

  if(c.timeMaxMin != null){
    const avgPrep = (selectedFoods||[]).length
      ? (selectedFoods.reduce((s,f)=>s+(Number(f?.prepMin)||0),0) / selectedFoods.length)
      : 99;
    if(avgPrep > Number(c.timeMaxMin) + 0.2){
      pass = false;
      score01 -= 0.20;
      issues.push(`ใช้เวลานาน (เฉลี่ย ~${avgPrep.toFixed(1)} นาที)`);
    }else{
      positives.push(`เตรียมได้ทันเวลา (${c.timeMaxMin} นาที)`);
    }
  }

  if(c.budgetMax){
    const maxAllowed = (c.budgetMax === 'low-mid') ? 2 : budgetRank(c.budgetMax);
    const avgB = (selectedFoods||[]).length
      ? (selectedFoods.reduce((s,f)=>s+budgetRank(f?.budget),0) / selectedFoods.length)
      : 99;
    if(avgB > maxAllowed + 0.05){
      pass = false;
      score01 -= 0.20;
      issues.push('เกินงบโดยรวม');
    }else{
      positives.push('อยู่ในงบประมาณ');
    }
  }

  // gentle bonus if veg (G3) present
  if((gCount[3]||0) > 0) score01 += 0.04;

  score01 = clamp(score01, 0, 1);

  return { pass, score01, issues, positives };
}

// ---------------- Reasoning model ----------------
// Supports:
// - reasonChipIds: array
// - reasonText: string
// - scenario.preferReasonTags: array<string>
// - optional: reasonBank: [{id,text,tags}] (if caller wants custom bank)
function evaluateReasoning(reasonChipIds, reasonText, scenario, reasonBank){
  const chips = Array.isArray(reasonChipIds) ? reasonChipIds : [];
  const text = String(reasonText||'').trim();
  const wanted = Array.isArray(scenario?.preferReasonTags) ? scenario.preferReasonTags : [];

  const bank = Array.isArray(reasonBank) ? reasonBank : [];
  const picked = chips.map(id => bank.find(c=>c.id===id)).filter(Boolean);
  const tags = uniq(picked.flatMap(c => c.tags||[]));

  let score01 = 0.40;
  const issues = [];
  const positives = [];

  if(chips.length > 0){
    score01 += 0.18;
    positives.push('เลือกชิปเหตุผล');
  }else{
    issues.push('ยังไม่เลือกชิปเหตุผล');
  }

  if(text.length >= 10){
    score01 += 0.18;
    positives.push('มีคำอธิบาย');
  }else{
    issues.push('คำอธิบายสั้นเกินไป');
  }

  // heuristic keyword match from text (fallback)
  const tx = normText(text);
  const textTags = [];
  if(/งบ|ประหยัด|ถูก/.test(tx)) textTags.push('budget');
  if(/เวลา|เร็ว|ทัน/.test(tx)) textTags.push('time');
  if(/โปรตีน|อิ่ม|กล้าม/.test(tx)) textTags.push('protein');
  if(/ผัก/.test(tx)) textTags.push('veg');
  if(/แพ้|นม|โยเกิร์ต|dairy/.test(tx)) textTags.push('dairy');
  if(/ออกกำลัง|ก่อนซ้อม|pre/.test(tx)) textTags.push('preworkout');
  if(/หวาน|ทอด|แปรรูป|น้ำอัดลม/.test(tx)) textTags.push('processed');

  const allTags = uniq(tags.concat(textTags));

  // preference alignment
  const matchWanted = wanted.filter(t=>allTags.includes(t)).length;
  if(wanted.length){
    score01 += Math.min(0.18, matchWanted * 0.07);
    if(matchWanted>0) positives.push('เหตุผลสอดคล้องเงื่อนไขโจทย์');
    else issues.push('เหตุผลยังไม่ชี้เงื่อนไขโจทย์');
  }

  // discourage weak reason
  if(allTags.includes('weak_reason')){ score01 -= 0.14; issues.push('เหตุผลยังเน้นความชอบมากไป'); }

  score01 = clamp(score01, 0, 1);

  return { score01, tags: allTags, matchWanted, issues, positives };
}

// ---------------- Helpers: compose response ----------------
function composeFeedback(balance, constraints, reasoning){
  const fb = []
    .concat(constraints.positives||[])
    .concat(constraints.issues||[])
    .concat(reasoning.positives||[])
    .concat(reasoning.issues||[])
    .filter(Boolean);

  const short = fb.slice(0,4).join(' | ');
  return short || 'ลองเพิ่มความหลากหลายของหมู่ และชี้เหตุผลให้ตรงโจทย์มากขึ้น';
}

function composeSummary(balance, constraints, reasoning){
  const b = Math.round(balance.score01*100);
  const c = Math.round(constraints.score01*100);
  const r = Math.round(reasoning.score01*100);
  return `สมดุล ${b}% • เงื่อนไข ${c}% • เหตุผล ${r}%`;
}

function finalPassRule(totalScore, constraintsPass, distinct, minDistinct){
  const need = Number(minDistinct||3);
  return (totalScore >= 65) && constraintsPass && (distinct >= need);
}

// ---------------- CREATE ----------------
// payload: { scenario, selectedFoods, selectedReasonChipIds, reasonText, reasonBank? }
export function scorePlateCreate(payload){
  const scenario = payload?.scenario || null;
  const selectedFoods = Array.isArray(payload?.selectedFoods) ? payload.selectedFoods : [];
  const reasonChipIds = payload?.selectedReasonChipIds || payload?.reasonChipIds || [];
  const reasonText = payload?.reasonText || '';
  const reasonBank = payload?.reasonBank || payload?.reasonChips || null;

  const balance = evaluateBalance(selectedFoods);
  const constraints = evaluateConstraints(selectedFoods, scenario);
  const reasoning = evaluateReasoning(reasonChipIds, reasonText, scenario, reasonBank);

  const total01 = clamp((balance.score01*0.40) + (constraints.score01*0.38) + (reasoning.score01*0.22), 0, 1);
  const totalScore = Math.round(total01 * 100);

  const minDistinct = scenario?.constraints?.requireGroupsMin ?? 3;
  const pass = finalPassRule(totalScore, constraints.pass, balance.distinct, minDistinct);

  const labels = {
    y_mode_create: 1,
    y_pass: pass?1:0,
    y_score: totalScore,
    y_balance: Math.round(balance.score01*100),
    y_constraints: Math.round(constraints.score01*100),
    y_reasoning: Math.round(reasoning.score01*100),
    y_distinct_groups: balance.distinct,
    y_processed_count: balance.processedCount,
    y_imbalance01: Math.round(balance.imbalance01*1000)/1000,
    y_reason_match: reasoning.matchWanted|0,
  };

  return {
    ok:true,
    mode:'create',
    totalScore,
    total01,
    pass,
    breakdown:{
      balance01: balance.score01,
      constraints01: constraints.score01,
      reasoning01: reasoning.score01,
      distinct: balance.distinct,
      processedCount: balance.processedCount,
      imbalance01: balance.imbalance01,
      constraintsPass: constraints.pass
    },
    balance, constraints, reasoning,
    summaryText: composeSummary(balance, constraints, reasoning),
    feedbackText: composeFeedback(balance, constraints, reasoning),
    labels
  };
}

// ---------------- ANALYZE (Scenario Puzzle) ----------------
// Similar to create, but heavier weight on constraints alignment + reasoning.
// payload: { scenario, selectedFoods, selectedReasonChipIds, reasonText, reasonBank? }
export function scorePlateAnalyzeScenario(payload){
  const scenario = payload?.scenario || null;
  const selectedFoods = Array.isArray(payload?.selectedFoods) ? payload.selectedFoods : [];
  const reasonChipIds = payload?.selectedReasonChipIds || payload?.reasonChipIds || [];
  const reasonText = payload?.reasonText || '';
  const reasonBank = payload?.reasonBank || payload?.reasonChips || null;

  const balance = evaluateBalance(selectedFoods);
  const constraints = evaluateConstraints(selectedFoods, scenario);
  const reasoning = evaluateReasoning(reasonChipIds, reasonText, scenario, reasonBank);

  // Analyze: constraints + reasoning matter more
  const total01 = clamp((balance.score01*0.30) + (constraints.score01*0.44) + (reasoning.score01*0.26), 0, 1);
  const totalScore = Math.round(total01 * 100);

  const minDistinct = scenario?.constraints?.requireGroupsMin ?? 3;
  const pass = finalPassRule(totalScore, constraints.pass, balance.distinct, minDistinct);

  const labels = {
    y_mode_analyze: 1,
    y_pass: pass?1:0,
    y_score: totalScore,
    y_balance: Math.round(balance.score01*100),
    y_constraints: Math.round(constraints.score01*100),
    y_reasoning: Math.round(reasoning.score01*100),
    y_distinct_groups: balance.distinct,
    y_processed_count: balance.processedCount,
    y_reason_match: reasoning.matchWanted|0,
  };

  return {
    ok:true,
    mode:'analyze',
    totalScore,
    total01,
    pass,
    breakdown:{
      balance01: balance.score01,
      constraints01: constraints.score01,
      reasoning01: reasoning.score01,
      distinct: balance.distinct,
      processedCount: balance.processedCount,
      constraintsPass: constraints.pass
    },
    balance, constraints, reasoning,
    summaryText: composeSummary(balance, constraints, reasoning),
    feedbackText: composeFeedback(balance, constraints, reasoning),
    labels
  };
}

// ---------------- EVALUATE (Plate Critique A/B) ----------------
// payload: { scenario?, plateA:{foods, reasonChipIds, reasonText}, plateB:{...}, chosen:'A'|'B', reasonText?, reasonChipIds? }
// This returns:
// - scores for A and B
// - correctness of player choice vs "better plate"
// - explanation quality scoring
export function scorePlateEvaluateAB(payload){
  const scenario = payload?.scenario || null;
  const reasonBank = payload?.reasonBank || payload?.reasonChips || null;

  const A = payload?.plateA || {};
  const B = payload?.plateB || {};
  const chosen = String(payload?.chosen || '').toUpperCase(); // 'A'|'B'

  const foodsA = Array.isArray(A.foods) ? A.foods : [];
  const foodsB = Array.isArray(B.foods) ? B.foods : [];

  // Plate quality score = balance + (optional) constraints alignment
  const balA = evaluateBalance(foodsA);
  const balB = evaluateBalance(foodsB);

  // If scenario exists, evaluate constraints too (light)
  const conA = scenario ? evaluateConstraints(foodsA, scenario) : { pass:true, score01: 1, issues:[], positives:[] };
  const conB = scenario ? evaluateConstraints(foodsB, scenario) : { pass:true, score01: 1, issues:[], positives:[] };

  const plateA01 = clamp(balA.score01*0.62 + conA.score01*0.38, 0, 1);
  const plateB01 = clamp(balB.score01*0.62 + conB.score01*0.38, 0, 1);

  const better = (plateA01 > plateB01 + 0.02) ? 'A' : (plateB01 > plateA01 + 0.02) ? 'B' : 'TIE';
  const correct = (better === 'TIE') ? (chosen === 'A' || chosen === 'B') : (chosen === better);

  // Player explanation quality (reasons about imbalance / veg low / carb high / processed etc.)
  const playerReasonText = payload?.reasonText || '';
  const playerChipIds = payload?.reasonChipIds || payload?.selectedReasonChipIds || [];

  // Use a "virtual scenario" preference tags for Evaluate
  const evalScenario = {
    preferReasonTags: ['balance','veg','processed','protein','time','budget']
  };
  const reasoning = evaluateReasoning(playerChipIds, playerReasonText, evalScenario, reasonBank);

  // Add "insight" bonus if they mention specific critique
  const tx = normText(playerReasonText);
  let insight01 = 0;
  const insightHits = [];
  if(/ผักน้อย|เพิ่มผัก|ขาดผัก/.test(tx)) { insight01 += 0.16; insightHits.push('veg'); }
  if(/แป้งเกิน|คาร์บเกิน|ลดแป้ง/.test(tx)) { insight01 += 0.16; insightHits.push('carb'); }
  if(/หวาน|ทอด|แปรรูป|น้ำอัดลม/.test(tx)) { insight01 += 0.14; insightHits.push('processed'); }
  if(/โปรตีน(น้อย|มาก)|เพิ่มโปรตีน|อิ่มนาน/.test(tx)) { insight01 += 0.12; insightHits.push('protein'); }
  insight01 = clamp(insight01, 0, 0.40);

  // Total Evaluate score focuses on decision correctness + reasoning quality
  // correctness 55%, reasoning 30%, insight 15%
  const correctness01 = (better === 'TIE') ? 0.85 : (correct ? 1 : 0);
  const total01 = clamp(correctness01*0.55 + reasoning.score01*0.30 + (insight01/0.40)*0.15, 0, 1);
  const totalScore = Math.round(total01*100);

  // Pass rule (Evaluate): choose correctly AND decent explanation
  const pass = (correctness01 >= 0.95 || (better==='TIE' && correctness01>=0.8)) && (reasoning.score01 >= 0.52) && (totalScore >= 65);

  const labels = {
    y_mode_evaluate: 1,
    y_pass: pass?1:0,
    y_score: totalScore,
    y_correct_choice: correct?1:0,
    y_better: better,
    y_plateA_score: Math.round(plateA01*100),
    y_plateB_score: Math.round(plateB01*100),
    y_reasoning: Math.round(reasoning.score01*100),
    y_insight: Math.round((insight01/0.40)*100),
    y_insight_hits: insightHits.join(','),
  };

  const fb = [];
  if(better !== 'TIE'){
    fb.push(correct ? `✅ เลือกถูก: ${better} ดีกว่า` : `❌ เลือกพลาด: ${better} ดีกว่า`);
  }else{
    fb.push('⚖️ ทั้งสองจานใกล้เคียงกัน (TIE)');
  }
  if(reasoning.score01 < 0.55) fb.push('เพิ่มเหตุผลให้ชัดเจนขึ้น (ชิป+คำอธิบาย)');
  if(insightHits.length === 0) fb.push('ลองชี้ “พลาดส่วนไหน” เช่น ผักน้อย/แป้งเกิน/แปรรูป');
  const feedbackText = fb.slice(0,4).join(' | ');

  const summaryText = `A ${Math.round(plateA01*100)}% • B ${Math.round(plateB01*100)}% • เหตุผล ${Math.round(reasoning.score01*100)}%`;

  return {
    ok:true,
    mode:'evaluate',
    totalScore,
    total01,
    pass,
    breakdown:{
      correctness01,
      reasoning01: reasoning.score01,
      insight01: (insight01/0.40),
      plateA01,
      plateB01,
      better,
      correct
    },
    plates:{
      A:{ balance:balA, constraints:conA, plate01:plateA01 },
      B:{ balance:balB, constraints:conB, plate01:plateB01 },
    },
    reasoning,
    summaryText,
    feedbackText,
    labels
  };
}