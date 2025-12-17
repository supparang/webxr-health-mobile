// === /herohealth/vr-goodjunk/quest-defs-goodjunk.js ===
// GoodJunkVR Quest Definitions (Goals + Mini)
// ใช้กับ quest-director.js เวอร์ชันใหม่ (def ต้องมี target() + getProgress() [+ finalize()])
//
// state ที่คาดหวัง:
// { score, goodHits, miss, comboMax, timeLeft }
//
// หมายเหตุสำคัญเรื่อง MISS:
// - ให้ engine ส่ง state.miss เป็น "MISS รวม" ตามนิยามโปรเจกต์:
//   miss = good expired (ปล่อยของดีหลุด) + junk hit (แตะขยะ)
// - ถ้าแตะขยะตอนมี Shield แล้วกันไว้ => ไม่ถือเป็น miss (engine ต้องไม่เพิ่ม miss)

'use strict';

function tier(diff){
  diff = String(diff || 'normal').toLowerCase();
  if (diff === 'easy') return 'easy';
  if (diff === 'hard') return 'hard';
  return 'normal';
}

function pickTierValue(diff, easyV, normalV, hardV){
  const k = tier(diff);
  if (k === 'easy') return easyV;
  if (k === 'hard') return hardV;
  return normalV;
}

function n(x){ return (Number(x) || 0) | 0; }

// ---- progress getters ----
function pScore(s){ return n(s && s.score); }
function pGood(s){ return n(s && s.goodHits); }
function pCombo(s){ return n(s && s.comboMax); }
function pMiss(s){ return n(s && s.miss); }

// ---- missMax helper ----
// เราต้องการ “ตัดสินตอนจบ” เท่านั้น:
// - ระหว่างเกม: ไม่ให้ done กลางทาง (เพื่อกัน HUD ขึ้นครบมั่ว)
// - ตอน finalize: ผ่านถ้า miss <= target => return target (ให้ done=true)
//               ไม่ผ่าน => return 0 (ให้ done=false)
function missFinalProgressDuringPlay(/*state*/){ return 0; }
function missFinalProgressOnFinalize(state, target){
  const miss = pMiss(state);
  return (miss <= n(target)) ? n(target) : 0;
}

