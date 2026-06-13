CSAI2102 AI Quest — PATCH v3.0.4 Fire-and-Forget Sync

ปัญหาที่แก้:
- v3.0.3 ยังรอ Google Sheets ก่อนกลับเมนู
- ถ้า AIQuestSync.submitAttempt() ไม่ resolve จริง หน้า result จะค้างที่ “กำลังส่งเข้า Google Sheets...”

v3.0.4 แก้แบบเด็ดขาด:
1) กดส่งแล้วบันทึก local progress ก่อนทันที
2) ไม่ await Google Sheets แล้ว
3) กลับเมนูได้ทันทีหลังบันทึก local
4) Google Sheets sync ทำเบื้องหลังแบบ fire-and-forget
5) ปุ่มไม่ค้าง disabled อีก
6) Code.gs APP_VERSION = v3.0.4

ติดตั้ง:
1) อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2) แทนที่ Apps Script Code.gs ทั้งไฟล์
3) Deploy Apps Script เป็น New version
4) เปิด /ai-quest/index.html?v=20260612-fireforget304

ผลที่ต้องเห็น:
- กดส่งแล้วไม่ค้าง
- ขึ้น “บันทึกในเครื่องแล้ว — กำลังซิงก์ Google Sheets เบื้องหลัง”
- กลับเมนูทันที
