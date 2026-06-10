CSAI2102 AI Quest — PATCH v2.3.5 Teacher Console Layout
======================================================

เป้าหมาย
--------
ปรับ Teacher Mode ให้เป็น Teacher Console จริง ไม่ใช่หน้าเกมที่มีเครื่องมือครูปนเต็มไปหมด

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  js/
    aiquest-teacher-console-v235.js
  apps-script/
    Code.gs
  README_PATCH_v2.3.5_TEACHER_CONSOLE.txt

สิ่งที่เปลี่ยน
--------------
1. Teacher Mode
เปิด:
  /ai-quest/index.html?teacher=1

จะเห็น Teacher Console เป็นส่วนแรก:
- Students
- Submitted
- Avg Score
- Mastery
- Need Support
- Reflection OK
- Risk Students
- Misconception Summary
- Teaching Decision
- Google Sheets Status

2. ซ่อนหน้าเกม/เครื่องมือทดสอบใน Teacher Mode
ค่าเริ่มต้นจะซ่อน:
- Session 1 hero
- Student Profile
- Gate & Support
- Adaptive Coach
- Mission Map

ถ้าอาจารย์ต้องการทดสอบเกมเอง กด:
  แสดงเครื่องมือทดสอบเกม

3. ดึงข้อมูลจาก Google Sheets
ต้องอัปเดต Apps Script Code.gs เป็นตัว v2.3.5
เพิ่ม action:
  ?action=teacherConsole

และรองรับ JSONP เพื่อให้ GitHub Pages อ่านข้อมูลจาก Apps Script ได้

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/js/aiquest-teacher-console-v235.js

2. ไป Apps Script
   แทนที่ Code.gs ด้วย:
   /aiquest_patch/apps-script/Code.gs

3. Save

4. Deploy > Manage deployments > Edit
   Version: New version
   Deploy

5. ทดสอบ:
   Apps Script URL?action=teacherConsole

6. เปิด:
   /ai-quest/index.html?teacher=1&v=20260610-teacher235

Console ต้องเห็น:
  [AIQuest] v2.3.5-teacher-console-layout loaded

หมายเหตุ
--------
Student Mode ยังเปิดปกติ:
  /ai-quest/index.html

นักศึกษาจะไม่เห็น Teacher Console
