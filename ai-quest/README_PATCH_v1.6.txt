CSAI2102 AI Quest v1.6 Google Sheets Events Patch

ไฟล์ใน zip นี้:
- index.html : ตัวเต็มล่าสุด แก้ logEvent ให้อยู่ถูกตำแหน่ง + ส่ง attempt.events เข้า Google Sheets
- results.html : Dashboard ดู local attempts / export / sync pending
- js/aiquest-storage.js : Student profile + local attempts + pending queue
- js/aiquest-cloud-logger.js : ส่ง Google Sheets โดยใส่ Apps Script URL ของอาจารย์แล้ว
- apps-script/Code.gs : Apps Script สำหรับสร้าง/รับข้อมูล 4 tabs

หมายเหตุ:
- ไฟล์ js/mission1-bank.js ไม่ได้รวมใน zip นี้ เพราะใช้ไฟล์เดิม 120 รายการของอาจารย์ ไม่ได้แก้ใน patch รอบนี้
- ให้วางไฟล์ทั้งหมดใน /ai-quest/ ตามโครงสร้างเดิม และคง /ai-quest/js/mission1-bank.js ตัวเดิมไว้

ทดสอบ:
1) กรอก Student Profile
2) กด Save Profile
3) กด Test Cloud
4) เล่น Session 1 จนจบ
5) กด Save Result
6) ตรวจ Google Sheet: session_attempts ต้องมีแถว และ session_events ต้องมีหลายแถว
