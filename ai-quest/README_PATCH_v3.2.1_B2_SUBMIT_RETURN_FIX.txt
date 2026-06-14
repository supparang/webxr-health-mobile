CSAI2102 AI Quest — PATCH v3.2.1 B2 Submit Return Fix

ปัญหา:
เล่น B2 แล้วกดบันทึก จากนั้นระบบเข้าเล่น B2 รอบใหม่เองซ้ำหลายรอบ

สาเหตุ:
card-click/native entry script อาจจับ click หลัง submit/summary แล้วเรียก startMission('b2') ซ้ำ

แก้:
1) เพิ่ม aiquest-b2-submit-return-fix-v321.js
2) หลังปุ่มบันทึก/ส่งผลใน B2:
   - suppress auto-start 15 วินาที
   - กลับ Roadmap/Home
   - ไม่เริ่ม B2 รอบใหม่
3) card-click-native ignore click ใน:
   - button/input/textarea/form
   - game/mission/play/summary/result screen
4) patch startMission('b2') กัน auto replay หลัง submit
5) Single entry bar และ B2 Specific Bank ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?v=20260612-b2return321

เช็ก:
 AIQUEST_B2_SUBMIT_RETURN_FIX
 AIQUEST_CARD_CLICK_NATIVE
