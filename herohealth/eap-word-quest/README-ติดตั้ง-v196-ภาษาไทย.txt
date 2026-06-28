EAP Word Quest v196 — Storage Repair + Core Compact Controller

อาการที่แก้:
- localStorage QuotaExceededError
- XP / Max Combo กลับเป็น 0 หลังจบรอบ เพราะ state และ logger เขียนไม่สำเร็จ
- Core progress state โตเกินจำเป็นจากการเก็บ run history / lastResult ซ้ำ

ไฟล์ในชุดนี้ให้วางทับใน:
/herohealth/eap-word-quest/

อัปโหลดทับทั้งหมด 7 ไฟล์:
1. index.html
2. eap-core-vocabulary-map-v189.js
3. eap-word-data-v191-core-aligned-bank.js
4. eap-word-engine-v195-core-ai-student-scoped.js
5. eap-word-engine-v195-stable-score-core-progress.js
6. eap-word-engine-v196-storage-repair.js
7. eap-word-engine-v196-core-compact-progress-controller.js

สำคัญ:
- index.html เวอร์ชันนี้ไม่โหลด v195 core truth controller แล้ว
- v196 จะล้างเฉพาะ cache/state เก่า EAP Word Quest ที่เป็น dev/test และ compact Learning Logs ให้เหลือข้อมูลจำเป็นสำหรับ Teacher/CSV
- Profile จะไม่ถูกลบ
- Core progress ที่ค้างจาก v195 test จะเริ่มจาก Core State ที่เล็กและสะอาด เพื่อป้องกัน legacy/test data ปน

หลังอัปโหลด เปิด:
index.html?v=20260628-v196-storage-repair

Console ทดสอบ:
getEapWordQuestStorageHealth()
inspectEapV196()

ผลที่ควรเห็น:
- ไม่มี Cannot write localStorage / QuotaExceededError
- จบ S1 แล้ว XP มากกว่า 0 เมื่อมีข้อถูก
- Max Combo มากกว่า 0 เมื่อมีตอบถูก
- Core Progress นับเฉพาะ core-bank-v196
