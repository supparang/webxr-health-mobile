CSAI2102 AI Quest — PATCH v2.6.6 Constructed-response Remedial
==================================================================

ปัญหาที่แก้
----------
v2.6.5 ยังเดาได้ เพราะใน multiple choice คำตอบที่ถูกมักยาวกว่า
นักศึกษาเลือก “ข้อที่ยาวที่สุด” ได้โดยไม่ต้องคิด concept

สิ่งที่แก้ใน v2.6.6
--------------------
1. ตัด multiple choice ออกจาก remedial review
   - ไม่มีตัวเลือกให้เดา
   - ผู้เรียนต้องเขียนเหตุผลก่อน

2. Constructed Response + Self-check
   - อ่าน prompt
   - พิมพ์เหตุผลอย่างน้อย 1 ประโยค
   - กดดูคำตอบตัวอย่าง
   - เทียบ checklist
   - กด “เข้าใจแล้ว” หรือ “ยังสับสน”

3. Review 4 track ยังอยู่ครบ
   - AI vs Automation
   - PEAS
   - Environment
   - Boss Weakness

4. Non-graded เหมือนเดิม
   - ไม่บันทึกคะแนนลง Google Sheets
   - ไม่กระทบ attempt จริง
   - เหมาะเป็น optional review ก่อน S3

5. Family lock ยังอยู่
   - ไม่วน family เดิมซ้ำเร็ว

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมด
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. Health ต้องเป็น v2.6.6
5. เปิด:
   /ai-quest/index.html?v=20260611-constructed266

ตรวจสอบ
--------
- Pre-S3 Review ต้องไม่มี multiple choice
- ต้องมี textarea ให้พิมพ์เหตุผล
- ต้องพิมพ์ก่อนถึงดูคำตอบตัวอย่างได้
- มี checklist ให้ self-check
- ไม่มีการบันทึก graded attempt
