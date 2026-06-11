CSAI2102 AI Quest — PATCH v2.4.2 Production Label + Metrics Fix
=================================================================

เป้าหมาย
--------
แก้จุดเล็ก ๆ ก่อนเริ่มทำ Session 2:
1) หัวเว็บยังขึ้น v2.3 ให้ถูกเป็น v2.4.2
2) Avg Score ทำให้เข้าใจผิด เพราะเดิมเป็นค่าเฉลี่ย Best Score
3) Risk Students ไม่ขึ้นแม้ latest score ต่ำกว่า 70 และ Reflection สั้น

สถานะหลังแก้
-------------
v2.4.2 = Session 1 Production Ready แบบเนียนขึ้น ก่อนเริ่ม Session 2

สิ่งที่แก้
----------
1. index.html
   - Subtitle เปลี่ยนเป็น:
     v2.4.2 • Classroom Production Ready • Section 101
   - โหลดไฟล์ v242 ทั้งหมด

2. Code.gs
   - version เป็น v2.4.2
   - stats เพิ่ม:
     avgLatestScore
     avgBestScore
   - avgScore ถูก set ให้เท่ากับ avgLatestScore เพื่อให้ Teaching Decision ไม่เข้าใจผิด
   - Risk logic เพิ่ม:
     คะแนนล่าสุดต่ำกว่า 70 => ควรทบทวน
     Reflection สั้น => ควรช่วย
     Misconception เด่นเกิน threshold => ควรสอนซ้ำ
   - testWrite ใช้ section 101

3. Teacher Console
   - เปลี่ยนการ์ด Avg Score เป็น:
     Avg Latest
     Avg Best
   - Teaching Decision ใช้ Avg Latest
   - Google Sheets Status แสดง Avg latest และ Avg best

4. Production Checklist
   - เช็ก server v2.4.2

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v242.js
    aiquest-student-detail-v242.js
    aiquest-production-v242.js
  apps-script/
    Code.gs
  README_PATCH_v2.4.2_PRODUCTION_LABEL_METRICS_FIX.txt

วิธีติดตั้ง
-----------
1. อัปโหลดไฟล์:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v242.js
   /ai-quest/js/aiquest-student-detail-v242.js
   /ai-quest/js/aiquest-production-v242.js

2. Apps Script:
   เอา /aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์

3. Deploy:
   Save
   Deploy > Manage deployments > Edit
   Version: New version
   Deploy

4. ทดสอบ Apps Script:
   .../exec?action=health
   ต้องเห็น version: v2.4.2

5. ทดสอบ Teacher Console API:
   .../exec?action=teacherConsole
   ต้องเห็น:
   data.stats.avgLatestScore
   data.stats.avgBestScore
   data.stats.needSupport

6. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-fix242

7. เปิด Student Mode:
   /ai-quest/index.html?v=20260611-fix242

หลัง v2.4.2 ผ่าน
-----------------
เริ่ม Session 2 ได้ทันที
