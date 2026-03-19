// === /herohealth/nutrition-plate/js/plate.swap.js ===
// Healthy swap questions
// PATCH v20260318-PLATE-RUN-FULL

import { getFoodById } from './plate.content.js';

const SWAP_QUESTIONS = [
  {
    id: 'swap-1',
    type: 'swap',
    prompt: 'ถ้าจะสลับไก่ทอด ควรเปลี่ยนเป็นอะไร',
    currentId: 'friedChicken',
    options: ['grilledFish', 'sausage', 'friedChicken'],
    correctId: 'grilledFish',
    note: 'โปรตีนที่ไม่ทอดมักช่วยให้มื้อสมดุลขึ้น'
  },
  {
    id: 'swap-2',
    type: 'swap',
    prompt: 'ถ้าจะสลับเค้ก ควรเปลี่ยนเป็นอะไร',
    currentId: 'cake',
    options: ['orange', 'watermelon', 'cake'],
    correctId: 'orange',
    note: 'ผลไม้เหมาะกว่าของหวานในมื้อประจำวัน'
  }
];

export function buildSwapQuestions() {
  return SWAP_QUESTIONS.map(question => ({
    ...question,
    currentFood: getFoodById(question.currentId),
    options: question.options.map(id => getFoodById(id)).filter(Boolean),
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
      : `ลองใหม่นิด — ตัวเลือกที่เหมาะกว่าคือ ${question.correctFood.label}`
  };
}