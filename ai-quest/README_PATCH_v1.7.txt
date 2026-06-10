CSAI2102 AI Quest v1.7 Hard Choice Upgrade

สิ่งที่เพิ่มจาก v1.6:
1) เพิ่ม /js/mission1-hard-choice-upgrade.js
2) ปรับ Explain Strike 40 ข้อให้เป็น near-miss distractors เดายากขึ้น
3) ปรับ Mini Boss ให้ใช้ claim.distractors แทนตัวเลือกผิดแบบตัดทิ้งง่าย
4) index.html โหลด hard-choice upgrade หลัง mission1-bank.js
5) aiquest-cloud-logger.js ใช้ Apps Script URL ล่าสุดของอาจารย์

วิธีติดตั้ง:
- วาง index.html ทับไฟล์เดิม
- วาง js/mission1-hard-choice-upgrade.js เพิ่มใน /ai-quest/js/
- ใช้ไฟล์ aiquest-storage.js และ aiquest-cloud-logger.js จาก zip นี้ หรือเช็กว่า URL ใน logger ตรงกับ Web App ล่าสุด
- mission1-bank.js ใช้ไฟล์เดิม 120 รายการได้

ทดสอบ:
1. Refresh หน้าเกม
2. เปิด Console ต้องเห็น [AIQuest] v1.7-hard-choice-upgrade loaded
3. เล่น Explain Strike จะเห็นตัวเลือกที่ใกล้เคียงกันมากขึ้น
4. เล่น Mini Boss จะเห็นตัวเลือกผิดแบบมีเหตุผลมากขึ้น
5. Save Result แล้วตรวจ session_attempts และ session_events
