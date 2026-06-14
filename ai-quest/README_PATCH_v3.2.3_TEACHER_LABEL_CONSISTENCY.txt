CSAI2102 AI Quest — PATCH v3.2.3 Teacher Label Consistency

ปัญหา:
หน้า Teacher/Production Checklist แสดง M1 ทั้งที่ระบบผู้ใช้เรียกเป็น S1
ทำให้อาจารย์สับสนว่า M1 คืออะไร

คำอธิบาย:
M1 เป็น internal mission id ของ S1 AI Awakening
แต่ user-facing label ต้องเป็น S1

แก้:
1) เปลี่ยน label ที่แสดงผล M1 -> S1
2) เพิ่ม aiquest-label-consistency-v323.js เพื่อ normalize label บนหน้า teacher/runtime
3) ไม่แตะ internal key m1 เพื่อไม่ให้ progress/storage พัง
4) B2 Native, Submit Return Fix, B2 Specific Bank ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-label323

เช็ก:
 AIQUEST_LABEL_CONSISTENCY
