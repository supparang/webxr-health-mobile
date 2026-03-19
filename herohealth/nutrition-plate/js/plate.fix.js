// === /herohealth/nutrition-plate/js/plate.fix.js ===
// Fix-the-plate questions
// PATCH v20260318-PLATE-RUN-FULL

import { getFoodById } from './plate.content.js';

const FIX_QUESTIONS = [
  {
    id: 'fix-1',
    type: 'fix',
    prompt: 'จานนี้ควรเพิ่มอะไรก่อน',
    scenarioTitle: 'จานตัวอย่างที่ยังไม่สมดุล',
    scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
    targetSlot: 'veg',
    options: ['broccoli', 'cake', 'soda'],
    correctId: 'broccoli',
    note: 'การเพิ่มผักช่วยให้จานดีขึ้นมาก'
  },
  {
    id: 'fix-2',
    type: 'fix',
    prompt: 'เครื่องดื่มไหนควรใช้แทนน้ำอัดลม',
    scenarioTitle: 'จานตัวอย่างที่ยังหวานเกินไป',
    scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
    targetSlot: 'drink',
    options: ['water', 'milk', 'soda'],
    correctId: 'water',
    note: 'น้ำเปล่าช่วยลดน้ำตาลส่วนเกิน'
  }
];

export function buildFixQuestions() {
  return FIX_QUESTIONS.map(question => ({
    ...question,
    options: question.options.map(id => getFoodById(id)).filter(Boolean),
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
  } else {
    stats.streak = 0;
  }

  if (correct) {
    stats.streak += 1;
    stats.bestStreak = Math.max(stats.bestStreak, stats.streak);
  }

  return {
    correct,
    delta: correct ? 10 : 0,
    tone: correct ? 'good' : 'bad',
    feedback: correct
      ? `ถูกเลย! ${question.correctFood.label} ช่วยแก้จานให้ดีขึ้น`
      : `ยังไม่ใช่ — คำตอบที่เหมาะกว่าคือ ${question.correctFood.label}`
  };
}