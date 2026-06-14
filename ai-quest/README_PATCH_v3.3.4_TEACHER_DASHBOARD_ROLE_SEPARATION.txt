CSAI2102 AI Quest — PATCH v3.3.4 Teacher Dashboard Role Separation

ปัญหา:
Teacher Mode ยังแสดง Student/Mission UI เยอะเกินไป เช่น:
- Run Mode
- Division Cards
- Mission detail
- เริ่ม Session
ซึ่งไม่ควรเป็น dashboard หลักของครู

แก้:
1) เพิ่ม aiquest-teacher-role-separation-v334.js
2) ใน Teacher Mode ซ่อน Student/Mission UI โดย default
3) Teacher dashboard เหลือแกนหลัก:
   - All Students Detail
   - Phase Analytics
   - Students to Review / Support
   - Production Classroom Checklist
   - Teaching Decision
   - Google Sheets Status
4) เพิ่ม notice:
   Teacher Dashboard + ปุ่ม Preview Student/Mission UI
5) ถ้าครูต้องการ preview ด่าน สามารถกด Preview ได้
6) ไม่แตะ layout หลัก / ไม่ย้าย DOM dashboard

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-teacherrole334

เช็ก:
 AIQUEST_TEACHER_ROLE_SEPARATION
 AIQUEST_TEACHER_ROLE_SEPARATION.refresh()
