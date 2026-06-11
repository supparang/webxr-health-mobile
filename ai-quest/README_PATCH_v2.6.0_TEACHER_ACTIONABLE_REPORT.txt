CSAI2102 AI Quest — PATCH v2.6.0 Teacher Actionable Report + Class Mastery Gate
==================================================================================

เป้าหมาย
--------
หลังจาก S1 → S2 → B1 แข็งแล้ว ให้ Teacher Mode ตอบได้ทันทีว่า
“ห้องพร้อมไป S3 หรือยัง” และ “ควรสอนซ้ำเรื่องอะไร”

สิ่งที่เพิ่ม
------------
1. Class Gate View
   - เพิ่มตัวเลือก Class Gate: S1+S2+B1 ใน Teacher Console
   - ดูภาพรวมทั้ง 3 ด่านพร้อมกัน

2. Mastery Gate Analytics
   - Ready for S3
   - Need S1
   - Need S2
   - Need B1
   - Challenge Ready
   - Remedial Count

3. Stage Progress
   - S1 AI Awakening: submitted / passed / mastery / avg best
   - S2 Agent Builder: submitted / passed / mastery / avg best
   - B1 Rookie Boss: submitted / passed / mastery / avg best

4. Teaching Recommendation
   - แนะนำว่าเปิด S3 ได้หรือยัง
   - ถ้า readiness ต่ำกว่า 50% แนะนำ remedial ก่อน
   - ถ้า 50–69% แนะนำเปิด S3 แบบมี remedial คู่ขนาน
   - ถ้า ≥70% แนะนำเปิด S3 ได้

5. Server-side Apps Script Gate
   - action=teacherConsole&sessionId=all
   - buildMasteryGate_() วิเคราะห์จาก Google Sheets โดยตรง
   - ยังรองรับ sessionId=s1/s2/b1 เหมือนเดิม

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v260.js
    boss1-rookie-bank-v260.js
    aiquest-ui-mode-v260.js
    aiquest-session-roadmap-v260.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v260.js
    aiquest-student-detail-v260.js
    aiquest-production-v260.js
  apps-script/
    Code.gs
  README_PATCH_v2.6.0_TEACHER_ACTIONABLE_REPORT.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดตามโครง aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.6.0
5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-report260

ตรวจสอบ
--------
Teacher Console ต้องมี:
- dropdown: Class Gate: S1+S2+B1
- Class Mastery Gate panel
- Ready for S3 %
- Teaching Recommendation
