CSAI2102 AI Quest — PATCH v2.5.1 Session 2 Direct Start Fix
================================================================

แก้ปัญหา
--------
กดปุ่ม Session 2 มุมขวาบนแล้วไม่เข้าเกมทันที
ใน v2.5.0 ปุ่มนี้เลือกด่าน Agent Builder เท่านั้น แต่ยังต้องเลื่อนลงไปกดเริ่ม Session อีกที
ทำให้นักศึกษาหรืออาจารย์เข้าใจว่า “กดแล้วไม่เข้า Session 2”

สิ่งที่แก้ใน v2.5.1
--------------------
1. ปุ่ม Session 2 มุมขวาบน
   - ถ้า Profile พร้อม และ Session 1 ผ่านแล้ว
   - จะเข้าเกม Session 2: Agent Builder ทันที

2. ถ้ายังไม่กรอก Profile
   - scroll ไปที่ Student Profile
   - แจ้งเตือนให้กรอกข้อมูลก่อน

3. ถ้ายังไม่ผ่าน Session 1
   - scroll ไปที่รายละเอียด Mission 2
   - แจ้งว่า Session 2 เปิดหลังผ่าน Session 1 อย่างน้อย 1 ดาว

4. เพิ่ม deep link
   - /ai-quest/index.html?session=s2&v=20260611-session251
   - /ai-quest/index.html?mission=m2&v=20260611-session251

5. ปุ่มในรายละเอียดด่านเปลี่ยนเป็น “เริ่ม Session 2”

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v251.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v251.js
    aiquest-student-detail-v251.js
    aiquest-production-v251.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.1_SESSION2_DIRECT_START_FIX.txt

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/mission2-agent-bank-v251.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v251.js
   /ai-quest/js/aiquest-student-detail-v251.js
   /ai-quest/js/aiquest-production-v251.js

2. Apps Script:
   เอา /aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์
   Save > Deploy > Manage deployments > Edit > New version > Deploy

3. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.5.1

4. เปิด Student Mode:
   /ai-quest/index.html?v=20260611-session251

5. กดปุ่ม Session 2 มุมขวาบน
   ต้องเข้าเกม Agent Builder ทันที

6. Direct link Session 2:
   /ai-quest/index.html?session=s2&v=20260611-session251
