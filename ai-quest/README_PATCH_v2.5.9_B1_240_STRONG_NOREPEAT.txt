CSAI2102 AI Quest — PATCH v2.5.9 B1 Boss 240 + Strong No-repeat
==================================================================

เป้าหมาย
--------
ทำ Boss B1 แบบ “ไม่ซ้ำสุด ๆ” สำหรับเล่นซ้ำหลายรอบ

B1 Bank ใหม่
------------
- Boss claims = 240 items
- Concept families = 40 families
- Variants ต่อ family = 6
- ครอบคลุม AI vs Automation, Agent Foundation, PEAS, Environment, Rationality และ Final Attack / Responsible AI

Strong No-repeat Engine
-----------------------
1. itemId recent lock = 8 boss attempts
2. family hard cooldown = 3 boss attempts
3. family soft penalty = 8 boss attempts
4. within-run family lock
5. phase-balanced pick
6. adaptive weak-key priority จาก S2 แต่เคารพ no-repeat ก่อน

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v259.js
    boss1-rookie-bank-v259.js
    aiquest-ui-mode-v259.js
    aiquest-session-roadmap-v259.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v259.js
    aiquest-student-detail-v259.js
    aiquest-production-v259.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.9_B1_240_STRONG_NOREPEAT.txt

วิธีติดตั้ง
-----------
1. อัปโหลดไฟล์ทั้งหมดตาม path ใน zip
2. Apps Script: แทนที่ Code.gs ทั้งไฟล์ แล้ว Deploy เป็น New version
3. ทดสอบ .../exec?action=health ต้องเห็น version: v2.5.9
4. เปิด /ai-quest/index.html?v=20260611-boss259

ตรวจใน Console
---------------
AIQUEST_BOSS1_BANK.counts.total ต้องเป็น 240
AIQUEST_BOSS1_BANK.counts.families ต้องเป็น 40
AIQUEST_BOSS1_BANK.resetBoss1History() ใช้ล้างประวัติ B1 ของนักศึกษาปัจจุบันได้
