CSAI2102 AI Quest — PATCH v3.2.0 Single Entry Bar

ปัญหา:
มีแถบปุ่มลอย 2 อัน เพราะโหลดทั้ง:
- aiquest-roadmap-click-fix
- aiquest-card-click-native

แก้:
1) เอา aiquest-roadmap-click-fix ออกจากชุดอัปโหลดและ index
2) เหลือเฉพาะ aiquest-card-click-native-v320.js
3) native script จะลบ panel เก่าทิ้ง:
   - roadmapClickFixPanel
   - roadmapDirectEntryPanel
4) เหลือแถบปุ่มลอยเดียวกลางล่าง
5) กดการ์ด S1-S5/B1/B2 เข้าเล่น/replay ได้เหมือนเดิม
6) B2 Specific Bank ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?v=20260612-singlebar320

เช็ก:
 AIQUEST_CARD_CLICK_NATIVE
