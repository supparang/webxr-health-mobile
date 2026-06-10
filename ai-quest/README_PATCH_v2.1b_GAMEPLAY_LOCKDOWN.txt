CSAI2102 AI Quest — PATCH v2.1b Gameplay Lockdown
===================================================

เป้าหมาย
--------
ล็อก flow ในตัวเกมก่อนเข้าสู่ v2.2 Data Contract เพื่อไม่ให้ต้องย้อนมาแก้ gameplay หลังเริ่มเชื่อม Firebase/Google Sheets จริง

ไฟล์ใน zip
----------
aiquest_patch/
  index.html
  results.html
  teacher-dashboard.html
  session2-agent-preview.html
  js/
    aiquest-gameplay-lockdown-v21b.js
    aiquest-adaptive-coach-v19.js
    aiquest-gate-support-v18.js
    mission1-hard-choice-upgrade.js
    mission2-agent-bank-v21.js
    aiquest-storage.js
    aiquest-cloud-logger.js
  apps-script/
    Code.gs
  README_PATCH_v2.1b_GAMEPLAY_LOCKDOWN.txt

สิ่งที่เพิ่มใน v2.1b
---------------------
1. Run Mode Badge
   - practice
   - graded
   - remedial
   - challenge
   - demo

2. Start Confirm ก่อนเริ่ม Graded Attempt
   - แจ้งว่าเป็นรอบจริง
   - บันทึกเวลา คำตอบ คะแนน และ event logs
   - มีปุ่มเปลี่ยนเป็น Practice

3. Result Status
   - CLEAR
   - PROFICIENT
   - MASTERED
   - NEEDS REMEDIAL

4. Wrong Review grouped by misconception
   - Automation vs AI
   - Sensor vs AI
   - Database/Retrieval vs AI
   - Rule-based vs Learning-based
   - Internet-connected vs AI

5. AI Help 3 levels schema
   - hint_question
   - eliminate_one
   - concept_explain

6. Save Result Lock
   - idle
   - saving
   - saved
   - pending
   - failed
   - duplicate

วิธีทดสอบ
----------
1. อัปโหลดทับ /ai-quest/
2. เปิด /ai-quest/index.html
3. Console ต้องเห็น:
   [AIQuest] v2.1b-gameplay-lockdown loaded

4. ดู Run Mode panel
5. เลือก Graded แล้วกดเริ่ม Session
6. ต้องขึ้น Start Confirm
7. เล่นจนจบ
8. หน้า Result ต้องมี Result Status และ Save Status
9. กด Save Result ซ้ำ ต้องถูกกันไม่ให้ส่งซ้ำ

หมายเหตุ
--------
v2.1b เป็น patch ก่อน Data Contract
หลังผ่าน patch นี้ ค่อยทำ:
v2.2 Data Contract + Classroom Config
v2.3 Firebase/Google Sheets Integration
