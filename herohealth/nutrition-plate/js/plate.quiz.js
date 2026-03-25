// === /herohealth/nutrition-plate/js/plate.quiz.js ===
// Mini quiz builders for Nutrition Plate
// PATCH v20260323-PLATE-CHILDFRIENDLY-A

import { getFoodById } from './plate.content.js';

const QUIZ_BANK = {
  pre: [
    {
      id: 'pre-quiz-1',
      type: 'quiz-missing',
      quizPhase: 'pre',
      prompt: 'ก่อนเล่น จานนี้ควรเพิ่มอะไรก่อน',
      scenarioTitle: 'มื้อนี้ยังขาดอะไร',
      scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
      options: ['broccoli', 'cake', 'soda'],
      correctId: 'broccoli',
      note: 'ผักช่วยให้มื้อสมดุลขึ้น',
      optionHelpers: {
        broccoli: 'ช่วยเพิ่มผัก',
        cake: 'ยังหวานอยู่',
        soda: 'ยังไม่ช่วยเรื่องผัก'
      }
    },
    {
      id: 'pre-quiz-2',
      type: 'quiz-better',
      quizPhase: 'pre',
      prompt: 'ก่อนเล่น เครื่องดื่มไหนดีกว่า',
      currentId: 'soda',
      options: ['water', 'milk', 'soda'],
      correctId: 'water',
      note: 'น้ำเปล่าช่วยลดน้ำตาลส่วนเกิน',
      optionHelpers: {
        water: 'หวานน้อย',
        milk: 'พอใช้ได้',
        soda: 'หวานมาก'
      }
    }
  ],
  post: [
    {
      id: 'post-quiz-1',
      type: 'quiz-missing',
      quizPhase: 'post',
      prompt: 'หลังเล่น จานนี้ควรเพิ่มอะไรก่อน',
      scenarioTitle: 'มื้อนี้ยังขาดอะไร',
      scenario: ['instantNoodles', 'sausage', 'noVeg', 'cake', 'soda'],
      options: ['broccoli', 'cake', 'soda'],
      correctId: 'broccoli',
      note: 'ผักช่วยทำให้จานสมดุลมากขึ้น',
      optionHelpers: {
        broccoli: 'ช่วยเพิ่มผัก',
        cake: 'ยังหวานอยู่',
        soda: 'ยังไม่ช่วยเรื่องผัก'
      }
    },
    {
      id: 'post-quiz-2',
      type: 'quiz-better',
      quizPhase: 'post',
      prompt: 'หลังเล่น ถ้าจะเปลี่ยนของทอด ควรเลือกอะไร',
      currentId: 'friedChicken',
      options: ['grilledFish', 'sausage', 'friedChicken'],
      correctId: 'grilledFish',
      note: 'โปรตีนที่ไม่ทอดมักเหมาะกว่า',
      optionHelpers: {
        grilledFish: 'ไม่ทอด',
        sausage: 'แปรรูปมาก',
        friedChicken: 'ทอดอยู่เหมือนเดิม'
      }
    }
  ]
};

export function buildPlateMiniQuizQuestions(quizPhase = 'pre') {
  return (QUIZ_BANK[quizPhase] || []).map(question => ({
    ...question,
    currentFood: question.currentId ? getFoodById(question.currentId) : null,
    scenarioFoods: (question.scenario || []).map(id => getFoodById(id)).filter(Boolean),
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