CSAI2102 AI Quest — PATCH v2.7.4 Checklist Version Sync
==========================================================

ปัญหาที่แก้
----------
หน้า Production Classroom Checklist ยังเช็ก server ด้วย expected version เก่า
ทำให้เกิดภาพไม่ตรงกัน:
- Checklist แสดง ! Server v2.7.2
- แต่ Google Sheets Status ด้านล่างบอก Server version: v2.7.3

สาเหตุคือ front-end checklist ใน aiquest-production ยัง hardcode expected server version เก่า
ไม่ใช่ปัญหา Apps Script หรือ Google Sheets

สิ่งที่แก้
----------
1. Sync expected server version เป็น v2.7.4
2. อัปเดตข้อความ checklist ให้ตรงกับ patch ปัจจุบัน
3. Apps Script Code.gs เป็น v2.7.4
4. เปลี่ยน cache-bust URL เป็น 20260612-checklist274
5. ระบบ S3 / Teacher Console / Roadmap / Student Status จาก v2.7.3 ยังอยู่ครบ

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy Apps Script เป็น version ใหม่
4. เปิด:
   /ai-quest/index.html?v=20260612-checklist274

ตรวจสอบ
--------
Production Classroom Checklist ต้องแสดง:
- Server v2.7.4 เป็นเครื่องหมายถูก
- Google Sheets Status ต้องแสดง Server version: v2.7.4
- ไม่มีข้อความ Apps Script เป็น v2.7.2 แล้ว
