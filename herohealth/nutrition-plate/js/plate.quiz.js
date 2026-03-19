// === /herohealth/nutrition-plate/js/plate.quiz.js ===
// Mini quiz builders for Nutrition Plate
// PATCH v20260318-PLATE-RUN-FULL

import { getFoodById } from './plate.content.js';

const QUIZ_BANK = {
  pre: [
    {
      id: 'pre-quiz-1',
      type: 'quiz-missing',
      quizPhase: 'pre',
      prompt: 'ก่อนเล่น จานนี้ควรเพิ่มอะไรก่อน',
      scenarioTitle: 'มื้อที่ยังขาดส่วนสำคัญ',
      scenario: ['rice', 'friedChicken', 'noVeg', 'cake', 'soda'],
      options: ['broccoli', 'cake', 'soda'],
      correctId: 'broccoli',
      note: 'ผักช่วยให้มื้อสมดุลขึ้น'
    },
    {
      id: 'pre-quiz-2',
      type: 'quiz-better',
      quizPhase: 'pre',
      prompt: 'ก่อนเล่น เครื่องดื่มไหนเหมาะกว่ากับมื้อนี้',
      currentId: 'soda',
      options: ['water', 'milk', 'soda'],
      correctId: 'water',
      note: 'น้ำเปล่าช่วยลดน้ำตาลส่วนเกิน'
    }
  ],
  post: [
    {
      id: 'post-quiz-1',
      type: 'quiz-missing',
      quizPhase: 'post',
      prompt: 'หลังเล่น จานนี้ควรเพิ่มอะไรก่อน',
      scenarioTitle: 'มื้อที่ยังขาดส่วนสำคัญ',
      scenario: ['instantNoodles', 'sausage', 'noVeg', 'cake', 'soda'],
      options: ['broccoli', 'cake', 'soda'],
      correctId: 'broccoli',
      note: 'ผักช่วยทำให้จานสมดุลมากขึ้น'
    },
    {
      id: 'post-quiz-2',
      type: 'quiz-better',
      quizPhase: 'post',
      prompt: 'หลังเล่น ถ้าจะสลับของทอด ควรเลือกอะไร',
      currentId: 'friedChicken',
      options: ['grilledFish', 'sausage', 'friedChicken'],
      correctId: 'grilledFish',
      note: 'โปรตีนที่ไม่ทอดมักเหมาะกว่า'
    }
  ]
};

export function buildPlateMiniQuizQuestions(quizPhase = 'pre') {
  return (QUIZ_BANK[quizPhase] || []).map(question => ({
    ...question,
    currentFood: question.currentId ? getFoodById(question.currentId) : null,
    scenarioFoods: (question.scenario || []).map(id => getFoodById(id)).filter(Boolean),
    options: question.options.map(id => getFoodById(id)).filter(Boolean),
    correctFood: getFoodById(question.correctId)
  }));
}