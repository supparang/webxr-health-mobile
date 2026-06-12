CSAI2102 AI Quest — PATCH v2.8.1 S4 UI Consistency
=====================================================

ปัญหาที่แก้
----------
หลังเปิดและผ่าน S4 แล้ว UI ยังมีข้อความเก่าบางจุด:
- subtitle ใต้ชื่อเกมยังเขียน Teacher Console Session 3 Option
- ปุ่มบนขวายังเขียน Session 2 ทั้งที่ progress ไปถึง S4 แล้ว
- Roadmap ยังบอก Next: เริ่ม S4 แม้ S4 Passed แล้ว

สิ่งที่แก้
----------
1. Header subtitle เป็น v2.8.1 • S4 UI Consistency • Section 101
2. ปุ่มบนขวาเปลี่ยนจาก Session 2 เป็นปุ่ม Continue แบบ dynamic
   - ยังไม่ผ่าน S1 → Session 1
   - ผ่าน S1 → Session 2
   - ผ่าน S2 → Boss B1
   - ผ่าน B1 → Session 3
   - ผ่าน S3 → Session 4
   - ผ่าน S4 → Replay S4
3. Roadmap หลัง S4 Passed แสดง Next เป็น S5 A* Rescue Mission จะเปิดใน patch ถัดไป
4. Student Start Panel เปลี่ยน wording จาก S1/S2-only เป็น S1–S4 progress
5. Deep link รองรับ session=s1,s2,s3,s4,b1 และ mission=m1,m2,m3,m4,b1

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy Apps Script เป็น version ใหม่
4. เปิด:
   /ai-quest/index.html?v=20260612-s4ui281

ตรวจสอบ
--------
- Header ต้องไม่เขียน Teacher Console Session 3 Option แล้ว
- ปุ่มบนขวาต้องไม่ค้าง Session 2
- ถ้าผ่าน S4 แล้ว Roadmap ต้องบอก S5 / A* Rescue Mission เป็นถัดไป
