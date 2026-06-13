CSAI2102 AI Quest — PATCH v3.1.3 B2 Entry Fix

แก้ B2 แสดงว่า Open/Next แต่กดการ์ดแล้วไม่เข้าเล่น:
- เพิ่ม passedByAny(id)
- เพิ่ม boss2Ready() = ผ่าน S3+S4+S5
- isUnlocked(b2) ใช้ boss2Ready()
- กดการ์ด B2 ที่เปิดแล้วเข้า Boss ทันที
- startMission('b2') มี gate เฉพาะ
- Anti-repeat quality + Max banks ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?v=20260612-b2entry313

หรือ deep link:
 /ai-quest/index.html?v=20260612-b2entry313&session=b2
