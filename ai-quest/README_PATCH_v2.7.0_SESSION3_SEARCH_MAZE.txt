CSAI2102 AI Quest — PATCH v2.7.0 Session 3 Search Maze
==========================================================

เป้าหมาย
--------
เปิด Session 3 จริงหลังผ่าน S1 → S2 → B1:
S3 Search Maze สำหรับหัวข้อ State Space, BFS, DFS, Frontier, Visited และ Goal Test

สิ่งที่เพิ่ม
------------
1. เปิด S3 ใน Mission Map และ Roadmap
   - S3 เปิดเมื่อผ่าน B1 Rookie AI Boss
   - กดการ์ด S3 แล้วเข้าเล่นได้จริง

2. Search Maze Gameplay
   - Phase 1: State Space
   - Phase 2: BFS/DFS Trace
   - Phase 3: Maze Path
   - Phase 4: Search Boss

3. S3 Question Bank
   - State Space items
   - Graph BFS/DFS trace items
   - Maze path items
   - Search Boss claims
   - มี no-repeat history ของ S3

4. Learning feedback หลังตอบ
   - แสดงคำตอบของผู้เรียน
   - คำตอบที่ควรได้
   - เหตุผล
   - phase/family

5. Google Sheets Ready
   - sessionId=s3
   - missionId=m3
   - event log แยก phase
   - phaseAnalytics ส่งเข้า extraJson

6. Reflection เฉพาะ S3
   - state/initial/actions/goal
   - BFS vs DFS frontier
   - การใช้ search ใน Mini Project

ไฟล์ใน patch
------------
aiquest_patch/
  index.html
  classroom-config.html
  student-guide.html
  teacher-guide.html
  js/
    mission2-agent-bank-v270.js
    boss1-rookie-bank-v270.js
    search3-maze-bank-v270.js
    aiquest-remedial-path-v270.js
    aiquest-ui-mode-v270.js
    aiquest-session-roadmap-v270.js
    aiquest-section-lock-v238.js
    aiquest-data-contract-v22.js
    aiquest-teacher-console-v270.js
    aiquest-student-detail-v270.js
    aiquest-production-v270.js
  apps-script/
    Code.gs
  README_PATCH_v2.7.0_SESSION3_SEARCH_MAZE.txt

ติดตั้ง
-------
1. อัปโหลดไฟล์ทั้งหมด
2. แทนที่ Apps Script Code.gs ทั้งไฟล์
3. Deploy > New version
4. Health ต้องเป็น v2.7.0
5. เปิด:
   /ai-quest/index.html?v=20260611-s3maze270

ตรวจสอบ
--------
Student Mode:
- S3 card ต้องเปิดเมื่อผ่าน B1
- กด S3 แล้วเข้า Search Maze
- เล่นจนจบแล้วส่งผลได้เป็น sessionId=s3 / missionId=m3

Teacher Mode:
- เลือก Session 3 ใน Teacher Console ได้หลังมีข้อมูล
- Phase Analytics ต้องเห็น State Space / BFS/DFS Trace / Maze Path / Search Boss
