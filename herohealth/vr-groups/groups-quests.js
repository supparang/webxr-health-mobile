/* === /herohealth/vr-groups/groups-quests.js ===
Quest Templates — PRODUCTION
✅ provides GroupsVR.Quests.getGoalText(groupName)
✅ provides GroupsVR.Quests.getMiniText({need, forbidJunk, sec})
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};

  const Quests = {
    getGoalText(groupName){
      return `ยิงให้ถูกหมู่ “${groupName}” ให้ได้ตามเป้าหมาย`;
    },
    getMiniText({need=5, forbidJunk=false, sec=9}={}){
      if (forbidJunk) return `MINI: ให้ถูก ${need} ภายใน ${sec} วิ และห้ามโดนขยะ!`;
      return `MINI: ให้ถูก ${need} ภายใน ${sec} วิ`;
    },
    // optional coach lines for variety (seeded usage later)
    coachLines(){
      return [
        'หยุด-เล็ง-ยิง 👀',
        'ดูชื่อหมู่ก่อนแล้วยิง ✅',
        'ถ้าไม่แน่ใจ อย่ายิงมั่วนะ',
        'คอมโบมาแล้ววว 🔥'
      ];
    }
  };

  NS.Quests = Quests;

})(typeof window !== 'undefined' ? window : globalThis);