CSAI2102 AI Quest — PATCH v2.3.1 Google Sheets First
====================================================

ไฟล์ที่ต้องอัปโหลดทับ:
- /ai-quest/js/aiquest-sync-v23.js
- /ai-quest/js/aiquest-data-contract-v22.js
- /ai-quest/classroom-config.html

แก้ปัญหา:
- Firebase databaseURL missing แล้วทำให้ Google Sheets ไม่ไปต่อ
- Save Status ค้าง "กำลังบันทึก..."

หลังอัปโหลด:
1. เปิด /ai-quest/classroom-config.html
2. ตั้ง Google Sheets = ON
3. ตั้ง Firebase = OFF
4. Save Config
5. เปิดหน้าเกม แล้ว Console รัน:
   localStorage.removeItem('CSAI2102_AIQUEST_SYNC_V23')
6. Refresh แล้วทดสอบเล่นใหม่

สถานะที่ถูกต้อง:
- Console ต้องเห็น [AIQuest] v2.3.1-google-sheets-first-sync loaded
- Sync v2.3.1: Failed = 0, Synced > 0, Last Sync มีเวลา
