CSAI2102 AI Quest — PATCH v3.4.0 Split Teacher / Student Pages

โครงใหม่:
1) /ai-quest/index.html = Student page
2) /ai-quest/teacher.html = Teacher dashboard

Student:
 /ai-quest/index.html?v=20260614-split340

Teacher:
 /ai-quest/teacher.html?teacher=1&v=20260614-split340

สำคัญ:
- ถ้าเปิด index.html?teacher=1 จะ redirect ไป teacher.html
- index.html ไม่โหลด teacher console scripts หลัก
- teacher.html บังคับ teacher=1 และมีปุ่มกลับ Student Page
- index.html มีปุ่มไป Teacher Dashboard
- Apps Script version v3.4.0

เช็ก:
window.AIQUEST_PAGE_ROLE
