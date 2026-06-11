CSAI2102 AI Quest — PATCH v2.6.4 Remedial Anti-repeat + Optional Review
=============================================================================

ปัญหาที่แก้
----------
v2.6.3 Pre-S3 Review Path มีปัญหาใน AI vs Automation Review:
- คลัง B1 มี 6 variants ต่อ family
- micro drill เดิมสุ่มจาก item ตรง ๆ
- ทำให้ family เดิม เช่น robot_only / agent ต้องเป็นหุ่นยนต์ ออกซ้ำหลายข้อในรอบเดียว
- ผู้เรียนรู้สึกว่า “ทำไปเพื่ออะไร” เพราะซ้ำและเสียเวลา

สิ่งที่แก้ใน v2.6.4
--------------------
1. Family Lock ใน micro drill
   - ในหนึ่ง drill ใช้ familyId เดิมได้ไม่เกิน 1 ครั้งก่อน
   - ถ้าข้อไม่พอจึง fallback เป็น item-level variety

2. Recent Family Memory
   - จำ family ที่เจอใน review ล่าสุด
   - ลดโอกาสเจอ family เดิมซ้ำในรอบถัดไป

3. AI vs Automation Review ไม่วน robot_only ซ้ำ
   - เลือกจากหลาย families
   - automation/rulebased/timer/threshold/database/random/sensor/robot
   - ถ้าใช้ bank เก่าจะ fallback แบบไม่ซ้ำ family

4. Optional Review แบบย่อ
   - Pre-S3 Review ไม่เปิดยาวอัตโนมัติแล้ว
   - แสดงเป็น Optional Pre-S3 Review แบบ compact
   - ผู้เรียนกด “เปิด Review” เองเมื่ออยากทบทวน

5. ไม่กระทบ graded data
   - ยังไม่บันทึก Google Sheets
   - Teacher Mode ยังไม่เห็น panel นี้
   - S1/S2/B1 grading เดิมไม่เปลี่ยน

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v264.js
    boss1-rookie-bank-v264.js
    aiquest-remedial-path-v264.js
    aiquest-ui-mode-v264.js
    aiquest-session-roadmap-v264.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v264.js
    aiquest-student-detail-v264.js
    aiquest-production-v264.js
  apps-script/
    Code.gs
  README_PATCH_v2.6.4_REMEDIAL_ANTIREPEAT.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมด
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. Health ต้องเป็น v2.6.4
5. เปิด:
   /ai-quest/index.html?v=20260611-antirepeat264

ตรวจสอบ
--------
Student Mode:
- Pre-S3 Review ต้องเป็น Optional แบบย่อ
- กดเปิด Review เอง
- AI vs Automation ไม่ควรซ้ำ family เดิม 3 ข้อติด
- มี family label แสดงในข้อเพื่อช่วย debug

Console:
AIQuestRemedialPath.reset()
ใช้ล้างประวัติ review/recent family ของผู้เรียนปัจจุบัน
