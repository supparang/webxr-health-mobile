CSAI2102 AI Quest — PATCH v3.0.2 B2 Result + Sync Fix

จาก screenshot พบ:
1) URL ยังใช้ cache เก่า v=20260612-s5astar290
2) Header ยังมีข้อความเก่า S4 UI Consistency
3) หน้า result ของ B2 ยังมีข้อความค้างจาก S3/S5 บางจุด
   - Next บอก S3/S5 ผิดบริบท
   - ปุ่ม feedback บางจุดขึ้น “สรุปผล S3”
   - log prompt บางจุดยังเป็น S4 started/ended
4) Save Status ถ้าส่งไม่สำเร็จยังสื่อสารไม่ชัดกับกล่องเขียว

v3.0.2 แก้:
- Header เป็น v3.0.2 • B2 Result + Sync Fix
- B2 result/coach/wrong review/next path เป็น B2/S6 ถูกบริบท
- B2 version เป็น v3.0.2-boss2-search-arena
- Failed save status แสดงใน saveStatusBox ชัดเจน
- Code.gs APP_VERSION เป็น v3.0.2

ติดตั้ง:
1) อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2) แทนที่ Apps Script Code.gs ทั้งไฟล์
3) Deploy Apps Script เป็น version ใหม่
4) เปิด /ai-quest/index.html?v=20260612-b2fix302
