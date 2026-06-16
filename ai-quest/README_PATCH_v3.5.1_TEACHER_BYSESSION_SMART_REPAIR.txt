CSAI2102 AI Quest — PATCH v3.5.1 Teacher bySession Smart Repair

ปัญหา:
v3.5.0 เอา attempts 51 แถวไปลง S1 ทั้งหมด หรือยังแยก session ไม่ได้
สาเหตุ: session_attempts มี field session ไม่ชัด หรือ mapper อ่าน session ผิด

แก้:
1) ห้ามใช้ plain number "1" เป็น S1 เพื่อกัน attempt number กลายเป็น session
2) infer session จาก content:
   - prompt
   - question
   - reflection1-3
   - phase
   - title
3) คำสำคัญ:
   - Search Arena / Boss2 -> B2
   - A* / heuristic / g(n),h(n),f(n) -> S5
   - Route Cost / UCS / priority queue -> S4
   - Search Maze / BFS / DFS / frontier / visited -> S3
   - Rookie / Final Attack -> B1
   - Agent / PEAS / Environment -> S2
   - Automation / Sensor / Prediction -> S1
4) ถ้า infer ไม่ได้ จะไม่เอาไปลง S1 แต่เก็บ unknownAttemptRows
5) เพิ่ม debug:
   - bySessionSource
   - bySessionAttemptRows
   - unknownAttemptRows
   - sessionKeySamples

เปิด:
 /ai-quest/teacher.html?teacher=1&v=20260616-bysessionrepair351

เช็ก:
1) Server version v3.5.1
2) Session Progress ไม่ควรเอา 51 ไปลง S1 ทั้งหมด
3) ถ้ามี unknown rows ให้เปิด Show Debug Raw Row ดู sessionKeySamples
