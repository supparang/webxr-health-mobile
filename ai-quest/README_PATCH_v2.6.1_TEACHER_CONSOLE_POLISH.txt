CSAI2102 AI Quest — PATCH v2.6.1 Teacher Console Polish + Phase Alias
============================================================================

เป้าหมาย
--------
Polish Teacher Console ให้ไม่สับสนก่อนเปิด S3 Search Maze

สิ่งที่แก้
----------
1. Default Teacher View เป็น Class Gate: S1+S2+B1
   - กันกรณี browser ยังจำ view=b1 จากรอบก่อน
   - reset default เมื่อขึ้น version v2.6.1

2. Class Mastery Gate แสดงเฉพาะตอนเลือก Class Gate
   - ถ้าเลือก Session 1 / Session 2 / Boss B1 จะซ่อน panel ใหญ่
   - ลดความสับสนว่าเป็นภาพรวมคลาสหรือเฉพาะด่าน

3. Phase Alias Merge
   - Agent + Agent Foundation -> Agent Foundation
   - PEAS + PEAS Gate -> PEAS Gate
   - Environment + Environment Gate -> Environment Gate
   - Rationality + Rationality Gate -> Rationality Gate
   - Boss / Adaptive Boss / Final Attack -> Final Attack

4. Ready for S3 vs Challenge Ready
   - เพิ่มคำอธิบายใน panel
   - Ready for S3 = ผ่านขั้นต่ำครบ S1+S2+B1
   - Challenge Ready = mastery/คะแนนสูงครบ เหมาะกับเรียนเร็วหรือยากขึ้น

5. Teaching Decision เป็น action plan
   - บอกชัดว่าเปิด S3 ได้หรือยัง
   - ถ้าเปิดได้ ให้ทบทวน misconception เด่น 10 นาทีแรก
   - ถ้ายังไม่พร้อม ให้ remedial S1/S2/B1 ก่อน

6. Copy Teaching Recommendation
   - เพิ่มปุ่มคัดลอกคำแนะนำการสอน
   - ใช้ส่งต่อ/เก็บเป็นบันทึกหลังคาบได้

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v261.js
    boss1-rookie-bank-v261.js
    aiquest-ui-mode-v261.js
    aiquest-session-roadmap-v261.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v261.js
    aiquest-student-detail-v261.js
    aiquest-production-v261.js
  apps-script/
    Code.gs
  README_PATCH_v2.6.1_TEACHER_CONSOLE_POLISH.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดตามโครง aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.6.1
5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-polish261

ตรวจสอบ
--------
- Dropdown default ต้องเป็น Class Gate: S1+S2+B1
- View ต้องเป็น all
- Phase Analytics ต้องไม่แยก Agent / Agent Foundation ซ้ำ
- Ready for S3 กับ Challenge Ready ต้องมีคำอธิบาย
- มีปุ่ม Copy Teaching Recommendation
