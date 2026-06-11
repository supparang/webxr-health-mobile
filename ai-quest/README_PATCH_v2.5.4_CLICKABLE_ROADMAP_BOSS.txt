CSAI2102 AI Quest — PATCH v2.5.4 Clickable Roadmap + Rookie Boss
=================================================================

เป้าหมาย
--------
ทำให้ Roadmap ใช้งานแบบเกมจริง:
- ไม่ต้องมีปุ่มเขียวซ้ำด้านบน
- กดการ์ดที่เปิดแล้วเพื่อเข้าเล่นได้เลย
- การ์ดล็อกบอกเงื่อนไขบนการ์ด
- Boss Gate B1 เล่นได้จริงหลังผ่าน S1-S2

สิ่งที่แก้ใน v2.5.4
--------------------
1. Roadmap Clickable Cards
   - S1 card กดเข้า Session 1
   - S2 card กดเข้า Session 2
   - B1 card กดเข้า Rookie AI Boss เมื่อปลดล็อก
   - การ์ด locked กดแล้วแจ้งเงื่อนไข

2. ตัด UX ที่ซ้ำ
   - เอาปุ่มเขียว “เริ่ม Session 1 / เริ่ม Session 2” ออกจาก Roadmap
   - เหลือคำแนะนำ “กดการ์ดที่เปิดแล้วเพื่อเข้าเล่น”

3. Boss Gate
   - B1 เปิดเมื่อผ่าน S1 และ S2 อย่างน้อย 1 ดาว
   - เพิ่ม Rookie AI Boss gameplay จริง
   - ส่งผลเข้า Google Sheets เป็น sessionId=b1 / missionId=b1

4. Student Status
   - เพิ่ม Boss B1: Rookie AI Boss ในสถานะของฉัน

5. Teacher Console
   - เพิ่มตัวเลือก Boss B1 ใน session dropdown

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v254.js
    aiquest-ui-mode-v254.js
    aiquest-session-roadmap-v254.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v254.js
    aiquest-student-detail-v254.js
    aiquest-production-v254.js
  apps-script/
    Code.gs
  README_PATCH_v2.5.4_CLICKABLE_ROADMAP_BOSS.txt

วิธีติดตั้ง
-----------
1. อัปโหลดไฟล์ทั้งหมดใน aiquest_patch ไปทับของเดิม
2. แทนที่ Code.gs ทั้งไฟล์ และ Deploy เป็น New version
3. ทดสอบ .../exec?action=health ต้องเห็น version: v2.5.4
4. เปิด /ai-quest/index.html?v=20260611-click254
