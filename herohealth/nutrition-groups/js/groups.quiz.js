// === /herohealth/nutrition-groups/js/groups.quiz.js ===
// Mini quiz builders for Nutrition Groups
// PATCH v20260318-GROUPS-VSLICE-C

import { sample } from '../../shared/nutrition-common.js';
import {
  FOOD_ITEMS,
  GROUP_OPTIONS,
  COMPARE_PAIRS,
  getFoodById
} from './groups.content.js';

export function buildMiniQuizQuestions(rng, quizPhase = 'pre') {
  const sortItems = sample(FOOD_ITEMS, 2, rng);
  const comparePairs = sample(COMPARE_PAIRS, 1, rng);

  const sortQuestions = sortItems.map((food, idx) => ({
    id: `${quizPhase}-sort-${idx + 1}`,
    type: 'sort',
    prompt:
      quizPhase === 'pre'
        ? 'ก่อนเล่น ลองตอบก่อนว่าอาหารนี้อยู่หมู่ไหน'
        : 'หลังเล่น ลองตอบอีกครั้งว่าอาหารนี้อยู่หมู่ไหน',
    food,
    options: GROUP_OPTIONS,
    correctId: food.groupId,
    quizPhase
  }));

  const compareQuestions = comparePairs.map((pair, idx) => ({
    id: `${quizPhase}-compare-${idx + 1}`,
    type: 'compare',
    prompt:
      quizPhase === 'pre'
        ? 'ก่อนเล่น ลองเลือกตัวเลือกที่ดีกว่า'
        : 'หลังเล่น ลองเลือกตัวเลือกที่ดีกว่าอีกครั้ง',
    pairId: pair.id,
    left: getFoodById(pair.leftId),
    right: getFoodById(pair.rightId),
    options: [
      { id: pair.leftId, label: getFoodById(pair.leftId)?.label || pair.leftId },
      { id: pair.rightId, label: getFoodById(pair.rightId)?.label || pair.rightId }
    ],
    correctId: pair.betterId,
    meta: pair,
    quizPhase
  }));

  return [...sortQuestions, ...compareQuestions];
}