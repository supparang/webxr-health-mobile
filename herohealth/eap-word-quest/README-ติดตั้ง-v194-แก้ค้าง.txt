EAP Word Quest v194 — Stability + Score Fix

ปัญหาที่แก้
- หน้าเกมค้างหลังเลือกตัวเลือก
- Console ขึ้นซ้ำ ๆ ว่า v190 / v193 logger bridge ready
- XP / Combo บางรอบกลายเป็น 0

สาเหตุ
v190 และ v193 ต่างกัน wrap logger ซ้ำใน setInterval จึง wrap กันเองต่อเนื่อง
และ v193 ใช้ MutationObserver ที่เสี่ยง render loop ตอน Summary

วิธีติดตั้ง
1) อัปโหลด index.html จาก zip นี้ไปทับ
2) อัปโหลด eap-word-engine-v194-stability-score-fix.js ไปโฟลเดอร์เดียวกัน
3) ห้ามให้ index.html โหลด eap-word-engine-v193-score-combo-recovery.js อีก
4) Hard Reload / เปิดด้วย
   index.html?v=20260628-v194-stable1

สิ่งที่ต้องเห็นใน Console
[EAP Word Quest] v194 single logger bridge ready
[EAP Word Quest] v194 stability + score fix ready

สิ่งที่ต้องไม่เห็นอีก
v193 logger reward bridge ready ซ้ำ ๆ
Core AI logger bridge ready ซ้ำ ๆ ทุกไม่กี่วินาที

ทดสอบ
- เริ่ม S1
- กดคำตอบ 1 ตัวเลือก
- Feedback ต้องขึ้นทันที
- ปุ่ม ข้อต่อไป ต้องกดได้
- Score ต้องมากกว่า 0 เมื่อถูกอย่างน้อย 1 ข้อ
- จบรอบแล้ว Summary ต้องขึ้น XP earned this round

Console test
inspectEapV194()
getEapV194RewardPreview()
