CSAI2102 AI Quest — PATCH v2.3.3 Reflection Required + Capture Fix
====================================================================

ปัญหาที่แก้
-----------
อาจารย์พบว่า:
- ส่งผลเข้า Google Sheets ได้แล้ว
- แต่ reflection1 / reflection2 / reflection3 ไม่เข้า session_attempts

สาเหตุที่เจอใน flow
--------------------
หน้า Result อาจส่ง attempt โดยที่ reflection ยังว่าง
หรือข้อมูล reflection ไม่ถูก lock ก่อน sync

สิ่งที่แก้ใน patch นี้
----------------------
1. index.html
   - เพิ่ม getReflectionValues()
   - เพิ่ม validateReflectionBeforeSubmit()
   - โหมด graded / challenge / remedial ต้องกรอก Reflection ครบก่อนส่ง
   - ถ้ายังไม่กรอกครบ จะไม่ sync และจะ focus ช่องแรกที่ยังว่าง
   - attempt จะใส่:
     reflection1
     reflection2
     reflection3
     reflectionLockedAt
     extraJson.reflections เป็น backup

2. js/aiquest-data-contract-v22.js
   - buildAttempt() อ่าน reflection จาก:
     1) summary.reflection1/2/3
     2) summary.extraJson.reflections
     3) DOM textarea #ref1/#ref2/#ref3
   - กันกรณี reflection หลุดจาก object หลัก

3. js/aiquest-sync-v23.js
   - เปลี่ยน label เป็น v2.3.3
   - logic sync เดิมยังเป็น Google Sheets-first

วิธีติดตั้ง
-----------
อัปโหลดทับไฟล์:
- /ai-quest/index.html
- /ai-quest/js/aiquest-data-contract-v22.js
- /ai-quest/js/aiquest-sync-v23.js

หลังอัปโหลด เปิดด้วย:
- /ai-quest/index.html?v=20260610-reflection233

Flow ใหม่
----------
จบเกม:
  Save Status: พร้อมบันทึกผล

ถ้า Reflection ยังว่าง:
  กดส่งแล้วจะขึ้นเตือน
  "กรุณากรอก Reflection ให้ครบก่อนส่งผลเข้า Google Sheets"

ถ้ากรอกครบ:
  กดส่งผลเข้า Google Sheets และกลับเมนู
  session_attempts จะมี reflection1 / reflection2 / reflection3
