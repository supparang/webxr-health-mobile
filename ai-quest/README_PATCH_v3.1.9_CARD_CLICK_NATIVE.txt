CSAI2102 AI Quest — PATCH v3.1.9 Card Click Native

ปัญหา:
v3.1.8 มีปุ่มลอย แต่การ์ด Roadmap บางใบยังไม่เข้าเกมเมื่อกด

แก้:
1) เพิ่ม aiquest-card-click-native-v319.js
2) ใช้ document-level capture click
3) ตรวจ stage จากข้อความบนการ์ดจริง:
   S1, S2, B1, S3, S4, S5, B2
4) กดการ์ดครั้งเดียวเข้าเล่น/replay ทันที
5) mark card ด้วย cursor/title
6) เพิ่มแถบปุ่มลอยกลางล่าง S1-S5/B1/B2
7) B2 Specific Bank ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?v=20260612-cardclick319

เช็ก:
 AIQUEST_CARD_CLICK_NATIVE
