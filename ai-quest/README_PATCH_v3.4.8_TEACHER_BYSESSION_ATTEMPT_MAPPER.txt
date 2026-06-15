CSAI2102 AI Quest — PATCH v3.4.8 Teacher bySession Attempt Mapper

ปัญหา:
v3.4.7 Student Detail มี Session Progress แล้ว แต่ขึ้นเฉพาะ B2
แม้ Google Sheets Status แสดงว่า attempts อยู่ที่ data.allStudents[0].attempts

แก้:
1) อ่าน nested raw.attempts / sessionAttempts / allAttempts / attemptRows / history / submissions
2) เพิ่ม attemptSessionKey() เพื่อ map session จากหลาย field:
   sessionId, missionId, missionKey, stageId, title, sessionTitle, missionTitle, label
3) normalizeSessionKey รองรับ:
   m1/session1/AI Awakening -> s1
   m2/Agent Builder -> s2
   boss1/Rookie -> b1
   m3/Search Maze -> s3
   m4/Route Cost -> s4
   m5/A* / Heuristic -> s5
   boss2/Search Arena -> b2
4) รวม best/latest/stars/attempts/lastSubmitted จาก attempts ราย session
5) ใช้ aggregate-current-row เป็น fallback เฉพาะเมื่อไม่มี session จริงเลย

เปิด:
 /ai-quest/teacher.html?teacher=1&v=20260614-bysession348

เช็ก console:
 AIQUEST_TEACHER_ONLY_DASHBOARD.nestedAttemptArrays(AIQUEST_TEACHER_ONLY_DASHBOARD.state.students[0].raw)
 AIQUEST_TEACHER_ONLY_DASHBOARD.sessionHistoryRows(AIQUEST_TEACHER_ONLY_DASHBOARD.state.students[0])
