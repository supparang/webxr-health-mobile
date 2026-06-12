CSAI2102 AI Quest — PATCH v3.0.0 Search Arena Boss B2

ทำ S3-S5 และ B2 ให้สุดก่อนข้ามไป S6

เพิ่ม/ปรับ:
1) S3 Max Search Bank คงอยู่ (>440 effective tasks)
2) S4 Max UCS Bank: concept + weighted graph maps + generated trace/path/frontier/BFS-vs-UCS + boss claims รวม >340
3) S5 Max A* Bank: concept + A* maps + trace/path/greedy compare/heuristic debug + boss claims รวม >340
4) เปิด B2 Search Arena Boss จริงหลังผ่าน S3/S4/S5
5) B2 ส่งผล sessionId=b2 / missionId=b2
6) Teacher Console รองรับ Boss B2 และ phase analytics

ติดตั้ง:
1) อัปโหลดไฟล์ทั้งหมดใน aiquest_patch
2) แทนที่ Apps Script Code.gs ทั้งไฟล์
3) Deploy Apps Script เป็น version ใหม่
4) เปิด /ai-quest/index.html?v=20260612-b2search300

เช็ก Console:
AIQUEST_SEARCH3_BANK.counts
AIQUEST_ROUTE4_BANK.counts
AIQUEST_ASTAR5_BANK.counts
AIQUEST_BOSS2_BANK.counts
