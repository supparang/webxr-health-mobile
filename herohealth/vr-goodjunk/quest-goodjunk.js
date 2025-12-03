// === /herohealth/vr-goodjunk/quest-goodjunk.js ===
// Adapter สำหรับต่อ VR GoodJunk เข้ากับ quest-director + รายการเควสต์

import { makeQuestDirector } from '../modes/quest-director.js';
import { GOODJUNK_GOALS, GOODJUNK_MINIS } from './quest-defs-goodjunk.js';

export function createVRGoodjunkQuest(diff = 'normal') {
  return makeQuestDirector({
    diff,
    goalDefs: GOODJUNK_GOALS,
    miniDefs: GOODJUNK_MINIS,
    maxGoals: 3,   // 1 เกมสุ่ม Goal สูงสุด 3 ข้อ
    maxMini:  3    // 1 เกมสุ่ม Mini สูงสุด 3 ข้อ
  });
}

export default { createVRGoodjunkQuest };