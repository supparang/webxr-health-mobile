// === /herohealth/nutrition-plate/js/plate.fix.js ===
// Fix-the-plate questions
// PATCH v20260325-PLATE-P5-BALANCE-3221-A

import { getFoodById } from './plate.content.js';

const FIX_QUESTIONS = [
  {
    id: 'fix-1',
    type: 'fix',
    prompt: 'จานนี้ควรเพิ่มอะไรก่อน',
    scenarioTitle: 'จานนี้ยังขาดผัก',
    scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
    targetSlot: 'veg',
    options: ['broccoli', 'cake', 'soda'],
    correctId: 'broccoli',
    note: 'ผักช่วยให้จานสมดุลขึ้น',
    optionHelpers: {
      broccoli: 'ช่วยเพิ่มผัก',
      cake: 'ยังเป็นของหวาน',
      soda: 'ยังไม่ช่วยเรื่องผัก'
    }
  },
  {
    id: 'fix-2',
    type: 'fix',
    prompt: 'จานนี้ควรเปลี่ยนเครื่องดื่มเป็นอะไร',
    scenarioTitle: 'จานนี้หวานเกินไป',
    scenario: ['rice', 'sausage', 'cucumber', 'cake', 'soda'],
    targetSlot: 'drink',
    options: ['water', 'milk', 'soda'],
    correctId: 'water',
    note: 'น้ำเปล่าช่วยให้มื้อนี้ดีขึ้นมาก',
    optionHelpers: {
      water: 'ดีที่สุดสำหรับมื้อนี้',
      milk: 'พอใช้ได้',
      soda: 'หวานเกินไป'
    }
  },
  {
    id: 'fix-3',
    type: 'fix',
    prompt: 'ถ้าจะทำให้มื้อนี้ดีขึ้น ควรเลือกอะไร',
    scenarioTitle: 'จานนี้ยังขาดผลไม้',
    scenario: ['brownRice', 'boiledEgg', 'broccoli', 'cake', 'sweetMilk'],
    targetSlot: 'fruit',
    options: ['banana', 'cake', 'sweetMilk'],
    correctId: 'banana',
    note: 'ผลไม้เหมาะกว่าของหวาน',
    optionHelpers: {
      banana: 'เป็นผลไม้',
      cake: 'หวานเกินไป',
      sweetMilk: 'ไม่ใช่ผลไม้'
    }
  }
];

export function buildFixQuestions() {
  return FIX_QUESTIONS.map(question => ({
    ...question,
    options: question.options
      .map(id => {
        const food = getFoodById(id);
        return food
          ? {
              ...food,
              helper: question.optionHelpers?.[id] || food.helper || ''
            }
          : null;
      })
      .filter(Boolean),
    scenarioFoods: question.scenario.map(id => getFoodById(id)).filter(Boolean),
    correctFood: getFoodById(question.correctId)
  }));
}

export function scoreFixQuestion(stats, question, answerId) {
  const correct = question.correctId === answerId;
  stats.fix.total += 1;

  if (correct) {
    stats.fix.correct += 1;
    stats.score += 10;
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  } else {
    stats.streak = 0;
  }

  return {
    correct,
    delta: correct ? 10 : 0,
    tone: correct ? 'good' : 'bad',
    feedback: correct
      ? `ถูกเลย! ${question.correctFood.label} ช่วยให้จานสมดุลขึ้น`
      : `ยังไม่ใช่ — คำตอบที่ดีกว่าคือ ${question.correctFood.label}`
  };
}