CSAI2102 AI Quest — PATCH v3.3.1 Teacher Dashboard Clean

ปัญหา:
v3.3.0 ยังมี Phase 1 Ready ซ้ำหลายกล่อง และ dashboard core ไม่เรียงเป็นหน้าครูที่อ่านง่าย

แก้:
1) เพิ่ม aiquest-teacher-dashboard-clean-v331.js
2) ย้าย/เรียง dashboard teacher ให้กลับมาเป็นแกนหลัก:
   - All Students Detail
   - Production Classroom Checklist
   - Teaching Decision + Google Sheets Status
   - Phase 1 Classroom Ready Checklist
3) ลบเฉพาะ Phase 1 Ready note ที่เป็น noise
4) ปิด aggressive final polish/dedupe ไม่ให้แทรกหรือลบ layout หลักอีก
5) Teaching Decision เหลือ note เดียว:
   Phase 1 Ready / Next S6
6) ระบบเดิมยังอยู่ครบ

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-clean331

เช็ก:
 AIQUEST_TEACHER_DASHBOARD_CLEAN
 AIQUEST_TEACHER_DASHBOARD_CLEAN.clean()
