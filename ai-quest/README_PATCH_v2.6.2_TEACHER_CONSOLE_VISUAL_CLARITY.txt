CSAI2102 AI Quest — PATCH v2.6.2 Teacher Console Visual Clarity
=================================================================

เป้าหมาย
--------
แก้รายละเอียด UI หลังทดสอบ v2.6.1:
- Teacher Console heading/ช่วงบนไม่ให้ดูเหมือนโดน topbar บัง
- ลดความสับสน Ready for S3 100% แต่ Need Support 1
- ทำให้ Class Gate อ่านเป็นภาพรวมก่อนเปิด S3 ได้ชัดขึ้น

สิ่งที่แก้
----------
1. เพิ่ม spacing ด้านบนของ Teacher Console
   - ลดอาการ heading/subtitle ชิดหรือเหมือนถูก topbar บัง
   - เพิ่ม margin-top และ scroll-margin-top ให้ panel

2. เปลี่ยน metric ใน Class Gate จาก Need Support เป็น Need Review
   - ถ้า View = all จะใช้คำว่า Need Review
   - ชี้แจงว่าไม่ใช่ fail แต่เป็นจุดทบทวนก่อน S3
   - ถ้าพร้อม S3 แล้วแต่ยังมี misconception จะขึ้น soft warning แทน bad warning

3. Ready Badge ชัดขึ้น
   - พร้อมเปิด S3 (ผ่านขั้นต่ำ) · xx%
   - แยกความหมายจาก Challenge Ready

4. ยังคงระบบเดิมทั้งหมด
   - Class Gate default
   - Phase Alias Merge
   - Copy Teaching Recommendation
   - Teacher Console อ่าน Google Sheets
   - Section 101 lock

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v262.js
    boss1-rookie-bank-v262.js
    aiquest-ui-mode-v262.js
    aiquest-session-roadmap-v262.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v262.js
    aiquest-student-detail-v262.js
    aiquest-production-v262.js
  apps-script/
    Code.gs
  README_PATCH_v2.6.2_TEACHER_CONSOLE_VISUAL_CLARITY.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดตามโครง aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.6.2
5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-clarity262

ตรวจสอบ
--------
- Header ไม่ควรบัง/ชิด Teacher Console
- View เป็น all
- Class Gate ยังขึ้น
- Metric เป็น Need Review ใน Class Gate
- Ready badge เขียนว่าพร้อมเปิด S3 (ผ่านขั้นต่ำ)
