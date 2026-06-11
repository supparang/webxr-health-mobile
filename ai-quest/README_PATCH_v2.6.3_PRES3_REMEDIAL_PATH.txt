CSAI2102 AI Quest — PATCH v2.6.3 Pre-S3 Remedial Path
========================================================

เป้าหมาย
--------
ก่อนเปิด S3 Search Maze ให้มีทางทบทวนสำหรับผู้เรียนที่ยังมี misconception
โดยไม่กระทบคะแนน graded และไม่ทำให้ Teacher Console สับสน

สิ่งที่เพิ่ม
------------
1. Student-side Pre-S3 Review Path
   - แสดงเฉพาะ Student Mode
   - ไม่แสดงใน Teacher Mode
   - อยู่หลัง Roadmap / หน้า Dashboard นักศึกษา

2. Review 4 เส้นทาง
   - AI vs Automation Review
   - PEAS Drill
   - Environment Drill
   - Boss Weakness Training

3. Micro Drill แบบไม่ graded
   - ใช้คลัง S2 และ B1 ที่มีอยู่แล้ว
   - ตอบแล้วมี feedback ทันที
   - ไม่บันทึกเป็นคะแนน Google Sheets
   - เหมาะสำหรับ remedial ก่อนเริ่ม S3

4. Weak Focus
   - อ่าน misconception เด่นจาก S2/B1 local history
   - ถ้าไม่มี weakness เฉพาะตัว จะใช้ review มาตรฐาน

5. Quick Actions
   - เล่น S2 ซ้ำเพื่อ Mastery
   - เข้า B1 Boss

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v263.js
    boss1-rookie-bank-v263.js
    aiquest-remedial-path-v263.js
    aiquest-ui-mode-v263.js
    aiquest-session-roadmap-v263.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v263.js
    aiquest-student-detail-v263.js
    aiquest-production-v263.js
  apps-script/
    Code.gs
  README_PATCH_v2.6.3_PRES3_REMEDIAL_PATH.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดตามโครง aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.6.3

เปิด Student Mode:
------------------
/ai-quest/index.html?v=20260611-remedial263

เปิด Teacher Mode:
------------------
/ai-quest/index.html?teacher=1&v=20260611-remedial263

ตรวจสอบ
--------
Student Mode:
- ต้องเห็น Pre-S3 Review Path
- กดเริ่ม Review แล้วมี micro drill
- ตอบแล้วมี feedback
- ไม่บันทึก graded attempt

Teacher Mode:
- ต้องไม่เห็น Pre-S3 Review Path
- Teacher Console ยังเป็น v2.6.3
