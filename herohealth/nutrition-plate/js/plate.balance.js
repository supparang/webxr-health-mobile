// === /herohealth/nutrition-plate/js/plate.balance.js ===
// Build evaluation for Nutrition Plate
// PATCH v20260325-PLATE-P5-BALANCE-3221-A

import { SLOT_META, TARGET_MODEL } from './plate.content.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function slotQualityText(slot, food) {
  const slotLabel = SLOT_META[slot]?.label || slot;

  if (!food) {
    return {
      delta: 0,
      tone: 'bad',
      feedback: `ยังไม่ได้เลือก${slotLabel}`
    };
  }

  if (food.tier === 'best') {
    return {
      delta: 0,
      tone: 'good',
      feedback: `ดีมาก! ${food.label} เหมาะกับ${slotLabel}`
    };
  }

  if (food.tier === 'good') {
    return {
      delta: 0,
      tone: 'good',
      feedback: `${food.label} ใช้ได้เลยสำหรับมื้อนี้`
    };
  }

  return {
    delta: 0,
    tone: 'bad',
    feedback: `${food.label} ยังไม่ค่อยสมดุล ลองดูตัวเลือกที่ดีกว่านี้`
  };
}

export function getBuildChoiceFeedback(slot, food) {
  return slotQualityText(slot, food);
}

function evaluateSlotUnits(slot, food) {
  const targetUnits = SLOT_META[slot]?.targetUnits ?? 0;
  const actualUnits = Number(food?.units || 0);

  if (targetUnits <= 0) {
    return { targetUnits, actualUnits, unitMatch: 1 };
  }

  const diff = Math.abs(actualUnits - targetUnits);
  const unitMatch = clamp(1 - diff / targetUnits, 0, 1);

  return {
    targetUnits,
    actualUnits,
    unitMatch
  };
}

export function evaluatePlate(plate) {
  const base = plate.base;
  const protein = plate.protein;
  const veg = plate.veg;
  const fruit = plate.fruit;
  const drink = plate.drink;

  const notes = [];
  const detail = {
    model: '3-2-2-1',
    targets: {
      base: TARGET_MODEL.riceUnits,
      protein: TARGET_MODEL.proteinUnits,
      veg: TARGET_MODEL.vegUnits,
      fruit: TARGET_MODEL.fruitUnits
    },
    selectedUnits: {
      base: Number(base?.units || 0),
      protein: Number(protein?.units || 0),
      veg: Number(veg?.units || 0),
      fruit: Number(fruit?.units || 0)
    },
    slotScore: {
      base: 0,
      protein: 0,
      veg: 0,
      fruit: 0,
      drink: 0
    },
    penalty: 0
  };

  const baseEval = evaluateSlotUnits('base', base);
  const proteinEval = evaluateSlotUnits('protein', protein);
  const vegEval = evaluateSlotUnits('veg', veg);
  const fruitEval = evaluateSlotUnits('fruit', fruit);

  // คะแนนตามเป้าหมาย 3-2-2-1
  detail.slotScore.base = Math.round((base?.qualityScore || 0) * baseEval.unitMatch);
  detail.slotScore.protein = Math.round((protein?.qualityScore || 0) * proteinEval.unitMatch);
  detail.slotScore.veg = Math.round((veg?.qualityScore || 0) * vegEval.unitMatch);
  detail.slotScore.fruit = Math.round((fruit?.qualityScore || 0) * fruitEval.unitMatch);
  detail.slotScore.drink = Number(drink?.qualityScore || 0);

  let score =
    detail.slotScore.base +
    detail.slotScore.protein +
    detail.slotScore.veg +
    detail.slotScore.fruit +
    detail.slotScore.drink;

  // คำอธิบายรายส่วน
  if (!base) {
    notes.push('ยังไม่มีอาหารหลัก');
  } else if (baseEval.unitMatch >= 1) {
    notes.push('อาหารหลักพอดี');
  } else {
    notes.push('อาหารหลักยังไม่เหมาะที่สุด');
  }

  if (!protein) {
    notes.push('ยังไม่มีโปรตีน');
  } else if (proteinEval.unitMatch >= 1 && !protein.fried && !protein.processed) {
    notes.push('โปรตีนค่อนข้างดี');
  } else {
    notes.push('โปรตีนยังควรเปลี่ยนให้ดีขึ้น');
  }

  if (!veg || veg.noVeg) {
    notes.push('จานนี้ยังขาดผัก');
    detail.penalty += 12;
  } else {
    notes.push('จานนี้มีผักแล้ว');
  }

  if (!fruit || !fruit.isFruit) {
    notes.push('ลองเพิ่มผลไม้แทนของหวาน');
    if (fruit?.sweet) detail.penalty += 6;
  } else {
    notes.push('มีผลไม้ในมื้อแล้ว');
  }

  if (!drink) {
    notes.push('ยังไม่ได้เลือกเครื่องดื่ม');
  } else if (drink.id === 'water') {
    notes.push('น้ำเปล่าเหมาะที่สุด');
  } else if (drink.isHealthyDrink) {
    notes.push('เครื่องดื่มใช้ได้');
  } else {
    notes.push('เครื่องดื่มหวานเกินไป');
  }

  // ตัวหักคะแนน
  if (protein?.fried) {
    detail.penalty += 6;
    notes.push('ของทอดมากไปนิด');
  }

  if (protein?.processed) {
    detail.penalty += 6;
    notes.push('อาหารแปรรูปมากไปนิด');
  }

  if (base?.processed) {
    detail.penalty += 5;
    notes.push('อาหารหลักแปรรูปมากไป');
  }

  if (drink?.sugary) {
    detail.penalty += 8;
  }

  if (fruit?.sweet) {
    detail.penalty += 4;
  }

  score -= detail.penalty;
  score = clamp(Math.round(score), 0, 100);

  let level = 'ควรปรับเพิ่ม';
  if (score >= 85) level = 'สมดุลดีมาก';
  else if (score >= 70) level = 'ดี';
  else if (score >= 50) level = 'พอใช้';

  return {
    score,
    level,
    notes,
    detail
  };
}