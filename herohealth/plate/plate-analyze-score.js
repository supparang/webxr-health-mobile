// /herohealth/plate/plate-analyze-score.js
'use strict';

const clamp = (v,a,b)=>Math.max(a,Math.min(b, Number(v)||0));

function hasTag(food, tag){
  return Array.isArray(food?.tags) && food.tags.includes(tag);
}
function levelVal(x){
  if(x === 'high') return 2;
  if(x === 'med') return 1;
  return 0;
}

export function scorePlateScenario({ scenario, foodsById, selectedFoodIds = [], selectedReasonChips = [], reasonNote = '' }) {
  const picked = selectedFoodIds.map(id => foodsById[id]).filter(Boolean);

  let balance = 0, constraintGoal = 0, reason = 0;
  const issues = [];
  const strengths = [];

  const groups = new Set();
  let totalBudget = 0;
  let totalPrep = 0;
  let hasForbiddenAllergen = false;
  let hasAvoidTag = false;
  let sugaryCount = 0;
  let friedCount = 0;
  let processedCount = 0;
  let proteinScore = 0;
  let hasVeg = false;
  let hasFruit = false;

  for(const f of picked){
    groups.add(f.group);
    totalBudget += Number(f.price || 0);
    totalPrep += Number(f.prepMin || 0);

    const nutr = f.nutr || {};
    const allergens = f.allergens || [];
    const avoidAllergens = scenario.constraints?.avoidAllergens || [];
    if(avoidAllergens.some(a => allergens.includes(a))) hasForbiddenAllergen = true;

    const avoidTags = scenario.constraints?.avoidTags || [];
    if(avoidTags.some(t => hasTag(f,t))) hasAvoidTag = true;

    proteinScore += levelVal(nutr.protein);
    if(nutr.veg) hasVeg = true;
    if(nutr.fruit) hasFruit = true;
    if(nutr.sugar === 'high') sugaryCount++;
    if(nutr.fried) friedCount++;
    if(nutr.processed) processedCount++;
  }

  // A) Balance 40
  // ไทย mapping: หมู่ 1 โปรตีน, 2 คาร์บ, 3 ผัก, 4 ผลไม้, 5 ไขมัน
  if(groups.has(1)) balance += 10; // โปรตีน
  if(groups.has(2)) balance += 8;  // คาร์บ
  if(groups.has(3)) balance += 10; // ผัก
  if(groups.has(4)) balance += 8;  // ผลไม้
  if(groups.has(5)) balance += 4;  // ไขมัน

  if(sugaryCount >= 2){ balance -= 8; issues.push('มีอาหาร/เครื่องดื่มหวานมากเกินไป'); }
  else if(sugaryCount === 1){ balance -= 3; }

  if(friedCount >= 2){ balance -= 8; issues.push('มีของทอดมากเกินไป'); }
  else if(friedCount === 1){ balance -= 3; }

  if(processedCount >= 3){ balance -= 4; issues.push('อาหารแปรรูปค่อนข้างมาก'); }

  balance = clamp(balance, 0, 40);

  // B) Constraints + Goal 40
  if(!hasForbiddenAllergen) constraintGoal += 15;
  else issues.push('มีอาหารที่ขัดกับข้อแพ้/ข้อห้าม');

  // avoidTags is weaker than allergen
  if(!hasAvoidTag) constraintGoal += 5;
  else issues.push('มีอาหารที่ควรหลีกเลี่ยงตามโจทย์');

  const maxBudget = scenario.constraints?.maxBudget;
  if(typeof maxBudget === 'number'){
    if(totalBudget <= maxBudget){
      constraintGoal += 10;
      strengths.push('คุมงบได้');
    }else{
      issues.push(`งบเกิน (${totalBudget}/${maxBudget} บาท)`);
    }
  }else{
    constraintGoal += 10;
  }

  const maxPrepMin = scenario.constraints?.maxPrepMin;
  if(typeof maxPrepMin === 'number'){
    if(totalPrep <= maxPrepMin){
      constraintGoal += 5;
      strengths.push('เวลาเตรียมเหมาะสม');
    }else{
      issues.push(`เวลาเตรียมเกิน (${totalPrep}/${maxPrepMin} นาที)`);
    }
  }else{
    constraintGoal += 5;
  }

  const goals = Array.isArray(scenario.goals) ? scenario.goals : [];
  let goalPass = 0;
  let goalChecked = 0;

  for(const g of goals){
    goalChecked++;

    if(g === 'protein_high'){
      if(proteinScore >= 3){ goalPass++; strengths.push('โปรตีนค่อนข้างสูง'); }
      else issues.push('โปรตีนยังไม่ถึงเป้าหมาย');
      continue;
    }

    if(g === 'low_sugar'){
      if(sugaryCount === 0){ goalPass++; strengths.push('คุมหวานได้ดี'); }
      else issues.push('ยังมีตัวเลือกหวานเกินเป้าหมาย');
      continue;
    }

    if(g === 'include_veg'){
      if(hasVeg){ goalPass++; strengths.push('มีผักตามเป้าหมาย'); }
      else issues.push('ยังไม่มีผัก');
      continue;
    }

    if(g === 'balanced_plate' || g === 'best_possible_balance'){
      // ยืดหยุ่นสำหรับโจทย์ที่ทรัพยากรจำกัด
      if(groups.size >= 4){ goalPass++; strengths.push('จานสมดุลดี'); }
      else if(groups.size >= 3){ goalPass += 0.7; strengths.push('จานค่อนข้างสมดุล'); }
      else issues.push('องค์ประกอบจานยังไม่สมดุลพอ');
      continue;
    }

    if(g === 'preworkout_easy_digest'){
      if(friedCount === 0 && sugaryCount <= 1){ goalPass++; strengths.push('เหมาะก่อนออกกำลังมากขึ้น'); }
      else issues.push('ยังหนัก/หวานเกินสำหรับก่อนออกกำลัง');
      continue;
    }

    if(g === 'postworkout_recovery'){
      if(proteinScore >= 2 && groups.has(2)){ goalPass++; strengths.push('เหมาะกับการฟื้นตัวหลังออกกำลัง'); }
      else issues.push('ยังไม่ครบองค์ประกอบฟื้นตัวหลังออกกำลัง');
      continue;
    }

    if(g === 'steady_energy'){
      if(sugaryCount === 0 && groups.has(1) && groups.has(2)){ goalPass++; strengths.push('พลังงานคงที่มากขึ้น'); }
      else issues.push('ยังไม่ตอบโจทย์พลังงานคงที่');
      continue;
    }

    if(g === 'satiety'){
      if(groups.has(1) && groups.has(2)){ goalPass++; strengths.push('มีคาร์บ+โปรตีนช่วยอิ่มนาน'); }
      else issues.push('ยังไม่ค่อยช่วยให้อิ่มนาน');
      continue;
    }

    // unknown goal -> neutral
    goalChecked--;
  }

  if(goalChecked <= 0) goalChecked = 1;
  constraintGoal += Math.round((goalPass / goalChecked) * 10);
  constraintGoal = clamp(constraintGoal, 0, 40);

  // C) Reason 20
  const preferred = new Set(scenario.preferredReasons || []);
  const selected = Array.isArray(selectedReasonChips) ? selectedReasonChips : [];
  let preferredHit = 0;
  for(const chip of selected) if(preferred.has(chip)) preferredHit++;

  if(preferredHit >= 2) reason = 15;
  else if(preferredHit >= 1) reason = 10;
  else reason = 3;

  // obvious mismatch penalty
  const badTexts = [
    'กินน้ำหวานเยอะ ๆ จะดีที่สุด',
    'เลือกทุกอย่างที่กินง่ายไม่ต้องคิด',
    'เลือกโดนัทเพราะกินเร็วที่สุด',
    'เลือกถั่วเพราะไขมันดีเสมอ',
    'โดนัทช่วยอ่านหนังสือดีที่สุด'
  ];
  if(selected.some(s => badTexts.includes(s))){
    reason = Math.max(0, reason - 5);
    issues.push('เหตุผลบางข้อยังไม่สอดคล้องกับโจทย์');
  }

  // note bonus (soft)
  const note = String(reasonNote || '').trim();
  if(note){
    if(/งบ|ประหยัด|คุมงบ/.test(note) && typeof maxBudget === 'number' && totalBudget <= maxBudget) reason += 2;
    if(/แพ้|หลีกเลี่ยง/.test(note) && !hasForbiddenAllergen) reason += 2;
    if(/โปรตีน/.test(note) && proteinScore >= 2) reason += 2;
    if(/ผัก/.test(note) && hasVeg) reason += 1;
  }

  // strength alignment bonus
  if(selected.some(ch => /โปรตีน/.test(ch)) && strengths.some(s => /โปรตีน/.test(s))) reason += 2;
  if(selected.some(ch => /งบ/.test(ch)) && typeof maxBudget === 'number' && totalBudget <= maxBudget) reason += 1;
  reason = clamp(reason, 0, 20);

  const total = balance + constraintGoal + reason;

  let grade = 'D';
  if(total >= 85) grade = 'S';
  else if(total >= 75) grade = 'A';
  else if(total >= 65) grade = 'B';
  else if(total >= 50) grade = 'C';

  return {
    total,
    grade,
    subscore: { balance, constraintGoal, reason },
    metrics: {
      totalBudget,
      totalPrep,
      groupsCount: groups.size,
      groups: [...groups].sort((a,b)=>a-b),
      hasForbiddenAllergen,
      hasAvoidTag,
      proteinScore,
      sugaryCount,
      friedCount,
      processedCount
    },
    strengths: [...new Set(strengths)].slice(0,5),
    issues: [...new Set(issues)].slice(0,6)
  };
}