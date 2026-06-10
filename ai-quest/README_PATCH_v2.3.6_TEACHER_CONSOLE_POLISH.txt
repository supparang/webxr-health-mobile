CSAI2102 AI Quest — PATCH v2.3.6 Teacher Console Polish
======================================================

เป้าหมาย
--------
ต่อจาก v2.3.5 ที่ Teacher Console อ่าน Google Sheets ได้แล้ว
รอบนี้ปรับให้ใช้งานในห้องเรียนจริงชัดขึ้น

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  js/
    aiquest-teacher-console-v236.js
  apps-script/
    Code.gs
  README_PATCH_v2.3.6_TEACHER_CONSOLE_POLISH.txt

สิ่งที่เพิ่ม/แก้
----------------
1. Metric ใหม่: Not Submitted
   แยกจาก Submitted ชัดเจน ไม่ต้องเดาจาก Students - Submitted เอง

2. Reflection OK ปรับความหมาย
   คิดจากกลุ่มที่ส่งแล้ว และ label ชี้ว่าเป็น "ครบในกลุ่มที่ส่งแล้ว"

3. Teaching Decision ฉลาดขึ้น
   ถ้ามีคนยังไม่ส่ง ระบบจะเตือน:
   "ยังไม่ส่ง X คน: ให้ตรวจรายชื่อใน Risk Students ก่อนปิดกิจกรรม"

4. ปุ่ม Copy Link
   - Copy Student Link
   - Copy Teacher Link

5. Apps Script v2.3.6
   เพิ่ม stats.notSubmittedStudents ใน action=teacherConsole

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/js/aiquest-teacher-console-v236.js

2. ไป Apps Script
   แทนที่ Code.gs ด้วย:
   /aiquest_patch/apps-script/Code.gs

3. Save

4. Deploy > Manage deployments > Edit
   Version: New version
   Deploy

5. ทดสอบ:
   Apps Script URL?action=health
   ต้องเห็น version: v2.3.6

6. ทดสอบ:
   Apps Script URL?action=teacherConsole
   ต้องเห็น data.stats.notSubmittedStudents

7. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260610-teacher236

Console ต้องเห็น:
  [AIQuest] v2.3.6-teacher-console-polish loaded

Student Mode
------------
นักศึกษาเปิด:
  /ai-quest/index.html?v=20260610-student236
