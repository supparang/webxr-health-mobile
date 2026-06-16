CSAI2102 AI Quest — PATCH v3.4.9 Teacher bySession Server Summary

ปัญหา:
v3.4.8 เห็น attempts=data.allStudents[0].attempts แต่ Session Progress ยังขึ้นเฉพาะ B2
เพราะ client ยัง map session จาก attempts ได้ไม่ครบ

แก้ฝั่ง Apps Script:
1) เพิ่ม aq349BuildBySessionFromAttempts_()
2) เพิ่ม aq349SessionKey_()
3) เพิ่ม aq349AttachBySessionToStudents_()
4) teacherConsole response จะ attach:
   - student.bySession
   - student.sessionSummary
   - bySessionServer = v3.4.9

bySession มี:
s1, s2, b1, s3, s4, s5, b2

แต่ละ session มี:
bestScore, latestScore, stars, status, attempts, lastSubmitted, source

เปิด:
 /ai-quest/teacher.html?teacher=1&v=20260614-bysessionserver349

เช็ก:
1) Google Sheets Status: Server version v3.4.9
2) Show Debug Raw Row: ต้องมี bySession หรือ sessionSummary
3) Student Detail > Session Progress ต้องไม่ขึ้นเฉพาะ B2 แล้ว
