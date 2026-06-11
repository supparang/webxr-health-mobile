CSAI2102 AI Quest — PATCH v2.6.5 Remedial Diagnostic Review
=================================================================

ปัญหาที่แก้
----------
v2.6.4 กันซ้ำดีขึ้นแล้ว แต่ตัวเลือกใน Review ยังง่ายเกินไป:
- ตัวเลือกขึ้นต้นด้วยคำว่า “ถูก/ไม่ถูก”
- คำตอบที่ถูกเดาได้จากรูปประโยค
- ไม่เหมาะใช้เป็น remedial จริง

สิ่งที่แก้ใน v2.6.5
--------------------
1. AI vs Automation เปลี่ยนเป็น Diagnostic Bank ใหม่
   - ไม่ใช้ raw boss claims แล้ว
   - มีโจทย์วินิจฉัย 12 families
   - ตัวเลือกทุกข้อเป็นเหตุผลที่ดู plausible

2. เอา prefix “ถูก/ไม่ถูก” ออกจากตัวเลือก
   - ให้ผู้เรียนเลือก “เหตุผลที่ดีที่สุด”
   - ไม่ใช่เดาจากคำขึ้นต้น

3. Distractors ยากขึ้น
   - เช่น simple reflex vs automation
   - sensor vs agent
   - software agent vs robot-only
   - prediction vs action
   - rule-based vs learning

4. Boss Weakness Diagnostic ดีขึ้น
   - แปลง raw boss answer เป็น reasoning options
   - distractors แยกตาม phase: PEAS / Environment / Rationality / Responsible AI

5. ยังเป็น Optional + non-graded
   - ไม่บันทึก Google Sheets
   - Teacher Mode ไม่เห็น panel
   - ใช้สำหรับทบทวนก่อน S3 เท่านั้น

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมด
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. Health ต้องเป็น v2.6.5
5. เปิด:
   /ai-quest/index.html?v=20260611-diagnostic265

ตรวจสอบ
--------
- AI vs Automation Review ต้องไม่มีตัวเลือกที่ขึ้นต้นด้วย “ถูก เพราะ...” / “ไม่ถูก...”
- ตัวเลือกต้องเป็นเหตุผลที่ใกล้เคียงกันมากขึ้น
- ต้องเห็นข้อความ “เลือกเหตุผลที่ดีที่สุด”
- ยังมี family lock และ recent family memory
