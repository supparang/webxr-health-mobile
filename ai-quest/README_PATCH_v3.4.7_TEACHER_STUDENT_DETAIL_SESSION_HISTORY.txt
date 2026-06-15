CSAI2102 AI Quest — PATCH v3.4.7 Teacher Student Detail Session History

เพิ่ม:
1) Student Detail แสดง Session Progress ทุก session:
   - S1 AI Awakening
   - S2 Agent Builder
   - B1 Rookie AI Boss
   - S3 Search Maze
   - S4 Route Cost
   - S5 A* Rescue
   - B2 Search Arena Boss

2) แต่ละ session แสดง:
   - Best
   - Latest
   - Stars
   - Status
   - Attempts
   - Last submitted

3) ถ้า endpoint ยังไม่มี bySession:
   - ใช้ attempts ที่ดึงได้มาสร้าง session table
   - ถ้ายังไม่มี จะใช้ aggregate row เป็น fallback อย่างน้อยกับ B2

4) เพิ่ม console helpers:
   AIQUEST_TEACHER_ONLY_DASHBOARD.sessionHistoryRows(student)
   AIQUEST_TEACHER_ONLY_DASHBOARD.sessionHistoryHTML(student)

เปิด:
 /ai-quest/teacher.html?teacher=1&v=20260614-sessionhistory347
