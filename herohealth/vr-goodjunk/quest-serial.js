// === /herohealth/vr/vr-goodjunk/quest-serial.js ===
// Quest System สำหรับ Good vs Junk VR
// - มี Goal หลัก + Mini Quest
// - ยิง event 'quest:update' เพื่อให้ HUD ฝั่ง goodjunk-vr.html แสดงผล

'use strict';

// ไว้ใช้เก็บ state ภายใน Quest
const QuestState = {
  goodCount: 0,     // นับจำนวน "ของดี" ที่เก็บได้
  junkHit:  0,     // นับจำนวนครั้งที่โดนของขยะ
  feverCount: 0    // นับจำนวนครั้งที่เข้าโหมด FEVER
};

// ยิง event ไปให้ HUD (goodjunk-vr.html ฟังอยู่)
function emitQuestUpdate() {
  const good = QuestState.goodCount | 0;
  const junk = QuestState.junkHit  | 0;

  // ใช้ comboMax จาก window (GameEngine จะเป็นคนอัปเดต)
  const comboMax = (window.comboMax | 0) || (window.combo | 0) || 0;

  const detail = {
    // Goal หลัก: เก็บของดีให้ได้ 30 ชิ้นขึ้นไป
    goal: {
      id: 'good-30',
      label: 'เก็บของดี (🥦🍎🥛) ให้ได้อย่างน้อย 30 ชิ้น',
      progress: good,
      target: 30
    },

    // Mini quest: ทำคอมโบให้ถึง x10
    mini: {
      id: 'combo-10',
      label: 'ทำคอมโบให้ถึง x10',
      progress: comboMax,
      target: 10
    },

    // ข้อความฮินต์สั้น ๆ
    hint: 'เล็งของดี 🥦🍎🥛 ให้เร็ว ๆ และพยายามไม่โดนของขยะ 🍟🍩 จะได้คอมโบยาว ๆ นะ!'
  };

  try {
    window.dispatchEvent(new CustomEvent('quest:update', { detail }));
  } catch (e) {
    console.warn('quest:update dispatch error', e);
  }
}

export const Quest = {
  start() {
    // รีเซ็ตทุกครั้งที่เริ่มเกมใหม่
    QuestState.goodCount = 0;
    QuestState.junkHit   = 0;
    QuestState.feverCount= 0;

    // ยิงครั้งแรกเพื่อให้ HUD แสดง goal/mini ตั้งแต่ยังไม่เล่น
    emitQuestUpdate();
  },

  stop() {
    // ตอนนี้ยังไม่ต้องทำอะไรเป็นพิเศษ
  },

  // เรียกจาก GameEngine เวลาเก็บของดีได้
  onGood() {
    QuestState.goodCount++;
    emitQuestUpdate();
  },

  // เรียกจาก GameEngine เวลาโดนของขยะ
  onBad() {
    QuestState.junkHit++;
    emitQuestUpdate();
  },

  // เรียกจาก GameEngine เวลาเข้าโหมด FEVER
  onFever() {
    QuestState.feverCount++;
    emitQuestUpdate();
  }
};

export default Quest;
