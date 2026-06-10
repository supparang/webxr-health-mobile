CSAI2102 AI Quest — PATCH v2.3.7 Student Detail View
====================================================

เป้าหมาย
--------
เพิ่มการดูข้อมูลรายคนใน Teacher Console

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  js/
    aiquest-student-detail-v237.js
  apps-script/
    Code.gs
  README_PATCH_v2.3.7_STUDENT_DETAIL_VIEW.txt

สิ่งที่เพิ่ม
------------
1. All Students Detail
   เห็นนักศึกษาทุกคน ไม่ใช่เฉพาะ Risk Students

2. Search / Filter
   - ค้นหา studentId / ชื่อ / section
   - filter: ทั้งหมด / เฉพาะ risk / ยังไม่ส่ง / Reflection ไม่ครบ / Mastery

3. View Detail รายคน
   กด View เพื่อดู:
   - Best Score / Latest Score / Help Used
   - Risk tags
   - Misconception ของคนนั้น
   - Latest Reflection 1–3
   - Attempts ทั้งหมด
   - Recent Events / Wrong Items

4. Export Student JSON
   ส่งออกข้อมูลรายคนเป็น JSON

5. Apps Script v2.3.7
   teacherConsole API เพิ่ม data.allStudents[]

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/js/aiquest-student-detail-v237.js

2. Apps Script:
   แทนที่ Code.gs ด้วย aiquest_patch/apps-script/Code.gs
   Save > Deploy > Manage deployments > Edit > New version > Deploy

3. ทดสอบ:
   Apps Script URL?action=health
   ต้องเห็น version: v2.3.7

4. ทดสอบ:
   Apps Script URL?action=teacherConsole
   ต้องเห็น data.allStudents

5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260610-teacher237

Console ต้องเห็น:
  [AIQuest] v2.3.7-student-detail-view loaded
