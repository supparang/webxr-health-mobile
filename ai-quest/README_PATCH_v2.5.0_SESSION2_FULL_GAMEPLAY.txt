CSAI2102 AI Quest — PATCH v2.5.0 Session 2 Full Gameplay
=============================================================

เป้าหมาย
--------
เริ่ม Session 2 อย่างเป็นทางการ หลัง Session 1 Production Ready แล้ว

Session 2: Agent Builder
------------------------
หัวข้อ:
- Intelligent Agent
- PEAS
- Environment Types
- Rational Agent

Gameplay:
1. Agent or Not
2. PEAS Builder
3. Environment Classifier
4. Rational Agent Boss
5. Reflection 3 ข้อ
6. Save to Google Sheets ด้วย sessionId=s2

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v250.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v250.js
    aiquest-student-detail-v250.js
    aiquest-production-v250.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.0_SESSION2_FULL_GAMEPLAY.txt

สิ่งที่เพิ่ม
------------
1. เปิด m2 เป็น playable
   - Session 2 จะปลดล็อกหลังผ่าน Session 1 อย่างน้อย 1 ดาว

2. เพิ่ม Gameplay เต็มของ Session 2
   - Agent or Not
   - PEAS Builder
   - Environment Classifier
   - Rational Agent Boss

3. Google Sheets integration
   - attempt ของ Session 2 ส่งเป็น sessionId=s2
   - missionId=m2
   - events ของ Session 2 ส่งเป็น sessionId=s2 / missionId=m2

4. Teacher Console
   - มีตัวเลือก Session 1 / Session 2
   - เปลี่ยน activeSession แล้ว Refresh จาก Sheets ได้
   - Server version v2.5.0

5. Mission 2 Bank
   - Agent cards
   - PEAS scenarios
   - Environment classifier
   - Boss claims/distractors

วิธีติดตั้ง
-----------
1. อัปโหลดไฟล์:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/mission2-agent-bank-v250.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v250.js
   /ai-quest/js/aiquest-student-detail-v250.js
   /ai-quest/js/aiquest-production-v250.js

2. Apps Script:
   เอา /aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์

3. Deploy:
   Save
   Deploy > Manage deployments > Edit
   Version: New version
   Deploy

4. ทดสอบ Apps Script:
   .../exec?action=health
   ต้องเห็น version: v2.5.0

5. เปิด Student Mode:
   /ai-quest/index.html?v=20260611-session250

6. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-session250

วิธีทดสอบ Session 2
-------------------
1. ให้แน่ใจว่า Session 1 มีอย่างน้อย 1 ดาวในเครื่องที่ทดสอบ
2. เปิด Mission Map
3. เลือก Agent Builder หรือกดปุ่ม Session 2
4. เล่นให้จบ
5. เขียน Reflection 3 ข้อ
6. กดส่งผลเข้า Google Sheets
7. Teacher Console เลือก Session 2 แล้ว Refresh
