CSAI2102 AI Quest — PATCH v3.3.2 Teacher Dashboard Safe Restore

ปัญหา:
v3.3.1 ยังย้าย DOM dashboard ผิด ทำให้ Teaching Decision ถูกบีบแคบ
และหน้าครูไม่เป็น dashboard ปกติ

แก้:
1) เพิ่ม aiquest-teacher-dashboard-safe-restore-v332.js
2) ปิด script ที่ย้าย DOM layout หลัก:
   - ไม่ move/reorder dashboard
   - ไม่ inject Phase 1 card ซ้ำ
   - ไม่ delete core dashboard
3) safe restore:
   - unwrap container ที่ script เก่าสร้าง
   - reset inline layout ที่บีบ core blocks
   - remove เฉพาะ Phase 1 Ready noise
   - เหลือ badge ด้านบนพอ
4) ให้ Teacher Console เดิม render layout หลักตามธรรมชาติ
5) ระบบเดิมยังอยู่ครบ

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-saferestore332

สำคัญ:
ถ้ายังเห็น layout เก่าจาก cache ให้ hard reload แล้วกด Dashboard

เช็ก:
 AIQUEST_TEACHER_DASHBOARD_SAFE_RESTORE
 AIQUEST_TEACHER_DASHBOARD_SAFE_RESTORE.clean()
