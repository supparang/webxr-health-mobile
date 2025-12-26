// === /herohealth/plate/plate.goals.js ===
// PlateVR Goals (2)
// ใช้กับ plate.quest.js (Quest Director)

'use strict';

export const PLATE_GOALS = [
  {
    key: 'plates2',
    title: '🍽️ ทำ “จานสมดุล” ให้ได้ 2 ใบ',
    target: 2,
    progressText(state){
      return `${Math.min(state.goalsCleared || 0, 99)}/${this.target}`;
    },
    isClear(state){
      return (state.goalsCleared || 0) >= this.target;
    }
  },
  {
    key: 'perfect6',
    title: '⭐ ทำ PERFECT ให้ได้ 6 ครั้ง',
    target: 6,
    progressText(state){
      return `${Math.min(state.perfectCount || 0, 999)}/${this.target}`;
    },
    isClear(state){
      return (state.perfectCount || 0) >= this.target;
    }
  }
];