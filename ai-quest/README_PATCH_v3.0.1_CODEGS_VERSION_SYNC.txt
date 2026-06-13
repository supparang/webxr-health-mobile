CSAI2102 AI Quest — PATCH v3.0.1 Code.gs Version Sync

ตรวจพบใน v3.0.0:
- หน้าเว็บ/JS เป็น v3.0.0 แล้ว
- แต่ apps-script/Code.gs ยังประกาศ APP_VERSION = v2.9.1
- ทำให้ health / Production Checklist / Teacher Console อาจโชว์ server version ไม่ตรง

v3.0.1 แก้:
1) Code.gs APP_VERSION เป็น v3.0.1
2) Version comment เป็น v3.0.1
3) อัปเดต cache-bust เป็น 20260612-codefix301
4) โครงสร้าง S3-S5 Max + B2 จาก v3.0.0 ยังอยู่ครบ

ติดตั้ง:
1) อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2) แทนที่ Apps Script Code.gs ทั้งไฟล์
3) Deploy Apps Script เป็น version ใหม่
4) เปิด /ai-quest/index.html?v=20260612-codefix301

ตรวจ:
.../exec?action=health ต้องเห็น version: v3.0.1
