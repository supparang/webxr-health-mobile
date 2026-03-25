// === /herohealth/nutrition-plate/js/plate.quiz.js ===
// Mini quiz builders for Nutrition Plate
// PATCH v20260325-PLATE-P5-BALANCE-3221-A

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
        cake: 'ยังเป็นของหวาน',
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
      note: 'น้ำเปล่าดีที่สุดสำหรับมื้อนี้',
      optionHelpers: {
        water: 'ดีที่สุด',
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
      scenario: ['instantNoodles', 'sausage', 'noVeg', 'cake', 'sweetMilk'],
      options: ['broccoli', 'banana', 'sweetMilk'],
      correctId: 'broccoli',
      note: 'ผักช่วยให้จานสมดุลขึ้นมาก',
      optionHelpers: {
        broccoli: 'ช่วยเพิ่มผัก',
        banana: 'ดี แต่ยังไม่ใช่ผัก',
        sweetMilk: 'ยังไม่ช่วยเรื่องผัก'
      }
    },
    {
      id: 'post-quiz-2',
      type: 'quiz-better',
      quizPhase: 'post',
      prompt: 'หลังเล่น ถ้าจะเปลี่ยนของทอด ควรเลือกอะไร',
      currentId: 'friedChicken',
      options: ['grilledFish', 'tofu', 'friedChicken'],
      correctId: 'grilledFish',
      note: 'ของไม่ทอดมักเหมาะกว่า',
      optionHelpers: {
        grilledFish: 'ไม่ทอด',
        tofu: 'ก็ดีเหมือนกัน',
        friedChicken: 'ทอดอยู่เหมือนเดิม'
      }
    },
    {
      id: 'post-quiz-3',
      type: 'quiz-better',
      quizPhase: 'post',
      prompt: 'หลังเล่น ถ้าจะเปลี่ยนของหวาน ควรเลือกอะไร',
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
  ]
};

export function buildPlateMiniQuizQuestions(quizPhase = 'pre') {
  return (QUIZ_BANK[quizPhase] || []).map(question => ({
    ...question,
    currentFood: question.currentId ? getFoodById(question.currentId) : null,
    scenarioFoods: (question.scenario || []).map(id => getFoodById(id)).filter(Boolean),
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