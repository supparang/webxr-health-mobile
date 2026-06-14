CSAI2102 AI Quest — PATCH v3.2.4 Teacher Accuracy Fix

ปัญหา:
หน้า Teacher Student Detail แสดง Attempts:
Score = 100 แต่ Accuracy = 0

สาเหตุ:
attempt row มี score แต่ field accuracy ไม่มี/เป็น 0
ตารางอ่าน accuracy ตรง ๆ โดยไม่ fallback จาก score หรือ correct/total

แก้:
1) เพิ่ม aiquest-teacher-accuracy-fix-v324.js
2) accuracy display fallback:
   - ใช้ accuracy ถ้ามีค่า > 0
   - ถ้ามี correct/total ให้คำนวณ correct / total * 100
   - ถ้า accuracy ไม่มี แต่ score มีค่า ให้ใช้ score เป็น accuracy
3) patch runtime table cells ที่ Accuracy เป็น 0 แต่ Score > 0
4) patch student detail/teacher console helper displayAccuracyV324
5) Teacher Label Consistency และ B2 fixes ยังอยู่ครบ

เปิด:
 /ai-quest/index.html?teacher=1&v=20260614-accuracy324

เช็ก:
 AIQUEST_TEACHER_ACCURACY_FIX
 AIQUEST_TEACHER_ACCURACY_FIX.refresh()
