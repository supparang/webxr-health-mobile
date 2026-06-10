CSAI2102 AI Quest — PATCH v2.1 Classroom Ready Preview
========================================================

เป้าหมายชุดนี้
---------------
ทำต่อจาก v1.8 ให้ถึง v2.1 ตามที่อาจารย์สั่ง:
v1.9 Adaptive Difficulty + Misconception Coach
v2.0 Teacher Dashboard
v2.1 Session 2 Intelligent Agent Template

ไฟล์ใน zip
----------
aiquest_patch/
  index.html
  teacher-dashboard.html
  session2-agent-preview.html
  results.html
  js/
    aiquest-storage.js
    aiquest-cloud-logger.js
    mission1-hard-choice-upgrade.js
    aiquest-gate-support-v18.js
    aiquest-adaptive-coach-v19.js
    mission2-agent-bank-v21.js
  apps-script/
    Code.gs
  README_PATCH_v2.1_CLASSROOM_READY.txt

สิ่งที่เพิ่ม
------------

1) v1.9 Adaptive Coach
   - วิเคราะห์ผิดติดกัน
   - จับ misconception เช่น automation, sensor, database, rule-based, internet
   - แนะนำ Practice/Coach/Challenge
   - เพิ่ม panel "Adaptive Coach"

2) v2.0 Teacher Dashboard
   - ไฟล์ใหม่ /ai-quest/teacher-dashboard.html
   - วิเคราะห์ CSV จาก Google Sheets
   - ดู Students, Attempts, Avg Score, Need Support
   - ดู Misconception Hotspots
   - ดู Gate Summary
   - ตาราง Student Progress
   - Export report เป็น JSON

3) v2.1 Session 2 Template
   - ไฟล์ใหม่ /ai-quest/session2-agent-preview.html
   - ไฟล์คำถาม /js/mission2-agent-bank-v21.js
   - หัวข้อ Intelligent Agent / PEAS / Environment / Rational Agent
   - 4 phase:
     1. Agent or Not
     2. PEAS Builder
     3. Environment Classifier
     4. Agent Boss

4) Apps Script URL ล่าสุด
   https://script.google.com/macros/s/AKfycbwXSUHbhVbZtKcjNIDzs4TawAohdeInm1MxLpomVeST2JilOL3L0LWQtT4_Yb7fbJG9/exec

วิธีติดตั้ง
-----------
1. แตก zip
2. อัปโหลดทับโฟลเดอร์ /ai-quest/
3. ต้องมีไฟล์ใหม่:
   /ai-quest/js/aiquest-adaptive-coach-v19.js
   /ai-quest/js/mission2-agent-bank-v21.js
   /ai-quest/teacher-dashboard.html
   /ai-quest/session2-agent-preview.html

4. เปิดหน้าเกม แล้วดู Console ต้องเห็น:
   [AIQuest] v1.8-gate-support loaded
   [AIQuest] v1.9-adaptive-coach loaded
   [AIQuest] v2.1-session2-agent-template loaded

วิธีทดสอบในห้องเรียนจำลอง
----------------------------
1. เปิด /ai-quest/index.html
2. กรอก Profile
3. เล่น Session 1
4. Save Result
5. ดู Gate & Support / Adaptive Coach
6. เปิด /ai-quest/teacher-dashboard.html
7. วาง CSV จาก Google Sheets แท็บ session_attempts
8. Analyze
9. เปิด /ai-quest/session2-agent-preview.html เพื่อดู Session 2 template

สถานะความพร้อม
---------------
ชุดนี้ยังเป็น Classroom Ready Preview ไม่ใช่ Final 100%
ควรดูอีกครั้งก่อนใช้จริง:
- Dashboard ต้องการ field CSV จริงจาก Google Sheets ว่าหัวคอลัมน์ตรงไหม
- Session 2 ยังเป็น preview/template ไม่ใช่ integrated full gameplay ใน index.html
- Adaptive Coach พร้อมเป็น engine แต่การแสดงผลใน gameplay อาจต้อง polish เพิ่ม
