CSAI2102 AI Quest — PATCH v2.3.4 Student Mode Clean UI
=======================================================

ปัญหาที่แก้
-----------
หน้าเมนูเดิมมีเครื่องมือเยอะเกินไปสำหรับนักศึกษา เช่น:
- Dashboard
- Config
- Reset
- Gate รายละเอียด
- Adaptive Coach เต็ม
- Classroom Entry / System Check
- Sync panel
- Mission Map เต็ม

จึงทำให้ผู้เรียนสับสนและมีโอกาสกดผิด

สิ่งที่เพิ่ม
------------
เพิ่มไฟล์:
- /ai-quest/js/aiquest-ui-mode-v234.js

แก้ไฟล์:
- /ai-quest/index.html

โหมดใหม่
---------
1) Student Mode = ค่าเริ่มต้น
เปิดปกติ:
  /ai-quest/index.html

นักศึกษาจะเห็นหลัก ๆ:
- Student Profile
- เริ่มเล่น Session 1
- ฝึกก่อนเล่นจริง
- สถานะของฉัน
- หน้าเกม
- หน้า Reflection + ส่งผลเข้า Google Sheets

ซ่อน:
- Dashboard
- Config
- Reset
- Gate เต็ม
- Adaptive Coach เต็ม
- Mission Map เต็ม
- Sync panel
- Export Summary

2) Teacher Mode
เปิดด้วย:
  /ai-quest/index.html?teacher=1

อาจารย์จะเห็นเครื่องมือครบ:
- Dashboard
- Config
- Reset
- Gate & Support
- Adaptive Coach
- Mission Map
- Sync panel
- Session 2 Preview

วิธีติดตั้ง
-----------
อัปโหลดทับ/เพิ่มไฟล์:
- /ai-quest/index.html
- /ai-quest/js/aiquest-ui-mode-v234.js

เปิดทดสอบแบบนักศึกษา:
  /ai-quest/index.html?v=20260610-student234

เปิดทดสอบแบบอาจารย์:
  /ai-quest/index.html?teacher=1&v=20260610-student234

Console ต้องเห็น:
  [AIQuest] v2.3.4-student-mode-clean-ui loaded

หมายเหตุ
--------
ระบบ Google Sheets / Reflection / Submit Flow ยังใช้ v2.3.3 เดิม
patch นี้ปรับ UI/UX เท่านั้น ไม่แตะ Apps Script
