CSAI2102 AI Quest — PATCH v2.4.0 Classroom Production Release
================================================================

เป้าหมาย
--------
ทำให้ Session 1 พร้อมใช้งานจริงทั้งห้อง Section 101 ก่อนเริ่มทำ Session 2

สถานะ
------
v2.4.0 = Classroom Production Release สำหรับ Session 1

มาตรฐานข้อมูล
--------------
courseId = CSAI2102
term = 1/2569
classId = CSAI2102-2569-101
section = 101

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
    aiquest-teacher-console-v240.js
    aiquest-student-detail-v240.js
    aiquest-production-v240.js
  apps-script/
    Code.gs
  README_PATCH_v2.4.0_CLASSROOM_PRODUCTION.txt

สิ่งที่เพิ่ม/ล็อก
------------------
1. Production Checklist
   - Profile Ready
   - Section 101
   - Google Sheets URL
   - Reflection Required
   - Class Lock

2. Teacher Production Checklist
   - Section 101
   - Class ID 101
   - Apps Script URL
   - Source: Sheets
   - Server v2.4.0
   - Ignored Test Rows

3. Ignore Test Data ใน Teacher Console
   ไม่เอา TEST / GAME_TEST / BROWSER / MANUAL-TEST / SAMPLE / DEMO ไปนับ summary
   ถ้าต้องการดู test data ให้เรียก API ด้วย includeTest=1

4. Submit Safety UX
   - กันกดส่งซ้ำเร็วเกินไป
   - แสดง hint หลังบันทึกสำเร็จ

5. คู่มือใช้งานจริง
   - student-guide.html
   - teacher-guide.html

วิธีติดตั้ง
-----------
1. อัปโหลดไฟล์:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v240.js
   /ai-quest/js/aiquest-student-detail-v240.js
   /ai-quest/js/aiquest-production-v240.js

2. Apps Script:
   เอา /aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์

3. Deploy:
   Save
   Deploy > Manage deployments > Edit
   Version: New version
   Deploy

4. ทดสอบ Apps Script:
   .../exec?action=health
   ต้องเห็น version: v2.4.0

5. ทดสอบ Teacher Console API:
   .../exec?action=teacherConsole
   ต้องเห็น:
   - filters.section = 101
   - data.stats.ignoredTestRows
   - data.allStudents

6. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-production240

7. เปิด Student Mode:
   /ai-quest/index.html?v=20260611-production240

หลังผ่าน v2.4.0
----------------
เริ่มทำ Session 2 Full Gameplay ได้:
Intelligent Agent / PEAS / Environment / Rational Agent Boss
