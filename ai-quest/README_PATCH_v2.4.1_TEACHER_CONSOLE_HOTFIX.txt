CSAI2102 AI Quest — PATCH v2.4.1 Teacher Console Hotfix
=======================================================

แก้ปัญหา
--------
หน้า Apps Script action=teacherConsole ขึ้น error:

ReferenceError: notSubmittedStudents is not defined

สาเหตุ
------
Code.gs v2.4.0 มีการใส่ field notSubmittedStudents ใน stats
แต่ยังไม่ได้ประกาศตัวแปร notSubmittedStudents ก่อนสร้าง stats

สิ่งที่แก้ใน v2.4.1
--------------------
1. Code.gs
   - เพิ่ม const notSubmittedStudents = Math.max(0, students.length - submitted.length);
   - version เป็น v2.4.1
   - teacherConsole กลับมาทำงานได้

2. Front-end
   - index.html โหลดไฟล์ v241
   - teacher console / student detail / production script เป็น v2.4.1
   - cache buster ใช้ 20260611-hotfix241

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
    aiquest-teacher-console-v241.js
    aiquest-student-detail-v241.js
    aiquest-production-v241.js
  apps-script/
    Code.gs
  README_PATCH_v2.4.1_TEACHER_CONSOLE_HOTFIX.txt

วิธีติดตั้งด่วน
----------------
1. Apps Script:
   เอา aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์

2. Deploy:
   Save
   Deploy > Manage deployments > Edit
   Version: New version
   Deploy

3. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.4.1

4. ทดสอบ:
   .../exec?action=teacherConsole
   ต้องได้ JSON ไม่ใช่ ReferenceError

5. อัปโหลดไฟล์หน้าเว็บ:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/aiquest-teacher-console-v241.js
   /ai-quest/js/aiquest-student-detail-v241.js
   /ai-quest/js/aiquest-production-v241.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js

เปิดใช้งาน
----------
Teacher:
  /ai-quest/index.html?teacher=1&v=20260611-hotfix241

Student:
  /ai-quest/index.html?v=20260611-hotfix241
