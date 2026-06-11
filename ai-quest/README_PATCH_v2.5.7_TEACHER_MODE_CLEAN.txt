CSAI2102 AI Quest — PATCH v2.5.7 Teacher Mode Clean + Student Roadmap
=======================================================================

ปัญหาที่แก้
------------
ใน Teacher Mode ไม่ควรแสดง Roadmap card ใหญ่แบบ Student Mode
เพราะ Teacher Mode ต้องเน้น:
- Teacher Console
- Phase Analytics
- Risk Students
- Student Detail
- Export/Refresh
ไม่ควรมีการ์ดด่านแบบนักศึกษาแทรกให้รกหน้า

สิ่งที่แก้ใน v2.5.7
--------------------
1. Roadmap card ใหญ่แสดงเฉพาะ Student Mode
   - Student Mode ยังเห็น S1-S15 + Boss Gates
   - กดการ์ดเข้า S1/S2/B1 ได้เหมือนเดิม

2. Teacher Mode ซ่อน Roadmap card ใหญ่
   - เมื่อเปิด ?teacher=1 จะไม่มี Session Roadmap panel
   - Teacher Console ขึ้นเป็นพื้นที่หลักทันที

3. แก้ bug ใน roadmap script
   - ตัด binding เก่า roadmapStartS1 / roadmapStartS2 / roadmapBossInfo ที่ไม่ใช้แล้ว
   - ป้องกัน ReferenceError จากตัวแปร s2/bi ที่ไม่มีใน clickable roadmap

4. Version/cache-bust ใหม่
   - aiquest-session-roadmap-v257.js
   - เปิดด้วย ?v=20260611-teacher257

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v257.js
    aiquest-ui-mode-v257.js
    aiquest-session-roadmap-v257.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v257.js
    aiquest-student-detail-v257.js
    aiquest-production-v257.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.7_TEACHER_MODE_CLEAN.txt

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/mission2-agent-bank-v257.js
   /ai-quest/js/aiquest-ui-mode-v257.js
   /ai-quest/js/aiquest-session-roadmap-v257.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v257.js
   /ai-quest/js/aiquest-student-detail-v257.js
   /ai-quest/js/aiquest-production-v257.js

2. Apps Script:
   แทนที่ Code.gs ทั้งไฟล์
   Save > Deploy > Manage deployments > Edit > New version > Deploy

3. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.5.7

4. เปิด Student Mode:
   /ai-quest/index.html?v=20260611-teacher257
   ต้องเห็น Roadmap card

5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-teacher257
   ต้องไม่เห็น Roadmap card ใหญ่
   ต้องเห็น Teacher Console เป็นหลัก
