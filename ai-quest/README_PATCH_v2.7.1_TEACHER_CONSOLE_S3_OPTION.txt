CSAI2102 AI Quest — PATCH v2.7.1 Teacher Console Session 3 Option
=====================================================================

ปัญหาที่แก้
----------
หลัง v2.7.0 เปิด S3 Search Maze แล้ว แต่ Teacher Console dropdown ยังมีแค่:
- Class Gate: S1+S2+B1
- Session 1
- Session 2
- Boss B1

จึงยังเลือกดูผล Session 3 แยกไม่ได้

สิ่งที่แก้
----------
1. เพิ่มตัวเลือกใน Teacher Console
   - Session 3: Search Maze

2. ปรับ label ให้ชัดขึ้น
   - Session 1: AI Awakening
   - Session 2: Agent Builder
   - Boss B1: Rookie AI Boss
   - Session 3: Search Maze

3. Teacher Console รองรับ sessionId=s3
   - Apps Script เดิมรองรับ filter sessionId อยู่แล้ว
   - patch นี้เพิ่ม UI option และ wording เท่านั้น

4. Phase Analytics รองรับ S3 อยู่ต่อจาก v2.7.0
   - State Space
   - BFS/DFS Trace
   - Maze Path
   - Search Boss

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v271.js
    boss1-rookie-bank-v271.js
    search3-maze-bank-v271.js
    aiquest-remedial-path-v271.js
    aiquest-ui-mode-v271.js
    aiquest-session-roadmap-v271.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v271.js
    aiquest-student-detail-v271.js
    aiquest-production-v271.js
  apps-script/
    Code.gs
  README_PATCH_v2.7.1_TEACHER_CONSOLE_S3_OPTION.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมด
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. Health ต้องเป็น v2.7.1
5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260612-tcs3-271

ตรวจสอบ
--------
Teacher Console dropdown ต้องมี:
- Class Gate: S1+S2+B1
- Session 1: AI Awakening
- Session 2: Agent Builder
- Boss B1: Rookie AI Boss
- Session 3: Search Maze

หลังนักศึกษาเล่น S3 และส่งผลแล้ว เลือก Session 3 ต้องเห็น Avg / Phase Analytics / Student Detail ของ S3
