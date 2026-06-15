CSAI2102 AI Quest — PATCH v3.4.1 Teacher Only Page

ปัญหา:
v3.4.0 มี teacher.html แล้ว แต่ยัง copy โครง index/student UI มา
ทำให้ Run Mode, Division Cards, Mission detail ยังโผล่ใน Teacher

แก้:
1) สร้าง teacher.html ใหม่เป็น Teacher-only จริง ๆ
2) ไม่ใช้ Student Mission Map เป็นฐาน
3) โหลดเฉพาะ:
   - section lock
   - data contract
   - label consistency
   - teacher accuracy
   - teacher console / student detail / production
   - aiquest-teacher-only-dashboard-v341.js
4) เพิ่ม dashboard เฉพาะครู:
   - Overview
   - All Students Detail
   - Phase Analytics
   - Students to Review / Support
   - Misconception / Review Focus Summary
   - Teaching Decision
   - Production Classroom Checklist
   - Google Sheets Status
5) ไม่มี Run Mode / Division Cards / Mission detail / เริ่ม Session ใน teacher.html
6) index.html ยังคงเป็น Student page

เปิด:
Student:
 /ai-quest/index.html?v=20260614-teacheronly341

Teacher:
 /ai-quest/teacher.html?teacher=1&v=20260614-teacheronly341

เช็ก:
AIQUEST_TEACHER_ONLY_DASHBOARD
window.AIQUEST_PAGE_ROLE
