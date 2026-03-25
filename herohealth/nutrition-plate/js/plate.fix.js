// === /herohealth/nutrition-plate/js/plate.fix.js ===
// Fix-the-plate questions
// PATCH v20260323-PLATE-CHILDFRIENDLY-A

import { getFoodById } from './plate.content.js';

const FIX_QUESTIONS = [
  {
    id: 'fix-1',
    type: 'fix',
    prompt: 'จานนี้ควรเพิ่มอะไรก่อน',
    scenarioTitle: 'จานนี้ยังไม่สมดุล',
    scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
    targetSlot: 'veg',
    options: ['broccoli', 'cake', 'soda'],
    correctId: 'broccoli',
    note: 'การเพิ่มผักช่วยให้จานดีขึ้นมาก',
    optionHelpers: {
      broccoli: 'เพิ่มผัก',
      cake: 'หวานเกินไป',
      soda: 'ยังไม่ช่วยเรื่องผัก'
    }
  },
  {
    id: 'fix-2',
    type: 'fix',
    prompt: 'ควรเปลี่ยนเครื่องดื่มเป็นอะไร',
    scenarioTitle: 'จานนี้ยังหวานเกินไป',
    scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
    targetSlot: 'drink',
    options: ['water', 'milk', 'soda'],
    correctId: 'water',
    note: 'น้ำเปล่าช่วยลดน้ำตาลส่วนเกิน',
    optionHelpers: {
      water: 'หวานน้อยที่สุด',
      milk: 'พอใช้ได้',
      soda: 'หวานเกินไป'
    }
  }
];

export function buildFixQuestions() {
  return FIX_QUESTIONS.map(question => ({
    ...question,
    options: question.options.map(id => {
      const food = getFoodById(id);
      return food
        ? {
            ...food,
            helper: question.optionHelpers?.[id] || ''
          }
        : null;
    }).filter(Boolean),
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
      ? `ถูกเลย! ${question.correctFood.label} ช่วยให้จานดีขึ้น`
      : `ยังไม่ใช่ — คำตอบที่ดีกว่าคือ ${question.correctFood.label}`
  };
}