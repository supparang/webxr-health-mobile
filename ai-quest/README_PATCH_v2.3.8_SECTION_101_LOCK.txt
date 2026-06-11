CSAI2102 AI Quest — PATCH v2.3.8 Section 101 Lock
==================================================

เป้าหมาย
--------
ล็อกระบบทั้งหมดให้ใช้ Section = 101 เท่านั้น
ไม่ใช้ SEC01 อีกต่อไป เพื่อให้ Google Sheets, Teacher Console และข้อมูลนักศึกษาตรงกัน

มาตรฐานข้อมูล
--------------
courseId = CSAI2102
term = 1/2569
classId = CSAI2102-2569-101
section = 101
teacherId = supparang
activeSession = s1

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  js/
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-student-detail-v237.js
  apps-script/
    Code.gs
  README_PATCH_v2.3.8_SECTION_101_LOCK.txt

สิ่งที่เปลี่ยน
--------------
1. index.html
   - โหลด section lock script
   - ใช้ v2.3.8 Section 101 Lock

2. classroom-config.html
   - แสดง Section Lock
   - บังคับ Class ID = CSAI2102-2569-101
   - บังคับ Section = 101

3. aiquest-data-contract-v22.js
   - DEFAULT_CONFIG ใช้ classId/section ใหม่
   - loadConfig/saveConfig normalize เป็น 101 เสมอ
   - build payload ส่ง section = 101 เสมอ

4. aiquest-section-lock-v238.js
   - lock UI input section/classId
   - patch AIQuestDataContract
   - patch AIQuestStorage profile section เป็น 101

5. Code.gs v2.3.8
   - บังคับทุก write เข้า Google Sheets เป็น section 101
   - teacherConsole กรอง section 101 เท่านั้น
   - health ต้องขึ้น version v2.3.8

วิธีติดตั้ง
-----------
1. อัปโหลดไฟล์:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-student-detail-v237.js

2. Apps Script:
   เอา /aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์

3. Deploy:
   Save
   Deploy > Manage deployments > Edit
   Version: New version
   Deploy

4. ทดสอบ Apps Script:
   .../exec?action=health
   ต้องเห็น version: v2.3.8

5. ทดสอบ Teacher Console:
   .../exec?action=teacherConsole
   ต้องเห็น filters.section = 101 และ data.allStudents

6. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260610-section238

7. เปิด Student Mode:
   /ai-quest/index.html?v=20260610-section238

หมายเหตุ
--------
ข้อมูลเก่าที่ section = SEC01 จะไม่ถูกนับรวมใน Teacher Console หลังล็อก 101
ถ้าเป็นข้อมูลทดสอบให้ลบออกจาก Google Sheets ได้เลย
