CSAI2102 AI Quest — PATCH v3.4.4 Teacher Detail Field Mapping

ปัญหา:
Student Detail เปิดได้แล้ว แต่ field mapping ยังไม่ครบ:
- attemptCount ไม่เข้า Attempts
- reflectionComplete true ไม่เข้า Reflection
- risks[] ไม่เข้า Review Focus
- latestScore/bestScore บางจุดยังไม่ map ชัด

แก้:
1) normStudent อ่าน:
   - attemptCount
   - bestScore
   - latestScore
   - helpUsed
   - reflectionComplete
   - mastered
   - risks[]
   - latestReflection
   - misconceptions[]
2) Student Detail แสดง:
   Attempts = attemptCount
   Reflection = ครบ เมื่อ reflectionComplete true
   Review Focus = Focus: automation จาก risks[]
   Mastered badge
   Latest Reflection block
3) Accuracy ถ้าไม่มี correct/total จะแสดง latestScore เป็น score proxy เช่น "93 score"
   ไม่อ้างว่าเป็น correct/total

เปิด:
 /ai-quest/teacher.html?teacher=1&v=20260614-detailmap344

เช็ก:
 AIQUEST_TEACHER_ONLY_DASHBOARD.normStudent(rawRow)
 AIQUEST_TEACHER_ONLY_DASHBOARD.loadStudent12()
