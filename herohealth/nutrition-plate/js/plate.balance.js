// === /herohealth/nutrition-plate/js/plate.balance.js ===
// Build evaluation for Nutrition Plate
// PATCH v20260318-PLATE-RUN-FULL

import { SLOT_META } from './plate.content.js';

export function getBuildChoiceFeedback(slot, food) {
  const slotLabel = SLOT_META[slot]?.label || slot;

  if (food.tier === 'best') {
    return {
      delta: 0,
      tone: 'good',
      feedback: `ดีมาก! ${food.label} เป็นตัวเลือกที่ดีในหมวด${slotLabel}`
    };
  }

  if (food.tier === 'good') {
    return {
      delta: 0,
      tone: 'good',
      feedback: `โอเคเลย ${food.label} ใช้จัดมื้อนี้ได้`
    };
  }

  return {
    delta: 0,
    tone: 'bad',
    feedback: `${food.label} ยังพอใช้ได้ แต่ลองดูว่ามีตัวเลือกที่สมดุลกว่านี้ไหม`
  };
}

export function evaluatePlate(plate) {
  const base = plate.base;
  const protein = plate.protein;
  const veg = plate.veg;
  const fruit = plate.fruit;
  const drink = plate.drink;

  let score = 0;
  const notes = [];
  const detail = {
    base: base?.balancePoints || 0,
    protein: protein?.balancePoints || 0,
    veg: veg?.balancePoints || 0,
    fruit: fruit?.balancePoints || 0,
    drink: drink?.balancePoints || 0,
    penalty: 0
  };

  score += detail.base;
  score += detail.protein;
  score += detail.veg;
  score += detail.fruit;
  score += detail.drink;

  if (!veg || veg.noVeg) {
    notes.push('จานนี้ยังขาดผัก');
  } else {
    notes.push('มีผักในจานแล้ว');
  }

  if (!fruit || !fruit.isFruit) {
    notes.push('ควรเพิ่มผลไม้แทนของหวาน');
  } else {
    notes.push('มีผลไม้ในมื้อแล้ว');
  }

  if (!drink || !drink.isHealthyDrink) {
    notes.push('ลองเปลี่ยนเครื่องดื่มเป็นน้ำเปล่าหรือนมจืด');
  } else {
    notes.push('เครื่องดื่มเหมาะสม');
  }

  if (protein?.fried || protein?.processed) {
    detail.penalty += 5;
    score -= 5;
    notes.push('โปรตีนยังมันหรือแปรรูปเกินไป');
  } else {
    notes.push('โปรตีนค่อนข้างเหมาะสม');
  }

  if (base?.processed) {
    detail.penalty += 3;
    score -= 3;
    notes.push('อาหารหลักยังแปรรูปมากไปนิด');
  }

  if (fruit?.sweet) {
    detail.penalty += 5;
    score -= 5;
    notes.push('ของหวานยังมากเกินไป');
  }

  if (drink?.sugary) {
    detail.penalty += 7;
    score -= 7;
    notes.push('เครื่องดื่มหวานเกินไป');
  }

  score = Math.max(0, Math.min(60, score));

  let level = 'ควรปรับเพิ่ม';
  if (score >= 48) level = 'สมดุลดีมาก';
  else if (score >= 36) level = 'สมดุลพอใช้';
  else if (score >= 24) level = 'ยังต้องปรับอีก';

  return {
    score,
    level,
    notes,
    detail
  };
}