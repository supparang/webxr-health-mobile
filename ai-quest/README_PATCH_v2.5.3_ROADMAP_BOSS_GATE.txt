CSAI2102 AI Quest — PATCH v2.5.3 Roadmap + Boss Gate
======================================================

เป้าหมาย
--------
ปรับหน้าให้เห็นชัดว่า:
1. มีทั้งหมดกี่ session
2. ตอนนี้เปิดแล้วกี่ session
3. ผ่านแล้วกี่ session
4. ผ่านเกณฑ์เปิด Boss หรือยัง
5. Boss ควรเปิดหลังผ่านกี่ session

คำตอบเชิงออกแบบเกม
-------------------
ช่วงต้นรายวิชาควรมี Boss หลังผ่าน 2 sessions:
- S1: AI Awakening
- S2: Agent Builder
- B1: Rookie AI Boss

เหตุผล:
S1+S2 เป็น foundation ของรายวิชา ถ้าผ่านสองเรื่องนี้แล้วควรมี boss เพื่อเช็กว่าเข้าใจ AI Overview + Intelligent Agent จริง ก่อนขึ้น Search / Problem Solving

หลังจากนั้น Boss ใช้ทุก 3 sessions ตาม division:
- B2 หลัง S3-S5
- B3 หลัง S6-S8
- B4 หลัง S9-S11
- B5 หลัง S12-S15

สิ่งที่เพิ่มใน v2.5.3
----------------------
1. AI Quest Roadmap Panel
   - 15 Sessions + 5 Boss Gates
   - Sessions เปิดในระบบตอนนี้
   - Sessions ที่ผ่านแล้ว
   - Boss Gates ที่เปิดแล้ว
   - Boss Rule

2. Boss Gate Logic ในหน้า UI
   - B1 เปิดเมื่อผ่าน S1 และ S2 อย่างน้อย 1 ดาว
   - แสดง Boss Locked / Boss Gate Open

3. Roadmap Cards
   - S1-S15
   - B1-B5
   - Open / Passed / Mastery / Locked / Boss Gate Open

4. ปุ่มลัดใน Roadmap
   - เริ่ม Session 1
   - เริ่ม Session 2
   - ดูเกณฑ์ Boss

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v253.js
    aiquest-ui-mode-v253.js
    aiquest-session-roadmap-v253.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v253.js
    aiquest-student-detail-v253.js
    aiquest-production-v253.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.3_ROADMAP_BOSS_GATE.txt

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/mission2-agent-bank-v253.js
   /ai-quest/js/aiquest-ui-mode-v253.js
   /ai-quest/js/aiquest-session-roadmap-v253.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v253.js
   /ai-quest/js/aiquest-student-detail-v253.js
   /ai-quest/js/aiquest-production-v253.js

2. Apps Script:
   แทนที่ Code.gs ทั้งไฟล์
   Save > Deploy > Manage deployments > Edit > New version > Deploy

3. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.5.3

4. เปิด:
   /ai-quest/index.html?v=20260611-roadmap253

สิ่งที่ควรเห็น
---------------
- หัวเว็บ v2.5.3
- Panel: AI Quest Roadmap: 15 Sessions + Boss Gates
- Sessions เปิดในระบบตอนนี้ = 2/15
- ผ่านแล้วตาม progress จริง
- Boss Rule: B1 เปิดหลังผ่าน Session 1–2
