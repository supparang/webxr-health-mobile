CSAI2102 AI Quest — PATCH v2.6.7 Constructed Review UX Polish
=================================================================

เป้าหมาย
--------
ขัด UX ของ Constructed Review หลัง v2.6.6 ให้ชัดว่า:
- ต้องพิมพ์ก่อนถึงดูคำตอบได้
- Review เป็น optional
- มี checklist ชัดเจน
- ข้ามไป Mission Map ได้เมื่อพร้อม

สิ่งที่แก้
----------
1. Disable ปุ่ม “ดูคำตอบตัวอย่าง”
   - กดไม่ได้จนกว่าพิมพ์เหตุผลครบขั้นต่ำ

2. Character Counter
   - ต้องพิมพ์อย่างน้อย 30 ตัวอักษร
   - ปุ่มจะเปลี่ยนจาก “พิมพ์เพิ่มอีก...” เป็น “ดูคำตอบตัวอย่าง”

3. Self-check Checklist ชัดขึ้น
   - เปลี่ยน checklist เป็น card
   - ใช้สำหรับเทียบคำตอบของตนเอง

4. Optional ชัดขึ้น
   - เพิ่ม notice ว่า Review เป็น optional
   - ถ้าผ่าน S1/S2/B1 แล้วสามารถข้ามได้

5. ปุ่มข้าม Review / ไป Mission Map
   - อยู่ทั้งใน panel และหลังดูคำตอบตัวอย่าง

6. ยังไม่บันทึก graded attempt
   - ไม่ส่ง Google Sheets
   - ไม่กระทบคะแนนจริง

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมด
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. Health ต้องเป็น v2.6.7
5. เปิด:
   /ai-quest/index.html?v=20260611-reviewux267

ตรวจสอบ
--------
- ปุ่มดูคำตอบตัวอย่างต้อง disabled ก่อนพิมพ์
- counter ต้องขึ้น 0/30
- พิมพ์ครบ 30 ตัวอักษรแล้วปุ่มจึงกดได้
- checklist ต้องแสดงเป็นกล่องชัด ๆ
- มีปุ่มข้าม Review / ไป Mission Map
