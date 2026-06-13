CSAI2102 AI Quest — PATCH v3.0.3 Sync Timeout Fix

ปัญหาที่แก้:
- หลังกรอก Reflection แล้วปุ่มค้าง “กำลังส่งเข้า Google Sheets...”
- saveStatusBox ค้าง “กำลังบันทึก...”
- ถ้า AIQuestSync / Apps Script / network ไม่ตอบกลับ promise จะค้างและผู้เรียนไปต่อไม่ได้

v3.0.3 แก้:
1) เพิ่ม withTimeout() ให้ Google Sheets sync ไม่ค้างเกิน 15 วินาที
2) บันทึก local progress ด้วย saveState() ก่อน network sync
3) ถ้า Google Sheets timeout/fail:
   - ปุ่มกลับมาให้กดส่งอีกครั้ง
   - saveStatusBox แจ้งว่า “บันทึกในเครื่องแล้ว แต่ Google Sheets ไม่สำเร็จ”
4) ถ้าส่งสำเร็จ:
   - ปุ่มไม่ค้าง disabled
   - กลับเมนูได้ปกติ
5) Code.gs APP_VERSION = v3.0.3

ติดตั้ง:
1) อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2) แทนที่ Apps Script Code.gs ทั้งไฟล์
3) Deploy Apps Script เป็น New version
4) เปิด /ai-quest/index.html?v=20260612-syncfix303

ตรวจ:
- กดส่งแล้วไม่ควรค้างเกิน 15 วินาที
- ถ้า Google Sheets ไม่ตอบ ต้องขึ้นให้ลองส่งอีกครั้ง
