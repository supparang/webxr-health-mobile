// === /herohealth/nutrition-plate/js/plate.swap.js ===
// Healthy swap questions
// PATCH v20260323-PLATE-CHILDFRIENDLY-A

import { getFoodById } from './plate.content.js';

const SWAP_QUESTIONS = [
  {
    id: 'swap-1',
    type: 'swap',
    prompt: 'ถ้าจะเปลี่ยนไก่ทอด ควรเลือกอะไร',
    currentId: 'friedChicken',
    options: ['grilledFish', 'sausage', 'friedChicken'],
    correctId: 'grilledFish',
    note: 'โปรตีนที่ไม่ทอดมักช่วยให้มื้อสมดุลขึ้น',
    optionHelpers: {
      grilledFish: 'ไม่ทอด',
      sausage: 'แปรรูปมาก',
      friedChicken: 'ทอดอยู่เหมือนเดิม'
    }
  },
  {
    id: 'swap-2',
    type: 'swap',
    prompt: 'ถ้าจะเปลี่ยนเค้ก ควรเลือกอะไร',
    currentId: 'cake',
    options: ['orange', 'watermelon', 'cake'],
    correctId: 'orange',
    note: 'ผลไม้เหมาะกว่าของหวานในมื้อประจำวัน',
    optionHelpers: {
      orange: 'เป็นผลไม้',
      watermelon: 'ก็พอใช้ได้',
      cake: 'หวานเกินไป'
    }
  }
];

export function buildSwapQuestions() {
  return SWAP_QUESTIONS.map(question => ({
    ...question,
    currentFood: getFoodById(question.currentId),
    options: question.options.map(id => {
      const food = getFoodById(id);
      return food
        ? {
            ...food,
            helper: question.optionHelpers?.[id] || ''
          }
        : null;
    }).filter(Boolean),
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