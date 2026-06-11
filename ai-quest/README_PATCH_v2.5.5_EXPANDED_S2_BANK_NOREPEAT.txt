CSAI2102 AI Quest — PATCH v2.5.5 Expanded S2 Bank + No-repeat Engine
=====================================================================

เป้าหมาย
--------
ทำให้ Session 2 เล่นซ้ำได้จริงโดยไม่รู้สึกซ้ำเร็วเกินไป

S2 Bank ใหม่
------------
1. Agent or Not: 60 items
2. PEAS Builder: 70 items
3. Environment Classifier: 60 items
4. Rational Agent Boss Claims: 30 items
5. Reflection / Transfer Prompts: 20 items

รวม static curated items = 240 items

No-repeat Engine
----------------
1. itemId recent lock
   ไม่สุ่ม item เดิมใน recent window ก่อน

2. familyId recent lock
   กันโจทย์ที่บริบทคล้ายกัน เช่น car/traffic/robot ซ้ำถี่

3. recentWindow = 5 rounds
   จำประวัติ 5 รอบล่าสุดของนักศึกษาแต่ละคน

4. least-recently-seen fallback
   ถ้าข้อที่ไม่ซ้ำไม่พอ ระบบเลือกข้อที่เจอน้อย/ไกลที่สุดก่อน ไม่ใช่ random มั่ว

5. within-run family lock
   ในหนึ่งรอบพยายามไม่ใช้ family ซ้ำข้าม phase

6. difficulty fit
   easy/normal/hard/challenge เลือกข้อให้เหมาะระดับ

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v255.js
    aiquest-ui-mode-v255.js
    aiquest-session-roadmap-v255.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v255.js
    aiquest-student-detail-v255.js
    aiquest-production-v255.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.5_EXPANDED_S2_BANK_NOREPEAT.txt

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/mission2-agent-bank-v255.js
   /ai-quest/js/aiquest-ui-mode-v255.js
   /ai-quest/js/aiquest-session-roadmap-v255.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v255.js
   /ai-quest/js/aiquest-student-detail-v255.js
   /ai-quest/js/aiquest-production-v255.js

2. Apps Script:
   แทนที่ Code.gs ทั้งไฟล์
   Save > Deploy > Manage deployments > Edit > New version > Deploy

3. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.5.5

4. เปิด:
   /ai-quest/index.html?v=20260611-bank255

ตรวจใน Console
---------------
AIQUEST_SESSION2_BANK.counts.total ต้องเป็น 240
AIQUEST_SESSION2_BANK.resetSession2History() ใช้ล้างประวัติสุ่มของนักศึกษาปัจจุบันได้
