CSAI2102 AI Quest — PATCH v2.3.2 Submit Flow Fix
==================================================

ปัญหาที่แก้
-----------
หลังจบเกมหน้า Result แสดง:
  Save Status: บันทึกแล้ว

แต่ข้อมูลยังไม่เข้า Google Sheets จนกว่าจะกดปุ่ม:
  บันทึกผลและกลับเมนู

ทำให้ผู้เล่น/อาจารย์เข้าใจผิดว่า auto-submit แล้ว ทั้งที่ submit จริงยังอยู่ที่ปุ่ม

สิ่งที่แก้ใน patch นี้
----------------------
1. index.html
   - เมื่อจบเกม แสดง:
     Save Status: พร้อมบันทึกผล
   - เปลี่ยนปุ่มเป็น:
     ส่งผลเข้า Google Sheets และกลับเมนู
   - saveResult() เป็น async
   - กดปุ่มแล้วรอ AIQuestSync.submitAttempt(attempt) จบก่อนค่อยกลับเมนู
   - ถ้าส่งสำเร็จค่อยแสดง:
     Save Status: บันทึกแล้ว
   - ถ้าส่งไม่สำเร็จ ปุ่มจะเปลี่ยนเป็น:
     ลองส่งเข้า Google Sheets อีกครั้ง

2. js/aiquest-gameplay-lockdown-v21b.js
   - idle = พร้อมบันทึกผล
   - failed = บันทึกไม่สำเร็จ
   - duplicate = บันทึกแล้ว

3. js/aiquest-sync-v23.js
   - เปลี่ยน label เป็น v2.3.2
   - ยังใช้ logic Google Sheets-first จาก v2.3.1:
     Firebase OFF หรือไม่มี databaseURL จะไม่ลาก Google Sheets ให้ fail

4. js/aiquest-data-contract-v22.js
   - ปรับ version log เป็น v2.2.2

วิธีติดตั้ง
-----------
อัปโหลดทับไฟล์เหล่านี้:
- /ai-quest/index.html
- /ai-quest/js/aiquest-gameplay-lockdown-v21b.js
- /ai-quest/js/aiquest-sync-v23.js
- /ai-quest/js/aiquest-data-contract-v22.js
- /ai-quest/classroom-config.html

หลังอัปโหลด
-----------
เปิดด้วย cache buster:
  /ai-quest/index.html?v=20260610-submit232

ใน Console ควรเห็น:
  [AIQuest] v2.3.2-google-sheets-submit-flow loaded

Flow ใหม่ที่ถูกต้อง
-------------------
จบเกม:
  Save Status: พร้อมบันทึกผล

กดปุ่ม:
  ส่งผลเข้า Google Sheets และกลับเมนู

ระหว่างส่ง:
  Save Status: กำลังบันทึก...

ส่งสำเร็จ:
  Save Status: บันทึกแล้ว
  Sync v2.3.2: Synced > 0, Failed = 0
  แล้วกลับเมนู

หมายเหตุ
--------
รอบนี้ยังไม่ทำ Auto Submit ทันทีตอนจบเกม
เพื่อกันข้อมูล reflection ไม่ครบ และให้เด็กกดยืนยันรอบ graded ก่อน
