EAP Word Quest v192 Core-Aligned Full Patch
=============================================

สิ่งที่อยู่ในชุดนี้
- index.html ที่ตัด v188 ออกแล้ว
- eap-core-vocabulary-map-v189.js
- eap-word-data-v191-core-aligned-bank.js
- eap-word-engine-v190-core-ai.js
- eap-word-engine-v192-core-bank-controller.js

สถานะ
- Core Vocabulary Map: 290 targets ครบ S1-S15
- Question Bank: 894 item variants
- Boss Gate: BG1-BG4 อย่างละ 18 ข้อ, BG5 24 ข้อ
- AI: Help / Difficulty / Prediction / Feedback Coach / Weak Word / Boss Focus
- Controller: เล่นจาก core bank จริง ไม่ใช้ glossary v188 แล้ว

วิธีติดตั้ง
1) วางไฟล์ทั้งหมดใน /herohealth/eap-word-quest/
2) เปิด index.html?v=20260616-v192-core
3) เปิด Console แล้วรัน:
   Array.from(document.scripts).map(s => s.src).filter(src => src.includes("eap-word") || src.includes("eap-core"))
4) ต้องเห็น v189, v191, v190, v192 และต้องไม่เห็น v188
5) รัน:
   getEapCoreTargetCounts()
   inspectEapCoreQuestionBank()
   inspectEapV192()

ค่าที่ควรเห็น
- getEapCoreTargetCounts().total = 290
- inspectEapCoreQuestionBank().totalItems = 894
- inspectEapV192().hasCoreBank = true

หมายเหตุสำคัญ
- v192 ไม่ลบ logger เดิมและไม่ลบผลเก่า
- ผลใหม่ที่เล่นด้วย controller นี้จะมี source = core-bank-v192
- ถ้าต้องการ reset เฉพาะ progress ของ controller นี้ ให้รัน resetEapCoreV192State()
- Teacher Dashboard จะอ่านผลผ่าน logger/report-core ตามเดิม
