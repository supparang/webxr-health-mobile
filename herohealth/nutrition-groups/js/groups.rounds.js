// === /herohealth/nutrition-groups/js/groups.rounds.js ===
// Round builders for Nutrition Groups
// PATCH v20260323-GROUPS-CHILDFRIENDLY-A

import { sample, shuffle } from '../../shared/nutrition-common.js';
import {
  FOOD_ITEMS,
  GROUP_OPTIONS,
  COMPARE_PAIRS,
  getFoodById
} from './groups.content.js';

export function buildSortQuestions(rng, count = 5) {
  return sample(FOOD_ITEMS, count, rng).map((food, idx) => ({
    id: `sort-${idx + 1}`,
    type: 'sort',
    prompt: 'อาหารนี้อยู่หมู่ไหน',
    food,
    options: GROUP_OPTIONS,
    correctId: food.groupId
  }));
}

export function buildCompareQuestions(rng, count = 3) {
  return sample(COMPARE_PAIRS, count, rng).map((pair, idx) => ({
    id: `compare-${idx + 1}`,
    type: 'compare',
    prompt: pair.prompt,
    pairId: pair.id,
    left: getFoodById(pair.leftId),
    right: getFoodById(pair.rightId),
    options: [
      { id: pair.leftId, label: getFoodById(pair.leftId)?.label || pair.leftId },
      { id: pair.rightId, label: getFoodById(pair.rightId)?.label || pair.rightId }
    ],
    correctId: pair.betterId,
    meta: pair
  }));
}

export function buildReasonQuestions(compareQuestions, rng) {
  return compareQuestions.map((compareQ, idx) => {
    const pair = compareQ.meta;

    const choices = shuffle(
      [
        {
          id: 'correct',
          label: pair.correctReason,
          helper: pair.correctReasonHelper,
          isCorrect: true
        },
        ...pair.distractors.map((item, j) => ({
          id: `wrong-${j + 1}`,
          label: item.label,
          helper: item.helper,
          isCorrect: false
        }))
      ],
      rng
    );

    return {
      id: `reason-${idx + 1}`,
      type: 'reason',
      prompt: `ทำไม "${pair.betterText}" ดีกว่า`,
      food: getFoodById(pair.betterId),
      options: choices.map(item => ({
        id: item.id,
        label: item.label,
        helper: item.helper
      })),
      correctId: 'correct',
      meta: pair
    };
  });
}