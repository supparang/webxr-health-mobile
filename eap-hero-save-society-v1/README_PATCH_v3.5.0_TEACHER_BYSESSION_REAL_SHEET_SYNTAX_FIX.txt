CSAI2102 AI Quest — PATCH v3.5.0 Teacher bySession Real Sheet + Syntax Fix

ปัญหา:
1) v3.4.9 client console มี SyntaxError ที่ aiquest-teacher-console-v349.js: Unexpected identifier 'FocusCsv'
2) Session Progress ยัง 0/7 เพราะ student.attempts เป็นตัวเลข 51 ไม่ใช่ array attempts ราย session

แก้:
1) bump เป็น v3.5.0 / v350
2) แก้ FocusCsv syntax/shim ใน teacher-console
3) Apps Script สร้าง bySession จาก sheet session_attempts จริง:
   - aq350SheetRows_('session_attempts')
   - aq350AttemptsForStudentFromSheet_(studentId, section)
   - aq350BuildBySessionFromAttempts_()
   - aq350AttachBySessionToStudents_()
4) ถ้า st.attempts เป็น number จะไม่ใช้เป็น source
5) response มี:
   - student.bySession
   - student.sessionSummary
   - student.bySessionSource
   - student.bySessionAttemptRows
   - bySessionServer = v3.5.0

เปิด:
 /ai-quest/teacher.html?teacher=1&v=20260614-bysessionreal350

เช็ก:
1) Console ไม่มี FocusCsv syntax error
2) Google Sheets Status: Server version v3.5.0
3) Show Debug Raw Row มี bySessionSource = session_attempts sheet
4) Session Progress ไม่ควรเป็น 0/7 แล้ว