// ===================== GOALS (สุ่ม 2 ต่อเกม) =====================
export const GOODJUNK_GOALS = [
  {
    id: 'G_SCORE_700',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 700 แต้ม',
    hint: 'โฟกัสของดีต่อเนื่อง จะได้คอมโบและแต้มเร็ว ⚡',
    target(diff /*, runMode*/){
      return pickTierValue(diff, 400, 700, 1000);
    },
    getProgress(state){
      return pScore(state);
    }
  },
  {
    id: 'G_GOOD_16',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 16 ชิ้น',
    hint: 'แตะผัก ผลไม้ นม ให้ไวและแม่น 🥦🍎🥛',
    target(diff){
      return pickTierValue(diff, 10, 16, 22);
    },
    getProgress(state){
      return pGood(state);
    }
  },
  {
    id: 'G_COMBO_8',
    label: 'ทำคอมโบสูงสุดให้ได้อย่างน้อย 8',
    hint: 'อย่าพลาดของดีหลุด จะตัดคอมโบทันที 🎯',
    target(diff){
      return pickTierValue(diff, 5, 8, 11);
    },
    getProgress(state){
      return pCombo(state);
    }
  },
  {
    id: 'G_MISS_MAX_8',
    label: 'MISS รวมไม่เกิน 8 ครั้ง (ตัดสินตอนจบ)',
    hint: 'เลี่ยงแตะขยะ และอย่าปล่อยของดีหลุด ❗',
    target(diff){
      return pickTierValue(diff, 10, 8, 6);
    },
    // ระหว่างเกม: ไม่ตัดสิน (กันผ่าน/ตกมั่ว)
    getProgress(statee(state){
      return missFinalProgressDuringPlay(state);
    },
    finalize(state){
      const t = this._cachedTarget ?? null;
      // quest-director เรียก finalize(state) อย่างเดียว ไม่ส่ง target มา
      // เราจะคำนวณ target ซ้ำแบบปลอดภัยจาก state ที่ไม่มี diff ไม่ได้
      // ดังนั้น: ให้ quest-director สร้าง instance แล้วเก็บ target ไว้ใน inst.target
      // -> ใน finalize เราอ่านจาก state ไม่ได้, จึงคืน 0 แล้วให้ quest-director ใช้ inst.target ตัดสินไม่ได้
      // ทางออก: ไม่พึ่ง finalize ของ def ในตัวนี้ แต่ให้ quest-director finalize(forceFinalize) ยิง state แล้วใช้ finalize ที่ “อ่าน inst.target”
      // ดังนั้นเราคืนค่าแบบมาตรฐาน: 0 (quest-director จะใช้ getProgress/forceFinalize ไม่ได้)
      // *** เพื่อไม่ให้พัง: เราใช้ trick: ใส่ค่าใน state.__questTargetMap ได้ถ้ามี
      const map = state && state.__questTargetMap ? state.__questTargetMap : null;
      const target = map && map[this.id] ? map[this.id] : 0;
      return missFinalProgressOnFinalize(state, target);
    }
  },
  {
    id: 'G_SCORE_900',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 900 แต้ม',
    hint: 'ถ้าเข้า FEVER แล้วรีบเก็บของดีรัว ๆ 🔥',
    target(diff){
      return pickTierValue(diff, 600, 900, 1200);
    },
    getProgress(state){
      return pScore(state);
    }
  },
  {
    id: 'G_GOOD_22',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 22 ชิ้น',
    hint: 'เล็งให้ไว เก็บให้ครบก่อนหมดเวลา ⏱️',
    target(diff){
      return pickTierValue(diff, 14, 22, 28);
    },
    getProgress(state){
      return pGood(state);
    }
  },
  {
    id: 'G_COMBO_12',
    label: 'ทำคอมโบสูงสุดให้ได้อย่างน้อย 12',
    hint: 'อย่าพลาดของดีหลุด และอย่าเผลอแตะขยะ 🚫',
    target(diff){
      return pickTierValue(diff, 7, 12, 15);
    },
    getProgress(state){
      return pCombo(state);
    }
  },
  {
    id: 'G_MISS_MAX_6',
    label: 'MISS รวมไม่เกิน 6 ครั้ง (ตัดสินตอนจบ)',
    hint: 'ยิ่งพลาดน้อย ยิ่งได้เกรดดี ⭐',
    target(diff){
      return pickTierValue(diff, 8, 6, 4);
    },
    getProgress(state){
      return missFinalProgressDuringPlay(state);
    },
    finalize(state){
      const map = state && state.__questTargetMap ? state.__questTargetMap : null;
      const target = map && map[this.id] ? map[this.id] : 0;
      return missFinalProgressOnFinalize(state, target);
    }
  },
  {
    id: 'G_SCORE_1200',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 1,200 แต้ม',
    hint: 'คอมโบสูง + FEVER = แต้มพุ่ง 🚀',
    target(diff){
      return pickTierValue(diff, 800, 1200, 1500);
    },
    getProgress(state){
      return pScore(state);
    }
  },
  {
    id: 'G_GOOD_28',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 28 ชิ้น',
    hint: 'เร็ว + แม่น = ชนะ 💪',
    target(diff){
      return pickTierValue(diff, 18, 28, 34);
    },
    getProgress(state){
      return pGood(state);
    }
  }
];

// ===================== MINI (สุ่ม 3 ต่อเกม, ต่อเนื่อง) =====================
export const GOODJUNK_MINIS = [
  {
    id: 'M_GOOD_8',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 8 ชิ้น',
    hint: 'เริ่มง่าย ๆ เก็บของดีต่อเนื่อง 🥦',
    target(diff){ return pickTierValue(diff, 6, 8, 10); },
    getProgress(state){ return pGood(state); }
  },
  {
    id: 'M_COMBO_5',
    label: 'ทำคอมโบสูงสุดให้ได้อย่างน้อย 5',
    hint: 'อย่าปล่อยของดีหลุดนะ 🎯',
    target(diff){ return pickTierValue(diff, 4, 5, 7); },
    getProgress(state){ return pCombo(state); }
  },
  {
    id: 'M_SCORE_400',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 400 แต้ม',
    hint: 'แตะของดีติด ๆ กัน แต้มจะมาเอง ⚡',
    target(diff){ return pickTierValue(diff, 300, 400, 550); },
    getProgress(state){ return pScore(state); }
  },
  {
    id: 'M_MISS_MAX_4',
    label: 'MISS รวมไม่เกิน 4 ครั้ง (ตัดสินตอนจบ)',
    hint: 'อย่าแตะขยะ และอย่าปล่อยของดีหลุด ❗',
    target(diff){ return pickTierValue(diff, 5, 4, 3); },
    getProgress(state){ return missFinalProgressDuringPlay(state); },
    finalize(state){
      const map = state && state.__questTargetMap ? state.__questTargetMap : null;
      const target = map && map[this.id] ? map[this.id] : 0;
      return missFinalProgressOnFinalize(state, target);
    }
  },
  {
    id: 'M_GOOD_12',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 12 ชิ้น',
    hint: 'เร่งสปีดขึ้นอีกนิด 🥛🍎',
    target(diff){ return pickTierValue(diff, 8, 12, 16); },
    getProgress(state){ return pGood(state); }
  },
  {
    id: 'M_SCORE_600',
    label: 'ทำคะแนนให้ได้อย่างน้อย 600 แต้ม',
    hint: 'คอมโบช่วยเพิ่มคะแนนมาก ⚡',
    target(diff){ return pickTierValue(diff, 450, 600, 800); },
    getProgress(state){ return pScore(state); }
  },
  {
    id: 'M_COMBO_7',
    label: 'ทำคอมโบสูงสุดให้ได้อย่างน้อย 7',
    hint: 'แม่น ๆ แล้วคอมโบจะยาวเอง 🎯',
    target(diff){ return pickTierValue(diff, 5, 7, 9); },
    getProgress(state){ return pCombo(state); }
  },
  {
    id: 'M_SCORE_800',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 800 แต้ม',
    hint: 'หาเป้าไว ๆ แล้วกดให้โดน 👍',
    target(diff){ return pickTierValue(diff, 550, 800, 1000); },
    getProgress(state){ return pScore(state); }
  },
  {
    id: 'M_GOOD_16',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 16 ชิ้น',
    hint: 'อย่าเสียจังหวะ! 🥦',
    target(diff){ return pickTierValue(diff, 10, 16, 20); },
    getProgress(state){ return pGood(state); }
  },
  {
    id: 'M_MISS_MAX_3',
    label: 'MISS รวมไม่เกิน 3 ครั้ง (ตัดสินตอนจบ)',
    hint: 'โฟกัสให้ดี ลดความพลาด ⭐',
    target(diff){ return pickTierValue(diff, 4, 3, 2); },
    getProgress(state){ return missFinalProgressDuringPlay(state); },
    finalize(state){
      const map = state && state.__questTargetMap ? state.__questTargetMap : null;
      const target = map && map[this.id] ? map[this.id] : 0;
      return missFinalProgressOnFinalize(state, target);
    }
  },
  {
    id: 'M_COMBO_9',
    label: 'ทำคอมโบสูงสุดให้ได้อย่างน้อย 9',
    hint: 'พลาดน้อย คอมโบสูง 💥',
    target(diff){ return pickTierValue(diff, 7, 9, 11); },
    getProgress(state){ return pCombo(state); }
  },
  {
    id: 'M_SCORE_900',
    label: 'ทำคะแนนรวมให้ได้อย่างน้อย 900 แต้ม',
    hint: 'ถ้าเข้า FEVER รีบกดของดีรัว ๆ 🔥',
    target(diff){ return pickTierValue(diff, 600, 900, 1100); },
    getProgress(state){ return pScore(state); }
  },
  {
    id: 'M_GOOD_20',
    label: 'เก็บอาหารดีให้ได้อย่างน้อย 20 ชิ้น',
    hint: 'สปีด + แม่น = ผ่าน 😄',
    target(diff){ return pickTierValue(diff, 12, 20, 24); },
    getProgress(state){ return pGood(state); }
  },
  {
    id: 'M_MISS_MAX_2',
    label: 'MISS รวมไม่เกิน 2 ครั้ง (ตัดสินตอนจบ)',
    hint: 'ท้าทาย! ห้ามพลาดเลยเกือบทั้งเกม 😳',
    target(diff){ return pickTierValue(diff, 3, 2, 1); },
    getProgress(state){ return missFinalProgressDuringPlay(state); },
    finalize(state){
      const map = state && state.__questTargetMap ? state.__questTargetMap : null;
      const target = map && map[this.id] ? map[this.id] : 0;
      return missFinalProgressOnFinalize(state, target);
    }
  },
  {
    id: 'M_COMBO_11',
    label: 'ทำคอมโบสูงสุดให้ได้อย่างน้อย 11',
    hint: 'คอมโบยาว ๆ แล้วแต้มจะพุ่ง 🚀',
    target(diff){ return pickTierValue(diff, 8, 11, 14); },
    getProgress(state){ return pCombo(state); }
  }
];
