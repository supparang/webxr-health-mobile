CSAI2102 AI Quest — PATCH v2.3.9 Student Detail Polish
=====================================================

เป้าหมาย
--------
ต่อจาก v2.3.8 ที่ล็อก Section = 101 แล้ว
รอบนี้ปรับ Student Detail รายคนให้ครูใช้สอนจริงได้เร็วขึ้น

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  js/
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-student-detail-v239.js
  apps-script/
    Code.gs
  README_PATCH_v2.3.9_STUDENT_DETAIL_POLISH.txt

สิ่งที่เพิ่ม/แก้
----------------
1. Student Detail Summary Card
   - Best Score
   - Latest Score
   - Attempt Count
   - Trend
   - Help Used
   - Reflection Quality

2. Reflection Quality Check
   - ไม่ครบ
   - สั้นเกินไป
   - พอใช้
   - ดี
   โดยดูจาก reflection ล่าสุด 3 ข้อ

3. Recommendation รายคน
   ระบบสรุปคำแนะนำให้อาจารย์ทันที เช่น
   - ควรทำ Remedial
   - Reflection สั้น ต้องเพิ่มเหตุผล
   - automation/sensor/rulebased misconception ควรสอนซ้ำอย่างไร

4. Attempts Table อ่านง่ายขึ้น
   เพิ่ม Gate:
   - Mastery
   - Proficient
   - Clear
   - Remedial

   Boss Display ปรับไม่ให้หลอกตา:
   - ชนะ
   - ชนะ? ตรวจ
   - ไม่ชัด
   - ยังไม่ชนะ
   - ไม่ระบุ

5. Wrong Items / Events to Review
   ย้าย Recent Events ลงล่างเต็มความกว้าง
   แสดง wrong items ก่อน ถ้าไม่มีค่อยแสดง recent events

6. Apps Script v2.3.9
   เพิ่ม field ราย attempt/event ให้ Student Detail ใช้วิเคราะห์ได้ดีขึ้น

วิธีติดตั้ง
-----------
1. อัปโหลด:
   /ai-quest/index.html
   /ai-quest/classroom-config.html
   /ai-quest/js/aiquest-section-lock-v238.js
   /ai-quest/js/aiquest-data-contract-v22.js
   /ai-quest/js/aiquest-student-detail-v239.js

2. Apps Script:
   เอา /aiquest_patch/apps-script/Code.gs ไปแทนที่ Code.gs ทั้งไฟล์

3. Deploy:
   Save
   Deploy > Manage deployments > Edit
   Version: New version
   Deploy

4. ทดสอบ:
   .../exec?action=health
   ต้องเห็น version: v2.3.9

5. เปิด Teacher Mode:
   /ai-quest/index.html?teacher=1&v=20260611-detail239

6. กด View รายคน
   ต้องเห็น Recommendation, Reflection Quality, Gate, Wrong Items
