CSAI2102 AI Quest — PATCH v3.1.8 Roadmap Click Fix

ปัญหา:
v3.1.7 โหลดแล้ว แต่ยังเข้าไม่ได้จากหน้ารวม เพราะ panel อยู่ล่าง/ไม่ถูกกด และการ์ดยังใช้ click เดิม

แก้:
1) เพิ่ม aiquest-roadmap-click-fix-v318.js
2) กดการ์ด Roadmap S1-S5/B1-B2 ครั้งเดียวเข้าเล่น/replay ทันที
3) ใช้ capture click + stopImmediatePropagation เพื่อ override click เดิม
4) เพิ่มปุ่มลอยมุมขวาล่าง: S1 S2 B1 S3 S4 S5 เข้า B2
5) ปุ่ม disabled ถ้ายังไม่ผ่าน gate
6) B2 Specific Bank ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?v=20260612-clickfix318

เช็ก:
 AIQUEST_ROADMAP_CLICK_FIX
