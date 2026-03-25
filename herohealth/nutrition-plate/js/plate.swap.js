// === /herohealth/nutrition-plate/js/plate.swap.js ===
// Healthy swap questions
// PATCH v20260325-PLATE-P5-BALANCE-3221-A

import { getFoodById } from './plate.content.js';

const SWAP_QUESTIONS = [
  {
    id: 'swap-1',
    type: 'swap',
    prompt: 'ถ้าจะเปลี่ยนไก่ทอด ควรเลือกอะไร',
    currentId: 'friedChicken',
    options: ['grilledFish', 'tofu', 'friedChicken'],
    correctId: 'grilledFish',
    note: 'ของไม่ทอดช่วยให้มื้อดีขึ้น',
    optionHelpers: {
      grilledFish: 'ไม่ทอด',
      tofu: 'ก็ดีเหมือนกัน',
      friedChicken: 'ทอดอยู่เหมือนเดิม'
    }
  },
  {
    id: 'swap-2',
    type: 'swap',
    prompt: 'ถ้าจะเปลี่ยนน้ำอัดลม ควรเลือกอะไร',
    currentId: 'soda',
    options: ['water', 'milk', 'soda'],
    correctId: 'water',
    note: 'น้ำเปล่าเหมาะที่สุดสำหรับมื้อนี้',
    optionHelpers: {
      water: 'ดีที่สุด',
      milk: 'พอใช้ได้',
      soda: 'หวานมาก'
    }
  },
  {
    id: 'swap-3',
    type: 'swap',
    prompt: 'ถ้าจะเปลี่ยนเค้ก ควรเลือกอะไร',
    currentId: 'cake',
    options: ['orange', 'banana', 'cake'],
    correctId: 'orange',
    note: 'ผลไม้เหมาะกว่าของหวาน',
    optionHelpers: {
      orange: 'เป็นผลไม้',
      banana: 'ก็ดีเหมือนกัน',
      cake: 'หวานเกินไป'
    }
  }
];

export function buildSwapQuestions() {
  return SWAP_QUESTIONS.map(question => ({
    ...question,
    currentFood: getFoodById(question.currentId),
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
    correctFood: getFoodById(question.correctId)
  }));
}

export function scoreSwapQuestion(stats, question, answerId) {
  const correct = question.correctId === answerId;
  stats.swap.total += 1;

  if (correct) {
    stats.swap.correct += 1;
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
      ? `ดีมาก! ${question.correctFood.label} เป็นตัวเลือกที่ดีกว่า`
      : `ลองใหม่นิด — ตัวเลือกที่ดีกว่าคือ ${question.correctFood.label}`
  };
}