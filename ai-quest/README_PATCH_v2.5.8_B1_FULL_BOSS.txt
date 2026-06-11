CSAI2102 AI Quest — PATCH v2.5.8 B1 Rookie AI Boss Full Experience
============================================================================

เป้าหมาย
--------
ทำ Boss B1 ให้เป็น checkpoint จริงหลังผ่าน S1-S2 ไม่ใช่แค่ด่านสรุปสั้น ๆ

สิ่งที่เพิ่มใน v2.5.8
----------------------
1. Boss B1 Question Bank
   - Static curated boss claims: 120 items
   - ครอบคลุม AI vs Automation, Agent, PEAS, Environment, Rationality, Ethics/Explainability

2. Boss B1 No-repeat Engine
   - itemId recent lock
   - familyId recent lock
   - recentWindow = 5 boss attempts
   - กัน claim/context ซ้ำเร็วเกินไป

3. Adaptive Boss
   - อ่าน misconception เด่นจาก S2 weak analysis
   - prioritize claims ที่ตรงกับจุดอ่อนนักศึกษา
   - เช่น PEAS swap, sensor confusion, rationality, observable/dynamic

4. Full Boss Gameplay
   - 6 phases:
     * AI vs Automation
     * Agent Foundation
     * PEAS Gate
     * Environment Gate
     * Rationality Gate
     * Final Attack
   - Boss HP / Player HP
   - Shield
   - Combo
   - Critical Hit
   - Final Attack

5. Learning Feedback หลังตอบ
   - ตอบแล้วไม่ข้ามทันที
   - แสดงคำตอบของนักศึกษา
   - คำตอบที่ควรได้
   - เหตุผล
   - Concept focus / misconception
   - Phase score

6. Google Sheets / Teacher Console Ready
   - ส่ง sessionId=b1 / missionId=b1
   - eventType=boss_answer
   - phase analytics แยก phase ของ Boss ได้
   - misconceptionsJson เก็บ key ที่ผิด

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v258.js
    boss1-rookie-bank-v258.js
    aiquest-ui-mode-v258.js
    aiquest-session-roadmap-v258.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v258.js
    aiquest-student-detail-v258.js
    aiquest-production-v258.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.8_B1_FULL_BOSS.txt

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/student-guide.html
   /ai-quest/teacher-guide.html
   /ai-quest/js/mission2-agent-bank-v258.js
   /ai-quest/js/boss1-rookie-bank-v258.js
   /ai-quest/js/aiquest-ui-mode-v258.js
   /ai-quest/js/aiquest-session-roadmap-v258.js
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-teacher-console-v258.js
   /ai-quest/js/aiquest-student-detail-v258.js
   /ai-quest/js/aiquest-production-v258.js

2. Apps Script:
   แทนที่ Code.gs ทั้งไฟล์
   Save > Deploy > Manage deployments > Edit > New version > Deploy

3. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.5.8

4. เปิด Student Mode:
   /ai-quest/index.html?v=20260611-boss258

5. เงื่อนไข:
   ผ่าน S1 + S2 อย่างน้อย 1 ดาว แล้วกด B1 card

ตรวจใน Console
---------------
AIQUEST_BOSS1_BANK.counts.total ต้องเป็น 120
AIQUEST_BOSS1_BANK.resetBoss1History() ใช้ล้างประวัติ B1 ของนักศึกษาปัจจุบันได้
