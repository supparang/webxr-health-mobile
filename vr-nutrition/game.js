(() => {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // I18N
  const i18n = {
    th: {
      start:"เริ่มเกม", pause:"พัก", how:"วิธีเล่น", restart:"เริ่มใหม่",
      score:"คะแนน", time:"เวลา", best:"สถิติ", mode:"โหมด", diff:"ความยาก", combo:"คอมโบ",
      modeGJ:"ดี vs ขยะ", modeGroups:"จาน 5 หมู่", daily:"ภารกิจประจำวัน",
      howGJ:"จ้อง/แตะ อาหารที่ดี (ผลไม้ ผัก น้ำ) หลีกเลี่ยงอาหารขยะ (เบอร์เกอร์ โซดา โดนัท) เก็บคอมโบเพื่อคะแนนสูง!",
      howGroups:"ดู 'หมู่เป้าหมาย' มุมขวาบน แล้วจ้อง/แตะอาหารที่อยู่ในหมู่นั้นเพื่อเก็บคะแนน!",
      tipsGood:"เยี่ยม! เลือกอาหารที่ดีมาก", tipsBad:"อาหารนี้ไม่ดีต่อสุขภาพ",
      target:"เป้าหมาย", summary:"สรุปผล",
      langSetTH:"เปลี่ยนภาษาเป็นไทยแล้ว", langSetEN:"Language set to English",
      voiceOn:"เสียงพูด: เปิด", voiceOff:"เสียงพูด: ปิด"
    },
    en: {
      start:"Start", pause:"Pause", how:"How to Play", restart:"Restart",
      score:"Score", time:"Time", best:"Best", mode:"Mode", diff:"Difficulty", combo:"Combo",
      modeGJ:"Good vs Junk", modeGroups:"Food Groups Plate", daily:"Daily Mission",
      howGJ:"Gaze/tap healthy foods (fruits, veggies, water). Avoid junk (burger, soda, donut). Keep combo for higher scores!",
      howGroups:"Check 'Target Group' (top-right) then gaze/tap foods from that group to score!",
      tipsGood:
